// ============================================================
//  SERVICE WORKER — makes the app work offline
//  The browser runs this file in the background. It keeps a copy
//  of the app's files on your device, and hands out that copy
//  whenever there's no internet.
//  (Your activities are NOT stored here — they stay in the
//   browser's localStorage, exactly like before.)
// ============================================================

// The name of our saved copy. Change the number (v2 → v3 …) whenever the app changes,
// so phones throw away the old copy and get the new version.
const CACHE = "family-planner-v17";

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

  if (url.origin === location.origin) {
    // Our own files: try the internet first (so you always get the newest version),
    // and use the saved copy when you're offline.
    event.respondWith(
      fetch(request)
        .then(response => response.ok ? remember(request, response) : response)
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(saved => saved || (request.mode === "navigate" ? caches.match("index.html") : undefined)))
    );
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    // The font: use the saved copy if we have one (fonts never change).
    event.respondWith(
      caches.match(request).then(saved => saved || fetch(request).then(response => remember(request, response)))
    );
  }
});
