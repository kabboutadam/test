# Release notes

## 0.2.0 (build 10)

**New**
- **Arabic + right-to-left.** The whole parent app is translated to Arabic, with
  a proper RTL layout. Switch anytime in Account → Language (English / العربية).
- **Afternoon drop-off tracking.** A Morning / Afternoon toggle on the Home
  screen. Afternoon follows the school → home run and drops each child at the
  same neighborhood they boarded from, with "dropping off" wording. It defaults
  to whichever matches the current time of day.

**Under the hood**
- Backend now serves the afternoon drop-off routes too, so live tracking works
  in both directions once the server is deployed.
- Over-the-air updates (EAS Update) are enabled from this build on, so future
  text/logic fixes can reach testers without a new TestFlight build.

### TestFlight "What to Test" (paste into App Store Connect)

> This build adds Arabic (with right-to-left layout) and afternoon drop-off
> tracking. Please try: Account → Language → العربية to switch to Arabic, and the
> Morning / Afternoon toggle at the top of the Home screen. Confirm the bus still
> counts down "stops away" in both directions and that Arabic reads correctly
> right-to-left. Note anything that looks mislaid out or untranslated.

---

## 0.1.0 (builds 1–9)

First TestFlight builds. Demo mode: simulated Beirut bus routes, "stops away"
tracking, live map, approach notifications, add/edit children, and a simulated
subscription flow.
