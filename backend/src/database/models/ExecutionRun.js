import mongoose from 'mongoose';

const executionRunSchema = new mongoose.Schema({
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  baseAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true },
  headAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true },
  commitSha: { type: String, required: true },
  commitRef: { type: String, required: true },
  selection: { type: String, enum: ['full_suite'], default: 'full_suite' },
  testFramework: { type: String, enum: ['jest', 'vitest'], default: 'jest' },
  configSnapshot: { type: mongoose.Schema.Types.Mixed, required: true, default: { runtime: 'node20', installCommand: 'npm ci', testCommand: 'npx --no-install jest --runInBand' } },
  status: { type: String, enum: ['dispatching', 'queued', 'in_progress', 'completed', 'failed', 'cancelled', 'dispatch_failed'], default: 'dispatching', index: true },
  conclusion: { type: String, default: null },
  workflowRunId: { type: String, default: null },
  workflowUrl: { type: String, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  errorCode: { type: String, default: null },
}, { timestamps: true, versionKey: false });
executionRunSchema.index({ ownerUserId: 1, repositoryId: 1, createdAt: -1 });

export const ExecutionRun = mongoose.models.ExecutionRun || mongoose.model('ExecutionRun', executionRunSchema);
