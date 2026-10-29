// =====================================================================
//  ☁️ FAMILY CLOUD (Firebase): the whole family shares the same data, live
// =====================================================================
// Where the data lives in the cloud (Cloud Firestore): families/{family account id}/state/…
//   plan   → people, activities, routines, My day, settings, the planned week, the habits list
//   points → activity ticks, points history, stars   ({ week, since, marks, history, log })
//   habits → good-habit ticks                        ({ marks })
//   news   → the last 30 changes for 🔔 "What's new"  ({ items }, see "WHAT'S NEW" below)
//   (the plan also says who saved it last: change = { by, at, what })
// A tick changes ONLY its own field in the cloud, so two phones ticking at the same time don't overwrite each other.
// Every phone listens for changes (onSnapshot) and redraws within seconds.
// Firestore also keeps its own offline copy: changes made without internet upload when you're back online.
// (This config is not a secret: it only says WHICH Firebase project to use. The Firestore rules protect the data.)
const firebaseConfig = {
  apiKey: "AIzaSyBArJ3-WFiUO_G9g32V6pKURCfzHH0LqX4",
  authDomain: "ani-family-plan.firebaseapp.com",
  projectId: "ani-family-plan",
  storageBucket: "ani-family-plan.firebasestorage.app",
  messagingSenderId: "662014356182",
  appId: "1:662014356182:web:1a46b5b4ded3b34ac33777",
  measurementId: "G-7J9Z81YL1D"
};
const FIREBASE_URL = "https://www.gstatic.com/firebasejs/10.14.1/";   // Firebase JS SDK v10 (modular)
// What this device remembers about the cloud: { uid: the family account it synced with, dirty: changes made before connecting }
const CLOUD_META = SAVE_KEY + ".cloud";
function cloudMeta() { try { return JSON.parse(localStorage.getItem(CLOUD_META)) || {}; } catch (e) { return {}; } }
function setCloudMeta(change) { try { localStorage.setItem(CLOUD_META, JSON.stringify({ ...cloudMeta(), ...change })); } catch (e) {} }

// The data split into the 3 cloud documents (copies), and put back together.
// 🎒 School pages live in the habits document too (a "school" field next to "marks"), so a kid ticking homework
// changes only that one item, like a habit tick. (Older cloud data has no "school" field: then it's empty.)
function splitData(d) {
  const { points, habitMarks, school, ...plan } = JSON.parse(JSON.stringify(d));
  return { plan, points, habits: { marks: habitMarks || {}, school: school || {} } };
}
function joinData(plan, points, habits) {
  return { ...plan, points: points || {}, habitMarks: (habits && habits.marks) || {}, school: (habits && habits.school) || {} };
}
// The same data always gives the same text (the cloud may return the keys in another order), so we can compare
function sameText(v) {
  return JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
}

// ---------- 📊 ANALYTICS (Google Analytics for Firebase): how many people use the app, and which pages they open ----------
// Only when the app is opened over https (not as a file). It sends ONLY: the automatic page_view / session events,
// a "screen_view" with the page's fixed English name (Today, Calendar, School …) and the user property role = parent | kid.
// NEVER names, emails, family ids, kid codes, school work, moods or anything the family typed: no setUserId, and the
// page_view gets a neutral title and the address without ?… / #… . No Google signals or ad personalisation.
// (The measurementId is in firebaseConfig; without one the SDK would fetch it by itself.)
const ANALYTICS_SCREENS = { home: "Today", mine: "Calendar", school: "School", points: "Points", me: "Profile", report: "Kids report",
                            diary: "My day", settings: "Settings", family: "Family", add: "Add activities", extra: "More pages",
                            setup: "Setup", start: "Who are you" };
let an = null, anScreen = null;   // { mod, a } once it's ready · the last screen sent
async function startAnalytics(app) {
  if (location.protocol !== "https:" || an) return;
  try {
    const mod = await import(FIREBASE_URL + "firebase-analytics.js");
    if (!(await mod.isSupported())) return;
    const a = mod.initializeAnalytics(app, { config: { page_title: "Family Plan", page_location: location.origin + location.pathname,
                                                      allow_google_signals: false, allow_ad_personalization_signals: false } });
    an = { mod, a };
    sendAnalyticsRole();
    trackScreen(screen);
  } catch (e) { console.warn("Analytics:", e); }   // (blocked by the browser or no internet: the app works the same)
}
function trackScreen(name) {
  if (!an || name === anScreen) return;
  anScreen = name;
  const label = ANALYTICS_SCREENS[name] || "Other";   // (a fixed name, never anything from the family's data)
  try { an.mod.logEvent(an.a, "screen_view", { firebase_screen: label, firebase_screen_class: label }); } catch (e) {}
}
function sendAnalyticsRole() {
  if (!an || !cloud.user) return;
  try { an.mod.setUserProperties(an.a, { role: isKidDevice() ? "kid" : "parent" }); } catch (e) {}
}

// ---------- Starting: load Firebase, then wait for the family login ----------
async function startCloud() {
  if (!cloud.enabled) return showSync();          // opened as a file: this device only
  if (cloud.fb || cloud.loading) return;
  cloud.loading = true;
  if (!cloudMeta().uid) showLogin("Connecting…", true);   // never signed in here: the login comes first
  showSync();
  try {
    const [app, auth, store] = await Promise.all(["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"]
      .map(file => import(FIREBASE_URL + file)));
    cloud.fb = { ...app, ...auth, ...store };
  } catch (e) {
    // No internet (or Firebase is blocked): keep working on this device, and try again when the internet is back.
    console.warn("Firebase didn't load:", e);
    cloud.loading = false;
    window.addEventListener("online", startCloud, { once: true });
    if (!cloudMeta().uid) showLogin("No internet. Connect to the internet to sign in the first time.", true);
    return showSync();
  }
  cloud.loading = false;
  const fb = cloud.fb, app = fb.initializeApp(firebaseConfig);
  startAnalytics(app);            // 📊 counting visits (https only; see ANALYTICS)
  cloud.auth = fb.getAuth(app);   // remembers the login on this device (until "Sign out")
  try {
    // Offline persistence: Firestore keeps a copy on the device and queues changes until you're online again
    cloud.db = fb.initializeFirestore(app, { ignoreUndefinedProperties: true,
      localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
  } catch (e) {
    console.warn("Offline copy not available:", e);
    cloud.db = fb.getFirestore(app);
  }
  fb.onAuthStateChanged(cloud.auth, user => user ? cloudSignedIn(user) : cloudSignedOut());
}

// ---------- The first screen: 👨‍👩‍👧 I'm a parent (sign in / new family / parent code) · 🧒 I'm a kid (a code) ----------
let lgMode = "signin";
function showLogin(message, busy) {
  $("loginScreen").hidden = false;
  $("loginHint").textContent = message || "Who is using this phone?";
  $("loginBtn").disabled = $("kidBtn").disabled = !!busy;
  showSync();
}
function hideLogin() { $("loginScreen").hidden = true; $("loginErr").textContent = $("kidErr").textContent = ""; $("loginPass").value = ""; }
// step: "choose" | "parent" | "kid"
function loginStep(step) {
  $("lgChoose").hidden = step !== "choose";
  $("loginForm").hidden = step !== "parent";
  $("kidForm").hidden = step !== "kid";
  if (step === "parent") loginMode(lgMode);
  if (step === "kid") $("kidCode").focus();
}
const LG_MODES = {
  signin: ["Sign in", "Sign in with your parent email.", "Sign in"],
  create: ["New family", "Make a family account. You'll add your kids next.", "Create a family account"],
  code:   ["Parent code", "Another parent gave you a code? Sign up with your own email, then type the code.", "Join the family"]
};
function loginMode(mode) {
  lgMode = mode;
  const [title, hint, btn] = LG_MODES[mode];
  $("lgTitle").textContent = "👨‍👩‍👧 " + title;
  $("lgModeHint").textContent = hint;
  $("loginBtn").textContent = btn;
  $("lgFamilyRow").hidden = mode !== "create";
  $("lgNameRow").hidden = mode === "signin";
  $("lgCodeRow").hidden = mode !== "code";
  $("loginPass").autocomplete = mode === "signin" ? "current-password" : "new-password";
  document.querySelectorAll("[data-lgmode]").forEach(b => { b.classList.toggle("on", b.dataset.lgmode === mode); b.setAttribute("aria-selected", b.dataset.lgmode === mode); });
  $("loginErr").textContent = "";
}
$("loginScreen").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.lg === "parent") return loginStep("parent");
  if (b.dataset.lg === "kid") return loginStep("kid");
  if (b.dataset.lg === "back") return loginStep("choose");
  if (b.dataset.lgmode) return loginMode(b.dataset.lgmode);
});
// A code as typed → "ABC234" (spaces gone, capitals; O → 0 is not a code letter, so it stays and fails)
const typedCode = id => $(id).value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
// Friendly words for Firebase's error codes
function loginError(err) {
  const code = (err && err.code) || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-login-credentials/.test(code)) return "That email or password isn't right. Please try again.";
  if (code.includes("invalid-email")) return "That doesn't look like an email address. Please check it.";
  if (code.includes("missing-password")) return "Please type the password.";
  if (code.includes("too-many-requests")) return "Too many tries. Please wait a few minutes, then try again.";
  if (code.includes("network-request-failed")) return "No internet. Connect to the internet and try again.";
  if (code.includes("user-disabled")) return "This account is turned off. Check it in the Firebase console.";
  if (code.includes("operation-not-allowed")) return "Email/Password sign-in isn't turned on in Firebase yet.";
  if (code.includes("unauthorized-domain")) return "This web address isn't allowed yet. Add it in Firebase → Authentication → Settings → Authorized domains.";
  return "Couldn't sign in. Please try again." + (code ? ` (${code})` : "");
}
// 👨‍👩‍👧 Parent: sign in, or create the account (new family / parent code). Then cloudSignedIn() → resolveMember() takes over.
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("loginEmail").value.trim(), pass = $("loginPass").value, fb = cloud.fb, mode = lgMode;
  const familyName = $("lgFamily").value.trim().slice(0, 40), parentName = $("lgName").value.trim().slice(0, 30), code = typedCode("lgPCode");
  if (!email || !pass) return $("loginErr").textContent = "Please type the email and the password.";
  if (mode === "create" && !familyName) return $("loginErr").textContent = "Please type your family name.";
  if (mode === "code" && !isCode(code)) return $("loginErr").textContent = "Please type the 6-letter parent code.";
  if (!fb) return $("loginErr").textContent = "No internet yet. Connect to the internet and try again.";
  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "One moment…";
  $("loginErr").textContent = "";
  cloud.pending = mode === "create" ? { kind: "create", familyName, parentName } : mode === "code" ? { kind: "parentcode", code, parentName } : null;
  try {
    if (mode === "signin") await fb.signInWithEmailAndPassword(cloud.auth, email, pass);
    else {
      // A new account. (Already has one? Then sign in with it.)
      try { await fb.createUserWithEmailAndPassword(cloud.auth, email, pass); }
      catch (err) { if ((err.code || "").includes("email-already-in-use")) await fb.signInWithEmailAndPassword(cloud.auth, email, pass); else throw err; }
    }
  } catch (err) { cloud.pending = null; $("loginErr").textContent = loginError(err); }
  $("loginBtn").disabled = false;
  loginMode(lgMode);
});
// 🧒 Kid: the code → signed in without an email (anonymous), as that kid. This device remembers it.
$("kidForm").addEventListener("submit", async e => {
  e.preventDefault();
  const code = typedCode("kidCode"), fb = cloud.fb;
  if (!isCode(code)) return $("kidErr").textContent = "Your code has 6 letters and numbers. Ask your parent for your code.";
  if (!fb) return $("kidErr").textContent = "No internet yet. Connect to the internet and try again.";
  $("kidBtn").disabled = true;
  $("kidErr").textContent = "";
  cloud.pending = { kind: "kid", code };
  try { await fb.signInAnonymously(cloud.auth); }
  catch (err) {
    cloud.pending = null;
    $("kidErr").textContent = (err.code || "").includes("operation-not-allowed") ? "Kid sign-in isn't turned on yet. Ask your parent (Firebase → Anonymous)." : loginError(err);
  }
  $("kidBtn").disabled = false;
});

// ---------- Who is this account? members/{uid} = { familyId, role: "parent" | "kid", kidId?, code?, name? } ----------
// Made here the first time: a new family (familyId = the new uid), a kid's code, a 2nd parent's code,
// or our first family account (it becomes that family's parent). Throws "badcode" / "nofamily" / a Firestore error.
async function resolveMember(user) {
  const fb = cloud.fb, ref = fb.doc(cloud.db, "members", user.uid), pending = cloud.pending;
  cloud.pending = null;
  let snap;
  try { snap = await fb.getDoc(ref); }
  catch (err) {
    // The Firestore rules from before families (no "members" yet): our family's account works exactly as before
    if (user.uid === OLD_FAMILY_UID) return { familyId: user.uid, role: "parent" };
    throw err;
  }
  if (snap.exists()) return snap.data();
  if (user.uid === OLD_FAMILY_UID) {
    const m = { familyId: user.uid, role: "parent" };
    await fb.setDoc(ref, m).catch(err => console.warn("Member:", err));
    return m;
  }
  if (!pending) throw new Error("nofamily");
  if (pending.kind === "create") {
    const m = { familyId: user.uid, role: "parent", name: pending.parentName || "" };
    await fb.setDoc(ref, m);
    await fb.setDoc(fb.doc(cloud.db, "families", user.uid), { name: pending.familyName, createdBy: user.uid, createdAt: new Date().toISOString() }, { merge: true });
    cloud.fresh = pending;
    return m;
  }
  // A code: a kid's (kidId = that kid), or a 2nd parent's (kidId = "parent")
  const codeRef = fb.doc(cloud.db, "codes", pending.code), c = await fb.getDoc(codeRef).catch(() => null);
  const code = c && c.exists() ? c.data() : null, forParent = pending.kind === "parentcode";
  if (!code || !code.familyId || (code.kidId === "parent") !== forParent) throw new Error("badcode");
  const m = forParent ? { familyId: code.familyId, role: "parent", name: pending.parentName || "", code: pending.code }
                      : { familyId: code.familyId, role: "kid", kidId: code.kidId, code: pending.code };
  await fb.setDoc(ref, m);
  if (forParent) fb.deleteDoc(codeRef).catch(() => {});   // a parent code works once
  return m;
}
const isKidDevice = () => (cloud.role || cloudMeta().role) === "kid";
const kidDeviceId = () => cloud.kidId || cloudMeta().kidId || null;

// Signed in: find the family, then listen to its 3 documents. Every change (from any phone) arrives here.
async function cloudSignedIn(user) {
  if (cloud.user && cloud.user.uid === user.uid) { hideLogin(); return showSync(); }
  const turn = cloud.turn = (cloud.turn || 0) + 1, wasKid = cloud.pending && cloud.pending.kind === "kid", known = cloudMeta().member;
  if (!known || known.uid !== user.uid) showLogin("Signing in…", true);
  let m = null;
  try { m = await resolveMember(user); }
  catch (err) {
    if (turn !== cloud.turn) return;
    const sure = err.message === "badcode" || err.message === "nofamily" || err.code === "permission-denied";
    // No internet (or the cloud is slow): use what this device already knows about this account, and keep it signed in
    if (!sure && known && known.uid === user.uid) m = known;
    else if (!sure) {
      showLogin("No internet? Connect to the internet, then open the app again.", false);
      window.addEventListener("online", () => { cloud.user = null; cloudSignedIn(user); }, { once: true });
      return;
    } else {
      // Wrong code / no family / not allowed: signed out again, with a friendly message on the right step
      const msg = err.message === "badcode" ? (wasKid ? "Ask your parent for your code." : "That parent code isn't right. Ask the other parent for a new one.")
        : err.message === "nofamily" ? "This account isn't in a family yet. Tap “New family”, or “Parent code”."
        : "The cloud said no. The family's Firestore rules need updating (see firestore.rules).";
      if (user.isAnonymous) fb_deleteQuietly(user); else cloud.fb.signOut(cloud.auth).catch(() => {});
      showLogin();
      loginStep(wasKid ? "kid" : "parent");
      $(wasKid ? "kidErr" : "loginErr").textContent = msg;
      return;
    }
  }
  if (turn !== cloud.turn) return;
  hideLogin();
  cloud.user = user;
  cloud.familyId = m.familyId;
  cloud.role = m.role === "kid" ? "kid" : "parent";
  cloud.kidId = cloud.role === "kid" ? m.kidId : null;
  setCloudMeta({ role: cloud.role, kidId: cloud.kidId, member: { uid: user.uid, familyId: m.familyId, role: cloud.role, kidId: cloud.kidId,
                 ...(typeof m.person === "string" ? { person: m.person } : {}), ...(typeof m.name === "string" ? { name: m.name } : {}) } });   // (👤 who this account is)
  applyRole();
  // 🆕 A new family: this device starts with only the parent (then "Add your kids")
  if (cloud.fresh) {
    data = freshFamilyData(cloud.fresh.parentName);
    savedJson = JSON.stringify(data);
    storeLocal();
    me = DAD;
  }
  const fb = cloud.fb, ref = name => fb.doc(cloud.db, "families", cloud.familyId, "state", name);
  cloud.refs = { plan: ref("plan"), points: ref("points"), habits: ref("habits") };
  cloud.snaps = {};
  cloud.ready = false;
  cloud.base = savedJson;   // this device's data now: changes made before the cloud answers are kept (see keepEarlyChanges)
  cloud.unsub = Object.keys(cloud.refs).map(name => fb.onSnapshot(cloud.refs[name], { includeMetadataChanges: true },
    snap => cloudSnap(name, snap), cloudError));
  // 🔔 The family's news list (a 4th document, kept apart from the data)
  feed.ref = ref("news");
  feed.items = {};
  feed.live = false;
  cloud.unsub.push(fb.onSnapshot(feed.ref, { includeMetadataChanges: true }, feedSnap, err => console.warn("News:", err)));
  // 🤖 The worksheets and explanations (each its own document, see AI HELP)
  aiListen();
  showSync();
  if (screen === "settings") render();
}
// A kid's wrong code: the empty no-email account is removed again
function fb_deleteQuietly(user) { cloud.fb.deleteUser(user).catch(() => cloud.fb.signOut(cloud.auth).catch(() => {})); }
// A new family's first data: only the parent (the family's admin, like Bro2a in ours)
function freshFamilyData(parentName) {
  const d = emptyData();
  d.users = [{ id: DAD, name: parentName || "Parent", emoji: "🦸‍♂️", color: "blue" }];
  return d;
}
// 🧒 / 👨‍👩‍👧 The device's role: a kid's device hides Settings, Switch user, backups and deleting (see the kid-device CSS)
function applyRole() {
  document.body.classList.toggle("kid-device", isKidDevice());
  sendAnalyticsRole();   // 📊 role = parent | kid (nothing else about the person)
  if (isKidDevice() && exists(kidDeviceId())) { me = kidDeviceId(); if (screen === "start") go("home"); }
}
function cloudSignedOut() {
  me = null;   // (👤 signed out: the next sign-in decides who this device is)
  setCloudMeta({ devicePerson: null });   // (the "Which parent are you?" pick on this device is forgotten too)
  cloud.turn = (cloud.turn || 0) + 1;
  cloud.unsub.forEach(stop => stop());
  cloud.unsub = [];
  cloud.user = null;
  cloud.familyId = cloud.role = cloud.kidId = null;
  setCloudMeta({ role: null, kidId: null, member: null });   // nobody is signed in: not a kid's device any more
  document.body.classList.remove("kid-device");
  cloud.ready = false;
  cloud.snaps = {};
  feed.ref = null;
  aiDocs.worksheets = {}; aiDocs.explanations = {};
  showLogin();
}

// A new copy of one document arrived (from the cloud, or our own change coming back)
function cloudSnap(name, snap) {
  cloud.snaps[name] = snap;
  showSync();
  if (!cloud.ready) return cloudFirstSync();
  if (snap.exists()) cloudApply(name, snap.data());
}

// ---------- The first time (on this device, since opening the app): match up the cloud and this device ----------
function cloudFirstSync() {
  const s = cloud.snaps;
  if (!s.plan || !s.points || !s.habits || cloud.asking) return;
  const cloudHasData = s.plan.exists();
  // Not in the offline copy yet: wait for the cloud's real answer before deciding it's empty
  if (!cloudHasData && [s.plan, s.points, s.habits].some(x => x.metadata.fromCache)) return;
  // 1) The cloud is empty: upload everything from this device
  if (!cloudHasData) {
    cloudUploadAll();
    cloudReady();
    // 🆕 A new family: "Add your kids" first
    if (cloud.fresh) { cloud.fresh = null; me = DAD; familySetup = true; return go("family"); }
    return toast("☁️ Your data is now in the family cloud. Sign in on the other phones to see it.", 5000);
  }
  const remote = cloudData(), local = JSON.parse(savedJson), meta = cloudMeta();
  const nothingHere = !local.fixed.length && !local.flexible.length && !local.routines.length
    && !Object.keys(local.points.marks).length && !Object.keys(local.habitMarks).length && !Object.keys(local.school || {}).length;
  // 2) Same data, nothing on this device yet, or this device was already in sync (the cloud is just newer): use the cloud
  // (a 🧒 kid's device never replaces the family's data, and neither does a device that was with ANOTHER family)
  if (sameText(remote) === sameText(local) || nothingHere || isKidDevice() || (meta.uid && meta.uid !== cloud.familyId)
      || (meta.uid === cloud.familyId && !meta.dirty))
    return cloudUseCloud(true);
  // 3) Both have different data: ask
  const count = d => `${d.users.length} people, ${d.fixed.length + d.flexible.length} activities, ` +
    `${Object.keys(d.points.marks).length + Object.keys(d.habitMarks).length} ticks`;
  $("syncInfo").innerHTML = `This device has different data from the family cloud.<br><br>
    <b>Cloud:</b> ${count(remote)}<br><b>This device:</b> ${count(local)}`;
  cloud.asking = true;
  $("syncModal").hidden = false;
  $("syncModal").querySelector("[data-sync=cloud]").focus();
}
// The cloud's data, cleaned up like any saved data
function cloudData() {
  const s = cloud.snaps, val = snap => snap && snap.exists() ? snap.data() : {};
  return cleanData(joinData(val(s.plan), val(s.points), val(s.habits)));
}
function answerSync(choice) {
  if (choice === "local" && !confirm("Replace the family's cloud data with this device's data?\n\nAll the family's phones will then show this device's data.")) return;
  $("syncModal").hidden = true;
  if (choice === "local") {
    cloudUploadAll();
    cloudReady();
    toast("☁️ The family cloud now has this device's data.", 4000);
  } else {
    cloudUseCloud();
    toast("☁️ Using the family data from the cloud.", 4000);
  }
}
// keepEarly = also keep the ticks/changes made on this device while waiting for the cloud's first answer
function cloudUseCloud(keepEarly) {
  const s = cloud.snaps, raw = snap => snap.exists() ? snap.data() : {};
  cloud.sent = { plan: raw(s.plan), points: raw(s.points), habits: raw(s.habits) };
  data = keepEarly && cloud.base ? keepEarlyChanges(cloudData(), JSON.parse(cloud.base), JSON.parse(savedJson)) : cloudData();
  cloud.stash = null;
  finishPlanAfterLoad();
  newWeek();
  if (me && !exists(me)) me = null;
  resetFixedForm(); resetFlexForm(); resetUserForm(); closeRoutineForm(); resetHabitForm();
  cloudReady();
  { const dm = deviceMe(); if (dm) me = dm; }   // 👤 always the signed-in person
  if (!me && screen !== "start" && screen !== "view") go("start"); else if (me && screen === "start") go("home"); else render();
}
// The cloud's data + what changed on this device (from base to local) in the first seconds:
// ticks added or removed are copied over one by one; a saved plan change wins as a whole.
function keepEarlyChanges(remote, base, local) {
  if (sameText(base) === sameText(local)) return remote;
  const b = splitData(base), l = splitData(local), r = splitData(remote), kid = isKidDevice() ? kidDeviceId() : null;
  if (sameText(b.plan) !== sameText(l.plan)) {
    // ⚠️ This device's plan may win ONLY when: not a kid's device, the plan it started from had real activities, and this
    // device was already synced with this same family. (An emptied device, e.g. right after signing out and in with a code,
    // must never replace the family's activities and week plan.) Otherwise: the cloud's plan, plus this device's first-time picks.
    const mayWin = !isKidDevice() && planSize(b.plan) > 0 && cloudMeta().uid === cloud.familyId;
    if (mayWin) {
      const cloudPlan = r.plan;
      r.plan = { ...l.plan, users: (l.plan.users || []).map(u => ({ ...u })) };
      mergePicks(r.plan, cloudPlan);   // 🌱 👋 ⭐ (a buddy, the tour, habits chosen on another phone aren't lost)
    } else mergePicks(r.plan, l.plan);   // (the cloud's plan stays; only 🌱 👋 ⭐ picks made here are added)
  }
  ["points", "habits"].forEach(part => {
    const bm = b[part].marks || {}, lm = l[part].marks || {}, rm = r[part].marks = r[part].marks || {};
    new Set([...Object.keys(bm), ...Object.keys(lm)]).forEach(key => {
      if (sameText(bm[key]) === sameText(lm[key])) return;
      if (kid && key.split("|").pop() !== kid) return;   // (🧒 a kid's device: only their own ticks)
      if (hasOwn(lm, key)) rm[key] = lm[key]; else delete rm[key];
    });
  });
  // 📚 Study session results made here in those first seconds win too (🧒 a kid's device: only their own)
  // (⭐ free study points too)
  ["sessions", "free", "picks"].forEach(part => {
    const bs = b.points[part] || {}, ls = l.points[part] || {}, rs = r.points[part] = r.points[part] || {};
    new Set([...Object.keys(bs), ...Object.keys(ls)]).forEach(key => {
      if (sameText(bs[key]) === sameText(ls[key]) || (kid && key.split("|").pop() !== kid)) return;
      if (hasOwn(ls, key)) rs[key] = ls[key]; else delete rs[key];
    });
  });
  // 🎒 School changes made here in those first seconds win (🧒 a kid's device: only that kid's own school data)
  if (sameText(b.habits.school) !== sameText(l.habits.school)) {
    if (!kid) r.habits.school = l.habits.school;
    else if (l.habits.school && hasOwn(l.habits.school, kid)) r.habits.school = { ...(r.habits.school || {}), [kid]: l.habits.school[kid] };
  }
  return cleanData(joinData(r.plan, r.points, r.habits));
}
// How much real plan there is: fixed + flexible activities + routines (0 = an empty plan)
const planSize = p => ((p && p.fixed) || []).length + ((p && p.flexible) || []).length + ((p && p.routines) || []).length;
// How many items a saved week plan has (📅 by date, or the older plan.days[0–6]): 0 = none
const planItemCount = wp => !wp || typeof wp !== "object" ? 0
  : [...Object.values(wp.dates || {}), ...(Array.isArray(wp.days) ? wp.days : [])].reduce((n, day) => n + ((day && Array.isArray(day.items)) ? day.items.length : 0), 0);
// 🗑️ A parent deleted activities on purpose in the activities editor (on a parent's device): the only time an empty plan may be sent
let planWipeOk = false;
// From now on every change goes to the cloud right away
function cloudReady() {
  cloud.ready = true;
  cloud.asking = false;
  setCloudMeta({ uid: cloud.familyId, dirty: false });   // (uid = the family this device synced with)
  writeData("auto");   // stores it here, and uploads anything the app tidied up (e.g. a new week)
  applyRole();         // 🧒 a kid's device: open as that kid now that their family's people are here
  uploadPhotos();      // 📥 Seesaw photos added before the cloud was ready
  uploadFiles();       // 🎒 school files too
  topicsFromAllWorksheets();   // 📚 the worksheets' topics into 📚 My topics (the ones already done too: once, no doubles)
  showSync();
}

// ---------- Uploading ----------
// The plan document also says who changed it last: change = { by, at, what, dev } (so others know who changed what).
// planOnly() is the plan without that note.
function planOnly(p) { const { change, ...rest } = p || {}; return rest; }
function changeNote(what) { return { by: me || "", at: new Date().toISOString(), what, dev: DEVICE }; }
// Everything: replaces the 3 cloud documents (first upload, "Replace cloud", Import backup, Clear everything)
// told = someone did it on purpose (Import backup, Clear everything, Load example): tell the family
function cloudUploadAll(told) {
  if (isKidDevice()) return console.warn("☁️ Not sent: a kid's device never replaces the family's cloud data.");
  const parts = splitData(data);
  // ⚠️ Safety net: an empty plan never replaces a cloud plan that has activities (unless a parent deleted them on purpose)
  if (cloud.sent && planSize(planOnly(cloud.sent.plan)) > 0 && planSize(parts.plan) === 0 && !(planWipeOk && isParentDevice())) {
    console.warn("☁️ Plan NOT replaced: it has no activities or routines, but the family's cloud plan has some. The cloud copy is kept.");
    parts.plan = planOnly(cloud.sent.plan);
  }
  if (told) {
    const what = "replaced all the family data";
    parts.plan.change = changeNote(what);
    addNews([newsItem("plan", what)]);
  }
  cloud.sent = JSON.parse(JSON.stringify(parts));
  Object.keys(cloud.refs).forEach(name => cloud.fb.setDoc(cloud.refs[name], parts[name]).catch(cloudError));
}
// Only what changed since the last upload.
// how = "auto": the app tidied up by itself (a new week, planned again after an update) — that isn't news.
function cloudUpload(how) {
  const now = splitData(data), told = how !== "auto", news = [];
  // The plan document is sent whole (it only changes with 💾 Save, "Plan my week", adding a person …)
  const before = planOnly(cloud.sent.plan);
  // 🧒 A kid's device never removes or replaces activities, the week plan or other people's data: from its plan only the
  // kid's OWN profile (name, emoji, colour, birthday, picks, school basics …) goes up; everything else stays as the cloud has it.
  const kid = isKidDevice() ? kidDeviceId() : null;
  if (kid) {
    const own = (now.plan.users || []).find(u => u.id === kid), list = Array.isArray(before.users) ? before.users : null;
    now.plan = list && own && list.some(u => u.id === kid) ? { ...before, users: list.map(u => u.id === kid ? own : u) } : before;
  }
  // ⚠️ Safety net (📅 the move to dates too): never send a week plan with no items over a cloud plan that has some while there
  // are still activities (that would be a plan that got lost, not one a parent emptied): the cloud's week plan is kept
  if (planItemCount(before.plan) > 0 && planItemCount(now.plan.plan) === 0 && planSize(now.plan) > 0 && !planWipeOk) {
    console.warn("☁️ The week plan was NOT sent: it has no items, but the family's cloud plan has some. The cloud copy is kept.");
    now.plan = { ...now.plan, plan: before.plan };
  }
  if (sameText(now.plan) !== sameText(before)) {
    // ⚠️ Safety net: never send a plan with 0 activities and 0 routines over a cloud plan that has some
    // (only a parent deleting them on purpose in the activities editor, on a parent's device, may do that)
    if (planSize(before) > 0 && planSize(now.plan) === 0 && !(planWipeOk && isParentDevice() && !kid)) {
      console.warn("☁️ Plan NOT sent: it has no activities or routines, but the family's cloud plan has " + planSize(before)
        + ". The cloud copy is kept (only a parent deleting them in the activities editor may empty it).");
    } else {
      planWipeOk = false;
      const what = planNews(before, now.plan);   // ("" = only someone's own prayer choice: not news)
      const change = told && what ? changeNote(what) : (cloud.sent.plan || {}).change;
      cloud.sent.plan = change ? { ...now.plan, change } : now.plan;
      cloud.fb.setDoc(cloud.refs.plan, cloud.sent.plan).catch(cloudError);
      if (told && what) news.push(newsItem("plan", what));
    }
  }
  // Ticks and unticks (worked out before cloud.sent is updated below)
  if (told) news.push(...tickNews(cloud.sent.points, now.points), ...habitNews(cloud.sent.habits, now.habits));
  cloudUpdateFields("points", now.points);
  cloudUpdateFields("habits", now.habits);
  addNews(news);
}
// Points and habits: update only the fields that changed (one tick = one field, e.g. marks."2|math|mody")
function cloudUpdateFields(name, now) {
  const fb = cloud.fb, before = cloud.sent[name] || {}, changes = [];
  // Ticks, 👨‍👩‍👧 auto points, 🎁 prizes, 🧩 riddles and answers: one field per item (so two phones don't overwrite each other)
  const BY_ITEM = ["marks", "auto", "prizes", "riddles", "riddleAns", "diary", "lifetime", "levels", "duties", "wishes",
                   "meeting", "screen", "quran", "quranHeard", "chores", "want", "notes", "study", "prizeMsg", "reach", "when", "hall", "community", "cmReact", "cmDone",
                   "sessions", "studyWeeks", "free", "picks"];   // (📚 study session results, each past week's study, ⭐ free study, 📚 subject picks)
  const kid = isKidDevice() ? kidDeviceId() : null;   // (🧒 a kid's device: only their own ticks, 📚 sessions and their own school data go up)
  BY_ITEM.filter(k => now[k] && typeof now[k] === "object").forEach(k => {
    let was = before[k] && typeof before[k] === "object" ? before[k] : {};
    const is = now[k], cloudKey = {};
    // 📅 Older ticks in the cloud are "day|activity|person" (day 0–6 of the points week). Only a parent's device moves them to dates
    // (its first upload after cleanData). A kid's device compares with them AS dates, so it never sends that change, and an untick
    // removes the cloud's own (older) key.
    if (k === "marks" && kid) {
      const w = {};
      Object.entries(was).forEach(([key, m]) => { const [day, ...rest] = key.split("|"), nk = [markDateOf(day, before.week || now.week), ...rest].join("|");
        w[nk] = m; if (nk !== key) cloudKey[nk] = key; });
      was = w;
    }
    new Set([...Object.keys(was), ...Object.keys(is)]).forEach(key => {
      if (kid && ["marks", "sessions", "studyWeeks", "free", "picks"].includes(k) && key.split("|").pop() !== kid) return;
      if (!hasOwn(is, key)) changes.push(new fb.FieldPath(k, cloudKey[key] || key), fb.deleteField());   // unticked
      else if (sameText(was[key]) !== sameText(is[key])) changes.push(new fb.FieldPath(k, key), is[key]);
    });
  });
  // The other fields (week, history …) only change on a new week.
  // 🎒 "school" (habits document): only the items that changed (e.g. school.mody.tasks.abc12), when the cloud has it already.
  Object.keys(now).forEach(k => {
    if (BY_ITEM.includes(k) || sameText(before[k]) === sameText(now[k])) return;
    if (k === "school" && kid) {   // 🧒 only school.<this kid>, never the other kids' school data
      const w = before.school && typeof before.school === "object" ? before.school : {}, n = now.school || {};
      if (sameText(w[kid]) === sameText(n[kid])) return;
      if (w[kid] && n[kid]) changes.push(...schoolChanges({ [kid]: w[kid] }, { [kid]: n[kid] }));
      else if (n[kid]) changes.push(new fb.FieldPath("school", kid), n[kid]);
      return;
    }
    if (k === "school" && before.school && typeof before.school === "object") changes.push(...schoolChanges(before.school, now.school));
    else changes.push(k, now[k]);
  });
  if (!changes.length) return;
  cloud.sent[name] = now;
  fb.updateDoc(cloud.refs[name], ...changes).catch(err => {
    // The document isn't in the cloud yet: create it with everything
    // (🧒 never from a kid's device: it would write the whole document)
    if (err && err.code === "not-found" && !kid) fb.setDoc(cloud.refs[name], splitData(data)[name]).catch(cloudError);
    else if (err && err.code === "not-found") console.warn("☁️ Not sent: a kid's device doesn't create the family's " + name + " document.");
    else cloudError(err);
  });
}

// 🎒 The changed parts of the school data, as Firestore field changes: a kid, a kid's info, or one item of a list
function schoolChanges(was, is) {
  const fb = cloud.fb, out = [], path = (...p) => new fb.FieldPath("school", ...p);
  const obj = x => x && typeof x === "object" && !Array.isArray(x);
  new Set([...Object.keys(was), ...Object.keys(is)]).forEach(kid => {
    const a = was[kid], b = is[kid];
    if (sameText(a) === sameText(b)) return;
    if (!hasOwn(is, kid)) return out.push(path(kid), fb.deleteField());
    if (!obj(a)) return out.push(path(kid), b);
    Object.keys(b).forEach(part => {
      const x = a[part], y = b[part];
      if (sameText(x) === sameText(y)) return;
      if (part === "info" || !obj(x) || !obj(y)) return out.push(path(kid, part), y);
      new Set([...Object.keys(x), ...Object.keys(y)]).forEach(id => {
        if (sameText(x[id]) !== sameText(y[id])) out.push(path(kid, part, id), hasOwn(y, id) ? y[id] : fb.deleteField());
      });
    });
  });
  return out;
}

// ---------- A change from another phone ----------
function cloudApply(name, remote) {
  if (sameText(remote) === sameText(cloud.sent[name])) return;   // nothing new (e.g. our own change coming back)
  // You're in the middle of changes (not saved yet): show the other phone's plan after you Save or Cancel
  if (name === "plan" && hasDraft()) {
    if (cloud.stash && sameText(cloud.stash) === sameText(remote)) return;
    cloud.stash = remote;
    // 🌱 👋 ⭐ First-time choices made on another phone join right away (in the draft AND in what counts as saved), so 💾 Save never drops them
    const saved = JSON.parse(savedJson);
    if (mergePicks(data, remote) | mergePicks(saved, remote)) { savedJson = JSON.stringify(saved); storeLocal(); render(); }
    return toast("☁️ The plan was changed on another phone. “Cancel changes” shows it · 💾 Save keeps yours.", 6000);
  }
  cloud.sent[name] = remote;
  const parts = splitData(data);
  parts[name] = remote;
  const fresh = cleanData(joinData(parts.plan, parts.points, parts.habits));
  if (name === "plan") {
    // 🌱 👋 ⭐ A first-time choice this phone has but the cloud lost (an older phone saved over it): keep it, and send it back up
    const lostBuddy = mergePicks(fresh, data);
    Object.keys(fresh).forEach(k => { if (k !== "points" && k !== "habitMarks") data[k] = fresh[k]; });
    const replanned = finishPlanAfterLoad();
    savedJson = JSON.stringify(data);
    if (replanned || lostBuddy) cloudUpload("auto");
    if (me && !exists(me)) me = null;   // your person was removed on another phone
  } else {
    // Ticks: change them in the data AND in what counts as "saved", so a draft you're working on stays a draft
    // (the habits document also has the 🎒 school pages)
    const keys = name === "points" ? ["points"] : ["habitMarks", "school"];
    const saved = JSON.parse(savedJson);
    keys.forEach(key => {
      data[key] = fresh[key];
      saved[key] = JSON.parse(JSON.stringify(fresh[key]));
    });
    savedJson = JSON.stringify(saved);
  }
  storeLocal();
  if (!me) { const dm = deviceMe(); if (dm) me = dm; }   // 👤 always the signed-in person
  if (!me && screen !== "start" && screen !== "view") go("start"); else if (me && screen === "start") go("home"); else render();
}

function cloudError(err) {
  console.warn("Cloud:", err);
  const code = err && err.code;
  if (code === "permission-denied") toast("⚠ The cloud said no. Check the Firestore rules in the Firebase console.", 6000);
  else if (code === "resource-exhausted") toast("⚠ The cloud is busy (daily limit reached). Changes are kept on this device.", 6000);
  showSync();
}

// ---------- The tiny "☁️ Synced / 📴 Offline" sign ----------
function showSync() {
  const pill = $("syncPill");
  if (!cloud.enabled) { pill.hidden = false; pill.textContent = "💾 This device only"; return; }
  if (cloud.fb && !cloud.user) { pill.hidden = true; return; }   // the login screen is showing
  const snaps = Object.values(cloud.snaps);
  const offline = !navigator.onLine || !cloud.fb || (cloud.ready && snaps.some(s => s.metadata.fromCache));
  const busy = !cloud.ready || snaps.some(s => s.metadata.hasPendingWrites);
  pill.hidden = false;
  pill.textContent = offline ? "📴 Offline" : busy ? "🔄 Syncing…" : "☁️ Synced";
  pill.classList.toggle("off", offline);
}
window.addEventListener("online", showSync);
window.addEventListener("offline", showSync);

// ---------- Sign out (Settings, Bro2a only) ----------
// 🚪 Sign out from this phone (👤 My profile, ☰ More, ⚙️ Settings). The family's data stays in the cloud: nothing is deleted there.
// A kid comes back with their 6-letter code (it keeps working); a parent with the family email and password.
$("signOutBtn").onclick = () => signOutDevice();
async function signOutDevice() {
  if (!cloud.user) return toast("This phone isn't signed in to a family.", 3000);
  const waiting = Object.values(cloud.snaps).some(s => s.metadata.hasPendingWrites);
  const back = isKidDevice() ? "You can come back with your 6-letter code." : "You'll need the family email and password to come back.";
  if (!confirm(`Sign out from this phone?\n\n${back}\n\n` + (waiting
      ? "⚠ Some changes haven't reached the cloud yet (no internet?). If you sign out now, they'll be lost."
      : "The family's data stays safe in the cloud."))) return;
  const fb = cloud.fb;
  cloud.unsub.forEach(stop => stop());
  cloud.unsub = [];
  cloud.ready = false;
  try { await fb.signOut(cloud.auth); } catch (e) {}
  // Forget the family's data on this device (it stays in the cloud), then start fresh at the login
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(CLOUD_META); } catch (e) {}
  try { await fb.terminate(cloud.db); await fb.clearIndexedDbPersistence(cloud.db); } catch (e) {}
  location.reload();   // → the first screen
}
