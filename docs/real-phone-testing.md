# Real-phone testing checklist

Automated tests run in desktop Chromium, some with phone screen sizes emulated (`tests/mobile-layout.cjs`). Emulation checks layout. It does **not** check:
- Safari's engine;
- touch keyboards, date pickers or system dialogs;
- storage rules, notifications or memory limits on real phones.

This checklist is for a person with real devices. Use **synthetic data only**: the demo profile, or made-up entries.

## Devices
Minimum versions come from `docs/browser-compat.md`: iOS 15.4, Chrome 98, Firefox 95, Samsung Internet 18. Every browser on iPhone and iPad uses Safari's engine.

| Device | Browser | Why |
|---|---|---|
| Oldest supported iPhone (iOS 15.4–16.x if available) | Safari tab | Minimum version; older Safari quirks |
| Current iPhone, current iOS | Safari tab **and** added to Home Screen | Home Screen apps get different storage and notification rules |
| iPad | Safari | Larger layout, split view |
| Mid-range Android (e.g. Pixel or Samsung A series) | Chrome, and installed as an app | Most common Android set-up |
| Samsung phone | Samsung Internet | Different engine version and defaults |
| Any Android | Firefox | Different engine |

## For each device
**Open and install**
- [ ] Opens over HTTPS; the welcome screen fits without sideways scrolling.
- [ ] Add to Home Screen / Install works, and the app opens full-screen from the icon.
- [ ] Airplane mode: the app still opens from the Home Screen icon (offline cache).
- [ ] After an update is published, the new version arrives within one or two relaunches (cache version bump).

**Typing and controls**
- [ ] Tapping any text field or menu does **not** zoom the page (iOS).
- [ ] Date fields open the system date picker. The chosen date appears correctly, with no off-by-one-day error near midnight.
- [ ] Menus (select) open the system picker and the choice sticks.
- [ ] Every button and checkbox is easy to hit with a thumb, and nothing is hidden under the notch or the home indicator (safe areas).
- [ ] Rotation to landscape and back keeps the layout usable.

**Cycle tracking (synthetic data)**
- [ ] Consent screen → agree → log a period start and end → log a day (energy, mood) → close the app completely → reopen: everything is still there.
- [ ] Two tabs open, edit in one: the other updates or warns, and nothing is lost.
- [ ] Export: the file downloads (on iPhone it goes to Files). The summary prints or saves as PDF.
- [ ] "Delete all" removes the data. After a relaunch, it is gone.
- [ ] Reminders and notifications:
  - on iPhone, only as a Home Screen app on iOS 16.4+, after allowing them;
  - in a Safari tab, the app says notifications aren't available.

**Storage (important for health data)**
- [ ] **iPhone Safari tab (not installed):** Safari can delete a website's stored data after 7 days without a visit. Leave the synthetic data, don't open the site for 8+ days, then check.
  - Expected risk: the data may be gone.
  - If it is, the app should advise installing it to the Home Screen and exporting regularly. **This is a known open item**: the app does not yet request persistent storage (`navigator.storage.persist()`) or warn about eviction.
- [ ] **Private browsing:** the app works, or says clearly that data will not be kept.
- [ ] **Low storage:** saving fails with a clear message, not silently.

**Accessibility**
- [ ] VoiceOver (iPhone) / TalkBack (Android): every button has a sensible name, and the order of the cycle screen makes sense.
- [ ] Larger text (Dynamic Type / Android font size): text grows and nothing overlaps or gets cut off.
- [ ] Dark mode and light mode are both readable.

**Camera features (optional)**
- [ ] Camera permission prompt appears. Refusing it shows a message, not a blank screen.

## Recording results
Record each device in a table with these columns:
- device and OS version;
- browser and version;
- installed or tab;
- each checked item: pass, fail, or not applicable;
- a screenshot of each failure.

File failures with the device and version. Do not record real health data in screenshots.

## Known limits of the automated tests
- `npm run test:e2e:webkit` and `npm run test:e2e:firefox` run the same browser tests in WebKit and Firefox once those browsers are installed (`npx playwright install --with-deps webkit firefox`).
  - They were **not** run in the development environment, where only Chromium is available.
  - Desktop WebKit is close to Safari, but it is not iOS Safari.
- The research dashboard is for researchers on a computer. It was laid out for desktop, and phone layout was not a goal.
