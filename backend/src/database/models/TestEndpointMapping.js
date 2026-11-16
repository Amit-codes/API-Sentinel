import mongoose from 'mongoose';

const testEndpointMappingSchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', required: true, index: true },
  testFilePath: { type: String, required: true },
  evidence: { type: String, required: true },
  confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
}, { timestamps: true, versionKey: false });

export const TestEndpointMapping = mongoose.models.TestEndpointMapping || mongoose.model('TestEndpointMapping', testEndpointMappingSchema);
