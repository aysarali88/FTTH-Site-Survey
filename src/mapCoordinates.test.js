import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMapCoordinates } from './mapCoordinates.js';

test('accepts a longitude, latitude pair in one field', () => {
  assert.deepEqual(parseMapCoordinates('15.0707183, 32.3703589'), { latitude: 32.3703589, longitude: 15.0707183 });
  assert.deepEqual(parseMapCoordinates('١٥٫٠٧٠٧١٨٣ ٣٢٫٣٧٠٣٥٨٩'), { latitude: 32.3703589, longitude: 15.0707183 });
  assert.deepEqual(parseMapCoordinates('-73.9857; 40.7484'), { latitude: 40.7484, longitude: -73.9857 });
});

test('rejects incomplete, malformed, and out-of-range coordinates', () => {
  assert.equal(parseMapCoordinates(''), null);
  assert.equal(parseMapCoordinates('15.07'), null);
  assert.equal(parseMapCoordinates('15, 91'), null);
  assert.equal(parseMapCoordinates('-181, 32'), null);
  assert.equal(parseMapCoordinates('15.07foo, 32.37'), null);
});
