
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/database/connect.js';

const app = createApp();

let databaseConnection;

export default async function handler(req, res) {
  try {
    if (!databaseConnection) {
      databaseConnection = connectDatabase().catch((error) => {
        databaseConnection = undefined;
        throw error;
      });
    }

    await databaseConnection;
    return app(req, res);
  } catch (error) {
    console.error('API initialization failed:', error);

    return res.status(503).json({
      error: {
        message: 'API temporarily unavailable',
      },
    });
  }
}
