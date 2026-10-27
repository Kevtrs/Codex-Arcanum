/* Codex Arcanum — effets visuels des sorts et des impacts.
   Moteur de particules : tsParticles (MIT, vendor/tsparticles.bundle.min.js). Mouvements d'interface : animate.css (MIT, vendor/).
   Tout est facultatif : sans tsParticles le jeu fonctionne, seuls les éclats disparaissent. */
(function (root) {
  "use strict";
  const CA = root.CA;
  const VFX = {};
  let n = 0, ready = null;
  // Le bundle tsParticles doit charger ses modules (formes, émetteurs…) une seule fois avant le premier usage.
  const init = () => ready || (ready = root.loadFull ? Promise.resolve(root.loadFull(root.tsParticles)) : Promise.resolve());
  const layer = () => document.getElementById("b-fx") || document.body;
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  /* Couleurs et formes par faction */
  const LOOK = {
    AURELIA:  { cols: ["#ffe9a0", "#ffd24d", "#fff7d6"], shape: "star", glow: "#ffd24d" },
    DRACONIS: { cols: ["#ff4d1a", "#ff9a1f", "#ffd24d"], shape: "circle", glow: "#ff6a1f" },
    SYLVE:    { shape: "emoji", emoji: ["🍃", "🌿", "🍂"], cols: ["#7be08f"], glow: "#58c46a" },
    ARCANES:  { cols: ["#8f6bff", "#5ea8ff", "#efe9ff"], shape: "star", glow: "#8f6bff" },
    ABYSSES:  { cols: ["#2a2438", "#6a3fa0", "#9aa6bd"], shape: "circle", glow: "#6a3fa0" }
  };
  VFX.look = (f) => LOOK[f] || LOOK.ARCANES;

  // Construit la configuration tsParticles d'un jet de particules (une seule rafale, qui s'éteint seule)
  function config(o) {
    const shape = o.shape === "emoji" ? { type: "emoji", options: { emoji: { value: o.emoji } } } : { type: o.shape || "circle" };
    return {
      fullScreen: { enable: false }, detectRetina: true, fpsLimit: 60, background: { color: "transparent" },
      particles: {
        number: { value: 0 }, color: { value: o.cols || ["#ffffff"] }, shape,
        opacity: { value: { min: 0.7, max: 1 }, animation: { enable: true, speed: o.fade || 1.4, startValue: "max", destroy: "min", sync: false } },
        size: { value: o.size || { min: 3, max: 7 }, animation: { enable: true, speed: o.shrink == null ? 6 : o.shrink, startValue: o.grow ? "min" : "max", destroy: o.grow ? "none" : "min", sync: false } },
        move: { enable: true, speed: o.speed || { min: 4, max: 10 }, direction: o.dir || "none", random: true, straight: false, decay: o.decay == null ? 0.07 : o.decay,
                gravity: { enable: !!o.grav, acceleration: o.grav || 0 }, outModes: { default: "destroy" }, spin: o.spin ? { enable: true, acceleration: 2 } : undefined },
        rotate: { value: { min: 0, max: 360 }, animation: { enable: true, speed: 20 } },
        life: { duration: { value: o.life || 0.9 }, count: 1 }
      },
      // une rafale = N particules posées au centre au départ (plus fiable qu'un émetteur), qui partent dans toutes les directions
      manualParticles: Array.from({ length: o.count || 16 }, () => ({ position: { x: 50, y: o.y == null ? 50 : o.y } }))
    };
  }

  // Joue une rafale centrée sur un rectangle d'écran
  function play(rect, opts, ms) {
    if (!rect || !root.tsParticles) return;
    const size = opts.area || 220, c = center(rect), host = document.createElement("div"), id = "vfx" + ++n;
    host.id = id; host.className = "vfx";
    host.style.cssText = `position:fixed;left:${c.x - size / 2}px;top:${c.y - size / 2}px;width:${size}px;height:${size}px;pointer-events:none;z-index:5`;
    layer().appendChild(host);
    init().then(() => root.tsParticles.load({ id, options: config(opts) })).then((cont) => {
      setTimeout(() => { try { cont.destroy(); } catch (e) { /* déjà détruit */ } host.remove(); }, ms || 1400);
    }).catch(() => host.remove());
  }

  /* ───────── Effets ───────── */
  VFX.sparks = (rect, f, power) => {
    const L = LOOK[f] || LOOK.ARCANES, big = (power || 1) >= 5;
    if (f === "DRACONIS") return play(rect, { cols: L.cols, shape: "circle", count: big ? 26 : 16, speed: { min: 4, max: 11 }, dir: "top", grav: -4, size: { min: 4, max: 11 }, shrink: 9, life: 0.8 });
    if (f === "ABYSSES")  return play(rect, { cols: L.cols, shape: "circle", count: big ? 22 : 14, speed: { min: 1, max: 4 }, dir: "top", size: { min: 8, max: 18 }, shrink: 4, fade: 1, life: 1.1 });
    play(rect, { cols: L.cols, emoji: L.emoji, shape: L.shape, count: big ? 28 : 16, speed: { min: 7, max: 15 }, grav: 5, size: { min: 3, max: 8 }, life: 0.9, area: 260 });
  };
  VFX.heal = (rect) => play(rect, { cols: ["#8af0a0", "#d9ffe0", "#ffe9a0"], shape: "star", count: 12, speed: { min: 1, max: 3.5 }, dir: "top", size: { min: 3, max: 7 }, shrink: 3, fade: 0.9, life: 1.3, decay: 0.02 }, 1700);
  VFX.buff = (rect, f) => { const L = LOOK[f] || LOOK.ARCANES; play(rect, { cols: L.cols, emoji: L.emoji, shape: L.shape, count: 12, speed: { min: 1.5, max: 4 }, dir: "top", size: { min: 3, max: 7 }, life: 1.2, decay: 0.03 }, 1600); };
  VFX.death = (rect, f) => {
    const L = LOOK[f] || LOOK.ABYSSES;
    play(rect, { cols: ["#ffffff", "#cfd8e8", "#9aa6bd"], shape: "circle", count: 14, speed: { min: 1, max: 5 }, size: { min: 6, max: 14 }, shrink: 5, fade: 1.2, life: 0.9 });
  };
  VFX.summon = (rect, f) => { const L = LOOK[f] || LOOK.SYLVE; play(rect, { cols: L.cols, emoji: L.emoji, shape: L.shape, count: 14, speed: { min: 2, max: 6 }, size: { min: 4, max: 9 }, spin: true, life: 1 }); };
  VFX.win = (rect) => {
    play(rect, { cols: ["#ffe08a", "#ffd24d", "#fff7d6", "#ffffff"], shape: "star", count: 46, speed: { min: 6, max: 16 }, grav: 5, size: { min: 4, max: 10 }, life: 1.6, area: 460, decay: 0.05 }, 2200);
  };

  /* Projectile : une orbe qui traverse le plateau, puis le rappel (callback) déclenche l'impact. */
  VFX.orbe = (from, to, f) => new Promise((resolve) => {
    if (!from || !to || !document.body.animate) return resolve();
    const L = LOOK[f] || LOOK.ARCANES, a = center(from), b = center(to), orb = document.createElement("i");
    orb.className = "orb"; orb.style.cssText = `left:${a.x}px;top:${a.y}px;--g:${L.glow}`;
    if (f === "SYLVE") orb.textContent = "🍃"; else if (f === "DRACONIS") orb.textContent = "🔥";
    layer().appendChild(orb);
    const anim = orb.animate([{ transform: "translate(-50%,-50%) scale(.5)", opacity: 0.2 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(1.15)`, opacity: 1 }], { duration: 420, easing: "cubic-bezier(.45,.05,.85,.5)" });
    let t = setInterval(() => { const r = orb.getBoundingClientRect(); play(r, { cols: L.cols, emoji: L.emoji, shape: L.shape, count: 2, speed: { min: 0.5, max: 2 }, size: { min: 3, max: 6 }, shrink: 5, life: 0.5, area: 60 }, 700); }, 70);
    let over = false;
    const finish = () => { if (over) return; over = true; clearInterval(t); orb.remove(); resolve(); };
    anim.onfinish = finish;
    setTimeout(finish, 650);
  });

  /* Éclair plein écran, teinté par la faction (sorts de zone et Légendaires) */
  VFX.flash = (f) => {
    const L = LOOK[f] || LOOK.ARCANES, d = document.createElement("div");
    d.className = "flash"; d.style.background = `radial-gradient(circle at 50% 50%, ${L.glow}aa, transparent 65%)`;
    layer().appendChild(d); setTimeout(() => d.remove(), 520);
  };

  /* animate.css : ajoute une classe d'animation à un élément, la retire à la fin */
  VFX.anim = (el, name) => {
    if (!el) return;
    el.classList.remove("animate__animated", "animate__" + name); void el.offsetWidth;
    el.classList.add("animate__animated", "animate__" + name);
    el.addEventListener("animationend", () => el.classList.remove("animate__animated", "animate__" + name), { once: true });
  };

  /* ───────── Sprites de sorts : « Spell FX Free » par heyheythere (CC BY 4.0, voir CREDITS.md) ─────────
     Feuilles d'animation image par image (grille 8 colonnes, fond transparent). Les éléments absents du pack gratuit
     (lumière, ombre, nature) sont teintés à partir des trois fournis ; le pack complet les offre en natif. */
  const SH = (frames, fps, loop, rows, w, h, ax, ay) => ({ frames, fps, loop, cols: 8, rows, w, h, ax, ay });
  const SHEETS = {};
  ["fire", "ice", "arcane"].forEach((el) => { SHEETS[el + "_bolt"] = SH(16, 24, true, 2, 256, 128, 0.78, 0.5); SHEETS[el + "_impact"] = SH(24, 30, false, 3, 256, 256, 0.5, 0.5); });
  const SKIN = {
    DRACONIS: ["fire", ""],
    AURELIA:  ["fire", "hue-rotate(38deg) saturate(.8) brightness(1.35)"],
    SYLVE:    ["ice", "hue-rotate(-62deg) saturate(1.35)"],
    ARCANES:  ["arcane", ""],
    ABYSSES:  ["arcane", "saturate(.45) brightness(.62) contrast(1.35)"]
  };
  const loaded = {};
  const base = CA.FX_BASE || "fx/";   // le laboratoire (tools/) change ce chemin
  VFX.spritesReady = false;
  VFX.preload = () => Promise.all(Object.keys(SHEETS).map((k) => new Promise((ok) => { const im = new Image(); im.onload = () => { loaded[k] = true; ok(); }; im.onerror = ok; im.src = base + k + ".png"; })))
    .then(() => { VFX.spritesReady = Object.keys(loaded).length === Object.keys(SHEETS).length; });
  if (typeof Image !== "undefined") VFX.preload();

  // Crée l'élément animé ; son point d'ancrage (tête de la boule, centre de l'impact) est placé sur (x, y).
  function sprite(name, x, y, scale, filter, angle) {
    const d = SHEETS[name], W = d.w * scale, H = d.h * scale, el = document.createElement("div");
    el.className = "spr";
    el.style.cssText = `position:absolute;left:${x - d.ax * W}px;top:${y - d.ay * H}px;width:${W}px;height:${H}px;pointer-events:none;` +
      `background:url(${base}${name}.png) 0 0 / ${d.cols * W}px ${d.rows * H}px no-repeat;` + (filter ? `filter:${filter};` : "") +
      (angle ? `transform:rotate(${angle}rad);transform-origin:${d.ax * W}px ${d.ay * H}px;` : "");
    let t0 = null, stopped = false, last = -1;
    const done = new Promise((resolve) => {
      const tick = (t) => {
        if (stopped) { el.remove(); return resolve(); }
        if (t0 == null) t0 = t;
        const i = Math.floor(((t - t0) / 1000) * d.fps);
        if (!d.loop && i >= d.frames) { el.remove(); return resolve(); }
        const f = d.loop ? i % d.frames : i;
        if (f !== last) { last = f; el.style.backgroundPosition = `-${(f % d.cols) * W}px -${Math.floor(f / d.cols) * H}px`; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // Filet de sécurité : si le navigateur gèle les animations (onglet en arrière-plan), un effet à lecture unique disparaît quand même.
    if (!d.loop) setTimeout(() => { stopped = true; el.remove(); }, (d.frames / d.fps) * 1000 + 350);
    return { el, done, stop: () => { stopped = true; } };
  }

  // Impact : la feuille d'explosion jouée une fois, centrée sur la cible
  VFX.impact = (rect, f, power) => {
    if (!VFX.spritesReady || !rect) return VFX.sparks(rect, f, power);
    const [el, filter] = SKIN[f] || SKIN.DRACONIS, c = center(rect);
    const scale = Math.max(0.7, Math.min(1.5, rect.width / 130)) * ((power || 1) >= 5 ? 1.3 : 1) * ((power || 1) <= 1 ? 0.8 : 1);
    layer().appendChild(sprite(el + "_impact", c.x, c.y, scale, filter).el);
  };

  // Projectile : la boule animée traverse le plateau, tournée dans le sens du trajet, puis la promesse se résout à l'arrivée.
  VFX.projectile = (from, to, f) => new Promise((resolve) => {
    if (!VFX.spritesReady || !from || !to || !document.body.animate) return VFX.orbe(from, to, f).then(resolve);
    const [el, filter] = SKIN[f] || SKIN.ARCANES, a = center(from), b = center(to);
    const wrap = document.createElement("div");
    wrap.style.cssText = `position:fixed;left:${a.x}px;top:${a.y}px;width:0;height:0;z-index:6;pointer-events:none`;
    const sp = sprite(el + "_bolt", 0, 0, 0.8, filter, Math.atan2(b.y - a.y, b.x - a.x));
    wrap.appendChild(sp.el); layer().appendChild(wrap);
    const dist = Math.hypot(b.x - a.x, b.y - a.y), ms = Math.max(280, Math.min(520, dist * 0.9));
    const anim = wrap.animate([{ transform: "translate(0,0) scale(.6)", opacity: 0 }, { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0.1 },
      { transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(1.05)`, opacity: 1 }], { duration: ms, easing: "cubic-bezier(.5,.05,.9,.55)" });
    let over = false;
    const finish = () => { if (over) return; over = true; sp.stop(); wrap.remove(); resolve(); };
    anim.onfinish = finish;
    setTimeout(finish, ms + 250);                // idem : le sort ne doit jamais bloquer la partie
  });

  CA.VFX = VFX;
})(typeof window !== "undefined" ? window : globalThis);
