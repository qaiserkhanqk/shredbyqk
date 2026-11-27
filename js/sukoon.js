// Sukoon: a short calm-down session. Slow breathing, optional tones, a recited passage of the Quran, then a dua.
// The logic here has no browser dependencies so it can be unit tested. SukoonTones (bottom) needs Web Audio.
//
// Evidence, strongest first (full references in SCIENCE.md §10):
//  1. Slow breathing at ~6 breaths/min raises vagal (parasympathetic) activity and heart-rate variability.
//  2. Listening to Quran recitation lowered anxiety in most of the trials in a 28-study review (Ghiasi & Keramat 2018).
//  3. Binaural beats: medium effect on anxiety in meta-analyses (Garcia-Argibay 2019, g = 0.45; Xiong 2025).
//  4. Specific "healing" frequencies (432 Hz, 528 Hz, 7.83 Hz): small pilots only. Shown as weak in the app.
// No hadith or verse assigns a frequency to a surah. The pairings below match a surah's MEANING to a goal.

export const SURAH = { 1: 'Al-Fatiha', 3: 'Al Imran', 30: 'Ar-Rum', 49: 'Al-Hujurat', 55: 'Ar-Rahman', 67: 'Al-Mulk', 94: 'Ash-Sharh', 96: 'Al-Alaq', 113: 'Al-Falaq', 114: 'An-Nas' };
export const AYAH_COUNT = { 1: 7, 3: 200, 30: 60, 49: 18, 55: 78, 67: 30, 94: 8, 96: 19, 113: 5, 114: 6 };

export const EVIDENCE = {
  moderate: 'Binaural beats reduced anxiety with a medium effect in meta-analyses of 15–22 trials. Effects vary between people.',
  weak: 'Only small pilot studies. Treat this tone as a preference, not a treatment. The breathing and the recitation carry the evidence.',
};

const BAND = f => f < 4 ? 'Delta' : f < 8 ? 'Theta' : f < 13 ? 'Alpha' : f < 30 ? 'Beta' : 'Gamma';

// beat = brainwave band the tone pulses at; carrier = the audible pitch.
export const GOALS = [
  { id: 'anxiety', name: 'Anxiety', blurb: 'Racing thoughts, tight chest', beat: 6, carrier: 200, evidence: 'moderate',
    passages: [[94, 1, 8]], key: '94:5–6', meaning: 'So surely with hardship comes ease. Surely with hardship comes ease.',
    dua: { t: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal, wal-bukhli wal-jubn, wa dala'id-dayni wa ghalabatir-rijal.",
      m: 'O Allah, I seek refuge in You from worry and grief, from weakness and laziness, from miserliness and cowardice, from the burden of debt and from being overpowered by men.', src: 'Sahih al-Bukhari 6369' } },
  { id: 'reset', name: 'Mind reset', blurb: 'Overloaded, need a pause', beat: 10, carrier: 200, evidence: 'moderate',
    passages: [[55, 1, 13]], key: '55:13', meaning: 'Which, then, of the favours of your Lord will you both deny?',
    dua: { t: "Hasbunallahu wa ni'mal-wakil.", m: 'Allah is sufficient for us, and He is the best disposer of affairs.', src: "Quran 3:173" } },
  { id: 'anger', name: 'Anger', blurb: 'Heated, about to react', beat: 10, carrier: 200, evidence: 'moderate',
    passages: [[3, 133, 134]], key: '3:134', meaning: '…those who restrain their anger and pardon people. And Allah loves those who do good.',
    dua: { t: "A'udhu billahi minash-shaytanir-rajim.", m: 'I seek refuge in Allah from Satan, the outcast.', src: 'Sahih al-Bukhari 6115',
      also: 'If you are standing, sit down. If anger still does not leave, lie down. (Sunan Abi Dawud 4782)' } },
  { id: 'envy', name: 'Jealousy', blurb: 'Comparing, feeling envious', beat: 6, carrier: 200, evidence: 'moderate',
    passages: [[113, 1, 5], [114, 1, 6]], key: '113:5', meaning: '…and from the evil of an envier when he envies.',
    dua: { t: "Ma sha'Allah, la quwwata illa billah.", m: 'What Allah wills. There is no power except with Allah.', src: 'Quran 18:39',
      also: 'When you admire what someone else has, ask Allah to bless it for them. (Sunan Ibn Majah 3509)' } },
  { id: 'backbiting', name: 'Backbiting', blurb: 'After gossip or harsh words', beat: 10, carrier: 200, evidence: 'moderate',
    passages: [[49, 11, 12]], key: '49:12', meaning: '…and do not spy on one another, and do not backbite one another.',
    dua: { t: "Subhanaka Allahumma wa bihamdik, ash-hadu an la ilaha illa ant, astaghfiruka wa atubu ilayk.",
      m: 'Glory be to You, O Allah, and praise. I bear witness that there is no god but You. I seek Your forgiveness and turn to You in repentance.', src: "Jami' at-Tirmidhi 3433" } },
  { id: 'focus', name: 'Focus & study', blurb: 'Before reading or work', beat: 40, carrier: 200, evidence: 'weak',
    passages: [[96, 1, 5]], key: '96:1–5', meaning: 'Read in the name of your Lord who created… Read, and your Lord is the Most Generous, who taught by the pen, taught man what he did not know.',
    dua: { t: "Rabbi zidni 'ilma.", m: 'My Lord, increase me in knowledge.', src: 'Quran 20:114' } },
  { id: 'sleep', name: 'Deep sleep', blurb: 'Winding down in bed', beat: 2, carrier: 160, evidence: 'weak',
    passages: [[67, 1, 30]], key: '67:1', meaning: 'Blessed is He in whose hand is the dominion, and He has power over all things.',
    dua: { t: 'Bismika Allahumma amutu wa ahya.', m: 'In Your name, O Allah, I die and I live.', src: 'Sahih al-Bukhari 6324',
      also: 'The Prophet ﷺ recited Al-Mulk before sleeping (Tirmidhi 2892), and Al-Ikhlas, Al-Falaq and An-Nas (Bukhari 5017).' } },
  { id: 'love', name: 'Love & connection', blurb: 'Softening the heart toward family', beat: 7.83, carrier: 528, evidence: 'weak',
    passages: [[30, 21, 21]], key: '30:21', meaning: 'And of His signs is that He created for you spouses from among yourselves so that you may find tranquillity in them, and He placed between you affection and mercy.',
    dua: { t: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yun.", m: 'Our Lord, grant us from our spouses and children the comfort of our eyes.', src: 'Quran 25:74' } },
  { id: 'healing', name: 'Healing (shifa)', blurb: 'When unwell or in pain', beat: 7.83, carrier: 432, evidence: 'weak',
    passages: [[1, 1, 7]], key: '17:82', why: true, meaning: 'And We send down of the Quran that which is healing and mercy for the believers.',
    dua: { t: "Allahumma Rabban-nas, adhhibil-ba's, ishfi antash-Shafi, la shifa'a illa shifa'uk, shifa'an la yughadiru saqama.",
      m: 'O Allah, Lord of mankind, remove the harm and heal, You are the Healer. There is no healing but Yours, a healing that leaves no illness.', src: 'Sahih al-Bukhari 5743',
      also: 'Al-Fatiha was used as ruqyah and the Prophet ﷺ approved it. (Sahih al-Bukhari 5736)' } },
].map(g => ({ ...g, band: BAND(g.beat) }));
export const GOAL = Object.fromEntries(GOALS.map(g => [g.id, g]));

/* ---------- Recitation ---------- */
// EveryAyah serves one MP3 per verse, named SSSAAA.mp3. 001001 is the basmala.
// qc = the same reciter's path on Quran.com's audio servers, tried in turn if EveryAyah can't be reached.
export const RECITERS = [
  { id: 'Alafasy_128kbps', name: 'Mishary Alafasy', qc: 'Alafasy/mp3' },
  { id: 'Husary_128kbps', name: 'Mahmoud Khalil Al-Husary', qc: 'Husary/mp3' },
  { id: 'Abdul_Basit_Murattal_192kbps', name: 'Abdul Basit (murattal)', qc: 'AbdulBaset/Murattal/mp3' },
];
const pad3 = n => String(n).padStart(3, '0');
export const ayahUrl = (s, a, reciter = RECITERS[0].id) => `https://everyayah.com/data/${reciter}/${pad3(s)}${pad3(a)}.mp3`;

export function ayahUrls(s, a, reciter = RECITERS[0].id) {
  const qc = RECITERS.find(r => r.id === reciter)?.qc;
  const file = `${qc}/${pad3(s)}${pad3(a)}.mp3`;
  return [ayahUrl(s, a, reciter), ...(qc ? [`https://verses.quran.com/${file}`, `https://verses.quran.foundation/${file}`] : [])];
}

export function playlist(goal, reciter) {
  const out = [];
  const item = (s, a, extra = {}) => { const urls = ayahUrls(s, a, reciter); return { s, a, ...extra, url: urls[0], urls }; };
  for (const [s, from, to] of goal.passages) {
    // A surah read from its first verse opens with the basmala (Al-Fatiha's first verse IS the basmala; At-Tawbah has none).
    if (from === 1 && s !== 1 && s !== 9) out.push(item(1, 1, { basmala: true }));
    for (let a = from; a <= to; a++) out.push(item(s, a));
  }
  return out;
}

// Phones only let a page play sound that a tap started. Playing this silent clip during the Begin tap
// unlocks the audio element, so the recitation can start by itself when the breathing ends.
export function silentWav(samples = 800, rate = 8000) {
  const b = new Uint8Array(44 + samples), v = new DataView(b.buffer);
  const tag = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  tag(0, 'RIFF'); v.setUint32(4, 36 + samples, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); // PCM, mono
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); // 8-bit
  tag(36, 'data'); v.setUint32(40, samples, true); b.fill(128, 44); // 128 = silence for 8-bit audio
  return b;
}
export const quranComUrl = ([s, a, b]) => `https://quran.com/${s}/${a === b ? a : `${a}-${b}`}`;
export const passageLabel = goal => goal.passages.map(([s, a, b]) => `${SURAH[s]} ${s}:${a}${b > a ? '–' + b : ''}`).join(' · ');

/* ---------- Tones ---------- */
// Binaural: each ear gets a slightly different pitch and the brain hears the difference as a beat. Needs headphones.
export function binauralPair(beat, carrier) { return { left: carrier - beat / 2, right: carrier + beat / 2 }; }

/* ---------- Breathing pacer ---------- */
// Default 5 s in, 5 s out = 6 breaths/min, the rate that maximises heart-rate variability in most adults.
export const BREATH = { inhale: 5, exhale: 5 };
// Cyclic sighing (Balban et al. 2023, Stanford RCT): a breath in through the nose, a short second breath in to fill
// the lungs, then a long slow breath out. 5 minutes a day improved mood more than mindfulness meditation.
export const PATTERNS = {
  slow: { name: 'Slow breathing: 5 s in, 5 s out', steps: [['in', 5], ['out', 5]] },
  sigh: { name: 'Cyclic sighing: double breath in, long breath out', steps: [['in', 2], ['top', 1], ['out', 6]] },
};
const stepsOf = b => b.steps || [['in', b.inhale], ['out', b.exhale]];
export const breathsPerMin = (b = BREATH) => Math.round(600 / stepsOf(b).reduce((a, [, d]) => a + d, 0)) / 10;
export function breathAt(t, b = BREATH) {
  const steps = stepsOf(b), cyc = steps.reduce((a, [, d]) => a + d, 0), x = ((t % cyc) + cyc) % cyc;
  const full = steps.some(([ph]) => ph === 'top') ? 0.8 : 1; // with a top-up, the first breath fills to 80%
  let acc = 0;
  for (const [phase, d] of steps) {
    if (x < acc + d) {
      const p = (x - acc) / d;
      return { phase, progress: p, scale: phase === 'in' ? full * ease(p) : phase === 'top' ? full + (1 - full) * ease(p) : 1 - ease(p) };
    }
    acc += d;
  }
  return { phase: steps[0][0], progress: 0, scale: 0 };
}
const ease = p => 0.5 - Math.cos(Math.PI * p) / 2;

/* ---------- Before / after ---------- */
export const SUPPORT_AT = 9; // tension 9–10 out of 10: show crisis support options first
export const needsSupport = before => before >= SUPPORT_AT;

export function summarize(sessions, n = 7) {
  const done = sessions.filter(s => Number.isFinite(s.before) && Number.isFinite(s.after));
  const recent = done.slice(-n);
  if (!recent.length) return { count: done.length, avgDrop: null, helpedPct: null, bestGoal: null, hrDrop: null };
  const avgDrop = Math.round(recent.reduce((a, s) => a + (s.before - s.after), 0) / recent.length * 10) / 10;
  const withHr = sessions.filter(s => s.hr?.before && s.hr?.after).slice(-n);
  const hrDrop = withHr.length ? Math.round(withHr.reduce((a, s) => a + (s.hr.before - s.hr.after), 0) / withHr.length) : null;
  const helpedPct = Math.round(recent.filter(s => s.after < s.before).length / recent.length * 100);
  const by = {};
  for (const s of done) (by[s.goal] ||= []).push(s.before - s.after);
  const ranked = Object.entries(by).filter(([, d]) => d.length >= 2).map(([g, d]) => [g, d.reduce((a, b) => a + b, 0) / d.length]).sort((a, b) => b[1] - a[1]);
  return { count: done.length, avgDrop, helpedPct, bestGoal: ranked[0]?.[0] ?? null, hrDrop };
}

/* ---------- Web Audio engine (browser only) ---------- */
export const MAX_GAIN = 0.12; // tones stay quiet: they sit under breathing, never over it

export class SukoonTones {
  constructor() { this.ctx = null; this.nodes = []; this.master = null; }
  // Browsers only allow sound after a tap: call this inside the click handler.
  unlock() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    this.ctx ||= new AC(); this.ctx.resume?.(); return true;
  }
  start({ beat, carrier, mode = 'binaural', volume = 0.6 }) {
    this.stop(0);
    if (!this.unlock()) return false;
    const c = this.ctx; c.resume?.();
    const now = c.currentTime;
    this.master = c.createGain();
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(MAX_GAIN * Math.max(0, Math.min(1, volume)), now + 4);
    this.master.connect(c.destination);
    if (mode === 'binaural' && c.createStereoPanner) {
      const { left, right } = binauralPair(beat, carrier);
      for (const [f, pan] of [[left, -1], [right, 1]]) {
        const o = c.createOscillator(), p = c.createStereoPanner();
        o.type = 'sine'; o.frequency.value = f; p.pan.value = pan;
        o.connect(p).connect(this.master); o.start(now); this.nodes.push(o, p);
      }
    } else {
      // Isochronic: one tone pulsed at the beat rate. Works on a phone speaker.
      const o = c.createOscillator(), amp = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
      o.type = 'sine'; o.frequency.value = carrier; amp.gain.value = 0.5;
      lfo.type = 'sine'; lfo.frequency.value = beat; depth.gain.value = 0.5;
      lfo.connect(depth).connect(amp.gain); o.connect(amp).connect(this.master);
      o.start(now); lfo.start(now); this.nodes.push(o, amp, lfo, depth);
    }
    return true;
  }
  // A soft chime at each change of breath, so the pacer can be followed with eyes closed.
  // Rising pitch = breathe in, falling = breathe out. A pure tone, no instrument.
  cue(phase, volume = 1) {
    if (!this.unlock()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    const [f0, f1] = phase === 'in' ? [330, 440] : phase === 'top' ? [440, 523] : [392, 262];
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 1.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * volume, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1.9);
  }
  setVolume(v) { if (this.master && this.ctx) this.master.gain.setTargetAtTime(MAX_GAIN * v, this.ctx.currentTime, 0.3); }
  stop(fade = 3) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, nodes = this.nodes, m = this.master, t = c.currentTime;
    m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(m.gain.value, t); m.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { nodes.forEach(n => { try { n.stop?.(); n.disconnect(); } catch {} }); try { m.disconnect(); } catch {} }, fade * 1000 + 100);
    this.nodes = []; this.master = null;
  }
}
