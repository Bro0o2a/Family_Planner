// =====================================================================
//  🔔 WHAT'S NEW: news and notifications about the family's changes
// =====================================================================
// The device that makes a change writes one line about it into the cloud document "news"
// (families/{family account id}/state/news → { items: { id: news } }), keeping the newest 30.
// Every device listens to it: news from ANOTHER device pops up (a toast + a phone notification),
// and the 🔔 button counts what this device hasn't looked at yet.
// Many ticks by the same person within 1 minute become one line (and one notification).
const NEWS_MAX = 30;
const NEWS_MINUTE = 60 * 1000;
// What this device remembers: { on: show pop-ups here, init: set up, opened: the news seen when the list was last opened }
const NEWS_KEY = SAVE_KEY + ".news";
function newsPrefs() { try { return { on: true, ...JSON.parse(localStorage.getItem(NEWS_KEY)) }; } catch (e) { return { on: true }; } }
function setNewsPrefs(change) { try { localStorage.setItem(NEWS_KEY, JSON.stringify({ ...newsPrefs(), ...change })); } catch (e) {} }

// ---------- Making news (on the device where the change happened) ----------
// kind = "tick" (ticks and unticks) or "plan" (a saved plan change)
// what = the words after the name ("finished Math ✓"), short = the short form for a group of ticks ("Math ✓")
function newsItem(kind, what, short, by, at) {
  const who = by || me || "", when = at || new Date().toISOString();
  return { id: newId(), kind, by: who, who: exists(who) ? whoText(who) : "🙂 Someone", what, short: short || what,
           list: [short || what], n: 1, at: when, start: new Date().toISOString(), dev: DEVICE };
}
// Activity ticks: what's ticked or unticked now that wasn't before (uses "by" and "at" from points.marks)
function tickNews(before, now) {
  if (!before || before.week !== now.week) return [];   // a new week cleared the ticks: that's not "unticked"
  const was = before.marks || {}, is = now.marks || {}, out = [];
  new Set([...Object.keys(was), ...Object.keys(is)]).forEach(key => {
    if (!!was[key] === !!is[key]) return;
    const [, actId, user] = key.split("|"), act = allActs().find(a => a.id === actId), pact = !act && (data.parentActs || []).find(a => a.id === actId);
    const name = act ? act.name : pact ? `${pactType(pact)[1]} ${pact.title}` : "an activity", by = is[key] ? is[key].by : me;
    const forWho = by !== user ? ` for ${whoText(user)}` : "";
    out.push(is[key]
      ? newsItem("tick", by === user ? `finished ${name} ✓` : `ticked ${name}${forWho} ✓`, `${name} ✓`, by, is[key].at)
      : newsItem("tick", `unticked ${name}${forWho}`, `${name} ✗`, by));
  });
  return out;
}
// Good habit ticks (the last 7 days only: ticks older than 5 weeks are tidied away, that's not news)
function habitNews(before, now) {
  const was = (before && before.marks) || {}, is = now.marks || {}, out = [];
  const recent = new Date(); recent.setDate(recent.getDate() - 7);
  const count = (h, v) => h.kind === "prayers" ? (Array.isArray(v) ? v.filter(Boolean).length : 0)
                        : h.kind === "water" ? (v || 0) : (v === true ? 1 : 0);
  new Set([...Object.keys(was), ...Object.keys(is)]).forEach(key => {
    if (key.slice(0, 10) < ymd(recent) || sameText(was[key]) === sameText(is[key])) return;
    const [, habitId, user] = key.split("|"), h = data.habits.find(x => x.id === habitId);   // (a parent's old "ph-" habit: no news)
    if (!h) return;
    const old = was[key], v = is[key], name = `${h.emoji} ${h.name}`;
    const forWho = me !== user ? ` for ${whoText(user)}` : "";
    let what, short;
    if (count(h, v) < count(h, old)) { what = `unticked ${name}${forWho}`; short = `${name} ✗`; }
    else if (habitDone(h, v)) { what = me === user ? `finished ${name} ✓` : `ticked ${name}${forWho} ✓`; short = `${name} ✓`; }
    else {
      const i = h.kind === "prayers" ? PRAYERS.findIndex((p, k) => v[k] && !(Array.isArray(old) && old[k])) : -1;
      const part = i >= 0 ? ` (${PRAYERS[i]})` : h.kind === "water" ? ` (${v}/${WATER_DROPS})` : "";
      what = `ticked ${name}${part}${forWho}`; short = `${name}${part}`;
    }
    out.push(newsItem("tick", what, short, me));
  });
  return out;
}
// A saved plan change, in words: "added Math · changed School · changed the routines"
function planNews(before, now) {
  const acts = p => [...(p.fixed || []), ...(p.flexible || []),
                     ...(p.parentActs || []).map(a => ({ ...a, name: `${pactType(a)[1]} ${a.title}` })),   // (📅 a parent's own activities too)
                     ...(p.oneDay || []).map(e => ({ ...e, name: `📌 ${e.title}` }))];   // (📌 one-day events too)
  const was = acts(before), is = acts(now), find = (list, id) => list.find(a => a.id === id);
  const few = list => list.slice(0, 3).map(a => a.name).join(", ") + (list.length > 3 ? ` +${list.length - 3} more` : "");
  const added = is.filter(a => !find(was, a.id)), removed = was.filter(a => !find(is, a.id));
  const edited = is.filter(a => find(was, a.id) && sameText(find(was, a.id)) !== sameText(a));
  const parts = [];
  if (added.length) parts.push("added " + few(added));
  if (removed.length) parts.push("removed " + few(removed));
  if (edited.length) parts.push("changed " + few(edited));
  // (a person's own 🕌 prayer choice isn't news for the family)
  const plain = (k, p) => k !== "users" ? p[k] : (p.users || []).map(({ showPrayer, prayerRemind, buddy, buddyAt, sparkName, focus, focusAt, toured, setupAsked, ...u }) => u);   // (🌱 a buddy, ⭐ focus habits, 👋 the tour: not news either)
  [["users", "the people"], ["routines", "the routines"], ["habits", "the good habits"], ["parentHabits", "the parents' habits"], ["features", "the app's features"]].forEach(([k, label]) => {
    if (sameText(plain(k, before)) !== sameText(plain(k, now))) parts.push("changed " + label);
  });
  if (sameText(before.myDay) !== sameText(now.myDay) || before.maxTogether !== now.maxTogether
      || sameText(before.prayer) !== sameText(now.prayer)) parts.push("changed the settings");
  if (!parts.length && sameText(before.plan) !== sameText(now.plan)) parts.push("changed the calendar 📅");
  // Only someone's own 🕌 choice changed: no news ("")
  if (!parts.length && sameText({ ...before, users: plain("users", before) }) === sameText({ ...now, users: plain("users", now) })) return "";
  return parts.length ? parts.join(" · ") : "changed the plan";
}
const newestFirst = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
const newsSig = it => it.id + ":" + (it.n || 1);   // changes when more ticks join the same line
// Adds news to the cloud list (only the lines that changed are sent, so two phones adding at once don't clash)
function addNews(list) {
  if (!list.length || !feed.ref || !cloud.fb) return;
  const fb = cloud.fb, items = { ...feed.items }, changes = new Map();
  list.forEach(it => {
    // A tick by the same person on this device within 1 minute joins the line that's already there
    const last = it.kind === "tick" && Object.values(items).find(x => x.kind === "tick" && x.dev === DEVICE && x.by === it.by
      && Date.now() - Date.parse(x.start) < NEWS_MINUTE);
    const line = last ? { ...last, n: (last.n || 1) + 1, list: [...(last.list || []), it.short].slice(-10), what: it.what, at: it.at } : it;
    items[line.id] = line;
    changes.set(line.id, line);
  });
  // Keep only the newest 30
  Object.values(items).sort(newestFirst).slice(NEWS_MAX).forEach(x => { delete items[x.id]; changes.set(x.id, null); });
  feed.items = items;
  const args = [];
  changes.forEach((v, id) => args.push(new fb.FieldPath("items", id), v === null ? fb.deleteField() : v));
  fb.updateDoc(feed.ref, ...args).catch(err => {
    // The list isn't in the cloud yet: create it
    if (err && err.code === "not-found") fb.setDoc(feed.ref, { items: feed.items }, { merge: true }).catch(e => console.warn("News:", e));
    else console.warn("News:", err);
  });
  drawNews();
}

// ---------- Getting news (from the other devices) ----------
function feedSnap(snap) {
  feed.items = (snap.exists() && snap.data().items) || {};
  const quiet = !feed.live;                    // the first answer = old news: count it, but no pop-ups
  if (!snap.metadata.fromCache) feed.live = true;
  // The very first time on this device: start with nothing new
  if (feed.live && !newsPrefs().init) setNewsPrefs({ init: true, opened: Object.values(feed.items).map(newsSig) });
  const fresh = [];
  Object.values(feed.items).forEach(it => {
    const sig = newsSig(it);
    if (feed.seen.has(sig)) return;
    feed.seen.add(sig);
    if (!quiet && it.dev !== DEVICE) fresh.push(it);
  });
  if (!$("newsModal").hidden) { fresh.forEach(it => feed.fresh.add(newsSig(it))); markNewsOpened(); }
  if (fresh.length) announce(fresh.sort(newestFirst).reverse());
  drawNews();
}
// "🦄 Bana" (or the name saved with the news, if that person was removed)
function newsWho(it) { return exists(it.by) ? whoText(it.by) : it.who || "🙂 Someone"; }
function newsWhat(it) {
  const n = it.n || 1, list = it.list || [];
  return n > 1 ? `made ${n} ticks: ${n > list.length ? "… " : ""}${list.slice(-4).join(", ")}${list.length > 4 ? " …" : ""}` : it.what;
}
const newsLine = it => `${newsWho(it)} ${newsWhat(it)}`;
// 🦉 School results ("school": a 🤖 check, its what = the whole line) are only for the parents (Bro2a's devices)
const newsForMe = it => it.kind === "cm" ? cmFor(it.to) : it.kind !== "school" || isParentId(me);   // (🏡 a post: only who it's for)
// Pop-ups: one for each plan change / school result, and one for all the ticks of the same minute (it's updated, not repeated)
function announce(list) {
  if (!newsPrefs().on) return;
  list = list.filter(newsForMe);
  list.filter(it => it.kind === "school").forEach(it => showNews(it.what, "", "school-" + it.id));
  list.filter(it => it.kind !== "tick" && it.kind !== "school").forEach(it => showNews(newsLine(it), "", "plan-" + it.id));
  const ticks = list.filter(it => it.kind === "tick");
  if (!ticks.length) return;
  if (!feed.bundle || Date.now() - feed.bundle.start > NEWS_MINUTE) feed.bundle = { start: Date.now(), items: new Map() };
  ticks.forEach(it => feed.bundle.items.set(it.id, it));
  const all = [...feed.bundle.items.values()], count = all.reduce((sum, it) => sum + (it.n || 1), 0);
  if (all.length === 1) showNews(newsLine(all[0]), "", "ticks-" + feed.bundle.start);
  else showNews(`✓ ${count} new ticks in the family`, all.map(newsLine).join("\n"), "ticks-" + feed.bundle.start);
}
function showNews(title, body, tag) {
  toast(body ? `🔔 ${title}` : title, 4500);
  systemNotify(title, body, tag);
}
// A phone/computer notification. Through the service worker, so it also shows when the app is in the background.
// The same tag replaces the old notification quietly (that's how a minute of ticks stays ONE notification).
async function systemNotify(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options = { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png" };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch (e) { console.warn("Notification:", e); }
}

// ---------- The 🔔 button and the "What's new" list ----------
function unreadNews() {
  const p = newsPrefs();
  if (!p.init) return 0;
  const opened = new Set(p.opened || []);
  return Object.values(feed.items).filter(it => it.dev !== DEVICE && newsForMe(it) && !opened.has(newsSig(it))).length;
}
function drawNews() {
  const n = unreadNews();
  document.querySelectorAll("[data-bell]").forEach(b => {
    const num = b.querySelector(".bell-num");
    num.hidden = !n;
    num.textContent = n;
    b.setAttribute("aria-label", n ? `What's new: ${n} new` : "What's new");
  });
  if ($("newsModal").hidden) return;
  const list = Object.values(feed.items).filter(newsForMe).sort(newestFirst);
  $("newsList").innerHTML = list.length ? list.map(it => {
    const u = exists(it.by) ? userById(it.by) : null, saved = (it.who || "🙂 Someone").split(" ");
    return `<li class="news-item ${feed.fresh.has(newsSig(it)) ? "new" : ""}">
      <span class="news-face">${safe(u ? u.emoji : saved[0])}</span>
      <div>${it.kind === "school" ? safe(it.what) : `<b>${safe(u ? u.name : saved.slice(1).join(" ") || "Someone")}</b> ${safe(newsWhat(it))}`}
        <small>${agoText(it.at)}${it.dev === DEVICE ? " · on this device" : ""}</small></div></li>`;
  }).join("") : `<li class="news-empty">Nothing new yet. Ticks and plan changes will show up here.</li>`;
  $("newsNotify").innerHTML = notifyHtml();
}
// "just now", "5 min ago", "today 4:30pm", "yesterday 9am", "Mon, Oct 5 4:30pm"
function agoText(iso) {
  const t = Date.parse(iso);
  if (!t) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  const dt = new Date(t), time = showTime(dt.getHours() * 60 + dt.getMinutes()), y = new Date();
  y.setDate(y.getDate() - 1);
  if (ymd(dt) === ymd(new Date())) return "today " + time;
  if (ymd(dt) === ymd(y)) return "yesterday " + time;
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " " + time;
}
// Opening the list clears the red number (on this device only)
function openNews() {
  const opened = new Set(newsPrefs().opened || []);
  feed.fresh = new Set(Object.values(feed.items).filter(it => it.dev !== DEVICE && !opened.has(newsSig(it))).map(newsSig));
  markNewsOpened();
  $("newsModal").hidden = false;
  drawNews();
  $("newsModal").querySelector("[data-newsclose]").focus();
}
function markNewsOpened() { setNewsPrefs({ init: true, opened: Object.values(feed.items).map(newsSig) }); }
function closeNews() { $("newsModal").hidden = true; }

// ---------- 🔒 Your privacy (the login screen's "🔒 Privacy" link, and ☰ More) ----------
let privacyFrom = null;   // the button that opened it (it gets the focus back)
function openPrivacy() {
  privacyFrom = document.activeElement;
  $("privacyContact").hidden = !CONTACT;
  $("privacyContact").textContent = CONTACT ? "Questions? Contact: " + CONTACT : "";
  $("privacyDate").textContent = "Last updated: " + PRIVACY_UPDATED;
  $("privacyModal").hidden = false;
  $("privacyModal").querySelector(".pv-card").scrollTop = 0;
  $("privacyModal").querySelector("[data-privacyclose]").focus();
}
function closePrivacy() {
  $("privacyModal").hidden = true;
  if (privacyFrom && privacyFrom.isConnected) privacyFrom.focus();
}

// ---------- 🔔 Notifications on this device (in Settings and in the "What's new" list) ----------
function notifyHtml() {
  const can = "Notification" in window, perm = can ? Notification.permission : "";
  const status = !can ? "This browser can't show notifications. On iPhone or iPad: add the app to the Home Screen, then open it from there."
    : perm === "granted" ? "✅ Notifications are allowed on this device."
    : perm === "denied" ? "🚫 Notifications are blocked. Allow them in this browser's settings for this app, then come back."
    : "Get a message when someone in the family ticks something or changes the plan.";
  return `<p class="hint">${status}</p>
    ${perm === "default" ? `<button class="primary" data-notifyask>🔔 Allow notifications</button>` : ""}
    <label class="checkline"><input type="checkbox" data-notifyon ${newsPrefs().on ? "checked" : ""}> Show family news on this device</label>`;
}
// Asks the browser only when the button is tapped
async function askNotify() {
  if (!("Notification" in window)) return;
  let answer = Notification.permission;
  try { answer = (await Notification.requestPermission()) || Notification.permission; } catch (e) {}
  if (answer === "granted") {
    setNewsPrefs({ on: true });
    toast("🔔 Notifications are on for this device!");
  } else toast("OK! You can still see the news with the 🔔 button.", 3500);
  render();
}
document.addEventListener("change", e => {
  if (!e.target.matches || !e.target.matches("[data-notifyon]")) return;
  setNewsPrefs({ on: e.target.checked });
  toast(e.target.checked ? "🔔 Family news is on for this device." : "🔕 Family news is off for this device. The 🔔 list still works.", 3500);
  render();
});
