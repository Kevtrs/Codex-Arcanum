/* Codex Arcanum — fonctionnement hors-ligne. Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours. */
const CACHE = "codex-arcanum-v8";
const SHELL = ["./", "index.html", "css/style.css", "js/cards.js", "js/engine.js", "js/ai.js", "js/meta.js", "js/profile.js", "js/audio.js", "js/vfx.js", "art/manifest.js", "vendor/animate.min.css", "js/ui.js", "js/battle.js", "manifest.webmanifest", "ui/gem_C.png", "ui/gem_R.png", "ui/gem_E.png", "ui/gem_L.png", "ui/back.png", "icon.svg"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
