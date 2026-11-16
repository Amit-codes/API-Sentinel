import { z } from 'zod';

export const callbackQuerySchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().regex(/^[a-f\d]{64}$/i),
});
