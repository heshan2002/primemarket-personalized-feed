import 'dotenv/config';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing.js';
import Interaction from '../src/models/Interaction.js';
import { listings } from '../src/data/listings.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
await mongoose.connect(process.env.MONGODB_URI);
try {
  await Listing.bulkWrite(listings.map(listing => ({
    updateOne: { filter: { id: listing.id }, update: { $set: listing }, upsert: true }
  })));
  await Promise.all([Listing.syncIndexes(), Interaction.syncIndexes()]);
  console.log(`Upserted ${listings.length} fictional listings; existing interactions remain intact.`);
} finally {
  await mongoose.disconnect();
}
