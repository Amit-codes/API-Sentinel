import mongoose from 'mongoose';

const repositorySchema = new mongoose.Schema({
  githubId: { type: String, required: true, unique: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  installationId: { type: String, required: true, index: true },
  fullName: { type: String, required: true, trim: true },
  ownerLogin: { type: String, required: true },
  name: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  defaultBranch: { type: String, required: true },
  selectedBranch: { type: String, required: true },
  status: { type: String, enum: ['connected', 'installation_removed'], default: 'connected', index: true },
  lastCommitSha: { type: String, default: null },
  lastPushAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
repositorySchema.index({ ownerUserId: 1, status: 1, fullName: 1 });

export const Repository = mongoose.models.Repository || mongoose.model('Repository', repositorySchema);
