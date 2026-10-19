import test from 'node:test';
import assert from 'node:assert/strict';
import { listings } from '../src/data/listings.js';
import { rankListings, INTERACTION_WEIGHTS } from '../src/services/recommend.js';

const action = (userId, listingId, type) => ({ userId, listingId, type });
const top = result => result.listings[0];

test('1. Cold start: defaults are stable and include both categories', () => {
  const a = rankListings(listings, [], 'user-asha');
  const b = rankListings(listings, [], 'user-asha');
  assert.equal(a.personalized, false);
  assert.equal(a.listings.length, 24);
  assert.deepEqual(a.listings.map(x => x.id), b.listings.map(x => x.id));
  assert.deepEqual(new Set(a.listings.map(x => x.category)), new Set(['property', 'vehicle']));
  assert.equal(a.listings[0].reasons[0], 'Featured starter pick');
});

test('2. Different users get different personalized feeds; no activity leaks', () => {
  const activity = [
    action('user-asha', 'p01', 'save'),
    action('user-nimal', 'v01', 'contact'),
  ];
  const asha = rankListings(listings, activity, 'user-asha');
  const nimal = rankListings(listings, activity, 'user-nimal');
  assert.equal(top(asha).category, 'property');
  assert.equal(top(nimal).category, 'vehicle');
  assert.notEqual(top(asha).id, top(nimal).id);
  assert.deepEqual(asha.listings.find(x => x.id === 'v01').interactionTypes, []);
  assert.deepEqual(nimal.listings.find(x => x.id === 'p01').interactionTypes, []);
  assert.equal(asha.personalized, true);
  assert.equal(nimal.personalized, true);
});

test('3. Repeating the exact same click 100 times does not increase scores', () => {
  const one = rankListings(listings, [action('user-asha', 'p01', 'view')], 'user-asha');
  const many = rankListings(listings, Array.from({ length: 100 }, () => action('user-asha', 'p01', 'view')), 'user-asha');
  assert.deepEqual(many.listings.map(x => [x.id, x.score, x.interactionTypes]),
    one.listings.map(x => [x.id, x.score, x.interactionTypes]));
});

test('4. Contact contributes more weight than save, and save more than view', () => {
  assert.ok(INTERACTION_WEIGHTS.contact > INTERACTION_WEIGHTS.save);
  assert.ok(INTERACTION_WEIGHTS.save > INTERACTION_WEIGHTS.view);
  const candidate = 'p11'; // same property type & location as p01
  const view = rankListings(listings, [action('user-asha', 'p01', 'view')], 'user-asha');
  const save = rankListings(listings, [action('user-asha', 'p01', 'save')], 'user-asha');
  const contact = rankListings(listings, [action('user-asha', 'p01', 'contact')], 'user-asha');
  const score = result => result.listings.find(x => x.id === candidate).score;
  assert.ok(score(contact) > score(save));
  assert.ok(score(save) > score(view));
});

test('5. Interacted-with listings appear after all unseen results', () => {
  const result = rankListings(listings, [
    action('user-asha', 'p01', 'save'),
    action('user-asha', 'p02', 'view'),
    action('user-asha', 'p01', 'contact'),
  ], 'user-asha');
  const firstInteracted = result.listings.findIndex(x => x.alreadyInteracted);
  assert.ok(firstInteracted >= 0);
  assert.equal(result.listings.slice(0, firstInteracted).every(x => !x.alreadyInteracted), true);
  assert.equal(result.listings.slice(firstInteracted).every(x => x.alreadyInteracted), true);
  assert.deepEqual(result.listings.find(x => x.id === 'p01').interactionTypes.sort(), ['contact', 'save']);
});

test('6. A fresh user remains cold even when another user has interaction history', () => {
  const result = rankListings(listings, [action('user-asha', 'v02', 'contact')], 'user-nimal');
  assert.equal(result.personalized, false);
  assert.equal(result.listings[0].reasons[0], 'Featured starter pick');
});
