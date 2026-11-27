const API = 'https://api.alquran.cloud/v1';
import { execFileSync } from 'node:child_process';
const get = async u => { for (let i = 0; i < 4; i++) { try { const j = JSON.parse(execFileSync('curl', ['-s', '-m', '20', u]).toString()); if (j.code === 200) return j.data; } catch {} await new Promise(r => setTimeout(r, 1500)); } throw new Error(u); };
const surahs = [1, 112, 113, 114, 103, 108, 110, 109, 111, 106, 105, 107, 102, 101, 100, 99, 97, 104, 95, 94, 93];
const out = [];
let basm = null;
for (const n of surahs) {
  const [ar, en] = await get(`${API}/surah/${n}/editions/quran-uthmani,en.sahih`);
  if (n === 1) basm = ar.ayahs[0].text.replace(/^\uFEFF/, "");
  const ayahs = ar.ayahs.map((a, i) => {
    let t = a.text.replace(/^\uFEFF/, "");
    if (n !== 1 && i === 0) { const bare = x => x.replace(/[\u064B-\u0652\u0670]/g, ''); const w = t.split(' '); if (bare(w.slice(0, 4).join(' ')) !== bare(basm)) throw new Error('no basmala ' + n); t = w.slice(4).join(' '); }
    return { a: a.numberInSurah, ar: t, en: en.ayahs[i].text };
  });
  out.push({ id: `s${n}`, s: n, name: ar.englishName, meaning: ar.englishNameTranslation, arName: ar.name, ayahs });
}
for (const [id, name, meaning, refs] of [['kursi', 'Ayat al-Kursi', 'The Throne Verse', ['2:255']], ['baqarah-end', 'End of Al-Baqarah', 'The last two verses', ['2:285', '2:286']]]) {
  const ayahs = [];
  for (const r of refs) { const [ar, en] = await get(`${API}/ayah/${r}/editions/quran-uthmani,en.sahih`); ayahs.push({ a: ar.numberInSurah, ar: ar.text, en: en.text }); }
  out.push({ id, s: 2, name, meaning, arName: '', ayahs });
}
const v = await get(`${API}/ayah/54:17/en.sahih`); console.error('54:17', v.text);
console.log(JSON.stringify({ source: 'Arabic: Tanzil Uthmani text (tanzil.net) via api.alquran.cloud. English: Saheeh International.', basmala: basm, sets: out }));
