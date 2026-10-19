/**
 * Deterministic, explainable, content-based recommendations.
 * Weights: view=1, save=4, contact=6. One occurrence per (user, listing, type).
 * Each UNIQUE interaction lends weight to matching candidate category, location,
 * propertyType or vehicle make, and broadly similar price (same category only).
 * Already-interacted listings are shown AFTER unseen ones, rather than deleted:
 * users can still find saved items and understand why they moved.
 */
export const INTERACTION_WEIGHTS = Object.freeze({ view: 1, save: 4, contact: 6 });

export function rankListings(listings, allInteractions = [], userId) {
  const byId = new Map(listings.map(listing => [listing.id, listing]));
  const seen = new Set();
  const activity = [];

  for (const item of allInteractions) {
    if (item.userId !== userId || !INTERACTION_WEIGHTS[item.type] || !byId.has(item.listingId)) continue;
    const uniqueKey = `${item.userId}|${item.listingId}|${item.type}`;
    if (seen.has(uniqueKey)) continue; // defensive cap in addition to MongoDB unique index
    seen.add(uniqueKey);
    activity.push({ ...item, source: byId.get(item.listingId), weight: INTERACTION_WEIGHTS[item.type] });
  }

  const personalized = activity.length > 0;
  return {
    userId,
    personalized,
    total: listings.length,
    listings: listings.map(candidate => {
      let score = 0;
      const contributions = new Map();
      const types = activity.filter(a => a.listingId === candidate.id).map(a => a.type);
      for (const event of activity) {
        if (event.listingId === candidate.id) continue; // no self-recommendation boost
        const { source, weight } = event;
        if (candidate.category === source.category) {
          add('category', `Matches your ${candidate.category} interest`, 3 * weight);
          if (candidate.category === 'property' && candidate.propertyType === source.propertyType) {
            add('type', `Similar property type: ${candidate.propertyType}`, 1.5 * weight);
          }
          if (candidate.category === 'vehicle' && candidate.make === source.make) {
            add('make', `Preferred vehicle make: ${candidate.make}`, 1.5 * weight);
          }
          // Compare similar prices only within one category; proportional, not LKR difference.
          if (Math.abs(Math.log(candidate.price / source.price)) < 0.30) {
            add('price', 'Similar to prices you explored', 0.5 * weight);
          }
        }
        if (candidate.location === source.location) {
          add('location', `Matches location: ${candidate.location}`, 1.6 * weight);
        }
        function add(key, label, points) {
          score += points;
          const old = contributions.get(key);
          contributions.set(key, { label, points: (old?.points || 0) + points });
        }
      }
      // Cold start uses a stable featured ranking, tied by listing ID.
      const reasonItems = [...contributions.values()]
        .sort((a, b) => b.points - a.points)
        .slice(0, 2)
        .map(item => item.label);
      const reasons = !personalized ? ['Featured starter pick']
        : reasonItems.length ? reasonItems : ['Discover something new'];
      return {
        ...candidate,
        score: Math.round(score * 10) / 10,
        reasons,
        interactionTypes: types,
        alreadyInteracted: types.length > 0,
      };
    }).sort((a, b) =>
      Number(a.alreadyInteracted) - Number(b.alreadyInteracted) ||
      (personalized ? b.score - a.score : 0) ||
      b.featuredScore - a.featuredScore ||
      a.id.localeCompare(b.id)
    ),
  };
}
