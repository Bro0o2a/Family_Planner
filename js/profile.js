// =====================================================================
//  👤 MY PROFILE: the Spark, name / colour / emoji, 🎂 birthday, 🎒 school, ❤️ things I love, this week, 🚪 sign out
//   A kid opens only their own; a parent everyone's (the chips at the top). Each person changes their own emoji, colour,
//   Spark name and ❤️ boxes; the birthday: themselves or a parent. (Saved on the person: u.emoji, u.color, u.sparkName,
//   u.birthday, u.loves.)
// =====================================================================
let meWho = null, meEdit = false;
function openProfile(id) {
  id = id || me;
  if (!exists(id)) return;
  if (id !== me && !isParentViewer()) return lockedToast(id);
  meWho = id; meEdit = false;
  homeMore = false;
  go("me");
}
// 🎂 "23 days to go!" and the age (from "2016-03-14")
function birthdayInfo(b) {
  if (!b) return null;
  const now = new Date(), [y, m, d] = b.split("-").map(Number), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  const days = Math.round((next - today) / 86400000), age = next.getFullYear() - y - (days === 0 ? 0 : 1);
  return { days, age: age >= 0 && age < 120 ? age : null, label: `${d} ${MONTHS[m - 1]}` };
}
// This week: ✅ tasks done %, ⭐ habit ticks, 📔 the mood of each day (🧩 riddles: not here, just for fun)
function weekStats(id) {
  const from = data.points.week, to = weekEnd(), planned = plannedCount(id), done = (activityPointsByUser()[id] || 0) / POINTS_EACH;
  const ticks = Object.entries(data.habitMarks).filter(([k, v]) => { const [date, , who] = k.split("|"); return who === id && date >= from && date < to && v; }).length;
  const moods = Array.from({ length: todayIndex() + 1 }, (_, d) => { const e = diaryOf(id, ymd(dayDate(d))); return { day: SHORT[d], face: e ? moodFace(e.mood) : "" }; });
  return { pct: planned ? Math.min(100, Math.round(done / planned * 100)) : null, done, planned, ticks, moods };
}
function drawMe() {
  if (!exists(meWho) || (meWho !== me && !isParentViewer())) meWho = me;
  const u = userById(meWho), c = colorsOf(u), mine = u.id === me, kid = !isParentId(u.id), parent = isParentViewer();
  const p = lifetimePoints(u.id), L = levelOf(p), pct = levelPct(p), k = weekKinds(u.id), st = weekStats(u.id), bd = birthdayInfo(u.birthday);
  const chips = parent ? `<div class="chips me-chips">${data.users.map(x => { const xc = colorsOf(x); return `<button class="chip ${x.id === u.id ? "on" : ""}" data-mewho="${safe(x.id)}"
    style="--soft:${xc.soft};--ink:${xc.ink}"><span class="e">${faceHtml(x)}</span>${x.id === me ? "Me" : safe(x.name)}</button>`; }).join("")}</div>` : "";
  const loves = LOVES.map(([key, e, label]) => { const v = (u.loves || {})[key]; return v ? `<li><span>${e} ${label}</span><b>${safe(v)}</b></li>` : ""; }).join("");
  // ⚙️ My settings: each person changes ALL their own things (kids too, from their own account); a parent also every kid's
  const canEdit = canEditProfile(u.id), canBirthday = canEdit, s = kid ? schoolOf(u.id) : null, my = mine ? "My" : `${safe(u.name)}'s`;
  const form = meEdit && canEdit ? `<div class="card sc-form me-form"><h2>⚙️ ${mine ? "My settings" : `Settings for ${safe(u.name)}`}</h2>
      <h3 class="ph-group">👤 ${mine ? "Me" : safe(u.name)}</h3>
      <label class="small" for="meName">📝 Name</label><input type="text" id="meName" maxlength="30" value="${safe(u.name)}">
      ${isParentId(u.id) ? `<label class="small">🖼️ ${my} picture: an emoji or a photo</label>
        <div class="me-pic"><span class="me-pic-now" id="mePicNow">${mePicHtml(u)}</span>
          <button type="button" class="pill" data-mephoto>📷 Take or choose a photo</button>
          <button type="button" class="pill" data-menophoto ${(mePhoto !== null ? mePhoto : facePhoto(u)) ? "" : "hidden"}>😀 Use my emoji instead</button></div>
        <input type="file" id="mePhotoFile" accept="image/*" hidden>
        <p class="hint">Or tap an emoji below. A photo is cut to a square and kept small.</p>` : ""}
      <label class="small">😀 ${my} emoji</label><div class="emoji-pick me-emojis">${[...new Set([u.emoji, ...EMOJIS])].map(e => `<button type="button" class="${e === u.emoji ? "on" : ""}" data-meemoji="${e}" aria-label="Use ${e}">${e}</button>`).join("")}</div>
      <label class="small">🎨 ${my} colour</label><div class="swatches me-colors">${Object.entries(PALETTE).map(([key, x]) => `<label title="${key}"><input type="radio" name="meColor" value="${key}" ${u.color === key ? "checked" : ""}><span style="background:${x.color}"></span></label>`).join("")}</div>
      <label class="small" for="meBirthday">🎂 Birthday</label><input type="date" id="meBirthday" value="${safe(u.birthday || "")}">
      ${hasSpark(u.id) ? `<h3 class="ph-group">✨ ${my} Spark</h3>
        <div class="btnrow"><button type="button" class="pill" data-mespark>✨ ${u.buddy ? "Change the Spark" : "Pick a Spark"}</button></div>
        <p class="hint">Change it any time: the level and points stay.</p>
        ${u.buddy ? `<label class="small" for="meSpark">✨ Spark's name</label><input type="text" id="meSpark" maxlength="12" value="${safe(u.sparkName || "")}" placeholder="Zozo">` : ""}` : ""}
      ${kid ? `<h3 class="ph-group">🏫 School</h3>${schoolFieldsHtml("me", u)}
        <h3 class="ph-group">📘 ${my} subjects</h3><p class="hint">The same subjects as in 🎒 School. Untick "Show" to hide one (its work is kept).</p>
        ${subjectList(s, true).map(f => `<div class="me-subrow"><span class="e">${safe(f.emoji)}</span>
          <input type="text" id="mesub-${safe(f.id)}" maxlength="30" value="${safe(f.name)}" aria-label="Subject name">
          <label class="checkline"><input type="checkbox" id="meshow-${safe(f.id)}" ${f.hidden ? "" : "checked"}> 👁️ Show</label></div>`).join("")}
        <label class="small" for="meSubNew">➕ Add a subject</label><input type="text" id="meSubNew" maxlength="30" placeholder="French, Computing…">` : ""}
      <h3 class="ph-group">❤️ Things ${mine ? "I" : "they"} love</h3>${LOVES.map(([key, e, label]) => `<label class="small" for="meLove-${key}">${e} ${label}</label>
        <input type="text" id="meLove-${key}" maxlength="30" value="${safe((u.loves || {})[key] || "")}">`).join("")}
      ${mine ? `<div class="btnrow"><button type="button" class="pill" data-go="settings">🕌 Prayer times</button></div>` : ""}
      <div class="err" id="meErr"></div>
      <div class="btnrow"><button class="primary" data-mesave>💾 Save</button><button data-mecancel>Cancel</button></div></div>` : "";
  // 👨‍👩‍👧 Family settings (parents only, at the bottom of their own profile): people & codes, features, prayer city, backup
  const famSettings = mine && parent ? `<div class="card me-card me-family"><h2>👨‍👩‍👧 Family settings</h2><div class="me-famlinks">
      ${isParentId(me) ? `<button class="pill" data-go="family">👨‍👩‍👧 Add a kid or parent · 🔑 Codes</button>` : ""}
      <button class="pill" data-setupopen>⚙️ Features on / off</button>
      <button class="pill" data-go="settings">🕌 Prayer city · ⏰ My day · 💾 Backup</button></div></div>` : "";
  // 👤 Who this device is signed in as (a parent on the family's main login can say "Not you?": the picker again; kids never)
  const meU = userById(me), notYou = !isKidDevice() && isParentId(me) && isMainLogin(cloudMeta().member) && parentsList().length > 1;
  const signedIn = exists(me) ? `<p class="me-signed">Signed in as: <b>${whoHtml(me)}</b>${notYou ? `<button class="linkbtn" data-menotyou>Not you?</button>` : ""}</p>` : "";
  $("meBody").innerHTML = `${signedIn}${chips}
    <div class="card me-top" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
      <div class="me-face">${faceHtml(u)}</div>
      <div class="me-name"><h1>${safe(u.name)}</h1><small>${mine ? "👤 My profile" : "👤 Profile"}</small></div>
      ${hasSpark(u.id) ? `<button class="me-spark" data-mespark aria-label="${sparkName(u, true)}: level ${L}, ${pct}% to level ${L + 1}">
        <span class="bu-ring bu-big" aria-hidden="true">${buddyRingSvg(pct)}<span class="bu-in"><span class="e">${buddyFace(u.id, L)}</span><b>Lv ${L}</b></span></span>
        <span class="bu-text"><b>${pct}% to Lv ${L + 1}</b><small>${u.buddy ? `✨ ${safe(sparkName(u, true))}` : "✨ Pick your Spark"}${kid ? ` · ⭐ ${p} points in all` : ""}</small></span></button>` : ""}
      ${kid ? `<p class="me-kinds">This week: ${kindsText(k)}</p>` : ""}
    </div>
    ${form}
    <div class="card me-card"><h2>🎂 Birthday</h2>${bd ? `<p class="me-big">${bd.days === 0 ? "🎉 Happy birthday!" : `🎂 ${bd.days} ${bd.days === 1 ? "day" : "days"} to go!`}</p>
      <p class="hint">${bd.label}${bd.age != null ? ` · ${bd.age} years old` : ""}</p>` : `<p class="sc-empty">${canBirthday ? "Add it in ⚙️ Settings." : "Not added yet."}</p>`}</div>
    ${kid ? schoolBasicsHtml(u.id, canEdit) : ""}
    <div class="card me-card"><h2>❤️ Things I love</h2>${loves ? `<ul class="me-list">${loves}</ul>` : `<p class="sc-empty">${canEdit ? "Fill them in with ⚙️ Settings." : "Nothing yet."}</p>`}</div>
    ${kid ? `<div class="card me-card"><h2>📅 This week</h2>${scoreBlockHtml(scoreOf(u.id))}<ul class="me-list">
      ${st.pct != null ? `<li><span>✅ Tasks done</span><b>${st.pct}% <small>(${st.done} of ${st.planned})</small></b></li>` : ""}
      <li><span>⭐ Habit ticks</span><b>${st.ticks}</b></li>
      ${(f => f.count ? `<li><span>⭐ Free study</span><b>${f.count} ${f.count === 1 ? "worksheet" : "worksheets"}, ${f.points} points</b></li>` : "")(freeStudy(u.id))}</ul>
      ${feat("diary") && canSeeMood(u.id) ? `<div class="me-moods">${st.moods.map(x => `<span><b>${x.face || "·"}</b><small>${x.day}</small></span>`).join("")}</div>` : ""}</div>` : ""}
    ${famSettings}
    <div class="btnrow me-btns">${canEdit && !meEdit ? `<button class="pill primary" data-meedit>⚙️ ${mine ? "My settings" : `Settings for ${safe(u.name)}`}</button>` : ""}</div>`;   // (🚪 Sign out: top right of every screen)
}
// 📜 While a pop-up is open (a box, 👋 the tour, 🌱 a level up), the page behind doesn't scroll (see the CSS "EVERY pop-up")
const popupOpen = () => !!document.querySelector(".k-modal:not([hidden]), .tour, .lvl-up");
new MutationObserver(() => document.documentElement.classList.toggle("popup-open", popupOpen()))
  .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });

// =====================================================================
//  🧒 FIRST-TIME KID SETUP (a parent's home, one kid at a time): name, birthday, 🏫 school (the searchable Dubai list),
//   📚 curriculum, 🎓 year / grade, 📘 subjects (suggested by the curriculum, tick to keep). All saved in that kid's 👤 profile.
//   For a kid with no school data yet; "Skip for now" is fine. Asked once only (u.setupAsked, on every device).
// =====================================================================
const SUBJECTS_BY_CURRICULUM = {
  British: ["Math", "English", "Science", "Arabic", "Islamic", "French", "Computing", "Geography", "History", "PE", "Art", "Music"],
  "British IGCSE": ["Math", "English", "Science", "Arabic", "Islamic", "French", "Computing", "Geography", "History", "Business"],
  American: ["Math", "English", "Science", "Social Studies", "Arabic", "Islamic", "French", "Computing", "PE", "Art"],
  IB: ["Math", "English", "Science", "Individuals & Societies", "Arabic", "Islamic", "French", "Design", "PE", "Art"],
  CBSE: ["Math", "English", "Science", "Social Science", "Hindi", "Arabic", "Islamic", "Computing", "PE"],
  ICSE: ["Math", "English", "Science", "History & Civics", "Geography", "Hindi", "Arabic", "Computing"],
  "UAE MOE": ["Math", "Arabic", "English", "Science", "Islamic", "Social Studies", "Moral Education", "Computing", "PE"],
  French: ["Math", "French", "English", "Science", "Arabic", "Islamic", "History & Geography"],
  German: ["Math", "German", "English", "Science", "Arabic", "Islamic"]
};
const CORE_SUBJECTS = ["Math", "English", "Science", "Arabic"];
const setupPending = u => !isParentId(u.id) && u.setupAsked !== true && !u.school && !u.curriculum && !u.year && !schoolOf(u.id).info.name;
function setupKid() { return isParentDevice() && !isKidDevice() ? kidsList().find(setupPending) || null : null; }
let ksCurr = null;   // (the curriculum the subject list was made for)
function ksSubjectsHtml(kid, curriculum) {
  const s = schoolOf(kid), have = subjectList(s, true).filter(f => !f.hidden).map(f => f.name);
  const sugg = SUBJECTS_BY_CURRICULUM[curriculumShort(curriculum)] || [...CORE_SUBJECTS, "Islamic"];
  const all = [...have, ...sugg.filter(n => !have.some(h => sameSubject(h, n)))];
  return all.map((n, i) => { const known = findSubject(n), on = have.some(h => sameSubject(h, n)) || (!have.length && CORE_SUBJECTS.includes(n));
    return `<label class="ks-sub"><input type="checkbox" name="ksSub" value="${safe(n)}" ${on ? "checked" : ""}><span>${known ? known.emoji : "📘"} ${safe(n)}</span></label>`; }).join("");
}
function kidSetupHtml() {
  const u = setupKid();
  if (!u) return "";
  ksCurr = u.curriculum || "";
  const left = kidsList().filter(setupPending).length;
  return `<div class="card sc-form ks-card" id="ksCard" data-kid="${safe(u.id)}"><h2>👋 Let's set up ${safe(u.emoji)} ${safe(u.name)}</h2>
    <p class="hint">One minute${left > 1 ? ` · ${left} kids to go, one at a time` : ""}. It's all saved in ${safe(u.name)}'s 👤 profile (changeable any time).</p>
    <div class="row"><div><label class="small" for="ksName">📝 Name</label><input type="text" id="ksName" maxlength="30" value="${safe(u.name)}"></div>
      <div><label class="small" for="ksBirthday">🎂 Birthday</label><input type="date" id="ksBirthday" value="${safe(u.birthday || "")}"></div></div>
    ${schoolFieldsHtml("ks", u)}
    <label class="small">📘 Subjects <small>(tick to keep)</small></label><div class="ks-subs" id="ksSubs">${ksSubjectsHtml(u.id, ksCurr)}</div>
    <div class="err" id="ksErr"></div>
    <div class="btnrow"><button class="primary" data-kssave>💾 Save</button><button data-ksskip>Skip for now</button></div></div>`;
}
// A new curriculum (picked, or from the school) → its suggested subjects (what's ticked stays ticked)
function ksRefresh() {
  const card = $("ksCard");
  if (!card) return;
  const c = schoolFieldsValue("ks").curriculum;
  if (c === ksCurr) return;
  const ticked = [...card.querySelectorAll('input[name="ksSub"]:checked')].map(x => x.value);
  ksCurr = c;
  $("ksSubs").innerHTML = ksSubjectsHtml(card.dataset.kid, c);
  $("ksSubs").querySelectorAll('input[name="ksSub"]').forEach(x => { if (ticked.includes(x.value)) x.checked = true; });
}
["change", "input", "click"].forEach(ev => document.addEventListener(ev, e => { if (e.target.closest && e.target.closest("#ksCard")) setTimeout(ksRefresh, 0); }));
function kidSetupSave(skip) {
  const card = $("ksCard"), u = card && data.users.find(x => x.id === card.dataset.kid);
  if (!u || !isParentDevice()) return;
  if (!skip) {
    const name = $("ksName").value.trim().slice(0, 30);
    if (!name) return $("ksErr").textContent = "Please type a name.";
    if (data.users.some(x => x.id !== u.id && x.name.toLowerCase() === name.toLowerCase())) return $("ksErr").textContent = "Someone already has that name.";
    u.name = name;
    const b = $("ksBirthday").value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(b)) u.birthday = b;
    const about = schoolFieldsValue("ks");
    Object.assign(u, about);
    Object.keys(about).forEach(k => { if (!u[k]) delete u[k]; });
    // 📘 Ticked: a folder (an existing one shows again) · unticked: hidden (its work is kept)
    const s = schoolFor(u.id), keep = [...card.querySelectorAll('input[name="ksSub"]:checked')].map(x => x.value);
    keep.forEach(n => ensureFolder(s, n));
    subjectList(s, true).forEach(f => { if (!keep.some(n => sameSubject(n, f.name))) s.subjects[f.id].hidden = true; });
  }
  u.setupAsked = true;   // (asked once)
  keepNow();
  toast(skip ? `Skipped. You can add it later in ${u.name}'s 👤 profile.` : `✓ Saved in ${u.name}'s 👤 profile!`, 3000);
}
document.addEventListener("click", e => {
  const b = e.target.closest("#ksCard button");
  if (!b) return;
  if ("kssave" in b.dataset) return kidSetupSave(false);
  if ("ksskip" in b.dataset) return kidSetupSave(true);
});
// Who changes a profile: the person themselves (kids too), or a parent for any kid
const canEditProfile = id => exists(id) && (id === me || (isParentViewer() && !isParentId(id)));
// 🖼️ A parent's picture while editing: null = as saved · "" = use the emoji · a new photo (a small JPEG, see takePhoto)
let mePhoto = null;
const mePicHtml = u => { const p = mePhoto !== null ? mePhoto : facePhoto(u);
  return p ? `<img class="face-img me-pic-img" src="${p}" alt="${safe(u.name)}">` : `<span class="me-pic-emoji">${safe(u.emoji)}</span>`; };
// 📷 A photo → cut to the middle square, made 160×160 and saved as a small JPEG (smaller still if it's big)
async function takePhoto(file) {
  if (!file || !/^image\//.test(file.type)) return toast("Please pick a photo.", 2500);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement("canvas");
    cv.width = cv.height = 160;
    cv.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 160, 160);
    let q = 0.82, out = cv.toDataURL("image/jpeg", q);
    while (out.length > 60000 && q > 0.3) { q -= 0.15; out = cv.toDataURL("image/jpeg", q); }
    mePhoto = out;
    $("mePicNow").innerHTML = mePicHtml(userById(meWho));
    const no = $("meBody").querySelector("[data-menophoto]");
    if (no) no.hidden = false;
  } catch (e) { toast("Couldn't read that photo. Please try another one.", 3000); }
  finally { URL.revokeObjectURL(url); }
}
document.addEventListener("change", e => { if (e.target.id === "mePhotoFile" && e.target.files[0]) takePhoto(e.target.files[0]); });
function saveMe() {
  const u = data.users.find(x => x.id === meWho);
  if (!u || !canEditProfile(u.id) || !$("meName")) return;
  const name = $("meName").value.trim().slice(0, 30);
  if (!name) return $("meErr").textContent = "Please type a name.";
  if (data.users.some(x => x.id !== u.id && x.name.toLowerCase() === name.toLowerCase())) return $("meErr").textContent = "Someone already has that name.";
  u.name = name;
  const em = ($("meBody").querySelector("[data-meemoji].on") || {}).dataset;
  if (em && em.meemoji) u.emoji = em.meemoji;
  const col = ($("meBody").querySelector('input[name="meColor"]:checked') || {}).value;
  if (col && hasOwn(PALETTE, col)) u.color = col;
  const b = $("meBirthday").value;
  if (b && /^\d{4}-\d{2}-\d{2}$/.test(b)) u.birthday = b; else delete u.birthday;
  if ($("meSpark")) { const n = $("meSpark").value.trim().slice(0, 12); if (n) u.sparkName = n; else delete u.sparkName; }
  // 🖼️ a parent's picture: the new photo, or the emoji (no photo)
  if (isParentId(u.id) && mePhoto !== null) { if (mePhoto) u.photo = mePhoto; else delete u.photo; }
  mePhoto = null;
  const loves = Object.fromEntries(LOVES.map(([key]) => [key, ($("meLove-" + key).value || "").trim().slice(0, 30)]).filter(([, v]) => v));
  if (Object.keys(loves).length) u.loves = loves; else delete u.loves;
  // 🏫 📚 🎓 the school basics and 📘 the subjects (a kid: the same subjects as in 🎒 School)
  if (!isParentId(u.id) && $("meSchool")) {
    const about = schoolFieldsValue("me");
    Object.assign(u, about);
    Object.keys(about).forEach(k => { if (!u[k]) delete u[k]; });
    const s = schoolFor(u.id);
    subjectList(s, true).forEach(f => {
      const box = $("mesub-" + f.id), show = $("meshow-" + f.id);
      if (!box) return;
      const x = s.subjects[f.id], to = box.value.trim().slice(0, 30);
      if (to && to !== x.name && !subjectList(s, true).some(y => y.id !== f.id && sameSubject(y.name, to))) {
        renameSubject(s, x.name, to); aiRenameSubject(u.id, x.name, to); x.name = to;
      }
      if (show && show.checked) delete x.hidden; else if (show) x.hidden = true;
    });
    const add = $("meSubNew").value.trim().slice(0, 30);
    if (add) ensureFolder(s, add);   // (a new folder; one with that name already: shown again)
  }
  meEdit = false;
  keepNow();
  toast("✓ Saved", 2000);
}
document.addEventListener("click", e => {
  const b = e.target.closest("#scr-me button");
  if (!b) return;
  const ds = b.dataset;
  if (ds.mewho) { meWho = ds.mewho; meEdit = false; return render(); }
  if ("menotyou" in ds) return askWhichParent(true);   // 👨‍👩‍👧 the family's main login: pick yourself again (this device only)
  if ("meedit" in ds) { meEdit = true; mePhoto = null; render(); return $("meBody").querySelector(".me-form").scrollIntoView({ behavior: "smooth", block: "start" }); }
  if ("mecancel" in ds) { meEdit = false; mePhoto = null; return render(); }
  if ("mesave" in ds) return saveMe();
  // 🖼️ a parent: 📷 take or choose a photo · 😀 use my emoji instead (tapping an emoji picks the emoji too)
  if ("mephoto" in ds) { $("mePhotoFile").value = ""; return $("mePhotoFile").click(); }
  if ("menophoto" in ds) { mePhoto = ""; $("mePicNow").innerHTML = mePicHtml(userById(meWho)); b.hidden = true; return; }
  if (ds.meemoji) {
    $("meBody").querySelectorAll("[data-meemoji]").forEach(x => x.classList.toggle("on", x === b));
    if ($("mePicNow")) { mePhoto = ""; const u = { ...userById(meWho), emoji: ds.meemoji }; $("mePicNow").innerHTML = mePicHtml(u);
      const no = $("meBody").querySelector("[data-menophoto]"); if (no) no.hidden = true; }
    return;
  }
  if ("mespark" in ds) { const w = meWho; if (!hasSpark(w)) return; openBuddyBox(w); if (userById(w).buddy && canChangeBuddy(w)) { buChange = true; drawBuddyBox(); } return; }   // ✨ pick / change the Spark
});

// ---------- 🌱 The buddy page (a pop-up box): the ring, "68% to Lv 5", points, level history, 👨‍👩‍👧 Change buddy ----------
let buWho = null, buChange = false, buFrom = null;
function openBuddyBox(id) {
  if (!hasSpark(id)) return;   // (✨ kids only)
  if (kidLockedOut(id)) return lockedToast(id);
  buWho = id; buChange = false; buFrom = document.activeElement;
  $("buddyModal").hidden = false;
  drawBuddyBox();
  const ok = $("buddyModal").querySelector("[data-buclose]");
  if (ok) ok.focus();
}
function closeBuddyBox() {
  $("buddyModal").hidden = true;
  buWho = null; buChange = false;
  if (buFrom && buFrom.isConnected) buFrom.focus();
}
function drawBuddyBox() {
  if (!exists(buWho)) return closeBuddyBox();
  const u = userById(buWho), c = colorsOf(u), p = lifetimePoints(u.id), L = levelOf(p), pct = levelPct(p);
  const picking = !u.buddy || buChange, mine = u.id === me;
  const pick = sparkPickHtml(u.id);
  $("buddyBody").style.cssText = `--c:${c.color};--soft:${c.soft};--ink:${c.ink}`;
  $("buddyBody").innerHTML = `<div class="print-title">✨ ${mine ? "My Spark" : `${safe(u.name)}'s Spark`}${u.sparkName ? ` · ${safe(u.sparkName)}` : ""}</div>
    ${!u.buddy && !mine && !canChangeBuddy(u.id) ? `<p class="print-hint">${safe(u.name)} hasn't picked a Spark yet.</p>`
      : picking ? `<p class="print-hint">${u.buddy ? "Pick a new Spark. The level and points stay the same." : "Pick your Spark! It grows with all your points. (You can change it any time in ⚙️ My settings.)"}</p>${pick}
        ${buChange ? `<button class="linkbtn bu-cancel" data-buchangecancel>Cancel</button>` : ""}` : ""}
    <div class="bu-page-top">
      <div class="bu-ring bu-big" role="img" aria-label="Level ${L}, ${pct}% to level ${L + 1}">${buddyRingSvg(pct)}
        <span class="bu-in"><span class="e">${buddyFace(u.id, L)}</span><b>Lv ${L}</b></span></div>
      <div class="bu-text"><b>${pct}% to Lv ${L + 1}</b><small>⭐ ${p} points in all</small></div></div>
    ${levelHistoryHtml(u.id)}
    ${u.buddy && !buChange && canChangeBuddy(u.id) ? `<div class="bu-change"><button class="pill" data-buchange>🔄 Change Spark</button></div>` : ""}`;
}

// ---------- ✨ The encouraging line under the top bar (every screen but the first ones; a new one each time the app opens) ----------
// Kids and parents get their own kind. A tap goes to the matching place; ✕ hides it for today (on this device).
const ENC_HIDE = SAVE_KEY + ".encHidden";
let encPick = Math.random(), encAway = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) encAway = Date.now();
  else if (encAway && Date.now() - encAway >= 30 * 60000) { encPick = Math.random(); render(); }   // (back after 30+ minutes = a new open)
});
const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
function encMessages() {
  const u = userById(me), out = [], totals = fairScores();   // (⚖️ the place on the board: by the fair score)
  const rank = fairOrder(totals).findIndex(x => x.id === me) + 1, first = name => name.split(" ")[0];
  const scored = !isParentId(me);   // (👨‍👩‍👧 parents: no points, rank or star lines)
  if (scored && feat("buddy") && u.buddy) {
    const p = lifetimePoints(me), L = levelOf(p), need = levelStart(L + 1) - p;
    out.push({ text: `Get ${need} more points and ${u.sparkName || "your Spark"} grows to Lv ${L + 1}! ✨`, go: "spark" });
  }
  if (stars().includes(me)) out.push({ text: `You're the ⭐ Shining Star this week, ${first(u.name)}! 🌟`, go: "points" });
  else if (totals[me] > 0 && rank === 1 && !starDecided()) out.push({ text: `🔥 You're in the lead, ${first(u.name)}! Keep going till Friday ⭐`, go: "points" });
  else if (rank > 1) out.push({ text: `You're ${ordinal(rank)} on the board, the ⭐ is so close!`, go: "points" });
  if (starDecided() && stars().includes(me) && !weekItem("want", me)) out.push({ text: "You're the ⭐ Shining Star! Choose your gift 🎁", go: "prize" });
  const left = scored ? todayItems(me).filter(x => !isDone(todayYmd(), x.id, me)).length : 0;
  if (left) out.push({ text: `${left} ${left === 1 ? "task" : "tasks"} left today, you can do it 💪`, go: "tasks" });
  if (isParentDevice() && kidsList().length) out.push({ text: "See how the kids are doing this week 📊", go: "report" });
  return out;
}
function setupEncLines() {
  document.querySelectorAll(".screen .bar").forEach(bar => {
    if (bar.nextElementSibling && bar.nextElementSibling.classList.contains("enc-line")) return;
    const line = document.createElement("div");
    line.className = "enc-line";
    line.hidden = true;
    bar.after(line);
  });
}
function updateEncLines() {
  setupEncLines();
  let hidden = false;
  try { hidden = localStorage.getItem(ENC_HIDE) === todayYmd(); } catch (e) {}
  const list = !hidden && exists(me) && !["start", "setup"].includes(screen) && $("loginScreen").hidden ? encMessages() : [];
  const m = list.length ? list[Math.floor(encPick * list.length) % list.length] : null;
  document.querySelectorAll(".enc-line").forEach(el => {
    el.hidden = !m;
    if (!m) return;
    const html = `<button class="enc-go" data-encgo="${m.go}">${safe(m.text)}</button><button class="enc-x" data-encx aria-label="Hide for today">✕ Hide</button>`;
    if (el.innerHTML !== html) el.innerHTML = html;
  });
}
function encGo(where) {
  if (where === "spark") return openProfile(me);
  if (where === "points") return go("points");
  if (where === "prize") { ptEdit = { id: me, kind: "want" }; return go("points"); }
  if (where === "tasks") { calWho = null; return go("mine"); }
  if (where === "report") return openReport();
  go("home");
}

// ---------- 🌱 The small buddy badge in the top bar of every screen (the person using the app now) ----------
let badgeLast = null;   // { id, p, L, key }: what the badge showed last (to grow / sparkle when it changes)
function setupBuddyBadges() {
  document.querySelectorAll(".screen .bar").forEach(bar => {
    if (bar.querySelector(".bu-badge")) return;
    const bell = bar.querySelector("[data-bell]"), badge = document.createElement("button");
    badge.type = "button";
    badge.className = "bu-badge";
    badge.dataset.bubadge = "";
    badge.hidden = true;
    if (!bell) return bar.appendChild(badge);
    if (bell.parentElement !== bar) return bell.after(badge);
    const end = document.createElement("span");   // (the bell and the badge stay together at the right end)
    end.className = "bar-end";
    bell.replaceWith(end);
    end.append(bell, badge);
  });
}
// ---------- 🚪 Sign out at the TOP RIGHT of every screen (next to 🔔 News), for everyone: kids too ----------
// (a tap → the usual "Sign out from this phone?" box, see signOutDevice; on a very small phone only 🚪 shows)
function setupSignOutButtons() {
  document.querySelectorAll(".screen .bar, .start-top").forEach(bar => {
    if (bar.querySelector("[data-signout]")) return;
    const bell = bar.querySelector("[data-bell]"), b = document.createElement("button");
    b.type = "button";
    b.className = "pill signout-btn";
    b.dataset.signout = "";
    b.setAttribute("aria-label", "Sign out");
    b.title = "Sign out";
    b.innerHTML = `<span aria-hidden="true">🚪</span><span class="signout-word"> Sign out</span>`;
    (bell && bell.parentElement !== bar ? bell.parentElement : bar).appendChild(b);   // (the last one on the right)
  });
}
function updateBuddyBadges() {
  setupBuddyBadges();
  setupSignOutButtons();
  const u = exists(me) && userById(me);
  const show = !!u && hasSpark(me) && !["start", "setup"].includes(screen) && $("loginScreen").hidden;   // (✨ no Spark badge for a parent)
  const badges = document.querySelectorAll(".bu-badge");
  if (!show) { badges.forEach(b => b.hidden = true); badgeLast = null; return; }
  const p = lifetimePoints(me), L = levelOf(p), pct = levelPct(p), key = [me, u.buddy, p, colorsOf(u).color].join("|");
  if (badgeLast && badgeLast.key === key) { badges.forEach(b => b.hidden = false); return; }
  const was = badgeLast && badgeLast.id === me ? badgeLast : null, grew = was && p > was.p, levelUp = was && L > was.L;
  badgeLast = { id: me, p, L, key };
  const label = u.buddy ? `My profile · ${sparkName(u, true)}: level ${L}, ${pct}% to level ${L + 1}` : "My profile · Pick your Spark";
  badges.forEach(b => {
    b.hidden = false;
    b.style.setProperty("--c", colorsOf(u).color);
    b.style.setProperty("--ink", colorsOf(u).ink);
    b.setAttribute("aria-label", label);
    b.title = label;
    // (when it grew: draw the ring where it was, then let it fill to the new place)
    b.innerHTML = `<span class="bu-ring bu-tiny" aria-hidden="true">${buddyRingSvg(grew && !levelUp ? levelPct(was.p) : pct)}<span class="bu-in"><span class="e">${buddyFace(me, L)}</span></span></span><b class="bu-badge-lv">✨ Spark Lv ${L}</b>`;
    if (!grew) return;
    const bar = b.querySelector(".bu-bar"), C = 2 * Math.PI * 44;
    void bar.getBoundingClientRect();
    bar.style.strokeDasharray = `${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}`;
    b.classList.remove("bu-grow"); void b.offsetWidth; b.classList.add("bu-grow");
    if (levelUp) {
      b.classList.add("bu-sparkle");
      clearTimeout(b.sparkleTimer);
      b.sparkleTimer = setTimeout(() => b.classList.remove("bu-sparkle"), 3000);
    }
  });
}
// After each change: a new level → kept in the history and a 🔔 to the family; 🎉 on the person's own screen
const SEEN_LEVEL = SAVE_KEY + ".level.";
function checkLevels() {
  if (!data.users.length || !feat("buddy")) return;
  let changed = false;
  data.users.filter(u => hasSpark(u.id)).forEach(u => {   // (✨ kids only: parents have no Spark levels)
    const L = levelOf(lifetimePoints(u.id)), list = data.points.levels[u.id] || [], top = list.length ? list[list.length - 1].level : 0;
    if (!top) { data.points.levels[u.id] = [{ level: L, date: todayYmd() }]; changed = true; return; }   // (the first time: no party)
    if (L <= top) return;
    data.points.levels[u.id] = [...list, ...Array.from({ length: L - top }, (_, i) => ({ level: top + 1 + i, date: todayYmd() }))].slice(-100);
    changed = true;
    addNews([newsItem("school", u.sparkName ? `🎉 ${u.name}'s Spark ${u.sparkName} reached Lv ${L}! ✨` : `🎉 ${u.name}'s Spark grew to Lv ${L}! ✨`, `🎉 Lv ${L}`, u.id)]);
  });
  if (changed) writeData("auto");
  // 🎉 The person using the app went up a level (since this device last saw it)
  if (!hasSpark(me) || screen === "start") return;
  const L = levelOf(lifetimePoints(me));
  let seen = 0;
  try { seen = Number(localStorage.getItem(SEEN_LEVEL + me)) || 0; localStorage.setItem(SEEN_LEVEL + me, String(L)); } catch (e) { return; }
  if (seen && L > seen) showLevelUp(me, L);
}
function showLevelUp(id, L) {
  const u = userById(id), c = colorsOf(u);
  const box = document.createElement("div");
  box.className = "lvl-up";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", `Level ${L}`);
  box.innerHTML = `<div class="lvl-box" style="--c:${c.color};--soft:${c.soft}"><div class="lvl-e">${buddyFace(id, L)}</div>
    <h2>${u.sparkName ? `🎉 ${safe(u.sparkName)} reached Lv ${L}! ✨` : `🎉 Your Spark grew to Lv ${L}! ✨`}</h2><p>Well done, ${safe(u.name)}! Keep going! 💪</p><button class="primary">Yay! 🎉</button></div>`;
  box.addEventListener("click", e => { if (e.target === box || e.target.closest("button")) box.remove(); });
  document.body.appendChild(box);
  box.querySelector("button").focus();
  celebrate(innerWidth / 2, innerHeight / 3, c.color, true);
}

// =====================================================================
//  🏆 LEADERBOARD ROWS: 🎁 the prize I want · 💬 an encouraging note · 🌱 what held me back
//   data.points.want  = "monday|person" → { text, ok, by }   (ok = a parent approved it; kept 8 weeks)
//   data.points.notes = "monday|person" → { text, by, at }   (a parent's note this week; kept 8 weeks)
// =====================================================================
let ptEdit = null;   // the small form open under a row: { id, kind: "want" | "note" }
const weekItem = (map, id) => data.points[map][`${data.points.week}|${id}`] || null;
// 🎁 The chip: "🎁 Ice cream" (gold when approved; "🏆 You won: …!" for the Shining Star). Tap: the person changes it, a parent ✅ approves / changes it.
// (🎁 The ⭐ Shining Star is decided on FRIDAY 6 PM (Dubai time), not during the week: see STAR_HOUR.
//  Until then nobody has a gift picker: the one in 1st place sees "🔥 You're in the lead!". After it, ONLY the star gets "🎁 Choose my gift".)
function wantChipHtml(id, isStar) {
  if (!starDecided() || !isStar) return "";   // (a choice saved earlier in the week is kept, just not shown)
  const w = weekItem("want", id), parent = isParentDevice();
  if (!w) return id === me ? `<button class="pt-want add star" data-want="${safe(id)}">🎁 Choose my gift</button>` : `<span class="pt-want locked">🎁 Choosing a gift…</span>`;
  const text = `🏆 My gift: ${safe(w.text)}${w.ok ? "" : " <small>⏳</small>"}`;
  return id === me || parent ? `<button class="pt-want ok" data-want="${safe(id)}" aria-label="Gift: ${safe(w.text)}${w.ok ? ", approved" : ", waiting for OK"}">${text}</button>`
    : `<span class="pt-want ok">${text}</span>`;
}
// ⭐ The star: decided once, on Friday at 6 PM Dubai time (the best ⚖️ fair score then; a tie: who got there first), on any device.
// data.points.prizeMsg = "monday" → { star: "id", at, reminded? }   (reminded = the parents got the Saturday-evening reminder)
const STAR_HOUR = 18, GIFT_REMIND_HOUR = 18;
function starDecided() {
  const d = dubaiNow(), friday = ymd(dayDate(4));   // (this points week's Friday)
  return d.date > friday || (d.date === friday && d.hour >= STAR_HOUR) || !!data.points.prizeMsg[data.points.week];
}
function maybeDecideStar() {
  if (!exists(me) || hasDraft()) return;
  const week = data.points.week, rec = data.points.prizeMsg[week];
  if (!rec) {
    if (!starDecided()) return;
    const win = leaders();
    if (!win.length) return;
    data.points.prizeMsg[week] = { star: win.join(",").slice(0, 200), text: "", at: new Date().toISOString() };
    hallSave(week, win[0]);   // 🏆 into the Hall of Stars
    return writeData("auto");
  }
  // 🎁 No gift chosen by Saturday evening: one gentle reminder for the parents
  const d = dubaiNow(), sat = ymd(dayDate(5));
  if (rec.reminded || !(d.date > sat || (d.date === sat && d.hour >= GIFT_REMIND_HOUR))) return;
  if (cloud.user && !(feed.ref && cloud.fb)) return;   // (the family's news isn't ready yet: later, so it isn't lost)
  const waiting = stars().filter(id => !weekItem("want", id));
  rec.reminded = true;
  if (waiting.length) addNews(waiting.map(id => newsItem("school", `⭐ ${userById(id).name} is this week's Shining Star and hasn't picked a gift yet. Maybe ask what they'd like? 🎁`, "🎁 a gift reminder", id)));
  writeData("auto");
}
// 🎁 Choose my gift (only the ⭐ star, from Friday 6 PM): big option buttons (kids' / parents'), or ✏️ type my own (40 letters).
// Each choice sends a 💌 message to ALL the parents right away (a "school" news line: only parents see those).
const PRIZES_KID = ["🍦 Ice cream", "🎮 1 hour games", "🍕 Pick dinner", "🎬 Movie night pick", "🛝 Park trip", "🧸 Small toy", "🌙 Stay up 30 min", "📚 New book"];
const PRIZES_PARENT = ["☕ Coffee out", "😴 Sleep in", "🍽️ Dinner out", "💆 Spa time", "📺 Pick the movie", "🧹 Day off chores", "🎁 Small gift"];
function wantFormHtml(id) {
  const w = weekItem("want", id), parent = isParentDevice() && id !== me, own = id === me;
  const opts = own ? (isParentId(id) ? PRIZES_PARENT : PRIZES_KID) : [];
  return `<div class="pt-form"><label class="small" for="wantText">🎁 ${own ? "You're the ⭐ Shining Star! Choose your gift" : `${safe(userById(id).name)}'s gift`}</label>
    ${opts.length ? `<div class="pz-opts">${opts.map(t => `<button class="${w && w.text === t ? "on" : ""}" data-wantpick="${safe(t)}">${safe(t)}</button>`).join("")}</div>
      <label class="small" for="wantText">✏️ Type my own gift</label>` : ""}
    <input type="text" id="wantText" maxlength="40" value="${safe((w && w.text && !opts.includes(w.text) && w.text) || (!own && w && w.text) || "")}" placeholder="Ice cream, cinema…">
    <div class="btnrow">${parent && w && !w.ok ? `<button class="primary" data-wantok="${safe(id)}">✅ Approve</button>` : ""}
      <button class="${parent && w && !w.ok ? "" : "primary"}" data-wantsave="${safe(id)}">💾 ${parent ? "Save & approve" : "Save"}</button><button data-ptcancel>Cancel</button></div></div>`;
}
// 💬 The note under the bar: a parent's (to this person: kids see only notes to them), or a kind line (see cheerLine)
function noteHtml(id, rank, fi, order) {
  const n = weekItem("notes", id), canSee = n && (id === me || isParentDevice());
  const auto = stars().includes(id) ? "⭐ Shining Star of the Week! 🌟" : fi ? safe(cheerLine(id, rank, fi, order)) : "Every tick counts! 🌱";
  return `<div class="pt-note">${canSee ? `💬 ${safe(n.text)} <small>— ${exists(n.by) ? safe(userById(n.by).name) : "Mum and Dad"}</small>` : auto}
    ${isParentDevice() && id !== me ? `<button class="linkbtn" data-ptnote="${safe(id)}">💬 ${n ? "Change note" : "Write a note"}</button>` : ""}</div>`;
}
// 🔥 / 💪 The kind line on each bar, from this person's real numbers this week (a different one each day; never mean):
// 1st place before Friday 6 PM: "🔥 You're in the lead!"; everyone else: points behind the one just above, habits / tasks left today,
// a subject going well, Friday coming. (fi = fairInfo(), order = the leaderboard order) (🧩 riddles: no points, so no riddle line)
function cheerLine(id, rank, fi, order) {
  const decided = starDecided(), mine = fi[id];
  if (rank === 0 && mine.fair > 0 && !decided)
    return id === me ? "🔥 You're in the lead! Keep going till Friday ⭐ then you choose your gift 🎁" : "🔥 In the lead! The ⭐ is decided on Friday.";
  const out = [], above = rank > 0 ? order[rank - 1] : null, date = todayYmd();
  if (above && fi[above.id].fair > mine.fair) {
    const gap = fi[above.id].fair - mine.fair;   // (in ⭐ Score)
    out.push(`Only ${gap} ⭐ Score behind ${userById(above.id).name}! 💪`);
  }
  const habitsLeft = isParentId(id) ? 0 : habitsFor(id).filter(h => !habitDone(h, data.habitMarks[habitKey(date, h.id, id)])).length;   // (parents: no habits)
  if (habitsLeft) out.push(`${habitsLeft} ${habitsLeft === 1 ? "habit" : "habits"} left today, you can catch up 🌱`);
  const tasksLeft = todayItems(id).filter(x => !isDone(todayYmd(), x.id, id)).length;
  if (tasksLeft) out.push(`${tasksLeft} ${tasksLeft === 1 ? "task" : "tasks"} left today, every tick counts ✅`);
  if (!isParentId(id)) {
    const bySub = {};
    Object.values(aiDocs.worksheets).filter(w => w.kid === id && w.check && String(w.check.at || "") >= data.points.week)
      .forEach(w => (bySub[w.subject] = bySub[w.subject] || []).push(wsPct(w)));
    const best = Object.entries(bySub).map(([sub, l]) => [sub, l.reduce((a, b) => a + b, 0) / l.length]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 70) out.push(`Great ${best[0]} work this week, keep it up 📚`);
  }
  if (!decided && todayIndex() >= 2) out.push("Friday is close, one more push! 🚀");
  if (decided) out.push("A fresh start on Monday, you've got this 🌱");
  if (!out.length) return "Every tick counts! 🌱";
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return out[(dayNumber(date) + h) % out.length];   // (a different line each day)
}
function ptNoteFormHtml(id) {   // (renamed in v144: the School note form had the same name and replaced this one)
  const n = weekItem("notes", id);
  return `<div class="pt-form"><label class="small" for="noteText">💬 A note to ${safe(userById(id).name)}</label>
    <input type="text" id="noteText" maxlength="80" value="${safe((n && n.text) || "")}" placeholder="Proud of you! 💛">
    <div class="btnrow"><button class="primary" data-notesave="${safe(id)}">💌 Send</button><button data-ptcancel>Cancel</button></div></div>`;
}
// 🌱 What held me back (not for the Shining Star; only the person and the parents see it): this week's missed things in kind words + one tip
function heldBackHtml(id, totals, sorted) {
  if (id !== me && !isParentDevice()) return "";
  const today = todayIndex(), days = planDays(), from = data.points.week, mine = id === me;
  const parts = [];
  // Activities not done (days up to today)
  let notDone = 0, left = 0;
  for (let d = 0; d <= 6; d++) {
    const date = ymd(dayDate(d));
    const ids = [...(days ? days[d].items.filter(it => it.users.includes(id)).map(it => it.actId) : []),
                 ...(data.parentActs || []).filter(a => a.by === id && a.type !== "travel" && pactStartOn(a, date)).map(a => a.id)];
    ids.forEach(a => { if (!isDone(date, a, id)) { if (d < today) notDone++; else left++; } });
  }
  if (notDone) parts.push(`${notDone} ${notDone === 1 ? "activity" : "activities"} not done yet`);
  // My day, habits (only when the feature is on; 👨‍👩‍👧 a parent's score is only their activities, so not for parents)
  // (🧩 riddles: no points, so they never "hold anyone back")
  const kid = !isParentId(id);
  const dayList = Array.from({ length: today + 1 }, (_, d) => ymd(dayDate(d)));
  if (kid && feat("diary")) parts.push(`My day: ${dayList.filter(date => diaryOf(id, date)).length} of ${dayList.length} days`);
  const ticksOn = date => Object.keys(data.habitMarks).some(k => { const [dt, hid, who] = k.split("|"); return dt === date && who === id && !hid.startsWith("ph-"); });
  if (kid && habitsFor(id).length) { const none = dayList.filter(date => !ticksOn(date)).length; if (none) parts.push(`Habits: ${none} ${none === 1 ? "day" : "days"} without ticks`); }
  // One tip: the type that lifts the ⭐ Score most per item (to catch up with the person just above)
  // (totals = fairInfo(): the gap is in ⭐ Score; one more ticked item of a type adds its weight × 100 ÷ its planned items)
  const above = [...sorted].reverse().find(x => totals[x.id].fair > totals[id].fair);
  const gap = above ? totals[above.id].fair - totals[id].fair + 1 : 0;
  const goal = above ? (stars().includes(above.id) ? `to become the Shining Star` : `to catch up with ${above.name}`) : "";
  const opts = Object.keys(SCORE_WEIGHTS).map(k => { const t = typeTally(id, k); return [k, t, t.planned ? SCORE_WEIGHTS[k] * 100 / t.planned : 0]; })
    .filter(([, t]) => t.planned > t.done).map(([k, t, each]) => { const [, e, w] = actTypeInfo(k), n = Math.max(1, Math.min(t.planned - t.done, Math.ceil(gap / each) || 1));
      return [each, `Tick ${n} more ${e} ${w} ${n === 1 ? "item" : "items"} = +${Math.round(n * each)} ⭐ Score`]; });
  const best = opts.sort((a, b) => b[0] - a[0])[0];
  if (!parts.length && !best) return "";
  return `<details class="pt-held"><summary>🌱 ${mine ? "What held me back" : "What held them back"}</summary>
    ${parts.length ? `<ul>${parts.map(p => `<li>${safe(p)}</li>`).join("")}</ul>` : ""}
    ${best ? `<p class="pt-tip">💡 ${safe(best[1])}${goal ? ` ${safe(goal)}!` : "!"}</p>` : ""}</details>`;
}
function leaderTap(ds) {
  const parent = isParentDevice(), key = id => `${data.points.week}|${id}`;
  if (ds.halledit || ds.hallsave || "hallcancel" in ds) return hallTap(ds);   // 🏆
  if ("ptcancel" in ds) { ptEdit = null; return render(); }
  // (🎁 only the ⭐ Shining Star, and only after Friday 6 PM)
  const notYet = "⭐ The Shining Star is decided on Friday at 6 PM. Keep going! 💪";
  if ("wantlock" in ds) return toast(notYet, 3000);
  if (ds.want) {
    if (ds.want !== me && !parent) return;
    if (!starDecided() || !stars().includes(ds.want)) return toast(notYet, 3000);
    ptEdit = { id: ds.want, kind: "want" }; return render();
  }
  if (ds.wantsave || ds.wantpick) {
    const id = ds.wantpick ? me : ds.wantsave, text = (ds.wantpick || $("wantText").value).trim().slice(0, 40), old = data.points.want[key(id)];
    if (id !== me && !parent) return;
    if (!starDecided() || !stars().includes(id)) { ptEdit = null; render(); return toast(notYet, 3000); }
    if (!text) delete data.points.want[key(id)];
    else data.points.want[key(id)] = { text, ok: parent, by: me };   // (set by a parent = approved; one's own wish waits for a parent's ✅)
    hallSave(data.points.week, id, text);   // 🏆 the gift in the Hall of Stars too
    ptEdit = null; keepNow();
    // 💌 To ALL the parents, right away (only parents see "school" news)
    if (text && id === me && (!old || old.text !== text)) {
      addNews([newsItem("school", `💌 You received a message from ${userById(me).name}: ⭐ I'm this week's Shining Star! My gift: ${text}`, "🎁 the star's gift", me)]);
      toast(`🎁 ${text}! Your parents got your message 💌`, 3000, colorsOf(userById(me)).color);
    }
    return;
  }
  if (ds.wantok && parent) { const w = data.points.want[key(ds.wantok)]; if (w) { data.points.want[key(ds.wantok)] = { ...w, ok: true }; ptEdit = null; keepNow(); toast("✅ Approved"); } return; }
  if (ds.ptnote && parent) { ptEdit = { id: ds.ptnote, kind: "note" }; return render(); }
  if (ds.notesave && parent) {
    const id = ds.notesave, text = $("noteText").value.trim().slice(0, 80);
    if (!text) delete data.points.notes[key(id)];
    else data.points.notes[key(id)] = { text, by: me, at: new Date().toISOString() };
    ptEdit = null; keepNow();
    if (text) { addNews([newsItem("school", `💬 a note for ${userById(id).name}: ${text}`, "💬 a note", me)]); toast("💌 Sent!"); }
  }
}
const LEADER_KEYS = ["ptcancel", "want", "wantlock", "wantsave", "wantpick", "wantok", "ptnote", "notesave", "halledit", "hallsave", "hallcancel"];

// =====================================================================
//  🏆 HALL OF STARS (everyone sees it, under the leaderboard): the ⭐ of every week since 1 October 2026, newest first
//   (Monday-to-Sunday weeks, like the points: Week 1 = the week of 1 October). Each week's star, in this order:
//   data.points.hall[monday] (the known ones, a parent's ✏️ fix, or saved by itself on Friday 6 PM)
//   → the star decided on Friday (points.prizeMsg) → a past week in the history with its ⚖️ fair score → "⭐ ?" (not enough data).
//   + the gift, when they chose one. Under it: "Most stars: …".
// =====================================================================
const HALL_START = "2026-09-28";   // (the Monday of the week of 1 October 2026 = Week 1)
const HALL_KNOWN = [["2026-09-28", "Jawad"], ["2026-10-05", "Mody"], ["2026-10-12", "Bana"]];   // (the first 3 stars, saved once)
let hallEdit = null;   // the week a parent is fixing
const hallUser = name => data.users.find(u => u.name.trim().toLowerCase() === String(name).trim().toLowerCase()) || null;
const hallEntry = u => ({ id: u.id, name: u.name, emoji: u.emoji || "", gift: "", by: "" });
// The known winners → saved in the hall (once: a parent's fix is never overwritten). → true when something was saved
function seedHall() {
  let changed = false;
  HALL_KNOWN.forEach(([wk, name]) => {
    if (data.points.hall[wk]) return;
    const u = hallUser(name);
    data.points.hall[wk] = u ? { ...hallEntry(u), by: "known" } : { id: "", name, emoji: "", gift: "", by: "known" };
    changed = true;
  });
  return changed;
}
// ⭐ Saved by itself when the star is decided (Friday 6 PM), and the 🎁 gift when they choose it
function hallSave(week, id, gift) {
  if (!exists(id)) return;
  const old = data.points.hall[week];
  if (old && old.by === "parent" && old.id !== id) return;   // (a parent's fix wins)
  data.points.hall[week] = { ...hallEntry(userById(id)), gift: gift !== undefined ? gift : (old && old.id === id ? old.gift : ""), by: old && old.by === "parent" ? "parent" : "auto" };
}
function hallWeeks() {
  const out = [];
  for (let dt = fromYmd(HALL_START); ymd(dt) <= data.points.week; dt.setDate(dt.getDate() + 7)) out.push(ymd(dt));
  return out;   // (oldest first: Week 1, Week 2 …)
}
// That week's star: { name, emoji, id?, gift? } or null ("⭐ ?"). (👨‍👩‍👧 an older parent star isn't shown: "⭐ ?")
function hallStar(week) {
  const st = hallStarAny(week);
  return st && st.id && isParentId(st.id) ? null : st;
}
function hallStarAny(week) {
  const h = data.points.hall[week];
  if (h) { const u = h.id && exists(h.id) ? userById(h.id) : null; return { id: h.id, name: u ? u.name : h.name, emoji: u ? u.emoji : h.emoji, gift: h.gift || ((data.points.want[`${week}|${h.id}`] || {}).text || "") }; }
  const r = data.points.prizeMsg[week], id = r && r.star && r.star.split(",").find(exists);
  if (id) return { id, name: userById(id).name, emoji: userById(id).emoji, gift: (data.points.want[`${week}|${id}`] || {}).text || "" };
  const past = data.points.history.find(x => x.week === week && x.fair != null && x.winners.length);   // (only weeks decided by the ⚖️ fair score)
  if (past) { const w = past.winners[0]; return { id: w.id, name: exists(w.id) ? userById(w.id).name : w.name, emoji: w.emoji, gift: "" }; }
  const known = HALL_KNOWN.find(([w]) => w === week);   // (the first 3 stars, before they're saved)
  if (known) { const u = hallUser(known[1]); return { id: u ? u.id : "", name: u ? u.name : known[1], emoji: u ? u.emoji : "", gift: "" }; }
  return null;
}
function hallWeekRange(week) {   // ("28 Sep–4 Oct" for any week; weekRange() is this week's)
  const a = fromYmd(week), b = fromYmd(week); b.setDate(b.getDate() + 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
function hallHtml() {
  const weeks = hallWeeks(), parent = isParentDevice(), count = {};
  const rows = weeks.map((wk, i) => {
    const now = wk === data.points.week, st = hallStar(wk);
    if (st && !(now && !starDecided())) count[st.name] = (count[st.name] || 0) + 1;
    const who = now && !starDecided() && !data.points.hall[wk] ? `⭐ <small>decided on Friday</small>` : st ? `⭐ ${safe(st.name)} ${safe(st.emoji || "")}` : "⭐ ?";
    const gift = st && st.gift ? ` · 🎁 Gift: ${safe(st.gift)}` : "";
    const edit = parent && !now ? `<button class="linkbtn hall-edit" data-halledit="${wk}" aria-label="Set the star of week ${i + 1}">✏️ Edit</button>` : "";
    const form = hallEdit === wk ? `<div class="pt-form hall-form"><label class="small" for="hallWho">⭐ The star of Week ${i + 1}</label>
        <select id="hallWho"><option value="">⭐ ? (not known)</option>${scoredUsers().map(u => `<option value="${safe(u.id)}" ${st && st.id === u.id ? "selected" : ""}>${safe(u.emoji)} ${safe(u.name)}</option>`).join("")}</select>
        <label class="small" for="hallGift">🎁 Gift (optional)</label><input type="text" id="hallGift" maxlength="40" value="${safe((st && st.gift) || "")}" placeholder="🍦 Ice cream">
        <div class="btnrow"><button class="primary" data-hallsave="${wk}">💾 Save</button><button data-hallcancel>Cancel</button></div></div>` : "";
    return `<li><div class="hall-row"><span class="hall-week"><b>Week ${i + 1}</b> · ${hallWeekRange(wk)}</span><span class="hall-who">${who}${gift}</span>${edit}</div>${form}</li>`;
  }).reverse();
  const most = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return `<h2>🏆 Hall of Stars</h2><ul class="hall-list">${rows.join("")}</ul>
    ${most.length ? `<p class="hall-most"><b>Most stars:</b> ${most.map(([n, c]) => `${safe(n)} ${c}`).join(" · ")}</p>` : ""}`;
}
function hallTap(ds) {
  if (!isParentDevice()) return;
  if (ds.halledit) { hallEdit = hallEdit === ds.halledit ? null : ds.halledit; return render(); }
  if ("hallcancel" in ds) { hallEdit = null; return render(); }
  if (ds.hallsave) {
    const wk = ds.hallsave, id = $("hallWho").value, gift = $("hallGift").value.trim().slice(0, 40);
    if (id && exists(id)) data.points.hall[wk] = { ...hallEntry(userById(id)), gift, by: "parent" };
    else delete data.points.hall[wk];   // (⭐ ? : back to what the app works out)
    hallEdit = null;
    keepNow();
    toast("🏆 Saved", 2000);
  }
}

// ---------- Points screen ----------
function drawPoints() {
  const totals = pointsByUser(), acts = activityPointsByUser(), star = stars(), from = data.points.week, to = weekEnd();
  $("ptsWeek").textContent = `${weekLabel(data.points.week)} · ✅ Tasks: activities, school work, duties · ⭐ Habits: good habits, prayers, My day · 🧩 Fun: wishes · only kids are scored · starts again every Monday`;
  // ⭐ The order and the bar: the OVERALL score (see SCORE); the old points stay in ✅ · ⭐ · 🧩
  const fi = fairInfo(), fair = Object.fromEntries(Object.entries(fi).map(([id, x]) => [id, x.fair]));
  const sorted = fairOrder(fair);
  const medals = ["🥇", "🥈", "🥉"];
  $("ptsList").innerHTML = sorted.map((u, rank) => {   // (a tie: whoever reached it first is higher)
    const c = colorsOf(u), max = plannedCount(u.id) * POINTS_EACH, pct = fair[u.id];
    const kinds = pointKinds(u.id, from, to, acts[u.id]);
    return `<div class="pt-row${star.includes(u.id) ? " is-star" : ""}" style="--soft:${c.soft};--ink:${c.ink};--c:${c.color}">
      <div class="pt-rank">${fair[u.id] > 0 && rank < 3 ? `${medals[rank]}<small>${ordinal(rank + 1)}</small>` : `<small>${ordinal(rank + 1)}</small>`}</div>
      <div class="face">${safe(u.emoji)}${starBadge(u.id)}</div>
      <div>
        <div class="pt-top"><span class="pt-name"><span class="pt-nameline">${buddyMiniHtml(u.id)}<span>${safe(u.name)}</span></span>${star.includes(u.id) ? `<span class="star-label">Shining Star of the Week!</span>` : ""}</span>
          ${wantChipHtml(u.id, star.includes(u.id))}<span class="pt-num pt-fair" aria-label="Score ${pct} of ${fi[u.id].max}"><small>⭐ Score</small> ${pct}<small> / ${fi[u.id].max}</small></span></div>
        ${ptEdit && ptEdit.id === u.id && ptEdit.kind === "want" ? wantFormHtml(u.id) : ""}
        <div class="pt-bar${star.includes(u.id) ? " shine" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i>
          ${star.includes(u.id) && pct ? `<span class="pt-spark" style="left:max(2px, calc(${pct}% - 20px))" aria-hidden="true">✨</span>` : ""}</div>
        ${subBarsHtml(fi[u.id])}
        <div class="pt-kinds">${kindsText(kinds)} <small>· ${totals[u.id]} points</small></div>
        <div class="pt-sub">${max ? `${acts[u.id] / POINTS_EACH} of ${max / POINTS_EACH} activities done` : "No planned activities yet"}</div>
        ${noteHtml(u.id, rank, fi, sorted)}
        ${ptEdit && ptEdit.id === u.id && ptEdit.kind === "note" ? ptNoteFormHtml(u.id) : ""}
        ${star.includes(u.id) ? "" : heldBackHtml(u.id, fi, sorted)}
        ${buHist === u.id ? levelHistoryHtml(u.id) : ""}
      </div></div>`;
  }).join("") + funLineHtml(fair);
  $("ptsHall").innerHTML = hallHtml();   // 🏆 every week's ⭐
  $("ptsRiddles").innerHTML = isParentDevice() ? "" : riddleBoardHtml();   // 🧩 the family riddle board (kids only)
  maybeMakeRiddles();
  // 🎁 My prizes (a parent's; parents have no habits card any more)
  $("ptsParents").innerHTML = isParentId(me) && !isKidDevice() ? prizesListHtml(me) : "";
  // (👨‍👩‍👧 an older week a parent won stays in the history data, but isn't shown)
  const h = data.points.history.map(w => ({ ...w, winners: w.winners.filter(x => !isParentId(x.id)) })).filter(w => w.winners.length);
  $("ptsHistory").innerHTML = h.length ? h.map(w => `<div class="hist-row"><span>${weekLabel(w.week)}</span>
      <b>🌟 ${w.winners.map(x => `${safe(x.emoji)} ${safe(x.name)}`).join(" & ")}${w.fair != null ? ` · ⭐ Score ${w.fair} / ${w.max != null ? w.max : 100}` : ""} · ${w.points} points</b>${
      w.winners.some(x => x.kinds) ? `<small class="hist-kinds">${w.winners.filter(x => x.kinds).map(x => `${w.winners.length > 1 ? safe(x.name) + ": " : ""}${kindsText(x.kinds)}`).join(" · ")}</small>` : ""}</div>`).join("")
    : `<p class="empty">No past weeks yet. The first star is chosen next Monday!</p>`;
}

// ("🎉 Jawad beat Bro2a this week!" was removed: parents aren't scored any more)
const funLineHtml = () => "";

// ---------- The last 7 days (today and the 6 days before) ----------
function tomorrow() { const t = new Date(); return ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)); }
function lastSevenDays() {
  const now = new Date();
  return [6, 5, 4, 3, 2, 1, 0].map(back => new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
}
// For each person: points, how many activities they finished, and how many were planned in the last 7 days.
// "Planned" counts each day's activities from the plan (only days since ticks started being kept).
function lastWeekStats() {
  const dates = lastSevenDays().filter(dt => ymd(dt) >= data.points.since);
  const inRange = new Set(dates.map(ymd));
  const ticks = tickLog().filter(t => inRange.has(t.date));
  const real = hasPlan();
  return scoredUsers().map(u => {   // (👨‍👩‍👧 kids only)
    const done = ticks.filter(t => t.user === u.id).length;
    // (📅 each date's own planned items)
    const planned = (real ? dates.reduce((sum, dt) => sum + planDay(ymd(dt)).items.filter(it => it.users.includes(u.id)).length, 0) : 0)
      + dates.reduce((sum, dt) => sum + pactTicksOn(u.id, ymd(dt)), 0);   // (👨‍👩‍👧 + a parent's ➕ My activity ones)
    const from = ymd(lastSevenDays()[0]), to = tomorrow();
    const kinds = pointKinds(u.id, from, to, done * POINTS_EACH);
    return { user: u, done, points: kinds.tasks + kinds.habits + kinds.fun, kinds, planned: Math.max(planned, done) };
  });
}

// ---------- The first page (only for a moment while the app opens: no "Who are you?" any more) · achievements · today's date ----------
function drawStart() {

  // 3. Last week's achievements. The Shining Star = most points in these 7 days (a tie = more than one star).
  const week = lastSevenDays(), short = dt => `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
  $("achRange").textContent = `The last 7 days: ${short(week[0])} – ${short(week[6])}`;
  const stats = lastWeekStats(), best = Math.max(0, ...stats.map(s => s.points));
  $("achList").innerHTML = !best ? `<div class="ach-empty">Finish activities to earn stars! ⭐</div>`
    : `<div class="ach-grid">${stats.map(s => {
        const c = colorsOf(s.user), star = s.points === best;
        return `<div class="ach" style="--soft:${c.soft};--ink:${c.ink};--c:${c.color}">
          <div class="face">${safe(s.user.emoji)}${star ? `<span class="star-badge" aria-label="Shining Star">🌟</span>` : ""}</div>
          <div class="ach-name">${safe(s.user.name)}</div>
          <div class="ach-pts">${s.points} <small>points</small></div>
          <div class="ach-kinds">${kindsText(s.kinds)}</div>
          <div class="ach-done">${s.planned ? `${s.done} of ${s.planned} done` : `${s.done} done`}</div>
          ${star ? `<span class="star-label">Shining Star!</span>` : ""}</div>`;
      }).join("")}</div>`;

  // 4. Today's date, e.g. "Tuesday, 6 October 2026"
  const t = new Date();
  $("todayDate").textContent = `${DAYS[todayIndex()]}, ${t.getDate()} ${t.toLocaleDateString("en-GB", { month: "long" })} ${t.getFullYear()}`;
}

// ---------- Home: big buttons ----------
function drawHome() {
  const u = userById(me), c = colorsOf(u);
  $("homeFace").innerHTML = faceHtml(u) + starBadge(me);   // (👨‍👩‍👧 a parent: their photo, or emoji)
  $("homeFace").style.cssText = `--soft:${c.soft}`;
  $("homeHello").textContent = `Hi ${u.name}!`;
  // 📅 Today, big: "Thursday" / "22 October 2026" (Dubai time; a bit smaller on a kid's home)
  const dn = new Date(), dz = o => dn.toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", ...o });
  $("homeDate").className = "home-date" + (isParentDevice() ? "" : " kid");
  $("homeDate").innerHTML = `<b>${dz({ weekday: "long" })}</b><span>${dz({ day: "numeric", month: "long", year: "numeric" })}</span>`;
  const myPoints = pointsByUser()[me], myFair = scoreText(scoreOf(me));
  $("homePoints").textContent = (stars().includes(me) ? `🌟 Shining Star of the Week · ⭐ Score ${myFair} · ${myPoints} points` : `⭐ Score ${myFair} · ${myPoints} points this week`)
    + ` · ${kindsText(weekKinds(me))}`;
  const isDad = isParentId(me), parent = isParentDevice();
  $("backupPill").hidden = !isDad;   // 💾 Backup button: only Bro2a sees it
  // 🌱 The hello: my buddy in its level ring (when Buddy levels is on and I picked one)
  const buddy = hasSpark(me) && u.buddy;   // (✨ kids only)
  $("homeFace").classList.toggle("has-buddy", !!buddy);
  if (buddy) {
    const p = lifetimePoints(me), L = levelOf(p), pct = levelPct(p);
    $("homeFace").innerHTML = `<span class="bu-ring bu-hello" role="img" aria-label="Level ${L}, ${pct}% to level ${L + 1}" style="--c:${c.color}">${buddyRingSvg(pct)}
      <span class="bu-in"><span class="e">${buddyFace(me, L)}</span><b>Lv ${L}</b></span>${starBadge(me)}</span><small class="bu-under">${pct}% to Lv ${L + 1}</small>`;
  }
  // (🧒 a kid's numbers are in 📊 My week; 👨‍👩‍👧 a parent has no points or score any more)
  $("homePoints").hidden = !parent || isParentId(me);
  $("scr-home").classList.toggle("kid-home", !parent);
  if (!parent) return drawKidHome(u);   // 🧒 a kid's home: super simple (see KIDS' HOME)
  // 👨‍👩‍👧 A PARENT'S HOME (simple): the hello and date · 🔔 "Needs you" (only when something does) · one card per kid ·
  // the Family row (📅 Family calendar · ✏️ Add / Plan · 🏡 Community · ☰ More). Everything else is on each kid's page or in ☰ More.
  $("homeNote").hidden = true;
  $("homeBig").hidden = false;
  $("homeBig").className = "p-home";
  $("homeBig").innerHTML = needsLineHtml() + `<div class="kid-cards">${kidsList().map(kidCardHtml).join("")}</div>${kidsList().length ? "" : kidSetupHtml()}`
    + familyRowHtml();
  $("homeMenu").hidden = !homeMore && !homeAddPlan;
  $("homeMenu").innerHTML = homeAddPlan ? addPlanMenuHtml() : homeMore ? parentMoreHtml() : "";
  $("homeHabits").innerHTML = "";
  $("homeCal").innerHTML = "";
  if (!isParentDevice()) maybeMakeRiddles();   // (🧩 riddles: kids only, never made on a parent's device)
  maybeShowTour();
  maybeShowSetup();   // ✨ a parent, the first time: "Make the app yours"
}
