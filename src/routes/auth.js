import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import RefreshSession from '../models/RefreshSession.js';
import { env, isProduction } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, HttpError, sendData } from '../utils/http.js';
import Workspace from '../models/Workspace.js';

const router = Router();
const loginSchema = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(200) }).strict();

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string()
    .min(8)
    .max(200),
}).strict();

const cookieOptions = () => ({ httpOnly: true, secure: env.COOKIE_SECURE === 'true' || isProduction, sameSite: env.COOKIE_SAME_SITE, path: '/api/auth', maxAge: env.REFRESH_TOKEN_DAYS * 86400000 });
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const issueAccess = (user) => jwt.sign({ typ: 'access', wid: String(user.workspace_id), role: user.role }, env.JWT_ACCESS_SECRET, {
  subject: String(user._id), issuer: 'estateflow-api', audience: 'estateflow-client', algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL
});
async function issueRefresh(user, req, res) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expires = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000);
  await RefreshSession.create({ user_id: user._id, token_hash: hashToken(token), expires_at: expires, user_agent: (req.get('user-agent') || '').slice(0, 300), ip: req.ip });
  res.cookie('estateflow_refresh', token, cookieOptions());
}

router.post(
  '/signup',
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email }).select('_id');

    if (existingUser) {
      throw new HttpError(409, 'An account with this email already exists');
    }

    // Each public signup gets a separate workspace.
    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
    });

    try {
      const password_hash = await bcrypt.hash(password, 12);

      // Never accept a role or workspace_id from the client.
      const user = await User.create({
        name,
        email,
        password_hash,
        workspace_id: workspace._id,
        role: 'user',
      });

      await issueRefresh(user, req, res);

      sendData(res, {
        accessToken: issueAccess(user),
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          workspace_id: String(user.workspace_id),
        },
      }, 201);
    } catch (error) {
      // Avoid leaving an empty workspace if account creation fails.
      await Workspace.deleteOne({ _id: workspace._id }).catch(() => { });

      if (error?.code === 11000) {
        throw new HttpError(409, 'An account with this email already exists');
      }

      throw error;
    }
  }),
);

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, is_active: true }).select('+password_hash');
  const valid = user && await bcrypt.compare(req.body.password, user.password_hash);
  if (!valid) throw new HttpError(401, 'Invalid email or password');
  await issueRefresh(user, req, res);
  sendData(res, { accessToken: issueAccess(user), user: { id: String(user._id), name: user.name, email: user.email, role: user.role, workspace_id: String(user.workspace_id) } });
}));
router.post('/refresh', asyncHandler(async (req, res) => {
  const raw = req.cookies?.estateflow_refresh;
  if (!raw) throw new HttpError(401, 'Refresh session missing');
  const session = await RefreshSession.findOne({ token_hash: hashToken(raw), revoked_at: null, expires_at: { $gt: new Date() } });
  if (!session) { res.clearCookie('estateflow_refresh', { ...cookieOptions(), maxAge: undefined }); throw new HttpError(401, 'Refresh session expired or revoked'); }
  const user = await User.findOne({ _id: session.user_id, is_active: true });
  session.revoked_at = new Date();
  await session.save();
  if (!user) throw new HttpError(401, 'User account unavailable');
  await issueRefresh(user, req, res);
  sendData(res, { accessToken: issueAccess(user), user: { id: String(user._id), name: user.name, email: user.email, role: user.role, workspace_id: String(user.workspace_id) } });
}));
router.post('/logout', asyncHandler(async (req, res) => {
  const raw = req.cookies?.estateflow_refresh;
  if (raw) await RefreshSession.updateOne({ token_hash: hashToken(raw), revoked_at: null }, { $set: { revoked_at: new Date() } });
  res.clearCookie('estateflow_refresh', { ...cookieOptions(), maxAge: undefined });
  sendData(res, { loggedOut: true });
}));
router.get('/me', authenticate, asyncHandler(async (req, res) => sendData(res, { user: req.user })));
export default router;
