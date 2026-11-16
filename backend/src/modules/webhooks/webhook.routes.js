import { Router } from 'express';
import { receiveGitHubWebhook } from './webhook.controller.js';

export const webhookRouter = Router();
webhookRouter.post('/', receiveGitHubWebhook);
