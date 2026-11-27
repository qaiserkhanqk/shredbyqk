# Competitor feature comparison: menstrual-cycle and women's-health tracking

> Raw research notes for `docs/competitor-comparison-2026-11-27.md`. Public sources only; competitor figures are theirs and do not apply to Shred by QK.

Compiled 2026-11-27 from public web sources only. "Accessed 2026-11-27" applies to every web page cited unless a publication year is given.

## Method and caveats (read first)

- Sources are official product, help-centre and press pages, FDA databases, peer-reviewed papers, and news/legal reporting. Each claim carries its source URL.
- **Limitation:** in this research session, direct page fetching was blocked for several vendor domains (ouraring.com, support.ouraring.com, whoop.com). For those vendors, the details come from search-engine indexing of their pages plus third-party reporting. Treat vendor feature details as "reported", and spot-check them on the live page before relying on them.
- **Labels used:** **[Company]** = claim or study by the vendor, its staff, or its funding. **[Independent]** = no vendor authorship or funding found. **[Regulatory]** = FDA or other regulator record. **Not found** = I could not verify it; this is not a claim that the thing is absent.
- Accuracy figures are specific to the cited study's population, reference standard and metric. They do not transfer to other products, including a new prototype.
- Prices change often and vary by region. Prices are US list prices unless stated, as reported on the date accessed.

---

## 1. Flo (Flo Health)

**Life stages**
- Period tracking, trying to conceive, a pregnancy tracker, and perimenopause tools (Perimenopause Score, Menopause Timeline). https://apps.apple.com/us/app/flo-cycle-period-tracker/id1038369065 (accessed 2026-11-27)
- Teens: one store listing describes "a safe space for teens to track their first period with age-appropriate education". I found no separate teen mode. https://apps.apple.com/us/app/flo-cycle-period-tracker/id1038369065 (accessed 2026-11-27)
- Postpartum: not found as a distinct mode.

**Data used**
- Logged periods, symptoms and other app inputs. A vendor case study (InData Labs, the developer of Flo's model) says the cycle model uses "over 400 inputs". https://indatalabs.com/resources/neural-network-implementation-in-healthcare-app (accessed 2026-11-27) **[Company/vendor]**
- Wearables: Anonymous Mode does not support pairing a wearable. https://flo.health/privacy-portal/anonymous-mode-faq (accessed 2026-11-27)
- In October 2026 Google and Flo announced that, with consent, Flo cycle data will sync with Google Health metrics (resting HR, HRV, skin temperature, sleep stages), starting in "early 2027". Google also made a strategic investment of undisclosed size. https://blog.google/products-and-platforms/products/google-health/commitment-womens-health-flo-health-partnership/ ; https://www.techrepublic.com/article/news-google-flo-health-womens-health-wearables/ (both 2026)

**Predictions and claims; regulatory status**
- Predicts periods, ovulation and the fertile window. Flo's accuracy page says "it's impossible to predict ovulation with 100% accuracy". https://flo.health/flo-accuracy (accessed 2026-11-27)
- No FDA clearance for contraception was found. Flo states it does not provide medical advice, diagnosis or treatment. https://apps.apple.com/us/app/flo-cycle-period-tracker/id1038369065 (accessed 2026-11-27)
- PCOS or other condition assessment: not verified (a search for a Flo symptom checker returned nothing usable).

**Published accuracy**
- No peer-reviewed validation of Flo's prediction model was found.
- Vendor case study: for irregular cycles, prediction error fell from 5.6 to 2.6 days. https://indatalabs.com/resources/neural-network-implementation-in-healthcare-app **[Company/vendor; unverified]**
- Flo claim: "90% of people using Flo say the app accurately predicts the start of their period." This is a user survey, not a measured outcome. https://flo.health/flo-accuracy **[Company]**
- Flo appears in the independent 10-app simulation by Worsfold et al. 2021 (see General evidence).

**Personalisation and coaching**
- Premium includes a "24/7 virtual Health Assistant", described as educational. https://apps.apple.com/us/app/flo-cycle-period-tracker/id1038369065 (accessed 2026-11-27)
- **Flo for Partners** (launched October 2023): the partner pairs with a code, the main user can stop sharing at any time, and users must be 18+ (20+ in South Korea). One store listing says it is not available in the UK, EU, EEA or Switzerland. https://flo.health/newsroom/flo-for-partners ; https://help.flo.health/hc/en-us/articles/19871976024596-How-do-I-set-up-Flo-for-Partners (accessed 2026-11-27)
- Training, sleep or nutrition plan adaptation: not found.

**Logging effort**
- Manual logging of periods and symptoms in the app. No passive sensing in Anonymous Mode. Passive data from Google wearables is planned for 2027 (see above).

**Privacy**
- **FTC action (2021):** the FTC alleged Flo shared health data with Facebook, Google and others despite privacy promises. The final order (June 2021) requires affirmative consent before sharing health data, notice to affected users, instructions to third parties to destroy the data, and an independent privacy review. https://www.ftc.gov/news-events/news/press-releases/2021/06/ftc-finalizes-order-flo-health-fertility-tracking-app-shared-sensitive-health-data-facebook-google ; case page https://www.ftc.gov/legal-library/browse/cases-proceedings/192-3133-flo-health-inc (2021) **[Regulatory]**
- **Class action, Frasco v. Flo Health (N.D. Cal. 3:21-cv-00757):** Google, Flurry and Flo settled; Labaton lists settlements totalling $59.5M. On 1 August 2025 a jury found Meta violated the California Invasion of Privacy Act. https://www.labaton.com/cases/frasco-v-flo-health-inc ; https://www.healthcareitnews.com/news/jury-finds-meta-liable-reproductive-health-data-case (2025)
- **Anonymous Mode (2022, post-Dobbs):** opt-in. It uses Oblivious HTTP via a Cloudflare relay so that no single party sees both identity and health data. Enabling it deletes the previous account (only essential cycle data carries over), and it disables Partners, Family, web subscriptions and wearable pairing. Experts quoted by Gizmodo said it is not fully anonymous and should be the default. https://flo.health/privacy-portal/anonymous-mode-faq ; https://www.cloudflare.com/case-studies/flo-health ; https://gizmodo.com/flo-app-releases-anonymous-mode-period-abortion-bans-1849536742 (2022)
- Flo's US state privacy notice says it does not "sell or rent personal data for monetary gain". https://flo.health/supplemental-flo-us-state-privacy-notice (accessed 2026-11-27)
- On legal requests, Flo says it will "exhaust available legal remedies to challenge" them and seek to limit disclosure. https://flo.health/how-does-flo-respond-to-data-requests (accessed 2026-11-27)

**Price**
- Core tracking is free. Premium is a paid subscription whose price varies by region and promotion; third-party reports range from about $39.99 to $59.99 per year in the US. https://flo.health/flo-premium ; https://eathealthy365.com/a-breakdown-of-the-flo-membership-cost/ (accessed 2026-11-27). Official US list price: not found.

**Criticisms and limitations**
- The data-sharing history above.
- App Store users complain that features have moved from free to Premium. https://apps.apple.com/us/app/flo-cycle-period-tracker/id1038369065 (accessed 2026-11-27)
- No independent accuracy validation was found.

---

## 2. Oura (ring)

**Life stages**
- Regular cycles (Cycle Insights, Period Prediction, Fertile Window), pregnancy (Pregnancy Insights, redesigned 2025) and perimenopause. The Perimenopause Check-In launched in the US on 13 August 2025 with a Menopause Rating Scale survey, a provider-ready report, and 17 perimenopause tags; Menopause Insights followed later. https://www.engadget.com/wearables/oura-rolls-out-new-features-for-pregnancy-and-perimenopause-130000405.html ; https://www.wareable.com/health-and-wellbeing/oura-pregnancy-insights-update-perimenopause-check-in-survey-rollout (2025)
- Contraception via a third party: the Natural Cycles app can use Oura temperature (FDA 510(k), 2021; see Natural Cycles). https://www.biospace.com/natural-cycles-receives-fda-clearance-to-integrate-its-birth-control-app-with-data-measured-by-apple-watch (2023)
- Teens and postpartum: not found.

**Data used**
- Finger skin temperature trends, cardiovascular and respiratory metrics, cycle regularity and user tags (as described for Fertile Window). https://ouraring.com/blog/inside-the-ring-fertile-window/ (accessed via search index 2026-11-27) **[Company]**

**Predictions and claims; regulatory status**
- Period prediction, fertile window, and an ovulation estimate. The ovulation algorithm detects a sustained post-ovulation temperature rise, so it is retrospective for ovulation itself.
- Oura states Fertile Window "is not intended to be used for contraception" and that the ring is not a medical device. https://ouraring.com/blog/inside-the-ring-fertile-window/ ; https://ouraring.com/perimenopause (accessed via search index 2026-11-27)

**Published accuracy**
- **Oura-authored JMIR 2025 study:** 1,155 ovulatory cycles from 964 members, with LH-test-tagged ovulation as the reference. The physiology method had a mean absolute error (MAE) of 1.18 days versus 1.70 days for the calendar method; for irregular cycles it was 1.48 versus 6.63 days. Oura's blog reports 96.4% of ovulations detected, with an average error of about ±1.26 days. https://jmir.org/2025/1/e60667/PDF ; https://ouraring.com/blog/oura-ovulation-detection-algorithm-validation-study/ (2025) **[Company]**
- Period prediction: Oura claims it is "more than twice as accurate" overall, "nearly three times" in perimenopause, and twice for irregular cycles. I found no peer-reviewed numbers for this claim. https://ouraring.com/blog/inside-the-ring-fertile-window/ **[Company; unverified]**
- **Maijala et al. 2019, BMC Women's Health:** a pilot with 22 analysed participants using Oura-ring finger temperature (study team included Oura staff). The best algorithm detected ovulation with 83.3% sensitivity in a −3/+2-day window; mean offset was 0.6 days (SD 1.5) for ovulation and 0.4 days (SD 1.8) for menstruation. https://pubmed.ncbi.nlm.nih.gov/31783840/ (2019) **[Company-involved]**

**Personalisation and coaching**
- Oura Advisor (an AI health companion) is included in the membership. https://www.lilachbullock.com/oura-membership-cost/ (accessed 2026-11-27)
- In-app access to care partners via the perimenopause check-in; integration work with Maven and Progyny was reported. https://athletechnews.com/oura-womens-health-new-pregnancy-perimenopause-tools/ (2025)
- Cycle-phase-specific training plans: not found.

**Logging effort**
- Mostly passive (worn overnight). Users log periods and tags.

**Privacy**
- In 2025, users objected to a US Department of Defense manufacturing deal and to links with Palantir. Oura's CEO said neither Palantir nor the government can access consumer Oura data, and that Oura does not sell data or share it without explicit permission (except for service members who consent within DoD programmes). https://fortune.com/2025/09/09/oura-ceo-tom-hale-data-privacy-oura-ring-defense-department-palantir/ ; https://www.tomsguide.com/wellness/smart-rings/oura-is-expanding-its-partnership-with-the-u-s-military-and-users-are-stressed-heres-what-that-means-for-your-data (2025)
- Mozilla's review concluded users must trust Oura's internal access controls. https://www.mozillafoundation.org/en/privacynotincluded/oura-ring/ (accessed 2026-11-27)

**Price**
- Ring roughly $349–$399, plus a membership of $5.99 per month or $69.99 per year. Without a membership, only the basic scores are shown. https://www.lilachbullock.com/oura-membership-cost/ ; https://ouraring.com/membership (accessed 2026-11-27)

**Criticisms and limitations**
- The accuracy evidence is company-authored, and its reference cohort already used LH kits.
- Skin temperature is not core or basal temperature.
- The privacy controversy above.

---

## 3. WHOOP

**Life stages**
- Menstrual Cycle Insights for natural cycles. Journal toggles cover trying to conceive, pregnancy, postpartum ("parenting an infant"), perimenopause and postmenopause. Pregnancy Insights includes a due-date community chat. Perimenopause and postmenopause toggles add recovery insights to the Monthly Performance Assessment. https://www.whoop.com/thelocker/whoop-features-support-reproductive-health-through-all-life-stages/ (accessed via search index 2026-11-27) **[Company]**
- Users on hormonal birth control can log, but the phase coaching is built for natural cycles. https://www.whoop.com/us/en/thelocker/womens-hormonal-insights/ (accessed via search index 2026-11-27)
- Since August 2026, a one-year Natural Cycles subscription is included in WHOOP membership; NC uses WHOOP skin temperature and heart rate. https://www.businesswire.com/news/home/20260804399367/en/ (2026)
- Teens: not found. Advanced Labs requires users aged 18+ who are not pregnant. https://www.whoop.com/us/en/unlocked (accessed 2026-11-27)

**Data used**
- HRV, resting HR, recovery, skin temperature, respiratory rate, logged bleeding and birth-control status. https://www.whoop.com/us/en/thelocker/menstrual-cycle-insights-white-paper/ (accessed via search index 2026-11-27) **[Company]**
- Blood tests (Advanced Labs, US only). A Women's Health Specialized Panel of 11 biomarkers ($299) was announced in March 2026. https://www.businesswire.com/news/home/20260310966566/en/ (2026)

**Predictions and claims; regulatory status**
- Phase estimates, predicted symptoms per phase, and "Hormonal Symptom Insights and Predictions" (2026). WHOOP says the feature is not a medical device and must not be used for conception or contraception, and that all phases, including ovulation, are estimates. https://www.whoop.com/us/en/thelocker/whoop-feature-menstrual-cycle-coaching (accessed via search index 2026-11-27)
- A community answer says ovulation is estimated by counting 8–13 days back from the predicted period; this is not an official method document. https://www.community.whoop.com/t/how-does-whoop-calculate-the-other-phases-of-my-menstrual-cycle/401 (accessed 2026-11-27)
- Regulatory context: the FDA issued a warning letter on 14 July 2025 over WHOOP's (non-cycle) Blood Pressure Insights; a June 2026 FDA letter references changes WHOOP made. https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/whoop-inc-709755-07142025 (2025) **[Regulatory]**

**Published accuracy**
- Not found. WHOOP references a white paper, but I found no error metrics or sample sizes.

**Personalisation and coaching**
- Phase-based Strain and Sleep recommendations, with AI coaching ("Daily Outlook") that adjusts to phase and symptoms. https://www.whoop.com/us/en/thelocker/whoop-feature-menstrual-cycle-coaching (accessed via search index 2026-11-27)
- WHOOP patent US 12,220,112 B2 describes raising strain in the early follicular phase and lowering it in the late phase. This shows the design intent, not confirmed shipped behaviour. https://patentsgazette.uspto.gov/week06/OG/html/1531-2/US12220112-20250211.html (2025)

**Logging effort**
- Passive 24/7 wrist or body sensor; periods and symptoms are logged in the Journal.

**Privacy**
- No women's-health-specific controversy was found.

**Price**
- Membership tiers (One, Peak, Life) include the hardware. Reported prices: One about $199/yr and Peak about $239/yr; Life price not confirmed. https://www.whoop.com/us/en/membership/ (accessed 2026-11-27)

**Criticisms and limitations**
- No published accuracy figures.
- Coaching is not designed for hormonal contraception users.

---

## 4. Clue (BioWink GmbH, Berlin)

**Life stages**
- Four tracking modes, including Clue Conceive, Clue Pregnancy and perimenopause. https://apps.apple.com/us/app/clue-period-cycle-tracker/id657189652 (accessed 2026-11-27)
- **Clue Birth Control** received FDA 510(k) K193330 on 18 February 2021, based on the acquired Dynamic Optimal Timing (Dot) algorithm, for women aged 18–45 with 20–40-day cycles. https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K193330 (2021) **[Regulatory]** Current availability is unclear: App Store reviewers report it is gone, and Clue says it is rebuilding the app and some features are temporarily unavailable. https://apps.apple.com/us/app/clue-period-cycle-tracker/id657189652 (accessed 2026-11-27)
- Clue Conceive is **not** FDA-cleared; Clue says no clearance is required for it. https://support.helloclue.com/hc/en-us/articles/7955901467412-Is-Clue-Conceive-FDA-cleared (accessed 2026-11-27)
- Teens: not found.

**Data used**
- Logged periods and symptoms. Wearable pairing is available with Clue Plus, and partner offers mention Oura. https://helloclue.com/landing/wearables/clue-plus-offer/oura (accessed 2026-11-27)

**Predictions and claims; regulatory status**
- Next period and fertile window. The fertile-window prediction is offered for conception as a medical device feature, not for contraception (company wording). https://apps.apple.com/us/app/clue-period-cycle-tracker/id657189652 (accessed 2026-11-27)

**Published accuracy**
- The Dot or Clue Birth Control basis is Jennings et al. 2019 (Eur J Contracept Reprod Health Care; Georgetown, NCT02833922): 718 women over 13 cycles, with a perfect-use failure rate of 1.0% and typical use of 5.8%. STAT noted that "typical use" counted condom use on fertile days, which complicates comparisons. https://clinicaltrials.gov/study/NCT02833922 ; https://www.statnews.com/2019/03/18/fertility-app-dot-bills-itself-as-contraception/ (2019) **[Developer-run trial]**
- In Setton et al. 2016, Clue was one of only 3 apps (of 33) that gave the exact fertile window for an idealised 28-day cycle. https://www.foxnews.com/health/apps-perform-poorly-to-find-best-time-for-conceiving (2016) **[Independent]**

**Personalisation and coaching**
- Clue Plus adds "deeper analysis, advanced predictions, personalized insights". https://support.helloclue.com/hc/en-us/articles/115005209543-What-is-Clue-Plus (accessed 2026-11-27)
- Training plans, AI assistant and partner sharing: not found.

**Logging effort**
- Manual logging.

**Privacy**
- Clue says it is a Berlin company bound by GDPR and has a legal duty under EU and German law not to disclose health data, regardless of where the user lives (post-Roe statements). https://helloclue.com/articles/about-clue/post-roe-reality-clue-s-commitment-to-your-privacy (2022–2023) **[Company]**
- Mozilla notes that Clue builds a long-term record tied to persistent identifiers. https://www.mozillafoundation.org/en/nothing-personal/clue-period-tracker-app-privacy-review/ (accessed 2026-11-27)
- A JMIR 2025 study scored both Clue and Flo 3.5 out of 5 on privacy and security. https://jmir.org/2025/1/e51517/PDF (2025) **[Independent]**

**Price**
- Free core period tracking. Clue Plus is about $39.99/yr in the US; prices vary by store region. https://support.helloclue.com/hc/en-us/articles/115005215266-How-much-does-Clue-Plus-cost ; https://www.mylola.com/products/clue (accessed 2026-11-27)

**Criticisms and limitations**
- Feature churn during the app rebuild.
- Birth-control availability is uncertain.

---

## 5. Natural Cycles (Sweden)

**Life stages**
- Five modes under one subscription: Birth Control, Plan Pregnancy, Follow Pregnancy, Postpartum, and Perimenopause. Perimenopause launched in October 2025 and estimates early, mid or late stage; the company says this is not a diagnosis. https://help.naturalcycles.com/hc/en-us/articles/360019623298 ; https://femtechinsider.com/natural-cycles-launches-perimenopause-app-mode-and-wearable-band/ (2025)
- The intended population for the original clearance was adult women (the app store rating is 17+). Teens: not found.

**Data used**
- Basal temperature from an oral thermometer, or from the NC° Band (2025; NC° Band 2 announced 17 November 2026), NC° Ring, Oura, Apple Watch, Samsung Galaxy Watch, Garmin (2026) or WHOOP (2026), with optional LH tests.
- Bull et al. 2019 used Natural Cycles data that included BBT and LH tests. https://pubmed.ncbi.nlm.nih.gov/31482137/ (2019)
- Apple Watch wrist temperature: 510(k) K231274 (2023); Oura: 510(k) (2021). https://510k.innolitics.com/device/K231274 ; https://www.biospace.com/natural-cycles-receives-fda-clearance-to-integrate-its-birth-control-app-with-data-measured-by-apple-watch (2023) **[Regulatory]**
- Garmin integration: https://www.garmin.com/en-US/blog/health/how-to-use-the-natural-cycles-app-with-your-garmin-smartwatch/ (2026)
- NC° Band: https://www.naturalcycles.com/the-nc-band ; NC° Band 2: https://androidauthority.com/natural-cycles-nc-band-2-3736085 (2026)

**Predictions and claims; regulatory status**
- Daily fertile or not-fertile ("Green Day") status for contraception, plus ovulation detection.
- **FDA De Novo DEN170052** (10 August 2018) classified it as Class II (21 CFR 884.5370), the first FDA-authorised digital contraceptive. https://www.fda.gov/NewsEvents/Newsroom/PressAnnouncements/ucm616511.htm (2018) **[Regulatory]**
- In July 2026 the company announced a sixth FDA clearance, for a next-generation algorithm combining physiological modelling and machine learning; a 2025 clearance allowed over-the-counter and prescription sale. https://www.contemporaryobgyn.net/view/natural-cycles-receives-fda-clearance-for-ai-powered-fertility-algorithm ; https://www.unite.ai/?p=441584 (2026)

**Published accuracy**
- FDA review: the clinical data covered 15,570 women over an average of 8 months, with a perfect-use failure rate of 1.8% and typical use of 6.5%. https://www.mobihealthnews.com/news/fda-grants-natural-cycles-contraception-app-de-novo-marketing-approval (2018) **[Regulatory review of company data]**
- Berglund Scherwitzl et al. 2017, Contraception: Pearl Index 6.9 typical use (6.8 truncated at 12 months) and 1.0 perfect use; 13-cycle typical-use failure rate 8.3%. https://pubmed.ncbi.nlm.nih.gov/28882680/ (2017) **[Company]**. The company now cites a perfect-use Pearl Index of 2 based on later data. https://www.naturalcycles.com/research-library/how-effective-is-natural-cycles-as-birth-control (accessed 2026-11-27)
- Current company figures are 98% effective with perfect use and 93% with typical use. For the 2026 algorithm, the company has not published the number of extra Green Days or the pregnancy rates. https://www.unite.ai/?p=441584 (2026) **[Company]**
- Apple Watch 510(k) summary: ovulation identification with wrist temperature was comparable to oral temperature. https://510k.innolitics.com/device/K231274 (2023) **[Regulatory]**

**Personalisation and coaching**
- Mode-specific daily check-ins (for example, postpartum symptom and bleeding tracking). Partner view: not verified.
- Training or sleep coaching: not found.

**Logging effort**
- Daily morning thermometer use, or passive overnight wearable sync. LH tests are optional.

**Privacy**
- "Go Anonymous" mode separates identity from fertility data and requires a password. https://help.naturalcycles.com/hc/en-us/articles/20116990594333-What-is-Go-Anonymous (accessed 2026-11-27)
- The company says it has never sold user data and never will. https://www.business-humanrights.org/documents/38278/Response_from_Natural_Cycles.pdf (2022)
- GDPR applied to all users. Data may be used for research. https://help.naturalcycles.com/hc/en-us/articles/360003330234 (accessed 2026-11-27)
- Server location: not found.

**Price**
- Subscription only. Reported prices conflict: an Oura partner page lists $149.99/yr or $21.99/mo, and the US App Store shows up to $194.99/yr. An annual plan includes a thermometer or NC° Band. Reported as FSA/HSA eligible. https://go.ouraring.com/naturalcycles/ ; https://help.naturalcycles.com/hc/en-us/articles/9128446250013 (accessed 2026-11-27)

**Criticisms and limitations**
- 2018: a Stockholm hospital reported 37 of 668 abortion seekers used the app, and the Swedish Medical Products Agency received about 60 complaints. The UK ASA ruled a Facebook ad's "highly accurate" claim misleading. https://techcrunch.com/2018/08/29/contraception-app-natural-cycles-facebook-ad-banned-for-being-misleading (2018)
- 2026 Trustpilot complaints about price rises. https://ie.trustpilot.com/review/www.naturalcycles.com (accessed 2026-11-27)

---

## 6. Apple Health / Apple Watch Cycle Tracking

**Life stages**
- Regular cycles, pregnancy (log by last period, due date, gestation or IVF transfer; gestational age shown on Watch), and lactation and contraceptive use logged as "factors". https://support.apple.com/120075 ; https://support.apple.com/120356 (accessed 2026-11-27)
- Perimenopause or teen modes: not found.

**Data used**
- Logged periods and symptoms, Apple Watch heart rate (used to improve period predictions), and overnight wrist temperature (Series 8 and later, all Ultra models). https://support.apple.com/120356 ; https://support.apple.com/120357 (accessed 2026-11-27)

**Predictions and claims; regulatory status**
- Period and fertile-window predictions.
- **Retrospective** ovulation estimates from wrist temperature, after about 2 cycles of nightly wear.
- Cycle-deviation notifications based on 6 months of logs: irregular, infrequent or prolonged periods, or persistent spotting. https://support.apple.com/120356 (accessed 2026-11-27)
- Apple says the feature must not be used for birth control or diagnosis, and that ovulation estimates do not guarantee that ovulation occurred. https://support.apple.com/120357 (accessed 2026-11-27)
- Wellness feature; no FDA clearance for cycle tracking was found.

**Published accuracy**
- Human Reproduction 2025 (doi 10.1093/humrep/deaf005), Apple-funded with Apple, Harvard and NIH authors: 260 participants and 889 cycles, with urine LH as the reference. In ongoing cycles, 80.5% of cycles received an estimate, 80.0% of estimates were within ±2 days, and MAE was 1.59 days. In completed cycles, 89.0% of estimates were within ±2 days and MAE was 1.22 days. The authors warn of false estimates when no ovulation occurred. https://www.nature.com/nature-index/article/10.1093/humrep%2Fdeaf005 (2025) **[Company-funded]**

**Personalisation and coaching**
- Notifications and predictions only.
- No cycle-adapted training or coaching found.
- Health app data can be shared with chosen contacts (Health sharing); whether cycle data is included was not verified.

**Logging effort**
- Manual logging on iPhone or Watch, plus passive overnight temperature and heart rate.

**Privacy**
- Health data is end-to-end encrypted in iCloud by default (with two-factor authentication and a device passcode), and Apple cannot read it. https://support.apple.com/102651 (accessed 2026-11-27)
- Cycle data specifically is inferred to fall under Health's protections; not explicitly confirmed.

**Price**
- Free with an iPhone; Watch hardware is required for temperature features.

**Criticisms and limitations**
- Ovulation estimates are retrospective only.
- Temperature features are limited to newer Watch models.

---

## 7. Fitbit / Google (Google Health app, Pixel Watch)

**Life stages**
- Period tracking with period and fertile-window predictions. https://support.google.com/fitbit/answer/14237115 (accessed 2026-11-27)
- Pregnancy, postpartum and menopause modes: not found. A user reported a 104-day "average cycle" because pregnancy is not recognised. https://community.fitbit.com/t5/Menstrual-Health-Tracking/How-does-Fitbit-predict-my-period-better-than-the-other-apps/td-p/4724172 (accessed 2026-11-27)

**Data used**
- Google's support page says predictions use entered period and cycle-length information, defaulting to a 28-day cycle and 5-day period. https://support.google.com/fitbit/answer/14237115 (accessed 2026-11-27)
- I found no official confirmation that skin temperature is used for cycle predictions. The Flo–Google integration (2027) will pair Flo cycle data with Google skin temperature, HRV and other metrics. https://blog.google/products-and-platforms/products/google-health/commitment-womens-health-flo-health-partnership/ (2026)

**Predictions and claims; regulatory status**
- Next period and fertile window. Pixel Watch 3 gained period logging and prediction in March 2025. https://www.androidauthority.com/google-pixel-watch-3-menstrual-health-3531951 (2025)
- Wellness only.

**Published accuracy**
- Not found.

**Personalisation and coaching**
- Google Health Premium includes Gemini-based coaching. The Flo integration promises "cycle-aware coaching" for Premium users. https://androidauthority.com/google-health-premium-price-inclusions-features-3664507/ ; https://blog.google/products-and-platforms/products/google-health/commitment-womens-health-flo-health-partnership/ (2026)

**Logging effort**
- Manual logging in the app or on watch tiles.

**Privacy**
- EU merger commitments (2020): Google may not use EEA Fitbit health data for Google Ads for 10 years (extendable), and EEA users choose whether other Google services may use it. https://techcrunch.com/2020/12/17/europe-clears-google-fitbit-with-a-ten-year-ban-on-using-health-data-for-ads/ (2020) **[Regulatory]**

**Price**
- Basic tracking is free. Google Health Premium is $9.99/mo or $99.99/yr (formerly Fitbit Premium at $79.99/yr). https://androidauthority.com/google-health-premium-price-inclusions-features-3664507/ (2026)

**Criticisms and limitations**
- Reviews have called the cycle features basic and dependent on manual logging. https://www.engadget.com/2018-07-05-fitbit-female-health-tracking-period-ovulation.html (2018) ; https://www.tomsguide.com/wellness/fitness-trackers/ive-been-writing-about-fitness-trackers-for-a-decade-10-years-later-they-are-still-falling-short-for-women (accessed 2026-11-27)

---

## 8. Garmin (Garmin Connect)

**Life stages**
- Regular and irregular cycles, "No Period" with perimenopause/menopause symptom logging, and pregnancy tracking (weekly updates, symptoms, blood glucose, baby movement, weight-gain goal based on US guidelines). https://connect.garmin.com/features/menstrual-cycle-tracking/ ; https://www.garmin.com/en-US/blog/featured-2/menstrual-cycle-tracking-in-garmin-connect/ (accessed 2026-11-27)
- Postpartum and teens: not found.

**Data used**
- Logged periods and symptoms. A Garmin UK page says the watch tracks skin temperature during sleep "for more accurate period predictions and past ovulation estimates" on supported devices; an older Garmin interview said predictions averaged the last 6 cycles without temperature. The date of the change was not found. https://www.garmin.com/en-GB/blog/garmin-smartwatch-features-for-women/ (accessed 2026-11-27)
- Natural Cycles integration (March 2026) syncs overnight skin temperature from selected watches (fēnix 8, Forerunner 570/970, Venu 4, Venu X1); a separate NC subscription is required. https://www.garmin.com/en-US/blog/health/how-to-use-the-natural-cycles-app-with-your-garmin-smartwatch/ (2026)

**Predictions and claims; regulatory status**
- Period and fertile-window predictions, and past (retrospective) ovulation estimates on supported devices. Garmin says the feature is not a medical device and not for conception or contraception. https://androidauthority.com/garmin-natural-cycles-integration-3654600 (2026)

**Published accuracy**
- Not found.

**Personalisation and coaching**
- Not verified.

**Logging effort**
- Set up in the app; logging on the watch requires a Connect IQ app on some models. https://www8.garmin.com/manuals-apac/webhelp/vivoactive5/EN-SG/GUID-B40B399D-013E-4CBE-AA64-8474ECBFA578-6946.html (accessed 2026-11-27)

**Privacy**
- No cycle-specific controversy found.

**Price**
- Included with the device; Garmin Connect cycle features are free (Garmin Connect+ subscription extras not verified).

**Criticisms and limitations**
- Forum users call the tracking "underwhelming" and ask for temperature charts. https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/412522/menstrual-cycle-tracking-underwhelming (accessed 2026-11-27)

---

## 9. Samsung Health (Galaxy Watch / Ring)

**Life stages**
- Cycle tracking. Pregnancy, menopause and teen modes: not found.

**Data used**
- Logged dates plus overnight skin temperature (Galaxy Watch5 and later, Watch7, Watch Ultra, Galaxy Ring), using an adapted Natural Cycles algorithm. https://news.samsung.com/global/samsung-and-natural-cycles-partner-to-bring-advanced-temperature-based-cycle-tracking-to-galaxy-watch5-series (2023) ; https://www.samsung.com/ca/support/apps-services/track-your-menstrual-cycle-with-samsung-health/ (accessed 2026-11-27)

**Predictions and claims; regulatory status**
- Next period, fertile days and ovulation.
- Cleared by Korea's MFDS. In the US, Samsung says the feature is "registered" with the FDA, operating under Natural Cycles' clearance per The Verge. Samsung says it is not intended for contraception or diagnosis. https://news.samsung.com/us/samsung-natural-cycles-partner-advanced-temperature-based-cycle-tracking-galaxy-watch5-series ; https://www.samsung.com/sg/support/apps-services/samsung-health-cycle-tracking/ (2023)

**Published accuracy**
- Not found.

**Personalisation and coaching**
- Not found.

**Logging effort**
- Enter recent cycle dates, enable "Predict period with skin temp", and wear the watch during sleep. https://9to5google.com/2023/04/19/galaxy-watch-5-menstrual-cycle-skin-temperature/ (2023)

**Privacy**
- Samsung says temperature data is encrypted and stored on the device. https://9to5google.com/2023/04/19/galaxy-watch-5-menstrual-cycle-skin-temperature/ (2023)

**Price**
- Free with the device.

**Criticisms and limitations**
- Launched in 32 countries in 2023; current country list not verified. https://news.samsung.com/global/skin-temperature-based-cycle-tracking-now-available-on-galaxy-watch5-series-in-32-countries (2023)

---

## 10. Ultrahuman (Ring AIR)

**Life stages**
- Cycle tracking and conception modes. Pregnancy and menopause: not found.

**Data used**
- Skin temperature, resting HR and HRV. https://www.ultrahuman.com/blog/ultrahuman-cycle-and-ovulation-powerplug/ (2024)

**Predictions and claims; regulatory status**
- The free Cycle & Ovulation PowerPlug (December 2024) gives calendar-based predictions.
- Cycle & Ovulation Pro (August 2025, after acquiring viO HealthTech/OvuSense) adds temperature-based ovulation pattern recognition and "Cycle Flags". It is a wellness product, not for contraception or diagnosis. The underlying OvuSense device is FDA-cleared Class II, but the ring version is a different product. https://techcrunch.com/2025/08/15/ultrahuman-acquires-vio-healthtech-to-launch-enhanced-cycle-and-ovulation-tracking (2025)

**Published accuracy**
- The company claims over 90% accuracy for ovulation confirmation from internal equivalence testing against a multi-hormone method. https://athletechnews.com/ultrahumans-vio-deal-brings-90-accurate-ovulation-tracking/ (2025) **[Company; internal]**
- A pilot claim of pinpointing ovulation within a 7-day fertile window. https://hitconsultant.net/2024/12/04/ultrahuman-launches-free-ai-powered-fertility-tracking (2024) **[Company]**

**Personalisation and coaching**
- Not verified.

**Logging effort**
- Passive ring wear plus period marking.

**Privacy**
- Not found.

**Price**
- No ring subscription. The free PowerPlug is included; Pro costs $3.99/mo or $39.99/yr. https://www.tomsguide.com/wellness/smart-rings/ultrahuman-launches-cycle-and-ovulation-pro-and-they-say-its-the-most-accurate-cycle-tracking-on-any-smart-ring (2025)

**Criticisms and limitations**
- A T3 review argues the predictions remain a "guesstimate". https://www.t3.com/active/fitness-trackers/ultrahumans-smart-ring-adds-medical-grade-cycle-tracking-for-a-price (2025)

---

## 11. Stardust

**Life stages**
- Period and pregnancy tracking. https://apps.apple.com/us/app/id1495829322 (accessed 2026-11-27)

**Data used**
- Logged data only.

**Predictions and claims**
- Cycle, PMS and mood forecasts; a moon-phase calendar and astrology content. https://www.bustle.com/wellness/stardust-app-review-period-tracking-astrology (accessed 2026-11-27)
- Wellness only.

**Published accuracy**
- Not found.

**Personalisation, coaching and sharing**
- Friend and partner sharing via share links and friend codes. https://apps.apple.com/us/app/id1495829322 (accessed 2026-11-27)

**Logging effort**
- Manual.

**Privacy**
- In June 2022 Stardust marketed end-to-end encryption. TechCrunch found it sent a phone-number identifier to a third party and later removed the end-to-end-encryption wording; later reporting found keys uploaded to its servers. Mozilla reported sharing with analytics firm RudderStack. https://techcrunch.com/2022/06/27/stardust-period-tracker-phone-number (2022) ; https://www.mozillafoundation.org/en/nothing-personal/stardust-privacy-review/ (accessed 2026-11-27)

**Price**
- Free, with All Access reported at $2.99/wk, $3.99/mo or $24.99/yr. https://www.bustle.com/wellness/stardust-app-review-period-tracking-astrology (accessed 2026-11-27)

---

## 12. Ovia (Labcorp)

**Life stages**
- Separate apps for fertility, pregnancy and parenting. Labcorp acquired Ovia on 12 August 2021. https://www.sec.gov/Archives/edgar/data/920148/000092014821000053/form81221ex991oviaacquisit.htm (2021)

**Data used**
- Logged BBT, cervical fluid and position, medications, moods, periods, symptoms and sleep. https://apps.apple.com/ms/app/id570244389 (accessed 2026-11-27)

**Predictions and claims**
- Fertile window and a daily fertility score; for conception, not contraception (wellness).

**Published accuracy**
- Not found.

**Personalisation**
- Premium tools are unlocked via employer or health-plan benefit. https://apps.apple.com/ms/app/id570244389 (accessed 2026-11-27)

**Logging effort**
- Manual.

**Privacy**
- 2019 Washington Post reporting: employers paying for Ovia could access de-identified, aggregated employee data. https://beckershospitalreview.com/cybersecurity/pregnancy-tracking-app-raises-privacy-concerns-over-data-shared-with-employers.html (2019)
- The current policy says health data is not shared with the employer without express opt-in. Mozilla advises not opting in. https://www.mozillafoundation.org/en/privacynotincluded/ovia-fertility (accessed 2026-11-27)

**Price**
- The consumer app is free; employer and health-plan versions exist.

---

## 13. Glow (Glow, Eve, Nurture, Glow Baby)

**Life stages**
- Fertility (Glow), period and sexual health (Eve), pregnancy (Nurture) and baby (Glow Baby). https://apps.apple.com/us/app/glow-fertility-ovulation-app/id638021335 (accessed 2026-11-27)

**Data used**
- Logged data.

**Predictions and claims**
- Ovulation and fertile-window prediction, for conception and not contraception. Eve predicts the next period from average luteal plus follicular phase lengths. https://www.comparably.com/companies/glow/faqs (accessed 2026-11-27)

**Published accuracy**
- Not found. Glow was included in the Worsfold 2021 simulation (see General evidence).

**Personalisation**
- Premium includes comparative "Is this normal?" insights and private messaging. https://apps.apple.com/us/app/-/id882398397 (accessed 2026-11-27)

**Logging effort**
- Manual.

**Privacy**
- The California AG settled with Glow in September 2020 ($250,000 penalty), alleging security flaws in 2013–2016 (for example, a password-change flaw) and sharing without consent. The settlement requires privacy- and security-by-design and annual risk assessments that consider gender-specific impact. No breach was alleged. https://oag.ca.gov/node/194137 ; https://iapp.org/news/a/calif-attorney-general-reaches-250k-settlement-with-fertility-tracking-app/ (2020) **[Regulatory]**

**Price**
- Free. One Glow Premium subscription covers all Glow apps; reported prices range from about $20–$70/yr by region, or $59.99 lifetime. https://apps.apple.com/us/app/-/id882398397 (accessed 2026-11-27)

---

## 14. Tempdrop (armband BBT sensor)

**Life stages**
- Trying to conceive, natural family planning and charting. Detail: not verified.

**Data used**
- An upper-arm sensor records overnight temperature; the app derives a BBT from the whole sleep session. https://www.mdpi.com/1424-8220/25/20/6327 (2025)

**Regulatory status**
- The iOS listing says the sensor is "registered in the FDA database" as a fertility diagnostic device. Registration is not clearance, and it was not verified in the FDA database. https://apps.apple.com/us/app/tempdrop/id1199061141 (accessed 2026-11-27)

**Published accuracy**
- MDPI Sensors 2025: 194 cycles with the Clearblue connected ovulation test as the reference; the author list includes Tempdrop Ltd. Tempdrop reports about 99% specificity and 98.6% accuracy for ovulation detection. https://www.mdpi.com/1424-8220/25/20/6327 ; https://www.tempdrop.com/a/blog/device/new-clinical-evidence-supports-tempdrop-for-precise-ovulation-detection (2025) **[Company]**

**Logging effort**
- Passive overnight wear, plus manual charting of other signs.

**Price**
- Device purchase plus an optional subscription for automated interpretation; current price not found. https://www.trustpilot.com/review/tempdrop.com (accessed 2026-11-27)

**Criticisms**
- Reviews report fit and recording-gap complaints.

---

## 15. Hormone-test devices: Mira, Inito, Proov, Kegg

### Mira
- Quantitative urine LH, E3G, PdG and FSH via wands and an analyser, aimed at TTC and cycle tracking (and perimenopause, not verified).
- **Accuracy:**
  - "Up to 99.5%" is analytical lab accuracy with known concentrations, not clinical accuracy. https://miracare.com/blog/5-facts-about-mira **[Company]**
  - About 14-cycle comparison with Clearblue (company PDF). https://www.miracare.com/assets/ovulation-tracking-comparison-study-of-Mira-with-semi-quantitative-product.pdf **[Company]**
  - A published protocol (PMC10533176, 2023) notes there had been no formal ultrasound or serum comparison. https://pmc.ncbi.nlm.nih.gov/articles/PMC10533176/ (2023)
- **Regulatory status:** not found; the company says it is not diagnostic or contraceptive.
- **Price:** the Max Kit was about $229+ (review). https://www.sheknows.com/health-and-wellness/articles/1234885736/mira-fertility-tracker-review/ (accessed 2026-11-27)

### Inito
- One strip measures E3G, LH, PdG and FSH, read with a smartphone reader.
- **Regulatory status:** reported as an FDA-registered Class I, 510(k)-exempt device; some listings say "510(k) cleared". Conflicting. https://india.entrepreneur.com/news-and-trends/in-a-first-bengalurus-inito-clears-fda-regulatory-pathway/358889 (2020)
- **Accuracy:** Scientific Reports 2023 reports high correlation with lab ELISA for urinary E3G, PdG and LH, with average CVs of 5.05% (PdG), 4.95% (E3G) and 5.57% (LH), and proposes earlier ovulation confirmation. https://www.nature.com/articles/s41598-023-36539-w (2023) **[Company-authored]**
- **Price:** the InSight Wireless Reader launched at $99 with 15 strips. https://www.businesswire.com/news/home/20260409655970/en (2026)

### Proov
- Urine PdG tests to confirm ovulation, with an app.
- **Regulatory status:** FDA 510(k) K191462 (27 February 2020) as an aid for confirming ovulation. https://www.accessdata.fda.gov/cdrh_docs/reviews/K191462.pdf (2020) **[Regulatory]**
- **Accuracy:**
  - Leiva et al. 2019 (company-funded): 100% specificity, and 85% sensitivity when a positive LH test was followed by 3 consecutive positive PdG tests. Cited in a NICE review. https://www.nice.org.uk/advice/mib322/chapter/Clinical-and-technical-evidence **[Company]**
  - NICE notes that 45% of participants were on fertility medication.

### Kegg
- An intravaginal impedance sensor that reads cervical-fluid electrolytes for about 2 minutes daily, combined with a pelvic-floor trainer; readings go to company cloud algorithms.
- **Regulatory status:** the company describes it as FDA-registered Class I, not cleared.
- **Accuracy:** a 2024 Contraception and Reproductive Medicine study with n=14 over 3 cycles found impedance outperformed BBT for the one-day fertile window. A larger study, NCT06862440 (n=189), is ongoing. https://contraceptionmedicine.biomedcentral.com/articles/10.1186/s40834-024-00276-w (2024) ; https://clinicaltrials.gov/study/NCT06862440

---

## 16. Menopause apps: Balance, Perifit

- **Balance** (founded by Dr Louise Newson): free symptom tracking, pattern spotting, evidence-based content and appointment preparation. Balance+ costs $4.99/mo or $49.99/yr (US) and adds content paths, weekly live Q&As and enhanced reports. https://apps.apple.com/us/app/id1503345959 (accessed 2026-11-27)
  - Logging is manual and symptom-based. No wearable or prediction features found. Published accuracy: not applicable / not found. Privacy: not researched in depth.
- **Perifit:** no menopause app was found in public sources. Perifit appears to be primarily a pelvic-floor trainer with a companion app (not verified). Excluded from the table.

---

## Compact comparison table

"NF" = not found / not verified. "Co." = company-authored or company-funded evidence. "Ind." = independent.

| Product | 1 Life stages | 2 Data used | 3 Predicts / regulatory | 4 Published accuracy | 5 Personalisation / coaching | 6 Logging | 7 Privacy notes | 8 Price (US, reported) | 9 Key criticism |
|---|---|---|---|---|---|---|---|---|---|
| Flo | Cycle, TTC, pregnancy, perimenopause; teen content | Logs, symptoms; Google wearable data from 2027 | Period, ovulation, fertile window; wellness only | No peer-reviewed model study; Co. user-survey claim | AI Health Assistant (Premium); Flo for Partners | Manual | FTC order 2021; $59.5M class settlements; Meta CIPA verdict 2025; Anonymous Mode (OHTTP) | Free; Premium about $40–60/yr | Data-sharing history; paywall creep |
| Oura | Cycle, pregnancy, perimenopause; NC contraception via partner | Finger skin temperature, HR/HRV, respiration, tags | Period, fertile window, retrospective ovulation; not a medical device | Co. JMIR 2025: MAE 1.18 d (n=964); Co.-involved pilot 83.3% sensitivity | Oura Advisor AI; care-partner access; provider report | Passive plus tags | DoD/Palantir backlash 2025; says no sale | Ring $349–399 plus $69.99/yr | Company-only evidence |
| WHOOP | Cycle, TTC, pregnancy, postpartum, peri/postmenopause toggles | HRV, RHR, skin temperature, respiration, logs; blood labs | Phase estimates, symptom predictions; not a medical device | NF | Phase-based strain and sleep; AI coach; NC included 2026 | Passive plus Journal | No cycle-specific issue found; FDA warning letter (BP feature) 2025 | About $199–239/yr incl. hardware | No accuracy data; natural cycles only |
| Clue | Cycle, conceive, pregnancy, perimenopause | Logs; wearable pairing (Plus) | Period, fertile window; Birth Control FDA 510(k) K193330 (2021), current availability unclear | Dot trial: 1.0% perfect / 5.8% typical, 13 cycles (developer-run) | Plus insights; NF for coaching | Manual | EU/GDPR, Berlin; post-Roe commitments | Free; Plus about $40/yr | Feature churn during rebuild |
| Natural Cycles | Contraception, TTC, pregnancy, postpartum, perimenopause | BBT (thermometer) or wearable temperature, optional LH | Contraception: FDA De Novo 2018 plus 5 later clearances | FDA review: 1.8% perfect / 6.5% typical; Co. PI 6.9 typical | Mode-specific check-ins | Daily thermometer or passive wearable | Go Anonymous; no sale; GDPR | About $150–195/yr (conflicting) | 2018 Swedish complaints; ASA ad ruling |
| Apple | Cycle, pregnancy, lactation/contraceptive factors | Logs, Watch HR, wrist temperature | Period, fertile window, retrospective ovulation, deviation alerts; wellness | Co.-funded Hum Reprod 2025: 80% within ±2 d (ongoing cycles) | Notifications only | Manual plus passive | Health end-to-end encrypted by default | Free (hardware) | Retrospective only; newer Watches only |
| Fitbit / Google | Cycle | Logs (temperature use NF); Flo sync 2027 | Period, fertile window; wellness | NF | Gemini coach (Premium); cycle-aware coaching planned | Manual | EU 10-yr ban on ads use of Fitbit health data | Free; Premium $99.99/yr | Basic; no pregnancy handling |
| Garmin | Cycle, pregnancy, no-period/menopause symptoms | Logs; skin temperature on some devices; NC integration 2026 | Period, fertile window, past ovulation; not a medical device | NF | NF | Manual (Connect IQ on watch) | NF | Free (hardware) | Users call it basic |
| Samsung | Cycle | Logs plus overnight skin temperature (NC algorithm) | Period, fertile days, ovulation; KR MFDS cleared, US "registered" | NF | NF | Manual setup plus passive | Temperature data encrypted on device | Free (hardware) | Device and country limits |
| Ultrahuman | Cycle, conception | Skin temperature, RHR, HRV | Calendar (free); temperature-based ovulation (Pro); wellness | Co. internal "90%+" | NF | Passive plus period marking | NF | Ring, no subscription; Pro $39.99/yr | Internal testing only |
| Stardust | Cycle, pregnancy | Logs | Forecasts, moon/astrology; wellness | NF | Friend sharing | Manual | 2022 encryption claims disputed; RudderStack sharing | Free; about $25/yr | Privacy claims vs practice |
| Ovia | Fertility, pregnancy, parenting | Logs incl. BBT, cervical fluid | Fertile window, fertility score; wellness | NF | Employer-benefit premium | Manual | 2019 employer aggregate-data reporting | Free / employer-paid | Employer data concerns |
| Glow | Fertility, period, pregnancy, baby | Logs | Ovulation, fertile window; wellness | NF | Comparative insights, messaging | Manual | CA AG $250k settlement 2020 | Free; Premium about $20–70/yr | Past security flaws |
| Tempdrop | TTC / FAM charting | Armband overnight temperature | Ovulation detection; "FDA registered" | Co. 2025: 98.6% vs Clearblue (194 cycles) | NF | Passive armband | NF | Device plus subscription (NF) | Fit / data gaps |
| Mira / Inito / Proov / Kegg | TTC (mainly) | Urine LH/E3G/PdG/FSH; Kegg: vaginal impedance | Fertile window, ovulation confirmation; Proov FDA 510(k); others registered or unclear | Mostly Co. (Inito Sci Rep 2023; Proov n small; Kegg n=14) | NF | Daily test strips / insertion | NF | Mira about $229 kit; Inito $99 reader | Small or company studies |
| Balance | Peri/menopause | Symptom logs | Symptom patterns; no predictions | n/a | Content, live Q&As (Plus) | Manual | NF | Free; $49.99/yr | Not researched |

---

## General evidence on cycle-app prediction accuracy (independent or population-level)

1. **Bull JR, Rowland SP, Scherwitzl EB, et al. "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles." npj Digital Medicine 2019;2:83.**
   - 612,613 ovulatory cycles from 124,648 Natural Cycles users. Mean cycle 29.3 days; mean follicular phase 16.9 days (range 10–30); luteal phase 12.4 days (7–17).
   - Cycle length fell about 0.18 days per year of age from 25 to 45.
   - Calendar assumptions (ovulation on day 14, or 14 days before the next period) were not supported, so physiological signals are needed to locate the fertile window.
   - Authors include Natural Cycles staff (company data). https://pubmed.ncbi.nlm.nih.gov/31482137/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244 (2019)
2. **Setton R, Tierney C, Tsai T. "The accuracy of web sites and cellular phone applications in predicting the fertile window." Obstet Gynecol 2016.** **[Independent]**
   - 20 websites and 33 apps were tested with an idealised 28-day cycle. Only 4 of 53 gave the exact fertile window (1 site; apps iPeriod, My Days, Clue).
   - Windows ranged from 4 to 12 days; most named the ovulation day correctly.
   - The authors note real-world irregular cycles would likely perform worse. https://www.foxnews.com/health/apps-perform-poorly-to-find-best-time-for-conceiving ; https://www.progress.org.uk/study-finds-most-fertility-tracker-apps-are-inaccurate/ (2016)
3. **Johnson S, Marriott L, Zinaman M. "Can apps and calendar methods predict ovulation with accuracy?" Curr Med Res Opin 2018;34(9):1587–94.**
   - 949 women collected daily urine (LH surge as reference). Apps' ovulation-day prediction accuracy was "no better than 21%".
   - Ovulation day varies substantially even within a given cycle length.
   - Authors are affiliated with SPD (Clearblue maker), a commercial interest in LH tests. https://www.tandfonline.com/doi/10.1080/03007995.2018.1475348 (2018)
4. **Worsfold L, Marriott L, Johnson S, Harper JC. "Period tracker applications: What menstrual cycle information are they giving women?" Women's Health 2021;17.**
   - 10 apps, including Clue, Flo and Glow, were tested with 5 simulated women over 6 cycles. The apps gave conflicting period, ovulation-day and fertile-window predictions.
   - All apps were correct only for the most regular profile.
   - Two authors have SPD affiliation. https://pmc.ncbi.nlm.nih.gov/articles/PMC8504278 ; doi 10.1177/17455065211049905 (2021)
5. **Supporting:**
   - Freis A, et al. "Plausibility of menstrual cycle apps claiming to support conception." Front Public Health 2018;6:98. A scoring system for 12 apps; the authors stress that fertile-window errors can steer couples to infertile days. https://pmc.ncbi.nlm.nih.gov/articles/PMC5891577 (2018) **[Independent]**
   - Li K, Urteaga I, et al. npj Digit Med 2020;3:79. Clue data from 378,000 users and 4.9M cycles; per-person cycle variability is linked with symptoms; self-tracked data partly reflects app engagement. https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828 (2020) **[Academic, Clue data]**

**Patterns across the evidence**
- Calendar-only predictions are least reliable for ovulation and the fertile window, especially in irregular cycles.
- Temperature- or hormone-based methods report smaller errors, but nearly all published figures for those methods are company-authored or company-funded.
- Most use LH tests as the reference rather than ultrasound.
- Wearable ovulation detection from temperature is largely **retrospective** (it confirms after the rise). Only Natural Cycles (and the Clue/Dot algorithm, now of uncertain availability) hold FDA authorisation for contraception.
