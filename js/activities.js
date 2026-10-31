// =====================================================================
//  ADD ACTIVITIES (kids: only their own; Dad: anyone's)
// =====================================================================
$("fxDays").innerHTML = SHORT.map((d, i) =>
  `<label><input type="checkbox" value="${i}" ${i < 5 ? "checked" : ""}><span>${d}</span></label>`).join(""); // Mon–Fri ticked at first

// "Get ready before" / "Break after" choices: No, 10, 15, 20, 30 min
document.querySelectorAll(".pad-pick").forEach(sel =>
  sel.innerHTML = GET_READY.map(m => `<option value="${m}">${m ? m + " min" : "No"}</option>`).join(""));

let editingFixed = null;   // which fixed activity is being edited (null = adding a new one)
let editingFlex = null;    // which flexible activity is being edited
// "Get ready before" / "Break after" also follow the name automatically (Gym → 15 + 10, Math → 5 …)
// until you pick them yourself. They always have a value (never empty).
const padTouched = { fx: false, fl: false };
function fillPads(p) {
  const a = autoPads($(p + "Name").value);
  $(p + "Ready").value = String(a.getReady);
  $(p + "Break").value = String(a.breakAfter);
}
["fx", "fl"].forEach(p => {
  $(p + "Name").addEventListener("input", () => { if (!padTouched[p]) fillPads(p); });
  [p + "Ready", p + "Break"].forEach(id => $(id).addEventListener("change", () => padTouched[p] = true));
});

// "Who?" checklist (Dad only): which people the activity is for. One activity can be for several people.
// "selected" = which people to tick. If not given, keep whatever is ticked right now.
function drawWho(p, selected) {
  const box = $(p + "Who");
  if (!selected) selected = box.children.length ? [...box.querySelectorAll("input:checked")].map(c => c.value) : [me];
  box.innerHTML = data.users.map(u => {
    const c = colorsOf(u);
    return `<label><input type="checkbox" value="${safe(u.id)}" ${selected.includes(u.id) ? "checked" : ""}>
      <span class="chip" style="--soft:${c.soft};--ink:${c.ink}"><span class="e">${safe(u.emoji)}</span>${safe(u.name)}</span></label>`;
  }).join("");
  if ($(p + "DadLine")) drawStudy(p);   // (routines have no 🤝 helper)
}
// Who the activity is for: Dad picks in "Who?", kids always add their own.
function pickedWho(p) { return isParentId(me) ? [...$(p + "Who").querySelectorAll("input:checked")].map(c => c.value) : [me]; }

// ---------- 📚 Study details and 🤝 the helping parent (fixed AND flexible forms) ----------
// Type = Study → 📘 Subject (the subjects of the kids in "Who?", from their 🎒 School) and How (📖 Sole study · 🤝 With assistance).
// With assistance → "🤝 Who helps?" (any parent, required). Other types → "🤝 A parent helps?" (No / a parent).
// The helper is only planned when THAT parent is free too (see peopleOf). A parent who's one of the people can't also be the helper.
const helperChoices = p => data.users.filter(u => isParentId(u.id) && !pickedWho(p).includes(u.id));
// The kids' subjects (each name once; the first kid's subject id)
function studySubjects(p) {
  const out = [];
  pickedWho(p).filter(id => !isParentId(id)).forEach(id =>
    subjectList(schoolOf(id)).forEach(x => { if (!out.some(y => sameSubject(y.name, x.name))) out.push(x); }));
  return out;
}
// A saved subject id → its name (it may be another kid's id for the same subject)
function subjectNameOf(users, id) {
  for (const u of users) { const x = id && schoolOf(u).subjects[id]; if (x) return x.name; }
  return "";
}
// The subjects ticked in the Study box: ["all"] (All my subjects) or subject ids
function pickedSubjects(p) {
  const on = [...document.querySelectorAll(`#${p}Study input[name="${p}Sub"]:checked`)].map(x => x.value);
  return on.includes(ALL_SUBJECTS) ? [ALL_SUBJECTS] : on;
}
// Draws the Study box and the helper line. keep = { subjectIds, studyMode, helper } (editing / reset), else what's picked now.
// 📚 Subjects: tick one or MORE (or "All my subjects"); with more than one, the kid picks one for each session ("Which subject today?").
function drawStudy(p, keep) {
  const study = $(p + "Type").value === "study", box = $(p + "Study");
  const cur = keep || { subjectIds: $(p + "Study").querySelector(`input[name="${p}Sub"]`) ? pickedSubjects(p) : [], studyMode: $(p + "How") ? $(p + "How").value : "sole", helper: $(p + "Helper").value };
  box.hidden = !study;
  $(p + "MustLine").hidden = $(p + "Type").value !== "habit";   // (⭐ Must-do: only on a 🌱 Routine)
  if (study) {
    const subs = studySubjects(p), kid = pickedWho(p).find(id => !isParentId(id)), ids = cur.subjectIds || [], all = ids.includes(ALL_SUBJECTS);
    const names = ids.map(id => subjectNameOf(pickedWho(p), id)).filter(Boolean);
    const on = x => ids.includes(x.id) || names.some(n => sameSubject(n, x.name));
    box.innerHTML = `<label class="small">📘 Subjects <small>(tick one or more, or 📚 Free Study; with more than one, the kid picks one each time)</small></label>
      <div class="daypick st-subs" id="${p}Subjects">${subs.length
        ? `<label><input type="checkbox" name="${p}Sub" value="${ALL_SUBJECTS}" ${all ? "checked" : ""}><span>📚 Free Study</span></label>`
          + subs.map(x => `<label><input type="checkbox" name="${p}Sub" value="${safe(x.id)}" ${!all && on(x) ? "checked" : ""} ${all ? "disabled" : ""}><span>${safe(x.emoji)} ${safe(x.name)}</span></label>`).join("")
        : `<span class="hint">No subjects yet</span>`}</div>
      <div class="row"><div><label class="small" for="${p}How">How</label><select id="${p}How"><option value="sole">📖 Sole study</option>
        <option value="assisted" ${cur.studyMode === "assisted" ? "selected" : ""}>🤝 With assistance</option></select></div></div>
      ${subs.length ? "" : !kid ? `<p class="hint">Tick a kid in “Who?” to pick one of their subjects.</p>`
        : isParentId(me) && !isKidDevice() ? `<p class="hint">${safe(userById(kid).name)} has no subjects yet. <button type="button" class="pill" data-actsubjects="${safe(kid)}">✏️ Edit subjects</button></p>`
        : `<p class="hint">No subjects yet. Ask a parent to add them in 🎒 School.</p>`}`;
  }
  const need = study && $(p + "How").value === "assisted", list = helperChoices(p);
  $(p + "DadLine").hidden = study ? !need : !list.length;
  $(p + "HelperLabel").textContent = need ? "🤝 Who helps?" : "🤝 A parent helps?";
  $(p + "Helper").innerHTML = `<option value="">${need ? "— Choose —" : "No"}</option>`
    + list.map(u => `<option value="${safe(u.id)}" ${u.id === cur.helper ? "selected" : ""}>${safe(u.emoji)} ${safe(u.name)}</option>`).join("");
}
// What to save: { helper, (study:) subjectId, studyMode } or { err }
function pickedHelp(p) {
  const users = pickedWho(p), h = $(p + "Helper").value;
  const helper = h && isParentId(h) && !users.includes(h) ? h : "";
  if (pickedType(p) === "habit") return { helper, ...($(p + "Must").checked ? { must: true } : {}) };   // (⭐ must-do routine)
  if (pickedType(p) !== "study") return { helper };
  const studyMode = $(p + "How").value === "assisted" ? "assisted" : "sole";
  if (studyMode === "assisted" && !helper) return { err: "🤝 With assistance: pick who helps." };
  const subjectIds = pickedSubjects(p);
  return { helper: studyMode === "assisted" ? helper : "", subjectIds, subjectId: subjectIds.find(x => x !== ALL_SUBJECTS) || "", studyMode };
}
// Saving: the study fields only on a Study activity, and no older "Needs Dad"
function putHelp(act, help) {
  delete act.needsDad; delete act.must; delete act.subjectId; delete act.subjectIds; delete act.studyMode;
  return Object.assign(act, help);
}
["fx", "fl"].forEach(p => {
  $(p + "Who").addEventListener("change", () => drawStudy(p));
  $(p + "Type").addEventListener("change", () => drawStudy(p));
  $(p + "Study").addEventListener("change", e => { if (e.target.id === p + "How" || e.target.value === ALL_SUBJECTS) drawStudy(p); });   // (📚 All my subjects: the others are greyed)
});
// ✏️ Edit subjects (no subjects yet): the kid's 🎒 School, with ✏️ Edit subjects open
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-actsubjects]");
  if (!b || !isParentId(me) || isKidDevice()) return;
  openSchool(b.dataset.actsubjects);
  scSubEdit = true;
  render();
});

function drawAdd() {
  $("addTitle").textContent = isParentId(me) ? "✏️ Everyone's activities" : "✏️ My activities";
  $("addSub").textContent = isParentId(me) ? "Tick “Who?” for each activity. School can be for all the kids at once!"
                                       : `Shared activities (like School) can only be changed by ${dadName()}.`;
  // Only Dad picks who an activity is for
  $("fxWhoWrap").hidden = $("flWhoWrap").hidden = !isParentId(me);
  if (isParentId(me)) { drawWho("fx"); drawWho("fl"); }
  drawStudy("fx"); drawStudy("fl");   // (📚 Study details · 🤝 the helper)
  // "Can be done at the same time as" is only for Dad (it changes other people's activities too)
  $("fxPickWrap").hidden = $("flPickWrap").hidden = !isParentId(me);
  drawFixedList();
  drawFlexibleList();
  // ⏱️ Enough time? (parents, live: it changes with every edit)
  $("addTime").hidden = !isParentId(me) || !kidsList().length;
  if (isParentId(me)) $("addTime").innerHTML = `⏱️ ${timeLineHtml()}`;
  // Routines: parents only
  if (isParentId(me)) { if (!$("rtForm").hidden) drawWho("rt"); drawRoutineList(); }
  drawAddSections();
}
// ---------- ✏️ ADD PAGE: closed and simple, three big buttons with counts, each opens its list (accordion) ----------
// A list's "➕ New …" or a tap on a row opens the form (the forms are hidden otherwise). Opening the page: all closed.
let addOpen = { fx: false, fl: false, rt: false };
function drawAddSections() {
  const parent = isParentId(me);
  $("fxCount").textContent = `(${listFor(data.fixed).length})`;
  $("flCount").textContent = `(${listFor(data.flexible).length})`;
  $("rtCount").textContent = `(${data.routines.length})`;
  $("secRtBtn").hidden = !parent;
  if (!parent) addOpen.rt = false;
  [["fx", "secFxBtn", "secFx"], ["fl", "secFlBtn", "secFl"], ["rt", "secRtBtn", "rtCard"]].forEach(([k, btn, panel]) => {
    $(panel).hidden = !addOpen[k];
    $(btn).classList.toggle("on", addOpen[k]);
    $(btn).setAttribute("aria-expanded", String(addOpen[k]));
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#scr-add [data-addsec], #scr-add [data-addnew]");
  if (!b) return;
  if (b.dataset.addsec) {   // tap = open / close that list
    const k = b.dataset.addsec;
    addOpen[k] = !addOpen[k];
    if (!addOpen[k]) { if (k === "fx") resetFixedForm(); if (k === "fl") resetFlexForm(); if (k === "rt") closeRoutineForm(); }
    return drawAddSections();
  }
  const k = b.dataset.addnew;   // ➕ New …: the empty form
  if (k === "fx") { resetFixedForm(); $("fxForm").hidden = false; $("fxName").focus(); }
  if (k === "fl") { resetFlexForm(); $("flForm").hidden = false; $("flName").focus(); }
});
// One row of a list: name · who (emojis) · days and time (fixed) or minutes × times a week (flexible). Tap = edit (when allowed).
function addRowHtml(f, kind, editing, what) {
  const [, te, tw] = actTypeInfo(actTypeOf(f));   // (⭐ its type, e.g. "📚 Study")
  const sub = actTypeOf(f) === "study" && actSubjectsText(f);   // (📚 its subjects, or "All my subjects")
  const can = canEdit(f), inner = `<span class="what">${te} ${safe(f.name)}<small>${te} ${tw}${sub ? ` · ${safe(sub)}` : ""} · ${safe(emojisOf(f.users))} · ${what}${helperOf(f) ? ` · ${safe(withText(f))}` : ""}</small></span>`;
  return `<li class="${editing ? "editing" : ""}">${can ? `<button class="add-row" data-edit-${kind}="${f.id}" aria-label="Edit ${safe(f.name)}">${inner}<span class="add-go" aria-hidden="true">✏️</span></button>`
    : `<div class="add-row look">${inner}<span class="tag">👀 shared</span></div>`}</li>`;
}

// A checklist of the other activities (anyone's) that this one can share time with. Dad only.
// "selected" = which boxes to tick. If not given, keep whatever is ticked right now.
function drawPickList(listId, selfId, selected) {
  const box = $(listId);
  if (!selected) selected = [...box.querySelectorAll("input:checked")].map(c => c.value);
  // You can't pick the activity itself. Lessons can never go together with School, so School isn't offered for them.
  const others = allActs().filter(a => a.id !== selfId && !(listId === "flOverlapList" && isFixed(a) && isSchoolName(a.name)));
  box.innerHTML = others.length
    ? others.map(a => `<label class="checkline"><input type="checkbox" value="${a.id}" ${selected.includes(a.id) ? "checked" : ""}>
        ${safe(emojisOf(a.users))} ${safe(a.name)}${isFixed(a) ? ` <span class="tag">fixed</span>` : ""}</label>`).join("")
    : `<div class="empty">Add another activity first, then you can pick it here.</div>`;
}
// Keeps "together" lists two-way: activity "id" now goes with exactly the ones in "wanted",
// so each of those gets "id" ticked, and every other activity gets it unticked.
function syncPartners(id, wanted) {
  allActs().forEach(o => {
    if (o.id === id) return;
    const has = o.overlapWith.includes(id), want = wanted.includes(o.id);
    if (want && !has) o.overlapWith.push(id);
    if (!want && has) o.overlapWith = o.overlapWith.filter(x => x !== id);
  });
}
// Dad sees everyone's activities; a kid sees the ones they're in.
function listFor(list) { return isParentId(me) ? list : list.filter(f => f.users.includes(me)); }

// ---------- Fixed activities ----------
// Finds other fixed activities that share a day AND overlap in time AND keep the same person busy
// (except the ones allowed to be at the same time). Different people at the same time is always fine.
// Returns clear messages like "🦸‍♂️ Dad is busy twice on Monday: Gym (9am–10:30am) and Math with Bana (9:30am–10:15am)".
function findFixedOverlaps(act, ignoreId) {
  const a = { ...act, start: toMin(act.start), end: toMin(act.end) }, mine = peopleOf(act), found = [];
  for (const other of data.fixed) {
    if (other.id === ignoreId || act.overlapWith.includes(other.id)) continue;
    const both = peopleOf(other).filter(p => mine.includes(p));
    if (!both.length) continue;                                     // different people: no problem
    const b = { ...other, start: toMin(other.start), end: toMin(other.end) };
    if (!(a.start < b.end && b.start < a.end)) continue;           // times don't touch: no problem
    const days = act.days.filter(d => other.days.includes(d));
    if (!days.length) continue;                                     // different days: no problem
    both.forEach(p => found.push(busyTwice(p, a, b, "on " + days.map(d => DAYS[d]).join(", "))));
  }
  return found;
}

// ⭐ The Type picker (📚 Study · ⚽ Activity · 🌱 Habit · 🗂️ Other = non-scored). New: "Activity" ("Other" while the name has "school"),
// until you pick one yourself; editing: its saved type.
const typeTouched = { fx: false, fl: false };
["fx", "fl"].forEach(k => {
  $(k + "Type").innerHTML = ACT_TYPES.map(([key, e, w]) => `<option value="${key}">${e} ${w}${key === "other" ? " (non-scored)" : ""}</option>`).join("");
  $(k + "Type").value = "activity";
  $(k + "Type").addEventListener("change", () => { typeTouched[k] = true; });
  $(k + "Name").addEventListener("input", () => { if (!typeTouched[k]) $(k + "Type").value = defaultActType({ name: $(k + "Name").value }); });
});
const pickedType = k => ACT_TYPE_KEYS.includes($(k + "Type").value) ? $(k + "Type").value : "activity";

$("fxAdd").onclick = () => {
  const users = pickedWho("fx");
  const name = $("fxName").value.trim(), type = pickedType("fx");
  const days = [...$("fxDays").querySelectorAll("input:checked")].map(c => Number(c.value));
  const start = $("fxStart").value, end = $("fxEnd").value;
  const help = pickedHelp("fx"), helper = help.helper || "";   // (🤝 · 📚)
  const getReady = Number($("fxReady").value) || 0, breakAfter = Number($("fxBreak").value) || 0;
  const old = editingFixed ? data.fixed.find(f => f.id === editingFixed) : null;
  if (old && !canEdit(old)) return;
  // Only Dad changes the "together" list; kids keep what it was.
  let overlapWith = isParentId(me) ? [...$("fxOverlapList").querySelectorAll("input:checked")].map(c => c.value) : (old ? old.overlapWith : []);
  // School never goes together with lessons
  if (isSchoolName(name)) overlapWith = overlapWith.filter(id => !data.flexible.some(f => f.id === id));
  if (!name) return $("fxErr").textContent = "Please type a name.";
  if (!users.length) return $("fxErr").textContent = "Tick “Who?” — at least one person.";
  if (!days.length) return $("fxErr").textContent = "Pick at least one day.";
  if (!start || !end || toMin(end) <= toMin(start)) return $("fxErr").textContent = "End time must be after start time.";
  if (help.err) return $("fxErr").textContent = help.err;

  // Block clashes for the same person: say who is busy twice, and don't save.
  const overlaps = findFixedOverlaps({ name, days, start, end, overlapWith, users, helper }, editingFixed);
  if (overlaps.length) {
    const tip = "Please change the time or the days"
      + (helper ? `, or pick another parent in “🤝”` : "")
      + (isParentId(me) ? ", or tick it in “Can be done at the same time as”." : ".");
    $("fxErr").innerHTML = `Not saved:<ul>${overlaps.map(o => `<li>${safe(o)}</li>`).join("")}</ul>${safe(tip)}`;
    return;
  }

  let id = editingFixed;
  if (old) putHelp(Object.assign(old, { name, days, start, end, overlapWith, users, getReady, breakAfter, type }), help);   // update the existing one
  else { id = newId(); data.fixed.push(putHelp({ id, name, days, start, end, overlapWith, users, getReady, breakAfter, type }, help)); } // add a new one
  if (isParentId(me)) syncPartners(id, overlapWith); // keep it two-way
  resetFixedForm();
  changed();
  draftToast(old ? "✓ Changed" : "✓ Added");
};

// Fill the form with an activity's values so you can change them
function startEditFixed(id) {
  const f = data.fixed.find(x => x.id === id);
  if (!f || !canEdit(f)) return;
  editingFixed = id;
  $("fxName").value = f.name;
  $("fxType").value = actTypeOf(f); typeTouched.fx = true;
  $("fxMust").checked = !!f.must;
  $("fxDays").querySelectorAll("input").forEach(c => c.checked = f.days.includes(Number(c.value)));
  $("fxStart").value = f.start;
  $("fxEnd").value = f.end;
  $("fxReady").value = String(f.getReady || 0);
  $("fxBreak").value = String(f.breakAfter || 0);
  padTouched.fx = true;   // editing: keep its saved times
  drawWho("fx", f.users);
  drawStudy("fx", { subjectIds: subjectIdsOf(f), studyMode: f.studyMode || "sole", helper: f.helper || "" });
  $("fxFormTitle").textContent = `✏️ Edit: ${f.name}`;
  $("fxDel").hidden = false; $("fxDel").dataset.delFixed = id;   // (🗑️ goes through the usual delete: same rules as before)
  $("fxErr").textContent = "";
  addOpen.fx = true; drawAddSections();
  $("fxForm").hidden = false;
  drawFixedList();
  drawPickList("fxOverlapList", editingFixed, f.overlapWith);
  $("fxName").focus();
}
// Put the form back to "add new" mode
function resetFixedForm() {
  editingFixed = null;
  $("fxName").value = "";
  $("fxType").value = "activity"; typeTouched.fx = false;
  $("fxMust").checked = false;
  $("fxDays").querySelectorAll("input").forEach(c => c.checked = Number(c.value) < 5); // Mon–Fri
  $("fxStart").value = "07:30";
  $("fxEnd").value = "14:00";
  padTouched.fx = false;
  fillPads("fx");          // automatic times (the name is empty now → 5 min before)
  drawWho("fx", [me]);
  drawStudy("fx", { subjectIds: [], studyMode: "sole", helper: "" });
  $("fxFormTitle").textContent = "➕ New fixed activity";
  $("fxDel").hidden = true; delete $("fxDel").dataset.delFixed;
  $("fxForm").hidden = true;   // (the form shows only after ➕ New or a tap on a row)
  $("fxErr").textContent = "";
  drawFixedList();
  drawPickList("fxOverlapList", null, []);
}
$("fxCancel").onclick = resetFixedForm;

function drawFixedList() {
  const mine = listFor(data.fixed);
  $("fxList").innerHTML = mine.length ? mine.map(f => addRowHtml(f, "fixed", f.id === editingFixed,
      `${f.days.map(d => SHORT[d]).join(", ")} · ${showTime(toMin(f.start))}–${showTime(toMin(f.end))}`)).join("")
    : `<li class="empty">Nothing here yet.</li>`;
  drawPickList("fxOverlapList", editingFixed); // refresh the checklist too (keeps your current ticks)
  if ($("fxCount")) $("fxCount").textContent = `(${mine.length})`;
}

// ---------- Flexible activities ----------
$("flAdd").onclick = () => {
  const users = pickedWho("fl");
  const name = $("flName").value.trim(), type = pickedType("fl");
  const duration = Number($("flDur").value);
  const times = Number($("flTimes").value);
  const help = pickedHelp("fl");   // (🤝 · 📚)
  const getReady = Number($("flReady").value) || 0, breakAfter = Number($("flBreak").value) || 0;
  const old = editingFlex ? data.flexible.find(f => f.id === editingFlex) : null;
  if (old && !canEdit(old)) return;
  // (School never goes together with lessons)
  const overlapWith = (isParentId(me) ? [...$("flOverlapList").querySelectorAll("input:checked")].map(c => c.value) : (old ? old.overlapWith : []))
    .filter(id => !data.fixed.some(f => f.id === id && isSchoolName(f.name)));
  if (!name) return $("flErr").textContent = "Please type a name.";
  if (!users.length) return $("flErr").textContent = "Tick “Who?” — at least one person.";
  if (!(duration >= 5)) return $("flErr").textContent = "It should be at least 5 minutes.";
  if (!(times >= 1 && times <= DAYS.length)) return $("flErr").textContent = `Times per week must be 1 to ${DAYS.length}.`;
  // "Only between": both times or none; the time must be long enough for the activity
  const from = $("flFrom").value, to = $("flTo").value;
  if (!from !== !to) return $("flErr").textContent = "“Only between”: pick both times, or tap ✕ Any time.";
  if (from && toMin(to) <= toMin(from)) return $("flErr").textContent = "“Only between”: the second time must be after the first.";
  if (from && toMin(to) - toMin(from) < duration)
    return $("flErr").textContent = `“Only between” is only ${showDuration(toMin(to) - toMin(from))}, but ${name} takes ${showDuration(duration)}.`;
  const between = from ? { from, to } : null;
  if (help.err) return $("flErr").textContent = help.err;
  const twice = $("flTwice").checked;   // (2️⃣ off = never twice on one day)

  let id = editingFlex;
  if (old) {                                                                       // update the existing one
    putHelp(Object.assign(old, { name, duration, times, overlapWith, users, getReady, breakAfter, type }), help);
    if (between) old.between = between; else delete old.between;
    if (twice) delete old.twice; else old.twice = false;
  } else {                                                                         // add a new one
    id = newId();
    data.flexible.push(putHelp({ id, name, duration, times, overlapWith, users, getReady, breakAfter, type, ...(between ? { between } : {}), ...(twice ? {} : { twice: false }) }, help));
  }
  if (isParentId(me)) syncPartners(id, overlapWith); // keep it two-way
  resetFlexForm();
  changed();
  draftToast(old ? "✓ Changed" : "✓ Added");
};

function startEditFlex(id) {
  const f = data.flexible.find(x => x.id === id);
  if (!f || !canEdit(f)) return;
  editingFlex = id;
  $("flName").value = f.name;
  $("flType").value = actTypeOf(f); typeTouched.fl = true;
  $("flMust").checked = !!f.must;
  $("flDur").value = f.duration;
  $("flTimes").value = f.times;
  $("flTwice").checked = f.twice !== false;
  $("flReady").value = String(f.getReady || 0);
  $("flBreak").value = String(f.breakAfter || 0);
  $("flFrom").value = f.between ? f.between.from : "";
  $("flTo").value = f.between ? f.between.to : "";
  padTouched.fl = true;   // editing: keep its saved times
  drawWho("fl", f.users);
  drawStudy("fl", { subjectIds: subjectIdsOf(f), studyMode: f.studyMode || "sole", helper: f.helper || "" });
  $("flFormTitle").textContent = `✏️ Edit: ${f.name}`;
  $("flDel").hidden = false; $("flDel").dataset.delFlex = id;   // (🗑️ goes through the usual delete: same rules as before)
  $("flErr").textContent = "";
  addOpen.fl = true; drawAddSections();
  $("flForm").hidden = false;
  drawFlexibleList();
  drawPickList("flOverlapList", editingFlex, f.overlapWith);
  $("flName").focus();
}
function resetFlexForm() {
  editingFlex = null;
  $("flName").value = "";
  $("flType").value = "activity"; typeTouched.fl = false;
  $("flMust").checked = false;
  $("flDur").value = 45;
  $("flTimes").value = 3;
  $("flTwice").checked = true;
  $("flFrom").value = $("flTo").value = "";   // any free time
  padTouched.fl = false;
  fillPads("fl");          // automatic times
  drawWho("fl", [me]);
  drawStudy("fl", { subjectIds: [], studyMode: "sole", helper: "" });
  $("flFormTitle").textContent = "➕ New flexible activity";
  $("flDel").hidden = true; delete $("flDel").dataset.delFlex;
  $("flForm").hidden = true;   // (the form shows only after ➕ New or a tap on a row)
  $("flErr").textContent = "";
  drawFlexibleList();
  drawPickList("flOverlapList", null, []);
}
$("flCancel").onclick = resetFlexForm;
$("flAnyTime").onclick = () => { $("flFrom").value = $("flTo").value = ""; };

function drawFlexibleList() {
  const mine = listFor(data.flexible);
  $("flList").innerHTML = mine.length ? mine.map(f => addRowHtml(f, "flex", f.id === editingFlex,
      `${f.duration} min × ${f.times} a week${f.between ? ` · 🕓 ${betweenText(f.between)}` : ""}`)).join("")
    : `<li class="empty">Nothing here yet.</li>`;
  drawPickList("flOverlapList", editingFlex);
  if ($("flCount")) $("flCount").textContent = `(${mine.length})`;
}

// ---------- Routines (Dad only) ----------
// Quick-add buttons: tap one, then pick only the time, the days and who.
$("rtQuick").innerHTML = ROUTINE_PRESETS.map((r, i) =>
  `<button class="rt-btn" data-rtnew="${i}">${r.emoji} ${r.name} <small>${r.duration} min</small></button>`).join("")
  + `<button class="rt-btn" data-rtnew="custom">➕ Custom</button>`;
$("rtDays").innerHTML = SHORT.map((d, i) => `<label><input type="checkbox" value="${i}" checked><span>${d}</span></label>`).join("");

let editingRoutine = null;  // which routine is being changed (null = adding a new one)
let rtPreset = null;        // the quick-add button that was tapped (null = Custom: also asks name, emoji and minutes)

// Opens the little form, for a quick-add button (preset), Custom (nothing), or an existing routine
function openRoutineForm(preset, routine) {
  editingRoutine = routine ? routine.id : null;
  const custom = routine ? routine.custom : !preset;
  const src = routine || preset || { name: "", emoji: "", duration: 20, start: "07:00" };
  rtPreset = custom ? null : { name: src.name, emoji: src.emoji, duration: src.duration };
  $("rtCustomRow").hidden = !custom;
  $("rtName").value = custom ? src.name : "";
  $("rtEmoji").value = custom ? src.emoji : "";
  $("rtDur").value = src.duration;
  $("rtStart").value = src.start;
  $("rtDays").querySelectorAll("input").forEach(c => c.checked = routine ? routine.days.includes(Number(c.value)) : true);
  drawWho("rt", routine ? routine.users : data.users.map(u => u.id));   // new routines: everyone
  $("rtTitle").textContent = custom ? (routine ? "✏️ Change routine" : "➕ New routine") : `${src.emoji} ${src.name} · ${src.duration} min`;
  $("rtAdd").textContent = "💾 Save";
  $("rtDel").hidden = !routine;   // (🗑️ only when changing one: the usual delete)
  if (routine) $("rtDel").dataset.delRt = routine.id; else delete $("rtDel").dataset.delRt;
  $("rtErr").textContent = "";
  addOpen.rt = true; drawAddSections();
  $("rtForm").hidden = false;
  drawRoutineList();
  (custom ? $("rtName") : $("rtStart")).focus();
}
function closeRoutineForm() {
  editingRoutine = null;
  $("rtForm").hidden = true;
  drawRoutineList();
}
$("rtCancel").onclick = closeRoutineForm;

$("rtAdd").onclick = () => {
  if (!isParentId(me)) return;
  const custom = !rtPreset;
  const name = custom ? $("rtName").value.trim().slice(0, 30) : rtPreset.name;
  const emoji = custom ? ($("rtEmoji").value.trim().slice(0, 8) || "⏰") : rtPreset.emoji;
  const duration = custom ? Math.round(Number($("rtDur").value)) : rtPreset.duration;
  const start = $("rtStart").value;
  const days = [...$("rtDays").querySelectorAll("input:checked")].map(c => Number(c.value));
  const users = [...$("rtWho").querySelectorAll("input:checked")].map(c => c.value);
  if (!name) return $("rtErr").textContent = "Please type a name.";
  if (!(duration >= 5 && duration <= 600)) return $("rtErr").textContent = "Minutes must be 5 to 600.";
  if (!start) return $("rtErr").textContent = "Please pick a time.";
  if (toMin(start) + duration > 24 * 60) return $("rtErr").textContent = "It must end before midnight.";
  if (!days.length) return $("rtErr").textContent = "Pick at least one day.";
  if (!users.length) return $("rtErr").textContent = "Tick “Who?” — at least one person.";
  const old = editingRoutine ? data.routines.find(r => r.id === editingRoutine) : null;
  if (old) Object.assign(old, { name, emoji, duration, start, days, users });
  else data.routines.push({ id: newId(), name, emoji, duration, start, days, users, custom });
  closeRoutineForm();
  changed();
  draftToast(old ? "✓ Changed" : `✓ ${emoji} ${name} added`);
};

function drawRoutineList() {
  const list = [...data.routines].sort((a, b) => toMin(a.start) - toMin(b.start));
  $("rtList").innerHTML = list.length ? list.map(r => {
    const s = toMin(r.start);
    return `<li class="${r.id === editingRoutine ? "editing" : ""}"><button class="add-row" data-edit-rt="${r.id}" aria-label="Edit ${safe(r.name)}">
      <span class="what">${safe(r.emoji)} ${safe(r.name)}<small>${isEveryone(r.users) ? "Everyone" : safe(emojisOf(r.users))} · ${daysText(r.days)} · ${showTime(s)}–${showTime(s + r.duration)}</small></span>
      <span class="add-go" aria-hidden="true">✏️</span></button></li>`;
  }).join("") : `<li class="empty">No routines yet. Tap a button above to add one.</li>`;
  if ($("rtCount")) $("rtCount").textContent = `(${data.routines.length})`;
}
function deleteRoutine(id) {
  const r = data.routines.find(x => x.id === id);
  if (!r || !isParentId(me) || !confirm(`Delete the routine “${r.name}”?`)) return;
  data.routines = data.routines.filter(x => x.id !== id);
  if (editingRoutine === id) closeRoutineForm();
  changed();
}

function deleteActivity(id, isFixedOne) {
  const list = isFixedOne ? data.fixed : data.flexible;
  const act = list.find(a => a.id === id);
  if (!act || !canEdit(act)) return;
  if (!confirm(`Delete “${act.name}”?`)) return;
  // 📅 Its items on the days that are gone (and today) stay as history: they remember its name, people and type
  // (today's ones that haven't started and aren't ticked are taken out when the week is planned again, see makePlan)
  if (hasPlan()) Object.entries(data.plan.dates).forEach(([ds, day]) => ds <= todayYmd() && day.items.forEach(it => {
    if (it.actId === id && !!it.fixed === !!isFixedOne) it.gone = { name: act.name, users: [...act.users], people: peopleOf(act), type: actTypeOf(act) };
  }));
  if (isFixedOne) data.fixed = data.fixed.filter(f => f.id !== id);
  else data.flexible = data.flexible.filter(f => f.id !== id);
  allActs().forEach(a => a.overlapWith = a.overlapWith.filter(x => x !== id)); // remove it from other checklists
  if (editingFixed === id) resetFixedForm();
  if (editingFlex === id) resetFlexForm();
  changed();
}

// =====================================================================
//  THE PLANNER — this is where the week gets built (for everyone together)
// =====================================================================

// How many minutes these activities take together.
// If two of them share the same hour, that hour is counted only once.
function busyMinutes(items) {
  const pieces = items.map(it => [it.start, it.end]).sort((x, y) => x[0] - y[0]);
  let total = 0, curStart = null, curEnd = null;
  for (const [a, b] of pieces) {
    if (curEnd === null || a > curEnd) {          // a new separate busy block
      if (curEnd !== null) total += curEnd - curStart;
      curStart = a; curEnd = b;
    } else curEnd = Math.max(curEnd, b);           // overlaps the current block: make it longer
  }
  if (curEnd !== null) total += curEnd - curStart;
  return total;
}
const totalLength = pieces => pieces.reduce((sum, [s, e]) => sum + e - s, 0);

// Cuts busy blocks out of a time window and returns the pieces that are left.
// Example: window 8am–9pm, busy 7pm–7:30pm → [8am–7pm, 7:30pm–9pm]
function cutOut([ws, we], busy) {
  let pieces = [[ws, we]];
  for (const [bs, be] of busy) {
    pieces = pieces.flatMap(([s, e]) => (be <= s || bs >= e) ? [[s, e]]
      : [[s, Math.min(bs, e)], [Math.max(be, s), e]].filter(([a, b]) => b > a));
  }
  return pieces;
}

// Day i's hours from "My day": that day's own start and end (Monday … Sunday), or (older settings) the day / weekend hours.
// The planner never places anything before the start or after the end, and the calendar shows only that time.
function dayWindow(i) {
  const m = data.myDay;
  if (m.days && m.days[i]) return [toMin(m.days[i].start), toMin(m.days[i].end)];
  const weekend = i >= 5 && m.weekendOwn;
  return [toMin(weekend ? m.weekendStart : m.start), toMin(weekend ? m.weekendEnd : m.end)];
}

// The free time of one person on day i: the day minus the fixed activities that keep them busy.
// A fixed activity you allowed to share time with one of their flexible activities still counts as free.
function freeFor(i, person) {
  // A kid's fixed activities (like School) always block the kid. Only a parent's can be shared with a lesson they allowed.
  const blocks = f => !isParentId(person) ||!f.overlapWith.some(id => data.flexible.some(x => x.id === id && peopleOf(x).includes(person)));
  const busy = data.fixed.filter(f => f.days.includes(i) && peopleOf(f).includes(person) && blocks(f))
    .map(f => [toMin(f.start), toMin(f.end)]);
  routinesOn(i).filter(r => r.users.includes(person)).forEach(r => busy.push([r.start, r.end]));  // routines aren't free time
  return cutOut(dayWindow(i), busy);
}

// =====================================================================
//  ROUTINES: eating, shower, getting ready … They keep their people busy (no lessons on top), but no points.
// =====================================================================
// (The quick-add buttons are in ROUTINE_PRESETS at the top.)
// Every routine strip on day i (0 = Monday), with times in minutes:
// the routines, plus a "🎒 Get ready" strip before each fixed activity that has "Get ready before".
function routinesOn(i) {
  const list = data.routines.filter(r => r.days.includes(i)).map(r => {
    const s = toMin(r.start);
    return { routine: true, id: r.id, name: r.name, emoji: r.emoji, start: s, end: s + r.duration, users: r.users };
  });
  data.fixed.filter(f => f.days.includes(i)).forEach(f => list.push(...padsFor(f, toMin(f.start), toMin(f.end))));
  return list.sort((a, b) => a.start - b.start);
}

// =====================================================================
//  🕌 PRAYER TIMES: worked out on this device (no internet needed) with the adhan library,
//  Dubai method, Shafi madhab, at the family's place from Settings (Al Barsha, Dubai by default).
//  Each prayer is a thin 🕌 line with its time, ON TOP of the calendar: it never blocks anything,
//  and "Plan my week" ignores it. Inside an activity when one is happening then.
//  Each person chooses for themselves (showPrayer on the person, the same on all their devices).
//  Someone who said No never sees prayer times or reminders.
// =====================================================================
const prayerCache = {};   // "date|lat|lng" → [{ key, name, start }] (so it's worked out once per day)
// The 5 times on a date, in minutes since midnight on this device's clock ([] if the library isn't loaded)
function prayerTimes(dt) {
  const p = data.prayer, key = `${ymd(dt)}|${p.lat}|${p.lng}`;
  if (prayerCache[key]) return prayerCache[key];
  if (typeof adhan === "undefined") return [];   // (not loaded: no internet the very first time) — try again next time
  try {
    const params = adhan.CalculationMethod.Dubai();
    params.madhab = adhan.Madhab.Shafi;
    const t = new adhan.PrayerTimes(new adhan.Coordinates(p.lat, p.lng), new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()), params);
    return prayerCache[key] = PRAYERS_LIST.map(([k, name]) => ({ key: k, name, start: t[k].getHours() * 60 + t[k].getMinutes() }))
      .filter(x => Number.isFinite(x.start));
  } catch (e) { console.warn("Prayer times:", e); return []; }
}
// Does the person using the app want to see prayer times? (Only a clear Yes: not asked yet / No = no.)
const seesPrayer = () => exists(me) && userById(me).showPrayer === true;
// The prayer lines on a date ("2026-10-23"), for the person using the app
function prayersOn(ds) { return feat("prayer") && seesPrayer() ? prayerTimes(fromYmd(ds)) : []; }   // (⚙️ off: no prayer lines)
// The thin line: "🕌 Asr 3:42 PM"
const prayLineHtml = (p, inside) => `<span class="k-pray ${inside ? "in" : ""}" title="🕌 ${p.name} ${clock(p.start, true)}${inside ? " (during this)" : ""}">🕌 ${p.name} ${clock(p.start, true)}</span>`;
// "Fajr 4:58 AM · Dhuhr 11:32 AM …" for today (Settings)
function prayerTodayText() {
  const list = prayerTimes(new Date());
  return list.length ? list.map(x => `${x.name} ${clock(x.start, true)}`).join(" · ") : "⚠ Prayer times aren't loaded yet. Connect to the internet once.";
}
// 🔔 "🕌 Time for Asr": while the app is open, once per prayer per day on this device (only for people who want it)
const PRAYER_SEEN = SAVE_KEY + ".prayerSeen";
function checkPrayerReminder() {
  if (!seesPrayer() || userById(me).prayerRemind === false) return;
  const now = new Date(), min = now.getHours() * 60 + now.getMinutes();
  const due = prayerTimes(now).find(x => min >= x.start && min < x.start + PRAYER_MIN);
  if (!due) return;
  const key = `${ymd(now)}|${due.key}`;
  let seen = "";
  try { seen = localStorage.getItem(PRAYER_SEEN) || ""; } catch (e) {}
  if (seen === key) return;
  try { localStorage.setItem(PRAYER_SEEN, key); } catch (e) {}
  toast(`🕌 Time for ${due.name}`, 8000);
}
setInterval(checkPrayerReminder, 30 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkPrayerReminder(); });
// The thin strips around an activity: "🎒 Get ready" before it and "☕ Break" after it (no points).
// They keep the activity's people busy (and Bro2a too if it needs him). Used for fixed AND flexible activities.
function padsFor(act, start, end) {
  const pads = [], people = peopleOf(act);
  if (act.getReady) pads.push({ routine: true, pad: true, id: `ready-${act.id}-${start}`, name: "Get ready", emoji: "🎒",
                                start: Math.max(0, start - act.getReady), end: start, users: people, before: act.name });
  if (act.breakAfter) pads.push({ routine: true, pad: true, id: `break-${act.id}-${end}`, name: "Break", emoji: "☕",
                                  start: end, end: Math.min(24 * 60, end + act.breakAfter), users: people, after: act.name });
  return pads;
}
// The strips to draw. person = only that person's (null = everyone's).
// The same routine at the same time for several people becomes ONE strip (e.g. Lunch for everyone).
function routineStrips(list, person) {
  const strips = [];
  for (const r of list) {
    if (person && !r.users.includes(person)) continue;
    const same = strips.find(s => s.name === r.name && s.start === r.start && s.end === r.end);
    if (same) same.users = data.users.map(u => u.id).filter(id => same.users.includes(id) || r.users.includes(id));
    else strips.push({ ...r });
  }
  return strips;
}
const isEveryone = ids => data.users.every(u => ids.includes(u.id));
// "Every day", "Mon–Fri", "Sat, Sun", "Mon, Wed, Fri"
function daysText(days) {
  const key = [...days].sort().join();
  return key === "0,1,2,3,4,5,6" ? "Every day" : key === "0,1,2,3,4" ? "Mon–Fri" : [...days].sort().map(d => SHORT[d]).join(", ");
}

// Can this activity go on this day from "start" to "end"?
// Only activities that keep the SAME person busy matter (its owner, and Dad if it needs Dad).
// mode "empty"   → those people must be completely free then.
// mode "share"   → it may share time, but only with activities you ticked in its
//                  "Can be done at the same time as" list, and nobody is in more than the max at once.
// mode "onFixed" → like "share", but it MUST be on top of a fixed activity you picked.
function fitsAt(day, start, end, act, mode) {
  // Must be inside "My day". Fixed activities are in day.items, so the checks below keep it
  // out of them — unless it's allowed to share with that fixed activity. So it only lands in free time.
  if (!day.window || start < day.window[0] || end > day.window[1]) return false;
  // "Only between": the activity itself must be inside its time (its get ready / break may stick out)
  if (act.lo != null && (start < act.lo || end > act.hi)) return false;
  const people = peopleOf(act);
  const touching = day.items.filter(it => it.start < end && start < it.end && it.people.some(p => people.includes(p)));
  // Kids can't do anything while they're at School (or in another fixed activity of theirs):
  // a kid's fixed activity always blocks that kid, even if "can be done at the same time" was ticked.
  if (touching.some(it => it.fixed && !it.routine && it.people.some(p => !isParentId(p) && people.includes(p)))) return false;
  if (mode === "onFixed" && !touching.some(it => it.fixed)) return false; // not on top of a fixed one
  if (!touching.length) return true;                                  // those people are free: fits
  if (mode === "empty") return false;
  // Every activity already at that time must be on this activity's list.
  if (touching.some(it => !act.overlapWith.includes(it.actId))) return false;
  // Check every moment where the number of activities could change, for each person.
  const moments = [start, ...touching.map(it => it.start).filter(t => t > start && t < end)];
  return moments.every(t => people.every(p =>
    1 + touching.filter(it => it.people.includes(p) && it.start <= t && t < it.end).length <= data.maxTogether));
}

// Find the earliest start time on this day where the activity fits.
// (This packs things tightly so as much as possible fits. spreadDay below then spaces them out.)
// Good places to try: the start of the day, the start or end of other activities,
// and "finish exactly when another activity ends".
function earliestStart(day, act, mode) {
  if (!day.window) return null;
  const tries = [day.window[0], ...(act.lo != null ? [act.lo] : []), ...day.items.flatMap(it => [it.start, it.end, it.end - act.duration])]
    .filter(t => t >= day.window[0])
    .sort((a, b) => a - b);
  for (const t of tries) if (fitsAt(day, t, t + act.duration, act, mode)) return t;
  return null;
}

// After the week is planned, this spaces out each day's flexible activities
// so they're spread over the free time instead of all stacked at the start.
// It only moves activities that don't share time with anything, and only to times when
// all their people are free — so no rule can be broken by moving them.
// Each one moves to where it has the most room around it (so there's a 10-minute break or more when possible).
// An activity with "Only between" stays inside that time (it.lo / it.hi), and is spread out inside it.
function spreadDay(day) {
  if (!day.window) return;
  const shares = (a, b) => a.people.some(p => b.people.includes(p));
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  // (📌 pinned activities stay exactly where Bro2a put them)
  const movable = day.items.filter(it => !it.fixed && !it.pinned && !it.kept && !day.items.some(o => o !== it && shares(it, o) && overlaps(it, o)));
  for (let pass = 0; pass < 3; pass++) {
    for (const it of movable) {
      const len = it.end - it.start;
      const ws = it.lo != null ? Math.max(day.window[0], it.lo) : day.window[0];
      const we = it.hi != null ? Math.min(day.window[1], it.hi) : day.window[1];
      const others = day.items.filter(o => o !== it && shares(it, o));
      // The room around it if it starts at s: the smallest gap to its neighbors or the edges of the day (-1 = clash)
      const room = s => {
        const e = s + len;
        if (s < ws || e > we) return -1;
        let gap = Math.min(s - ws, we - e);
        for (const o of others) {
          if (o.start < e && s < o.end) return -1;
          gap = Math.min(gap, o.end <= s ? s - o.end : o.start - e);
        }
        return gap;
      };
      let bestStart = it.start, best = room(it.start);
      for (let s = Math.ceil(ws / 5) * 5; s + len <= we; s += 5) {   // try every 5 minutes (tidy times)
        const r = room(s);
        if (r > best) { best = r; bestStart = s; }
      }
      it.start = bestStart; it.end = bestStart + len;
    }
  }
}

// 📅 The plan is by date, for a ROLLING window: today + the next 6 days (days[0] = today … days[6]). Days before today never change.
// mode "replan" (💾 Save, ✨ Plan my week, "redo"): today keeps what it has and only gets new things AFTER now (Dubai time);
//      tomorrow … today+6 are planned again (📌 pins stay on their date). No saved plan yet (or "redo"): from now on.
// mode "roll" (a new day, on a parent's device): only the dates that just came into the window are planned; the rest stays as it is.
// mode "fresh" (🔄 Make a new plan): like "replan", but today's flexible items that haven't started, aren't ticked and aren't 📌 pinned
//      are planned again too (from now). Fixed activities, ticked items and 📌 one-day events stay.
// mode "fill" (📌 a one-day event moved some items away): everything saved stays; only what's missing is placed again, from now on.
// A deleted activity's items stay on the days that are gone, and today if they started or were ticked (history).
// Fixed activities and routines go by weekday (a Monday activity is on every Monday date).
// 📌 One-day events keep their people busy (nothing is planned on top), and an activity "removed for that day" isn't put back on that date.
function makePlan(mode = "replan") {
  const warnings = [];
  const old = hasPlan() ? data.plan : null, today = todayYmd(), now = dubaiMinutes(), dates = aheadDates();
  // Kept exactly as saved: "replan" / "fresh" → up to today; "roll" → every date that was already planned (none when the plan is
  // older than today); "fill" → every date
  const keepUpTo = !old ? addDaysYmd(today, -1) : mode === "roll" ? (old.upTo >= today ? old.upTo : addDaysYmd(today, -1))
    : mode === "fill" ? dates[dates.length - 1] : today;
  const open = ds => ds > keepUpTo || ((mode === "replan" || mode === "fresh" || mode === "fill") && ds >= today);   // can this date get new things?
  const savedOn = ds => (old && old.dates[ds] && old.dates[ds].items) || [];

  // STEP A: For each date, note "My day" (its weekday's hours), and how much free time each person has.
  // (Dates that only keep what they have: no room for anything new. Today: only from now, on a tidy 5 minutes.)
  const days = dates.map(ds => {
    const w = dayWindow(weekdayOf(ds)), s = ds === today ? Math.max(w[0], Math.ceil(now / 5) * 5) : w[0];
    return { date: ds, items: [], window: !open(ds) || s >= w[1] ? null : [s, w[1]] };
  });
  const capacity = dates.map(ds => Object.fromEntries(data.users.map(u => [u.id, totalLength(freeFor(weekdayOf(ds), u.id))])));

  // STEP A2: the saved items of the kept dates, as they are
  const keptOf = {};   // flexible activity id → the days (0 = today) it's already on (they count towards its "times a week")
  days.forEach((day, d) => { if (day.date <= keepUpTo) savedOn(day.date).forEach(it => {
    const act = (it.fixed ? data.fixed : data.flexible).find(a => a.id === it.actId);
    const ticked = Object.keys(data.points.marks).some(k => k.startsWith(`${day.date}|${it.actId}|`));
    // a deleted activity is gone from now on (today: unless it already started or was ticked)
    if (!act && (day.date > today || (it.start > now && !ticked))) return;
    // 🔄 Make a new plan: today's flexible items that haven't started (not ticked, not pinned) are planned again
    if (mode === "fresh" && day.date === today && !it.fixed && it.start > now && !ticked && !it.pinned) return;
    const pre = act && !it.fixed ? act.getReady || 0 : 0, post = act && !it.fixed ? act.breakAfter || 0 : 0;
    const people = act ? peopleOf(act) : it.gone ? it.gone.people : [];
    day.items.push({ name: act ? act.name : "", start: it.start - pre, end: it.end + post, pre, post, fixed: !!it.fixed,
                     kept: it, actId: it.actId, users: act ? act.users : people, people });
    if (act && !it.fixed) (keptOf[act.id] = keptOf[act.id] || []).push(d);
  }); });

  // STEP B: Put fixed activities at their exact times, on the dates of their weekdays that can get new things.
  // (Today: only if it isn't there yet and starts from now.)
  for (const f of data.fixed) {
    const s = toMin(f.start), e = toMin(f.end), people = peopleOf(f);
    for (const [d, day] of days.entries()) {
      if (!f.days.includes(weekdayOf(day.date)) || !open(day.date) || skippedOn(day.date, f.id)) continue;
      if (day.items.some(it => it.kept && it.actId === f.id) || (day.date === today && s < now)) continue;   // (already there, or started)
      // Same person busy twice at once? (activities you allowed together are fine)
      // (Different people at the same time is always fine.)
      const clash = days[d].items.find(it => it.start < e && s < it.end && it.people.some(p => people.includes(p)) && !f.overlapWith.includes(it.actId));
      if (clash) {
        const busy = clash.people.find(p => people.includes(p));
        warnings.push(`${busyTwice(busy, { ...f, start: s, end: e }, clash, "on " + dayName(day.date))}. Please edit one of them.`);
      }
      days[d].items.push({ name: f.name, start: s, end: e, fixed: true, actId: f.id, users: f.users, people });
    }
  }
  // Routines (and "Get ready" before fixed activities) keep their people busy like fixed activities,
  // so lessons are never placed on top of them. (A routine during a fixed activity, like lunch at school, is fine.)
  // (🕌 Prayer times are NOT here: they never block anything.)
  days.forEach(day => routinesOn(weekdayOf(day.date)).forEach(r =>
    day.items.push({ ...r, fixed: true, actId: r.id, people: r.users })));
  // 📌 One-day events: their people are busy then (like a routine: never saved in the plan, never scored)
  days.forEach(day => oneDayOn(day.date).forEach(e =>
    day.items.push({ routine: true, fixed: true, name: e.title, actId: e.id, start: toMin(e.from), end: toMin(e.to), users: e.who, people: e.who })));
  // How full a person's free time is on day d (0 = empty, 1 = full) with flexible activities.
  // For an activity, we look at the busiest of its people (e.g. the kid AND Dad).
  const fullness = (d, people) => Math.max(...people.map(p => capacity[d][p]
    ? Math.min(1, busyMinutes(days[d].items.filter(it => !it.fixed && it.people.includes(p))) / capacity[d][p]) : 1));

  // STEP C: Place flexible activities.
  // Order: activities that can't share time with anything go first (they need empty time, so they're harder),
  // then the longest ones first, because big blocks are the hardest to fit.
  const canShare = a => a.overlapWith.length > 0 ? 1 : 0;
  const ordered = [...data.flexible].sort((a, b) => (canShare(a) - canShare(b)) || (b.duration - a.duration));

  // 📌 Activities Bro2a moved by hand are pinned: put them first, exactly where he put them.
  // The others are planned around them.
  // (Only the pins on the dates planned again; the ones on kept dates are already there, see STEP A2.)
  const pinnedOf = keptOf;   // activity id → the days it's pinned (or kept) on
  days.forEach((day, d) => day.date > keepUpTo && savedOn(day.date).forEach(it => {
    const act = !it.fixed && it.pinned && data.flexible.find(a => a.id === it.actId);
    if (!act) return;
    const pre = act.getReady || 0, post = act.breakAfter || 0;
    days[d].items.push({ name: act.name, start: it.start - pre, end: it.start + act.duration + post, pre, post, pinned: true,
                         actId: act.id, users: act.users, people: peopleOf(act) });
    (pinnedOf[act.id] = pinnedOf[act.id] || []).push(d);
  }));

  for (const act0 of ordered) {
    // "Get ready before" and "Break after" are busy time too: we place the whole span
    // (get ready + activity + break) so nothing else for these people goes inside it.
    const pre = act0.getReady || 0, post = act0.breakAfter || 0;
    // "Only between" → where the whole span may be (lo–hi): the activity itself inside the time, get ready / break around it
    const only = onlyWindow(act0);
    const act = { ...act0, duration: pre + act0.duration + post, ...(only ? { lo: only[0] - pre, hi: only[1] + post } : {}) };
    const people = peopleOf(act);
    const usedDays = [...(pinnedOf[act.id] || [])]; // days that already have this activity (never twice in one day)

    // The order of tries for this activity:
    // Try 1 (only if you picked a fixed activity for it): put it on top of that fixed activity.
    // Try 2: find completely free time.
    // Try 3 (only if you picked partners for it): allow sharing time with any of its partners.
    const sharingOn = canShare(act) && data.maxTogether > 1;
    const hasFixedPartner = act.overlapWith.some(id => data.fixed.some(f => f.id === id));
    const modes = [...(sharingOn && hasFixedPartner ? ["onFixed"] : []), "empty", ...(sharingOn ? ["share"] : [])];

    // ("times a week" = times inside the 7-day window, today included; the kept and pinned ones already count)
    for (let n = usedDays.length; n < Math.min(act.times, days.length); n++) {
      let best = null;
      for (const mode of modes) {
        for (let d = 0; d < days.length; d++) {
          if (usedDays.includes(d)) continue;                             // rule: never twice on the same date
          if (skippedOn(days[d].date, act.id)) continue;                  // (📌 removed for that day by a one-day event)
          const start = earliestStart(days[d], act, mode);
          if (start === null) continue;                                   // doesn't fit this day
          // Score the day: emptier days win (balance),
          // and days far from the other sessions get a small bonus (spread out over the window).
          const gap = u => Math.abs(u - d);
          const distance = usedDays.length ? Math.min(...usedDays.map(gap)) : 0;
          const score = fullness(d, people) - distance * 0.05;
          if (!best || score < best.score) best = { d, score, start };
        }
        if (best) break; // found a spot, no need for the next try
      }
      // 2️⃣ Last try (unless switched off): no new day has room → make its session LONGER on a day that already has it
      // (one block, one tick, one worksheet for the whole time). Each day's session gets longer only once.
      if (!best && act0.twice !== false) {
        for (const mode of modes) {
          for (const d of [...new Set(usedDays)]) {
            const day = days[d], it = day.items.find(x => x.actId === act.id && !x.kept && !x.pinned && !x.fixed && !x.longer);
            if (!it || skippedOn(day.date, act.id)) continue;
            const others = day.items.filter(x => x !== it), len = it.end - it.start + act0.duration;
            const start = earliestStart({ ...day, items: others }, { ...act, duration: len }, mode);
            if (start === null) continue;
            const score = fullness(d, people);
            if (!best || score < best.score) best = { d, score, start, it, len };
          }
          if (best) break;
        }
        if (best) {   // (start/end are the whole span: get ready + the longer session + break)
          Object.assign(best.it, { start: best.start, end: best.start + best.len, longer: true });
          usedDays.push(best.d);
          continue;
        }
      }
      if (!best) break; // no day has room left

      // (start/end here are the whole span; pre/post say how much of it is get ready / break)
      days[best.d].items.push({ name: act.name, start: best.start, end: best.start + act.duration, pre, post,
                                actId: act.id, users: act.users, people, ...(only ? { lo: act.lo, hi: act.hi } : {}) });
      usedDays.push(best.d);
    }

    // STEP D: Warn if we couldn't place everything.
    if (usedDays.length < act.times) {
      const missing = act.times - usedDays.length;
      const tips = [...(only ? ["a wider “Only between” time (or ✕ Any time)"] : []), "a longer day (in Settings)", "shortening it", "reducing how often"];
      if (helperOf(act)) tips.push(`another parent in “🤝” (${helperOf(act).name} is busy)`);
      tips.push(canShare(act) ? "picking more activities it can be done with, or raising “Max activities at the same time”"
                              : "picking activities it can be done at the same time as");
      const where = only ? ` inside its time 🕓 ${betweenText(act0.between)}` : "";
      warnings.push(`"${act.name}" (${usersText(act.users)}) only fit ${usedDays.length} of ${act.times} times${where} (${missing} missing). Try ${tips.join(", ")}.`);
    }
  }

  // STEP E: Space out each day's activities (with 10-minute breaks when possible).
  days.forEach(day => { spreadDay(day); day.items.sort((a, b) => a.start - b.start); });
  return { days, warnings };
}

// ---------- The saved plan ----------
// A "fingerprint" of everything the plan depends on. If it changes, the plan is old.
function planKey() {
  const pads = f => f.getReady || f.breakAfter ? [f.getReady || 0, f.breakAfter || 0] : [];   // get ready / break
  // 🤝 the helper as the older "Needs Dad" was (Bro2a → true, nobody → false), so plans made before still count as up to date
  const helps = f => f.helper === DAD ? true : f.helper || false;
  return JSON.stringify({
    fx: data.fixed.map(f => [f.id, f.days, f.start, f.end, [...f.overlapWith].sort(), f.users, helps(f), ...pads(f)]),
    // (the "Only between" time only when it's set, so plans made before it existed still count as up to date)
    fl: data.flexible.map(f => [f.id, f.duration, f.times, [...f.overlapWith].sort(), f.users, helps(f), ...pads(f),
                                ...(f.between ? [{ only: [f.between.from, f.between.to] }] : []), ...(f.twice === false ? [{ once: true }] : [])]),
    day: [data.myDay.start, data.myDay.end, data.myDay.weekendOwn, data.myDay.weekendStart, data.myDay.weekendEnd],
    // (🕗 each day's own hours: only when they're set, so a plan made before still counts as up to date)
    ...(data.myDay.days ? { days: data.myDay.days.map(x => [x.start, x.end]) } : {}),
    max: data.maxTogether,
    // (only when there are routines, so a plan made before routines existed still counts as up to date)
    ...(data.routines.length ? { rt: data.routines.map(r => [r.id, r.days, r.start, r.duration, r.users]) } : {})
  });
}
function planIsOld() { return !!data.plan && data.plan.key !== planKey(); }
const hasPlan = () => !!data.plan && data.plan !== "redo";
// Plan now and keep it (only the times; names and colors are looked up when drawing). mode: "replan" | "roll" (see makePlan)
// data.plan = { dates: { "2026-10-23": { items } }, warnings, key, upTo: the last date planned (today + 6) }
function makeAndKeepPlan(mode = "replan") {
  const old = hasPlan() ? data.plan : null, p = makePlan(mode), today = todayYmd(), keepFrom = addDaysYmd(today, -PLAN_KEEP);
  const dates = {};
  // The days that are gone stay exactly as saved (only the last 14 days are kept)
  if (old) Object.entries(old.dates).forEach(([ds, day]) => { if (ds >= keepFrom && ds < today) dates[ds] = { items: day.items.map(it => ({ ...it })) }; });
  // (routines aren't saved in the plan: they're added live when drawing)
  // (the plan keeps the activity's own times: the get ready / break around it are added when drawing)
  // (kept items are saved exactly as they were)
  p.days.forEach(day => dates[day.date] = { items: day.items.filter(it => !it.routine).map(it => it.kept ? { ...it.kept } :
    ({ actId: it.actId, fixed: !!it.fixed, start: it.start + (it.pre || 0), end: it.end - (it.post || 0), ...(it.pinned ? { pinned: true } : {}) })) });
  // (a new day, or 📌 a one-day event's moves, only add items: the notes and the "up to date" mark stay as the last Save / Plan my week left them)
  const roll = (mode === "roll" || mode === "fill") && old;
  data.plan = { dates, warnings: roll ? old.warnings : p.warnings, key: roll ? old.key : planKey(), upTo: addDaysYmd(today, PLAN_AHEAD) };
  return p;
}
// 📅 A new day: the date that comes into the window (today + 6) is planned, the others stay as they are.
// Only on a parent's device, with no unsaved changes, and (with the family cloud) once it's online and signed in. → true when planned
function rollPlan() {
  if (!hasPlan() || !isParentDevice() || hasDraft() || editMode || (cloud.enabled && !cloud.ready)) return false;
  if ((data.plan.upTo || "") >= addDaysYmd(todayYmd(), PLAN_AHEAD)) return false;
  makeAndKeepPlan("roll");
  return true;
}
// The "Plan my week" button (Dad only)
function planNow() {
  if (!isParentId(me)) return;
  const p = makeAndKeepPlan();
  writeData();
  go("all");
  toast(p.warnings.length ? "✨ Planned! A few things need your attention." : "✨ Everyone's week is planned!");
}
// 🔄 Make a new plan (a parent's device): today (from now) up to the end of the plan is planned again.
// Fixed activities, everything already ticked (or started, or 📌 pinned) and 📌 one-day events stay (see makePlan, mode "fresh").
function newPlanNow() {
  if (!isParentDevice()) return;
  if (hasDraft()) return toast("💾 Save your changes first, then make a new plan.", 3500);
  if (!confirm("Re-plan this week from today? Ticks already done stay.")) return;
  const p = makeAndKeepPlan("fresh");
  writeData();
  render();
  toast(p.warnings.length ? "🔄 New plan made! A few things need your attention." : "🔄 New plan made! Ticks already done stayed.", 3500);
}
