import mongoose from 'mongoose';

const sourceFileSchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  path: { type: String, required: true },
  blobSha: { type: String, required: true },
  language: { type: String, enum: ['javascript', 'typescript', 'json'], required: true },
  kind: { type: String, enum: ['application', 'test', 'configuration'], required: true },
  symbols: { type: [String], default: [] },
  parseDiagnostics: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

export const SourceFile = mongoose.models.SourceFile || mongoose.model('SourceFile', sourceFileSchema);
