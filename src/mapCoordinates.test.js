import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMapCoordinates } from './mapCoordinates.js';

test('accepts a latitude, longitude pair in one field', () => {
  assert.deepEqual(parseMapCoordinates('32.3703589, 15.0707183'), { latitude: 32.3703589, longitude: 15.0707183 });
  assert.deepEqual(parseMapCoordinates('٣٢٫٣٧٠٣٥٨٩ ١٥٫٠٧٠٧١٨٣'), { latitude: 32.3703589, longitude: 15.0707183 });
  assert.deepEqual(parseMapCoordinates('40.7484; -73.9857'), { latitude: 40.7484, longitude: -73.9857 });
});

test('rejects incomplete, malformed, and out-of-range coordinates', () => {
  assert.equal(parseMapCoordinates(''), null);
  assert.equal(parseMapCoordinates('15.07'), null);
  assert.equal(parseMapCoordinates('91, 15'), null);
  assert.equal(parseMapCoordinates('32, -181'), null);
  assert.equal(parseMapCoordinates('32.37foo, 15.07'), null);
});
