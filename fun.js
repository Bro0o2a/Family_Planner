// =====================================================================
//  ⭐ GOOD HABITS: a daily checklist for the kids (not on the calendar)
// =====================================================================
let habitDay = todayIndex();   // which day the habits card shows (0 = Monday … today). No future days.

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
  const u = userById(who), c = colorsOf(u), today = todayIndex();
  if (habitDay > today) habitDay = today;
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
      <b>${isToday ? "Today" : DAYS[d]}, ${dateOfDay(d)}</b>
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
  if (habitDay > todayIndex()) return toast("Not yet!");
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
function diaryFormHtml(e) {
  const mood = diaryMood || (e && e.mood), parent = isParentId(me);
  return `<div class="card sc-form dy-form"><h2>How do you feel today?</h2>
    <div class="dy-moods" role="radiogroup" aria-label="My mood">${MOODS.map(([k, face, word]) => `<button class="dy-mood ${mood === k ? "on" : ""}" data-dymood="${k}"
      role="radio" aria-checked="${mood === k}"><span class="e">${face}</span><small>${word}</small></button>`).join("")}</div>
    <p class="hint">All optional, one line each. 🎤 Tip: tap the mic on your keyboard to talk instead of typing.</p>
    ${DIARY_LINES.map(([k, emoji, label]) => `<label class="small" for="dy-${k}">${emoji} ${label}</label>
      <input type="text" id="dy-${k}" maxlength="120" value="${safe((e && e[k]) || "")}" placeholder="🎤 ${label}…">`).join("")}
    ${parent ? `<p class="hint">🔒 Your days are just for you.</p>` : `<label class="checkline"><input type="checkbox" id="dyPrivate" ${e && e.private ? "checked" : ""}> 🔒 Just for me (your parents still see the face)</label>`}
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
