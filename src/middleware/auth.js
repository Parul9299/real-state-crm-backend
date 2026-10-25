import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try { payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'estateflow-api', audience: 'estateflow-client' }); }
  catch { throw new HttpError(401, 'Invalid or expired access token'); }
  if (payload.typ !== 'access' || !payload.sub || !payload.wid) throw new HttpError(401, 'Invalid access token');
  const user = await User.findOne({ _id: payload.sub, workspace_id: payload.wid, is_active: true }).lean();
  if (!user) throw new HttpError(401, 'User account is inactive or unavailable');
  req.user = { id: String(user._id), workspace_id: String(user.workspace_id), name: user.name, email: user.email, role: user.role };
  next();
});

export const allowRoles = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'Insufficient permissions'));
  next();
};
