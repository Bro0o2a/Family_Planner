// ✅ Code check (no browser needed). Run: cd tests && npm run check
//
// The app's js/ files are plain scripts that share ONE global scope. So a name that one file
// uses but that only exists inside another file (like the v161 `okKey` bug), or the same
// function name in two files, breaks the app quietly. This check reads the files in the same
// order as index.html, joins them, and asks ESLint to find exactly those two problems.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import globals from "globals";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const files = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map(m => m[1]);
if (files.length < 10) { console.error("❌ Could not find the js/ files in index.html"); process.exit(1); }

// Join the files, remembering where each one starts (to report "file:line")
let code = "", starts = [];
for (const f of files) {
  starts.push({ f, line: code.split("\n").length });
  code += readFileSync(join(ROOT, f), "utf8") + "\n";
}
const where = line => {
  let s = starts[0];
  for (const x of starts) if (x.line <= line) s = x;
  return `${s.f}:${line - s.line + 1}`;
};

// Names that come from outside the app's own files (libraries loaded from the internet)
const LIBRARIES = { adhan: "readonly", jspdf: "readonly", html2canvas: "readonly", pdfjsLib: "readonly", JSZip: "readonly" };

const problems = new Linter().verify(code, {
  languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: { ...globals.browser, ...LIBRARIES } },
  rules: {
    "no-undef": "error",                                // a name used but never made (the okKey bug)
    "no-redeclare": ["error", { builtinGlobals: false }], // the same name made twice (rule 6 in CLAUDE.md)
  },
});

if (!problems.length) { console.log(`✅ Code check passed (${files.length} files)`); process.exit(0); }
for (const p of problems) console.error(`❌ ${where(p.line)}  ${p.message}`);
console.error(`\n${problems.length} problem(s) found.`);
process.exit(1);
