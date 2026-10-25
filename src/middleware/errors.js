import mongoose from 'mongoose';
import { env } from '../config/env.js';
export function notFound(_req, _res, next) { next(Object.assign(new Error('Route not found'), { status: 404 })); }
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;
  if (err instanceof mongoose.Error.ValidationError) { status = 400; message = 'Validation failed'; details = Object.values(err.errors).map(e => e.message); }
  if (err instanceof mongoose.Error.CastError) { status = 400; message = 'Invalid resource identifier'; }
  if (err?.code === 11000) { status = 409; message = 'A record with this unique value already exists'; }
  if (status >= 500) { console.error(err); message = 'Internal server error'; details = undefined; }
  const payload = { error: { message, ...(details ? { details } : {}) } };
  if (env.NODE_ENV !== 'production' && status >= 500) payload.error.requestHint = 'Check server logs for the internal error.';
  res.status(status).json(payload);
}
