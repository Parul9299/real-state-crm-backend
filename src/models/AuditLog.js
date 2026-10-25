import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, maxlength: 100 },
  resource_type: { type: String, required: true, maxlength: 80 },
  resource_id: { type: String, maxlength: 80 },
  ip: { type: String, maxlength: 80 }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
schema.index({ workspace_id: 1, created_at: -1 });
export default mongoose.model('AuditLog', schema);
