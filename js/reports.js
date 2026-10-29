// =====================================================================
//  📊 KIDS REPORT (parents): one kid · this week / this month. Every number comes from the app's data (no 🤖);
//   only "🤖 Coach summary" asks 🤖 (the existing 📋 brief), once a week: a brief made this week is shown, not asked again.
//   (✅ tasks % is for this week only: older weeks keep only their points, shown for the month.)
// =====================================================================
let rpKid = null, rpRange = "week";
function openReport() {
  if (!isParentDevice()) return;
  if (!kidsList().some(k => k.id === rpKid)) rpKid = (kidsList()[0] || {}).id || null;
  homeMore = false;
  go("report");
}
function reportRange() {
  if (rpRange === "week") return { from: data.points.week, to: weekEnd(), days: todayIndex() + 1, label: "This week" };
  const now = new Date(), from = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  return { from, to, days: now.getDate(), label: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
}
const stars5 = lv => lv ? "★".repeat(lv) + "☆".repeat(Math.max(0, 3 - lv)) : "";   // (the 👤 profile levels: 1–3)
// Everything the report shows for one kid (plain numbers and short lists)
function reportData(kid, r) {
  const s = schoolOf(kid), inR = d => d && d >= r.from && d < r.to;
  const files = Object.values(s.files).filter(f => inR(f.date)).length;
  const sheets = Object.values(aiDocs.worksheets).filter(w => w.kid === kid && w.check && inR(String(w.check.at || w.date).slice(0, 10)));
  const subjects = subjectList(s).map(f => {
    const all = checkedOf(kid, f.name), last = all[0], inside = all.filter(w => sheets.includes(w));
    return { id: f.id, emoji: f.emoji, name: f.name, level: (s.profile.subjects[f.id] || {}).level || 0, avg: avgPct(inside), avgAll: avgPct(all),
             strong: last ? (last.check.strong_points || []).slice(0, 3) : [], weak: last ? (last.check.weak_points || []).slice(0, 3) : [] };
  });
  const habits = habitsFor(kid).map(h => ({ h, days: new Set(Object.entries(data.habitMarks).filter(([k, v]) => { const [date, id, who] = k.split("|"); return who === kid && id === h.id && inR(date) && habitDone(h, v); })
    .map(([k]) => k.slice(0, 10))).size }));
  const moods = Object.entries(data.points.diary).filter(([k]) => { const [date, who] = k.split("|"); return who === kid && inR(date); }).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, e]) => ({ date: k.slice(0, 10), face: moodFace(e.mood) })).filter(x => x.face);
  const weekNowIn = inR(data.points.week);
  const points = Object.entries(data.points.lifetime).filter(([k]) => { const [wk, who] = k.split("|"); return who === kid && inR(wk) && wk !== data.points.week; })
    .reduce((n, [, v]) => n + v, 0) + (weekNowIn ? pointsByUser()[kid] || 0 : 0);
  const planned = plannedCount(kid), done = (activityPointsByUser()[kid] || 0) / POINTS_EACH;
  return { s, files, sheets: sheets.length, avg: avgPct(sheets), subjects, habits, moods, points,
           tasksPct: planned ? Math.min(100, Math.round(done / planned * 100)) : null, done, planned,
           level: levelOf(lifetimePoints(kid)) };   // (🧩 riddles: not in the report, they're just for fun)
}
// 🌟 the best thing and 👀 the one that needs help, in plain words
function reportLines(x, r, name) {
  const cands = [
    ...x.subjects.filter(f => f.avg != null).map(f => ({ score: f.avg / 100, best: `${f.emoji} ${f.name}: ${f.avg}% on worksheets`, help: `${f.emoji} ${f.name}: ${f.avg}% on worksheets. A short practice together will help.` })),
    ...x.habits.map(({ h, days }) => ({ score: days / Math.max(1, r.days), best: `${h.emoji} ${h.name}: ${days} of ${r.days} days`, help: `${h.emoji} ${h.name}: only ${days} of ${r.days} days. A small reminder could help.` })),
    ...(x.tasksPct != null && rpRange === "week" ? [{ score: x.tasksPct / 100, best: `✅ ${x.tasksPct}% of the planned activities done`, help: `✅ ${x.tasksPct}% of the planned activities done so far.` }] : [])];
  if (!cands.length) return { best: "", help: "" };
  const sorted = [...cands].sort((a, b) => b.score - a.score), low = sorted[sorted.length - 1];
  return { best: sorted[0].score > 0 ? sorted[0].best : "", help: sorted.length > 1 && low.score < .7 ? low.help : "" };
}
function reportCardsHtml(kid, forPdf) {
  const u = userById(kid), r = reportRange(), x = reportData(kid, r), lines = reportLines(x, r, u.name), b = x.s.brief, briefNow = b && b.date >= data.points.week;
  const big = (n, label) => `<div class="rp-num"><b>${n}</b><small>${label}</small></div>`;
  const sc = rpRange === "week" ? scoreOf(kid) : null;   // (⭐ the score is for this week only)
  return `${sc ? `<div class="card rp-card"><h2>⭐ Score this week</h2>${scoreBlockHtml(sc)}</div>` : ""}
    <div class="card rp-card"><h2>📚 Study per subject</h2>${sc ? `<p class="rp-free">📚 Sessions: ${sc.sp ? sc.sp.study + "%" : "–"} · ⚡ Extra worksheets: +${sc.extra.bonus}${
      sc.free.count ? ` <small>(${sc.free.count} ${sc.free.count === 1 ? "worksheet" : "worksheets"}, ${sc.free.points} points)</small>` : ""}</p>` : ""}${studyTableHtml(kid, null)}</div>
    <div class="card rp-card"><h2>🎒 Topics</h2>${topicsSummaryHtml(kid)}</div>
    <div class="card rp-card"><h2>🧠 Learning profile</h2>${learnReportHtml(kid)}</div><div class="card rp-card"><h2>🎒 School</h2><div class="rp-nums">${big(x.files, "files uploaded")}${big(x.sheets, "worksheets done")}${big(x.avg != null ? x.avg + "%" : "–", "average mark")}</div>
      ${x.subjects.length ? `<ul class="rp-subs">${x.subjects.map(f => `<li>${forPdf ? `<div class="rp-sub">` : `<button class="rp-sub" data-rpsub="${safe(f.id)}">`}
        <span class="rp-subname">${safe(f.emoji)} ${safe(f.name)}</span><span class="rp-stars" aria-label="${f.level ? `Level ${f.level} of 3` : "No level yet"}">${stars5(f.level) || "–"}</span>
        ${f.strong.length ? `<small>💪 Good at: ${safe(f.strong.join(", "))}</small>` : ""}${f.weak.length ? `<small>🎯 Work on: ${safe(f.weak.join(", "))}</small>` : ""}${forPdf ? "</div>" : "</button>"}</li>`).join("")}</ul>` : ""}</div>
    <div class="card rp-card"><h2>✅ Tasks</h2><div class="rp-nums">${x.tasksPct != null ? big(x.tasksPct + "%", `of planned activities done this week (${x.done} of ${x.planned})`) : big("–", "no planned activities this week")}
      ${rpRange === "month" ? big(x.points, "points this month") : ""}</div></div>
    ${x.habits.length ? `<div class="card rp-card"><h2>⭐ Habits</h2><ul class="me-list">${x.habits.map(({ h, days }) => `<li><span>${safe(h.emoji)} ${safe(h.name)}</span><b>${days} of ${r.days} days</b></li>`).join("")}</ul></div>` : ""}
    <div class="card rp-card"><div class="rp-nums">${feat("buddy") ? big("Lv " + x.level, "✨ Spark level") : ""}</div>
      ${feat("diary") ? `<h2>📔 Moods</h2>${x.moods.length ? `<div class="me-moods">${x.moods.map(m => `<span><b>${m.face}</b><small>${safe(shortDate(m.date).split(" ").slice(1).join(" "))}</small></span>`).join("")}</div>` : `<p class="sc-empty">No moods saved ${rpRange === "week" ? "this week" : "this month"}.</p>`}` : ""}</div>
    ${lines.best || lines.help ? `<div class="card rp-card rp-lines">${lines.best ? `<p>🌟 <b>Best ${rpRange === "week" ? "this week" : "this month"}:</b> ${safe(lines.best)}</p>` : ""}${lines.help ? `<p>👀 <b>Needs help:</b> ${safe(lines.help)}</p>` : ""}</div>` : ""}
    ${briefNow ? `<div class="card rp-card"><h2>🤖 Coach summary</h2><p>${safe(b.summary)}</p>${b.home_tips.length ? `<ul>${b.home_tips.map(t => `<li>${safe(t)}</li>`).join("")}</ul>` : ""}</div>` : ""}`;
}
function drawReport() {
  if (!isParentDevice()) return go("home");
  const kids = kidsList();
  if (!kids.some(k => k.id === rpKid)) rpKid = (kids[0] || {}).id || null;
  if (!rpKid) { $("reportBody").innerHTML = `<div class="card"><p class="sc-empty">No kids yet. Add one in ☰ More → 👨‍👩‍👧 Family.</p></div>`; return; }
  const b = schoolOf(rpKid).brief, briefNow = b && b.date >= data.points.week;
  $("reportBody").innerHTML = `<div class="chips rp-kids">${kids.map(k => { const c = colorsOf(k); return `<button class="chip ${k.id === rpKid ? "on" : ""}" data-rpkid="${safe(k.id)}"
      style="--soft:${c.soft};--ink:${c.ink}"><span class="e">${safe(k.emoji)}</span>${safe(k.name)}</button>`; }).join("")}</div>
    <div class="seg rp-range" role="group" aria-label="Period"><button class="${rpRange === "week" ? "on" : ""}" data-rprange="week" aria-pressed="${rpRange === "week"}">This week</button>
      <button class="${rpRange === "month" ? "on" : ""}" data-rprange="month" aria-pressed="${rpRange === "month"}">This month</button></div>
    ${reportCardsHtml(rpKid, false)}
    <div class="btnrow rp-btns">${briefNow ? "" : `<button data-rpbrief data-aiwait="brief">🤖 Coach summary</button>`}<button class="primary" data-rppdf>📄 PDF</button></div>
    ${fsButtonsHtml()}`;
  showAiWait();
}
// =====================================================================
//  📄 FAMILY SUMMARY PDF (parents): a cute, colourful A4 summary of This week / Last week, made like the worksheet PDFs
//   (jsPDF + html2canvas), then 📤 Share / ⬇️ Download. Cover (the ⭐ star with their Spark and 🎁 gift, everyone in a row) ·
//   one card per person in their colour (⭐ score, ✅ tasks, 📚 school, ⭐ habits & 🕌 prayers, 🧩 riddles, 📔 moods: emojis only,
//   ✨ Spark, 💡 tips for next week made from their own numbers: no AI) · 🏆 Hall of Stars and 🏡 Our Community highlights.
//   📅 The week's dates are on the cover and at the top of every page. File: "Family-summary-2026-10-25.pdf" (the Sunday).
//   (Last week: what the app still keeps: its points, ticks, habits, riddles, moods, worksheets. Its ⭐ score: only this week.)
// =====================================================================
const longDay = d => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).replace(/,/g, "");
function fsWeek(which) {
  const mon = fromYmd(data.points.week);
  if (which === "last") mon.setDate(mon.getDate() - 7);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const to = new Date(mon); to.setDate(to.getDate() + 7);
  return { from: ymd(mon), to: ymd(to), sunday: ymd(sun), now: which !== "last", label: `${hallWeekRange(ymd(mon))} ${sun.getFullYear()}`,
           dates: `📅 From ${longDay(mon)} to ${longDay(sun)}` };
}
// One person's week in numbers (from what the app keeps)
function fsPerson(u, wk) {
  const id = u.id, kid = !isParentId(id), today = todayYmd();
  const days = Array.from({ length: 7 }, (_, i) => { const d = fromYmd(wk.from); d.setDate(d.getDate() + i); return ymd(d); }).filter(d => d <= today);
  const fi = wk.now ? fairInfo()[id] : null;
  const raw = wk.now ? fi.raw : (data.points.lifetime[`${wk.from}|${id}`] || 0);
  const st = wk.now ? weekStats(id) : null;
  const doneLast = tickLog().filter(x => x.user === id && x.date >= wk.from && x.date < wk.to).length;
  // 📚 school: the worksheets checked that week
  const sheets = kid ? Object.values(aiDocs.worksheets).filter(w => w.kid === id && w.check && String(w.check.at || w.date).slice(0, 10) >= wk.from && String(w.check.at || w.date).slice(0, 10) < wk.to) : [];
  const pick = key => [...new Set(sheets.flatMap(w => w.check[key] || []))].slice(0, 3);
  // ⭐ habits and 🕌 prayers
  let ticks = 0, prayed = 0, prayerDays = 0, fajrMissed = 0, leftDays = 0;
  const kidHabits = kid ? habitsFor(id) : [], parentHabits = [];   // (👨‍👩‍👧 parents have no habits or prayers any more)
  const prayHabit = kid ? kidHabits.find(h => h.kind === "prayers") : null;
  days.forEach(date => {
    let left = 0;
    kidHabits.filter(h => h.kind !== "prayers").forEach(h => { if (habitDone(h, data.habitMarks[habitKey(date, h.id, id)])) ticks++; else left++; });
    parentHabits.forEach(h => { if (data.habitMarks[habitKey(date, h.id, id)] === true) ticks++; else left++; });
    if (prayHabit) {
      const v = data.habitMarks[habitKey(date, prayHabit.id, id)], n = Array.isArray(v) ? v.filter(Boolean).length : 0;
      prayed += n; prayerDays++;
      if (!(Array.isArray(v) && v[0])) fajrMissed++;
    }
    if (left >= 3) leftDays++;
  });
  const moods = days.map(date => { const e = diaryOf(id, date); return e ? moodFace(e.mood) : ""; });
  const L = levelOf(lifetimePoints(id));
  return { u, kid, raw, fair: fi ? fi.fair : null, score: fi, tasksPct: st ? st.pct : null, tasksDone: st ? st.done : doneLast, tasksPlanned: st ? st.planned : 0,
           sheets: sheets.length, avg: avgPct(sheets), strong: pick("strong_points"), weak: pick("weak_points"),
           ticks, habitCount: kidHabits.filter(h => h.kind !== "prayers").length + parentHabits.length, prayed, prayerMax: prayerDays * PRAYERS.length, fajrMissed,
           leftDays, days: days.length, moods, L, face: buddyFace(id, L) };   // (🧩 riddles: not in the summary, just for fun)
}
// 💡 2–3 short, kind tips for next week, from their own numbers
function fsTips(p) {
  const name = p.u.name.split(" ")[0], out = [];
  if (p.weak.length) out.push(`Try 10 minutes of ${p.weak[0]} every day 🎯`);
  if (p.prayerMax && p.fajrMissed >= 2) out.push(`You missed Fajr ${p.fajrMissed} times, set an alarm 🕌`);
  else if (p.prayerMax && p.prayed === p.prayerMax) out.push("Every prayer on time, mashallah! Keep it up 🕌");
  if (p.leftDays >= 3) out.push(`${name}: 3 habits left most days, pick an easier time ⏰`);
  if (p.tasksPct != null && p.tasksPlanned && p.tasksPct < 60) out.push("Finish one more activity each day ✅");
  else if (p.tasksPct != null && p.tasksPct >= 90) out.push("Brilliant work on your tasks, keep going ✅");
  if (p.avg != null && p.avg >= 85) out.push("Super worksheet marks, try a 🚀 challenge sheet next");
  if (p.moods.filter(m => m === "😢" || m === "😡" || m === "😟").length >= 2) out.push("Hard days happen: talk to someone you love 💛");
  if (out.length < 2) out.push("Keep shining next week ✨");
  return out.slice(0, 3);
}
function fsCardHtml(p) {
  const c = colorsOf(p.u), bar = n => `<div class="fs-bar"><i style="width:${Math.max(0, Math.min(100, n))}%;background:${c.color}"></i></div>`;
  const row = (label, value) => `<div class="fs-row"><span>${label}</span><b>${value}</b></div>`;
  return `<section class="fs-card" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
    <div class="fs-cardtop"><span class="fs-big">${safe(p.u.emoji)}</span><div><h2>${safe(p.u.name)}</h2><small>✨ Spark ${p.face} Lv ${p.L}${p.u.sparkName ? ` · ${safe(p.u.sparkName)}` : ""}</small></div>
      <div class="fs-score">${p.fair != null ? `<b>${p.fair}</b><small> / ${p.score.max}</small>` : `<b>${p.raw}</b><small> points</small>`}<span>⭐ Score</span></div></div>
    ${p.fair != null ? bar(p.fair) + subBarsHtml(p.score) : ""}
    ${row("✅ Tasks done", p.tasksPct != null ? `${p.tasksPct}% (${p.tasksDone} of ${p.tasksPlanned})` : `${p.tasksDone} done`)}
    ${p.kid ? row("📚 Worksheets done", `${p.sheets}${p.avg != null ? ` · average ${p.avg}%` : ""}`) : ""}
    ${p.strong.length ? row("💪 Good at", safe(p.strong.join(", "))) : ""}${p.weak.length ? row("🎯 Work on", safe(p.weak.join(", "))) : ""}
    ${p.habitCount ? row("⭐ Habits ticked", p.ticks) : ""}${p.prayerMax ? row("🕌 Prayers", `${p.prayed} of ${p.prayerMax}`) : ""}
    ${feat("diary") && p.moods.length ? `<div class="fs-row"><span>📔 Moods</span><b class="fs-moods">${p.moods.map(m => m || "·").join(" ")}</b></div>` : ""}
    <div class="fs-tips"><b>💡 Tips for next week</b><ul>${fsTips(p).map(t => `<li>${safe(t)}</li>`).join("")}</ul></div></section>`;
}
function familySummaryNode(which) {
  // (👨‍👩‍👧 a card for each kid only: parents aren't scored)
  const wk = fsWeek(which), people = scoredUsers().map(u => fsPerson(u, wk)), fam = APP_NAME.replace(/\s*Plan$/i, "");
  const st = hallStar(wk.from) || (wk.now && !starDecided() && leaders()[0] ? { id: leaders()[0], lead: true } : null);
  const su = st && exists(st.id) ? userById(st.id) : null;
  const starHtml = su ? `<div class="fs-star"><span class="fs-big">${safe(su.emoji)}</span><div><b>${st.lead ? "🔥 In the lead" : "⭐ Shining Star of the Week"}</b>
      <h2>${safe(su.name)}</h2><small>✨ Spark ${buddyFace(su.id, levelOf(lifetimePoints(su.id)))}${st.gift ? ` · 🎁 Gift: ${safe(st.gift)}` : ""}</small></div></div>`
    : st ? `<div class="fs-star"><div><b>⭐ Shining Star of the Week</b><h2>${safe(st.name)} ${safe(st.emoji || "")}</h2></div></div>` : `<div class="fs-star"><div><b>⭐ Shining Star of the Week</b><h2>⭐ ?</h2></div></div>`;
  const weeks = hallWeeks().filter(w => w <= wk.from).reverse().slice(0, 6);
  const posts = cmPosts().filter(p => (p.at || "").slice(0, 10) >= wk.from && (p.at || "").slice(0, 10) < wk.to)
    .map(p => ({ p, n: Object.keys(data.points.cmReact).filter(k => k.split("|")[0] === p.id).length })).sort((a, b) => b.n - a.n).slice(0, 3);
  const closing = ["You're an amazing team. See you next week! 💛", "Small steps every day make big stars ⭐", "Proud of every one of you! 🏡", "Keep going, together! 🌈"][Math.abs(dayNumber(wk.from)) % 4];
  const box = document.createElement("div");
  box.className = "fs-sheet";
  box.innerHTML = `<section class="fs-cover"><div class="fs-deco" aria-hidden="true">✨ ⭐ 🎉 ⭐ ✨</div>
      <h1>🏡 ${safe(fam)}</h1><p class="fs-week">Week of ${safe(wk.label)}</p><p class="fs-dates">${safe(wk.dates)}</p>
      ${starHtml}
      <div class="fs-family">${data.users.map(u => `<span style="--soft:${colorsOf(u).soft};--ink:${colorsOf(u).ink}"><b>${faceHtml(u)}</b>${
        hasSpark(u.id) ? `<i>${buddyFace(u.id, levelOf(lifetimePoints(u.id)))}</i>` : ""}<small>${safe(u.name)}</small></span>`).join("")}</div></section>
    ${people.map(fsCardHtml).join("")}
    <section class="fs-end"><h2>🏆 Hall of Stars</h2><ul>${weeks.map(w => { const s = hallStar(w), i = hallWeeks().indexOf(w) + 1;
        return `<li><b>Week ${i}</b> · ${hallWeekRange(w)} · ${s ? `⭐ ${safe(s.name)} ${safe(s.emoji || "")}${s.gift ? ` · 🎁 ${safe(s.gift)}` : ""}` : w === data.points.week ? "⭐ decided on Friday" : "⭐ ?"}</li>`; }).join("")}</ul>
      ${feat("meeting") ? `<h2>🏡 Our Community</h2>${posts.length ? `<ul>${posts.map(({ p, n }) => { const u = exists(p.by) ? userById(p.by) : null, [e, label] = CM_TYPES[p.type];
          return `<li>${e} <b>${safe(u ? u.emoji + " " + u.name : "Someone")}</b> · ${label}: ${safe(p.text.length > 120 ? p.text.slice(0, 120) + "…" : p.text)}${n ? ` · ❤️ ${n}` : ""}</li>`; }).join("")}</ul>` : `<p>No posts this week.</p>`}` : ""}
      <p class="fs-close">${safe(closing)}</p><div class="fs-deco" aria-hidden="true">⭐ ✨ 💛 ✨ ⭐</div></section>`;
  const head = document.createElement("div");
  head.className = "fs-head";
  head.textContent = `🏡 ${fam} · ${wk.dates}`;
  return { box, head, file: `Family-summary-${wk.sunday}.pdf` };
}
function familySummaryPdf(which) {
  if (!isParentDevice()) return;
  const { box, head, file } = familySummaryNode(which);
  makePdf(box, file, { header: head, ask: true });
}
// "📄 Family summary: This week · Last week" (📊 How are my kids doing? and the parent's home)
const fsButtonsHtml = () => `<div class="fs-pick"><span>📄 Family summary</span><button class="pill" data-fsweek="this">This week</button><button class="pill" data-fsweek="last">Last week</button></div>`;
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-fsweek]");
  if (b) familySummaryPdf(b.dataset.fsweek === "last" ? "last" : "this");
});
function reportPdf() {
  const u = userById(rpKid), r = reportRange(), box = document.createElement("div");
  box.innerHTML = `<h1>📊 ${safe(u.name)} · ${safe(r.label)}</h1>` + reportCardsHtml(rpKid, true);
  makePdf(box, pdfName(u.name, "Report", r.label));
}
document.addEventListener("click", e => {
  const b = e.target.closest("#scr-report button");
  if (!b) return;
  const ds = b.dataset;
  if (ds.rpkid) { rpKid = ds.rpkid; return render(); }
  if (ds.rprange) { rpRange = ds.rprange === "month" ? "month" : "week"; return render(); }
  if (ds.rpsub) { const kid = rpKid; openSchool(kid); return goSchool("subject", ds.rpsub); }   // 👀 that kid's subject (look only)
  if ("rpbrief" in ds) return makeBrief(rpKid, false).then(() => { if (screen === "report") render(); });
  if ("rppdf" in ds) return reportPdf();
});

// =====================================================================
//  👀 KIDS' WORK TODAY (parents): everything the kids did today, newest first, updating by itself (each change redraws it).
//   ✅ activities and homework · ⭐ habits · 🕌 prayers · 🧩 riddles · ✏️ worksheets made / finished · 📤 answers uploaded · 🤖 explanations
//   · 📥 school work uploaded · 🧹 duties · 📔 My day (the mood emoji only, never the private text). Tap → that thing, look-only.
//   (The time: from the item itself, or from data.points.when for habits, riddles and homework; older ones say "Earlier".)
// =====================================================================
function noteWhen(date, kind, ref, who, on) {
  const k = `${date}|${kind}|${String(ref).replace(/\|/g, "-")}|${who}`;
  if (on) data.points.when[k] = new Date().toISOString(); else delete data.points.when[k];
}
function kidsWorkItems() {
  const date = todayYmd(), kids = kidsList().map(k => k.id), out = [], when = data.points.when;
  // (cat: "school" | "act" | "habit" | "prayer" | "riddle" | "mood" | "duty": the summary names only school work and activities)
  const add = (at, kid, text, open, cat) => { if (kids.includes(kid)) out.push({ at: at || "", kid, text, open: open || "", cat: cat || "school" }); };
  // ✅ activities ticked today
  Object.entries(data.points.marks).forEach(([key, m]) => {
    const [d, actId] = key.split("|");
    if (d !== date) return;
    const a = allActs().find(x => x.id === actId);
    add(m.at, m.user, `✅ finished ${a ? a.name : "an activity"}`, "go|mine", "act");
  });
  // ⭐ habits and 🕌 prayers
  Object.entries(data.habitMarks).forEach(([key, v]) => {
    const [dt, hid, who] = key.split("|"), h = dt === date && data.habits.find(x => x.id === hid);
    if (!h) return;
    const w = part => when[`${date}|hb|${hid}-${part}|${who}`];
    if (h.kind === "prayers") { if (Array.isArray(v)) v.forEach((on, i) => { if (on) add(w(i), who, `🕌 prayed ${PRAYERS[i]}`, "me|" + who, "prayer"); }); }
    else if (habitDone(h, v)) add(w(0), who, `${h.emoji} ${h.name}`, "me|" + who, "habit");
  });
  // 🧩 riddles solved
  Object.entries(data.points.riddleAns).forEach(([key, v]) => {
    const p = riddleKeyParts(key);
    if (p.help || p.date !== riddleDay() || !v.solved) return;
    add(when[`${p.date}|rd|${p.n}|${p.who}`], p.who, "🧩 solved a riddle 🎈", "go|points", "riddle");   // (no points: just for fun)
  });
  // 📔 My day: the mood only
  kids.forEach(kid => { const e = data.points.diary[`${date}|${kid}`]; if (e && moodFace(e.mood)) add(e.at, kid, `📔 My day: ${moodFace(e.mood)}`, "", "mood"); });
  // 🧹 duties
  Object.entries(data.points.chores).forEach(([key, v]) => {
    const [dt, chId, kid] = key.split("|"), ch = choresList().find(x => x.id === chId);
    if (dt === date) add(v.at, kid, `🧹 ${ch ? ch.emoji + " " + ch.title : "did a duty"}`, "", "duty");
  });
  // 🎒 School: homework done, school work uploaded
  kids.forEach(kid => {
    const s = data.school[kid];
    if (!s) return;
    Object.entries(s.tasks).forEach(([id, t]) => { if (t.done && t.doneAt === date) add(when[`${date}|task|${id}|${kid}`], kid, `✅ finished ${t.subject} ${t.kind === "homework" ? "homework" : t.kind}${t.title ? `: ${t.title}` : ""}`, "school|" + kid); });
    Object.values(s.work).forEach(w => { if (w.date === date && w.by === kid) add("", kid, `📥 uploaded ${w.subject} work: ${w.title}`, "school|" + kid); });
  });
  // ✏️ worksheets made / finished, 🤖 explanations asked
  Object.entries(aiDocs.worksheets).forEach(([id, w]) => {
    if (w.date === date && w.by === w.kid) add(w.at, w.kid, `✏️ made a ${w.part || w.topics[0] || w.subject} worksheet`, "ws|" + id);
    if (w.check && String(w.check.at || "").slice(0, 10) === date) add("", w.kid, `🎉 finished a ${w.subject} worksheet: ${num(w.check.score)}/${num(w.check.max_score)}`, "ws|" + id);
  });
  Object.entries(aiDocs.explanations).forEach(([id, x]) => { if (x.date === date && x.by === x.kid) add(x.at, x.kid, `🤖 asked to explain “${x.title}”`, "ex|" + id); });
  // 📤 answers uploaded (+5) · 👍 an explanation read (+5)
  Object.entries(data.points.study).forEach(([key, v]) => {
    const [dt, kid, kind, ref] = key.split("|");
    if (dt !== date) return;
    if (kind === "up") { const w = aiDocs.worksheets[ref]; add(v.at, kid, `📤 uploaded ${w ? w.subject + " " : ""}answers (+${STUDY_POINTS.up})`, w ? "ws|" + ref : ""); }
    if (kind === "ex") {
      const hit = Object.entries(aiDocs.explanations).find(([, x]) => x.kid === kid && topicRef(x.topic || x.title) === ref);
      add(v.at, kid, `👍 read ${hit ? `“${hit[1].title}”` : "an explanation"} (+${STUDY_POINTS.ex})`, hit ? "ex|" + hit[0] : "");
    }
  });
  return out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}
const kwTime = at => at ? new Date(at).toLocaleTimeString("en-US", { timeZone: "Asia/Dubai", hour: "numeric", minute: "2-digit" }) : "";
// A short school line: "finished a Math worksheet: 8/10 4:35 PM" (no emoji in front, no "(+5)")
const kwShort = x => x.text.replace(/^\S+\s/, "").replace(/\s*\(\+\d+\)$/, "") + (x.at ? ` <small>${kwTime(x.at)}</small>` : "");
// 👀 A SHORT summary: one small card per kid (📚 school work and ✅ activities named, with times; habits, prayers, riddles,
// mood just counts on one line). Tap a card → that kid's details, the long list folded (collapsed) at first.
function kwCardHtml(k, items) {
  const c = colorsOf(k), date = todayYmd(), mine = items.filter(x => x.kid === k.id);
  const school = mine.filter(x => x.cat === "school").slice(0, 4);
  const acts = todayItems(k.id), done = acts.filter(x => isDone(date, x.id, k.id));
  const markAt = id => (data.points.marks[markKey(date, id, k.id)] || {}).at;
  const habits = mine.filter(x => x.cat === "habit").length, prayers = mine.filter(x => x.cat === "prayer").length;
  const duties = mine.filter(x => x.cat === "duty").length;   // (🧩 riddles: not counted here, just for fun)
  const mood = (mine.find(x => x.cat === "mood") || {}).text, face = mood ? mood.replace("📔 My day: ", "") : "";
  const hasPrayers = habitsFor(k.id).some(h => h.kind === "prayers");
  return `<button class="card kw-card" data-kwdetail="${safe(k.id)}" style="--c:${c.color};--soft:${c.soft};--ink:${c.ink}">
    <span class="kw-name"><span class="e">${safe(k.emoji)}</span><b>${safe(k.name)}</b><small>Details ›</small></span>
    <span class="kw-line">📚 <b>School:</b> ${school.length ? school.map(kwShort).join(" · ") : "nothing yet"}</span>
    <span class="kw-line">✅ <b>Activities:</b> ${acts.length ? `${done.length} of ${acts.length} done (${acts.map(x => { const ok = done.includes(x), at = ok && markAt(x.id);
        return `${safe(x.name)} ${ok ? "✅" : "⏳"}${at ? ` <small>${kwTime(at)}</small>` : ""}`; }).join(", ")})` : "none today"}</span>
    <span class="kw-line kw-counts">⭐ Habits ${habits}${hasPrayers ? ` · 🕌 Prayers ${prayers}/5` : ""}${duties ? ` · 🧹 Duties ${duties}` : ""}${feat("diary") ? ` · 📔 Mood ${face || "–"}` : ""}</span></button>`;
}
let kwDetail = null;   // the kid whose details are open, or null (the summary)
function drawKidsWork() {
  if (!isParentDevice()) return go("home");
  const kids = kidsList(), items = kidsWorkItems();
  if (kwDetail && !kids.some(k => k.id === kwDetail)) kwDetail = null;
  if (!kwDetail) {
    $("kidsWorkBody").innerHTML = kids.length ? `<div class="kw-cards">${kids.map(k => kwCardHtml(k, items)).join("")}</div>`
      : `<div class="card"><p class="sc-empty">No kids yet.</p></div>`;
    return;
  }
  // One kid: the card on top, then everything they did today (folded until opened)
  const k = userById(kwDetail), c = colorsOf(k), list = items.filter(x => x.kid === k.id);
  $("kidsWorkBody").innerHTML = `<div class="btnrow"><button class="pill" data-kwback>‹ All kids</button></div>${kwCardHtml(k, items).replace("data-kwdetail", "data-kwsame").replace("<small>Details ›</small>", "")}
    <details class="card kw-all"><summary>📋 Everything ${safe(k.name)} did today (${list.length})</summary>
      ${list.length ? `<ul class="kw-list">${list.map(x => {
        const inner = `<span class="kw-time">${x.cat === "school" || x.cat === "act" ? kwTime(x.at) : ""}</span><span class="kw-what">${safe(x.text)}</span>`;
        return `<li>${x.open ? `<button class="kw-item" data-kwopen="${safe(x.kid)}|${safe(x.open)}">${inner}</button>` : `<div class="kw-item">${inner}</div>`}</li>`;
      }).join("")}</ul>` : `<p class="sc-empty">No work yet today 🙂</p>`}</details>`;
}
// Tap an item → that thing (parents' devices only look)
function kidsWorkOpen(v) {
  const [kid, kind, id] = v.split("|");
  if (kind === "ws" || kind === "ex") { schoolKid = kid; return openAiDoc(kind === "ws" ? "worksheet" : "explain", id); }
  if (kind === "go") return go(id);
  if (kind === "me") return openProfile(kid);
  if (kind === "school") return openSchool(kid);
}
document.addEventListener("click", e => {
  const b = e.target.closest("#scr-kidswork button, #scr-kid [data-kwopen]");   // (👧 the Kid page's list too)
  if (!b) return;
  if (b.dataset.kwdetail) { kwDetail = b.dataset.kwdetail; drawKidsWork(); return window.scrollTo(0, 0); }   // a kid's card → their details
  if ("kwback" in b.dataset) { kwDetail = null; return drawKidsWork(); }
  if (b.dataset.kwopen) return kidsWorkOpen(b.dataset.kwopen);
});
// (it redraws with every change that comes in; this keeps the times fresh while it's open)
setInterval(() => { if (screen === "kidswork" && !document.hidden) drawKidsWork(); }, 30000);
