/* Codex Arcanum — fonctionnement hors-ligne. Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours. */
const CACHE = "codex-arcanum-v6";
const SHELL = ["./", "index.html", "css/style.css", "js/cards.js", "js/engine.js", "js/ai.js", "js/meta.js", "js/profile.js", "js/audio.js", "js/vfx.js", "fx/effects.js", "art/manifest.js", "vendor/tsparticles.bundle.min.js", "vendor/animate.min.css", "fx/effects.json", "js/ui.js", "js/battle.js", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    try {   // les feuilles d'animation sont listées dans le registre : on les met toutes en cache pour le hors-ligne
      const reg = await (await fetch("fx/effects.json")).json();
      const files = Array.from(new Set(Object.keys(reg).map((k) => "fx/" + (reg[k].file || k) + ".png")));
      await c.addAll(files);
    } catch (err) { /* sans registre, les feuilles seront mises en cache à la première utilisation */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
