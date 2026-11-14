# Cycle tracking: evidence register

What each design decision rests on, how strong that support is, and what is **not** supported.

Citation details were checked against PubMed on 2026-11-14 (titles, authors, journals and DOIs; abstracts read, **full texts not read**).

Note on studies of other brands: they describe *those* devices and populations. They are context for design choices only. **No accuracy figure from another brand may be presented as this product's accuracy.**

## Sources

| ID | Source | What it supports here | Strength / caveats |
|---|---|---|---|
| E1 | Munro MG, Critchley HOD, Fraser IS, et al. *The two FIGO systems for normal and abnormal uterine bleeding symptoms… 2018 revisions.* Int J Gynaecol Obstet 2018;143(3):393–408. [doi:10.1002/ijgo.12666](https://doi.org/10.1002/ijgo.12666) | Standard terminology for normal and abnormal bleeding, including cycle regularity. Used for the `VARIABLE = 9` day label threshold. | Consensus document. **The "≤7–9 days" variation figure is NOT in the abstract.** Check it in the full text before citing it in the app. Our label is a description of data, not a diagnosis. |
| E2 | Bull JR, Rowland SP, Scherwitzl EB, et al. *Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles.* NPJ Digit Med 2019;2:83. [doi:10.1038/s41746-019-0152-7](https://doi.org/10.1038/s41746-019-0152-7) | Cycle length varies widely; mean follicular phase 16.9 days (95% range 10–30) vs luteal 12.4 days (7–17). Supports: **no 28-day default and no day-14 ovulation.** | App users of one vendor (Natural Cycles); authors include company staff. Ovulation was estimated from that vendor's BBT/LH algorithm, not from a gold standard. |
| E3 | Fehring RJ, Schneider M, Raviele K. *Variability in the phases of the menstrual cycle.* J Obstet Gynecol Neonatal Nurs 2006;35(3):376–84. [doi:10.1111/j.1552-6909.2006.00051.x](https://doi.org/10.1111/j.1552-6909.2006.00051.x) | Among regularly cycling women, within-woman variation > 7 days in 42.5% of women; only 25% had the whole fertile phase between days 10–17; follicular phase drives the variability. Supports **personal ranges and the "variable" state.** | 141 women, LH-surge monitor as the reference; regularly cycling volunteers only. |
| E4 | Su HW, Yi YC, Wei TY, et al. *Detection of ovulation, a review of currently available methods.* Bioeng Transl Med 2017;2(3):238–46. [doi:10.1002/btm2.10058](https://doi.org/10.1002/btm2.10058) | Ovulation reference methods (ultrasound, urinary LH, progesterone/PdG) and BBT's limits. Supports **no ovulation estimate from dates** and the reference protocol in the validation plan. | Narrative review; it notes inconsistent reference standards across studies. |
| E5 | Shilaih M, Goodale BM, Falco L, et al. *Modern fertility awareness methods: wrist wearables capture the changes in temperature associated with the menstrual cycle.* Biosci Rep 2018;38(6). [doi:10.1042/BSR20171279](https://doi.org/10.1042/BSR20171279) | The three-over-six rule applied to wrist skin temperature; a sustained shift in 82% of 437 cycles; 86% of shifts **on or after** LH-estimated ovulation day. Supports making the rise **retrospective, not an advance warning**, and the rule's shape. | One vendor's device (Ava); eumenorrheic women; LH reference; company-affiliated authors. **Not transferable** to other hardware. |
| E6 | Zhu TY, Rothenbühler M, Hamvas G, et al. *The Accuracy of Wrist Skin Temperature in Detecting Ovulation Compared to Basal Body Temperature.* J Med Internet Res 2021;23(6):e20710. [doi:10.2196/20710](https://doi.org/10.2196/20710) | Wrist skin temperature detected more shifts than oral BBT (sensitivity 0.62 vs 0.23) but with **low specificity (0.26)** and low negative predictive value. Supports **"may be consistent with", "not proof"**, and keeping the feature behind a research flag. | 57 women, 193 cycles, one device (Ava). |
| E7 | Goodale BM, Shilaih M, Falco L, et al. *Wearable Sensors Reveal Menses-Driven Changes in Physiology and Enable Prediction of the Fertile Window.* J Med Internet Res 2019;21(4):e13404. [doi:10.2196/13404](https://doi.org/10.2196/13404) | Phase-related shifts in wrist temperature, heart rate and breathing rate; HRV effects weaker. Supports accepting HR/HRV/breathing as **optional** inputs only. | Conception-seeking Swiss women; one vendor; the ML accuracy is that vendor's and **not ours**. |
| E8 | Uchida Y, Izumizaki M. *The use of wearable devices for predicting biphasic basal body temperature to estimate the date of ovulation in women.* J Therm Biol 2022;108:103290. [doi:10.1016/j.jtherbio.2022.103290](https://doi.org/10.1016/j.jtherbio.2022.103290) | Review: evidence is strongest for bracelet-type wrist skin temperature, and absent for many consumer watches. Supports **"unverified until tested"** for any new device, including the SWL DS07. | Narrative review. |
| E9 | Luo C, Su YF, Ren YY, et al. *Prediction of the fertile window and menstruation with a wearable device via machine-learning algorithms.* Reprod Biomed Online 2025;51(1):104795. [doi:10.1016/j.rbmo.2025.104795](https://doi.org/10.1016/j.rbmo.2025.104795) | Performance drops markedly for irregular cycles (e.g. menstruation prediction accuracy 75.0% regular vs 50.8% irregular in that study). Supports **evaluating irregular cycles separately.** | One vendor's device (Huawei, a co-author); 2 cycles per participant. |

## Design decisions without external evidence (our own choices)

| Decision | Basis | Status |
|---|---|---|
| Range = shortest–longest of the last 6 usable cycles | Transparency: easy to explain from the user's own data | **Unvalidated.** To be measured (coverage and width) in the study. |
| 15–90 day plausibility, ±2 early pad, 20-day "too variable", stale rule | Display safeguards | Placeholder; needs clinical review |
| Pattern rules (≥ 3 cycles, ≥ 75%, < 50% outside the window) | Conservative, explainable | Placeholder; to test against personal baselines |
| Temperature rule ΔT 0.15 °C, 6/3 nights, ≥ 180 min per night | Shaped after the BBT three-over-six rule (E5) | Placeholder; **not fitted**; pre-register before any study |
| Neutral lock-screen text, encryption, separate store | Privacy by design (GDPR Art. 5 and 25; health data is special-category data under Art. 9) | Legal and DPO review pending |

## Explicitly NOT supported (and not implemented)
- Safe days, contraception or fertile-window advice.
- Pregnancy detection.
- PCOS or any other diagnosis or treatment claim.
- Inferring mood or hormones from temperature or HRV.
- Phase-based training or nutrition prescriptions.
- Any claim that sensor data improves period prediction for this product. Not shown until the validation plan's Q2 is met on the frozen device and firmware.
