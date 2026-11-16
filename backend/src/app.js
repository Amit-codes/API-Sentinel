import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { githubRouter, repositoryRouter } from './modules/github/github.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { webhookRouter } from './modules/webhooks/webhook.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProduction ? 1 : false);
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.get('x-request-id')?.slice(0, 100) || undefined,
    serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0], remoteAddress: req.remoteAddress }) },
  }));
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'] }));
  app.use('/api/v1/webhooks/github', express.raw({ type: 'application/json', limit: '10mb' }), webhookRouter);
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(session({
    name: 'api-sentinel.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({ mongoUrl: env.MONGODB_URI, collectionName: 'sessions', ttl: 60 * 60 * 24 * 7, autoRemove: 'native' }),
    cookie: { httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' },
  }));

  app.get('/api/v1/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    return res.status(connected ? 200 : 503).json({ data: { status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected' } });
  });
  app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), authRouter);
  app.use('/api/v1/github', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }), githubRouter);
  app.use('/api/v1/repositories', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }), repositoryRouter);
  app.use('/api/v1/users', usersRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
  return app;
}

const app = createApp();

export default app;
