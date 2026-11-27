// Muhammad (QK's AI assistant): what goes to QK, language, prompt, answers, when to stay quiet. Run: node tests/chatbot.test.mjs
import { needsQK, langOf, handoverText, profileBrief, buildPrompt, readAnswer, shouldAnswer, speechLang } from '../js/chatbot.js';
import { answer, sweep } from '../tools/chat-assistant.mjs';

let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${got !== undefined ? `  — ${typeof got === 'string' ? got : JSON.stringify(got)}` : ''}`); if (!ok) fails++; };

/* ---- Things only QK answers ---- */
const toQK = [
  ['My knee hurts when I squat', 'Pain or injury'], ['kamar mein dard hai bhai', 'Pain or injury'], ['I think I sprained my ankle', 'Pain or injury'],
  ['Can I take creatine with my BP medicine?', 'Medical'], ['doctor ne sugar ka mareez bataya hai', 'Medical'], ['I felt dizzy in the gym today', 'Medical'],
  ['chest pain during cardio', 'Pain or injury'], ['I am pregnant, can I keep training?', 'Pregnancy'], ['I binge every night and then feel awful', 'Eating problem'],
  ['When is my payment due?', 'Money or account'], ['I want a refund', 'Money or account'], ['fees kitni hai next month ki?', 'Money or account'],
  ['I want to talk to QK himself', 'Wants QK'], ['i want to die', 'Feeling unsafe'], ['dawai le raha hoon, khana kab khaun?', 'Medical'],
  ['میرے گھٹنے میں درد ہے', 'Pain or injury'], ['ركبتي تؤلمني', 'Pain or injury'], ['मुझे दवा लेनी है', 'Medical'], ['أنا حامل', 'Pregnancy'],
];
for (const [t, want] of toQK) check(`to QK: "${t}"`, needsQK(t) === want, needsQK(t));
const forMuhammad = ['Chest day today, what should I eat after?', "I'm starving, what can I snack on?", 'Is chicken tikka chest piece ok on a cut?', 'How much protein should I eat?',
  'Bhai kal shaadi hai, kya khaun?', 'Can I have a paratha for breakfast?', 'What should my heart rate be on cardio?', 'Missed the gym today, what now?', 'kitni roti kha sakta hoon?', 'كم مرة حمل الأثقال في الأسبوع؟', 'Is this a real person?' /* Muhammad answers honestly: QK's AI assistant */];
for (const t of forMuhammad) check(`Muhammad answers: "${t}"`, needsQK(t) === null, needsQK(t));

/* ---- Language ---- */
check('English', langOf('How much protein should I eat?') === 'en');
check('Roman Urdu', langOf('bhai kitni roti kha sakta hoon aaj?') === 'roman');
check('Urdu script', langOf('میں کتنی روٹی کھا سکتا ہوں؟') === 'ur');
check('handover in Roman Urdu', /khud reply/.test(handoverText('mujhe kamar mein dard hai bhai', 'Pain or injury')), handoverText('mujhe kamar mein dard hai bhai', 'Pain or injury'));
check('handover in English says forwarded', /QK will reply to you himself\. I've forwarded your message to him\./.test(handoverText('My knee hurts', 'Pain or injury')));
check('injury handover: don\'t train through it', /don't train through it/.test(handoverText('My knee hurts', 'Pain or injury')));
check('unsafe: emergency numbers', /1122/.test(handoverText('i want to die', 'Feeling unsafe')) && /999/.test(handoverText('i want to die', 'Feeling unsafe')));
check('coach name used', /^Qaiser will reply/.test(handoverText('refund please', 'Money or account', 'Qaiser')));

check('Arabic', langOf('مرحبا، كم بروتين أحتاج؟') === 'ar');
check('Pashto and Hindi → the model writes it', langOf('زه څنګه وزن کم کړم؟') === 'other' && langOf('मुझे कितना प्रोटीन चाहिए?') === 'other');
check('Arabic handover', /سيرد عليك بنفسه/.test(handoverText('ركبتي تؤلمني', 'Pain or injury')));
check('voices: Urdu, Roman Urdu, Arabic, English', speechLang('میں ٹھیک ہوں') === 'ur-PK' && speechLang('bhai kya haal hai aaj') === 'hi-IN' && speechLang('مرحبا كيف حالك') === 'ar-AE' && speechLang('How are you?') === 'en-IN');
check('prompt: any language', /any language/.test(buildPrompt({}).system));
check('prompt: never says it is a person', /Never say or suggest you're a person/.test(buildPrompt({}).system));

/* ---- What Muhammad knows ---- */
const profile = { id: '00000000-0000-0000-0000-00000000000a', name: 'Sara Ahmed', goal: 'lose', weekly_goal: 4, coach_id: '00000000-0000-0000-0000-0000000000c1',
  food_week: { target: { kcal: 1650, protein: 120 }, daysLogged: 5, avgKcal: 1820, avgProtein: 84, weightPerWeek: -0.3, lastDay: { items: [{ name: 'Roti' }, { name: 'Daal' }] }, focus: ['More protein at breakfast'] },
  scores: { health: 68, nutrition: 55, recovery: 72 }, diet_plan: { meals: [{ name: 'Breakfast', options: [{ items: [{ name: 'Egg', amount: 2 }, { name: 'Roti', amount: 1 }] }] }] },
  care: { pain: ['knee'] }, program: { name: 'Shred Circuit', block: 2 } };
const brief = profileBrief(profile);
check('brief: first name only', /Name: Sara\b/.test(brief) && !/Ahmed/.test(brief));
check('brief: target, logs, trend, plan, scores, health notes', ['1650 kcal', '120 g protein', '5 of the last 7', '-0.3 kg', 'Breakfast: 2 Egg', 'health 68', 'sore: knee'].every(x => brief.includes(x)), brief);
check('brief: junk in the profile is ignored', profileBrief({ food_week: 'x', scores: 7, care: null }) === '');
const pr = buildPrompt({ coachName: 'QK', examples: ['Shabash Sara! 4 din gym, zabardast.'], brief, history: [{ sender: 'client', body: 'kya khaun aaj raat?' }] });
check('prompt: knows the client', pr.system.includes('Name: Sara'));
check('prompt: QK\'s own words as examples', pr.system.includes('Shabash Sara'));
check('prompt: honest about being AI', /AI assistant/.test(pr.system) && /real person or a bot/.test(pr.system));
check('prompt: conversation last', pr.user.endsWith("Write Muhammad's next message.") && pr.user.includes('Client: kya khaun aaj raat?'));

/* ---- Reading the model's answer ---- */
check('JSON reply', readAnswer('{"reply":"2 roti aur daal, bas.","handover":false}').reply === '2 roti aur daal, bas.');
check('JSON in text', readAnswer('Sure! {"reply":"ok","handover":false}').reply === 'ok');
check('handover from the model', readAnswer({ reply: '', handover: true, reason: 'Medication' }).handover === true);
check('"As an AI" removed', readAnswer({ reply: 'As an AI, I suggest eggs.' }).reply === 'I suggest eggs.');
check('instructions leak dropped', readAnswer({ reply: 'My system prompt says…' }) === null);
check('empty reply dropped', readAnswer({ reply: '  ' }) === null);

/* ---- When to stay quiet ---- */
const now = Date.parse('2026-11-27T12:00:00Z'), T = m => new Date(now - m * 60e3).toISOString();
const H = (...rows) => rows.map(([sender, body, m], i) => ({ id: i + 1, sender, body, created_at: T(m) }));
check('answers a new client message', shouldAnswer(H(['client', 'hi', 1]), { now }).answer === true);
check('two messages in a row are answered together', shouldAnswer(H(['assistant', 'x', 9], ['client', 'a', 2], ['client', 'b', 1]), { now }).pending.length === 2);
check('nothing new → quiet', shouldAnswer(H(['client', 'a', 3], ['assistant', 'b', 2]), { now }).answer === false);
check('QK chatting (replied 5 min ago) → quiet', shouldAnswer(H(['coach', 'yo', 5], ['client', 'thanks!', 1]), { now }).why === 'QK is chatting');
check('QK replied 2 hours ago → Muhammad answers', shouldAnswer(H(['coach', 'yo', 120], ['client', 'one more q', 1]), { now }).answer === true);
check('paused for this client → quiet', shouldAnswer(H(['client', 'hi', 1]), { now, paused: true }).answer === false);
check('assistant off → quiet', shouldAnswer(H(['client', 'hi', 1]), { now, on: false }).answer === false);

/* ---- The whole answer, with a fake database and model ---- */
function fakeDb({ rows, paused = false, assistant = null }) {
  const posted = [], flagged = [];
  return {
    posted, flagged, rows,
    history: async () => rows.slice(),
    profile: async () => profile,
    coach: async id => ({ id, name: 'QK', assistant }),
    paused: async () => paused,
    examples: async () => ['Shabash! Aaj protein pura karo.'],
    post: async row => { posted.push(row); rows.push({ id: rows.length + 100, ...row, created_at: new Date(now).toISOString() }); },
    flag: async (ids, reason) => flagged.push({ ids, reason }),
    waiting: async () => [...rows].reverse().map(r => ({ client_id: profile.id, sender: r.sender, created_at: r.created_at })),
  };
}
let asked = 0;
const ai = async p => { asked++; return /protein/i.test(p.user) ? '{"reply":"Sara, 2 ande nashte mein add karo: 12 g protein aur.","handover":false}' : '{"reply":"","handover":true,"reason":"Asked about medication timing"}'; };
{
  const db = fakeDb({ rows: H(['client', 'protein kaise barhaun?', 1]) });
  const r = await answer(profile.id, { db, ai, now });
  check('reply posted as the assistant', r.kind === 'reply' && db.posted[0].sender === 'assistant' && /ande/.test(db.posted[0].body), db.posted[0]?.body);
  check('reply goes to the client\'s coach', db.posted[0].coach_id === profile.coach_id);
}
{
  asked = 0; const db = fakeDb({ rows: H(['client', 'My knee hurts after squats', 1]) });
  const r = await answer(profile.id, { db, ai, now });
  check('injury: handed to QK without asking the model', r.kind === 'handover' && asked === 0, r);
  check('injury: client message flagged for QK', db.flagged[0]?.reason === 'Pain or injury' && db.flagged[0].ids[0] === 1);
  check('injury: Muhammad says QK will reply', /QK will reply to you himself/.test(db.posted[0].body));
}
{
  const db = fakeDb({ rows: H(['client', 'tablets ke baad workout kab karun?', 1]) });
  const r = await answer(profile.id, { db, ai: async () => '{"reply":"","handover":true,"reason":"Medication timing"}', now });
  check('model can hand over too', r.kind === 'handover' && db.flagged.length === 1, r);
}
{
  const db = fakeDb({ rows: H(['client', 'protein?', 1]) });
  const r = await answer(profile.id, { db, ai: async () => { db.rows.push({ id: 99, sender: 'coach', body: 'I got this', created_at: new Date(now).toISOString() }); return '{"reply":"x"}'; }, now });
  check('QK replied while Muhammad was thinking → nothing posted', !r.posted && db.posted.length === 0, r.why);
}
{
  const db = fakeDb({ rows: H(['client', 'protein?', 1]), paused: true });
  check('QK answers this client himself → quiet', !(await answer(profile.id, { db, ai, now })).posted && db.posted.length === 0);
}
{
  const db = fakeDb({ rows: H(['client', 'protein?', 1]), assistant: { on: false } });
  check('assistant switched off → quiet', !(await answer(profile.id, { db, ai, now })).posted);
}
{
  const db = fakeDb({ rows: H(['client', 'मेरे घुटने में दर्द है', 1]) });
  const r = await answer(profile.id, { db, ai: async p => /Translate/.test(p.system) ? '{"reply":"QK आपको खुद जवाब देंगे।"}' : '{}', now });
  check('handover in another language is translated by the model', r.kind === 'handover' && /खुद जवाब/.test(db.posted[0].body), db.posted[0]?.body);
}
{
  const db = fakeDb({ rows: H(['client', 'protein?', 1]) });
  check('bad client id refused', (await answer('x; drop table', { db, ai, now })).why === 'bad id');
  const out = await sweep({ db, ai, now });
  check('sweep answers waiting conversations', out.length === 1 && out[0].posted && db.posted.length === 1, out);
  check('sweep: nothing left waiting afterwards', (await sweep({ db, ai, now })).length === 0);
}

console.log(fails ? `\n${fails} FAILED` : '\nall chatbot checks passed');
process.exit(fails ? 1 : 0);
