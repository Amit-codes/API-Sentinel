import mongoose from 'mongoose';

const testFileSchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  path: { type: String, required: true },
  framework: { type: String, enum: ['jest', 'vitest', 'unknown'], default: 'unknown' },
  hasSupertest: { type: Boolean, default: false },
  suites: { type: [String], default: [] },
  cases: { type: [String], default: [] },
  requests: { type: [mongoose.Schema.Types.Mixed], default: [] },
  parseDiagnostics: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

export const TestFile = mongoose.models.TestFile || mongoose.model('TestFile', testFileSchema);
