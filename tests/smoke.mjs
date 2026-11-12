// 🧪 Screen test. Run: cd tests && npm run smoke
//
// Opens the app in a phone-sized browser as a FILE (this-device-only mode), so it never signs in
// and never touches the family's real data in Firebase. Firebase is blocked on purpose.
// Then: loads the example week, opens every screen as a parent and as a kid, shows a checked
// worksheet, and does a pretend AI check (the AI server is faked, so it costs nothing).
// Any JavaScript error = the test fails.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");   // (installed by package.json, or the one already on this computer)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCREENS = ["home", "add", "mine", "extra", "diary", "points", "settings", "family", "school", "report", "kidswork", "me"];
const errors = [];
let step = "start";

// A worksheet and its check, the way the AI server sends them
const FAKE_CHECK = { score: 4, max_score: 5, overall_note: "Good work!", strong_points: ["Adding"], weak_points: ["Carrying"],
  coach_tip: "Practise carrying.", questions: [
    { number: 1, correct: true, points: 3, note: "Right", your_answer: "12", askTo: ["dad"], fixedBy: "dad" },
    { number: 2, correct: false, points: 1, note: "Almost", your_answer: "8", ask: true }] };
const FAKE_WS = { kid: "ex-kid1", subject: "Math", date: "2026-11-01", by: "dad", at: "test", title: "Adding practice", intro: "Add the numbers.",
  topics: ["Adding"], count: 2, answers: ["ans1"], check: FAKE_CHECK, questions: [
    { number: 1, kind: "short_answer", prompt: "7 + 5 = ?", answer: "12", points: 3, topic: "Adding", skill: "carrying", difficulty: 3 },
    { number: 2, kind: "multiple_choice", prompt: "4 + 5 = ?", options: ["8", "9", "10"], answer: "9", points: 2 }] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", e => { if (!e.message.includes("TEST-BOOM")) errors.push(`[${step}] ${e.message}`); });
// (a website that can't be reached is the internet, not the app: not counted)
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|TEST-BOOM/.test(m.text())) errors.push(`[${step}] console: ${m.text().slice(0, 300)}`); });
page.on("dialog", d => d.accept());   // (a "Replace everything?" box: yes)
// No real internet services: Firebase blocked; the AI server answers with the fake check
await page.route("**/*", route => {
  const url = route.request().url();
  if (url.startsWith("https://family-plan-ai.")) return route.fulfill({ status: 200, contentType: "application/json",
    headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ result: FAKE_CHECK }) });
  if (url.includes("gstatic.com/firebasejs") || url.includes("googleapis.com/") && !url.includes("fonts.")) return route.abort();
  return route.continue();
});

async function run(name, fn, arg) {
  step = name;
  try { return await page.evaluate(fn, arg); }
  catch (e) { errors.push(`[${name}] ${e.message.split("\n")[0]}`); return null; }
}

try {
  step = "open the app";
  await page.goto(pathToFileURL(join(ROOT, "index.html")).href, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  // The example week (the parent is the first person)
  await run("example week", () => { me = DAD; go("settings"); document.getElementById("exampleBtn").click(); });
  await page.waitForTimeout(500);

  // ✅ The AI's answers are cleaned the same way the app does it (the v161 bug broke exactly this)
  const ok = await run("clean a worksheet + check", ws => {
    const w = cleanWorksheet(ws), c = cleanCheck(ws.check, 5);
    return !!(w && w.check && w.questions.length === 2 && c && c.questions.length === 2 && c.questions[0].askTo.length === 1);
  }, FAKE_WS);
  if (ok === false) errors.push("[clean a worksheet + check] the worksheet or its check came back empty");

  // 🔢 A "put in order" question whose items are only in its text gets lettered items (A, B, C …) for the answer sheet
  const ordered = await run("ordering items", () => {
    const w = cleanWorksheet({ title: "t", questions: [
      { number: 1, kind: "ordering", prompt: "Put these in order: egg; caterpillar; pupa; butterfly", options: [], answer: "egg; caterpillar; pupa; butterfly", points: 2 },
      { number: 2, kind: "ordering", prompt: "Put the steps in order.", options: [], answer: "x", points: 1 }] });
    const [a, b] = w.questions;
    return a.options.length === 4 && a.prompt === "Put these in order:" && b.kind === "short_answer" && b.answer_lines >= 2 ? "ok" : JSON.stringify([a, b]);
  });
  if (ordered !== "ok") errors.push("[ordering items] " + ordered);

  // ✍️ Choices that differ only in punctuation (where the speech marks go): the right letter is found, never a look-alike
  const punct = await run("punctuation choices", () => {
    const opts = ['"Let\'s play football, said Taha."', '"Let\'s play football," said Taha.', 'Let\'s play football, "said Taha."'];
    return optFind(opts, '“Let’s play football,” said Taha.') === 1 && optFind(opts, "Lets play football said Taha") === -1 ? "ok" : "wrong letter";
  });
  if (punct !== "ok") errors.push("[punctuation choices] " + punct);

  // ✅ An answer exactly like the key is always right (the AI once marked "1-B, 2-C, 3-A" wrong with the key "1-B, 2-C, 3-A")
  const sure = await run("answer same as key", () => {
    const w = { subject: "English", questions: [
      { number: 1, kind: "matching", options: [], left: ["a", "b", "c"], right: ["x", "y", "z"], answer: "1-B, 2-C, 3-A", points: 3 },
      { number: 2, kind: "multiple_choice", options: ["3", "4", "5"], answer: "4", points: 1 },
      { number: 3, kind: "multiple_choice", options: ["3", "4", "5"], answer: "4", points: 1 }] };
    const c = { score: 1, max_score: 5, questions: [
      { number: 1, correct: false, points: 0, your_answer: "1-B, 2-C, 3-A" },
      { number: 2, correct: false, points: 0, your_answer: "B" },
      { number: 3, correct: false, points: 0, your_answer: "C" }] };
    wsSureRight(w, c);
    return c.questions[0].correct && c.questions[1].correct && !c.questions[2].correct && c.score === 5 ? "ok" : JSON.stringify(c);
  });
  if (sure !== "ok") errors.push("[answer same as key] " + sure);

  // 🛡️ A new worksheet's guard: a choice question whose answer isn't a choice becomes a written question; good ones stay
  const guard = await run("new worksheet guard", () => {
    const w = wsGuard({ subject: "Maths", questions: [
      { number: 1, kind: "multiple_choice", options: ["3", "4", "5"], answer: "4", answer_lines: 0, points: 1 },
      { number: 2, kind: "multiple_choice", options: ["3", "4", "5"], answer: "7", answer_lines: 0, points: 1 },
      { number: 3, kind: "true_false", options: ["True", "False"], answer: "False", answer_lines: 0, points: 1 },
      { number: 4, kind: "matching", options: ["cat"], answer: "x", answer_lines: 0, points: 1 }] });
    const k = w.questions.map(q => q.kind).join();
    return k === "multiple_choice,short_answer,true_false,short_answer" && w.questions[1].answer_lines === 2 ? "ok" : k;
  });
  if (guard !== "ok") errors.push("[new worksheet guard] " + guard);

  // 🔤 "Put the letters in order to make a word" is a spelling question (the kid writes the word), never A B C D bits of instructions
  const unscr = await run("unscramble letters", () => {
    const w = cleanWorksheet({ questions: [{ number: 1, kind: "ordering", prompt: "Put the letters in the right order to make a word: H T G N E L", options: ["Rearrange the letters", "into one word", "then check it", "with a friend"], answer: "length", points: 1 },
      { number: 2, kind: "ordering", prompt: "Order the steps: Rearrange the letters, into one word, then check it", options: [], answer: "x", points: 1 }] });
    return w.questions.every(q => q.kind === "short_answer" && !q.options.length) ? "ok" : JSON.stringify(w.questions.map(q => [q.kind, q.options]));
  });
  if (unscr !== "ok") errors.push("[unscramble letters] " + unscr);

  // 🔑 Key words: a parent saves them for a kid's subject → new worksheets and the check get them; cleared → gone
  const words = await run("key words", () => {
    const kid = "ex-kid1", sub = (subjectList(schoolOf(kid), true)[0] || {}).name;
    if (!sub) return "no subject";
    const host = document.createElement("div"); host.innerHTML = wsWordsHtml(kid, sub); document.body.appendChild(host);
    const box = host.querySelector("textarea"), btn = host.querySelector("[data-wswords]");
    if (!box || !btn) { host.remove(); return "no key words box"; }
    box.value = "evaporation = water turns into a gas\n\n condensation = gas turns into water "; btn.click();
    const saved = wsWordsOf(kid, sub), inWs = wsKidNote(kid, sub, "practice").includes("evaporation = water turns into a gas; condensation"),
          inCheck = wsWordsCheck(kid, sub).includes("SAME thing");
    box.value = ""; btn.click(); host.remove();
    return saved === "evaporation = water turns into a gas\ncondensation = gas turns into water" && inWs && inCheck && !wsWordsOf(kid, sub) ? "ok" : JSON.stringify({ saved, inWs, inCheck });
  });
  if (words !== "ok") errors.push("[key words] " + words);

  // A checked worksheet in the School binder
  await run("add a checked worksheet", ws => { aiDocs.worksheets.testws = cleanWorksheet(ws); }, FAKE_WS);
  // 🟡 Part marks: a parent gives 2 of Q1's 3 points → kept after cleaning, score goes up by 2
  const part = await run("part marks", () => {
    const before = aiDocs.worksheets.testws.check.score;
    fixQuestion("testws", 1, "part:2");
    const c = aiDocs.worksheets.testws.check, q = cleanCheck(JSON.parse(JSON.stringify(c)), 5).questions[0];
    const ok = q.fixed === "part" && q.points === 2 && !q.correct && c.score === before - 3 + 2;
    fixQuestion("testws", 1, "right");
    return ok && aiDocs.worksheets.testws.check.score === before ? "ok" : JSON.stringify({ before, c });
  });
  if (part !== "ok") errors.push("[part marks] " + part);

  // 🔑 v191 Key words box: kept by cleanWorksheet, printed on the paper, a parent's tick box takes it off
  const kbox = await run("key words box", () => {
    const w = cleanWorksheet({ title: "t", key_words: ["evaporation = gas", "condensation", "condensation", ""], questions: [{ number: 1, kind: "short_answer", prompt: "Why?", answer: "x", points: 1 }] });
    if (JSON.stringify(w.key_words) !== '["evaporation","condensation"]') return "clean: " + JSON.stringify(w.key_words);
    const on = document.createElement("div"); on.appendChild(wsSheetNode(w, false));
    if (!on.querySelector(".ws-keybox") || !on.querySelector(".ws-keybox").textContent.includes("condensation")) return "no box on the paper";
    aiDocs.worksheets.kwtest = { ...w, kid: "ex-kid1", subject: "Science", answers: [] };
    const ed = document.createElement("div"); ed.appendChild(wsKeyEditNode(aiDocs.worksheets.kwtest, "kwtest")); document.body.appendChild(ed);
    const tick = ed.querySelector("[data-kwtick]"); tick.checked = false; tick.dispatchEvent(new Event("change", { bubbles: true }));
    const off = aiDocs.worksheets.kwtest, kept = cleanWorksheet(off).kwOff === true;
    const paper = document.createElement("div"); paper.appendChild(wsSheetNode(off, false));
    ed.remove(); delete aiDocs.worksheets.kwtest;
    return off.kwOff === true && kept && !paper.querySelector(".ws-keybox") ? "ok" : JSON.stringify(off);
  });
  if (kbox !== "ok") errors.push("[key words box] " + kbox);

  // 🤖 No parent OK yet: the AI helper asks first and sends nothing
  const asked = await run("AI asks for OK first", async () => {
    data.aiOk = null;
    const r = await callAi("check", { title: "test" }, "check|test");
    const shown = !document.getElementById("aiOkModal").hidden;
    document.getElementById("aiOkYes").click();
    return r === null && shown && !!data.aiOk && document.getElementById("aiOkModal").hidden;
  });
  if (asked === false) errors.push("[AI OK] the AI helper did not ask the parent first, or the OK was not saved");

  // 🚩 The Report button on a worksheet opens the report box
  const reported = await run("report an AI answer", () => {
    const b = document.createElement("button"); b.dataset.aireport = "worksheet|testws"; document.body.appendChild(b);
    b.click(); b.remove();
    const m = document.getElementById("aiReportModal"), open = !m.hidden;
    document.getElementById("arCancel").click();
    return open && m.hidden;
  });
  if (reported === false) errors.push("[report] the Report box did not open");

  // 🤖 Pretend AI check: the app asks the (fake) server and cleans its answer
  const checked = await run("pretend AI check", async () => {
    cloud.enabled = true; cloud.user = { getIdToken: async () => "test-token" }; cloud.db = {};
    const r = await callAi("check", { title: "test" }, "check|test");
    cloud.enabled = false; cloud.user = null; cloud.db = null;
    const c = r && cleanCheck(r, 5);
    return !!(c && c.score === 4 && c.max_score === 5);
  });
  if (checked === false) errors.push("[pretend AI check] the app did not understand the AI's answer");

  // ⚠️ App problems: a pretend error is written down and shows in Settings → Backup → App problems
  await run("make a pretend error", () => { setTimeout(() => { throw new Error("TEST-BOOM thrown"); }); console.error("Check:", new Error("TEST-BOOM caught")); });
  await page.waitForTimeout(300);
  const shown = await run("show app problems", async () => {
    me = DAD; go("settings"); render();
    const box = document.getElementById("errBox"); box.open = true;
    await drawAppErrors();
    const text = document.getElementById("errList").textContent;
    await clearAppErrors();
    return text.includes("TEST-BOOM thrown") && text.includes("TEST-BOOM caught") && appErrors.length === 0;
  });
  if (shown === false) errors.push("[app problems] the pretend errors were not listed in Settings");

  // 🗑️ Delete family account: with a pretend cloud, everything of this family goes, another family's data stays
  const deleted = await run("delete family account", async () => {
    const store = new Map(), path = a => a.join("/");
    const put = (p, v) => store.set(p, v);
    ["state/plan", "state/points", "state/photo-a", "files/f1", "worksheets/w1", "explanations/e1"].forEach(x => put("families/fam1/" + x, {}));
    put("families/fam1", { name: "Test" }); put("families/fam2/state/plan", {}); put("codes/KID111", { familyId: "fam1" }); put("codes/OTHER1", { familyId: "fam2" });
    put("members/fam1", { familyId: "fam1", role: "parent" }); put("members/kidA", { familyId: "fam1", role: "kid", code: "KID111" }); put("members/x", { familyId: "fam2" });
    let userGone = false;
    const ref = p => ({ path: p, id: p.split("/").pop() });
    const docs = (pre, f) => [...store.keys()].filter(k => k.startsWith(pre + "/") && k.split("/").length === pre.split("/").length + 1 && (!f || f(store.get(k))))
      .map(k => ({ id: k.split("/").pop(), ref: ref(k), data: () => store.get(k) }));
    const keep = { fb: cloud.fb, db: cloud.db, user: cloud.user, familyId: cloud.familyId };
    cloud.fb = {
      doc: (db, ...a) => ref(path(a)), collection: (db, ...a) => ({ col: path(a) }), where: (k, op, v) => ({ k, v }),
      query: (c, w) => ({ col: c.col, w }), getDocs: async q => { const list = docs(q.col, q.w && (d => d[q.w.k] === q.w.v)); return { forEach: f => list.forEach(f) }; },
      deleteDoc: async r => { store.delete(r.path); }, writeBatch: () => { const l = []; return { delete: r => l.push(r), commit: async () => l.forEach(r => store.delete(r.path)) }; },
      deleteUser: async () => { userGone = true; } };
    cloud.db = {}; cloud.user = { uid: "fam1", email: "p@x.com" }; cloud.familyId = "fam1";
    data.users.forEach(u => { if (u.id === "ex-kid1") u.code = "KID111"; });
    await deleteAccountNow();
    Object.assign(cloud, keep);
    const left = [...store.keys()].sort().join(",");
    return left === "codes/OTHER1,families/fam2/state/plan,members/x" && userGone ? "ok" : left + " · login gone " + userGone;
  });
  if (deleted !== "ok") errors.push("[delete family account] left: " + deleted);

  // 🆕 A new family starts with only its parent: no other family's kids, names or past stars
  const fresh = await run("new family", () => {
    const d = cleanData(freshFamilyData("Sam")), keep = data;
    data = d; const hall = hallWeeks().length, seeded = seedHall(); data = keep;
    const names = d.users.map(u => u.name).join(",");
    return names === "Sam" && hall <= 1 && !seeded && !/Mody|Bana|Jawad|Bro2a|Hani/.test(JSON.stringify(d)) ? "ok" : `${names} · ${hall} weeks · seeded ${seeded}`;
  });
  if (fresh !== "ok") errors.push("[new family] " + fresh);

  // Every screen, as the parent and as a kid
  for (const who of ["dad", "ex-kid1"]) {
    for (const s of SCREENS) {
      await run(`${who} → ${s}`, ([w, sc]) => { me = w; go(sc); render(); }, [who, s]);
      await page.waitForTimeout(150);
    }
  }
} finally {
  await browser.close();
}

if (!errors.length) { console.log(`✅ Screen test passed (${SCREENS.length} screens × parent + kid, AI OK, report box, pretend AI check, app problems list, delete account, new family)`); process.exit(0); }
for (const e of errors) console.error("❌ " + e);
console.error(`\n${errors.length} problem(s) found.`);
process.exit(1);
