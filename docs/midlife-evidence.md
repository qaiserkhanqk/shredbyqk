# Perimenopause and menopause mode: the evidence behind it

**Date:** 2026-11-25. All papers were found through PubMed.

**How the researchers were chosen:** there is no objective "top 10 doctors" list. Instead, the mode is built on the researchers whose papers define the field:
- the international staging consensus;
- the largest long-term study of women in midlife (SWAN, the Study of Women's Health Across the Nation, US);
- a validated symptom scale;
- the consensus on terminology;
- the 2024 Lancet series;
- the main society position statement.

Every sentence in the app's mode traces to these sources. **All wording is a placeholder awaiting clinician review.**

## The 10 researchers and what was taken from each
| Researcher (affiliation in the paper) | Key paper | What the app uses |
|---|---|---|
| **Siobán Harlow** (University of Michigan), with the STRAW+10 group (5 countries) | STRAW+10 executive summary, 2012. [DOI](https://doi.org/10.1210/jc.2011-3362) · [full text used](https://doi.org/10.1097/gme.0b013e31824d8f40) | **Early transition:** "a persistent difference of 7 days or more in the length of consecutive cycles", where persistent means it recurs within 10 cycles. **Late transition:** "amenorrhea of 60 days or longer". The final menstrual period is confirmed after 12 months without a period. The bleeding criteria do not apply with PCOS, hysterectomy or ablation, chemotherapy or hormonal treatments. |
| **Nanette Santoro** (University of Colorado) | The menopause transition: signs, symptoms and management, 2021. [DOI](https://doi.org/10.1210/clinem/dgaa764) | The transition "can last for over a decade" and causes symptoms in most women: hot flushes, mood, *temporary* changes in concentration and memory, genitourinary symptoms. |
| **Susan R. Davis** (Monash University) | Menopause, Nature Reviews Disease Primers, 2015. [DOI](https://doi.org/10.1038/nrdp.2015.4) | "The individual experience of the menopause transition varies widely." |
| **Martha Hickey** (University of Melbourne) | An empowerment model for managing menopause, Lancet 2024. [DOI](https://doi.org/10.1016/S0140-6736(23)02799-X) | The woman as "an expert in their own condition"; the app supports informed decisions with her clinician. |
| **Nancy Avis** (Wake Forest) | Duration of vasomotor symptoms (SWAN), JAMA Intern Med 2015. [DOI](https://doi.org/10.1001/jamainternmed.2014.8063) | Frequent hot flushes and night sweats lasted a median of 7.4 years, and longer for some groups. This is why tracking is long-term. |
| **Gail Greendale** (UCLA) | SWAN progress report, Menopause 2019. [DOI](https://doi.org/10.1097/GME.0000000000001424) | Symptom areas: hot flushes, sleep, psychological symptoms, cognitive performance, urogenital and sexual health. |
| **Rebecca Thurston** (University of Pittsburgh) | Co-author of the SWAN papers above | The same symptom areas, with hot flushes and night sweats as their own category |
| **Klaas & Lothar Heinemann** (Berlin) | The Menopause Rating Scale (MRS): methodological review, 2004. [DOI](https://doi.org/10.1186/1477-7525-2-45) | The 11 symptom areas of a validated scale used in 9 countries: hot flushes, heart discomfort, sleep, depressive mood, irritability, anxiety, exhaustion, sexual problems, bladder, dryness, joints. **Our wording is our own. The app neither reproduces nor scores the MRS** (that would need the exact instrument and permission). |
| **David Portman & Margery Gass** (ISSWSH and NAMS consensus) | Genitourinary syndrome of menopause, 2014. [DOI](https://doi.org/10.1097/GME.0000000000000329) | Vaginal dryness and discomfort and bladder changes as one recognised group of symptoms |
| **Jerilynn Prior** (University of British Columbia) | Within-woman variability of cycle phases, Hum Reprod 2024. [DOI](https://doi.org/10.1093/humrep/deae215) | Cycles vary within the same woman, and the second half is not a fixed 14 days |

**Also used:** The North American Menopause Society, *2022 hormone therapy position statement*. [DOI](https://doi.org/10.1097/GME.0000000000002028). It says treatment should be individualised by a clinician, which is why **the app gives no treatment, hormone, medicine or dose advice**.

## What was built (`js/cycle/midlife.js`, flag `midlifeMode`, off by default)
- **Six symptoms**, each off until she switches it on:
  - hot flushes or night sweats;
  - concentration and memory;
  - joint and muscle aches;
  - heart racing or pounding (with "chest pain, breathless or faint: get urgent help");
  - vaginal dryness or discomfort;
  - bladder changes.
  - Each is rated none, mild, moderate or severe, and appears in the doctor summary.
- **Bleeding-pattern descriptions** against the STRAW+10 criteria, in her own numbers. Each always says it has other causes and isn't a diagnosis. Operational choices, all conservative:
  - one odd cycle counts as a single episode;
  - "60 days" counts days without a logged period, never an invented period end;
  - cycles marked as a missed log are left out.
- **12 months without a period:** described "looking back", with "any bleeding from now on should be checked by a doctor". If bleeding is logged after 12 months, a prominent warning to see a doctor.
- **Not applicable:** with hormonal contraception, pregnancy or another condition or medicine, nothing is described, and the app says why (from STRAW+10).
- **Warning signs**, always shown:
  - bleeding after 12 months;
  - very heavy bleeding;
  - bleeding between periods or after sex;
  - changes before age 40;
  - chest pain, breathlessness or fainting;
  - low mood or thoughts of self-harm;
  - symptoms that stop her doing her usual things.

**Tests:** `tests/cycle-midlife.test.mjs` (35 checks) and `tests/cycle-ui-midlife.cjs` (12). Both were written first; the failing runs are in `docs/test-logs/`.

## Still needed
- A menopause clinician reviews every sentence; the warning signs especially.
- If a validated score is wanted, permission to use the exact MRS, or another licensed instrument.
- Real-world testing with women in the transition. Not done.
