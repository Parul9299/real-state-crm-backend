import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token_hash: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true, expires: 0 },
  revoked_at: { type: Date, default: null },
  user_agent: { type: String, maxlength: 300 },
  ip: { type: String, maxlength: 80 }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
export default mongoose.model('RefreshSession', schema);
