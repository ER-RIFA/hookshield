import { connectDB } from './config/database';
import { env } from './config/env';
import app from './app';

async function start() {
  try {
    // Initiate DB connection in background
    connectDB();

    app.listen(parseInt(env.PORT), () => {
      console.log(`🚀  HookShield API running on http://localhost:${env.PORT}`);
      console.log(`🌍  Environment: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});

start();
