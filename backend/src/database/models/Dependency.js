import mongoose from 'mongoose';

const dependencySchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromPath: { type: String, required: true },
  toPath: { type: String, required: true },
  specifier: { type: String, default: null },
  relationType: { type: String, enum: ['imports', 'controller_service', 'service_model', 'controller_route', 'mounts_router', 'calls_function'], required: true },
  symbol: { type: String, default: null },
  confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
}, { timestamps: true, versionKey: false });

export const Dependency = mongoose.models.Dependency || mongoose.model('Dependency', dependencySchema);
