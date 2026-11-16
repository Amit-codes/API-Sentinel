import mongoose from 'mongoose';

const endpointSchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  routeFile: { type: String, required: true },
  line: { type: Number, default: null },
  routerName: { type: String, default: null },
  middlewareNames: { type: [String], default: [] },
  handlerNames: { type: [String], default: [] },
  controllerFiles: { type: [String], default: [] },
  confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  unsupportedReasons: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

export const Endpoint = mongoose.models.Endpoint || mongoose.model('Endpoint', endpointSchema);
