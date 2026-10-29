// =====================================================================
//  ALL THE TAPS (one listener handles every button)
// =====================================================================
const t0 = (e, sel) => e.target.closest && e.target.closest(sel);   // the tapped thing (or what it's inside) matching sel
document.addEventListener("click", e => {
  if (e.target === $("kModal")) return closeCard();  // tapped outside the big card
  if (e.target === $("printModal")) return closePrintMenu();
  if (e.target === $("leaveModal")) return answerLeave("stay");   // tapped outside the box = Stay
  if (e.target === $("moveModal")) return closeMoveBox();
  if (e.target === $("backupModal")) return closeBackupBox();
  if (e.target === $("newsModal")) return closeNews();
  if (e.target === $("privacyModal")) return closePrivacy();
  if (e.target === $("buddyModal")) return closeBuddyBox();
  if (t0(e, "[data-snsave]")) return saveSparkName(false);
  if (t0(e, "[data-snskip]") || e.target === $("sparkNameModal")) return saveSparkName(true);
  if (e.target === $("topicModal")) return closeTopicSheet();
  if (t0(e, "[data-tpclose]")) return closeTopicSheet();
  if (t0(e, "[data-tpex]")) return topicExplain(tp);
  if (t0(e, "[data-tpws]")) return topicWorksheet(tp);
  if (e.target === $("riddleModal")) return rdPop && rdPop.result ? nextRiddlePop() : closeRiddlePop();   // (outside = Later)
  // The round "done" checkbox
  const chk = e.target.closest("[data-check]");
  if (chk) {
    const [day, actId, user] = chk.dataset.check.split("|");   // "date|activity|person"
    return toggleDone(day, actId, user, chk);
  }
  const t = e.target.closest("button");
  if (!t) {
    // Tapped a block (not its checkbox): show the big card
    const blk = e.target.closest("[data-kblock]");
    if (blk && editMode && blk.dataset.drag) { const [d, id] = blk.dataset.drag.split("|"); openMoveBox(d, id); }   // edit mode: the "Move" box
    else if (blk && editMode && blk.classList.contains("locked") && !blk.classList.contains("fixed")) toast("📅 Past days stay as they were.", 2800);
    else if (blk && editMode && blk.classList.contains("locked")) toast("🔒 Fixed activities stay in place. Change them in “Add activities”.", 3200);
    else if (blk) openCard(blocks[Number(blk.dataset.kblock)]);
    return;
  }
  const ds = t.dataset;
  if (ds.sync) return answerSync(ds.sync);   // ☁️ "Which data should we use?"
  // 🔔 What's new, and "Allow notifications"
  if ("bell" in ds) return openNews();
  if ("newsclose" in ds) return closeNews();
  if ("notifyask" in ds) return askNotify();
  // 🔒 Your privacy
  if ("privacy" in ds) return openPrivacy();
  if ("privacyclose" in ds) return closePrivacy();
  if (t.id === "kOk") return closeCard();
  if (ds.print) return printFor(ds.print);
  if ("printmenu" in ds) return openPrintMenu();
  if ("printlist" in ds) return printList();         // "My activities": the week as a list
  if ("printcal" in ds) return printCalendar();      // calendar pages: the week as a time grid
  if ("printfamily" in ds) return printFamilyWeek(); // home page: everyone's week, clean and professional
  // 💾 Backup box (Dad only)
  if ("backup" in ds) return openBackupBox();
  if ("backupclose" in ds) return closeBackupBox();
  if ("backupexport" in ds) { closeBackupBox(); return exportBackup(); }
  if ("backupimport" in ds) {   // first ask "Are you sure?" inside the box
    $("backupPick").hidden = true;
    $("backupAsk").hidden = false;
    return $("backupModal").querySelector("[data-backupyes]").focus();
  }
  if ("backupyes" in ds) { closeBackupBox(); return pickBackupFile(true); }
  // ⭐ Good habits: a tick, and ◀ ▶ for earlier days this week
  if (ds.hb) { const [who, id, part] = ds.hb.split("|"); toggleHabit(who, id, Number(part), t); return popButton(`[data-hb="${ds.hb}"]`); }
  if (ds.hbday) { habitDay = Math.max(0, Math.min(todayIndex(), habitDay + Number(ds.hbday))); return render(); }
  // 🎁 A parent's weekly prize
  if ("pzgive" in ds) return givePrize();
  // 🏠 Today: ☰ More, 👋 the tour, 📅 the family calendar; ☰ More pages (🗣️ 📱 📗 🧹)
  if ("homemore" in ds) { homeMore = !homeMore; homeAddPlan = false; return render(); }
  if ("tour" in ds) { homeMore = false; render(); return showTour(); }
  // ⭐ ✏️ Kids' habits (parents): Settings → the kids' habits card
  if ("kidhabits" in ds) { go("settings"); return requestAnimationFrame(() => $("kidHabitsCard").scrollIntoView({ behavior: "smooth", block: "start" })); }
  if ("calall" in ds) { calWho = "all"; return go("mine"); }
  // ✨ Make the app yours (parents)
  if ("setupopen" in ds) return openSetup();
  if (ds.setupfeat) { if (setupDraft) setupDraft[ds.setupfeat] = !setupDraft[ds.setupfeat]; return render(); }
  if ("setupall" in ds) { if (setupDraft) FEATURES.forEach(([k]) => setupDraft[k] = true); return render(); }
  if ("setupsave" in ds) return saveSetup(false);
  if ("setuplater" in ds) return saveSetup(true);
  if (ds.susubdel || ds.susubadd || ds.susubnew || "susubdone" in ds) return setupSubjectTap(ds);   // 📘 setup: the kids' subjects
  if (isExtraTap(ds)) return extraTap(ds, t);
  if (Object.keys(ds).some(k => LEADER_KEYS.includes(k))) return leaderTap(ds);   // 🏆 🎁 prize · 💬 note
  // 📔 My day: open (mine or a kid's), a face, a day in the strip, whose days, 💾 Save
  if (ds.dyopen !== undefined) return openDiary(ds.dyopen || me);
  if (ds.dymood) { diaryMood = ds.dymood; document.querySelectorAll("[data-dymood]").forEach(b => { const on = b.dataset.dymood === ds.dymood; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); return; }
  if (ds.dyday) { diaryDay = ds.dyday === todayYmd() ? null : ds.dyday; return render(); }
  if (ds.dywho) { if (kidLockedOut(ds.dywho)) return lockedToast(ds.dywho); diaryWho = ds.dywho; diaryDay = null; return render(); }
  if ("dysave" in ds) return saveDiary(t);
  // ✅ Duties (a parent, in the evening) and 💌 wishes
  if (ds.duty) { const [kid, v] = ds.duty.split("|"); return setDuty(kid, v); }
  if ("wishsave" in ds) return saveWish(t);
  if ("wishedit" in ds) { wishEdit = true; return render(); }
  if ("wishcancel" in ds) { wishEdit = false; return render(); }
  if (ds.wishdid) { const [week, kid, k] = ds.wishdid.split("|"); return wishDone(`${week}|${kid}`, k); }
  // 🌱 Buddy: pick one, 👨‍👩‍👧 a kid's level history
  if (ds.bupick) return pickBuddy(ds.bupick, ds.buwho || me);
  if (ds.buhist) return isParentDevice() || ds.buhist === me ? openBuddyBox(ds.buhist) : undefined;   // 👨‍👩‍👧 a kid's buddy page (🧒 a kid: only their own; someone else's does nothing)
  // 🌱 The buddy badge (top bar) → the buddy page; 👨‍👩‍👧 Change buddy
  if ("bubadge" in ds) return openProfile(me);   // 👤 the Spark badge → My profile
  if ("profile" in ds) return openProfile(ds.profile && isParentViewer() ? ds.profile : me);   // ☰ More → 👤 My profile (👧 the Kid page: that kid's)
  if ("report" in ds) return openReport();       // 📊 How are my kids doing? (parents)
  // ✨ The encouraging line: go there, or ✕ hide it for today
  if (ds.encgo) return encGo(ds.encgo);
  if ("encx" in ds) { try { localStorage.setItem(ENC_HIDE, todayYmd()); } catch (e) {} return updateEncLines(); }
  if ("signout" in ds) return signOutDevice();   // 🚪 (My profile, ☰ More)
  // 📚 Study sessions: 📚 Start session (it makes the session's worksheet) · ⭐ the helper's rating
  if (ds.sessstart) return leaveDraft(() => startSession(ds.sessstart));
  if (ds.sessrate) { const i = ds.sessrate.lastIndexOf("|"); return rateSession(ds.sessrate.slice(0, i), Number(ds.sessrate.slice(i + 1))); }
  if ("buclose" in ds) return closeBuddyBox();
  if ("buchange" in ds) { buChange = true; return drawBuddyBox(); }
  if ("buchangecancel" in ds) { buChange = false; return drawBuddyBox(); }
  // 🧩 Riddle of the day: an answer, 💡 hint, 🆘 ask (pick who), 🤝 a helper's answer
  if (ds.rdpick) return pickRiddle(Number(ds.rdpick), t);
  if ("rdhint" in ds) return riddleHint();
  if ("rdask" in ds) { riddleAsk = !riddleAsk; return drawRiddlePop(); }
  if (ds.rdhelpask) return askRiddleHelp(ds.rdhelpask);
  if (ds.rdhelp) return helpRiddle(Number(ds.rdhelp), t);
  if ("rdlater" in ds) return closeRiddlePop();   // it comes back on the next open
  if ("rdgotit" in ds) return nextRiddlePop();
  // ⭐ Good habits in Settings (Bro2a)
  if (ds.hbkid) { const [id, kid] = ds.hbkid.split("|"); return toggleHabitKid(id, kid); }
  if (ds.hbup) return moveHabit(ds.hbup, -1);
  if (ds.hbdown) return moveHabit(ds.hbdown, 1);
  if (ds.hbedit) return startEditHabit(ds.hbedit);
  if (ds.hbdel) return deleteHabit(ds.hbdel);
  if ("printclose" in ds) return closePrintMenu();
  // ✏️ Edit calendar: start, Done, Undo, unpin 📌, and the small "Move" box
  if ("editcal" in ds) return startEdit();
  if ("editdone" in ds) return finishEdit();
  if ("editundo" in ds) return undoEdit();
  if (ds.unpin) { const [d, id] = ds.unpin.split("|"); return unpin(d, id); }   // (d = the date)
  if (ds.moveday) { moving.day = ds.moveday; return drawMoveBox(); }
  if ("movesave" in ds) return saveMoveBox();
  if ("movecancel" in ds) return closeMoveBox();
  // Save bar and the "Save your changes?" box
  if ("savechanges" in ds) return saveChanges();
  if ("cancelchanges" in ds) return cancelChanges();
  if (ds.leave) return answerLeave(ds.leave);
  // Leaving the page: ask first if there are unsaved changes
  if ("viewall" in ds) return openViewAll();
  if (ds.go) return leaveDraft(() => go(ds.go));
  // ⬅️ Back one page, like the phone's back gesture (the popstate above asks first about unsaved changes); nothing before → 🏠 Home
  if ("navback" in ds) {
    const at = location.href, was = history.state;
    history.back();
    return setTimeout(() => { if (history.state === was && location.href === at && screen !== "home") leaveDraft(() => go("home")); }, 450);
  }
  if ("plan" in ds) return planNow();
  if (ds.school) return leaveDraft(() => openSchool(ds.school));   // 🎒 School page
  if (ds.editFixed) return startEditFixed(ds.editFixed);
  if (ds.editFlex) return startEditFlex(ds.editFlex);
  // (🗑️ a parent deleting in the activities editor, on purpose: the only way the plan may be emptied in the cloud)
  if (ds.delFixed) { planWipeOk = isParentDevice(); return deleteActivity(ds.delFixed, true); }
  if (ds.delFlex) { planWipeOk = isParentDevice(); return deleteActivity(ds.delFlex, false); }
  if (ds.rtnew) return openRoutineForm(ds.rtnew === "custom" ? null : ROUTINE_PRESETS[Number(ds.rtnew)], null);
  if (ds.editRt) return openRoutineForm(null, data.routines.find(r => r.id === ds.editRt));
  if (ds.delRt) { planWipeOk = isParentDevice(); return deleteRoutine(ds.delRt); }
  if (ds.editUser) return startEditUser(ds.editUser);
  if (ds.delUser) return removeUser(ds.delUser);
  if (ds.emoji) { $("uEmoji").value = ds.emoji; return; }
  if (ds.pview) { allFilter = ds.pview; return render(); }
  if (ds.calwho) {   // 📅 Calendar: Me · Everyone · one person (🧒 a kid: only Me · Everyone)
    if (!isParentDevice() && ds.calwho !== me && ds.calwho !== "all") return;
    calWho = ds.calwho; return render();
  }
  if ("viewcal" in ds) { calWho = ds.viewcal || me; return go("mine"); }   // (older links: someone's calendar, "" = my own)
  if (ds.allview) { allView = ds.allview; return render(); }
  // (📅 the calendar's 12 days: ‹ › stop at the first and last one)
  if (ds.kday) { viewDay = Number(ds.kday); wholeWeek = false; return render(); }
  if ("kprev" in ds) { viewDay = Math.max(0, viewDay - 1); wholeWeek = false; return render(); }
  if ("knext" in ds) { viewDay = Math.min(CAL_LEN - 1, viewDay + 1); wholeWeek = false; return render(); }
  if (ds.kmode) { wholeWeek = ds.kmode === "week"; return render(); }
  if (ds.kblock) return openCard(blocks[Number(ds.kblock)]);
  if (ds.same) return toast(`⇄ ${ds.same}`, 3500);   // "At the same time as: Gym (Bro2a)"
  // View all plan: "📆 Day" / "📅 Week summary", the day buttons and ◀ ▶
  if (ds.vmode) { viewMode = ds.vmode; return render(); }
  if (ds.vwho) { viewWho = ds.vwho; return render(); }   // Full week: All or one person
  if (ds.vday) { viewDay = Number(ds.vday); return render(); }
  if ("vprev" in ds) { viewDay = Math.max(0, viewDay - 1); return render(); }
  if ("vnext" in ds) { viewDay = Math.min(CAL_LEN - 1, viewDay + 1); return render(); }
});
// Phone: swipe the calendar left = next day, right = the day before (when one day is showing).
// Not while dragging a card in "Edit calendar", and not when the swipe just scrolled the calendar sideways.
let swipe = null;
document.addEventListener("touchstart", e => {
  swipe = null;
  const sc = e.target.closest("#scr-mine .k-scroll, #scr-home .k-scroll");
  if (!sc || e.touches.length > 1 || innerWidth >= 700 || (editMode && e.target.closest("[data-drag]"))) return;
  if (wholeWeek) return;
  swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, sc, left: sc.scrollLeft };
}, { passive: true });
document.addEventListener("touchend", e => {
  const s = swipe; swipe = null;
  if (!s || document.body.classList.contains("drag-on") || Math.abs(s.sc.scrollLeft - s.left) > 2) return;
  const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;   // too short, or mostly up/down (scrolling the page)
  viewDay = Math.max(0, Math.min(CAL_LEN - 1, viewDay + (dx < 0 ? 1 : -1)));
  render();
}, { passive: true });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("kModal").hidden) closeCard();
  if (e.key === "Escape" && !$("printModal").hidden) closePrintMenu();
  if (e.key === "Escape" && !$("leaveModal").hidden) answerLeave("stay");
  if (e.key === "Escape" && !$("moveModal").hidden) closeMoveBox();
  if (e.key === "Escape" && !$("backupModal").hidden) closeBackupBox();
  if (e.key === "Escape" && !$("newsModal").hidden) closeNews();
  if (e.key === "Escape" && !$("privacyModal").hidden) closePrivacy();
  if (e.key === "Escape" && !$("buddyModal").hidden) closeBuddyBox();
  if (!$("sparkNameModal").hidden && (e.key === "Escape" || (e.key === "Enter" && e.target.id === "snInput"))) saveSparkName(e.key === "Escape");
  if (e.key === "Escape" && !$("topicModal").hidden) closeTopicSheet();
  if (e.key === "Escape" && rdPop) { if (rdPop.result) nextRiddlePop(); else closeRiddlePop(); }
  // Keyboard: Enter or Space on a block opens its big card
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-kblock]")) {
    e.preventDefault();
    openCard(blocks[Number(e.target.dataset.kblock)]);
  }
});
// If the app stays open past midnight, "Today" moves when you come back to it.
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
