import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true, index: true },
  eventName: { type: String, required: true },
  action: { type: String, default: null },
  installationId: { type: String, default: null, index: true },
  repositoryGithubId: { type: String, default: null, index: true },
  status: { type: String, enum: ['processing', 'processed', 'failed'], required: true, index: true },
  outcome: { type: String, default: null },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

export const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);
