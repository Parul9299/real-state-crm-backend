import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: !env.NODE_ENV || env.NODE_ENV !== 'production'
  });
  console.log('MongoDB connected');
}
