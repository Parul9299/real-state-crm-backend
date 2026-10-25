
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  },
  password_hash: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'user'],
    default: 'user',
    required: true,
  },
  avatar_color: {
    type: String,
    default: '#2563eb',
    maxlength: 20,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

schema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password_hash;
    return ret;
  },
});

export default mongoose.model('User', schema);