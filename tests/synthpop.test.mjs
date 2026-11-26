// The synthetic population generator (js/cycle/synthpop.js) and the population check (tools/synthetic-population-eval.mjs).
// Synthetic data only. Run: node tests/synthpop.test.mjs
import { makePerson, makePopulation, personState, PARAMS, SOURCES, SYNTHETIC_BANNER } from '../js/cycle/synthpop.js';
import { evaluatePopulation } from '../tools/synthetic-population-eval.mjs';
let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

check('labelled synthetic, with a "not accuracy" banner', /SYNTHETIC/.test(SYNTHETIC_BANNER) && /not real-world/i.test(SYNTHETIC_BANNER));
check('deterministic: the same seed gives the same person', JSON.stringify(makePerson(7)) === JSON.stringify(makePerson(7)) && JSON.stringify(makePerson(7)) !== JSON.stringify(makePerson(8)));
check('every setting says where it comes from', Object.values(PARAMS).every(v => typeof v.src === 'string' && v.src.length > 5));
check('published sources carry a DOI or PMID where cited', ['bull2019', 'goodale2019', 'bouchard2026', 'acog651'].every(k => SOURCES[k]?.doi) && SOURCES.moghissi1976.pmid);

const pop = makePopulation(600), reg = pop.filter(p => p.group === 'regular').flatMap(p => p.truth.filter(c => !c.open && !c.pregnancy));
const ov = reg.filter(c => !c.anovulatory);
const lut = ov.map(c => c.length - c.ovulationDay), fol = ov.map(c => c.ovulationDay);
check(`regular group: luteal phase averages about 12.4 days (Bull 2019): ${mean(lut).toFixed(2)}`, Math.abs(mean(lut) - 12.4) < 0.6);
check(`regular group: luteal phase stays within 7–17 days`, lut.every(x => x >= 7 && x <= 17));
check(`regular group: follicular phase within 10–30 days (Bull 2019 95% range), average ${mean(fol).toFixed(1)}`, fol.every(x => x >= 10 && x <= 30) && Math.abs(mean(fol) - 16) < 2);
const anov = reg.filter(c => c.anovulatory).length / reg.length;
check(`regular group: about 11% anovulatory cycles (Bouchard 2026): ${(100 * anov).toFixed(1)}%`, Math.abs(anov - 0.11) < 0.04);
const noRise = ov.filter(c => !c.visibleRise).length / ov.length;
check(`about 20% of ovulatory cycles without a visible rise (Moghissi 1976): ${(100 * noRise).toFixed(1)}%`, Math.abs(noRise - 0.20) < 0.04);
check('rise sizes within 0.28–0.56 °C (Goodale 2019)', ov.every(c => c.rise >= 0.28 && c.rise <= 0.56));
const teen = pop.filter(p => p.group === 'teen').flatMap(p => p.truth.filter(c => !c.open && !c.pregnancy));
check('teen cycles within 21–45 days (ACOG CO 651)', teen.every(c => c.length >= 21 && c.length <= 45));
check('no band nights for the no-band group; band nights for others', pop.filter(p => p.group === 'noBand').every(p => p.nights.length === 0) && pop.filter(p => p.group === 'regular').every(p => p.nights.length > 100));
check('the after-pregnancy group has a pregnancy in its history', pop.filter(p => p.group === 'afterPregnancy').every(p => p.truth.some(c => c.pregnancy)));
let built = 0; try { for (const p of pop.slice(0, 120)) { personState(p); built++; } } catch (e) { check('app states build for every group', false, e.message); }
check('app states build from the synthetic histories, through the app\'s own logging functions', built === 120);

const r = evaluatePopulation(80);
check(`the app's rules hold at every check point (${r.evals} checks on 80 synthetic people)`, r.problems.length === 0, r.problems.slice(0, 3).join(' | '));
check('both estimates were exercised (dates-only dates and band adjustments both occurred)', r.rows.some(x => x.dErr != null) && r.rows.some(x => x.aStatus === 'adjusted'));
check('the band estimate also abstained for stale data and for a band change at some point', ['stale_band', 'new_setup'].every(k => r.rows.some(x => x.aReason === k)), [...new Set(r.rows.map(x => x.aReason))].join(','));
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
