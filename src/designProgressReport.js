export const DESIGN_PROGRESS_HEADERS = [
  'Source', 'City', 'District', 'Batch ID', 'Point ID', 'Point name',
  'Latitude', 'Longitude', 'Validation status', 'Validation notes', 'Planting status',
  'Technician', 'Validated at', 'Field record ID', 'Field recorded at',
  'Reason not planted', 'Field notes', 'Photo URL',
];

export function buildDesignProgressRows(plannedRows, plantingRows) {
  const activePlannedRows = plannedRows.filter((row) => !row.deleted_at);
  const reportsById = new Map(plantingRows.map((row) => [row.id, row]));
  const linkedReportIds = new Set(activePlannedRows.map((row) => row.planted_record_id).filter(Boolean));

  const planned = activePlannedRows.map((row) => {
    const report = reportsById.get(row.planted_record_id);
    const planted = row.validation_status === 'planted' || row.is_planted === true;
    return {
      Source: 'Planned pole',
      City: row.city || '',
      District: row.district || '',
      'Batch ID': row.batch_id || '',
      'Point ID': row.id,
      'Point name': row.point_name || '',
      Latitude: row.latitude,
      Longitude: row.longitude,
      'Validation status': row.validation_status === 'rejected' ? 'Rejected'
        : ['validated', 'planted'].includes(row.validation_status) ? 'Validated' : 'Pending',
      'Validation notes': row.validation_notes || '',
      'Planting status': planted ? 'Planted'
        : row.validation_status === 'validated' ? 'Awaiting planting' : 'Not started',
      Technician: report?.tech_name || row.assigned_to || '',
      'Validated at': row.validated_at || '',
      'Field record ID': report?.id || row.planted_record_id || '',
      'Field recorded at': report?.created_at || '',
      'Reason not planted': '',
      'Field notes': report?.notes || '',
      'Photo URL': report?.photo_url || '',
    };
  });

  const unlinked = plantingRows.filter((row) => !linkedReportIds.has(row.id)).map((row) => ({
    Source: 'Field report (unlinked)',
    City: row.city || '',
    District: row.district || '',
    'Batch ID': '',
    'Point ID': '',
    'Point name': '',
    Latitude: row.latitude,
    Longitude: row.longitude,
    'Validation status': 'No linked plan ID',
    'Validation notes': '',
    'Planting status': row.is_planted ? 'Planted' : 'Not planted',
    Technician: row.tech_name || '',
    'Validated at': '',
    'Field record ID': row.id,
    'Field recorded at': row.created_at || '',
    'Reason not planted': row.planting_reason || '',
    'Field notes': row.notes || '',
    'Photo URL': row.photo_url || '',
  }));

  return [...planned, ...unlinked].sort((a, b) =>
    a.City.localeCompare(b.City) || a.District.localeCompare(b.District)
    || a.Source.localeCompare(b.Source) || String(a['Point ID'] || a['Field record ID']).localeCompare(String(b['Point ID'] || b['Field record ID'])));
}
