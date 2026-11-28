// Minimal test harness shared by the research test files. Prints one line per check and a final summary.
let fails = 0, count = 0;
export function check(name, ok, detail = '') { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); }
/** Returns the thrown error if fn throws an error whose message/code contains `code`, the error for any throw if code is omitted, else null. */
export function throwsCode(fn, code) { try { fn(); return null; } catch (e) { return !code || String(e.code || '').includes(code) || String(e.message).includes(code) ? e : null; } }
export async function throwsCodeAsync(fn, code) { try { await fn(); return null; } catch (e) { return !code || String(e.code || '').includes(code) || String(e.message).includes(code) ? e : null; } }
export function done() { console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0); }
