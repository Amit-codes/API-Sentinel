import { User } from '../../database/models/User.js';
import { HttpError } from '../../shared/HttpError.js';
import { toPublicUser } from '../auth/auth.service.js';

export async function getCurrentUser(req, res) {
  const user = await User.findById(req.session.userId).lean();
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  res.json({ data: { user: toPublicUser(user) } });
}
