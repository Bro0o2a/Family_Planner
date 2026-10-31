// =====================================================================
//  SETTINGS (Dad only): my day, planning, people, backup
// =====================================================================
function drawSettings() {
  // A kid: only the cards that are for everyone (🕌 Prayer times)
  $("scr-settings").classList.toggle("kid-view", !isParentId(me));
  drawFeatures();   // ⚙️ Features (parents)
  fillMyDay();
  drawFreeTime();
  $("maxTogether").value = data.maxTogether;
  $("starDay").innerHTML = DAYS.map((d, i) => `<option value="${i}" ${i === starTime().day ? "selected" : ""}>${d}</option>`).join("");
  $("starClock").value = starTime().time;
  fillPrayer();
  drawUsers();
  drawHabitList();
  $("acctInfo").textContent = cloud.user ? `Signed in as ${cloud.user.email}. Everyone's phones share this family's data.`
    : cloud.enabled ? "Not signed in." : "Opened from a file: the cloud only works from a web address (http://…).";
  $("signOutBtn").hidden = !cloud.user;
  $("setNotify").innerHTML = notifyHtml();
}

// ---------- My day ----------
// Puts the saved "My day" hours into the boxes: "Day starts at" / "Day ends at" for each day, Monday … Sunday.
function fillMyDay() {
  const hm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  $("dayHours").innerHTML = DAYS.map((name, i) => { const [s, e] = dayWindow(i);
    return `<div class="day-hrow"><b>${name}</b>
      <label><span class="small">Day starts at</span><input type="time" id="dh-s-${i}" value="${hm(s)}" aria-label="${name}: day starts at"></label>
      <label><span class="small">Day ends at</span><input type="time" id="dh-e-${i}" value="${hm(e)}" aria-label="${name}: day ends at"></label></div>`; }).join("");
  $("dayErr").textContent = "";
}
// Any change in the boxes: check every day, then save (a wrong time: a message, and nothing is saved until it's fixed).
// (The older single day / weekend hours follow Monday and Saturday, for phones that don't have this update yet.)
function saveDayHours() {
  const days = DAYS.map((_, i) => ({ start: $(`dh-s-${i}`).value, end: $(`dh-e-${i}`).value }));
  const bad = days.findIndex(x => !x.start || !x.end || toMin(x.end) <= toMin(x.start));
  if (bad >= 0) return $("dayErr").textContent = `${DAYS[bad]}: the day must end after it starts.`;
  $("dayErr").textContent = "";
  data.myDay = { start: days[0].start, end: days[0].end, weekendOwn: sameText(days[5]) !== sameText(days[0]),
                 weekendStart: days[5].start, weekendEnd: days[5].end, days };
  changed();
}
$("dayHours").addEventListener("change", e => { if (e.target.matches("input[type=time]")) saveDayHours(); });
// 📋 Same for all days: Monday's hours for every day
$("daySame").addEventListener("click", () => {
  for (let i = 1; i < DAYS.length; i++) { $(`dh-s-${i}`).value = $("dh-s-0").value; $(`dh-e-${i}`).value = $("dh-e-0").value; }
  saveDayHours();
  toast("📋 Every day now has Monday's hours.", 2500);
});
// The calculated free time of one person for each day, listed under the "My day" boxes,
// with the flexible activities the SAVED plan put inside it (nothing is re-planned here)
// and the free time left after them (and their get ready / break).
let freeWho = DAD;   // whose free time is showing (only on this screen, not saved)
function drawFreeTime() {
  if (!data.users.some(u => u.id === freeWho)) freeWho = DAD;
  const who = userById(freeWho);
  $("freeTitle").textContent = `${who.name}'s free time (calculated)`;
  $("freeWho").innerHTML = data.users.map(x => {
    const c = colorsOf(x);
    return `<button type="button" class="chip ${x.id === freeWho ? "on" : ""}" data-freewho="${safe(x.id)}" style="--soft:${c.soft};--ink:${c.ink}"
      ${x.id === freeWho ? `aria-current="true"` : ""}><span class="e">${safe(x.emoji)}</span>${safe(x.name)}</button>`;
  }).join("");
  const days = planDays();   // the saved plan (null = no plan yet)
  $("freeRows").innerHTML = DAYS.map((d, i) => {
    const free = freeFor(i, freeWho), total = totalLength(free);
    const parts = free.map(([s, e]) => `${showTime(s)}–${showTime(e)}`).join(", ");
    let plan = "";
    if (days && total) {
      // This person's flexible activities that day that are (at least partly) in their free time
      const inFree = (s, e) => free.some(([a, b]) => s < b && a < e);
      const acts = days[i].items.filter(it => !it.fixed && it.people.includes(freeWho) && inFree(it.start, it.end));
      // The time they take, with their get ready / break, counted only where it's inside the free time
      const pieces = acts.flatMap(it => {
        const act = data.flexible.find(a => a.id === it.actId) || {};
        const s = it.start - (act.getReady || 0), e = it.end + (act.breakAfter || 0);
        return free.map(([a, b]) => ({ start: Math.max(a, s), end: Math.min(b, e) })).filter(p => p.end > p.start);
      });
      const used = busyMinutes(pieces), left = Math.max(0, total - used);
      plan = `<div class="free-plan"><div class="sum">${acts.length
        ? `planned <b>${acts.length} ${acts.length === 1 ? "activity" : "activities"} (${showDuration(used)})</b>`
        : "nothing planned"} · <span class="left">left ${showDuration(left)}</span></div>
        ${acts.length ? `<ul>${acts.map(it => `<li><span class="t">${showTime(it.start)}–${showTime(it.end)}</span>
          ${safe(it.name)} ${it.users.map(id => safe(userById(id).emoji)).join("")}</li>`).join("")}</ul>` : ""}</div>`;
    }
    return `<div class="free-row"><b>${SHORT[i]}</b>
      <small>${parts ? "free " + parts : "No free time"}</small>
      <span class="total ${total ? "" : "none"}">${total ? showDuration(total) : "—"}</span>${plan}</div>`;
  }).join("") + (days ? "" : `<p class="hint">No plan yet, so nothing is planned in this free time.</p>`);
}
// Tap a person to see their free time and what's planned in it
$("freeWho").addEventListener("click", e => {
  const b = e.target.closest("[data-freewho]");
  if (!b) return;
  freeWho = b.dataset.freewho;
  drawFreeTime();
});
// The "Max activities at the same time" setting
$("maxTogether").addEventListener("change", () => {
  const n = Math.round(Number($("maxTogether").value));
  if (n >= 1 && n <= 5) data.maxTogether = n;   // only accept 1 to 5
  changed();                                    // (if the number was wrong, this puts the old one back)
});

// 🌟 The Shining Star's announce day + time: the points week then runs from the next day (see pointsWeekOf).
// The week is moved straight away (no star for the part-week): ticks are by date, so nothing is lost.
["starDay", "starClock"].forEach(id => $(id).addEventListener("change", () => {
  const day = Number($("starDay").value), time = $("starClock").value;
  if (!(day >= 0 && day <= 6) || !/^\d{2}:\d{2}$/.test(time)) return drawSettings();
  data.starAt = { day, time };
  data.points.week = pointsWeekOf(new Date());
  changed();
}));

// ---------- 🕌 Prayer times ----------
// On / Off and the reminder are each person's own choice: kept right away (on all their devices).
// The place is Bro2a's (a draft until 💾 Save, like the rest of Settings).
function fillPrayer() {
  const p = data.prayer, u = userById(me), on = u.showPrayer === true;
  $("prMine").innerHTML = `<button type="button" class="${on ? "on" : ""}" data-prmine="on" aria-pressed="${on}">🕌 On</button>
    <button type="button" class="${on ? "" : "on"}" data-prmine="off" aria-pressed="${!on}">Off</button>`;
  $("prRemind").checked = on && u.prayerRemind !== false;
  $("prRemind").disabled = !on;
  $("prPlace").hidden = !isParentId(me);
  if (document.activeElement !== $("prCity")) $("prCity").value = p.city;
  if (document.activeElement !== $("prLat")) $("prLat").value = p.lat;
  if (document.activeElement !== $("prLng")) $("prLng").value = p.lng;
  $("prToday").textContent = on ? `Today in ${p.city || "our city"}: ${prayerTodayText()}` : "";
}
// A person's own prayer choice: kept right away. (If other Settings changes aren't saved yet, it's saved with them.)
function setMyPrayer(change) {
  if (!exists(me)) return;
  const draft = hasDraft();
  Object.assign(data.users.find(u => u.id === me), change);
  if (!draft) writeData();
  render();
}
$("prMine").addEventListener("click", e => {
  const b = e.target.closest("[data-prmine]");
  if (!b) return;
  const on = b.dataset.prmine === "on";
  setMyPrayer(on ? { showPrayer: true, prayerRemind: userById(me).prayerRemind !== false } : { showPrayer: false });
  toast(on ? "🕌 Prayer times are on your calendar." : "Prayer times are off.");
});
$("prRemind").addEventListener("change", () => setMyPrayer({ prayerRemind: $("prRemind").checked }));
["prCity", "prLat", "prLng"].forEach(id => $(id).addEventListener("change", () => {
  if (!isParentId(me)) return;
  const lat = Number($("prLat").value), lng = Number($("prLng").value);
  $("prErr").textContent = "";
  if ($("prLat").value === "" || $("prLng").value === "" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return $("prErr").textContent = "Latitude is −90 to 90 and longitude is −180 to 180 (Al Barsha: 25.1135, 55.2000).";
  data.prayer = { ...data.prayer, city: $("prCity").value.trim().slice(0, 40), lat, lng };
  changed();
}));
$("prDefault").addEventListener("click", () => {
  if (!isParentId(me)) return;
  data.prayer = { ...data.prayer, city: PRAYER_DEFAULT.city, lat: PRAYER_DEFAULT.lat, lng: PRAYER_DEFAULT.lng };
  $("prErr").textContent = "";
  ["prCity", "prLat", "prLng"].forEach(id => $(id).blur());
  changed();
});

// ---------- 🕌 "Show prayer times on your calendar?" (once per person, the first time after this update) ----------
// Only once the family data is matched up with the cloud, so the answer is never asked twice or lost.
function maybeAskPrayer() {
  const u = exists(me) && userById(me);
  const ready = !cloud.enabled || cloud.ready;
  if (!u || !feat("prayer") || typeof u.showPrayer === "boolean" || !ready || screen === "start" || !$("prayAsk").hidden) return;
  if (!$("syncModal").hidden || !$("loginScreen").hidden) return;
  $("prayAsk").hidden = false;
  $("prayYes").focus();
}
function answerPrayer(yes) {
  $("prayAsk").hidden = true;
  setMyPrayer(yes ? { showPrayer: true, prayerRemind: true } : { showPrayer: false });
  toast(yes ? "🕌 Prayer times are on your calendar. You can change it in ⚙️ Settings." : "OK! You can turn them on later in ⚙️ Settings.", 4000);
}
$("prayYes").addEventListener("click", () => answerPrayer(true));
$("prayNo").addEventListener("click", () => answerPrayer(false));

// ---------- People ----------
let editingUser = null; // which person is being edited (null = adding a new one)
$("uEmojiPick").innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}" aria-label="Use ${e}">${e}</button>`).join("");
$("uColors").innerHTML = Object.entries(PALETTE).map(([key, c]) =>
  `<label title="${key}"><input type="radio" name="uColor" value="${key}"><span style="background:${c.color}"></span></label>`).join("");
function pickedColor() { const c = $("uColors").querySelector("input:checked"); return c ? c.value : null; }
function setColor(key) { $("uColors").querySelectorAll("input").forEach(c => c.checked = c.value === key); }
// A color nobody has yet (or purple)
function freeColor() { return Object.keys(PALETTE).find(k => !data.users.some(u => u.color === k)) || "purple"; }

// ---------- ⭐ The kids' good habits (Settings → ✏️ Kids' habits: any parent, for every kid; kids only tick them) ----------
// Changes here are a draft until 💾 Save, like the rest of Settings. 🗑️ Removing one keeps the points already earned with it.
let editingHabit = null;   // which habit is being changed (null = adding a new one)
const HABIT_PTS = [1, 2, 3, 5, 10];
const canEditKidHabits = () => isParentPhone();
function drawHabitList() {
  const kids = data.users.filter(u => !isParentId(u.id)), list = data.habits.filter(h => !h.gone);
  $("hbList").innerHTML = list.length ? list.map((h, i) => `
    <li class="${h.id === editingHabit ? "editing" : ""}"><span class="uemoji">${safe(h.emoji)}</span>
      <span class="what">${safe(h.name)}<small>${h.kind === "prayers" ? `5 ticks: ${PRAYERS.join(", ")}` : h.kind === "water" ? `${WATER_DROPS} drops a day` : `1 tick a day · +${h.points || 1}`}${h.must ? ` · <b style="color:#b45309">⭐ Must-do</b>` : ""}</small>
        <span class="hb-kids">${kids.map(k => { const c = colorsOf(k), on = !h.off.includes(k.id);
          return `<button class="chip ${on ? "on" : "off"}" data-hbkid="${safe(h.id)}|${safe(k.id)}" style="--soft:${c.soft};--ink:${c.ink}"
            aria-pressed="${on}" title="${on ? "On" : "Off"} for ${safe(k.name)}"><span class="e">${safe(k.emoji)}</span>${safe(k.name)}</button>`; }).join("")}</span></span>
      <span class="hb-order"><button class="edit" data-hbup="${safe(h.id)}" ${i === 0 ? "disabled" : ""} aria-label="Move up">▲ Up</button>
        <button class="edit" data-hbdown="${safe(h.id)}" ${i === list.length - 1 ? "disabled" : ""} aria-label="Move down">▼ Down</button></span>
      <button class="edit" data-hbedit="${safe(h.id)}">Edit</button>
      <button class="x" title="Remove" aria-label="Remove" data-hbdel="${safe(h.id)}">× Remove</button></li>`).join("")
    : `<li class="empty">No habits yet. Add one below.</li>`;
}
function toggleHabitKid(id, kid) {
  const h = data.habits.find(x => x.id === id);
  if (!h || !canEditKidHabits()) return;
  h.off = h.off.includes(kid) ? h.off.filter(x => x !== kid) : [...h.off, kid];
  changed();
}
function moveHabit(id, step) {
  const list = data.habits.filter(h => !h.gone), i = list.findIndex(x => x.id === id), j = i + step;
  if (i < 0 || j < 0 || j >= list.length || !canEditKidHabits()) return;
  const a = data.habits.indexOf(list[i]), b = data.habits.indexOf(list[j]);
  [data.habits[a], data.habits[b]] = [data.habits[b], data.habits[a]];
  changed();
}
function startEditHabit(id) {
  const h = data.habits.find(x => x.id === id);
  if (!h || !canEditKidHabits()) return;
  editingHabit = id;
  $("hbEmoji").value = h.emoji;
  $("hbName").value = h.name;
  $("hbPoints").value = String(h.points || 1);
  $("hbMust").checked = !!h.must;
  $("hbAdd").textContent = "Save changes";
  $("hbCancel").hidden = false;
  $("hbErr").textContent = "";
  drawHabitList();
  $("hbName").focus();
}
function resetHabitForm() {
  editingHabit = null;
  $("hbEmoji").value = "";
  $("hbName").value = "";
  $("hbPoints").value = "1";
  $("hbMust").checked = false;
  $("hbAdd").textContent = "Add habit";
  $("hbCancel").hidden = true;
  $("hbErr").textContent = "";
  if (screen === "settings") drawHabitList();
}
$("hbCancel").onclick = resetHabitForm;
$("hbAdd").onclick = () => {
  if (!canEditKidHabits()) return toast("🙂 A parent changes the habits. You tick them!");
  const name = $("hbName").value.trim().slice(0, 40), emoji = $("hbEmoji").value.trim().slice(0, 8) || "⭐";
  const points = HABIT_PTS.includes(Number($("hbPoints").value)) ? Number($("hbPoints").value) : 1;
  if (!name) return $("hbErr").textContent = "Please type a habit.";
  const old = data.habits.find(x => x.id === editingHabit), must = $("hbMust").checked;
  // ⭐ Must-do: remembers the day it was switched on (days before that never lock the score)
  const mustOf = h => must ? (h && h.must) || todayYmd() : null;
  if (old) { const m = mustOf(old); if (m) old.must = m; else delete old.must; }
  if (old) { Object.assign(old, { name, emoji }); if (old.kind === "single") { if (points > 1) old.points = points; else delete old.points; } }
  else data.habits.push({ id: newId(), name, emoji, kind: "single", off: [], ...(points > 1 ? { points } : {}), ...(must ? { must: todayYmd() } : {}) });
  resetHabitForm();
  changed();
  draftToast(old ? "✓ Changed" : `✓ ${emoji} ${name} added`);
};
function deleteHabit(id) {
  const h = data.habits.find(x => x.id === id);
  if (!h || !canEditKidHabits() || !confirm(`Remove the habit “${h.name}”?\n\nPoints already earned with it are kept.`)) return;
  // (ticked before: kept as "gone", so its points stay counted; never ticked: removed)
  if (Object.keys(data.habitMarks).some(k => k.split("|")[1] === id)) h.gone = true;
  else data.habits = data.habits.filter(x => x.id !== id);
  if (editingHabit === id) resetHabitForm();
  changed();
}

// (New people are added only in 👨‍👩‍👧 Family → ➕ Add a kid / Add a parent. Settings → People only changes or removes them.)
function drawUsers() {
  $("userList").innerHTML = data.users.map(u => {
    const count = allActs().filter(a => a.users.includes(u.id)).length;
    return `<li class="${u.id === editingUser ? "editing" : ""}"><span class="uemoji">${safe(u.emoji)}</span>
      <span class="what" style="color:${colorsOf(u).ink}">${safe(u.name)}<small>${count} ${count === 1 ? "activity" : "activities"}${u.id === DAD ? " · can plan the week" : ""}</small></span>
      <button class="edit" data-edit-user="${safe(u.id)}">Edit</button>
      ${u.id === DAD ? `<span style="width:44px"></span>` : `<button class="x" title="Remove" aria-label="Remove" data-del-user="${safe(u.id)}">× Remove</button>`}</li>`;
  }).join("");
}
function resetUserForm() {
  editingUser = null;
  $("uEmoji").value = "";
  $("uName").value = "";
  setColor(freeColor());
  $("uForm").hidden = true;   // (the form is only for ✏️ Edit)
  $("uErr").textContent = "";
  if (screen === "settings") drawUsers();
}
$("uCancel").onclick = resetUserForm;
function startEditUser(id) {
  const u = data.users.find(x => x.id === id);
  if (!u) return;
  editingUser = id;
  $("uEmoji").value = u.emoji;
  $("uName").value = u.name;
  setColor(u.color);
  $("uForm").hidden = false;
  $("uErr").textContent = "";
  drawUsers();
  $("uName").focus();
}
$("uAdd").onclick = () => {
  if (!isParentId(me) || !editingUser) return;   // (only changes: new people are added in 👨‍👩‍👧 Family)
  const name = $("uName").value.trim().slice(0, 30);
  const emoji = $("uEmoji").value.trim().slice(0, 8) || "🙂";
  const color = pickedColor() || freeColor();
  if (!name) return $("uErr").textContent = "Please type a name.";
  if (data.users.some(u => u.id !== editingUser && u.name.toLowerCase() === name.toLowerCase()))
    return $("uErr").textContent = "Someone already has that name.";
  const old = data.users.find(u => u.id === editingUser);
  if (old) Object.assign(old, { name, emoji, color });
  else data.users.push({ id: newId(), name, emoji, color });
  resetUserForm();
  changed();
  draftToast(old ? "✓ Changed" : `✓ ${name} added`);
};
function removeUser(id) {
  const u = data.users.find(x => x.id === id);
  if (!u || id === DAD || !isParentId(me)) return;
  const acts = allActs().filter(a => a.users.includes(id));
  const alone = acts.filter(a => a.users.length === 1).length;
  const msg = `Remove ${u.name}?` + (alone ? `\n\n${alone} ${alone === 1 ? "activity that was only theirs goes" : "activities that were only theirs go"} to ${dadName()}.` : "");
  if (!confirm(msg)) return;
  // Shared activities just lose this person. Activities that were only theirs go to Dad, so nothing is lost.
  acts.forEach(a => {
    a.users = a.users.filter(x => x !== id);
    if (!a.users.length) { a.users = [DAD]; a.helper = ""; }
    if (a.helper === id || a.users.includes(a.helper)) a.helper = "";   // (🤝 a removed parent no longer helps)
  });
  // Routines just lose this person (a routine that was only theirs is removed)
  data.routines.forEach(r => r.users = r.users.filter(x => x !== id));
  data.routines = data.routines.filter(r => r.users.length);
  data.users = data.users.filter(x => x.id !== id);
  if (allFilter === id) allFilter = "all";
  if (editingUser === id) resetUserForm();
  changed();
  return true;
}

// =====================================================================
//  👨‍👩‍👧 FAMILY (parents): kids with their school, school system, year and 🔑 code · ➕ Add a kid · Add a parent
//  A kid's code: codes/{CODE} = { familyId, kidId, createdBy, createdAt } (and user.code, so it can be shown again).
//  A parent code: kidId "parent", works once (the 2nd parent signs up with their email, then types it).
//  Changes here are kept right away (no 💾 Save).
// =====================================================================
let familySetup = false;   // a new family's first visit: "Add your kids"
let famEdit = null;        // the open form: a kid's id, "new", or null
let famParentCode = "";    // the last parent code made on this device (shown until you leave)
function drawFamily() {
  const kids = kidsList(), online = !!(cloud.user && cloud.familyId);
  const form = famEdit ? familyFormHtml(famEdit === "new" ? {} : userById(famEdit)) : "";
  $("familyBody").innerHTML = `
    ${familySetup ? `<div class="card sc-newtopic"><b>🎉 Your family is ready!</b><p>Now add your kids. Each kid gets a code to sign in on their own phone or tablet.</p></div>` : ""}
    ${online ? "" : `<div class="card"><p class="sc-empty">🔌 Codes need the internet and the family sign-in.</p></div>`}
    ${cloud.familyId && isParentDevice() ? `<div class="card fam-id"><span>Family ID: <code>${safe(cloud.familyId)}</code></span>
      <button class="pill" data-famidcopy>📋 Copy</button>${aiUsageHtml()}</div>` : ""}
    <div class="bd-head"><h2>🧒 Kids</h2>${famEdit === "new" ? "" : `<button class="edit" data-famedit="new">➕ Add a kid</button>`}</div>
    ${famEdit === "new" ? form : ""}
    ${kids.length ? `<div class="fam-list">${kids.map(u => {
      const c = colorsOf(u), about = [u.school, u.curriculum, u.year].filter(Boolean).join(" · ");
      return `<div class="card bd-card fam-kid" style="--c:${c.color}">
        <div class="fam-top"><span class="fam-face" style="background:${c.soft}">${safe(u.emoji)}</span>
          <div class="what"><b>${safe(u.name)}</b><small>${about ? safe(about) : "No school or year yet"}</small></div></div>
        ${famEdit === u.id ? form : ""}
        <div class="fam-code">${u.code ? `🔑 <span class="code-big">${safe(u.code)}</span>` : `<span class="sc-empty">No code yet</span>`}</div>
        <div class="ai-btns">
          ${u.code ? `<button data-famcopy="${safe(u.id)}">📋 Copy</button><button data-famshare="${safe(u.id)}">📤 Share</button>` : ""}
          <button data-famcode="${safe(u.id)}">${u.code ? "🔁 New code" : "🔑 Make code"}</button>
          ${famEdit === u.id ? "" : `<button data-famedit="${safe(u.id)}">✏️ Edit</button>`}
          <button class="danger-text" data-famdel="${safe(u.id)}">🗑️ Remove</button>
          ${isParentDevice() ? `<button class="danger-fill" data-famreset="${safe(u.id)}">🗑️ Reset study data</button>` : ""}</div></div>`;
    }).join("")}</div>` : `<div class="card"><p class="sc-empty">No kids yet. Tap ➕ Add a kid.</p></div>`}
    <div class="card bd-card" style="margin-top:18px"><h2>👨‍👩‍👧 Add a parent</h2>
      <p class="hint">Makes a code for the other parent. They open the app, tap 👨‍👩‍👧 I'm a parent → Parent code, sign up with their own email, and type the code. It works once.</p>
      ${famParentCode ? `<div class="fam-code">🔑 <span class="code-big">${safe(famParentCode)}</span></div>
        <div class="ai-btns"><button data-famcopy="parent">📋 Copy</button><button data-famshare="parent">📤 Share</button></div>` : ""}
      <div class="ai-btns" style="margin-top:10px"><button class="primary" data-famcode="parent">${famParentCode ? "🔁 New parent code" : "🔑 Make a parent code"}</button></div></div>
    ${familySetup ? `<div class="btnrow" style="margin-top:18px"><button class="primary" data-famdone>✅ Done</button></div>` : ""}`;
}
function familyFormHtml(u) {
  const color = u.color || freeColor();
  return `<div class="sc-form fam-form">
    <div class="row"><div style="flex:0 0 84px"><label class="small" for="famEmoji">Emoji</label><input type="text" id="famEmoji" maxlength="8" value="${safe(u.emoji || "")}" placeholder="🐼"></div>
      <div><label class="small" for="famName">Name</label><input type="text" id="famName" maxlength="30" value="${safe(u.name || "")}" placeholder="Name"></div></div>
    <div class="emoji-pick">${EMOJIS.map(e => `<button type="button" data-famemoji="${e}" aria-label="Use ${e}">${e}</button>`).join("")}</div>
    <label class="small">Colour</label>
    <div class="swatches">${Object.entries(PALETTE).map(([key, c]) => `<label title="${key}"><input type="radio" name="famColor" value="${key}" ${color === key ? "checked" : ""}>
      <span style="background:${c.color}"></span></label>`).join("")}</div>
    ${u.id ? `<p class="hint">🏫 School, 📚 curriculum and 🎓 year: in ${safe(u.name)}'s 👤 profile (☰ More → 👤 My profile → ${safe(u.name)}).</p>`
      : schoolFieldsHtml("fam", u)}
    <div class="btnrow"><button class="primary" data-famsave>${u.id ? "💾 Save" : "➕ Add"}</button><button data-famcancel>Cancel</button></div>
    <div class="err" id="famErr"></div></div>`;
}
async function saveFamilyKid() {
  if (!isParentId(me)) return;
  const name = $("famName").value.trim().slice(0, 30), emoji = $("famEmoji").value.trim().slice(0, 8) || "🙂";
  const color = (document.querySelector('input[name="famColor"]:checked') || {}).value || freeColor();
  if (!name) return $("famErr").textContent = "Please type a name.";
  if (data.users.some(u => u.id !== famEdit && u.name.toLowerCase() === name.toLowerCase())) return $("famErr").textContent = "Someone already has that name.";
  const about = $("famSchool") ? schoolFieldsValue("fam") : {};   // (a new kid only: then they're kept in 👤 the profile)
  let u = famEdit !== "new" && data.users.find(x => x.id === famEdit);
  if (u) Object.assign(u, { name, emoji, color }, about);
  else { u = { id: newId(), name, emoji, color, ...about }; data.users.push(u); }
  Object.keys(about).forEach(k => { if (!u[k]) delete u[k]; });
  const isNew = famEdit === "new";
  famEdit = null;
  keepNow();
  toast(isNew ? `✓ ${emoji} ${name} added!` : "✓ Saved");
  if (isNew) makeCode(u.id);   // a new kid gets their code right away
}
// 🔑 A new code (a kid's, or "parent"): unique, saved in codes/{CODE}; a kid's old code stops working for new phones
async function makeCode(kidId) {
  if (!isParentId(me)) return;
  if (!cloud.user || !cloud.familyId || !navigator.onLine) return toast("🔌 Codes need the internet and the family sign-in.", 4000);
  const fb = cloud.fb, u = kidId === "parent" ? null : data.users.find(x => x.id === kidId);
  if (kidId !== "parent" && !u) return;
  try {
    let code = "";
    for (let tries = 0; tries < 6 && !code; tries++) {
      const pick = Array.from(crypto.getRandomValues(new Uint32Array(6)), n => CODE_CHARS[n % CODE_CHARS.length]).join("");
      if (!(await fb.getDoc(fb.doc(cloud.db, "codes", pick))).exists()) code = pick;
    }
    if (!code) throw new Error("busy");
    await fb.setDoc(fb.doc(cloud.db, "codes", code), { familyId: cloud.familyId, kidId, createdBy: cloud.user.uid, createdAt: new Date().toISOString() });
    if (u) {
      if (u.code) fb.deleteDoc(fb.doc(cloud.db, "codes", u.code)).catch(() => {});
      u.code = code;
      keepNow();
    } else { famParentCode = code; render(); }
    toast(`🔑 New code: ${code}`, 3500);
  } catch (err) {
    console.warn("Code:", err);
    toast(err && err.code === "permission-denied" ? "⚠ The cloud said no. Deploy the new Firestore rules first (firestore.rules)." : "Couldn't make a code. Please try again.", 5000);
  }
}
// The words to send: the code and how to use it
function codeText(kidId) {
  const link = location.origin + location.pathname;
  if (kidId === "parent") return `👨‍👩‍👧 Join our family in Family Plan: open ${link}, tap “I'm a parent” → “Parent code”, sign up with your email, and type ${famParentCode}.`;
  const u = userById(kidId);
  return `🧒 ${u.name}'s code for Family Plan: ${u.code}\nOpen ${link}, tap “I'm a kid”, and type the code.`;
}
function shareCode(kidId, how) {
  const text = codeText(kidId);
  if (how === "share" && navigator.share) return navigator.share({ title: "Family Plan code", text }).catch(() => {});
  copyText(text).then(ok => toast(ok ? "📋 Copied! Paste it in a message." : "Couldn't copy on this device.", 3000));
}
// 🗑️ Remove a kid: like removing a person in Settings, kept right away, and their code stops working
function removeFamilyKid(id) {
  const u = data.users.find(x => x.id === id), code = u && u.code;
  if (!removeUser(id)) return;
  if (code && cloud.user) cloud.fb.deleteDoc(cloud.fb.doc(cloud.db, "codes", code)).catch(() => {});
  if (famEdit === id) famEdit = null;
  keepNow();
}
$("scr-family").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || !isParentId(me)) return;
  const ds = b.dataset;
  if (ds.famedit) { famEdit = ds.famedit; render(); const n = $("famName"); if (n) n.focus(); return; }
  if ("famcancel" in ds) { famEdit = null; return render(); }
  if ("famsave" in ds) return saveFamilyKid();
  if (ds.famemoji) { $("famEmoji").value = ds.famemoji; return; }
  if (ds.famcode) return makeCode(ds.famcode);
  if (ds.famcopy) return shareCode(ds.famcopy, "copy");
  if ("famidcopy" in ds) return copyText(cloud.familyId || "").then(ok => toast(ok ? "📋 Family ID copied" : "Couldn't copy. Please write it down.", 2400));
  if (ds.famshare) return shareCode(ds.famshare, "share");
  if (ds.famdel) return removeFamilyKid(ds.famdel);
  if (ds.famreset) return openResetStudy(ds.famreset);
  if ("famdone" in ds) { familySetup = false; return go("home"); }
});

// ---------- 🗑️ Reset a kid's study data (parents, on a parent's device) ----------
// Deletes, for THAT kid only: their files, worksheets and explanations (cloud documents with kid == them), and in their school data
// the 📚 topics, 📂 files list, 📥 school work, 🧠 learning profile, 🌍 official curriculum map and the worksheet results;
// and their 📚 study session results. Subjects, school basics (profile), calendar (events), activities and points stay.
// (The school data and the session results go up as field changes: school.<kid>.<part>.<id> / sessions.<key>, see cloudUpdateFields,
// so the other kids' data is never touched.)
let resetKid = null;
const resetOk = kid => isParentId(me) && isParentDevice() && exists(kid) && !isParentId(kid);
function openResetStudy(kid) {
  if (!resetOk(kid)) return;
  const name = userById(kid).name;
  resetKid = kid;
  $("rsHint").textContent = `This deletes ALL of ${name}'s study data: files, topics, worksheets and results, explanations, learning profile, ` +
    `study session results and the official curriculum map. Subjects, school basics, calendar, activities and points stay. ` +
    `This can't be undone. Tip: 💾 Export a backup first.`;
  $("rsLabel").textContent = `Type ${name} to confirm`;
  $("rsName").value = "";
  $("rsDel").disabled = true;
  $("resetModal").hidden = false;
  $("rsName").focus();
}
function closeResetStudy() { $("resetModal").hidden = true; resetKid = null; }
// (the name as typed, without spaces around it; capitals don't matter, phones often add one)
const resetNameOk = () => !!resetKid && exists(resetKid) && sameSubject($("rsName").value, userById(resetKid).name);
$("rsName").addEventListener("input", () => $("rsDel").disabled = !resetNameOk());
$("rsName").addEventListener("keydown", e => { if (e.key === "Enter" && resetNameOk()) $("rsDel").click(); });
$("rsCancel").onclick = closeResetStudy;
$("resetModal").addEventListener("click", e => { if (e.target === $("resetModal")) closeResetStudy(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("resetModal").hidden) closeResetStudy(); });
$("rsDel").onclick = () => { if (!resetNameOk()) return; const kid = resetKid; closeResetStudy(); resetStudyData(kid); };
async function resetStudyData(kid) {
  if (!resetOk(kid)) return;
  if (!cloud.ready || !cloud.familyId || !navigator.onLine) return toast("🔌 Resetting study data needs the internet and the family sign-in.", 4000);
  const fb = cloud.fb, name = userById(kid).name;
  toast(`🗑️ Deleting ${name}'s study data…`, 8000);
  // 1) The cloud documents (files, worksheets, explanations) that are this kid's: batch deletes (at most 400 a batch)
  const gone = { files: [], worksheets: [], explanations: [] };
  try {
    const refs = [];
    for (const col of Object.keys(gone)) {
      const snap = await fb.getDocs(fb.query(fb.collection(cloud.db, "families", cloud.familyId, col), fb.where("kid", "==", kid)));
      snap.forEach(d => { refs.push(d.ref); gone[col].push(d.id); });
    }
    for (let i = 0; i < refs.length; i += 400) {
      const batch = fb.writeBatch(cloud.db);
      refs.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
  } catch (err) {
    console.warn("Reset study data:", err);
    return toast("⚠ Couldn't delete the study data. Nothing in the school data was changed. Please try again.", 5000);
  }
  // … and this device's copies of them (also files still waiting to go up)
  gone.worksheets.forEach(id => delete aiDocs.worksheets[id]);
  gone.explanations.forEach(id => delete aiDocs.explanations[id]);
  const s = data.school[kid], fileIds = new Set([...gone.files, ...Object.keys(s ? s.files : {}),
    ...Object.entries(fileWaiting).filter(([, p]) => p.kid === kid).map(([id]) => id)]);
  fileIds.forEach(id => { delete fileCache[id]; delete fileWaiting[id]; try { localStorage.removeItem(FILE_KEY + id); } catch (e) {} });
  // 2) The school data: topics, files list, work, learning profile, curriculum map, worksheet results
  // (curr and map are emptied, not removed, so they aren't made again from older data; see cleanSchool)
  if (s) {
    Object.assign(s, { files: {}, work: {}, learn: {}, map: {}, topics: {}, curr: {}, wsScores: {} });   // (📝 the only place the kept scores go)
    Object.keys(s.grades).forEach(id => { if (s.grades[id].type === "worksheet" || s.grades[id].worksheet) delete s.grades[id]; });
    // (no pointers left to deleted files: a homework's uploaded answer, and 📥 school work still waiting to be read)
    Object.values(s.tasks).forEach(t => { if (t.answer && fileIds.has(t.answer)) delete t.answer; });
    Object.keys(s.requests).forEach(id => { if (s.requests[id].kind === "work") delete s.requests[id]; });
  }
  // 3) Their 📚 study session results ("date|actId|kid")
  Object.keys(data.points.sessions).forEach(key => { if (key.split("|").pop() === kid) delete data.points.sessions[key]; });
  Object.keys(data.points.free).forEach(key => { if (key.split("|").pop() === kid) delete data.points.free[key]; });   // ⭐ their free study entries too
  Object.keys(data.points.picks).forEach(key => { if (key.split("|").pop() === kid) delete data.points.picks[key]; });   // 📚 and their subject picks
  keepNow();
  toast(`✓ ${name}'s study data was reset.`, 3500);
  addNews([newsItem("school", `🗑️ ${userById(me).name} reset ${name}'s study data`, "🗑️ reset study data", me)]);
}

// ---------- Backup: Export and Import ----------
// Export: turn your data into a text file (JSON) and download it.
$("exportBtn").onclick = exportBackup;
function exportBackup() {
  const backup = { app: "weekly-planner", version: 4, exportedAt: new Date().toISOString(), data };
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "weekly-planner-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast("✓ Backup downloaded. Check your Downloads folder.");
}
// Import: open the file picker, read the chosen file, check it, then replace your data.
// alreadyAsked = true when Bro2a already said "Yes" in the 💾 Backup box (so we don't ask twice).
let importAlreadyAsked = false;
function pickBackupFile(alreadyAsked) {
  importAlreadyAsked = alreadyAsked;
  $("importFile").click();
}
$("importBtn").onclick = () => pickBackupFile(false);
$("importFile").onchange = () => {
  const chosen = $("importFile").files[0];
  $("importFile").value = ""; // so you can pick the same file again later
  if (!chosen) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); } catch (e) {
      return toast("⚠ That file isn't a planner backup. Nothing was changed.", 4000);
    }
    const incoming = parsed && parsed.data ? parsed.data : parsed; // accept the backup wrapper or plain data
    if (!incoming || (!Array.isArray(incoming.fixed) && !Array.isArray(incoming.flexible) && !Array.isArray(incoming.users) && !Array.isArray(incoming.routines) && !incoming.myDay)) {
      return toast("⚠ That file isn't a planner backup. Nothing was changed.", 4000);
    }
    const cleaned = cleanData(incoming);
    const ok = importAlreadyAsked || confirm(`Load this backup?\n\n${cleaned.users.length} people\n${cleaned.fixed.length} fixed activities\n${cleaned.flexible.length} flexible activities\n${cleaned.routines.length} routines\n\nThis replaces the family's data on all devices (the cloud).`);
    if (!ok) return;
    data = cleaned;
    finishPlanAfterLoad();
    me = DAD;
    cloud.stash = null;
    resetFixedForm(); resetFlexForm(); resetUserForm(); closeRoutineForm(); resetHabitForm();
    writeData("replace");   // you already said yes, so it's kept right away — and replaces the cloud data
    render();
    toast("✓ Backup loaded and saved.");
  };
  reader.readAsText(chosen);
};

// 💾 Backup box on the home page (Bro2a only): Export, or Import after "Are you sure?"
function openBackupBox() {
  if (!isParentId(me)) return toast(`Ask ${dadName()} 🙂`);
  $("backupPick").hidden = false;
  $("backupAsk").hidden = true;
  $("backupModal").hidden = false;
  $("backupModal").querySelector("[data-backupexport]").focus();
}
function closeBackupBox() { $("backupModal").hidden = true; }

$("clearBtn").onclick = () => {
  if (!confirm("Delete all activities, people and settings — on ALL the family's devices?\n\nTip: click Cancel and use “Export backup” first if you might want them back.")) return;
  data = emptyData();
  allFilter = "all";
  cloud.stash = null;
  resetFixedForm(); resetFlexForm(); resetUserForm(); closeRoutineForm(); resetHabitForm();
  writeData("replace");   // you already said yes in the box, so it's kept right away (cloud too)
  render();
};

$("exampleBtn").onclick = () => {
  if ((data.fixed.length || data.flexible.length || data.routines.length) && !confirm("Replace everything with the example week?\n\nThis changes it on all the family's devices.")) return;
  data = emptyData();
  cloud.stash = null;
  allFilter = "all";
  resetFixedForm(); resetFlexForm(); resetUserForm(); closeRoutineForm(); resetHabitForm();
  // (every activity gets its automatic get ready / break times from its name)
  const fx = (name, users, days, start, end) => data.fixed.push({ id: newId(), name, days, start, end, overlapWith: [], users, helper: "", type: defaultActType({ name }), ...autoPads(name) });
  const fl = (id, name, user, duration, times, needsDad, overlapWith) => data.flexible.push({ id, name, duration, times, overlapWith: overlapWith || [], users: [user], helper: needsDad ? DAD : "", type: "activity", ...autoPads(name) });
  const rt = (name, emoji, start, duration, users) => data.routines.push({ id: newId(), name, emoji, start, duration, days: [0, 1, 2, 3, 4, 5, 6], users, custom: false });
  const everyone = data.users.map(u => u.id), kids = ["mody", "bana", "jawad"];
  fx("Work", [DAD], [0, 1, 2, 3, 4], "09:00", "17:00");
  fx("School", kids, [0, 1, 2, 3, 4], "07:30", "14:00");   // one activity for all three kids (15 min to get ready)
  // Routines: nothing gets planned on top of them
  rt("Breakfast", "🍳", "06:45", 20, everyone);
  rt("Lunch", "🍽️", "14:15", 30, everyone);
  rt("Dinner", "🍲", "19:00", 30, everyone);
  rt("Bedtime routine", "🌙", "20:30", 20, kids);
  // Mody's math and Bana's Arabic are allowed together (Dad can teach both at once).
  fl("ex-math", "Math", "mody", 45, 3, true, ["ex-arabic"]);
  fl("ex-arabic", "Arabic", "bana", 45, 3, true, ["ex-math"]);
  fl(newId(), "English", "jawad", 30, 4, true);
  fl(newId(), "Reading", "bana", 30, 3, false);
  fl(newId(), "Science", "mody", 45, 2, true);
  fl(newId(), "Quran", "jawad", 30, 3, true);
  fl(newId(), "Gym", DAD, 60, 3, false);  makeAndKeepPlan();
  writeData("replace");
  go("all");
  toast("✨ Example week loaded and planned!");
};
