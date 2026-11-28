// Small, strict CSV reader (RFC 4180 quoting) with hard limits, and a CSV writer that neutralises spreadsheet
// formula injection. No eval, no type guessing: every cell is a string until the schema converts it.
import { CONFIG } from './config.js';

export class ParseError extends Error { constructor(code, line) { super(`parse:${code}`); this.code = code; this.line = line; } }

export function parseCSV(text, limits = CONFIG.limits) {
  if (typeof text !== 'string') throw new ParseError('not_text', 0);
  if (Buffer.byteLength(text, 'utf8') > limits.maxUploadBytes) throw new ParseError('too_large', 0);
  if (text.includes('\u0000')) throw new ParseError('binary_content', 0);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // `closed`: the current cell was quoted and its closing quote has been read. Only a delimiter or a line end may follow
  // (RFC 4180). Anything else, e.g. "33".5, is malformed and rejected rather than merged into 33.5.
  const rows = []; let row = [], cell = '', q = false, closed = false, line = 1, i = 0;
  const pushCell = () => { if (cell.length > limits.maxCellChars) throw new ParseError('cell_too_long', line); row.push(cell); cell = ''; closed = false; if (row.length > limits.maxColumns) throw new ParseError('too_many_columns', line); };
  const pushRow = () => { pushCell(); if (!(row.length === 1 && row[0] === '')) rows.push({ line, cells: row }); row = []; if (rows.length > limits.maxRows + 1) throw new ParseError('too_many_rows', line); };
  for (; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { q = false; closed = true; } }
      else { if (ch === '\n') line++; cell += ch; }
    } else if (closed && ch !== ',' && ch !== '\n' && ch !== '\r') throw new ParseError('text_after_closing_quote', line);
    else if (ch === '"') { if (cell !== '') throw new ParseError('stray_quote', line); q = true; }
    else if (ch === ',') pushCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; pushRow(); line++; }
    else cell += ch;
  }
  if (q) throw new ParseError('unterminated_quote', line);
  if (cell !== '' || row.length) pushRow();
  if (!rows.length) throw new ParseError('empty', 0);
  const header = rows[0].cells.map(h => h.trim());
  if (new Set(header).size !== header.length) throw new ParseError('duplicate_header', 1);
  return rows.slice(1).map(r => {
    if (r.cells.length !== header.length) return { line: r.line, error: 'column_count' };
    return { line: r.line, record: Object.fromEntries(header.map((h, k) => [h, r.cells[k]])) };
  });
}

/** JSON input: { "records": [ {...}, ... ] } or a bare array. Same limits as CSV. */
export function parseJSONRecords(text, limits = CONFIG.limits) {
  if (typeof text !== 'string') throw new ParseError('not_text', 0);
  if (Buffer.byteLength(text, 'utf8') > limits.maxUploadBytes) throw new ParseError('too_large', 0);
  let v; try { v = JSON.parse(text); } catch { throw new ParseError('invalid_json', 0); }
  const arr = Array.isArray(v) ? v : v?.records;
  if (!Array.isArray(arr)) throw new ParseError('no_records_array', 0);
  if (arr.length > limits.maxRows) throw new ParseError('too_many_rows', 0);
  // The same per-record limits as CSV (fields per record, characters per cell), and plain values only: a nested object
  // or array is not a cell. Errors are per record, so one bad record is reported without failing the whole file.
  return arr.map((r, k) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return { line: k + 1, error: 'not_an_object' };
    const entries = Object.entries(r);
    if (entries.length > limits.maxColumns) return { line: k + 1, error: 'too_many_columns' };
    if (entries.some(([, v]) => v !== null && typeof v === 'object')) return { line: k + 1, error: 'nested_value_not_allowed' };
    if (entries.some(([key, v]) => String(key).length > limits.maxCellChars || (typeof v === 'string' && v.length > limits.maxCellChars))) return { line: k + 1, error: 'cell_too_long' };
    return { line: k + 1, record: r };
  });
}

/** A cell that a spreadsheet would treat as a formula is prefixed with an apostrophe. Plain numbers are left alone. */
export function safeCell(v) {
  if (v == null) return '';
  let s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const numeric = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s);
  if (!numeric && /^[=+\-@\t\r|%]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCSV = (columns, rows) => [columns.map(safeCell).join(','), ...rows.map(r => columns.map(c => safeCell(r[c])).join(','))].join('\r\n') + '\r\n';
