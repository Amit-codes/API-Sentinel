import { Router } from 'express';
import { requireAuthentication } from '../../middleware/authenticate.js';
import { getCsrfToken, requireCsrf } from '../../middleware/csrf.js';
import { finishGitHubLogin, logout, startGitHubLogin } from './auth.controller.js';

export const authRouter = Router();
authRouter.get('/github', startGitHubLogin);
authRouter.get('/github/callback', finishGitHubLogin);
authRouter.get('/csrf', (req, res) => res.json({ data: { csrfToken: getCsrfToken(req) } }));
authRouter.post('/logout', requireAuthentication, requireCsrf, logout);
