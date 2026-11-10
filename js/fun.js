// =====================================================================
//  ⭐ GOOD HABITS: a daily checklist for the kids (not on the calendar)
// =====================================================================
let habitDay = -1;   // (-1 = today) which day of the points week the habits card shows (0 = its first day … today; set when a screen opens). No future days.

// The habits that are on for this person (kids only; Bro2a can turn them off per kid in Settings)
function habitsFor(user) { return isParentId(user) || !exists(user) ? [] : data.habits.filter(h => !h.gone && !h.off.includes(user)); }
const habitKey = (date, habitId, user) => `${date}|${habitId}|${user}`;
// Is the habit fully done? (all 5 prayers, all 6 drops)
function habitDone(h, v) {
  return h.kind === "prayers" ? Array.isArray(v) && v.every(Boolean) : h.kind === "water" ? v >= WATER_DROPS : v === true;
}

// The card "⭐ My good habits today": big rows to tap, small round ticks in the kid's color
// The one-tick habits are round picture buttons; 🕌 prayers and 💧 water keep their small ticks in a row.
function habitsCardHtml(who) {
  const list = habitsFor(who);
  if (!list.length) return "";
  const u = userById(who), c = colorsOf(u), today = weekIndex();
  if (habitDay < 0 || habitDay > today) habitDay = today;
  const d = habitDay, date = ymd(dayDate(d)), isToday = d === today;
  const canTick = isParentId(me) || who === me;            // same rule as activities
  const dis = canTick ? "" : "disabled";
  const mark = h => data.habitMarks[habitKey(date, h.id, who)];
  const done = list.filter(h => habitDone(h, mark(h))).length;
  const tick = (h, part, on, inner, label) =>
    `<button class="k-check hb-check ${on ? "on" : ""}" data-hb="${safe(who)}|${safe(h.id)}|${part}" ${dis}
       aria-pressed="${on}" aria-label="${safe(label)}" title="${safe(label)}">${inner}</button>`;
  const rows = list.map(h => {
    const v = mark(h), full = habitDone(h, v);
    const head = `<span class="hb-emoji">${safe(h.emoji)}</span><span class="hb-name">${safe(h.name)}</span>`;
    if (h.kind === "prayers") return `<div class="hb-row multi ${full ? "done" : ""}">${head}<span class="hb-parts">${PRAYERS.map((p, i) => {
        const on = Array.isArray(v) && !!v[i];
        return `<span class="hb-part">${tick(h, i, on, on ? "✓" : "", p)}<small>${p}</small></span>`;
      }).join("")}</span></div>`;
    if (h.kind === "water") return `<div class="hb-row multi ${full ? "done" : ""}">${head}<span class="hb-parts">${Array.from({ length: WATER_DROPS }, (_, i) => {
        const on = (v || 0) > i;
        return tick(h, i, on, `<span class="e">💧</span>`, `Glass ${i + 1} of ${WATER_DROPS}`);
      }).join("")}</span></div>`;
    return "";   // (one-tick habits: the round buttons below)
  }).join("");
  // One tick: a round picture button (the circle fills with my colour, a ✓ pops in)
  const singles = list.filter(h => h.kind !== "prayers" && h.kind !== "water").map(h => { const on = habitDone(h, mark(h)); return `<button class="pic-btn ${on ? "on" : ""}"
    data-hb="${safe(who)}|${safe(h.id)}|0" ${dis} aria-pressed="${on}"><span class="pic-dot"><span class="e">${safe(h.emoji)}</span>${on ? `<b class="pic-ok" aria-hidden="true">✓</b>` : ""}</span>
    <small>${safe(h.name)}</small></button>`; }).join("");
  return `<div class="card hb-card" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
    <div class="hb-top"><h2>${who === me ? "⭐ My good habits" : `⭐ ${safe(u.name)}'s good habits`}${isToday ? " today" : ""}</h2>
      <span class="hb-progress">${done} / ${list.length}${isToday ? " today" : ""} ${done === list.length ? "🌟" : "💪"}</span></div>
    <div class="hb-nav">
      <button data-hbday="-1" ${d === 0 ? "disabled" : ""} aria-label="Day before">◀ Before</button>
      <b>${isToday ? "Today" : DAYS[weekdayOf(date)]}, ${dateOfDay(d)}</b>
      <button data-hbday="1" ${d >= today ? "disabled" : ""} aria-label="Next day">Next ▶</button>
      ${canTick ? "" : `<span class="hb-look">Just looking 👀</span>`}
    </div>
    ${rows ? `<div class="hb-rows">${rows}</div>` : ""}${singles ? `<div class="pic-grid">${singles}</div>` : ""}
    ${isParentDevice() ? `<div class="ph-change"><button class="linkbtn" data-kidhabits>✏️ Kids' habits</button></div>` : ""}</div>`;
}
// A small bounce on the button that was just tapped (after the screen is drawn again)
function popButton(sel) {
  requestAnimationFrame(() => { const b = document.querySelector(sel); if (b) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } });
}

// Tapping a habit tick. part = which prayer (0–4) or which water drop (0–5); 0 for one-tick habits.
function toggleHabit(who, habitId, part, button) {
  if (editMode) return toast("Tap ✅ Done first, then you can tick.");
  if (newWeek()) { keepNow(); return toast("🌅 A new week started! Points are back to zero."); }
  const h = data.habits.find(x => x.id === habitId);
  if (!h || !habitsFor(who).includes(h)) return;
  if (!(isParentId(me) || who === me)) return toast("You can only tick your own habits.");
  if (habitDay > weekIndex()) return toast("Not yet!");
  const date = ymd(dayDate(habitDay)), key = habitKey(date, habitId, who), old = data.habitMarks[key];
  let now;
  if (h.kind === "prayers") {
    now = Array.isArray(old) ? [...old] : PRAYERS.map(() => 0);
    now[part] = now[part] ? 0 : 1;
    if (!now.some(Boolean)) now = undefined;
  } else if (h.kind === "water") {
    const n = old || 0;
    now = n === part + 1 ? part : part + 1;          // tap the last full drop again to take it back
    if (!now) now = undefined;
  } else now = old === true ? undefined : true;
  if (now === undefined) delete data.habitMarks[key]; else data.habitMarks[key] = now;
  const gained = habitValuePoints(now, date, h) - habitValuePoints(old, date, h);
  noteWhen(date, "hb", `${habitId}-${h.kind === "prayers" ? part : 0}`, who, gained > 0);   // (👀 Your kids' work today: when it was ticked)
  const wasStar = stars().includes(who);
  keepNow();   // habit ticks are kept right away, like activity ticks
  if (gained <= 0) return;
  const owner = userById(who), color = colorsOf(owner).color;
  const allDone = habitsFor(who).every(x => habitDone(x, data.habitMarks[habitKey(ymd(dayDate(habitDay)), x.id, who)]));
  const nowStar = !wasStar && stars().includes(who);
  const r = button.getBoundingClientRect();
  celebrate(r.left + r.width / 2, r.top + r.height / 2, color, allDone || nowStar);
  if (allDone) toast(`All good habits done, ${owner.name}! 🌟`, 3200, color);
  else if (nowStar) toast(`You're the Shining Star, ${owner.name}! 🌟`, 3200, color);
  else if (h.kind === "prayers") toast(`${h.emoji} Well done, ${owner.name}! +${gained} ⭐`, 2200, color);   // each prayer
  else if (habitDone(h, now)) toast(`${h.emoji} Well done, ${owner.name}! +${gained} ⭐`, 2200, color);
}

// (👨‍👩‍👧 The PARENTS' habits and prayers were removed: no card, picker, editor or points. Their old data stays saved in the cloud
//  untouched (data.parentHabits, the "ph-…" ticks in habitMarks, each parent's u.focus), only not shown or counted. Kids' habits are above.)

const givePrize = () => {};
const prizesListHtml = () => "";

// =====================================================================
//  🧩 RIDDLES OF THE DAY: 5 for each person (kids and parents), made by 🤖 once a day after 5:00 Dubai time
//   They only show as a pop-up "🧩 Riddle time!" when the app opens (one per open, see RIDDLE POP-UP).
//   data.points.riddles   = "date" → { by, at, list: [{ for: person id, kind, question, options (4), answer, hint, fun_fact }] }
//                           (each person's riddles in order, easier first; older days have one each)
//                           (or { making: who, at } while the first parent's device asks 🤖: the others wait)
//   data.points.riddleAns = "date|person" (the 1st riddle) or "date|person#n" (n = 1 … 4) → { tries, wrong: [option numbers], hint, solved, pts, ask: helper id }
//                           … + "|help" → { helper, right, pick, at }   (the helper's one answer)
//   🎈 Riddles are JUST FOR FUN: they give NO points (not to the score, the fair score, the leaderboard, reports or summaries).
//   (Older saved answers may still have a "pts" number: it's kept in the data, never counted.) Kept 5 weeks.
// =====================================================================
const RIDDLE_HOUR = 5, RIDDLE_TRIES = 2, RIDDLE_COUNT = 5;
let riddleBusy = false;   // this device is asking 🤖 for today's riddles
let riddleAsk = false;    // 🆘 the "Who can help?" chips are open
const riddleKey = (date, who, n = 0) => `${date}|${who}${n ? "#" + n : ""}`;
// "date|person#2|help" → { date, who, n, help }
const riddleKeyParts = key => { const [date, whoN, help] = key.split("|"), [who, n] = whoN.split("#"); return { date, who, n: Number(n) || 0, help: !!help }; };
// Dubai's date and hour now (the riddles' day starts at 5:00 Dubai time)
function dubaiNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const riddleDay = () => dubaiNow().date;
const todaysRiddles = () => { const r = data.points.riddles[riddleDay()]; return r && r.list ? r.list : []; };
const riddlesOf = (who, date = riddleDay()) => { const r = data.points.riddles[date]; return r && r.list ? r.list.filter(x => x.for === who) : []; };
const riddleOf = (who, n = 0) => riddlesOf(who)[n] || null;
const riddleState = (who, date = riddleDay(), n = 0) => data.points.riddleAns[riddleKey(date, who, n)] || { tries: 0, wrong: [], hint: false, solved: false, pts: 0, ask: "" };
const riddleHelp = (who, date = riddleDay(), n = 0) => data.points.riddleAns[riddleKey(date, who, n) + "|help"] || null;
// Finished: right, 2 wrong tries, or a helper got it right
const riddleDone = (who, date, n = 0) => { const s = riddleState(who, date, n), hp = riddleHelp(who, date, n); return s.solved || s.tries >= RIDDLE_TRIES || !!(hp && hp.right); };
const riddleWaiting = (who, n = 0) => { const s = riddleState(who, undefined, n); return !!s.ask && !riddleHelp(who, undefined, n) && !riddleDone(who, undefined, n); };
const riddleRight = (who, date, n = 0) => riddleState(who, date, n).solved || !!(riddleHelp(who, date, n) || {}).right;

// ---------- 🤖 Making today's riddles (the first family device after 5:00, a kid's too; never twice the same day) ----------
// 🧩 What /riddles gets about each person: ONLY name, role, age / year, curriculum, level and school subjects
// (never the calendar, activities, habits or anything private: the riddles are brain teasers, school knowledge and world facts)
// (🧩 kids only: parents never get riddles)
function riddleMembers() {
  return kidsList().map(u => {
    const parent = isParentId(u.id), s = schoolOf(u.id), bd = birthdayInfo(u.birthday);
    const levels = subjectList(s).map(f => { const x = s.profile.subjects[f.id]; return x && x.level ? `${f.name}: ${LEVEL_WORDS[x.level]}` : ""; }).filter(Boolean);
    return { name: u.name, role: parent ? "parent" : "kid", ...(!parent && bd && bd.age != null ? { age: bd.age } : {}),
             year: parent ? "adult" : gradeOf(u.id) || "primary school", ...(!parent && curriculumOf(u.id) ? { curriculum: curriculumOf(u.id) } : {}),
             level: parent ? "adult" : levels.join(", ") || "not known yet", subjects: parent ? [] : subjectList(s).map(f => f.name) };
  });
}
// The last 60 questions (so nothing repeats)
const recentRiddles = () => Object.keys(data.points.riddles).sort().flatMap(k => (data.points.riddles[k].list || []).map(r => r.question)).slice(-60);
async function maybeMakeRiddles() {
  const { date, hour } = dubaiNow(), day = data.points.riddles[date];
  // (a kid's phone: 👨‍👩‍👧 a parent's device never makes, shows or pops up riddles)
  if (!feat("riddles") || isParentDevice() || riddleBusy || hour < RIDDLE_HOUR || !cloud.ready || !aiReady() || aiWait || !kidsList().length) return;
  if (day && (day.list || Date.now() - Date.parse(day.at) < 30 * 60000)) return;   // made, or another device is making them
  riddleBusy = true;
  data.points.riddles[date] = { making: me || "", at: new Date().toISOString() };
  writeData("auto");
  try {
    const r = await callAi("riddles", { today: date, count: RIDDLE_COUNT, members: riddleMembers(), recent: recentRiddles() }, "riddles", true);   // (auto)
    const all = (r && Array.isArray(r.riddles) ? r.riddles : []).map(cleanRiddle).filter(Boolean);
    const list = all.filter((x, i) => all.slice(0, i).filter(y => y.for === x.for).length < RIDDLE_COUNT);   // (up to 5 each)
    if (!list.length) return;
    data.points.riddles[date] = { by: me || "", at: new Date().toISOString(), list };
    writeData("auto");
    render();
  } finally { riddleBusy = false; }
}
// One riddle from 🤖 → { for: person id, … } (null when it's not usable: 4 options, the answer one of them)
function cleanRiddle(x) {
  if (!x || typeof x !== "object") return null;
  const name = String(x.for || "").trim().toLowerCase(), u = data.users.find(p => p.name.toLowerCase() === name);
  const options = Array.isArray(x.options) ? x.options.map(o => String(o).trim().slice(0, 120)).filter(Boolean).slice(0, 4) : [];
  const answer = String(x.answer || "").trim().slice(0, 120), question = String(x.question || "").trim().slice(0, 400);
  if (!u || !question || options.length !== 4 || !options.includes(answer)) return null;
  return { for: u.id, kind: String(x.kind || "riddle").slice(0, 20), question, options, answer,
           hint: String(x.hint || "").trim().slice(0, 300), fun_fact: String(x.fun_fact || "").trim().slice(0, 300) };
}

// ---------- 🧩 RIDDLE POP-UP: "🧩 Riddle time!" when the app opens (nothing about riddles stays on the screen) ----------
// An "open" = the app starts, or comes back after 30+ minutes away. Each open shows: the riddles someone asked me to help with,
// then my next riddle (one per open). "Later" closes it: it comes back on the next open.
// It waits while the 👋 tour, ✨ setup, 🎉 level up, another box, a 📝 worksheet or the login screen is showing.
const RIDDLE_AWAY = 30 * 60000, RIDDLE_SHOW = 3000;
let riddleOpen = true;   // this open hasn't shown its riddle yet
let rdPop = null;        // the pop-up: { queue: [{ kind: "own" | "help", who, n }], at, result, timer }
let rdRetry = null, rdHiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { rdHiddenAt = Date.now(); return; }
  if (rdHiddenAt && Date.now() - rdHiddenAt >= RIDDLE_AWAY) { riddleOpen = true; maybeRiddlePop(); }
});
// The riddles waiting for me: 🤝 others' I was asked to help with, then my own next one (not done, not waiting for a helper)
function riddleQueue() {
  const helps = data.users.filter(u => u.id !== me).flatMap(u => riddlesOf(u.id).map((r, n) => ({ kind: "help", who: u.id, n })))
    .filter(x => riddleState(x.who, undefined, x.n).ask === me && riddleWaiting(x.who, x.n));
  const mine = riddlesOf(me).findIndex((r, n) => !riddleDone(me, undefined, n) && !riddleWaiting(me, n));
  return [...helps, ...(mine >= 0 ? [{ kind: "own", who: me, n: mine }] : [])];
}
function riddlePopCanShow() {
  return feat("riddles") && exists(me) && !["start", "setup"].includes(screen) && $("loginScreen").hidden
    && !document.querySelector(".tour, .lvl-up, .k-modal:not([hidden])") && !(screen === "school" && schoolView === "worksheet");
}
function maybeRiddlePop() {
  if (!riddleOpen || rdPop || !feat("riddles") || !exists(me) || isParentDevice() || isParentId(me)) return;   // (🧩 kids only)
  if (!riddlePopCanShow()) { if (!rdRetry) rdRetry = setTimeout(() => { rdRetry = null; maybeRiddlePop(); }, 1500); return; }
  const queue = riddleQueue();
  if (!queue.length) { if (riddlesOf(me).length) riddleOpen = false; return; }   // (none made yet: wait for them)
  riddleOpen = false;
  riddleAsk = false;
  rdPop = { queue, at: 0, result: false, timer: null };
  $("riddleModal").hidden = false;
  drawRiddlePop();
}
function closeRiddlePop() {
  if (!rdPop) return;
  clearTimeout(rdPop.timer);
  rdPop = null;
  riddleAsk = false;
  $("riddleModal").hidden = true;
}
// After an answer: the next one in this open's queue (🤝 helps first), or close
function nextRiddlePop() {
  if (!rdPop) return;
  clearTimeout(rdPop.timer);
  const was = rdPop.queue[rdPop.at];
  rdPop.at++;
  rdPop.result = false;
  riddleAsk = false;
  // (my own riddle: the next one waits for the next open; 🤝 a help: go on to the next waiting one)
  while (rdPop.at < rdPop.queue.length) {
    const x = rdPop.queue[rdPop.at];
    if (was.kind === "help" && (x.kind === "own" ? !riddleDone(me, undefined, x.n) && !riddleWaiting(me, x.n) : riddleWaiting(x.who, x.n))) return drawRiddlePop();
    rdPop.at++;
  }
  closeRiddlePop();
}
// Answered (right, 2 wrong tries, or 🤝 helped): the answer and the fun fact for 3 seconds, then it closes
function showRiddleResult() {
  rdPop.result = true;
  drawRiddlePop();
  clearTimeout(rdPop.timer);
  rdPop.timer = setTimeout(nextRiddlePop, RIDDLE_SHOW);
}
function riddleOptionsHtml(r, attr, opts) {
  return `<div class="rd-opts">${r.options.map((o, i) => {
    const right = opts.show && o === r.answer, wrong = opts.wrong.includes(i);
    return `<button class="rd-opt ${right ? "right" : ""} ${wrong ? "wrong" : ""}" data-${attr}="${i}" ${opts.lock || wrong ? "disabled" : ""}>${right ? "✅ " : wrong ? "❌ " : ""}${safe(o)}</button>`;
  }).join("")}</div>`;
}
function drawRiddlePop() {
  if (!rdPop) return;
  const x = rdPop.queue[rdPop.at];
  const r = x && (x.kind === "own" ? riddleOf(me, x.n) : riddleOf(x.who, x.n));
  if (!r || !exists(x.who)) return nextRiddlePop();
  const c = colorsOf(userById(me)), body = $("riddleBody");
  body.style.cssText = `--c:${c.color};--soft:${c.soft};--ink:${c.ink}`;
  body.innerHTML = `<div class="print-title">🧩 Riddle time!</div>` + (x.kind === "own" ? ownRiddlePopHtml(x.n, r) : helpRiddlePopHtml(x.who, x.n, r));
  const first = body.querySelector("[data-rdgotit], .rd-opt:not([disabled])");
  if (first && !body.contains(document.activeElement)) first.focus();
}
function ownRiddlePopHtml(n, r) {
  const who = me, s = riddleState(who, undefined, n), hp = riddleHelp(who, undefined, n), done = riddleDone(who, undefined, n), total = riddlesOf(who).length;
  const helper = s.ask && exists(s.ask) ? userById(s.ask).name : "";
  const top = `<p class="print-hint rd-num">Riddle ${n + 1} of ${total}</p><p class="rd-q">${safe(r.question)}</p>`;
  if (rdPop.result || done) {
    const note = hp && hp.right ? `<p class="rd-yes">${safe(helper)} helped you! 🤝</p>`
      : s.solved ? `<p class="rd-yes">🎉 Right! 🎈</p>` : `<p class="rd-no">The answer was: <b>${safe(r.answer)}</b></p>`;
    return `${top}${riddleOptionsHtml(r, "rdpick", { show: true, wrong: s.wrong, lock: true })}${note}
      ${r.fun_fact ? `<p class="rd-fact">🤓 ${safe(r.fun_fact)}</p>` : ""}<button class="k-ok rd-gotit" data-rdgotit>Got it 👍</button>`;
  }
  let note = "";
  if (hp && !hp.right) note = `<p class="rd-no">${safe(helper)}'s answer wasn't right. Try again!</p>`;
  else if (s.tries) note = `<p class="rd-no">Try again! (${RIDDLE_TRIES - s.tries} try left)</p>`;
  const others = kidsList().filter(u => u.id !== who);   // (🧩 helpers: the other kids; parents don't get riddles any more)
  const tools = `<div class="rd-tools">${s.hint ? "" : `<button data-rdhint>💡 Hint</button>`}${s.ask || !others.length ? "" : `<button data-rdask>🆘 Ask for help</button>`}</div>
    ${riddleAsk && !s.ask ? `<div class="rd-ask"><b>Who can help?</b><div class="rd-who">${others.map(u => `<button class="chip" data-rdhelpask="${safe(u.id)}"
      style="--soft:${colorsOf(u).soft};--ink:${colorsOf(u).ink}"><span class="e">${safe(u.emoji)}</span>${safe(u.name)}</button>`).join("")}</div></div>` : ""}`;
  return `${top}${riddleOptionsHtml(r, "rdpick", { show: false, wrong: s.wrong, lock: false })}
    ${s.hint ? `<p class="rd-hint">💡 ${safe(r.hint)}</p>` : ""}${note}${tools}
    <button class="linkbtn rd-later" data-rdlater>Later</button>`;
}
function helpRiddlePopHtml(asker, n, r) {
  const hp = riddleHelp(asker, undefined, n), name = userById(asker).name;
  const top = `<p class="print-hint rd-num">🤝 ${safe(name)} asked you for help!</p><p class="rd-q">${safe(r.question)}</p>`;
  if (rdPop.result && hp) return `${top}<p class="${hp.right ? "rd-yes" : "rd-no"}">${hp.right ? `🎉 Right! 🎈` : `Not this time. ${safe(name)} can try again.`}</p>
    ${hp.right && r.fun_fact ? `<p class="rd-fact">🤓 ${safe(r.fun_fact)}</p>` : ""}<button class="k-ok rd-gotit" data-rdgotit>Got it 👍</button>`;
  return `${top}${riddleOptionsHtml(r, "rdhelp", { show: false, wrong: [], lock: false })}<button class="linkbtn rd-later" data-rdlater>Later</button>`;
}

// ---------- 🧩 Answering (in the pop-up) ----------
function saveRiddleState(who, s, n = 0) { data.points.riddleAns[riddleKey(riddleDay(), who, n)] = s; }
function shakeButton(sel) {
  requestAnimationFrame(() => { const b = document.querySelector(sel); if (b) { b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); } });
}
const popN = kind => rdPop && rdPop.queue[rdPop.at] && rdPop.queue[rdPop.at].kind === kind ? rdPop.queue[rdPop.at] : null;
function pickRiddle(i, button) {
  const x = popN("own"), who = me;
  if (!x || rdPop.result) return;
  const n = x.n, r = riddleOf(who, n);
  if (!r || riddleDone(who, undefined, n) || riddleWaiting(who, n)) return;
  if (newWeek()) keepNow();
  const s = { ...riddleState(who, undefined, n), wrong: [...riddleState(who, undefined, n).wrong] }, color = colorsOf(userById(who)).color;
  if (r.options[i] === r.answer) {
    s.solved = true;
    s.pts = 0;   // (🎈 just for fun: no points)
    saveRiddleState(who, s, n);
    noteWhen(riddleDay(), "rd", String(n), who, true);   // (👀 when it was solved)
    keepNow();
    const rect = button.getBoundingClientRect();
    celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2, color, true);
    toast("🧩 Right! 🎈", 3000, color);
    return riddleAnswered();
  }
  s.tries++;
  s.wrong.push(i);
  saveRiddleState(who, s, n);
  riddleAsk = false;
  keepNow();
  if (s.tries >= RIDDLE_TRIES) return riddleAnswered();
  shakeButton(`#riddleModal [data-rdpick="${i}"]`);
  toast("Try again! 💪", 2000);
}
// My riddle is finished: show the answer for 3 seconds; the last one of the day → a small toast
function riddleAnswered() {
  showRiddleResult();
  const all = riddlesOf(me);
  if (all.length && all.every((r, n) => riddleDone(me, undefined, n))) setTimeout(() => toast("🌟 You solved all today's riddles! Come back tomorrow.", 3500), RIDDLE_SHOW);
}
function riddleHint() {
  const x = popN("own");
  if (!x || riddleDone(me, undefined, x.n)) return;
  saveRiddleState(me, { ...riddleState(me, undefined, x.n), hint: true }, x.n);
  keepNow();
}
// 🆘 Ask someone: they get a 🔔 and the riddle pops up on their next open
function askRiddleHelp(helper) {
  const x = popN("own");
  if (!x) return;
  const n = x.n, r = riddleOf(me, n), s = riddleState(me, undefined, n);
  if (!r || riddleDone(me, undefined, n) || s.ask || !exists(helper) || helper === me) return;
  saveRiddleState(me, { ...s, ask: helper }, n);
  riddleAsk = false;
  closeRiddlePop();
  keepNow();
  addNews([newsItem("school", `🧩 ${userById(me).name} needs help with a riddle! (asked ${userById(helper).name})`, "🧩 needs help with a riddle", me)]);
  toast(`🆘 Asked ${userById(helper).name}! ⏳`, 3000);
}
// 🤝 The helper's one answer (🎈 just for fun: no points)
function helpRiddle(i, button) {
  const x = popN("help");
  if (!x || rdPop.result) return;
  const asker = x.who, n = x.n, r = riddleOf(asker, n);
  if (!r || riddleState(asker, undefined, n).ask !== me || riddleHelp(asker, undefined, n) || riddleDone(asker, undefined, n)) return;
  if (newWeek()) keepNow();
  const right = r.options[i] === r.answer;
  data.points.riddleAns[riddleKey(riddleDay(), asker, n) + "|help"] = { helper: me, right, pick: i, at: new Date().toISOString() };
  keepNow();
  const name = userById(asker).name;
  addNews([newsItem("school", right ? `🤝 helped ${name} with a riddle! 🧩` : `tried to help ${name} with a riddle 🧩`, "🧩 riddle help", me)]);
  showRiddleResult();
  if (!right) return;
  const rect = button.getBoundingClientRect();
  celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2, colorsOf(userById(me)).color, true);
  toast(`🤝 Right! You helped ${name} 🎈`, 3200);
}

// ---------- 🧩 Family riddle board (under the leaderboard) ----------
function riddleBoardHtml() {
  if (!feat("riddles")) return "";
  const list = todaysRiddles(), parent = isParentId(me) && !isKidDevice();
  if (!list.length) return "";   // (🎈 just today's fun: no weekly tally, riddles aren't points)
  // One row per person: a mark for each of today's riddles (✅ right · ❌ not · ⏳ to do)
  const rows = data.users.filter(u => list.some(r => r.for === u.id)).map(u => {
    const mine = riddlesOf(u.id);
    const marks = mine.map((r, n) => riddleRight(u.id, undefined, n) ? "✅" : riddleDone(u.id, undefined, n) ? "❌" : "⏳").join("");
    const helped = mine.map((r, n) => { const s = riddleState(u.id, undefined, n), hp = riddleHelp(u.id, undefined, n);
      return hp && exists(hp.helper) ? `🤝 ${hp.right ? "helped by" : "asked"} ${userById(hp.helper).name}` : s.ask && exists(s.ask) ? `🆘 asked ${userById(s.ask).name}` : ""; }).filter(Boolean);
    return `<li><span class="rd-b-who">${safe(u.emoji)} ${safe(u.name)}</span><span class="rd-b-mark">${marks}</span>
      ${[...new Set(helped)].map(t => `<small>${safe(t)}</small>`).join("")}${parent ? mine.map(r => `<small class="rd-b-q">${safe(r.question)}</small>`).join("") : ""}</li>`;
  }).join("");
  return `<div class="card rd-board"><h2>🧩 Family riddle board <small>· just for fun 🎈</small></h2>
    ${rows ? `<h3 class="ph-group">Today</h3><ul class="rd-b-list">${rows}</ul>` : ""}</div>`;
}

// =====================================================================
//  📔 MY DAY: a mood + 4 short lines, once a day (+5 the first save). Everyone has one.
//   Parents see each kid's mood, and the text unless the kid ticked 🔒 Just for me.
//   A parent's own days: only that parent. Kids never see anyone else's.
//   (The data: data.points.diary, see emptyData.)
// =====================================================================
const DIARY_POINTS = 5, DIARY_DAYS = 14;
const DIARY_LINES = [["best", "✨", "The best thing today"], ["bad", "🌧️", "Something bad today"], ["hard", "💪", "Something that challenged me"],
                     ["scared", "😨", "Something that scared me"]];
let diaryWho = null;    // whose days are showing (a parent can look at a kid's)
let diaryDay = null;    // the day being read ("2026-10-21"), or null = today's form
let diaryMood = null;   // the face tapped (before 💾 Save)
const diaryOf = (who, date) => data.points.diary[`${date}|${who}`] || null;
const moodFace = key => (MOODS.find(m => m[0] === key) || [])[1] || "";
const moodWord = key => (MOODS.find(m => m[0] === key) || [])[2] || "";
const isParentViewer = () => isParentId(me) && !isKidDevice();
// 🔒 On a kid's device a kid only opens their own things (School, My day, habits, duties, buddy page …): someone else's → "🔒 This belongs to Bana"
const kidLockedOut = who => isKidDevice() && !!who && who !== me;
function lockedToast(who) { toast(`🔒 This belongs to ${exists(who) ? userById(who).name : "someone else"}`, 2600); }
// May the person using the app see this person's mood / text?
const canSeeMood = who => who === me || (isParentViewer() && !isParentId(who));
const canReadDiary = (who, e) => who === me || (isParentViewer() && !isParentId(who) && !(e && e.private));
function diaryPoints(user, from, to) {
  return Object.entries(data.points.diary).filter(([key, e]) => { const [date, who] = key.split("|"); return who === user && e.pts && date >= from && date < to; }).length * DIARY_POINTS;
}
function openDiary(who) {
  if (!feat("diary")) return go("home");
  if (kidLockedOut(who)) return lockedToast(who);
  diaryWho = who && canSeeMood(who) ? who : me;
  diaryDay = null;
  const e = diaryOf(diaryWho, todayYmd());
  diaryMood = e ? e.mood : null;
  go("diary");
}
function drawDiary() {
  if (!diaryWho || !exists(diaryWho) || !canSeeMood(diaryWho)) diaryWho = me;
  const who = diaryWho, mine = who === me, u = userById(who), today = todayYmd();
  $("diaryTitle").textContent = mine ? "📔 My day" : `📔 ${u.emoji} ${u.name}'s days`;
  // 👨‍👩‍👧 A parent: chips to look at a kid's days
  const kids = isParentViewer() ? kidsList() : [];
  const chips = kids.length ? `<div class="chips dy-who">${[userById(me), ...kids].map(x => { const c = colorsOf(x); return `<button class="chip ${x.id === who ? "on" : ""}"
    data-dywho="${safe(x.id)}" style="--soft:${c.soft};--ink:${c.ink}"><span class="e">${safe(x.emoji)}</span>${x.id === me ? "Me" : safe(x.name)}</button>`; }).join("")}</div>` : "";
  // 📅 the last 14 days, with the mood on each
  const strip = Array.from({ length: DIARY_DAYS }, (_, i) => { const dt = new Date(); dt.setDate(dt.getDate() - (DIARY_DAYS - 1 - i)); return ymd(dt); }).map(date => {
    const e = diaryOf(who, date), on = (diaryDay || today) === date;
    return `<button class="dy-day ${on ? "on" : ""}" data-dyday="${date}" aria-label="${safe(shortDate(date))}${e ? ": " + moodWord(e.mood) : ""}">
      <small>${SHORT[(fromYmd(date).getDay() + 6) % 7]}</small><span class="e">${e ? moodFace(e.mood) : "·"}</span><small>${fromYmd(date).getDate()}</small></button>`;
  }).join("");
  const date = diaryDay || today, e = diaryOf(who, date);
  let body;
  if (mine && date === today) body = diaryFormHtml(e);
  else if (!e) body = `<div class="card"><p class="sc-empty">Nothing written on ${safe(shortDate(date))}.</p></div>`;
  else body = `<div class="card dy-read"><h2>${moodFace(e.mood)} ${safe(moodWord(e.mood))} · ${safe(shortDate(date))}</h2>${canReadDiary(who, e)
    ? DIARY_LINES.filter(([k]) => e[k]).map(([k, emoji, label]) => `<p><b>${emoji} ${label}</b><br>${safe(e[k])}</p>`).join("") || `<p class="sc-empty">Only the mood today.</p>`
    : `<p class="sc-empty">🔒 Just for ${safe(u.name)}.</p>`}</div>`;
  $("diaryBody").innerHTML = `${chips}<div class="card dy-strip-card"><h2>📅 ${mine ? "My days" : `${safe(u.name)}'s days`}</h2><div class="dy-strip">${strip}</div></div>${body}`;
}
// 📝 What's typed in 📔 My day is kept as it's typed (this device), so a tap by mistake or a screen refresh never loses it.
// (cleared when it's saved; only today's, only this person's)
const DY_DRAFT_KEY = SAVE_KEY + ".diaryDraft";
function diaryDraft() {
  try { const d = JSON.parse(localStorage.getItem(DY_DRAFT_KEY) || "null"); return d && d.who === me && d.date === todayYmd() ? d : null; } catch (e) { return null; }
}
function keepDiaryDraft() {
  const d = { who: me, date: todayYmd(), lines: {} };
  DIARY_LINES.forEach(([k]) => { const el = $("dy-" + k); if (el) d.lines[k] = el.value.slice(0, 120); });
  if ($("dyPrivate")) d.private = $("dyPrivate").checked;
  try { localStorage.setItem(DY_DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
}
const dropDiaryDraft = () => { try { localStorage.removeItem(DY_DRAFT_KEY); } catch (e) {} };
document.addEventListener("input", e => { if (e.target && e.target.closest && e.target.closest(".dy-form")) keepDiaryDraft(); });
document.addEventListener("change", e => { if (e.target && e.target.id === "dyPrivate") keepDiaryDraft(); });
function diaryFormHtml(e) {
  const mood = diaryMood || (e && e.mood), parent = isParentId(me), dr = diaryDraft();
  const val = k => dr && dr.lines[k] != null ? dr.lines[k] : (e && e[k]) || "", priv = dr && dr.private != null ? dr.private : !!(e && e.private);
  return `<div class="card sc-form dy-form"><h2>How do you feel today?</h2>
    <div class="dy-moods" role="radiogroup" aria-label="My mood">${MOODS.map(([k, face, word]) => `<button class="dy-mood ${mood === k ? "on" : ""}" data-dymood="${k}"
      role="radio" aria-checked="${mood === k}"><span class="e">${face}</span><small>${word}</small></button>`).join("")}</div>
    <p class="hint">All optional, one line each. 🎤 Tip: tap the mic on your keyboard to talk instead of typing.</p>
    ${DIARY_LINES.map(([k, emoji, label]) => `<label class="small" for="dy-${k}">${emoji} ${label}</label>
      <input type="text" id="dy-${k}" maxlength="120" value="${safe(val(k))}" placeholder="🎤 ${label}…">`).join("")}
    ${parent ? `<p class="hint">🔒 Your days are just for you.</p>` : `<label class="checkline"><input type="checkbox" id="dyPrivate" ${priv ? "checked" : ""}> 🔒 Just for me (your parents still see the face)</label>`}
    <div class="err" id="dyErr"></div>
    <div class="btnrow"><button class="primary" data-dysave>💾 Save${e && e.pts ? "" : ` (+${DIARY_POINTS} ⭐)`}</button></div></div>`;
}
function saveDiary(button) {
  const today = todayYmd(), key = `${today}|${me}`, old = data.points.diary[key];
  const mood = diaryMood || (old && old.mood);
  if (!mood) return $("dyErr").textContent = "Tap a face first. 🙂";
  if (newWeek()) keepNow();
  const line = k => $("dy-" + k).value.trim().slice(0, 120);
  data.points.diary[key] = { mood, best: line("best"), bad: line("bad"), hard: line("hard"), scared: line("scared"),
                             private: !!($("dyPrivate") && $("dyPrivate").checked), pts: DIARY_POINTS, at: new Date().toISOString() };
  // 💛 A kid feeling sad / angry / scared: a gentle 🔔 to the parents (once for that mood today)
  const u = userById(me);
  if (!isParentId(me) && HARD_MOODS.includes(mood) && (!old || old.mood !== mood))
    addNews([newsItem("school", `${u.name} is feeling ${moodWord(mood).toLowerCase()} today 💛`, `${moodFace(mood)} feeling ${moodWord(mood).toLowerCase()}`, me)]);
  keepNow();
  dropDiaryDraft();   // (saved: the typed copy isn't needed any more)
  const r = button.getBoundingClientRect();
  celebrate(r.left + r.width / 2, r.top + r.height / 2, colorsOf(u).color, false);
  toast(old && old.pts ? "📔 Saved!" : `📔 Saved! +${DIARY_POINTS} ⭐`, 2400, colorsOf(u).color);
}

// =====================================================================
//  ✅ DUTIES ON TIME: every evening (after 6 pm Dubai time) a parent says how each kid did today
//   data.points.duties = "date|kid" → { v: "yes" | "partly" | "no", by, at }  (the first parent counts). Kept 5 weeks.
// =====================================================================
const DUTY_HOUR = 18;
const DUTY = { yes: ["👍", "Yes", 10, "duties on time!"], partly: ["🤏", "Partly", 5, "duties partly done"], no: ["👎", "Not today", 0, "not today"] };
const dutyOf = (kid, date = todayYmd()) => data.points.duties[`${date}|${kid}`] || null;
function dutyPoints(user, from, to) {
  return Object.entries(data.points.duties).reduce((sum, [key, x]) => { const [date, kid] = key.split("|"); return sum + (kid === user && date >= from && date < to ? DUTY[x.v][2] : 0); }, 0);
}
// (👧 the Kid page: one kid's row)
function dutyRowsCardHtml(kids, title) {
  if (!isParentViewer() || dubaiNow().hour < DUTY_HOUR || !kids.length) return "";
  return `<div class="card du-card"><h2>${title}</h2>${kids.map(k => {
    const x = dutyOf(k.id), c = colorsOf(k);
    return `<div class="du-row" style="--soft:${c.soft};--ink:${c.ink}"><span class="du-kid">${safe(k.emoji)} ${safe(k.name)}</span>${x
      ? `<span class="du-done">${DUTY[x.v][0]} ${DUTY[x.v][1]}${DUTY[x.v][2] ? ` · +${DUTY[x.v][2]} ⭐` : ""}<small>${x.by !== me && exists(x.by) ? ` (${safe(userById(x.by).name)})` : ""}</small></span>`
      : `<span class="du-btns">${Object.entries(DUTY).map(([v, [e, label, pts]]) => `<button data-duty="${safe(k.id)}|${v}">${e} ${label}${pts ? ` <small>+${pts}</small>` : ""}</button>`).join("")}</span>`}</div>`;
  }).join("")}</div>`;
}
function setDuty(kid, v) {
  if (!isParentViewer() || !exists(kid) || isParentId(kid) || !DUTY[v]) return;
  if (dutyOf(kid)) return toast("Already answered today. 🙂");   // (the first parent counts)
  if (newWeek()) keepNow();
  data.points.duties[`${todayYmd()}|${kid}`] = { v, by: me, at: new Date().toISOString() };
  keepNow();
  toast(`${DUTY[v][0]} ${userById(kid).name}: ${DUTY[v][1]}${DUTY[v][2] ? ` +${DUTY[v][2]} ⭐` : ""}`, 2400, colorsOf(userById(kid)).color);
}

// =====================================================================
//  💌 WISHES: every Friday (until Sunday) each kid answers 2 questions (+5 once a week)
//   data.points.wishes = "monday|kid" → { me, sib, at, done: { me: true?, sib: true? } }. Kept about 6 months.
//   Parents see them in "💌 Kids' wishes" and tap ❤️ We did it! → a 🔔 to the kid. Kids see only their own.
// =====================================================================
const WISH_POINTS = 5, WISH_DAY = 4;   // Friday (0 = Monday)
const wishKey = (kid, week = data.points.week) => `${week}|${kid}`;
function wishPoints(user, from, to) {
  return Object.entries(data.points.wishes).filter(([key, w]) => { const [week, kid] = key.split("|"); return kid === user && w.at && week >= from && week < to; }).length * WISH_POINTS;
}
const siblingsText = kid => { const names = kidsList().filter(k => k.id !== kid).map(k => k.name); return names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]; };
let wishEdit = false;   // ✏️ the kid is changing this week's answers
function saveWish(button) {
  if (isParentId(me) || todayIndex() < WISH_DAY) return;
  const mine = $("wiMe").value.trim().slice(0, 120), sib = $("wiSib") ? $("wiSib").value.trim().slice(0, 120) : "";
  if (!mine && !sib) return $("wiErr").textContent = "Write a wish first. 🙂";
  if (newWeek()) keepNow();
  const key = wishKey(me), old = data.points.wishes[key];
  data.points.wishes[key] = { me: mine, sib, at: (old && old.at) || new Date().toISOString(), done: old ? old.done : {} };
  wishEdit = false;
  keepNow();
  const r = button.getBoundingClientRect();
  celebrate(r.left + r.width / 2, r.top + r.height / 2, colorsOf(userById(me)).color, false);
  toast(old ? "💌 Changed!" : `💌 Sent! +${WISH_POINTS} ⭐`, 2400);
}
// 👨‍👩‍👧 "💌 Kids' wishes" on a parent's home: the last 4 weeks, newest first
// (only = one kid's: 👧 the Kid page)
function wishesListHtml(only) {
  if (!feat("wishes") || !isParentViewer()) return "";
  const from = (() => { const dt = fromYmd(data.points.week); dt.setDate(dt.getDate() - 21); return ymd(dt); })();
  const list = Object.entries(data.points.wishes).filter(([key]) => key.slice(0, 10) >= from && exists(key.split("|")[1]) && (!only || key.split("|")[1] === only)).sort((a, b) => b[0].localeCompare(a[0]));
  if (!list.length) return "";
  return `<div class="card wi-list"><h2>💌 Kids' wishes</h2><ul class="list">${list.flatMap(([key, w]) => {
    const kid = key.split("|")[1], u = userById(kid);
    return [["me", "💭", "for me"], ["sib", "🤝", `for ${siblingsText(kid) || "the others"}`]].filter(([k]) => w[k]).map(([k, e, forWho]) => `<li>
      <span class="what"><b>${safe(u.emoji)} ${safe(u.name)}</b> ${e} <small>${safe(forWho)} · ${weekLabel(key.slice(0, 10))}</small><br>${safe(w[k])}</span>
      ${w.done && w.done[k] ? `<span class="wi-done">❤️ Done</span>` : `<button data-wishdid="${safe(key)}|${k}">❤️ We did it!</button>`}</li>`);
  }).join("")}</ul></div>`;
}
function wishDone(key, k) {
  const w = data.points.wishes[key];
  if (!isParentViewer() || !w || !w[k]) return;
  w.done = { ...(w.done || {}), [k]: true };
  keepNow();
  const kid = key.split("|")[1];
  addNews([newsItem("school", `❤️ Mum and Dad did ${userById(kid).name}'s wish!`, "❤️ did a wish", me)]);
  toast("❤️ Wonderful!", 2200);
}

// =====================================================================
//  🌱 GROWING LEVEL: each person's buddy grows with ALL their points (never resets)
//   Level 1 at 0, then +100 more each level: 100, 300, 600, 1000 … (level n starts at 50·n·(n−1))
// =====================================================================
let buHist = null;   // 👨‍👩‍👧 the kid whose level history is open on the leaderboard
const levelStart = n => 50 * n * (n - 1);
const levelOf = p => { let n = 1; while (levelStart(n + 1) <= p) n++; return n; };
const levelPct = p => { const n = levelOf(p); return Math.floor((p - levelStart(n)) / (levelStart(n + 1) - levelStart(n)) * 100); };
// All points: the banked weeks + this week
function lifetimePoints(id) {
  if (isParentId(id)) return 0;   // (👨‍👩‍👧 parents aren't scored: their older banked points stay in the data, unshown)
  let total = pointsByUser()[id] || 0;
  Object.entries(data.points.lifetime).forEach(([key, n]) => { if (key.split("|")[1] === id && key.split("|")[0] !== data.points.week) total += n; });
  return total;
}
function buddyFace(id, level) {
  const b = BUDDIES[(userById(id) || {}).buddy];
  return b ? b.stages[Math.min(Math.floor((level - 1) / 3), b.stages.length - 1)] : "🥚";
}
function buddyRingSvg(pct) {
  const C = 2 * Math.PI * 44;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="bu-trk"/>
    <circle cx="50" cy="50" r="44" class="bu-bar" style="stroke-dasharray:${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>`;
}
// The home card: pick a buddy (the first time), or the ring with "Lv 4" and "68% to Lv 5"
function buddyCardHtml(who) {
  if (who !== me || !hasSpark(who)) return "";   // (✨ kids only)
  const u = userById(who), c = colorsOf(u);
  if (!u.buddy) return `<div class="card bu-card" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}"><h2>✨ Pick your Spark!</h2>
    <p class="hint">It grows with all your points, forever. (You pick only once.)</p>
    ${sparkPickHtml(who)}</div>`;
  const p = lifetimePoints(who), L = levelOf(p), pct = levelPct(p);
  return `<div class="card bu-card" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
    <div class="bu-ring bu-big" role="img" aria-label="Level ${L}, ${pct}% to level ${L + 1}">${buddyRingSvg(pct)}
      <span class="bu-in"><span class="e">${buddyFace(who, L)}</span><b>Lv ${L}</b></span></div>
    <div class="bu-text"><b>${pct}% to Lv ${L + 1}</b><small>⭐ ${p} points in all · ${safe(sparkName(u))} is growing!</small></div></div>`;
}
// ✨ The pick cards: the first stage big, its 4 stages small, "grows into …" the last one
function sparkPickHtml(who) {
  const u = userById(who);
  return `<div class="bu-pick">${Object.entries(BUDDIES).map(([k, b]) => `<button class="sp-card" data-bupick="${k}" data-buwho="${safe(who)}" ${u && u.buddy === k ? `aria-current="true"` : ""}
    aria-label="${safe(`${b.first}, grows into ${b.last}`)}"><span class="e sp-first">${b.stages[0]}</span><b>${safe(b.first)}</b>
    <span class="sp-stages" aria-hidden="true">${b.stages.join(" → ")}</span>
    <small>grows into ${b.stages[b.stages.length - 1]} ${safe(b.last)}</small></button>`).join("")}</div>`;
}
// ✨ The Spark's own name (picked once right after the Spark; changeable in 👤 My profile), or "your Spark"
const sparkName = (u, cap) => u && u.sparkName ? u.sparkName : cap ? "Your Spark" : "your Spark";
// Small, next to the name on the leaderboard (a parent taps a kid's to see the level history)
function buddyMiniHtml(id) {
  if (!hasSpark(id)) return "";   // (✨ kids only)
  const p = lifetimePoints(id), L = levelOf(p), pct = levelPct(p), tap = isParentViewer() && !isParentId(id);
  // The ring and "Lv 2" side by side on the name's line (never on top of other text)
  const inner = `<span class="bu-ring bu-mini" aria-hidden="true">${buddyRingSvg(pct)}<span class="bu-in"><span class="e">${buddyFace(id, L)}</span></span></span><b class="bu-lv">✨ Spark Lv ${L}</b>`;
  const label = `Level ${L}, ${pct}% to level ${L + 1}`;
  return tap ? `<button class="bu-minirow" data-buhist="${safe(id)}" aria-label="${label}. Level history" title="${label}">${inner}</button>`
    : `<span class="bu-minirow" role="img" aria-label="${label}" title="${label}">${inner}</span>`;
}
function levelHistoryHtml(id) {
  const list = (data.points.levels[id] || []).slice().reverse();
  return `<div class="bu-hist"><b>🌱 Level history</b>${list.length ? `<ul>${list.map(x => `<li>Lv ${x.level} · ${safe(shortDate(x.date))}</li>`).join("")}</ul>` : `<p class="sc-empty">No levels yet.</p>`}</div>`;
}
// 🌱 Each person picks their buddy ONE time (saved on the person: u.buddy + u.buddyAt, in the family's plan).
// After that only a parent can change it (the buddy page → "Change buddy"). Level and points never change.
// (✨ each person changes their own Spark any time, from ⚙️ My settings; a parent any kid's. The level and points stay.)
const canChangeBuddy = (who = me) => who === me || (!isKidDevice() && (isParentId(me) || cloud.role === "parent") && !isParentId(who));
function pickBuddy(key, who = me) {
  const u = data.users.find(x => x.id === who);
  if (!u || !hasOwn(BUDDIES, key)) return;
  if (u.buddy && !canChangeBuddy(who)) return toast("✨ Only they (or a parent) can change this Spark.");
  const first = !u.buddy;
  u.buddy = key;
  u.buddyAt = new Date().toISOString();
  buChange = false;
  keepNow();
  if (!$("buddyModal").hidden) drawBuddyBox();
  toast(first ? `✨ Say hi to your Spark! ${BUDDIES[key].stages[0]}` : `✨ ${u.name}'s new Spark: ${buddyFace(u.id, levelOf(lifetimePoints(u.id)))}`, 2600, colorsOf(u).color);
  if (first && who === me && !u.sparkName) setTimeout(() => askSparkName(who), 700);   // ✨ "What's your Spark's name?" (once, right after picking)
}
// ---------- ✨ "What's your Spark's name?" (optional, max 12 letters; asked once after picking, changeable in 👤 My profile) ----------
let snWho = null;
function askSparkName(who) {
  const u = userById(who);
  if (!u || !$("sparkNameModal").hidden) return;
  snWho = who;
  $("snFace").textContent = buddyFace(who, levelOf(lifetimePoints(who)));
  $("snInput").value = u.sparkName || "";
  $("sparkNameModal").hidden = false;
  $("snInput").focus();
}
function saveSparkName(skip) {
  const u = data.users.find(x => x.id === snWho);
  $("sparkNameModal").hidden = true;
  snWho = null;
  if (!u || skip) return;
  const name = $("snInput").value.trim().slice(0, 12);
  if (name === (u.sparkName || "")) return;
  if (name) u.sparkName = name; else delete u.sparkName;
  keepNow();
  if (name) toast(`✨ Hi ${name}!`, 2400, colorsOf(u).color);
}
// Two copies of the people list meet (the cloud's and this phone's): copy each person's "first time" choices that are
// missing or newer from `from` into `into`, so they're never lost when an older phone saves the whole plan over them:
//   🌱 buddy (+ buddyAt) and ⭐ focus = a parent's habits (+ focusAt): the newer choice wins · 👋 toured: once true, stays true
//   🕌 showPrayer / prayerRemind: once answered, stays answered. ("not chosen yet" never wins.) Returns true when `into` changed.
function mergeBuddies(into, from) {
  if (!Array.isArray(into) || !Array.isArray(from)) return false;
  let changed = false;
  into.forEach(u => {
    const o = from.find(x => x && x.id === u.id);
    if (!o) return;
    if (hasOwn(BUDDIES, o.buddy) && !(u.buddy && (o.buddyAt || "") <= (u.buddyAt || "")) && !(u.buddy === o.buddy && u.buddyAt === o.buddyAt)) {
      u.buddy = o.buddy;
      if (typeof o.buddyAt === "string") u.buddyAt = o.buddyAt; else delete u.buddyAt;
      changed = true;
    }
    if (Array.isArray(o.focus) && o.focus.length && !(Array.isArray(u.focus) && u.focus.length && (o.focusAt || "") <= (u.focusAt || ""))
        && sameText(o.focus) !== sameText(u.focus)) {
      u.focus = [...o.focus];
      if (typeof o.focusAt === "string") u.focusAt = o.focusAt; else delete u.focusAt;
      changed = true;
    }
    if (o.toured === true && u.toured !== true) { u.toured = true; changed = true; }
    if (o.setupAsked === true && u.setupAsked !== true) { u.setupAsked = true; changed = true; }   // 🧒 once true, stays true
    if (typeof o.sparkName === "string" && o.sparkName && !u.sparkName) { u.sparkName = o.sparkName; changed = true; }   // ✨
    ["showPrayer", "prayerRemind"].forEach(k => { if (typeof o[k] === "boolean" && typeof u[k] !== "boolean") { u[k] = o[k]; changed = true; } });
  });
  return changed;
}
// The same for a whole plan: the people, and ✨ "Make the app yours" done (featuresChosen: once true, stays true)
function mergePicks(into, from) {
  if (!into || !from) return false;
  let changed = mergeBuddies(into.users, from.users);
  if (from.featuresChosen === true && into.featuresChosen !== true) { into.featuresChosen = true; changed = true; }
  return changed;
}

// =====================================================================
//  🎈 v180 FREE-TIME IDEAS (Broo2a): on a kid's own calendar, "🎈 Free now? What do you want to do?" → kinds of things
//  (📚 read, 🦁 animal films, 🎨 draw …) → tap one → 3 ideas. They change every day and with 🔄, fit the kid's AGE
//  (🎂 birthday, else school year) and PERSONALITY (❤️ Things I love: dream job, game, colour; and the kinds they pick most).
//  Built in (no AI, no internet). s = up to 7 years, m = 8–10, b = 11 and up.
// =====================================================================
const FREE_KINDS = [
  { id: "read", e: "📚", label: "Read a book", ideas: {
    s: ["The Very Hungry Caterpillar", "Where the Wild Things Are", "The Gruffalo", "Room on the Broom", "Elmer the Patchwork Elephant", "Oi Frog!", "Owl Babies", "Peppa Pig: Peppa's Big Book", "We're Going on a Bear Hunt", "The Snail and the Whale", "Hamid and the Moon (an Islamic picture book)", "Any picture book from your shelf: read it to someone!"],
    m: ["Charlotte's Web", "Fantastic Mr Fox", "The Magic Finger", "Diary of a Wimpy Kid", "Dog Man", "The Owl Who Was Afraid of the Dark", "Matilda", "The Iron Man", "Amelia Fang", "Horrid Henry", "Stories of the Prophets for kids", "The Worst Witch", "A Boy Called Christmas", "Encyclopedia of animals: pick 3 pages"],
    b: ["Wonder", "Holes", "Percy Jackson and the Lightning Thief", "The Wild Robot", "Harry Potter and the Philosopher's Stone", "Journey to the River Sea", "Pax", "Amari and the Night Brothers", "Boy at the Back of the Class", "The 1001 Inventions of Muslim civilisation", "Hatchet", "The Phantom Tollbooth", "A newspaper for kids: read 2 stories"],
    a: ["Atomic Habits", "The Alchemist", "Man's Search for Meaning", "Sapiens", "The Sealed Nectar (the Prophet's life)", "Rich Dad Poor Dad", "A chapter of a book you started and stopped"] } },
  { id: "animals", e: "🦁", label: "Animal films", ideas: {
    s: ["Puffin Rock (an episode)", "Octonauts (an episode)", "Andy's Wild Adventures", "Tiny World (a short clip)", "Hey Duggee: The Animal Badge", "A video of baby animals at the zoo"],
    m: ["Wild Kratts (an episode)", "Tiny World (an episode)", "Our Planet: Jungles", "Secret Life of the Zoo", "Meerkat Manor", "Penguins: a day at the South Pole", "Seven Worlds, One Planet: Africa"],
    b: ["Our Planet: Frozen Worlds", "Planet Earth II: Islands", "Blue Planet II: The Deep", "Life in Colour", "Dynasties: Lions", "The Hunt", "My Octopus Teacher", "Seven Worlds, One Planet: Asia"],
    a: ["Our Planet II", "Planet Earth III", "Chimp Empire", "My Octopus Teacher", "Blue Planet II: One Ocean", "Watch one with the kids and talk about it"] } },
  { id: "draw", e: "🎨", label: "Draw and make", ideas: {
    s: ["Draw your family as animals", "Colour a picture using only {color}", "Make a paper crown", "Draw your dream house", "Hand-print animals", "Make a card for Mum"],
    m: ["Draw a comic with 4 boxes about your day", "Design a new animal (half lion, half fish?)", "Make a paper plane and paint it {color}", "Draw a map of a treasure island", "Make a bookmark for your book", "Draw your favourite food: {food}"],
    b: ["Design a logo for your future company", "Draw a comic strip with a twist ending", "Sketch your room from the door", "Learn to draw a 3D cube and a 3D name", "Design a poster for your dream job: {job}", "Make an origami crane"],
    a: ["Doodle for 15 minutes with music on", "Try calligraphy: write a short ayah or name", "Paint with the kids: everyone paints the same thing", "Sketch a corner of your home"] } },
  { id: "build", e: "🧱", label: "Build something", ideas: {
    s: ["Build the tallest tower you can", "Make a house for your toy", "Build a car with blocks", "Make a train with chairs"],
    m: ["Lego challenge: a bridge between two books", "Build a marble run from paper rolls", "Make a pillow fort", "Build a robot from boxes", "Build a city with Lego or blocks"],
    b: ["Build a working catapult from lolly sticks", "Lego challenge: a machine that moves", "Make a phone stand from cardboard", "Plan and build a mini city", "Build a paper bridge that holds a book"] } },
  { id: "move", e: "🏃", label: "Move your body", ideas: {
    s: ["Animal walk: hop like a frog, waddle like a penguin", "Dance to 2 songs", "Throw and catch a ball 20 times", "Freeze dance with someone"],
    m: ["Skip with a rope 50 times", "Ride your bike or scooter", "Football: 20 keepy-uppies", "Make an obstacle course", "10 minutes of kids' yoga"],
    b: ["A 15-minute workout: jumps, push-ups, squats", "Practise your football skills", "Go for a walk with a parent", "Learn a new trick (bike, ball, skipping)", "Swim if you can"],
    a: ["A 20-minute walk outside", "Stretching or yoga for 15 minutes", "Play football or catch with the kids", "A short home workout"] } },
  { id: "science", e: "🔬", label: "Little experiments", ideas: {
    s: ["Which toys float and which sink?", "Mix colours with water and food colouring", "Grow a bean in a wet tissue", "Find 5 shapes in your house"],
    m: ["Make a lemon volcano with baking soda (ask a parent)", "Make a rainbow with a glass of water and the sun", "Make slime (ask a parent)", "Find out how many drops fit on a coin", "Grow crystals with salt"],
    b: ["Build a simple circuit with a battery (ask a parent)", "Make a balloon rocket on a string", "Test which paper plane flies furthest", "Make a pH tester with red cabbage (ask a parent)", "Watch a Mark Rober video and try one idea"] } },
  { id: "puzzle", e: "🧩", label: "Puzzles and games", ideas: {
    s: ["Do a jigsaw puzzle", "Play memory cards", "Play I spy", "Play snakes and ladders"],
    m: ["Play chess or checkers", "Do an easy sudoku", "Make your own word search", "Play Uno with the family", "A 100-piece jigsaw"],
    b: ["Play chess (or learn a new opening)", "A hard sudoku", "Rubik's cube: learn one step", "Make a quiz for your family", "A 500-piece jigsaw"],
    a: ["A crossword or a hard sudoku", "Play chess with one of the kids", "Learn a new card game", "A 1000-piece jigsaw with the family"] } },
  { id: "cook", e: "🍳", label: "Help in the kitchen", ideas: {
    s: ["Wash the fruit", "Make a fruit face on a plate", "Help mix a cake (with a parent)"],
    m: ["Make a sandwich by yourself", "Make a fruit salad", "Help bake cookies (with a parent)", "Make lemonade"],
    b: ["Cook an omelette (with a parent)", "Make a smoothie with your own recipe", "Bake a cake from a recipe", "Help plan tomorrow's dinner: {food}?"],
    a: ["Try a new recipe from another country", "Cook with one of the kids", "Plan next week's meals", "Bake bread from scratch"] } },
  { id: "space", e: "🚀", label: "Space and science films", ideas: {
    s: ["Ready Jet Go! (an episode)", "Peppa Pig goes to the moon", "Look at the moon tonight: what shape is it?"],
    m: ["Ada Twist, Scientist (an episode)", "The Magic School Bus Rides Again", "A video tour of the International Space Station", "Find the planets in order: make a song"],
    b: ["A video about black holes for kids", "Cosmos: A Spacetime Odyssey (part)", "Watch a rocket launch video", "How the pyramids were built (a short film)", "1001 Inventions and the Library of Secrets"],
    a: ["A short documentary about the universe", "Watch a rocket launch with the kids", "Look at the stars tonight with an app"] } },
  { id: "write", e: "✍️", label: "Write something", ideas: {
    s: ["Tell a story and a parent writes it", "Write your name in big bubble letters", "Make a list of 5 things you love"],
    m: ["Write a short story about a talking cat", "Write a letter to your grandma or grandpa", "Make a diary page about today", "Write 5 riddles for your family"],
    b: ["Write a story that starts: 'The door was open…'", "Write a review of the last film you watched", "Start a diary", "Write a letter to yourself in 5 years", "Write about your dream job: {job}"],
    a: ["Write 3 things you're grateful for", "Write a letter to each kid to read when they're older", "Plan your goals for this month", "Journal for 10 minutes"] } },
  { id: "kind", e: "💌", label: "Do something kind", ideas: {
    s: ["Give someone a big hug", "Help tidy the toys", "Draw a picture for a friend"],
    m: ["Make a thank-you card for your teacher", "Help set the table", "Call your grandparents", "Share a toy with your sibling"],
    b: ["Help your little brother or sister with homework", "Call a relative you haven't talked to", "Do a job at home without being asked", "Write kind notes for the family"],
    a: ["Call your parents or a relative", "Message an old friend", "Leave a kind note for your partner", "Help a neighbour"] } },
  { id: "outside", e: "🌳", label: "Play outside", ideas: {
    s: ["Treasure hunt with a magnifying glass: find 5 tiny things", "Collect leaves of 3 different shapes", "Draw with chalk on the floor", "Blow bubbles and chase them"],
    m: ["A nature hunt: a feather, a smooth stone, a yellow leaf", "Make a family sports day: 3 races", "Count the birds you see in 10 minutes", "Water the plants and check what grew"],
    b: ["Plan a mini sports day for the family", "Photograph 10 interesting things outside", "Find north with the sun or a compass", "Start a small plant pot of your own"],
    a: ["A family walk in the park", "Tend the plants or start a small herb pot", "Watch the sunset with a tea", "Take the kids to the beach or a playground"] } },
  { id: "family", e: "🎲", label: "Family game time", ideas: {
    s: ["Play Simon says", "Hide and seek", "Play a board game with someone", "Make a puppet show for the family"],
    m: ["Board game night: pick the game!", "Charades: act out animals", "Start a family book club with one book", "Play 20 questions"],
    b: ["Teach the family a game you know", "A family quiz night: you ask the questions", "Play Pictionary", "Swap books with a friend or cousin"],
    a: ["Board game night with the kids", "Ask each kid about the best part of their day", "A family quiz: you ask the questions", "Look at old family photos together"] } },
  { id: "metime", e: "☕", label: "Me time", ideas: { a: ["A quiet coffee or tea, no phone", "A short nap (20 minutes)", "Listen to a podcast you like", "A long shower and an early night", "Read something just for fun"] } },
  { id: "quran", e: "🕌", label: "Quran and stories", ideas: {
    s: ["Listen to a short surah: Al-Fatiha, Al-Ikhlas", "Listen to a story of a prophet", "Learn a short dua"],
    m: ["Learn 3 new ayat", "Listen to the story of Prophet Yunus", "Learn the meaning of a short surah", "Read a hadith with a parent"],
    b: ["Revise a surah you know", "Listen to the story of Prophet Yusuf", "Learn about a famous Muslim scientist", "Read the meaning of a surah you know"],
    a: ["Read one page of Quran with its meaning", "Listen to a short tafsir", "Learn a new dua with the kids", "Revise a surah you know"] } }
];
// Personality → kinds that come first (from ❤️ Things I love)
const FREE_LIKES = [[/vet|animal|zoo|horse|dog|cat|nature|marine|biolog/i, ["animals", "science"]], [/doctor|scien|engineer|invent|chemist|lab/i, ["science", "build"]],
  [/artist|design|paint|draw|fashion|architect/i, ["draw", "build"]], [/foot|soccer|athlet|sport|swim|player|basket|tennis|gym/i, ["move"]],
  [/chef|cook|bak|food/i, ["cook"]], [/astronaut|pilot|space|planet/i, ["space", "science"]], [/writer|author|poet|journalist|teacher/i, ["write", "read"]],
  [/minecraft|lego|roblox|build|craft/i, ["build", "puzzle"]], [/chess|puzzle|sudoku|uno|card/i, ["puzzle"]], [/youtube|film|movie|actor/i, ["animals", "space"]],
  [/imam|sheikh|quran|hafiz/i, ["quran", "read"]], [/garden|farm|explor|camp/i, ["outside"]], [/math|maths|number|smart|genius|coder|program/i, ["iq", "sudoku"]]];
function kidAge(u) {
  if (u.birthday) { const [y, m, d] = u.birthday.split("-").map(Number), n = new Date(); return n.getFullYear() - y - (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d) ? 1 : 0); }
  const yr = /\d+/.exec(u.year || ""); return yr ? +yr[0] + 5 : 9;   // (Year 4 / Grade 4 ≈ 9 years old)
}
// (👨‍👩‍👧 a parent: "a" = grown-up ideas; their games are the hardest ones)
const freeBand = u => { if (isParentId(u.id)) return "a"; const a = kidAge(u); return a <= 7 ? "s" : a <= 10 ? "m" : "b"; };
const gameBand = u => freeBand(u) === "a" ? "b" : freeBand(u);
// A small number from text, so the same day gives the same ideas (and 🔄 gives new ones)
function freeSeed(t) { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function freeShuffle(list, seed) { const a = [...list]; let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const FREE_KEY = SAVE_KEY + ".freeIdeas.";   // (this device: the kinds each kid picked most, so their favourites come first)
function freePicks(id) { try { return JSON.parse(localStorage.getItem(FREE_KEY + id)) || {}; } catch (e) { return {}; } }
let freeBox = null;   // the open box: { kid, kind (null = the kinds), spin }
function freeKindsFor(u, spin) {
  const loves = Object.values(u.loves || {}).join(" "), liked = new Set(FREE_LIKES.filter(([re]) => re.test(loves)).flatMap(([, ks]) => ks));
  const picks = freePicks(u.id), seed = freeSeed(`${u.id}|${todayYmd()}|${spin}`);
  const score = k => (liked.has(k.id) ? 3 : 0) + Math.min(3, (picks[k.id] || 0) / 2) + (freeSeed(k.id + seed) % 100) / 40;
  return FREE_KINDS.filter(k => k.ideas[freeBand(u)]).sort((a, b) => score(b) - score(a)).slice(0, 6);
}
function freeIdeasFor(u, kind, spin) {
  const fill = t => t.replace("{color}", (u.loves && u.loves.color) || "blue").replace("{food}", (u.loves && u.loves.food) || "pizza")
    .replace("{job}", (u.loves && u.loves.job) || "your dream job");
  return freeShuffle(kind.ideas[freeBand(u)], freeSeed(`${u.id}|${kind.id}|${todayYmd()}|${spin}`)).slice(0, 3).map(fill);
}
function freeNowHtml(who) {
  if (!who || !exists(who) || (isParentId(who) && who !== me)) return "";   // (👨‍👩‍👧 v180: a parent on their own calendar too)
  const u = userById(who), now = dubaiMinutes(), ds = todayYmd(), day = planDay(ds), [ws, we] = day.window || [0, 0];
  const bed = bedMin(who, ds), busy = [...day.items.filter(it => it.people.includes(who)), ...day.routines.filter(r => (r.users || []).includes(who)),
    ...oneDayOn(ds).filter(e => e.who.includes(who)).map(e => ({ start: toMin(e.from), end: toMin(e.to) }))].some(b => b.start <= now && now < b.end);
  const freeNow = !busy && now >= ws && now < we && (bed == null || now < bed);
  return `<button class="free-btn ${freeNow ? "now" : ""}" data-freeopen="${safe(who)}">🎈 ${freeNow ? `Free now${who === me ? "" : `, ${safe(u.name)}`}? What do you want to do?` : "Free-time ideas"}</button>`;
}
function drawFree() {
  const u = userById(freeBox.kid);
  if (!freeBox.kind) {
    $("ideaTitle").textContent = `🎈 What do you want to do${freeBox.kid === me ? "" : `, ${u.name}`}?`;
    const kb = k => `<button class="free-kind ${k.game ? "game" : ""}" data-freekind="${k.id}"><span class="e">${k.e}</span>${safe(k.label)}</button>`;
    $("freeBody").innerHTML = `<div class="free-kinds">${FREE_GAMES.map(kb).join("")}${freeKindsFor(u, freeBox.spin).map(kb).join("")}</div>
      <div class="btnrow"><button data-freespin>🔄 Other ideas</button><button data-freeclose>Close</button></div>`;
  } else if (freeBox.kind === "iq") drawIq(u);
  else if (freeBox.kind === "sudoku") drawSudoku(u);
  else {
    const k = FREE_KINDS.find(x => x.id === freeBox.kind);
    $("ideaTitle").textContent = `${k.e} ${k.label}`;
    $("freeBody").innerHTML = `<p class="print-hint" style="margin:0 0 8px">Pick one you like:</p><ul class="free-ideas">${freeIdeasFor(u, k, freeBox.spin).map(t => `<li>${safe(t)}</li>`).join("")}</ul>
      <div class="btnrow"><button data-freespin>🔄 Other ideas</button><button data-freeback>‹ Back</button><button data-freeclose>Close</button></div>`;
  }
  $("freeModal").hidden = false;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-freeopen], [data-freekind], [data-freespin], [data-freeback], [data-freeclose]"); if (!b) return;
  const d = b.dataset;
  if (d.freeopen) { freeBox = { kid: d.freeopen, kind: null, spin: 0 }; iqBox = null; sdk = null; return drawFree(); }
  if (!freeBox) return;
  if ("freeclose" in d) { $("freeModal").hidden = true; freeBox = null; return; }
  if ("freeback" in d) { freeBox.kind = null; return drawFree(); }
  if ("freespin" in d) { freeBox.spin++; if (freeBox.kind === "iq") iqBox = null; if (freeBox.kind === "sudoku") sdk = null; return drawFree(); }
  if (d.freekind) { freeBox.kind = d.freekind; freeBox.spin = 0;
    try { const p = freePicks(freeBox.kid); p[d.freekind] = (p[d.freekind] || 0) + 1; localStorage.setItem(FREE_KEY + freeBox.kid, JSON.stringify(p)); } catch (err) {}
    return drawFree(); }
});

// ---------- 🧠 IQ puzzles and 🔢 Sudoku (v180, Broo2a): played right in the 🎈 box, new ones every time, harder for older kids ----------
const FREE_GAMES = [{ id: "iq", e: "🧠", label: "IQ puzzles", game: true }, { id: "sudoku", e: "🔢", label: "Sudoku", game: true }];
const rnd = n => Math.floor(Math.random() * n);
const ODD_SETS = [["Lion", "Tiger", "Cat", "Carrot"], ["Apple", "Banana", "Mango", "Chair"], ["Red", "Blue", "Green", "Spoon"], ["Car", "Bus", "Train", "Shoe"],
  ["Eagle", "Owl", "Parrot", "Shark"], ["Square", "Circle", "Triangle", "Seven"], ["Monday", "Friday", "Sunday", "March"], ["Piano", "Guitar", "Drum", "Pencil"],
  ["Whale", "Dolphin", "Shark", "Camel"], ["Mars", "Venus", "Earth", "Moon"], ["Doctor", "Teacher", "Pilot", "Hospital"], ["Milk", "Juice", "Water", "Bread"]];
const IQ_RIDDLES = [
  ["Sara is taller than Ali. Ali is taller than Omar. Who is the shortest?", "Omar", ["Sara", "Ali", "Same"]],
  ["A farmer has 5 sheep. All but 2 run away. How many are left?", "2", ["3", "5", "0"]],
  ["What is half of 2 + 2?", "3", ["2", "1", "4"]],
  ["How many months have 28 days?", "All 12", ["1", "2", "6"]],
  ["If 3 cats catch 3 mice in 3 minutes, how many cats catch 6 mice in 6 minutes?", "3", ["6", "9", "12"]],
  ["Which weighs more: 1 kg of feathers or 1 kg of stones?", "The same", ["Feathers", "Stones", "Can't tell"]],
  ["Mona's father has 3 daughters: Lulu, Lala and …?", "Mona", ["Lili", "Lolo", "Nobody"]],
  ["You overtake the person in 2nd place in a race. What place are you in now?", "2nd", ["1st", "3rd", "Last"]],
  ["8 teams play a knockout cup (the loser goes home). How many games are played?", "7", ["8", "4", "16"]],
  ["A clock shows 3:00. What is the angle between the hands?", "90°", ["45°", "180°", "30°"]],
  ["What comes next: Monday, Wednesday, Friday, …?", "Sunday", ["Saturday", "Tuesday", "Thursday"]],
  ["If BAT is written 213, how is TAB written?", "312", ["231", "123", "321"]]];
// One question: { q, a (the right answer), opts }
function iqQuestion(band) {
  const t = rnd(band === "s" ? 2 : 4);
  const shuffle = l => freeShuffle(l, rnd(1e9) + 1);
  if (t === 0) {   // 🔢 what comes next?
    const kinds = band === "s" ? ["add"] : band === "m" ? ["add", "mul", "alt"] : ["mul", "alt", "sq", "fib", "grow"];
    const k = kinds[rnd(kinds.length)], a0 = 1 + rnd(band === "s" ? 5 : 9), d = 2 + rnd(band === "s" ? 2 : 5);
    let seq = [];
    if (k === "add") for (let i = 0; i < 5; i++) seq.push(a0 + d * i);
    if (k === "mul") for (let i = 0; i < 5; i++) seq.push(a0 * Math.pow(2, i));
    if (k === "alt") for (let i = 0; i < 5; i++) seq.push(i % 2 ? seq[i - 1] - 1 : (i ? seq[i - 1] + d + 1 : a0 + 5));
    if (k === "sq") for (let i = 0; i < 5; i++) seq.push((i + 1 + rnd(1)) ** 2);
    if (k === "fib") { seq = [a0, a0 + 1]; while (seq.length < 5) seq.push(seq[seq.length - 1] + seq[seq.length - 2]); }
    if (k === "grow") { seq = [a0]; for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + i + 1); }
    const ans = seq.pop(), wrong = new Set(); while (wrong.size < 3) { const w = ans + (rnd(2) ? 1 : -1) * (1 + rnd(d + 3)); if (w !== ans && w > 0) wrong.add(w); }
    return { q: `What comes next? ${seq.join(", ")}, ?`, a: String(ans), opts: shuffle([ans, ...wrong].map(String)) };
  }
  if (t === 1) {   // 🔍 the odd one out
    const set = ODD_SETS[rnd(ODD_SETS.length)];
    return { q: "Which one is the odd one out?", a: set[3], opts: shuffle(set) };
  }
  if (t === 2) {   // ⚖️ a balance puzzle
    const x = 2 + rnd(8), n = 2 + rnd(3), tot = x * n + (band === "b" ? 0 : 0);
    const wrong = new Set(); while (wrong.size < 3) { const w = x + (rnd(2) ? 1 : -1) * (1 + rnd(3)); if (w > 0 && w !== x) wrong.add(w); }
    return { q: `${"🍎 ".repeat(n)}= ${tot}. How much is one 🍎?`, a: String(x), opts: shuffle([x, ...wrong].map(String)) };
  }
  const r = IQ_RIDDLES[rnd(IQ_RIDDLES.length)];   // 🤔 a thinking riddle
  return { q: r[0], a: r[1], opts: shuffle([r[1], ...r[2]]) };
}
let iqBox = null;   // { q, picked, right, n (asked), score }
function drawIq(u) {
  if (!iqBox) iqBox = { ...iqQuestion(gameBand(u)), picked: null, n: 1, score: 0 };
  const x = iqBox;
  $("ideaTitle").textContent = `🧠 IQ puzzle ${x.n}`;
  $("freeBody").innerHTML = `<p class="iq-q">${safe(x.q)}</p><div class="iq-opts">${x.opts.map(o => `<button class="iq-opt ${x.picked == null ? "" : o === x.a ? "right" : o === x.picked ? "wrong" : ""}"
      data-iqpick="${safe(o)}" ${x.picked == null ? "" : "disabled"}>${safe(o)}</button>`).join("")}</div>
    ${x.picked == null ? "" : `<p class="iq-res">${x.picked === x.a ? "✅ Correct! Clever!" : `❌ Not this time. The answer is <b>${safe(x.a)}</b>.`} Score: ${x.score} of ${x.n}</p>`}
    <div class="btnrow">${x.picked == null ? "" : `<button class="primary" data-iqnext>Next puzzle ›</button>`}<button data-freeback>‹ Back</button><button data-freeclose>Close</button></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-iqpick], [data-iqnext]"); if (!b || !iqBox || !freeBox) return;
  const u = userById(freeBox.kid);
  if (b.dataset.iqpick != null && iqBox.picked == null) { iqBox.picked = b.dataset.iqpick; if (iqBox.picked === iqBox.a) iqBox.score++; }
  else if ("iqnext" in b.dataset) { let q = iqQuestion(gameBand(u)); for (let i = 0; i < 5 && q.q === iqBox.q; i++) q = iqQuestion(gameBand(u));   // (never the same twice in a row)
    iqBox = { ...q, picked: null, n: iqBox.n + 1, score: iqBox.score }; }
  drawIq(u);
});

// 🔢 Sudoku: 4×4 for small kids, 6×6 for 8–10, 9×9 for 11+. A full grid from a pattern, shuffled; then cells are taken out.
// Any answer that follows the rules (row, column, box) counts as solved.
let sdk = null;   // { n, br, bc (box rows / cols), grid (0 = empty), given, sel }
function sudokuNew(band) {
  const [n, br, bc] = band === "s" ? [4, 2, 2] : band === "m" ? [6, 2, 3] : [9, 3, 3];
  const sh = l => freeShuffle(l, rnd(1e9) + 1);
  const base = (r, c) => (bc * (r % br) + Math.floor(r / br) + c) % n;
  const rows = sh([...Array(n / br).keys()]).flatMap(g => sh([...Array(br).keys()]).map(r => g * br + r));
  const cols = sh([...Array(n / bc).keys()]).flatMap(g => sh([...Array(bc).keys()]).map(c => g * bc + c));
  const nums = sh([...Array(n).keys()].map(i => i + 1));
  const full = rows.map(r => cols.map(c => nums[base(r, c)]));
  const holes = Math.round(n * n * (band === "s" ? 0.45 : band === "m" ? 0.5 : 0.55));
  const grid = full.map(r => [...r]);
  sh([...Array(n * n).keys()]).slice(0, holes).forEach(i => grid[Math.floor(i / n)][i % n] = 0);
  return { n, br, bc, grid, given: grid.map(r => r.map(v => v > 0)), sel: null };
}
function sudokuBad(s, r, c) {
  const v = s.grid[r][c]; if (!v) return false;
  for (let i = 0; i < s.n; i++) { if (i !== c && s.grid[r][i] === v) return true; if (i !== r && s.grid[i][c] === v) return true; }
  const r0 = r - r % s.br, c0 = c - c % s.bc;
  for (let i = r0; i < r0 + s.br; i++) for (let j = c0; j < c0 + s.bc; j++) if ((i !== r || j !== c) && s.grid[i][j] === v) return true;
  return false;
}
function drawSudoku(u) {
  if (!sdk) sdk = sudokuNew(gameBand(u));
  const s = sdk, done = s.grid.every((row, r) => row.every((v, c) => v && !sudokuBad(s, r, c)));
  $("ideaTitle").textContent = `🔢 Sudoku ${s.n}×${s.n}`;
  $("freeBody").innerHTML = `<p class="print-hint" style="margin:0 0 8px">${done ? "🎉 Solved! Well done!" : `Every row, column and box has 1 to ${s.n} once. Tap a box, then a number.`}</p>
    <div class="sdk sdk-${s.n}" style="--n:${s.n}">${s.grid.map((row, r) => row.map((v, c) => `<button class="sdk-c ${s.given[r][c] ? "given" : ""} ${s.sel === r * s.n + c ? "sel" : ""} ${sudokuBad(s, r, c) ? "bad" : ""}
      ${(c + 1) % s.bc === 0 && c < s.n - 1 ? "br" : ""} ${(r + 1) % s.br === 0 && r < s.n - 1 ? "bb" : ""}" data-sdkcell="${r * s.n + c}" ${s.given[r][c] ? "disabled" : ""}>${v || ""}</button>`).join("")).join("")}</div>
    ${done ? "" : `<div class="sdk-pad">${[...Array(s.n).keys()].map(i => `<button data-sdknum="${i + 1}">${i + 1}</button>`).join("")}<button data-sdknum="0">⌫</button></div>`}
    <div class="btnrow"><button data-freespin>🔄 New sudoku</button><button data-freeback>‹ Back</button><button data-freeclose>Close</button></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-sdkcell], [data-sdknum]"); if (!b || !sdk || !freeBox) return;
  if (b.dataset.sdkcell != null) sdk.sel = Number(b.dataset.sdkcell);
  else if (sdk.sel != null) { const r = Math.floor(sdk.sel / sdk.n), c = sdk.sel % sdk.n; if (!sdk.given[r][c]) sdk.grid[r][c] = Number(b.dataset.sdknum); }
  drawSudoku(userById(freeBox.kid));
});
