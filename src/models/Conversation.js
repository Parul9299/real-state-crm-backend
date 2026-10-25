import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Direct chats ke liye deterministic key
    direct_key: {
      type: String,
      select: false,
    },

    last_message: {
      type: String,
      maxlength: 4000,
      default: '',
    },

    last_message_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    strict: 'throw',
  },
);

schema.index({
  workspace_id: 1,
  participants: 1,
  last_message_at: -1,
});

schema.index(
  { workspace_id: 1, direct_key: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'direct' },
  },
);

export default mongoose.model('Conversation', schema);
