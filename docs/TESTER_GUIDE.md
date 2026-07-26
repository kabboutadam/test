# BusMapp — tester guide

Thanks for testing BusMapp! This is an early build of a school-bus tracking app
for parents in Lebanon. This version runs in **demo mode**: the buses move on
their own with sample Beirut routes, so **you don't need to log in or set
anything up** — just open it and explore.

## What to try (2–3 minutes)

1. **Home — "My Children."** You'll see two sample kids, each with a live status
   like `3 stops away · ~7 min`. Watch a chip update as the bus moves.
2. **Open a child.** Tap a card. You'll see:
   - A big **"stops away"** countdown that ticks down as the bus approaches.
   - **Map / Stops** toggle — a live map with the moving bus, or a stop-by-stop
     list. Try both.
   - The child's **school, route, and pickup stop + time**.
   - **Tap the bus card** to call the driver (it'll open your phone dialer — you
     can cancel).
3. **Notifications.** On the home/Account screen make sure **Bus approach alerts**
   is on and allow notifications. As a bus gets close you'll get "3 stops away",
   "1 stop away", and "arriving" alerts.
4. **Add / edit a child.** Account → **Add child** → pick a school, route, and
   stop. Then tap a child in Account to **change their stop** or remove them.
5. **Subscription.** Home banner or Account → **Manage plan** → pick a plan →
   Subscribe. (No real charge — it's a demo.)
6. **Morning vs Afternoon.** At the top of Home, switch between **Morning**
   (home → school pickup) and **Afternoon** (school → home drop-off). Each child
   is dropped at the same neighborhood they boarded from, and the countdown flips
   to "dropping off." It defaults to whichever matches the current time of day.
7. **Arabic.** Account → **Language** → العربية. The whole app switches to Arabic
   and flips to right-to-left layout. Switch back with English.
8. **Restart the demo** anytime: Account → **Restart bus simulation**.

## What feedback helps most

- Is the **"stops away"** idea clear and useful at a glance?
- Are the **notifications** helpful, or too many / too few?
- Anything **confusing** in the wording, layout, or flow?
- The **map** vs. the **stops list** — which do you prefer, and why?
- Any **crash, freeze, or weird behavior** — note what you tapped just before.

## Known limitations (already on our list)

- The buses and routes are **sample data** — not real schools or live GPS yet.
- **Payments** are simulated (no real billing).
- This build is **demo mode**; the real version adds phone login, live GPS from
  the actual bus driver, and per-school setup.

Send feedback however's easiest — a quick note or screenshot is perfect. 🚌
