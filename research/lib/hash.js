// Canonical JSON (sorted keys) and SHA-256 hashing, so identical inputs always produce identical hashes.
import { createHash } from 'node:crypto';

export function canonical(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}
export const sha256 = s => createHash('sha256').update(s).digest('hex');
export const hashJSON = v => sha256(canonical(v));
