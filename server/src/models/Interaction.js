import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  listingId: { type: String, required: true },
  type: { type: String, enum: ['view', 'save', 'contact'], required: true },
}, { timestamps: true, versionKey: false });

// MongoDB rejects duplicate clicks on the same type of action for the same listing.
interactionSchema.index({ userId: 1, listingId: 1, type: 1 }, { unique: true });
export default mongoose.model('Interaction', interactionSchema);
