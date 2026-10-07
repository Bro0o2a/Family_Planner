// ============================================================
//  SERVICE WORKER — makes the app work offline
//  The browser runs this file in the background. It keeps a copy
//  of the app's files on your device, and hands out that copy
//  whenever there's no internet.
//  (Your activities are NOT stored here — they live in the family
//   cloud (Firebase) and in the browser's localStorage.)
// ============================================================

// The name of our saved copy. Change the number (v2 → v3 …) whenever the app changes,
// so phones throw away the old copy and get the new version.
const CACHE = "family-planner-v36";

// Firebase and Google's servers (login, the cloud data, the Firebase code): NEVER saved here.
// They must always come fresh from the internet (Firebase keeps its own offline copy of the data).
function isFirebase(url) {
  return /(^|\.)(googleapis\.com|gstatic\.com|firebaseio\.com|firebaseapp\.com|firebasestorage\.app|web\.app)$/.test(url.hostname);
}

// The files the app needs to open without internet.
const APP_FILES = ["./", "index.html", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];

// 1) Install: save a copy of the app files.
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting(); // start working right away
});

// 2) Activate: delete old saved copies (from older versions).
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Saves a fresh copy of a file for next time.
function remember(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then(cache => cache.put(request, copy));
  return response;
}

// 3) Fetch: every time the app asks for a file, decide where it comes from.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin && isFirebase(url)) return;   // not touched at all: the browser fetches it normally

  if (url.origin === location.origin) {
    // Our own files: try the internet first (so you always get the newest version),
    // and use the saved copy when you're offline.
    event.respondWith(
      fetch(request)
        .then(response => response.ok ? remember(request, response) : response)
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(saved => saved || (request.mode === "navigate" ? caches.match("index.html") : undefined)))
    );
  }
  // Everything else from other websites (including the font, which comes from Google): not saved here.
});

// 4) 🔔 Tapping a family notification ("🦄 Bana finished Math ✓"): open the app (or bring it to the front).
//    (The app itself shows the notifications, through this service worker's showNotification.)
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
      const open = windows.find(w => "focus" in w);
      return open ? open.focus() : self.clients.openWindow("./");
    })
  );
});
