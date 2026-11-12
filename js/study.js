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
// "Fractions › Adding" → the big topic "Fractions" and the small "Adding" (also "Fractions > Adding")
const topicUnitOf = title => { const m = String(title || "").match(/^(.{2,40}?)\s*[›>]\s*(.+)$/); return m ? m[1].trim() : ""; };
const topicShort = title => { const m = String(title || "").match(/^(.{2,40}?)\s*[›>]\s*(.+)$/); return m ? m[2].trim() : String(title || ""); };
const lowerT = t => String(t || "").trim().toLowerCase();
const meanPct = list => list.length ? Math.round(list.reduce((n, x) => n + x, 0) / list.length) : null;   // (the average of some %)
const dayMon = d => { const x = fromYmd(String(d).slice(0, 10)); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };
let stSub = null, stPick = [], stFilter = "all", stOpen = null, stWs = false, stFiles = false, stMapPick = [], stCmp = false, stCmpPick = [];   // (the subject page · 📊 v192 Compare view + its ticked topics)
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
// 📌 v161 LEFT BEHIND: the class moved on to another unit, but these school topics never got a worksheet.
// The unit = "Big topic ›" in its name, or the official topic it matches. The class's unit now = the unit of the newest topic.
// (a topic with no unit: left behind when it's 14+ days older than the newest topic)
function leftBehind(kid, s, f, all) {
  const m = s.map[f.id], unitOf = t => topicUnitOf(t.title) || (m && m.list.length ? ((curMatchOf(kid, f.id, t.title) || {}).title || "") : "");
  const newest = [...all].sort((a, b) => (b.added || "").localeCompare(a.added || ""))[0];
  if (!newest) return { unit: "", list: [] };
  const nowUnit = unitOf(newest), nowDate = newest.added || todayYmd();
  const old = t => { if (!t.added) return false; const d = (fromYmd(nowDate) - fromYmd(t.added)) / 864e5; return d >= 14; };
  const list = all.filter(t => !t.info.list.length && t.id !== newest.id && (nowUnit && unitOf(t) ? lowerT(unitOf(t)) !== lowerT(nowUnit) : old(t)));
  return { unit: nowUnit, list };
}
function leftBehindHtml(kid, s, f, all) {
  const lb = leftBehind(kid, s, f, all);
  if (!lb.list.length) return "";
  const ids = lb.list.slice(0, 4).map(t => t.id).join(",");
  return `<div class="card st-left"><h3>📌 Left behind <span class="wsg-n">${lb.list.length}</span></h3>
    <p class="hint">${lb.unit ? `The class is on <b>${safe(lb.unit)}</b> now, but` : "These are older, and"} these topics never had a worksheet:</p>
    <ul>${lb.list.map(t => `<li>${statusDot(t.st)} <b>${safe(t.title)}</b>${t.added ? ` <small>added ${dayMon(t.added)}</small>` : ""}</li>`).join("")}</ul>
    <div class="btnrow"><button class="primary" data-stleft="${safe(ids)}" data-aiwait="stmake">✏️ Practise ${lb.list.length > 4 ? "4 of them" : lb.list.length === 1 ? "it" : "them"}</button></div></div>`;
}
function topicsCardHtml(s, f, parent) {
  const all = topicRows(schoolKid, s, f);
  stPick = stPick.filter(id => all.some(t => t.id === id));
  const shown = parent && stFilter !== "all" ? all.filter(t => t.st === stFilter) : all;
  const count = k => all.filter(t => t.st === k).length;
  const rowHtml = t => {
    const on = stPick.includes(t.id), n = t.info.list.length, last = t.info.results[t.info.results.length - 1];
    const meta = [t.added ? `Added ${dayMon(t.added)}` : "", t.src === "ws" ? WS_TOPIC_TAG : "", n ? `${n} ${n === 1 ? "worksheet" : "worksheets"}` : "", last ? `last ${last.pct}%` : ""].filter(Boolean).join(" · ");
    return `<li class="st-topic ${on ? "on" : ""}"><label class="st-tick"><input type="checkbox" data-sttick="${safe(t.id)}" ${on ? "checked" : ""} aria-label="Pick ${safe(t.title)}"></label>
      ${statusDot(t.st)}${parent ? `<button class="st-name" data-sthist="${safe(t.id)}" aria-expanded="${stOpen === t.id}"><b>${safe(topicShort(t.title))}</b>${meta ? `<small>${safe(meta)}</small>` : ""}</button>`
        : `<span class="st-name"><b>${safe(topicShort(t.title))}</b>${t.src === "ws" ? `<small>${WS_TOPIC_TAG}</small>` : ""}</span>`}
      ${parent && stOpen === t.id ? topicHistoryHtml(t) : ""}</li>`;
  }, rows = shown.map(rowHtml).join("");
  // 🌍 v154: with the official list, the topics go under its BIG unit titles (each unit folds open); the rest under "Other topics"
  const m = s.map[f.id], units = [];
  let unitsHtml = "";
  // 📚 v157 no official list: the topics named "Big topic › small topic" go under their big topic (each folds open)
  if (!(m && m.list.length) && shown.some(t => topicUnitOf(t.title))) {
    const groups = [];
    shown.forEach(t => { const u = topicUnitOf(t.title) || ""; let g = groups.find(x => lowerT(x.unit) === lowerT(u)); if (!g) groups.push(g = { unit: u, list: [] }); g.list.push(t); });
    groups.sort((a, b) => (!a.unit) - (!b.unit) || a.unit.localeCompare(b.unit));
    unitsHtml = groups.map(g => { const res = g.list.filter(t => t.info.results.length), avg = res.length ? meanPct(res.map(t => meanPct(t.info.results.slice(-3).map(x => x.pct)))) : null;
      const st = res.length ? (g.list.some(t => t.st === "needs") ? "needs" : g.list.every(t => t.st === "mastered") ? "mastered" : "practising") : "new";
      return `<details class="st-unit ${g.unit ? "" : "other"}" ${g.list.some(t => stPick.includes(t.id) || stOpen === t.id) || groups.length === 1 ? "open" : ""}><summary>${statusDot(st)}
        <span class="st-unit-t"><b>${safe(g.unit || "Other topics")}</b><small>${g.list.length} ${g.list.length === 1 ? "topic" : "topics"}${avg != null ? ` · ${avg}%` : ""}</small></span></summary>
        <ul class="st-list">${g.list.map(rowHtml).join("")}</ul></details>`; }).join("");
  }
  if (m && m.list.length && shown.length) {
    shown.forEach(t => { const u = curMatchOf(schoolKid, f.id, t.title) || null;
      let g = units.find(x => x.unit === u); if (!g) units.push(g = { unit: u, list: [] }); g.list.push(t); });
    const at = g => g.unit ? m.list.indexOf(g.unit) : 999;   // (in the curriculum's order; "Other topics" last)
    units.sort((a, b) => at(a) - at(b));
    unitsHtml = units.map(g => { const res = g.list.filter(t => t.info.results.length), avg = res.length ? meanPct(res.map(t => meanPct(t.info.results.slice(-3).map(x => x.pct)))) : null;
      const st = res.length ? (g.list.some(t => t.st === "needs") ? "needs" : g.list.every(t => t.st === "mastered") ? "mastered" : "practising") : "new";
      return `<details class="st-unit ${g.unit ? "" : "other"}" ${g.list.some(t => stPick.includes(t.id) || stOpen === t.id) ? "open" : ""}><summary>${statusDot(st)}
        <span class="st-unit-t"><b>${safe(g.unit ? g.unit.title : "Other topics")}</b><small>${g.list.length} ${g.list.length === 1 ? "topic" : "topics"}${avg != null ? ` · ${avg}%` : ""}${
          g.unit ? g.unit.term ? ` · ${safe(g.unit.term)}` : "" : " · not in the official curriculum"}</small></span></summary>
        <ul class="st-list">${g.list.map(rowHtml).join("")}</ul></details>`; }).join("");
  }
  const cmpBtn = `<div class="btnrow st-cmp-row"><button class="pill ${stCmp ? "on" : ""}" data-stcmp aria-pressed="${stCmp}">📊 ${stCmp ? "Back to my topics" : "Compare with the official curriculum"}</button></div>`;
  if (stCmp) return cmpBtn + compareHtml(schoolKid, s, f, parent);
  return `${cmpBtn}${leftBehindHtml(schoolKid, s, f, all)}<div class="card bd-card st-card"><h2>📚 ${parent ? "Topics" : "My topics"}</h2>
    ${parent && all.length ? `<div class="chips st-filters">${ST_FILTERS.map(([k, label]) => `<button class="chip ${stFilter === k ? "on" : ""}" data-stfilter="${k}" aria-pressed="${stFilter === k}">${label}${k === "all" ? "" : ` (${count(k)})`}</button>`).join("")}</div>` : ""}
    ${parent && all.length && !(m && m.list.length) && !unitsHtml ? `<p class="hint st-nounits">📖 Tip: open 📖 This year's topics and get the official list: then these are grouped into big units.</p>` : ""}
    ${all.length ? `${unitsHtml ? `<div class="st-units">${unitsHtml}</div>` : `<ul class="st-list">${rows || `<li class="sc-empty">No topics here.</li>`}</ul>`}
      <p class="st-legend">⚪ New · 🟡 Practising · 🔴 Needs work · 🟢 Mastered</p>
      <div class="btnrow"><button class="primary st-make ${stPick.length ? "" : "off"}" data-stmake data-aiwait="stmake" aria-disabled="${!stPick.length}">✏️ Make a worksheet${stPick.length ? ` (${stPick.length})` : ""}</button></div>`
      : `<p class="sc-empty">📂 No topics yet. Tap ⬆️ Upload topic and add a school file (a photo or PDF).</p>`}</div>`;
}
// ---------- 📊 v192 COMPARE: the official curriculum, unit by unit (its small topics = parts), against what the school
// taught (the school topics from newsletters and files) and what the kid practised (worksheets) · tick → ✏️ Make a worksheet ----------
// (an older official list without parts: each unit is one row; parents can get it again with the small topics)
// A school topic = this small topic? Same title, or most of their words match, NOT counting the unit's own words
// ("Adding fractions" ≠ "Equivalent fractions" in the unit "Fractions": only "fractions" is shared)
function partSame(a, b, unit) {
  if (sameTopicTitle(a, b)) return true;
  const U = new Set(topicWords(unit || "").map(curStem)), w = t => [...new Set(topicWords(t).filter(x => x.length > 2).map(curStem))].filter(x => !U.has(x));
  const A = w(a), B = new Set(w(b));
  if (!A.length || !B.size) return false;
  const both = A.filter(x => B.has(x)).length;
  return both >= 1 && both / Math.max(A.length, B.size) >= 0.6;
}
function compareRows(kid, s, f) {
  const m = s.map[f.id], rows = topicRows(kid, s, f), used = new Set();
  const units = m.list.map(u => {
    const parts = (u.parts && u.parts.length ? u.parts : [u.title]).map(p => {
      const mine = rows.filter(r => partSame(r.title, p, u.parts && u.parts.length ? u.title : "")); mine.forEach(r => used.add(r.id));
      const direct = topicInfo(kid, f, p), ws = new Map();
      [...mine.map(r => r.info), direct].forEach(i => i.list.forEach(w => ws.set(w.id, w)));
      const res = new Map(); [...mine.flatMap(r => r.info.results), ...direct.results].forEach(r => res.set(r.ws + "|" + r.date, r));
      const results = [...res.values()].sort((a, b) => a.date.localeCompare(b.date));
      const st = topicStatus({ list: [...ws.values()], results });
      return { title: p, taught: mine.length > 0, when: mine.map(r => r.added).filter(Boolean).sort()[0] || "", n: ws.size, st, results };
    });
    return { title: u.title, term: u.term, now: u.now, parts };
  });
  // (a school topic named like the whole unit: the unit has started, its untaught small topics show 🟡)
  units.forEach(u => { const hit = rows.filter(r => sameTopicTitle(r.title, u.title)); if (!hit.length) return; hit.forEach(r => used.add(r.id)); u.parts.forEach(p => { if (!p.taught) p.unitTaught = true; }); });
  return { units, extra: rows.filter(r => !used.has(r.id)) };
}
function compareHtml(kid, s, f, parent) {
  const m = s.map[f.id], who = safe(kidNameOf(kid));
  if (!m || !m.list.length) return `<div class="card bd-card st-cmp"><h2>📊 Compare</h2>
    <p class="hint">First we need the official ${safe(f.name)} curriculum for ${who}'s year. It comes once, then the app compares it with what the school taught.</p>
    ${parent ? `<div class="btnrow"><button class="primary" data-stmapload="${safe(f.id)}" data-aiwait="map|${safe(f.id)}">📖 Get the official curriculum</button></div>`
      : `<p class="hint">🙋 Ask Mum or Dad to get it (📖 This year's topics).</p>`}</div>`;
  const { units, extra } = compareRows(kid, s, f), all = units.flatMap(u => u.parts);
  stCmpPick = stCmpPick.filter(t => all.some(p => p.title === t));
  const taught = all.filter(p => p.taught).length, practised = all.filter(p => p.n).length, notYet = all.filter(p => !p.taught && !p.unitTaught).length;
  const noParts = m.list.every(u => !(u.parts && u.parts.length));
  const res = p => p.results.length ? `${statusDot(p.st)} <small>${meanPct(p.results.slice(-3).map(x => x.pct))}%</small>` : p.n ? statusDot(p.st) : `<span class="hint">—</span>`;
  const row = p => { const on = stCmpPick.includes(p.title);
    return `<tr class="${on ? "on" : ""}"><td><b>${safe(p.title)}</b></td>
      <td>${p.taught ? `✅${p.when ? ` <small>${dayMon(p.when)}</small>` : ""}` : p.unitTaught ? `🟠 <small>unit started</small>` : `❌ <small>not yet</small>`}</td>
      <td>${p.n ? `${p.n} <small>${p.n === 1 ? "sheet" : "sheets"}</small>` : `<small>none</small>`}</td><td>${res(p)}</td>
      <td><input type="checkbox" data-stcmptick="${safe(encodeURIComponent(p.title))}" ${on ? "checked" : ""} aria-label="Pick ${safe(p.title)}"></td></tr>`; };
  const pc = (n, of) => of ? Math.round(n / of * 100) : 0;
  const scoreOf = list => { const r = list.filter(p => p.results.length); return r.length ? meanPct(r.map(p => meanPct(p.results.slice(-3).map(x => x.pct)))) : null; };
  const unit = (u, i) => { const t = u.parts.filter(p => p.taught).length, pr = u.parts.filter(p => p.n).length, sc = scoreOf(u.parts);
    return `<details class="st-cmp-unit" ${u.now || u.parts.some(p => stCmpPick.includes(p.title)) ? "open" : ""}><summary><b>Unit ${i + 1}: ${safe(u.title)}</b>
      <small>${[u.term, `✅ taught ${t} of ${u.parts.length} (${pc(t, u.parts.length)}%)`, `✏️ practised ${pc(pr, u.parts.length)}%`, sc != null ? `🎯 score ${sc}%` : "", u.now ? "📍 the class is here now" : ""].filter(Boolean).map(safe).join(" · ")}</small></summary>
      <div class="st-cmp-wrap"><table class="st-cmp-t"><thead><tr><th>Official topic</th><th>School</th><th>Practised</th><th>Result</th><th>Pick</th></tr></thead>
      <tbody>${u.parts.map(row).join("")}</tbody></table></div></details>`; };
  // 📢 The summary: the class is past these units (before the "now" unit, else before the last unit the school taught from),
  // but the school never taught these small topics → "practise them yourself" (+ one button that ticks the first 4)
  const nowAt = units.findIndex(u => u.now), lastAt = units.reduce((n, u, i) => u.parts.some(p => p.taught) ? i : n, -1);
  const cut = nowAt >= 0 ? nowAt : lastAt, missed = units.slice(0, Math.max(0, cut)).flatMap(u => u.parts).filter(p => !p.taught && !p.n);
  const left = cut >= 0 ? units[cut].parts.filter(p => !p.taught && !p.n) : [];
  const summary = missed.length ? `<div class="st-cmp-sum"><p>📢 <b>${parent ? `${who}'s school` : "Your school"} hasn't covered ${missed.length} ${missed.length === 1 ? "topic" : "topics"} from the official curriculum</b>
      that the class has already gone past. ${parent ? `${who} needs` : "You need"} to practise ${missed.length === 1 ? "it" : "them"} at home:</p>
      <ul>${missed.map(p => `<li>${safe(p.title)}</li>`).join("")}</ul>
      <div class="btnrow"><button class="primary" data-stcmpmissed="${safe(missed.slice(0, 4).map(p => encodeURIComponent(p.title)).join("|"))}">✏️ Tick ${missed.length > 4 ? "the first 4" : missed.length === 1 ? "it" : "them"} for a worksheet</button></div></div>`
    : all.length && cut >= 0 ? `<div class="st-cmp-sum ok"><p>👍 <b>So far the school has covered the official topics</b> of the units the class has finished.${left.length ? ` Still to come in ${safe(units[cut].title)}: ${left.map(p => safe(p.title)).join(", ")}.` : ""}</p></div>` : "";
  return `<div class="card bd-card st-cmp"><h2>📊 ${safe(f.name)}: official curriculum vs school</h2>${summary}
    <p class="st-bench"><b>📖 ${all.length} official topics</b> · <b>✅ ${taught} taught at school (${pc(taught, all.length)}%)</b> · <b>✏️ ${practised} practised (${pc(practised, all.length)}%)</b> · <b>❌ ${notYet} not yet (${pc(notYet, all.length)}%)</b>${scoreOf(all) != null ? ` · <b>🎯 average score ${scoreOf(all)}%</b>` : ""}</p>
    <div class="cur-bar st-cmp-bar" role="img" aria-label="${pc(taught, all.length)}% taught at school"><i style="width:${pc(taught, all.length)}%"></i></div>
    <p class="hint">${pc(taught, all.length)}% of this year's ${safe(f.name)} has been taught at school so far.</p>
    ${noParts && parent ? `<p class="hint">This list only has the big units. <button class="linkbtn" data-stmapload="${safe(f.id)}" data-aiwait="map|${safe(f.id)}">🔄 Get the small topics of each unit</button></p>` : ""}
    <div class="st-cmp-units">${units.map(unit).join("")}</div>
    ${extra.length ? `<details class="st-cmp-unit other"><summary><b>School topics not in the official list</b> <small>${extra.length}</small></summary>
      <ul class="st-blist">${extra.map(r => `<li>${statusDot(r.st)} ${safe(r.title)}</li>`).join("")}</ul></details>` : ""}
    <p class="st-legend">School: ✅ taught · 🟠 unit started · ❌ not yet. Result: ⚪ New · 🟡 Practising · 🔴 Needs work · 🟢 Mastered</p>
    <div class="btnrow"><button class="primary ${stCmpPick.length ? "" : "off"}" data-stcmpmake="${safe(f.id)}" data-aiwait="stcmpmake" aria-disabled="${!stCmpPick.length}">✏️ Make a worksheet${stCmpPick.length ? ` (${stCmpPick.length})` : ""}</button></div>
    <p class="hint">Tick up to 4 topics. Topics the school hasn't taught yet start easy, with a short explanation first.</p></div>`;
}
async function compareWorksheet(kid, sid) {
  const s = schoolOf(kid), f = s.subjects[sid] && { id: sid, ...s.subjects[sid] };
  if (!f) return;
  if (!stCmpPick.length) return toast("📌 Tick at least one topic first.", 2500);
  const items = compareRows(kid, s, f).units.flatMap(u => u.parts).filter(p => stCmpPick.includes(p.title));
  if (!items.length) return;
  const fresh = items.filter(p => !p.taught && !p.n).map(p => p.title);
  const sections = items.length > 1 ? items.map(p => ({ topic: p.title, minutes: Math.max(5, Math.round(30 / items.length)), focus: [], kind: KIND_OF[p.st] })) : [];
  const id = await newWorksheet(kid, f.name, items.map(p => p.title), 10, pickMode(kid, f.name), "stcmpmake",
    { part: items[0].title, ...(sections.length ? { sections } : {}),
      ...(fresh.length ? { hint: `Not taught at school yet: ${fresh.join(", ")}. For these, start very easy, explain the idea in one line before the first question, then step up slowly.` } : {}) }, true);
  if (id) { stCmpPick = []; toast("✨ Your worksheet is ready! 🖨️ Print or 📄 PDF.", 3500); }
}
// 👨‍👩‍👧 A topic's history: each worksheet, its date, score and 🎯 weak points
function topicHistoryHtml(t) {
  const list = t.info.list;
  return `<div class="st-hist">${list.length ? `<ul>${list.map(w => { const pct = w.check ? topicPctIn(w, t.title) : null, weak = w.check ? w.check.weak_points || [] : [];
      return `<li><button class="linkbtn" data-aiopen="worksheet|${safe(w.id)}">📝 ${safe(w.title)}</button>
        <small>${dayMon(w.date)} · ${pct != null ? `${pct}%` : safe(w.status)}</small>${weak.length ? `<small class="st-weak">🎯 ${safe(weak.join(", "))}</small>` : ""}</li>`; }).join("")}</ul>`
    : `<p class="hint">No worksheets on this topic yet.</p>`}${t.note ? `<p class="hint">${safe(t.note)}</p>` : ""}${t.sum ? `<p class="hint st-sum">📄 <b>From the school file:</b> ${safe(t.sum)}</p>` : ""}${
      stuckSkipped(schoolKid, t.sub, t.title) ? `<p class="hint">⏭ Skipped for now (not in sessions). <button class="linkbtn" data-stuckback="${safe(schoolKid)}|${safe(t.sub)}|${safe(encodeURIComponent(t.title))}">↩ Bring it back</button></p>` : ""}${t.files.length ? `<p class="hint">📂 ${t.files.length} school ${t.files.length === 1 ? "file" : "files"}</p>` : ""}</div>`;
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
  const all = topicRows(kid, s, f), kept = all.filter(t => !stuckSkipped(kid, f.id, t.title)), rows = kept.length ? kept : all;   // (⏭ not the skipped ones)
  const avg = t => { const r = t.info.results.slice(-3).map(x => x.pct); return r.length ? meanPct(r) : 100; };
  if (rows.length === 1) return [{ topic: rows[0].title, minutes, focus: topicWeak(rows[0].info), kind: rows[0].st === "needs" ? "needs_work" : "practising" }];
  // (📚 v179: never-practised topics one after the other in the school's order: the oldest first, then their place in the file)
  const byOrder = (a, b) => (a.added || "").localeCompare(b.added || "") || (a.ord ?? 999) - (b.ord ?? 999);
  const g = { needs: rows.filter(t => t.st === "needs").sort((a, b) => avg(a) - avg(b)), new: rows.filter(t => t.st === "new").sort(byOrder),
              practising: rows.filter(t => t.st === "practising").sort((a, b) => avg(a) - avg(b)), mastered: rows.filter(t => t.st === "mastered") };
  if (!g.needs.length && !g.new.length && !g.practising.length) {   // all 🟢
    const a = g.mastered[0], b = g.mastered[1] || a, main = Math.max(5, Math.round(minutes * 0.75));
    return [{ topic: a.title, minutes: main, focus: [], kind: "practising" }, { topic: b.title, minutes: Math.max(5, minutes - main), focus: [], kind: "challenge" }];
  }
  // 🏫 v191 (Broo2a) study follows school: this week's newsletter topics come first (not 🟢 yet), then last week's 🔴 ones;
  //   a test on this subject in the next 3 days: its topics first. They take about half the session (a test: most of it).
  const today = todayYmd(), wk = s.week && s.week.start <= today && today <= s.week.end ? s.week.start : mondayOf(new Date());
  const test = testsAhead(kid, 3).find(t => t.f.id === f.id), tTopics = test ? testTopics(s, f, test.date) : [];
  const schoolNow = rows.filter(t => (test ? tTopics.some(x => sameTopicTitle(x, t.title)) : t.added === wk && t.st !== "mastered") || (!test && t.added === addDaysYmd(wk, -7) && t.st === "needs"));
  if (schoolNow.length) {
    const share = test ? 0.7 : 0.5, gm = Math.round(minutes * share), n = Math.max(1, Math.min(3, schoolNow.length, Math.floor(gm / 5)));
    const first = schoolNow.sort((a, b) => (b.added || "").localeCompare(a.added || "") || avg(a) - avg(b)).slice(0, n)
      .map(t => ({ topic: t.title, minutes: Math.max(5, Math.round(gm / n)), focus: t.st === "needs" ? topicWeak(t.info) : [], kind: test ? "review" : t.st === "needs" ? "needs_work" : "practising" }));
    Object.keys(g).forEach(k => { g[k] = g[k].filter(t => !first.some(x => x.topic === t.title)); });
    minutes = Math.max(5, minutes - gm);
    if (!g.needs.length && !g.new.length && !g.practising.length && !g.mastered.length) return first;
    return [...first, ...restSections(kid, f, g, minutes)].slice(0, 6);
  }
  return restSections(kid, f, g, minutes);
}
function restSections(kid, f, g, minutes) {
  if (!g.needs.length && !g.new.length && !g.practising.length) {
    const a = g.mastered[0]; if (!a) return [];
    return [{ topic: a.title, minutes, focus: [], kind: "practising" }];
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
  if (sessionNotYet(x)) return sessionNotYetToast(x);   // ⏰ only once its time has come
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
  $("awTitle").textContent = f ? `⬆️ Upload topic · ${f.emoji} ${f.name}` : "⬆️ Upload topic";
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
    subjects: subs.map(x => ({ id: x.id, name: `${x.name} (${TOPIC_NAME_RULE})`, existing: topicsOf(s, x.id).map(t => t.title).slice(0, 80) })), ...(box.sid ? { only: box.sid } : {}) }, "curriculum");
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
      g.topics.push({ title, note: aiTxt(t.note, 200), sum: aiTxt(t.summary, 1200), same: hit ? hit.id : "", on: !hit });   // (📄 v179: what the file teaches on it)
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
  // 📄 v179: each topic keeps the file's SUMMARY (sum: what the class learned, new first) and its place in the file (ord), so the
  //    worksheets follow what was taught, topic after topic in the school's order
  const addSum = (x, t) => { if (t.sum && !(x.sum || "").includes(t.sum)) x.sum = [t.sum, x.sum].filter(Boolean).join(" ").slice(0, 1200); };
  const touch = (x, t) => { x.added = today; x.files = [...new Set([...x.files, ...files])].slice(0, 30); addSum(x, t); };
  let added = 0, linked = 0, dates = 0;
  box.result.groups.forEach(g => g.topics.forEach((t, i) => {
    if (t.on) {
      const id = topicIdOf(g.sid, t.title);
      if (s.curr[id]) { touch(s.curr[id], t); linked++; }   // (the very same title)
      else { s.curr[id] = { sub: g.sid, title: t.title, note: t.note, added: today, files: files.slice(0, 30), by: me, ord: i, ...(t.sum ? { sum: t.sum } : {}) }; added++; }
    } else if (t.same && s.curr[t.same]) { touch(s.curr[t.same], t); linked++; }
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
// ---------- 😟 v179 STUCK ON A TOPIC (Broo2a): the last 5 worksheets with that topic were ALL under 60 % ----------
// → 🔔 Needs you (parents): "Does he need more explaining, or skip this topic?" · 🤖 Ask AI for help (the same mistake + advice)
//   · ⏭ Skip this topic (out of 📚 sessions and 🎯 weak points; ↩ Bring it back in the topic's history)
//   · ✅ I explained it → a new 🎯 worksheet on those weak points (then it only alerts again after 5 more fails).
// Data: data.school[kid].learn[subject id].stuck[topic key] = { skip?, done? (its results count then), help?, at }
const STUCK_N = 5, STUCK_PCT = 60;
const stuckRecOf = (kid, fid, title) => { const L = (schoolOf(kid).learn || {})[fid]; return (L && L.stuck && L.stuck[topicKey(title)]) || null; };
const stuckSkipped = (kid, fid, title) => { const r = stuckRecOf(kid, fid, title); return !!(r && r.skip); };
function stuckRecFor(kid, fid, title) {
  const f = schoolOf(kid).subjects[fid], L = f && learnFor(kid, f.name);
  if (!L) return null;
  if (!L.stuck) L.stuck = {};
  return L.stuck[topicKey(title)] || (L.stuck[topicKey(title)] = { at: new Date().toISOString() });
}
function isStuck(kid, fid, t) {
  const rec = stuckRecOf(kid, fid, t.title);
  if (rec && rec.skip) return false;
  const last = t.info.results.slice(rec && rec.done ? rec.done : 0).slice(-STUCK_N);
  return last.length >= STUCK_N && last.every(x => x.pct < STUCK_PCT);
}
// Every stuck topic of every kid (parents only) → [{ kid, f, t, rec }]
function stuckList() {
  if (!isParentDevice() || !feat("coach")) return [];
  const out = [];
  kidsList().forEach(k => { const s = schoolOf(k.id);
    subjectList(s).forEach(f0 => { const f = { id: f0.id, ...f0 };
      topicRows(k.id, s, f).filter(t => isStuck(k.id, f.id, t)).forEach(t => out.push({ kid: k.id, f, t, rec: stuckRecOf(k.id, f.id, t.title) })); }); });
  return out;
}
const stuckId = x => `${safe(x.kid)}|${safe(x.f.id)}|${safe(encodeURIComponent(x.t.title))}`;
function stuckCardHtml(x) {
  const name = kidNameOf(x.kid), last = x.t.info.results.slice(-STUCK_N).map(r => r.pct + "%").join(", "), hp = x.rec && x.rec.help, id = stuckId(x);
  return `<div class="card stuck-card"><p>😟 <b>${safe(name)}</b> is stuck on <b>${safe(x.t.title)}</b> in ${safe(x.f.name)}: the last ${STUCK_N} worksheets were ${safe(last)}.</p>
    <p>Does ${safe(name)} need more explaining, or should we skip this topic for now?</p>
    ${hp ? `<div class="stuck-help"><p><b>🔁 The same mistake:</b> ${safe(hp.mistake)}</p>${hp.why ? `<p><b>🤔 Why:</b> ${safe(hp.why)}</p>` : ""}
      ${hp.explain_steps.length ? `<p><b>🧑‍🏫 How to explain it:</b></p><ol>${hp.explain_steps.map(t => `<li>${safe(t)}</li>`).join("")}</ol>` : ""}
      ${hp.home_tips.length ? `<p><b>🏠 At home:</b></p><ul>${hp.home_tips.map(t => `<li>${safe(t)}</li>`).join("")}</ul>` : ""}</div>` : ""}
    <div class="btnrow">${hp ? "" : `<button class="primary" data-stuckai="${id}" data-aiwait="stuck|${safe(x.kid)}|${safe(x.t.title)}">🤖 Ask AI for help</button>`}
      <button ${hp ? `class="primary"` : ""} data-stuckfix="${id}" data-aiwait="stuckfix|${safe(x.kid)}|${safe(x.t.title)}">✅ I explained it: make a new worksheet</button>
      <button data-stuckskip="${id}">⏭ Skip this topic</button></div></div>`;
}
// The kid's wrong answers on the topic, from its last checked worksheets
function stuckWrong(t) {
  const out = [], title = lowerT(t.title);
  t.info.list.filter(w => w.check).slice(0, STUCK_N + 2).forEach(w => {
    const mine = (w.questions || []).some(q => q.topic) ? new Set(w.questions.filter(q => lowerT(q.topic) === title || sameTopicTitle(q.topic || "", t.title)).map(q => q.number)) : null;
    w.check.questions.filter(q => q.fixed === "wrong" || (!q.correct && q.fixed !== "right")).forEach(q => {
      if (mine && mine.size && !mine.has(q.number)) return;
      const wq = w.questions.find(y => y.number === q.number) || {};
      out.push({ question: String(wq.prompt || "").slice(0, 300), child: q.your_answer || "", right: String(wq.answer || "").slice(0, 200), note: q.explanation || q.note || "" });
    });
  });
  return out.slice(0, 30);
}
function stuckFind(ds) {
  const [kid, fid, enc] = String(ds).split("|"), title = decodeURIComponent(enc || ""), s = schoolOf(kid), f0 = s.subjects[fid];
  if (!f0) return null;
  const f = { id: fid, ...f0 }, t = topicRows(kid, s, f).find(y => y.title === title);
  return t ? { kid, f, t } : null;
}
async function stuckAskAi(ds) {
  const x = stuckFind(ds);
  if (!x) return;
  const L = learnRead(x.kid, x.f.name), r = await callAi("stuck", { ...kidInfo(x.kid), subject: x.f.name, topic: x.t.title, ...(x.t.sum ? { summary: x.t.sum } : {}),
    results: x.t.info.results.slice(-STUCK_N).map(y => y.pct), weak: topicWeak(x.t.info), wrong: stuckWrong(x.t), ...(L ? { level: levelNow(L) } : {}) }, "stuck|" + x.kid + "|" + x.t.title);
  if (!r) return;
  const strs = (y, n) => aiArr(y, n).map(t => aiTxt(t, 300)).filter(Boolean);
  const rec = stuckRecFor(x.kid, x.f.id, x.t.title);
  if (!rec) return;
  rec.help = { mistake: aiTxt(r.mistake, 600) || "No clear pattern yet.", why: aiTxt(r.why, 600), explain_steps: strs(r.explain_steps, 6), home_tips: strs(r.home_tips, 4),
               focus: strs(r.focus, 3).map(t => t.slice(0, 60)), at: new Date().toISOString() };
  writeData();
  render();
}
async function stuckFix(ds) {
  const x = stuckFind(ds);
  if (!x) return;
  const hp = (stuckRecOf(x.kid, x.f.id, x.t.title) || {}).help, focus = hp && hp.focus.length ? hp.focus : topicWeak(x.t.info);
  const id = await newWorksheet(x.kid, x.f.name, [x.t.title], WS_COUNT, "weak_points", "stuckfix|" + x.kid + "|" + x.t.title,
    { title: `🎯 ${x.f.name}: ${topicShort(x.t.title)} again`, part: x.t.title, ...(focus.length ? { focus } : {}),
      sections: [{ topic: x.t.title, minutes: 25, focus, kind: "needs_work" }],
      ...(hp ? { hint: `The parents just explained this topic again. The child kept making this mistake: ${hp.mistake} Include questions that check exactly this, from very easy up to the child's level.` } : {}) }, false);
  if (!id) return;
  const rec = stuckRecFor(x.kid, x.f.id, x.t.title);
  rec.done = x.t.info.results.length;   // (alerts again only after 5 more fails)
  writeData();
  render();
  toast(`✅ A new worksheet on ${x.t.title} is ready in ${kidNameOf(x.kid)}'s 🎒 School › Worksheets.`, 4500);
}
function stuckSkip(ds, on) {
  const [kid, fid, enc] = String(ds).split("|"), rec = stuckRecFor(kid, fid, decodeURIComponent(enc || ""));
  if (!rec) return;
  if (on) rec.skip = true; else { delete rec.skip; rec.done = 0; }
  writeData();
  render();
  toast(on ? "⏭ Skipped for now: it's out of the study sessions. Bring it back from the topic's history any time." : "↩ It's back in the study sessions.", 4000);
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-stuckai], [data-stuckfix], [data-stuckskip], [data-stuckback]");
  if (!b || !isParentDevice()) return;
  const ds = b.dataset;
  if (ds.stuckai) return stuckAskAi(ds.stuckai);
  if (ds.stuckfix) return stuckFix(ds.stuckfix);
  if (ds.stuckskip) return stuckSkip(ds.stuckskip, true);
  if (ds.stuckback) return stuckSkip(ds.stuckback, false);
});
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
// (v162: "IGCSE" only from Year 10 up; younger kids on the British / IGCSE track get "British")
const mapLabel = kid => { const c = curriculumOf(kid) || "", y = parseInt(String(gradeOf(kid) || "").replace(/\D+/g, " ").trim(), 10);
  if (c && !/igcse|british/i.test(c)) return c;
  return y >= 10 ? "IGCSE" : "British"; };
async function loadMap(kid, sid) {
  const s = schoolOf(kid), f = s.subjects[sid];
  if (!f || !isParentDevice()) return;
  const syl = s.syllabus;
  const r = await callAi("topics", { ...kidInfo(kid), subject: f.name, today: todayYmd(), ...(syl && syl.text ? { syllabus: syl.text } : {}) }, "map|" + sid);
  const list = (r && Array.isArray(r.topics) ? r.topics : []).map(t => ({ title: aiTxt(t.title, 80), term: aiTxt(t.term, 20), now: t.now === true,
    ...(Array.isArray(t.parts) && t.parts.length ? { parts: t.parts.map(x => aiTxt(x, 80)).filter(Boolean).slice(0, 8) } : {}) })).filter(t => t.title).slice(0, 30);
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
  if (!m) return `<p class="hint">Everything ${safe(kidNameOf(kid))} should learn in ${safe(f.name)}${year ? ` in ${safe(year)}` : " this year"} (${safe(label)} curriculum). Get it once, then you see what's done and what's left.</p>
    <div class="btnrow"><button class="primary" data-stmapload="${safe(f.id)}" data-aiwait="map|${safe(f.id)}">📖 Get this year's topics</button></div>`;
  const chip = t => { const on = stMapPick.includes(t); return `<button class="ph-chip ${on ? "on" : ""}" data-stmappick="${safe(encodeURIComponent(t))}" aria-pressed="${on}">${safe(t)}${on ? ` <b class="ph-tick" aria-hidden="true">✓</b>` : ""}</button>`; };
  const ul = list => list.length ? `<ul class="st-blist">${list.map(t => `<li>${safe(t)}</li>`).join("")}</ul>` : `<p class="hint">None.</p>`;
  return `${curBriefHtml(kid, f)}<details class="cur-tools"><summary>🛠️ More: the full list, 📊 Benchmark, pick your own topics</summary><p class="hint">${safe(sys)}${year ? ` · ${safe(year)}` : ""} · ${m.list.length} topics</p>
    <div class="btnrow"><button class="pill" data-stbench="${safe(f.id)}" data-aiwait="bench|${safe(f.id)}">📊 Benchmark</button>
      <button class="linkbtn" data-stmapload="${safe(f.id)}" data-aiwait="map|${safe(f.id)}">🔄 Again</button></div>
    ${b ? `<p class="st-bench"><b>✅ Covered ${b.covered.length}</b> · <b>⏳ Not yet ${b.not_yet.length}</b> · <b>🚀 Ahead ${b.ahead.length}</b></p>
      ${b.note ? `<p class="hint">${safe(b.note)}</p>` : ""}
      <details><summary>✅ Covered</summary>${ul(b.covered)}</details><details><summary>⏳ Not yet</summary>${ul(b.not_yet)}</details><details><summary>🚀 Ahead</summary>${ul(b.ahead)}</details>` : ""}
    <h3 class="ph-group">🌍 Extra ${safe(label)} practice</h3>
    <p class="hint">Pick topics. The results go to the 🧠 profile as “${safe(label)} extra”, never into the school topics.</p>
    ${b && b.not_yet.length ? `<div class="btnrow"><button class="linkbtn" data-stmapnotyet="${safe(f.id)}">⏳ Pick the “Not yet” ones</button></div>` : ""}
    <div class="ph-chips">${m.list.map(t => chip(t.title)).join("")}</div>
    <div class="btnrow"><button class="primary ${stMapPick.length ? "" : "off"}" data-stmapmake="${safe(f.id)}" data-aiwait="mapmake" aria-disabled="${!stMapPick.length}">✏️ Make ${safe(label)} practice${stMapPick.length ? ` (${stMapPick.length})` : ""}</button></div></details>`;
}

// ---------- 🌍 v154: do the school topics MATCH the official curriculum? (no 🤖: word matching on the saved official list) ----------
// Two titles match when they're the same topic (sameTopicTitle), or half of the shorter one's words are in the other
// (words compared by their first 5 letters, so "digestion" = "digestive").
const curStem = w => w.slice(0, 5);
function curSame(a, b) {
  if (sameTopicTitle(a, b)) return true;
  const A = [...new Set(topicWords(a).filter(w => w.length > 2).map(curStem))], B = new Set(topicWords(b).filter(w => w.length > 2).map(curStem));
  if (!A.length || !B.size) return false;
  const both = A.filter(w => B.has(w)).length, small = Math.min(A.length, B.size);
  return both >= 1 && both / small >= 0.5;
}
// The official topic a school topic matches (or null); no official list yet → undefined
function curMatchOf(kid, sid, title) {
  const m = schoolOf(kid).map[sid];
  if (!m || !m.list.length) return undefined;
  return m.list.find(t => curSame(title, t.title)) || null;
}
// The small tag on a topic (parents): "🌍 ✅ In the curriculum" · "🌍 ⚠️ Not in the curriculum" (nothing before the official list is loaded)
function curTagHtml(kid, sid, title) {
  const x = curMatchOf(kid, sid, title);
  return x === undefined ? "" : x ? `<small class="cur-tag ok">🌍 ✅ In the curriculum${x.term ? ` · ${safe(x.term)}` : ""}</small>` : `<small class="cur-tag no">🌍 ⚠️ Not in the curriculum</small>`;
}
// 🌍 The brief: ✅ done and matched · ⏭️ the next lesson · ⚠️ the risks (behind / weak) · 🔜 coming later · ➕ extra (not in the curriculum)
function curBriefHtml(kid, f) {
  const s = schoolOf(kid), m = s.map[f.id];
  if (!m || !m.list.length) return "";
  const rows = topicRows(kid, s, f), done = r => r.info.results.length > 0;
  const off = m.list.map((t, i) => { const mine = rows.filter(r => curSame(r.title, t.title)), tried = mine.filter(done);
    const pct = tried.length ? Math.round(tried.reduce((n, r) => n + meanPct(r.info.results.slice(-3).map(x => x.pct)), 0) / tried.length) : null;
    return { ...t, i, mine, practised: tried.length > 0, pct, weak: tried.some(r => r.st === "needs") || (pct != null && pct < 60) }; });
  // Where the class is: the official "now" topics (else: the last topic he has). Before it and not practised = ⚠️ behind; after it = 🔜 later.
  const lastNow = off.reduce((n, t) => t.now ? t.i : n, -1), firstNow = off.findIndex(t => t.now);
  const lastDone = off.reduce((n, t) => t.practised || t.mine.length ? t.i : n, -1), cut = firstNow >= 0 ? firstNow : lastDone + 1, after = firstNow >= 0 ? lastNow : lastDone;
  const matched = off.filter(t => t.practised), behind = off.filter(t => !t.practised && !t.mine.length && t.i < cut), later = off.filter(t => !t.mine.length && t.i > after);
  const weak = off.filter(t => t.weak), inSchool = off.filter(t => t.mine.length && !t.practised && !t.now);
  // 📍 now in class = the official "now" topics · ⏭️ the next lesson = the first topic after them that isn't practised yet
  const nowList = off.filter(t => t.now), nextUp = off.filter(t => t.i > lastNow && !t.practised).slice(0, 3);
  const next3 = nextUp.length ? nextUp : off.filter(t => !t.practised).slice(0, 3);
  const extra = rows.filter(r => !m.list.some(t => curSame(r.title, t.title)));
  const pctAll = Math.round(matched.length / off.length * 100);
  // (v162: one simple screen: the bar, where the class is, what's not done yet + ONE button; the rest folded)
  const notDone = [...behind, ...inSchool, ...nowList.filter(t => !t.practised && !behind.includes(t) && !inSchool.includes(t))];
  const toDo = (notDone.length ? notDone : next3).slice(0, 4).map(t => t.title);
  const li = (t, extra) => `<li><b>${safe(t.title)}</b>${extra || t.term ? `<small>${safe([String(extra || "").replace(/^ · /, ""), t.term].filter(Boolean).join(" · "))}</small>` : ""}</li>`;
  const block = (cls, title, list, fn, empty) => `<div class="cur-block ${cls}"><h3>${title} <span class="wsg-n">${list.length}</span></h3>${list.length ? `<ul>${list.map(fn).join("")}</ul>` : `<p class="hint">${empty}</p>`}</div>`;
  const fold = (cls, title, list, fn) => list.length ? `<details class="cur-fold ${cls}"><summary>${title} <span class="wsg-n">${list.length}</span></summary><ul>${list.map(fn).join("")}</ul></details>` : "";
  return `<div class="cur-brief">
    <h2>📖 This year's topics</h2>
    <div class="cur-bar" role="img" aria-label="${pctAll}% done"><i style="width:${pctAll}%"></i></div>
    <p class="cur-sum"><b>${matched.length} of ${off.length}</b> done (${pctAll}%)</p>
    ${nowList.length ? `<div class="cur-next now"><span>📍 In class now</span><b>${safe(nowList.map(t => t.title).join(", "))}</b></div>` : ""}
    ${next3.length ? `<div class="cur-next"><span>⏭️ Coming next</span>${next3.map(t => `<b>${safe(t.title)}</b>`).join("")}</div>` : `<div class="cur-next"><span>🎉 All done</span><b>Every topic of the year is practised</b></div>`}
    ${block("risk", "⚠️ Not done yet", notDone, t => li(t, t.now ? "In class now" : t.mine.length ? "No worksheet yet" : "Should be done by now"), "No gaps so far. 👍")}
    ${toDo.length ? `<div class="btnrow"><button class="primary cur-go" data-stnotdone="${safe(f.id)}" data-stnotdonet="${safe(toDo.map(encodeURIComponent).join("|"))}" data-aiwait="mapmake">✏️ Practise what's not done yet${toDo.length > 1 ? ` (${toDo.length})` : ""}</button></div>` : ""}
    ${weak.length ? block("weak", "🔴 Weak marks", weak, t => li(t, `${t.pct}%`), "") : ""}
    ${fold("ok", "✅ Done", matched, t => li(t, t.pct != null ? `${t.pct}%` : ""))}
    ${fold("extra", "➕ Extra, not in this year's list", extra, t => `<li><b>${safe(t.title)}</b></li>`)}</div>`;
}

// ---------- 📊 The parents' summary (📊 How are my kids doing?): per subject ⚪ · 🔴 · 🟢, the 🔴 topics first with ✏️ Practise ----------
function topicsSummaryHtml(kid) {
  const s = schoolOf(kid), subs = subjectList(s).filter(f => topicsOf(s, f.id).length);
  if (!subs.length) return `<p class="sc-empty">No school topics yet. They come from ⬆️ Upload topic in 🎒 School.</p>`;
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
  if (ds.stleft) { stPick = ds.stleft.split(",").filter(Boolean).slice(0, 4); return makeFromTopics(); }   // (📌 left behind: practise them)
  if (ds.sessmore) return moreQuestions(ds.sessmore);
  if (ds.sessdone) return sessionDone(ds.sessdone);
  if ("stcmp" in ds) { stCmp = !stCmp; return render(); }
  if (ds.stcmpmake) return compareWorksheet(schoolKid, ds.stcmpmake);
  if (ds.stcmpmissed) { stCmpPick = ds.stcmpmissed.split("|").filter(Boolean).map(decodeURIComponent); render();
    const btn = document.querySelector("#scr-school [data-stcmpmake]"); if (btn) btn.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
  if (ds.stmapload) return loadMap(schoolKid, ds.stmapload);
  if (ds.stbench) return benchmark(schoolKid, ds.stbench);
  if (ds.stmappick) { const t = decodeURIComponent(ds.stmappick); stMapPick = stMapPick.includes(t) ? stMapPick.filter(x => x !== t) : [...stMapPick, t].slice(0, 8); return render(); }
  if (ds.stmapnotyet) { const bn = schoolOf(schoolKid).bench[ds.stmapnotyet]; stMapPick = bn ? bn.not_yet.slice(0, 8) : []; return render(); }
  if (ds.stmapmake) return mapPractice(schoolKid, ds.stmapmake);
  if (ds.stnotdone) { stMapPick = (ds.stnotdonet || "").split("|").filter(Boolean).map(decodeURIComponent); return mapPractice(schoolKid, ds.stnotdone); }
});
$("scr-school").addEventListener("change", e => {
  const ct = e.target.dataset && e.target.dataset.stcmptick;
  if (ct) { const t = decodeURIComponent(ct); stCmpPick = e.target.checked ? [...new Set([...stCmpPick, t])].slice(0, 4) : stCmpPick.filter(x => x !== t); return render(); }
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
         + ". On Friday after school, a week review worksheet is made for each subject.") : null,
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
  // 📰 v179 (Broo2a): the Week {n} reviews are made AFTER the week is taught: on its Friday after school (from 3 PM Dubai), not now
  if (subjects.length) {
    const fri = addDaysYmd(start, 4);
    s.reviewDue = [...(s.reviewDue || []).filter(x => x.start !== start), { n, label: res.week_label, start, fri, subjects: subjects.map(x => ({ subject: x.subject, topics: x.topics })) }].slice(-3);
    writeData();
  }
  // 📖 v191 (Broo2a): next week's PREVIEW worksheets, on the parents' day + time before the week starts (⚙️ Settings, default Sunday 9 AM)
  const pv = previewDateFor(start);
  if (subjects.length && pv) {
    s.previewDue = [...(s.previewDue || []).filter(x => x.start !== start), { n, label: res.week_label, start, on: pv, subjects: subjects.map(x => ({ subject: x.subject, topics: x.topics })) }].slice(-3);
    writeData();
  }
  toast(`📰 Added ${added} school ${added === 1 ? "date" : "dates"}${newTopics ? ` and ${newTopics} new ${newTopics === 1 ? "topic" : "topics"}` : ""}${subjects.length && pv ? `. 📖 The previews come ${dayMon(pv)}` : ""}${subjects.length ? `. The week reviews come on Friday ${dayMon(addDaysYmd(start, 4))} after school.` : ""}`, 6000);
}
// 📰 Friday after school (a parent's device opens the app from Friday 3 PM on): each waiting week review, one per subject.
//    🔴 needs-work topics of that week get more of the worksheet. (Older than 2 weeks: dropped, not made.)
const REVIEW_FROM = 15 * 60;
let reviewsMaking = false;
async function maybeMakeWeekReviews() {
  if (reviewsMaking || !isParentDevice() || !aiReady() || (cloud.enabled && !cloud.ready) || hasDraft()) return;
  const d = dubaiNow().date, after = x => d > x.fri || (d === x.fri && dubaiMinutes() >= REVIEW_FROM);
  const jobs = [];
  kidsList().forEach(k => { const s = schoolOf(k.id); (s.reviewDue || []).filter(after).forEach(x => jobs.push({ kid: k.id, x })); });
  if (!jobs.length) return;
  reviewsMaking = true;
  jobs.forEach(j => { const s = schoolFor(j.kid); s.reviewDue = (s.reviewDue || []).filter(y => y.start !== j.x.start); });   // (taken first: never made twice)
  writeData();
  try {
    let made = 0, tried = 0;
    for (const j of jobs) {
      if (daysBetween(j.x.fri, d) > 14) continue;
      for (const y of j.x.subjects) {
        tried++;
        const s = schoolOf(j.kid), f0 = folderOf(s, y.subject), f = f0 && { ...f0 }, rows = f ? topicRows(j.kid, s, f) : [];
        const sections = y.topics.map(t => { const row = rows.find(r => sameTopicTitle(r.title, t)), needs = row && row.st === "needs";
          return { topic: t, minutes: needs ? 10 : 5, focus: row && needs ? topicWeak(row.info) : [], kind: needs ? "needs_work" : row && row.st === "mastered" ? "review" : "practising" }; });
        if (await newWorksheet(j.kid, y.subject, y.topics, REVIEW_COUNT, "week_review", "review", { title: `📰 Week ${j.x.n} review`, part: `📰 Week ${j.x.n}`, sections }, false)) made++;
      }
    }
    if (tried) toast(made === tried ? `📰 ${made} week ${made === 1 ? "review is" : "reviews are"} ready in 📝 Worksheets!` : `📰 ${made} of ${tried} week reviews were made.`, 4500);
    if (made && screen === "school") render();
  } finally { reviewsMaking = false; }
}
// 📖 v191 PREVIEW: { day 0–6 (0 = Monday), time } from data.previewAt ("6|09:00" = Sunday 9 AM; "" = off)
const previewAtOf = () => { const v = data.previewAt === undefined ? "6|09:00" : data.previewAt; if (!v) return null; const [d, t] = v.split("|"); return { day: Number(d), time: t }; };
// (the date of the preview day just before the week that starts on "start" (a Monday); on or before the day before it)
function previewDateFor(start) {
  const p = previewAtOf(); if (!p) return "";
  for (let d = addDaysYmd(start, -1), i = 0; i < 7; d = addDaysYmd(d, -1), i++) if (weekdayOf(d) === p.day) return d;
  return "";
}
let previewsMaking = false;
// (a parent's device, from the preview day + time on: one preview worksheet per subject of next week)
async function maybeMakePreviews() {
  if (previewsMaking || !isParentDevice() || !aiReady() || (cloud.enabled && !cloud.ready) || hasDraft()) return;
  const p = previewAtOf(), d = dubaiNow().date, now = dubaiMinutes(); if (!p) return;
  const due = x => d > x.on || (d === x.on && now >= toMin(p.time));
  const jobs = [];
  kidsList().forEach(k => (schoolOf(k.id).previewDue || []).filter(due).forEach(x => jobs.push({ kid: k.id, x })));
  if (!jobs.length) return;
  previewsMaking = true;
  jobs.forEach(j => { const s = schoolFor(j.kid); s.previewDue = (s.previewDue || []).filter(y => y.start !== j.x.start); });   // (taken first: never made twice)
  writeData();
  try {
    let made = 0, tried = 0;
    for (const j of jobs) {
      if (d > addDaysYmd(j.x.start, 4)) continue;   // (the week is nearly over: too late for a preview)
      for (const y of j.x.subjects) {
        tried++;
        if (await newWorksheet(j.kid, y.subject, y.topics, WS_COUNT, "preview", "preview", { title: `📖 Week ${j.x.n} preview`, part: `📖 Week ${j.x.n} preview` }, false)) made++;
      }
    }
    if (tried) toast(made === tried ? `📖 ${made} next-week ${made === 1 ? "preview is" : "previews are"} ready in 📝 Worksheets!` : `📖 ${made} of ${tried} previews were made.`, 4500);
    if (made && screen === "school") render();
  } finally { previewsMaking = false; }
}
// 📝 v191 TEST COMING UP: a 📌 school date that is a test / quiz / exam / assessment, for one subject (its name is in the title or note)
const TEST_WORDS = /\b(test|quiz|exam|assessment|end of unit|unit check|spelling check|mock)\b|اختبار|امتحان/i;
function testsAhead(kid, days = 3) {
  const s = schoolOf(kid), d = dubaiNow().date, subs = subjectList(s, true);
  return Object.entries(s.events || {}).filter(([, e]) => e.date > d && e.date <= addDaysYmd(d, days) && TEST_WORDS.test(`${e.title} ${e.note || ""}`))
    .map(([id, e]) => ({ id, ...e, f: subs.find(f => new RegExp(`\\b${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(`${e.title} ${e.note || ""}`)) }))
    .filter(x => x.f);
}
// (the topics a test is about: that subject's school topics of the last 3 weeks, newest first; at most 8)
const testTopics = (s, f, date) => topicsOf(s, f.id).filter(t => t.added && t.added >= addDaysYmd(date, -21)).map(t => t.title).slice(0, 8);
let revMaking = false;
// (a parent's device: 2 days before the test, one revision worksheet on its topics; each test once)
async function maybeMakeRevisions() {
  if (revMaking || !isParentDevice() || !aiReady() || (cloud.enabled && !cloud.ready) || hasDraft()) return;
  const jobs = [];
  kidsList().forEach(k => testsAhead(k.id, 2).forEach(t => { if (!(schoolOf(k.id).revDone || []).includes(t.id)) jobs.push({ kid: k.id, t }); }));
  if (!jobs.length) return;
  revMaking = true;
  jobs.forEach(j => { const s = schoolFor(j.kid); s.revDone = [...(s.revDone || []), j.t.id].slice(-30); });
  writeData();
  try {
    let made = 0;
    for (const j of jobs) {
      const s = schoolOf(j.kid), topics = testTopics(s, j.t.f, j.t.date);
      if (!topics.length) continue;
      if (await newWorksheet(j.kid, j.t.f.name, topics, WS_COUNT, "revision", "revision", { title: `📝 ${j.t.title} revision`, part: `📝 ${j.t.title} (${dayMon(j.t.date)})` }, false)) made++;
    }
    if (made) toast(`📝 ${made} test revision ${made === 1 ? "worksheet is" : "worksheets are"} ready in 📝 Worksheets!`, 4500);
    if (made && screen === "school") render();
  } finally { revMaking = false; }
}
// 📋 v191 MISSING TOPICS: once the school week is over (Friday from 3 PM, Dubai), a note for the parents per kid: the newsletter's
// topics of that week the kid hasn't practised yet, and the ones still 🔴 weak. Kept in the kid's 🎒 School notes, and on the
// parents' home until they tap OK.
function weekGaps(kid, w) {
  const s = schoolOf(kid), out = [];
  (w.subjects || []).forEach(x => {
    const f = folderOf(s, x.subject); if (!f) return;
    const rows = topicRows(kid, s, f), not = [], weak = [];
    x.topics.forEach(t => { const r = rows.find(y => sameTopicTitle(y.title, t)); if (!r || r.st === "new") not.push(t); else if (r.st === "needs") weak.push(t); });
    if (not.length || weak.length) out.push({ subject: f.name, not, weak });
  });
  return out;
}
function maybeTellGaps() {
  if (!isParentDevice() || hasDraft()) return;
  const d = dubaiNow().date;
  let n = 0;
  kidsList().forEach(k => {
    const s0 = schoolOf(k.id), w = s0.week;
    if (!w || !w.start || s0.gapDone === w.start) return;
    const fri = addDaysYmd(w.start, 4);
    if (d < fri || (d === fri && dubaiMinutes() < REVIEW_FROM)) return;
    const gaps = weekGaps(k.id, w), s = schoolFor(k.id);
    s.gapDone = w.start; n++;
    // (one note per subject, so it shows in that subject's 🗒️ Notes in the 🎒 School file)
    gaps.forEach(g => {
      const text = `📋 ${w.label || "Week " + (w.n || "")}: ${[g.not.length ? "not practised yet: " + g.not.join(", ") : "", g.weak.length ? "still weak: " + g.weak.join(", ") : ""].filter(Boolean).join(". ")}.`;
      s.notes[newId()] = { subject: g.subject, text: text.slice(0, 1000), date: d, by: me, gap: true };
    });
  });
  if (n) writeData();
}
// (the parents' home: the unseen 📋 notes)
const gapNotes = () => !isParentId(me) || isKidDevice() ? [] : kidsList().flatMap(k => Object.entries(schoolOf(k.id).notes || {}).filter(([, n]) => n.gap && !n.seen).map(([id, n]) => ({ kid: k.id, id, n })));
function gapCardsHtml() {
  const kids = [...new Set(gapNotes().map(x => x.kid))];
  return kids.map(kid => { const list = gapNotes().filter(x => x.kid === kid);
    return `<div class="card gap-card" style="--c:${colorsOf(userById(kid)).color}"><p><b>📋 What ${safe(kidNameOf(kid))} still needs from this school week</b></p>
    ${list.map(x => `<p><b>${safe(x.n.subject)}</b>: ${safe(x.n.text.replace(/^📋 [^:]*: /, ""))}</p>`).join("")}
    <div class="btnrow"><button class="primary" data-gapws="${safe(kid)}">📝 Make worksheets on these</button><button data-gapok="${safe(kid)}">OK</button></div>
    <p class="hint">Saved in ${safe(kidNameOf(kid))}'s 🎒 School file (each subject's 🗒️ Notes).</p></div>`; }).join("");
}
const gapSeen = kid => { const s = schoolFor(kid); Object.values(s.notes).forEach(n => { if (n.gap) n.seen = true; }); };
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-gapok], [data-gapws]"); if (!b || !isParentDevice()) return;
  if (b.dataset.gapok) { gapSeen(b.dataset.gapok); writeData(); return render(); }
  // (📝 one weak-points worksheet per subject that has missing topics: the topics themselves)
  const kid = b.dataset.gapws, w = schoolOf(kid).week; if (!w) return;
  const gaps = weekGaps(kid, w);
  gapSeen(kid); writeData(); render();
  (async () => { let made = 0; for (const g of gaps) if (await newWorksheet(kid, g.subject, [...g.not, ...g.weak].slice(0, 8), WS_COUNT, "weak_points", "gapws|" + kid, { title: `📋 ${g.subject}: catch up`, part: "📋 Catch up" }, false)) made++;
    if (made) toast(`📝 ${made} catch-up ${made === 1 ? "worksheet is" : "worksheets are"} ready in ${kidNameOf(kid)}'s 📝 Worksheets!`, 4500); })();
});
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
  const stage = h("div", { class: "pdf-stage" + (opts.big ? " pdf-big" : ""), "aria-hidden": "true" }, h("div", { class: "ai-print" }, node), opts.header ? h("div", { class: "ai-print" }, opts.header) : null);
  document.body.appendChild(stage);
  try {
    await Promise.all([loadScript(JSPDF_URL, () => window.jspdf && window.jspdf.jsPDF), loadScript(HTML2CANVAS_URL, () => window.html2canvas)]);
    // The parts: each question of a list on its own, everything else as it is
    const sheet = node, parts = [];
    [...sheet.children].forEach(el => { if (el.matches("ol, ul") && el.children.length) parts.push(...el.children); else parts.push(el); });
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), W = 210, H = 297, M = 12, FOOT = 10, GAP = opts.big ? 0.8 : 2.5;   // (📄 worksheets: the questions close together)
    const mmPerPx = (W - 2 * M) / sheet.getBoundingClientRect().width;
    // The header on every page (drawn once, put on each page)
    let head = null;
    if (opts.header) {
      const hc = await window.html2canvas(opts.header, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true }), r = opts.header.getBoundingClientRect();
      head = { url: hc.toDataURL("image/jpeg", 0.92), w: r.width * mmPerPx, h: r.height * mmPerPx };
    }
    const top = () => { if (!head) return M; pdf.addImage(head.url, "JPEG", M, M, head.w, head.h); return M + head.h + GAP; };
    const room = H - M - FOOT - M - (head ? head.h + GAP : 0), roomPx = room / mmPerPx, firstY = head ? M + head.h + GAP : M;
    const place = async el => {   // one part on the page (a new page when it doesn't fit)
      const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      let w = el.getBoundingClientRect().width * mmPerPx, hgt = el.getBoundingClientRect().height * mmPerPx;
      if (hgt > room) { w *= room / hgt; hgt = room; }   // (a very tall part: made smaller to fit one page)
      if (y + hgt > H - M - FOOT && y > firstY) { pdf.addPage(); y = top(); }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, y, w, hgt);
      y += hgt + GAP;
    };
    let y = top();
    for (let i = 0; i < parts.length; i++) {
      const el = parts[i];
      if (el.classList && el.classList.contains("pdf-break")) { if (y > firstY) { pdf.addPage(); y = top(); } continue; }   // (✏️ the answer sheet: a new page)
      if (!el.getBoundingClientRect().height) continue;
      // 📏 a section bar never sits alone at the bottom: it goes to the next page with its first question
      const nx = parts[i + 1];
      if (el.classList && (el.classList.contains("ws-bar") || el.classList.contains("ws-sec")) && nx && nx.getBoundingClientRect) {
        const both = (el.getBoundingClientRect().height + nx.getBoundingClientRect().height) * mmPerPx + GAP;
        if (y + both > H - M - FOOT && y > firstY) { pdf.addPage(); y = top(); }
      }
      // ✏️ the answer sheet: its own size (v178: no longer stretched to fill the page: Broo2a found the spaces too big),
      // and when it's too long it goes on over more pages.
      if (el.classList && el.classList.contains("ws-answers")) {
        if (el.getBoundingClientRect().height <= roomPx + 1) { await place(el); continue; }
        // (v157: no squeezing at all. A long answer sheet simply goes on over more pages, with BIG writing space)
        for (const pg of splitAnswerSheet(el, roomPx)) { if (y > firstY) { pdf.addPage(); y = top(); } await place(pg); }
        continue;
      }
      // (the "Now write your answers on the ANSWER SHEET" note never gets a page of its own)
      if (el.classList && el.classList.contains("ws-to-sheet") && y + el.getBoundingClientRect().height * mmPerPx > H - M - FOOT) continue;
      await place(el);
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
// ✏️ A long answer sheet → several full-size pages (the header on each; the questions in order; the score on the last)
function splitAnswerSheet(el, roomPx) {
  const grid = el.querySelector(".as-grid"), total = el.querySelector(".ws-total"), headNode = el.firstElementChild;
  const cells = [...grid.children], pages = [el];
  grid.innerHTML = "";
  if (total) total.remove();
  let page = el, g = grid;
  for (const c of cells) {
    g.appendChild(c);
    if (page.getBoundingClientRect().height > roomPx + 8 && g.children.length > 1) {   // (+8px: a hair smaller is fine)
      c.remove();
      const bar = g.lastElementChild && g.lastElementChild.classList.contains("as-bar") && g.children.length > 1 ? g.lastElementChild : null;   // (a section bar goes with its question)
      if (bar) bar.remove();
      page = el.cloneNode(false); page.append(headNode.cloneNode(true), g = grid.cloneNode(false));
      if (bar) g.appendChild(bar);
      page.firstElementChild.querySelector("b") && (page.firstElementChild.querySelector("b").textContent = "Answer sheet (continued)");
      pages[pages.length - 1].after(page); pages.push(page);
      g.appendChild(c);
    }
  }
  if (total) { page.appendChild(total); if (page.getBoundingClientRect().height > roomPx) { total.remove();
    const last = el.cloneNode(false); last.append(total); page.after(last); pages.push(last); } }
  if (pages.length > 1) { const ins = el.querySelector(".ws-ins"); if (ins) ins.textContent = `Write the LETTER of your answer in the box. Write the other answers in the spaces. Take a clear photo of each answer page (${pages.filter(x => x.querySelector(".as-grid")).length} pages).`; }
  return pages;
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
// 📄 The questions (compact) + ✏️ the ANSWER SHEET on its own last page
const worksheetPdf = w => { const node = wsSheetNode(w, false, true);
  node.append(h("div", { class: "pdf-break" }), wsAnswerSheetNode(w));
  return makePdf(node, pdfName(kidNameOf(w.kid), w.subject, w.title), { big: true }); };
const answerKeyPdf = w => makePdf(wsKeyNode(w), pdfName(kidNameOf(w.kid), w.subject, `${w.title} answer key`), { big: true });   // 🔑 (only the answers)
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
  // 🔢 v191: the kid picks 10 or 15 questions (15 when nothing was picked before)
  const pickN = [10, 15].includes(count) ? count : WS_COUNT;
  $("wsoCount").replaceChildren(...[10, 15].map(n => h("label", null, h("input", { type: "radio", name: "wsoN", value: n, checked: n === pickN }), h("span", null, `${n} questions`))),
    h("p", { class: "hint", style: "flex-basis:100%;margin:0" }, `At ${kidNameOf(kid)}'s level.`));
  $("wsoErr").textContent = aiReady() ? "" : "🔌 " + AI_OFF + ".";
  $("wsoTr").innerHTML = wsPickHtml(kid, subject) + wsWordsHtml(kid, subject) + translateToggleHtml(kid, subject);   // 🌐 (remembered for this kid)
  $("aiWsModal").hidden = false;
  $("wsoMake").focus();
}
function closeWsOpts() { $("aiWsModal").hidden = true; wso = null; }
// From a School work card (all its topics) or one topic chip
function wsFromWork(v) {
  const [wid, i] = v.split("|"), w = schoolOf(schoolKid).work[wid];
  if (!w) return;
  const topics = i !== undefined ? [w.topics[Number(i)]].filter(Boolean) : w.topics.length ? w.topics : [w.title];
  openWsOpts(schoolKid, w.subject, topics, WS_COUNT, wid, w.title);
}
async function makeWorksheet() {
  const o = wso;
  if (!o) return;
  const topics = [...$("wsoTopics").querySelectorAll("input:checked")].map(x => o.topics[Number(x.value)]).filter(Boolean);
  if (!topics.length) return $("wsoErr").textContent = "Please tick at least one topic.";
  const picked = $("wsoCount").querySelector("input[name=wsoN]:checked"), count = picked && [10, 15].includes(Number(picked.value)) ? Number(picked.value) : WS_COUNT;
  $("wsoErr").textContent = "";
  const mode = pickMode(o.kid, o.subject);   // 🔁 practice, or 🚀 challenge when it's going very well
  const r = await callAi("worksheet", { ...kidInfo(o.kid), subject: o.subject, topics, count,
                                        notes: (MODE_NOTES[mode] ? MODE_NOTES[mode] + "." : "") + ` Exactly ${count} questions.` + wsKidNote(o.kid, o.subject, mode) + wsSummaryNote(o.kid, o.subject, topics), mode, profile: profileText(o.kid, o.subject), ...schoolSystemOf(o.kid),
                                        ...learnBody(o.kid, o.subject), ...langBody(o.kid, o.subject) }, "worksheet");   // (🧠 level, skills, focus · 🇦🇪 / 🌐)
  if (!r) return;
  const ws = wsExamOrder(cleanWorksheet({ ...r, key_words: wsKeyWordsFor(r, o.kid, o.subject), kid: o.kid, subject: o.subject, topics, count, date: todayYmd(), by: me, at: new Date().toISOString(), purpose: mode,
                              ...(isArabicSubject(o.subject) ? { lang: "ar" } : {}),
                              answers: [], ...(wsBandOf(o.kid, o.subject, mode) !== "normal" ? { pick: wsBandOf(o.kid, o.subject, mode) } : {}),
                              ...(learnRead(o.kid, o.subject) ? { lvl: levelNow(learnRead(o.kid, o.subject)) } : {}), ...(o.work ? { work: o.work } : {}), ...(o.part ? { part: o.part } : {}) }));
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
// compact (📄 the PDF): small, no writing lines, choices with letters A B C …: the kid answers on the ✏️ ANSWER SHEET (the last page)
const OPT_LETTERS = "ABCDEFGHIJ";
const isChoiceQ = q => q.options.length > 0 && q.kind !== "matching" && q.kind !== "ordering";
// 🔢 Put in order (the PDF): each step has a letter; on the answer sheet the kid writes the letters in order (1st, 2nd …).
// The key: the letters in the right order, from the answer's steps (split on ";" or new lines). Not found → null.
const isOrderQ = q => q.kind === "ordering" && q.options.length > 1;
function orderKey(q) {
  const steps = String(q.answer || "").split(/\s*[;\n]\s*/).filter(x => optNorm(x));
  if (steps.length !== q.options.length) return null;
  const idx = steps.map(st => optFind(q.options, st));
  return idx.some(i => i < 0) || new Set(idx).size !== idx.length ? null : idx.map(i => OPT_LETTERS[i] || String(i + 1));
}
// 🔤 Which choice is the answer? Same text first ("30cm" = "30 cm" = "A) 30 cm"), then an answer that is only a letter ("B", "B)"),
// then a near match only when exactly ONE choice fits (never guess between two). Not found → -1.
const optNorm = x => String(x || "").toLowerCase().replace(/^\s*\(?[a-j]\s*[).:\-]\s+|^\s*\(?[a-j]\)\s*/, "").replace(/[^\p{L}\p{N}]+/gu, "");
// (the same text WITH its punctuation: for choices that differ only in commas or speech marks, e.g. where the "…" go)
const optExact = x => String(x || "").replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
function optFind(opts, ans) {
  const a = optNorm(ans), o = opts.map(optNorm);
  const ex = opts.map(optExact).reduce((l, x, k) => x && x === optExact(ans) ? [...l, k] : l, []);
  if (ex.length === 1) return ex[0];
  const same = o.reduce((l, x, k) => a && x === a ? [...l, k] : l, []);
  if (same.length > 1) return -1;   // (only the punctuation tells them apart, and it doesn't match exactly: don't guess)
  let i = same.length ? same[0] : -1;
  if (i >= 0) return i;
  const L = String(ans || "").trim().match(/^\(?([A-Ja-j])(?:\)|\.|:|$)/);
  if (L) { i = OPT_LETTERS.indexOf(L[1].toUpperCase()); if (i < opts.length) return i; }
  if (!a) return -1;
  const near = o.map((x, k) => x && (x.startsWith(a) || a.startsWith(x) || x.includes(a)) ? k : -1).filter(k => k >= 0);
  if (near.length === 1) return near[0];
  const big = Math.max(...near.map(k => o[k].length), 0), top = near.filter(k => o[k].length === big);   // ("300 cm": "300", not "30")
  return near.length && top.length === 1 ? top[0] : -1;
}
// 📝 v155 "Clean exam" (Broo2a picked templates A + C): every worksheet = Section A choose (multiple choice, true / false, put in order,
//   matching) → Section B short answer (fill the gap, short answers) → Section C explain (3+ writing lines). Q1, Q2 … through the
//   whole paper, choices A) B) C) D), marks in [brackets], a section bar with its marks, a header box (Name · Date · Time · Total),
//   an instructions box, and the ANSWER SHEET with the same sections (circles for choose, boxes for the rest).
const WS_PARTS = { A: "Choose the answer", B: "Short answer", C: "Explain" };
const wsPartOf = q => isChoiceQ(q) || isOrderQ(q) || q.kind === "matching" ? "A" : (q.answer_lines || 0) >= 3 ? "C" : "B";
const marksText = n => `[${num(n)}]`;
// A NEW worksheet (never one with answers already): put the questions in A → B → C order and number them 1, 2, 3 …
// (a study session's sheet with topic parts keeps its order: its parts are in order already)
// 🛡️ A NEW worksheet's guard (never an old one: its paper may be printed already): a choice question whose answer isn't one of its
// choices (or with fewer than 2 different choices), or a matching question that can't be drawn in two columns, becomes a question
// the child answers in writing (the answer stays the key), so the paper, the answer sheet and the check always agree.
function wsGuard(ws) {
  if (!ws || !Array.isArray(ws.questions)) return ws;
  ws.questions = ws.questions.map(q => {
    const write = () => ({ ...q, kind: "short_answer", options: [], answer_lines: Math.max(q.answer_lines || 0, 2) });
    if (q.kind === "multiple_choice" || q.kind === "true_false") {
      const opts = q.options.filter((o, k) => q.options.findIndex(x => optExact(x) === optExact(o)) === k);
      if (opts.length < 2 || optFind(opts, q.answer) < 0) return write();
      return opts.length === q.options.length ? q : { ...q, options: opts };
    }
    if (q.kind === "matching" && !matchCols(q, isArabicWs(ws))) return write();
    return q;
  });
  return ws;
}
function wsExamOrder(ws) {
  ws = wsGuard(ws);
  if (!ws || (ws.sections && ws.sections.length)) return ws;
  const rank = { A: 0, B: 1, C: 2 };
  ws.questions = ws.questions.map((q, i) => ({ q, i })).sort((a, b) => rank[wsPartOf(a.q)] - rank[wsPartOf(b.q)] || a.i - b.i)
    .map(({ q }, i) => ({ ...q, number: i + 1 }));
  return ws;
}
// The section bars: a new bar each time the part changes (only when the sheet has no topic parts). → { number: [letter, marks] }
function wsPartBars(w) {
  if (w.sections && w.sections.length) return {};
  const out = {}; let cur = null, first = null, n = 0;
  const end = () => { if (first != null) out[first] = [cur, n]; };
  w.questions.forEach(q => { const p = wsPartOf(q); if (p !== cur) { end(); cur = p; first = q.number; n = 0; } n += q.points; });
  end();
  const letters = Object.keys(out).length;
  return letters > 1 || w.questions.length > 3 ? out : {};
}
const wsBarNode = (bar, short) => h("div", { class: "ws-part" }, h("span", null, short ? `Section ${bar[0]}` : `Section ${bar[0]} · ${WS_PARTS[bar[0]]}`), h("span", null, short ? marksText(bar[1]) : `[${num(bar[1])} ${bar[1] === 1 ? "mark" : "marks"}]`));
const wsBoxHead = (w, sheet) => h("div", { class: "ws-hbox", dir: "ltr" },
  h("div", { class: "ws-htop" }, h("b", null, sheet ? "Answer sheet" : w.title), h("small", null, sheet ? w.title : [gradeOf(w.kid), w.subject].filter(Boolean).join(" · "))),
  h("div", { class: "ws-hgrid" }, h("span", null, "Name: ", h("u", null, kidNameOf(w.kid))), h("span", null, "Date: ", h("u", null, wsDateText(w.date))),
    sheet ? null : h("span", null, "Time: ", h("u", null, w.minutes ? `${w.minutes} min` : "______")),
    sheet ? null : h("span", null, "Total: ", h("u", null, `____ / ${num(wsTotal(w))}`))));
// ✅ How the AI marks written answers (sent with every check): right only when the MEANING is right (any words), wrong = 0, spelling never costs marks (but is shown)
const CHECK_RULES = "MARKING RULES for written answers (short answer, fill in, explain): be a fair teacher who judges the MEANING, in every subject (science, physics, English, maths, social studies …). An answer is RIGHT when its meaning is correct and answers the question: the child may use their own words, simple sentences, an example, a synonym or a different correct way of saying it. Never ask for the exact words of the key: if a real teacher would give the mark, it is RIGHT. An answer whose idea is wrong, off-topic, missing or only guessed is WRONG with 0 points, even if it uses some words from the key. Do not give points for wrong answers. FULL SENTENCES: if the question asks for one word or part (a pronoun, a noun, a verb, a number, a name …) and the child writes a whole sentence, look INSIDE the sentence: when the right word is there and clearly used as the answer (for example underlined, circled, or the sentence copies the original one with the right word in it), it is RIGHT. Only mark it wrong when the right word is missing, or the child also gives a wrong answer for the same thing. Never mark an answer wrong only because of its form (a sentence instead of one word, capital letters, no full stop). SPELLING: never take marks off for spelling or grammar when the meaning is right (unless the question itself is about spelling), but in the note of that question add 'Spelling: wrong word → right word' for each misspelled science or key word, so the child can learn it.";
const MARK_EXPLAIN = "Right only when the meaning is correct (the key ideas, in any words). A wrong idea is wrong: 0 points.";
const MARK_SHORT = "Right when the meaning is correct (other words or a spelling mistake are fine). A wrong answer is wrong: 0 points.";
// A question with parts "a) … b) … c) …" (or "(a)", "a." at a line start, "i) ii)") → ["a", "b", "c"]  ([] when it has no parts)
function qPartsOf(text) {
  const t = String(text || ""), found = [];
  for (const m of t.matchAll(/(?:^|[\s(\n])\(?([a-h]|i{1,3}|iv|v)[).](?=\s)/gim)) { const k = m[1].toLowerCase(); if (!found.includes(k)) found.push(k); }
  const abc = found.filter(k => /^[a-h]$/.test(k)), rom = found.filter(k => /^(i{1,3}|iv|v)$/.test(k));
  const run = list => list.length >= 2 && list[0] === (list === abc ? "a" : "i") ? list : [];
  return run(abc).length ? abc : run(rom);
}
// ✍️ For every kid (answer sheet + before uploading): clear writing and a good photo → the checker reads it right
const HAND_TIP = "✍️ Write clearly and big, with a dark pen or pencil. 📸 Take the photo in good light, straight from above, with the whole page in it.";
const SOLVE_Q = /\b(solve|work out|calculate|show (your )?work|how many|how much|explain|why|describe|find the)\b|\d\s*[+\-×x÷*/]\s*\d/i;
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
function wsSheetNode(w, showAns, compact = false) {
  const rtl = isArabicWs(w), bars = wsPartBars(w);
  return h("div", { class: "ws-sheet ws-exam" + (rtl ? " ws-rtl" : "") + (compact ? " ws-compact" : ""), dir: rtl ? "rtl" : null, lang: rtl ? "ar" : null },
    wsBoxHead(w),
    w.topics.length ? h("div", { class: "ws-sub" }, w.topics.join(", ")) : null,
    h("div", { class: "ws-ins" }, compact ? "Answer all the questions. Write your answers on the ANSWER SHEET (the last page): for a choose question, write the letter (A, B, C or D) in the box. Marks are shown in [brackets]."
      : "Answer all the questions. Marks are shown in [brackets]."),
    w.intro ? h("p", { class: "ws-intro" }, w.intro) : null,
    wsKeyBoxNode(w, rtl),
    h("ol", { class: "ws-qs" }, w.questions.flatMap(q => { const match = matchNode(q, rtl, showAns);   // (🔗 matching: the 2-column table)
      return [   // (📚 each part's title above its first question · or the exam's section bar)
      ...(w.sections || []).filter(x => x.from === q.number && (x.title || x.topic)).map(x => h("li", { class: "ws-sec" }, x.title || x.topic)),
      ...(bars[q.number] ? [h("li", { class: "ws-bar" }, wsBarNode(bars[q.number]))] : []), h("li", { class: "ws-q" },
      h("span", { class: "ws-num" }, `Q${q.number}`),
      h("div", null,
        h("div", { class: "ws-prompt" }, q.prompt),
        q.question_ar && !rtl ? h("div", { class: "ws-ar", dir: "rtl", lang: "ar" }, q.question_ar) : null,
        q.picture && typeof wsPicNode === "function" ? wsPicNode(q.picture) : null,   // (🖼️)
        match || (q.options.length ? h("ul", { class: "ws-opts" }, q.options.map((o, i) => h("li", { class: "ws-opt" },
          (isChoiceQ(q) || isOrderQ(q)) ? h("b", { class: "ws-letter" }, `${OPT_LETTERS[i] || i + 1})`)
            : h("span", { class: "ws-circle" + (q.kind === "ordering" || q.kind === "matching" ? " ws-box" : "") }), h("span", null, o)))) : null),
        isOrderQ(q) ? h("div", { class: "ws-to-order" }, compact ? "On the answer sheet: write the letters in the right order (1st, 2nd, 3rd …)." : "Write the letters in the right order (1st, 2nd, 3rd …).") : null,
        match || compact ? null : Array.from({ length: q.answer_lines }, () => h("div", { class: "ws-line" })),
        showAns && !match ? h("div", { class: "ws-ans" }, "✓ " + (q.answer || "—")) : null),
      h("span", { class: "ws-pts" }, marksText(q.points)))]; })),
    compact ? h("div", { class: "ws-to-sheet" }, "Now write your answers on the ANSWER SHEET (the last page).")
      : h("div", { class: "ws-total" }, "Total: ", h("i"), ` / ${num(wsTotal(w))}`));
}
// ✏️ The ANSWER SHEET (the PDF's last page, always ONE page): each question's number + bubbles (choices), boxes (matching,
// ordering) or 1–3 lines. The kid uploads only this page → fewer photos for ✅ Check now.
function wsAnswerSheetNode(w) {
  const rtl = isArabicWs(w), bars = wsPartBars(w);
  const cell = q => {
    const n = h("b", { class: "as-num" }, `Q${q.number}`);
    // (🔤 v178: a box to WRITE the letter of the answer, no circles: Broo2a's choice, easier to read than filled circles)
    if (isChoiceQ(q)) return h("div", { class: "as-q" }, n, h("span", { class: "as-pair as-choice" }, h("i", { class: "as-box" }),
      h("small", { class: "as-of" }, `(A–${OPT_LETTERS[q.options.length - 1] || q.options.length})`)));
    if (q.kind === "matching") { const m = matchCols(q, rtl), k = m ? m.left.length : q.options.length;
      // (🔗 a small table: the numbers of column 1 on top, an empty box under each for the letter from column 2)
      const L = (m ? m.letters : MATCH_LETTERS[rtl ? "ar" : "en"]).slice(0, 3).join(rtl ? "، " : ", ");
      return h("div", { class: "as-q as-wide" }, n, h("div", null,
        h("div", { class: "as-how" }, rtl ? `اكتب الحرف (${L} …) تحت كل رقم:` : `Write the letter (${L} …) under each number:`),
        h("table", { class: "as-mtab" }, h("tbody", null,
          h("tr", null, Array.from({ length: k }, (_, i) => h("th", null, String(i + 1)))),
          h("tr", null, Array.from({ length: k }, () => h("td", null))))))); }
    if (q.kind === "ordering") return h("div", { class: "as-q as-wide" }, n, h("div", null,
      h("div", { class: "as-how" }, "Write the letters in order:"),
      h("span", { class: "as-bubbles" }, q.options.map((_, i) => h("span", { class: "as-pair" }, ORDINALS[i] || `${i + 1}.`, h("i", { class: "as-box" }))))));
    // (✍️ room to write: 🅲 explain = 4 lines · a problem to solve = 3 · a short answer = 2)
    // ✍️ v157 lots of room: explain 5 lines · a problem to solve 4 · a short answer 3 · a question with parts a), b), c): each part its own space
    // (v161: the BIG room only for explain questions; a problem to solve 3 lines, a short answer 2 lines in 2 columns)
    // (v178 shorter, Broo2a: explain 3 lines · a problem to solve 2 · a short answer 1 · each part a) b) 2)
    const lines = wsPartOf(q) === "C" ? 3 : SOLVE_Q.test(q.prompt || "") ? 2 : 1, parts = qPartsOf(q.prompt);
    const lineBox = k => h("div", { class: "as-lines" }, Array.from({ length: k }, () => h("div", { class: "as-line" })));
    // (each part is its own row, so a long question can go on over the next page)
    if (parts.length > 1) return parts.map((p, i) => h("div", { class: "as-q as-wide as-part" + (i ? " as-pnext" : "") },
      h("b", { class: "as-num" }, `Q${q.number} ${p})`), lineBox(2)));
    return h("div", { class: "as-q " + (wsPartOf(q) === "C" || lines > 1 ? "as-wide as-c" : "as-s") }, n, lineBox(lines));
  };
  return h("div", { class: "ws-sheet ws-answers ws-exam" + (rtl ? " ws-rtl" : ""), dir: rtl ? "rtl" : null, lang: rtl ? "ar" : null },
    wsBoxHead(w, true),
    h("div", { class: "ws-ins" }, "Write the LETTER of your answer in the box. Write the other answers in the spaces. Take ONE clear photo of this page."),
    h("div", { class: "ws-hand" }, HAND_TIP),
    h("div", { class: "as-grid" }, w.questions.flatMap(q => [...(bars[q.number] ? [h("div", { class: "as-bar" }, wsBarNode(bars[q.number], true))] : []), ...[cell(q)].flat()])),
    h("div", { class: "ws-total" }, "Score: ", h("i"), ` / ${num(wsTotal(w))}`));
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
// 🔑 v191 Key words box on the paper (a hint): the lesson's words to use in the answers
function wsKeyBoxNode(w, rtl) {
  const k = w.key_words || [];
  if (!k.length || w.kwOff) return null;
  return h("div", { class: "ws-keybox" }, h("b", null, rtl ? "🔑 كلمات مفتاحية: استخدمها في إجاباتك" : "🔑 Key words: use them in your answers"),
    h("div", { class: "ws-keywords" }, k.join("  ·  ")));
}
// (parents only, above the paper: one tick box, the key words box on this worksheet or not)
function wsKeyEditNode(w, id) {
  if (!(w.key_words || []).length) return null;
  return h("label", { class: "card ws-keyedit ai-narrow" }, h("input", { type: "checkbox", checked: !w.kwOff, data: { kwtick: id } }),
    h("span", null, h("b", null, "🔑 Key words box"), " on this worksheet: the kids use these words in their answers"));
}
document.addEventListener("change", e => {
  const b = e.target.closest && e.target.closest("[data-kwtick]");
  if (!b || !isDadNow()) return;
  const id = b.dataset.kwtick, w = aiDocs.worksheets[id];
  if (!w) return;
  const doc = { ...w }; if (b.checked) delete doc.kwOff; else doc.kwOff = true;
  aiSave("worksheets", id, doc);
  render();
});
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
      h("button", { data: { aireport: "worksheet|" + id } }, "🚩 Report"),
      isDad ? h("button", { class: "danger-text", data: { wsact: "delete" } }, "🗑️ Delete") : null),
    wsLevelNode(w),
    isDad ? wsKeyEditNode(w, id) : null,
    wsSheetNode(w, show),
    // ✅ Upload the answers → 🤖 Check
    h("div", { class: "card bd-card ai-narrow" },
      h("div", { class: "sc-head" }, h("h2", null, done ? "✅ Checked" : "✅ Finished? Check it!"), h("span", { class: "ai-status " + (done ? "done" : files.length ? "up" : "") }, w.status)),
      done ? resultNode(w) : h("p", { class: "hint" }, files.length
        ? "The answers are uploaded. Tap ✅ Check now!"
        : "Do the worksheet on paper, then upload a photo (or PDF) of your answers."),
      done || files.length ? null : h("p", { class: "ws-hand" }, HAND_TIP),
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
      aiFailFor("check|" + id) ? h("p", { class: "ai-failnote" }, aiFailFor("check|" + id)) : null,   // (⚠️ why the last check didn't work)
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
    h("div", { class: "mist-head", dir: "ltr" }, h("b", null, q.points > 0 ? `🟡 Almost! ${i + 1} of ${wrong.length}` : `❌ Mistake ${i + 1} of ${wrong.length}`),
      h("small", null, `Question ${q.number}${q.points > 0 && wq.points ? ` · ${num(q.points)}/${num(wq.points)}` : ""}`)),
    h("p", { class: "mist-q" }, wq.prompt || `Question ${q.number}`),
    wq.question_ar && !rtl ? h("p", { class: "ws-ar", dir: "rtl", lang: "ar" }, wq.question_ar) : null,
    wq.picture && typeof wsPicNode === "function" ? wsPicNode(wq.picture) : null,
    h("div", { class: "mist-row bad" }, h("span", null, "Your answer"), h("b", null, q.your_answer || "—")),
    h("div", { class: "mist-row ok" }, h("span", null, "Correct answer"), h("b", null, wq.answer || "—")),
    q.explanation || q.note ? h("p", { class: "mist-why" }, "💡 " + (q.explanation || q.note)) : null,
    q.fixed ? h("p", { class: "ws-fixed" }, `✓ Checked by ${fixerName(q)}`)
      : isParentDevice() ? null : q.ask ? h("p", { class: "ws-fixed" }, `⏳ ${askNames(q)} will check this answer`)
      : askButtonsNode(q.number),
    h("div", { class: "btnrow", dir: "ltr" },
      i < wrong.length - 1 ? h("button", { class: "primary", data: { wsact: "mistnext" } }, `Next mistake ➡️ (${i + 2} of ${wrong.length})`) : null,
      h("button", { data: { wsact: "mistdone" } }, "Done")));
}
// ✏️ Words to spell right (from the check notes "Spelling: wrong → right"): shown with the result; no marks were taken off
const spellsOf = c => c.questions.flatMap(q => [...String(q.note || "").replace(/->/g, "→").matchAll(/Spelling:\s*([^.;\n]+)/gi)].flatMap(m => m[1].split(/,\s*(?=[^,]*→)/)))
  .map(x => x.trim()).filter(x => x.includes("→")).filter((x, i, a) => a.indexOf(x) === i).slice(0, 12);
function spellingNode(c) {
  const list = spellsOf(c);
  return list.length ? h("div", { class: "card spell-card" }, h("b", null, "✏️ Spelling to practise"), h("small", null, "No marks were taken off. Learn these words:"),
    h("ul", null, list.map(x => { const [bad, good] = x.split("→").map(t => t.trim()); return h("li", null, h("s", null, bad), " → ", h("b", null, good)); }))) : null;
}
// 🎚️ The worksheet's level (chosen by the parents) + ⭐ the Hard bonus (a kid's own extra worksheet)
const HARD_BONUS = 5;
function wsLevelNode(w) {
  const k = w.pick || "normal", name = { easy: "Easy", normal: "Normal", hard: "Hard" }[k];
  if (["placement", "level_check"].includes(w.purpose)) return null;
  return h("div", { class: "card ws-level ws-level-" + k }, h("b", null, w.lvl ? `🎚️ Level ${w.lvl}/10 · ${name}` : `🎚️ Level: ${name}`), h("span", null, w.pick && !w.lvl ? " · chosen by your parents" : ""),
    k === "hard" && isFreeStudy(w) && !w.check ? h("p", null, `⭐ Bonus! Get 50% or more on this Hard worksheet for +${HARD_BONUS} extra points.`) : null);
}
// 🚀 After a good mark (85%+): go up a level for more points (the parents choose it) · ⭐ the Hard bonus that came
function levelUpNode(w, pct) {
  const k = w.pick || "normal";
  if (["placement", "level_check"].includes(w.purpose)) return null;
  if (k === "hard") return pct >= 50 && isFreeStudy(w) ? h("p", { class: "ai-note ws-lvl-tip" }, `⭐ Hard level bonus: +${HARD_BONUS} points!`) : null;
  const lv = levelNow(learnRead(w.kid, w.subject));
  if (pct < 85 || wsPickOf(w.kid, w.subject) !== k || lv >= 10) return null;
  return h("p", { class: "ai-note ws-lvl-tip" }, isParentDevice() ? `🚀 ${kidNameOf(w.kid)} got ${pct}%! Time to move the ${w.subject} level up to ${lv + 1}? (🎚️ Worksheet level)`
    : `🚀 Great mark! You're ready for harder work. Ask your parents to move your ${w.subject} level up${k === "normal" && lv >= 6 ? ": Hard worksheets give bonus points!" : " to earn more points!"}`);
}
// The score big, the notes, then the mistakes one by one (parents: "See all answers" for ✓ / ✗ on every question)
function resultNode(w) {
  const c = w.check, most = Object.fromEntries(w.questions.map(q => [q.number, q.points])), pct = Math.round(c.score / c.max_score * 100), parent = isParentDevice();
  return h("div", null,
    h("div", { class: "ai-score" }, `${num(c.score)} / ${num(c.max_score)}`, h("small", null, `${pct}%`)),
    c.overall_note ? h("p", { class: "ai-note" }, c.overall_note) : null,
    levelUpNode(w, pct),
    c.dadNote ? h("p", { class: "ai-note dad" }, `${userById(DAD).emoji} ${dadName()}: ${c.dadNote}`) : null,
    c.strong_points && c.strong_points.length ? h("p", { class: "ai-note" }, "Strong: " + c.strong_points.join(" · ")) : null,
    c.weak_points && c.weak_points.length ? h("p", { class: "ai-note" }, "Practise: " + c.weak_points.join(" · ")) : null,
    c.coach_tip ? h("p", { class: "ai-note" }, "Coach tip: " + c.coach_tip) : null,
    spellingNode(c),
    c.questions.length ? mistakesNode(w, c) : null,
    parent && c.questions.length ? h("div", { class: "btnrow" }, h("button", { data: { wsact: "allans" }, "aria-expanded": String(wsAllAns) }, wsAllAns ? "Hide all answers" : "📋 See all answers")) : null,
    fixedNode(c),
    parent && wsAllAns && c.questions.length ? h("ul", { class: "list" }, c.questions.map(q => h("li", { class: q.ask && !q.fixed ? "ws-asked" : null },
      h("span", { class: "ai-mk " + (q.correct ? "ok" : "no"), "aria-label": q.correct ? "Right" : q.points > 0 ? "Part marks" : "Not right yet" }, q.correct ? "✓" : q.points > 0 ? "🟡" : "✗"),
      h("div", { class: "what" }, `Question ${q.number}`,
        h("small", null, `${q.ask && !q.fixed ? `🙋 ${kidNameOf(w.kid)} asks ${askedMe(q) ? "you" : askNames(q)} to check this · ` : ""}${num(q.points)}${most[q.number] != null ? "/" + num(most[q.number]) : ""} pts${q.your_answer ? ` · wrote: ${q.your_answer}` : ""}${q.note ? " · " + q.note : ""}${q.fixed ? ` · ✓ changed by ${q.fixedBy === me ? "you" : fixerName(q)}` : ""}`),
        partMarksNode(q, most[q.number])),
      h("button", { class: "pill", data: { wsqfix: `${q.number}|${q.correct ? "wrong" : "right"}` } }, q.correct ? "Mark wrong" : "Mark right")))) : null);
}
// 👨‍👩‍👧 What a parent changed (the kid sees it too): "✓ Dad checked Q4: right"
function fixedNode(c) {
  const list = c.questions.filter(q => q.fixed);
  return list.length ? h("p", { class: "ai-note ws-fixed" }, list.map(q => `✓ ${fixerName(q)} checked Q${q.number}: ${q.fixed === "part" ? `${num(q.points)} ${q.points === 1 ? "point" : "points"} (part marks)` : q.fixed === "right" ? "right" : "wrong"}`).join(" · ")) : null;
}
// 🟡 v188: PART MARKS (Broo2a): a parent gives some of a question's points ("Part marks: 1 · 2 …"), for a question worth 2 or more
// (the buttons are the points between 0 and full: 0 = Mark wrong, full = Mark right)
function partMarksNode(q, full) {
  const top = Math.ceil(Number(full) || 0) - 1;
  if (top < 1) return null;
  const vals = Array.from({ length: Math.min(top, 9) }, (_, k) => k + 1);
  return h("div", { class: "ws-partrow" }, h("span", null, `Part marks (out of ${num(full)}):`),
    vals.map(v => h("button", { class: "pill" + (q.fixed === "part" && q.points === v ? " on" : ""), data: { wsqfix: `${q.number}|part:${v}` },
      "aria-label": `Give ${v} of ${num(full)} points` }, `${v}`)));
}
// ✓ / ✗ A parent marks ONE question right or wrong (the AI's check stays as it is everywhere else) → the score, %, mark and learning update
function fixQuestion(wsId, number, to) {
  const w = aiDocs.worksheets[wsId];
  if (!w || !w.check || !isParentDevice()) return;
  const wq = w.questions.find(x => x.number === number), full = wq ? wq.points : 0;
  const qs = w.check.questions.map(q => ({ ...q })), q = qs.find(x => x.number === number);
  if (!q) return;
  const part = /^part:/.test(to) ? Math.max(0, Math.min(full, Number(to.slice(5)) || 0)) : null;   // (🟡 part marks: "part:2" → 2 points)
  if (part != null && (part <= 0 || part >= full)) to = part >= full ? "right" : "wrong";
  const pts = to === "right" ? full : part != null && to.startsWith("part") ? part : 0;
  if (to.startsWith("part")) to = "part";
  const score = Math.max(0, Math.min(w.check.max_score, w.check.score + pts - (q.points || 0)));
  Object.assign(q, { correct: to === "right", points: pts, fixed: to, fixedBy: me });
  delete q.ask; delete q.askTo;
  const c = { ...w.check, questions: qs, score };
  aiSave("worksheets", wsId, { ...w, check: c, status: "Checked ✓" });
  learnAfterCheck(w, c, wsId);   // 🧠 (its % in the history)
  saveWsMark(w.kid, wsId, w, c);
  schoolFresh = true;
  render();
  toast(`✓ Q${number} is now ${to === "part" ? `${num(pts)} of ${num(full)} points` : to}. Score: ${num(score)} / ${num(c.max_score)}`, 3000);
}
// 🙋 A kid asks a parent to check one answer (the parent sees it in "Needs you")
// (to = one parent's id, or "all": the kid picks who checks it)
function askQuestion(wsId, number, to) {
  const w = aiDocs.worksheets[wsId];
  if (!w || !w.check) return;
  const ids = to && to !== "all" && isParentId(to) ? [to] : parentsList().map(u => u.id);
  const qs = w.check.questions.map(q => q.number === number ? { ...q, ask: true, askTo: ids } : q);
  aiSave("worksheets", wsId, { ...w, check: { ...w.check, questions: qs } });
  schoolFresh = true;
  render();
  toast(`🙋 Sent! ${askNames({ askTo: ids })} will check Q${number}.`, 3000);
}
// 🙋 The buttons on a mistake: "Ask Dad" · "Ask Mum" · "Ask both" (one button when there's only one parent)
function askButtonsNode(number) {
  const ps = parentsList();
  return h("div", { class: "btnrow ws-askrow", dir: "ltr" }, h("span", { class: "ws-askq" }, "🙋 Not fair? Ask a parent to check:"),
    ps.map(u => h("button", { data: { wsqask: `${number}|${u.id}` } }, `${u.emoji || ""} Ask ${u.name}`)),
    ps.length > 1 ? h("button", { data: { wsqask: `${number}|all` } }, "👨‍👩‍👧 Ask both") : null);
}
const askNames = q => { const ids = q.askTo && q.askTo.length ? q.askTo : parentsList().map(u => u.id);
  return ids.map(id => (userById(id) || {}).name).filter(Boolean).join(" or ") || dadName(); };
const fixerName = q => (q.fixedBy && userById(q.fixedBy) && userById(q.fixedBy).name) || dadName();
// Is this question waiting for ME (a parent)? (no list = asked before v161: every parent)
const askedMe = q => q.ask && !q.fixed && (!q.askTo || !q.askTo.length || q.askTo.includes(me));
// 🙋 Worksheets with an answer a kid asked about (for the parents' "Needs you") → [{ id, w, nums }]
const askedWs = () => Object.entries(aiDocs.worksheets).filter(([, w]) => w && w.check && w.check.questions.some(askedMe))
  .map(([id, w]) => ({ id, w, nums: w.check.questions.filter(askedMe).map(q => q.number) }));
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-wsqfix], [data-wsqask], [data-wsaskopen]");
  if (!b) return;
  if (b.dataset.wsqfix) { const [n, to] = b.dataset.wsqfix.split("|"); return fixQuestion(schoolDoc, Number(n), to); }
  if (b.dataset.wsqask) { const [n, to] = b.dataset.wsqask.split("|"); return askQuestion(schoolDoc, Number(n), to); }
  if (b.dataset.wsaskopen) { openAiDoc("worksheet", b.dataset.wsaskopen); wsAllAns = true; schoolFresh = true; return render(); }
});
// ✕ v180: a parent removes a "please check" alert (the AI's mark stays as it is; the kid's question is closed)
function askDismiss(which) {
  if (!isParentId(me) || isKidDevice()) return;
  const list = askedWs().filter(x => which === "all" || x.id === which);
  list.forEach(x => {
    const w = aiDocs.worksheets[x.id];
    if (!w || !w.check) return;
    const questions = w.check.questions.map(q => { if (!askedMe(q)) return q; const { ask, askTo, ...rest } = q; return rest; });
    aiSave("worksheets", x.id, { ...w, check: { ...w.check, questions } });
  });
  if (list.length) toast(list.length === 1 ? "✕ Alert removed." : `✕ ${list.length} alerts removed.`, 2500);
  render();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-wsaskx]");
  if (b) askDismiss(b.dataset.wsaskx);
});
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
    if (free > 0) return toast("📎 The answers are uploaded! Now tap ✅ Check now: your points come with the check ⭐", 4000, colorsOf(userById(w.kid)).color);
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
// ✅ Check: any problem (also an unexpected one) is kept and shown under the button (see aiFailFor)
async function checkWorksheet(wsId) {
  try { await checkWorksheetNow(wsId); }
  catch (err) {
    console.error("Check:", err);
    aiFail = { key: "check|" + wsId, text: "⚠️ Something went wrong while checking: " + String(err && err.message || err).slice(0, 160), at: Date.now() };
    schoolFresh = true; render();
  }
}
// ✅ A safety net after the AI check: an answer the AI wrote down EXACTLY like the key (the same matching letters, the same order
// letters, the same choice letter or text) is always right, even if the AI said wrong. (Never the other way: it only ever adds marks.)
const wsPairs = t => { const p = {}; String(t || "").replace(/(\d+)\s*[-–—:→=.)]?\s*([A-Za-zء-ي])(?!\p{L})/gu, (m, n, l) => { p[n] = /[a-z]/i.test(l) ? l.toUpperCase() : l; }); return p; };
const wsLetters = t => (String(t || "").match(/(?<!\p{L})[A-Ja-j](?!\p{L})/gu) || []).map(x => x.toUpperCase()).join("");
function wsSameAsKey(w, wq, said) {
  if (!wq || !String(said || "").trim()) return false;
  if (wq.kind === "matching") {
    const m = matchCols(wq, isArabicWs(w)), key = m ? m.key : wsPairs(wq.answer), got = wsPairs(said), ks = Object.keys(key);
    return ks.length > 0 && ks.length === Object.keys(got).length && ks.every(k => got[k] === key[k]);
  }
  if (isOrderQ(wq)) { const k = orderKey(wq); return !!k && wsLetters(said) === k.join(""); }
  if (isChoiceQ(wq)) { const i = optFind(wq.options, wq.answer);
    if (i < 0) return wsSameText(said, wq.answer);   // (the key isn't one of the choices: the same text is right)
    // (v185: 1. the same words as a choice decide · 2. else the letter the kid wrote, also said in a longer way: "A (30 cm)", "A ✓",
    //  "(A)", "Q3 A", "أ" · 3. else the old near match. E.g. "A cat" with the choices "A dog" / "A cat" is the words "A cat", not the letter A)
    const byText = wsTextIdx(wq.options, said);
    if (byText >= 0) return byText === i;
    const L = wsKidLetter(wq.options, said);
    if (L) return L === (OPT_LETTERS[i] || "");
    return optFind(wq.options, said) === i;
  }
  // (any other question: the kid's answer is the key itself, e.g. "A" = "A", "30cm" = "30 cm")
  // (v191: also the final answer after the working: "475 - 150 = 325" = "325 (475 − 150)")
  const ends = x => [x, String(x || "").replace(/\s*\([^)]*\)\s*$/, ""), String(x || "").split("=").pop()];
  return ends(said).some(a => a.trim() && ends(wq.answer).some(k => wsSameText(a, k) || wsSameWithUnit(a, k)));
}
// (v191: the key is just a number and the kid wrote that number + its unit: "3 V" = "3", "25 cm" = "25", "40°C" = "40".
//  Only real units count, so "3x" ≠ "3" and "34" ≠ "3")
const WS_UNITS = new Set(("v volt volts a amp amps ampere amperes w watt watts ω ohm ohms j joule joules n newton newtons hz kw kwh " +
  "mm cm m km in ft mi g kg mg t l ml cl s sec secs second seconds min mins minute minutes h hr hrs hour hours day days week weeks " +
  "° °c °f c f k % percent cm² cm2 m² m2 km² km2 mm² mm2 cm³ cm3 m³ m3 mm³ mm3 m/s km/h kmh kph mph aed dhs dh dirham dirhams $ fils " +
  "unit units sq.cm squarecm squarem cubiccm").split(" "));
function wsSameWithUnit(said, key) {
  const k = wsPlain(key), a = wsPlain(said);
  if (!/^-?\d+(?:[.,]\d+)?$/.test(k) || !a.startsWith(k)) return false;
  const u = a.slice(k.length).replace(/\.$/, "");
  return WS_UNITS.has(u);
}
// (the same answer, only spaces, capitals or a full stop at the end different: "30cm" = "30 cm", "Paris." = "paris";
//  signs stay: "-5" ≠ "5", "3/4" ≠ "34", "1.5" ≠ "15")
const wsPlain = x => String(x || "").toLowerCase().replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/[\s.!?,;:]+$/, "").replace(/\s+/g, "");
const wsSameText = (a, b) => !!wsPlain(a) && wsPlain(a) === wsPlain(b);
// 🔤 The letter the kid wrote for a choice question, said in a longer way → "A" … or "" (not sure). OK: "A", "a)", "(A)", "A ✓",
// "A (circled)", "Q3: A", "3 - A", "أ", or the letter + its own choice's words ("A) 30 cm", "A (30 cm)"). Not OK: "a dog" (words, not a letter).
const WS_AR_ABC = { "أ": "A", "ا": "A", "ب": "B", "ج": "C", "د": "D" };
function wsKidLetter(opts, said) {
  let t = String(said || "").trim();
  const n = t.match(/^q?\s*\d+\s*[).:\-–—=]?\s*(\(?(?:[A-Ja-j]|[أابجد])\)?\.?)$/iu);   // ("Q3 A", "3-A": only a number + one letter)
  if (n) t = n[1];
  const m = t.match(/^\(?([A-Ja-j]|[أابجد])(?![\p{L}\p{N}])\)?\s*[).:\-–—=]?\s*(.*)$/su);
  if (!m) return "";
  const L = WS_AR_ABC[m[1]] || m[1].toUpperCase();
  if (!(OPT_LETTERS.indexOf(L) < opts.length)) return "";   // (not a letter on the paper: "F" for False, "T" for True …)
  const rest = m[2].replace(/\b(circled|ticked|chosen|written|picked|in the box)\b/gi, "");
  if (!/[\p{L}\p{N}]/u.test(rest)) return L;
  return optFind(opts, rest) === OPT_LETTERS.indexOf(L) ? L : "";   // (the words after the letter are that letter's choice)
}
// (which choice has the SAME words as the kid's answer, with or without "A)" in front: no guessing) → its index or -1
function wsTextIdx(opts, said) {
  const a = optNorm(said), ex = opts.map(optExact).indexOf(optExact(said));
  if (ex >= 0) return ex;
  const same = opts.map(optNorm).reduce((l, x, k) => a && x === a ? [...l, k] : l, []);
  return same.length === 1 ? same[0] : -1;
}
function wsSureRight(w, c) {
  let score = c.score;
  c.questions.forEach(q => {
    const wq = w.questions.find(x => x.number === q.number);
    if (q.correct || !wsSameAsKey(w, wq, q.your_answer)) return;
    const full = wq.points || 0;
    score = Math.min(c.max_score, score + Math.max(0, full - (q.points || 0)));
    Object.assign(q, { correct: true, points: Math.max(q.points || 0, full), note: "Right ✓" });
  });
  c.score = score;
  return c;
}
// 🔢 v191 the check's total is ALWAYS the worksheet's own total (the "Total: __ / N" on the paper), and the score is the sum of
// the questions' points, each between 0 and that question's marks (a right one = full marks). Before, the AI's own sums could differ.
function wsSameTotal(w, c) {
  const max = wsTotal(w);
  if (!(max > 0) || !c.questions.length) return c;
  c.questions.forEach(q => {
    const wq = w.questions.find(x => x.number === q.number);
    if (!wq) return;
    q.points = q.correct ? wq.points : Math.max(0, Math.min(wq.points, Number(q.points) || 0));
  });
  c.max_score = max;
  c.score = Math.min(max, c.questions.filter(q => w.questions.some(x => x.number === q.number)).reduce((n, q) => n + q.points, 0));
  return c;
}
async function checkWorksheetNow(wsId) {
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
  // (✏️ the PDF's ANSWER SHEET: the kid writes the question number + the letter of a choice, so the key says the letter too)
  // (each choice question also sends its choices WITH the letters printed on the paper, so the checker never has to guess them)
  const lettered = q => q.options.map((o, i) => `${OPT_LETTERS[i] || i + 1}) ${o}`);
  const keyOf = q => { if (isOrderQ(q)) { const k = orderKey(q); return k ? `${k.join(", ")} (letters in order: ${q.answer})` : q.answer; }
    if (q.kind === "matching") { const m = matchCols(q, isArabicWs(w)), ks = m ? Object.keys(m.key) : [];   // (🔗 the letters printed on the paper)
      return ks.length ? `${ks.map(n => `${n}-${m.key[n]}`).join(", ")} (${q.answer})` : q.answer; }
    if (!isChoiceQ(q)) return q.answer; const i = optFind(q.options, q.answer);
    return i >= 0 ? `${OPT_LETTERS[i] || i + 1}) ${q.options[i]}` : q.answer; };
  const extraOf = q => { if (!isChoiceQ(q) && !isOrderQ(q)) return {};
    const i = isChoiceQ(q) ? optFind(q.options, q.answer) : -1;
    return { choices_on_paper: lettered(q), ...(i >= 0 ? { correct_letter: OPT_LETTERS[i] || String(i + 1) } : {}) }; };
  const r = await callAi("check", { ...kidInfo(w.kid), ...(lv ? { level: lv.level } : {}),
    title: `${w.title} (the child may answer on an ANSWER SHEET page instead: each question's number with the answer, the letter A, B, C … written in a box for a choice question (older sheets: a circled or filled circle), for matching a small table with the numbers 1, 2, 3 … on top and the letter the child wrote under each number, and for ordering the step letters A, B, C … written in order next to 1st, 2nd, 3rd …. IMPORTANT: the letters in choices_on_paper are EXACTLY the letters printed on the child's paper. For a choice question, the child is right when the letter they wrote or circled equals correct_letter. Never re-letter the choices yourself). ${CHECK_RULES}${wsWordsCheck(w.kid, w.subject)}`,
    answerKey: w.questions.map(q => ({ number: q.number, answer: keyOf(q), ...extraOf(q), points: q.points,
                                       ...(isChoiceQ(q) || isOrderQ(q) || q.kind === "matching" ? {} : { marking: wsPartOf(q) === "C" ? MARK_EXPLAIN : MARK_SHORT }),
                                       ...(q.skill ? { skill: q.skill } : {}), ...(q.difficulty ? { difficulty: q.difficulty } : {}),
                                       ...(q.picture ? { picture: q.picture.alt || q.picture.title || q.picture.type } : {}) })), files }, "check|" + wsId);
  if (!r) { schoolFresh = true; return render(); }   // (⚠️ the reason shows under the button)
  const c = cleanCheck({ ...r, at: todayYmd() }, wsTotal(w));
  if (c) { wsSureRight(w, c); wsSameTotal(w, c); }   // (✅ an answer exactly like the key is right · 🔢 the total = the paper's total)
  if (!c) { aiFail = { key: "check|" + wsId, text: "🤖 The check came back empty. Please try again.", at: Date.now() }; schoolFresh = true; render(); return toast("🤖 The check came back empty. Please try again.", 4000); }
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
  if (!confirm(`Delete this worksheet?\n\n“${w.title}”\n\nIt goes out of the lists, but it stays saved: you can bring it back from “All the worksheets”.`)) return;
  // 🙈 Never really deleted: kept in the cloud with hidden = true (its answer files keep pointing to it)
  const doc = { ...w, hidden: true };
  aiSave("worksheets", id, doc);
  delete aiDocs.worksheets[id];
  aiDocs.hiddenWs[id] = doc;
  leaveAiDoc();
}
// ♻️ Bring a hidden worksheet back
function unhideWorksheet(id) {
  const w = aiDocs.hiddenWs[id];
  if (!w) return;
  if (!isDadNow()) return toast(`Ask ${dadName()} 🙂`);
  const { hidden, ...back } = w;
  delete aiDocs.hiddenWs[id];
  aiSave("worksheets", id, back);
  schoolFresh = true;
  render();
  toast("♻️ The worksheet is back.", 2500);
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
      h("button", { data: { aireport: "explanation|" + schoolDoc } }, "🚩 Report"),
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
