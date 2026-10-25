import { Router } from 'express';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, sendData } from '../utils/http.js';

const router = Router();

router.use(authenticate);

router.get(
    '/',
    asyncHandler(async (req, res) => {
        // Admin can view all active users.
        // Other users can view active users in their own workspace only.
        const filter = {
            is_active: true,
        };

        if (req.user.role !== 'admin') {
            filter.workspace_id = req.user.workspace_id;
        }

        const users = await User.find(filter)
            .select('name email role avatar_color created_at workspace_id')
            .sort({ name: 1 })
            .lean();

        console.log(
            'Team members returned:',
            users.map((user) => ({
                id: String(user._id),
                name: user.name,
                role: user.role,
                workspace_id: String(user.workspace_id || ''),
            })),
        );

        sendData(
            res,
            users.map((user) => ({
                ...user,
                id: String(user._id),
            })),
        );
    }),
);

export default router;