// =====================================================================
//  POINTS: "done" checkboxes, 10 points each, Shining Star of the Week
// =====================================================================
const POINTS_EACH = 10;
// Each person has their own tick (an activity for 3 kids = 3 ticks, 10 points each): "date|activity|person"
// (📅 ticks are kept by date for 5 weeks, so the calendar's past days still show them; points count only this week's)
const markKey = (date, actId, user) => date + "|" + actId + "|" + user;
const isDone = (date, actId, user) => !!data.points.marks[markKey(date, actId, user)];
const markDate = key => key.slice(0, 10);
// This week's ticks (Monday … Sunday of the points week)
const weekMarks = () => Object.entries(data.points.marks).filter(([key]) => markDate(key) >= data.points.week && markDate(key) < weekEnd()).map(([, m]) => m);
// Every tick we still know of, as { date, user }: older weeks' list (kept before ticks were by date) + the ticks by date
const tickLog = () => [...data.points.log, ...Object.entries(data.points.marks).map(([key, m]) => ({ date: markDate(key), user: m.user }))];

// 👨‍👩‍👧 ONLY KIDS ARE SCORED: parents have no points, score, rank, star, prize or weekly history any more
// (their activities still show on the calendar, without a tick for points). Older saved parent numbers stay in the data, unshown.
const scoredUsers = () => kidsList();
// Every kid's points from activities this week: { kidId: points }
function activityPointsByUser() {
  const totals = Object.fromEntries(scoredUsers().map(u => [u.id, 0]));
  weekMarks().forEach(m => { if (hasOwn(totals, m.user)) totals[m.user] += POINTS_EACH; });
  return totals;
}
// Every kid's points this week: activities + good habits + 🎒 homework done. (This is what the Shining Star uses.)
function pointsByUser() {
  const totals = activityPointsByUser(), from = data.points.week, to = weekEnd();
  Object.keys(totals).forEach(id => totals[id] += bonusPoints(id, from, to));
  return totals;
}
// Everything but the activity ticks: habits, 📝 homework, 🤝 helping, 🎁 prize, 🧩 riddles, 📔 my day
function bonusPoints(id, from, to) { const k = pointKinds(id, from, to, 0); return k.tasks + k.habits + k.fun; }
// The 3 kinds of points (the numbers of each source are unchanged, only grouped):
//   ✅ Tasks  = activities (acts: their points, worked out by the caller) + 📝 homework & 🤖 worksheets + ✅ duties
//   ⭐ Habits = good habits & prayers (kids' and parents') + 📔 My day
//   🧩 Fun    = 💌 wishes   (🧩 riddles: just for fun, no points; 👨‍👩‍👧 parents' helping points and prizes were removed)
// (⚙️ a feature that's off gives no points: 🧩 riddles, 📔 My day, 💌 wishes, 👨‍👩‍👧 a parent's habits / helping / prize)
function pointKinds(id, from, to, acts) {
  if (isParentId(id)) return { tasks: 0, habits: 0, fun: 0 };   // (👨‍👩‍👧 parents aren't scored: no auto points, prize or habits either)
  const on = k => feat(k) ? 1 : 0;
  return { tasks: acts + homeworkPoints(id, from, to) + studyPoints(id, from, to) + freeStudyPoints(id, from, to) + dutyPoints(id, from, to) + extraTaskPoints(id, from, to),
           habits: habitPoints(id, from, to) + diaryPoints(id, from, to) * on("diary"),
           fun: wishPoints(id, from, to) * on("wishes") + extraFunPoints(id, from, to) };   // (🧩 riddles: no points, just for fun)
}
const weekKinds = id => pointKinds(id, data.points.week, weekEnd(), activityPointsByUser()[id] || 0);
const kindsText = k => `✅ Tasks ${k.tasks} · ⭐ Habits ${k.habits} · 🧩 Fun ${k.fun}`;   // (each symbol with its word: users are new)
// How many activities a person has this week: their planned ones + (a parent) their ➕ My activity ones (not ✈️ travel)
const pactTicksOn = (who, date) => (data.parentActs || []).filter(a => a.by === who && a.type !== "travel" && pactStartOn(a, date)).length;
function plannedCount(id) {
  const days = planDays();
  const planned = days ? days.reduce((sum, day) => sum + day.items.filter(it => it.users.includes(id)).length, 0) : 0;
  return planned + DAYS.reduce((sum, _, d) => sum + pactTicksOn(id, ymd(dayDate(d))), 0);
}

// ---------- 👨‍👩‍👧 A parent's auto points (✅ checking a worksheet, 🔁 a practice sheet, 📋 reading a brief): REMOVED ----------
const giveAuto = () => {};

// ---------- 🎒 SCHOOL POINTS (✅ Tasks): one full round on a topic = 20 ----------
//   ✏️ a worksheet finished: +10 when it's first checked (its "Worksheet" mark, see homeworkPoints)
//   🤖 an explanation read ("I got it 👍" at its end): +5, once a topic a day · 📤 answers uploaded: +5, once a worksheet
//   (📤 only for a planned study session's worksheet: any other worksheet is ⭐ FREE STUDY, see below)
// Only a kid earns them, on their own device (👨‍👩‍👧 parents' devices only watch).
// data.points.study = "date|kid|kind|ref" → { at }   (kind: "ex" | "up"; ref: the topic, or the worksheet's id. Kept 180 days.)
function studyPoints(user, from, to) {
  return Object.keys(data.points.study).reduce((n, k) => { const [date, who, kind] = k.split("|"); return n + (who === user && date >= from && date < to ? STUDY_POINTS[kind] || 0 : 0); }, 0);
}
const studyRef = x => String(x).trim().replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40) || "x";
// A topic → a short ref that's the same for "Fractions" and "fractions " (any language)
function topicRef(t) {
  let n = 5381;
  for (const ch of String(t).trim().toLowerCase()) n = ((n * 33) ^ ch.codePointAt(0)) >>> 0;
  return "t" + n.toString(36);
}
const canEarnStudy = kid => !!kid && kid === me && !isParentId(kid) && !isParentPhone();
// → true when the points were given now (false: already given, or a parent's device)
function giveStudy(kid, kind, ref) {
  if (!hasOwn(STUDY_POINTS, kind) || !canEarnStudy(kid)) return false;
  if (studyEarned(kid, kind, ref)) return false;
  if (newWeek()) keepNow();
  data.points.study[`${todayYmd()}|${kid}|${kind}|${studyRef(ref)}`] = { at: new Date().toISOString() };
  writeData();
  pointPop(STUDY_POINTS[kind], colorsOf(userById(kid)).color);
  return true;
}
// 📤 once a worksheet (any day) · 🤖 once a topic a day
function studyEarned(kid, kind, ref) {
  const r = studyRef(ref);
  return kind === "up" ? Object.keys(data.points.study).some(k => { const [, who, kd, x] = k.split("|"); return who === kid && kd === "up" && x === r; })
    : hasOwn(data.points.study, `${todayYmd()}|${kid}|${kind}|${r}`);
}
// ---------- ⭐ FREE STUDY: a worksheet a kid makes OUTSIDE a planned study session (no session key) ----------
//   Any day, any way: a subject page, ⚡ instant, ➕ more questions, 🔁 practice, 🚀 challenge … It earns (instead of "📤 +5" above):
//   +2 for making it and +15 for the answers, both when the answers go up (an unsolved worksheet earns nothing),
//   then after its check +10 (≥ 80 %) / +5 (50–79 %) / 0. Each step once a worksheet (uploading or checking again gives nothing).
//   Only the first 3 a day for each SUBJECT earn points (the Dubai date the answers went up). Worksheets in a planned session: as before.
//   data.points.free["date|wsId|kid"] = { make, up, bonus, at, sub, capped?, checked? }   (kept 180 days)
//   → the kid's ⭐ points (✅ Tasks, see pointKinds) and ⚡ the extra-worksheet bonus on the score (see extraBonus / scoreOf).
const isFreeStudy = w => !!w && !w.session && exists(w.kid) && !isParentId(w.kid);
const freeKeyOf = (wsId, kid) => Object.keys(data.points.free).find(k => { const [, id, who] = k.split("|"); return id === wsId && who === kid; }) || null;
// A kid's free study between two dates: { count (worksheets that earned points), points }
function freeStudy(kid, from = data.points.week, to = weekEnd()) {
  const list = Object.entries(data.points.free).filter(([k, x]) => { const [date, , who] = k.split("|"); return who === kid && !x.capped && date >= from && date < to; }).map(([, x]) => x);
  return { count: list.length, points: list.reduce((n, x) => n + x.make + x.up + x.bonus, 0) };
}
const freeStudyPoints = (kid, from, to) => freeStudy(kid, from, to).points;
const freeLine = f => `⭐ Free study: ${f.count} ${f.count === 1 ? "worksheet" : "worksheets"}, ${f.points} points`;
// 📤 The answers went up (the kid, on their own device) → +2 +15, or the day's limit for that subject. → the points (0: none, -1: the limit)
function giveFreeUp(w, wsId) {
  if (!isFreeStudy(w) || !canEarnStudy(w.kid) || freeKeyOf(wsId, w.kid)) return 0;
  if (newWeek()) keepNow();
  const date = dubaiNow().date, sub = String(w.subject || "").slice(0, 30), at = new Date().toISOString();
  const today = Object.entries(data.points.free).filter(([k, x]) => { const [d, , who] = k.split("|"); return d === date && who === w.kid && !x.capped && sameSubject(x.sub, sub); }).length;
  const capped = today >= FREE_CAP;
  data.points.free[`${date}|${wsId}|${w.kid}`] = capped ? { make: 0, up: 0, bonus: 0, at, sub, capped: true } : { make: FREE_POINTS.make, up: FREE_POINTS.up, bonus: 0, at, sub };
  return capped ? -1 : FREE_POINTS.make + FREE_POINTS.up;
}
const freeCapText = sub => `🌟 Great work! You've earned today's free study points for ${sub || "this subject"} (${FREE_CAP} of ${FREE_CAP}). Try another subject, or keep practising! More worksheets are still good practice!`;
// ✅ Its first check → +10 (≥ 80 %) / +5 (50–79 %) / 0 (any device may do the check; a kid's device only for itself). → { bonus, pct } or null
function giveFreeBonus(w, wsId, c) {
  const k = isFreeStudy(w) && freeKeyOf(wsId, w.kid), x = k && data.points.free[k];
  if (!x || x.capped || x.checked || (isKidDevice() && w.kid !== kidDeviceId()) || !(c.max_score > 0)) return null;
  const pct = Math.round(c.score / c.max_score * 100), bonus = pct >= 80 ? FREE_POINTS.top : pct >= 50 ? FREE_POINTS.mid : 0;
  data.points.free[k] = { ...x, bonus, checked: true };
  return { bonus, pct };
}
// The small "+10 ⭐" pop (where the last tap was, else the middle of the screen)
let lastTap = null;
document.addEventListener("pointerdown", e => { lastTap = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
function pointPop(n, color) {
  const el = document.createElement("div"), tap = lastTap && Date.now() - lastTap.t < 60000 ? lastTap : null;
  el.className = "pt-pop";
  el.setAttribute("aria-hidden", "true");
  el.textContent = `+${n} ⭐`;
  el.style.left = (tap ? tap.x : innerWidth / 2) + "px";
  el.style.top = (tap ? tap.y : innerHeight / 2) + "px";
  if (color) el.style.setProperty("--c", color);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ---------- 🎁 A parent's weekly prize (Sunday evening): +20 once a week, when they did 70% or more ----------
const PRIZE_POINTS = 20, PRIZE_PCT = 70;
// The day after this week's Sunday (so "this week" = from data.points.week up to, not including, this day)
function weekEnd() { const dt = fromYmd(data.points.week); dt.setDate(dt.getDate() + 7); return ymd(dt); }

// ---------- Good habits: points ----------
// One tick = 1 point · each prayer = 15 points · water = 1 point when all 6 drops are ticked
// (🕌 Prayers ticked before 2026-10-18 stay 1 point each, so older weeks and past Shining Stars don't change.)
const PRAYER_POINTS = 15;
const PRAYER_POINTS_FROM = "2026-10-18";
const prayerPointsOn = date => date >= PRAYER_POINTS_FROM ? PRAYER_POINTS : 1;
// date = the day of the tick ("2026-10-18")
function habitValuePoints(v, date, h) {
  return v === true ? (h && h.points) || 1 : Array.isArray(v) ? v.filter(Boolean).length * prayerPointsOn(date)
    : typeof v === "number" ? (v >= WATER_DROPS ? 1 : 0) : 0;
}
// A person's habit points between two dates (from ≤ day < to), e.g. this week
// (👨‍👩‍👧 Parents have no habits any more: their old "ph-…" ticks stay saved, but give no points.)
function habitPoints(user, from, to) {
  let total = 0;
  for (const [key, v] of Object.entries(data.habitMarks)) {
    const [date, id, who] = key.split("|");
    if (who !== user || date < from || date >= to || id.startsWith("ph-")) continue;
    total += habitValuePoints(v, date, data.habits.find(h => h.id === id));
  }
  return total;
}
// ---------- ⭐ SCORE (the new concept): 3 sub-scores from the calendar's activities by their TYPE, and one OVERALL ----------
// Each person, this week: 📚 Study (type "study") · ⚽ Activity (type "activity") · 🌱 Habit (type "habit"), each 0–100.
// ("other" is never scored. A parent's ➕ My activity (work / travel / other) isn't scored either.)
// OVERALL (v146) = 80% 📝 Marks (the average % of this week's checked worksheets) + 20% ✅ Ticks (study, activities and habits ticked) (a type with no items this week scores 0: the weights are never shared out).
// MAX = 100 × the weights of the types the person HAS items of this week (e.g. no habits → 90). Shown as "37 / 90".
// The leaderboard and the ⭐ Shining Star compare the OVERALL as it is (not divided by the max); a tie: whoever reached it first.
// (The old points are still collected: they grow the ✨ Spark and show in "✅ · ⭐ · 🧩", but they're not the score any more.)
const SCORE_WEIGHTS = { marks: 0.80, ticks: 0.20 };
// An activity's type: the one picked in ✏️ Add activities (older ones got theirs once, see defaultActType)
const actTypeOf = a => defaultActType(a);
const actTypeInfo = k => ACT_TYPES.find(t => t[0] === k) || ACT_TYPES[3];
// The score's parts: the activity types + 🎓 Level (not an activity type)
const scorePartInfo = k => k === "marks" ? ["marks", "📝", "Marks"] : k === "ticks" ? ["ticks", "✅", "Ticks"] : k === "level" ? ["level", "🎓", "Level"] : actTypeInfo(k);
// One type, one person, this week SO FAR: the planned items (days up to today; today's only once they've started, Dubai time)
// and how many of them are ticked ✅
function typeTally(id, type) {
  const days = planDays();
  let planned = 0, done = 0;
  if (!days) return { planned, done };
  const today = todayYmd(), now = dubaiMinutes(), acts = allActs();
  days.forEach(day => {
    if (day.date > today) return;
    day.items.forEach(it => {
      if (!it.users.includes(id) || (day.date === today && it.start > now)) return;
      const a = acts.find(x => x.id === it.actId);
      if (!a || actTypeOf(a) !== type) return;
      planned++;
      if (isDone(day.date, it.actId, id)) done++;
    });
  });
  return { planned, done };
}
const tallyPct = t => t.planned ? Math.round(t.done / t.planned * 100) : 0;
// ---------- 📚 STUDY SCORE (0–100) = ⏱️ HOURS (0–50) + 🎯 EFFICIENCY (0–50) ----------
// A study session = one planned calendar item of type "study" for that person this week (its activity has subjectId, studyMode,
// helper; minutes = end − start).
//   ⏱️ Hours = 50 × minutes of the sessions ticked ✅ ÷ minutes of ALL their study sessions this week (0 when none is planned).
//   🎯 Efficiency = 50 × Σ(session result % × its minutes) ÷ Σ(minutes of the sessions that have ENDED, or already have a result).
//      A session that ended without a result counts as 0 %.
//   A session's result (data.points.sessions["date|actId|person"] = { pct, by, at, ws?, note? }):
//      📖 Sole study → the % of its worksheet (✏️ Make my worksheet for this session, then ✅ the check);
//      🤝 With assistance → the helping parent's rating after it ends (😟 20 · 🙁 40 · 🙂 60 · 😀 80 · 🤩 100).
// One number for all subjects together; parents also see it per subject (📊 How are my kids doing? and the 🎒 subject page).
// ---------- 📚 STUDY SUBJECTS: a Study activity may have several subjects (or All my subjects); then the kid picks one for each session ----------
// The subjects an activity allows for one kid, from THEIR 🎒 School (shown ones only): [{ id, name, emoji, … }]
// (a saved id may be another kid's id for the same subject: matched by its name)
const subjectIdsOf = a => Array.isArray(a.subjectIds) && a.subjectIds.length ? a.subjectIds : a.subjectId ? [a.subjectId] : [];
function actSubjectsFor(a, kid) {
  const ids = subjectIdsOf(a), mine = subjectList(schoolOf(kid));
  if (ids.includes(ALL_SUBJECTS)) return mine;
  const out = [];
  ids.forEach(id => { const name = subjectNameOf([kid, ...a.users], id), x = mine.find(y => y.id === id) || (name && mine.find(y => sameSubject(y.name, name)));
    if (x && !out.includes(x)) out.push(x); });
  return out;
}
// "📐 Math, 📖 English" / "All my subjects" (for the activity lists)
function actSubjectsText(a) {
  const ids = subjectIdsOf(a);
  if (ids.includes(ALL_SUBJECTS)) return "All my subjects";
  return [...new Set(ids.map(id => subjectNameOf(a.users, id)).filter(Boolean))].join(", ");
}
// 📚 "Which subject today?": the kid (or a parent) picks one of the allowed subjects for that session → saved for it
function pickSessionSubject(key, sid) {
  const [date, actId, kid] = String(key).split("|"), a = allActs().find(x => x.id === actId);
  if (!a || !exists(kid) || (isKidDevice() && kid !== kidDeviceId()) || (!isParentId(me) && kid !== me)) return false;
  const x = actSubjectsFor(a, kid).find(o => o.id === sid);
  if (!x || !isYmd(date)) return false;
  data.points.picks[key] = { sid: x.id, name: x.name, by: me, at: new Date().toISOString() };
  writeData();
  return true;
}
// The question with the allowed subjects (chips); start = then 📚 Start session
const subjectPickHtml = (x, start) => `<span class="k-pick"><b>Which subject today?</b>${x.options.map(o =>
  `<button class="chip" data-sesspick="${safe(x.key)}|${safe(o.id)}${start ? "|start" : ""}">${safe(o.emoji)} ${safe(o.name)}</button>`).join("")}</span>`;
// 📚 Start session with no subject picked yet: ask first (a box with the subjects), then start
function askSessionSubject(x) {
  $("kCard").style.cssText = "--soft:#e0f2fe;--ink:#075985";
  $("kCard").innerHTML = `<div class="k-card-top"><div class="big">📚</div><div class="nm">Which subject today?</div></div>
    <p class="hint" style="text-align:center;margin:6px 16px">${safe(x.act.name)} · ${clock(x.start, true)}–${clock(x.end, true)}</p>
    <div class="btnrow pick-row">${x.options.map(o => `<button class="pill" data-sesspick="${safe(x.key)}|${safe(o.id)}|start">${safe(o.emoji)} ${safe(o.name)}</button>`).join("")}</div>
    <button class="k-ok" id="kOk">Cancel</button>`;
  $("kModal").hidden = false;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-sesspick]");
  if (!b) return;
  e.stopPropagation();
  const [date, actId, kid, sid, then] = b.dataset.sesspick.split("|"), key = `${date}|${actId}|${kid}`;
  if (!pickSessionSubject(key, sid)) return;
  closeCard();
  render();
  toast(`📚 ${data.points.picks[key].name} today!`, 2200);
  if (then === "start") leaveDraft(() => startSession(key));
}, true);
// The study sessions of a person in a week (week = its Monday). full = the whole week has ended (last week, on a new week).
function studySessions(id, week = data.points.week, full = false) { return sessionsIn(id, weekDates(week), full); }
// The study sessions of a person on some dates (📅 the plan by date): { key "date|actId|person", date, … }
function sessionsIn(id, dates, full = false) {
  if (!hasPlan()) return [];
  const today = todayYmd(), now = dubaiMinutes(), acts = allActs(), out = [];
  dates.forEach(date => planDay(date).items.forEach(it => {
    if (!it.users.includes(id)) return;
    const a = acts.find(x => x.id === it.actId);
    if (!a || actTypeOf(a) !== "study") return;
    const key = `${date}|${it.actId}|${id}`;
    // 📚 Its subject: the one the kid picked (several allowed), the only one allowed, or (none set) the older subject / the name
    const options = actSubjectsFor(a, id), pick = data.points.picks[key], picked = pick && options.find(o => o.id === pick.sid);
    const sub = picked || (options.length === 1 ? options[0] : null);
    out.push({ key, date, actId: it.actId, act: a, person: id, options, needsPick: options.length > 1 && !picked,
               subject: sub ? sub.name : options.length > 1 ? a.name : subjectNameOf(a.users, a.subjectId) || a.name, subjectId: sub ? sub.id : options.length > 1 ? "" : a.subjectId || "",
               mode: a.studyMode === "assisted" ? "assisted" : "sole", helper: a.studyMode === "assisted" ? a.helper || "" : "",
               start: it.start, end: it.end, minutes: Math.max(0, it.end - it.start), done: isDone(date, it.actId, id),
               ended: full || date < today || (date === today && it.end <= now), result: data.points.sessions[key] || null });
  }));
  return out;
}
// ⏱️ + 🎯 of some sessions: { planned, done (minutes), hours (0–50), eff (0–50), study = hours + eff }
function studyParts(list) {
  const mins = l => l.reduce((n, x) => n + x.minutes, 0), planned = mins(list), done = mins(list.filter(x => x.done));
  const counted = list.filter(x => x.ended || x.result), m = mins(counted);
  const hours = planned ? Math.round(50 * done / planned) : 0;
  const eff = m ? Math.round(50 * counted.reduce((n, x) => n + (x.result ? x.result.pct : 0) * x.minutes, 0) / 100 / m) : 0;
  return { planned, done, hours, eff, study: hours + eff };
}
// The week per subject (for the table and the 4-week history): { all, subjects: [{ name, planned, done, hours, eff, study }] }
function studyWeekOf(list) {
  const names = [...new Set(list.map(x => x.subject))];
  return { all: studyParts(list), subjects: names.map(name => ({ name, ...studyParts(list.filter(x => x.subject === name)) })) };
}

// ---------- 📚 Study sessions: 📚 Start session (📖 sole) · ⭐ the helper's rating (🤝 with assistance) ----------
// A session by its key "date|actId|person" (null when it isn't in the plan on that date)
const sessionByKey = key => { const [date, , who] = String(key).split("|"); return isYmd(date) ? sessionsIn(who || "", [date]).find(x => x.key === key) || null : null; };
// May I rate this 🤝 session? Its helper, or any parent when the helper isn't a parent of the family any more (a parent's device)
const canRate = x => x.mode === "assisted" && isParentId(me) && !isKidDevice() && (x.helper === me || !isParentId(x.helper));
const RATES = [[20, "😟"], [40, "🙁"], [60, "🙂"], [80, "😀"], [100, "🤩"]];
// Saves a session's result (0–100 %). 🧒 A kid's device: only that kid's own sessions.
function saveSession(key, pct, extra = {}) {
  if (isKidDevice() && key.split("|")[2] !== kidDeviceId()) return false;
  if (newWeek()) keepNow();
  data.points.sessions[key] = { pct: Math.max(0, Math.min(100, Math.round(pct))), by: me, at: new Date().toISOString(), ...extra };
  writeData();
  return true;
}
// On a card: "✅ 85%" (its result) · "⏳ 👩 Mum rates it" (🤝, ended, no rating yet)
function sessionTagText(x) {
  if (x.result) return `✅ ${x.result.pct}%${x.result.swap ? ` · 🔁 swapped to ${x.result.swap}` : ""}`;   // (🔁 another subject done in the session)
  const h = userById(x.helper);
  return x.mode === "assisted" && x.ended ? `⏳ ${h ? `${h.emoji} ${h.name}` : "A parent"} rates it` : "";
}
// (📚 Start session and ➕ More questions: see STUDY TOPICS)
// ⭐ The helper rates a 🤝 session (its % = the result)
function rateSession(key, pct) {
  const x = sessionByKey(key);
  if (!x || !canRate(x) || !RATES.some(r => r[0] === pct)) return;
  const note = (($("rateNote-" + key.replace(/[^A-Za-z0-9_-]/g, "_")) || {}).value || "").trim().slice(0, 80);
  saveSession(key, pct, note ? { note } : {});
  render();
  toast(`⭐ Saved: ${RATES.find(r => r[0] === pct)[1]} ${pct}% for ${userById(x.person).name}'s ${x.subject}`, 3000);
}
// 👨‍👩‍👧 On the helper's home: "⭐ Rate Bana's Math session" for every 🤝 session that ended without a rating
function rateCardsHtml() {
  if (!isParentDevice()) return "";
  // (📅 the last 7 days, today included: a Sunday session can still be rated on Monday)
  const list = kidsList().flatMap(k => sessionsIn(k.id, recentDates())).filter(x => x.ended && !x.result && canRate(x));
  return list.map(x => { const u = userById(x.person), id = x.key.replace(/[^A-Za-z0-9_-]/g, "_");
    return `<div class="card rate-card" style="--c:${colorsOf(u).color}"><h2>⭐ Rate ${safe(u.name)}'s ${safe(x.subject)} session</h2>
      <p class="hint">${x.date === todayYmd() ? "Today" : dayLong(x.date)} · ${clock(x.start, true)}–${clock(x.end, true)} · ${x.minutes} min · 🤝 with you</p>
      <div class="rate-btns">${RATES.map(([p, e]) => `<button data-sessrate="${safe(x.key)}|${p}" aria-label="${p}%"><span class="e">${e}</span><b>${p}</b></button>`).join("")}
        <button class="miss-btn" data-sessmiss="${safe(x.key)}" aria-label="Didn't happen"><span class="e">❌</span><b>Didn't happen</b></button></div>
      <input type="text" id="rateNote-${id}" maxlength="80" placeholder="A short note (optional)"></div>`; }).join("")
    // 📖 Sole study that ended with no worksheet: the parent can say it didn't happen too
    + kidsList().flatMap(k => sessionsIn(k.id, recentDates())).filter(x => x.mode === "sole" && x.ended && !x.result && !sessionWsIds(x.key).length).map(x => { const u = userById(x.person);
      return `<div class="card rate-card" style="--c:${colorsOf(u).color}"><h2>📚 ${safe(u.name)}'s ${safe(x.subject)} session · no worksheet</h2>
        <p class="hint">${x.date === todayYmd() ? "Today" : dayLong(x.date)} · ${clock(x.start, true)}–${clock(x.end, true)} · ${x.minutes} min</p>
        <div class="rate-btns"><button class="miss-btn" data-sessmiss="${safe(x.key)}" aria-label="Didn't happen"><span class="e">❌</span><b>Didn't happen</b></button></div></div>`; }).join("");
}
// ---------- ❌ A SESSION DIDN'T HAPPEN (parents): 📅 Move it to another day, or ⏭️ Skip it ----------
// Skip: it leaves that day's plan, so it doesn't count in the kid's 📚 Study at all (no booked minutes, no 0 %); nobody loses points.
// Move: the next free time this week, the same length, inside that day's hours, when the kid AND the helping parent are free and
// nothing (📌 one-day events too) is on: "Thu 5:00–5:45 pm, OK?" → it moves there (📌 pinned). Either way it never comes back on that date.
let miss = null;   // { key, slots: [{ date, start }], i }
function missSlots(x) {
  const a = x.act, len = x.end - x.start, pre = a.getReady || 0, post = a.breakAfter || 0, people = [x.person, ...(x.helper ? [x.helper] : [])];
  const today = todayYmd(), now = Math.ceil(dubaiMinutes() / 5) * 5, last = [addDaysYmd(weekEnd(), -1), (hasPlan() && data.plan.upTo) || today].sort()[0];
  const out = [];
  for (let ds = today; ds <= last && out.length < 20; ds = addDaysYmd(ds, 1)) {
    if (ds === x.date || planItemsOn(ds).some(it => it.actId === x.actId) || skippedOn(ds, x.actId)) continue;   // (never twice on one date)
    const day = planDay(ds), [ws, we] = day.window;
    const busy = [...day.items.filter(it => it.people.some(p => people.includes(p))).map(it => [it.start, it.end]),
                  ...day.routines.filter(r => r.users.some(p => people.includes(p))).map(r => [r.start, r.end]),
                  ...oneDayOn(ds).filter(e => e.who.some(p => people.includes(p))).map(e => [toMin(e.from), toMin(e.to)])];
    const from = ds === today ? Math.max(ws, now) : ws;   // (today: from now; its get ready inside the day too)
    for (let s = Math.ceil((from + pre) / 5) * 5; s + len + post <= we; s += 5) {
      if (busy.some(([b0, b1]) => b0 < s + len + post && s - pre < b1)) continue;
      out.push({ date: ds, start: s });
      s += 55;   // (the next offer: an hour later at least)
    }
  }
  return out;
}
function askMissed(key) {
  const x = sessionByKey(key);
  if (!x || !isParentDevice()) return;
  miss = { key, slots: null, i: 0 };
  $("kCard").style.cssText = "--soft:#fee2e2;--ink:#991b1b";
  $("kCard").innerHTML = `<div class="k-card-top"><div class="big">❌</div><div class="nm">${safe(userById(x.person).name)}'s ${safe(x.subject)} session didn't happen</div></div>
    <p class="hint" style="text-align:center;margin:6px 16px">${x.date === todayYmd() ? "Today" : dayLong(x.date)} · ${clock(x.start, true)}–${clock(x.end, true)}</p>
    <div class="btnrow pick-row"><button class="primary" data-missmove>📅 Move it to another day</button><button data-missskip>⏭️ Skip it</button></div>
    <p class="hint" style="text-align:center;margin:4px 16px">Skipped sessions don't count in the score. Nobody loses points.</p>
    <button class="k-ok" id="kOk">Cancel</button>`;
  $("kModal").hidden = false;
}
function showMissSlot() {
  const s = miss.slots[miss.i], x = sessionByKey(miss.key), len = x.end - x.start;
  $("kCard").innerHTML = `<div class="k-card-top"><div class="big">📅</div><div class="nm">${SHORT[weekdayOf(s.date)]} ${clock(s.start)}–${clock(s.start + len, true)}, OK?</div></div>
    <p class="hint" style="text-align:center;margin:6px 16px">${safe(dayLong(s.date))} · ${len} min${x.helper ? ` · ${safe(userById(x.person).name)} and ${safe(userById(x.helper).name)} are both free` : ""}</p>
    <div class="btnrow pick-row"><button class="primary" data-missok>✅ OK</button>${miss.i < miss.slots.length - 1 ? `<button data-missnext>🔁 Pick another time</button>` : ""}</div>
    <button class="k-ok" id="kOk">Cancel</button>`;
}
// Takes the session off its day (and keeps it off that date)
function takeOffDay(x, why) {
  const day = data.plan.dates[x.date];
  if (day) day.items = day.items.filter(it => it.actId !== x.actId);
  data.skips = { ...(data.skips || {}), [`${x.date}|${x.actId}`]: { by: me, at: new Date().toISOString(), why } };
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-sessmiss], [data-missmove], [data-missskip], [data-missok], [data-missnext]");
  if (!b || !isParentDevice()) return;
  const ds = b.dataset;
  if (ds.sessmiss) return askMissed(ds.sessmiss);
  const x = miss && sessionByKey(miss.key);
  if (!x || !hasPlan()) { closeCard(); return; }
  if ("missskip" in ds) {
    takeOffDay(x, "skip");
    closeCard(); miss = null; keepNow();
    return toast(`⏭️ Skipped. It doesn't count in ${userById(x.person).name}'s score.`, 3200);
  }
  if ("missmove" in ds) {
    miss.slots = missSlots(x); miss.i = 0;
    if (!miss.slots.length) { closeCard(); return toast("😕 No free time left this week for both of them. You can skip it instead.", 4000); }
    return showMissSlot();
  }
  if ("missnext" in ds) { miss.i = Math.min(miss.i + 1, miss.slots.length - 1); return showMissSlot(); }
  if ("missok" in ds) {
    const s = miss.slots[miss.i], len = x.end - x.start;
    takeOffDay(x, "moved");
    const to = data.plan.dates[s.date] = data.plan.dates[s.date] || { items: [] };
    to.items.push({ actId: x.actId, fixed: false, start: s.start, end: s.start + len, pinned: true });
    to.items.sort((p, q) => p.start - q.start);
    closeCard(); miss = null; keepNow();
    return toast(`📅 Moved to ${dayName(s.date)} ${clock(s.start, true)}.`, 3200);
  }
});
// 📊 Parents: a kid's study per subject THIS week (same formulas, only that subject's sessions) + the last 4 weeks (their 📚 /100).
// only = one subject's name (its 🎒 page). (The kid's ⭐ Study score stays ONE number for all subjects together.)
function studyTableHtml(kid, only) {
  const now = studyWeekOf(studySessions(kid)), pick = v => only ? v.subjects.filter(x => sameSubject(x.name, only)) : v.subjects;
  const weeks = [1, 2, 3, 4].map(i => { const d = fromYmd(data.points.week); d.setDate(d.getDate() - 7 * i); const wk = ymd(d); return { wk, v: data.points.studyWeeks[`${wk}|${kid}`] }; });
  const names = [...new Set([...pick(now).map(x => x.name), ...weeks.flatMap(w => w.v ? pick(w.v).map(x => x.name) : [])])];
  if (!names.length) return `<p class="sc-empty">No 📚 Study sessions${only ? ` for ${safe(only)}` : ""} this week or in the last 4 weeks.</p>`;
  const h = m => (Math.round(m / 6) / 10).toString(), find = (v, n) => v && v.subjects.find(x => sameSubject(x.name, n));
  const row = (label, x) => `<tr><th>${label}</th><td>${x ? h(x.planned) : "–"}</td><td>${x ? h(x.done) : "–"}</td><td>${x ? x.hours : "–"}</td><td>${x ? x.eff : "–"}</td><td><b>${x ? x.study : "–"}</b></td></tr>`;
  const cell = (w, n) => { const x = n ? find(w.v, n) : w.v && w.v.all; return `<td title="${x ? `⏱️ ${x.hours} + 🎯 ${x.eff}` : ""}">${x ? x.study : "–"}</td>`; };
  return `<div class="st-wrap"><table class="st-table"><thead><tr><th>Subject</th><th>⏱️ Planned h</th><th>Done h</th><th>⏱️ Hours /50</th><th>🎯 Efficiency /50</th><th>📚 Study /100</th></tr></thead>
    <tbody>${names.map(n => row(safe(n), find(now, n))).join("")}${!only && names.length > 1 ? row("All subjects", now.all.planned ? now.all : null) : ""}</tbody></table></div>
    <p class="st-hist-title">📅 The last 4 weeks (📚 Study /100)</p>
    <div class="st-wrap"><table class="st-table st-hist"><thead><tr><th>Subject</th>${weeks.map(w => { const a = fromYmd(w.wk); return `<th title="Week of ${safe(hallWeekRange(w.wk))}">${a.getDate()} ${MONTHS[a.getMonth()]}</th>`; }).join("")}</tr></thead>
    <tbody>${names.map(n => `<tr><th>${safe(n)}</th>${weeks.map(w => cell(w, n)).join("")}</tr>`).join("")}${!only && names.length > 1 ? `<tr><th>All subjects</th>${weeks.map(w => cell(w, null)).join("")}</tr>` : ""}</tbody></table></div>`;
}
// 📚 On the 🎒 subject page (and 🎒 My school / 📚 STUDY): today's sessions (and earlier ones without a result):
// 📚 Start session · 📝 Open my worksheet · 🙋 I'm done · ➕ More questions (while it lasts) · ✅ its result · 🔁 swapped
function sessionCardsHtml(kid, f) {
  // (📅 the last 7 days, today included)
  const today = todayYmd(), list = sessionsIn(kid, recentDates()).filter(x => x.mode === "sole" && x.date <= today && (!x.result || x.date === today)
    && (!f || x.subjectId === f.id || sameSubject(x.subject, f.name) || (x.needsPick && x.options.some(o => o.id === f.id)))   // (📚 not picked yet: on each allowed subject)
    && !(f && x.date === today && !x.ended && !sessionWsIds(x.key).length && !x.needsPick));   // (the subject page: today's 📚 Start session is the big button)
  return list.map(x => {
    // 📚 Several subjects, none picked yet: "Which subject today?" (a pick starts the session)
    if (x.needsPick && !sessionWsIds(x.key).length && !x.ended) return `<div class="card sess-card"><h2>📚 ${safe(x.act.name)} · ${x.minutes} min</h2>
      <p class="hint">${x.date === today ? "Today" : dayLong(x.date)} · ${clock(x.start, true)}–${clock(x.end, true)}</p>${subjectPickHtml(x, x.date === today)}</div>`;
    const ids = sessionWsIds(x.key), wsId = ids[ids.length - 1], w = wsId && aiDocs.worksheets[wsId], tag = sessionTagText(x);
    const swap = !x.result && ids.map(id => aiDocs.worksheets[id].swap).find(Boolean), live = x.date === today && !x.ended;
    const more = w && live && (w.answers.length || w.check || w.done);
    return `<div class="card sess-card"><h2>📚 ${f ? "Study session" : safe(x.subject)} · ${x.minutes} min${tag ? ` <span class="sess-res">${safe(tag)}</span>` : ""}</h2>
      <p class="hint">${x.date === today ? "Today" : dayLong(x.date)} ·${clock(x.start, true)}–${clock(x.end, true)}${swap ? ` · 🔁 swapped to ${safe(swap)}` : ""}</p>
      <div class="btnrow">${!w ? `<button class="primary" data-sessstart="${safe(x.key)}" data-aiwait="session|${safe(x.key)}">📚 Start session</button>`
        : `<button class="${more ? "" : "primary"}" data-aiopen="worksheet|${safe(wsId)}">📝 Open my worksheet</button>${
          more ? `<button class="primary" data-sessmore="${safe(x.key)}" data-aiwait="more|${safe(x.key)}">➕ More questions</button>`
          : live && !w.check ? `<button data-sessdone="${safe(wsId)}">🙋 I'm done</button>` : ""}`}</div></div>`;
  }).join("");
}
// ⚽ ACTIVITY sub-score (0–100). FOR NOW: % of this week's planned activity items (so far) that are ticked. (These rules will change later.)
function activityScore(id) { return tallyPct(typeTally(id, "activity")); }
// 🌱 HABIT sub-score (0–100). FOR NOW: % of this week's planned habit items (so far) that are ticked. (These rules will change later.)
function habitScore(id) { return tallyPct(typeTally(id, "habit")); }
// Everything for one person: the 3 sub-scores, which types they have items of, the OVERALL and their MAX
// 📚 Study = the planned sessions' score (0–100). (Since v145 the free-study worksheets count through ⚡ and 🎓, not here.)
// 🎓 Level = the average over the kid's subjects with a 🧠 learning profile of: (level × 10 + this week's average % of checked worksheets) / 2
//    (no checked worksheet this week in a subject → level × 10). No learning profile at all → no Level part ("–").
// ⚡ Extra = each free-study worksheet this week (not over the daily limit): +1 answers uploaded, then +2 (≥ 80 %) or +1 (50–79 %) once checked.
function levelScore(id) {
  const s = schoolOf(id), from = data.points.week, to = weekEnd();
  const subs = Object.entries(s.learn || {}).filter(([fid]) => s.subjects && s.subjects[fid]).map(([fid, L]) => {
    const f = s.subjects[fid], pcts = (L.history || []).filter(h => h.date >= from && h.date < to && typeof h.pct === "number").map(h => h.pct);
    const avg = pcts.length ? Math.round(pcts.reduce((n, x) => n + x, 0) / pcts.length) : null;
    return { id: fid, name: f.name, emoji: f.emoji || "📘", level: L.level, avg, score: Math.round(avg == null ? L.level * 10 : (L.level * 10 + avg) / 2) };
  });
  return { subs, score: subs.length ? Math.round(subs.reduce((n, x) => n + x.score, 0) / subs.length) : 0 };
}
function extraBonus(kid, from = data.points.week, to = weekEnd()) {
  const list = Object.entries(data.points.free).filter(([k, x]) => { const [date, , who] = k.split("|"); return who === kid && !x.capped && date >= from && date < to; }).map(([, x]) => x);
  const up = list.filter(x => x.up > 0);
  return { count: up.length, bonus: up.reduce((n, x) => n + 1 + (x.bonus >= FREE_POINTS.top ? 2 : x.bonus > 0 ? 1 : 0), 0) };
}
// 📝 Marks: every worksheet checked this week (planned sessions and extra ones), from the 🧠 learning profiles' history, each worksheet once
function scoreMarks(id) {
  const s = schoolOf(id), from = data.points.week, to = weekEnd(), seen = {};
  Object.entries(s.learn || {}).forEach(([fid, L]) => (L.history || []).forEach(h => {
    if (h.ws && h.date >= from && h.date < to && typeof h.pct === "number") seen[h.ws] = { pct: h.pct, fid };
  }));
  const list = Object.values(seen);
  return { count: list.length, avg: list.length ? Math.round(list.reduce((n, x) => n + x.pct, 0) / list.length) : null };
}
// ✅ Ticks: 📚 ⚽ 🌱 items this week; today's items count only once they're ticked (so the score never drops in the morning)
function ticksTally(id) {
  const days = planDays(), today = todayYmd(), acts = allActs();
  let planned = 0, done = 0;
  (days || []).forEach(day => {
    if (day.date > today) return;
    day.items.forEach(it => {
      if (!it.users.includes(id)) return;
      const a = acts.find(x => x.id === it.actId);
      if (!a || !["study", "activity", "habit"].includes(actTypeOf(a))) return;
      const ok = isDone(day.date, it.actId, id);
      if (day.date === today && !ok) return;
      planned++; if (ok) done++;
    });
  });
  return { planned, done };
}
function scoreOf(id) {
  const sessions = studySessions(id), sp = studyParts(sessions);
  const fs = freeStudy(id), free = { ...fs, bonus: 0 }, lv = levelScore(id), mk = scoreMarks(id), tk = ticksTally(id);
  const study = sessions.length ? Math.min(100, sp.study) : 0;
  const subs = { marks: mk.avg || 0, ticks: tk.planned ? Math.round(tk.done / tk.planned * 100) : 0 };
  const has = { marks: mk.count > 0, ticks: tk.planned > 0 };
  const overall = Math.round(Object.keys(SCORE_WEIGHTS).reduce((s, k) => s + SCORE_WEIGHTS[k] * subs[k], 0));
  const max = Math.round(100 * Object.keys(SCORE_WEIGHTS).reduce((s, k) => s + (has[k] ? SCORE_WEIGHTS[k] : 0), 0));
  return { ...subs, study, level: lv.score, activity: activityScore(id), habit: habitScore(id), has, base: overall, overall, max,
           sp: sessions.length ? sp : null, free, levels: lv.subs, extra: { count: 0, bonus: 0 }, marksCount: mk.count, tk };
}
// "37 / 90"
const scoreText = s => `${s.overall} / ${s.max}${s.extra && s.extra.bonus ? ` (⚡ +${s.extra.bonus})` : ""}`;
// The small bars: 📝 Marks (with each subject under it) · ✅ Ticks (a part with nothing this week: "–")
function subBarsHtml(s) {
  return `<div class="score-subs">${Object.keys(SCORE_WEIGHTS).map(k => { const [, e, w] = scorePartInfo(k), on = s.has[k];
    return `<div class="score-sub ${on ? "" : "none"}"><span class="score-sub-l">${e} ${w}</span><span class="score-sub-bar"><i style="width:${on ? Math.min(100, s[k]) : 0}%"></i></span><b>${on ? s[k] + "%" : "–"}</b></div>${
      k === "marks" && on ? `<div class="score-parts">📝 ${s.marksCount} ${s.marksCount === 1 ? "worksheet" : "worksheets"} checked this week (average ${s.marks}%)</div>${
        (s.levels || []).filter(x => x.avg != null).map(x => `<div class="score-parts">${safe(x.emoji)} ${safe(x.name)} · ${x.avg}% · Level ${x.level}/10</div>`).join("")}` : ""}${
      k === "ticks" && on && s.tk ? `<div class="score-parts">✅ ${s.tk.done} of ${s.tk.planned} ticked</div>` : ""}`; }).join("")}</div>`;
}
// The overall, big ("⭐ Score 37 / 90 ⚡ +6"), with the bars under it
const scoreBlockHtml = s => `<div class="score-total"><small>⭐ Score</small><b>${s.overall}</b><small>/ ${s.max}${s.extra && s.extra.bonus ? ` · ⚡ +${s.extra.bonus}` : ""}</small></div>${subBarsHtml(s)}`;
// Everyone's score this week (kept the old name: the leaderboard, ⭐ star, Hall of Stars, history and reports all read it):
// { id: { fair: the OVERALL, max, study, activity, habit, has, raw: the old points (only for showing), possible: max } }
// (👨‍👩‍👧 only kids: parents have no score)
function fairInfo() {
  const pts = pointsByUser(), out = {};
  scoredUsers().forEach(u => { const s = scoreOf(u.id); out[u.id] = { ...s, fair: s.overall, possible: s.max, raw: pts[u.id] || 0 }; });
  return out;
}
const fairScores = () => Object.fromEntries(Object.entries(fairInfo()).map(([id, x]) => [id, x.fair]));
// When each person reached their fair score (now, if it changed): → true when something was written down
function updateReach(fair = fairScores()) {
  let changed = false;
  scoredUsers().forEach(u => {
    const k = `${data.points.week}|${u.id}`, r = data.points.reach[k];
    if (!r || r.s !== fair[u.id]) { data.points.reach[k] = { s: fair[u.id], at: new Date().toISOString() }; changed = true; }
  });
  return changed;
}
// The leaderboard order: the fair score, then whoever reached it first
function fairOrder(fair = fairScores()) {
  const at = id => { const r = data.points.reach[`${data.points.week}|${id}`]; return r && r.s === fair[id] && r.at ? r.at : "~"; };
  return [...scoredUsers()].sort((a, b) => fair[b.id] - fair[a.id] || at(a.id).localeCompare(at(b.id)));
}
// ⭐ The Shining Star of the week: decided on Friday 6 PM (see maybeDecideStar); before that there's none, only 🔥 the leader
function stars() {
  const r = data.points.prizeMsg[data.points.week];
  return r && r.star ? r.star.split(",").filter(id => exists(id) && !isParentId(id)) : [];   // (👨‍👩‍👧 an older parent star isn't shown)
}
// 🔥 First place right now: the best fair score (more than 0); a tie: whoever reached it first
// (two people only share it when they reached it at the very same moment)
function leaders() {
  const fair = fairScores(), order = fairOrder(fair), top = order[0];
  if (!top || !(fair[top.id] > 0)) return [];
  const r = id => (data.points.reach[`${data.points.week}|${id}`] || {});
  const sameTime = order.filter(u => fair[u.id] === fair[top.id] && r(u.id).s === fair[u.id] && r(u.id).at && r(u.id).at === r(top.id).at);
  return sameTime.length ? sameTime.map(u => u.id) : [top.id];
}
const starBadge = id => stars().includes(id) ? `<span class="star-badge" aria-label="Shining Star of the Week">🌟</span>` : "";

// Every Monday: remember last week's star(s), then start again from zero.
function newWeek() {
  const thisWeek = mondayOf(new Date());
  if (data.points.week === thisWeek) return false;
  // (nobody opened the app after Friday 6 PM: the star is the leader now)
  const totals = pointsByUser(), win = stars().length ? stars() : leaders(), fair = fairScores(), best = win.length ? totals[win[0]] : 0;
  // 🌱 Bank last week's points for the buddies (one item per week and person: the same on every phone)
  scoredUsers().forEach(u => { if (totals[u.id] > 0) data.points.lifetime[`${data.points.week}|${u.id}`] = totals[u.id]; });   // (kids only)
  // 📚 Keep last week's study (all subjects and each subject) for the 4-week history, before its ticks are cleared below
  kidsList().forEach(u => { const list = studySessions(u.id, data.points.week, true);
    if (list.length && !data.points.studyWeeks[`${data.points.week}|${u.id}`]) data.points.studyWeeks[`${data.points.week}|${u.id}`] = studyWeekOf(list); });
  // ⭐ The star(s) by the ⚖️ fair score; the history keeps their raw points (and the fair score)
  if (win.length && !data.points.hall[data.points.week]) hallSave(data.points.week, win[0]);   // 🏆
  if (win.length) data.points.history.unshift({
    week: data.points.week, points: best, fair: fair[win[0]], max: scoreOf(win[0]).max,
    // (each winner's ✅ ⭐ 🧩 too; older history has only the total)
    winners: data.users.filter(u => win.includes(u.id)).map(u => ({ id: u.id, name: u.name, emoji: u.emoji, kinds: weekKinds(u.id) }))
  });
  data.points.history = data.points.history.slice(0, 104); // keep about two years
  // 🎁 Nobody opened the app on Friday night: the parents get the star's prize message now
  // 📅 Ticks are by date now, so they simply stay (the calendar's past days, "Last week's achievements"); ticks older than 5 weeks are forgotten.
  // (data.points.log is the list older versions kept of past weeks' ticks: it's only read now, and forgotten after 5 weeks too.)
  const cut = new Date(); cut.setDate(cut.getDate() - 35);
  Object.keys(data.points.marks).forEach(key => { if (markDate(key) < ymd(cut)) delete data.points.marks[key]; });
  data.points.log = data.points.log.filter(t => t.date >= ymd(cut));
  Object.keys(data.habitMarks).forEach(key => { if (key.slice(0, 10) < ymd(cut)) delete data.habitMarks[key]; });  // habits: 5 weeks too
  Object.keys(data.points.auto).forEach(key => { if (key.slice(0, 10) < ymd(cut)) delete data.points.auto[key]; });  // 👨‍👩‍👧 auto points too
  ["riddles", "riddleAns"].forEach(k => Object.keys(data.points[k]).forEach(key => { if (key.slice(0, 10) < ymd(cut)) delete data.points[k][key]; }));  // 🧩 too
  const half = new Date(); half.setDate(half.getDate() - 180);   // 📔 My day: about 6 months
  Object.keys(data.points.diary).forEach(key => { if (key.slice(0, 10) < ymd(half)) delete data.points.diary[key]; });
  Object.keys(data.points.wishes).forEach(key => { if (key.slice(0, 10) < ymd(half)) delete data.points.wishes[key]; });   // 💌 too
  Object.keys(data.points.study).forEach(key => { if (key.slice(0, 10) < ymd(half)) delete data.points.study[key]; });   // 🎒 too
  Object.keys(data.points.sessions).forEach(key => { if (key.slice(0, 10) < ymd(half)) delete data.points.sessions[key]; });   // 📚 too
  Object.keys(data.points.free).forEach(key => { if (key.slice(0, 10) < ymd(half)) delete data.points.free[key]; });   // ⭐ free study too
  Object.keys(data.points.picks).forEach(key => { if (key.slice(0, 10) < ymd(half)) delete data.points.picks[key]; });   // 📚 subject picks too
  const eightW = new Date(); eightW.setDate(eightW.getDate() - 56);   // 📚 the study history: 8 weeks
  Object.keys(data.points.studyWeeks).forEach(key => { if (key.slice(0, 10) < ymd(eightW)) delete data.points.studyWeeks[key]; });
  Object.entries(data.points.community).forEach(([id, p]) => { if ((p.at || "").slice(0, 10) < ymd(half)) {   // 🏡 too (with its reactions and ✅)
    delete data.points.community[id]; delete data.points.cmDone[id];
    Object.keys(data.points.cmReact).forEach(k => { if (k.split("|")[0] === id) delete data.points.cmReact[k]; }); } });
  Object.keys(data.points.duties).forEach(key => { if (key.slice(0, 10) < ymd(cut)) delete data.points.duties[key]; });   // ✅ 5 weeks
  ["quranHeard", "chores", "when"].forEach(k => Object.keys(data.points[k]).forEach(key => { if (key.slice(0, 10) < ymd(cut)) delete data.points[k][key]; }));   // ☰ 5 weeks
  const eight = new Date(); eight.setDate(eight.getDate() - 56);   // 🗣️ meetings: 8 weeks
  ["meeting", "want", "notes", "prizeMsg", "reach"].forEach(k => Object.keys(data.points[k]).forEach(key => { if (key.slice(0, 10) < ymd(eight)) delete data.points[k][key]; }));
  // (🎁 prizes are kept, like the past Shining Stars: about two years)
  Object.keys(data.points.prizes).sort().reverse().slice(104 * 2).forEach(key => delete data.points.prizes[key]);
  data.points.week = thisWeek;   // (the ticks stay: this week's points only count this week's dates, see weekMarks)
  return true;
}

// Tapping a "done" checkbox (one person's part of an activity). Kids: only their own. Dad: anyone's.
// Not on days that haven't come yet.
// ⏰ Minutes since midnight in Dubai now; and an activity's lock: its start (minutes) while a kid can't tick it yet, else null
function dubaiMinutes() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}
// ⏰ EVERYONE (kids and parents): an activity can't be ticked before its start time today (Dubai time); later today and past days: fine.
// (Future days are locked for everyone too. Habits, prayers and 📔 My day are not affected.)
const tickTimeLock = (date, start) => date === todayYmd() && start >= 0 && start > dubaiMinutes() ? start : null;
// 👨‍👩‍👧 A parent (on a parent's device) may tick or untick a kid's activity that has already started, on an earlier day of this week too.
// The tick says who did it (by) and counts for the kid exactly like their own. (Kids: today only, and never before the start time.)
const parentPastTick = (date, user) => isParentDevice() && exists(user) && !isParentId(user) && date >= data.points.week && date <= todayYmd();
// day = the date ("2026-10-23"). 📅 Past days are look-only (their ticks stay as they were).
function toggleDone(day, actId, user, button) {
  if (editMode) return toast("Tap ✅ Done first, then you can tick.");
  if (newWeek()) { keepNow(); return toast("🌅 A new week started! Points are back to zero."); }
  if (!isYmd(day)) return;
  const act = allActs().find(a => a.id === actId), pact = !act && (data.parentActs || []).find(a => a.id === actId);
  if (pact) {   // 👨‍👩‍👧 a parent's ➕ My activity: only that parent ticks it (kids just look)
    if (pact.by !== user || pact.type === "travel" || !pactStartOn(pact, day)) return;
    if (user !== me || isKidDevice()) return toast(`Only ${userById(user).name} can tick this. 👀`);
  } else if (!act || !act.users.includes(user)) return;
  if (!(isParentId(me) || user === me)) return toast("You can only tick your own activities.");
  if (isParentId(user)) return;   // (👨‍👩‍👧 parents aren't scored: no tick for points on their own activities)
  if (day > todayYmd()) return toast(`Not yet! You can tick it on ${dayName(day)}.`);
  // 📅 Past days: look-only, except 👨‍👩‍👧 a parent's device may tick / untick a kid's activity on an earlier day of THIS week
  if (day < todayYmd() && !parentPastTick(day, user)) return toast("📅 Past days are just for looking.");
  const owner = userById(user), key = markKey(day, actId, user);
  if (data.points.marks[key]) {
    delete data.points.marks[key];   // ticked by mistake: take it back
    keepNow();                       // ticks are kept right away (no Save needed)
    return toast(`Unticked. −${POINTS_EACH} points for ${owner.name}.`);
  }
  // ⏰ Nobody (kids or parents) ticks before the activity's start time (Dubai time): a planned one, or a parent's ➕ My activity
  const it = act && planDay(day).items.find(x => x.actId === actId && x.users.includes(user));
  const lockAt = it ? tickTimeLock(day, it.start) : pact && pact.from ? tickTimeLock(day, toMin(pact.from)) : null;
  if (lockAt != null) return toast(`⏰ You can tick this at ${clock(lockAt, true).toUpperCase()}`, 2800);
  const wasStar = stars().includes(owner.id);
  data.points.marks[key] = { user: owner.id, by: me, at: new Date().toISOString() };
  keepNow();
  const nowStar = !wasStar && stars().includes(owner.id);
  const r = button.getBoundingClientRect();
  celebrate(r.left + r.width / 2, r.top + r.height / 2, colorsOf(owner).color, nowStar);
  toast(`Great job, ${owner.name}! +${POINTS_EACH} points ⭐` + (nowStar ? " You're the Shining Star! 🌟" : ""), 3200, colorsOf(owner).color);
}

// Confetti and stars bursting out of the checkbox
function celebrate(x, y, color, big) {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  const colors = [color, "#facc15", "#f472b6", "#60a5fa", "#34d399", "#fb923c"];
  const n = big ? 48 : 30;
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2, dist = 80 + Math.random() * (big ? 260 : 170);
    const star = i % 3 === 0;
    const el = document.createElement(star ? "span" : "i");
    if (star) { el.textContent = ["⭐", "✨", "🌟", "🎉"][i % 4]; el.style.setProperty("--s", (18 + Math.random() * 18) + "px"); }
    el.style.setProperty("--x", x + "px");
    el.style.setProperty("--y", y + "px");
    el.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    el.style.setProperty("--dy", Math.sin(angle) * dist + 60 + "px");  // + a little gravity
    el.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    el.style.setProperty("--c", colors[i % colors.length]);
    box.appendChild(el);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1500);
}
