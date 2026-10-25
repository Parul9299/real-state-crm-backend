import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  budget: { type: Number, min: 0, default: 0 },
  interest_property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  stage: { type: String, enum: ['New','Contacted','Qualified','Negotiation','Closed'], default: 'New' },
  source: { type: String, enum: ['Website','Referral','Zillow','Open House','Social Media','Cold Call','Other'], default: 'Website' },
  notes: { type: String, maxlength: 10000, default: '' },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, strict: 'throw' });
schema.index({ workspace_id: 1, stage: 1, created_at: -1 });
schema.index({ workspace_id: 1, email: 1 });
export default mongoose.model('Lead', schema);
