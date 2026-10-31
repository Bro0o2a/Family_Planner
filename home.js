// =====================================================================
//  🧒 KIDS' HOME = SUPER SIMPLE: day + date, hello with ✨ the Spark (+ the encouraging line in the top bar),
//   two BIG buttons (📚 STUDY → 🎒 My school · 📅 CALENDAR → my calendar, today), "📊 My week" (words next to every symbol),
//   then a small bottom bar for the rest: 🏆 Points · ⭐ Habits · 📔 My day · 🏡 Community · 👤 Me · ☰ More.
//   (⭐ Habits opens my habits and 🧹 duties right here. The 🧩 riddle still pops up when the app opens.)
// =====================================================================
let kidPanel = null;   // the part opened from the bottom bar on the home: "habits" | null
function drawKidHome(u) {
  const p = lifetimePoints(u.id), L = levelOf(p), pct = levelPct(p), from = data.points.week, to = weekEnd();
  const today = todayItems(u.id), doneToday = today.filter(x => isDone(todayYmd(), x.id, u.id)).length;
  const free = freeStudy(u.id), study = homeworkPoints(u.id, from, to) + studyPoints(u.id, from, to) + free.points;   // (⭐ free study in 📚 Study too)
  $("homeNote").hidden = true;
  $("homeBig").hidden = false;
  $("homeBig").className = "kid-big";
  $("homeBig").innerHTML = `<button class="kb kb-study" data-school="${safe(u.id)}"><span class="e">📚</span><b>STUDY</b><small>My school</small></button>
    <button class="kb kb-cal" data-kidcal><span class="e">📅</span><b>CALENDAR</b><small>Today</small></button>`;
  $("homeMenu").hidden = true;
  const bar = [["data-go=\"points\"", "🏆", "Points"], ["data-kidpanel=\"habits\"", "⭐", "Habits"], ...(feat("diary") ? [["data-go=\"diary\"", "📔", "My day"]] : []),
               ...(feat("meeting") ? [[`data-extra="meeting"`, "🏡", "Community"]] : []), ["data-profile", "👤", "Me"], ["data-homemore", "☰", "More"]];
  $("homeHabits").innerHTML = (u.buddy || !feat("buddy") ? "" : buddyCardHtml(me))
    + `<div class="card kid-week" style="--c:${colorsOf(u).color}"><h2>📊 My week</h2><p>
      <span>⭐ Score ${scoreText(scoreOf(u.id))}</span> · <span>✅ Tasks ${doneToday} of ${today.length} today</span> · <span>📚 Study ${study}</span>
${feat("buddy") ? ` · <span>✨ Spark Lv ${L} (${pct}% to Lv ${L + 1})</span>` : ""}</p>${free.count ? `<p class="kid-free">${freeLine(free)}</p>` : ""}</div>
    <nav class="kid-bar" aria-label="More">${bar.map(([attr, e, label]) => `<button ${attr} class="${(attr.includes("habits") && kidPanel === "habits") || (attr === "data-homemore" && homeMore) ? "on" : ""}"><span class="e">${e}</span><small>${label}</small></button>`).join("")}</nav>
    ${kidPanel === "habits" ? habitsCardHtml(me) + (feat("chores") ? choresTodayHtml(me) : "") || `<div class="card"><p class="sc-empty">No habits today.</p></div>` : ""}
    ${homeMore ? `<div class="menu kid-more">${moreTilesHtml()}</div>` : ""}`;
  $("homeCal").innerHTML = "";
  maybeMakeRiddles();
  maybeShowTour();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#scr-home [data-kidpanel], #scr-home [data-kidcal]");
  if (!b) return;
  if ("kidcal" in b.dataset) { go("mine"); calWho = me; return render(); }   // 📅 my own calendar, today
  kidPanel = kidPanel === b.dataset.kidpanel ? null : b.dataset.kidpanel;
  homeMore = false;
  render();
});
// ☰ More: everything that isn't on the Today screen
// (☰ More is only 👤 My profile · 🔒 Your privacy · 👋 Show the tour; a parent's other pages are in their Family tiles and 👨‍👩‍👧 Family settings)
let homeMore = false;
const tileHtml = t => `<button class="tile ${t.cls || ""}" ${t.attr ? t.attr : t.plan ? "data-plan" : t.extra ? `data-extra="${t.extra}"`
  : t.tour ? "data-tour" : t.privacy ? "data-privacy" : t.profile ? "data-profile" : t.signout ? "data-signout" : `data-go="${t.go}"`}>
    <span class="t-emoji">${t.emoji}</span><span class="t-label">${t.label}</span><span class="t-sub">${t.sub}</span></button>`;
const TOUR_TILE = { tour: true, emoji: "👋", label: "Show the tour", sub: "How the app works" };
const PRIVACY_TILE = { privacy: true, emoji: "🔒", label: "Your privacy", sub: "Who can see your data" };
const PROFILE_TILE = { profile: true, emoji: "👤", label: "My profile", sub: "My Spark, birthday, things I love" };
// =====================================================================
//  👨‍👩‍👧 THE PARENT'S HOME (see drawHome): 🔔 Needs you · a card per kid → 👧 the Kid page · the Family row · ✏️ Add / Plan · ☰ More
// =====================================================================
let homeAddPlan = false, needsOpen = null;   // the ✏️ Add / Plan menu is open · "Needs you": null | "list" | one thing's key
// What needs a parent now: ⭐ sessions to rate (and ❌ sessions without a worksheet), 🧒 a kid's setup, 🗓️ the plan, 📰 newsletters
function needsItems() {
  const out = [], rate = rateCardsHtml(), nRate = (rate.match(/class="card rate-card"/g) || []).length;
  if (nRate) out.push({ key: "rate", text: `⭐ ${nRate} ${nRate === 1 ? "session" : "sessions"} to rate`, html: rate });
  const setup = kidSetupHtml();
  if (setup) out.push({ key: "setup", text: "🧒 Finish a kid's setup", html: setup });
  if (isParentId(me) && (!hasPlan() || planIsOld())) out.push({ key: "plan", text: !hasPlan() ? "🗓️ No plan yet" : "🗓️ Things changed: plan again",
    html: `<div class="card"><p>${!hasPlan() ? "🗓️ No plan yet. Add activities, then press ✨ Plan my week." : "⚠ Things changed since your last plan. Press ✨ Plan my week to update it."}</p>
      <div class="btnrow"><button class="primary" data-plan>✨ Plan my week</button><button data-go="add">✏️ Add activities</button></div></div>` });
  const nl = newsletterDue();
  if (nl.length) out.push({ key: "nl", text: `📰 Newsletter for ${nl.map(k => k.name).join(", ")}`, html: newsletterNudgeHtml() });
  return out;
}
function needsLineHtml() {
  const list = needsItems();
  if (needsOpen && needsOpen !== "list" && !list.some(x => x.key === needsOpen)) needsOpen = null;
  if (!list.length) return "";
  const one = list.length === 1, open = needsOpen === "list" || (one && needsOpen === list[0].key) || list.some(x => x.key === needsOpen);
  const head = `<button class="needs-line ${open ? "on" : ""}" data-needs="${one ? list[0].key : "list"}" aria-expanded="${open}">
    ${one ? safe(list[0].text) : `🔔 ${list.length} things need you`}<span aria-hidden="true">${open ? "▲" : "›"}</span></button>`;
  const shown = list.find(x => x.key === needsOpen);
  return `<div class="needs">${head}${needsOpen === "list" && !one ? `<div class="needs-list">${list.map(x => `<button data-needs="${x.key}">${safe(x.text)} ›</button>`).join("")}</div>` : ""}
    ${shown ? `<div class="needs-panel">${shown.html}</div>` : ""}</div>`;
}
// 🎯 The score ring (0–100) in the kid's colour
function scoreRingHtml(n, color) {
  const C = 2 * Math.PI * 44;
  return `<span class="kc-ring" role="img" aria-label="Score ${n} this week" style="--c:${color}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="bu-trk"/>
    <circle cx="50" cy="50" r="44" class="kc-bar" style="stroke-dasharray:${(C * Math.min(n, 100) / 100).toFixed(1)} ${C.toFixed(1)}"/></svg><b>${n}</b></span>`;
}
// "Today 3 of 5 done · next Math 4:00" · "All finished ✅" · "Nothing today"
function kidTodayLine(kid) {
  const date = todayYmd(), now = dubaiMinutes(), items = todayItems(kid), done = items.filter(x => isDone(date, x.id, kid)).length;
  if (!items.length) return "Nothing today";
  if (done === items.length) return "All finished ✅";
  const next = items.find(x => !isDone(date, x.id, kid) && x.end > now && x.start >= 0);
  return `Today ${done} of ${items.length} done${next ? ` · next ${next.name} ${clock(next.start)}` : ""}`;
}
// ONE CARD PER KID: the score ring, name + today's mood, today's line, 🎒 School · 📅 Calendar · 📊 Report. The card itself → the Kid page
function kidCardHtml(k) {
  const c = colorsOf(k), sc = scoreOf(k.id), e = feat("diary") ? diaryOf(k.id, todayYmd()) : null;
  return `<div class="card kid-card" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
    <button class="kc-open" data-kidpage="${safe(k.id)}" aria-label="${safe(k.name)}: all about ${safe(k.name)}">${scoreRingHtml(sc.overall, c.color)}
      <span class="kc-text"><b>${safe(k.emoji)} ${safe(k.name)}${e && moodFace(e.mood) ? ` <span class="kc-mood" title="Today's mood">${moodFace(e.mood)}</span>` : ""}</b>
        <small>${safe(kidTodayLine(k.id))}</small></span><span class="kc-go" aria-hidden="true">›</span></button>
    <div class="kc-btns"><button data-school="${safe(k.id)}">🎒 School</button><button data-viewcal="${safe(k.id)}">📅 Calendar</button><button data-kidreport="${safe(k.id)}">📊 Report</button></div></div>`;
}
// The Family row: 4 small square buttons
function familyRowHtml() {
  const n = feat("meeting") ? cmNewCount() : 0;
  return `<div class="fam-row">
    <button data-calall><span class="e">📅</span><small>Family calendar</small></button>
    <button data-homeaddplan class="${homeAddPlan ? "on" : ""}" aria-expanded="${homeAddPlan}"><span class="e">✏️</span><small>Add / Plan</small></button>
    ${feat("meeting") ? `<button data-extra="meeting"><span class="e">🏡</span><small>Community${n ? ` <b class="fr-new">${n} new</b>` : ""}</small></button>` : ""}
    <button data-homemore class="${homeMore ? "on" : ""}" aria-expanded="${homeMore}"><span class="e">☰</span><small>More</small></button></div>`;
}
// ✏️ Add / Plan: Add activities · ✨ Plan my week · 📌 One-day event · 🔄 Make a new plan
function addPlanMenuHtml() {
  return [{ go: "add", emoji: "✏️", label: "Add activities", sub: "Yours and everyone's" },
    ...(isParentId(me) ? [{ plan: true, emoji: "✨", label: "Plan my week", sub: "Plans for everyone", cls: "primary" }] : []),
    { attr: "data-onedaynew", emoji: "📌", label: "One-day event", sub: "Only on one date" },
    ...(hasPlan() ? [{ attr: "data-newplan", emoji: "🔄", label: "Make a new plan", sub: "From today, ticks stay" }] : [])].map(tileHtml).join("");
}
// ☰ More (a parent): 📄 Family summary · 📊 How are my kids doing? · 🧹 Home duties · 📔 My day · 👤 My profile · 💾 Backup ·
// 🔒 Your privacy · 👋 Show the tour · ✏️ Edit my home (and 🏆 Points, 👀 Your kids' work today: nothing that was on the home is lost)
function parentMoreHtml() {
  return `${fsButtonsHtml()}` + [
    { attr: "data-report", emoji: "📊", label: "How are my kids doing?", sub: "All the kids" },
    ...(feat("chores") ? [{ extra: "chores", emoji: "🧹", label: "Home duties", sub: "Jobs at home" }] : []),
    ...(feat("diary") ? [{ attr: 'data-dyopen=""', emoji: "📔", label: "My day", sub: "How do you feel today?" }] : []),
    { attr: 'data-go="kidswork"', emoji: "👀", label: "Your kids' work today", sub: "Live, as they do it" },
    { attr: 'data-go="points"', emoji: "🏆", label: "Points", sub: "The kids' week" },
    { ...PROFILE_TILE, sub: "My settings, my picture" },
    ...(isParentId(me) ? [{ attr: "data-backup", emoji: "💾", label: "Backup", sub: "Save or load the family's data" }] : []),
    PRIVACY_TILE, TOUR_TILE, { attr: "data-setupopen", emoji: "✏️", label: "Edit my home", sub: "Features on / off" }].map(tileHtml).join("");
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-needs], [data-homeaddplan], [data-kidpage], [data-kidreport]");
  if (!b) return;
  const ds = b.dataset;
  if (ds.needs) { needsOpen = needsOpen === ds.needs || (ds.needs === "list" && needsOpen) ? null : ds.needs; return render(); }
  if ("homeaddplan" in ds) { homeAddPlan = !homeAddPlan; homeMore = false; return render(); }
  if (ds.kidpage) return openKidPage(ds.kidpage);
  if (ds.kidreport) { rpKid = ds.kidreport; return openReport(); }
});

// =====================================================================
//  👧 THE KID PAGE (a parent's device): everything about one kid — this week's score (📚 Study · ⚽ Activity · 🌱 Habit), today's list
//  (parents tick; earlier days of this week on 📅 Calendar), 👀 their work today (live), ⭐ habits, ✅ duties, 💌 wishes, 🌟 prize,
//  📔 moods and the 📊 report. ⬅️ Back → home.
// =====================================================================
let kidPage = null;
function openKidPage(id) {
  if (!isParentDevice() || !exists(id) || isParentId(id)) return;
  kidPage = id; homeMore = homeAddPlan = false;
  go("kid");
}
// Today's list for one kid, with ✅ ticks (a parent ticks for the kid; ⏰ not before the start)
function kidTodayHtml(k) {
  const d = todayYmd(), all = todayItems(k.id), c = colorsOf(k);
  return `<div class="card td-card" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}"><div class="sc-head"><h2>📋 Today</h2>
    <span class="td-count">${all.filter(x => isDone(d, x.id, k.id)).length} / ${all.length} ✓</span></div>
    ${all.length ? all.map(x => { const on = isDone(d, x.id, k.id), lock = !on && tickTimeLock(d, x.start) != null;
      return `<div class="td-row ${on ? "done" : ""}"><button class="k-check td-check ${on ? "on" : ""} ${lock ? "time-lock" : ""}" data-check="${d}|${safe(x.id)}|${safe(k.id)}" style="--c:${c.color}"
        aria-pressed="${on}" aria-label="${safe(`${on ? "Done" : lock ? `Locked until ${clock(x.start, true)}` : "Tap when done"}: ${x.name}`)}">${on ? "✓" : lock ? "🔒" : ""}</button>
        <span class="td-what"><b>${safe(x.name)}</b><small>${x.start >= 0 ? `${clock(x.start)} – ${clock(x.end)}` : "All day"}</small></span></div>`; }).join("")
      : `<p class="sc-empty">Nothing today. 🎈</p>`}
    <div class="td-more"><button class="linkbtn" data-viewcal="${safe(k.id)}">📅 The week (tick earlier days) ›</button></div></div>`;
}
function drawKidPage() {
  if (!isParentDevice() || !exists(kidPage) || isParentId(kidPage)) return go("home");
  const k = userById(kidPage), c = colorsOf(k), sc = scoreOf(k.id), st = weekStats(k.id), e = feat("diary") ? diaryOf(k.id, todayYmd()) : null;
  const items = kidsWorkItems(), mine = items.filter(x => x.kid === k.id), want = weekItem("want", k.id);
  $("kidBody").innerHTML = `
    <div class="card kp-top" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
      <div class="kp-head">${scoreRingHtml(sc.overall, c.color)}<div><h1>${safe(k.emoji)} ${safe(k.name)}${e && moodFace(e.mood) ? ` ${moodFace(e.mood)}` : ""}</h1>
        <small>${safe(kidTodayLine(k.id))}</small></div></div>
      ${scoreBlockHtml(sc)}${sc.free && sc.free.count ? `<p class="kid-free">${freeLine(sc.free)}</p>` : ""}
      <div class="kc-btns"><button data-school="${safe(k.id)}">🎒 School</button><button data-viewcal="${safe(k.id)}">📅 Calendar</button><button data-profile="${safe(k.id)}">👤 Profile</button></div></div>
    ${kidTodayHtml(k)}
    <h2 class="kp-h">👀 ${safe(k.name)}'s work today</h2>${kwCardHtml(k, items).replace("data-kwdetail", "data-kwsame").replace("<small>Details ›</small>", "")}
    <details class="card kw-all"><summary>📋 Everything ${safe(k.name)} did today (${mine.length})</summary>
      ${mine.length ? `<ul class="kw-list">${mine.map(x => { const inner = `<span class="kw-time">${x.cat === "school" || x.cat === "act" ? kwTime(x.at) : ""}</span><span class="kw-what">${safe(x.text)}</span>`;
        return `<li>${x.open ? `<button class="kw-item" data-kwopen="${safe(x.kid)}|${safe(x.open)}">${inner}</button>` : `<div class="kw-item">${inner}</div>`}</li>`; }).join("")}</ul>` : `<p class="sc-empty">No work yet today 🙂</p>`}</details>
    ${habitsCardHtml(k.id)}<div class="btnrow"><button class="pill" data-kidhabits>✏️ Edit the kids' habits</button></div>
    ${dutyRowsCardHtml([k], `✅ Did ${safe(k.name)} do the duties on time today?`)}
    ${wishesListHtml(k.id)}
    ${stars().includes(k.id) ? `<div class="card"><h2>🌟 Shining Star of the Week!</h2><p>${want && want.text ? `🎁 Gift: <b>${safe(want.text)}</b>${want.ok ? " ✅" : ""}` : "🎁 No gift picked yet."}</p>
      <div class="btnrow"><button class="pill" data-go="points">🏆 Points</button></div></div>` : ""}
    ${feat("diary") ? `<div class="card"><h2>📔 Moods this week</h2><div class="me-moods">${st.moods.map(x => `<span><b>${x.face || "·"}</b><small>${x.day}</small></span>`).join("")}</div>
      <div class="btnrow"><button class="pill" data-dyopen="${safe(k.id)}">📔 ${safe(k.name)}'s day</button></div></div>` : ""}
    <h2 class="kp-h">📊 How ${safe(k.name)} is doing</h2>${reportCardsHtml(k.id)}`;
}
// ☰ More: simple, the same for everyone: 👤 My profile (big: each person's ⚙️ settings, and a parent's 👨‍👩‍👧 Family settings,
// 🚪 Sign out at its bottom) · 🔒 Your privacy · 👋 Show the tour. (✏️ Add activities and 🖨️ Print are on 📅 Calendar.)
function moreTilesHtml() {
  return [{ ...PROFILE_TILE, cls: "primary more-profile", sub: hasSpark(me) ? "My settings, my Spark, my school" : "My settings, my picture" }, PRIVACY_TILE, TOUR_TILE].map(tileHtml).join("");
}
// 📅 Calendar's small buttons: ✏️ Add activities (everyone) · 🖨️ Schedules to tick (the parent who plans)
function calToolsHtml() {
  return `<button class="pill" data-go="add">✏️ Add activities</button>${isParentId(me) ? `<button class="pill" data-printmenu>🖨️ Schedules to tick</button>` : ""}`;
}
// 📋 Today: my next activities (not done yet, up to 5) with big ✅ ticks; "See all" opens 📅 Calendar
function todayItems(who) {
  const date = todayYmd();
  return [...(hasPlan() ? planDay(date).items.filter(it => it.users.includes(who)).map(it => ({ id: it.actId, name: it.name, start: it.start, end: it.end })) : []),
          ...(data.parentActs || []).filter(a => a.by === who && a.type !== "travel" && pactStartOn(a, date))
            .map(a => ({ id: a.id, name: `${pactType(a)[1]} ${a.title}`, start: a.from ? toMin(a.from) : -1, end: a.to ? toMin(a.to) : 1440 }))]
    .sort((a, b) => a.start - b.start);
}

// =====================================================================
//  ☰ MORE PAGES: 🗣️ family meeting · 📱 screen time · 📗 Quran & Arabic · 🧹 home duties
//   One "extra" screen (extraPage = which one). Each is a ⚙️ feature (off = hidden, no points).
//   Settings (plan document): data.screenRate { points, minutes, max } · data.chores [{ id, title, emoji, kids, days, turns, every }]
//   Shared items (points document, one field per item):
//     meeting    = "monday|person" → { great, better, goal, at }       (kept 8 weeks)
//     screen     = "date|kid" → { bought, used, run }                  (minutes; run = when the timer started; kept: points used)
//     quran      = kid → { surahs: { index: "done" | "revising" }, words: [{ id, text, date }] }
//     quranHeard = "date|kid|what" → { by, at }                        (+10, a parent heard it; 5 weeks)
//     chores     = "date|chore|kid" → { at }                           (+10; 5 weeks)
// =====================================================================
// (🏡 Our Community keeps the old ⚙️ key "meeting", so the family's on / off choice stays as it was)
const EXTRA_PAGES = [["meeting", "🏡", "Our Community", "Our family board"], ["chores", "🧹", "Home duties", "Jobs at home"]];   // (📱 Screen time: removed)
let extraPage = null, extraKid = null, extraEdit = null;   // the page, the kid a parent is looking at, an open form
const CHORE_POINTS = 10, HEARD_POINTS = 10, MEETING_DAY = 4;
// (SURAHS is with the other lists at the top: the saved data is checked with it)
function openExtra(k) {
  if (!feat(k) || !EXTRA_PAGES.some(p => p[0] === k)) return;   // (📱 a removed page: nothing)
  extraPage = k; extraEdit = null;
  extraKid = isParentDevice() ? (kidsList().some(x => x.id === extraKid) ? extraKid : (kidsList()[0] || {}).id) : me;
  homeMore = false;
  go("extra");
}
// The points from these pages (⚙️ off = none): ✅ home duties and 📗 "heard it" are Tasks
function extraTaskPoints(id, from, to) {
  let n = 0;
  const inRange = key => { const date = key.slice(0, 10); return date >= from && date < to; };
  if (feat("chores")) n += Object.keys(data.points.chores).filter(k => inRange(k) && k.split("|")[2] === id).length * CHORE_POINTS;
  // (📗 the removed Quran page: the "heard it" points already earned keep counting; no new ones can be made)
  n += Object.keys(data.points.quranHeard).filter(k => inRange(k) && k.split("|")[1] === id).length * HEARD_POINTS;
  return n;
}
const extraFunPoints = () => 0;
function drawExtra() {
  if (!extraPage || !feat(extraPage) || !EXTRA_PAGES.some(p => p[0] === extraPage)) return go("home");
  const [, emoji, label] = EXTRA_PAGES.find(p => p[0] === extraPage);
  $("extraTitle").textContent = `${emoji} ${label}`;
  const views = { meeting: communityHtml, chores: choresPageHtml };
  if (extraPage === "meeting") cmMarkSeen();   // (🏡 opened: nothing "new" any more on this device)
  $("extraBody").innerHTML = views[extraPage]();
}

// ---------- 🏡 OUR COMMUNITY: a simple family board, newest first (it took the place of 🗣️ Family meeting) ----------
//   Anyone writes: 📝 Note (about our family) · 🙏 I need (a kid asks the parents) · 📣 Please (a parent asks the kids) · ⭐ Review (1–5 stars).
//   Others react (❤️ 👍 😂 🙏); a 🙏 / 📣 can be marked ✅ Done. The writer (or a parent) deletes a post.
//   🔔 New 🙏: all parents · new 📣: the kids named (or all kids) · notes and reviews: everyone.
//   data.points.community = id → { type, text, by, at, stars?, to? }   cmReact = "post|person" → emoji   cmDone = post → { by, at }
//   (Kept 180 days. The old 🗣️ meeting answers stay saved in points.meeting, just not shown.)
// (CM_TYPES and CM_REACTS are at the top, with STUDY_POINTS: the saved data is checked with them when the app starts)
const CM_SEEN = SAVE_KEY + ".communitySeen";
let cmDraft = null;   // the post being written: { type, to: [kid ids], stars }
const cmTypesFor = who => isParentId(who) ? ["note", "please", "review"] : ["note", "need", "review"];
const cmPosts = () => Object.entries(data.points.community).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
function cmSeen() { try { return localStorage.getItem(CM_SEEN) || ""; } catch (e) { return ""; } }
function cmMarkSeen() { try { localStorage.setItem(CM_SEEN, new Date().toISOString()); } catch (e) {} }
const cmNewCount = () => { const seen = cmSeen(); return cmPosts().filter(p => p.by !== me && (p.at || "") > seen).length; };
const cmWhen = at => at ? new Date(at).toLocaleString("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
function communityHtml() {
  const posts = cmPosts(), d = cmDraft, parent = isParentDevice();
  const write = !d ? `<div class="btnrow"><button class="primary" data-cmwrite>➕ Write</button></div>`
    : !d.type ? `<div class="card sc-form cm-form"><h2>➕ What do you want to write?</h2><div class="cm-types">${cmTypesFor(me).map(t => { const [e, label, sub] = CM_TYPES[t];
        return `<button class="cm-type" data-cmtype="${t}"><span class="e">${e}</span><b>${label}</b><small>${sub}</small></button>`; }).join("")}</div>
        <div class="btnrow"><button data-cmcancel>Cancel</button></div></div>`
    : `<div class="card sc-form cm-form"><h2>${CM_TYPES[d.type][0]} ${CM_TYPES[d.type][1]}</h2>
        ${d.type === "review" ? `<label class="small">⭐ Stars</label><div class="cm-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${d.stars >= n ? "on" : ""}" data-cmstar="${n}" aria-label="${n} stars">⭐</button>`).join("")}</div>` : ""}
        ${d.type === "please" ? `<label class="small">📣 For <small>(none ticked = all kids)</small></label><div class="cm-kids">${kidsList().map(k => `<button type="button" class="chip ${d.to.includes(k.id) ? "on" : ""}" data-cmkid="${safe(k.id)}" aria-pressed="${d.to.includes(k.id)}"><span class="e">${safe(k.emoji)}</span>${safe(k.name)}</button>`).join("")}</div>` : ""}
        <label class="small" for="cmText">✍️ Write it</label><textarea id="cmText" rows="3" maxlength="300" placeholder="${safe(CM_TYPES[d.type][3])}">${safe(d.text || "")}</textarea>
        <div class="err" id="cmErr"></div>
        <div class="btnrow"><button class="primary" data-cmsave>📮 Post</button><button data-cmcancel>Cancel</button></div></div>`;
  const list = posts.length ? posts.map(p => {
    const u = exists(p.by) ? userById(p.by) : null, c = u ? colorsOf(u) : GREY, [e, label] = CM_TYPES[p.type] || CM_TYPES.note;
    const reacts = Object.entries(data.points.cmReact).filter(([k]) => k.split("|")[0] === p.id);
    const done = data.points.cmDone[p.id];
    const canDone = (p.type === "need" || p.type === "please") && !done && p.by !== me;
    const forWho = p.type === "please" ? (p.to && p.to.length ? p.to.filter(exists).map(id => userById(id).name).join(", ") : "all kids") : "";
    return `<li class="card cm-post cm-${p.type}" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
      <div class="cm-top"><span class="cm-who"><span class="e">${u ? faceHtml(u) : "🙂"}</span><b>${safe(u ? u.name : "Someone")}</b></span>
        <span class="cm-kind">${e} ${label}${forWho ? ` · for ${safe(forWho)}` : ""}</span><small class="cm-time">${safe(cmWhen(p.at))}</small></div>
      ${p.type === "review" && p.stars ? `<p class="cm-starsline" aria-label="${p.stars} of 5 stars">${"⭐".repeat(p.stars)}<small> ${p.stars}/5</small></p>` : ""}
      <p class="cm-text">${safe(p.text)}</p>
      <div class="cm-acts">${CM_REACTS.map(r => { const n = reacts.filter(([, v]) => v === r).length, mine = data.points.cmReact[`${p.id}|${me}`] === r;
          return `<button class="cm-react ${mine ? "on" : ""}" data-cmreact="${safe(p.id)}|${r}" aria-pressed="${mine}">${r}${n ? ` ${n}` : ""}</button>`; }).join("")}
        ${done ? `<span class="cm-done">✅ Done${exists(done.by) ? ` · ${safe(userById(done.by).name)}` : ""}</span>` : canDone ? `<button class="cm-react" data-cmdone="${safe(p.id)}">✅ Done</button>` : ""}
        ${p.by === me || parent ? `<button class="cm-react danger-text" data-cmdel="${safe(p.id)}">🗑️ Delete</button>` : ""}</div></li>`;
  }).join("") : "";
  return write + (list ? `<ul class="cm-list">${list}</ul>` : `<div class="card"><p class="sc-empty">Nothing yet. Tap ➕ Write to start our board! 🏡</p></div>`);
}
// 🔔 Who gets a new post: 🙏 all parents · 📣 the kids named (or all kids) · 📝 ⭐ everyone
const cmFor = to => !to || to === "all" || (to === "parents" ? isParentId(me) : to === "kids" ? !isParentId(me) : Array.isArray(to) && to.includes(me));
function cmPost() {
  const d = cmDraft, text = $("cmText").value.trim().slice(0, 300);
  if (!d || !d.type || !cmTypesFor(me).includes(d.type)) return;
  if (!text) return $("cmErr").textContent = "Please write something first. 🙂";
  if (d.type === "review" && !d.stars) return $("cmErr").textContent = "Please pick 1 to 5 stars. ⭐";
  const id = newId(), to = d.type === "please" ? d.to.filter(exists) : [];
  data.points.community[id] = { type: d.type, text, by: me, at: new Date().toISOString(), ...(d.type === "review" ? { stars: d.stars } : {}), ...(to.length ? { to } : {}) };
  cmDraft = null;
  keepNow();
  const short = text.length > 80 ? text.slice(0, 80) + "…" : text;
  const news = d.type === "need" ? { what: `🙏 needs: ${short}`, to: "parents" }
    : d.type === "please" ? { what: `📣 asks: ${short}`, to: to.length ? to : "kids" }
    : d.type === "review" ? { what: `⭐ gave ${d.stars}/5: ${short}`, to: "all" } : { what: `📝 wrote: ${short}`, to: "all" };
  addNews([{ ...newsItem("cm", news.what, CM_TYPES[d.type][0] + " " + CM_TYPES[d.type][1], me), to: news.to }]);
  toast("📮 Posted on 🏡 Our Community!", 2500);
}
function communityTap(ds) {
  if ("cmwrite" in ds) { cmDraft = { type: null, to: [], stars: 0 }; return render(); }
  if ("cmcancel" in ds) { cmDraft = null; return render(); }
  const keep = () => { if (cmDraft && $("cmText")) cmDraft.text = $("cmText").value; };   // (what's typed stays when a star / kid is tapped)
  if (ds.cmtype && cmDraft && cmTypesFor(me).includes(ds.cmtype)) { cmDraft.type = ds.cmtype; return render(); }
  if (ds.cmstar && cmDraft) { keep(); cmDraft.stars = Number(ds.cmstar); return render(); }
  if (ds.cmkid && cmDraft) { keep(); cmDraft.to = cmDraft.to.includes(ds.cmkid) ? cmDraft.to.filter(x => x !== ds.cmkid) : [...cmDraft.to, ds.cmkid]; return render(); }
  if ("cmsave" in ds) return cmPost();
  if (ds.cmreact) {
    const [id, r] = ds.cmreact.split("|"), key = `${id}|${me}`;
    if (!data.points.community[id] || !CM_REACTS.includes(r)) return;
    if (data.points.cmReact[key] === r) delete data.points.cmReact[key]; else data.points.cmReact[key] = r;
    return keepNow();
  }
  if (ds.cmdone) {
    const p = data.points.community[ds.cmdone];
    if (!p || p.by === me) return;
    data.points.cmDone[ds.cmdone] = { by: me, at: new Date().toISOString() };
    keepNow();
    return toast("✅ Done! Thank you 💛", 2200);
  }
  if (ds.cmdel) {
    const p = data.points.community[ds.cmdel];
    if (!p || !(p.by === me || isParentDevice()) || !confirm("Delete this post?")) return;
    delete data.points.community[ds.cmdel]; delete data.points.cmDone[ds.cmdel];
    Object.keys(data.points.cmReact).forEach(k => { if (k.split("|")[0] === ds.cmdel) delete data.points.cmReact[k]; });
    return keepNow();
  }
}

// (📱 Screen time was removed: its saved data (data.screenRate, points.screen) is kept but not shown, and the points stay as they are.
//  The only reward in the app is the ⭐ Shining Star choosing their own prize: 🎁 Choose my prize.)

// (📗 Quran & Arabic was removed: its saved data (points.quran, points.quranHeard) is kept but not shown, and the
//  "✅ heard it" points already earned still count. A family that wants Quran adds it as a school subject in ✏️ Edit subjects.)

// ---------- 🧹 Home duties: per kid with days, or taking turns (daily / weekly); kids tick ✅ (+10, Tasks) ----------
const choresList = () => data.chores || [];
const dayNumber = date => Math.floor(fromYmd(date).getTime() / 86400000 + 0.5);
function choreKidsOn(ch, date) {
  if (!ch.days.includes(weekdayOf(date))) return [];
  const kids = ch.kids.filter(exists);
  if (!kids.length) return [];
  if (!ch.turns) return kids;
  const n = ch.every === "week" ? Math.floor((dayNumber(date) - weekdayOf(date)) / 7) : dayNumber(date);
  return [kids[((n % kids.length) + kids.length) % kids.length]];
}
const choreDone = (date, ch, kid) => !!data.points.chores[`${date}|${ch.id}|${kid}`];
function choresTodayHtml(kid) {
  const date = todayYmd(), list = choresList().filter(ch => choreKidsOn(ch, date).includes(kid)), c = colorsOf(userById(kid));
  return list.length ? `<div class="card td-card" style="--c:${c.color}"><h2>🧹 My duties today</h2>${list.map(ch => { const on = choreDone(date, ch, kid); return `<div class="td-row">
    <button class="k-check td-check ${on ? "on" : ""}" data-chore="${safe(ch.id)}|${safe(kid)}" style="--c:${c.color}" aria-pressed="${on}" aria-label="${safe(ch.title)}">${on ? "✓" : ""}</button>
    <span class="td-what"><b>${safe(ch.emoji)} ${safe(ch.title)}</b><small>+${CHORE_POINTS} ⭐</small></span></div>`; }).join("")}</div>` : "";
}
function choresPageHtml() {
  const parent = isParentDevice(), date = todayYmd();
  const today = kidsList().map(k => ({ k, list: choresList().filter(ch => choreKidsOn(ch, date).includes(k.id)) })).filter(x => x.list.length && (parent || x.k.id === me));
  const ed = extraEdit && extraEdit.chore;
  const form = parent && ed ? `<div class="card sc-form"><h2>${ed.id ? "✏️ Duty" : "➕ New duty"}</h2>
      <div class="row"><div style="flex:0 0 70px"><label class="small" for="chEmoji">Emoji</label><input type="text" id="chEmoji" maxlength="8" value="${safe(ed.emoji || "🧹")}"></div>
        <div><label class="small" for="chTitle">What</label><input type="text" id="chTitle" maxlength="40" value="${safe(ed.title || "")}" placeholder="Set the table"></div></div>
      <label class="small">Who</label><div class="daypick">${kidsList().map(k => `<label><input type="checkbox" name="chKid" value="${safe(k.id)}" ${(ed.kids || []).includes(k.id) ? "checked" : ""}><span>${safe(k.emoji)} ${safe(k.name)}</span></label>`).join("")}</div>
      <label class="small">Days</label><div class="daypick">${SHORT.map((d, i) => `<label><input type="checkbox" name="chDay" value="${i}" ${(ed.days || [0, 1, 2, 3, 4, 5, 6]).includes(i) ? "checked" : ""}><span>${d}</span></label>`).join("")}</div>
      <label class="checkline"><input type="checkbox" id="chTurns" ${ed.turns ? "checked" : ""}> 🔄 Take turns</label>
      <select id="chEvery" aria-label="Change turns every"><option value="day" ${ed.every !== "week" ? "selected" : ""}>Every day</option><option value="week" ${ed.every === "week" ? "selected" : ""}>Every week</option></select>
      <div class="err" id="chErr"></div>
      <div class="btnrow"><button class="primary" data-chsave>💾 Save</button>${ed.id ? `<button class="danger-text" data-chdel="${safe(ed.id)}">🗑️ Delete</button>` : ""}<button data-chcancel>Cancel</button></div></div>` : "";
  return (parent && !ed ? `<div class="btnrow"><button class="primary" data-chnew>➕ New duty</button></div>` : "") + form
    + `<div class="card"><h2>Today</h2>${today.map(({ k, list }) => `<h3 class="ph-group">${safe(k.emoji)} ${safe(k.name)}</h3>${list.map(ch => { const on = choreDone(date, ch, k.id); return `<div class="td-row">
      <button class="k-check td-check ${on ? "on" : ""}" data-chore="${safe(ch.id)}|${safe(k.id)}" style="--c:${colorsOf(k).color}" aria-pressed="${on}" aria-label="${safe(ch.title)}">${on ? "✓" : ""}</button>
      <span class="td-what"><b>${safe(ch.emoji)} ${safe(ch.title)}</b></span></div>`; }).join("")}`).join("") || `<p class="sc-empty">No duties today.</p>`}</div>`
    + (parent ? `<div class="card"><h2>All duties</h2><ul class="list">${choresList().map(ch => `<li><span class="what">${safe(ch.emoji)} ${safe(ch.title)}<small>${ch.kids.filter(exists).map(id => userById(id).emoji).join(" ")}
      ${ch.turns ? ` · 🔄 ${ch.every === "week" ? "weekly" : "daily"}` : ""} · ${ch.days.map(i => SHORT[i]).join(" ")}</small></span><button class="edit" data-chedit="${safe(ch.id)}" aria-label="Change">✏️ Edit</button></li>`).join("")
      || `<li class="sc-empty">No duties yet.</li>`}</ul></div>` : "");
}

// ---------- The taps on these pages ----------
const EXTRA_KEYS = ["extra", "extrakid", "cmwrite", "cmcancel", "cmtype", "cmstar", "cmkid", "cmsave", "cmreact", "cmdone", "cmdel",
                    "qsurah", "qword", "qheard",
                    "chore", "chnew", "chedit", "chcancel", "chdel", "chsave"];
const isExtraTap = ds => Object.keys(ds).some(k => EXTRA_KEYS.includes(k));
function extraTap(ds, t) {
  const kidOK = kid => kid === me || isParentDevice();
  if (ds.extra) return openExtra(ds.extra);
  if (ds.extrakid) { if (kidLockedOut(ds.extrakid)) return lockedToast(ds.extrakid); extraKid = ds.extrakid; return render(); }
  // 🏡
  if (Object.keys(ds).some(k => k.startsWith("cm"))) return communityTap(ds);
  // 🧹
  if (ds.chore) {
    const [id, kid] = ds.chore.split("|"), ch = choresList().find(x => x.id === id), date = todayYmd();
    if (!ch || !kidOK(kid) || !choreKidsOn(ch, date).includes(kid)) return;
    if (newWeek()) keepNow();
    const key = `${date}|${id}|${kid}`;
    if (data.points.chores[key]) delete data.points.chores[key];
    else { data.points.chores[key] = { at: new Date().toISOString() }; const r = t.getBoundingClientRect(); celebrate(r.left + r.width / 2, r.top, colorsOf(userById(kid)).color, false); toast(`🧹 Well done! +${CHORE_POINTS} ⭐`, 2200); }
    return keepNow();
  }
  if ("chnew" in ds) { extraEdit = { chore: { kids: [], days: [0, 1, 2, 3, 4, 5, 6] } }; return render(); }
  if (ds.chedit) { const ch = choresList().find(x => x.id === ds.chedit); if (ch) extraEdit = { chore: { ...ch } }; return render(); }
  if ("chcancel" in ds) { extraEdit = null; return render(); }
  if (ds.chdel && isParentDevice()) { if (!confirm("Delete this duty?")) return; data.chores = choresList().filter(x => x.id !== ds.chdel); extraEdit = null; return keepNow(); }
  if ("chsave" in ds && isParentDevice()) {
    const title = $("chTitle").value.trim().slice(0, 40), kids = [...document.querySelectorAll('input[name="chKid"]:checked')].map(x => x.value);
    const days = [...document.querySelectorAll('input[name="chDay"]:checked')].map(x => Number(x.value));
    if (!title || !kids.length || !days.length) return $("chErr").textContent = "Please type what, and pick who and the days.";
    const ch = { id: (extraEdit.chore && extraEdit.chore.id) || newId(), title, emoji: $("chEmoji").value.trim().slice(0, 8) || "🧹", kids, days,
                 turns: $("chTurns").checked, every: $("chEvery").value === "week" ? "week" : "day" };
    data.chores = [...choresList().filter(x => x.id !== ch.id), ch];
    extraEdit = null; return keepNow();
  }
  return false;
}

// ---------- 👋 The first-time tour: 4 swipe cards (kids / parents). ☰ More → Show the tour ----------
const TOUR_KID = [["✅", "Tick your tasks", "When you finish something, tap its big ✅. Every tick gives you points!"],
                  ["🧩", "Solve your riddles", "A riddle pops up when you open the app. Stuck? Ask someone in the family for help."],
                  ["📔", "Tell us your day", "Pick a face for how you feel, and write a line about your day."],
                  ["✨", "Grow your Spark", "All your points help your Spark grow. Can you reach the next level?"]];
const TOUR_PARENT = [["📅", "Family calendar", "Everyone's week in one place. ✨ Plan my week fits all the activities together."],
                     ["🎒", "School coach", "Upload today's school work: 🤖 makes worksheets, checks the answers and tells you what to practise."],
                     ["⭐", "Points & the kids' habits", "⭐ Score: the calendar's 📚 Study (65%), ⚽ Activity (25%) and 🌱 Habit (10%) items ticked ✅ this week. Points still grow the ✨ Spark."],
                     ["⚙️", "Settings", "Turn features on or off for your family, and set up the people and the day."]];
let tourShown = false;   // (once per opening of the app)
function maybeShowTour() {
  const u = userById(me);
  if (tourShown || !u || u.toured || !(!cloud.enabled || cloud.ready)) return;
  tourShown = true;
  setTimeout(showTour, 400);
}
function showTour() {
  if (document.querySelector(".tour")) return;
  const cards = isParentId(me) && !isKidDevice() ? TOUR_PARENT : TOUR_KID, c = colorsOf(userById(me));
  const box = document.createElement("div");
  box.className = "tour";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "How the app works");
  box.innerHTML = `<div class="tour-box" style="--c:${c.color};--soft:${c.soft}">
    <div class="tour-track">${cards.map(([e, title, text], i) => `<div class="tour-card"><div class="tour-e">${e}</div><h2>${title}</h2><p>${text}</p>
      <small>${i + 1} / ${cards.length}</small></div>`).join("")}</div>
    <div class="tour-dots">${cards.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
    <div class="btnrow"><button data-tourskip>Skip</button><button class="primary" data-tournext>Next ›</button></div></div>`;
  const track = box.querySelector(".tour-track"), dots = box.querySelectorAll(".tour-dots i"), next = box.querySelector("[data-tournext]");
  const at = () => Math.round(track.scrollLeft / track.clientWidth);
  const show = () => { const i = at(); dots.forEach((d, k) => d.classList.toggle("on", k === i)); next.textContent = i >= cards.length - 1 ? "Let's go! 🎉" : "Next ›"; };
  const close = () => { box.remove(); const u = data.users.find(x => x.id === me); if (u && !u.toured) { u.toured = true; writeData("auto"); } maybeShowSetup(); };
  track.addEventListener("scroll", () => requestAnimationFrame(show), { passive: true });
  box.addEventListener("click", e => {
    if (e.target.closest("[data-tourskip]")) return close();
    if (e.target.closest("[data-tournext]")) { const i = at(); if (i >= cards.length - 1) return close(); track.scrollTo({ left: (i + 1) * track.clientWidth, behavior: "smooth" }); }
  });
  document.body.appendChild(box);
  next.focus();
}

// ---------- ✨ Make the app yours (parents): which features the family uses ----------
// Asked once (after the tour; an existing family: the next time a parent opens the app). Later: "✏️ Edit my home" (parent home)
// or ⚙️ Settings → Features. Off = hidden everywhere (tiles, habits, menus, points), never deleted: on again brings it all back.
// data.featuresChosen = a parent saved it (or said "Not now") once.
const FEATURE_INFO = {
  coach: ["🎒", "School coach", "Upload school work: 🤖 makes worksheets and checks them"], newsletter: ["📰", "Newsletter", "Read the school newsletter into the calendar"],
  riddles: ["🧩", "Riddles", "A fun riddle of the day for everyone"], diary: ["📔", "My day", "A mood and a few lines about the day"],
  buddy: ["✨", "Spark levels", "A Spark that grows with all your points"], parentPoints: ["⭐", "Parent points", "Parents earn points too: their activities and the weekly prize"],
  wishes: ["💌", "Kids' wishes", "Every Friday the kids tell you their wishes"], prayer: ["🕌", "Prayer times", "Prayer times on the calendar"],
  chores: ["🧹", "Home duties", "Jobs at home, or taking turns"],
  meeting: ["🏡", "Our Community", "A family board: notes, requests, reviews"]
};
let setupDraft = null;   // the switches being chosen (a copy of data.features)
function openSetup() {
  if (!isParentDevice()) return;
  setupDraft = { ...data.features };
  setupStep = "features";
  homeMore = false;
  go("setup");
}
let setupStep = "features";   // ✨ the features, then 📘 each kid's subjects
function drawSetup() {
  if (!isParentDevice()) return go("home");
  if (setupStep === "subjects") return drawSetupSubjects();
  if (!setupDraft) setupDraft = { ...data.features };
  $("setupBody").innerHTML = `<p class="lead">What would you like in your family app?</p>
    <div class="su-top"><span>${Object.values(setupDraft).filter(Boolean).length} of ${FEATURES.length} on</span><button class="linkbtn" data-setupall>Turn all on</button></div>
    <div class="su-grid">${FEATURES.map(([k]) => { const [e, name, what] = FEATURE_INFO[k], on = !!setupDraft[k]; return `<button class="su-card ${on ? "on" : ""}"
      data-setupfeat="${k}" role="switch" aria-checked="${on}"><span class="e">${e}</span><span class="su-text"><b>${name}</b><small>${what}</small></span>
      <span class="su-switch" aria-hidden="true"><i></i></span></button>`; }).join("")}</div>
    <p class="hint">Turned off = hidden, never deleted. Turn it on again and everything comes back.</p>
    <div class="btnrow su-save"><button class="primary" data-setupsave>✅ Save</button>${data.featuresChosen ? "" : `<button data-setuplater>Not now</button>`}</div>`;
}
function saveSetup(later) {
  if (!isParentDevice()) return;
  if (!later && setupDraft) data.features = { ...data.features, ...setupDraft };
  data.featuresChosen = true;
  setupDraft = null;
  writeData();
  if (!later && kidsList().length) { setupStep = "subjects"; return render(); }   // → 📘 the kids' subjects
  go("home");
  if (!later) toast("✅ Your family app is ready!", 2600);
}
// 📘 Step 2 (first time, parents): each kid's school subjects, the same as their 🎒 School subjects (used by 📚 Study activities).
// ➕ a suggested one or any name · ✕ remove (one with work in it is hidden instead). Changed any time in 🎒 School → ✏️ Edit subjects.
function drawSetupSubjects() {
  $("setupBody").innerHTML = `<p class="lead">📘 Each kid's school subjects</p>
    <p class="hint">For 📚 Study activities. Change them any time in 🎒 School → ✏️ Edit subjects.</p>
    ${kidsList().map(k => { const list = subjectList(schoolOf(k.id)), have = n => list.some(x => sameSubject(x.name, n));
      return `<div class="card su-subs"><h2>${safe(k.emoji)} ${safe(k.name)}</h2>
        <div class="su-have">${list.length ? list.map(x => `<span class="su-sub">${safe(x.emoji)} ${safe(x.name)}<button type="button" class="x" data-susubdel="${safe(k.id)}|${safe(x.id)}" aria-label="Remove ${safe(x.name)}">✕ Remove</button></span>`).join("")
          : `<span class="hint">No subjects yet.</span>`}</div>
        <div class="su-sugg">${SUBJECTS.filter(x => !have(x.name)).map(x => `<button type="button" class="pill" data-susubadd="${safe(k.id)}|${safe(x.name)}">➕ ${x.emoji} ${safe(x.name)}</button>`).join("")}</div>
        <label class="small" for="susub-${safe(k.id)}">➕ Another subject</label>
        <div class="su-addrow"><input type="text" id="susub-${safe(k.id)}" maxlength="30" placeholder="French, Computing…"><button type="button" class="pill" data-susubnew="${safe(k.id)}">➕ Add</button></div></div>`; }).join("")}
    <div class="btnrow su-save"><button class="primary" data-susubdone>✅ Done</button></div>`;
}
function setupSubjectTap(ds) {
  if (!isParentDevice()) return;
  if ("susubdone" in ds) { setupStep = "features"; go("home"); return toast("✅ Your family app is ready!", 2600); }
  const [kid, x] = (ds.susubdel || ds.susubadd || ds.susubnew || "").split("|");
  if (!kid || !userById(kid)) return;
  if (ds.susubdel) { schoolKid = kid; return deleteSubject(x); }   // (the usual 🗑️: work in it → hidden instead)
  const name = (ds.susubadd ? x : ($("susub-" + kid) || {}).value || "").trim().slice(0, 30);
  if (!name) return toast("Type a subject first.", 2000);
  ensureFolder(schoolFor(kid), name);
  writeData();
  render();
}
// The first time: after the tour (if it's still to come, the tour's end opens it)
let setupAsked = false;
function maybeShowSetup() {
  const u = userById(me);
  if (setupAsked || data.featuresChosen || !isParentDevice() || !u || !u.toured || document.querySelector(".tour") || screen === "setup" || !(!cloud.enabled || cloud.ready)) return;
  setupAsked = true;
  setTimeout(openSetup, 300);
}

// ---------- ⚙️ Features (Settings, parents): the same choices, on the "✨ Make the app yours" screen ----------
function drawFeatures() {
  const card = $("featCard");
  if (!isParentDevice()) { card.innerHTML = ""; card.hidden = true; return; }
  card.hidden = false;
  const on = FEATURES.filter(([k]) => feat(k));
  card.innerHTML = `<h2>⚙️ Features</h2><p class="hint">${on.length} of ${FEATURES.length} on: ${on.map(([, e]) => e).join(" ")}</p>
    <div class="btnrow"><button class="primary" data-setupopen>✨ Choose the features</button></div>`;
}
document.addEventListener("change", e => {
  const k = e.target.dataset && e.target.dataset.feat;
  if (!k || !isParentDevice()) return;
  data.features[k] = e.target.checked;
  keepNow();
  toast(`${e.target.checked ? "✓ On" : "Off"}: ${(FEATURES.find(f => f[0] === k) || [])[2]}`, 1800);
});
