// Temperature units. Normalised values are in °C; the source value and unit are always kept alongside.
const UNIT = { c: 'degC', degc: 'degC', '°c': 'degC', celsius: 'degC', f: 'degF', degf: 'degF', '°f': 'degF', fahrenheit: 'degF' };

/** Canonical unit code, or null if missing or unrecognised. The unit is never guessed from the value. */
export function parseUnit(u) {
  if (u == null) return null;
  return UNIT[String(u).trim().toLowerCase().replace(/\s+/g, '')] || null;
}
export function toCelsius(value, unit) {
  if (unit === 'degC') return value;
  if (unit === 'degF') return (value - 32) * 5 / 9;
  throw new Error('unknown unit');
}
/** °C rounded to 0.001 (finer than any stated sensor precision), plus the source precision expressed in °C. */
export function normalise(value, unit, precision) {
  const c = Number(toCelsius(value, unit).toFixed(3));
  const precisionC = precision != null && precision > 0 ? Number((unit === 'degF' ? precision * 5 / 9 : precision).toFixed(4)) : null;
  return { valueC: c, precisionC };
}
