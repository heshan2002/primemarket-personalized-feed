import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const port = Number(process.env.PORT || 4000);
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI missing. Copy .env.example to .env in server/.');
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 6000 });
  app.listen(port, () => console.log(`PrimeFeed API: http://localhost:${port} (${process.env.S3_MODE || 'mock'} images)`));
} catch (error) {
  console.error('Cannot connect to MongoDB:', error.message);
  process.exit(1);
}
