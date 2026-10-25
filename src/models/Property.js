import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  city: { type: String, required: true, trim: true, maxlength: 120 },
  price: { type: Number, required: true, min: 0, default: 0 },
  beds: { type: Number, min: 0, max: 100, default: 0 },
  baths: { type: Number, min: 0, max: 100, default: 0 },
  area_sqft: { type: Number, min: 0, default: 0 },
  type: { type: String, enum: ['House','Apartment','Condo','Villa','Townhouse','Penthouse','Land'], default: 'House' },
  status: { type: String, enum: ['Available','Pending','Sold','Off Market'], default: 'Available' },
  description: { type: String, maxlength: 5000, default: '' },
  image_url: { type: String, maxlength: 2048, default: '' },
  listed_date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, strict: 'throw' });
schema.index({ workspace_id: 1, status: 1, created_at: -1 });
schema.index({ workspace_id: 1, city: 1 });
export default mongoose.model('Property', schema);
