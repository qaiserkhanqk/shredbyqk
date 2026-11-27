// Muhammad's voice (server): Gemini speech → WAV, cached. Run: node tests/chatvoice.test.mjs
process.env.GEMINI_API_KEY = 'test-key'; delete process.env.CHAT_AI; delete process.env.FOOD_AI;
const { speak, wav, voiceOn } = await import('../tools/chat-assistant.mjs');
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${got !== undefined ? `  — ${JSON.stringify(got)}` : ''}`); if (!ok) fails++; };

const w = wav(Buffer.alloc(4800), 24000);
check('WAV header', w.toString('ascii', 0, 4) === 'RIFF' && w.toString('ascii', 8, 12) === 'WAVE' && w.readUInt32LE(24) === 24000 && w.length === 44 + 4800);
check('voice is on with a Gemini key', voiceOn());
const calls = [];
const fake = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) }); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(9600).toString('base64') } }] } }] }) }; };
const a = await speak('Shabash Sara! Aaj protein pura karo.', fake);
check('asks the speech model for audio in a male coach voice', /tts:generateContent$/.test(calls[0].url) && calls[0].body.generationConfig.responseModalities[0] === 'AUDIO' && calls[0].body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Charon');
check('returns a playable WAV', a.toString('ascii', 0, 4) === 'RIFF' && a.length === 44 + 9600);
await speak('Shabash Sara! Aaj protein pura karo.', fake);
check('the same reply twice costs one call', calls.length === 1);
await speak('میں نے آپ کا پیغام بھیج دیا ہے', fake);
check('Urdu text goes to the voice as it is', calls[1].body.contents[0].parts[0].text.includes('میں نے آپ کا پیغام'));
let bad = false; try { await speak('  ', fake); } catch { bad = true; }
check('empty text refused', bad);
let err = ''; try { await speak('x', async () => ({ ok: false, status: 429 })); } catch (e) { err = e.message; }
check('provider error surfaces (server answers 502, app falls back to the phone voice)', /429/.test(err), err);
console.log(fails ? `\n${fails} FAILED` : '\nall chat voice checks passed');
process.exit(fails ? 1 : 0);
