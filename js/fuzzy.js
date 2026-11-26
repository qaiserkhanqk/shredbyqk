// Sound-alike matching for Roman Urdu and English food words, shared by meal parsing and search.
// Words are compared by a "sound skeleton": consonants only, aspirates folded (th→t, kh→k), q→k,
// common plural endings dropped. So parata = paratha = prathay, nahari ≈ nihari, karhai ≈ karahi,
// samose = samosa, chapatiyan = chapati, burgr ≈ burger, cheezius ≈ cheezious.
export const STEM = /(iyan|yan|ain|on|es|s)$/;
export function skeleton(w) {
  let x = w.toLowerCase();
  if (x.length > 4) x = x.replace(STEM, '');
  x = x.replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/ph/g, 'p').replace(/jh/g, 'j').replace(/gh/g, 'g').replace(/kh/g, 'k').replace(/q/g, 'k').replace(/w/g, 'v');
  const first = x[0];
  x = x.replace(/h/g, '').replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1');
  return (/[aeiouy]/.test(first) ? first : '') + x; // keep a leading vowel: aam ≠ m, aloo ≠ l
}
export function lev1(a, b) { // edit distance ≤ 1
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
export const stem = w => (w.length > 4 ? w.replace(STEM, '') : w.length > 3 ? w.replace(/s$/, '') : w);
// Exact (or plural): roti = rotis, egg = eggs. Sound-alike: same skeleton when it's long enough to be
// distinctive (paratha = prathay), or one edit apart on longer words (nahari ≈ nihari, karhai ≈ karahi).
export const exact = (a, b) => a === b || stem(a) === stem(b);
export const sounds = (a, b) => {
  if (exact(a, b) || a[0] !== b[0]) return exact(a, b);
  const sa = skeleton(a), sb = skeleton(b);
  if (Math.abs(a.length - b.length) > 2) return false; // chowmein ≠ cumin
  if (sa === sb) return sa.length >= 3 || (a.length >= 5 && b.length >= 5 && lev1(a, b.slice(0, a.length)) );
  return a.length > 4 && b.length > 4 && sa.length >= 4 && lev1(sa, sb);
};
export const near = (a, b) => exact(a, b) || sounds(a, b) || (a.length >= 5 && b.length >= 5 && rawLev(a, b) <= 2 && skeleton(a) === skeleton(b));
export function rawLev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}


/** For names (places, brands): exact, a prefix, or one or two typos, but never just "sounds alike"
 *  (bhindi must not find Bundu Khan). cheezius → cheezious, kababjes → kababjees, savor → savour. */
export const typo = (w, x) => w === x || (w.length >= 3 && x.startsWith(w)) || (w.length >= 5 && x.length >= 5 && w[0] === x[0] && rawLev(w, x) <= (Math.min(w.length, x.length) >= 7 ? 2 : 1));
