import { HttpError } from '../utils/http.js';
export const validate = (schema, key = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[key]);
  if (!result.success) return next(new HttpError(400, 'Validation failed', result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))));
  req[key] = result.data;
  next();
};
