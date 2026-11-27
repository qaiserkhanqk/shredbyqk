// Builds the full Quran for the reader: data/quran/index.json and data/quran/001.json … 114.json.
// Arabic: Tanzil Uthmani text; English: Saheeh International; both via api.alquran.cloud.
// Usage: node tools/fetch-quran.mjs            (downloads with curl)
//        node tools/fetch-quran.mjs AR.json EN.json   (from files already downloaded)
// Checks: 114 surahs, 6,236 verses, Arabic and English verse counts match, Basmala moved out of verse 1.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const API = 'https://api.alquran.cloud/v1/quran';
const load = (file, edition) => JSON.parse(file ? readFileSync(file, 'utf8') : execFileSync('curl', ['-s', '-m', '120', `${API}/${edition}`], { maxBuffer: 64e6 }).toString()).data.surahs;
const ar = load(process.argv[2], 'quran-uthmani'), en = load(process.argv[3], 'en.sahih');
if (ar.length !== 114 || en.length !== 114) throw new Error('expected 114 surahs');

const bom = t => t.replace(/^﻿/, '');
const bare = t => t.replace(/[ً-ْٰ]/g, '');
const basmala = bom(ar[0].ayahs[0].text);
const NICE = { 'Al-Faatiha': 'Al-Fatiha', 'Al-Ikhlaas': 'Al-Ikhlas', 'An-Naas': 'An-Nas', 'Al-Kaafiroon': 'Al-Kafirun', "Al-Maa'un": "Al-Ma'un", 'At-Takaathur': 'At-Takathur', "Al-Qaari'a": "Al-Qari'ah", 'Al-Aadiyaat': "Al-'Adiyat", 'Az-Zalzala': 'Az-Zalzalah', 'Ad-Dhuhaa': 'Ad-Duha', 'Quraish': 'Quraysh' };

mkdirSync(new URL('../data/quran/', import.meta.url), { recursive: true });
const index = [];
let total = 0;
for (let i = 0; i < 114; i++) {
  const A = ar[i], E = en[i], n = A.number;
  if (A.ayahs.length !== E.ayahs.length) throw new Error(`verse count differs in ${n}`);
  const ayahs = A.ayahs.map((v, k) => {
    let t = bom(v.text);
    if (n !== 1 && n !== 9 && k === 0) {
      const w = t.split(' ');
      if (bare(w.slice(0, 4).join(' ')) !== bare(basmala)) throw new Error(`no Basmala at ${n}:1`);
      t = w.slice(4).join(' ');
    }
    return { a: v.numberInSurah, ar: t, en: E.ayahs[k].text, juz: v.juz, page: v.page };
  });
  total += ayahs.length;
  const meta = { s: n, name: NICE[A.englishName] || A.englishName, meaning: A.englishNameTranslation, arName: A.name, type: A.revelationType, verses: ayahs.length, juz: ayahs[0].juz, page: ayahs[0].page };
  index.push(meta);
  writeFileSync(new URL(`../data/quran/${String(n).padStart(3, '0')}.json`, import.meta.url), JSON.stringify({ ...meta, basmala: n !== 1 && n !== 9, ayahs }));
}
if (total !== 6236) throw new Error(`expected 6236 verses, got ${total}`);
writeFileSync(new URL('../data/quran/index.json', import.meta.url), JSON.stringify({ source: 'Arabic: Tanzil Uthmani text (tanzil.net) via api.alquran.cloud. English: Saheeh International.', basmala, surahs: index }));
console.log(`ok: 114 surahs, ${total} verses`);
