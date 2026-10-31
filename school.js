// =====================================================================
//  🎒 SCHOOL ("Binder"): one binder per kid
//   School home (like a private tutor): one big ⬆️ Upload today's work, then a tile per subject with its success %
//     (the older pages — Homework, Marks, Reviews, School info, Reports, Seesaw — are small links under the tiles)
//   📥 → files saved in the subject → 🤖 reads them → 🤖 makes a short LEVEL CHECK → print, ⬆ upload answers, 🤖 Check
//   A subject: the level and % on top, then 5 big buttons: 💪 good at · 🎯 work on · 📝 to do · ✅ finished · 📁 files
//     (parents also see 🦉 the coach's tip and the % by part)
//  Bro2a sees and changes everything for every kid. A kid sees only their OWN binder: they can add homework,
//  upload files and answers, add notes and tick done. Only Bro2a adds marks and reviews, checks answers,
//  and changes School info and the subject folders.
//  Changes are kept right away (no 💾 Save), like ticks. (The data: see cleanSchool. The files: see SCHOOL FILES.)
// =====================================================================
let schoolKid = null;      // whose binder is showing
let schoolView = "home";   // "home" | "subject" | "worksheet" | "explain" | older pages: "homework" | "marks" | "reviews" | "info" | "reports" | "seesaw"
let schoolSubject = null;  // the open subject folder (its id)
let schoolTab = "";        // the open subject's big button: "" (none) | "strong" | "weak" | "todo" | "done" | "files"
let schoolOlder = false;   // 🗂️ the subject's older records are open (at the bottom of the subject)
let schoolLevel = null;    // 🤖 the level check being made: { kid, folder, work, title, subject, state: "making" | "failed" }
let schoolEdit = null;     // the open form: "task" | "grade" | "note" | "link" | "subject" | "info" | "review" | "check"
let schoolEditId = null;   // the item being changed (null = adding a new one)
let schoolFresh = false;   // true = a form was just opened or closed: don't put back what was typed before
let schoolReport = false;  // 📄 the report was made (it's showing)
let schoolUpload = null;   // what the next chosen file is for: { subject, task }
let schoolDoc = null;      // 🤖 the open worksheet / explanation (view "worksheet" | "explain")
let wsAnswers = false;     // 🔑 the open worksheet shows its answers
let wsFix = false;         // ✏️ Bro2a's "Change score" form is open

const kidsList = () => data.users.filter(u => !isParentId(u.id));   // (every parent is left out, not only DAD)
const schoolOf = kid => data.school[kid] || emptySchool();
// The kid's school data (made the first time something is added)
function schoolFor(kid) { if (!data.school[kid]) data.school[kid] = emptySchool(); return data.school[kid]; }
const isYmd = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
// "2026-10-20" → "Tue 20 Oct"
function shortDate(s) { const dt = fromYmd(s); return `${SHORT[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; }
// Days from today to that date (0 = today, 1 = tomorrow, -1 = yesterday)
function daysUntil(s) { return Math.round((fromYmd(s) - fromYmd(todayYmd())) / 86400000); }
const pctOf = g => Math.round(g.score / g.max * 100);
const num = n => String(Math.round(n * 100) / 100);   // 7.5 → "7.5", 8 → "8"
const sameSubject = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const avgOf = list => list.length ? Math.round(list.reduce((sum, g) => sum + pctOf(g), 0) / list.length) : null;
// ▲ better than the mark before, ▼ lower, ▬ the same (nothing for the first mark)
function arrowHtml(now, before) {
  if (before == null) return "";
  return now > before ? `<span class="sc-up" title="Better than the last mark">▲ Better</span>`
    : now < before ? `<span class="sc-down" title="Lower than the last mark">▼ Lower</span>` : `<span class="sc-same" title="Same as the last mark">▬ Same</span>`;
}
function starsHtml(n) { return `<span class="sc-stars" aria-label="${n} of 5 stars">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`; }
const GRADE_LABEL = { quiz: "✏️ Quiz", exam: "📝 Exam", homework: "📚 Homework", worksheet: "🤖 Worksheet" };
const isDadNow = () => isParentId(me);
// Can the person using the app change / delete this? (Bro2a always; a kid only what they added themselves)
const canChange = x => isParentId(me) || (!!x && x.by === me);
// A label + input in its own row
const scField = (id, label, input) => `<div class="row"><div><label class="small" for="${id}">${label}</label>${input}</div></div>`;
const scButtons = (what, editing) => `<div class="btnrow"><button class="primary" data-scsave="${what}">${editing ? "💾 Save" : "➕ Add"}</button>
  <button data-sccancel>Cancel</button></div><div class="err" id="scErr"></div>`;
const itemBtns = (what, id, edit = true) => `${edit ? `<button class="edit" data-scedit="${what}|${safe(id)}" aria-label="Change">✏️ Edit</button>` : ""}
  <button class="x" data-scdel="${what}|${safe(id)}" aria-label="Delete">🗑️ Delete</button>`;

// ---------- The subject folders ----------
// (withHidden: also the folders a parent hid in ✏️ Edit subjects)
function subjectList(s, withHidden = false) {
  return Object.entries(s.subjects).map(([id, x]) => ({ id, ...x })).filter(x => withHidden || !x.hidden)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
const subjectColors = x => PALETTE[x && x.color] || PALETTE.blue;
// The folder of a subject name (null when there's no folder with that name; a hidden one counts, so no second folder is made)
const folderOf = (s, name) => subjectList(s, true).find(x => sameSubject(x.name, name)) || null;
const subjectEmoji = (s, name) => { const f = folderOf(s, name); return f ? f.emoji : "📘"; };
// Every subject name this kid has (folders first, then the ones only used in homework / marks / timetable)
function subjectsOf(s) {
  const all = [...subjectList(s).map(x => x.name), ...Object.values(s.info.timetable).flat(),
               ...Object.values(s.grades).map(g => g.subject), ...Object.values(s.tasks).map(t => t.subject)];
  const seen = new Set();
  return all.filter(x => { const k = x.toLowerCase(); return x && !seen.has(k) && seen.add(k); });
}
const subjectPicker = (id, s, value) => `<input type="text" id="${id}" list="scSubjects" maxlength="30" value="${safe(value || "")}" placeholder="Math">`;
// Homework that still has to be done; a subject's files / marks / notes
const todoOf = (s, subject) => Object.values(s.tasks).filter(t => !t.done && (!subject || sameSubject(t.subject, subject)));
const marksOf = (s, subject) => Object.entries(s.grades).map(([id, g]) => ({ id, ...g }))
  .filter(g => !subject || sameSubject(g.subject, subject)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const filesOf = (s, subject) => Object.entries(s.files).map(([id, f]) => ({ id, ...f }))
  .filter(f => !subject || sameSubject(f.subject, subject)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

// ---------- ⭐ Homework points (+10 for each homework ticked done, in the week it was ticked) ----------
// (+10 too for each 🤖 worksheet that was checked: its "Worksheet" mark, in the week it was first checked)
function homeworkPoints(user, from, to) {
  const s = data.school[user];
  if (!s) return 0;
  const homework = Object.values(s.tasks).filter(t => t.done && t.doneAt && t.doneAt >= from && t.doneAt < to).length;
  const worksheets = Object.values(s.grades).filter(g => g.type === "worksheet" && g.worksheet && g.date >= from && g.date < to).length;
  return (homework + worksheets) * POINTS_EACH;
}

// Open a kid's binder (a kid always gets their own)
function openSchool(kid) {
  if (kidLockedOut(kid)) return lockedToast(kid);
  schoolKid = isParentId(me) ? kid : me;
  schoolView = "home"; schoolSubject = null; schoolReport = false;
  schoolEdit = schoolEditId = null; scSubEdit = false;
  schoolFresh = true;
  go("school");
}
function goSchool(view, subject, tab) {
  const was = schoolView + "|" + schoolSubject;
  schoolView = view || "home";
  schoolSubject = subject || null;
  schoolTab = tab || "overview"; schoolOlder = false;
  // ⬅️ Each School page is a step in the history, so Back (and the phone's back gesture) goes back one page
  if (screen === "school" && was !== schoolView + "|" + schoolSubject) {
    try { history.pushState({ screen: "school", sub: schoolView, subj: schoolSubject, tab: schoolTab }, ""); } catch (e) {}
  }
  schoolEdit = schoolEditId = null; schoolFresh = true; schoolReport = false;
  // 📋 A parent reading a kid's brief (no points any more: giveAuto does nothing)
  const brief = schoolView === "brief" && schoolKid && schoolOf(schoolKid).brief;
  if (brief) giveAuto("brief", schoolKid + "-" + (brief.at || brief.date));
  render();
  window.scrollTo(0, 0);
}

function drawSchool() {
  const kids = kidsList(), isDad = isDadNow();
  if (!isDad) schoolKid = me;
  else if (!kids.some(k => k.id === schoolKid)) schoolKid = kids.length ? kids[0].id : null;
  $("schoolKids").hidden = !isDad;
  $("schoolKids").innerHTML = isDad ? kids.map(x => {
    const c = colorsOf(x);
    return `<button class="chip ${x.id === schoolKid ? "on" : ""}" data-sckid="${safe(x.id)}" style="--soft:${c.soft};--ink:${c.ink}"
      ${x.id === schoolKid ? `aria-current="true"` : ""}><span class="e">${safe(x.emoji)}</span>${safe(x.name)}</button>`;
  }).join("") : "";
  if (!schoolKid) {
    $("schoolTitle").textContent = "🎒 School";
    $("schoolSub").textContent = "";
    $("schoolBody").innerHTML = `<div class="card"><p class="sc-empty">There are no kids yet. Add one in ☰ More → 👨‍👩‍👧 Family.</p></div>`;
    return;
  }
  const u = userById(schoolKid), s = schoolOf(schoolKid);
  if ((schoolView === "subject" && !s.subjects[schoolSubject]) || schoolView === "subjects" || schoolView === "seesaw") schoolView = "home";
  $("schoolTitle").textContent = isDad ? `🎒 ${u.emoji} ${u.name}'s school` : "🎒 My school";
  $("schoolSub").textContent = "";
  // Drawn again while a form is open (e.g. a change from another phone): keep what was typed
  const typed = {}, focus = document.activeElement && document.activeElement.id;
  if (!schoolFresh) $("schoolBody").querySelectorAll(".sc-form [id]").forEach(el => { if ("value" in el && el.type !== "radio") typed[el.id] = el.value; });
  schoolFresh = false;
  const views = { home: schoolHomeHtml, subject: schoolSubjectHtml, homework: schoolHomeworkHtml,
                  marks: schoolMarksHtml, reviews: schoolReviewsHtml, info: schoolInfoHtml, reports: schoolReportsHtml,
                  worksheet: schoolWorksheetHtml, explain: schoolExplainHtml, profile: schoolProfileHtml, brief: schoolBriefHtml, make: schoolMakeHtml,
                  allws: schoolAllWsHtml };
  if (schoolView === "brief" && (!isDad || isKidDevice())) schoolView = "home";   // 📋 parents only
  aiMounts = [];
  // (The 👤 profile isn't forced any more: only a missing 🏫 📚 🎓 basic is asked, one at a time, see askBasicHtml)
  const view = schoolView;
  $("schoolBody").innerHTML = `<datalist id="scSubjects">${subjectsOf(s).map(x => `<option value="${safe(x)}">`).join("")}</datalist>`
    + (view === schoolView ? crumbHtml(s) : "") + (views[view] || schoolHomeHtml)(s, isDad, u);
  fillAiMounts($("schoolBody"));   // 🤖 the parts with text from the AI (built as plain text)
  Object.entries(typed).forEach(([id, v]) => { const el = $(id); if (el) el.value = v; });
  $("schoolBody").querySelectorAll(".sc-starpick").forEach(showStars);
  if (focus && $(focus) && $("schoolBody").contains($(focus))) $(focus).focus();
  fillPhotos($("schoolBody"));
  fillAnswerThumbs($("schoolBody"));   // 📸 the answer photos' thumbnails (before the check)
  showAiWait();
}

// "🎒 School › ➗ Math › 📝 Worksheet" (tap a part to go back there)
const VIEW_NAMES = { allws: "📝 All worksheets", make: "✏️ Make a worksheet", homework: "📝 Homework", marks: "📊 Marks", reviews: "⭐ Reviews", info: "🏫 School info", reports: "📄 Reports" };
function crumbHtml(s) {
  if (schoolView === "home") return "";
  const parts = [["🎒 School", "home"]], f = schoolSubject && s.subjects[schoolSubject];
  if (schoolView === "subject") parts.push([`${f.emoji} ${f.name}`, null]);
  else if (schoolView === "worksheet" || schoolView === "explain") {
    // 🤖 a worksheet / explanation: back to its subject's 📝 Worksheets (or to the School home when the folder is gone)
    if (f) parts.push([`${f.emoji} ${f.name}`, "subject|" + schoolSubject + "|worksheets"]);
    parts.push([schoolView === "worksheet" ? "📝 Worksheet" : "📖 Explanation", null]);
  } else if (schoolView === "brief") parts.push(["👤 Profile", "profile"], ["📋 Brief for parents", null]);
  else {
    if (f && VIEW_NAMES[schoolView]) parts.push([`${f.emoji} ${f.name}`, "subject|" + schoolSubject]);   // (a subject's 📊 📝 ⭐ 📄 📥: back to it)
    parts.push([schoolView === "profile" ? "👤 Profile" : VIEW_NAMES[schoolView], null]);
  }
  return `<nav class="bd-crumb" aria-label="Where you are">${parts.map(([label, view], i) => i < parts.length - 1
    ? `<button data-scgo="${view}">${safe(label)}</button><span class="sep">›</span>` : `<b>${safe(label)}</b>`).join("")}</nav>`;
}

// ---------- 📊 How the kid is doing: from the 🤖 checked worksheets ----------
const wsPct = w => Math.round(w.check.score / w.check.max_score * 100);
// green ≥ 80, amber 60–79, red < 60 (the class "lv-good" | "lv-mid" | "lv-low")
const pctLevel = p => p >= 80 ? "good" : p >= 60 ? "mid" : "low";
const LEVEL_COLOR = { good: "#22a35a", mid: "#e8a020", low: "#dc4a4a" };
// A subject's checked worksheets, newest check first
const checkedOf = (kid, subject) => wsOf(kid, subject).filter(w => w.check)
  .sort((a, b) => String(b.check.at).localeCompare(String(a.check.at)) || byNewest(a, b));
const avgPct = list => list.length ? Math.round(list.reduce((n, w) => n + wsPct(w), 0) / list.length) : null;
// The part (topic) of a worksheet: saved with it, or (older ones) its 📥 school work card's title, or its first topic
const partOf = (w, s) => w.part || (w.work && s.work[w.work] ? s.work[w.work].title : "") || w.topics[0] || w.title;
const pctBarNode = p => h("div", { class: "bd-bar", role: "img", "aria-label": p + "%" },
  h("i", { style: `width:${Math.min(100, p)}%;background:${LEVEL_COLOR[pctLevel(p)]}` }));

// ---------- 🏠 School home: ⬆️ Upload today's work + 📰 Newsletter, 🔔 reminders, a tile per subject, 📌 past school dates ----------
// 📰 This week (from the newsletter) is shown until its last day
const weekNow = s => s.week && s.week.end >= todayYmd() ? s.week : null;
// 👨‍👩‍👧 A parent's phone: ⚙️ For parents (📰 Newsletter, 👤 Profile, 🏫 School info, 📄 Reports, 📥 From Seesaw, 📊 Marks …) · ✏️ Edit subjects
let scParents = false, scSubEdit = false;
// Has the subject anything in it? (then 🗑️ hides it instead, and everything is kept)
function subjectHasWork(s, f) {
  const same = x => sameSubject(x.subject || "", f.name);
  return filesOf(s, f.name).length > 0 || Object.values(s.work).some(same) || wsOf(schoolKid, f.name).length > 0 || exOf(schoolKid, f.name).length > 0
    || Object.values(s.tasks).some(same) || Object.values(s.grades).some(same) || Object.values(s.notes).some(same);
}
function subjectsEditHtml(s) {
  const list = subjectList(s, true), adding = schoolEdit === "subject" && !schoolEditId;
  return `<div class="card bd-card sc-subedit"><div class="sc-head"><h2>✏️ Edit subjects</h2><button class="linkbtn" data-scsubedit>Done</button></div>
    <ul class="list">${list.map((x, i) => `<li class="sc-subrow ${x.hidden ? "off" : ""}"><span class="what"><span class="e">${safe(x.emoji)}</span> ${safe(x.name)}${x.hidden ? " <small>🙈 hidden</small>" : ""}</span>
      <span class="sc-subbtns"><button data-scsubmove="${safe(x.id)}|-1" ${i ? "" : "disabled"} aria-label="Move up">↑ Up</button><button data-scsubmove="${safe(x.id)}|1" ${i < list.length - 1 ? "" : "disabled"} aria-label="Move down">↓ Down</button>
        <button data-scedit="subject|${safe(x.id)}" aria-label="Rename">✏️ Rename</button><button data-scsubhide="${safe(x.id)}" aria-label="${x.hidden ? "Show" : "Hide"}">${x.hidden ? "👁️ Show" : "🙈 Hide"}</button>
        <button data-scsubdel="${safe(x.id)}" aria-label="Delete">🗑️ Delete</button></span>
      ${schoolEdit === "subject" && schoolEditId === x.id ? subjectFormHtml(x) : ""}</li>`).join("")}</ul>
    ${adding ? subjectFormHtml({}) : `<button class="pill" data-scedit="subject">➕ Add a subject</button>`}</div>`;
}
function moveSubject(id, step) {
  const s = schoolFor(schoolKid), list = subjectList(s, true), i = list.findIndex(x => x.id === id), j = i + step;
  if (!isDadNow() || i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((x, n) => { s.subjects[x.id].order = n; });
  keepNow();
}
function hideSubject(id) {
  const s = schoolFor(schoolKid), x = s.subjects[id];
  if (!isDadNow() || !x) return;
  if (x.hidden) delete x.hidden; else x.hidden = true;
  keepNow();
  toast(x.hidden ? `🙈 ${x.name} is hidden. Everything in it is kept.` : `👁️ ${x.name} shows again.`, 3000);
}
function deleteSubject(id) {
  const s = schoolOf(schoolKid), x = s.subjects[id];
  if (!isDadNow() || !x) return;
  if (!subjectHasWork(s, { id, ...x })) return deleteSchoolItem("subject", id);
  if (!confirm(`“${x.name}” has work in it, so it can't be deleted.\n\nHide it instead? Everything in it is kept.`)) return;
  if (!x.hidden) hideSubject(id);
}
// 🎒 My school = the subject tiles ONLY (big, with ★ the level and the %). Everything else is inside each subject.
// (No subjects yet: they're added in 👤 My profile → ⚙️ My settings, or 🤖 makes one from an upload.)
function schoolHomeHtml(s, isDad) {
  const list = subjectList(s), look = isParentPhone();
  // 👨‍👩‍👧 A parent's phone: ✏️ Edit subjects (➕ add · ✏️ rename · 🙈 hide · 🗑️ delete, any time; 📚 Study activities pick from them)
  if (look && isDad && scSubEdit) return subjectsEditHtml(s);
  const edit = look && isDad ? `<div class="btnrow"><button class="pill" data-scsubedit>✏️ Edit subjects</button></div>` : "";
  const sess = sessionCardsHtml(schoolKid, null);   // (📚 STUDY: today's study sessions, each with 📚 Start session)
  // ⬆️ Upload a school file (a newsletter, a school review …): its topics go into every subject (see STUDY TOPICS)
  const up = feat("coach") && list.length ? `<button class="sc-addbig st-up" data-stup="">⬆️ Upload<small>A newsletter, a school review or school work: I find the topics for every subject</small></button>` : "";
  // 👨‍👩‍👧 the kid's files that aren't in a subject (newsletters, reviews …)
  const loose = isParentDevice() ? Object.entries(s.files).map(([id, x]) => ({ id, ...x })).filter(x => !x.subject && !x.worksheet && x.kind !== "link")
    .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 10) : [];
  const looseHtml = loose.length ? `<div class="card bd-card"><h2>📂 School files</h2><ul class="list">${loose.map(x => fileRowHtml(x, s, true)).join("")}</ul></div>` : "";
  // 📝 Every worksheet of the kid, all subjects, with its score (the kid's own; a parent: look-only)
  const allWs = `<div class="btnrow sc-allws"><button class="pill" data-scgo="allws">📝 All my worksheets</button></div>`;
  return sess + up + allWs + goalsLineHtml(schoolKid) + (list.length ? `<div class="sc-tiles sc-tiles-big">${list.map(x => subjectTileHtml(s, x)).join("")}</div>${looseHtml}${edit}`
    : edit ? `<div class="card"><p class="sc-empty">No subjects yet.</p>${edit}</div>` : `<div class="card"><p class="sc-empty">No subjects yet. ${look ? `Add them in ${safe(userById(schoolKid).name)}'s 👤 profile → ⚙️ Settings.` : "Add them in 👤 My profile → ⚙️ My settings."}</p>
      <div class="btnrow"><button class="pill" data-scprof="${safe(schoolKid)}">👤 Open the profile</button></div></div>`);
}
// ---------- 🎯 WORKSHEET GOALS: per subject, a parent sets "Worksheets per week" (0–7, 0 = no goal) in the kid's 🎒 School ----------
// Progress (kid and parents): the worksheets of that subject this week (Monday … Sunday) with the answers uploaded or a check.
const wsDoneThisWeek = (kid, name) => wsOf(kid, name).filter(w => w.date >= data.points.week && w.date < weekEnd() && (w.check || w.answers.length)).length;
const goalText = (kid, f) => `${f.name}: ${wsDoneThisWeek(kid, f.name)} of ${f.goal} worksheets this week`;
// The family's 🤖 limit a month (from the server's last answer on this device), or null = unlimited / not known
const aiLimit = () => { const u = aiUsage(); return u && Number(u.limit) > 0 ? Number(u.limit) : null; };
// All the kids' goals together, a month (about 4.3 weeks)
const goalsPerMonth = () => Math.round(kidsList().reduce((n, k) => n + subjectList(schoolOf(k.id)).reduce((m, f) => m + (f.goal || 0), 0), 0) * 52 / 12);
// On the subject page: the progress, and (a parent's device) the setting with the 🤖 note and, over the limit, a warning
function goalCardHtml(kid, f) {
  const parent = isParentDevice(), goal = f.goal || 0;
  if (!goal && !parent) return "";
  const done = goal ? wsDoneThisWeek(kid, f.name) : 0, limit = aiLimit(), month = goalsPerMonth();
  const progress = goal ? `<p class="goal-line ${done >= goal ? "ok" : ""}">🎯 ${safe(goalText(kid, f))}${done >= goal ? " 🎉" : ""}</p>` : "";
  const setting = parent ? `<div class="goal-set"><label class="small" for="wsGoal">🎯 Worksheets per week</label>
      <select id="wsGoal" data-wsgoal="${safe(kid)}|${safe(f.id)}">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${n === goal ? "selected" : ""}>${n === 0 ? "0 (no goal)" : n}</option>`).join("")}</select>
      <p class="hint">Each worksheet uses the AI. Your plan includes ${limit ? limit : "unlimited"} AI actions per month.</p>
      ${limit && month > limit ? `<p class="goal-warn">⚠️ All the kids' worksheet goals together are about ${month} worksheets a month, more than your plan's ${limit} AI actions. Lower some goals.</p>` : ""}</div>` : "";
  return `<div class="card bd-card goal-card"><h2>🎯 Worksheet goal</h2>${progress || (parent ? `<p class="hint">No goal yet for ${safe(f.name)}.</p>` : "")}${setting}</div>`;
}
// On the School home: every subject with a goal, in one line
function goalsLineHtml(kid) {
  const list = subjectList(schoolOf(kid)).filter(f => f.goal);
  return list.length ? `<div class="card bd-card goal-card"><p class="goal-line">🎯 ${list.map(f => `${safe(f.emoji)} ${safe(goalText(kid, f))}`).join(" · ")}</p></div>` : "";
}
document.addEventListener("change", e => {
  if (!e.target.matches || !e.target.matches("[data-wsgoal]") || !isParentDevice()) return;
  const [kid, sid] = e.target.dataset.wsgoal.split("|"), x = schoolFor(kid).subjects[sid], n = Number(e.target.value);
  if (!x) return;
  if (n >= 1 && n <= 7) x.goal = n; else delete x.goal;
  keepNow();
  toast(n ? `🎯 ${x.name}: ${n} ${n === 1 ? "worksheet" : "worksheets"} a week` : `🎯 ${x.name}: no goal`, 2500);
});
// ---------- 📝 ALL MY WORKSHEETS: every worksheet of the kid, all subjects, newest first, with its score ----------
// (📚 curriculum, ⚡ instant, 📚 study session, 🔁 practice, 🚀 challenge … all of them. A tap opens it as usual: the answers follow the 🔒 rule.)
// Kept for good: a checked worksheet and its result are never deleted by the app (only 🗑️ Reset study data does). A small copy of
// each check is kept in the kid's school data too (wsScores), so the list and the score stay even when the worksheet's document is gone.
let awFilter = "all";   // "all" | a subject (lower case) | "todo" (⏳ not checked yet)
// The kind tag: "📚 Study session" · "⚡ Instant" · "🔁 Practice" … · "📘 Curriculum"
function wsKindOf(w) {
  if (w.session) return "📚 Study session";
  if (w.src === "instant" || w.instant) return "⚡ Instant";
  if (w.src === "igcse") return "🌍 Curriculum extra";
  const p = WS_PURPOSE[w.purpose];
  return p ? `${p[0]} ${p[1]}` : "📘 Curriculum";
}
// The small copy of a check (see saveWsMark)
function keepWsScore(s, id, w, c) {
  if (!s.wsScores) s.wsScores = {};
  s.wsScores[id] = { pct: c.max_score > 0 ? Math.round(c.score / c.max_score * 100) : 0, score: c.score, total: c.max_score,
                     at: String(c.at || todayYmd()), title: String(w.title || "Worksheet").slice(0, 120), subject: String(w.subject || "").slice(0, 30),
                     date: w.date || "", kind: wsKindOf(w).slice(0, 30) };
}
// 🟢 ≥ 80 · 🟡 50–79 · 🔴 < 50
const awLevel = p => p >= 80 ? "good" : p >= 50 ? "mid" : "low";
// Every worksheet of the kid: its document, or (gone) its kept copy → [{ id, title, topics, subject, date, kind, score, total, pct, checked, open }]
function allWorksheetsOf(kid) {
  const s = schoolOf(kid), kept = s.wsScores || {}, out = new Map();
  Object.entries(aiDocs.worksheets).forEach(([id, w]) => {
    if (w.kid !== kid) return;
    const c = w.check, k = kept[id];
    out.set(id, { id, title: w.title, topics: w.topics || [], subject: w.subject || "", date: w.date || "", kind: wsKindOf(w), open: true,
                  ...(c ? { checked: true, score: c.score, total: c.max_score, pct: wsPct(w) } : k ? { checked: true, score: k.score, total: k.total, pct: k.pct } : { checked: false }) });
  });
  Object.entries(kept).forEach(([id, k]) => { if (!out.has(id)) out.set(id, { id, title: k.title || "Worksheet", topics: [], subject: k.subject, date: k.date || String(k.at).slice(0, 10),
    kind: k.kind || "📝 Worksheet", open: false, checked: true, score: k.score, total: k.total, pct: k.pct }); });
  return [...out.values()].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id.localeCompare(a.id));
}
// Checked worksheets that have no kept copy yet (made before the copies existed): copied once, quietly
function backfillWsScores(kid) {
  const s = data.school[kid];
  if (!s || hasDraft() || (isKidDevice() && kid !== kidDeviceId())) return;
  let added = false;
  Object.entries(aiDocs.worksheets).forEach(([id, w]) => { if (w.kid === kid && w.check && !(s.wsScores && s.wsScores[id])) { keepWsScore(s, id, w, w.check); added = true; } });
  if (added) setTimeout(() => writeData("auto"), 0);
}
function schoolAllWsHtml(s) {
  const kid = schoolKid, u = userById(kid);
  backfillWsScores(kid);
  const all = allWorksheetsOf(kid), subOf = x => String(x.subject || "").trim().toLowerCase();
  const subs = [...new Map(all.filter(x => x.subject).map(x => [subOf(x), x.subject])).entries()];
  if (awFilter !== "all" && awFilter !== "todo" && !subs.some(([k]) => k === awFilter)) awFilter = "all";
  const list = all.filter(x => awFilter === "all" || (awFilter === "todo" ? !x.checked : subOf(x) === awFilter));
  const checked = list.filter(x => x.checked), avg = checked.length ? Math.round(checked.reduce((n, x) => n + x.pct, 0) / checked.length) : null;
  const chip = (v, label) => `<button class="chip ${awFilter === v ? "on" : ""}" data-awfilter="${safe(v)}" aria-pressed="${awFilter === v}">${label}</button>`;
  const rows = list.map(x => {
    const what = [x.topics.length ? x.topics.join(", ") : "", x.date ? shortDate(x.date) : "", x.kind].filter(Boolean).join(" · ");
    const score = x.checked ? `<span class="ai-status lv-${awLevel(x.pct)}">${num(x.score)}/${num(x.total)} · ${x.pct}%</span>` : `<span class="ai-status">⏳ Not checked yet</span>`;
    const inner = `<span class="e">${safe(subjectEmoji(s, x.subject) || "📝")}</span>
      <span class="what">${x.subject ? `<b>${safe(x.subject)}</b> · ` : ""}${safe(x.title)}<small>${safe(what)}${x.open ? "" : " · (the worksheet itself isn't here any more: its score is kept)"}</small></span>${score}`;
    return `<li>${x.open ? `<button class="bd-file aw-row" data-aiopen="worksheet|${safe(x.id)}">${inner}</button>` : `<div class="bd-file aw-row">${inner}</div>`}</li>`;
  }).join("");
  return `<div class="card bd-card aw-card"><h2>📝 All the worksheets ${safe(u.name)} did</h2>
    <div class="chips aw-chips">${chip("all", "All")}${subs.map(([k, name]) => chip(k, `${safe(subjectEmoji(s, name) || "📘")} ${safe(name)}`)).join("")}${chip("todo", "⏳ Not checked")}</div>
    <p class="aw-sum">${list.length} ${list.length === 1 ? "worksheet" : "worksheets"}${avg != null ? ` · average ${avg}%` : ""}</p>
    ${list.length ? `<ul class="list aw-list">${rows}</ul>` : `<p class="sc-empty">${all.length ? "None here." : "No worksheets yet."}</p>`}</div>`;
}
// ---------- ⏳ WAITING: answers not checked yet, and older asks a kid's device saved before kids could ask 🤖 themselves ----------
async function doRequest(id) {
  const kid = schoolKid, s = schoolOf(kid), q = s.requests[id];
  if (!q) return;
  if (q.kind === "practice") {
    const topics = q.topics && q.topics.length ? q.topics : [q.topic];   // (✏️ Make a worksheet: several topics, its own count and kind)
    if (!(await newWorksheet(kid, q.subject, topics, q.count || PRACTICE_COUNT, q.mode || "practice", "req|" + id, { part: q.part || topics[0] }))) return;
    delete schoolFor(kid).requests[id];
    writeData();
    render();
    return toast("🔁 The practice worksheet is ready!", 2500);
  }
  // 📥 School work: the kid's saved files → 🤖 read, the same as ⬆️ Upload today's work
  const ids = q.files.filter(f => s.files[f]);
  if (!ids.length) { delete schoolFor(kid).requests[id]; writeData(); render(); return toast("Those files aren't there any more."); }
  let urls = [];
  try { urls = await Promise.all(ids.map(fileUrl)); } catch (e) {}
  if (urls.length !== ids.length || urls.some(u => !u)) return toast("📎 The files aren't on this device yet. Please try again in a moment.", 4500);
  const total = urls.reduce((n, u) => n + bytesOf(u), 0);
  if (total > AI_MAX) return toast(tooBigText(total), 6000);
  let files;
  try { files = await aiFilesFor(ids.map((f, i) => ({ name: s.files[f].name, url: urls[i] }))); }
  catch (err) { return toast(aiFileError(err), 6000); }
  const r = await callAi("analyze", { files, ...kidInfo(kid) }, "req|" + id);
  if (!r) return;
  delete schoolFor(kid).requests[id];
  const f = folderOf(s, q.subject);
  afterAnalyze(kid, r, ids, f ? f.id : "");   // (this also saves the data)
}

// ---------- 👤 Kid profile: asked once (the first time School opens for the kid), then from 👤 Profile ----------
const LEVEL_WORDS = { 1: "needs help", 2: "doing OK", 3: "strong" };
// 🧪 A subject's placement test (a worksheet) → "pending" (not checked yet) | "done" | null (none yet)
const testOf = x => x && x.test && aiDocs.worksheets[x.test] ? { id: x.test, w: aiDocs.worksheets[x.test] } : null;
function testStatusText(x) {
  const t = testOf(x);
  if (!t) return "A short 10-question test is made when you tap 💾 Save. Get its 📄 PDF from 📝 Worksheets.";
  if (!t.w.check) return "🧪 Test pending: get its 📄 PDF from 📝 Worksheets, then ⬆ upload the answers.";
  return `✅ Checked: ${num(t.w.check.score)}/${num(t.w.check.max_score)} → Level ${"⭐".repeat(x.level || 1)}`;
}
// 🏫 The kid's school basics in one card (👤 My profile, and look-only in School): school, curriculum, year, syllabus, subjects + levels.
// canEdit (a parent's device): ✏️ Edit · ✏️ Edit subjects. Kids only look.
function schoolBasicsHtml(kid, canEdit) {
  const u = userById(kid), s = schoolOf(kid), syl = s.syllabus, none = `<i class="sc-empty">${canEdit ? "Not added yet" : "–"}</i>`;
  const row = (label, v) => `<li><span>${label}</span><b>${v ? safe(v) : none}</b></li>`;
  const subjects = subjectList(s).map(f => {
    const x = s.profile.subjects[f.id] || {}, lv = x.level, t = testOf(x);
    return `<li><span>${safe(f.emoji)} ${safe(f.name)}</span><b>${lv ? `<span aria-label="Level ${lv} of 3: ${LEVEL_WORDS[lv]}">${"★".repeat(lv)}${"☆".repeat(3 - lv)}</span>`
      : x.unsure ? `<small>🧪 ${t ? "test pending" : "test to make"}</small>` : `<small>🧭 from the first level check</small>`}</b></li>`;
  }).join("");
  return `<div class="card me-card sc-basics"><h2>🏫 School</h2><ul class="me-list">
      ${row("🏫 School", schoolNameOf(kid))}${row("📚 Curriculum", u.curriculum)}${row("🎓 Year / Grade", gradeOf(kid))}
      ${row("📄 Syllabus", syl ? syl.name : "")}</ul>
    ${subjects ? `<h3 class="ph-group">📚 Subjects and levels</h3><ul class="me-list">${subjects}</ul>` : ""}
    ${canEdit ? `<div class="btnrow"><button class="pill" data-meedit>⚙️ Change school & subjects</button></div>`
      : `<p class="hint">✏️ Change these in 👤 My profile → ⚙️ My settings.</p>`}</div>`;
}
// ❓ Only a basic that's missing is asked (on a parent's device), one at a time, once: answered → saved on the kid; "Not now" → never again
function missingBasic(kid) {
  const u = userById(kid), skip = schoolOf(kid).profile.skip || [];
  const has = { school: !!schoolNameOf(kid), curriculum: !!u.curriculum, year: !!gradeOf(kid) };
  return BASIC_KEYS.find(k => !has[k] && !skip.includes(k)) || null;
}
function askBasicHtml(kid) {
  if (!isDadNow() || isKidDevice()) return "";
  const k = missingBasic(kid), u = userById(kid);
  if (!k || setupPending(u)) return "";   // (🧒 the first-time setup on the home asks it all first)
  const known = CURRICULA.some(x => x[0] === u.curriculum);
  const input = k === "school"
    ? `<input type="text" id="abSchool" maxlength="60" list="abSchools" placeholder="Type the school's name" autocomplete="off">
       <datalist id="abSchools">${DUBAI_SCHOOLS.map(([n]) => `<option value="${safe(n)}">`).join("")}</datalist>`
    : k === "curriculum"
    ? `<select id="abCurr"><option value="">—</option>${CURRICULA.map(([c]) => `<option>${c}</option>`).join("")}</select>`
    : `<select id="abYear">${yearOptionsHtml(known ? u.curriculum : "", "")}</select>`;
  const q = { school: `🏫 Which school does ${safe(u.name)} go to?`, curriculum: `📚 Which curriculum does ${safe(u.name)} follow?`,
              year: `🎓 Which year / grade is ${safe(u.name)} in?` }[k];
  return `<div class="card bd-card sc-form sc-askbasic"><label class="small" for="${{ school: "abSchool", curriculum: "abCurr", year: "abYear" }[k]}"><b>${q}</b></label>${input}
    <p class="hint">Asked once. It's saved in ${safe(u.name)}'s 👤 profile, and every worksheet uses it.</p>
    <div class="btnrow"><button class="primary" data-askbasic="${k}">💾 Save</button><button data-askbasicskip="${k}">Not now</button></div></div>`;
}
function saveBasic(k, skip) {
  const kid = schoolKid, u = data.users.find(x => x.id === kid);
  if (!u || !isDadNow() || !BASIC_KEYS.includes(k)) return;
  if (skip) {
    const p = schoolFor(kid).profile;
    p.skip = [...new Set([...(p.skip || []), k])];
  } else if (k === "school") {
    const v = $("abSchool").value.trim().slice(0, 60);
    if (!v) return;
    u.school = v;
    const hit = DUBAI_SCHOOLS.find(([n]) => n.toLowerCase() === v.toLowerCase());   // (a known school: its curriculum too, when there's none yet)
    if (hit && !u.curriculum) u.curriculum = hit[1];
  } else {
    const v = $(k === "curriculum" ? "abCurr" : "abYear").value;
    if (!v) return;
    u[k] = v;
  }
  writeData();
  schoolFresh = true;
  render();
  if (!skip) toast("👤 Saved in the profile!", 2200);
}
let profBack = null;   // 👤 My profile → ✏️ Edit: 💾 Save / Cancel go back to that kid's profile
function schoolProfileHtml(s, isDad, u) {
  if (!isDad || isKidDevice()) return schoolBasicsHtml(u.id, false);   // 🧒 look only
  const p = s.profile, first = !p.asked, syl = s.syllabus;
  return `${isDad ? `<div class="sc-actions"><button class="pill" data-scgo="brief">📋 Brief for parents</button></div>` : ""}
    <div class="card bd-card sc-form sc-profile"><h2>👤 About ${safe(u.name)}</h2>
    <p class="hint">${first ? `Before we start, tell me a little about ${safe(u.name)}. ` : ""}This helps 🤖 make worksheets that fit just right.</p>
    ${schoolFieldsHtml("sp", u)}
    <div class="sc-syl"><b>📄 Add the syllabus (optional)</b>
      <p class="hint">The year's plan from school: PDF, Word, PowerPoint or a photo. 🤖 follows it in every worksheet.</p>
      ${syl ? `<p class="sc-syl-file">📄 <b>${safe(syl.name)}</b><small>${syl.date ? shortDate(syl.date) + " · " : ""}${syl.text.split(/\s+/).filter(Boolean).length} words</small></p>` : ""}
      <div class="ai-btns"><button type="button" data-sylpick data-aiwait="syllabus">${syl ? "🔁 Replace" : "📄 Add the syllabus"}</button>
        ${syl ? `<button type="button" class="danger-text" data-syldel>🗑️ Remove</button>` : ""}</div>
      ${syl ? "" : `<p class="hint sc-sylnote" id="spSylNote">${safe(sylNoteText(u.curriculum, u.year))}</p>`}</div>
    ${subjectList(s).map(f => { const x = p.subjects[f.id] || {}, id = safe(f.id), unsure = x.unsure === true;
      // (⭐ the level is asked once: a subject that has it only shows it; it's changed in ✏️ Edit subjects)
      if (levelAnswered(u.id, f)) return `<fieldset class="sc-prof-sub"><legend>${safe(f.emoji)} ${safe(f.name)}</legend>
        <p class="sc-know-test">${x.level ? `Level ${"⭐".repeat(x.level)} <small>${LEVEL_WORDS[x.level]}${x.unsure ? " · from the 🧪 placement test" : ""} · change it in ✏️ Edit subjects</small>`
          : `<small>${x.unsure ? safe(testStatusText(x)) : "🧭 The level check is on its way: the level is saved when it's checked."}</small>`}</p>
        <label class="small" for="spg-${id}">Good at…</label><input type="text" id="spg-${id}" maxlength="150" value="${safe(x.good || "")}" placeholder="Times tables">
        <label class="small" for="sph-${id}">Finds hard…</label><input type="text" id="sph-${id}" maxlength="150" value="${safe(x.hard || "")}" placeholder="Long division"></fieldset>`;
      return `<fieldset class="sc-prof-sub"><legend>${safe(f.emoji)} ${safe(f.name)}</legend>
      <div class="sc-know" role="radiogroup" aria-label="Do you know their level in ${safe(f.name)}?"><b class="sc-know-q">Do you know their level?</b>
        <label><input type="radio" name="spk-${id}" value="yes" data-spknow="${id}" ${unsure ? "" : "checked"}><span>Yes</span></label>
        <label><input type="radio" name="spk-${id}" value="unsure" data-spknow="${id}" ${unsure ? "checked" : ""}><span>Not sure</span></label></div>
      <div id="spy-${id}" ${unsure ? "hidden" : ""}>
        <div class="sc-stars3" role="radiogroup" aria-label="${safe(f.name)} level">${[1, 2, 3].map(n => `<label title="${LEVEL_WORDS[n]}">
          <input type="radio" name="spl-${id}" value="${n}" ${x.level === n && !unsure ? "checked" : ""}><span>${"⭐".repeat(n)}</span></label>`).join("")}</div>
        <label class="small" for="spg-${id}">Good at…</label><input type="text" id="spg-${id}" maxlength="150" value="${safe(x.good || "")}" placeholder="Times tables">
        <label class="small" for="sph-${id}">Finds hard…</label><input type="text" id="sph-${id}" maxlength="150" value="${safe(x.hard || "")}" placeholder="Long division"></div>
      <p class="sc-know-test" id="spt-${id}" ${unsure ? "" : "hidden"}>🧪 <b>Placement test</b><small>${safe(testStatusText(x))}</small></p>
      </fieldset>`; }).join("")}
    <label class="small" for="spOther">Anything else?</label>
    <textarea id="spOther" rows="3" maxlength="400" placeholder="Loves animals. Gets tired after 20 minutes.">${safe(p.other)}</textarea>
    <div class="btnrow"><button class="primary" data-profsave>💾 Save</button><button data-profskip>${first ? "Skip for now" : "Cancel"}</button></div></div>`;
}
function saveProfile(skip) {
  if (!schoolKid || !exists(me) || !isDadNow() || isKidDevice()) return;   // (kids only look)
  const kid = schoolKid, s = schoolOf(kid), back = profBack === kid;
  profBack = null;
  const done = () => back ? openProfile(kid) : goSchool("home");   // (back to 👤 My profile when ✏️ Edit came from there)
  if (skip && s.profile.asked) return done();   // (Cancel)
  const p = schoolFor(kid).profile;
  let tests = [];
  if (!skip) {
    const subjects = {};
    subjectList(s).forEach(f => {
      const old = p.subjects[f.id] || {}, unsure = (document.querySelector(`input[name="spk-${f.id}"]:checked`) || {}).value === "unsure";
      const good = $("spg-" + f.id).value.trim().slice(0, 150), hard = $("sph-" + f.id).value.trim().slice(0, 150);
      // (a subject whose level was asked already: its level / test stay as they are, only 💪 / 🎯 change)
      if (!document.querySelector(`input[name="spk-${f.id}"]`)) {
        const keep = { ...old, good, hard };
        if (keep.level || keep.unsure || good || hard) subjects[f.id] = keep;
        return;
      }
      if (unsure) {
        // 🧪 Not sure: the level comes from the placement test (kept when that test is already made;
        // offline the worksheets may not be here yet, so the test is kept unless it's really gone)
        const t = old.unsure ? testOf(old) : null, keep = old.unsure && old.test && (t || !aiReady());
        subjects[f.id] = { level: t && t.w.check ? old.level : 0, good, hard, unsure: true, ...(keep ? { test: old.test } : {}) };
        if (!keep) tests.push(f.id);
        return;
      }
      const level = Number((document.querySelector(`input[name="spl-${f.id}"]:checked`) || {}).value) || 0;
      if (level || good || hard) subjects[f.id] = { level, good, hard };
    });
    Object.assign(p, { subjects, other: $("spOther").value.trim().slice(0, 400) });
    // 🏫 📚 🎓 kept on the kid (shared family data, like 👨‍👩‍👧 Family)
    const u = data.users.find(x => x.id === kid), about = schoolFieldsValue("sp");
    if (u) { Object.assign(u, about); Object.keys(about).forEach(k => { if (!u[k]) delete u[k]; }); }
  }
  p.asked = true;   // asked once: it doesn't come by itself again
  writeData();
  done();
  if (skip) return;
  if (!tests.length) return toast("👤 Saved! Thank you.");
  makePlacementTests(kid, tests);
}
// 🧪 One placement test for each "Not sure" subject, one after the other (they're in 📝 Worksheets, checked like any worksheet)
const PLACEMENT_COUNT = 10;
async function makePlacementTests(kid, folderIds) {
  toast(`👤 Saved! Making ${folderIds.length === 1 ? "a placement test" : folderIds.length + " placement tests"}… 🧪`, 4000);
  let made = 0;
  for (const fid of folderIds) {
    const f = schoolOf(kid).subjects[fid];
    if (!f) continue;
    const topics = [schoolOf(kid).syllabus ? `The main ${f.name} topics of this year, from the school syllabus`
                                          : `The main ${f.name} topics of ${gradeOf(kid) || "this school year"}`];
    const id = await newWorksheet(kid, f.name, topics, PLACEMENT_COUNT, "placement", "placement",
                                  { title: `🧪 ${f.name} placement test`, part: "🧪 Placement test" }, false);
    if (!id) continue;
    made++;
    const x = schoolFor(kid).profile.subjects[fid];
    if (x && x.unsure) { x.test = id; writeData(); }
  }
  if (screen === "school") render();
  toast(made === folderIds.length ? `🧪 ${made === 1 ? "The placement test is" : made + " placement tests are"} ready in 📝 Worksheets!`
    : `🧪 ${made} of ${folderIds.length} placement tests were made. Save the profile again to try the others.`, 4500);
}
// A checked 🧪 placement test: the subject's level from the score, and 📋 the brief once ALL the kid's tests are checked
function afterPlacement(kid, wsId, c, first) {
  const p = schoolFor(kid).profile, x = Object.values(p.subjects).find(y => y.unsure && y.test === wsId);
  if (x) { const pct = c.score / c.max_score * 100; x.level = pct >= 80 ? 3 : pct >= 50 ? 2 : 1; writeData(); }
  const tests = Object.values(p.subjects).filter(y => y.unsure);
  if (first && x && tests.every(y => { const t = testOf(y); return t && t.w.check; })) {
    toast("🧪 All placement tests are checked! Writing the brief for parents… 📋", 4500);
    makeBrief(kid, true);
  }
}
// "📄 Add the syllabus": its text is taken out (PDF / Word / PowerPoint here; a photo or a scanned PDF: 🤖 reads it) and kept for the kid
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
let pdfjsLoading = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfjsLoading = pdfjsLoading || new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = PDFJS_URL;
    el.onload = () => { if (!window.pdfjsLib) return reject(new Error("pdf")); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL; resolve(window.pdfjsLib); };
    el.onerror = () => { el.remove(); pdfjsLoading = null; reject(new Error("pdf")); };
    document.head.appendChild(el);
  });
}
// A PDF's text ("" when it has none, e.g. a scanned one, or the PDF reader couldn't load)
async function pdfText(url) {
  try {
    const lib = await loadPdfJs(), bytes = Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), ch => ch.charCodeAt(0));
    const pdf = await lib.getDocument({ data: bytes }).promise, out = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 80); i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      const text = tc.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+/g, " ").trim();
      if (text) out.push(text);
    }
    return out.join("\n\n");
  } catch (e) { return ""; }
}
async function syllabusText(r) {
  const type = r.url.slice(5, r.url.indexOf(";"));
  if (type === "text/plain") return textOfUrl(r.url);
  if (type === PPTX_TYPE || type === DOCX_TYPE) return officeText(r.url.slice(r.url.indexOf(",") + 1), type === PPTX_TYPE ? "pptx" : "docx");
  if (type === "application/pdf") return pdfText(r.url);
  return "";   // a photo
}
async function addSyllabus(files) {
  const kid = schoolKid;
  if (!kid || isKidDevice() || !exists(me)) return;
  toast("📄 Reading the syllabus…", 3000);
  const texts = [], pictures = [], problems = [];
  for (const file of files) {
    const { r, problem } = await readForAi(file);
    if (problem) { problems.push(problem); continue; }
    try { const text = (await syllabusText(r)).trim(); if (text) texts.push(text); else pictures.push(r); }
    catch (err) { problems.push(aiFileError(err)); }
  }
  // Photos and scanned PDFs: 🤖 reads the subjects and topics from them
  if (pictures.length) {
    const total = pictures.reduce((n, x) => n + bytesOf(x.url), 0);
    if (total > AI_MAX) problems.push(tooBigText(total));
    else {
      const r = await callAi("newsletter", { files: pictures.map(x => aiFile(x.name, x.url)), ...kidInfo(kid), today: todayYmd() }, "syllabus");
      if (r) {
        const res = cleanNewsletter(r);
        const lines = [...res.subjects.map(x => `${x.subject}: ${x.topics.join("; ")}`),
                       ...res.events.map(e => `${e.date}: ${e.title}${e.note ? " (" + e.note + ")" : ""}`), ...res.reminders];
        if (lines.length) texts.push(lines.join("\n"));
        else problems.push("🤖 couldn't find subjects or topics in the photos.");
      }
    }
  }
  if (!texts.length) return toast(problems.join(" ") || "📄 Couldn't read the syllabus. Please try another file.", 6000);
  const all = texts.join("\n\n"), name = files.length === 1 ? fileNameOf(files[0]) : `${fileNameOf(files[0])} +${files.length - 1}`;
  schoolFor(kid).syllabus = { name: name.slice(0, 60), text: all.slice(0, 20000), date: todayYmd(), by: me };
  writeData();
  render();
  toast(`📄 Syllabus saved for ${kidNameOf(kid)}!${all.length > 20000 ? " (It's long: the first part is kept.)" : ""}${problems.length ? " " + problems.join(" ") : ""}`, 4500);
}
function removeSyllabus() {
  const s = schoolFor(schoolKid);
  if (!s.syllabus || !confirm(`Remove the syllabus “${s.syllabus.name}”?`)) return;
  s.syllabus = null;
  writeData();
  render();
}

// ---------- 📋 Brief for parents (parents only): 🤖 /brief from the 👤 profile + the last 10 checked worksheets ----------
// It opens by itself once all the kid's 🧪 placement tests are checked (see afterPlacement). The latest one is kept (school.brief).
function briefResults(kid) {
  return wsOf(kid).filter(w => w.check).sort((a, b) => String(b.check.at).localeCompare(String(a.check.at)) || byNewest(a, b)).slice(0, 10)
    .map(w => ({ subject: w.subject, title: w.title, score: w.check.score, max: w.check.max_score,
                 strong: w.check.strong_points || [], weak: w.check.weak_points || [], ...(w.purpose === "placement" ? { placement: true } : {}) }));
}
function briefProfile(kid) {
  const s = schoolOf(kid), p = s.profile;
  return { subjects: subjectList(s).map(f => {
             const x = p.subjects[f.id] || {};
             const level = x.level ? `${x.level} of 3 stars (${LEVEL_WORDS[x.level]})${x.unsure ? ", from the placement test" : ", from the parents"}`
               : x.unsure ? "not sure yet (placement test pending)" : "not given";
             return { subject: f.name, level, good_at: x.good || "", finds_hard: x.hard || "" };
           }), other: p.other || "" };
}
async function makeBrief(kid, auto) {
  if (!isParentId(me) || isKidDevice() || !exists(kid)) return;
  const u = userById(kid);
  const r = await callAi("brief", { ...kidInfo(kid), profile: briefProfile(kid), results: briefResults(kid) }, "brief");
  if (!r) return;
  const list = (x, n, len) => aiArr(x, n).map(t => aiTxt(t, len)).filter(Boolean);
  const b = { at: new Date().toISOString(), date: todayYmd(), summary: aiTxt(r.summary, 1500),
              subjects: aiObjs(r.subjects, 12).map(x => ({ subject: aiTxt(x.subject, 30), level: aiTxt(x.level, 80), strong_points: list(x.strong_points, 5, 150),
                                                          weak_points: list(x.weak_points, 5, 150), next_steps: list(x.next_steps, 5, 300) })).filter(x => x.subject),
              home_tips: list(r.home_tips, 6, 400) };
  if (!b.summary) return toast("🤖 The brief came back empty. Please try again.", 4000);
  schoolFor(kid).brief = b;
  writeData();
  addNews([newsItem("school", `📋 New brief for ${u.name}`, "", kid)]);   // 🔔 for the parents' devices
  toast(`📋 New brief for ${u.name}`, 3500);
  // Open it (by itself too, after the last placement test)
  if (screen === "school" && schoolKid === kid) goSchool("brief");
  else if (auto) { schoolKid = kid; leaveDraft(() => { schoolView = "brief"; schoolSubject = null; schoolEdit = schoolEditId = null; schoolFresh = true; go("school"); }); }
}
function schoolBriefHtml(s, isDad, u) {
  if (!isDad || isKidDevice()) return `<div class="card"><p class="sc-empty">📋 The brief is for parents.</p></div>`;
  const b = s.brief;
  return aiMount(() => h("div", null,
    h("div", { class: "ai-toolbar" },
      h("button", { class: b ? null : "primary", data: { briefmake: "", aiwait: "brief" } }, b ? "🔁 Make a new brief" : "📋 Make the brief"),
      b ? h("button", { class: "primary", data: { briefprint: "" } }, "🖨️ Print") : null,
      b ? h("button", { data: { briefpdf: "" } }, "📄 PDF") : null),
    b ? briefNode(schoolKid, b)
      : h("div", { class: "card bd-card ai-narrow" }, h("p", { class: "sc-empty" },
          `No brief yet. Tap 📋 Make the brief: 🤖 writes it from ${u.name}'s profile and the last checked worksheets.`))));
}
// The brief card (on screen, and the same on paper)
function briefNode(kid, b) {
  const u = userById(kid), items = (emoji, title, list) => list.length ? h("div", { class: "bf-part" }, h("b", null, `${emoji} ${title}`),
    h("ul", null, list.map(t => h("li", null, t)))) : null;
  return h("div", { class: "bf-sheet" },
    h("div", { class: "ws-namerow" }, h("span", null, "📋 Brief for parents"), h("span", null, b.date ? longDate(b.date) : "")),
    h("h1", { class: "ex-title" }, `${u.emoji} ${u.name}`),
    h("div", { class: "ws-sub" }, [gradeOf(kid), u.school].filter(Boolean).join(" · ")),
    h("p", { class: "bf-summary" }, b.summary),
    b.subjects.map(x => h("section", { class: "bf-sub" },
      h("div", { class: "bf-subhead" }, h("h3", null, `${subjectEmoji(schoolOf(kid), x.subject)} ${x.subject}`), x.level ? h("span", { class: "bf-level" }, x.level) : null),
      items("💪", "Strong", x.strong_points), items("🎯", "To work on", x.weak_points), items("➡️", "Next steps", x.next_steps))),
    b.home_tips.length ? h("section", { class: "bf-sub bf-home" }, h("h3", null, "🏠 Home tips"), h("ul", null, b.home_tips.map(t => h("li", null, t)))) : null);
}
function subjectTileHtml(s, x) {
  const avg = avgPct(checkedOf(schoolKid, x.name)), level = (s.profile.subjects[x.id] || {}).level;
  return `<button class="sc-tile" data-scgo="subject|${safe(x.id)}" style="--c:${subjectColors(x).color}">
    <span class="e">${safe(x.emoji)}</span><b>${safe(x.name)}</b><span class="sc-stars sc-lvstars ${level ? "" : "none"}" aria-label="${level ? `Level ${level} of 3` : "No level yet"}">${level ? "★".repeat(level) + "☆".repeat(3 - level) : "☆☆☆"}</span>
    ${avg == null ? `<span class="sc-pct none" aria-label="No checked worksheets yet">–</span>` : `<span class="sc-pct lv-${pctLevel(avg)}">${avg}%</span>`}</button>`;
}

// ---------- The subject form (Bro2a: ➕ Subject on the School home, ✏️ on a subject) ----------
// ➕ A new subject: one tap fills the name and emoji
const SUBJECT_SUGGEST = [["📗", "Quran"], ["✍️", "Arabic"], ["➗", "Math"], ["📖", "English"], ["🔬", "Science"], ["🕌", "Islamic"],
                         ["🌍", "Social Studies"], ["🇫🇷", "French"], ["💻", "Computing"], ["🎨", "Art"], ["🎵", "Music"], ["⚽", "PE"]];
function subjectFormHtml(x) {
  const s = schoolOf(schoolKid), sugg = x.name ? [] : SUBJECT_SUGGEST.filter(([, n]) => !folderOf(s, n));
  return `<div class="sc-form">
    ${sugg.length ? `<div class="ph-chips sc-sugg">${sugg.map(([e, n]) => `<button type="button" class="ph-chip" data-scsugg="${safe(e)}|${safe(n)}"><span class="e">${e}</span><span>${safe(n)}</span></button>`).join("")}</div>` : ""}
    <div class="row"><div style="flex:0 0 84px"><label class="small" for="scsEmoji">Emoji</label><input type="text" id="scsEmoji" maxlength="8" value="${safe(x.emoji || "")}" placeholder="📘"></div>
      <div><label class="small" for="scsName">Subject</label><input type="text" id="scsName" maxlength="30" value="${safe(x.name || "")}" placeholder="History"></div></div>
    <label class="small">Color</label>
    <div class="swatches">${Object.entries(PALETTE).map(([key, c]) => `<label title="${key}"><input type="radio" name="scsColor" value="${key}" ${(x.color || "blue") === key ? "checked" : ""}>
      <span style="background:${c.color}"></span></label>`).join("")}</div>
    ${subjectLevelPickHtml(x.id ? s.profile.subjects[x.id] || {} : {}, !x.id)}
    ${scButtons("subject", !!schoolEditId)}</div>`;
}
// ⭐ The subject's level: asked when the subject is added, changed later here (✏️ Edit subjects). Nothing picked → 🧭 a level check on the first worksheet.
function subjectLevelPickHtml(x, fresh) {
  const pick = (v, label, title, on) => `<label title="${title}"><input type="radio" name="scsLevel" value="${v}" ${on ? "checked" : ""}><span>${label}</span></label>`;
  return `<label class="small">⭐ Level${fresh ? " (asked once)" : ""}</label>
    <div class="sc-stars3" role="radiogroup" aria-label="Level">${[1, 2, 3].map(n => pick(n, "⭐".repeat(n), LEVEL_WORDS[n], x.level === n)).join("")}
      ${pick("unsure", "🧪 Not sure", "A short placement test", !x.level && x.unsure)}</div>
    <p class="hint">${fresh ? "Not sure? Pick 🧪: a short test finds it. Nothing picked: the first worksheet is a 🧭 level check." : "The level is saved for this subject: it isn't asked again."}</p>`;
}
// 🧭 Is the subject's level known (or being found)? A level given, "Not sure" (🧪 test), or a level check / test already made.
// Then it's never asked again (on any device); parents change it in ✏️ Edit subjects.
function levelAnswered(kid, f) {
  const x = schoolOf(kid).profile.subjects[f.id] || {};
  return !!x.level || !!x.unsure || wsOf(kid, f.name).some(w => w.purpose === "level_check" || w.purpose === "placement");
}
// A parent's pick in ✏️ Edit subjects → saved on the subject (true = a 🧪 placement test is needed)
function setSubjectLevel(kid, fid, v) {
  const p = schoolFor(kid).profile, old = p.subjects[fid] || {}, base = { good: old.good || "", hard: old.hard || "" };
  const n = Number(v);
  if ([1, 2, 3].includes(n)) { p.subjects[fid] = { ...base, level: n }; return false; }
  if (v === "unsure" && !old.unsure) { p.subjects[fid] = { ...base, level: 0, unsure: true }; return true; }
  return false;
}
// The first 🧭 level check of a subject that has no level yet, checked → the subject's level (like a 🧪 placement test)
function afterLevelCheck(kid, w, c) {
  const s = schoolFor(kid), f = folderOf(s, w.subject);
  if (!f || !(c.max_score > 0)) return;
  const x = s.profile.subjects[f.id];
  if (x && (x.level || x.unsure)) return;
  const pct = c.score / c.max_score * 100;
  s.profile.subjects[f.id] = { good: (x && x.good) || "", hard: (x && x.hard) || "", level: pct >= 80 ? 3 : pct >= 50 ? 2 : 1 };
  writeData();
}

// ---------- 📂 One subject: 3 big buttons (📂 my work · ✏️ worksheets · 🎬 help me understand), 📌 my topics, the 💪 / 🎯 note ----------
// 👨‍👩‍👧 A parent's phone (also when it's showing a kid): parents look, kids upload and make (no ⬆ Upload, ✏️ Make, 🤖 Explain there)
const isParentPhone = () => !isKidDevice() && (cloud.role === "parent" || isParentId(me));
let scTopics = [];          // the 📌 topic chips drawn last (a chip's number points here)
let scMakeOpen = false;     // ✏️ worksheets → ➕ Make a new one: the topic chips are showing
// 🎒 A subject (see STUDY TOPICS). The kid: ⬆️ Upload · 📚 Start session · ✏️ My worksheets · 📚 the topics with coloured dots
// (+ the friendly 🧠 line). Parents also: the filters and each topic's history, 📊 Study, 🧠 Learning profile, 🌍 Official curriculum,
// 📂 Files, 📖 explanations and the older parts (📊 Marks, 📝 Homework, ⭐ Reviews, 📄 Reports, 🏫 School info, 👤 Profile).
function schoolSubjectHtml(s, isDad, u) {
  const f = { id: schoolSubject, ...s.subjects[schoolSubject] }, c = subjectColors(f), parent = isParentDevice();
  const editing = isDad && schoolEdit === "subject" && schoolEditId === schoolSubject;
  let html = `<div class="bd-folder-head" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}"><span class="e">${safe(f.emoji)}</span>
      <h2>${safe(f.name)}</h2>${isDad && !editing ? `<span class="bd-head-btns">${itemBtns("subject", schoolSubject)}</span>` : ""}</div>`;
  if (editing) html += subjectFormHtml(f);
  // ⚙️ School coach off: just the files and the older records (no 🤖 worksheets, %, strong / weak points)
  if (!feat("coach")) return html + subjectFilesHtml(s, f, `📁 ${u.name}'s uploaded files`) + subjectOlderHtml(s, f, c, isDad);
  if (stSub !== f.id) { stSub = f.id; stPick = []; stFilter = "all"; stOpen = null; stWs = false; stFiles = false; stMapPick = []; }
  html += levelBannerHtml();
  // The big buttons: ⬆️ Upload · 📚 Start session (this subject's session today, not made yet) · ✏️ My worksheets
  const now = sessionsIn(schoolKid, [todayYmd()]).find(x => x.mode === "sole" && !x.ended && !sessionWsIds(x.key).length
    && (x.subjectId === f.id || sameSubject(x.subject, f.name)));
  const all = wsOf(schoolKid, f.name), todo = all.filter(w => !w.check).length;
  html += `<div class="st-big">
      <button class="st-btn" data-stup="${safe(f.id)}"><span class="e">⬆️</span><b>Upload</b></button>
      ${now ? `<button class="st-btn go" data-sessstart="${safe(now.key)}" data-aiwait="session|${safe(now.key)}"><span class="e">📚</span><b>Start session</b></button>` : ""}
      <button class="st-btn ${stWs ? "on" : ""}" data-stws aria-expanded="${stWs}"><span class="e">✏️</span><b>My worksheets</b>${todo ? `<span class="sc-badge">${todo}</span>` : ""}</button></div>`;
  html += translateToggleHtml(schoolKid, f.name);   // 🌐 Arabic translation of questions (for this kid's new worksheets; not Arabic / Islamic)
  html += goalCardHtml(schoolKid, f);   // 🎯 "Math: 2 of 4 worksheets this week" (a parent: the setting too)
  html += sessionCardsHtml(schoolKid, f);
  if (stWs) html += all.length ? aiMount(() => aiListCard("✏️ My worksheets", h("ul", { class: "list" }, [...all].sort((a, b) => (a.check ? 1 : 0) - (b.check ? 1 : 0)).map(w => wsRowNode(s, w))), ""))
    : `<div class="card"><p class="sc-empty">No worksheets yet. Tick a topic, then ✏️ Make a worksheet.</p></div>`;
  html += topicsCardHtml(s, f, parent);
  if (!parent) return html + learnKidLine(schoolKid, f);   // 🧒 the kid: that's all
  // 👨‍👩‍👧 Parents only
  html += `<div class="card bd-card"><h2>📊 Study this week</h2>${studyTableHtml(schoolKid, f.name)}</div>
    <div class="card bd-card"><h2>🧠 Learning profile</h2>${learnCardHtml(schoolKid, f)}</div>
    <div class="card bd-card"><h2>🌍 Official curriculum</h2>${mapCardHtml(schoolKid, f)}</div>`;
  const files = filesOf(s, f.name);
  html += `<div class="card bd-card"><div class="sc-head"><h2>📂 Files</h2><button class="linkbtn" data-stfiles aria-expanded="${stFiles}">${stFiles ? "Hide" : `Show (${files.length})`}</button></div>
    ${stFiles ? files.length ? `<ul class="list">${files.map(x => fileRowHtml(x, s, true)).join("")}</ul>` : `<p class="sc-empty">Nothing uploaded yet.</p>` : ""}</div>`;
  const ex = exOf(schoolKid, f.name);
  if (ex.length) html += aiMount(() => aiListCard("📖 Explanations", exListNode(ex), ""));
  const fid = safe(f.id), checked = checkedOf(schoolKid, f.name);
  html += `<div class="sc-subrow">${[["marks", "📊 Marks"], ["homework", "📝 Homework"], ["reviews", "⭐ Reviews"], ["reports", "📄 Reports"]]
      .map(([v, label]) => `<button class="pill" data-scgo="${v}|${fid}">${label}</button>`).join("")}
    <button class="pill" data-scprof="${safe(schoolKid)}|info">🏫 School info</button><button class="pill" data-scprof="${safe(schoolKid)}">👤 Profile</button></div>`;
  if (isDad && !isKidDevice() && checked.length) html += aiMount(() => parentExtrasNode(s, checked));   // (🦉 the coach's tip, "By part")
  return html + subjectOlderHtml(s, f, c, isDad);
}
// ---------- 📌 A topic chip → the small sheet: 🤖 Explain it to me · ✏️ Make a worksheet (the kid, or a parent for that kid) ----------
let tp = null;   // { kid, subject, title, work, workTitle, topics }
function openTopicSheet(i) {
  const t = scTopics[Number(i)], f = s0Subject();
  if (!t || !f) return;
  tp = { kid: schoolKid, subject: f.name, ...t };
  $("topicTitle").textContent = `📌 ${t.title}`;
  $("topicFrom").textContent = t.workTitle ? `From: ${t.workTitle}` : f.name;
  $("topicModal").hidden = false;
  $("topicModal").querySelector("[data-tpex]").focus();
}
function closeTopicSheet() { $("topicModal").hidden = true; tp = null; }
const s0Subject = () => { const s = schoolOf(schoolKid), x = s.subjects[schoolSubject]; return x ? { id: schoolSubject, ...x } : null; };
// 🤖 Explain: the topic at the kid's level, with the upload's title as context
async function topicExplain(t) {
  if (!t || aiWait) return;
  const topic = (t.workTitle && t.workTitle.toLowerCase() !== t.title.toLowerCase() ? `${t.title} (from “${t.workTitle}”)` : t.title).slice(0, 200);
  if ($("topicModal").hidden) toast("🤖 Thinking…", 2500);
  await explainTopic(t.kid || schoolKid, t.subject, topic, "tpex", t.work || undefined);   // (the sheet shows "🤖 Thinking…" meanwhile)
  closeTopicSheet();
}
// ✏️ A 🔁 practice worksheet on the topic (with the other topics from that upload)
async function topicWorksheet(t) {
  if (!t || aiWait) return;
  if ($("topicModal").hidden) toast("🤖 Thinking…", 2500);
  const kid = t.kid || schoolKid, topics = [t.title, ...(t.topics || []).filter(x => x.toLowerCase() !== t.title.toLowerCase())].slice(0, 6);
  const ok = await newWorksheet(kid, t.subject, topics, PRACTICE_COUNT, "practice", "tpws", { part: t.workTitle || t.title, ...(t.work ? { work: t.work } : {}) });
  closeTopicSheet();
  if (ok) toast("✏️ Your worksheet is ready! 🖨️ Print or 📄 PDF.", 3000);
}
// "🆕 New topic: Fractions" while its level check is being made (or 🔁 when that didn't work)
function levelBannerHtml() {
  const L = schoolLevel;
  if (!L || L.kid !== schoolKid || L.folder !== schoolSubject) return "";
  return `<div class="card sc-newtopic" role="status"><b>🆕 New topic: ${safe(L.title)}</b>
    <p>${L.state === "making" ? "📝 Making a short level check to see what you already know…" : "Couldn't make the level check."}</p>
    ${L.state === "failed" ? `<div class="btnrow"><button class="primary" data-levelretry="${safe(L.work)}" data-aiwait="level">🔁 Try again</button>
      <button data-levelclose>Close</button></div>` : ""}</div>`;
}

// 👨‍👩‍👧 Parents only: 🦉 the latest coach's tip and the % by part
function parentExtrasNode(s, list) {
  const parts = new Map(), tip = list.find(w => w.check.coach_tip);
  list.forEach(w => {
    const name = partOf(w, s), k = name.toLowerCase();
    if (!parts.has(k)) parts.set(k, { name, list: [] });
    parts.get(k).list.push(w);
  });
  return h("div", { class: "sc-ov sc-parent" },
    tip ? h("div", { class: "card bd-card sc-tip" }, h("h2", null, "🦉 Coach's tip"), h("p", null, tip.check.coach_tip),
      h("small", null, `${shortDate(tip.check.at)} · ${partOf(tip, s)}`)) : null,
    h("div", { class: "card bd-card" }, h("h2", null, "By part"), [...parts.values()].map(p => {
      const a = avgPct(p.list);
      return h("div", { class: "bd-avgrow" }, h("div", { class: "bd-avgtop" }, h("b", null, p.name),
        h("span", null, h("b", { class: "lv-" + pctLevel(a) }, a + "%"), " ", h("small", null, `(${p.list.length})`))), pctBarNode(a));
    })));
}

// 📁 Files: every file of the subject, newest first (tap one to see / ⬇ download it)
function subjectFilesHtml(s, f, title = "📁 Files", status = false) {
  const files = filesOf(s, f.name), look = isParentPhone();   // (👨‍👩‍👧 a parent's phone: look only, no ⬆ Upload)
  return `${look ? "" : `<div class="sc-actions"><button class="pill" data-scupload="${safe(f.name)}">⬆ Upload</button><button class="pill" data-scedit="link">🔗 Add link</button></div>
    ${schoolEdit === "link" ? linkFormHtml() : ""}`}
    <div class="card bd-card"><h2>${safe(title)}</h2>${files.length ? `<ul class="list">${files.map(x => fileRowHtml(x, s, status)).join("")}</ul>`
      : `<p class="sc-empty">${look ? "Nothing uploaded yet." : "No files yet. Use ⬆️ Upload today's work, or ⬆ Upload."}</p>`}</div>`;
}
// ✅ / ⏳ for an uploaded file: 🤖 read it (a school work card) or its worksheet is checked · waiting for a parent's phone or the check
function fileStatus(f, s) {
  if (f.worksheet) { const w = aiDocs.worksheets[f.worksheet]; return w && w.check ? "✅ Checked" : "⏳ Waiting for check"; }
  if (f.work && s.work[f.work]) return "✅ Read";
  if (Object.values(s.requests).some(q => q.kind === "work" && (q.files || []).includes(f.id))) return "⏳ Waiting";
  return "";
}

// 📝 Worksheets: each with its status and 🖨️ ⬆ 🤖 🔑
const WS_PURPOSE = { level_check: ["🧭", "Level check"], practice: ["🔁", "Practice"], week_review: ["📅", "Week review"], challenge: ["🚀", "Challenge"],
                     placement: ["🧪", "Placement test"] };
// A worksheet row: its status (✅ the score and the short note), then 📂 🖨️ 📸 ✅ 🔑
// "👨‍👩‍👧 from Bro2a": a worksheet / explanation a parent made for the kid (it's in the kid's lists too)
const madeByParent = d => d.by && d.by !== d.kid && exists(d.by) && isParentId(d.by) ? `👨‍👩‍👧 from ${userById(d.by).name}` : "";
function wsRowNode(s, w) {
  const files = w.answers.filter(x => s.files[x]), done = !!w.check, canAct = isDadNow() || !done, [emoji, label] = WS_PURPOSE[w.purpose] || ["📝", ""];
  const status = done ? `${num(w.check.score)}/${num(w.check.max_score)} · ${wsPct(w)}%` : files.length ? "⏳ Waiting for check" : "Not done";
  const note = done ? w.check.dadNote || w.check.overall_note : "";
  return h("li", { class: "sc-wsrow" },
    h("button", { class: "bd-file", data: { aiopen: "worksheet|" + w.id } }, h("span", { class: "e" }, emoji),
      h("span", { class: "what" }, w.title, h("small", null, [label, partOf(w, s), shortDate(w.date), madeByParent(w)].filter(Boolean).join(" · ")))),
    h("div", { class: "sc-wsstatus" }, h("span", { class: "ai-status " + (done ? "lv-" + pctLevel(wsPct(w)) : files.length ? "up" : "") }, status)),
    note ? h("p", { class: "sc-wsnote" }, note.length > 140 ? note.slice(0, 137) + "…" : note) : null,
    h("div", { class: "ai-btns sc-wsbtns" },
      h("button", { data: { aiopen: "worksheet|" + w.id } }, "📂 Open"),
      h("button", { data: { wsrow: "pdf|" + w.id } }, "📄 PDF"),   // (📄 worksheets are PDF only: never with the answers)
      canAct ? h("button", { data: { wsrow: "upload|" + w.id } }, "📸 Upload my answers") : null,
      canAct && files.length ? h("button", { class: "primary", data: { wsrow: "check|" + w.id, aiwait: "check|" + w.id } }, done ? "🤖 Check again" : "✅ Check now") : null,
      h("button", { data: { wsrow: "answers|" + w.id } }, answersOpen(w) ? "🔑 Show answers" : "🔒 Show answers")));
}
function wsRowAction(v) {
  const [act, id] = v.split("|"), w = aiDocs.worksheets[id];
  if (!w) return;
  if (act === "pdf") return worksheetPdf(w);                     // (never with the answers)
  if (act === "answers" && !answersOpen(w)) return answersLocked(id);   // 🔒 a kid before the check
  if (act === "answers") { openAiDoc("worksheet", id); wsAnswers = true; return render(); }
  if (act === "upload") {
    if (w.check && !isDadNow()) return toast(`It's checked already. Ask ${dadName()} 🙂`);
    aiPick = { ws: id };
    $("aiFile").value = "";
    return $("aiFile").click();
  }
  if (act === "check") return checkWorksheet(id);
}

// 🗂️ Older records of the subject (from before the tutor pages): school work cards, explanations, homework, marks, notes
function subjectOlderHtml(s, f, c, isDad) {
  const tasks = Object.entries(s.tasks).map(([id, t]) => ({ id, ...t })).filter(t => sameSubject(t.subject, f.name));
  const marks = marksOf(s, f.name).filter(g => !g.worksheet);   // (the worksheets' marks are in 📝 Worksheets already)
  const notes = Object.entries(s.notes).map(([id, n]) => ({ id, ...n }))
    .filter(n => sameSubject(n.subject, f.name)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const works = Object.values(s.work).filter(w => sameSubject(w.subject, f.name)).length, explains = exOf(schoolKid, f.name).length;
  const count = tasks.length + marks.length + notes.length + works + explains;
  const editing = ["task", "note", "grade", "check"].includes(schoolEdit), open = schoolOlder || editing;
  if (!count && !editing) return "";
  let html = `<button class="sc-older-btn" data-scolder aria-expanded="${open}">🗂️ Older school records (${count}) ${open ? "▾" : "▸"}</button>`;
  if (!open) return html;
  if (schoolEdit === "note") html += noteFormHtml(s);
  if (schoolEdit === "grade" && isDad) html += gradeFormHtml(s, f.name);
  if (schoolEdit === "task") html += taskFormHtml(s, f.name);
  return html + `<div class="sc-grid">
    ${works ? aiMount(() => workListNode(s, f.name, c)) : ""}
    ${explains ? aiMount(() => aiListCard("📖 Explanations", exListNode(exOf(schoolKid, f.name)), "")) : ""}
    ${tasks.length ? `<div class="card bd-card"><h2>📝 Homework & exams</h2>${tasksListHtml(s, tasks)}</div>` : ""}
    ${marks.length ? `<div class="card bd-card"><h2>📊 Marks</h2>${marksListHtml(marks)}</div>` : ""}
    ${notes.length ? `<div class="card bd-card"><h2>🗒️ Notes</h2>${notes.map(n => `<div class="sc-ss"><div class="sc-head" style="margin:0"><b>${shortDate(n.date)}</b>
        ${canChange(n) ? `<span>${itemBtns("note", n.id)}</span>` : ""}</div><p>${safe(n.text)}</p></div>`).join("")}</div>` : ""}
  </div>`;
}
const barHtml = (pct, c) => `<div class="bd-bar" role="img" aria-label="${pct}%"><i style="width:${Math.min(100, pct)}%;background:${c.color}"></i></div>`;

// ---------- Forms ----------
function linkFormHtml() {
  return `<div class="sc-form">
    ${scField("sclName", "Name", `<input type="text" id="sclName" maxlength="60" placeholder="Fractions worksheet">`)}
    ${scField("sclUrl", "Link (Google Drive …)", `<input type="text" id="sclUrl" maxlength="500" placeholder="https://drive.google.com/…" inputmode="url">`)}
    ${scButtons("link", false)}</div>`;
}
function noteFormHtml(s) {
  const n = schoolEditId ? s.notes[schoolEditId] || {} : {};
  return `<div class="sc-form"><label class="small" for="scnText">Note</label>
    <textarea id="scnText" rows="3" maxlength="1000" placeholder="Test on Thursday: chapters 3 and 4">${safe(n.text || "")}</textarea>
    ${scButtons("note", !!schoolEditId)}</div>`;
}
function gradeFormHtml(s, subject) {
  const g = schoolEditId ? s.grades[schoolEditId] || {} : {};
  return `<div class="sc-form">
    ${scField("scgSubject", "Subject", subjectPicker("scgSubject", s, g.subject || subject))}
    <div class="row"><div><label class="small" for="scgDate">Date</label><input type="date" id="scgDate" value="${g.date || todayYmd()}"></div>
      <div><label class="small" for="scgType">Type</label><select id="scgType">${GRADE_TYPES.map(t =>
        `<option value="${t}" ${(g.type || "quiz") === t ? "selected" : ""}>${GRADE_LABEL[t]}</option>`).join("")}</select></div></div>
    <div class="row"><div><label class="small" for="scgScore">Score</label><input type="number" id="scgScore" min="0" step="any" value="${g.score ?? ""}" placeholder="8"></div>
      <div><label class="small" for="scgMax">Out of</label><input type="number" id="scgMax" min="1" step="any" value="${g.max ?? 10}"></div></div>
    ${scButtons("grade", !!schoolEditId)}</div>`;
}
function taskFormHtml(s, subject) {
  const t = schoolEditId ? s.tasks[schoolEditId] || {} : {};
  return `<div class="sc-form">
    <div class="row"><div><label class="small" for="sctKind">Type</label><select id="sctKind">${TASK_KINDS.map(k =>
        `<option value="${k}" ${(t.kind || "homework") === k ? "selected" : ""}>${k === "exam" ? "📝 Exam" : "📚 Homework"}</option>`).join("")}</select></div>
      <div><label class="small" for="sctDue">Due day</label><input type="date" id="sctDue" value="${t.due || ""}"></div></div>
    ${scField("sctSubject", "Subject", subjectPicker("sctSubject", s, t.subject || subject))}
    ${scField("sctTitle", "What", `<input type="text" id="sctTitle" maxlength="80" value="${safe(t.title || "")}" placeholder="Fractions sheet p. 24">`)}
    ${scButtons("task", !!schoolEditId)}</div>`;
}

// ---------- 📝 Homework & exams ----------
function schoolHomeworkHtml(s) {
  const open = schoolEdit === "task" && !schoolEditId, only = viewSubject(s);   // (from a subject: only its homework)
  const all = Object.entries(s.tasks).map(([id, t]) => ({ id, ...t })).filter(t => !only || sameSubject(t.subject, only));
  return `<div class="bd-head"><h2>📝 Homework & exams${only ? ` · ${safe(only)}` : ""}</h2>${open ? "" : `<button class="edit" data-scedit="task">➕ Add</button>`}</div>
    ${open ? taskFormHtml(s, only || "") : ""}<div class="card bd-card">${tasksListHtml(s, all)}</div>
    <div style="height:18px"></div>${aiMount(() => aiListCard("📝 Worksheets", wsListNode(wsOf(schoolKid, only || undefined), true),
      "No worksheets yet. Use ⬆️ Upload today's work: a new topic gets a short level check."))}`;
}
// To do (soonest first), then the last ones done
function tasksListHtml(s, all) {
  const todo = all.filter(t => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const done = all.filter(t => t.done).sort((a, b) => b.due.localeCompare(a.due)).slice(0, 8);
  if (!all.length) return `<p class="sc-empty">Nothing yet. 🎉</p>`;
  return (todo.length ? `<ul class="list">${todo.map(t => taskRowHtml(s, t)).join("")}</ul>` : `<p class="sc-empty">All done! 🎉</p>`)
    + (done.length ? `<h3 class="sc-h3">✓ Done</h3><ul class="list">${done.map(t => taskRowHtml(s, t)).join("")}</ul>` : "");
}
// Where the homework is: To do → Answers uploaded → Checked ✓
const taskStatus = t => t.checked ? "checked" : t.answer ? "answers" : "todo";
const STATUS_LABEL = { todo: "To do", answers: "📎 Answers uploaded", checked: "Checked ✓" };
function taskRowHtml(s, t) {
  const isDad = isDadNow(), canTick = isDad || me === schoolKid, st = taskStatus(t), n = daysUntil(t.due);
  const when = t.done ? "" : n < 0 ? `<span class="sc-tag late">Late</span>` : n === 0 ? `<span class="sc-tag soon">Today!</span>`
    : n === 1 ? `<span class="sc-tag soon">Tomorrow</span>` : `in ${n} days`;
  const answerFile = t.answer && s.files[t.answer];
  const btns = [
    `<button class="linkbtn" data-scprompt="worksheet|${safe(t.id)}">🤖 Make worksheet</button>`,
    answerFile ? `<button class="linkbtn" data-scfile="${safe(t.answer)}">📎 My answers</button>`
      : canTick ? `<button class="linkbtn" data-scupload="${safe(t.subject)}|${safe(t.id)}">⬆ Upload my answers</button>` : "",
    isDad && answerFile && !t.checked ? `<button class="linkbtn" data-scprompt="check|${safe(t.id)}">🤖 Check answers</button>` : "",
    isDad && !t.checked ? `<button class="linkbtn" data-scedit="check|${safe(t.id)}">✅ Mark as checked</button>` : ""
  ].join("");
  const checking = isDad && schoolEdit === "check" && schoolEditId === t.id;
  return `<li class="bd-task ${t.done ? "sc-done" : ""}"><input type="checkbox" class="sc-tick" data-sctick="${safe(t.id)}" ${t.done ? "checked" : ""}
      ${canTick ? "" : "disabled"} aria-label="Done: ${safe(t.subject)} ${safe(t.title)}">
    <div class="what"><span class="sc-tag ${t.kind === "exam" ? "exam" : ""}">${t.kind === "exam" ? "📝 Exam" : "📚 Homework"}</span>${safe(subjectEmoji(s, t.subject))} ${safe(t.subject)}${t.title ? " – " + safe(t.title) : ""}
      <small>${t.kind === "exam" ? "On" : "Due"} ${shortDate(t.due)} ${when} · <span class="bd-status ${st}">${STATUS_LABEL[st]}</span>${t.checked
        ? ` <b>${num(t.checked.score)}/${num(t.checked.max)}</b>${t.checked.note ? ` · “${safe(t.checked.note)}”` : ""}` : ""}</small>
      <span class="bd-task-btns">${btns}</span>
      ${checking ? `<div class="sc-form">
        <div class="row"><div><label class="small" for="sckScore">Score</label><input type="number" id="sckScore" min="0" step="any" placeholder="8"></div>
          <div><label class="small" for="sckMax">Out of</label><input type="number" id="sckMax" min="1" step="any" value="10"></div></div>
        ${scField("sckNote", "Note", `<input type="text" id="sckNote" maxlength="200" placeholder="Great work! Check question 7 again.">`)}
        ${scButtons("check", true)}</div>` : ""}</div>
    ${canChange(t) ? itemBtns("task", t.id) : ""}</li>`;
}

// ---------- 📊 Marks ----------
// (opened from a subject's 📊 Marks: only that subject's marks)
const viewSubject = s => schoolSubject && s.subjects[schoolSubject] ? s.subjects[schoolSubject].name : null;
function schoolMarksHtml(s, isDad) {
  const only = viewSubject(s), all = marksOf(s, only), open = isDad && schoolEdit === "grade";
  const subjects = subjectsOf(s).filter(name => !only || sameSubject(name, only)).map(name => ({ name, list: marksOf(s, name) })).filter(x => x.list.length);
  let html = `<div class="bd-head"><h2>📊 Marks</h2>${isDad && !open ? `<button class="edit" data-scedit="grade">➕ Add mark</button>` : ""}</div>`;
  if (open) html += gradeFormHtml(s, only || "");
  if (!all.length) return html + `<div class="card"><p class="sc-empty">No marks yet.</p></div>`;
  html += `<div class="card bd-card"><h2>Average per subject</h2>${subjects.map(x => {
    const avg = avgOf(x.list), last = x.list[x.list.length - 1], prev = x.list.length > 1 ? pctOf(x.list[x.list.length - 2]) : null;
    const c = subjectColors(folderOf(s, x.name));
    return `<div class="bd-avgrow"><div class="bd-avgtop"><b>${safe(subjectEmoji(s, x.name))} ${safe(x.name)}</b>
      <span><b class="bd-avg">${avg}%</b> ${arrowHtml(pctOf(last), prev)} <small>${x.list.length} ${x.list.length === 1 ? "mark" : "marks"}</small></span></div>${barHtml(avg, c)}</div>`;
  }).join("")}</div>`;
  return html + `<div class="card bd-card" style="margin-top:18px"><h2>Latest marks</h2>${marksListHtml(all.slice(-12))}</div>`;
}
// Newest first, each with ▲▼ compared with the same subject's mark before
function marksListHtml(marks) {
  const before = {}, last = {};
  marks.forEach(g => { const k = g.subject.toLowerCase(); before[g.id] = last[k] ? pctOf(last[k]) : null; last[k] = g; });
  return `<ul class="list">${[...marks].reverse().map(m => `<li><div class="what">${safe(m.subject)} <span class="sc-score">${num(m.score)}/${num(m.max)}</span>
      ${arrowHtml(pctOf(m), before[m.id])}<small>${GRADE_LABEL[m.type]} · ${shortDate(m.date)} · ${pctOf(m)}%</small></div>
      ${isDadNow() ? itemBtns("grade", m.id) : ""}</li>`).join("")}</ul>`;
}

// ---------- ⭐ Reviews ----------
function schoolReviewsHtml(s, isDad, u) {
  const week = mondayOf(new Date()), r = s.reviews[week];
  const past = Object.entries(s.reviews).filter(([w]) => w !== week).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 20);
  const open = isDad && schoolEdit === "review";
  const acts = activityPointsByUser()[u.id] || 0, habits = habitPoints(u.id, data.points.week, weekEnd()), hw = homeworkPoints(u.id, data.points.week, weekEnd());
  const review = (w, x) => `<div class="sc-review"><div class="sc-head" style="margin:0"><b>Week of ${shortDate(w)}</b>
      ${isDad ? `<span>${itemBtns("review", w)}</span>` : ""}</div>
      <div class="sc-rates">${REVIEW_PARTS.map(([k, label]) => `<span>${label} ${starsHtml(x[k])}</span>`).join("")}</div>
      ${x.note ? `<p>${safe(x.note)}</p>` : ""}</div>`;
  let html = `<div class="sc-grid"><div class="card bd-card"><div class="sc-head"><h2>⭐ This week</h2>${isDad && !open ? `<button class="edit" data-scedit="review">${r ? "✏️ Change" : "➕ Add"}</button>` : ""}</div>`;
  if (open) {
    const x = schoolEditId ? s.reviews[schoolEditId] || {} : r || {};
    html += `<div class="sc-form">
      ${scField("scrWeek", "Week (any day of it)", `<input type="date" id="scrWeek" value="${schoolEditId || week}">`)}
      ${REVIEW_PARTS.map(([k, label]) => `<div class="sc-starpick"><span>${label}</span>${[1, 2, 3, 4, 5].map(n =>
        `<button type="button" data-scstar="${n}" aria-label="${n} ${n === 1 ? "star" : "stars"}">★</button>`).join("")}
        <input type="hidden" id="scr-${k}" value="${x[k] || 0}"></div>`).join("")}
      <label class="small" for="scrNote">Note</label>
      <textarea id="scrNote" rows="3" maxlength="600" placeholder="Great week! Keep reading every day.">${safe(x.note || "")}</textarea>
      ${scButtons("review", true)}</div>`;
  }
  html += r ? review(week, r) : `<p class="sc-empty">No review for this week yet.</p>`;
  html += `</div><div class="card bd-card"><h2>🏆 Points this week</h2>
    <div class="bd-points"><div><b>${acts}</b><small>📅 Activities</small></div><div><b>${habits}</b><small>⭐ Habits</small></div>
      <div><b>${hw}</b><small>📝 Homework</small></div><div class="total"><b>${acts + habits + hw}</b><small>Total</small></div></div></div></div>`;
  return html + `<div class="card bd-card" style="margin-top:18px"><h2>Past weeks</h2>${past.length ? past.map(([w, x]) => review(w, x)).join("") : `<p class="sc-empty">No past reviews yet.</p>`}</div>`;
}

// ---------- 🏫 School info + timetable (Mon–Fri, up to 7 lessons) ----------
const LESSONS = 7;
function schoolInfoHtml(s, isDad) {
  const i = s.info, today = todayIndex(), open = isDad && schoolEdit === "info";
  // (🏫 the school and 🎓 the year are in 👤 the profile: only the class / section, teacher and timetable are typed here)
  const rows = [["🏫 School", schoolNameOf(schoolKid)], ["🎓 Class", i.grade], ["👩‍🏫 Teacher", i.teachers]].filter(r => r[1]);
  const most = Math.max(0, ...[0, 1, 2, 3, 4].map(d => (i.timetable[d] || []).length));
  let html = `<div class="bd-head"><h2>🏫 School info</h2>${isDad && !open ? `<button class="edit" data-scedit="info">✏️ Edit</button>` : ""}</div>`;
  if (open) html += `<div class="sc-form">
      <div class="row"><div><label class="small" for="scGrade">Class / section</label><input type="text" id="scGrade" maxlength="30" value="${safe(i.grade)}" placeholder="6B"></div>
        <div><label class="small" for="scTeachers">Teacher</label><input type="text" id="scTeachers" maxlength="300" value="${safe(i.teachers)}" placeholder="Ms. Sara"></div></div>
      <label class="small">Timetable (Mon–Fri, up to ${LESSONS} lessons)</label>
      <div class="bd-tt-edit"><span></span>${SHORT.slice(0, 5).map(d => `<b>${d}</b>`).join("")}
        ${Array.from({ length: LESSONS }, (_, n) => `<span class="n">${n + 1}</span>${[0, 1, 2, 3, 4].map(d =>
          `<input type="text" id="scTT${d}_${n}" list="scSubjects" maxlength="30" aria-label="${DAYS[d]}, lesson ${n + 1}" value="${safe((i.timetable[d] || [])[n] || "")}">`).join("")}`).join("")}</div>
      <div style="height:10px"></div>${scButtons("info", true)}</div>`;
  html += `<div class="card bd-card">${rows.length ? `<div class="sc-info">${rows.map(([l, v]) => `<span>${l}</span><b>${safe(v)}</b>`).join("")}</div>`
    : `<p class="sc-empty">No school info yet.${isDad ? " Tap ✏️ Edit." : ""}</p>`}
    <h3 class="sc-h3">📅 Timetable</h3>${most ? `<div class="bd-tt-scroll"><table class="bd-tt"><thead><tr><th></th>${SHORT.slice(0, 5).map((d, n) =>
      `<th class="${n === today ? "today" : ""}">${d}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: most }, (_, n) => `<tr><th>${n + 1}</th>${[0, 1, 2, 3, 4].map(d => {
        const x = (i.timetable[d] || [])[n] || "", c = x && folderOf(s, x) ? subjectColors(folderOf(s, x)) : null;
        return `<td class="${d === today ? "today" : ""}">${x ? `<span class="bd-lesson" ${c ? `style="--soft:${c.soft};--ink:${c.ink}"` : ""}>${safe(subjectEmoji(s, x))} ${safe(x)}</span>` : ""}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="sc-empty">No timetable yet.</p>`}</div>`;
  return html;
}

// ---------- 📄 Reports ----------
function schoolReportsHtml(s, isDad, u) {
  return `<div class="bd-head"><h2>📄 Reports</h2></div>
    <div class="card bd-card"><p class="hint">A neat one-page school report for ${safe(u.name)}: the average per subject, homework done,
      this week's stars and note, and the points.</p>
      <div class="btnrow"><button class="primary" data-screport="make">📄 Make report</button>
        ${schoolReport ? `<button data-screport="pdf">⬇ Download as PDF</button><button data-screport="share">📤 Share</button>` : ""}</div></div>
    ${schoolReport ? `<div class="bd-report-preview">${reportInner(u.id)}</div>` : ""}`;
}
// The report itself (the same on screen and on paper)
function reportInner(kid) {
  const s = schoolOf(kid), u = userById(kid), week = mondayOf(new Date());
  const r = s.reviews[week] || Object.entries(s.reviews).sort((a, b) => b[0].localeCompare(a[0])).map(x => x[1])[0];
  const rWeek = s.reviews[week] ? week : Object.keys(s.reviews).sort().reverse()[0];
  const subjects = subjectsOf(s).map(name => ({ name, list: marksOf(s, name) })).filter(x => x.list.length);
  const tasks = Object.values(s.tasks), doneWeek = tasks.filter(t => t.done && t.doneAt && t.doneAt >= data.points.week && t.doneAt < weekEnd()).length;
  const acts = activityPointsByUser()[kid] || 0, habits = habitPoints(kid, data.points.week, weekEnd()), hw = homeworkPoints(kid, data.points.week, weekEnd());
  const info = [s.info.name, s.info.grade, s.info.teachers && "Teacher: " + s.info.teachers].filter(Boolean).join(" · ");
  return `<div class="bd-report">
    <div class="rp-top"><div><div class="rp-title">🎒 School report: ${safe(u.emoji)} ${safe(u.name)}</div>
      <div class="rp-sub">${safe(weekLabel(data.points.week))}${info ? " · " + safe(info) : ""}</div></div><div class="rp-date">Made ${shortDate(todayYmd())}</div></div>
    <div class="rp-grid">
      <div class="rp-box"><h3>📊 Average per subject</h3>${subjects.length ? `<table class="rp-table">${subjects.map(x => {
        const avg = avgOf(x.list), c = subjectColors(folderOf(s, x.name));
        return `<tr><td>${safe(subjectEmoji(s, x.name))} ${safe(x.name)}</td><td class="rp-bar"><i style="width:${avg}%;background:${c.color}"></i></td><td class="rp-pct">${avg}%</td>
          <td class="rp-n">${x.list.length} ${x.list.length === 1 ? "mark" : "marks"}</td></tr>`;
      }).join("")}</table>` : `<p>No marks yet.</p>`}</div>
      <div class="rp-box"><h3>📝 Homework</h3><p><b>${doneWeek}</b> done this week · <b>${tasks.filter(t => t.done).length}</b> done in all · <b>${tasks.filter(t => !t.done).length}</b> to do</p>
        <h3>🏆 Points this week</h3><p>📅 Activities <b>${acts}</b> · ⭐ Habits <b>${habits}</b> · 📝 Homework <b>${hw}</b> · <b>Total ${acts + habits + hw}</b></p></div>
      <div class="rp-box rp-wide"><h3>⭐ ${rWeek ? `Week of ${shortDate(rWeek)}` : "This week"}</h3>${r ? `<p class="rp-stars">${REVIEW_PARTS.map(([k, label]) =>
        `<span>${label} ${starsHtml(r[k])}</span>`).join("")}</p>${r.note ? `<p class="rp-note">“${safe(r.note)}”</p>` : ""}` : `<p>No review yet.</p>`}</div>
    </div>
    <div class="rp-foot">Parent signature:<span class="line"></span></div></div>`;
}
function reportText(kid) {
  const s = schoolOf(kid), u = userById(kid), r = s.reviews[mondayOf(new Date())];
  const lines = [`🎒 School report: ${u.name} (${weekLabel(data.points.week)})`];
  subjectsOf(s).forEach(name => { const list = marksOf(s, name); if (list.length) lines.push(`${subjectEmoji(s, name)} ${name}: ${avgOf(list)}% (${list.length} marks)`); });
  lines.push(`📝 Homework to do: ${todoOf(s).length}`);
  if (r) lines.push(REVIEW_PARTS.map(([k, label]) => `${label} ${"★".repeat(r[k])}`).join(" · ") + (r.note ? `\n“${r.note}”` : ""));
  lines.push(`🏆 Points this week: ${pointsByUser()[kid] || 0}`);
  return lines.join("\n");
}
function reportAction(what) {
  const kid = schoolKid;
  if (what === "make") { schoolReport = true; return render(); }
  if (what === "pdf") {   // the app's usual way: the print screen (choose "Save as PDF" there)
    buildPages([`<section class="p-page bd-report-page">${reportInner(kid)}</section>`]);
    return window.print();
  }
  if (what === "share") {
    const text = reportText(kid);
    if (navigator.share) return navigator.share({ title: `School report: ${userById(kid).name}`, text }).catch(() => {});
    copyText(text).then(ok => toast(ok ? "📋 The report is copied. Paste it in a message." : "Couldn't share on this device.", 3500));
  }
}

// ---------- 🤖 Ready prompts for the Claude app ----------
function gradeText(s) { const g = s.info.grade.trim(); return g ? (/^\d/.test(g) ? "Grade " + g : g) : ""; }
function promptFor(kind, t, s) {
  const g = gradeText(s), what = `${t.subject}${t.title ? " – " + t.title : ""}`;
  return kind === "check"
    ? `Check this ${g ? g + " " : ""}${t.subject} worksheet answer photo. Give a score out of 10 and one short kind note.`
    : `Make a printable worksheet for a ${g ? g + " " : ""}student about: ${what}. 10 questions, easy to hard, with space to answer, and an answer key on a separate last page.`;
}
// Copies text; true when it worked
async function copyText(text) {
  // (some browsers never answer: then give up after 1.5 seconds and try the older way)
  try {
    await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 1500))]);
    return true;
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) { return false; }
}
let promptTask = null;   // the homework of the open prompt box (for "📎 Open the answers")
async function showPrompt(kind, taskId) {
  const s = schoolOf(schoolKid), t = s.tasks[taskId];
  if (!t) return;
  const text = promptFor(kind, t, s), ok = await copyText(text);
  promptTask = kind === "check" ? taskId : null;
  $("pmTitle").textContent = ok ? "🤖 Copied!" : "🤖 Your prompt";
  $("pmHint").textContent = ok
    ? (kind === "check" ? "Copied! Paste it in the Claude app with the answer photo." : "Copied! Paste it in the Claude app, then print the sheet.")
    : "Copy the text below, paste it in the Claude app" + (kind === "check" ? " with the answer photo." : ", then print the sheet.");
  $("pmText").value = text;
  $("pmAnswers").hidden = kind !== "check" || !t.answer;
  $("promptModal").hidden = false;
  $("pmOpen").focus();
}
function closePrompt() { $("promptModal").hidden = true; }
$("promptModal").addEventListener("click", e => {
  if (e.target === $("promptModal")) return closePrompt();
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "pmOpen") { window.open("https://claude.ai/new", "_blank", "noopener"); return; }
  if (b.id === "pmOk") return closePrompt();
  if (b.id === "pmAnswers") { closePrompt(); const t = schoolOf(schoolKid).tasks[promptTask]; if (t && t.answer) openFile(t.answer); }
});

// ---------- The stars in the review form ----------
function showStars(pick) {
  const v = Number(pick.querySelector("input").value) || 0;
  pick.querySelectorAll("[data-scstar]").forEach(b => { const on = Number(b.dataset.scstar) <= v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}

// ---------- Opening, saving and deleting ----------
function openSchoolForm(what, id) {
  const s = schoolOf(schoolKid);
  const dadOnly = ["grade", "subject", "info", "review", "check"];
  if (dadOnly.includes(what) && !isDadNow()) return;
  if ((what === "task" || what === "note") && id && !canChange((what === "task" ? s.tasks : s.notes)[id])) return;
  if (what === "review" && !id && s.reviews[mondayOf(new Date())]) id = mondayOf(new Date());   // this week already has one: change it
  schoolEdit = what; schoolEditId = id || null; schoolFresh = true;
  render();
  const first = $("schoolBody").querySelector(".sc-form input:not([type=hidden]):not([type=radio]), .sc-form select, .sc-form textarea");
  if (first) { first.focus(); first.closest(".sc-form").scrollIntoView({ block: "nearest", behavior: "smooth" }); }
}
function closeSchoolForm() { schoolEdit = schoolEditId = null; schoolFresh = true; render(); }
const scErr = msg => { $("scErr").textContent = msg; };
// Renames a subject everywhere (homework, marks, files, notes, timetable)
function renameSubject(s, from, to) {
  [s.grades, s.tasks, s.files, s.notes, s.work].forEach(list => Object.values(list).forEach(x => { if (sameSubject(x.subject, from)) x.subject = to; }));
  Object.values(s.info.timetable).forEach(day => day.forEach((x, n) => { if (sameSubject(x, from)) day[n] = to; }));
}

function saveSchoolForm(what) {
  if (!schoolKid || !exists(me)) return;
  const isDad = isDadNow(), s = schoolFor(schoolKid), v = id => $(id).value.trim();
  const folder = schoolView === "subject" ? s.subjects[schoolSubject] : null;
  if (what === "info" && isDad) {
    const timetable = { ...s.info.timetable };   // (Saturday / Sunday from older data stay as they are)
    for (let d = 0; d < 5; d++) {
      const lessons = Array.from({ length: LESSONS }, (_, n) => v(`scTT${d}_${n}`).slice(0, 30));
      while (lessons.length && !lessons[lessons.length - 1]) lessons.pop();
      if (lessons.some(Boolean)) timetable[d] = lessons.map(x => x || "—"); else delete timetable[d];
    }
    s.info = { name: s.info.name, grade: v("scGrade").slice(0, 30), teachers: v("scTeachers").slice(0, 300), timetable };
  } else if (what === "subject" && isDad) {
    const name = v("scsName").slice(0, 30), emoji = v("scsEmoji").slice(0, 8) || "📘";
    const color = (document.querySelector('input[name="scsColor"]:checked') || {}).value || "blue";
    if (!name) return scErr("Please type the subject.");
    if (subjectList(s, true).some(x => x.id !== schoolEditId && sameSubject(x.name, name))) return scErr("There's already a folder with that name.");
    let fid = schoolEditId;
    if (schoolEditId && s.subjects[schoolEditId]) {
      const old = s.subjects[schoolEditId];
      if (!sameSubject(old.name, name) || old.name !== name) { renameSubject(s, old.name, name); aiRenameSubject(schoolKid, old.name, name); }
      Object.assign(old, { name, emoji, color });
    } else { fid = "s" + newId(); s.subjects[fid] = { name, emoji, color, order: subjectList(s, true).length }; }
    // ⭐ its level (🧪 "Not sure": a placement test, made after saving)
    const lv = (document.querySelector('input[name="scsLevel"]:checked') || {}).value;
    if (lv && setSubjectLevel(schoolKid, fid, lv)) { const kid = schoolKid; setTimeout(() => makePlacementTests(kid, [fid]), 0); }
  } else if (what === "grade" && isDad) {
    const subject = v("scgSubject"), date = v("scgDate"), score = Number(v("scgScore")), max = Number(v("scgMax"));
    if (!subject) return scErr("Please type the subject.");
    if (!isYmd(date)) return scErr("Please pick the date.");
    if (v("scgScore") === "" || !Number.isFinite(score) || score < 0) return scErr("Please type the score.");
    if (!(max > 0)) return scErr("“Out of” must be more than 0.");
    if (score > max) return scErr("The score can't be more than “Out of”.");
    const old = schoolEditId && s.grades[schoolEditId];
    s.grades[schoolEditId || newId()] = { subject: subject.slice(0, 30), date, type: $("scgType").value, score, max, ...(old && old.task ? { task: old.task } : {}),
                                          ...(old && old.worksheet ? { worksheet: old.worksheet } : {}) };
  } else if (what === "task") {
    const subject = v("sctSubject"), due = v("sctDue"), old = schoolEditId && s.tasks[schoolEditId];
    if (old && !canChange(old)) return;
    if (!subject) return scErr("Please type the subject.");
    if (!v("sctTitle")) return scErr("What is the homework? (e.g. Fractions sheet p. 24)");
    if (!isYmd(due)) return scErr("Please pick the due day.");
    s.tasks[schoolEditId || newId()] = { ...(old || { done: false, by: me }), kind: $("sctKind").value, subject: subject.slice(0, 30), title: v("sctTitle").slice(0, 80), due };
  } else if (what === "note") {
    const text = v("scnText"), old = schoolEditId && s.notes[schoolEditId];
    if (old && !canChange(old)) return;
    if (!text) return scErr("Please type the note.");
    s.notes[schoolEditId || newId()] = { ...(old || { date: todayYmd(), by: me }), subject: old ? old.subject : folder ? folder.name : "", text: text.slice(0, 1000) };
  } else if (what === "link") {
    const name = v("sclName"), url = v("sclUrl");
    if (!/^https?:\/\/\S+$/i.test(url)) return scErr("Please paste the whole link, starting with https://");
    s.files[newId()] = { subject: folder ? folder.name : "", name: (name || url.replace(/^https?:\/\//i, "")).slice(0, 60), kind: "link", url: url.slice(0, 500), size: 0, date: todayYmd(), by: me };
  } else if (what === "check" && isDad) {
    const t = s.tasks[schoolEditId], score = Number(v("sckScore")), max = Number(v("sckMax"));
    if (!t) return;
    if (v("sckScore") === "" || !Number.isFinite(score) || score < 0) return scErr("Please type the score.");
    if (!(max > 0)) return scErr("“Out of” must be more than 0.");
    if (score > max) return scErr("The score can't be more than “Out of”.");
    t.checked = { score, max, note: v("sckNote").slice(0, 200), at: todayYmd() };
    s.grades["c" + schoolEditId] = { subject: t.subject, date: todayYmd(), type: "homework", score, max, task: schoolEditId };   // also a mark
  } else if (what === "review" && isDad) {
    const day = v("scrWeek");
    if (!isYmd(day)) return scErr("Please pick the week.");
    const rates = Object.fromEntries(REVIEW_PARTS.map(([k]) => [k, Number($("scr-" + k).value) || 0]));
    if (REVIEW_PARTS.some(([k]) => !rates[k])) return scErr("Please give stars for Effort, Behaviour and Focus.");
    const week = mondayOf(fromYmd(day));
    if (schoolEditId && schoolEditId !== week) delete s.reviews[schoolEditId];   // moved to another week
    s.reviews[week] = { note: v("scrNote").slice(0, 600), ...rates };
  } else return;
  schoolEdit = schoolEditId = null; schoolFresh = true;
  writeData();
  render();
  toast(what === "check" ? "✅ Checked, and saved as a mark" : "✓ Saved");
}

function deleteSchoolItem(what, id) {
  if (!schoolKid || isKidDevice()) return;   // (🧒 a kid's device never deletes)
  const s = schoolFor(schoolKid);
  const part = { grade: "grades", task: "tasks", review: "reviews", seesaw: "seesaw", note: "notes", subject: "subjects", file: "files", work: "work", event: "events" }[what];
  const item = part && s[part][id];
  if (!item) return;
  const dadOnly = ["grade", "review", "seesaw", "subject", "event"];
  if (dadOnly.includes(what) ? !isDadNow() : !canChange(item)) return toast(`Ask ${dadName()} 🙂`);
  const label = what === "task" ? (item.kind === "exam" ? "exam" : "homework") : what === "seesaw" ? "Seesaw note"
    : what === "subject" ? `subject folder “${item.name}”` : what === "file" ? `file “${item.name}”` : what === "grade" ? "mark"
    : what === "work" ? `school work “${item.title}”` : what === "event" ? `school date “${item.title}”` : what;
  const extra = what === "subject" ? "\n\nIts homework, marks, files and notes are kept." : what === "work" ? "\n\nIts files, worksheets and explanations are kept." : "";
  if (!confirm(`Delete this ${label}?${extra}`)) return;
  if (what === "seesaw" && item.photo) deletePhoto(id);
  if (what === "file") {
    if (item.kind !== "link") deleteFileData(id);
    Object.values(s.tasks).forEach(t => { if (t.answer === id) delete t.answer; });   // answers deleted: back to "To do"
    Object.values(s.work).forEach(w => { w.files = w.files.filter(f => f !== id); });   // 📥 no longer on its school work card
  }
  if (what === "work") Object.values(s.files).forEach(f => { if (f.work === id) delete f.work; });   // its files stay in the folder
  if (what === "task") Object.entries(s.files).forEach(([fid, f]) => { if (f.task === id) delete f.task; });   // its answers stay as a file
  delete s[part][id];
  if (schoolEditId === id) schoolEdit = schoolEditId = null;
  if (what === "subject") { schoolView = "home"; schoolSubject = null; }
  schoolFresh = true;
  writeData();
  render();
}

// Homework done ✓ (the kid on their own binder, or Bro2a): +10 points this week
function tickSchoolTask(id, box) {
  const s = data.school[schoolKid];
  if (!s || !s.tasks[id] || (!isParentId(me) && me !== schoolKid)) { box.checked = !box.checked; return; }
  if (newWeek()) keepNow();
  const t = s.tasks[id];
  t.done = box.checked;
  if (t.done) t.doneAt = todayYmd(); else delete t.doneAt;
  noteWhen(todayYmd(), "task", id, schoolKid, t.done);   // (👀 when it was done)
  writeData();
  render();
  if (box.checked) {
    const r = box.getBoundingClientRect(), color = colorsOf(userById(schoolKid)).color;
    celebrate(r.left + r.width / 2, r.top + r.height / 2, color, false);
    toast(`${me === schoolKid ? "🎉 Well done!" : "✓ Done"} +${POINTS_EACH} ⭐`, 2200, color);
  }
}

// ---------- ⬆ Uploading files (a subject's file, or the answers to a homework) ----------
function startUpload(target) {
  const [subject, task] = target.split("|");
  if (task) { const t = schoolOf(schoolKid).tasks[task]; if (!t || !(isDadNow() || me === schoolKid)) return; }
  schoolUpload = { subject, task: task || null };
  $("scUpFile").value = "";
  $("scUpFile").click();
}
$("scUpFile").addEventListener("change", async e => {
  const file = e.target.files[0], target = schoolUpload, kid = schoolKid;
  schoolUpload = null;
  if (!file || !target || !kid) return;
  toast("⬆ Getting the file ready…", 2500);
  let ready;
  try { ready = await readSchoolFile(file); }
  catch (err) {
    return toast(err.message === "big" ? "Too big. Add a 🔗 link instead (Google Drive)."
      : err.message === "type" ? TYPE_TEXT : "Couldn't read that file. Please try another one.", 5000);
  }
  const s = schoolFor(kid), id = newId();
  s.files[id] = { subject: target.subject, name: ready.name, kind: ready.kind, size: ready.size, date: todayYmd(), by: me, ...(target.task ? { task: target.task } : {}) };
  if (target.task && s.tasks[target.task]) s.tasks[target.task].answer = id;   // Answers uploaded
  storeFileData(id, kid, ready.url);
  writeData();
  render();
  toast(target.task ? "📎 Your answers are uploaded!" : "✓ File saved", 3000);
});

$("scr-school").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const ds = b.dataset;
  if (ds.sckid) { if (kidLockedOut(ds.sckid)) return lockedToast(ds.sckid); schoolKid = ds.sckid; return goSchool("home"); }
  if (ds.scgo) { const [view, id, tab] = ds.scgo.split("|"); if (view === "allws") awFilter = "all"; return goSchool(view, id, tab); }
  if (ds.awfilter) { awFilter = ds.awfilter; schoolFresh = true; return render(); }   // 📝 All my worksheets: All · a subject · ⏳ Not checked
  if (ds.sctab) { schoolTab = schoolTab === ds.sctab ? "" : ds.sctab; scMakeOpen = false; schoolOlder = false; schoolEdit = schoolEditId = null; schoolFresh = true; return render(); }
  // 👨‍👩‍👧 ⚙️ For parents · ✏️ Edit subjects (↑ ↓ · ✏️ rename · 🙈 hide · 🗑️ delete, or hide when it has work) · ➕ a suggested subject
  if ("scparents" in ds) { scParents = !scParents; schoolFresh = true; return render(); }
  if ("scsubedit" in ds) { scSubEdit = !scSubEdit; schoolEdit = schoolEditId = null; schoolFresh = true; return render(); }
  if (ds.scsubmove) { const [id, step] = ds.scsubmove.split("|"); return moveSubject(id, Number(step)); }
  if (ds.scsubhide) return hideSubject(ds.scsubhide);
  if (ds.scsubdel) return deleteSubject(ds.scsubdel);
  if (ds.scsugg) { const [e, n] = ds.scsugg.split("|"); if ($("scsEmoji")) $("scsEmoji").value = e; if ($("scsName")) { $("scsName").value = n; $("scsName").focus(); } return; }
  // 👨‍👩‍👧 A parent's phone: the kids upload their files and answers; parents may ✏️ make worksheets and 🤖 explain for a kid
  const KID_ONLY = ["scupload", "aiadd"];
  if (isParentPhone() && (KID_ONLY.some(k => k in ds) || (ds.wsrow || "").startsWith("upload|"))) return toast(`🙂 ${userById(schoolKid) ? userById(schoolKid).name : "The kids"} does this on their own phone.`, 3000);
  // 📌 Topic chips: the small sheet · ✏️ make a worksheet · 🤖 explain
  if ("scmake" in ds) { scMakeOpen = !scMakeOpen; return render(); }
  if (ds.sctopic) return openTopicSheet(ds.sctopic);
  if (ds.sctopicws) { const f = s0Subject(), t = scTopics[Number(ds.sctopicws)]; return t && f && topicWorksheet({ kid: schoolKid, subject: f.name, ...t }); }
  if (ds.sctopicex) { const f = s0Subject(), t = scTopics[Number(ds.sctopicex)]; return t && f && topicExplain({ kid: schoolKid, subject: f.name, ...t }); }
  if ("scolder" in ds) { schoolOlder = !schoolOlder; schoolEdit = schoolEditId = null; schoolFresh = true; return render(); }
  if (ds.scedit) { const [what, id] = ds.scedit.split("|"); return openSchoolForm(what, id); }
  if (ds.scsave) return saveSchoolForm(ds.scsave);
  if ("sccancel" in ds) return closeSchoolForm();
  if (ds.scdel) { const [what, id] = ds.scdel.split("|"); return what === "subject" ? deleteSubject(id) : deleteSchoolItem(what, id); }   // (a subject with work: hidden instead)
  if (ds.scfile) return openFile(ds.scfile);
  if (ds.scupload !== undefined) return startUpload(ds.scupload);
  if (ds.scprompt) { const [kind, id] = ds.scprompt.split("|"); return showPrompt(kind, id); }
  // 🤖 AI help
  if (ds.aiadd !== undefined) return openUpload(ds.aiadd);   // (⬆️ Upload: see STUDY TOPICS)
  if (ds.aiws) return wsFromWork(ds.aiws);
  if (ds.aiex) return exFromWork(ds.aiex);
  if (ds.aiopen) { const [view, id] = ds.aiopen.split("|"); return openAiDoc(view, id); }
  if (ds.wsact) return wsAction(ds.wsact);
  if (ds.wsrow) return wsRowAction(ds.wsrow);
  if (ds.askbasic) return saveBasic(ds.askbasic, false);   // ❓ one missing 🏫 📚 🎓 basic
  if (ds.askbasicskip) return saveBasic(ds.askbasicskip, true);
  // 👤 Profile / 🏫 School info: the kid's 👤 profile (School info: its ⚙️ settings, where school, year and subjects are)
  if (ds.scprof) { const [kid, part] = ds.scprof.split("|"); openProfile(kid); if (part === "info" && canEditProfile(kid)) { meEdit = true; render(); } return; }
  if ("profsave" in ds) return saveProfile(false);
  if ("profskip" in ds) return saveProfile(true);
  if ("sylpick" in ds) { aiPick = "syllabus"; $("aiFile").value = ""; return $("aiFile").click(); }
  if ("syldel" in ds) return removeSyllabus();
  if ("briefmake" in ds) return makeBrief(schoolKid, false);
  if ("briefprint" in ds) { const s = schoolOf(schoolKid); return s.brief && printAi(briefNode(schoolKid, s.brief)); }
  if ("briefpdf" in ds) return briefPdf(schoolKid);
  if (Object.keys(ds).some(k => MAKE_KEYS.includes(k))) return makeTap(ds);   // ✏️ Make a worksheet
  if ("nlopen" in ds) return openNewsletter();
  if (ds.reqdo) return doRequest(ds.reqdo);
  if (ds.wspractice) return makePractice(ds.wspractice);
  if (ds.levelretry) return makeLevelCheck(schoolKid, ds.levelretry);
  if ("levelclose" in ds) { schoolLevel = null; return render(); }
  if (ds.exact) return exAction(ds.exact);
  if (ds.wsfdel) return removeAnswerFile(ds.wsfdel);
  if (ds.screport) return reportAction(ds.screport);
  if (ds.scstar) {
    const pick = b.closest(".sc-starpick");
    pick.querySelector("input").value = ds.scstar;
    return showStars(pick);
  }
});
$("scr-school").addEventListener("change", e => {
  if (e.target.dataset.sctick) tickSchoolTask(e.target.dataset.sctick, e.target);
  // 👤 "Do you know their level?" Yes → ⭐ + Good at / Finds hard; Not sure → 🧪 Placement test
  const k = e.target.dataset.spknow;
  if (k) { const unsure = e.target.value === "unsure"; $("spy-" + k).hidden = unsure; $("spt-" + k).hidden = !unsure; }
});

// A file in a list: 🖼️ photo, 📄 PDF, 🔗 link
const FILE_EMOJI = { image: "🖼️", pdf: "📄", pptx: "📊", docx: "📃", link: "🔗" };
const sizeText = n => n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
function fileRowHtml(f, s, status) {
  const t = f.task && s.tasks[f.task], st = status ? fileStatus(f, s) : "";
  return `<li><button class="bd-file" data-scfile="${safe(f.id)}"><span class="e">${FILE_EMOJI[f.kind]}</span>
    <span class="what">${safe(f.name)}<small>${f.subject ? safe(subjectEmoji(s, f.subject)) + " " + safe(f.subject) + " · " : ""}${shortDate(f.date)}${
      f.kind === "link" ? " · link" : " · " + sizeText(f.size)}${t ? " · 📎 answers" : ""}${f.by && f.by !== DAD && isDadNow() ? " · by " + safe(userById(f.by).name) : ""}</small></span>${
      st ? `<span class="sc-fstatus ${st[0] === "✅" ? "ok" : ""}">${st}</span>` : ""}</button></li>`;
}

// 📝 Upcoming exams (not done yet) on a date: one kid's, or every kid's (who = null)
function examsOn(date, who) {
  if (date < todayYmd()) return [];
  return Object.entries(data.school).filter(([kid]) => (!who || who === kid) && exists(kid))
    .flatMap(([kid, s]) => Object.values(s.tasks).filter(t => t.kind === "exam" && !t.done && t.due === date).map(t => ({ ...t, kid })));
}
// Small red "📝 Math" tags under the day name (tap one to see what it is)
function examTagsHtml(date, who) {
  return examsOn(date, who).map(t => {
    const u = userById(t.kid), text = `📝 Exam: ${t.subject}${t.title ? " – " + t.title : ""} (${u.name})`;
    return `<button class="k-exam" data-same="${safe(text)}" title="${safe(text)}">${who ? "" : safe(u.emoji) + " "}📝 ${safe(t.subject)}</button>`;
  }).join("");
}

// ---------- 📌 School dates (a 3rd kind of activity: not fixed, not flexible) ----------
// One date (and a time, or all day). Only on their own date: from the day after, the calendar hides them
// (they stay in School's "Past school dates"). The planner never sees them: no planning around them, no points.
// Shown on that kid's calendar, on Bro2a's, and on the family's (who = null).
function eventsOn(date, who) {
  if (date < todayYmd()) return [];
  return Object.entries(data.school).filter(([kid]) => exists(kid) && (!who || who === kid || isParentId(who)))
    .flatMap(([kid, s]) => Object.entries(s.events || {}).filter(([, e]) => e.date === date).map(([id, e]) => ({ id, kid, ...e })))
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}
function eventHtml(e, who) {
  const u = userById(e.kid), when = e.time ? clock(toMin(e.time), true) : "All day";
  return `<button class="k-event" data-kevent="${safe(e.kid)}|${safe(e.id)}" title="${safe(`📌 ${e.title} · ${when} (${u.name})`)}">
    📌 ${who === e.kid ? "" : safe(u.emoji) + " "}${e.time ? `<b>${clock(toMin(e.time))}</b> ` : ""}${safe(e.title)}</button>`;
}
// Tap one: its details (Bro2a can delete it from there)
function showEvent(kid, id) {
  const s = data.school[kid], e = s && s.events[id];
  if (!e) return;
  const text = `📌 ${e.title}\n${shortDate(e.date)} · ${e.time ? clock(toMin(e.time), true) : "All day"} · ${userById(kid).name}${e.note ? "\n" + e.note : ""}`;
  if (!isParentId(me)) return toast(text.replace(/\n/g, " · "), 5000);
  if (!confirm(`${text}\n\nDelete this school date?`)) return;
  delete s.events[id];
  writeData();
  render();
  toast("🗑️ Deleted");
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-kevent]");
  if (!b) return;
  const [kid, id] = b.dataset.kevent.split("|");
  showEvent(kid, id);
});

// ---------- 📅 A parent's own activities (💼 Work, ✈️ Travel, 📌 Other): a 4th kind of thing on the calendar ----------
// A parent adds them with ➕ My activity (the family calendar on their home screen). Everyone sees them; kids only look.
// The planner never sees them, so it never moves them (and nothing is planned around them).
// ✅ A "done" tick like the kids' (not ✈️ travel): +10, a mark in data.points.marks ("date|id|parent"). Not done = 0.
// One date (or a date range for travel), a time or all day, and maybe every week. Travel = ONE bar across its days.
const PACT_TYPES = [["work", "💼", "Work"], ["travel", "✈️", "Travel"], ["other", "📌", "Other"]];
const pactType = a => PACT_TYPES.find(t => t[0] === a.type) || PACT_TYPES[2];
// (isParentId is near DAD at the top: DAD, or a person with role "parent")
// (addDaysYmd, daysBetween and weekdayOf are with the other date helpers at the top)
// Is it on this date? → the first day of that time (for a trip: the day it starts), or null
function pactStartOn(a, date) {
  const diff = daysBetween(a.start, date), len = daysBetween(a.start, a.end);
  if (diff < 0) return null;
  if (!a.weekly) return diff <= len ? a.start : null;
  const k = Math.max(0, Math.ceil((diff - len) / 7));
  return k * 7 <= diff ? addDaysYmd(a.start, k * 7) : null;
}
// Whose: everything (who = null), that parent's own, or every parent's on a kid's calendar (look only)
const pactsFor = who => (data.parentActs || []).filter(a => exists(a.by) && (!who || a.by === who || !isParentId(who)));
const pactsOn = (date, who) => pactsFor(who).filter(a => pactStartOn(a, date));
// ✈️ The trips on the calendar's dates: { a, from, d0, d1, date } (d0 / d1 = the first / last column it covers, date = its first date there)
function travelBars(who, dates) {
  const bars = [];
  pactsFor(who).filter(a => a.type === "travel").forEach(a => {
    let cur = null;
    for (let d = 0; d < dates.length; d++) {
      const from = pactStartOn(a, dates[d]);
      if (from && cur && cur.from === from) cur.d1 = d;
      else if (from) bars.push(cur = { a, from, d0: d, d1: d, date: dates[d] });
      else cur = null;
    }
  });
  return bars;
}
const pactFaded = (a, opts) => (opts.fade && opts.fade !== "all" && opts.fade !== a.by) || !!opts.subj;   // (📚 a subject picked: faded)
const pactStyle = a => { const c = colorsOf(userById(a.by)); return `--soft:${c.soft};--ink:${c.ink};--c:${c.color};--line-c:${c.color}`; };
const pactTag = a => `<span class="k-tag">${whoHtml(a.by)}</span>`;   // (🖼️ the parent's photo, or emoji)
// ✅ Its "done" tick (+10, like an activity): only that parent ticks it. Others see a ✓ once it's done (just looking).
// (d = the date; 📅 past days: look-only. 👨‍👩‍👧 Parents aren't scored any more, so their own activities have no tick at all.)
function pactCheckHtml(a, d, opts) {
  if (opts.readOnly || a.type === "travel" || isParentId(a.by)) return "";
  const on = isDone(d, a.id, a.by), mine = a.by === me && !isKidDevice(), today = todayYmd(), owner = userById(a.by);
  if (!mine && !on) return "";
  const label = `${on ? (mine ? "Done! Tap to untick" : "Done!") : d > today ? "Not yet" : "Tap when done"}: ${owner.name}, ${a.title}`;
  if (kidLockedOut(a.by) || (d < today && on)) return `<span class="k-check on" role="img" style="--c:${colorsOf(owner).color}" aria-label="${safe(`Done: ${owner.name}, ${a.title}`)}">✓</span>`;   // 🔒 look-only
  if (d < today) return "";
  return `<button class="k-check ${on ? "on" : ""}" data-check="${d}|${safe(a.id)}|${safe(a.by)}" ${mine && d === today ? "" : "disabled"}
    style="--c:${colorsOf(owner).color}" aria-pressed="${on}" aria-label="${safe(label)}" title="${safe(label)}">${on ? "✓" : ""}</button>`;
}
function pactCardHtml(a, d, opts) {
  const n = blocks.push({ pact: a, day: d }) - 1, title = `${pactType(a)[1]} ${a.title}`, check = pactCheckHtml(a, d, opts);
  return `<div class="k-block k-pact ${pactFaded(a, opts) ? "faded" : ""}" data-kblock="${n}" role="button" tabindex="0" style="${pactStyle(a)}"
      title="${safe(title)} · ${clock(toMin(a.from), true)}–${clock(toMin(a.to), true)} (${safe(userById(a.by).name)})">
    ${pactTag(a)}<span class="who"><span class="t-full">${safe(title)}</span><span class="t-short">${safe(title)}</span></span>
    <span class="k-sub"><span class="when">${clock(toMin(a.from))} - ${clock(toMin(a.to))}</span></span>${check ? `<div class="k-checks">${check}</div>` : ""}</div>`;
}
// All day: a small chip under the day name (its ✅ tick next to it)
function pactDayHtml(a, d, opts) {
  const n = blocks.push({ pact: a, day: d }) - 1, check = pactCheckHtml(a, d, opts);
  const chip = `<button class="k-pactday ${pactFaded(a, opts) ? "faded" : ""}" data-kblock="${n}" style="${pactStyle(a)}" title="${safe(`${pactType(a)[1]} ${a.title} · All day (${userById(a.by).name})`)}">
    ${pactTag(a)} ${safe(pactType(a)[1] + " " + a.title)}</button>`;
  return check ? `<div class="k-pactwrap">${chip}${check}</div>` : chip;
}
// "✈️ Dad away (Mon-Thu)"
const tripDays = (a, from) => { const to = addDaysYmd(from, daysBetween(a.start, a.end)); return SHORT[weekdayOf(from)] + (to !== from ? "-" + SHORT[weekdayOf(to)] : ""); };
function travelBarHtml(x, opts) {
  const n = blocks.push({ pact: x.a, day: x.date }) - 1, text = `✈️ ${x.a.title} (${tripDays(x.a, x.from)})`;
  return `<button class="k-travel ${pactFaded(x.a, opts) ? "faded" : ""}" data-kblock="${n}" style="${pactStyle(x.a)}" title="${safe(text)} · ${safe(userById(x.a.by).name)}">
    ${pactTag(x.a)} ${safe(text)}</button>`;
}
// Tapped: the details (a parent can ✏️ change or 🗑️ delete it from here)
function openPactCard(b) {
  const a = b.pact, u = userById(a.by), [, emoji, label] = pactType(a);
  const from = (isYmd(b.day) && pactStartOn(a, b.day)) || a.start, to = addDaysYmd(from, daysBetween(a.start, a.end));
  const rows = [["📌 What", `${emoji} ${a.title}`], ["🏷️ Type", `${emoji} ${label}`], ["🙂 Who", whoText(a.by)],
    ["📅 When", to !== from ? `${shortDate(from)} – ${shortDate(to)}` : shortDate(from)],
    ["⏰ Time", a.from ? `${clock(toMin(a.from), true)} – ${clock(toMin(a.to), true)}` : "All day"],
    a.weekly ? ["🔁 Repeats", "Every week"] : null].filter(Boolean);
  const canEdit = isParentId(me) && !isKidDevice();
  $("kCard").style.cssText = pactStyle(a);
  $("kCard").innerHTML = `
    <div class="k-card-top"><div class="big">${safe(emoji)}</div><div class="nm">${safe(a.title)}</div></div>
    <div class="k-rows">${rows.map(([l, v]) => `<div><span>${safe(l)}</span><b>${safe(v)}</b></div>`).join("")}</div>
    <p class="hint" style="text-align:center;margin:8px 16px 0">${canEdit ? `The ✨ planner never moves it.${a.type === "travel" ? "" : ` ✅ Tick it when it's done: +${POINTS_EACH} points.`}` : `Just so everyone knows. Only ${safe(u.name)} can change or tick it.`}</p>
    ${canEdit ? `<div class="btnrow" style="justify-content:center;margin:10px 16px 0"><button data-pactedit="${safe(a.id)}">✏️ Change</button>
      <button class="danger-text" data-pactdel="${safe(a.id)}">🗑️ Delete</button></div>` : ""}
    <button class="k-ok" id="kOk">OK 👍</button>`;
  $("kModal").hidden = false;
  $("kOk").focus();
}

// ➕ My activity (a parent): the small form
let pa = null;   // the open form: { id (null = new), title, type, start, end, from, to, weekly }
function openPactForm(id) {
  if (!isParentId(me) || isKidDevice()) return;
  const a = id && data.parentActs.find(x => x.id === id);
  pa = a ? { ...a } : { id: null, title: "", type: "work", start: todayYmd(), end: todayYmd(), from: "09:00", to: "17:00", weekly: false };
  closeCard();
  drawPactForm();
  $("pactModal").hidden = false;
  $("paName").focus();
}
function closePactForm() { $("pactModal").hidden = true; pa = null; }
function drawPactForm() {
  const travel = pa.type === "travel", allDay = !travel && !pa.from && !!pa.id;
  $("paTitle").textContent = pa.id ? "✏️ My activity" : "➕ My activity";
  $("paBody").innerHTML = `
    <label class="small" for="paName">What?</label>
    <input type="text" id="paName" maxlength="40" value="${safe(pa.title)}" placeholder="${travel ? `${safe(dadName())} away` : "Team meeting"}">
    <label class="small">Type</label>
    <div class="daypick" role="radiogroup" aria-label="Type">${PACT_TYPES.map(([k, e, l]) => `<label><input type="radio" name="paType" value="${k}" ${pa.type === k ? "checked" : ""}>
      <span>${e} ${l}</span></label>`).join("")}</div>
    <div class="row"><div><label class="small" for="paStart" id="paStartLbl">${travel ? "First day" : "Date"}</label><input type="date" id="paStart" value="${safe(pa.start)}"></div>
      <div id="paEndWrap" ${travel ? "" : "hidden"}><label class="small" for="paEnd">Last day</label><input type="date" id="paEnd" value="${safe(pa.end)}"></div></div>
    <div id="paTimeWrap" ${travel ? "hidden" : ""}>
      <label class="checkline"><input type="checkbox" id="paAllDay" ${allDay ? "checked" : ""}> All day</label>
      <div class="row" id="paTimes" ${allDay ? "hidden" : ""}><div><label class="small" for="paFrom">Start</label><input type="time" id="paFrom" value="${safe(pa.from || "09:00")}"></div>
        <div><label class="small" for="paTo">End</label><input type="time" id="paTo" value="${safe(pa.to || "17:00")}"></div></div></div>
    <p class="hint" id="paTravelHint" ${travel ? "" : "hidden"}>✈️ Travel is one bar across the days, e.g. “✈️ ${safe(dadName())} away (Mon-Thu)”.</p>
    <label class="checkline"><input type="checkbox" id="paWeekly" ${pa.weekly ? "checked" : ""}> 🔁 Repeat every week</label>
    <p class="hint">Everyone sees it on their calendar. The ✨ planner never moves it. ✅ Tick it when it's done: +${POINTS_EACH} points (not travel).</p>
    <div class="err" id="paErr"></div>
    <div class="btnrow"><button class="primary" data-pasave>${pa.id ? "💾 Save" : "➕ Add"}</button>
      ${pa.id ? `<button class="danger-text" data-padel>🗑️ Delete</button>` : ""}<button data-pacancel>Cancel</button></div>`;
}
function savePact() {
  if (!pa || !isParentId(me)) return;
  const type = (document.querySelector('input[name="paType"]:checked') || {}).value || "other", travel = type === "travel";
  const start = $("paStart").value, end = travel ? $("paEnd").value : start, weekly = $("paWeekly").checked;
  const allDay = travel || $("paAllDay").checked, from = $("paFrom").value, to = $("paTo").value;
  let title = $("paName").value.trim().slice(0, 40);
  if (!title && travel) title = `${userById(me).name} away`;
  const err = text => { $("paErr").textContent = text; };
  if (!title) return err("Please type what it is.");
  if (!isYmd(start)) return err("Please pick the date.");
  if (travel && (!isYmd(end) || end < start)) return err("The last day can't be before the first day.");
  if (travel && daysBetween(start, end) > 60) return err("A trip can be 60 days at most.");
  if (weekly && daysBetween(start, end) >= 7) return err("A trip that repeats every week must be shorter than a week.");
  if (!allDay && (!isHm(from) || !isHm(to) || toMin(to) <= toMin(from))) return err("The end time must be after the start time.");
  const a = { id: pa.id || newId(), title, type, by: pa.by || me, start, end, from: allDay ? "" : from, to: allDay ? "" : to, weekly };
  const i = data.parentActs.findIndex(x => x.id === a.id);
  if (i >= 0) data.parentActs[i] = a; else data.parentActs.push(a);
  closePactForm();
  keepNow();
  toast(`✓ ${pactType(a)[1]} ${a.title} is on the family calendar`, 3000);
}
function deletePact(id) {
  const a = data.parentActs.find(x => x.id === id);
  if (!a || !isParentId(me) || !confirm(`Delete “${a.title}”?`)) return;
  data.parentActs = data.parentActs.filter(x => x.id !== id);
  closeCard();
  closePactForm();
  keepNow();
  toast("🗑️ Deleted");
}
$("pactModal").addEventListener("click", e => {
  if (e.target === $("pactModal")) return closePactForm();
  const b = e.target.closest("button");
  if (!b || !pa) return;
  if ("pasave" in b.dataset) return savePact();
  if ("padel" in b.dataset) return deletePact(pa.id);
  if ("pacancel" in b.dataset) return closePactForm();
});
$("pactModal").addEventListener("change", e => {
  if (!pa) return;
  if (e.target.name === "paType") {
    const travel = e.target.value === "travel";
    $("paEndWrap").hidden = !travel; $("paTimeWrap").hidden = travel; $("paTravelHint").hidden = !travel;
    $("paStartLbl").textContent = travel ? "First day" : "Date";
    if (travel && (!isYmd($("paEnd").value) || $("paEnd").value < $("paStart").value)) $("paEnd").value = $("paStart").value;
    $("paName").placeholder = travel ? `${dadName()} away` : "Team meeting";
  }
  if (e.target.id === "paAllDay") $("paTimes").hidden = e.target.checked;
  if (e.target.id === "paStart" && !$("paEndWrap").hidden && $("paEnd").value < e.target.value) $("paEnd").value = e.target.value;
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("pactModal").hidden) closePactForm(); });

// ---------- 📅 The family calendar on a parent's home screen: the whole week, everyone in their own color ----------
let famCalWho = "all";   // "All" or one person
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-pactnew], [data-pactedit], [data-pactdel], [data-fcwho]");
  if (!b) return;
  const ds = b.dataset;
  if ("pactnew" in ds) return openPactForm(null);
  if (ds.pactedit) return openPactForm(ds.pactedit);
  if (ds.pactdel) return deletePact(ds.pactdel);
  if (ds.fcwho) { famCalWho = ds.fcwho; render(); }
});

// Makes a photo about 800px wide, as a JPEG under 150 KB (smaller and smaller until it fits).
// (School files: 1000px wide, under 700 KB.)
function shrinkPhoto(file, width = 800, LIMIT = 150 * 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image(), src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      let w = Math.min(width, img.naturalWidth), url = "";
      for (let round = 0; round < 8 && w >= 50; round++) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = Math.max(1, Math.round(img.naturalHeight * w / img.naturalWidth));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";   // (a see-through screenshot gets a white background)
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) {
          url = c.toDataURL("image/jpeg", q);
          if ((url.length - url.indexOf(",") - 1) * 0.75 < LIMIT) return resolve(url);
        }
        w = Math.round(w * 0.8);   // still too big (e.g. a very long screenshot): narrower
      }
      url ? resolve(url) : reject(new Error("too big"));
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error("not a picture")); };
    img.src = src;
  });
}

// =====================================================================
//  📥 SEESAW PHOTOS: each photo is its own small cloud document, families/{family}/state/photo-{id}
//  = { kid, data: "data:image/jpeg;base64,…", at } — NOT inside the family data (Firebase Storage needs the paid plan).
//  Until the cloud has it, the photo waits on this device (localStorage), and uploads when the cloud is ready.
// =====================================================================
const PHOTO_KEY = SAVE_KEY + ".photo.";
const photoCache = {};   // id → the photo (data URL), once loaded on this device
const isPhotoUrl = u => typeof u === "string" && u.startsWith("data:image/jpeg;base64,");
function photoRef(id) { return cloud.fb.doc(cloud.db, "families", cloud.familyId, "state", "photo-" + id); }
function sendPhoto(id, kid, url) {
  return cloud.fb.setDoc(photoRef(id), { kid, data: url, at: new Date().toISOString() })
    .then(() => { try { localStorage.removeItem(PHOTO_KEY + id); } catch (e) {} });
}
// Photos that are still waiting on this device: send them now
function uploadPhotos() {
  if (!cloud.ready) return;
  let keys = [];
  try { keys = Object.keys(localStorage).filter(k => k.startsWith(PHOTO_KEY)); } catch (e) {}
  keys.forEach(key => {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    if (p && isPhotoUrl(p.url)) sendPhoto(key.slice(PHOTO_KEY.length), String(p.kid || ""), p.url).catch(cloudError);
  });
}
function deletePhoto(id) {
  delete photoCache[id];
  try { localStorage.removeItem(PHOTO_KEY + id); } catch (e) {}
  if (cloud.ready) cloud.fb.deleteDoc(photoRef(id)).catch(cloudError);
}
// The photo: from this device, or from the cloud (Firestore also keeps an offline copy of the ones it loaded)
async function photoUrl(id) {
  if (photoCache[id]) return photoCache[id];
  try { const p = JSON.parse(localStorage.getItem(PHOTO_KEY + id)); if (p && isPhotoUrl(p.url)) return photoCache[id] = p.url; } catch (e) {}
  if (!cloud.ready) return null;
  const snap = await cloud.fb.getDoc(photoRef(id));
  const url = snap.exists() ? snap.data().data : null;
  return isPhotoUrl(url) ? photoCache[id] = url : null;
}
// Puts each photo in its place on the page (they load one by one)
function fillPhotos(root) {
  root.querySelectorAll("[data-photo]").forEach(box => {
    const id = box.dataset.photo;
    const put = url => {
      if (!url) return box.innerHTML = `<p class="sc-empty">📷 The photo isn't here yet. It shows when this device is online.</p>`;
      const img = document.createElement("img");
      img.className = "sc-photo";
      img.alt = "Photo from Seesaw";
      img.src = url;
      box.replaceChildren(img);
    };
    if (photoCache[id]) return put(photoCache[id]);
    photoUrl(id).then(put).catch(() => { box.innerHTML = `<p class="sc-empty">📷 Couldn't load the photo.</p>`; });
  });
}

// =====================================================================
//  🎒 SCHOOL FILES: each file is its own cloud document, families/{family}/files/{id}
//  = { kid, name, type: "image/jpeg" | "application/pdf" | PowerPoint (.pptx) | Word (.docx), data: "data:…;base64,…", at }
//  NOT inside the family data (Firebase Storage needs the paid plan). Photos ~1000px JPEG; at most about 700 KB a file.
//  Until the cloud has it, the file waits on this device (localStorage if there's room, or in memory), then uploads.
// =====================================================================
const FILE_MAX = 700 * 1024;
const FILE_KEY = SAVE_KEY + ".file.";
const fileCache = {};     // id → the file (data URL), once loaded on this device
const fileWaiting = {};   // id → { kid, url } not in the cloud yet
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const OFFICE_TYPES = { pptx: PPTX_TYPE, docx: DOCX_TYPE };
const TYPE_TEXT = "Only photos, PDF, PowerPoint (.pptx) and Word (.docx) files, please.";
const isFileUrl = u => typeof u === "string" && /^data:(image\/jpeg|application\/pdf|application\/vnd\.openxmlformats-officedocument\.(presentationml\.presentation|wordprocessingml\.document));base64,/.test(u);
const bytesOf = url => Math.round((url.length - url.indexOf(",") - 1) * 0.75);
function fileRef(id) { return cloud.fb.doc(cloud.db, "families", cloud.familyId, "files", id); }
// A chosen file → { kind, name, size, url }; throws "big" (too big) or "type" (not a photo / PDF)
// (width: photos are made this wide at most. 🤖 AI help uses 1600px, so the AI can read the small writing.)
const fileNameOf = file => String(file.name || "File").replace(/\.[^.]+$/, "").slice(0, 60) || "File";
const isPdfFile = file => file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
// "pptx" / "docx" for a PowerPoint / Word file, otherwise null
const officeKindOf = file => file.type === PPTX_TYPE || /\.pptx$/i.test(file.name || "") ? "pptx"
  : file.type === DOCX_TYPE || /\.docx$/i.test(file.name || "") ? "docx" : null;
// The file as "data:<type>;base64,…" (with the right type, whatever the phone said)
function readAsUrl(file, type) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;,]*/, "data:" + type));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}
const readPdf = file => readAsUrl(file, "application/pdf");
async function readSchoolFile(file, width = 1000) {
  const name = fileNameOf(file);
  if (/^image\//.test(file.type)) {
    const url = await shrinkPhoto(file, width, FILE_MAX);
    if (bytesOf(url) > FILE_MAX) throw new Error("big");
    return { kind: "image", name, size: bytesOf(url), url };
  }
  if (isPdfFile(file)) {
    if (file.size > FILE_MAX) throw new Error("big");
    return { kind: "pdf", name, size: file.size, url: await readPdf(file) };
  }
  const office = officeKindOf(file);
  if (office) {
    if (file.size > FILE_MAX) throw new Error("big");
    return { kind: office, name, size: file.size, url: await readAsUrl(file, OFFICE_TYPES[office]) };
  }
  throw new Error("type");
}
function sendFile(id, kid, url) {
  const meta = Object.values(data.school).map(s => s.files[id]).find(Boolean) || {};
  return cloud.fb.setDoc(fileRef(id), { kid, name: meta.name || "", type: url.slice(5, url.indexOf(";")), data: url, at: new Date().toISOString() })
    .then(() => { delete fileWaiting[id]; try { localStorage.removeItem(FILE_KEY + id); } catch (e) {} });
}
function storeFileData(id, kid, url) {
  fileCache[id] = url;
  fileWaiting[id] = { kid, url };
  try { localStorage.setItem(FILE_KEY + id, JSON.stringify({ kid, url })); } catch (e) {}   // (no room: it waits in memory)
  if (cloud.ready) sendFile(id, kid, url).catch(cloudError);
}
// Files still waiting on this device: send them now (when the cloud is ready)
function uploadFiles() {
  if (!cloud.ready) return;
  try {
    Object.keys(localStorage).filter(k => k.startsWith(FILE_KEY)).forEach(key => {
      const id = key.slice(FILE_KEY.length);
      let p = null;
      try { p = JSON.parse(localStorage.getItem(key)); } catch (e) {}
      if (p && isFileUrl(p.url) && !fileWaiting[id]) fileWaiting[id] = { kid: String(p.kid || ""), url: p.url };
    });
  } catch (e) {}
  Object.entries(fileWaiting).forEach(([id, p]) => sendFile(id, p.kid, p.url).catch(cloudError));
}
function deleteFileData(id) {
  delete fileCache[id]; delete fileWaiting[id];
  try { localStorage.removeItem(FILE_KEY + id); } catch (e) {}
  if (cloud.ready) cloud.fb.deleteDoc(fileRef(id)).catch(cloudError);
}
// The file: from this device, or from the cloud
async function fileUrl(id) {
  if (fileCache[id]) return fileCache[id];
  if (fileWaiting[id]) return fileCache[id] = fileWaiting[id].url;
  try { const p = JSON.parse(localStorage.getItem(FILE_KEY + id)); if (p && isFileUrl(p.url)) return fileCache[id] = p.url; } catch (e) {}
  if (!cloud.ready) return null;
  const snap = await cloud.fb.getDoc(fileRef(id));
  const url = snap.exists() ? snap.data().data : null;
  return isFileUrl(url) ? fileCache[id] = url : null;
}

// "data:application/pdf;base64,…" → a Blob (for the preview and the download)
function blobOf(url) {
  const comma = url.indexOf(","), bin = atob(url.slice(comma + 1)), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: url.slice(5, url.indexOf(";")) });
}
// ---------- Tap a file: preview (photo or PDF), ⬇ Download, 🗑️ Delete ----------
let fileOpen = null, fileBlobUrl = null;   // the open file's id, and its blob address (for the PDF preview and the download)
function closeFile() {
  $("fileModal").hidden = true;
  $("fmBody").innerHTML = "";
  if (fileBlobUrl) URL.revokeObjectURL(fileBlobUrl);
  fileOpen = fileBlobUrl = null;
}
async function openFile(id) {
  const s = schoolOf(schoolKid), f = s.files[id];
  if (!f) return;
  closeFile();
  fileOpen = id;
  $("fmTitle").textContent = `${FILE_EMOJI[f.kind]} ${f.name}`;
  $("fmInfo").textContent = [f.subject, shortDate(f.date), f.kind === "link" ? "link" : sizeText(f.size), f.by ? "by " + userById(f.by).name : ""].filter(Boolean).join(" · ");
  $("fmDel").hidden = !canChange(f);
  $("fmDown").hidden = f.kind === "link";
  $("fmLink").hidden = f.kind !== "link";
  $("fileModal").hidden = false;
  if (f.kind === "link") {
    $("fmBody").innerHTML = `<p class="bd-linktext">${safe(f.url)}</p>`;
    return $("fmLink").focus();
  }
  $("fmBody").innerHTML = `<p class="sc-empty">Loading…</p>`;
  $("fmDown").disabled = true;
  let url = null;
  try { url = await fileUrl(id); } catch (e) {}
  if (fileOpen !== id) return;   // closed meanwhile
  if (!url) return $("fmBody").innerHTML = `<p class="sc-empty">The file isn't here yet. It shows when this device is online.</p>`;
  fileBlobUrl = URL.createObjectURL(blobOf(url));
  $("fmDown").disabled = false;
  if (OFFICE_TYPES[f.kind]) {   // PowerPoint / Word: no preview here, ⬇ Download opens it
    $("fmBody").innerHTML = `<p class="sc-empty">${FILE_EMOJI[f.kind]} ${f.kind === "pptx" ? "PowerPoint" : "Word"} files can't be shown here. Tap ⬇ Download to open it.</p>`;
    return $("fmDown").focus();
  }
  $("fmBody").innerHTML = "";
  const el = document.createElement(f.kind === "image" ? "img" : "iframe");
  el.className = f.kind === "image" ? "bd-preview-img" : "bd-preview-pdf";
  if (f.kind === "image") el.alt = f.name; else el.title = f.name;
  el.src = fileBlobUrl;
  $("fmBody").appendChild(el);
  $("fmDown").disabled = false;
  $("fmDown").focus();
}
$("fileModal").addEventListener("click", e => {
  if (e.target === $("fileModal")) return closeFile();
  const b = e.target.closest("button");
  if (!b) return;
  const f = fileOpen && schoolOf(schoolKid).files[fileOpen];
  if (b.id === "fmClose") return closeFile();
  if (!f) return;
  if (b.id === "fmLink") return window.open(f.url, "_blank", "noopener");
  if (b.id === "fmDown" && fileBlobUrl) {
    const a = document.createElement("a");
    a.href = fileBlobUrl;
    a.download = f.name + (f.kind === "pdf" ? ".pdf" : OFFICE_TYPES[f.kind] ? "." + f.kind : ".jpg");
    document.body.appendChild(a); a.click(); a.remove();
    return;
  }
  if (b.id === "fmDel") { const id = fileOpen; closeFile(); deleteSchoolItem("file", id); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("fileModal").hidden) closeFile();
  if (!$("promptModal").hidden) closePrompt();
});
