/* Codex Arcanum — profil du joueur : sauvegarde, progression, quêtes, série, succès, récompenses.
   Fonctions pures sur un objet profil P (testables sans navigateur). */
(function (root) {
  "use strict";
  const CA = root.CA, M = CA.Meta, E = CA.Engine;
  const KEY = "codex-arcanum-v2";

  const Profile = { clock: () => new Date() };

  function fresh() {
    return {
      v: 2, xp: 0, lvl: 1, owned: Object.assign({}, M.STARTER), picks: 0, pickN: 0, offer: null,
      campaign: {}, daily: { date: "", quests: [], claimed: false, won: false },
      streak: { last: "", n: 0, best: 0 },
      stats: { g: 0, w: 0, l: 0, run: 0, bestRun: 0, beat: {} },
      ach: {}, settings: { sound: true, haptic: true, speed: 1 }, tips: {}, decks: [],
      pick: "preset:AURELIA", opp: "random", diff: 1, intro: false
    };
  }

  /* ───────── Sauvegarde ───────── */
  Profile.load = function () {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* stockage indisponible */ }
    const P = Object.assign(fresh(), d && d.v === 2 ? d : {});
    ["settings", "stats", "streak", "daily"].forEach((k) => (P[k] = Object.assign(fresh()[k], P[k])));
    Profile.refreshDaily(P);
    return P;
  };
  Profile.save = function (P) { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* idem */ } };
  Profile.reset = function () { try { localStorage.removeItem(KEY); } catch (e) { /* idem */ } return Profile.load(); };

  /* ───────── Dates, série ───────── */
  const pad = (n) => (n < 10 ? "0" : "") + n;
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  Profile.today = () => dkey(Profile.clock());
  Profile.yesterday = () => { const d = Profile.clock(); d.setDate(d.getDate() - 1); return dkey(d); };
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let s = seed || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

  // Nouvelle journée → nouvelles quêtes. La série n'est comptée qu'à la première partie du jour.
  Profile.refreshDaily = function (P) {
    const t = Profile.today();
    if (P.daily.date === t && P.daily.quests.length) return;
    const rnd = seeded(hash("q" + t)), pool = M.QUESTS.slice(), picks = [];
    while (picks.length < 3) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    P.daily = { date: t, quests: picks.map((q) => ({ id: q.id, prog: 0, done: false })), claimed: false, won: false };
  };
  Profile.streakAlive = (P) => P.streak.last === Profile.today() || P.streak.last === Profile.yesterday();
  Profile.streakDays = (P) => (Profile.streakAlive(P) ? P.streak.n : 0);
  function touchStreak(P) {
    const t = Profile.today();
    if (P.streak.last === t) return;
    P.streak.n = P.streak.last === Profile.yesterday() ? P.streak.n + 1 : 1;
    P.streak.last = t;
    P.streak.best = Math.max(P.streak.best, P.streak.n);
  }

  Profile.dailyChallenge = function () {
    const t = Profile.today(), r = seeded(hash("d" + t));
    return { date: t, faction: CA.FACTION_ORDER[Math.floor(r() * 5)], mod: M.DAILY_MODS[Math.floor(r() * M.DAILY_MODS.length)] };
  };

  /* ───────── Récompenses : choisir 1 carte parmi 3 ───────── */
  const locked = (P) => CA.CARDS.filter((c) => !P.owned[c.id]);
  Profile.openOffer = function (P, rnd) {
    rnd = rnd || Math.random;
    if (P.offer) return P.offer;
    if (P.picks <= 0) return null;
    const pool = locked(P);
    if (!pool.length) { P.xp += 50 * P.picks; P.picks = 0; return null; }       // collection complète → l'XP prend le relais
    const take = (list) => list.splice(Math.floor(rnd() * list.length), 1)[0];
    const out = [];
    const legends = pool.filter((c) => c.r === "L");
    if (P.pickN % 4 === 3 && legends.length) { const c = take(legends); out.push(c.id); pool.splice(pool.indexOf(c), 1); }   // une Légendaire proposée tous les 4 choix
    while (out.length < 3 && pool.length) out.push(take(pool).id);
    P.offer = out;
    return out;
  };
  Profile.takeOffer = function (P, id) {
    if (!P.offer || P.offer.indexOf(id) < 0) return false;
    P.owned[id] = true; P.picks--; P.pickN++; P.offer = null;
    return true;
  };

  /* ───────── Fin de partie ───────── */
  // s : { win, st, citLeft, citMax, myTurns, custom, foeFaction }   ctx : { mode, nodeKey, skill }
  Profile.recordGame = function (P, s, ctx) {
    const ev = [];
    Profile.refreshDaily(P);
    touchStreak(P);
    const stt = P.stats;
    stt.g++;
    if (s.win) { stt.w++; stt.run++; stt.bestRun = Math.max(stt.bestRun, stt.run); stt.beat[s.foeFaction] = (stt.beat[s.foeFaction] || 0) + 1; }
    else { stt.l++; stt.run = 0; }

    let xp = (s.win ? 50 : 20) * [0.6, 1, 1.4][ctx.skill == null ? 1 : ctx.skill];
    xp *= 1 + 0.1 * Math.min(5, Math.max(0, P.streak.n - 1));
    xp = Math.round(xp);
    const node = ctx.nodeKey && M.NODES.find((n) => n.key === ctx.nodeKey);
    if (node && s.win && !P.campaign[node.key]) {
      P.campaign[node.key] = new Date().toISOString().slice(0, 10);
      xp += node.xp; P.picks++;
      ev.push({ t: "node", key: node.key });
      const ch = M.CHAPTERS[node.chapter];
      if (node.boss) ev.push({ t: "chapter", chapter: node.chapter, seal: ch.seal });
    }
    if (ctx.mode === "daily" && s.win && !P.daily.won) { P.daily.won = true; xp += 60; P.picks++; ev.push({ t: "daily" }); }

    P.daily.quests.forEach((q) => {
      if (q.done) return;
      const def = M.QUESTS.find((d) => d.id === q.id);
      q.prog = Math.min(def.goal, q.prog + def.inc(s));
      if (q.prog >= def.goal) { q.done = true; xp += 40; ev.push({ t: "quest", id: q.id }); }
    });
    if (!P.daily.claimed && P.daily.quests.every((q) => q.done)) { P.daily.claimed = true; P.picks++; ev.push({ t: "questsAll" }); }

    P.xp += xp;
    ev.unshift({ t: "xp", n: xp });
    while (P.xp >= M.xpForLevel(P.lvl)) { P.xp -= M.xpForLevel(P.lvl); P.lvl++; P.picks++; ev.push({ t: "level", lvl: P.lvl }); }

    const today = Profile.today();
    M.ACH.forEach((a) => { if (!P.ach[a.id] && a.test(P, s)) { P.ach[a.id] = today; ev.push({ t: "ach", id: a.id }); } });
    return ev;
  };

  Profile.nextNode = (P) => M.NODES.find((n) => !P.campaign[n.key]) || null;
  Profile.nodeUnlocked = (P, key) => { const i = M.NODES.findIndex((n) => n.key === key); return i === 0 || !!P.campaign[M.NODES[i - 1].key]; };
  Profile.ownedCount = (P) => Object.keys(P.owned).length;

  CA.Profile = Profile;
  if (typeof module !== "undefined") module.exports = Profile;
})(typeof window !== "undefined" ? window : globalThis);
