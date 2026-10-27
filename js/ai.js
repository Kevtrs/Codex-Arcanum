/* Codex Arcanum — adversaire automatique.
   Principe : pour chaque coup légal, on joue le coup sur une copie de la partie, on note le plateau
   obtenu (evaluate), et on garde le meilleur. Pas de triche : l'IA n'utilise que les règles du moteur. */
(function (root) {
  "use strict";
  const CA = root.CA, E = CA.Engine;

  function unitWorth(u) {
    let v = u.atk * 1.1 + u.hp * 0.9;
    if (E.has(u, "garde")) v += 1;
    if (E.has(u, "vif")) v += 1.5;
    if (E.has(u, "percee")) v += 0.8;
    if (E.has(u, "rage")) v += 1;
    if (E.has(u, "soutien")) v += 1;
    if (u.shield) v += 1.2;
    return v;
  }

  // Note du plateau du point de vue de `me` (plus c'est haut, mieux c'est).
  function evaluate(g, me) {
    if (g.over) return g.winner === me ? 1000 : -1000;
    const foe = 1 - me, P = g.p;
    let s = P[me].cit - P[foe].cit * 1.25;
    for (let i = 0; i < E.LINES; i++) {
      const a = P[me].board[i], b = P[foe].board[i];
      if (a) s += unitWorth(a);
      if (b) s -= unitWorth(b);
      if (a && b) {                           // couloir tenu : qui gagne le duel ?
        const aKills = a.atk >= b.hp, bKills = b.atk >= a.hp;
        if (aKills && !bKills) s += 1.5; else if (bKills && !aKills) s -= 1.5;
      } else if (a && !b) s += a.atk * 0.6;     // couloir ouvert sur la Citadelle ennemie
      else if (b && !a) s -= b.atk * 0.6;
    }
    s += P[me].hand.length * 1.4 - P[foe].hand.length * 0.6;
    return s;
  }

  function options(g, side) {
    const out = [], p = g.p[side], foe = 1 - side;
    p.hand.forEach((id, h) => {
      if (!E.canPlay(g, side, h).ok) return;
      const c = E.card(id);
      if (c.type === "unit") E.freeLines(g, side).forEach((line) => out.push({ h, opts: { line }, c }));
      else if (!c.pick) out.push({ h, opts: {}, c });
      else {
        const s = c.pick === "foe" ? foe : side;
        g.p[s].board.forEach((u, line) => { if (u) out.push({ h, opts: { pick: { side: s, line } }, c }); });
      }
    });
    return out;
  }

  // Le meilleur coup à jouer maintenant (ou null si rien n'apporte de gain net).
  // skill : 0 = Novice (se trompe souvent, ne garde jamais d'unité en retrait), 1+ = joue le meilleur coup.
  function chooseMove(g, side, skill) {
    const opts = options(g, side);
    if (!opts.length) return null;
    const base = evaluate(g, side);
    let best = null, bestScore = 0.4;                      // il faut un gain net pour jouer
    const good = [];
    for (const o of opts) {
      const t = E.clone(g);
      E.playCard(t, side, o.h, o.opts);
      const sc = evaluate(t, side) - base + o.c.c * 0.45 + (o.c.type === "unit" ? 0.5 : 0);
      if (sc > 0.4) good.push(o);
      if (sc > bestScore) { bestScore = sc; best = o; }
    }
    if (skill === 0 && good.length) {
      if (E.rnd(g) < 0.18) return null;                                 // oublie de jouer
      if (E.rnd(g) < 0.45) return good[Math.floor(E.rnd(g) * good.length)];   // coup au hasard parmi les coups corrects
    }
    return best;
  }

  // Retrait : une unité qui mourrait sans rien tuer reste à l'abri.
  function applyHolds(g, side) {
    const foe = 1 - side;
    g.p[side].board.forEach((u, i) => {
      if (!u || !E.canAttack(u)) return;
      const d = g.p[foe].board[i];
      if (!d) return;
      const gd = (x) => (E.has(x, "garde") ? 1 : 0);
      const dealt = Math.max(0, u.atk - gd(d)), taken = Math.max(0, d.atk - gd(u));
      const firstStrike = E.has(u, "vif") && !E.has(d, "vif");
      const uDies = !u.shield && taken >= u.hp && !(firstStrike && !d.shield && dealt >= d.hp);
      const dDies = !d.shield && dealt >= d.hp;
      if (uDies && !dDies) u.hold = true;
    });
  }

  function playTurn(g, side, skill) {
    for (let guard = 0; !g.over && guard < 20; guard++) {
      const m = chooseMove(g, side, skill);
      if (!m) break;
      E.playCard(g, side, m.h, m.opts);
    }
    if (!g.over && skill !== 0) applyHolds(g, side);
  }

  CA.AI = { playTurn, chooseMove, applyHolds, evaluate, options };
  if (typeof module !== "undefined") module.exports = CA.AI;
})(typeof window !== "undefined" ? window : globalThis);
