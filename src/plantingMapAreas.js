const AREA_COLORS = [
  '#22c55e', '#f97316', '#38bdf8', '#f472b6',
  '#facc15', '#a78bfa', '#2dd4bf', '#fb7185',
  '#a3e635', '#60a5fa', '#e879f9', '#fbbf24',
];

function isPlanted(row) {
  return row.is_planted === true || row.is_planted === 'نعم';
}

export function plantingAreaKey(row) {
  return JSON.stringify([
    String(row.city || 'Other / City not set').trim(),
    String(row.district || 'Not set').trim() || 'Not set',
  ]);
}

export function plantingAreaColors(rows) {
  const keys = [...new Set(rows.filter(isPlanted).map(plantingAreaKey))].sort();
  return new Map(keys.map((key, index) => [key, AREA_COLORS[index % AREA_COLORS.length]]));
}

export function plantedAreaGroups(rows, colors) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!isPlanted(row)) return;
    const key = plantingAreaKey(row);
    const current = groups.get(key);
    if (current) {
      current.count += 1;
    } else {
      const [city, district] = JSON.parse(key);
      groups.set(key, { key, city, district, count: 1, color: colors.get(key) });
    }
  });
  return [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
