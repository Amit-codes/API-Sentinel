import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: process.env.LOG_LEVEL || (env.isProduction ? 'info' : 'debug'),
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers.set-cookie'],
});
