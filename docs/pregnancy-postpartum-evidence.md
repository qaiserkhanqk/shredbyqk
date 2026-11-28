# Pregnancy and postpartum modes: evidence and design

**Date:** 2026-11-25. **Status:** prototype behind the flag `pregnancyMode` (off). **All wording is awaiting clinician review** (an obstetrician or midwife, and a paediatric gynaecologist if the app is offered to teenagers).

**Code:** `js/cycle/pregnancy.js`, plus changes in `model.js`, `predict.js`, `learning.js`, `companion.js` and `ui.js`.
**Tests:** `tests/cycle-pregnancy.test.mjs` and `tests/cycle-ui-pregnancy.cjs`, written before the code. Their failing runs are in `docs/test-logs/`.

## Principles
- **She tells the app.** The app never detects, suggests or tests for a pregnancy, and never says "you are pregnant".
- **Never a diagnosis or treatment advice.** It describes, reminds and points to her midwife or doctor.
- **Urgent warning signs are always one tap away** on both cards.
- **A pregnancy that ended:**
  - she is never asked why;
  - the message is gentle and blames no one;
  - Zara is quiet until her next period;
  - she can delete every record.
- **Same privacy as the rest of the app:** encrypted on the phone; nothing uploaded or shared. The browser test checks that no request goes to any other server.

## Sources and how each is used
| Source | Used for |
|---|---|
| ACOG Committee Opinion No. 700, *Methods for Estimating the Due Date* (2017). [DOI](https://doi.org/10.1097/AOG.0000000000002046) | Due date = first day of last period + 280 days. A clinician's or scan date takes precedence. The due date is shown as an estimate. |
| ACOG trimester convention | 1st trimester to 13 weeks 6 days; 2nd from 14+0 to 27+6; 3rd from 28+0. |
| ACOG Committee Opinion No. 579, *Definition of Term Pregnancy* (2013). [DOI](https://doi.org/10.1097/01.AOG.0000437385.88715.4a) | "Term from 37 weeks". From 42 weeks: "talk to your midwife or doctor today". |
| ACOG Committee Opinion No. 736, *Optimizing Postpartum Care* (2018). [DOI](https://doi.org/10.1097/AOG.0000000000002633) | Contact within 3 weeks of birth, and a full check no later than 12 weeks. Also sets the end of Zara's postpartum check-ins (12 weeks). |
| Jackson & Glasier, *Obstet Gynecol* 2011 (systematic review). [DOI](https://doi.org/10.1097/AOG.0b013e31820ce18c) | In women not breastfeeding, mean first ovulation was 45–94 days after birth, sometimes earlier. Shown as: "You can get pregnant before your first period returns … talk to your midwife or doctor about contraception." |
| Rezaie-Keikhaie et al., *JOGNN* 2020 (meta-analysis, 26 studies). [DOI](https://doi.org/10.1016/j.jogn.2020.01.001) | Baby blues in about 39% of women ("about 4 in 10"). |
| NICE CG192, *Antenatal and postnatal mental health*. [Link](https://www.nice.org.uk/guidance/cg192) | Low mood lasting more than 2 weeks after birth: talk to someone. Zara checks in on days 3, 7, 10 and 14. |
| CDC Hear Her, *Urgent maternal warning signs*. [Link](https://www.cdc.gov/hearher/maternal-warning-signs/index.html) | The warning-sign lists, in our own wording. "Baby moving less: call now" follows UK maternity guidance. |

**Not re-read from this environment:** the NICE and CDC pages (their hosts are not on the network allowlist). The lists follow their published content as known; a clinician should check the wording against the current pages. The PubMed entries above were checked through PubMed.

**From common guidance, to be confirmed in clinician review:**
- bleeding after birth usually settles over about 6 weeks;
- the UK postnatal check is at 6–8 weeks.

## Algorithm change: estimates restart after a pregnancy
- **The rule:** `restartDate(s)` is the end of her most recent pregnancy. From then on, the dates-only estimate and the learning stage use only cycles that start on or after it. The algorithm version is now `dates-only-1.2.0`.
- **Why:**
  - the gap that contains a pregnancy is not a cycle;
  - cycles often change after a pregnancy;
  - mixing cycles from before and after would give a confident-looking but wrong range.
- **Until a new cycle exists,** the estimate says so in plain words: "After a pregnancy, estimates start again …".
- **This is a design rule, not physiology.** The synthetic evaluation is unchanged, because its cohort has no pregnancies; only the version line in `docs/cycle-eval-synthetic.md` changed.

## Data-entry limits (safeguards, not clinical limits)
- **Due date:** up to 44 weeks ahead and up to 6 weeks past.
- **Last period:** not in the future.
- **Birth date entered directly:** within the last 2 years.

## What is not built
- **Pregnancy workouts:** fitness is a separate subject.
- **Not included, deliberately:** baby tracking, feeding logs, contraception methods, kick counting (UK guidance advises against formal counting; the advice is "call if movements reduce"), and any risk scores.
- **Teen-specific pathways:** these depend on the age-range decision.
