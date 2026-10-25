import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, HttpError, sendData, objectId } from '../utils/http.js';

const router = Router();

router.use(authenticate);

const userIdSchema = z.string().refine(
  (value) => objectId(value),
  'Invalid user ID',
);

// Return conversation details without exposing internal direct_key.
async function getConversation(conversationId, workspaceId, userId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  })
    .populate('participants', 'name role avatar_color')
    .lean();

  if (!conversation) return null;

  // Direct conversations may span workspaces.
  // Group conversations remain restricted to their workspace.
  if (
    conversation.type !== 'direct' &&
    String(conversation.workspace_id) !== String(workspaceId)
  ) {
    return null;
  }

  return conversation;
}

// GET /api/conversations
// Logged-in user's conversation list.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({
      participants: req.user.id,
      $or: [
        { type: 'direct' },
        { workspace_id: req.user.workspace_id },
      ],
    })
      .populate('participants', 'name role avatar_color')
      .sort({ last_message_at: -1, updated_at: -1 })
      .lean();

    sendData(
      res,
      conversations.map((conversation) => ({
        ...conversation,
        id: String(conversation._id),
      })),
    );
  }),
);

// POST /api/conversations/direct
// Body: { "user_id": "<team member ID>" }
router.post(
  '/direct',
  validate(
    z.object({
      user_id: userIdSchema,
    }).strict(),
  ),
  asyncHandler(async (req, res) => {
    const currentUserId = req.user.id;
    const otherUserId = req.body.user_id;

    if (currentUserId === otherUserId) {
      throw new HttpError(400, 'You cannot start a chat with yourself');
    }

    const otherUserFilter = {
      _id: otherUserId,
      is_active: true,
    };

    // Admin can find users across workspaces.
    // Other users remain restricted to their own workspace.
    if (req.user.role !== 'admin') {
      otherUserFilter.workspace_id = req.user.workspace_id;
    }

    const otherUser = await User.findOne(otherUserFilter)
      .select('_id workspace_id')
      .lean();

    if (!otherUser) {
      throw new HttpError(404, 'Team member not found');
    }

    const participantIds = [currentUserId, otherUserId].sort();
    const directKey = participantIds.join(':');

    let conversation;

    try {
      conversation = await Conversation.findOneAndUpdate(
        {
          workspace_id: req.user.workspace_id,
          type: 'direct',
          direct_key: directKey,
        },
        {
          $setOnInsert: {
            workspace_id: req.user.workspace_id,
            type: 'direct',
            participants: participantIds,
            created_by: currentUserId,
            direct_key: directKey,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );
    } catch (error) {
      // Concurrent requests may attempt to create the same direct chat.
      if (error?.code !== 11000) throw error;

      conversation = await Conversation.findOne({
        workspace_id: req.user.workspace_id,
        type: 'direct',
        direct_key: directKey,
      });
    }

    const populated = await getConversation(
      conversation._id,
      req.user.workspace_id,
      currentUserId,
    );

    sendData(
      res,
      {
        ...populated,
        id: String(populated._id),
      },
      201,
    );
  }),
);

// POST /api/conversations/group
// Body: { "name": "Sales Team", "participant_ids": ["<user ID>"] }
router.post(
  '/group',
  validate(
    z.object({
      name: z.string().trim().min(2).max(120),
      participant_ids: z.array(userIdSchema).min(1).max(49),
    }).strict(),
  ),
  asyncHandler(async (req, res) => {
    const currentUserId = req.user.id;

    const participantIds = [
      ...new Set([
        currentUserId,
        ...req.body.participant_ids,
      ]),
    ];

    if (participantIds.length < 2) {
      throw new HttpError(400, 'A group requires at least two members');
    }

    const validUsers = await User.find({
      _id: { $in: participantIds },
      workspace_id: req.user.workspace_id,
      is_active: true,
    }).select('_id').lean();

    if (validUsers.length !== participantIds.length) {
      throw new HttpError(
        400,
        'One or more team members are invalid or inactive',
      );
    }

    const conversation = await Conversation.create({
      workspace_id: req.user.workspace_id,
      type: 'group',
      name: req.body.name,
      participants: participantIds,
      created_by: currentUserId,
    });

    const populated = await getConversation(
      conversation._id,
      req.user.workspace_id,
      currentUserId,
    );

    sendData(
      res,
      {
        ...populated,
        id: String(populated._id),
      },
      201,
    );
  }),
);

// GET /api/conversations/:id
// A user can only access a conversation they participate in.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!objectId(req.params.id)) {
      throw new HttpError(400, 'Invalid conversation ID');
    }

    const conversation = await getConversation(
      req.params.id,
      req.user.workspace_id,
      req.user.id,
    );

    if (!conversation) {
      throw new HttpError(404, 'Conversation not found');
    }

    sendData(res, {
      ...conversation,
      id: String(conversation._id),
    });
  }),
);

export default router;
