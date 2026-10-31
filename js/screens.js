// =====================================================================
//  WHO IS USING THE APP + MOVING BETWEEN SCREENS
// =====================================================================
let me = null;        // the person using the app right now (an id)
let screen = "start";

const exists = id => data.users.some(u => u.id === id);
// Kids can only change activities that are just theirs (not shared ones like School). Dad can change everything.
const canEdit = act => isParentId(me) || (act.users.length === 1 && act.users[0] === me);

// fromHistory = true when we got here with the phone's/browser's Back button
function go(name, fromHistory) {
  // 🧒 A kid's device is always that kid: no "Who are you?", no Settings (see KID DEVICE)
  if (isKidDevice()) {
    if (exists(kidDeviceId())) me = kidDeviceId();
    if (exists(me) && ["start", "settings", "family"].includes(name)) name = "home";
  }
  // 📅 The old calendar pages ("Everyone's plan", "View all plan") are now 📅 Calendar → Everyone
  if (name === "all" || name === "view") { name = "mine"; calWho = "all"; if (screen === "mine") screen = ""; }
  if (name === "family" && !isParentId(me)) name = "home";   // 👨‍👩‍👧 Family: parents only
  if (name === "kidswork" && !isParentDevice()) name = "home";   // 👀 Your kids' work today: parents only
  if (name === "kid" && (!isParentDevice() || !exists(kidPage))) name = "home";   // 👧 the Kid page: parents only
  // ✏️ Add activities opens CLOSED and simple every time (no list or form open)
  if (name === "add" && screen !== "add") { addOpen = { fx: false, fl: false, rt: false }; resetFixedForm(); resetFlexForm(); closeRoutineForm(); }
  // 👤 This device is always the person signed in on it (no "Switch user" / "Who are you?"): see deviceMe
  if (!exists(me)) { const dm = deviceMe(); if (dm) me = dm; }
  if (name === "start" && exists(me)) name = "home";
  if (name !== "start" && !exists(me)) name = "start";   // (only while signing in / the family's data is on its way)
  // (Settings: everyone can open it, but the kids only see their own 🕌 Prayer times.)
  if (name === "school" && !isParentId(me)) schoolKid = me;   // 🎒 a kid only sees their own School page
  if (name === "school" && name !== screen) { schoolEdit = schoolEditId = null; schoolFresh = true; }
  // Remember each screen in the browser history, so Back goes to the previous screen (not out of the app)
  if (!fromHistory && name !== screen) { try { history.pushState({ screen: name }, ""); } catch (e) {} }
  // 📅 Calendar opens on the last day / view / chip chosen on this device (first time: today; kids "Me", parents "Everyone").
  // Tapping "📅 Calendar" while already on it goes back to that first chip.
  if (name === "mine" && screen !== "mine") restoreMine();
  else if (name === "mine") calWho = null;
  if ((name === "home" || name === "mine") && screen !== name) habitDay = weekIndex();     // habits: start on today
  if (name !== screen) { editMode = false; editUndo = []; }   // leaving the page ends "Edit calendar"
  screen = name;
  trackScreen(name);   // 📊 screen_view (the page's fixed name only)
  if (name === "mine" || name === "start") hideSaved();   // already there (or nobody's using the app)
  document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== "scr-" + name);
  closeCard();
  render();
  window.scrollTo(0, 0);
}
// (🔄 "Switch user" was removed: nobody can change who they are on a device)
// 👤 Who this device is: ALWAYS the person signed in on it, never the family's first parent (Bro2a) by mistake.
//   · a kid's code → that kid
//   · a parent's OWN account (joined with a parent code: not the family's main login) → their own parent person, linked on their
//     account (members/{uid}.person, the same on all their devices). Not there yet → it's made for them (see linkOwnParent). Never DAD.
//   · the family's MAIN login (it may be shared by several parents) → the parent picked on THIS device (cloud meta "devicePerson");
//     with only 1 parent: that one; with 2+ and no pick yet: "Which parent are you?" (once, see askWhichParent)
//   · no family account (the app opened as a file) → the first parent
// null = not known yet (still signing in, the family's people aren't here yet, or waiting for the pick).
const isMainLogin = meta => !!meta && !!meta.familyId && (meta.uid === meta.familyId || meta.uid === OLD_FAMILY_UID);
const parentsList = () => data.users.filter(u => isParentId(u.id));
function deviceMe() {
  if (isKidDevice()) return exists(kidDeviceId()) ? kidDeviceId() : null;
  const meta = cloudMeta().member;
  if (!meta) return cloud.enabled ? null : DAD;   // (file://: no sign-in, the first parent)
  if (isMainLogin(meta)) {
    const pick = cloudMeta().devicePerson;
    if (pick && exists(pick) && isParentId(pick)) return pick;
    if (parentsList().length <= 1) return DAD;   // (only one parent: no question)
    if (!cloud.ready) return null;                // (wait for the family's people)
    askWhichParent();
    return null;
  }
  // A parent's own account: their own person (a link to DAD from before this fix doesn't count: that was the mistake)
  if (meta.person && meta.person !== DAD && exists(meta.person) && isParentId(meta.person)) return meta.person;
  if (!cloud.ready) return null;   // (wait for the family's people)
  return linkOwnParent(meta);
}
// 🆕 A parent who joined with a parent code: find their own parent person (by the name they typed at sign up), or ADD one
// (a free emoji and colour, like the other parents), save it in the family's plan for everyone, and link it to their account.
let linkingParent = false;
function linkOwnParent(meta) {
  if (linkingParent || cloud.role !== "parent") return null;
  const name = (meta.name || "").trim();
  let u = name && data.users.find(x => x.id !== DAD && isParentId(x.id) && x.name.trim().toLowerCase() === name.toLowerCase());
  if (!u) {
    linkingParent = true;
    const used = new Set(data.users.map(x => x.emoji));
    const emoji = ["👩", "👨", "🧕", "👩‍🦱", "🧔", "👱‍♀️", "🙂"].find(e => !used.has(e)) || "🙂";
    u = { id: newId(), name: (name || "Parent").slice(0, 30), emoji, color: freeColor(), role: "parent" };
    data.users.push(u);
    writeData();   // (saved normally: everyone's devices see the new parent)
    linkingParent = false;
  }
  setCloudMeta({ member: { ...meta, person: u.id } });
  if (cloud.user && cloud.fb) cloud.fb.updateDoc(cloud.fb.doc(cloud.db, "members", cloud.user.uid), { person: u.id }).catch(() => {});
  return u.id;
}
// 👨‍👩‍👧 "Which parent are you?" (the family's main login on a new device, 2+ parents): big buttons, saved on THIS device only
function askWhichParent(again) {
  const box = $("whoParentModal");
  if (!box || (!box.hidden && !again)) return;
  $("whoParentList").innerHTML = parentsList().map(u => { const c = colorsOf(u);
    return `<button class="wp-btn" data-wpick="${safe(u.id)}" style="--soft:${c.soft};--ink:${c.ink}"><span class="e">${faceHtml(u)}</span><b>${safe(u.name)}</b></button>`; }).join("");
  box.hidden = false;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#whoParentModal [data-wpick]");
  if (!b) return;
  const id = b.dataset.wpick;
  if (!exists(id) || !isParentId(id) || !isMainLogin(cloudMeta().member)) return;
  setCloudMeta({ devicePerson: id });   // (this device only: not on the shared account)
  $("whoParentModal").hidden = true;
  me = id;
  go("home");
  toast(`👋 Hi ${userById(id).name}!`, 2500, colorsOf(userById(id)).color);
});
// (older links to "View all plan": 📅 Calendar → Everyone)
function openViewAll() { calWho = "all"; go("mine"); }

// Draws the screen that's showing
function render() {
  // A new week started: points go back to zero. (If there's a draft, it's stored when you tap Save;
  // if you cancel the draft, this runs again on the stored data.)
  const draft = hasDraft();
  if (newWeek() && !draft) writeData("auto");
  // 📅 A new day: the date that comes into the plan's window (today + 6) is planned (a parent's device only, see rollPlan)
  if (rollPlan()) writeData("auto");
  if (!draft && exists(me) && updateReach()) writeData("auto");   // ⚖️ when each fair score was reached (a tie: who got there first)
  maybeDecideStar();   // ⭐ the announce day + time (⚙️ Settings): the Shining Star is decided (🎁 next evening: a reminder when no gift is chosen)
  if (!draft && exists(me) && seedHall()) writeData("auto");   // 🏆 the first 3 stars, saved once
  if (!draft) maybeShowStar();   // 📣 the announcement pop-up (once on each device)
  if (screen === "start") drawStart();
  if (screen === "points") drawPoints();
  if (screen === "home") drawHome();
  if (screen === "add") drawAdd();
  if (screen === "mine") drawMine();
  if (screen === "settings") drawSettings();
  if (screen === "school") drawSchool();
  if (screen === "family") drawFamily();
  if (screen === "diary") drawDiary();
  if (screen === "extra") drawExtra();
  if (screen === "setup") drawSetup();
  if (screen === "me") drawMe();
  if (screen === "report") drawReport();
  if (screen === "kidswork") drawKidsWork();   // 👀 (parents)
  if (screen === "kid") drawKidPage();          // 👧 one kid's page (parents)
  // ⚙️ A feature that's off: body.off-<feature> hides its buttons (see the CSS "FEATURES OFF")
  FEATURES.forEach(([k]) => document.body.classList.toggle("off-" + k, !feat(k)));
  document.body.classList.toggle("parent-phone", isParentPhone());   // 👨‍👩‍👧 School: look only (see the CSS)
  checkLevels();   // 🌱 a new level? (history, 🔔, 🎉)
  updateBuddyBadges();   // 🌱 the buddy badge in the top bar
  updateEncLines();      // ✨ the encouraging line under it
  if (!$("buddyModal").hidden && !buChange) drawBuddyBox();
  if (rdPop) drawRiddlePop(); else maybeRiddlePop();   // 🧩 "Riddle time!" (once per app open)
  if (screen === "mine") saveCalPrefs();   // remember the day / view / chip on this device
  updateSaveBars();
  drawNews();
  maybeAskPrayer();   // 🕌 the first time after this update: "Show prayer times on your calendar?"
}
// A change on "Add activities" or "Settings": it's only a draft until you tap 💾 Save.
function changed() { render(); }
// A change that is kept right away (ticks, "Plan my week", backups): store it, then redraw.
function keepNow() { writeData(); render(); }

// =====================================================================
//  💾 SAVE: the one function that keeps a user's changes for good
// =====================================================================
// 1) plans the week again if the activities changed, 2) stores everything (writeData), 3) redraws, 4) says so.
// (If only the calendar was edited by hand, nothing is re-planned, so the moves stay exactly where they are.)
// Everyone's calendar and "View all plan" read the same data, so they're all updated.
// (writeData() also sends it to the family cloud, so the other phones get it within seconds.)
// ⏱️ A parent's changed activities must fit: when a kid needs more time than they have this week, NOTHING is saved (see timeBudget).
// → true when saved
function saveChanges() {
  const short = isParentId(me) && planIsOld() ? timeBudget().filter(x => x.need > x.free) : [];
  if (short.length) { showTimeShort(short); return false; }
  if (!data.plan || data.plan === "redo" || planIsOld()) makeAndKeepPlan();
  cloud.stash = null;   // your saved changes win over a change another phone made meanwhile
  writeData();
  render();
  showSaved();
  return true;
}
// ⏱️ ENOUGH TIME? For each kid, over the plan's 7 days (today … today + 6, whole days):
//   need = what their flexible activities take (each session with its get ready / break × times a week, e.g. 5 Math × 45 min);
//   free = each day's start … end, minus their fixed activities (and get ready / break), routines and 📌 one-day events.
// (Fixed activities are already at their own times, so they're taken out of the free time instead of added to the need.)
const hmText = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h && r ? `${h} h ${r} min` : h ? `${h} h` : `${r} min`; };
function timeBudget() {
  const dates = aheadDates();
  return kidsList().map(k => {
    const acts = data.flexible.filter(f => peopleOf(f).includes(k.id)).map(f => {
      const each = f.duration + (f.getReady || 0) + (f.breakAfter || 0), times = Math.min(f.times, dates.length);
      return { name: f.name, each, times, min: each * times };
    }).sort((a, b) => b.min - a.min);
    const free = dates.reduce((n, ds) => {
      const busy = oneDayOn(ds).filter(e => e.who.includes(k.id)).map(e => [toMin(e.from), toMin(e.to)]);
      return n + totalLength(freeFor(weekdayOf(ds), k.id).flatMap(p => cutOut(p, busy)));
    }, 0);
    return { kid: k, need: acts.reduce((n, a) => n + a.min, 0), free, acts };
  });
}
// The box: "Not enough time for Mody this week: needs 14 h 30 min, free 11 h. …" and the biggest activities with their weekly minutes
function showTimeShort(short) {
  $("kCard").style.cssText = "--soft:#fee2e2;--ink:#991b1b";
  $("kCard").innerHTML = `<div class="k-card-top"><div class="big">⏱️</div><div class="nm">Not saved: not enough time</div></div>
    ${short.map(x => `<div class="time-short"><p><b>Not enough time for ${safe(x.kid.name)} this week: needs ${hmText(x.need)}, free ${hmText(x.free)}.</b>
      Make some sessions fewer or shorter.</p>
      <ul>${x.acts.slice(0, 4).map(a => `<li>${safe(a.name)}: ${a.times} × ${hmText(a.each)} = <b>${hmText(a.min)}</b> a week</li>`).join("")}</ul></div>`).join("")}
    <button class="k-ok" id="kOk">OK 👍</button>`;
  $("kModal").hidden = false;
  $("kOk").focus();
}
// The small live line on ✏️ Add activities (parents): "Mody: 9 h 15 min of 11 h free · Bana: …" (red when it doesn't fit)
const timeLineHtml = () => timeBudget().map(x => `<span class="${x.need > x.free ? "over" : ""}">${safe(x.kid.name)}: ${hmText(x.need)} of ${hmText(x.free)} free</span>`).join(" · ");
// The "Saved! ✓" box with "📅 See the calendar" under it (goes away by itself after a few seconds)
let savedTimer = null;
function showSaved() {
  $("toast").hidden = true;
  liftAboveSaveBar();
  $("savedPop").hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(hideSaved, 7000);
}
function hideSaved() { $("savedPop").hidden = true; clearTimeout(savedTimer); }
// "Cancel changes": throw the draft away and go back to what was saved
function cancelChanges(quiet) {
  if (savedJson === null) return;
  data = JSON.parse(savedJson);
  resetFixedForm(); resetFlexForm(); resetUserForm(); closeRoutineForm(); resetHabitForm();
  if (cloud.stash) { const s = cloud.stash; cloud.stash = null; cloudApply("plan", s); }  // now show the other phone's change
  render();
  if (!quiet) toast("↩ Changes thrown away.");
}
// The Save bar at the bottom of "Add activities" and "Settings": bright and pulsing when there are unsaved changes
function updateSaveBars() {
  const draft = hasDraft();
  document.querySelectorAll(".savebar").forEach(bar => {
    bar.classList.toggle("dirty", draft);
    bar.querySelector(".save-note").hidden = !draft;
    bar.querySelectorAll("button").forEach(b => b.disabled = !draft);
  });
}
// Leaving a page with unsaved changes? Ask first (a friendly box, not a browser popup).
let afterLeave = null;   // what to do once the user decides (e.g. go to Home)
function leaveDraft(then) {
  if (!hasDraft()) return then();
  afterLeave = then;
  $("leaveModal").hidden = false;
  $("leaveSave").focus();
}
function answerLeave(choice) {
  $("leaveModal").hidden = true;
  const then = afterLeave;
  afterLeave = null;
  if (choice === "stay" || !then) return;
  if (choice === "save") { if (!saveChanges()) return; }   // (⏱️ not enough time: not saved, so stay here)
  else cancelChanges(true);
  then();
}
// The phone's/browser's Back button: go to the previous screen (and ask first if there are unsaved changes)
window.addEventListener("popstate", e => {
  const target = (e.state && e.state.screen) || "start";
  const back = () => {
    // (👤 going back to the very first page never changes who you are: go() turns "start" into 🏠 Home)
    // 🎒 Inside School: back to the School page that was open before (a subject, a worksheet … or School's home)
    if (target === "school") {
      schoolView = e.state.sub || "home"; schoolSubject = e.state.subj || null; schoolTab = e.state.tab || "overview";
      if (e.state.doc) schoolDoc = e.state.doc;
      schoolEdit = schoolEditId = null; schoolFresh = true; schoolReport = false;
    }
    go(target, true);
  };
  if (!hasDraft()) return back();
  try { history.pushState({ screen }, ""); } catch (err) {}   // stay on this page until they answer
  leaveDraft(() => go(target));
});
