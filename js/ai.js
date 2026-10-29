// =====================================================================
//  🤖 AI HELP (School): 📥 Add school work · 📝 Worksheet · 📖 Explain · ✅ Check
//  Every call goes to the family's own AI server (a Cloudflare Worker). The Claude key lives ONLY there,
//  never in this app. The server only answers the signed-in family account (its Firebase login token goes with each call).
//  Each call: POST AI_URL/<action> with JSON → { result } or { error }.
//  Saved:  📥 school work cards → data.school[kid].work (like the other School lists, see cleanSchool)
//          📝 worksheets        → their own cloud documents families/{family}/worksheets/{id}
//          📖 explanations      → their own cloud documents families/{family}/explanations/{id}
//  Text from the AI is ALWAYS put on the page as plain text (textContent, see h()), never as HTML.
//  Kids and Bro2a can use everything. Only Bro2a deletes worksheets / explanations and changes scores.
// =====================================================================
const AI_URL = "https://family-plan-ai.hanifamily.workers.dev";
const AI_OFF = "AI needs internet and the family sign-in";
const AI_MAX = 4 * 1024 * 1024;   // all the files of one AI call together (the server takes about 4.5 MB)
const WS_COUNTS = [5, 10, 15];
const WS_KINDS = ["multiple_choice", "true_false", "fill_blank", "short_answer", "matching", "ordering"];
const aiDocs = { worksheets: {}, explanations: {} };   // id → document, kept up to date from the cloud
let aiWait = null;    // the AI button that's waiting for an answer ("🤖 Thinking…")
let aiPick = null;    // what the next chosen files are for: "work" (📥 Add school work) or { ws: id } (the answers)
let aiMounts = [];    // the AI parts of the School page, built after its HTML (see fillAiMounts)

// Builds a page element. Text (strings) always goes in as plain text, never as HTML.
// props: class, text, data: { key: value } (data-key), any other attribute; false / null = left out.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === "class") el.className = v;
    else if (k === "data") Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; });
    else el.setAttribute(k, v === true ? "" : String(v));
  });
  kids.flat(Infinity).forEach(c => { if (c != null && c !== false) el.append(c instanceof Node ? c : String(c)); });
  return el;
}
// A place in the School page's HTML that gets an element built with h() (fn returns it)
const aiMount = fn => `<div data-aimount="${aiMounts.push(fn) - 1}"></div>`;
function fillAiMounts(root) {
  root.querySelectorAll("[data-aimount]").forEach(box => {
    const fn = aiMounts[Number(box.dataset.aimount)], node = fn && fn();
    if (node) box.replaceWith(node); else box.remove();
  });
  aiMounts = [];
}

// ---------- Is the AI there? (signed in to the family account, and online) ----------
const aiReady = () => cloud.enabled && !!cloud.user && !!cloud.db && navigator.onLine;
// "🤖 Thinking…" on the waiting button (and it can't be tapped again); the others get their own words back
function showAiWait() {
  document.querySelectorAll("[data-aiwait]").forEach(b => {
    if (!b.dataset.label) b.dataset.label = b.textContent;
    const on = !!aiWait && b.dataset.aiwait === aiWait;
    b.disabled = on;
    b.textContent = on ? "🤖 Thinking…" : b.dataset.label;
  });
}
// Asks the AI server. → the result, or null (then a friendly message was shown)
// 🤖 This month's AI use for a family with a limit (kept on this device: { used, limit, month }); our family has no limit, so nothing shows
const AI_USAGE_KEY = SAVE_KEY + ".aiUsage";
function aiUsage() {
  try { const u = JSON.parse(localStorage.getItem(AI_USAGE_KEY)); return u && u.month === dubaiNow().date.slice(0, 7) ? u : null; } catch (e) { return null; }
}
function saveAiUsage(used, limit) {
  try { localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ used, limit, month: dubaiNow().date.slice(0, 7) })); } catch (e) {}
}
const aiUsageHtml = () => { const u = aiUsage(); return u ? `<p class="ai-usage">🤖 AI this month: <b>${u.used}</b> of ${u.limit}</p>` : ""; };
// 🧒 What a kid's device may ask 🤖 itself: 📥 read school work · ⚡ instant · 📚 Start session / ➕ More questions (worksheet) · 🤖 explain ·
// ✅ check answers · ✏️ a subject's topics · 🧩 riddles · 📚 Add to curriculum (🤖 Find the topics). Parents only: 📋 brief, 📰 newsletter, 📏 benchmark.
const KID_AI = ["analyze", "worksheet", "explain", "check", "topics", "riddles", "curriculum"];
// 🤖 When the AI can't answer: 💳 "no_credit" (the AI credit ran out) or 📅 "limit" (this month's family limit) → a clear box, never retried;
// ⏳ no answer in 90 seconds → "taking too long"; anything else → "didn't answer" (a few server replies keep their own words, e.g. files too big).
// auto = a call the app makes by itself (🧩 riddles, ✏️ a subject's topics): after no_credit / limit it isn't made again on this device
// until the app is opened again, and it never shows the box.
const AI_TIMEOUT = 90 * 1000;
let aiStop = null;   // "no_credit" | "limit" once the server said so (this session)
function aiStopBox(code) {
  $("asText").textContent = isKidDevice() ? "😴 The AI helper is resting. Ask your parent."
    : code === "limit" ? "📅 You used this month's AI helper. Upgrade your subscription for more, or wait for the 1st."
    : "💳 Your AI credit has run out. Please upgrade your subscription to keep using the AI helper.";
  $("aiStopModal").hidden = false;
  $("asOk").focus();
}
$("asOk").onclick = () => { $("aiStopModal").hidden = true; };
$("aiStopModal").addEventListener("click", e => { if (e.target === $("aiStopModal")) $("aiStopModal").hidden = true; });
async function callAi(action, body, key, auto = false) {
  // 🧒 A kid's device asks 🤖 itself for KID_AI (the server allows the same list); 📋 brief and 📰 newsletter: parents only
  if (isKidDevice() && !KID_AI.includes(action)) { toast("Ask your parent 🙂", 3000); return null; }
  if (auto && aiStop) return null;   // (💳 / 📅: the app doesn't try again by itself)
  if (!aiReady()) { toast("🔌 " + AI_OFF, 4500); return null; }
  if (aiWait) { toast("🤖 Still thinking… one moment, please.", 2500); return null; }
  aiWait = key || action;
  showAiWait();
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), AI_TIMEOUT);   // ⏳ 90 seconds
  try {
    const token = await cloud.user.getIdToken();
    const res = await fetch(AI_URL + "/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body),
      signal: stop.signal
    });
    let out = null;
    try { out = await res.json(); } catch (e) {}
    // 🤖 A family with a monthly limit: the server says how many are used ("🤖 AI this month: 3 of 15")
    if (out && Number.isFinite(out.used) && Number.isFinite(out.limit)) saveAiUsage(out.used, out.limit);
    if (res.ok && out && out.result && typeof out.result === "object" && !out.error) return out.result;
    // 💳 / 📅 (an older server: 402, or 429 with used ≥ limit)
    const code = out && out.code === "no_credit" || res.status === 402 ? "no_credit"
      : out && (out.code === "limit" || (res.status === 429 && Number.isFinite(out.used) && out.used >= out.limit)) ? "limit" : "";
    if (code) { aiStop = code; if (!auto) aiStopBox(code); return null; }
    // The server's own words when it says what to do (not signed in, files too big, try other wording …); otherwise "didn't answer"
    const why = out && out.code !== "ai_error" && res.status >= 400 && res.status < 500 && res.status !== 429 && typeof out.error === "string" && out.error.trim()
      ? "🤖 " + out.error.trim().slice(0, 200) : "⚠️ The AI helper didn't answer. Please try again.";
    if (!auto) toast(why, 5500);
  } catch (e) {
    if (!auto) toast(e && e.name === "AbortError" ? "⏳ The AI is taking too long. Please try again."
      : navigator.onLine ? "⚠️ The AI helper didn't answer. Please try again." : "🔌 " + AI_OFF, 5500);
  } finally {
    clearTimeout(timer);
    aiWait = null;
    showAiWait();   // (every "🤖 Thinking…" button gets its words back, whatever happened)
  }
  return null;
}
// A file for the AI: { name, mediaType, data } (data = the base64 part, without "data:…;base64,")
const aiFile = (name, url) => ({ name, mediaType: url.slice(5, url.indexOf(";")), data: url.slice(url.indexOf(",") + 1) });
// PowerPoint / Word can't go to the AI as they are: their text is sent instead ({ name, mediaType: "text/plain", data: the text, NOT base64 }).
// Throws "notext" (only pictures inside) or "zip" (JSZip couldn't load: no internet).
const NO_TEXT = "This file has no text I can read. Save it as PDF in PowerPoint (File > Save As > PDF) and upload the PDF.";
// Text already taken out of a big PowerPoint / Word, kept as "data:text/plain;base64,…" (UTF-8)
function textUrl(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return "data:text/plain;base64," + btoa(bin);
}
const textOfUrl = url => new TextDecoder().decode(Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), c => c.charCodeAt(0)));
async function aiFileFor(name, url) {
  const type = url.slice(5, url.indexOf(";"));
  if (type === "text/plain") return { name, mediaType: "text/plain", data: textOfUrl(url) };
  if (type !== PPTX_TYPE && type !== DOCX_TYPE) return aiFile(name, url);
  const text = await officeText(url.slice(url.indexOf(",") + 1), type === PPTX_TYPE ? "pptx" : "docx");
  if (!text) throw new Error("notext");
  return { name, mediaType: "text/plain", data: text };
}
// The files for an AI call (each PowerPoint / Word turned into its text)
const aiFilesFor = list => Promise.all(list.map(x => aiFileFor(x.name, x.url)));
const aiFileError = err => err.message === "notext" ? NO_TEXT
  : err.message === "zip" ? "🔌 Couldn't load the PowerPoint / Word reader. Check the internet and try again." : "Couldn't read that file. Please try another one.";
// 📦 JSZip (opens .pptx / .docx, which are zip files): loaded only the first time it's needed (sw.js keeps a copy)
const JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
let jszipLoading = null;
function loadJsZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return jszipLoading = jszipLoading || new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = JSZIP_URL;
    el.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error("zip"));
    el.onerror = () => { el.remove(); jszipLoading = null; reject(new Error("zip")); };
    document.head.appendChild(el);
  });
}
// The text of one slide / notes page / Word document: one line per paragraph (<a:p> / <w:p>), from its <a:t> / <w:t> pieces
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main", NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
function xmlLines(xml, ns) {
  const doc = new DOMParser().parseFromString(xml, "application/xml"), lines = [];
  let para;
  for (const t of doc.getElementsByTagNameNS(ns, "t")) {
    let p = t.parentNode;
    while (p && !(p.namespaceURI === ns && p.localName === "p")) p = p.parentNode;
    if (p !== para || !lines.length) { lines.push(""); para = p; }
    lines[lines.length - 1] += t.textContent;
  }
  return lines.map(l => l.trim()).filter(Boolean);
}
// The base64 .pptx / .docx → its text ("" when there is none)
async function officeText(base64, kind) {
  const JSZip = await loadJsZip();
  let zip;
  try { zip = await JSZip.loadAsync(base64, { base64: true }); } catch (e) { throw new Error("read"); }
  const read = path => zip.file(path) ? zip.file(path).async("string") : Promise.resolve("");
  if (kind === "docx") return xmlLines(await read("word/document.xml"), NS_W).join("\n");
  // PowerPoint: the slides in slide-number order ("--- Slide N ---" before each), then the speaker notes
  const numbered = re => Object.keys(zip.files).map(p => { const m = p.match(re); return m ? { p, n: Number(m[1]) } : null; })
    .filter(Boolean).sort((a, b) => a.n - b.n);
  const out = [];
  let found = false;
  for (const { p, n } of numbered(/^ppt\/slides\/slide(\d+)\.xml$/)) {
    const lines = xmlLines(await read(p), NS_A);
    if (lines.length) found = true;
    out.push(`--- Slide ${n} ---`, ...lines);
  }
  for (const { p, n } of numbered(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/)) {
    const lines = xmlLines(await read(p), NS_A).filter(l => !/^\d+$/.test(l));   // (not the slide number itself)
    if (lines.length) { found = true; out.push(`--- Notes ${n} ---`, ...lines); }
  }
  return found ? out.join("\n") : "";
}
const tooBigText = total => `📦 That's ${sizeText(total)}: too big for the AI (4 MB at most). Please remove some pages or photos.`;
const kidNameOf = kid => userById(kid).name;
// The kid's year from 👤 About / 👨‍👩‍👧 Family, e.g. "Year 5"; else the class from 🏫 School info
const gradeOf = kid => userById(kid).year || schoolOf(kid).info.grade;
// (the AI gets the short name for IGCSE: "British IGCSE", so worksheets follow the IGCSE syllabus for Years 10–11)
const curriculumOf = kid => { const c = userById(kid).curriculum; return !c || c === "Other" ? "" : c === IGCSE ? "British IGCSE" : c; };
// 🏫 The kid's school: from 👤 the profile, else (older data) from 🏫 School info
const schoolNameOf = kid => userById(kid).school || schoolOf(kid).info.name;
// Sent with EVERY 🤖 call: the kid's name, 🏫 school, 🎓 year / grade and 📚 curriculum (all read from 👤 the profile, never asked again)
const kidInfo = kid => ({ kidName: kidNameOf(kid), grade: gradeOf(kid), ...(curriculumOf(kid) ? { curriculum: curriculumOf(kid) } : {}),
                          ...(schoolNameOf(kid) ? { school: schoolNameOf(kid) } : {}) });
// "2026-10-19" → "19 October 2026"
const longDate = s => fromYmd(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// ---------- Cleaning what the AI (or the cloud) gives back ----------
const okId = x => typeof x === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x);
const aiTxt = (x, n) => typeof x === "string" ? x.trim().slice(0, n) : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
const aiInt = (x, lo, hi, d) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const aiNum = (x, lo, hi, d) => { const n = Number(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : d; };
const aiArr = (x, n) => Array.isArray(x) ? x.slice(0, n) : [];
const aiObjs = (x, n) => aiArr(x, n).filter(o => o && typeof o === "object" && !Array.isArray(o));
const aiSearches = x => aiObjs(x, 6).map(o => ({ label: aiTxt(o.label, 80), query: aiTxt(o.query, 120) }))
  .filter(o => o.query).map(o => ({ label: o.label || o.query, query: o.query }));
// Who / what / when, the same for worksheets and explanations
function aiMeta(d) {
  return { kid: okId(d.kid) ? d.kid : "", subject: aiTxt(d.subject, 30), date: isYmd(d.date) ? d.date : todayYmd(),
           by: okId(d.by) ? d.by : "", at: aiTxt(d.at, 40), ...(okId(d.work) ? { work: d.work } : {}) };
}
// A worksheet: { kid, subject, topics, count, title, intro, questions, youtube_searches, printable_searches,
//                date, status: "To do" | "Answers uploaded" | "Checked ✓", by, at, work?, answers: [file ids], check?,
//                part?: the topic title it's about (📊 "By part"), purpose?: the mode it was made with (see WS_MODES) }
const WS_MODES = ["level_check", "practice", "week_review", "challenge", "placement"];
const modeOf = x => x === "level" ? "level_check" : WS_MODES.includes(x) ? x : null;   // ("level": a few sheets from an earlier test version)
function cleanWorksheet(d) {
  if (!d || typeof d !== "object") return null;
  const questions = aiObjs(d.questions, 40).map((q, i) => {
    const kind = WS_KINDS.includes(q.kind) ? q.kind : "short_answer";
    let options = aiArr(q.options, 12).map(o => aiTxt(o, 200)).filter(Boolean), lines = aiInt(q.answer_lines, 0, 12, 0);
    if (kind === "true_false" && !options.length) options = ["True", "False"];
    if (!options.length && !lines) lines = 1;   // always somewhere to write
    return { number: aiInt(q.number, 1, 99, i + 1), kind, prompt: aiTxt(q.prompt, 1000), options, answer_lines: lines,
             points: aiInt(q.points, 0, 100, 1), answer: aiTxt(q.answer, 1000),
             // 🧠 its topic, skill and difficulty 1–10 (newer worksheets)
             ...(aiTxt(q.topic, 80) ? { topic: aiTxt(q.topic, 80) } : {}),
             ...(aiTxt(q.skill, 60) ? { skill: aiTxt(q.skill, 60) } : {}), ...(q.difficulty != null ? { difficulty: aiInt(q.difficulty, 1, 10, 5) } : {}),
             ...(aiTxt(q.question_ar, 1000) ? { question_ar: aiTxt(q.question_ar, 1000) } : {}),   // (🌐 its Arabic translation, when asked for)
             // (🔗 matching: column 1, numbered, and column 2, lettered: see matchNode)
             ...(aiArr(q.left, 8).map(x => aiTxt(x, 200)).filter(Boolean).length ? { left: aiArr(q.left, 8).map(x => aiTxt(x, 200)).filter(Boolean) } : {}),
             ...(aiArr(q.right, 9).map(x => aiTxt(x, 200)).filter(Boolean).length ? { right: aiArr(q.right, 9).map(x => aiTxt(x, 200)).filter(Boolean) } : {}) };
  }).filter(q => q.prompt);
  if (!questions.length) return null;
  const check = cleanCheck(d.check, questions.reduce((n, q) => n + q.points, 0));
  const answers = aiArr(d.answers, 20).filter(okId);
  return { ...aiMeta(d), title: aiTxt(d.title, 120) || "Worksheet", intro: aiTxt(d.intro, 1500),
           topics: aiArr(d.topics, 12).map(t => aiTxt(t, 60)).filter(Boolean), count: aiInt(d.count, 1, 40, questions.length),
           questions, youtube_searches: aiSearches(d.youtube_searches), printable_searches: aiSearches(d.printable_searches),
           answers, status: check ? "Checked ✓" : answers.length ? "Answers uploaded" : "To do", ...(check ? { check } : {}),
           ...(aiTxt(d.part, 80) ? { part: aiTxt(d.part, 80) } : {}), ...(modeOf(d.purpose) ? { purpose: modeOf(d.purpose) } : {}),
           // 📚 made for a study session: its key "date|actId|person", its minutes and the AI's estimate
           ...(/^\d{4}-\d{2}-\d{2}\|[^|]+\|[^|]+$/.test(aiTxt(d.session, 100)) ? { session: aiTxt(d.session, 100) } : {}),
           ...(d.minutes != null ? { minutes: aiInt(d.minutes, 5, 240, 30) } : {}), ...(d.estimated_minutes != null ? { estimated_minutes: aiInt(d.estimated_minutes, 1, 600, 30) } : {}),
           // 📚 its parts, where it came from (⚡ instant from a file / 🌍 IGCSE extra), the topic found in the file, 🔁 a swapped session, 🙋 "I'm done"
           ...(aiObjs(d.sections, 8).length ? { sections: aiObjs(d.sections, 8).map(x => ({ title: aiTxt(x.title, 80), topic: aiTxt(x.topic, 80),
                 from: aiInt(x.from_question != null ? x.from_question : x.from, 1, 99, 1), to: aiInt(x.to_question != null ? x.to_question : x.to, 1, 99, 99) })).filter(x => x.title || x.topic) } : {}),
           ...(["instant", "igcse"].includes(d.src) ? { src: d.src } : {}),
           ...(aiTxt(d.detected_topic, 80) ? { detected_topic: aiTxt(d.detected_topic, 80) } : {}), ...(aiTxt(d.detected_subject, 30) ? { detected_subject: aiTxt(d.detected_subject, 30) } : {}),
           ...(aiTxt(d.swap, 30) ? { swap: aiTxt(d.swap, 30) } : {}), ...(d.done === true ? { done: true } : {}),
           ...(d.lang === "ar" ? { lang: "ar" } : {}) };   // (🇦🇪 written in Arabic: shown right-to-left)
}
// The check: { score, max_score, overall_note, questions: [{ number, correct, points, note }], at, aiScore?, dadNote?,
//              strong_points?, weak_points?: ["Adding fractions", …], coach_tip?: for the parents }   (older checks have none of the last 3)
function cleanCheck(c, fallbackMax) {
  if (!c || typeof c !== "object") return null;
  let max = aiNum(c.max_score, 0, 1000, 0);
  if (!(max > 0)) max = fallbackMax;
  if (!(max > 0)) return null;
  const out = { score: aiNum(c.score, 0, max, 0), max_score: max, overall_note: aiTxt(c.overall_note, 800),
                questions: aiObjs(c.questions, 40).map(q => ({ number: aiInt(q.number, 0, 99, 0), correct: q.correct === true,
                                                               points: aiNum(q.points, 0, 100, 0), note: aiTxt(q.note, 400),
                                                               // (newer checks: what the child wrote, and why the right answer is right)
                                                               ...(aiTxt(q.your_answer, 400) ? { your_answer: aiTxt(q.your_answer, 400) } : {}),
                                                               ...(aiTxt(q.explanation, 600) ? { explanation: aiTxt(q.explanation, 600) } : {}),
                                                               ...(aiTxt(q.topic, 80) ? { topic: aiTxt(q.topic, 80) } : {}),
                                                               ...(aiTxt(q.skill, 60) ? { skill: aiTxt(q.skill, 60) } : {}),
                                                               ...(q.difficulty != null ? { difficulty: aiInt(q.difficulty, 1, 10, 5) } : {}) })),
                at: isYmd(c.at) ? c.at : todayYmd() };
  if (c.aiScore != null && Number.isFinite(Number(c.aiScore))) out.aiScore = aiNum(c.aiScore, 0, 1000, 0);
  if (aiTxt(c.dadNote, 400)) out.dadNote = aiTxt(c.dadNote, 400);
  const skills = x => aiArr(x, 5).map(t => aiTxt(t, 80)).filter(Boolean);
  if (Array.isArray(c.strong_points)) out.strong_points = skills(c.strong_points);
  if (Array.isArray(c.weak_points)) out.weak_points = skills(c.weak_points);
  if (aiTxt(c.coach_tip, 600)) out.coach_tip = aiTxt(c.coach_tip, 600);
  if (c.suggested_level != null) out.suggested_level = aiInt(c.suggested_level, 1, 10, 5);   // 🧠 the next worksheet's level, and why
  if (aiTxt(c.level_reason, 200)) out.level_reason = aiTxt(c.level_reason, 200);
  return out;
}
// An explanation: { kid, subject, topic, title, sections, key_words, try_this, youtube_searches, printable_searches, date, by, at, work? }
function cleanExplain(d) {
  if (!d || typeof d !== "object") return null;
  const sections = aiObjs(d.sections, 12).map(x => ({ heading: aiTxt(x.heading, 120), text: aiTxt(x.text, 3000) })).filter(x => x.heading || x.text);
  if (!sections.length) return null;
  return { ...aiMeta(d), topic: aiTxt(d.topic, 200), title: aiTxt(d.title, 120) || aiTxt(d.topic, 120) || "Explanation", sections,
           key_words: aiObjs(d.key_words, 20).map(k => ({ word: aiTxt(k.word, 60), meaning: aiTxt(k.meaning, 400) })).filter(k => k.word),
           try_this: aiArr(d.try_this, 10).map(t => aiTxt(t, 500)).filter(Boolean),
           youtube_searches: aiSearches(d.youtube_searches), printable_searches: aiSearches(d.printable_searches) };
}

// ---------- The cloud: worksheets and explanations (each its own document) ----------
const aiRef = (name, id) => cloud.fb.doc(cloud.db, "families", cloud.familyId, name, id);
function aiSave(name, id, doc) {
  aiDocs[name][id] = doc;
  if (cloud.user && cloud.db) cloud.fb.setDoc(aiRef(name, id), doc).catch(cloudError);
  // 📚 a new worksheet's topics go into the subject's 📚 My topics (once, no doubles)
  if (name === "worksheets" && !hasDraft() && topicsFromWorksheet(id, doc)) writeData();
}
function aiDelete(name, id) {
  delete aiDocs[name][id];
  if (cloud.user && cloud.db) cloud.fb.deleteDoc(aiRef(name, id)).catch(cloudError);
}
// Signed in: listen to both lists (changes from any phone arrive here; Firestore also keeps an offline copy)
function aiListen() {
  const fb = cloud.fb, uid = cloud.familyId;
  ["worksheets", "explanations"].forEach(name => {
    aiDocs[name] = {};
    cloud.unsub.push(fb.onSnapshot(fb.collection(cloud.db, "families", uid, name), snap => {
      const all = {};
      snap.forEach(d => { const x = (name === "worksheets" ? cleanWorksheet : cleanExplain)(d.data()); if (x && okId(d.id)) all[d.id] = x; });
      aiDocs[name] = all;
      if (name === "worksheets") topicsFromAllWorksheets();   // 📚 (worksheets made before, or on another phone: their topics too)
      if (screen === "school") render();
    }, err => console.warn("AI " + name + ":", err)));
  });
}
// A subject folder was renamed: its worksheets and explanations follow
function aiRenameSubject(kid, from, to) {
  ["worksheets", "explanations"].forEach(name => Object.entries(aiDocs[name]).forEach(([id, d]) => {
    if (d.kid === kid && sameSubject(d.subject, from)) aiSave(name, id, { ...d, subject: to });
  }));
}
const byNewest = (a, b) => b.date.localeCompare(a.date) || String(b.at).localeCompare(String(a.at)) || b.id.localeCompare(a.id);
const wsOf = (kid, subject) => Object.entries(aiDocs.worksheets).map(([id, w]) => ({ id, ...w }))
  .filter(w => w.kid === kid && (!subject || sameSubject(w.subject, subject))).sort(byNewest);
const exOf = (kid, subject) => Object.entries(aiDocs.explanations).map(([id, x]) => ({ id, ...x }))
  .filter(x => x.kid === kid && (!subject || sameSubject(x.subject, subject))).sort(byNewest);

// ---------- 📥 Files for the AI (⬆️ Upload: see STUDY TOPICS) ----------
// A chosen file, ready for the AI (photos: 1600px JPEG) → { r: { kind, name, size, url }, keep } or { problem: "…" }
// (keep = small enough to be kept in the School files)
async function readForAi(file) {
  try { return { r: await readSchoolFile(file, 1600), keep: true }; }
  catch (err) {
    // A PDF too big to keep can still be read by the AI now (up to 4 MB)
    if (err.message === "big" && isPdfFile(file) && file.size <= AI_MAX) {
      try { return { r: { kind: "pdf", name: fileNameOf(file), size: file.size, url: await readPdf(file) }, keep: false }; } catch (e) {}
    }
    // A PowerPoint / Word too big to keep (any size): only its text goes to the AI, so take the text out now
    const office = err.message === "big" && officeKindOf(file);
    if (office) {
      try {
        const url = await readAsUrl(file, OFFICE_TYPES[office]);
        const text = await officeText(url.slice(url.indexOf(",") + 1), office);
        if (!text) return { problem: `“${file.name}”: ${NO_TEXT}` };
        return { r: { kind: office, name: fileNameOf(file), size: file.size, url: textUrl(text) }, keep: false };
      } catch (e) { return { problem: aiFileError(e) }; }
    }
    return { problem: err.message === "type" ? `“${file.name}”: ${TYPE_TEXT.charAt(0).toLowerCase() + TYPE_TEXT.slice(1)}`
      : err.message === "big" ? `“${file.name}” is too big (4 MB at most).` : `Couldn't read “${file.name}”.` };
  }
}
// The folder for the subject the AI found (same name, one name inside the other, or the same known subject)
function folderIdFor(s, name) {
  if (!name) return null;
  const list = subjectList(s, true), n = name.toLowerCase();
  const hit = list.find(x => sameSubject(x.name, name)) || list.find(x => n.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(n));
  if (hit) return hit.id;
  const known = findSubject(name), same = known && list.find(x => known.find.test(x.name));
  return same ? same.id : null;
}
// The folder for a subject the AI found (a subject without a folder yet gets one) → its id
function ensureFolder(s, subject) {
  const name = subject || "Other", found = folderIdFor(s, name);
  if (found) { delete s.subjects[found].hidden; return found; }   // (🙈 a hidden folder gets new work: it shows again)
  const known = findSubject(name), colors = Object.keys(PALETTE), id = "s" + newId(), n = subjectList(s, true).length;
  s.subjects[id] = { name, emoji: known ? known.emoji : "📘", color: colors[n % colors.length] || "blue", order: n };
  return id;
}
// 🤖 What the AI read → a "School work" card in its subject (+ a 🧭 level check when the topic is new)
function afterAnalyze(kid, r, ids, chosen) {
  const s = schoolFor(kid), subject = aiTxt(r.subject, 30);
  const folderId = s.subjects[chosen] ? chosen : ensureFolder(s, subject);
  const folder = s.subjects[folderId], id = newId(), fileIds = ids.filter(f => f && s.files[f]);
  s.work[id] = { subject: folder.name, title: aiTxt(r.title, 80) || "School work", date: todayYmd(), what_to_do: aiTxt(r.what_to_do, 600),
                 topics: aiArr(r.topics, 8).map(t => aiTxt(t, 40)).filter(Boolean), files: fileIds, by: me };
  fileIds.forEach(f => { s.files[f].subject = folder.name; s.files[f].work = id; });
  writeData();
  // (🧭 a level check only when the subject's level isn't known yet: once a subject)
  const title = s.work[id].title, fresh = isNewTopic(s, kid, folder.name, title, id) && !levelAnswered(kid, { id: folderId, name: folder.name });
  if (schoolKid === kid && screen === "school") goSchool("subject", folderId, fresh ? "worksheets" : "overview");
  if (!fresh) return toast(`📥 Saved in ${folder.emoji} ${folder.name}!`, 3000);
  toast(`🆕 New topic: ${title}`, 4000);
  makeLevelCheck(kid, id);   // a new topic: by itself, a short level check on it
}
// Is it a new topic for the kid? (no earlier school work card or worksheet with that title in the subject)
function isNewTopic(s, kid, subject, title, workId) {
  const t = title.trim().toLowerCase();
  return !Object.entries(s.work).some(([id, w]) => id !== workId && sameSubject(w.subject, subject) && w.title.trim().toLowerCase() === t)
    && !wsOf(kid, subject).some(w => partOf(w, s).trim().toLowerCase() === t);
}

// ---------- Every 🤖 worksheet: a mode + a short profile of the kid ----------
//   mode: "level_check" (🧭 a new topic) | "practice" (🔁) | "week_review" (📰 the newsletter's week) | "challenge" (🚀)
const LEVEL_COUNT = 8, PRACTICE_COUNT = 8, REVIEW_COUNT = 8;
const MODE_NOTES = {
  level_check: "short level check to see what the child already knows",
  practice: "practice only these weak points",
  week_review: "review of this week's school topics",
  challenge: "a harder challenge sheet: the child is doing very well in this subject",
  placement: "short placement test: we don't know the child's level in this subject yet"
};
// 🏫 The kid's school system and 📄 syllabus (when saved): sent with EVERY 🤖 worksheet
function schoolSystemOf(kid) {
  const syl = schoolOf(kid).syllabus;
  return { ...(curriculumOf(kid) ? { curriculum: curriculumOf(kid) } : {}), ...(syl && syl.text ? { syllabus: syl.text } : {}) };
}
// ---------- ✏️ Make a worksheet: 1) the subject → 2) its topics (🤖 /topics, kept per kid + subject) → how many → ✨ Make it ----------
// The kind is picked the usual way: 🧭 a level check for a topic that's new in the subject, else 🔁 practice or 🚀 challenge (see pickMode).
// (A kid's phone asks 🤖 itself, like a parent's.)
let mk = null;   // { subject, picked: [topic titles], typed: [topics typed by hand], count }
const MAKE_COUNTS = [5, 10, 15];
const topicsKey = subject => subject.trim().toLowerCase().slice(0, 40);
function openMake(subject) {
  mk ={ subject: subject || "", picked: [], typed: [], count: 10 };
  goSchool("make");
  if (subject) maybeLoadTopics();
}
// Topics already met: 📥 school work cards and 📰 this week's newsletter (no doubles)
function learnedTopics(s, subject) {
  const all = [];
  Object.values(s.work).filter(w => sameSubject(w.subject, subject)).forEach(w => all.push(w.title, ...w.topics));
  const week = weekNow(s), x = week && week.subjects.find(y => sameSubject(y.subject, subject));
  if (x) all.push(...x.topics);
  const seen = new Set();
  return all.filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 16);
}
function maybeLoadTopics() {
  const s = schoolOf(schoolKid);
  if (mk && mk.subject && !s.topics[topicsKey(mk.subject)] && aiReady() && !aiWait) loadTopics();
}
async function loadTopics() {
  if (!mk || !mk.subject) return;
  const kid = schoolKid, subject = mk.subject, syl = schoolOf(kid).syllabus;
  const r = await callAi("topics", { ...kidInfo(kid), subject, today: todayYmd(), ...(syl && syl.text ? { syllabus: syl.text } : {}) }, "topics", true);   // (auto)
  const list = (r && Array.isArray(r.topics) ? r.topics : []).map(t => ({ title: aiTxt(t.title, 80), term: aiTxt(t.term, 20), now: t.now === true })).filter(t => t.title).slice(0, 20);
  if (!list.length) return;
  schoolFor(kid).topics[topicsKey(subject)] = { at: new Date().toISOString(), list };
  writeData();
  if (screen === "school") render();
}
function schoolMakeHtml(s) {
  if (!mk) mk = { subject: "", picked: [], typed: [], count: 10 };
  if (!mk.subject) return `<div class="card mk-card"><h2>1️⃣ Which subject?</h2>
    <div class="mk-subjects">${subjectList(s).map(f => `<button class="mk-sub" data-mksub="${safe(f.name)}" style="--c:${subjectColors(f).color}"><span class="e">${safe(f.emoji)}</span><b>${safe(f.name)}</b></button>`).join("")}</div>
    <div class="row mk-other"><div><label class="small" for="mkOther">➕ Other subject</label><input type="text" id="mkOther" maxlength="30" placeholder="Science, French…"></div></div>
    <div class="btnrow"><button data-mkother>➕ Use this subject</button></div></div>`;
  const ai = s.topics[topicsKey(mk.subject)], f = folderOf(s, mk.subject);
  const chip = (title, extra) => { const on = mk.picked.includes(title); return `<button class="ph-chip mk-topic ${on ? "on" : ""}" data-mktopic="${safe(title)}" aria-pressed="${on}"><span>${safe(title)}</span>${extra || ""}${on ? `<b class="ph-tick" aria-hidden="true">✓</b>` : ""}</button>`; };
  const aiList = ai ? [...ai.list].sort((a, b) => b.now - a.now) : [];
  const learned = learnedTopics(s, mk.subject).filter(t => !aiList.some(x => x.title.toLowerCase() === t.toLowerCase()));
  const aiPart = ai ? `<div class="ph-chips">${aiList.map(t => chip(t.title, t.now ? `<small class="mk-now">📍 Now in class</small>` : t.term ? `<small>${safe(t.term)}</small>` : "")).join("")}</div>`
    : aiWait === "topics" ? `<p class="sc-empty">🤖 Finding the topics…</p>`
    : `<div class="btnrow"><button class="primary" data-mkload data-aiwait="topics">🤖 Find the topics</button></div>`;
  return `<div class="card mk-card"><div class="sc-head"><h2>${f ? safe(f.emoji) : "📘"} ${safe(mk.subject)}</h2><button class="linkbtn" data-mksub="">Change subject</button></div>
    <h3 class="ph-group">2️⃣ Pick one or more topics</h3>
    <div class="mk-aihead"><b>📚 This year's topics</b>${ai ? `<button class="linkbtn" data-mkload data-aiwait="topics" aria-label="Find the topics again">🔄 Again</button>` : ""}</div>
    ${aiPart}
    ${learned.length ? `<b class="mk-label">📥 Learned already</b><div class="ph-chips">${learned.map(t => chip(t)).join("")}</div>` : ""}
    ${mk.typed.length ? `<b class="mk-label">✍️ Typed</b><div class="ph-chips">${mk.typed.map(t => chip(t)).join("")}</div>` : ""}
    <div class="row mk-type"><div><label class="small" for="mkType">✍️ Or type a topic</label><input type="text" id="mkType" maxlength="60" placeholder="Fractions, the water cycle…"></div></div>
    <div class="btnrow"><button data-mkadd>➕ Add</button></div>
    <h3 class="ph-group">3️⃣ How many questions?</h3>
    <div class="mk-counts">${MAKE_COUNTS.map(n => `<button class="${mk.count === n ? "on" : ""}" data-mkcount="${n}" aria-pressed="${mk.count === n}">${n}</button>`).join("")}</div>
    <div class="btnrow mk-go"><button class="primary" data-mkgo data-aiwait="make" ${mk.picked.length ? "" : "disabled"}>✨ Make it${mk.picked.length ? ` (${mk.picked.length} ${mk.picked.length === 1 ? "topic" : "topics"})` : ""}</button></div></div>`;
}
async function makeFromPicker() {
  if (!mk || !mk.subject || !mk.picked.length) return toast("Tap a topic first 🙂");
  const kid = schoolKid, s = schoolFor(kid), topics = [...mk.picked], count = mk.count;
  const folderId = ensureFolder(s, mk.subject), subject = s.subjects[folderId].name;
  // 🧭 A level check only when the subject's level isn't known yet (once a subject); otherwise 🔁 / 🚀
  const mode = levelAnswered(kid, { id: folderId, name: subject }) ? pickMode(kid, subject) : "level_check";
  writeData();   // (a new subject folder)
  const id = await newWorksheet(kid, subject, topics, count, mode, "make", { part: topics[0] }, false);
  if (!id) return;
  mk = null;
  goSchool("subject", folderId, "todo");
  toast("✨ Your worksheet is ready! 🖨️ Print or 📄 PDF.", 4000);
}
function makeTap(ds) {
  if (ds.mkopen !== undefined) return openMake(ds.mkopen);
  if (!mk) return;
  if (ds.mksub !== undefined) { mk = { subject: ds.mksub, picked: [], typed: [], count: mk.count }; render(); return maybeLoadTopics(); }
  if ("mkother" in ds) { const v = $("mkOther").value.trim().slice(0, 30); if (!v) return; mk.subject = v; render(); return maybeLoadTopics(); }
  if (ds.mktopic) { mk.picked = mk.picked.includes(ds.mktopic) ? mk.picked.filter(t => t !== ds.mktopic) : [...mk.picked, ds.mktopic].slice(0, 8); return render(); }
  if ("mkadd" in ds) { const v = $("mkType").value.trim().slice(0, 60); if (!v) return; if (!mk.typed.includes(v)) mk.typed.push(v); if (!mk.picked.includes(v)) mk.picked.push(v); return render(); }
  if (ds.mkcount) { mk.count = Number(ds.mkcount); return render(); }
  if ("mkload" in ds) return loadTopics();
  if ("mkgo" in ds) return makeFromPicker();
}
const MAKE_KEYS = ["mkopen", "mksub", "mkother", "mktopic", "mkadd", "mkcount", "mkload", "mkgo"];

// 🚀 Challenge when the last 3 checks of the subject average 85% or more,
// but back to 🔁 practice when a challenge among them scored under 60%
function pickMode(kid, subject) {
  const last3 = checkedOf(kid, subject).slice(0, 3);
  if (last3.some(w => w.purpose === "challenge" && wsPct(w) < 60)) return "practice";
  return last3.length === 3 && avgPct(last3) >= 85 ? "challenge" : "practice";
}
// One short text about the kid in this subject: 👤 the Kid profile + the last check's 💪 / 🎯 ("" when there's nothing)
function profileText(kid, subject) {
  const s = schoolOf(kid), p = s.profile, f = folderOf(s, subject), x = f && p.subjects[f.id], last = checkedOf(kid, subject)[0], out = [];
  if (x && x.level) out.push(`Level ${x.level} of 3 (${LEVEL_WORDS[x.level]}${x.unsure ? ", from a placement test" : ""})`);
  else if (x && x.unsure) out.push("Level not known yet (the parents are not sure)");
  if (x && x.good) out.push("Good at: " + x.good);
  if (x && x.hard) out.push("Finds hard: " + x.hard);
  if (p.other) out.push("Also: " + p.other);
  if (last && last.check.strong_points && last.check.strong_points.length) out.push("Last strong points: " + last.check.strong_points.join(", "));
  if (last && last.check.weak_points && last.check.weak_points.length) out.push("Last weak points: " + last.check.weak_points.join(", "));
  return out.join(". ").slice(0, 800);
}
// ---------- 🧠 LEARNING PROFILE (adaptive worksheets): per kid per subject, in data.school[kid].learn[subject id] ----------
// { level 1–10 (5 = right at their school year), skills: { name: { mastery 0–100, tries, right, last } }, history: [{ date, ws, pct, level, hand? }] }
// Starts at 5, or from the subject's level (👤 the parent's answer / 🧪 the placement test: 1 → 3, 2 → 5, 3 → 7).
// After every checked worksheet: each skill's mastery = 40% the new answers + 60% the old; the level follows the server's
// suggested_level but moves at most ±1 a worksheet (2 in a row ≥ 85 % → +1, 2 in a row < 50 % → −1). Parents can set it by hand (− / +).
// Every new worksheet sends level, skills and focus = the 3 weakest skills (mastery < 60, most tries first).
const LEARN_START = { 1: 3, 2: 5, 3: 7 };
const learnStart = (s, fid) => { const x = s.profile.subjects[fid]; return (x && LEARN_START[x.level]) || 5; };
// Read only (a default one when there's none yet), or null when the subject has no folder
function learnRead(kid, subject) {
  const s = schoolOf(kid), f = folderOf(s, subject);
  return !f ? null : (s.learn || {})[f.id] || { level: learnStart(s, f.id), skills: {}, history: [] };
}
// To change it (made the first time)
function learnFor(kid, subject) {
  const s = schoolFor(kid), f = folderOf(s, subject);
  if (!f) return null;
  if (!s.learn) s.learn = {};
  return s.learn[f.id] || (s.learn[f.id] = { level: learnStart(s, f.id), skills: {}, history: [] });
}
const skillList = L => Object.entries(L.skills).map(([skill, v]) => ({ skill, ...v }));
const weakSkills = L => skillList(L).filter(x => x.mastery < 60).sort((a, b) => b.tries - a.tries || a.mastery - b.mastery);
const strongSkills = L => skillList(L).filter(x => x.mastery >= 80).sort((a, b) => b.mastery - a.mastery);
// What a new worksheet sends: { level, skills, focus } (focus: the 3 weakest, or the one skill of ✏️ Practise this)
function learnBody(kid, subject, focus) {
  const L = learnRead(kid, subject);
  if (!L) return {};
  return { level: L.level, skills: skillList(L).sort((a, b) => b.tries - a.tries).slice(0, 30).map(x => ({ skill: x.skill, mastery: x.mastery })),
           focus: focus && focus.length ? focus : weakSkills(L).slice(0, 3).map(x => x.skill) };
}
// After a checked worksheet: skills, level and history (a worksheet checked again only updates its % in the history)
function learnAfterCheck(w, c, wsId) {
  const L = learnFor(w.kid, w.subject);
  if (!L || !(c.max_score > 0)) return;
  const today = todayYmd(), pct = Math.round(c.score / c.max_score * 100), seen = L.history.find(h => h.ws === wsId);
  // 🔗 Per topic (each question's topic; older / ⚡ instant: the worksheet's part, the topic found in the file): its % and its skills
  const src = w.src === "instant" || w.src === "igcse" ? w.src : "school", fallback = String(w.part || w.topics[0] || w.title || "").trim().slice(0, 80);
  const byTopic = {};
  c.questions.forEach(q => {
    const wq = w.questions.find(x => x.number === q.number) || {}, title = String(q.topic || wq.topic || fallback).trim().slice(0, 80);
    if (!title) return;
    const t = byTopic[lowerT(title)] || (byTopic[lowerT(title)] = { title, got: 0, most: 0, qs: [] }), most = wq.points || 1;
    t.got += Math.min(most, q.points || 0); t.most += most; t.qs.push(q);
  });
  if (!c.questions.length && fallback) byTopic[lowerT(fallback)] = { title: fallback, got: c.score, most: c.max_score, qs: [] };
  if (!L.topics) L.topics = {};
  Object.values(byTopic).forEach(t => {
    const key = topicKey(t.title), T = L.topics[key] || (L.topics[key] = { title: t.title, src, results: [], skills: {} });
    T.results = [...T.results.filter(r => r.ws !== wsId), { date: today, ws: wsId, pct: t.most ? Math.round(t.got / t.most * 100) : pct }].slice(-12);
    if (!seen) addSkills(T.skills, w, t.qs, today);
  });
  if (seen) { seen.pct = pct; return; }   // (checked again: only its %)
  addSkills(L.skills, w, c.questions, today);
  const prev = [...L.history].reverse().find(h => !h.hand);
  let level = c.suggested_level ? Math.max(L.level - 1, Math.min(L.level + 1, c.suggested_level)) : L.level;
  if (prev && prev.pct >= 85 && pct >= 85) level = L.level + 1;
  else if (prev && prev.pct < 50 && pct < 50) level = L.level - 1;
  L.level = Math.max(1, Math.min(10, level));
  L.history = [...L.history, { date: today, ws: wsId, pct, level: L.level }].slice(-30);
}
// Each skill from some marked questions: mastery = 40 % the new answers + 60 % the old, tries and right counted
function addSkills(skills, w, qs, today) {
  const by = {};
  qs.forEach(q => {
    const wq = w.questions.find(x => x.number === q.number) || {}, name = String(q.skill || wq.skill || "").trim().slice(0, 60);
    if (!name) return;
    const x = by[name] || (by[name] = { n: 0, sum: 0, right: 0 });
    x.n++; x.sum += q.correct ? 1 : Math.min(1, (q.points || 0) / (wq.points || 1)); x.right += q.correct ? 1 : 0;
  });
  Object.entries(by).forEach(([name, x]) => {
    const old = skills[name], now = Math.round(x.sum / x.n * 100);
    skills[name] = { mastery: old ? Math.round(0.4 * now + 0.6 * old.mastery) : now, tries: (old ? old.tries : 0) + x.n, right: (old ? old.right : 0) + x.right, last: today };
  });
}
// 👨‍👩‍👧 A parent sets the level by hand (− / +)
function learnSetLevel(kid, fid, step) {
  if (!isParentDevice()) return;
  const s = schoolFor(kid), f = s.subjects[fid];
  if (!f) return;
  const L = learnFor(kid, f.name), level = Math.max(1, Math.min(10, L.level + step));
  if (level === L.level) return;
  L.level = level;
  L.history = [...L.history, { date: todayYmd(), ws: "", pct: 0, level, hand: true }].slice(-30);
  writeData();
  render();
}
// ✏️ Practise this: a worksheet focused on that one skill (opens in 🎒 when it's showing)
async function learnPractise(kid, fid, skill) {
  if (!isParentDevice()) return;
  const f = schoolOf(kid).subjects[fid];
  if (!f || !skill) return;
  const id = await newWorksheet(kid, f.name, [skill], 10, "practice", "learn|" + kid + "|" + skill, { part: skill, focus: [skill] });
  if (id) toast(`📝 A ${f.name} worksheet on “${skill}” is ready${screen === "school" ? "" : ` in ${kidNameOf(kid)}'s 🎒 School`}!`, 3500);
}
// The small line chart of the level over time (1–10)
function learnChartSvg(L) {
  const pts = (L.history.length ? L.history : [{ level: L.level }]).map(h => h.level), W = 240, H = 64, n = pts.length;
  const xy = pts.map((v, i) => `${n > 1 ? Math.round(6 + i * (W - 12) / (n - 1)) : W / 2},${Math.round(H - 6 - (v - 1) * (H - 12) / 9)}`);
  return `<svg class="learn-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Level over time: ${pts.join(", ")}">
    <line x1="0" x2="${W}" y1="${Math.round(H - 6 - 4 * (H - 12) / 9)}" y2="${Math.round(H - 6 - 4 * (H - 12) / 9)}" class="learn-mid"/>
    <polyline points="${xy.join(" ")}" class="learn-line"/>${xy.map(p => { const [x, y] = p.split(","); return `<circle cx="${x}" cy="${y}" r="3" class="learn-dot"/>`; }).join("")}</svg>`;
}
// 🔗 The profile's topics with results: the school topics (see STUDY TOPICS), plus ⚡ instant and 🌍 extra ones (only in the profile)
// → [{ title, src, st, pct (the last 3 average), weak: [weak skills] }]
function learnTopicRows(kid, f) {
  const s = schoolOf(kid), L = (s.learn || {})[f.id], out = [], school = topicRows(kid, s, f);
  school.filter(t => t.info.results.length).forEach(t => out.push({ title: t.title, src: "school", st: t.st, pct: meanPct(t.info.results.slice(-3).map(x => x.pct)), weak: topicWeak(t.info) }));
  Object.values((L && L.topics) || {}).filter(T => T.results.length && !school.some(t => lowerT(t.title) === lowerT(T.title))).forEach(T => {
    const info = { results: T.results, list: [{}], skills: T.skills };
    out.push({ title: T.title, src: T.src, st: topicStatus(info), pct: meanPct(T.results.slice(-3).map(x => x.pct)), weak: topicWeak(info) });
  });
  return out;
}
// 🧠 Parents: level x/10 (− / +) with the chart, 💪 strong topics, 🎯 weaknesses by topic ("🔴 Fractions (52%): weak at …", ✏️ Practise this topic)
function learnCardHtml(kid, f) {
  const L = learnRead(kid, f.name);
  if (!L) return "";
  const enc = x => safe(encodeURIComponent(x)), rows = learnTopicRows(kid, f);
  const tag = r => r.src === "instant" ? " <small>⚡ instant</small>" : r.src === "igcse" ? ` <small>🌍 ${safe(mapLabel(kid))} extra</small>` : "";
  const strong = rows.filter(r => r.st === "mastered" || r.pct >= 85).sort((a, b) => b.pct - a.pct), weak = rows.filter(r => !strong.includes(r)).sort((a, b) => a.pct - b.pct);
  const skillsPart = () => { const sk = weakSkills(L).slice(0, 6);   // (older profiles: skills only)
    return sk.length ? `<ul class="learn-weak">${sk.map(x => `<li><span>${safe(x.skill)} <small>${x.mastery}% · ${x.right}/${x.tries} right</small></span>
        <button class="pill" data-learnpr="${safe(kid)}|${safe(f.id)}|${enc(x.skill)}" data-aiwait="learn|${safe(kid)}|${safe(x.skill)}">✏️ Practise this</button></li>`).join("")}</ul>`
      : `<p class="hint">Nothing to work on right now.</p>`; };
  return `<div class="learn-box"><div class="learn-top"><span class="learn-sub">${safe(f.emoji)} ${safe(f.name)}</span>
      <span class="learn-lv"><button class="pill" data-learnlv="${safe(kid)}|${safe(f.id)}|-1" aria-label="Level down" ${L.level <= 1 ? "disabled" : ""}>−</button>
      <b>Level ${L.level}/10</b><button class="pill" data-learnlv="${safe(kid)}|${safe(f.id)}|1" aria-label="Level up" ${L.level >= 10 ? "disabled" : ""}>+</button></span></div>
    ${learnChartSvg(L)}
    <p class="learn-h">💪 Strong</p>${strong.length ? `<div class="learn-chips">${strong.map(r => `<span class="learn-chip good">${safe(r.title)} <small>${r.pct}%</small></span>`).join("")}</div>`
      : `<p class="hint">None yet (85% or more).</p>`}
    <p class="learn-h">🎯 To work on</p>${weak.length ? `<ul class="learn-weak">${weak.map(r => `<li><span>${ST[r.st][0]} ${safe(r.title)} (${r.pct}%)${tag(r)}${r.weak.length ? `<small>weak at ${safe(r.weak.join(", "))}</small>` : ""}</span>
        <button class="pill" data-learntp="${safe(kid)}|${safe(f.id)}|${enc(r.title)}|${r.src}" data-aiwait="ltp|${safe(kid)}|${safe(r.title)}">✏️ Practise this topic</button></li>`).join("")}</ul>`
      : rows.length ? `<p class="hint">Nothing to work on right now.</p>` : skillsPart()}</div>`;
}
// 🧒 The kid's friendly line: "🧠 Level 6 in Math · 💪 You're great at fractions · 🎯 Let's practise times tables"
function learnKidLine(kid, f) {
  const L = learnRead(kid, f.name), rows = L ? learnTopicRows(kid, f) : [];
  if (!L || (!L.history.length && !rows.length)) return "";
  const best = rows.filter(r => r.pct >= 80).sort((a, b) => b.pct - a.pct)[0], low = rows.filter(r => r.pct < 60).sort((a, b) => a.pct - b.pct)[0];
  const great = best ? best.title : (strongSkills(L)[0] || {}).skill, practise = low ? low.title : (weakSkills(L)[0] || {}).skill;
  return `<p class="learn-kid">🧠 Level ${L.level} in ${safe(f.name)}${great ? ` · 💪 You're great at ${safe(great)}` : ""}${practise ? ` · 🎯 Let's practise ${safe(practise)}` : ""}</p>`;
}
// 📊 How are my kids doing?: every subject with a learning profile (or a checked worksheet)
function learnReportHtml(kid) {
  const s = schoolOf(kid), list = subjectList(s).filter(f => (s.learn || {})[f.id]);
  return list.length ? list.map(f => learnCardHtml(kid, f)).join("") : `<p class="sc-empty">No checked worksheets yet: the profile starts with the first one.</p>`;
}
// ✏️ Practise this topic: a worksheet on it, focused on its weak skills (a 🌍 extra topic stays "extra")
async function learnPractiseTopic(kid, fid, title, src) {
  if (!isParentDevice()) return;
  const f = schoolOf(kid).subjects[fid];
  if (!f || !title) return;
  const row = learnTopicRows(kid, { id: fid, ...f }).find(r => lowerT(r.title) === lowerT(title)), focus = row ? row.weak : [];
  const id = await newWorksheet(kid, f.name, [title], 10, "practice", "ltp|" + kid + "|" + title,
    { part: title, ...(focus.length ? { focus } : {}), ...(src === "igcse" ? { src: "igcse" } : {}),
      sections: [{ topic: title, minutes: 20, focus, kind: row && row.st === "needs" ? "needs_work" : "practising" }] });
  if (id) toast(`📝 A ${f.name} worksheet on “${title}” is ready${screen === "school" ? "" : ` in ${kidNameOf(kid)}'s 🎒 School`}!`, 3500);
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-learnlv], [data-learnpr], [data-learntp]");
  if (!b || !isParentDevice()) return;
  if (b.dataset.learnlv) { const [kid, fid, step] = b.dataset.learnlv.split("|"); return learnSetLevel(kid, fid, Number(step)); }
  if (b.dataset.learntp) { const [kid, fid, title, src] = b.dataset.learntp.split("|"); return learnPractiseTopic(kid, fid, decodeURIComponent(title || ""), src); }
  const [kid, fid, skill] = b.dataset.learnpr.split("|");
  learnPractise(kid, fid, decodeURIComponent(skill || ""));
});
// ---------- 🇦🇪 ARABIC WORKSHEETS · 🌐 ARABIC TRANSLATION OF QUESTIONS ----------
// An Arabic / Islamic subject (Islamic studies, Quran, Tarbiya, دين, عربي …) → lang "ar": the whole worksheet in Arabic, right-to-left.
// Any other subject → translate: true when "🌐 Arabic translation of questions" is on for that kid (remembered on this device):
// each question then has question_ar, shown small and grey under it, right-to-left.
const AR_SUBJECT = /arab|islam|quran|qur'?an|tarbiya|عرب|إسلام|اسلام|دين|قرآن|تربية/i;
const isArabicSubject = name => AR_SUBJECT.test(String(name || ""));
const isArabicWs = w => w.lang === "ar" || isArabicSubject(w.subject);
const TR_KEY = SAVE_KEY + ".translate.";
const translateOn = kid => { try { return localStorage.getItem(TR_KEY + kid) === "1"; } catch (e) { return false; } };
const setTranslate = (kid, on) => { try { localStorage.setItem(TR_KEY + kid, on ? "1" : "0"); } catch (e) {} };
// What goes to the worksheet server (and lang is kept on the worksheet)
const langBody = (kid, subject) => isArabicSubject(subject) ? { lang: "ar" } : translateOn(kid) ? { translate: true } : {};
// The toggle (not for an Arabic / Islamic subject: those are all in Arabic)
const translateToggleHtml = (kid, subject) => isArabicSubject(subject) ? "" :
  `<label class="checkline tr-toggle"><input type="checkbox" data-translate="${safe(kid)}" ${translateOn(kid) ? "checked" : ""}> 🌐 Arabic translation of questions</label>`;
document.addEventListener("change", e => {
  if (!e.target.matches || !e.target.matches("[data-translate]")) return;
  setTranslate(e.target.dataset.translate, e.target.checked);
  toast(e.target.checked ? "🌐 New worksheets will have an Arabic translation of each question." : "🌐 No Arabic translation on new worksheets.", 3000);
});
// "Wed 29 Oct 2026" (the day the worksheet was made)
const wsDateText = s => { if (!isYmd(s)) return ""; const d = fromYmd(s); return `${SHORT[weekdayOf(s)]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
// The header on every worksheet (screen, PDF and answer key PDF): Name · Subject · Date
const wsHeaderNode = (w, first) => h("div", { class: "ws-namerow ws-head", dir: "ltr" },
  first ? h("span", null, first + " ·") : null,
  h("span", null, "Name: ", h("b", null, kidNameOf(w.kid)), " ·"), h("span", null, "Subject: ", h("b", null, w.subject || "–"), " ·"),
  h("span", null, "Date: ", h("b", null, wsDateText(w.date))));
// A new worksheet from the AI, saved (and opened when open = true). extra = { part, work?, title? }. → its id, or null.
async function newWorksheet(kid, subject, topics, count, mode, key, extra, open = true) {
  // (📚 a study session's worksheet: extra.minutes = the session's minutes → the AI fills them; sections = its parts in order;
  //  ⚡ instant + files = only about the file (never kept); avoid = questions already given; focus = the skills to practise.
  //  Those go to the AI only: the rest of extra is saved with the worksheet.)
  const { files, instant, sections, avoid, focus, ...keep } = extra || {};
  const minutes = keep.minutes >= 5 && keep.minutes <= 240 ? Math.round(keep.minutes) : 0;
  const r = await callAi("worksheet", { ...kidInfo(kid), subject, topics, count, notes: MODE_NOTES[mode],
                                        mode, profile: profileText(kid, subject), ...schoolSystemOf(kid), ...(minutes ? { minutes } : {}),
                                        ...(sections && sections.length ? { sections } : {}), ...(instant ? { instant: true, files } : {}),
                                        ...(avoid && avoid.length ? { avoid } : {}), ...learnBody(kid, subject, focus),   // (🧠 level, skills, focus)
                                        ...langBody(kid, subject) }, key);   // (🇦🇪 Arabic / 🌐 translation)
  if (!r) return null;
  const found = aiTxt(r.detected_topic, 80), name = subject || aiTxt(r.detected_subject, 30) || "Other";   // (⚡ the topic in the file)
  const ws = cleanWorksheet({ ...r, kid, subject: name, topics: topics.length ? topics : [found || name], count, date: todayYmd(), by: me, ...(langBody(kid, subject).lang ? { lang: "ar" } : {}),
                              at: new Date().toISOString(), answers: [], purpose: mode, ...(instant && found ? { part: found } : {}), ...keep });
  if (!ws) { toast("🤖 The worksheet came back empty. Please try again.", 4000); return null; }
  delete ws.check;
  const id = newId();
  aiSave("worksheets", id, ws);
  if (open && screen === "school" && schoolKid === kid) openAiDoc("worksheet", id);
  // (👨‍👩‍👧 a parent who makes it earns no school points: the kid earns them when they finish it)
  return id;
}
async function makeLevelCheck(kid, workId) {
  const s = schoolOf(kid), w = s.work[workId];
  if (!w) return;
  const f = folderOf(s, w.subject);
  schoolLevel = { kid, folder: f ? f.id : null, work: workId, title: w.title, subject: w.subject, state: "making" };
  if (screen === "school") render();
  const ok = await newWorksheet(kid, w.subject, w.topics.length ? w.topics : [w.title], LEVEL_COUNT, "level_check", "level", { work: workId, part: w.title });
  schoolLevel = ok ? null : { ...schoolLevel, state: "failed" };
  if (ok) toast("🧭 The level check is ready! Get its 📄 PDF, then ⬆ upload the answers.", 4500);
  else if (screen === "school") render();
}
// 🔁 Make practice for this: one 🎯 weak point of the subject's last check
async function makePractice(i) {
  const kid = schoolKid, s = schoolOf(kid), f = s.subjects[schoolSubject], last = f && checkedOf(kid, f.name)[0];
  const point = last && (last.check.weak_points || [])[Number(i)];
  if (!point) return;
  const ok = await newWorksheet(kid, f.name, [point], PRACTICE_COUNT, "practice", "practice|" + i, { part: partOf(last, s) });
  if (ok) toast("🔁 Your practice worksheet is ready!", 2500);
}
$("aiFile").addEventListener("change", e => {
  const files = [...e.target.files], target = aiPick;
  aiPick = null;
  e.target.value = "";
  if (!files.length || !target) return;
  if (target === "work") return addUploadFiles(files);   // (⬆️ Upload: see STUDY TOPICS)
  if (target === "newsletter") return addNewsletterFiles(files);
  if (target === "syllabus") return addSyllabus(files);
  if (target.ws) return addAnswerFiles(target.ws, files);
});
