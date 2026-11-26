// Reads the Marquette "Menstrual Cycle Data" CSV (Fehring 2012; https://epublications.marquette.edu/data_nfp/7).
// Only ClientID, CycleNumber and LengthofCycle are read. Each participant's first unbroken run of cycle numbers is kept
// (a gap or a repeated number ends it), so no dates are guessed. The raw data is never stored in the repository.
import { readFileSync } from 'node:fs';

export function parseCSV(text) { // small RFC 4180 reader: quoted fields, commas, CRLF
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

/** { people: Map(id → [{num,len}]), series: [{ id, lens: [..] }], truncated } */
export function loadMarquette(file) {
  const [head, ...body] = parseCSV(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const col = n => head.findIndex(h => h.trim() === n);
  const [iId, iNum, iLen] = ['ClientID', 'CycleNumber', 'LengthofCycle'].map(col);
  if ([iId, iNum, iLen].includes(-1)) throw new Error('expected columns ClientID, CycleNumber, LengthofCycle');
  const people = new Map();
  for (const r of body) {
    const id = (r[iId] || '').trim(), num = Number(r[iNum]), len = Number(r[iLen]);
    if (!id || !Number.isInteger(num) || !Number.isInteger(len)) continue;
    (people.get(id) || people.set(id, []).get(id)).push({ num, len });
  }
  let truncated = 0;
  const series = [...people.entries()].map(([id, cs]) => {
    cs.sort((a, b) => a.num - b.num);
    const run = [cs[0]];
    for (const c of cs.slice(1)) { if (c.num !== run.at(-1).num + 1) { truncated++; break; } run.push(c); }
    return { id, lens: run.map(c => c.len) };
  });
  return { people, series, truncated };
}
