function normalizeCoordinateText(value) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  return String(value || '').trim().replace(/[٠-٩۰-۹]/g, (digit) => String(
    digit >= '٠' && digit <= '٩' ? arabicDigits.indexOf(digit) : persianDigits.indexOf(digit),
  )).replace(/٫/g, '.');
}

function parseDecimal(value) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseMapCoordinates(value) {
  const pair = normalizeCoordinateText(value).match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[,;\s]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (!pair) return null;

  const lat = parseDecimal(pair[1]);
  const lng = parseDecimal(pair[2]);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}
