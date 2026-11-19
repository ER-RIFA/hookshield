import mongoose from 'mongoose';
import { env } from './env';

let isConnecting = false;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1 || isConnecting) return;
  isConnecting = true;
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('✅  MongoDB connected successfully');
    isConnecting = false;
  } catch (err: any) {
    isConnecting = false;
    console.warn(`⚠️  MongoDB connection notice: ${err.message}`);
    console.warn(`💡  Tip: Ensure MongoDB is running at ${env.MONGODB_URI} (or run 'docker run -d -p 27017:27017 mongo')`);
    console.warn('🔄  HookShield API is running and will retry DB connection every 5s...');
    setTimeout(connectDB, 5000);
  }
}

export function isDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
