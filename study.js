// =====================================================================
//  📚 STUDY TOPICS (the 🎒 School study): each subject's topics from the school files, 🚦 their status from the worksheets,
//  ⬆️ Upload (📚 Add to curriculum · ⚡ Instant worksheet), 📚 Start session (sections) + ➕ More questions,
//  🔗 weaknesses per topic, 🌍 the official curriculum + 📏 benchmark (parents), 📊 the parents' summary.
//  The kid only sees ⬆️ Upload · 📚 Start session · ✏️ My worksheets · the topics with coloured dots; all the detail is for parents.
//  Data (in data.school[kid]): curr (topic id → { sub, title, note, added, files }), map (subject id → the official list),
//  bench (subject id → the benchmark), learn[subject].topics (topic key → { title, src, results, skills }: see LEARNING PROFILE).
// =====================================================================
// 🚦 ⚪ New (no worksheet) · 🟡 Practising (a worksheet but < 2 results, or 60–84 %) · 🔴 Needs work (2+ results, the last 3 average < 60 %)
//    · 🟢 Mastered (≥ 85 % twice in a row)
const ST = { new: ["⚪", "New"], practising: ["🟡", "Practising"], needs: ["🔴", "Needs work"], mastered: ["🟢", "Mastered"] };
const ST_FILTERS = [["all", "All"], ["new", "⚪ Not practised"], ["needs", "🔴 Needs work"], ["mastered", "🟢 Mastered"]];
const KIND_OF = { needs: "needs_work", new: "new", practising: "practising", mastered: "review" };
const lowerT = t => String(t || "").trim().toLowerCase();
const meanPct = list => list.length ? Math.round(list.reduce((n, x) => n + x, 0) / list.length) : null;   // (the average of some %)
const dayMon = d => { const x = fromYmd(String(d).slice(0, 10)); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };
let stSub = null, stPick = [], stFilter = "all", stOpen = null, stWs = false, stFiles = false, stMapPick = [];   // (the subject page)
// A subject's school topics, newest first: [{ id, sub, title, note, added, files }]
function topicsOf(s, sid) {
  return Object.entries(s.curr || {}).filter(([, t]) => t.sub === sid).map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => (b.added || "").localeCompare(a.added || "") || a.title.localeCompare(b.title));
}
// Does a worksheet practise this topic? (its questions' topics; older ones: its part or topics)
function wsHasTopic(w, title) {
  const t = lowerT(title);
  if (w.questions.some(q => q.topic)) return w.questions.some(q => lowerT(q.topic) === t);
  return lowerT(w.part) === t || w.topics.some(x => lowerT(x) === t);
}
// The topic's % in a checked worksheet (only its own questions, when they're marked by topic)
function topicPctIn(w, title) {
  const qs = w.questions.filter(q => lowerT(q.topic) === lowerT(title));
  if (!qs.length || !w.check.questions.length) return wsPct(w);
  const nums = new Set(qs.map(q => q.number)), max = qs.reduce((n, q) => n + (q.points || 1), 0);
  const got = w.check.questions.filter(q => nums.has(q.number)).reduce((n, q) => n + (q.points || 0), 0);
  return max ? Math.round(Math.min(1, got / max) * 100) : wsPct(w);
}
// A school topic's worksheets (newest first), results (oldest first: [{ date, ws, pct }]) and 🔗 its skills
// (⚡ instant and 🌍 extra worksheets only count when they're 🔗 linked to the topic: links = worksheet id → its own wording of the topic)
function topicInfo(kid, f, title, links) {
  const ln = links || {}, list = wsOf(kid, f.name).filter(w => hasOwn(ln, w.id) || (!w.src && wsHasTopic(w, title)));
  const L = (schoolOf(kid).learn || {})[f.id];
  // (the 🧠 profile's topic: under this title (school worksheets), and under each linked worksheet's own wording (any kind))
  const lts = [];
  [title, ...Object.values(ln)].forEach((t, i) => {
    const lt = L && L.topics ? L.topics[topicKey(t)] : null;
    if (lt && !lts.includes(lt) && (i > 0 || lt.src === "school")) lts.push(lt);
  });
  const fromWs = list.filter(w => w.check).map(w => ({ date: String(w.check.at || w.date).slice(0, 10), ws: w.id, pct: topicPctIn(w, ln[w.id] || title) }));
  const kept = lts.flatMap(lt => lt.results).filter((r, i, all) => !fromWs.some(x => x.ws === r.ws) && !aiDocs.worksheets[r.ws] && all.findIndex(y => y.ws === r.ws && y.date === r.date) === i);
  const results = [...fromWs, ...kept].sort((a, b) => a.date.localeCompare(b.date));
  return { list, results, skills: Object.assign({}, ...lts.map(lt => lt.skills || {}).reverse()) };
}
function topicStatus(info) {
  const r = info.results.map(x => x.pct), n = r.length;
  if (n >= 2 && r[n - 1] >= 85 && r[n - 2] >= 85) return "mastered";
  if (n >= 2 && meanPct(r.slice(-3)) < 60) return "needs";
  return info.list.length || n ? "practising" : "new";
}
const statusDot = st => `<span class="st-dot" role="img" aria-label="${ST[st][1]}" title="${ST[st][1]}">${ST[st][0]}</span>`;
// 🔗 The topic's weak skills (mastery < 60, weakest first); older: the last check's 🎯 points
function topicWeak(info) {
  const sk = Object.entries(info.skills || {}).filter(([, v]) => v.mastery < 60).sort((a, b) => a[1].mastery - b[1].mastery).map(([n]) => n);
  if (sk.length) return sk.slice(0, 3);
  const last = (info.list || []).find(w => w.check);
  return last ? (last.check.weak_points || []).slice(0, 2) : [];
}
// Every school topic of a subject with its status (newest first)
const topicRows = (kid, s, f) => topicsOf(s, f.id).map(t => { const info = topicInfo(kid, f, t.title, t.links); return { ...t, info, st: topicStatus(info) }; });

// ---------- 📚 The topics card: ☐ tick · 🚦 dot · the title (parents: date · worksheets · last score; tap → its history) ----------
function topicsCardHtml(s, f, parent) {
  const all = topicRows(schoolKid, s, f);
  stPick = stPick.filter(id => all.some(t => t.id === id));
  const shown = parent && stFilter !== "all" ? all.filter(t => t.st === stFilter) : all;
  const count = k => all.filter(t => t.st === k).length;
  const rows = shown.map(t => {
    const on = stPick.includes(t.id), n = t.info.list.length, last = t.info.results[t.info.results.length - 1];
    const meta = [t.added ? `Added ${dayMon(t.added)}` : "", t.src === "ws" ? WS_TOPIC_TAG : "", n ? `${n} ${n === 1 ? "worksheet" : "worksheets"}` : "", last ? `last ${last.pct}%` : ""].filter(Boolean).join(" · ");
    return `<li class="st-topic ${on ? "on" : ""}"><label class="st-tick"><input type="checkbox" data-sttick="${safe(t.id)}" ${on ? "checked" : ""} aria-label="Pick ${safe(t.title)}"></label>
      ${statusDot(t.st)}${parent ? `<button class="st-name" data-sthist="${safe(t.id)}" aria-expanded="${stOpen === t.id}"><b>${safe(t.title)}</b>${meta ? `<small>${safe(meta)}</small>` : ""}</button>`
        : `<span class="st-name"><b>${safe(t.title)}</b>${t.src === "ws" ? `<small>${WS_TOPIC_TAG}</small>` : ""}</span>`}
      ${parent && stOpen === t.id ? topicHistoryHtml(t) : ""}</li>`;
  }).join("");
  return `<div class="card bd-card st-card"><h2>📚 ${parent ? "Topics" : "My topics"}</h2>
    ${parent && all.length ? `<div class="chips st-filters">${ST_FILTERS.map(([k, label]) => `<button class="chip ${stFilter === k ? "on" : ""}" data-stfilter="${k}" aria-pressed="${stFilter === k}">${label}${k === "all" ? "" : ` (${count(k)})`}</button>`).join("")}</div>` : ""}
    ${all.length ? `<ul class="st-list">${rows || `<li class="sc-empty">No topics here.</li>`}</ul>
      <p class="st-legend">⚪ New · 🟡 Practising · 🔴 Needs work · 🟢 Mastered</p>
      <div class="btnrow"><button class="primary st-make ${stPick.length ? "" : "off"}" data-stmake data-aiwait="stmake" aria-disabled="${!stPick.length}">✏️ Make a worksheet${stPick.length ? ` (${stPick.length})` : ""}</button></div>`
      : `<p class="sc-empty">📂 No topics yet. Tap ⬆️ Upload and add a school file (a photo or PDF).</p>`}</div>`;
}
// 👨‍👩‍👧 A topic's history: each worksheet, its date, score and 🎯 weak points
function topicHistoryHtml(t) {
  const list = t.info.list;
  return `<div class="st-hist">${list.length ? `<ul>${list.map(w => { const pct = w.check ? topicPctIn(w, t.title) : null, weak = w.check ? w.check.weak_points || [] : [];
      return `<li><button class="linkbtn" data-aiopen="worksheet|${safe(w.id)}">📝 ${safe(w.title)}</button>
        <small>${dayMon(w.date)} · ${pct != null ? `${pct}%` : safe(w.status)}</small>${weak.length ? `<small class="st-weak">🎯 ${safe(weak.join(", "))}</small>` : ""}</li>`; }).join("")}</ul>`
    : `<p class="hint">No worksheets on this topic yet.</p>`}${t.note ? `<p class="hint">${safe(t.note)}</p>` : ""}${t.files.length ? `<p class="hint">📂 ${t.files.length} school ${t.files.length === 1 ? "file" : "files"}</p>` : ""}</div>`;
}
// ✏️ Make a worksheet on the ticked topics (one section a topic; focus = their weak skills)
async function makeFromTopics() {
  const s = schoolOf(schoolKid), f = s.subjects[schoolSubject] && { id: schoolSubject, ...s.subjects[schoolSubject] };
  if (!f) return;
  if (!stPick.length) return toast("📌 Select at least one topic first.", 2500);
  const items = topicRows(schoolKid, s, f).filter(t => stPick.includes(t.id));
  const sections = items.length > 1 ? items.map(t => ({ topic: t.title, minutes: Math.max(5, Math.round(30 / items.length)), focus: topicWeak(t.info), kind: KIND_OF[t.st] })) : [];
  const focus = [...new Set(items.flatMap(t => topicWeak(t.info)))].slice(0, 3);
  const id = await newWorksheet(schoolKid, f.name, items.map(t => t.title), 10, pickMode(schoolKid, f.name), "stmake",
                                { part: items[0].title, ...(focus.length ? { focus } : {}), ...(sections.length ? { sections } : {}) }, true);
  if (id) { stPick = []; toast("✨ Your worksheet is ready! 🖨️ Print or 📄 PDF.", 3500); }
}

// ---------- 📚 Study sessions: the sections (📚 Start session, ➕ More questions) ----------
// The worksheets made for a session, oldest first
const sessionWsIds = key => Object.entries(aiDocs.worksheets).filter(([, w]) => w.session === key)
  .sort((a, b) => String(a[1].at || "").localeCompare(String(b[1].at || ""))).map(([id]) => id);
// The session's sections for `minutes`: 🔴 needs work ≈ 50 % (weakest first, their weak skills as focus) → ⚪ never practised ≈ 25 %
// (newest first) → 🟡 practising ≈ 20 % → 🟢 a quick review ≈ 7 % (only every 3rd session of the subject). Empty groups share their time.
// All 🟢: the newest topics + a small 🚀 challenge. Only 1 topic: the whole session on it, mixed difficulty.
function sessionSections(kid, s, f, minutes) {
  const rows = topicRows(kid, s, f);
  const avg = t => { const r = t.info.results.slice(-3).map(x => x.pct); return r.length ? meanPct(r) : 100; };
  if (rows.length === 1) return [{ topic: rows[0].title, minutes, focus: topicWeak(rows[0].info), kind: rows[0].st === "needs" ? "needs_work" : "practising" }];
  const g = { needs: rows.filter(t => t.st === "needs").sort((a, b) => avg(a) - avg(b)), new: rows.filter(t => t.st === "new"),
              practising: rows.filter(t => t.st === "practising").sort((a, b) => avg(a) - avg(b)), mastered: rows.filter(t => t.st === "mastered") };
  if (!g.needs.length && !g.new.length && !g.practising.length) {   // all 🟢
    const a = g.mastered[0], b = g.mastered[1] || a, main = Math.max(5, Math.round(minutes * 0.75));
    return [{ topic: a.title, minutes: main, focus: [], kind: "practising" }, { topic: b.title, minutes: Math.max(5, minutes - main), focus: [], kind: "challenge" }];
  }
  const review = wsOf(kid, f.name).filter(w => w.session).length % 3 === 2;   // (every 3rd session of this subject)
  const plan = [["needs", 0.5, 2], ["new", 0.25, 2], ["practising", 0.2, 2], ...(review ? [["mastered", 0.07, 1]] : [])].filter(([k]) => g[k].length);
  const total = plan.reduce((n, p) => n + p[1], 0), out = [];
  plan.forEach(([k, w, most]) => {
    const gm = Math.round(minutes * w / total), n = Math.max(1, Math.min(most, g[k].length, Math.floor(gm / 5)));
    g[k].slice(0, n).forEach(t => out.push({ topic: t.title, minutes: Math.max(5, Math.round(gm / n)), focus: k === "needs" ? topicWeak(t.info) : [], kind: KIND_OF[k] }));
  });
  return out.slice(0, 6);
}
// 📚 Start session (calendar or 📚 STUDY; no upload): a worksheet that fills the session (or the minutes left), in sections
async function startSession(key) {
  const x = sessionByKey(key);
  if (!x) return toast("This session isn't in this week's plan any more.", 3000);
  if (kidLockedOut(x.person)) return lockedToast(x.person);
  if (x.needsPick) return askSessionSubject(x);   // 📚 several subjects and none picked yet: "Which subject today?" first
  const s = schoolOf(x.person), sid = x.subjectId && s.subjects[x.subjectId] ? x.subjectId : folderIdFor(s, x.subject);
  if (!sid) return toast(`📘 Pick a subject for “${x.act.name}” in ✏️ Add activities first.`, 4000);
  const f = { id: sid, ...s.subjects[sid] };
  openSchool(x.person);
  goSchool("subject", sid, "");
  const made = sessionWsIds(key);
  if (made.length) return openAiDoc("worksheet", made[made.length - 1]);   // (made already: open it)
  if (!topicsOf(s, sid).length) {
    if (confirm(`📂 Upload a file for ${f.name} first, so I know what you're learning.\n\nUpload now?`)) openUpload(sid);
    return;
  }
  const now = dubaiMinutes(), live = x.date === todayYmd() && x.start <= now && now < x.end, minutes = Math.max(5, live ? x.end - now : x.minutes);
  const sections = sessionSections(x.person, s, f, minutes);
  await newWorksheet(x.person, f.name, [...new Set(sections.map(y => y.topic))], 10, pickMode(x.person, f.name), "session|" + key,
                     { session: key, minutes, sections, part: sections[0].topic }, true);
}
// ➕ More questions (the session hasn't ended; after the answers are uploaded or 🙋 I'm done): the minutes left, nothing repeated
async function moreQuestions(key) {
  const x = sessionByKey(key);
  if (!x || x.ended) return toast("⏰ This session has ended. Well done! 🌟", 3000);
  const s = schoolOf(x.person), sid = x.subjectId && s.subjects[x.subjectId] ? x.subjectId : folderIdFor(s, x.subject);
  if (!sid) return;
  const f = { id: sid, ...s.subjects[sid] }, now = dubaiMinutes(), minutes = Math.max(5, x.date === todayYmd() && x.start <= now ? x.end - now : x.minutes);
  const ids = sessionWsIds(key), avoid = ids.flatMap(id => aiDocs.worksheets[id].questions.map(q => q.prompt)).slice(-80);
  const sections = topicsOf(s, sid).length ? sessionSections(x.person, s, f, minutes) : [];
  const last = aiDocs.worksheets[ids[ids.length - 1]] || {};
  await newWorksheet(x.person, f.name, sections.length ? [...new Set(sections.map(y => y.topic))] : last.topics || [f.name], 10, pickMode(x.person, f.name),
                     "more|" + key, { session: key, minutes, avoid, ...(sections.length ? { sections, part: sections[0].topic } : { part: last.part || f.name }) }, true);
}
// 🙋 I'm done (then ➕ More questions shows while the session lasts)
function sessionDone(wsId) {
  const w = aiDocs.worksheets[wsId];
  if (!w || (isKidDevice() && w.kid !== kidDeviceId())) return;
  aiSave("worksheets", wsId, { ...w, done: true });
  render();
}

// ---------- ⬆️ Upload: 📚 Add to curriculum (kept in 📂 Files → 🤖 its topics, ticked) · ⚡ Instant worksheet (the file isn't kept) ----------
// From a subject: both; from the School home: 📚 for all the kid's subjects (a newsletter, a school review …)
let aw = null;   // { kid, sid ("" = all subjects), kind: "curr" | "instant" | null, items: [{ id (kept file) or null, name, kind, url, size }], result, err }
function openUpload(sid) {
  if (!schoolKid || !exists(me)) return;
  const s = schoolOf(schoolKid), home = !sid || !s.subjects[sid];
  aw = { kid: schoolKid, sid: home ? "" : sid, kind: home ? "curr" : null, items: [], result: null, err: aiReady() ? "" : `🔌 ${AI_OFF}.` };
  $("aiWorkModal").hidden = false;
  drawUpload();
}
function closeWork() { $("aiWorkModal").hidden = true; aw = null; }   // (📚 files kept already stay in 📂 Files)
function drawUpload() {
  if (!aw) return;
  const s = schoolOf(aw.kid), f = aw.sid && s.subjects[aw.sid], body = [];
  $("awTitle").textContent = f ? `⬆️ Upload · ${f.emoji} ${f.name}` : "⬆️ Upload a school file";
  if (!aw.kind) body.push(h("p", { class: "print-hint" }, "What is this file for?"),
    h("div", { class: "aw-kinds" },
      h("button", { type: "button", class: "aw-kind", data: { awkind: "curr" } }, h("span", { class: "e" }, "📚"), h("b", null, "Add to curriculum"), h("small", null, "Keep it in 📂 Files and add its topics")),
      h("button", { type: "button", class: "aw-kind", data: { awkind: "instant" } }, h("span", { class: "e" }, "⚡"), h("b", null, "Instant worksheet"), h("small", null, "A worksheet on it right now. The file isn't kept."))),
    h("div", { class: "btnrow" }, h("button", { type: "button", data: { awclose: "" } }, "Close")));
  else if (aw.result) body.push(...curriculumReviewNodes(s));
  else {
    const total = aw.items.reduce((n, x) => n + bytesOf(x.url), 0);
    body.push(h("p", { class: "print-hint" }, aw.kind === "instant" ? "⚡ Add a photo or PDF of what you're learning. I make a worksheet only about it."
        : f ? `📚 Add the school file (photo, PDF, PowerPoint or Word). I find its ${f.name} topics.`
        : "📚 Add a newsletter, a school review or school work. I find the topics for every subject, and the school dates."),
      h("div", { class: "sc-photo-row", style: "margin:12px 0 4px" }, h("button", { type: "button", class: "pill", data: { awpick: "" } }, "📷 Add photos or PDF"),
        h("span", { class: "ai-size" }, aw.items.length ? `${aw.items.length} ${aw.items.length === 1 ? "file" : "files"} · ${sizeText(total)}` : "")),
      aw.items.length ? h("ul", { class: "list" }, aw.items.map((x, i) => h("li", null, h("span", { class: "uemoji" }, FILE_EMOJI[x.kind]),
        h("div", { class: "what" }, x.name, h("small", null, sizeText(x.size) + (aw.kind === "instant" ? " · not kept" : x.id ? " · kept in 📂 Files" : " · too big to keep: only read now"))),
        h("button", { type: "button", class: "x", "aria-label": "Remove " + x.name, data: { awdel: i } }, "✕")))) : null,
      h("div", { class: "err" }, aw.err),
      h("div", { class: "btnrow" }, aw.kind === "instant"
        ? h("button", { type: "button", class: "primary", data: { awgo: "", aiwait: "instant" } }, "⚡ Make my worksheet")
        : h("button", { type: "button", class: "primary", data: { awgo: "", aiwait: "curriculum" } }, "🤖 Find the topics"),
        h("button", { type: "button", data: { awclose: "" } }, "Close")));
  }
  $("awBody").replaceChildren(...body.filter(Boolean));
  showAiWait();
}
// The chosen files: 📚 kept in 📂 Files (the subject's, or the kid's from the School home); ⚡ only read, never kept
async function addUploadFiles(files) {
  const box = aw;
  if (!box || !box.kind) return;
  const s = schoolFor(box.kid), f = box.sid && s.subjects[box.sid], problems = [];
  box.err = "⏳ Getting the files ready…";
  drawUpload();
  let kept = 0;
  for (const file of files) {
    const { r, keep, problem } = await readForAi(file);
    if (problem) problems.push(problem);
    if (!r) continue;
    let id = null;
    if (keep && box.kind === "curr") {
      id = newId();
      s.files[id] = { subject: f ? f.name : "", name: r.name, kind: r.kind, size: r.size, date: todayYmd(), by: me };
      storeFileData(id, box.kid, r.url);
      kept++;
    }
    box.items.push({ id, name: r.name, kind: r.kind, url: r.url, size: r.size });
  }
  if (kept) { writeData(); render(); }
  if (aw !== box) return;
  const total = box.items.reduce((n, x) => n + bytesOf(x.url), 0);
  box.err = problems.length ? problems.join(" ") : total > AI_MAX ? tooBigText(total) : "";
  drawUpload();
}
function removeUploadFile(i) {
  const x = aw && aw.items[i];
  if (!x) return;
  const s = schoolFor(aw.kid), f = x.id && s.files[x.id];
  if (f && canChange(f)) { deleteFileData(x.id); delete s.files[x.id]; writeData(); render(); }
  aw.items.splice(i, 1);
  aw.err = "";
  drawUpload();
}
async function uploadFilesForAi(box) {
  const total = box.items.reduce((n, x) => n + bytesOf(x.url), 0);
  box.err = !box.items.length ? "Add the photos or PDF first (📷 Add photos or PDF)." : total > AI_MAX ? tooBigText(total) : "";
  if (box.err) { drawUpload(); return null; }
  try { return await aiFilesFor(box.items); } catch (err) { box.err = aiFileError(err); drawUpload(); return null; }
}
// 📚 🤖 /curriculum: the topics of this subject (or of all the kid's subjects), matched to the ones we have, and the school dates
async function findCurriculum() {
  const box = aw;
  if (!box) return;
  const s = schoolOf(box.kid), subs = box.sid ? [{ id: box.sid, ...s.subjects[box.sid] }] : subjectList(s);
  if (!subs.length) { box.err = "Add the subjects first (👤 Profile → ⚙️ Settings)."; return drawUpload(); }
  const files = await uploadFilesForAi(box);
  if (!files) return;
  const r = await callAi("curriculum", { files, ...kidInfo(box.kid), today: todayYmd(),
    subjects: subs.map(x => ({ id: x.id, name: x.name, existing: topicsOf(s, x.id).map(t => t.title).slice(0, 80) })), ...(box.sid ? { only: box.sid } : {}) }, "curriculum");
  if (!r || aw !== box) return;
  box.result = cleanCurriculum(s, subs, r);
  box.err = "";
  drawUpload();
}
// → { groups: [{ sid, topics: [{ title, note, same (the existing topic's id, or ""), on }] }], events: [{ date, time, title, on }] }
// (only the kid's own subjects; a topic the AI says is the same as one we have: greyed and unticked)
function cleanCurriculum(s, subs, r) {
  const groups = [];
  aiObjs(r.subjects, 20).forEach(x => {
    const sid = subs.some(y => y.id === x.subjectId) ? x.subjectId : "";
    if (!sid) return;
    const have = topicsOf(s, sid);
    let g = groups.find(y => y.sid === sid);
    if (!g) groups.push(g = { sid, topics: [] });
    aiObjs(x.topics, 30).forEach(t => {
      const title = aiTxt(t.title, 80), sameAs = aiTxt(t.same_as, 80);
      if (!title || g.topics.some(y => lowerT(y.title) === lowerT(title))) return;
      const hit = (sameAs && have.find(y => lowerT(y.title) === lowerT(sameAs))) || have.find(y => lowerT(y.title) === lowerT(title));
      g.topics.push({ title, note: aiTxt(t.note, 200), same: hit ? hit.id : "", on: !hit });
    });
  });
  const events = aiObjs(r.events, 30).map(e => ({ date: isYmd(e.date) ? e.date : "", time: hmOf(e.time), title: aiTxt(e.title, 80), on: true })).filter(e => e.date && e.title);
  return { groups: groups.filter(g => g.topics.length), events };
}
// One screen grouped by subject: ☑ each topic (greyed "Already in Math as …", unticked) · 📅 the school dates · ✅ Add
function curriculumReviewNodes(s) {
  const res = aw.result, out = [];
  if (!res.groups.length && !res.events.length) out.push(h("p", { class: "sc-empty" }, "🤖 I couldn't find any topics for these subjects in this file."));
  else if (res.groups.length) out.push(h("p", { class: "print-hint" }, "Untick what you don't want, then tap ✅ Add."));
  res.groups.forEach((g, gi) => {
    const f = s.subjects[g.sid];
    out.push(h("h3", { class: "ph-group" }, `${f.emoji} ${f.name}`),
      h("ul", { class: "list aw-topics" }, g.topics.map((t, ti) => { const old = t.same && s.curr[t.same];
        return h("li", { class: old ? "aw-same" : null }, h("label", { class: "checkline" },
          h("input", { type: "checkbox", checked: t.on, data: { awt: gi + "|" + ti } }),
          h("span", null, h("b", null, t.title), old ? h("small", null, `Already in ${f.name} as “${old.title}”`) : t.note ? h("small", null, t.note) : null))); })));
  });
  if (res.events.length) out.push(h("h3", { class: "ph-group" }, "📅 Add to calendar"),
    h("ul", { class: "list" }, res.events.map((e, i) => h("li", null, h("label", { class: "checkline" }, h("input", { type: "checkbox", checked: e.on, data: { awe: i } }),
      h("span", null, h("b", null, `📌 ${shortDate(e.date)}${e.time ? " · " + clock(toMin(e.time), true) : ""}`), " " + e.title))))));
  out.push(h("div", { class: "err" }, aw.err),
    h("div", { class: "btnrow" }, res.groups.length || res.events.length ? h("button", { type: "button", class: "primary", data: { awadd: "" } }, "✅ Add") : null,
      h("button", { type: "button", data: { awclose: "" } }, "Close")));
  return out;
}
// ✅ Add: the ticked topics go into their OWN subjects; an unticked "already there" one gets the file and moves to the top (today);
// the ticked 📅 dates go on the calendar (no doubles)
function addCurriculum() {
  const box = aw;
  if (!box || !box.result) return;
  const s = schoolFor(box.kid), files = box.items.map(x => x.id).filter(id => id && s.files[id]), today = todayYmd();
  const touch = x => { x.added = today; x.files = [...new Set([...x.files, ...files])].slice(0, 30); };
  let added = 0, linked = 0, dates = 0;
  box.result.groups.forEach(g => g.topics.forEach(t => {
    if (t.on) {
      const id = topicIdOf(g.sid, t.title);
      if (s.curr[id]) { touch(s.curr[id]); linked++; }   // (the very same title)
      else { s.curr[id] = { sub: g.sid, title: t.title, note: t.note, added: today, files: files.slice(0, 30), by: me }; added++; }
    } else if (t.same && s.curr[t.same]) { touch(s.curr[t.same]); linked++; }
  }));
  box.result.events.filter(e => e.on).forEach(e => {
    if (Object.values(s.events).some(x => x.date === e.date && lowerT(x.title) === lowerT(e.title))) return;
    s.events[newId()] = { date: e.date, time: e.time, title: e.title, note: "", by: me };
    dates++;
  });
  writeData();
  closeWork();
  render();
  toast(`📚 ${added} new ${added === 1 ? "topic" : "topics"}${linked ? ` · ${linked} already there (moved to the top)` : ""}${dates ? ` · 📅 ${dates} school ${dates === 1 ? "date" : "dates"}` : ""}`, 4000);
}
// ---------- 📚 Every topic a kid practises in ANY worksheet is in that subject's 📚 My topics too ----------
// (⚡ instant, 📚 study session, ➕ more questions, 🔁 practice, 🚀 challenge …) Each of its topics (the questions' topics, else its part,
// else its topics, else its title) goes in like 📚 Add to curriculum: newest on top, its "Added" date, the tag "⚡ from a worksheet".
// No doubles: the same topic (even worded a little differently, see sameTopicTitle) isn't added again, the existing one is used.
// 🔗 The worksheet is linked to each topic (links), so its check moves the topic's 🚦 dot and its weak skills show there.
// (⚡ the instant FILE is still not kept: only the topics. No subject, or a subject that's gone: skipped.)
const WS_TOPIC_TAG = "⚡ from a worksheet";
const TOPIC_STOP = new Set(["the", "a", "an", "of", "and", "to", "in", "on", "for", "with", "using", "intro", "introduction", "basics", "&"]);
// A topic's words, plain: lower case, no accents or punctuation, no little words, simple plurals made singular
function topicWords(t) {
  return lowerT(t).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter(w => w && !TOPIC_STOP.has(w))
    .map(w => w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 4 && /(s|x|z|ch|sh)es$/.test(w) ? w.slice(0, -2)
      : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
}
// The same topic? The same words in any order ("Fractions: adding" = "Adding fractions"), or nearly (¾ of the words in common)
function sameTopicTitle(a, b) {
  if (lowerT(a) === lowerT(b)) return true;
  const A = new Set(topicWords(a)), B = new Set(topicWords(b));
  if (!A.size || !B.size) return false;
  const both = [...A].filter(w => B.has(w)).length;
  return both / new Set([...A, ...B]).size >= 0.75;
}
// The topics a worksheet practises, as it words them (no doubles)
function wsTopicTitles(w) {
  const q = (w.questions || []).map(x => String(x.topic || "").trim()).filter(Boolean);
  const list = q.length ? q : w.part ? [w.part] : (w.topics || []).length ? w.topics : [w.title];
  return [...new Map(list.map(t => String(t || "").trim().slice(0, 80)).filter(Boolean).map(t => [lowerT(t), t])).values()];
}
// One worksheet → its topics in its kid's subject. → true when the school data changed (the caller saves it)
function topicsFromWorksheet(id, w) {
  if (!w || !okId(id) || !exists(w.kid) || isParentId(w.kid) || (isKidDevice() && w.kid !== kidDeviceId())) return false;
  const s = data.school[w.kid], f = s && folderOf(s, w.subject);
  if (!f) return false;   // (no subject, or one that's gone)
  if (!s.curr) s.curr = {};
  if (Object.values(s.curr).some(t => t.links && hasOwn(t.links, id))) return false;   // (done already)
  const have = topicsOf(s, f.id), added = isYmd(w.date) ? w.date : todayYmd();
  wsTopicTitles(w).forEach(title => {
    const hit = have.find(t => lowerT(t.title) === lowerT(title)) || have.find(t => sameTopicTitle(t.title, title));
    if (hit) { const x = s.curr[hit.id]; x.links = { ...(x.links || {}), [id]: title }; return; }   // (the existing topic is used)
    const tid = topicIdOf(f.id, title);
    s.curr[tid] = { sub: f.id, title, note: "", added, files: [], src: "ws", links: { [id]: title }, ...(exists(w.by) ? { by: w.by } : {}) };
    have.unshift({ id: tid, ...s.curr[tid] });
  });
  return true;
}
// Every worksheet we have (the ones the kids already did, and ones made on another phone): once each, no doubles
function topicsFromAllWorksheets() {
  if ((cloud.enabled && !cloud.ready) || hasDraft()) return;
  let changed = false;
  Object.entries(aiDocs.worksheets).forEach(([id, w]) => { if (topicsFromWorksheet(id, w)) changed = true; });
  if (changed) { writeData("auto"); if (screen === "school") render(); }
}
// ⚡ Instant worksheet: only about the file (nothing about the file is kept; its results go to the 🧠 profile under the topic found)
// During a 📚 study session now: 🤖 finds the file's subject first. The same subject → the minutes left, it's the session's result.
// Another subject → "Continue anyway?" Yes → it still counts for the session, "🔁 swapped to …", and the parents are told.
async function instantWorksheet() {
  const box = aw;
  if (!box) return;
  const files = await uploadFilesForAi(box);
  if (!files) return;
  const kid = box.kid, s = schoolOf(kid), page = s.subjects[box.sid], now = dubaiMinutes();
  const sess = sessionsIn(kid, [todayYmd()]).find(x => x.start <= now && now < x.end);
  const extra = { src: "instant", instant: true, files };
  let subject = page ? page.name : "";
  if (sess) {
    const r = await callAi("analyze", { files, ...kidInfo(kid) }, "instant");
    if (!r || aw !== box) return;
    const found = aiTxt(r.subject, 30), fid = folderIdFor(s, found), name = fid ? s.subjects[fid].name : found;
    const same = !found || (fid && fid === sess.subjectId) || sameSubject(name, sess.subject);
    if (!same && !confirm(`⚠️ This looks like ${name}, but now is your ${sess.subject} time. Continue anyway?`)) return closeWork();
    subject = same ? sess.subject : name;
    Object.assign(extra, { session: sess.key, minutes: Math.max(5, sess.end - now), ...(same ? {} : { swap: name }) });
    if (!same) addNews([newsItem("school", `🔁 ${kidNameOf(kid)} swapped ${sess.subject} with ${name} (${clock(sess.start, true)}–${clock(sess.end, true)})`, "", kid)]);
  }
  const id = await newWorksheet(kid, subject, [], 10, "practice", "instant", extra, true);
  if (aw === box) closeWork();
  if (id) toast("⚡ Your worksheet is ready!", 3000);
}
$("aiWorkModal").addEventListener("click", e => {
  if (e.target === $("aiWorkModal")) return closeWork();
  const b = e.target.closest("button");
  if (!b || !aw) return;
  const ds = b.dataset;
  if ("awclose" in ds) return closeWork();
  if (ds.awkind) { aw.kind = ds.awkind; return drawUpload(); }
  if ("awpick" in ds) { aiPick = "work"; $("aiFile").value = ""; return $("aiFile").click(); }
  if (ds.awdel !== undefined) return removeUploadFile(Number(ds.awdel));
  if ("awgo" in ds) return aw.kind === "instant" ? instantWorksheet() : findCurriculum();
  if ("awadd" in ds) return addCurriculum();
});
$("aiWorkModal").addEventListener("change", e => {
  const ds = e.target.dataset || {};
  if (!aw || !aw.result) return;
  if (ds.awt) { const [g, t] = ds.awt.split("|").map(Number); aw.result.groups[g].topics[t].on = e.target.checked; }
  if (ds.awe) aw.result.events[Number(ds.awe)].on = e.target.checked;
});

// ---------- 🌍 The official curriculum (parents only, never mixed with the school topics): the 🤖 /topics list for the kid's school
// system and year, 📊 Benchmark (🤖 /benchmark: covered · not yet · ahead), 🌍 extra practice (its results: the 🧠 profile only) ----------
const mapLabel = kid => /igcse|british/i.test(curriculumOf(kid) || "") || !curriculumOf(kid) ? "IGCSE" : curriculumOf(kid);
async function loadMap(kid, sid) {
  const s = schoolOf(kid), f = s.subjects[sid];
  if (!f || !isParentDevice()) return;
  const syl = s.syllabus;
  const r = await callAi("topics", { ...kidInfo(kid), subject: f.name, today: todayYmd(), ...(syl && syl.text ? { syllabus: syl.text } : {}) }, "map|" + sid);
  const list = (r && Array.isArray(r.topics) ? r.topics : []).map(t => ({ title: aiTxt(t.title, 80), term: aiTxt(t.term, 20), now: t.now === true })).filter(t => t.title).slice(0, 30);
  if (!list.length) return;
  schoolFor(kid).map[sid] = { at: new Date().toISOString(), list };
  writeData();
  render();
}
async function benchmark(kid, sid) {
  const s = schoolOf(kid), f = s.subjects[sid], m = s.map[sid];
  if (!f || !m || !isParentDevice()) return;
  const r = await callAi("benchmark", { ...kidInfo(kid), subject: f.name, school_topics: topicsOf(s, sid).map(t => t.title), map: m.list.map(t => t.title) }, "bench|" + sid);
  if (!r) return;
  const list = x => aiArr(x, 40).map(t => aiTxt(t, 80)).filter(Boolean);
  schoolFor(kid).bench[sid] = { at: new Date().toISOString(), covered: list(r.covered), not_yet: list(r.not_yet), ahead: list(r.ahead), note: aiTxt(r.note, 400) };
  writeData();
  render();
}
async function mapPractice(kid, sid) {
  const f = schoolOf(kid).subjects[sid];
  if (!f || !isParentDevice()) return;
  if (!stMapPick.length) return toast("📌 Select at least one topic first.", 2500);
  const id = await newWorksheet(kid, f.name, [...stMapPick], 10, "practice", "mapmake", { part: `🌍 ${mapLabel(kid)} extra`, src: "igcse" }, true);
  if (id) { stMapPick = []; toast(`🌍 ${mapLabel(kid)} practice is ready!`, 3000); }
}
function mapCardHtml(kid, f) {
  const s = schoolOf(kid), m = s.map[f.id], b = s.bench[f.id], sys = curriculumOf(kid) || "the school's", year = gradeOf(kid) || "", label = mapLabel(kid);
  if (!m) return `<p class="hint">The official ${safe(sys)} ${safe(f.name)} topics${year ? ` for ${safe(year)}` : ""}. Kept apart from the school topics.</p>
    <div class="btnrow"><button class="pill" data-stmapload="${safe(f.id)}" data-aiwait="map|${safe(f.id)}">🌍 Get the official topics</button></div>`;
  const chip = t => { const on = stMapPick.includes(t); return `<button class="ph-chip ${on ? "on" : ""}" data-stmappick="${safe(encodeURIComponent(t))}" aria-pressed="${on}">${safe(t)}${on ? ` <b class="ph-tick" aria-hidden="true">✓</b>` : ""}</button>`; };
  const ul = list => list.length ? `<ul class="st-blist">${list.map(t => `<li>${safe(t)}</li>`).join("")}</ul>` : `<p class="hint">None.</p>`;
  return `<p class="hint">${safe(sys)}${year ? ` · ${safe(year)}` : ""} · ${m.list.length} topics</p>
    <div class="btnrow"><button class="pill" data-stbench="${safe(f.id)}" data-aiwait="bench|${safe(f.id)}">📊 Benchmark</button>
      <button class="linkbtn" data-stmapload="${safe(f.id)}" data-aiwait="map|${safe(f.id)}">🔄 Again</button></div>
    ${b ? `<p class="st-bench"><b>✅ Covered ${b.covered.length}</b> · <b>⏳ Not yet ${b.not_yet.length}</b> · <b>🚀 Ahead ${b.ahead.length}</b></p>
      ${b.note ? `<p class="hint">${safe(b.note)}</p>` : ""}
      <details><summary>✅ Covered</summary>${ul(b.covered)}</details><details><summary>⏳ Not yet</summary>${ul(b.not_yet)}</details><details><summary>🚀 Ahead</summary>${ul(b.ahead)}</details>` : ""}
    <h3 class="ph-group">🌍 Extra ${safe(label)} practice</h3>
    <p class="hint">Pick topics. The results go to the 🧠 profile as “${safe(label)} extra”, never into the school topics.</p>
    ${b && b.not_yet.length ? `<div class="btnrow"><button class="linkbtn" data-stmapnotyet="${safe(f.id)}">⏳ Pick the “Not yet” ones</button></div>` : ""}
    <div class="ph-chips">${m.list.map(t => chip(t.title)).join("")}</div>
    <div class="btnrow"><button class="primary ${stMapPick.length ? "" : "off"}" data-stmapmake="${safe(f.id)}" data-aiwait="mapmake" aria-disabled="${!stMapPick.length}">✏️ Make ${safe(label)} practice${stMapPick.length ? ` (${stMapPick.length})` : ""}</button></div>`;
}

// ---------- 📊 The parents' summary (📊 How are my kids doing?): per subject ⚪ · 🔴 · 🟢, the 🔴 topics first with ✏️ Practise ----------
function topicsSummaryHtml(kid) {
  const s = schoolOf(kid), subs = subjectList(s).filter(f => topicsOf(s, f.id).length);
  if (!subs.length) return `<p class="sc-empty">No school topics yet. They come from ⬆️ Upload in 🎒 School.</p>`;
  return subs.map(f => { const rows = topicRows(kid, s, f), n = k => rows.filter(t => t.st === k).length, red = rows.filter(t => t.st === "needs");
    return `<div class="st-sum"><p><b>${safe(f.emoji)} ${safe(f.name)}</b> <small>⚪ ${n("new")} not practised · 🔴 ${n("needs")} needs work · 🟢 ${n("mastered")} mastered</small></p>
      ${red.length ? `<ul class="learn-weak">${red.map(t => `<li><span>🔴 ${safe(t.title)} <small>${meanPct(t.info.results.slice(-3).map(x => x.pct))}%</small></span>
        <button class="pill" data-learntp="${safe(kid)}|${safe(f.id)}|${safe(encodeURIComponent(t.title))}|school" data-aiwait="ltp|${safe(kid)}|${safe(t.title)}">✏️ Practise</button></li>`).join("")}</ul>` : ""}</div>`; }).join("");
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#scr-school button");
  if (!b) return;
  const ds = b.dataset;
  if (ds.stup !== undefined) return openUpload(ds.stup);
  if ("stws" in ds) { stWs = !stWs; schoolFresh = true; return render(); }
  if ("stfiles" in ds) { stFiles = !stFiles; schoolFresh = true; return render(); }
  if (ds.stfilter) { stFilter = ds.stfilter; stOpen = null; return render(); }
  if (ds.sthist) { stOpen = stOpen === ds.sthist ? null : ds.sthist; return render(); }
  if ("stmake" in ds) return makeFromTopics();
  if (ds.sessmore) return moreQuestions(ds.sessmore);
  if (ds.sessdone) return sessionDone(ds.sessdone);
  if (ds.stmapload) return loadMap(schoolKid, ds.stmapload);
  if (ds.stbench) return benchmark(schoolKid, ds.stbench);
  if (ds.stmappick) { const t = decodeURIComponent(ds.stmappick); stMapPick = stMapPick.includes(t) ? stMapPick.filter(x => x !== t) : [...stMapPick, t].slice(0, 8); return render(); }
  if (ds.stmapnotyet) { const bn = schoolOf(schoolKid).bench[ds.stmapnotyet]; stMapPick = bn ? bn.not_yet.slice(0, 8) : []; return render(); }
  if (ds.stmapmake) return mapPractice(schoolKid, ds.stmapmake);
});
$("scr-school").addEventListener("change", e => {
  const id = e.target.dataset && e.target.dataset.sttick;
  if (!id) return;
  stPick = e.target.checked ? [...new Set([...stPick, id])] : stPick.filter(x => x !== id);
  render();
});

// ---------- 📰 School newsletter → 📌 school dates, 📰 This week (+ a week review per subject), 🔔 reminders ----------
// /newsletter gives back { week_label, events: [{ date, time, title, note }], subjects: [{ subject, topics }], reminders: [text] }
// (the newsletter's files are only read, not kept)
let nl = null;   // the open box: { kid, items: [{ name, kind, url, size }], result, err }
function openNewsletter() {
  if (!schoolKid || !exists(me)) return;
  nl = { kid: schoolKid, items: [], result: null, err: aiReady() ? "" : "🔌 " + AI_OFF + "." };
  $("nlModal").hidden = false;
  drawNewsletter();
}
function closeNewsletter() { $("nlModal").hidden = true; nl = null; }
function drawNewsletter() {
  if (!nl) return;
  const res = nl.result, kids = isParentId(me) ? kidsList() : [];
  const body = res
    // The review: week label, each school date with a tick (ticked), what's in This week, the reminders
    ? [h("p", { class: "print-hint" }, `For ${kidNameOf(nl.kid)}${res.week_label ? " · " + res.week_label : ""}. Untick what you don't want.`),
       res.events.length ? h("ul", { class: "list nl-events" }, res.events.map((e, i) => h("li", null,
         h("label", { class: "checkline" }, h("input", { type: "checkbox", checked: true, data: { nlev: i } }),
           h("span", null, h("b", null, `📌 ${shortDate(e.date)}${e.time ? " · " + clock(toMin(e.time), true) : ""}`), " " + e.title,
             e.note ? h("small", null, e.note) : null)))))
         : h("p", { class: "sc-empty" }, "No school dates in this newsletter."),
       res.subjects.length ? h("p", { class: "hint" }, "📰 This week: " + res.subjects.map(x => `${x.subject} (${x.topics.join(", ")})`).join(" · ")
         + ". A week review worksheet is made for each subject.") : null,
       res.reminders.length ? h("p", { class: "hint" }, "🔔 Reminders: " + res.reminders.join(" · ")) : null,
       h("div", { class: "err" }, nl.err),
       h("div", { class: "btnrow" }, h("button", { class: "primary", data: { nladd: "" } }, "✅ Add to the plan"), h("button", { data: { nlclose: "" } }, "Close"))]
    // Step 1: the kid (Bro2a) and the file
    : [h("p", { class: "print-hint" }, "Add the newsletter (photo, PDF, PowerPoint or Word). 🤖 finds the school dates and this week's topics."),
       kids.length ? h("div", { class: "chips" }, kids.map(x => { const c = colorsOf(x);
         return h("button", { type: "button", class: "chip" + (x.id === nl.kid ? " on" : ""), style: `--soft:${c.soft};--ink:${c.ink}`,
                              "aria-pressed": String(x.id === nl.kid), data: { nlkid: x.id } }, h("span", { class: "e" }, x.emoji), x.name); })) : null,
       h("div", { class: "sc-photo-row", style: "margin:12px 0 4px" }, h("button", { type: "button", class: "pill", data: { nlpick: "" } }, "📷 Add the newsletter"),
         h("span", { class: "ai-size" }, nl.items.length ? `${nl.items.length} ${nl.items.length === 1 ? "file" : "files"}` : "")),
       nl.items.length ? h("ul", { class: "list" }, nl.items.map((x, i) => h("li", null, h("span", { class: "uemoji" }, FILE_EMOJI[x.kind]),
         h("div", { class: "what" }, x.name, h("small", null, sizeText(x.size))),
         h("button", { type: "button", class: "x", "aria-label": "Remove " + x.name, data: { nldel: i } }, "✕")))) : null,
       h("div", { class: "err" }, nl.err),
       h("div", { class: "btnrow" }, h("button", { class: "primary", data: { nlread: "", aiwait: "newsletter" } }, "🤖 Read it"), h("button", { data: { nlclose: "" } }, "Close"))];
  $("nlBody").replaceChildren(...body.filter(Boolean));
  showAiWait();
}
async function addNewsletterFiles(files) {
  const box = nl;
  if (!box) return;
  const problems = [];
  for (const file of files) {
    const { r, problem } = await readForAi(file);
    if (problem) problems.push(problem);
    if (r) box.items.push(r);
  }
  if (nl !== box) return;
  const total = box.items.reduce((n, x) => n + bytesOf(x.url), 0);
  box.err = problems.length ? problems.join(" ") : total > AI_MAX ? tooBigText(total) : "";
  drawNewsletter();
}
// "09:30", "9:30 am", "2:15 PM" → "09:30" / "14:15" ("" when there's no time)
function hmOf(x) {
  const m = aiTxt(x, 20).match(/^(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)?/i);
  if (!m) return "";
  let hr = Number(m[1]);
  if (m[3] && /p/i.test(m[3]) && hr < 12) hr += 12;
  if (m[3] && /a/i.test(m[3]) && hr === 12) hr = 0;
  const t = `${String(hr).padStart(2, "0")}:${m[2]}`;
  return isHm(t) ? t : "";
}
function cleanNewsletter(r) {
  return { week_label: aiTxt(r.week_label, 60),
           events: aiObjs(r.events, 30).map(e => ({ date: isYmd(e.date) ? e.date : "", time: hmOf(e.time), title: aiTxt(e.title, 80), note: aiTxt(e.note, 300) }))
             .filter(e => e.date && e.title),
           subjects: aiObjs(r.subjects, 12).map(x => ({ subject: aiTxt(x.subject, 30), topics: aiArr(x.topics, 8).map(t => aiTxt(t, 60)).filter(Boolean) }))
             .filter(x => x.subject && x.topics.length),
           reminders: aiArr(r.reminders, 10).map(t => aiTxt(t, 200)).filter(Boolean) };
}
async function readNewsletter() {
  const box = nl;
  if (!box) return;
  if (!box.items.length) { box.err = "Add the newsletter first (📷 Add the newsletter)."; return drawNewsletter(); }
  const total = box.items.reduce((n, x) => n + bytesOf(x.url), 0);
  if (total > AI_MAX) { box.err = tooBigText(total); return drawNewsletter(); }
  let files;
  try { files = await aiFilesFor(box.items); }
  catch (err) { box.err = aiFileError(err); return drawNewsletter(); }
  const r = await callAi("newsletter", { files, ...kidInfo(box.kid), today: todayYmd() }, "newsletter");
  if (!r || nl !== box) return;
  box.result = cleanNewsletter(r);
  box.err = "";
  drawNewsletter();
}
// "Week 6" → 6 (otherwise the week number of the year)
function weekNumberOf(label) {
  const m = String(label).match(/week\s*(\d{1,2})/i);
  if (m) return Number(m[1]);
  const d = new Date(), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
// 📚 Topics into a subject's 📚 My topics (⚪ new), with the same "no doubles" check as everywhere (sameTopicTitle). → how many were new
function addSchoolTopics(s, sid, titles, added) {
  if (!s.curr) s.curr = {};
  const have = topicsOf(s, sid);
  let n = 0;
  titles.forEach(t => {
    const title = String(t || "").trim().slice(0, 80);
    if (!title || have.some(x => sameTopicTitle(x.title, title))) return;
    const id = topicIdOf(sid, title);
    s.curr[id] = { sub: sid, title, note: "", added, files: [], by: me };
    have.unshift({ id, ...s.curr[id] });
    n++;
  });
  return n;
}
// 📰 THE WEEKLY NEWSLETTER REMINDER (a parent's home): on Friday, Saturday and Sunday (Dubai time), for each kid whose newsletter for the
// coming week (Monday … Sunday) isn't in yet. "📰 Upload" opens the newsletter box for that kid; "Remind me later" hides it until the
// app is opened again (this device, that day). It stops once that kid's newsletter for that week is in (their 📰 This week).
let nlLater = { date: "", kids: [] };
function newsletterDue() {
  if (!isParentDevice() || !feat("newsletter")) return [];
  const d = dubaiNow().date, wd = weekdayOf(d);
  if (wd < 4) return [];
  const monday = addDaysYmd(d, 7 - wd);   // (the coming week)
  if (nlLater.date !== d) nlLater = { date: d, kids: [] };
  return kidsList().filter(k => { const w = schoolOf(k.id).week; return !(w && w.start === monday) && !nlLater.kids.includes(k.id); });
}
function newsletterNudgeHtml() {
  return newsletterDue().map(k => `<div class="card nl-nudge" style="--c:${colorsOf(k).color}"><p>📰 Upload this week's school newsletter for ${safe(k.name)} so ${safe(k.name)}'s study matches what school will cover.</p>
    <div class="btnrow"><button class="primary" data-nlnudge="${safe(k.id)}">📰 Upload the newsletter</button><button data-nllater="${safe(k.id)}">Remind me later</button></div></div>`).join("");
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-nlnudge], [data-nllater]");
  if (!b) return;
  if (b.dataset.nllater) { nlLater.kids.push(b.dataset.nllater); return render(); }
  schoolKid = b.dataset.nlnudge;
  openNewsletter();
});
// ✅ Add to the plan: the ticked 📌 school dates (no doubles), 📰 This week + 🔔 reminders, then a 📰 week review per subject
async function addNewsletter() {
  const box = nl;
  if (!box || !box.result) return;
  const kid = box.kid, s = schoolFor(kid), res = box.result, same = x => x.trim().toLowerCase();
  const picked = [...$("nlBody").querySelectorAll("input[data-nlev]:checked")].map(x => res.events[Number(x.dataset.nlev)]).filter(Boolean);
  let added = 0;
  picked.forEach(e => {
    if (Object.values(s.events).some(x => x.date === e.date && same(x.title) === same(e.title))) return;   // already there
    s.events[newId()] = { date: e.date, time: e.time, title: e.title, note: e.note, by: me };
    added++;
  });
  // This week = the week of today (on Friday / Saturday / Sunday: the coming week, that starts on Monday)
  const now = new Date();
  if ((now.getDay() + 6) % 7 >= 4) now.setDate(now.getDate() + 7);
  const start = mondayOf(now), end = new Date(fromYmd(start)), n = weekNumberOf(res.week_label);
  end.setDate(end.getDate() + 6);
  const subjects = res.subjects.map(x => ({ sid: ensureFolder(s, x.subject), topics: x.topics })).map(x => ({ ...x, subject: s.subjects[x.sid].name }));
  // 📚 Its topics go into each subject's 📚 My topics (⚪ new, no doubles), so next week's worksheets follow them
  const newTopics = subjects.reduce((sum, x) => sum + addSchoolTopics(s, x.sid, x.topics, start), 0);
  s.week = { label: res.week_label, n, start, end: ymd(end), subjects: subjects.map(({ sid, ...x }) => x), reminders: res.reminders };
  writeData();
  closeNewsletter();
  if (screen === "school") { schoolKid = kid; goSchool("home"); }
  toast(`📰 Added ${added} school ${added === 1 ? "date" : "dates"}${newTopics ? ` and ${newTopics} new ${newTopics === 1 ? "topic" : "topics"}` : ""}${subjects.length ? ". Making the week reviews…" : ""}`, 4000);
  // 📰 Week {n} review: one for each subject, one after the other (checked like any worksheet)
  let made = 0;
  for (const x of subjects) {
    if (await newWorksheet(kid, x.subject, x.topics, REVIEW_COUNT, "week_review", "review", { title: `📰 Week ${n} review`, part: `📰 Week ${n}` }, false)) made++;
  }
  if (subjects.length) toast(made === subjects.length ? `📰 ${made} week ${made === 1 ? "review is" : "reviews are"} ready in 📝 Worksheets!`
    : `📰 ${made} of ${subjects.length} week reviews were made. Try the others again later.`, 4500);
}
$("nlModal").addEventListener("click", e => {
  if (e.target === $("nlModal")) return closeNewsletter();
  const b = e.target.closest("button");
  if (!b || !nl) return;
  const ds = b.dataset;
  if ("nlclose" in ds) return closeNewsletter();
  if (ds.nlkid) { nl.kid = ds.nlkid; return drawNewsletter(); }
  if ("nlpick" in ds) { aiPick = "newsletter"; $("aiFile").value = ""; return $("aiFile").click(); }
  if (ds.nldel !== undefined) { nl.items.splice(Number(ds.nldel), 1); nl.err = ""; return drawNewsletter(); }
  if ("nlread" in ds) return readNewsletter();
  if ("nladd" in ds) return addNewsletter();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("nlModal").hidden) closeNewsletter(); });

// ---------- 📥 The School work cards (in the subject folder) ----------
function workListNode(s, subject, c) {
  const list = Object.entries(s.work).map(([id, w]) => ({ id, ...w })).filter(w => sameSubject(w.subject, subject))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return h("div", { class: "card bd-card", style: "margin-bottom:18px" }, h("h2", null, "📥 School work"),
    list.length ? list.map(w => workNode(s, w, c))
      : h("p", { class: "sc-empty" }, "Nothing yet. Tap 📥 Add school work: add the PDF or photos, and 🤖 reads them for you."));
}
function workNode(s, w, c) {
  const files = w.files.filter(id => s.files[id]);
  return h("div", { class: "ai-work" },
    h("div", { class: "ai-work-top" },
      h("div", null, h("div", { class: "ai-work-title" }, "📥 " + w.title),
        h("span", { class: "ai-work-date" }, shortDate(w.date) + (w.by && w.by !== DAD && isDadNow() ? " · by " + userById(w.by).name : ""))),
      canChange(w) ? h("button", { class: "x", "aria-label": "Delete", data: { scdel: "work|" + w.id } }, "🗑️") : null),
    w.what_to_do ? h("p", { class: "ai-todo" }, "✏️ " + w.what_to_do) : null,
    w.topics.length ? h("div", { class: "ai-chips", style: `--soft:${c.soft};--ink:${c.ink};--c:${c.color}` }, w.topics.map((t, i) => h("span", { class: "ai-chip" }, t,
      h("button", { type: "button", title: "📝 Worksheet: " + t, "aria-label": "Worksheet on " + t, data: { aiws: w.id + "|" + i } }, "📝"),
      h("button", { type: "button", title: "📖 Explain: " + t, "aria-label": "Explain " + t, data: { aiex: w.id + "|" + i, aiwait: "ex|" + w.id + "|" + i } }, "📖")))) : null,
    files.length ? h("div", { class: "ai-files" }, files.map(id => h("button", { class: "linkbtn", data: { scfile: id } }, `${FILE_EMOJI[s.files[id].kind]} ${s.files[id].name}`))) : null,
    h("div", { class: "ai-btns" },
      h("button", { class: "primary", data: { aiws: w.id } }, "📝 Worksheet"),
      h("button", { data: { aiex: w.id, aiwait: "ex|" + w.id } }, "📖 Explain")));
}
// "📝 Worksheets" / "📖 Explanations" lists
function aiListCard(title, list, empty) {
  return h("div", { class: "card bd-card" }, h("h2", null, title),
    list || h("p", { class: "sc-empty" }, cloud.user ? empty : "🔌 These show when this device is online and signed in to the family account."));
}
function wsListNode(list, showSubject) {
  if (!list.length) return null;
  return h("ul", { class: "list" }, list.map(w => h("li", null, h("button", { class: "bd-file", data: { aiopen: "worksheet|" + w.id } },
    h("span", { class: "e" }, "📝"),
    h("span", { class: "what" }, w.title, h("small", null,
      [showSubject ? w.subject : "", shortDate(w.date), `${w.questions.length} questions`].filter(Boolean).join(" · ") + " · ",
      h("span", { class: "ai-status " + (w.check ? "done" : w.answers.length ? "up" : "") }, w.status + (w.check ? ` ${num(w.check.score)}/${num(w.check.max_score)}` : "")))))))) ;
}
function exListNode(list) {
  if (!list.length) return null;
  return h("ul", { class: "list" }, list.map(x => h("li", null, h("button", { class: "bd-file", data: { aiopen: "explain|" + x.id } },
    h("span", { class: "e" }, "📖"), h("span", { class: "what" }, x.title, h("small", null, shortDate(x.date) + (x.topic && x.topic !== x.title ? " · " + x.topic : "") + (madeByParent(x) ? " · " + madeByParent(x) : "")))))));
}
// Open a saved worksheet / explanation (from the lists, or right after it was made)
function openAiDoc(view, id) {
  const d = (view === "worksheet" ? aiDocs.worksheets : aiDocs.explanations)[id];
  if (!d || (view !== "worksheet" && view !== "explain")) return;
  const parent = isParentId(me) || isParentDevice();
  if (!parent && d.kid !== me) return;   // a kid only opens their own (a parent: any kid's)
  if (parent && exists(d.kid)) schoolKid = d.kid;
  const f = folderOf(schoolOf(d.kid), d.subject);
  schoolView = view; schoolSubject = f ? f.id : null; schoolDoc = id;
  schoolEdit = schoolEditId = null; schoolFresh = true; schoolReport = false; wsAnswers = false; wsFix = false;
  const st = { screen: "school", sub: view, subj: schoolSubject, doc: id };   // (⬅️ Back comes back to it)
  if (screen !== "school") { go("school"); try { history.replaceState(st, ""); } catch (e) {} }
  else { try { history.pushState(st, ""); } catch (e) {} render(); }
  window.scrollTo(0, 0);
}
// Back from a worksheet / explanation: its subject's 📝 Worksheets (or the School home)
function leaveAiDoc() { if (schoolSubject && schoolOf(schoolKid).subjects[schoolSubject]) goSchool("subject", schoolSubject, "worksheets"); else goSchool("home"); }
const notHere = () => `<div class="card"><p class="sc-empty">${cloud.user ? "It isn't here (maybe it was deleted). It shows when this device is online." : "🔌 " + AI_OFF + "."}</p></div>`;

// ---------- ▶️ YouTube / 🖨️ printable links (they open in a new tab) ----------
function aiLinksNode(d) {
  const yt = d.youtube_searches || [], pr = d.printable_searches || [];
  if (!yt.length && !pr.length) return null;
  const link = (href, text, cls) => h("a", { class: "ai-link " + cls, href, target: "_blank", rel: "noopener noreferrer" }, text);
  return h("div", { class: "card bd-card ai-links ai-narrow" },
    yt.length ? [h("h2", null, "▶️ Watch on YouTube"), h("div", { class: "ai-linkrow" },
      yt.map(x => link("https://www.youtube.com/results?search_query=" + encodeURIComponent(x.query), "▶️ " + x.label, "yt")))] : null,
    pr.length ? [h("h2", null, "🖨️ Printable resources"), h("div", { class: "ai-linkrow" },
      pr.map(x => link("https://www.google.com/search?q=" + encodeURIComponent(x.query + " printable worksheet pdf"), "🖨️ " + x.label, "")))] : null);
}

// ---------- 🖨️ Printing an explanation / a brief: A4 portrait, only that sheet (📄 worksheets and answer keys: PDF only) ----------
// (The app's print style already hides everything but #printArea. A4 portrait is added just for this print.)
// ---------- 📄 PDF: a real A4 PDF made on the phone (jsPDF + html2canvas, loaded the first time it's needed; offline after that) ----------
// The sheet is drawn off-screen, each part (the title, each question, the total) becomes a picture, and the pictures go on A4 pages
// one after the other: a question is never cut in half. Page numbers at the bottom. Then: the share sheet (printer app, WhatsApp…)
// when the phone can share files, otherwise a download. (Worksheets: always WITHOUT the answers.)
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const scriptLoads = {};
function loadScript(url, ready) {
  if (ready()) return Promise.resolve();
  return scriptLoads[url] = scriptLoads[url] || new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = url;
    el.onload = () => ready() ? resolve() : reject(new Error("lib"));
    el.onerror = () => { el.remove(); delete scriptLoads[url]; reject(new Error("lib")); };
    document.head.appendChild(el);
  });
}
let pdfBusy = false;
const pdfName = (...parts) => parts.filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) + ".pdf";
// opts: header = a small part drawn at the top of EVERY page (e.g. 📅 the week's dates) · ask = show "📤 Share / ⬇️ Download" instead
async function makePdf(node, fileName, opts = {}) {
  if (pdfBusy) return;
  pdfBusy = true;
  toast("⏳ Making your PDF…", 20000);
  const stage = h("div", { class: "pdf-stage", "aria-hidden": "true" }, h("div", { class: "ai-print" }, node), opts.header ? h("div", { class: "ai-print" }, opts.header) : null);
  document.body.appendChild(stage);
  try {
    await Promise.all([loadScript(JSPDF_URL, () => window.jspdf && window.jspdf.jsPDF), loadScript(HTML2CANVAS_URL, () => window.html2canvas)]);
    // The parts: each question of a list on its own, everything else as it is
    const sheet = node, parts = [];
    [...sheet.children].forEach(el => { if (el.matches("ol, ul") && el.children.length) parts.push(...el.children); else parts.push(el); });
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), W = 210, H = 297, M = 12, FOOT = 10, GAP = 2.5;
    const mmPerPx = (W - 2 * M) / sheet.getBoundingClientRect().width;
    // The header on every page (drawn once, put on each page)
    let head = null;
    if (opts.header) {
      const hc = await window.html2canvas(opts.header, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true }), r = opts.header.getBoundingClientRect();
      head = { url: hc.toDataURL("image/jpeg", 0.92), w: r.width * mmPerPx, h: r.height * mmPerPx };
    }
    const top = () => { if (!head) return M; pdf.addImage(head.url, "JPEG", M, M, head.w, head.h); return M + head.h + GAP; };
    let y = top();
    for (const el of parts) {
      if (!el.getBoundingClientRect().height) continue;
      const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      let w = el.getBoundingClientRect().width * mmPerPx, hgt = el.getBoundingClientRect().height * mmPerPx;
      const room = H - M - FOOT - M - (head ? head.h + GAP : 0);
      if (hgt > room) { w *= room / hgt; hgt = room; }   // (a very tall part: made smaller to fit one page)
      if (y + hgt > H - M - FOOT && y > (head ? M + head.h + GAP : M)) { pdf.addPage(); y = top(); }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, y, w, hgt);
      y += hgt + GAP;
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(9); pdf.setTextColor(120); pdf.text(`${i} / ${n}`, W / 2, H - 7, { align: "center" }); }
    const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
    $("toast").hidden = true;
    if (opts.ask) pdfReadyBar(file); else await sharePdf(file);
  } catch (e) {
    toast("😕 Couldn't make the PDF. Please try again (the first time it needs the internet).", 5000);
  } finally {
    stage.remove();
    pdfBusy = false;
  }
}
// The share sheet when the phone can share files, otherwise a download. (Some phones only share right after a tap: then a small "📤 Share" bar.)
async function sharePdf(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, "") }); return; }
    catch (e) { if (e && e.name === "AbortError") return; if (e && e.name === "NotAllowedError") return pdfReadyBar(file); }
  }
  downloadFile(file);
}
function downloadFile(file) {
  const url = URL.createObjectURL(file), a = h("a", { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast("📄 PDF saved!", 2500);
}
function pdfReadyBar(file) {
  document.querySelectorAll(".pdf-ready").forEach(x => x.remove());
  const share = h("button", { class: "primary" }, "📤 Share"), save = h("button", null, "⬇️ Download");
  const bar = h("div", { class: "pdf-ready", role: "status" }, h("span", null, "📄 Your PDF is ready"), share, save);
  share.addEventListener("click", () => {
    bar.remove();
    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) return downloadFile(file);   // (a computer: no share sheet → the file)
    navigator.share({ files: [file], title: file.name }).catch(e => { if (!e || e.name !== "AbortError") downloadFile(file); });
  });
  save.addEventListener("click", () => { bar.remove(); downloadFile(file); });
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 30000);
}
// 📄 A worksheet (never the answers) and 📋 the parents' brief
const worksheetPdf = w => makePdf(wsSheetNode(w, false), pdfName(kidNameOf(w.kid), w.subject, w.title));
const answerKeyPdf = w => makePdf(wsKeyNode(w), pdfName(kidNameOf(w.kid), w.subject, `${w.title} answer key`));   // 🔑 (only the answers)
const briefPdf = kid => { const b = schoolOf(kid).brief; if (b) makePdf(briefNode(kid, b), pdfName(kidNameOf(kid), "Brief for parents", b.date)); };

function printAi(node) {
  $("printArea").replaceChildren(h("div", { class: "ai-print" }, node));
  if (!$("aiPageSize")) document.head.appendChild(h("style", { id: "aiPageSize" }, "@page { size: A4 portrait; margin: 12mm; }"));
  window.print();
}
window.addEventListener("beforeprint", () => { if (!$("printArea").querySelector(".ai-print") && $("aiPageSize")) $("aiPageSize").remove(); });
window.addEventListener("afterprint", () => {
  if (!$("printArea").querySelector(".ai-print")) return;
  $("printArea").replaceChildren();
  if ($("aiPageSize")) $("aiPageSize").remove();
});

// ---------- 📝 Make a worksheet (the small box: topics + how many questions) ----------
let wso = null;   // { kid, subject, topics, count, work, part }
function openWsOpts(kid, subject, topics, count, work, part) {
  if (!kid || !exists(me)) return;
  wso = { kid, subject, topics: topics.length ? topics : [subject], count: WS_COUNTS.includes(count) ? count : 10, work: work || null, part: part || "" };
  $("wsoHint").textContent = `${subject} for ${kidNameOf(kid)}. The answers stay hidden until you tap 🔑.`;
  $("wsoTopics").replaceChildren(...wso.topics.map((t, i) => h("label", { class: "checkline" },
    h("input", { type: "checkbox", value: i, checked: true }), h("span", null, t))));
  $("wsoCount").replaceChildren(...WS_COUNTS.map(n => h("label", null,
    h("input", { type: "radio", name: "wsoN", value: n, checked: n === wso.count }), h("span", null, `${n} questions`))));
  $("wsoErr").textContent = aiReady() ? "" : "🔌 " + AI_OFF + ".";
  $("wsoTr").innerHTML = translateToggleHtml(kid, subject);   // 🌐 (remembered for this kid)
  $("aiWsModal").hidden = false;
  $("wsoMake").focus();
}
function closeWsOpts() { $("aiWsModal").hidden = true; wso = null; }
// From a School work card (all its topics) or one topic chip
function wsFromWork(v) {
  const [wid, i] = v.split("|"), w = schoolOf(schoolKid).work[wid];
  if (!w) return;
  const topics = i !== undefined ? [w.topics[Number(i)]].filter(Boolean) : w.topics.length ? w.topics : [w.title];
  openWsOpts(schoolKid, w.subject, topics, 10, wid, w.title);
}
async function makeWorksheet() {
  const o = wso;
  if (!o) return;
  const topics = [...$("wsoTopics").querySelectorAll("input:checked")].map(x => o.topics[Number(x.value)]).filter(Boolean);
  if (!topics.length) return $("wsoErr").textContent = "Please tick at least one topic.";
  const count = Number((document.querySelector('input[name="wsoN"]:checked') || {}).value) || 10;
  $("wsoErr").textContent = "";
  const mode = pickMode(o.kid, o.subject);   // 🔁 practice, or 🚀 challenge when it's going very well
  const r = await callAi("worksheet", { ...kidInfo(o.kid), subject: o.subject, topics, count,
                                        notes: MODE_NOTES[mode], mode, profile: profileText(o.kid, o.subject), ...schoolSystemOf(o.kid),
                                        ...learnBody(o.kid, o.subject), ...langBody(o.kid, o.subject) }, "worksheet");   // (🧠 level, skills, focus · 🇦🇪 / 🌐)
  if (!r) return;
  const ws = cleanWorksheet({ ...r, kid: o.kid, subject: o.subject, topics, count, date: todayYmd(), by: me, at: new Date().toISOString(), purpose: mode,
                              ...(isArabicSubject(o.subject) ? { lang: "ar" } : {}),
                              answers: [], ...(o.work ? { work: o.work } : {}), ...(o.part ? { part: o.part } : {}) });
  if (!ws) return toast("🤖 The worksheet came back empty. Please try again.", 4000);
  delete ws.check;
  const id = newId();
  aiSave("worksheets", id, ws);
  if (wso === o) closeWsOpts();
  openAiDoc("worksheet", id);
  toast("📝 Your worksheet is ready!", 2500);
}
$("aiWsModal").addEventListener("click", e => {
  if (e.target === $("aiWsModal")) return closeWsOpts();
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "wsoCancel") return closeWsOpts();
  if (b.id === "wsoMake") return makeWorksheet();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("aiWorkModal").hidden) closeWork();
  if (!$("aiWsModal").hidden) closeWsOpts();
});

// ---------- 📝 The worksheet page ----------
const ptsText = n => `${num(n)} ${n === 1 ? "pt" : "pts"}`;
const wsTotal = w => w.questions.reduce((n, q) => n + q.points, 0);
// The sheet itself (on screen, and the same on paper). Answers only when showAns (never on the printed worksheet).
// 🔗 MATCHING in two columns: column 1 "1. item" (with an empty box to write a letter in), column 2 "A. match" (أ ب ج … on an Arabic
// sheet). From the worksheet's left / right; older ones: each option split on " - ", " – ", ":" or "→", column 2 shuffled (always the same
// way, so the screen, the PDF and the answer key agree). Not possible → null (shown as before). The key: each box's right letter.
const MATCH_LETTERS = { en: "ABCDEFGHI".split(""), ar: ["أ", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط"] };
function matchCols(q, ar) {
  const L = ar ? MATCH_LETTERS.ar : MATCH_LETTERS.en;
  if (q.left && q.left.length && q.right && q.right.length) {
    const key = {};
    String(q.answer || "").replace(/(\d+)\s*[-–—:→=.)]?\s*([A-Za-zء-ي])/g, (m, n, l) => { key[n] = /[a-z]/i.test(l) ? l.toUpperCase() : l; });
    return { left: q.left, right: q.right, letters: L, key };
  }
  const parts = q.options.map(o => o.split(/\s+[-–—]\s+|\s*:\s*|\s*→\s*/));
  if (parts.length < 2 || parts.length > 8 || parts.some(p => p.length !== 2 || !p[0].trim() || !p[1].trim())) return null;
  const left = parts.map(p => p[0].trim()), rights = parts.map(p => p[1].trim());
  let order = rights.map((_, i) => i).sort((a, b) => hash36(rights[a] + "|" + q.number).localeCompare(hash36(rights[b] + "|" + q.number)));
  if (order.every((x, i) => x === i)) order = [...order.slice(1), order[0]];   // (never in the same order as column 1)
  const key = {};
  left.forEach((_, i) => { key[i + 1] = L[order.indexOf(i)]; });
  return { left, right: order.map(i => rights[i]), letters: L, key };
}
function matchNode(q, ar, showAns) {
  const m = q.kind === "matching" && matchCols(q, ar);
  if (!m) return null;
  return h("table", { class: "ws-match" }, h("tbody", null, Array.from({ length: Math.max(m.left.length, m.right.length) }, (_, i) => h("tr", null,
    h("td", { class: "wm-l" }, m.left[i] != null ? [h("span", { class: "wm-box", "aria-label": "Write a letter" }, showAns ? m.key[i + 1] || "" : ""), h("b", null, `${i + 1}.`), " ", m.left[i]] : ""),
    h("td", { class: "wm-r" }, m.right[i] != null ? [h("b", null, `${m.letters[i]}.`), " ", m.right[i]] : "")))));
}
// 🇦🇪 An Arabic worksheet: right-to-left · 🌐 question_ar: small and grey under its question, right-to-left · the header: Name · Subject · Date
function wsSheetNode(w, showAns) {
  const rtl = isArabicWs(w);
  return h("div", { class: "ws-sheet" + (rtl ? " ws-rtl" : ""), dir: rtl ? "rtl" : null, lang: rtl ? "ar" : null },
    wsHeaderNode(w),
    h("div", { class: "ws-title" }, w.title),
    h("div", { class: "ws-sub" }, [w.subject, w.topics.join(", ")].filter(Boolean).join(" · ")),
    w.intro ? h("p", { class: "ws-intro" }, w.intro) : null,
    h("ol", { class: "ws-qs" }, w.questions.flatMap(q => { const match = matchNode(q, rtl, showAns);   // (🔗 matching: the 2-column table)
      return [   // (📚 each part's title above its first question)
      ...(w.sections || []).filter(x => x.from === q.number && (x.title || x.topic)).map(x => h("li", { class: "ws-sec" }, x.title || x.topic)), h("li", { class: "ws-q" },
      h("span", { class: "ws-num" }, String(q.number)),
      h("div", null,
        h("div", { class: "ws-prompt" }, q.prompt),
        q.question_ar && !rtl ? h("div", { class: "ws-ar", dir: "rtl", lang: "ar" }, q.question_ar) : null,
        match || (q.options.length ? h("ul", { class: "ws-opts" }, q.options.map(o => h("li", { class: "ws-opt" },
          h("span", { class: "ws-circle" + (q.kind === "ordering" || q.kind === "matching" ? " ws-box" : "") }), h("span", null, o)))) : null),
        match ? null : Array.from({ length: q.answer_lines }, () => h("div", { class: "ws-line" })),
        showAns && !match ? h("div", { class: "ws-ans" }, "✓ " + (q.answer || "—")) : null),
      h("span", { class: "ws-pts" }, ptsText(q.points)))]; })),
    h("div", { class: "ws-total" }, "Total points: ", h("i"), ` / ${num(wsTotal(w))}`));
}
// 🔑 May the answers be seen? A parent's device: always. A kid (a kid's device, or a kid using the app): once the worksheet has a
// check result, even if the answers file isn't in their Files any more (a parent typed the score, or the file was deleted).
// (Everywhere: 🔑 Show answers, 📄 Answer key PDF, the rows in every list.)
function answersOpen(w) {
  return isParentPhone() || !!w.check;
}
// 🔒 Not yet: the box with "📤 Upload my answers"
function answersLocked(id) {
  $("kCard").style.cssText = "--soft:#fef3c7;--ink:#6b4f05";
  $("kCard").innerHTML = `
    <div class="k-card-top"><div class="big">🔒</div><div class="nm">Answers are locked</div></div>
    <p class="hint" style="text-align:center;margin:8px 18px 0;font-size:17px">🔒 You can't see the answers before your work is checked. Upload your answers first! 📤</p>
    <div class="btnrow" style="justify-content:center;margin:12px 16px 0"><button class="primary" data-wslockup="${safe(id)}">📤 Upload my answers</button></div>
    <button class="k-ok" id="kOk">OK 👍</button>`;
  $("kModal").hidden = false;
  $("kOk").focus();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-wslockup]");
  if (!b) return;
  closeCard();
  wsRowAction("upload|" + b.dataset.wslockup);
});
// 🔑 The answer key: only the answers, on its own page
// (🇦🇪 an Arabic worksheet: right-to-left · the header: Name · Subject · Date)
function wsKeyNode(w) {
  const rtl = isArabicWs(w);
  return h("div", { class: "ws-sheet" + (rtl ? " ws-rtl" : ""), dir: rtl ? "rtl" : null, lang: rtl ? "ar" : null },
    wsHeaderNode(w, "🔑 Answer key"),
    h("div", { class: "ws-title" }, w.title),
    h("ol", { class: "ws-qs" }, w.questions.map(q => h("li", { class: "ws-q" },
      h("span", { class: "ws-num" }, String(q.number)), matchNode(q, rtl, true) || h("div", { class: "ws-ans" }, q.answer || "—"), h("span", { class: "ws-pts" }, ptsText(q.points))))),   // (🔗 matching: each box's letter)
    h("div", { class: "ws-total" }, `Total: ${num(wsTotal(w))} points`));
}
function schoolWorksheetHtml(s, isDad) {
  const w = aiDocs.worksheets[schoolDoc];
  return w && w.kid === schoolKid ? aiMount(() => wsViewNode(w, schoolDoc, s, isDad)) : notHere();
}
function wsViewNode(w, id, s, isDad) {
  const done = !!w.check, canAct = isDad || !done, files = w.answers.filter(f => s.files[f]), open = answersOpen(w), show = wsAnswers && open;
  return h("div", null,
    h("div", { class: "ai-toolbar" },
      // (🔒 a kid before the check: the button is there, a tap says why)
      h("button", { class: show ? "primary" : null, "aria-pressed": String(show), data: { wsact: "answers" } }, show ? "🔑 Hide answers" : open ? "🔑 Show answers" : "🔒 Show answers"),
      // (📄 worksheets are PDF only, no printing from the app)
      h("button", { data: { wsact: "pdf" } }, "📄 Download PDF"),
      h("button", { data: { wsact: "key" } }, open ? "📄 Answer key PDF" : "🔒 Answer key PDF"),
      h("button", { data: { wsact: "again" } }, "🔁 Make another"),
      isDad ? h("button", { class: "danger-text", data: { wsact: "delete" } }, "🗑️ Delete") : null),
    wsSheetNode(w, show),
    // ✅ Upload the answers → 🤖 Check
    h("div", { class: "card bd-card ai-narrow" },
      h("div", { class: "sc-head" }, h("h2", null, done ? "✅ Checked" : "✅ Finished? Check it!"), h("span", { class: "ai-status " + (done ? "done" : files.length ? "up" : "") }, w.status)),
      done ? resultNode(w) : h("p", { class: "hint" }, files.length
        ? "The answers are uploaded. Tap ✅ Check now!"
        : "Do the worksheet on paper, then upload a photo (or PDF) of your answers."),
      // 📸 Before the check: each answer photo as a thumbnail with 🗑 (remove a wrong or blurry one, then take it again).
      // After the check they're locked: just the list.
      files.length && !done ? h("div", { class: "ans-thumbs" }, files.map(fid => { const f = s.files[fid];
        return h("div", { class: "ans-thumb" },
          h("button", { class: "ans-open", data: { scfile: fid }, "aria-label": "Open " + f.name },
            f.kind === "image" ? h("img", { alt: f.name, data: { ansimg: fid } }) : h("span", { class: "e" }, FILE_EMOJI[f.kind]), h("small", null, f.name)),
          canRemoveAnswer(w, f) ? h("button", { class: "ans-del", "aria-label": "Remove " + f.name, title: "Remove this photo", data: { wsfdel: fid } }, "🗑") : null); }))
      : files.length ? h("ul", { class: "list" }, files.map(fid => h("li", null,
        h("button", { class: "bd-file", data: { scfile: fid } }, h("span", { class: "e" }, FILE_EMOJI[s.files[fid].kind]),
          h("span", { class: "what" }, s.files[fid].name, h("small", null, `${shortDate(s.files[fid].date)} · ${sizeText(s.files[fid].size)}`)))))) : null,
      h("div", { class: "ai-btns", style: "margin-top:12px" },
        canAct ? h("button", { data: { wsact: "upload" } }, "⬆ Upload my answers") : null,
        canAct && files.length ? h("button", { class: "primary", data: { wsact: "check", aiwait: "check|" + id } }, done ? "🤖 Check again" : "✅ Check now") : null,
        isDad ? h("button", { data: { wsact: "fix" } }, done ? "✏️ Change score" : "✏️ Add score") : null),
      isDad && wsFix ? fixFormNode(w) : null),
    sessionBarNode(w, id),
    aiLinksNode(w));
}
// 📚 A study session's worksheet while the session lasts: 🙋 I'm done, then ➕ More questions (the minutes left, nothing repeated)
function sessionBarNode(w, id) {
  const x = w.session && sessionByKey(w.session);
  if (!x || x.ended || x.date !== todayYmd()) return null;
  return h("div", { class: "card bd-card ai-narrow sess-bar" },
    h("p", { class: "hint" }, `📚 ${x.subject} session · until ${clock(x.end, true)}`),
    h("div", { class: "btnrow" }, w.answers.length || w.check || w.done
      ? h("button", { class: "primary", data: { sessmore: w.session, aiwait: "more|" + w.session } }, "➕ More questions")
      : h("button", { data: { sessdone: id } }, "🙋 I'm done")));
}
// ❌ MISTAKES ONE BY ONE (after the check): the score card first, then each wrong answer in its own card — the question,
// "Your answer", "Correct answer", a short explanation — with "Next mistake ➡️ (2 of 5)" and "Done". Right answers aren't repeated.
// 👨‍👩‍👧 Parents also have "See all answers" (every question with ✓ / ✗).
let wsMist = { id: null, i: 0, done: false }, wsAllAns = false;
function mistakesNode(w, c) {
  const wrong = c.questions.filter(q => !q.correct);
  if (wsMist.id !== schoolDoc) { wsMist = { id: schoolDoc, i: 0, done: false }; wsAllAns = false; }
  if (!wrong.length) return h("p", { class: "ai-note mist-none" }, "🌟 No mistakes! Every answer is right.");
  if (wsMist.done) return h("div", { class: "btnrow" }, h("button", { data: { wsact: "mistagain" } }, `❌ See my mistakes again (${wrong.length})`));
  const i = Math.min(wsMist.i, wrong.length - 1), q = wrong[i], wq = w.questions.find(x => x.number === q.number) || {}, rtl = isArabicWs(w);
  return h("div", { class: "card mist-card" + (rtl ? " ws-rtl" : ""), dir: rtl ? "rtl" : null },
    h("div", { class: "mist-head", dir: "ltr" }, h("b", null, `❌ Mistake ${i + 1} of ${wrong.length}`), h("small", null, `Question ${q.number}`)),
    h("p", { class: "mist-q" }, wq.prompt || `Question ${q.number}`),
    wq.question_ar && !rtl ? h("p", { class: "ws-ar", dir: "rtl", lang: "ar" }, wq.question_ar) : null,
    h("div", { class: "mist-row bad" }, h("span", null, "Your answer"), h("b", null, q.your_answer || "—")),
    h("div", { class: "mist-row ok" }, h("span", null, "Correct answer"), h("b", null, wq.answer || "—")),
    q.explanation || q.note ? h("p", { class: "mist-why" }, "💡 " + (q.explanation || q.note)) : null,
    h("div", { class: "btnrow", dir: "ltr" },
      i < wrong.length - 1 ? h("button", { class: "primary", data: { wsact: "mistnext" } }, `Next mistake ➡️ (${i + 2} of ${wrong.length})`) : null,
      h("button", { data: { wsact: "mistdone" } }, "Done")));
}
// The score big, the notes, then the mistakes one by one (parents: "See all answers" for ✓ / ✗ on every question)
function resultNode(w) {
  const c = w.check, most = Object.fromEntries(w.questions.map(q => [q.number, q.points])), pct = Math.round(c.score / c.max_score * 100), parent = isParentDevice();
  return h("div", null,
    h("div", { class: "ai-score" }, `${num(c.score)} / ${num(c.max_score)}`, h("small", null, `${pct}% ${pct >= 80 ? "🌟" : pct >= 50 ? "👍" : "💪"}`)),
    c.overall_note ? h("p", { class: "ai-note" }, "🤖 " + c.overall_note) : null,
    c.dadNote ? h("p", { class: "ai-note dad" }, `${userById(DAD).emoji} ${dadName()}: ${c.dadNote}`) : null,
    c.strong_points && c.strong_points.length ? h("p", { class: "ai-note" }, "💪 Strong: " + c.strong_points.join(" · ")) : null,
    c.weak_points && c.weak_points.length ? h("p", { class: "ai-note" }, "🎯 Practise: " + c.weak_points.join(" · ")) : null,
    c.coach_tip ? h("p", { class: "ai-note" }, "🦉 " + c.coach_tip) : null,
    c.questions.length ? mistakesNode(w, c) : null,
    parent && c.questions.length ? h("div", { class: "btnrow" }, h("button", { data: { wsact: "allans" }, "aria-expanded": String(wsAllAns) }, wsAllAns ? "Hide all answers" : "📋 See all answers")) : null,
    parent && wsAllAns && c.questions.length ? h("ul", { class: "list" }, c.questions.map(q => h("li", null,
      h("span", { class: "ai-mk " + (q.correct ? "ok" : "no"), "aria-label": q.correct ? "Right" : "Not right yet" }, q.correct ? "✓" : "✗"),
      h("div", { class: "what" }, `Question ${q.number}`,
        h("small", null, `${num(q.points)}${most[q.number] != null ? "/" + num(most[q.number]) : ""} pts${q.your_answer ? ` · wrote: ${q.your_answer}` : ""}${q.note ? " · " + q.note : ""}`))))) : null);
}
// ✏️ Bro2a changes the score / adds his own note
function fixFormNode(w) {
  const c = w.check;
  return h("div", { class: "sc-form" },
    h("div", { class: "row" },
      h("div", null, h("label", { class: "small", for: "wsfScore" }, "Score"), h("input", { type: "number", id: "wsfScore", min: 0, step: "any", value: c ? c.score : "" })),
      h("div", null, h("label", { class: "small", for: "wsfMax" }, "Out of"), h("input", { type: "number", id: "wsfMax", min: 1, step: "any", value: c ? c.max_score : wsTotal(w) || 10 }))),
    h("div", { class: "row" }, h("div", null, h("label", { class: "small", for: "wsfNote" }, `${dadName()}'s note`),
      h("input", { type: "text", id: "wsfNote", maxlength: 400, value: (c && c.dadNote) || "", placeholder: "Great work! Practise question 4 again." }))),
    h("div", { class: "btnrow" }, h("button", { class: "primary", data: { wsact: "fixsave" } }, "💾 Save"), h("button", { data: { wsact: "fixcancel" } }, "Cancel")),
    h("div", { class: "err", id: "wsfErr" }));
}
function wsAction(act) {
  const id = schoolDoc, w = aiDocs.worksheets[id];
  if (!w) return;
  if ((act === "answers" || act === "key") && !answersOpen(w)) { wsAnswers = false; return answersLocked(id); }   // 🔒 a kid before the check
  // ❌ the mistakes one by one · 📋 all answers (parents)
  if (act === "mistnext") { wsMist.i++; schoolFresh = true; return render(); }
  if (act === "mistdone") { wsMist.done = true; schoolFresh = true; return render(); }
  if (act === "mistagain") { wsMist = { id: id, i: 0, done: false }; schoolFresh = true; return render(); }
  if (act === "allans" && isParentDevice()) { wsAllAns = !wsAllAns; schoolFresh = true; return render(); }
  if (act === "answers") { wsAnswers = !wsAnswers; return render(); }
  if (act === "pdf") return worksheetPdf(w);                     // (never with the answers, even when 🔑 is open)
  if (act === "key") return answerKeyPdf(w);                     // (🔒 a kid: only after the check, see above)
  if (act === "again") return openWsOpts(w.kid, w.subject, w.topics, w.count, w.work, w.part);
  if (act === "upload") {
    if (w.check && !isDadNow()) return toast(`It's checked already. Ask ${dadName()} 🙂`);
    aiPick = { ws: id };
    $("aiFile").value = "";
    return $("aiFile").click();
  }
  if (act === "check") return checkWorksheet(id);
  if (act === "fix" && isDadNow()) { wsFix = !wsFix; schoolFresh = true; render(); if ($("wsfScore")) $("wsfScore").focus(); return; }
  if (act === "fixcancel") { wsFix = false; schoolFresh = true; return render(); }
  if (act === "fixsave") return saveWsFix(id);
  if (act === "delete") return deleteWorksheet(id);
}
// ⬆ Upload my answers: photos (1600px JPEG) or a PDF, kept in the School files, linked to the worksheet
async function addAnswerFiles(wsId, files) {
  const w = aiDocs.worksheets[wsId];
  if (!w || (w.check && !isDadNow())) return;
  const s = schoolFor(w.kid), ids = [];
  toast("⬆ Getting your answers ready…", 2500);
  for (const file of files) {
    let r;
    try { r = await readSchoolFile(file, 1600); }
    catch (err) {
      toast(err.message === "big" ? "That file is too big (a PDF can be 700 KB at most). Try photos instead."
        : err.message === "type" ? TYPE_TEXT : "Couldn't read that file. Please try another one.", 5000);
      continue;
    }
    const id = newId(), n = (w.answers.length + ids.length + 1);
    s.files[id] = { subject: w.subject, name: (`Answers – ${w.title}` + (n > 1 ? ` (${n})` : "")).slice(0, 60), kind: r.kind, size: r.size,
                    date: todayYmd(), by: me, worksheet: wsId };
    storeFileData(id, w.kid, r.url);
    ids.push(id);
  }
  if (!ids.length) return;
  writeData();
  const now = aiDocs.worksheets[wsId] || w;
  aiSave("worksheets", wsId, { ...now, answers: [...now.answers, ...ids].slice(0, 20), status: now.check ? "Checked ✓" : "Answers uploaded" });
  // ⭐ Free study (outside a planned session): +2 +15 instead of 📤 +5 (once a worksheet; the first 3 a day for each subject)
  if (isFreeStudy(now)) {
    const free = giveFreeUp(now, wsId);
    if (free) writeData();
    render();
    if (free > 0) { pointPop(free, colorsOf(userById(w.kid)).color); return toast(`⭐ +${free} for your answers! Now tap ✅ Check now.`, 3500, colorsOf(userById(w.kid)).color); }
    if (free < 0) return toast(freeCapText(now.subject), 6000);
    return toast("📎 The answers are uploaded! Now tap ✅ Check now.", 3500);
  }
  const got = giveStudy(w.kid, "up", wsId);   // 📤 +5 ⭐ (once a worksheet)
  render();
  toast(`📎 The answers are uploaded!${got ? ` +${STUDY_POINTS.up} ⭐` : ""} Now tap ✅ Check now.`, 3500);
}
// 📸 The thumbnails: each answer photo, from this device or the cloud (after the page is drawn)
function fillAnswerThumbs(root) {
  root.querySelectorAll("img[data-ansimg]").forEach(img => fileUrl(img.dataset.ansimg).then(url => { if (url) img.src = url; }).catch(() => {}));
}
// 🗑 An answer photo may go before the check: the kid (their own worksheet, also on their own device) or a parent. After the check: locked.
const canRemoveAnswer = (w, f) => !w.check && canChange(f) && (!isKidDevice() || w.kid === kidDeviceId());
function removeAnswerFile(fid) {
  const w = aiDocs.worksheets[schoolDoc], s = schoolFor(schoolKid), f = s.files[fid];
  if (!w || !f || !canRemoveAnswer(w, f)) return;
  if (!confirm(`Remove “${f.name}”? Then you can take it again.`)) return;
  deleteFileData(fid);
  delete s.files[fid];
  writeData();
  const answers = w.answers.filter(x => x !== fid);
  aiSave("worksheets", schoolDoc, { ...w, answers, status: w.check ? "Checked ✓" : answers.length ? "Answers uploaded" : "To do" });
  render();
}
// 🤖 Check: the answer photos + the answer key → the score. Saved on the worksheet AND as a "Worksheet" mark (+10 ⭐ the first time).
async function checkWorksheet(wsId) {
  const w = aiDocs.worksheets[wsId];
  if (!w) return;
  if (w.check && !isDadNow()) return toast(`It's checked already. Ask ${dadName()} 🙂`);
  const s = schoolOf(w.kid), ids = w.answers.filter(f => s.files[f]);
  if (!ids.length) return toast("⬆ Upload your answers first.", 3000);
  if (!aiReady()) return toast("🔌 " + AI_OFF, 4500);
  let urls = [];
  try { urls = await Promise.all(ids.map(fileUrl)); } catch (e) {}
  if (urls.length !== ids.length || urls.some(u => !u)) return toast("📎 The answer files aren't on this device yet. Please try again in a moment.", 4500);
  const total = urls.reduce((n, u) => n + bytesOf(u), 0);
  if (total > AI_MAX) return toast(tooBigText(total), 6000);
  let files;
  try { files = await aiFilesFor(ids.map((f, i) => ({ name: s.files[f].name, url: urls[i] }))); }
  catch (err) { return toast(aiFileError(err), 6000); }
  const lv = learnRead(w.kid, w.subject);   // (🧠 each question's skill and difficulty, and the level before this worksheet)
  const r = await callAi("check", { ...kidInfo(w.kid), title: w.title, ...(lv ? { level: lv.level } : {}),
    answerKey: w.questions.map(q => ({ number: q.number, answer: q.answer, points: q.points,
                                       ...(q.skill ? { skill: q.skill } : {}), ...(q.difficulty ? { difficulty: q.difficulty } : {}) })), files }, "check|" + wsId);
  if (!r) return;
  const c = cleanCheck({ ...r, at: todayYmd() }, wsTotal(w));
  if (!c) return toast("🤖 The check came back empty. Please try again.", 4000);
  c.aiScore = c.score;
  const now = aiDocs.worksheets[wsId] || w;
  aiSave("worksheets", wsId, { ...now, check: c, status: "Checked ✓" });   // (with its subject and part, and 💪 🎯 🦉)
  if (now.session) {   // 📚 the study session's result: all its worksheets together (weighted by their points), 🔁 a swapped subject too
    const all = sessionWsIds(now.session).map(id => id === wsId ? { ...now, check: c } : aiDocs.worksheets[id]).filter(x => x && x.check);
    const got = all.reduce((n, x) => n + x.check.score, 0), most = all.reduce((n, x) => n + x.check.max_score, 0), swap = all.map(x => x.swap).find(Boolean);
    saveSession(now.session, most ? got / most * 100 : c.score / c.max_score * 100, { ws: wsId, ...(swap ? { swap } : {}) });
  }
  learnAfterCheck(now, c, wsId);   // 🧠 skills, level and history (saved with the mark just below)
  const first = saveWsMark(now.kid, wsId, now, c);
  // (👨‍👩‍👧 no school points for a parent who checks it: the kid earns them)
  notifyCheck(now, c);
  if (now.purpose === "placement") afterPlacement(now.kid, wsId, c, first);   // 🧪 → the level (and 📋 the brief when all are checked)
  if (now.purpose === "level_check") afterLevelCheck(now.kid, now, c);       // 🧭 the subject's first level check → its level (saved once)
  render();
  const color = colorsOf(userById(now.kid)).color;
  if (first) {
    celebrate(innerWidth / 2, innerHeight / 3, color, true);
    if (!isParentPhone()) pointPop(POINTS_EACH, color);   // ✏️ +10 ⭐ (👨‍👩‍👧 a parent's device only watches)
    toast(`🎉 ${num(c.score)}/${num(c.max_score)}! Worksheet done +${POINTS_EACH} ⭐`, 3500, color);
  } else toast(`✅ Checked again: ${num(c.score)}/${num(c.max_score)}`, 3000);
}
// 🔔 "🦉 Mody · Math: 5/6" + the coach's tip, in the family's What's new (it pops up on the parents' devices)
function notifyCheck(w, c) {
  const text = `🦉 ${kidNameOf(w.kid)} · ${w.subject}: ${num(c.score)}/${num(c.max_score)}${c.coach_tip ? " — " + c.coach_tip : ""}`;
  addNews([newsItem("school", text.slice(0, 700), "", w.kid)]);
}
// The worksheet's mark in its subject (type "Worksheet"). true = the first time (that's when the +10 ⭐ come)
function saveWsMark(kid, wsId, w, c) {
  if (newWeek()) keepNow();
  const s = schoolFor(kid), key = "w" + wsId, old = s.grades[key];
  s.grades[key] = { subject: w.subject, date: old ? old.date : todayYmd(), type: "worksheet", score: c.score, max: c.max_score, worksheet: wsId };
  keepWsScore(s, wsId, w, c);   // 📝 (the score stays in 📝 All my worksheets, even if the worksheet's document goes)
  const free = giveFreeBonus(w, wsId, c);   // ⭐ free study: +10 / +5 after its first check
  writeData();
  if (free && free.bonus) setTimeout(() => toast(`⭐ +${free.bonus} bonus for ${free.pct}%!`, 3200, colorsOf(userById(kid)).color), 2600);   // (after the check's own message)
  return !old;
}
function saveWsFix(wsId) {
  const w = aiDocs.worksheets[wsId];
  if (!w || !isDadNow()) return;
  const score = Number($("wsfScore").value), max = Number($("wsfMax").value), note = $("wsfNote").value.trim().slice(0, 400);
  if ($("wsfScore").value.trim() === "" || !Number.isFinite(score) || score < 0) return $("wsfErr").textContent = "Please type the score.";
  if (!(max > 0)) return $("wsfErr").textContent = "“Out of” must be more than 0.";
  if (score > max) return $("wsfErr").textContent = "The score can't be more than “Out of”.";
  const c = { ...(w.check || { overall_note: "", questions: [], at: todayYmd() }), score, max_score: max };
  if (note) c.dadNote = note; else delete c.dadNote;
  aiSave("worksheets", wsId, { ...w, check: c, status: "Checked ✓" });
  learnAfterCheck(w, c, wsId);   // 🧠 (a mark fixed by hand: its % in the history)
  const first = saveWsMark(w.kid, wsId, w, c);
  if (w.purpose === "placement") afterPlacement(w.kid, wsId, c, first);
  if (w.purpose === "level_check") afterLevelCheck(w.kid, w, c);
  wsFix = false; schoolFresh = true;
  render();
  toast("✓ Saved, and the mark too");
}
function deleteWorksheet(id) {
  const w = aiDocs.worksheets[id];
  if (!w) return;
  if (!isDadNow()) return toast(`Ask ${dadName()} 🙂`);
  if (!confirm(`Delete this worksheet?\n\n“${w.title}”\n\nIts answer files and its mark are kept.`)) return;
  const s = schoolFor(w.kid);
  Object.values(s.files).forEach(f => { if (f.worksheet === id) delete f.worksheet; });
  writeData();
  aiDelete("worksheets", id);
  leaveAiDoc();
}

// ---------- 📖 Explain ----------
function exFromWork(v) {
  const [wid, i] = v.split("|"), w = schoolOf(schoolKid).work[wid];
  if (!w) return;
  const topic = i !== undefined ? w.topics[Number(i)] : (w.title + (w.topics.length ? ` (${w.topics.join(", ")})` : "")).slice(0, 200);
  if (topic) explainTopic(schoolKid, w.subject, topic, "ex|" + v, wid);
}
async function explainTopic(kid, subject, topic, key, work) {
  const r = await callAi("explain", { ...kidInfo(kid), subject, topic, profile: profileText(kid, subject), ...schoolSystemOf(kid) }, key);
  if (!r) return;
  const x = cleanExplain({ ...r, kid, subject, topic, date: todayYmd(), by: me, at: new Date().toISOString(), ...(work ? { work } : {}) });
  if (!x) return toast("🤖 The explanation came back empty. Please try again.", 4000);
  const id = newId();
  aiSave("explanations", id, x);
  openAiDoc("explain", id);
}
function schoolExplainHtml(s, isDad) {
  const x = aiDocs.explanations[schoolDoc];
  return x && x.kid === schoolKid ? aiMount(() => h("div", null,
    h("div", { class: "ai-toolbar" },
      h("button", { class: "primary", data: { exact: "print" } }, "🖨️ Print"),
      h("button", { data: { exact: "ws" } }, "📝 Worksheet on this"),
      isDad ? h("button", { class: "danger-text", data: { exact: "delete" } }, "🗑️ Delete") : null),
    exSheetNode(x), gotItNode(x), aiLinksNode(x))) : notHere();
}
// 👍 "I got it" at the end of an explanation: +5 ⭐ for the kid, once a topic a day (on their own device)
function gotItNode(x) {
  if (!canEarnStudy(x.kid)) return null;
  const done = studyEarned(x.kid, "ex", topicRef(x.topic || x.title));
  return h("div", { class: "btnrow ex-gotit" }, done ? h("p", { class: "hint" }, `👍 Got it! +${STUDY_POINTS.ex} ⭐ for this topic today.`)
    : h("button", { class: "primary", data: { exact: "gotit" } }, `I got it 👍 (+${STUDY_POINTS.ex} ⭐)`));
}
// The reading page (on screen, and the same on paper)
function exSheetNode(x) {
  return h("div", { class: "ex-sheet" },
    h("div", { class: "ws-sub" }, `${x.subject} · ${kidNameOf(x.kid)} · ${longDate(x.date)}`),
    h("h1", { class: "ex-title" }, "📖 " + x.title),
    x.sections.map(sec => h("section", { class: "ex-sec" }, sec.heading ? h("h3", null, sec.heading) : null, sec.text ? h("p", null, sec.text) : null)),
    x.key_words.length ? h("section", { class: "ex-sec" }, h("h3", null, "🔑 Key words"),
      h("div", { class: "ex-words" }, x.key_words.map(k => h("div", { class: "ex-word" }, h("b", null, k.word), k.meaning ? h("span", null, k.meaning) : null)))) : null,
    x.try_this.length ? h("section", { class: "ex-sec" }, h("h3", null, "🧪 Try this"), h("ul", { class: "ex-try" }, x.try_this.map(t => h("li", null, t)))) : null);
}
function exAction(act) {
  const id = schoolDoc, x = aiDocs.explanations[id];
  if (!x) return;
  if (act === "print") return printAi(exSheetNode(x));
  if (act === "gotit") {
    const got = giveStudy(x.kid, "ex", topicRef(x.topic || x.title));
    render();
    return toast(got ? `👍 Great! +${STUDY_POINTS.ex} ⭐` : "👍 Great! (Points for this topic come once a day.)", 2600, colorsOf(userById(x.kid)).color);
  }
  if (act === "ws") return openWsOpts(x.kid, x.subject, [x.topic || x.title], 10, x.work);
  if (act === "delete") {
    if (!isDadNow()) return toast(`Ask ${dadName()} 🙂`);
    if (!confirm(`Delete this explanation?\n\n“${x.title}”`)) return;
    aiDelete("explanations", id);
    leaveAiDoc();
  }
}
