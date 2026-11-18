# Comparison: Natural Cycles (published descriptions) vs this app's cycle estimate

**Sources and limits**
- **Website not read.** The Natural Cycles website (including `/cyclematters/period-calculator`) could **not be read** from this environment: page fetches failed and a direct fetch was blocked by the session's safety checks. Nothing here comes from their website.
- **What it's based on.** This comparison is based only on peer-reviewed papers retrieved from PubMed (abstracts, not full texts).
- **Their algorithm is proprietary.** Its exact rules are **not published**, so it can't be re-implemented or run here. Their published effectiveness figures belong to their product and their studies. **They must not be quoted as this app's performance.** Most papers below are written by company staff.

## What the published papers say about Natural Cycles
| Topic | What is published | Source |
|---|---|---|
| Purpose | A **contraceptive** app (a fertility awareness-based method) that tells users whether protection is needed ("green" or "red" days). Later papers describe it as FDA-cleared and CE-marked. | [Berglund Scherwitzl 2017](https://doi.org/10.1016/j.contraception.2017.08.014); [Brondolin 2026](https://doi.org/10.1080/13625187.2026.2669220) |
| Inputs | Dates of menstruation and **basal body temperature** (BBT), optionally **urinary LH test** results. Recent work compares temperature from **wearable devices** with oral thermometers. | [Berglund Scherwitzl 2015](https://doi.org/10.3109/13625187.2014.988210); [Kleinschmidt 2019](https://doi.org/10.1080/13625187.2019.1682544); [van Lamsweerde 2026](https://doi.org/10.1080/13625187.2026.2671267) |
| Core method | A **proprietary, individualised** algorithm that estimates the **ovulation day** from the temperature rise and uses it to set the **fertile window** | [Manhart & Duane 2022](https://doi.org/10.1016/j.contraception.2022.07.007) (independent); [Kleinschmidt 2019](https://doi.org/10.1080/13625187.2019.1682544) |
| Ovulation detection (their validation) | Mean delay of **1.9 days** from the first positive LH test to the temperature-based ovulation estimate; luteal-phase length varied on average **1.25 days** per user (317 women, 1,501 cycles, retrospective) | [Berglund Scherwitzl 2015](https://doi.org/10.3109/13625187.2014.988210) |
| Fertile-window output | By cycle 12, about **59% green days**, with 0.08% "wrong green days" (with LH and BBT; company analysis) | [Kleinschmidt 2019](https://doi.org/10.1080/13625187.2019.1682544) |
| Independent check | The same temperatures entered into Natural Cycles and another app: Natural Cycles' fertile window averaged 12.8 days and designated more cycle days as infertile **inside** the estimated physiological fertile window (20 women, small study) | [Manhart & Duane 2022](https://doi.org/10.1016/j.contraception.2022.07.007) |
| Contraceptive effectiveness | Typical-use Pearl Index 6.9 and perfect-use 1.0 (22,785 users); UK cohort typical 6.1. Wearable vs thermometer: 13-cycle typical-use pregnancy rates 4.7% vs 7.3%, **not significant after adjusting for demographics** | [2017](https://doi.org/10.1016/j.contraception.2017.08.014); [Pearson 2021](https://doi.org/10.1080/13625187.2020.1867844); [van Lamsweerde 2026](https://doi.org/10.1080/13625187.2026.2671267) |
| Period prediction | **Not described in these abstracts.** How the app predicts the next period isn't published in a form that could be checked here. | n/a |

## Side by side
| | Natural Cycles (as published) | This app (`js/cycle/predict.js`, `dates-only-1.1.0`) |
|---|---|---|
| Purpose | Contraception and fertility (regulated medical device) | Period tracking only. **No fertile window, ovulation day, safe days or contraception, by design** |
| Main input | Daily temperature (thermometer or wearable), period dates, optional LH tests | Period dates the person logs; optional symptoms; wearable data is research-only and off |
| Ovulation | Estimated each cycle from the temperature rise, validated against LH tests in their own study | **Not estimated.** A retrospective temperature rise exists only behind a research flag, abstains on weak evidence, and is unvalidated |
| Next period | Not published in detail | Shortest to longest of the person's last ≤ 6 usable cycles, no padding, labelled "your period may come earlier or later; not a prediction interval" |
| Individualised | Yes (their statistics on the user's own data) | Yes (own logged cycles only; no 28-day default) |
| Evidence | Peer-reviewed studies (mostly company-authored), regulatory clearance | **None in real people.** Synthetic tests only; validation plan in `docs/cycle-validation-plan.md` |

## Can the two be "checked against" each other?
**Not with what is available here.** A fair comparison would need four things:
1. Their algorithm's outputs: they're proprietary, though one could enter the same data into both apps, as Manhart & Duane did.
2. The **same real participants' data**, collected with consent.
3. A clinician-designed reference, such as LH tests for ovulation and logged periods for start dates.
4. The pre-registered metrics in our validation plan (start-date error, ±1/2/3 days, coverage, no-prediction rate).

Our synthetic evaluation can't stand in for this, and their published figures can't be borrowed.

## What the published work suggests for this app (to test, not to adopt untested)
- **Ovulation evidence and period timing.** Their 2015 abstract reports a fairly stable luteal phase per person (varying about 1.25 days). That supports the idea already in our evaluation harness's *sensor candidate*: once a temperature rise is confirmed, the next period might be timed from it. In our app that stays **off** until the validation study shows it beats the dates-only baseline on the frozen device.
- **Validation design.** They validated temperature-based ovulation against LH tests. Our validation plan uses the same kind of reference (Q3), plus ultrasound in a sub-cohort.
- **Wearables.** Their 2026 paper found no independent effect of wearable vs thermometer on pregnancy rates, but better continuation with wearables. Whether *our* device's wrist temperature is usable is a separate question that needs its own device testing (`docs/wearable-sdk-requirements.md`).
- **Not to copy:** fertile or "green" days, contraception claims, their effectiveness figures, or their design and wording.
