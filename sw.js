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
const CACHE = "family-planner-v113";

// 🤖 The family's AI helper (School: read school work, worksheets, explanations, checking): NEVER saved or touched here.
// Every call must go straight to the internet (the app says so when there's no internet).
const AI_ORIGIN = "https://family-plan-ai.hanifamily.workers.dev";

// Firebase and Google's servers (login, the cloud data, the Firebase code): NEVER saved here.
// They must always come fresh from the internet (Firebase keeps its own offline copy of the data).
function isFirebase(url) {
  return /(^|\.)(googleapis\.com|gstatic\.com|firebaseio\.com|firebaseapp\.com|firebasestorage\.app|web\.app)$/.test(url.hostname);
}

// The files the app needs to open without internet.
const APP_FILES = ["./", "index.html", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];
// 🕌 The prayer-times library (from another website). The version is in the address, so it never changes:
// once it's saved here, it's always used from here (the prayer times then work without internet).
const ADHAN_URL = "https://cdn.jsdelivr.net/npm/adhan@4.4.3/lib/bundles/adhan.umd.min.js";
// 📦 JSZip (opens PowerPoint / Word files for 🤖 AI help). Same idea: the version is in the address, so it never changes.
const JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
// 📄 pdf.js (takes the text out of a 📄 syllabus PDF). Same idea: the version is in the address.
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
// 📄 jsPDF + html2canvas (make a real PDF of a worksheet or a brief, on the phone). Same idea: the version is in the address.
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const LIBRARIES = [ADHAN_URL, JSZIP_URL, PDFJS_URL, PDFJS_WORKER_URL, JSPDF_URL, HTML2CANVAS_URL];

// 1) Install: save a copy of the app files (and the libraries).
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all([
    cache.addAll(APP_FILES),
    // (if one can't be fetched right now, the app still installs: it's saved the first time the page loads it)
    ...LIBRARIES.map(url => cache.add(new Request(url, { mode: "cors" })).catch(() => {}))
  ])));
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
  const url = new URL(request.url);
  if (url.origin === AI_ORIGIN) return;   // 🤖 the AI helper: not touched at all (the browser fetches it normally)
  if (request.method !== "GET") return;
  if (url.origin !== location.origin && isFirebase(url)) return;   // not touched at all: the browser fetches it normally

  // 🕌 The prayer-times library and 📦 JSZip: the saved copy first, the internet only if it isn't saved yet
  if (LIBRARIES.includes(request.url)) {
    const lib = request.url;
    event.respondWith(
      caches.match(lib).then(saved => saved || fetch(request).then(response => {
        // (a script from another website can come back "opaque": that's fine to keep)
        if (response.ok || response.type === "opaque") { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(lib, copy)); }
        return response;
      }))
    );
    return;
  }

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
