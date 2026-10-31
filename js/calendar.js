// =====================================================================
//  📌 ONE-DAY EVENTS (parents): a title, who (one or more people), a date, a start and an end time. Only on that date (not every
//  week), on the calendar with a 📌, never scored. The planner keeps those people free then. When it's saved over planned activities
//  of those people: the clashes, then "Move them to another free time" (only those are planned again) or "Remove them for that day".
// =====================================================================
const oneDayOn = ds => (data.oneDay || []).filter(e => e.date === ds);
// (also ❌ a session that didn't happen: skipped, or moved to another day)
const skippedOn = (ds, actId) => oneDayOn(ds).some(e => (e.skip || []).includes(actId)) || hasOwn(data.skips || {}, `${ds}|${actId}`);
// The planned activities of those people at that time: the saved plan's (or, a date it doesn't have yet, the fixed ones by weekday)
function oneDayClashes(e) {
  const s = toMin(e.from), t = toMin(e.to), hits = it => it.start < t && s < it.end && it.people.some(p => e.who.includes(p));
  if (hasPlan() && data.plan.dates[e.date]) return planDay(e.date).items.filter(it => !it.gone && hits(it))
    .map(it => ({ actId: it.actId, name: it.name, fixed: !!it.fixed, start: it.start, end: it.end, users: it.users }));
  return data.fixed.filter(f => f.days.includes(weekdayOf(e.date))).map(f => ({ actId: f.id, name: f.name, fixed: true, start: toMin(f.start), end: toMin(f.end), users: f.users, people: peopleOf(f) }))
    .filter(hits);
}
let od = null;   // the open form: { id (null = new), title, who, date, from, to, clashes? }
function openOneDay(id) {
  if (!isParentDevice()) return;
  if (hasDraft()) return toast("💾 Save your changes first, then add the event.", 3500);
  const e = id && (data.oneDay || []).find(x => x.id === id);
  od = e ? { ...e, who: [...e.who] } : { id: null, title: "", who: kidsList().map(k => k.id).slice(0, 1), date: todayYmd(), from: "16:00", to: "17:00" };
  closeCard();
  drawOneDay();
  $("odModal").hidden = false;
  if ($("odName")) $("odName").focus();
}
function closeOneDay() { $("odModal").hidden = true; od = null; }
function drawOneDay() {
  $("odTitle").textContent = od.id ? "📌 Change the one-day event" : "📌 One-day event";
  if (od.clashes) {   // step 2: what to do with the clashes
    $("odBody").innerHTML = `<p class="print-hint">“${safe(od.title)}” on ${safe(dayLong(od.date))}, ${clock(toMin(od.from), true)}–${clock(toMin(od.to), true)} is at the same time as:</p>
      <ul class="list">${od.clashes.map(c => `<li><span class="what"><b>${safe(c.name)}</b><small>${clock(c.start, true)}–${clock(c.end, true)} · ${safe(namesOf(c.users))}${c.fixed ? " · 🔒 fixed: it can't move, only be removed" : ""}</small></span></li>`).join("")}</ul>
      <div class="btnrow"><button class="primary" data-odmove>🔀 Move them to another free time</button><button data-odremove>🗑️ Remove them for that day</button><button data-odback>⬅️ Back</button></div>`;
    return;
  }
  $("odBody").innerHTML = `
    <label class="small" for="odName">Title</label><input type="text" id="odName" maxlength="40" value="${safe(od.title)}" placeholder="Dentist, birthday party…">
    <label class="small">Who</label><div class="daypick" id="odWho">${data.users.map(u => `<label><input type="checkbox" value="${safe(u.id)}" ${od.who.includes(u.id) ? "checked" : ""}><span>${safe(u.emoji)} ${safe(u.name)}</span></label>`).join("")}</div>
    <label class="small" for="odDate">Date</label><input type="date" id="odDate" value="${safe(od.date)}">
    <div class="row"><div><label class="small" for="odFrom">Start time</label><input type="time" id="odFrom" value="${safe(od.from)}"></div>
      <div><label class="small" for="odTo">End time</label><input type="time" id="odTo" value="${safe(od.to)}"></div></div>
    <p class="hint">It's only on that date, shows with a 📌 and is never scored. Nothing is planned for those people at that time.</p>
    <div class="err" id="odErr"></div>
    <div class="btnrow"><button class="primary" data-odsave>💾 Save</button>${od.id ? `<button class="danger-text" data-oddel>🗑️ Delete</button>` : ""}<button data-odcancel>Cancel</button></div>`;
}
// 💾 Save: checked, then (clashes) step 2, or saved now
function saveOneDay() {
  const title = $("odName").value.trim().slice(0, 40), who = [...document.querySelectorAll("#odWho input:checked")].map(x => x.value);
  const date = $("odDate").value, from = $("odFrom").value, to = $("odTo").value, err = t => { $("odErr").textContent = t; };
  if (!title) return err("Please type a title.");
  if (!who.length) return err("Please pick who it's for.");
  if (!isYmd(date)) return err("Please pick the date.");
  if (!isHm(from) || !isHm(to) || toMin(to) <= toMin(from)) return err("The end time must be after the start time.");
  Object.assign(od, { title, who, date, from, to });
  const clashes = oneDayClashes(od);
  if (clashes.length) { od.clashes = clashes; return drawOneDay(); }
  finishOneDay([], false);
}
// Saves it. removed = the clashing activities taken off that day; move = plan the clashing (flexible) ones again in free time
function finishOneDay(removed, move) {
  const was = (data.oneDay || []).find(x => x.id === od.id);
  const e = { id: od.id || newId(), title: od.title, who: od.who, date: od.date, from: od.from, to: od.to, by: me,
              skip: [...new Set([...((was && was.date === od.date && was.skip) || []), ...removed])] };
  if (!e.skip.length) delete e.skip;
  data.oneDay = [...(data.oneDay || []).filter(x => x.id !== e.id), e];
  const ids = new Set((od.clashes || []).filter(c => removed.includes(c.actId) || (move && !c.fixed)).map(c => c.actId));
  if (ids.size && hasPlan() && data.plan.dates[e.date]) data.plan.dates[e.date].items = data.plan.dates[e.date].items.filter(it => !ids.has(it.actId));
  if (move && ids.size && hasPlan()) makeAndKeepPlan("fill");   // 🔀 only the ones taken off are placed again (from now, in free time)
  closeOneDay();
  writeData();
  render();
  toast(`📌 ${e.title} is on the calendar${move && ids.size ? `. ${ids.size} ${ids.size === 1 ? "activity was" : "activities were"} moved` : removed.length ? `. ${removed.length} removed for that day` : ""}.`, 3500);
}
function deleteOneDay(id) {
  const e = (data.oneDay || []).find(x => x.id === id);
  if (!e || !isParentDevice() || !confirm(`Delete “${e.title}”?`)) return;
  data.oneDay = data.oneDay.filter(x => x.id !== id);
  if (hasPlan() && e.skip && data.plan.dates[e.date]) makeAndKeepPlan("fill");   // (what it removed for that day can come back)
  closeCard();
  closeOneDay();
  writeData();
  render();
  toast("🗑️ Deleted");
}
// On the calendar: a 📌 card at its time (no tick: never scored)
function oneDayCardHtml(e, ds, opts) {
  const n = blocks.push({ oneDay: e, day: ds }) - 1, faded = (opts.fade && opts.fade !== "all" && !e.who.includes(opts.fade)) || !!opts.subj;
  return `<div class="k-block k-oneday ${faded ? "faded" : ""}" data-kblock="${n}" role="button" tabindex="0" title="${safe(`📌 ${e.title} · ${clock(toMin(e.from), true)}–${clock(toMin(e.to), true)}`)}">
    <span class="who"><span class="t-full">📌 ${safe(e.title)}</span><span class="t-short">📌 ${safe(e.title)}</span></span>
    <span class="k-sub"><span class="when">${clock(toMin(e.from))} - ${clock(toMin(e.to))}</span> <span class="what">${facesHtml(e.who.filter(exists))}</span></span></div>`;
}
function openOneDayCard(b) {
  const e = b.oneDay;
  const rows = [["📌 What", e.title], ["🙂 Who", e.who.filter(exists).map(whoText).join(", ")], ["📅 Day", dayLong(e.date)],
                ["⏰ Time", `${clock(toMin(e.from), true)} – ${clock(toMin(e.to), true)}`], ["⭐ Points", "None: a one-day event isn't scored"]];
  $("kCard").style.cssText = "--soft:#fef3c7;--ink:#6b4f05";
  $("kCard").innerHTML = `
    <div class="k-card-top"><div class="big">📌</div><div class="nm">${safe(e.title)}</div></div>
    <div class="k-rows">${rows.map(([l, v]) => `<div><span>${safe(l)}</span><b>${safe(v)}</b></div>`).join("")}</div>
    ${isParentDevice() ? `<div class="btnrow" style="justify-content:center;margin:10px 16px 0"><button data-onedayedit="${safe(e.id)}">✏️ Change</button>
      <button class="danger-text" data-onedaydel="${safe(e.id)}">🗑️ Delete</button></div>` : ""}
    <button class="k-ok" id="kOk">OK 👍</button>`;
  $("kModal").hidden = false;
  $("kOk").focus();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-newplan], [data-onedaynew], [data-onedayedit], [data-onedaydel]");
  if (!b) return;
  const ds = b.dataset;
  if ("newplan" in ds) return newPlanNow();
  if ("onedaynew" in ds) return openOneDay(null);
  if (ds.onedayedit) return openOneDay(ds.onedayedit);
  if (ds.onedaydel) return deleteOneDay(ds.onedaydel);
});
$("odModal").addEventListener("click", e => {
  if (e.target === $("odModal")) return closeOneDay();
  const b = e.target.closest("button");
  if (!b || !od) return;
  const ds = b.dataset;
  if ("odsave" in ds) return saveOneDay();
  if ("odcancel" in ds) return closeOneDay();
  if ("oddel" in ds) return deleteOneDay(od.id);
  if ("odback" in ds) { delete od.clashes; return drawOneDay(); }
  if ("odmove" in ds) return finishOneDay([], true);
  if ("odremove" in ds) return finishOneDay(od.clashes.map(c => c.actId), false);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("odModal").hidden) closeOneDay(); });
// One date of the saved plan, ready to draw: { date, window, items, routines }. Each block gets its current name, owner and people.
// (Activities deleted since the plan was made are left out. No plan, or a date it doesn't have: no items, but the routines.)
function planDay(ds) {
  const wd = weekdayOf(ds), saved = hasPlan() && data.plan.dates[ds];
  const items = (saved ? saved.items : []).map(it => {
    const act = (it.fixed ? data.fixed : data.flexible).find(a => a.id === it.actId);
    // (🗂️ a deleted activity kept as history on a day that's gone: drawn from what it remembers, look-only)
    const g = !act && it.gone, users = g ? g.users.filter(exists) : [];
    if (g) return users.length ? { ...it, name: g.name, users, people: g.people.filter(exists), helper: "", type: g.type } : null;
    return act ? { ...it, name: act.name, users: act.users, people: peopleOf(act), helper: helperOf(act) ? act.helper : "", type: actTypeOf(act), ...(act.must ? { must: true } : {}) } : null;
  }).filter(Boolean).sort((a, b) => a.start - b.start || b.fixed - a.fixed);
  // Strips (kept apart from activities: no checkbox, no points): routines, the fixed activities' get ready / break,
  // and the get ready / break around each planned flexible activity (not a deleted one's).
  const flexPads = items.filter(it => !it.fixed && !it.gone).flatMap(it => padsFor(data.flexible.find(a => a.id === it.actId), it.start, it.end));
  return { date: ds, window: dayWindow(wd), items, routines: [...routinesOn(wd), ...flexPads].sort((a, b) => a.start - b.start) };
}
// This points week, Monday … Sunday (scores, reports, print, free time). null = no plan yet.
function planDays() { return hasPlan() ? weekDates().map(planDay) : null; }
// The calendar's 12 dates: 5 days back, today, 6 days ahead (with no plan: just the routines)
const calDays = () => calDates().map(planDay);

// =====================================================================
//  THE COLORFUL WEEK (my plan, everyone's plan)
// =====================================================================
// Phone: a calendar opens on one day. Computer: on the whole week.
const isPhone = () => window.matchMedia("(max-width: 699px)").matches;
let viewDay = CAL_BACK;       // which of the calendar's 12 days is showing (0 = 5 days ago … CAL_BACK = today … 11 = today + 6)
let wholeWeek = !isPhone();   // true = show all 12 days
let blocks = [];              // the blocks on screen, so we know which one was tapped

// The last calendar view and person, remembered on THIS device only (not in the family's data), e.g.
// { day: 2, mine: { week: true, who: { dad: "mody" } }, view: { mode: "full", who: "all" } }
const CAL_KEY = SAVE_KEY + ".calendar";
function calPrefs() { try { return JSON.parse(localStorage.getItem(CAL_KEY)) || {}; } catch (e) { return {}; } }
function saveCalPrefs() {
  const p = calPrefs();
  p.day = viewDay;
  if (screen === "mine" && exists(me)) p.mine = { week: wholeWeek, who: { ...((p.mine && p.mine.who) || {}), [me]: calWho } };
  try { localStorage.setItem(CAL_KEY, JSON.stringify(p)); } catch (e) {}
}
// 📅 A day strip always opens on TODAY (an old picked day is never brought back); a tapped day shows only until you leave the page
const savedDay = () => CAL_BACK;
// When the app comes back after a while (10+ minutes away), or at midnight while it's open: "today" is picked again everywhere
let dayAway = 0, lastToday = null;   // (set on the first check)
function backToToday() {
  viewDay = CAL_BACK; habitDay = todayIndex(); lastToday = todayYmd();
  calScrollFresh();
  if (exists(me)) render();
  scrollStripToToday();
}
// 📅 The calendar's sideways scroll (a phone's 12 days, or a narrow screen): it opens with TODAY in view, and stays where
// it was when the calendar is drawn again (a tick, a tap). id = the box the calendar is drawn in.
const calScroll = {};   // id → scrollLeft (missing = scroll to today next time)
function calScrollFresh() { Object.keys(calScroll).forEach(id => delete calScroll[id]); }
function keepCalScroll(id) { const sc = $(id) && $(id).querySelector(".k-scroll"); if (sc && hasOwn(calScroll, id)) calScroll[id] = sc.scrollLeft; }
function putCalScroll(id) {
  requestAnimationFrame(() => {
    const sc = $(id) && $(id).querySelector(".k-scroll");
    if (!sc) return;
    if (!hasOwn(calScroll, id)) {   // (today at the left, with a little of yesterday showing)
      const t = sc.querySelector(".k-day.today"), times = sc.querySelector(".k-time");
      if (t && sc.scrollWidth > sc.clientWidth)
        sc.scrollLeft += t.getBoundingClientRect().left - sc.getBoundingClientRect().left - (times ? times.offsetWidth : 0) - 24;
    } else sc.scrollLeft = calScroll[id];
    calScroll[id] = sc.scrollLeft;
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { dayAway = Date.now(); if (!lastToday) lastToday = todayYmd(); return; }
  if ((lastToday && todayYmd() !== lastToday) || (dayAway && Date.now() - dayAway >= 10 * 60000)) backToToday();
});
setInterval(() => { if (!lastToday) lastToday = todayYmd(); else if (todayYmd() !== lastToday) backToToday(); }, 30000);   // (🌙 midnight: a new "today")
// The strip scrolls (when it's wider than the screen) so the picked day, or today, can be seen
function scrollStripToToday() {
  requestAnimationFrame(() => document.querySelectorAll(".k-days, .v-days").forEach(strip => {
    const t = strip.querySelector(".sel") || strip.querySelector(".istoday");
    if (t && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2;
  }));
}
// Opening "My calendar": the last day, Day / Week and person (or today, and my own week)
function restoreMine() {
  const p = calPrefs(), m = p.mine || {};
  viewDay = savedDay(p);
  calScrollFresh();
  wholeWeek = typeof m.week === "boolean" ? m.week : !isPhone();
  const who = m.who && m.who[me];
  if (calWho !== "all") calWho = who === "all" || exists(who) ? who : null;   // (a link to "Everyone" keeps "Everyone")
}

// A small Day / Week switch, then ‹ Thu 23 · Fri 24 … › (the calendar's 12 dates). Phone: swiping also changes the day.
function navHtml(dates) {
  const today = todayYmd();
  return `<div class="k-nav"><div class="k-navrow">
      <div class="seg k-mode"><button class="${wholeWeek ? "" : "on"}" data-kmode="day">📆 Day</button>
        <button class="${wholeWeek ? "on" : ""}" data-kmode="week">📅 Week</button></div></div>
    <div class="k-days"><button class="k-arrow" data-kprev aria-label="Previous day">‹</button>${dates.map((ds, i) => { const d = SHORT[weekdayOf(ds)];
      return `<button class="k-dbtn ${i === viewDay && !wholeWeek ? "sel" : ""} ${ds === today ? "istoday" : ""} ${ds < today ? "past" : ""}" data-kday="${i}" data-date="${ds}"
        ${ds === today ? `aria-label="${d} (today)"` : ""}>${d}<small>${fromYmd(ds).getDate()}</small></button>`; }).join("")}<button class="k-arrow" data-knext aria-label="Next day">›</button></div></div>`;
}

// What a block shows: big title, colors, and a smaller line underneath.
function blockInfo(b) {
  const withDad = b.helper ? ` · ${withText(b)}` : "";   // (🤝 with the helping parent)
  const subject = findSubject(b.name), te = actTypeInfo(b.type || "activity")[1] + (b.must ? "⭐" : "");   // (⭐ the type's emoji next to the name)
  // Fixed activities (School, Gym, Work …) and shared ones (several people): soft grey, with a small colored dot
  // for each person, so each person's own lessons stand out in their color.
  if (b.fixed || b.users.length > 1) {
    const what = `${te} ${b.fixed || !subject ? b.name : subject.name}`;
    return { title: what, titleHtml: safe(what), emoji: b.fixed ? (isSchoolName(b.name) ? "🏫" : "📌") : emojisOf(b.users),
             soft: GREY.soft, ink: GREY.ink, line: GREY.color, dots: b.users,
             what: namesOf(b.users) + withDad };
  }
  // One person's lesson: light background of their color, darker left border, dark text
  // (titleHtml: the same with a parent's 🖼️ photo instead of their emoji)
  const c = colorsOf(userById(b.users[0]));
  return { title: `${emojisOf(b.users)} ${namesOf(b.users)}`, titleHtml: `${facesHtml(b.users)} ${safe(namesOf(b.users))}`, emoji: emojisOf(b.users),
           soft: c.soft, ink: c.ink, line: c.color, what: `${te} ${subject ? subject.name : b.name}` + withDad };
}
// The colors of a block, the same on screen and on paper: one person's lesson → their color; fixed or shared → grey
function blockColors(it) {
  const c = it.fixed || it.users.length > 1 ? GREY : colorsOf(userById(it.users[0]));
  return `--c:${c.color};--soft:${c.soft};--ink:${c.ink}`;
}
// The day header for a date: name and date on ONE line, the same for every day, e.g. "Thu 23 Oct" (calendar, View all plan, print)
function dayHead(ds) { const dt = fromYmd(ds); return `${SHORT[weekdayOf(ds)]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; }
// Small colored dots, one per person (for fixed and shared activities)
function dotsHtml(ids) {
  return `<span class="k-dots">${ids.map(id => { const u = userById(id);
    return `<i style="background:${colorsOf(u).color}" title="${safe(u.name)}"></i>`; }).join("")}</span>`;
}

// Draws the days as colorful cards. days = planDay()s (📅 the calendar's 12 dates: 5 back, today, 6 ahead).
// opts.only = show only this person's blocks; opts.fade = fade blocks that aren't this person's;
// opts.readOnly = just for looking (no "done" checkboxes). Past days are always look-only (their ticks show, nothing moves).
function weekHtml(days, opts) {
  const today = todayYmd(), dates = days.map(x => x.date);
  blocks = [];
  const sessCache = {}, sessOf = id => sessCache[id] || (sessCache[id] = sessionsIn(id, dates));   // 📚 each person's study sessions on these dates
  const dayParts = [];   // each day's cards and strips, with their start time
  days.forEach(day => {
    const ds = day.date, past = ds < today;
    let items = opts.only ? day.items.filter(it => it.people.includes(opts.only)) : day.items;
    // One block per activity, with one "done" circle per person ("acts").
    // On someone's own plan, only their own circle shows (Dad helping with a lesson sees the kid's circle).
    // Two separate fixed activities with the same name and time (like School) also become one block.
    const merged = [];
    for (const it of items) {
      const who = opts.only && it.users.includes(opts.only) ? [opts.only] : it.users;
      const acts = who.map(user => ({ user, actId: it.actId }));
      const same = it.fixed && merged.find(b => b.fixed && b.name === it.name && b.start === it.start && b.end === it.end && b.helper === it.helper);
      if (same) { same.users = [...new Set([...same.users, ...it.users])]; same.acts.push(...acts); same.people = [...new Set([...same.people, ...it.people])]; }
      else merged.push({ ...it, acts });
    }
    // Everything on this day in time order: activity blocks and thin routine strips
    const parts = [];
    // Routines: a thin grey strip with only the emoji and name (no time, no checkbox). Tap it for the details.
    // On a shared view, small emojis show who it's for (none when it's everyone).
    routineStrips(day.routines, opts.only).forEach(s => {
      const faded = (opts.fade && opts.fade !== "all" && !s.users.includes(opts.fade)) || !!opts.subj;   // (📚 a subject picked: faded)
      const n = blocks.push({ ...s, day: ds, soft: "#f1f2f6", ink: "#6b7280" }) - 1;
      parts.push({ start: s.start, end: s.end, strip: true, padId: s.pad ? s.id : null, html: `<div class="k-routine ${s.pad ? "pad" : ""} ${faded ? "faded" : ""}" data-kblock="${n}" role="button" tabindex="0"
          title="${safe(s.name)} · ${clock(s.start, true)}–${clock(s.end, true)}"><span class="r-nm">${safe(s.emoji)} ${safe(s.name)}</span>${
          !opts.only && !isEveryone(s.users) ? `<span class="r-who">${facesHtml(s.users)}</span>` : ""}</div>` });
    });
    // 📌 School dates with a time: a strip at that time (all-day ones are under the day name). Never planned around.
    eventsOn(ds, opts.only || null).filter(e => e.time).forEach(e =>
      parts.push({ start: toMin(e.time), end: toMin(e.time) + 30, strip: true, html: eventHtml(e, opts.only || null) }));
    // 📅 A parent's own activity with a time: a card in their color with their name (✅ only that parent ticks it)
    const pacts = pactsOn(ds, opts.only || null).filter(a => a.type !== "travel" && a.from);
    pacts.forEach(a => parts.push({ start: toMin(a.from), end: toMin(a.to), html: pactCardHtml(a, ds, opts) }));
    // 📌 One-day events (only that person's on their own calendar; never a tick)
    const odays = oneDayOn(ds).filter(e => !opts.only || e.who.includes(opts.only));
    odays.forEach(e => parts.push({ start: toMin(e.from), end: toMin(e.to), html: oneDayCardHtml(e, ds, opts) }));
    if (!merged.length && !pacts.length && !odays.length) parts.push({ free: true, start: -1, html: `<div class="k-free">${past ? "Nothing planned" : "Free day! 🎉"}</div>` });
    // 🕌 Prayer times (only for people who want them): inside the activity happening then, otherwise a thin line of its own
    const prays = prayersOn(ds), inPrayer = new Set();
    const praysIn = b => prays.filter(p => b.start <= p.start && p.start < b.end);
    merged.forEach(b => praysIn(b).forEach(p => inPrayer.add(p)));
    prays.filter(p => !inPrayer.has(p)).forEach(p => parts.push({ start: p.start, end: p.start + 1, strip: true, html: prayLineHtml(p, false) }));
    merged.forEach(b => {
      const info = blockInfo(b);
      // 🤝 On the helping parent's own calendar: the kid's activity shows faded, as "helping"
      const helping = !!opts.only && b.helper === opts.only && !b.users.includes(opts.only);
      // (📚 the subject filter: only that subject's sessions stand out)
      const faded = (opts.fade && opts.fade !== "all" && !b.people.includes(opts.fade)) || helping || (!!opts.subj && !subjMatch(b, ds, opts, sessOf));
      const kidActs = b.acts.filter(a => !isParentId(a.user));   // (only the kids' parts are ticked)
      const done = kidActs.length > 0 && kidActs.every(a => isDone(ds, a.actId, a.user));
      const n = blocks.push({ ...b, ...info, day: ds }) - 1;
      // The round "done" checkbox: one per person (a shared block like School has one for each kid).
      // View only (opts.readOnly): no checkboxes, just "Done!" when it's finished.
      // (👨‍👩‍👧 a parent's own activity: no tick for points, parents aren't scored)
      const checks = opts.readOnly ? "" : b.acts.filter(a => !isParentId(a.user)).map(a => {
        const on = isDone(ds, a.actId, a.user), owner = userById(a.user), parentPast = past && parentPastTick(ds, a.user);
        const allowed = ((isParentId(me) || a.user === me) && ds === today) || parentPast;
        // ⏰ Everyone: locked (grey 🔒) until the start time; a tap says when (see tickTimeLock). Future days: locked too.
        const timeLock = !on && (ds > today || tickTimeLock(ds, b.start) != null);
        if (timeLock && (isParentId(me) || a.user === me)) return `<button class="k-check time-lock" data-check="${ds}|${safe(a.actId)}|${safe(a.user)}" style="--c:${colorsOf(owner).color}"
                  aria-label="${safe(`Locked until ${ds > today ? dayName(ds) : clock(b.start, true)}: ${b.name}`)}" title="${safe(ds > today ? `On ${dayName(ds)}` : `At ${clock(b.start, true)}`)}">🔒</button>`;
        const label = `${on ? "Done! Tap to untick" : ds > today ? "Not yet" : "Tap when done"}: ${owner.name}, ${b.name}`;
        // 🔒 A kid's device: someone else's tick is only a picture (look-only, no button). 📅 Past days: look-only
        // (except 👨‍👩‍👧 a parent's device on an earlier day of this week: see parentPastTick)
        if (kidLockedOut(a.user) || b.gone || (past && !parentPast)) return `<span class="k-check ${on ? "on" : ""}" role="img" style="--c:${colorsOf(owner).color}"
                  aria-label="${safe(`${on ? "Done" : "Not done"}: ${owner.name}, ${b.name}`)}">${on ? "✓" : b.acts.length > 1 ? `<span class="e">${safe(owner.emoji)}</span>` : ""}</span>`;
        return `<button class="k-check ${on ? "on" : ""}" data-check="${ds}|${safe(a.actId)}|${safe(a.user)}" ${allowed ? "" : "disabled"}
                  style="--c:${colorsOf(owner).color}" aria-pressed="${on}" aria-label="${safe(label)}" title="${safe(label)}">
                  ${on ? "✓" : b.acts.length > 1 ? `<span class="e">${safe(owner.emoji)}</span>` : ""}</button>`;
      }).join("");
      // Bro2a can drag flexible activities (not fixed ones). A moved one has a 📌 (Bro2a taps it to unpin).
      // Edit mode (Bro2a): flexible activities get a ✥ handle and a dashed border and can be moved;
      // fixed ones look locked 🔒. A moved one has a 📌 (tap it in edit mode to unpin).
      // (📅 only today and the days ahead: past days never move)
      const movable = opts.drag && !b.fixed && !b.gone && !past;
      const drag = movable ? `data-drag="${ds}|${safe(b.actId)}"` : "";
      const pin = !b.pinned ? "" : movable
        ? `<button class="k-pin" data-unpin="${ds}|${safe(b.actId)}" title="Moved by hand. Tap to unpin" aria-label="Pinned. Tap to unpin">📌</button>`
        : `<span class="k-pin" title="Placed by ${safe(dadName())}">📌</span>`;
      const mark = !opts.drag ? "" : b.fixed || past ? `<span class="k-lock" title="${b.fixed ? "Fixed: can't be moved here" : "A past day: can't be moved"}">🔒</span>` : `<span class="k-handle" aria-hidden="true">✥</span>`;
      // ⇄ = something else on this day happens at the same time (tap it to see what)
      const same = sameTimeText(b, merged);
      const sameBtn = same ? `<button class="k-same" data-same="${safe(same)}" title="${safe(same)}" aria-label="${safe(same)}">⇄</button>` : "";
      // Narrow card (side by side): a short title (emoji + name) instead of the full one.
      // Fixed or shared: just the colored dots, not everyone's names (tap the card for the full details).
      const subject = findSubject(b.name), te = actTypeInfo(b.type || "activity")[1] + (b.must ? "⭐" : "");
      // (as HTML: a parent's 🖼️ photo instead of their emoji)
      const shortHtml = b.fixed || b.users.length > 1 ? info.titleHtml : `${facesHtml(b.users)} ${safe(`${te} ${subject ? subject.name : b.name}`)}`;
      // Line 2 = time, then the dots (shared) or the type + name, then 🤝 with the helping parent ("🤝 helping" on their own calendar)
      const whatHtml = [info.dots ? "" : safe(`${te} ${subject ? subject.name : b.name}`), helping ? "🤝 helping" : b.helper ? withHtml(b) : ""].filter(Boolean).join(" · ");
      // 📚 A study session: its result ("✅ 85%", "⏳ 👩 Mum rates it"), or 📖 "📚 Start session" (today only, not while moving cards)
      const sess = b.type === "study" && !opts.drag ? b.acts.map(a => sessOf(a.user).find(x => x.date === ds && x.actId === a.actId)).filter(Boolean) : [];
      const sessHtml = sess.map(x => { const tag = sessionTagText(x), who = sess.length > 1 ? userById(x.person).emoji + " " : "";
        const can = !opts.readOnly && x.mode === "sole" && ds === today && (x.person === me || isParentId(me)) && !kidLockedOut(x.person);
        // 📚 "Which subject today?" (several subjects allowed, none picked: today or a day ahead, before the session ends)
        if (!opts.readOnly && x.needsPick && !x.ended && ds >= today && (x.person === me || isParentId(me)) && !kidLockedOut(x.person) && !sessionWsIds(x.key).length)
          return `${safe(who)}${subjectPickHtml(x, false)}`;
        const picked = x.options.length > 1 && !x.needsPick ? `<span class="k-sesstag">${safe(who)}📚 ${safe(x.subject)}</span> ` : "";
        return picked + (tag ? `<span class="k-sesstag">${safe(who + tag)}</span>` : can ? `<button class="k-sess" data-sessstart="${safe(x.key)}">${safe(who)}📚 Start session</button>` : ""); }).join(" ");
      parts.push({ start: b.start, end: b.end, padIds: padIdsOf(b), html: `<div class="k-block ${b.fixed ? "fixed" : ""} ${checks && b.acts.length > 1 ? "many" : ""} ${drag ? "draggable editable" : ""} ${opts.drag && (b.fixed || past) ? "locked" : ""} ${faded ? "faded" : ""} ${done ? "done" : ""}" data-kblock="${n}" role="button" tabindex="0" ${drag}
                 style="--soft:${info.soft};--ink:${info.ink};--line-c:${info.line}">
        ${mark}${pin}<span class="k-checks">${checks}${done ? `<span class="k-donetag">Done!</span>` : ""}</span>
        <span class="who">${sameBtn}<span class="t-full">${info.titleHtml}</span><span class="t-short">${shortHtml}</span></span>
        <span class="k-sub"><span class="when">${clock(b.start)} - ${clock(b.end)}</span>${info.dots ? " " + dotsHtml(info.dots) : ""}${whatHtml
          ? ` <span class="what">${whatHtml}</span>` : ""}</span>${sessHtml ? `<span class="k-sessrow">${sessHtml}</span>` : ""}${praysIn(b).map(p => prayLineHtml(p, true)).join("")}</div>` });
    });
    // 🕗 Only that day's time (Day starts at … Day ends at): anything wholly before or after it isn't drawn
    const [ws, we] = day.window || [0, 24 * 60];
    dayParts.push(parts.filter(p => p.free || (p.end > ws && p.start < we)).sort((a, b) => a.start - b.start));
  });
  // ✈️ Travel: one bar across its days (under the day names)
  const bars = travelBars(opts.only || null, dates).map(x => ({ ...x, html: travelBarHtml(x, opts) }));
  // opts.whole = always all the days, without the Day / Week switch (View all plan → "🗓️ Full week")
  return (opts.whole ? "" : navHtml(dates)) + weekRowsHtml(dayParts, d => { const ds = dates[d];
    return `<div class="k-dayname" ${ds === today ? `title="Today"` : ""}>${ds === today ? "📍 " : ""}${dayHead(ds)}</div>${examTagsHtml(ds, opts.only || null)}${
      eventsOn(ds, opts.only || null).filter(e => !e.time).map(e => eventHtml(e, opts.only || null)).join("")}${
      pactsOn(ds, opts.only || null).filter(a => a.type !== "travel" && !a.from).map(a => pactDayHtml(a, ds, opts)).join("")}`; }, opts.whole || wholeWeek, bars, dates);
}

// Rows by time of day: every different start time in the week (to the nearest 15 minutes) is one row,
// sorted from morning to night, so things that start at the same time line up across the week.
// A card starts in the row of its start time and spans down over every row until its end time.
// Things on the same day that overlap get their own lane (side by side), so no card hides another.
const slot15 = min => Math.round(min / 15) * 15;
// "7:30 AM"
function rowTime(min) { return `${clock(min)} ${min >= 12 * 60 ? "PM" : "AM"}`; }
// "At the same time as: Gym (Bro2a)" — the other activities this day that overlap it (empty when none)
function sameTimeText(b, list) {
  const others = list.filter(o => o !== b && o.start < b.end && b.start < o.end);
  return others.length ? "At the same time as: " + others.map(o => `${o.name} (${namesOf(o.users)})`).join(", ") : "";
}
// The ids of an activity's own "Get ready" and "Break" strips (see padsFor), so they can be glued to its card
function padIdsOf(it) {
  return (it.acts ? it.acts.map(a => a.actId) : [it.actId]).flatMap(id => [`ready-${id}-${it.start}`, `break-${id}-${it.end}`]);
}
// Works out the rows and, for each day, each thing's row, how many rows it spans, its lane and how many lanes wide it is.
// dayParts = per day a list of { start, end, html, strip, padId, padIds, free }.
function rowLayout(dayParts) {
  // "Get ready" / "Break" never get a lane of their own: they're glued above / below their own activity's card
  dayParts = dayParts.map(parts => {
    const cards = parts.filter(p => p.padIds);
    const rest = [];
    parts.forEach(p => {
      const card = p.padId && cards.find(c => c.padIds.includes(p.padId));
      if (!card) return rest.push(p);
      if (p.padId.startsWith("ready-")) card.above = (card.above || "") + p.html;
      else card.below = (card.below || "") + p.html;
    });
    return rest.map(p => p.above || p.below ? { ...p, html: (p.above || "") + p.html + (p.below || "") } : p);
  });
  const times = [...new Set(dayParts.flatMap(parts => parts.filter(p => !p.free).map(p => slot15(p.start))))].sort((a, b) => a - b);
  const rows = times.length ? times : [null];   // (a week with nothing: one empty row)
  const days = dayParts.map(parts => {
    let items = [];
    parts.filter(p => !p.free).sort((a, b) => a.start - b.start).forEach(p => {
      const r0 = times.indexOf(slot15(p.start));
      // Two things in the same row that don't really overlap (e.g. 5:00–5:20 and 5:20): one under the other, same lane
      // (a card that stretches over several columns — View all plan — always stays on its own)
      const prev = !p.solo && items.find(o => !o.solo && o.r0 === r0 && o.end <= p.start);
      if (prev) { prev.html += p.html; prev.end = Math.max(prev.end, p.end); prev.strip = prev.strip && !!p.strip; }
      else items.push({ r0, start: p.start, end: p.end, html: p.html, strip: !!p.strip, solo: !!p.solo, key: p.key, first: p.first });
    });
    // A card spans down over the rows until its end time (routine strips stay one row high) …
    items.forEach(it => it.n = it.strip ? 1 : Math.max(1, times.filter(t => t >= times[it.r0] && t < it.end).length));
    // … but stops above anything that starts after it has ended (the rows are rounded to 15 minutes)
    items.forEach(it => items.forEach(o => { if (o !== it && o.r0 > it.r0 && o.r0 < it.r0 + it.n && o.start >= it.end) it.n = o.r0 - it.r0; }));
    items.sort((a, b) => a.r0 - b.r0 || b.n - a.n);
    // Groups of things that really overlap each other. Only a group is split into lanes:
    // 2 together → halves, 3 → thirds. Anything with nothing else at its time keeps the full width.
    const groups = [];
    let group = null, groupEnd = -1;
    items.forEach(it => {
      if (!group || it.r0 > groupEnd) { group = []; groups.push(group); groupEnd = -1; }
      group.push(it);
      groupEnd = Math.max(groupEnd, it.r0 + it.n - 1);
    });
    const meets = (a, b) => a.r0 <= b.r0 + b.n - 1 && b.r0 <= a.r0 + a.n - 1;
    groups.forEach(g => {
      // Each thing goes in the first lane that's free from its first row …
      const ends = [];
      g.forEach(it => {
        let lane = ends.findIndex(e => e < it.r0);
        if (lane < 0) lane = ends.length;
        ends[lane] = it.r0 + it.n - 1;
        it.lane = lane;
      });
      // … then gets wider to the right, as long as nothing in those lanes shares its rows (so no lane is left empty)
      g.forEach(it => {
        const right = g.filter(o => o.lane > it.lane && meets(it, o)).map(o => o.lane);
        it.w = (right.length ? Math.min(...right) : ends.length) - it.lane;
        it.lanes = ends.length;
      });
    });
    // The day's columns: enough small columns for every group (e.g. halves and thirds → 6 columns)
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const L = items.reduce((l, it) => l * it.lanes / gcd(l, it.lanes), 1);
    items.forEach(it => { const k = L / it.lanes; it.lane *= k; it.w *= k; it.narrow = it.w < L; });
    return { items, L, free: parts.find(p => p.free) };
  });
  return { rows, days };
}
// bars = ✈️ travel bars, each across its days: [{ d0, d1, html }] (one row each, right under the day names)
// dates = each column's date (📅 today is highlighted; the days before it are greyed a little: look-only)
function weekRowsHtml(dayParts, headHtml, whole = wholeWeek, bars = [], dates = []) {
  const today = dates.indexOf(todayYmd());
  const { rows, days } = rowLayout(dayParts);
  const B = bars.length;
  const last = rows.length + 2 + B;             // the day names row + the bars + the rows + a little space at the bottom
  const cls = d => `${d === today ? "today" : ""} ${today >= 0 && d < today ? "past" : ""} ${d === viewDay ? "sel" : ""}`;
  // Columns: the time labels, then each day's lanes (one lane, or more when things overlap), with a small gap between days.
  // Computer: the 7 days share the width equally (each day = 1fr, split into its lanes), so there's no sideways scroll.
  // --cols = computer, --cols-wide = phone week (scrolls sideways), --cols-day = phone one day.
  const fluid = ["48px"], wide = ["auto"], one = ["auto"], first = [];
  let col = 2;
  days.forEach((x, d) => {
    if (d) { fluid.push("6px"); wide.push("6px"); one.push("0px"); col++; }
    first[d] = col;
    col += x.L;
    // Phone week: a day with things side by side is wider (at least 80px for each of them)
    const dayMin = Math.max(150, 80 * Math.max(1, ...x.items.map(it => it.lanes)));
    for (let i = 0; i < x.L; i++) {
      const lane = `${(dayMin / x.L).toFixed(2)}px`, fr = `${(1 / x.L).toFixed(4)}fr`;
      fluid.push(`minmax(0,${fr})`); wide.push(lane); one.push(d === viewDay ? `minmax(0,${fr})` : "0px");
    }
  });
  let html = `<div class="k-scroll ${whole ? "wide" : ""}"><div class="k-week rows ${whole ? "" : "one-day"}"
    style="--cols:${fluid.join(" ")};--cols-wide:${wide.join(" ")};--cols-day:${one.join(" ")};grid-template-rows:auto ${B ? `repeat(${B}, auto) ` : ""}repeat(${rows.length}, auto) 6px">
    <div class="k-corner"></div>`;
  days.forEach((x, d) => {
    const span = `grid-column:${first[d]} / span ${x.L}`;
    // Each day's white card is drawn behind its column, from the day name to the bottom
    html += `<section class="k-day ${cls(d)}" data-day="${d}" ${dates[d] ? `data-date="${dates[d]}"` : ""} style="${span};grid-row:1 / ${last + 1}"></section>
      <div class="k-cell k-head ${cls(d)}" style="${span};grid-row:1">${headHtml(d)}${x.free ? x.free.html : ""}</div>`;
    x.items.forEach(it => {
      const pad = `padding-left:${it.lane ? 1 : 6}px;padding-right:${it.lane + it.w < x.L ? 1 : 6}px`;
      html += `<div class="k-cell ${it.strip ? "k-stripcell" : "k-span"} ${it.narrow ? "narrow" : ""} ${cls(d)}"
        style="grid-column:${first[d] + it.lane} / span ${it.w};grid-row:${it.r0 + 2 + B} / span ${it.n};${pad}">${it.html}</div>`;
    });
  });
  // ✈️ The travel bars (on the phone's one-day view: only the ones on that day)
  bars.forEach((bar, i) => html += `<div class="k-cell k-barcell ${bar.d0 <= viewDay && viewDay <= bar.d1 ? "sel" : ""}"
    style="grid-column:${first[bar.d0]} / ${first[bar.d1] + days[bar.d1].L};grid-row:${i + 2}">${bar.html}</div>`);
  // The time labels (on the phone's one-day view: only the times that day has)
  rows.forEach((t, r) => {
    const used = (days[viewDay] || { items: [] }).items.some(it => it.r0 === r);
    html += `<div class="k-time ${used ? "" : "not-sel"}" style="grid-row:${r + 2 + B}">${t === null ? "" : rowTime(t)}</div>`;
  });
  return html + `</div></div>`;
}

// The big card: who, what, day, start and end
function openCard(b) {
  if (b.routine) return openRoutineCard(b);
  if (b.pact) return openPactCard(b);
  if (b.oneDay) return openOneDayCard(b);
  const flex = !b.fixed && data.flexible.find(a => b.acts.some(x => x.actId === a.id));
  const rows = [
    b.fixed ? ["📌 Activity", b.name] : ["📘 What", findSubject(b.name) ? `${findSubject(b.name).emoji} ${findSubject(b.name).name}` : b.name],
    ["🙂 Who", b.users.map(whoText).join(", "), b.users.map(whoHtml).join(", ")],   // (3rd = as HTML, with a parent's 🖼️ photo)
    ["⭐ Type", (([, e, w]) => `${e} ${w}`)(actTypeInfo(b.type || "activity"))],
    helperOf(b) ? ["🤝 Helper", `${helperOf(b).emoji} ${helperOf(b).name}`, whoHtml(helperOf(b).id)] : null,
    ["📅 Day", dayLong(b.day)],
    // (👨‍👩‍👧 only the kids' parts: parents aren't ticked)
    b.acts.some(a => !isParentId(a.user)) ? ["✅ Done", b.acts.filter(a => !isParentId(a.user)).map(a => (b.acts.length > 1 ? userById(a.user).emoji + " " : "") + (isDone(b.day, a.actId, a.user) ? "Yes! 🎉" : "Not yet")).join("  ")] : null,
    ["⏰ Start", clock(b.start, true)],
    ["🏁 End", clock(b.end, true)],
    flex && flex.between ? ["🕓 Only between", betweenText(flex.between)] : null
  ].filter(Boolean);
  $("kCard").style.cssText = `--soft:${b.soft};--ink:${b.ink}`;
  $("kCard").innerHTML = `
    <div class="k-card-top"><div class="big">${b.fixed ? safe(b.emoji) : facesHtml(b.users)}</div><div class="nm">${safe(b.fixed ? b.name : namesOf(b.users))}</div></div>
    <div class="k-rows">${rows.map(([label, value, html]) => `<div><span>${safe(label)}</span><b>${html || safe(value)}</b></div>`).join("")}</div>
    <button class="k-ok" id="kOk">OK 👍</button>`;
  $("kModal").hidden = false;
  $("kOk").focus();
}
// =====================================================================
//  ✏️ EDIT CALENDAR (Bro2a only): move flexible activities to another time or day
// =====================================================================
// Dragging is OFF until Bro2a presses "✏️ Edit calendar". In edit mode:
//  · drag a flexible activity (mouse or finger — no long press); scroll with the empty space
//  · or tap it to pick a day and start time in a small box
//  · the time snaps to 15 minutes, and the block is green (free) or red (busy)
//  · full week: drop on another day's column; one day (phone): drop on a day button at the top
// Moves are a draft until "✅ Done" (the same Save as everything else). Leaving first asks to save or discard.
const SNAP = 15;            // minutes
const PX_PER_SNAP = 14;     // how far to move the finger for 15 minutes
let editMode = false;       // is the calendar in edit mode?
let editUndo = [];          // the plan before each move (for "↩️ Undo")
let drag = null;            // the drag in progress
let suppressClick = false;  // after a drag, don't open the big card

function startEdit() {
  if (!isParentId(me)) return toast(`Ask ${dadName()} 🙂`);
  editMode = true;
  editUndo = [];
  if (screen === "all") allView = "cards";   // editing works on the cards
  render();
}
// "✅ Done": save everything (the same save function as the rest of the app), leave edit mode
function finishEdit() {
  editMode = false;
  editUndo = [];
  saveChanges();
  hideSaved();
  toast("Saved ✓ The calendar is updated.", 3000, "#16a34a");
}
function undoEdit() {
  if (!editUndo.length) return;
  data.plan = JSON.parse(editUndo.pop());
  changed();
  toast("↩️ Undone.");
}
// The bar at the top of the calendar while editing
function editBarHtml() {
  if (!editMode || !isParentId(me)) return "";
  return `<div class="edit-bar"><span>✏️ Edit mode: drag activities to change their day or time</span>
    <span class="edit-btns"><button data-editundo ${editUndo.length ? "" : "disabled"}>↩️ Undo</button>
    <button class="save-btn" data-editdone>✅ Done</button></span></div>`;
}

// Is this place free for everyone in the activity? → { ok } or { ok: false, why: "Jawad is at School then." }
// fromDay / toDay = dates. 📅 Only today (from now) … today + 6: past days never change.
function moveCheck(actId, fromDay, toDay, start) {
  const act = data.flexible.find(a => a.id === actId);
  if (!act) return { ok: false, why: "That activity doesn't exist any more." };
  const today = todayYmd(), last = addDaysYmd(today, PLAN_AHEAD);
  if (!isYmd(toDay) || toDay < today) return { ok: false, why: "Past days can't be changed." };
  if (toDay > last) return { ok: false, why: `The plan only goes up to ${dayLong(last)}.` };
  const end = start + act.duration, S = start - (act.getReady || 0), E = end + (act.breakAfter || 0);
  if (toDay === today && start < dubaiMinutes()) return { ok: false, why: "That time has already passed today." };
  const [ws, we] = dayWindow(weekdayOf(toDay));
  if (S < ws || E > we) return { ok: false, why: `That's outside “My day” (${showTime(ws)}–${showTime(we)}).` };
  const only = onlyWindow(act);
  if (only && (start < only[0] || end > only[1])) return { ok: false, why: `${act.name} is only between 🕓 ${betweenText(act.between)}.` };
  if (toDay !== fromDay && planItemsOn(toDay).some(it => it.actId === actId)) return { ok: false, why: `${act.name} is already on ${dayName(toDay)}.` };
  const day = planDay(toDay), people = peopleOf(act);
  const mine = x => x.actId === actId || String(x.id || "").includes(`-${actId}-`);   // the activity itself and its own strips
  const busy = [...day.items.filter(it => !mine(it)), ...day.routines.filter(r => !mine(r)).map(r => ({ ...r, people: r.users }))];
  for (const b of busy) {
    const shared = b.people.filter(p => people.includes(p));
    if (!shared.length || !(b.start < E && S < b.end)) continue;
    // Two lessons Bro2a allowed together may share his time (never a kid's fixed activity)
    if (!b.fixed && !b.routine && act.overlapWith.includes(b.actId)) continue;
    const who = userById(shared.find(p => p !== DAD) || shared[0]).name;
    const why = b.fixed && !b.routine && isSchoolName(b.name) ? `${who} is at School then.`
      : b.pad && b.before ? `${who} is getting ready for ${b.before} then.`
      : b.pad && b.after ? `${who} has a break after ${b.after} then.`
      : `${who} has ${b.name} then.`;
    return { ok: false, why };
  }
  return { ok: true };
}

document.addEventListener("pointerdown", e => {
  const el = e.target.closest("[data-drag]");
  if (!el || !editMode || !isParentId(me) || e.button > 0 || e.target.closest(".k-pin, .k-same")) return;
  const [d, actId] = el.dataset.drag.split("|");   // (d = the date)
  const it = planItemsOn(d).find(x => !x.fixed && x.actId === actId);
  if (!it) return;
  drag = { el, actId, fromDay: d, toDay: d, orig: it.start, start: it.start, x0: e.clientX, y0: e.clientY,
           id: e.pointerId, touch: e.pointerType !== "mouse", started: false, check: { ok: true } };
});
function startDrag() {
  if (!drag) return;
  drag.started = true;
  drag.el.classList.add("dragging");
  document.body.classList.add("drag-on");
  try { drag.el.setPointerCapture(drag.id); } catch (err) {}
  if (drag.touch && navigator.vibrate) navigator.vibrate(25);
  updateDrag(drag.x0, drag.y0);
}
document.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
  if (!drag.started) {
    if (dist > 6) startDrag();        // mouse or finger: it starts as soon as it moves (edit mode only)
    else return;
  }
  updateDrag(e.clientX, e.clientY);
});
// While dragging on a phone, the page must not scroll
document.addEventListener("touchmove", e => { if (drag && drag.started) e.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", e => { if (drag) e.preventDefault(); });

function updateDrag(x, y) {
  const dx = x - drag.x0, dy = y - drag.y0;
  drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
  // Which day is under the finger? (another day's column, or a day button at the top on the phone)
  document.querySelectorAll(".drop-target").forEach(n => n.classList.remove("drop-target"));
  const under = document.elementsFromPoint(x, y).find(n => !drag.el.contains(n) && n.matches && n.matches(".k-dbtn, .k-day"));
  if (under && under.dataset.date) {   // (📅 each day button and column carries its date)
    drag.toDay = under.dataset.date;
    under.classList.add("drop-target");
  }
  // The new time: up/down moves it, snapped to 15 minutes.
  // Over a day button (phone) the time doesn't change: it keeps the time it had just before (same time, another day).
  const act = data.flexible.find(a => a.id === drag.actId);
  if (under && under.matches(".k-dbtn")) drag.start = drag.keep !== undefined ? drag.keep : drag.orig;
  else drag.start = drag.keep = Math.max(0, Math.min(24 * 60 - act.duration, Math.round((drag.orig + dy / PX_PER_SNAP * SNAP) / SNAP) * SNAP));
  drag.check = moveCheck(drag.actId, drag.fromDay, drag.toDay, drag.start);
  drag.el.classList.toggle("drop-ok", drag.check.ok);
  drag.el.classList.toggle("drop-bad", !drag.check.ok);
  const when = drag.el.querySelector(".when");
  if (when) when.textContent = `${drag.toDay !== drag.fromDay ? dayHead(drag.toDay) + " · " : ""}${clock(drag.start)} - ${clock(drag.start + act.duration)}`;
}

document.addEventListener("pointerup", e => { if (drag && e.pointerId === drag.id) endDrag(true); });
document.addEventListener("pointercancel", e => { if (drag && e.pointerId === drag.id) endDrag(false); });
function endDrag(drop) {
  const d = drag;
  drag = null;
  document.body.classList.remove("drag-on");
  document.querySelectorAll(".drop-target").forEach(n => n.classList.remove("drop-target"));
  if (!d.started) return;            // it was a tap: the big card opens as usual
  suppressClick = true;
  setTimeout(() => suppressClick = false, 400);
  const moved = d.toDay !== d.fromDay || d.start !== d.orig;
  if (!drop || !moved) return render();
  if (!d.check.ok) { render(); return toast(`↩ ${d.check.why}`, 3500); }   // red: it goes back
  moveActivity(d.actId, d.fromDay, d.toDay, d.start);
}
// After a drag, the click that follows must not open the big card
document.addEventListener("click", e => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);

// Move it and pin it 📌 (a draft until "✅ Done"). After Done, the kid's calendar, "View all plan"
// and print all read the same saved plan.
// (fromDay / toDay = dates)
function moveActivity(actId, fromDay, toDay, start) {
  const act = data.flexible.find(a => a.id === actId);
  editUndo.push(JSON.stringify(data.plan));
  const from = data.plan.dates[fromDay], to = data.plan.dates[toDay] = data.plan.dates[toDay] || { items: [] };
  if (from) from.items = from.items.filter(it => !(!it.fixed && it.actId === actId));
  to.items.push({ actId, fixed: false, start, end: start + act.duration, pinned: true });
  to.items.sort((a, b) => a.start - b.start);
  if (toDay !== fromDay && !wholeWeek && calDates().includes(toDay)) viewDay = calDates().indexOf(toDay);   // phone: follow it to its new day
  changed();
  toast(`📌 ${act.name} → ${dayName(toDay)} ${clock(start, true)} · tap ✅ Done to save`, 2500);
}
// The saved items on a date (none when the plan doesn't have it)
const planItemsOn = ds => (hasPlan() && data.plan.dates[ds] && data.plan.dates[ds].items) || [];
// Tap 📌 (edit mode): unpin it (then "Plan my week" may move it again). day = the date
function unpin(day, actId) {
  if (!isParentId(me) || !editMode || day < todayYmd()) return;
  const it = planItemsOn(day).find(x => !x.fixed && x.actId === actId);
  if (!it) return;
  editUndo.push(JSON.stringify(data.plan));
  delete it.pinned;
  changed();
  toast("📌 Unpinned. ✨ Plan my week can move it again.");
}

// ---------- The small "Move" box (edit mode): tap a flexible activity, pick the day and start time ----------
let moving = null;   // { actId, fromDay, day } (dates)
function openMoveBox(fromDay, actId) {
  const act = data.flexible.find(a => a.id === actId);
  const it = act && fromDay >= todayYmd() && planItemsOn(fromDay).find(x => !x.fixed && x.actId === actId);
  if (!it) return;
  moving = { actId, fromDay, day: fromDay };
  $("moveTitle").textContent = `${emojisOf(act.users)} ${act.name}`;
  $("moveTime").value = String(Math.floor(it.start / 60)).padStart(2, "0") + ":" + String(it.start % 60).padStart(2, "0");
  drawMoveBox();
  $("moveModal").hidden = false;
}
function drawMoveBox() {
  // (📅 today … today + 6)
  $("moveDays").innerHTML = aheadDates().map(ds => `<button class="${ds === moving.day ? "on" : ""}" data-moveday="${ds}">${SHORT[weekdayOf(ds)]}<small>${fromYmd(ds).getDate()}</small></button>`).join("");
  const t = $("moveTime").value, act = data.flexible.find(a => a.id === moving.actId);
  if (!t) { $("moveCheck").className = "move-check bad"; return $("moveCheck").textContent = "Pick a start time."; }
  const start = toMin(t), check = moveCheck(moving.actId, moving.fromDay, moving.day, start);
  $("moveCheck").className = "move-check " + (check.ok ? "ok" : "bad");
  $("moveCheck").textContent = check.ok ? `✓ Free: ${dayLong(moving.day)} ${clock(start, true)} – ${clock(start + act.duration, true)}` : `✗ ${check.why}`;
}
$("moveTime").addEventListener("input", () => moving && drawMoveBox());
function saveMoveBox() {
  const t = $("moveTime").value;
  if (!moving || !t) return;
  const start = toMin(t), check = moveCheck(moving.actId, moving.fromDay, moving.day, start);
  if (!check.ok) return drawMoveBox();   // stays open, with the reason in red
  const m = moving;
  closeMoveBox();
  const it = planItemsOn(m.fromDay).find(x => !x.fixed && x.actId === m.actId);
  if (m.day === m.fromDay && it && it.start === start) return;   // nothing changed
  moveActivity(m.actId, m.fromDay, m.day, start);
}
function closeMoveBox() { $("moveModal").hidden = true; moving = null; }

// The card for a routine strip: no "Done" row (routines give no points)
function openRoutineCard(b) {
  const rows = [
    [b.pad ? "⏱️ Time to" : "🧺 Routine", `${b.emoji} ${b.name}`],
    b.before ? ["⏭️ Before", b.before] : null,
    b.after ? ["⏮️ After", b.after] : null,
    ["🙂 Who", isEveryone(b.users) ? "Everyone" : usersText(b.users)],
    ["📅 Day", dayLong(b.day)],
    ["⏰ Start", clock(b.start, true)],
    ["🏁 End", clock(b.end, true)]
  ].filter(Boolean);
  $("kCard").style.cssText = `--soft:${b.soft};--ink:${b.ink}`;
  $("kCard").innerHTML = `
    <div class="k-card-top"><div class="big">${safe(b.emoji)}</div><div class="nm">${safe(b.name)}</div></div>
    <div class="k-rows">${rows.map(([label, value]) => `<div><span>${safe(label)}</span><b>${safe(value)}</b></div>`).join("")}</div>
    <button class="k-ok" id="kOk">OK 👍</button>`;
  $("kModal").hidden = false;
  $("kOk").focus();
}
function closeCard() { $("kModal").hidden = true; }

// ---------- 📅 Calendar: the one calendar page ----------
// Chips: "Me" · "Everyone" · one per person. Everyone (kids too) can see everyone's week. The ✅ ticks work only for
// their owner and the parents (the others are greyed out). ✏️ Edit calendar / ✨ Plan my week / ➕ My activity: parents.
let calWho = null;   // "all", a person's id, or null = the first chip (kids: "Me", parents: "Everyone")
const isParentDevice = () => isParentId(me) && !isKidDevice();
function drawMine() {
  $("calTools").innerHTML = calToolsHtml();   // ✏️ Add activities · 🖨️ Schedules to tick
  scrollStripToToday();   // (after it's drawn)
  if (calWho !== "all" && calWho && !exists(calWho)) calWho = null;
  if (!calWho) calWho = isParentDevice() ? "all" : me;
  // 🧒 A kid's device: only "🙋 Me" and "👨‍👩‍👧 Everyone" (look-only for other people's items), never one other person's calendar
  if (!isParentDevice() && calWho !== "all") calWho = me;
  const all = calWho === "all", who = all ? null : calWho, u = who ? userById(who) : null, mine = who === me, parent = isParentDevice();
  // (face = HTML: a parent's 🖼️ photo or their emoji)
  const chip = (id, face, label, c) => `<button class="chip ${calWho === id ? "on" : ""}" data-calwho="${safe(id)}" style="--soft:${c.soft};--ink:${c.ink}"
    ${calWho === id ? `aria-current="true"` : ""}><span class="e">${face}</span>${safe(label)}</button>`;
  $("minePeople").innerHTML = chip(me, parent ? faceHtml(userById(me)) : "🙋", "Me", colorsOf(userById(me))) + chip("all", "👨‍👩‍👧", "Everyone", { soft: "#fef3c7", ink: "var(--text)" })
    + (parent ? data.users.filter(x => x.id !== me).map(x => chip(x.id, faceHtml(x), x.name, colorsOf(x))).join("") : "");
  $("mineTitle").textContent = all ? "📅 Everyone's week" : mine ? `${u.emoji} My week` : `${u.emoji} ${u.name}'s week`;
  $("mineSub").textContent = all ? "Each colour is one person. Tap a block to see more."
    : !mine && !parent ? `Just looking 👀 Only ${u.name}${isParentId(who) ? "" : ` or ${dadName()}`} can tick these.`
    : isParentId(who) ? "Your activities, plus the kids' lessons that need you." : "Tap a block to see more!";
  document.querySelector("#scr-mine .bar .cal-btn").classList.toggle("here", calWho === (parent ? "all" : me));
  // (real = this points week's plan, for the week's numbers; the calendar shows its 12 dates, routines even with no plan yet)
  const real = planDays(), days = calDays();
  const editing = editMode && isParentId(me) && !!real;
  // Buttons: ✏️ Add / edit activities (everyone: kids change only their own), and for parents ✏️ Edit calendar · ✨ Plan my week · ➕ My activity
  $("mineActions").innerHTML = `<button class="pill" data-go="add">✏️ Add / edit activities</button>
    ${isParentId(me) && real && !editMode ? `<button class="pill edit-cal-btn" data-editcal>✏️ Edit calendar</button>` : ""}
    ${isParentId(me) && (!real || planIsOld()) ? `<button class="pill primary" data-plan>✨ Plan my week</button>` : ""}
    ${parent ? `<button class="pill" data-pactnew>➕ My activity</button>` : ""}
    ${parent && real ? `<button class="pill" data-newplan>🔄 Make a new plan</button>` : ""}
    ${parent ? `<button class="pill" data-onedaynew>📌 One-day event</button>` : ""}`;
  // ⚠ The plan's notes (parents, on Everyone) / "not in the plan yet" (kids)
  let top = "";
  if (isParentId(me) && all && real) {
    const w = data.plan.warnings;
    if (planIsOld()) top += `<div class="msg warn"><b>⚠ Things changed since this plan was made.</b> Tap ✨ Plan my week.</div>`;
    if (w.length) top += `<div class="msg warn"><b>⚠ Some things need your attention:</b><ul>${w.map(x => `<li>${safe(x)}</li>`).join("")}</ul></div>`;
  }
  $("calTop").innerHTML = top;
  const note = !real ? (isParentId(me) ? "🗓️ No plan yet. Add activities, then tap ✨ Plan my week." : `🗓️ No plan yet. ${dadName()} will plan the week soon.`)
    : !isParentId(me) && planIsOld() ? `🕐 Some changes aren't in the plan yet. ${dadName()} will update it soon.` : "";
  $("mineNote").hidden = !note;
  $("mineNote").textContent = note;
  $("mineBrief").innerHTML = who ? briefHtml(who, real) : "";
  $("mineBrief").hidden = !who;
  if (who) $("mineBrief").style.cssText = `--c:${colorsOf(u).color}`;
  // Ticks: always drawn; each one only works for its owner and the parents. In edit mode (Bro2a): moving, no ticking.
  // 📚 The subject filter's kid: the kid whose calendar it is; a parent on Everyone / a parent's calendar: the kid picked under it; a kid: themselves
  const sk = subjFilterKid(who), subj = sk && calSubj !== "all" ? { kid: sk, name: calSubj } : null;
  keepCalScroll("mineWeek");
  $("mineWeek").innerHTML = editBarHtml() + weekHtml(days, { only: who, readOnly: editing, drag: editing, subj });
  putCalScroll("mineWeek");   // (📅 opens with today in view; a tick or a tap keeps it where it was)
  $("mineSubj").innerHTML = sk ? subjFilterHtml(sk, who) : "";
  $("mineHabits").innerHTML = who && !kidLockedOut(who) ? habitsCardHtml(who) : "";   // ⭐ good habits (a kid; 🔒 a kid's device: only their own; parents have none)
}

// ---------- 📚 SUBJECT FILTER (bottom of the calendar): "All" + each subject of a kid; a subject → only its study sessions this
// week stand out (the rest is faded) and a summary card. Parents switch between kids; a kid sees only themselves. ----------
let calSubj = "all", sfKid = null;   // the subject (its name) or "all" · the kid a parent picked here (when the calendar isn't one kid's)
function subjFilterKid(who) {
  if (!isParentDevice()) return exists(me) && !isParentId(me) ? me : null;
  if (who && !isParentId(who)) return who;
  if (!kidsList().some(k => k.id === sfKid)) sfKid = kidsList().length ? kidsList()[0].id : null;
  return sfKid;
}
// Does this block count for the subject? (its session's subject: the one picked, the only one, or one it may still be)
function subjMatch(b, ds, opts, sessOf) {
  const { kid, name } = opts.subj;
  return b.type === "study" && b.acts.some(a => { if (a.user !== kid) return false;
    const x = sessOf(kid).find(y => y.date === ds && y.actId === a.actId);
    return !!x && (sameSubject(x.subject, name) || (x.needsPick && x.options.some(o => sameSubject(o.name, name)))); });
}
// "📐 Math this week: 4 sessions (Mon, Tue, Thu, Sat) · 3 h · done 2 of 4 · worksheets done 3 of 5 · topics covered 6 of 14"
function subjSummaryHtml(kid, f) {
  const sess = studySessions(kid).filter(x => sameSubject(x.subject, f.name)), mins = sess.reduce((n, x) => n + x.minutes, 0);
  const days = [...new Set(sess.map(x => SHORT[weekdayOf(x.date)]))];
  const from = data.points.week, to = weekEnd(), ws = wsOf(kid, f.name).filter(w => w.date >= from && w.date < to);
  const done = ws.filter(w => w.check || w.answers.length).length, rows = topicRows(kid, schoolOf(kid), f);
  const covered = rows.filter(t => t.st === "practising" || t.st === "mastered").length;   // (🟡 / 🟢)
  return `<div class="card subj-sum" style="--c:${subjectColors(f).color}"><b>${safe(f.emoji)} ${safe(f.name)} this week:</b>
    ${sess.length} ${sess.length === 1 ? "session" : "sessions"}${days.length ? ` (${days.join(", ")})` : ""} · ${hmText(mins)} · done ${sess.filter(x => x.done).length} of ${sess.length}
    · worksheets done ${done} of ${ws.length} · topics covered ${covered} of ${rows.length}</div>`;
}
function subjFilterHtml(kid, who) {
  const s = schoolOf(kid), subs = subjectList(s);
  if (!subs.length) return "";
  if (calSubj !== "all" && !subs.some(x => sameSubject(x.name, calSubj))) calSubj = "all";
  const kids = isParentDevice() && (!who || isParentId(who)) && kidsList().length > 1
    ? `<div class="chips subj-kids">${kidsList().map(k => `<button class="chip ${k.id === kid ? "on" : ""}" data-sfkid="${safe(k.id)}" aria-pressed="${k.id === kid}"><span class="e">${safe(k.emoji)}</span>${safe(k.name)}</button>`).join("")}</div>` : "";
  const chip = (v, label) => `<button class="chip ${lowerT(calSubj) === lowerT(v) ? "on" : ""}" data-calsubj="${safe(v)}" aria-pressed="${lowerT(calSubj) === lowerT(v)}">${label}</button>`;
  const f = calSubj !== "all" && subs.find(x => sameSubject(x.name, calSubj));
  return `<div class="card subj-filter"><h2>📚 Subjects${isParentDevice() ? ` · ${safe(userById(kid).name)}` : ""}</h2>${kids}
    <div class="chips subj-chips">${chip("all", "All")}${subs.map(x => chip(x.name, `${safe(x.emoji)} ${safe(x.name)}`)).join("")}</div>
    ${f ? subjSummaryHtml(kid, f) : ""}</div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-calsubj], [data-sfkid]");
  if (!b) return;
  if (b.dataset.sfkid) { sfKid = b.dataset.sfkid; calSubj = "all"; }
  else calSubj = b.dataset.calsubj;
  render();
});
// The week in short, e.g. "📅 This week: 12 activities · 7 done ✓ · 5 left" / "⏱️ 8h 30m of activities · ⭐ 35 points"
// Only the person's own activities count (not lessons Dad only helps with), just like points.
function briefHtml(who, days) {
  const items = days ? days.flatMap(day => day.items.filter(it => it.users.includes(who)).map(it => ({ ...it, date: day.date }))) : [];
  const done = items.filter(it => isDone(it.date, it.actId, who)).length;
  const minutes = items.reduce((sum, it) => sum + it.end - it.start, 0);
  const points = pointsByUser()[who] || 0;
  const line1 = items.length
    ? `📅 This week: <b>${items.length}</b> ${items.length === 1 ? "activity" : "activities"} · <b>${done}</b> done ✓ · <b>${items.length - done}</b> left`
    : `📅 No activities planned this week.`;
  const line2 = `${minutes ? `⏱️ <b>${showDuration(minutes)}</b> of activities · ` : ""}<b>${points}</b> points (${kindsText(weekKinds(who))})${stars().includes(who) ? " · 🌟 Shining Star!" : ""}`;
  // (👨‍👩‍👧 a parent: just the activities, no points)
  if (isParentId(who)) return `<div>${items.length ? `📅 This week: <b>${items.length}</b> ${items.length === 1 ? "activity" : "activities"}` : "📅 No activities planned this week."}</div>${minutes ? `<div>⏱️ <b>${showDuration(minutes)}</b> of activities</div>` : ""}`;
  return `<div>${line1}</div><div>${line2}</div>${pastHtml(who)}`;
}
// Past weeks' points: last week's points (from the ticks we keep) and how often they were the Shining Star
function pastHtml(who) {
  const lastMon = fromYmd(data.points.week);
  lastMon.setDate(lastMon.getDate() - 7);
  const from = ymd(lastMon), to = data.points.week;
  const parts = [];
  if (data.points.since < to) {   // we were already keeping ticks last week
    const k = pointKinds(who, from, to, tickLog().filter(t => t.user === who && t.date >= from && t.date < to).length * POINTS_EACH);
    const wasStar = data.points.history.some(h => h.week === from && h.winners.some(w => w.id === who));
    parts.push(`Last week: <b>${k.tasks + k.habits + k.fun}</b> (${kindsText(k)})${wasStar ? " 🌟" : ""}`);
  }
  const times = data.points.history.filter(h => h.winners.some(w => w.id === who)).length;
  if (times) parts.push(`🌟 Shining Star ${times === 1 ? "once" : times + " times"}`);
  return parts.length ? `<div class="brief-past">${parts.join(" · ")}</div>` : "";
}

// (The old "Everyone's plan" and "View all plan" pages are now 📅 Calendar → Everyone. These are still read by older taps.)
let allFilter = "all";     // (older) "all" or one person
let allView = "cards";
let viewMode = "day";
let viewWho = "all";
// The activity's name for View all plan: "🏫 School", "🔢 Math", "Gym_kids" (no names list, no "with …")
function viewTitle(b) {
  const subject = !b.fixed && findSubject(b.name), te = actTypeInfo(b.type || "activity")[1] + (b.must ? "⭐" : "");   // (⭐ the type's emoji next to the name)
  return `${te} ${subject ? subject.name : b.name}`;
}
// 📅 Week summary: rows = people, columns = Mon–Sun. Each cell: that person's activities as one-line chips
// ("7:30 🏫 School"), with ✓ on done ones. At the end of the row: "Done 12/20 ⭐ 60" (their own activities and points).
function weekSummaryHtml(days, paper) {
  const today = todayYmd(), pts = pointsByUser();
  const head = `<tr><th class="vs-corner"></th>${days.map(day => `<th class="${day.date === today && !paper ? "today" : ""}">${dayHead(day.date)}</th>`).join("")}<th>This week</th></tr>`;
  const body = data.users.map(u => {
    const c = colorsOf(u);
    let own = 0, done = 0;
    const cells = days.map(day => {
      const items = day.items.filter(it => it.people.includes(u.id)).sort((a, b) => a.start - b.start);
      return `<td>${items.map(it => {
        const mine = it.users.includes(u.id);
        const ok = mine ? isDone(day.date, it.actId, u.id) : it.users.every(x => isDone(day.date, it.actId, x));
        if (mine) { own++; if (ok) done++; }
        return `<div class="vs-chip ${ok ? "done" : ""}" style="${blockColors(it)}" title="${safe(it.name)} · ${clock(it.start, true)}–${clock(it.end, true)}">${
          ok ? "✓ " : ""}${clock(it.start)} ${safe(viewTitle(it))}</div>`;
      }).join("")}</td>`;
    }).join("");
    return `<tr style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}"><th class="vs-who">${safe(u.emoji)} ${safe(u.name)}</th>${cells}
      <td class="vs-total">${isParentId(u.id) ? "" : `Done ${done}/${own} ⭐ ${pts[u.id] || 0}`}</td></tr>`;   // (👨‍👩‍👧 parents: no ticks or points)
  }).join("");
  return `<div class="vs-scroll"><table class="vs-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
// 🖨️ Print from View all plan: the Week summary on one landscape page
function summaryPage() {
  return `<section class="p-page" style="--soft:#ede9fe;--ink:#4c1d95">
    <div><div class="p-title">👨‍👩‍👧‍👦 Everyone's Week ⭐ ${weekRange()}</div>
      <div class="p-sub">Each color is one person. ✓ = done.</div></div>
    ${weekSummaryHtml(planDays(), true)}</section>`;
}




// =====================================================================
//  PRINT: paper schedules — one A4 page (sideways) per person
// =====================================================================
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayDate(d) { const dt = fromYmd(data.points.week); dt.setDate(dt.getDate() + d); return dt; }
// "5–11 Oct", or "28 Sep – 4 Oct" when the week goes into the next month
function weekRange() {
  const a = dayDate(0), b = dayDate(6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

// "Who should I print?" (Dad only)
function openPrintMenu() {
  if (!isParentId(me)) return;
  if (!planDays()) return toast("Press ✨ Plan my week first, then you can print it.", 3500);
  const btn = (id, emoji, name, c) => `<button class="who-btn" data-print="${safe(id)}" style="--soft:${c.soft};--ink:${c.ink}">
      <span class="face">${safe(emoji)}</span><span class="nm">${safe(name)}</span></button>`;
  $("printWho").innerHTML = data.users.map(u => btn(u.id, u.emoji, u.name, colorsOf(u))).join("")
    + btn("all", "👨‍👩‍👧‍👦", "Everyone", { soft: "#fef3c7", ink: "var(--text)" });
  $("printModal").hidden = false;
  $("printWho").querySelector("button").focus();
}
function closePrintMenu() { $("printModal").hidden = true; }

// On paper there's nothing to tap, so the ⇄ note is written out, short: "⇄ Gym"
function pSame(same) {
  return same ? `<div class="p-same">⇄ ${safe(same.replace("At the same time as: ", "").replace(/ \([^)]*\)/g, ""))}</div>` : "";
}
// One activity on paper: ☐, the time, the subject with its emoji (and whose it is, on someone else's page)
function paperItem(it, pageFor, same) {
  const subject = findSubject(it.name);
  const what = it.fixed ? `${isSchoolName(it.name) ? "🏫" : "📌"} ${it.name}` : subject ? `${subject.emoji} ${subject.name}` : it.name;
  const owners = it.users;
  const notes = [];
  if (pageFor === "all" || owners.some(id => id !== pageFor)) notes.push(owners.map(whoText).join(" "));
  if (helperOf(it) && pageFor !== it.helper) notes.push(`with ${helperOf(it).name}`);
  const c = colorsOf(userById(owners[0])).color;
  return `<div class="p-item ${pageFor === "all" ? "striped" : ""}" style="--c:${c}"><span class="p-box"></span>
    <div><div class="p-time">${clock(it.start)}–${clock(it.end)}</div><div class="p-what">${safe(what)}</div>
    ${notes.length ? `<div class="p-note">${safe(notes.join(" · "))}</div>` : ""}${pSame(same)}</div></div>`;
}
// The table: one column per day, and one row per start time (like the calendar on screen),
// so things that start at the same time line up across the week. item / strip = how to draw them (optional).
function paperTable(pageFor, item, strip) {
  item = item || ((it, same) => paperItem(it, pageFor, same));
  strip = strip || (r => `<div class="p-routine">${clock(r.start)} ${safe(r.emoji)} ${safe(r.name)}</div>`);
  const week = planDays();   // (📅 paper: this Monday … Sunday)
  const cols = week.map(day => {
    let items = pageFor === "all" ? day.items : day.items.filter(it => it.people.includes(pageFor));
    if (pageFor === "all") {  // the same fixed activity for several people (like School) is one line
      const merged = [];
      for (const it of items) {
        const same = it.fixed && merged.find(b => b.fixed && b.name === it.name && b.start === it.start && b.end === it.end);
        if (same) same.users = [...new Set([...same.users, ...it.users])]; else merged.push({ ...it });
      }
      items = merged;
    }
    // Routines: one small, light line each (no box to tick), in time order with the activities
    const lines = routineStrips(day.routines, pageFor === "all" ? null : pageFor).map(r => ({ start: r.start, end: r.end, strip: true, padId: r.pad ? r.id : null, html: strip(r) }));
    items.forEach(it => lines.push({ start: it.start, end: it.end, padIds: padIdsOf(it), html: item(it, sameTimeText(it, items)) }));
    if (!items.length) lines.push({ free: true, start: -1, html: "" });
    return lines.sort((a, b) => a.start - b.start);
  });
  // The same layout as on screen: rows by start time, each activity spans down to its end time,
  // and things at the same time sit side by side in their own lane.
  const { rows, days } = rowLayout(cols);
  const tpl = ["auto"], first = [];
  days.forEach((x, d) => { first[d] = tpl.length + 1; for (let i = 0; i < x.L; i++) tpl.push(`minmax(0,${(1 / x.L).toFixed(4)}fr)`); });
  let html = `<div class="p-table rows" style="--cols:${tpl.join(" ")}"><div class="p-corner"></div>`;
  rows.forEach((t, r) => html += `<div class="p-rowline" style="grid-row:${r + 2}"></div><div class="p-rtime" style="grid-row:${r + 2}">${t === null ? "" : rowTime(t)}</div>`);
  days.forEach((x, d) => {
    const span = `grid-column:${first[d]} / span ${x.L}`;
    html += `<div class="p-head" style="${span};grid-row:1">${dayHead(week[d].date)}${x.free ? "<small>Free day! 🎉</small>" : ""}</div>
      <div class="p-daybg" style="${span};grid-row:2 / span ${rows.length}"></div>`;
    x.items.forEach(it => html += `<div class="p-cell ${it.strip ? "strip" : ""}" style="grid-column:${first[d] + it.lane} / span ${it.w};grid-row:${it.r0 + 2} / span ${it.n}">${it.html}</div>`);
  });
  return html + `</div>`;
}// One person's page
function paperPage(id) {
  const u = userById(id), c = colorsOf(u);
  return `<section class="p-page" style="--soft:${c.soft};--ink:${c.ink}">
    <div><div class="p-title">${safe(u.emoji)} ${safe(u.name)}'s Week ⭐ ${weekRange()}</div>
      <div class="p-sub">Tick the box ☐ when you finish each activity!</div></div>
    ${paperTable(id)}
    ${habitsTableHtml(id)}
    <div class="p-foot">
      <div class="p-stars">My stars this week: ${SHORT.map(s => `<span class="s"><b>☆</b><small>${s}</small></span>`).join("")}</div>
      <div class="p-sign">Parent signature:<span class="line"></span></div>
    </div></section>`;
}
// The extra page with everyone together (each person has their color stripe)
function everyonePage() {
  return `<section class="p-page" style="--soft:#ede9fe;--ink:#4c1d95">
    <div><div class="p-title">👨‍👩‍👧‍👦 Everyone's Week ⭐ ${weekRange()}</div>
      <div class="p-sub">The whole family's plan. Each color is one person.</div></div>
    ${paperTable("all")}
    <div class="p-foot"><div class="p-legend">${data.users.map(u => `<span style="--c:${colorsOf(u).color}"><i></i>${safe(u.emoji)} ${safe(u.name)}</span>`).join("")}</div>
      <div class="p-sign">Parent signature:<span class="line"></span></div></div></section>`;
}

// Builds the pages, then makes the text on each page small enough to fit on ONE sheet.
function buildPrint(who) {
  buildPages(who === "all" ? [...data.users.map(u => paperPage(u.id)), everyonePage()] : [paperPage(who)]);
}
// Puts the pages in the print area. Pages with a time grid already fill exactly one sheet;
// the others get their text shrunk until they fit on one sheet.
function buildPages(pages) {
  const area = $("printArea");
  area.innerHTML = pages.join("");
  area.classList.add("measuring");                     // lay it out off-screen at paper size, so we can measure
  const room = 188 * 96 / 25.4;                        // a sheet's height (in screen pixels), with a little spare
  area.querySelectorAll(".p-page:not(.pg-page)").forEach(page => {
    let size = 15;                                     // start big (15pt) …
    page.style.setProperty("--fs", size + "pt");
    while (page.scrollHeight > room && size > 6) {     // … and shrink until it fits
      size -= 0.5;
      page.style.setProperty("--fs", size + "pt");
    }
  });
  area.classList.remove("measuring");
}
function printFor(who) {
  closePrintMenu();
  buildPrint(who);
  window.print();   // opens the normal print screen (you can also choose "Save as PDF" there)
}
// ---------- 🖨️ Print on "My activities": a list of the week, day by day, with a box to tick ----------
// "5 – 11 October 2026", or "28 September – 4 October 2026" across two months
function monthName(dt) { return dt.toLocaleDateString("en-GB", { month: "long" }); }
function weekRangeLong() {
  const a = dayDate(0), b = dayDate(6);
  if (a.getFullYear() !== b.getFullYear()) return `${a.getDate()} ${monthName(a)} ${a.getFullYear()} - ${b.getDate()} ${monthName(b)} ${b.getFullYear()}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} - ${b.getDate()} ${monthName(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${monthName(a)} - ${b.getDate()} ${monthName(b)} ${b.getFullYear()}`;
}
function listPage(who) {
  const u = userById(who), c = colorsOf(u);
  const groups = planDays().map(day => {
    const items = day.items.filter(it => it.people.includes(who));
    return `<div class="pl-day"><div class="p-head">${dayHead(day.date)}</div>
      ${items.length ? items.map(it => paperItem(it, who)).join("") : `<div class="p-free">Free day! 🎉</div>`}</div>`;
  });
  return `<section class="p-page" style="--soft:${c.soft};--ink:${c.ink}">
    <div><div class="p-title">${safe(u.emoji)} ${safe(u.name)}'s activities - Week of ${weekRangeLong()}</div>
      <div class="p-sub">Tick the box ☐ when you finish each activity!</div></div>
    <div class="pl-cols">${groups.join("")}</div>
    <div class="p-foot"><div class="p-sign">Parent signature:<span class="line"></span></div></div></section>`;
}
function printList() {
  if (hasDraft()) return toast("💾 Save your changes first, then print.", 3500);
  if (!planDays()) return toast("There's no plan yet, so there's nothing to print.", 3500);
  buildPages([listPage(me)]);
  window.print();
}

// ---------- 🖨️ Print on the calendar pages: the whole week, in rows by time of day, on one landscape page ----------
// who = one person's id, or "all" (everyone together, for "View all plan").
// Always the whole week (Monday to Sunday), even on a phone that shows one day.
function gridPage(who) {
  const all = who === "all", u = all ? null : userById(who);
  // The same rows by time as on screen; each activity keeps its colored block with ☐ boxes
  const table = paperTable(who, (it, same) => {
    const subject = findSubject(it.name);
    const what = it.fixed ? `${isSchoolName(it.name) ? "🏫" : "📌"} ${it.name}` : subject ? `${subject.emoji} ${subject.name}` : it.name;
    const who2 = all || it.users.some(id => id !== who) ? emojisOf(it.users) + " " : "";
    const withDad = helperOf(it) && who !== it.helper ? ` · with ${helperOf(it).name}` : "";
    const boxes = (all ? it.users : [who]).map(() => `<span class="p-box"></span>`).join("");
    return `<div class="pg-ev" style="${blockColors(it)}">
        <span class="pg-boxes">${boxes}</span><div><b>${clock(it.start)}–${clock(it.end)}</b> ${safe(who2 + what + withDad)}${pSame(same)}</div></div>`;
  }, r => `<div class="pg-rt">${safe(r.emoji)} ${safe(r.name)}</div>`);
  const c = all ? { soft: "#ede9fe", ink: "#4c1d95" } : colorsOf(u);
  return `<section class="p-page" style="--soft:${c.soft};--ink:${c.ink}">
    <div><div class="p-title">${all ? "👨‍👩‍👧‍👦 Everyone's Week" : `${safe(u.emoji)} ${safe(u.name)}'s Week`} ⭐ ${weekRange()}</div>
      <div class="p-sub">Tick the box ☐ when you finish each activity!${all ? " Each color is one person." : ""}</div></div>
    ${table}
    ${all ? `<div class="p-legend">${data.users.map(x => `<span style="--c:${colorsOf(x).color}"><i></i>${safe(x.emoji)} ${safe(x.name)}</span>`).join("")}</div>` : ""}
  </section>`;
}
// (🖨️ The Calendar print is ONLY the week calendar, one landscape page: this "Good habits" table isn't printed any more.)
// The "Good habits" table for a kid's printout: habits as rows, Mon–Sun as columns, empty boxes to tick.
// Split in two tables side by side so it stays small.
function habitsTableHtml(who) {
  const list = habitsFor(who);
  if (!list.length) return "";
  const boxes = h => `<span class="p-box"></span>`.repeat(h.kind === "prayers" ? PRAYERS.length : h.kind === "water" ? WATER_DROPS : 1);
  const table = rows => `<table class="hb-table"><thead><tr><th></th>${SHORT.map(s => `<th>${s}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(h => `<tr><td class="hb-tname">${safe(h.emoji)} ${safe(h.name)}${h.kind === "prayers" ? " <small>(5)</small>" : h.kind === "water" ? " <small>(6 glasses)</small>" : ""}</td>${
      SHORT.map(() => `<td>${boxes(h)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const half = Math.ceil(list.length / 2);
  return `<div class="hb-print"><div class="hb-print-title">⭐ Good habits</div>
    <div class="hb-tables">${table(list.slice(0, half))}${table(list.slice(half))}</div></div>`;
}

// The calendar that's showing: one person's, or everyone's (📅 Calendar → Everyone)
function printCalendar() {
  if (!planDays()) return toast("There's no plan yet, so there's nothing to print.", 3500);
  // Everyone: the Week summary table on one landscape page
  buildPages([calWho === "all" ? summaryPage() : gridPage(calWho || me)]);
  window.print();
}

// ---------- 🖨️ Print family week (home page): everyone, clean and professional ----------
// White page, plain text (no emojis), thin grey lines, soft colors per person, small tick boxes, legend at the bottom.
function familyPage() {
  const table = paperTable("all", (it, same) => {
    const subject = findSubject(it.name);
    const name = subject && !it.fixed ? subject.name : it.name;
    const people = namesOf(it.users) + (helperOf(it) ? ` with ${helperOf(it).name}` : "");
    return `<div class="pg-ev" style="${blockColors(it)}">
        <span class="pg-boxes">${it.users.map(() => `<span class="p-box"></span>`).join("")}</span>
        <div><b>${safe(name)}</b> <span class="pf-meta">${clock(it.start)}–${clock(it.end)} · ${safe(people)}</span>${pSame(same)}</div></div>`;
  }, r => `<div class="pg-rt">${safe(r.name)}</div>`);
  return `<section class="p-page pro">
    <div class="pf-top"><div class="p-title">${APP_NAME}</div><div class="p-sub">Week of ${weekRangeLong()}</div></div>
    ${table}
    <div class="p-legend">${data.users.map(u => `<span style="--c:${colorsOf(u).color}"><i></i>${safe(u.name)}</span>`).join("")}
      <span style="--c:${GREY.color}"><i></i>Fixed or shared (school, work …)</span></div>
  </section>`;
}function printFamilyWeek() {
  if (!planDays()) return toast("There's no plan yet, so there's nothing to print.", 3500);
  buildPages([familyPage()]);
  window.print();
}

// If someone prints from the browser's own menu instead, print their own week.
window.addEventListener("beforeprint", () => {
  if (!$("printArea").innerHTML.trim() && exists(me) && planDays()) buildPrint(me);
});
