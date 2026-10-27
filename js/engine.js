/* Codex Arcanum — moteur de règles (sans interface, 100 % déterministe avec une graine).
   Toutes les règles du jeu vivent ici, et seulement ici. Voir RULES.md. */
(function (root) {
  "use strict";
  const CA = root.CA;

  const LINES = 4, CITADEL = 20, MAX_AETHER = 10, HAND_MAX = 8, DECK_SIZE = 30, FATIGUE = 2;

  /* ───────── Aléatoire (graine dans l'état → clonable en JSON) ───────── */
  function rnd(g) {
    g.seed = (g.seed + 0x6D2B79F5) | 0;
    let t = Math.imul(g.seed ^ (g.seed >>> 15), 1 | g.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(g, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd(g) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ───────── Création ───────── */
  function newPlayer(name, deckIds, cit, dpt) {
    return { name, cit: cit || CITADEL, citMax: cit || CITADEL, dpt: dpt || 1, deck: deckIds.slice(), hand: [], board: new Array(LINES).fill(null),
             grave: [], aether: 0, max: 0, turns: 0, fatigue: 0,
             st: { cit: 0, units: 0, spells: 0, kills: 0, legend: 0, fac: {} } };
  }
  // opts : decks[2], names[2], first, seed, et options facultatives par joueur :
  //   cit[2] (PV de Citadelle), extraHand[2] (cartes de départ en plus), drawPerTurn[2]
  function newGame(opts) {
    const o2 = (k, d) => opts[k] || [d, d];
    const g = { seed: (opts.seed == null ? Date.now() : opts.seed) | 0, uid: 1, turn: 0, active: opts.first || 0,
                over: false, winner: null, log: [], fx: [],
                p: [0, 1].map((i) => newPlayer(opts.names[i], opts.decks[i], o2("cit", CITADEL)[i], o2("drawPerTurn", 1)[i])) };
    g.p.forEach((p) => shuffle(g, p.deck));
    const f = g.active, s = 1 - f, xh = o2("extraHand", 0);
    for (let i = 0; i < 4 + xh[f]; i++) drawCard(g, f, true);
    for (let i = 0; i < 5 + xh[s]; i++) drawCard(g, s, true);
    startTurn(g, true);
    return g;
  }

  /* ───────── Utilitaires ───────── */
  const card = (id) => CA.BY_ID[id];
  const log = (g, text) => { g.log.push(text); if (g.log.length > 80) g.log.shift(); };
  const foeOf = (i) => 1 - i;
  // Événements pour l'interface (animations, sons) : l'interface les vide après lecture.
  const emit = (g, ev) => { if (g.fx) g.fx.push(ev); };
  const lineOf = (g, u) => g.p[u.owner].board.indexOf(u);
  const has = (u, kw) => u.kw.indexOf(kw) >= 0;

  function makeUnit(g, id, owner) {
    const c = card(id);
    const u = { uid: g.uid++, id, owner, atk: c.atk, hp: c.hp, max: c.hp, kw: c.kw.filter((k) => k !== "egide"),
                shield: c.kw.indexOf("egide") >= 0, fresh: !(c.kw.indexOf("charge") >= 0), stun: false, hold: false };
    return u;
  }

  function checkOver(g) {
    if (g.over) return;
    const a = g.active, b = foeOf(a);
    if (g.p[b].cit <= 0) { g.over = true; g.winner = a; }       // égalité → le joueur actif gagne
    else if (g.p[a].cit <= 0) { g.over = true; g.winner = b; }
    if (g.over) log(g, `${g.p[g.winner].name} remporte la partie !`);
  }

  // self = true : dégâts que le joueur s'inflige (Pacte, épuisement) → ne comptent pas comme dégâts infligés
  function hitCit(g, side, n, self) {
    if (n <= 0) return;
    g.p[side].cit -= n;
    if (!self) g.p[foeOf(side)].st.cit += n;
    emit(g, { k: "cit", side, n });
    checkOver(g);
  }
  function healCit(g, side, n) {
    const p = g.p[side], before = p.cit;
    p.cit = Math.min(p.citMax, p.cit + n);
    if (p.cit > before) emit(g, { k: "healcit", side, n: p.cit - before });
  }

  // Dégâts à une unité. Égide : annule la source et disparaît. Renvoie les PV réellement perdus.
  function hurt(g, u, n) {
    if (n <= 0) return 0;
    if (u.shield) { u.shield = false; log(g, `${card(u.id).name} : l'Égide absorbe les dégâts.`); emit(g, { k: "shield", side: u.owner, line: lineOf(g, u) }); return 0; }
    u.hp -= n;
    emit(g, { k: "hit", side: u.owner, line: lineOf(g, u), n });
    return n;
  }

  /* ───────── Pioche ───────── */
  function drawCard(g, side, silent) {
    const p = g.p[side];
    if (!p.deck.length) {                    // épuisement
      p.fatigue++;
      hitCit(g, side, FATIGUE, true);
      if (!silent) log(g, `${p.name} n'a plus de cartes : ${FATIGUE} dégâts à sa Citadelle.`);
      return;
    }
    const id = p.deck.pop();
    if (p.hand.length >= HAND_MAX) { p.grave.push({ burned: id }); if (!silent) log(g, `${p.name} défausse ${card(id).name} (main pleine).`); return; }
    p.hand.push(id);
  }

  /* ───────── Cibles ───────── */
  // ctx : { owner, unit?, line?, pick? }  →  [{u, side} | {cit, side}]
  function targets(g, to, ctx) {
    const me = ctx.owner, foe = foeOf(me), P = g.p, out = [];
    const board = (side) => P[side].board;
    switch (to) {
      case "self":   if (ctx.unit && ctx.unit.hp > 0) out.push({ u: ctx.unit, side: me }); break;
      case "facing": { const u = board(foe)[ctx.line]; if (u) out.push({ u, side: foe }); break; }
      case "adj":    [ctx.line - 1, ctx.line + 1].forEach((i) => { const u = board(me)[i]; if (u && u !== ctx.unit) out.push({ u, side: me }); }); break;
      case "allies": board(me).forEach((u) => { if (u && u !== ctx.unit) out.push({ u, side: me }); }); break;
      case "foes":   board(foe).forEach((u) => { if (u) out.push({ u, side: foe }); }); break;
      case "rand":   { const l = board(foe).filter(Boolean); if (l.length) out.push({ u: l[Math.floor(rnd(g) * l.length)], side: foe }); break; }
      case "foeCit": out.push({ cit: true, side: foe }); break;
      case "ownCit": out.push({ cit: true, side: me }); break;
      case "pick":   if (ctx.pick) { const u = board(ctx.pick.side)[ctx.pick.line]; if (u) out.push({ u, side: ctx.pick.side }); } break;
    }
    return out;
  }

  /* ───────── Effets ───────── */
  function freeLines(g, side) { const r = []; g.p[side].board.forEach((u, i) => { if (!u) r.push(i); }); return r; }

  function placeUnit(g, side, id, line, fromRaise) {
    const u = makeUnit(g, id, side);
    g.p[side].board[line] = u;
    emit(g, { k: "place", side, line });
    if (!card(id).token) runTriggers(g, u, line, "arrive");
    return u;
  }

  function applyFx(g, fx, ctx) {
    for (const e of fx) {
      if (g.over) return;
      switch (e.k) {
        case "dmg":
          targets(g, e.to, ctx).forEach((t) => { if (t.cit) hitCit(g, t.side, e.n, t.side === ctx.owner); else hurt(g, t.u, e.n); });
          break;
        case "heal":
          targets(g, e.to, ctx).forEach((t) => {
            if (t.cit) return healCit(g, t.side, e.n);
            const before = t.u.hp; t.u.hp = Math.min(t.u.max, t.u.hp + e.n);
            if (t.u.hp > before) emit(g, { k: "heal", side: t.side, line: g.p[t.side].board.indexOf(t.u), n: t.u.hp - before });
          });
          break;
        case "buff":
          targets(g, e.to, ctx).forEach((t) => { if (t.u) { t.u.atk = Math.max(0, t.u.atk + e.a); t.u.max += e.h; t.u.hp += e.h; } });
          break;
        case "draw": for (let i = 0; i < e.n; i++) drawCard(g, ctx.owner); break;
        case "kill": targets(g, e.to, ctx).forEach((t) => { if (t.u) t.u.hp = 0; }); break;
        case "bounce":
          targets(g, e.to, ctx).forEach((t) => {
            if (!t.u) return;
            const p = g.p[t.side], i = p.board.indexOf(t.u);
            if (i < 0) return;
            p.board[i] = null;
            if (card(t.u.id).token) return;
            if (p.hand.length < HAND_MAX) p.hand.push(t.u.id); else p.grave.push({ burned: t.u.id });
          });
          break;
        case "stun": targets(g, e.to, ctx).forEach((t) => { if (t.u) t.u.stun = true; }); break;
        case "aether": g.p[ctx.owner].aether += e.n; break;
        case "summon": {
          const free = freeLines(g, ctx.owner);
          for (let i = 0; i < e.n && i < free.length; i++) placeUnit(g, ctx.owner, e.tok, free[i]);
          break;
        }
        case "grant":
          targets(g, e.to, ctx).forEach((t) => {
            if (!t.u) return;
            if (e.kw === "egide") t.u.shield = true;
            else if (!has(t.u, e.kw)) t.u.kw.push(e.kw);
            if (e.kw === "charge") t.u.fresh = false;
          });
          break;
        case "raise": {
          const p = g.p[ctx.owner];
          for (let n = 0; n < e.n; n++) {
            const free = freeLines(g, ctx.owner);
            let gi = -1;
            for (let i = p.grave.length - 1; i >= 0; i--) if (typeof p.grave[i] === "string") { gi = i; break; }
            if (gi < 0 || !free.length) break;
            const id = p.grave.splice(gi, 1)[0];
            placeUnit(g, ctx.owner, id, free[0], true);
          }
          break;
        }
      }
      sweep(g);
    }
  }

  function runTriggers(g, u, line, when) {
    const c = card(u.id);
    const fx = c.on && c.on[when];
    if (!fx) return;
    applyFx(g, fx, { owner: u.owner, unit: u, line });
  }

  // Retire les unités mortes (PV ≤ 0), déclenche leurs « Dernier souffle », recommence jusqu'à stabilité.
  function sweep(g) {
    let again = true, guard = 0;
    while (again && guard++ < 50) {
      again = false;
      const dead = [];
      for (const side of [g.active, foeOf(g.active)]) {
        g.p[side].board.forEach((u, i) => { if (u && u.hp <= 0) dead.push({ u, side, i }); });
      }
      if (!dead.length) break;
      again = true;
      dead.forEach((d) => {
        g.p[d.side].board[d.i] = null;
        g.p[foeOf(d.side)].st.kills++;
        emit(g, { k: "die", side: d.side, line: d.i, id: d.u.id });
        if (!card(d.u.id).token) g.p[d.side].grave.push(d.u.id);
        log(g, `${card(d.u.id).name} est détruite.`);
      });
      dead.forEach((d) => {
        const c = card(d.u.id);
        if (c.on && c.on.last && !g.over) applyFx(g, c.on.last, { owner: d.side, unit: d.u, line: d.i });
      });
    }
  }

  /* ───────── Tour de jeu ───────── */
  function startTurn(g, first) {
    if (g.over) return;
    const side = g.active, p = g.p[side];
    g.turn++;
    p.turns++;
    p.max = Math.min(MAX_AETHER, p.turns);
    p.aether = p.max + (p.turns === 1 && g.turn === 2 ? 1 : 0);   // le second joueur démarre avec 1 Aether de plus
    if (g.turn > 1) for (let i = 0; i < p.dpt; i++) drawCard(g, side);   // le tout premier tour se joue sans pioche
    p.board.forEach((u) => { if (u) { u.fresh = false; u.hold = false; } });
    log(g, `— Tour ${p.turns} · ${p.name} —`);
    p.board.forEach((u, i) => { if (u && has(u, "soutien") && !g.over) applyFx(g, [{ k: "heal", n: 1, to: "adj" }], { owner: side, unit: u, line: i }); });
    sweep(g);
  }

  function canPlay(g, side, handIdx) {
    const p = g.p[side], id = p.hand[handIdx];
    if (g.over || g.active !== side || id == null) return { ok: false };
    const c = card(id);
    if (c.c > p.aether) return { ok: false, why: "Aether insuffisant" };
    if (c.type === "unit" && !freeLines(g, side).length) return { ok: false, why: "Aucune ligne libre" };
    if (c.type === "spell" && c.pick === "foe" && !g.p[foeOf(side)].board.some(Boolean)) return { ok: false, why: "Aucune cible ennemie" };
    if (c.type === "spell" && c.pick === "ally" && !p.board.some(Boolean)) return { ok: false, why: "Aucune unité alliée" };
    return { ok: true };
  }

  // opts : { line } pour une unité ; { pick:{side,line} } pour un sort ciblé
  function playCard(g, side, handIdx, opts) {
    opts = opts || {};
    const chk = canPlay(g, side, handIdx);
    if (!chk.ok) return chk;
    const p = g.p[side], id = p.hand[handIdx], c = card(id);
    if (c.type === "unit") {
      if (opts.line == null || p.board[opts.line]) return { ok: false, why: "Ligne invalide" };
      p.aether -= c.c;
      p.hand.splice(handIdx, 1);
      log(g, `${p.name} joue ${c.name}.`);
      noteCard(p, c);
      placeUnit(g, side, id, opts.line);
      sweep(g);
    } else {
      let pick = null;
      if (c.pick) {
        const wantSide = c.pick === "foe" ? foeOf(side) : side;
        if (!opts.pick || opts.pick.side !== wantSide || !g.p[wantSide].board[opts.pick.line]) return { ok: false, why: "Cible invalide" };
        pick = opts.pick;
      }
      p.aether -= c.c;
      p.hand.splice(handIdx, 1);
      log(g, `${p.name} lance ${c.name}.`);
      noteCard(p, c);
      emit(g, { k: "spell", side, id });
      p.grave.push({ spell: id });
      applyFx(g, c.fx, { owner: side, pick });
    }
    checkOver(g);
    return { ok: true };
  }

  function noteCard(p, c) {
    if (c.type === "unit") p.st.units++; else p.st.spells++;
    if (c.r === "L") p.st.legend++;
    p.st.fac[c.f] = (p.st.fac[c.f] || 0) + 1;
  }

  // Mulligan : remet les cartes choisies (indices de la main) dans le deck, mélange, repioche autant. À faire avant la première action.
  function mulligan(g, side, idxs) {
    const p = g.p[side], set = Array.from(new Set(idxs)).filter((i) => i >= 0 && i < p.hand.length).sort((a, b) => b - a);
    set.forEach((i) => p.deck.push(p.hand.splice(i, 1)[0]));
    shuffle(g, p.deck);
    for (let i = 0; i < set.length; i++) p.hand.push(p.deck.pop());
    return set.length;
  }

  function toggleHold(g, side, line) {
    const u = g.p[side].board[line];
    if (!u || g.active !== side) return false;
    u.hold = !u.hold;
    return true;
  }

  // Une unité peut-elle attaquer à l'assaut ?
  function canAttack(u) { return !u.fresh && !u.stun && !u.hold; }

  // Une ligne de l'assaut. Renvoie true si l'unité a réellement attaqué.
  function assaultLine(g, i) {
    if (g.over) return false;
    const me = g.active, foe = foeOf(me), P = g.p, a = P[me].board[i];
    if (!a) return false;
    if (a.stun) { a.stun = false; log(g, `${card(a.id).name} est étourdie : elle n'attaque pas.`); return false; }
    if (a.fresh || a.hold) return false;
    const d = P[foe].board[i];
    emit(g, { k: "swing", side: me, line: i });
    if (!d) { log(g, `${card(a.id).name} frappe la Citadelle (${a.atk}).`); hitCit(g, foe, a.atk); return true; }
    duel(g, a, d, me, foe);
    sweep(g);
    return true;
  }
  function assaultEnd(g) {
    // les étourdissements des unités qui n'ont pas pu agir (nouvelles / en retrait) sont aussi consommés
    g.p[g.active].board.forEach((u) => { if (u && u.stun) u.stun = false; });
  }
  function assault(g) {
    for (let i = 0; i < LINES && !g.over; i++) assaultLine(g, i);
    assaultEnd(g);
  }

  function duel(g, a, d, me, foe) {
    const aGuard = has(a, "garde") ? 1 : 0, dGuard = has(d, "garde") ? 1 : 0;
    const dealToD = Math.max(0, a.atk - dGuard);
    const dealToA = Math.max(0, d.atk - aGuard);
    const dHpBefore = d.hp;
    log(g, `${card(a.id).name} (${a.atk}/${a.hp}) attaque ${card(d.id).name} (${d.atk}/${d.hp}).`);
    const aVif = has(a, "vif"), dVif = has(d, "vif");
    if (aVif && !dVif) {
      hurt(g, d, dealToD);
      if (d.hp > 0) hurt(g, a, dealToA);
    } else if (dVif && !aVif) {
      hurt(g, a, dealToA);
      if (a.hp > 0) hurt(g, d, dealToD);
    } else {
      hurt(g, d, dealToD);
      hurt(g, a, dealToA);
    }
    if (d.hp <= 0 && has(a, "percee")) {
      const over = dealToD - dHpBefore;
      if (over > 0) { log(g, `Percée : ${over} dégâts à la Citadelle.`); hitCit(g, foe, over); }
    }
    if (a.hp > 0 && has(a, "rage")) a.atk += 1;
  }

  // Passe la main à l'adversaire (après l'assaut).
  function passTurn(g) {
    if (g.over) return;
    g.active = foeOf(g.active);
    startTurn(g, false);
  }
  function endTurn(g) {
    if (g.over) return;
    assault(g);
    passTurn(g);
  }

  /* ───────── Decks ───────── */
  function deckProblems(ids) {
    const errs = [], count = {}, facs = {};
    if (ids.length !== DECK_SIZE) errs.push(`Le deck doit contenir ${DECK_SIZE} cartes (${ids.length}).`);
    ids.forEach((id) => {
      const c = card(id);
      if (!c || c.token) { errs.push("Carte inconnue : " + id); return; }
      count[id] = (count[id] || 0) + 1;
      facs[c.f] = 1;
    });
    Object.keys(count).forEach((id) => {
      const max = CA.RARITIES[card(id).r].max;
      if (count[id] > max) errs.push(`${card(id).name} : ${max} exemplaire${max > 1 ? "s" : ""} maximum.`);
    });
    if (Object.keys(facs).length > 2) errs.push("2 factions maximum par deck.");
    return errs;
  }

  // Deck de 30 cartes suivant une courbe cible (decks prêts à jouer, decks de l'IA).
  // owned (facultatif) : ne piocher que parmi les cartes possédées { id: true }.
  function autoDeck(factions, owned) {
    const fs = Array.isArray(factions) ? factions : [factions];
    const pool = CA.CARDS.filter((c) => fs.indexOf(c.f) >= 0 && (!owned || owned[c.id]));
    const curve = { 1: 4, 2: 7, 3: 6, 4: 5, 5: 3, 6: 2, 7: 3 };       // 7 = « 7 et plus » → 30
    const picked = [], left = {};
    Object.keys(curve).forEach((k) => (left[k] = curve[k]));
    const slot = (c) => Math.min(7, c.c);
    // ordre de préférence : unités avant sorts, puis raretés élevées en premier
    const rank = { L: 0, E: 1, R: 2, C: 3 };
    const sorted = pool.slice().sort((a, b) => (rank[a.r] - rank[b.r]) || (a.type === b.type ? a.c - b.c : a.type === "unit" ? -1 : 1));
    for (let pass = 0; pass < 2; pass++) {
      for (const c of sorted) {
        const max = CA.RARITIES[c.r].max;
        const have = picked.filter((x) => x === c.id).length;
        if (have >= max || have > pass) continue;
        if (left[slot(c)] > 0) { picked.push(c.id); left[slot(c)]--; }
      }
    }
    // complète si la courbe n'a pas pu être remplie
    for (const c of sorted) {
      while (picked.length < DECK_SIZE && picked.filter((x) => x === c.id).length < CA.RARITIES[c.r].max) picked.push(c.id);
    }
    return picked.slice(0, DECK_SIZE);
  }

  const Engine = {
    LINES, CITADEL, MAX_AETHER, HAND_MAX, DECK_SIZE, FATIGUE,
    newGame, canPlay, playCard, toggleHold, canAttack, endTurn, passTurn, assault, assaultLine, assaultEnd, mulligan, duel,
    freeLines, makeUnit, deckProblems, autoDeck, rnd, shuffle, card, has, foeOf, clone: (g) => { const c = JSON.parse(JSON.stringify(g)); c.fx = []; return c; },
    startTurn
  };
  CA.Engine = Engine;
  if (typeof module !== "undefined") module.exports = Engine;
})(typeof window !== "undefined" ? window : globalThis);
