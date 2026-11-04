import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDesignProgressRows } from './designProgressReport.js';

test('exports every area and keeps unlinked field outcomes separate', () => {
  const planned = [
    { id: 'pending', city: 'Tripoli', district: 'A', validation_status: 'pending' },
    { id: 'ready', city: 'Tripoli', district: 'A', validation_status: 'validated', assigned_to: 'tech1' },
    { id: 'planted', city: 'Misrata', district: 'B', validation_status: 'planted', validation_notes: 'Approved location', planted_record_id: 'record-1' },
    { id: 'rejected', city: 'Misrata', district: 'B', validation_status: 'rejected', validation_notes: 'Move point' },
    { id: 'deleted', city: 'Tripoli', district: 'A', deleted_at: '2026-01-01', planted_record_id: 'record-3' },
  ];
  const reports = [
    { id: 'record-1', city: 'Misrata', district: 'B', is_planted: true, tech_name: 'tech2', notes: 'Photo checked' },
    { id: 'record-2', city: 'Tripoli', district: 'A', is_planted: false, planting_reason: 'Blocked', notes: 'Access denied' },
    { id: 'record-3', city: 'Tripoli', district: 'A', is_planted: true },
  ];
  const rows = buildDesignProgressRows(planned, reports);

  assert.equal(rows.length, 6);
  assert.equal(rows.find((row) => row['Point ID'] === 'pending')['Validation status'], 'Pending');
  assert.equal(rows.find((row) => row['Point ID'] === 'ready')['Planting status'], 'Awaiting planting');
  assert.equal(rows.find((row) => row['Point ID'] === 'planted')['Field record ID'], 'record-1');
  assert.equal(rows.find((row) => row['Point ID'] === 'planted')['Validation notes'], 'Approved location');
  assert.equal(rows.find((row) => row['Point ID'] === 'planted')['Field notes'], 'Photo checked');
  assert.equal(rows.find((row) => row['Point ID'] === 'rejected')['Validation status'], 'Rejected');
  assert.equal(rows.find((row) => row['Point ID'] === 'rejected')['Validation notes'], 'Move point');
  assert.equal(rows.find((row) => row['Field record ID'] === 'record-2')['Reason not planted'], 'Blocked');
  assert.equal(rows.find((row) => row['Field record ID'] === 'record-2')['Field notes'], 'Access denied');
  assert.equal(rows.filter((row) => row['Field record ID'] === 'record-1').length, 1);
  assert.equal(rows.find((row) => row['Field record ID'] === 'record-3').Source, 'Field report (unlinked)');
  assert.equal(rows[0].City, 'Misrata');
});

test('does not cap the export at the preview limit', () => {
  const planned = Array.from({ length: 1201 }, (_, index) => ({
    id: `point-${index}`, city: 'Tripoli', district: 'A', validation_status: 'pending',
  }));
  assert.equal(buildDesignProgressRows(planned, []).length, 1201);
});
