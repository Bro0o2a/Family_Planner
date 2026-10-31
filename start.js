// =====================================================================
//  START THE APP
// =====================================================================
// After loading saved data (or a backup) from an older version:
//  "redo"     → plan the week once now with the new rules (e.g. after School was fixed)
//  PLAN_FRESH → the plan was up to date before the update, so it still is
// Returns true when the week was planned again.
function finishPlanAfterLoad() {
  const redo = data.plan === "redo";
  if (redo) { data.plan = null; makeAndKeepPlan(); }
  if (data.plan && data.plan.key === PLAN_FRESH) data.plan.key = planKey();
  return redo;
}
// If the week was planned again (e.g. with the School rule), say so — and whether everything fit.
if (finishPlanAfterLoad()) {
  const n = data.plan.warnings.length;
  setTimeout(() => toast(n ? `📅 The week was planned again. ${n} thing${n === 1 ? "" : "s"} couldn't fit — see “Everyone's plan”.`
                           : "📅 The week was planned again. Everything fits! ✓", 6000), 400);
}
newWeek();                     // a new week since last time? Points start again from zero
writeData("auto");              // stores the updated data (people, owners, "Needs Dad", plan, points)
try { history.replaceState({ screen: "start" }, ""); } catch (e) {}   // the Back button's first stop
resetFixedForm(); resetFlexForm(); resetUserForm(); closeRoutineForm(); resetHabitForm();
// 👤 Open as the person signed in on this device, straight on 🏠 Home (go() works it out: see deviceMe).
// (Nobody signed in yet: the family login comes first.)
document.body.classList.toggle("kid-device", isKidDevice());
go("start");
startCloud();

// ---------- Offline support ----------
// Starts the "service worker" (sw.js), which keeps a copy of the app so it works without internet.
// It only works when the page is opened from a web address (http://…), not by double-clicking the file.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(err => console.warn("Offline mode not available:", err));
}
