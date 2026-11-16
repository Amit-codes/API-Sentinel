import mongoose from 'mongoose';

const installationSchema = new mongoose.Schema({
  installationId: { type: String, required: true, unique: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  accountId: { type: String, required: true },
  accountLogin: { type: String, required: true },
  accountType: { type: String, default: null },
  repositorySelection: { type: String, enum: ['all', 'selected'], default: 'selected' },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active', index: true },
  suspendedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

export const GitHubInstallation = mongoose.models.GitHubInstallation || mongoose.model('GitHubInstallation', installationSchema);
