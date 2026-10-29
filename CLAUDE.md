# Hani's Family Plan (PWA) — notes for Claude Code

The owner is a programming beginner. Keep answers short and simple. Never deploy or upload anything; the owner uploads to GitHub by hand.

## Files (since v144 the app is split; do NOT merge them back into index.html)
- `index.html` — only the page's HTML (screens, pop-ups) + the list of `<script>` tags.
- `css/app.css` — all the styles.
- `js/*.js` — the JavaScript, plain classic scripts sharing one global scope (no modules, no import/export). They load in this order:
  1. `core.js` — settings, data shape, load/clean data (`cleanData`, `cleanSchool`), small helpers
  2. `screens.js` — who is using the app, moving between screens, 💾 save
  3. `points.js` — points, done ticks, scoring, Shining Star
  4. `fun.js` — ⭐ habits, 🧩 riddles, 📔 My day, ✅ duties, 💌 wishes, 🌱 levels
  5. `reports.js` — 📊 kids report, 📄 family summary PDF, 👀 kids' work today
  6. `profile.js` — 👤 My profile, 🧒 first-time kid setup, 🏆 leaderboard, Hall of Stars
  7. `home.js` — kids' home, parent's home (card per kid), kid page, ☰ more pages
  8. `activities.js` — add activities, the planner (builds the week), routines, 🕌 prayer times
  9. `calendar.js` — 📌 one-day events, the week calendar, ✏️ edit calendar, print
  10. `school.js` — 🎒 School binder, school files, photos
  11. `ai.js` — 🤖 AI help (worksheets, explain, check) — talks to the family-plan-ai server
  12. `study.js` — 📚 study topics, curriculum, sessions, learning profile
  13. `settings.js` — ⚙️ settings, 👨‍👩‍👧 family setup
  14. `taps.js` — the one click listener for most buttons
  15. `cloud.js` — ☁️ Firebase login + sync
  16. `news.js` — 🔔 What's new / notifications
  17. `start.js` — starts the app (must stay last)
- `sw.js` — service worker (offline copy). `manifest.json`, `icons/`.

## Rules for every change
1. Open only the file(s) the change needs. Use search (grep) to find a function instead of reading whole files.
2. Code that runs straight away when a file loads (not inside a function) may only use functions from the SAME or an EARLIER file in the list above.
3. A new file: add its `<script>` tag in `index.html` in the right place AND add it to `APP_FILES` in `sw.js`.
4. After every change: bump `CACHE` in `sw.js` (e.g. family-planner-v144 → v145) AND the `?v=` number on every `<script>`/`<link>` in `index.html` to the same number.
5. Check syntax: `node --check` on every changed .js file. Give a short summary of what changed.
6. Function names must be unique across ALL files (two functions with the same name silently replace each other).
