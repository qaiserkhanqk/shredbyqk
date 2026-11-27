// Browser choice for every browser test (app and research dashboard).
//   E2E_BROWSER=chromium (default) | firefox | webkit
// Firefox and WebKit (Safari's engine) must be installed for the Playwright version in use, e.g.
//   npx playwright install firefox webkit
// If the chosen browser is not installed, the test stops with exit code 1 and says so: it never silently falls back
// to another browser or reports a skipped run as passed.
const pw = require('playwright');

const NAMES = ['chromium', 'firefox', 'webkit'];
function chosen() {
  const name = (process.env.E2E_BROWSER || 'chromium').toLowerCase();
  if (!NAMES.includes(name)) { console.error(`E2E_BROWSER must be one of ${NAMES.join(', ')} (got "${name}")`); process.exit(1); }
  return name;
}
/** Launches the chosen browser. Browser-specific options: chromiumArgs (command-line switches), firefoxUserPrefs. */
async function launch({ chromiumArgs, firefoxUserPrefs, ...opts } = {}) {
  const name = chosen();
  if (name === 'chromium' && chromiumArgs) opts.args = [...(opts.args || []), ...chromiumArgs];
  if (name === 'firefox' && firefoxUserPrefs) opts.firefoxUserPrefs = { ...(opts.firefoxUserPrefs || {}), ...firefoxUserPrefs };
  try {
    const b = await pw[name].launch(opts);
    if (process.env.E2E_BROWSER) console.log(`browser: ${name} ${b.version()}`);
    return b;
  } catch (e) {
    if (/Executable doesn't exist|browserType\.launch: .*(not found|missing)|Host system is missing dependencies/i.test(e.message)) {
      console.error(`FAIL ${name} is not installed (or lacks system libraries) for this Playwright version. Install it with: npx playwright install --with-deps ${name}`);
      process.exit(1);
    }
    throw e;
  }
}

/** Merge 2026-11-27: the app's first launch is now a multi-step sign-up (name, an optional "about you" step, a focus
 *  question...), returning users skip it, and there is no Body tab. This gets past the sign-up if it is showing (name
 *  "Test", the optional step skipped, "calm" as the focus, which finishes the sign-up at once) and opens the cycle
 *  screen: the Cycle tab when shown, otherwise Today > Body > Cycle. */
async function finishSignUp(p, { tap = 'click' } = {}) {
  if (!(await p.isVisible('#welcome').catch(() => false))) return;
  if (await p.isVisible('#welcomeName').catch(() => false)) await p.fill('#welcomeName', 'Test');
  await p[tap]('#welcomeBtn');
  if (await p.isVisible('#aboutNext').catch(() => false)) await p[tap]('#aboutNext');
  if (await p.isVisible('#ob2 [data-focus=calm]').catch(() => false)) await p[tap]('#ob2 [data-focus=calm]');
  await p.waitForTimeout(200);
}
async function openCycle(p, { tap = 'click' } = {}) {
  await finishSignUp(p, { tap });
  if (await p.isVisible('.tabs [data-tab=cycle]').catch(() => false)) await p[tap]('.tabs [data-tab=cycle]');
  else { await p[tap]('.tabs [data-tab=today]'); await p[tap]('#today [data-go=body]'); await p[tap]('#body [data-go=cycle]'); }
}
module.exports = { launch, chosen, NAMES, finishSignUp, openCycle };
