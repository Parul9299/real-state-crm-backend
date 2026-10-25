import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  type: { type: String, enum: ['Call','Email','Meeting','Showing','Note'], default: 'Call' },
  description: { type: String, required: true, trim: true, maxlength: 3000, default: '' },
  due_date: { type: String, default: null },
  completed: { type: Boolean, default: false },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, strict: 'throw' });
schema.index({ workspace_id: 1, due_date: 1, completed: 1 });
export default mongoose.model('Activity', schema);
