import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './database/connect.js';

const server = createApp().listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, 'API Sentinel API ready'));
connectDatabase().catch((error) => logger.error({ err: error }, 'MongoDB connection unavailable; health endpoint will report degraded status'));

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  if (server) await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
