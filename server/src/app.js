import express from 'express';
import cors from 'cors';
import Listing from './models/Listing.js';
import Interaction from './models/Interaction.js';
import { users } from './data/users.js';
import { rankListings, INTERACTION_WEIGHTS } from './services/recommend.js';
import { getListingImage } from './services/images.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '10kb' }));

const validUser = userId => users.some(user => user.id === userId);

app.get('/api/health', (_req, res) => res.json({ ok: true, imageMode: process.env.S3_MODE || 'mock' }));
app.get('/api/users', (_req, res) => res.json({ users }));

app.get('/api/feed', async (req, res, next) => {
  try {
    const userId = req.query.userId;
    if (typeof userId !== 'string' || !validUser(userId)) return res.status(400).json({ error: 'Select a valid test user.' });
    const [listings, interactions] = await Promise.all([
      Listing.find({}, { _id: 0 }).lean(),
      Interaction.find({ userId }, { _id: 0, userId: 1, listingId: 1, type: 1 }).lean(),
    ]);
    res.json(rankListings(listings, interactions, userId));
  } catch (error) { next(error); }
});

app.post('/api/interactions', async (req, res, next) => {
  try {
    const { userId, listingId, type } = req.body || {};
    if (!validUser(userId) || typeof listingId !== 'string' || !Object.hasOwn(INTERACTION_WEIGHTS, type)) {
      return res.status(400).json({ error: 'Invalid user, listing or interaction type.' });
    }
    if (!await Listing.exists({ id: listingId })) return res.status(404).json({ error: 'Listing not found.' });
    try {
      await Interaction.updateOne(
        { userId, listingId, type },
        { $setOnInsert: { userId, listingId, type } },
        { upsert: true }
      );
    } catch (error) {
      // Concurrent identical upserts can race; E11000 means the click was already recorded.
      if (error.code !== 11000) throw error;
    }
    res.status(200).json({ ok: true, message: 'Interaction recorded (idempotent).' });
  } catch (error) { next(error); }
});

app.get('/api/listings/:listingId/image', async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ id: req.params.listingId }, { imageKey: 1 }).lean();
    if (!listing?.imageKey) return res.status(404).json({ error: 'No image for this listing.' });
    const { bytes, contentType } = await getListingImage(listing.imageKey);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=60');
    res.send(bytes);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message);
  res.status(500).json({ error: 'Server request failed. Check backend configuration and logs.' });
});
export default app;
