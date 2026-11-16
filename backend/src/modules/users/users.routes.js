import { Router } from 'express';
import { requireAuthentication } from '../../middleware/authenticate.js';
import { getCurrentUser } from './users.controller.js';

export const usersRouter = Router();
usersRouter.get('/me', requireAuthentication, getCurrentUser);
