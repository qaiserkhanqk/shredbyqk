// The bundled Quran text (data/quran/), used by the reader. Run: node tests/quran.test.mjs
import { readFileSync } from 'node:fs';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const read = f => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const idx = read('quran/index.json');
const surahs = idx.surahs.map(m => read(`quran/${String(m.s).padStart(3, '0')}.json`));

check('114 surahs in the index and as files', idx.surahs.length === 114 && surahs.every((d, i) => d.s === i + 1));
const total = surahs.reduce((a, d) => a + d.ayahs.length, 0);
check('6,236 verses in total', total === 6236, String(total));
check('index verse counts match the files', surahs.every((d, i) => d.ayahs.length === idx.surahs[i].verses));
check('well-known lengths: Al-Baqarah 286, Al-Kahf 110, Yasin 83, Al-Kawthar 3', surahs[1].ayahs.length === 286 && surahs[17].ayahs.length === 110 && surahs[35].ayahs.length === 83 && surahs[107].ayahs.length === 3);
check('verses numbered 1…n in order', surahs.every(d => d.ayahs.every((v, i) => v.a === i + 1)));
check('every verse has Arabic and English text', surahs.every(d => d.ayahs.every(v => /[ء-يٱ]/.test(v.ar) && v.en.length > 0)));
check('no byte-order marks', !surahs.some(d => /﻿/.test(JSON.stringify(d))));
check('Basmala heading on every surah except Al-Fatiha (it is verse 1) and At-Tawbah', surahs.filter(d => !d.basmala).map(d => d.s).join() === '1,9');
const bare = t => t.replace(/[ً-ْٰ]/g, '');
check('Basmala removed from verse 1 of the other surahs', surahs.filter(d => d.basmala).every(d => !bare(d.ayahs[0].ar).startsWith(bare('بِسْمِ ٱللَّهِ'))));
check('Al-Fatiha verse 1 is the Basmala', bare(surahs[0].ayahs[0].ar).startsWith(bare('بِسْمِ ٱللَّهِ')));
check('juz 1 starts at Al-Fatiha, juz 30 at An-Naba', surahs[0].ayahs[0].juz === 1 && surahs[77].ayahs[0].juz === 30);
check('names: Makki/Madani on every surah', surahs.every(d => ['Meccan', 'Medinan'].includes(d.type)));

// The memorisation sets must match the reader's text word for word.
const hifz = read('quran-hifz.json');
let same = true;
for (const set of hifz.sets) for (const v of set.ayahs) if (surahs[set.s - 1].ayahs[v.a - 1].ar !== v.ar || surahs[set.s - 1].ayahs[v.a - 1].en !== v.en) { same = false; console.log('  differs:', set.id, v.a); }
check('memorisation sets match the full text exactly', same);

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nquran: all passed');
