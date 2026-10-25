import { Router } from 'express';
import { z } from 'zod';

import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../middleware/audit.js';
import {
  asyncHandler,
  HttpError,
  sendData,
  objectId,
} from '../utils/http.js';

const router = Router();

router.use(authenticate);

const conversationBodySchema = z.object({
  conversation_id: z.string().refine(objectId, 'Invalid conversation ID'),
  content: z.string().trim().min(1).max(4000),
}).strict();

async function requireConversation(conversationId, user) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: user.id,
  }).lean();

  if (!conversation) {
    throw new HttpError(404, 'Conversation not found');
  }

  // Group chats remain restricted to their workspace.
  if (
    conversation.type !== 'direct' &&
    String(conversation.workspace_id) !== String(user.workspace_id)
  ) {
    throw new HttpError(404, 'Conversation not found');
  }

  return conversation;
}

// GET /api/messages?conversation_id=<id>
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversationId = req.query.conversation_id;

    if (!objectId(conversationId)) {
      throw new HttpError(400, 'A valid conversation_id is required');
    }

    const conversation = await requireConversation(
      conversationId,
      req.user,
    );

    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.limit) || 100),
    );

    const data = await Message.find({
      workspace_id: conversation.workspace_id,
      conversation_id: conversationId,
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    sendData(
      res,
      data.reverse().map((message) => ({
        ...message,
        id: String(message._id),
      })),
    );
  }),
);


/* POST /api/messages */
router.post(
  '/',
  validate(conversationBodySchema),
  asyncHandler(async (req, res) => {
    const { conversation_id: conversationId, content } = req.body;

    const conversation = await requireConversation(
      conversationId,
      req.user,
    );

    const item = await Message.create({
      workspace_id: conversation.workspace_id,
      conversation_id: conversation._id,
      sender_id: req.user.id,
      sender_name: req.user.name,
      content,
    });

    await Conversation.updateOne(
      {
        _id: conversation._id,
        participants: req.user.id,
      },
      {
        $set: {
          last_message: content,
          last_message_at: item.created_at,
        },
      },
    );

    await audit(req, 'create', 'message', item._id);

    const payload = {
      ...item.toObject(),
      id: String(item._id),
      conversation_id: String(conversation._id),
    };

    const io = req.app.get('io');

    if (io) {
      // Notify other participants once.
      for (const participantId of conversation.participants) {
        const recipientId = String(participantId);

        if (recipientId !== String(req.user.id)) {
          io.to(`user:${recipientId}`).emit('notification:new', {
            type: 'message',
            id: String(item._id),
            message_id: String(item._id),
            conversation_id: String(conversation._id),
            sender_id: String(req.user.id),
            sender_name: item.sender_name,
          });
        }
      }

      // Deliver the message to connected members of this conversation room.
      io.to(`conversation:${conversation._id}`).emit(
        'message:new',
        payload,
      );
    }

    return res.status(201).json({ message: payload });
  }),
);


// DELETE /api/messages/:id
router.delete(
  '/:id',
  allowRoles('admin', 'manager'),
  asyncHandler(async (req, res) => {
    if (!objectId(req.params.id)) {
      throw new HttpError(400, 'Invalid message ID');
    }

    const item = await Message.findOne({
      _id: req.params.id,
    });

    if (!item) {
      throw new HttpError(404, 'Message not found');
    }

    if (!item.conversation_id) {
      throw new HttpError(409, 'Legacy message cannot be deleted through conversation chat');
    }

    await requireConversation(String(item.conversation_id), req.user);

    await Message.deleteOne({ _id: item._id });

    await audit(req, 'delete', 'message', item._id);

    req.app.get('io')
      .to(`conversation:${item.conversation_id}`)
      .emit('message:deleted', { id: String(item._id) });

    sendData(res, { deleted: true });
  }),
);

export default router;
