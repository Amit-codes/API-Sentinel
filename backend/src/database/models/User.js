import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  githubId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, trim: true },
  displayName: { type: String, default: null, trim: true },
  avatarUrl: { type: String, default: null },
}, { timestamps: true, versionKey: false });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
