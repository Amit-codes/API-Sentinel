import { z } from 'zod';

const installationIdSchema = z.string().regex(/^\d{1,20}$/);

export const installationParamSchema = z.object({ installationId: installationIdSchema });
export const repositoryParamsSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
export const installationQuerySchema = z.object({ installationId: installationIdSchema });
export const selectRepositorySchema = z.object({
  installationId: installationIdSchema,
  repositoryId: z.string().regex(/^\d{1,20}$/),
  branch: z.string().min(1).max(255),
});
export const branchSchema = z.object({ branch: z.string().min(1).max(255) });
export const appSetupQuerySchema = z.object({
  installation_id: installationIdSchema,
  setup_action: z.enum(['install', 'update']),
  state: z.string().regex(/^[a-f\d]{64}$/i),
});
