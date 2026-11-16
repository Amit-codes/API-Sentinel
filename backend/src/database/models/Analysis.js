import mongoose from 'mongoose';

const analysisSchema = new mongoose.Schema({
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  commitSha: { type: String, required: true, index: true },
  commitRef: { type: String, required: true },
  status: { type: String, enum: ['analyzing', 'completed', 'partial', 'failed'], required: true, index: true },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  project: { type: mongoose.Schema.Types.Mixed, default: {} },
  warnings: { type: [String], default: [] },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
analysisSchema.index({ repositoryId: 1, createdAt: -1 });

export const Analysis = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);
