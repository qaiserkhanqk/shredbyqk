# Her premenstrual pattern, and the question budget

**Date:** 2026-11-27. **Flag:** `premenstrualPatterns`, off by default. **Code:** `js/cycle/premenstrual.js`, `js/cycle/asks.js`.
**Status:** synthetic tests only. Wording awaits clinician review. Not a diagnosis.

## What she sees
- **Symptoms:** she can turn on the ones she wants to track. The existing ones are cravings, sleep, mood, energy and pain. New: **appetite** (less / usual / more; never calories, diets or weight), **bloating**, **breast tenderness** and **headache**.
- **While it is still learning:** "Learning your pattern: 2 of 3 cycles with symptom logs before and after your period. 1 more cycle needed."
- **Her pattern, with counts:** "In 3 of your last 3 cycles with logs, you logged strong cravings in the 7 days before your period, clearly more than in the week after it (days 4 to 10 of your cycle)."
- **In the 7 days before her expected period, in the app only:**
  - "Your next period is most likely between … In your last 3 cycles, you logged strong cravings and poor sleep in the 7 days before your period. If you're noticing any of these now, it may be part of that pattern. Stress, illness, travel, alcohol or a bad night can cause the same things."
  - At most **3 one-tap questions**, about her pattern symptoms only, with **Save** and **Not now**.
- **A mood pattern adds a note:** mood changes that come back every cycle and get in the way of daily life have a name (PMDD); treatments help, and it's worth talking to a doctor; with thoughts of harming herself, get help straight away.
- **Never:** "binge eating" or any other label, diet or calorie advice, or "is" instead of "may".

## The rule, and why
The app uses the **C-PASS** rule. In each of her last **3** cycles where she logged the symptom both before and after her period, its average score on the **7 days before her period** (days −7 to −1) is at least **30% of the scale** above its average on **cycle days 4 to 10**. A notable answer must also appear before the period.
- **Counting backwards:** cycles are counted back from each period start, so the pattern shows even when her cycle length varies. The older pattern finder counts forwards from day 1, which smears premenstrual symptoms.
- **Unknown cycles:** a cycle without logs on both sides is skipped as unknown, never counted as "it didn't happen".
- **Not used:** in pregnancy, after a birth, or on hormonal contraception (bleeds on hormonal contraception aren't periods). Pregnancy gaps and cycles from before a pregnancy are left out.
- **Sources:**
  - C-PASS: Eisenlohr-Moul TA et al., *Am J Psychiatry* 2017;174:51–59, doi:10.1176/appi.ajp.2016.15121510. It sets the windows and the 30% threshold, calibrated against expert clinical diagnosis. C-PASS itself needs 2 cycles; we require 3.
  - ACOG Clinical Practice Guideline No. 7, *Management of Premenstrual Disorders*, *Obstet Gynecol* 2023;142:1516–33, doi:10.1097/AOG.0000000000005426. Timing is the key, from a symptom log over several cycles.
  - ACOG's PMS criteria (Practice Bulletin No. 15, as summarised in *Am J Manag Care* 2005). Symptoms in the 5 days before the period, in each of 3 cycles, not back before cycle day 13. This is the "strict rule", kept for comparison.
  - DRSP: Endicott J et al., *Arch Womens Ment Health* 2006;9:41–49, doi:10.1007/s00737-005-0103-y. Daily ratings.
- **Why C-PASS and not the strict rule:** the synthetic comparison below. Both kept false patterns below 1%. The strict rule found only 13–16% of patterns, because one occasional symptom in the week after cancelled a cycle. C-PASS found 32–35%.
- **App choices, not from the sources:**
  - the last 6 usable cycles are looked at;
  - at most 3 questions;
  - severity scores: graded symptoms by their order; others count 1 for a notable answer.

## Synthetic comparison
Full report: `docs/premenstrual-eval-synthetic.md`. Regenerate it with `node tools/premenstrual-eval.mjs 1500 20261127`. Every generator setting is an assumption.

| Method | People with no pattern told they have one | People with a pattern: found |
|---|---|---|
| Older forward finder (`patterns.js`) | 32–33% | 89–90% |
| Strict ACOG rule | 0.7% | 13–14% |
| **C-PASS (the app's rule)** | **0.2–0.5%** | **32–34%**; about half (51–53%) when the pattern is clear and she logs most days |

The figures are from 2 seeds of 1,500 people per group.
- **What this means:** the app now almost never tells someone she has a pattern she doesn't have. In exchange, it stays quiet ("still learning" or nothing) for many weaker or sparsely logged patterns.
- **What it doesn't mean:** these are not real-world detection rates; they depend on the assumed pattern strengths.
- **Next:** check on real daily symptom data. mcPHASES may have it, once PhysioNet access is approved (to be confirmed).

## The question budget (product owner: "won't they get irritated?")
- **One check-in a day.** On a day she gets "Has your period started?" or her premenstrual questions, Zara doesn't ask as well.
- **No new notifications.** The premenstrual card is in the app only.
- **At most 3 one-tap questions,** about her pattern symptoms only.
- **Backs off.** After 3 "Not now" in a row, Zara (and, separately, the premenstrual questions) asks only every other day until she answers again. It never stops for good.
- **"Light" or "Normal"** (Settings): "Light" means Zara checks in only before her period and on its first day.

These are UI choices to avoid question fatigue, not physiology.
