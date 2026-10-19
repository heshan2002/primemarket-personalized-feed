import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, enum: ['property', 'vehicle'], required: true },
  location: { type: String, required: true },
  price: { type: Number, min: 1, required: true },
  propertyType: String,
  bedrooms: Number,
  bathrooms: Number,
  make: String,
  model: String,
  year: Number,
  featuredScore: { type: Number, default: 0 },
  imageKey: String,
}, { versionKey: false });

export default mongoose.model('Listing', listingSchema);
