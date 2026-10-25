import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },

    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },

    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    sender_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
    strict: 'throw',
  },
);

schema.index({ workspace_id: 1, created_at: -1 });
schema.index({ conversation_id: 1, created_at: 1 });

export default mongoose.model('Message', schema);
