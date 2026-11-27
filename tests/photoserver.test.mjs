// The photo server stays up and cheap: ask once when sure, retry what's worth retrying, practice mode works.
process.env.FOOD_AI = 'mock'; process.env.MOCK_MS = '5';
const { sureEnough, withRetry, askMock, server, checkAnswer } = await import('../tools/food-vision-server.mjs');
const { catalogue } = await import('../js/foodphoto.js');
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };
const item = x => ({ dish: 'chicken_karahi', alternative: 'none', other_name: '', servings: 1, meat_share: 'normal', oil: 'normal', confidence: 0.9, ...x });
check('clear answer → one AI call is enough', sureEnough({ scene: 'plate', items: [item(), item({ dish: 'naan' })] }));
check('a runner-up ("naan or roghni naan?") → ask twice more', !sureEnough({ scene: 'plate', items: [item({ alternative: 'roghni_naan' })] }));
check('low confidence → ask twice more', !sureEnough({ scene: 'plate', items: [item({ confidence: 0.6 })] }));
check('"other" dish or nothing found → ask twice more', !sureEnough({ items: [item({ dish: 'other' })] }) && !sureEnough({ items: [] }));
let n = 0;
const flaky = await withRetry(async () => { if (++n < 3) { const e = new Error('rate limited'); e.status = 429; throw e; } return 'ok'; }, { base: 1 });
check('rate limited → retried with backoff, then succeeds', flaky === 'ok' && n === 3);
let m = 0;
try { await withRetry(async () => { m++; const e = new Error('bad'); e.status = 400; throw e; }, { base: 1 }); } catch {}
check('a bad request is not retried', m === 1);
const ids = catalogue().map(c => c.id), a1 = await askMock({ ids, hashOf: 'same photo' }), a2 = await askMock({ ids, hashOf: 'same photo' });
check('practice mode: same photo, same answer, real dish ids', JSON.stringify(a1) === JSON.stringify(a2) && a1.items.every(i => ids.includes(i.dish)));
// End to end over HTTP in practice mode.
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const post = () => fetch(`${base}/food-vision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: 'data:image/jpeg;base64,' + Buffer.from('x' + Math.random()).toString('base64'), hash: String(Math.random()), samples: 'auto', catalogue: catalogue() }) });
const rs = await Promise.all(Array.from({ length: 40 }, post));
const bodies = await Promise.all(rs.map(r => r.json()));
check('40 photos at once: all answered', rs.every(r => r.status === 200) && bodies.every(b => b.samples.length === 1 || b.samples.length === 3));
const h = await (await fetch(`${base}/health`)).json();
check('health shows served photos, calls and an estimated cost', h.served === 40 && h.usage.calls >= 40 && h.estCostUsd > 0 && h.provider === 'mock');
check('"auto" asks fewer than 3 calls per photo on average', h.usage.calls / h.served < 3, (h.usage.calls / h.served).toFixed(2));
const fast = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/food-vision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: 'data:image/jpeg;base64,' + Buffer.from('f' + Math.random()).toString('base64'), hash: String(Math.random()), samples: 'fast', catalogue: catalogue() }) }).then(r => r.json())));
check('"fast": one answer back, with refine:true only when unsure', fast.every(b => b.samples.length === 1 && typeof b.refine === 'boolean') && fast.some(b => b.refine) && fast.some(b => !b.refine));
const fixed = checkAnswer({ items: [{ dish: 'Chicken Karahi', alternative: 'naan' }, { dish: 'pizza_margherita_xl', alternative: 'nope' }] }, ids);
check('answers mapped onto real dishes; unknown ones become "other" with their name', fixed.items[0].dish === 'chicken_karahi' && fixed.items[0].alternative === 'naan' && fixed.items[1].dish === 'other' && fixed.items[1].other_name === 'pizza_margherita_xl' && fixed.items[1].alternative === 'none');
server.close();
console.log(fails ? `\n${fails} failed` : '\nall photo server checks pass');
process.exit(fails ? 1 : 0);
