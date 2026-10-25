import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  plan: { type: String, enum: ['free', 'team', 'enterprise'], default: 'free' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('Workspace', schema);
