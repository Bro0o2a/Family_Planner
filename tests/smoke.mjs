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
const FAKE_WS = { kid: "mody", subject: "Math", date: "2026-11-01", by: "dad", at: "test", title: "Adding practice", intro: "Add the numbers.",
  topics: ["Adding"], count: 2, answers: ["ans1"], check: FAKE_CHECK, questions: [
    { number: 1, kind: "short_answer", prompt: "7 + 5 = ?", answer: "12", points: 3, topic: "Adding", skill: "carrying", difficulty: 3 },
    { number: 2, kind: "multiple_choice", prompt: "4 + 5 = ?", options: ["8", "9", "10"], answer: "9", points: 2 }] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", e => errors.push(`[${step}] ${e.message}`));
// (a website that can't be reached is the internet, not the app: not counted)
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`[${step}] console: ${m.text().slice(0, 300)}`); });
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

  // A checked worksheet in the School binder
  await run("add a checked worksheet", ws => { aiDocs.worksheets.testws = cleanWorksheet(ws); }, FAKE_WS);

  // 🤖 Pretend AI check: the app asks the (fake) server and cleans its answer
  const checked = await run("pretend AI check", async () => {
    cloud.enabled = true; cloud.user = { getIdToken: async () => "test-token" }; cloud.db = {};
    const r = await callAi("check", { title: "test" }, "check|test");
    cloud.enabled = false; cloud.user = null; cloud.db = null;
    const c = r && cleanCheck(r, 5);
    return !!(c && c.score === 4 && c.max_score === 5);
  });
  if (checked === false) errors.push("[pretend AI check] the app did not understand the AI's answer");

  // Every screen, as the parent and as a kid
  for (const who of ["dad", "mody"]) {
    for (const s of SCREENS) {
      await run(`${who} → ${s}`, ([w, sc]) => { me = w; go(sc); render(); }, [who, s]);
      await page.waitForTimeout(150);
    }
  }
} finally {
  await browser.close();
}

if (!errors.length) { console.log(`✅ Screen test passed (${SCREENS.length} screens × parent + kid, pretend AI check)`); process.exit(0); }
for (const e of errors) console.error("❌ " + e);
console.error(`\n${errors.length} problem(s) found.`);
process.exit(1);
