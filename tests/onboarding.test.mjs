// Personalised sign-up (js/onboarding.js): what each answer turns on. Written BEFORE the module. Synthetic only.
// Product owner's decisions (2026-11-27): ask "Which best describes you?"; a man never sees period tracking; a woman
// (and anyone who answers "Other or prefer not to say") is asked whether she'd like to track her periods; ages 13 and
// over only; if yes, Zara introduces herself as her cycle companion (not "clinical"), on screen, never in a notification.
// Run: node tests/onboarding.test.mjs
let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const words = v => JSON.stringify(v);
let O = {}; try { O = await import('../js/onboarding.js'); } catch (e) { check('module js/onboarding.js exists', false, e.message); }
const p = a => { try { return O.personalise(a); } catch (e) { return { error: e.message }; } };

// Which questions are shown
check('man: no age or period question', p({ gender: 'man' }).ask?.age === false && p({ gender: 'man' }).ask?.periods === false, words(p({ gender: 'man' })));
check('woman: asked her age', p({ gender: 'woman' }).ask?.age === true);
check('other or prefer not to say: asked her age too (nobody who has periods is locked out)', p({ gender: 'other' }).ask?.age === true);
check('woman under 13: no period question, with a note', p({ gender: 'woman', age: 'under13' }).ask?.periods === false && /13/.test(p({ gender: 'woman', age: 'under13' }).note || ''));
check('woman 13–17 and 18+: asked whether she would like to track her periods', p({ gender: 'woman', age: '13-17' }).ask?.periods === true && p({ gender: 'woman', age: '18+' }).ask?.periods === true);
check('"Not right now": asked which applies (pregnant, recently gave birth, menopause, just not now)', p({ gender: 'woman', age: '18+', periods: 'notNow' }).ask?.notNow === true);

// What each answer turns on
const man = p({ gender: 'man' });
check('man: period tracking and Zara stay off, and he lands on Today', man.flags?.cycleTracking === false && man.flags?.companion === false && man.route === 'today' && man.sex === 'male', words(man));
const yes = p({ gender: 'woman', age: '18+', periods: 'yes' });
check('woman, yes: period tracking and Zara on, and she goes straight to her cycle screen', yes.flags?.cycleTracking === true && yes.flags?.companion === true && yes.route === 'cycle' && yes.zaraIntro === true && yes.sex === 'female', words(yes));
const teen = p({ gender: 'woman', age: '13-17', periods: 'yes' });
check('13–17, yes: the same', teen.flags?.cycleTracking === true && teen.route === 'cycle');
const under = p({ gender: 'woman', age: 'under13', periods: 'yes' });
check('under 13: never turned on, even if a period answer is sent', under.flags?.cycleTracking === false && under.route === 'today', words(under));
const no = p({ gender: 'woman', age: '18+', periods: 'no' });
check('woman, no: off, lands on Today, and is told she can turn it on in settings', no.flags?.cycleTracking === false && no.route === 'today' && /settings|profile/i.test(no.note || ''), words(no));
const preg = p({ gender: 'woman', age: '18+', periods: 'notNow', notNow: 'pregnant' });
check('not right now, pregnant: pregnancy mode on and she goes to her cycle screen', preg.flags?.cycleTracking === true && preg.flags?.pregnancyMode === true && preg.intent === 'pregnant' && preg.route === 'cycle', words(preg));
const birth = p({ gender: 'woman', age: '18+', periods: 'notNow', notNow: 'postpartum' });
check('not right now, recently gave birth: postpartum (pregnancy mode) on', birth.flags?.pregnancyMode === true && birth.intent === 'postpartum');
const meno = p({ gender: 'woman', age: '18+', periods: 'notNow', notNow: 'menopause' });
check('not right now, menopause: menopause mode on', meno.flags?.cycleTracking === true && meno.flags?.midlifeMode === true && meno.intent === 'menopause');
const later = p({ gender: 'woman', age: '18+', periods: 'notNow', notNow: 'later' });
check('not right now, just not now: off, lands on Today', later.flags?.cycleTracking === false && later.route === 'today');
const other = p({ gender: 'other', age: '18+', periods: 'yes' });
check('other or prefer not to say, yes: on (no sex assumed for the body-fat formula)', other.flags?.cycleTracking === true && other.sex === null, words(other));
const skip = p({});
check('no answers (skipped): nothing is changed', skip.flags && Object.keys(skip.flags).length === 0 && skip.route === 'today', words(skip));

// Zara's welcome
check('Zara is introduced as a companion, never as clinical or medical', typeof O.ZARA_WELCOME === 'string' && /companion/i.test(O.ZARA_WELCOME) && !/clinic|medical|doctor|diagnos/i.test(O.ZARA_WELCOME), O.ZARA_WELCOME);
check('the welcome says she can rename Zara', /rename/i.test(O.ZARA_WELCOME || ''));
check('the minimum age is 13', O.MIN_CYCLE_AGE === 13);
check('invalid answers are refused', !!p({ gender: 'robot' }).error && !!p({ gender: 'woman', age: '12' }).error);
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
