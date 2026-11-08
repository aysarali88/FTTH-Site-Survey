import assert from 'node:assert/strict';
import test from 'node:test';
import { plantedAreaGroups, plantingAreaColors, plantingAreaKey } from './plantingMapAreas.js';

test('groups only planted points by city and district', () => {
  const rows = [
    { city: 'Tripoli', district: 'نوفلين', is_planted: true },
    { city: 'Tripoli', district: 'نوفلين', is_planted: 'نعم' },
    { city: 'Tripoli', district: 'شارع الظل', is_planted: false },
    { city: 'Misrata', district: 'نوفلين', is_planted: true },
  ];
  const colors = plantingAreaColors(rows);
  const groups = plantedAreaGroups(rows, colors);

  assert.deepEqual(groups.map(({ city, district, count }) => [city, district, count]), [
    ['Tripoli', 'نوفلين', 2],
    ['Misrata', 'نوفلين', 1],
  ]);
  assert.notEqual(colors.get(plantingAreaKey(rows[0])), colors.get(plantingAreaKey(rows[3])));
});

test('keeps area colors stable when the visible rows are filtered', () => {
  const rows = [
    { city: 'Tripoli', district: 'نوفلين', is_planted: true },
    { city: 'Misrata', district: 'المنقوش', is_planted: true },
  ];
  const colors = plantingAreaColors(rows);
  const groups = plantedAreaGroups(rows.slice(0, 1), colors);

  assert.equal(groups[0].color, colors.get(plantingAreaKey(rows[0])));
  assert.equal(plantingAreaKey({ city: 'Tripoli', district: '' }), '["Tripoli","Not set"]');
});
