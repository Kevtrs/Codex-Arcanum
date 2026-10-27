/* Tests : node tools/test.js
   Moteur (règles de base), profil (progression), difficulté de la campagne. */
const path = require("path");
global.CA = {};
["cards", "engine", "ai", "meta", "profile"].forEach((f) => require(path.join(__dirname, "../js/" + f + ".js")));
const CA = global.CA, E = CA.Engine, M = CA.Meta, Pr = CA.Profile;

let fails = 0, n = 0;
function ok(cond, msg) { n++; if (!cond) { fails++; console.log("  ✗ " + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`); }
const filler = (id, k) => new Array(k).fill(id);

// Partie minimale : decks bidon, on pose les cartes à la main
function duelGame(opts) {
  const g = E.newGame(Object.assign({ decks: [filler("A01", 30), filler("A01", 30)], names: ["A", "B"], first: 0, seed: 1 }, opts));
  g.p.forEach((p) => { p.hand = []; p.aether = 10; p.max = 10; });
  return g;
}
const put = (g, side, id, line, o) => {
  const prev = g.active; g.active = side;
  g.p[side].hand.unshift(id); g.p[side].aether = 10;
  const r = E.playCard(g, side, 0, { line }); ok(r.ok, "pose " + id + " : " + (r.why || ""));
  g.active = prev;
  const b = g.p[side].board[line]; if (o) Object.assign(b, o); return b;
};

console.log("== MOTEUR ==");
{ // combat simultané + Garde
  const g = duelGame();
  const a = put(g, 0, "A06", 0, { fresh: false });            // Griffon 3/3
  const d = put(g, 1, "A05", 0);                               // Garde-Bouclier 2/5 Garde
  E.assaultLine(g, 0);
  eq([d.hp, a.hp], [3, 1], "Garde réduit les dégâts de 1, riposte simultanée");
}
{ // ligne vide → Citadelle
  const g = duelGame(); put(g, 0, "A06", 1, { fresh: false });
  E.assaultLine(g, 1); eq(g.p[1].cit, 17, "Une unité sans adversaire frappe la Citadelle");
}
{ // unité fraîche n'attaque pas, Charge si
  const g = duelGame(); put(g, 0, "A02", 0); put(g, 0, "A06", 1);
  g.p[0].board[1].fresh = false;
  E.assaultLine(g, 0); E.assaultLine(g, 1);
  eq(g.p[1].cit, 17, "Seule l'unité prête attaque (Lancier fraîche reste au repos)");
}
{ // Vif
  const g = duelGame(); const a = put(g, 0, "A02", 0, { fresh: false }); const d = put(g, 1, "D01", 0); d.hp = 2; d.atk = 5;  // Lancier 2/2 Vif contre 5/2
  E.assaultLine(g, 0); ok(a.hp === 2 && g.p[1].board[0] === null, "Vif : l'adversaire meurt avant de riposter");
}
{ // Égide
  const g = duelGame(); const a = put(g, 0, "A07", 0, { fresh: false }); const d = put(g, 1, "D04", 0);   // Chevalier (Égide) vs 4/3
  E.assaultLine(g, 0); ok(!a.shield && a.hp === 3, "Égide absorbe la première source de dégâts");
}
{ // Percée
  const g = duelGame(); const a = put(g, 0, "D06", 0, { fresh: false }); put(g, 1, "A01", 0);          // Drake 5/4 percée vs 1/2 garde
  E.assaultLine(g, 0); eq(g.p[1].cit, 20 - (5 - 1 - 2), "Percée : dégâts en trop sur la Citadelle (garde comprise)");
}
{ // Étourdi
  const g = duelGame(); put(g, 0, "A06", 0, { fresh: false, stun: true });
  E.assaultLine(g, 0); eq(g.p[1].cit, 20, "Une unité étourdie n'attaque pas");
}
{ // Dernier souffle + stats
  const g = duelGame(); put(g, 0, "A06", 0, { fresh: false }); put(g, 1, "M01", 0);                    // Squelette 2/1 : dernier souffle 2 dégâts Citadelle ennemie
  E.assaultLine(g, 0); eq(g.p[0].cit, 18, "Dernier souffle se déclenche");
  eq([g.p[0].st.kills, g.p[1].st.cit], [1, 2], "statistiques de partie");
}
{ // Mulligan
  const g = E.newGame({ decks: [filler("A01", 15).concat(filler("D01", 15)), filler("A01", 30)], names: ["A", "B"], first: 0, seed: 7 });
  const n0 = g.p[0].hand.length, total = g.p[0].hand.length + g.p[0].deck.length;
  E.mulligan(g, 0, [0, 1]); eq([g.p[0].hand.length, g.p[0].hand.length + g.p[0].deck.length], [n0, total], "Mulligan conserve main et deck");
}
{ // Options de partie
  const g = E.newGame({ decks: [E.autoDeck("AURELIA"), E.autoDeck("SYLVE")], names: ["A", "B"], first: 0, seed: 3, cit: [20, 30], extraHand: [2, 0], drawPerTurn: [2, 1] });
  eq([g.p[0].cit, g.p[1].cit, g.p[0].hand.length, g.p[1].hand.length], [20, 30, 6, 5], "cit / extraHand");
}
{ // Deck : 3 factions refusé, 3 exemplaires refusé
  const bad = E.autoDeck("AURELIA").slice(0, 27).concat(["D01", "S01", "R01"]);
  ok(E.deckProblems(bad).some((x) => x.includes("2 factions")), "3 factions refusées");
  ok(E.deckProblems(filler("A01", 30)).some((x) => x.includes("maximum")), "limite d'exemplaires");
}
{ // Decks de départ valides
  CA.FACTION_ORDER.forEach((f) => { const d = E.autoDeck(f, M.STARTER); eq(E.deckProblems(d), [], "deck de départ " + f); ok(d.every((id) => M.STARTER[id]), "deck de départ " + f + " n'utilise que des cartes de départ"); });
  eq(Object.keys(M.STARTER).length, 75, "75 cartes de départ");
}

console.log("== PROFIL ==");
function freshProfile(day) {
  global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
  Pr.clock = () => new Date(2026, 9, day, 12);
  return Pr.load();
}
const sum = (o) => Object.assign({ win: true, st: { cit: 20, units: 8, spells: 3, kills: 6, legend: 0, fac: {} }, citLeft: 12, citMax: 20, myTurns: 9, custom: false, foeFaction: "SYLVE" }, o);
{
  const P = freshProfile(1);
  eq(P.daily.quests.length, 3, "3 quêtes par jour");
  const ev = Pr.recordGame(P, sum(), { mode: "quick", skill: 1 });
  ok(ev.some((e) => e.t === "ach" && e.id === "first"), "succès Première victoire");
  ok(P.xp > 0 && P.stats.w === 1 && P.streak.n === 1, "XP, victoire et série comptées");
  // niveau
  P.xp = M.xpForLevel(P.lvl) - 1; const p0 = P.picks;
  Pr.recordGame(P, sum({ win: false }), { mode: "quick", skill: 1 });
  ok(P.lvl >= 2 && P.picks >= p0 + 1, "un niveau gagné donne un choix de carte");
  // série
  Pr.clock = () => new Date(2026, 9, 2, 12); Pr.refreshDaily(P); Pr.recordGame(P, sum(), { mode: "quick", skill: 1 });
  eq(P.streak.n, 2, "série de jours +1");
  Pr.clock = () => new Date(2026, 9, 5, 12); Pr.refreshDaily(P); Pr.recordGame(P, sum(), { mode: "quick", skill: 1 });
  eq(P.streak.n, 1, "série remise à 1 après une pause");
  // récompense
  const offer = Pr.openOffer(P, () => 0.3);
  ok(offer && offer.length === 3 && offer.every((id) => !M.STARTER[id]), "l'offre propose 3 cartes à débloquer");
  const owned0 = Pr.ownedCount(P); ok(Pr.takeOffer(P, offer[0]) && Pr.ownedCount(P) === owned0 + 1, "carte débloquée");
  ok(!Pr.takeOffer(P, "A01"), "on ne peut pas choisir hors de l'offre");
  // campagne
  const P2 = freshProfile(1);
  eq(Pr.nextNode(P2).key, "c1n1", "campagne : premier duel");
  ok(!Pr.nodeUnlocked(P2, "c1n2"), "duel 2 verrouillé");
  Pr.recordGame(P2, sum(), { mode: "campaign", nodeKey: "c1n1", skill: 0 });
  ok(Pr.nodeUnlocked(P2, "c1n2") && P2.campaign.c1n1, "duel 2 débloqué après victoire");
  const picks = P2.picks; Pr.recordGame(P2, sum(), { mode: "campaign", nodeKey: "c1n1", skill: 0 });
  eq(P2.picks, picks, "pas de récompense de campagne au rejeu");
  // défi du jour
  const ch = Pr.dailyChallenge(); ok(CA.FACTION_ORDER.includes(ch.faction) && ch.mod, "défi du jour défini");
  const P3 = freshProfile(1); Pr.recordGame(P3, sum(), { mode: "daily", skill: 1 }); ok(P3.daily.won, "défi du jour gagné");
  // collection complète → plus d'offre, XP à la place
  const P4 = freshProfile(1); CA.CARDS.forEach((c) => (P4.owned[c.id] = true)); P4.picks = 2; eq(Pr.openOffer(P4), null, "collection complète : pas d'offre"); eq(P4.picks, 0, "picks convertis en XP");
}

console.log("== DIFFICULTÉ DE LA CAMPAGNE (joueur = IA Adepte, moyenne des 5 decks de départ) ==");
function sim(deckA, deckB, skillB, extra, N) {
  let w = 0, turns = 0;
  for (let k = 0; k < N; k++) {
    const g = E.newGame(Object.assign({ decks: [deckA, deckB], names: ["A", "B"], first: k % 2, seed: 1000 + k }, extra));
    for (let t = 0; t < 80 && !g.over; t++) { CA.AI.playTurn(g, g.active, g.active === 0 ? 1 : skillB); E.endTurn(g); }
    if (g.winner === 0) w++; turns += g.turn;
  }
  return { rate: w / N, turns: turns / N / 2 };
}
const NN = parseInt(process.argv[2] || "16", 10);
M.NODES.forEach((node) => {
  const opp = E.autoDeck(node.faction, node.pool === "starter" ? M.STARTER : null);
  const rs = CA.FACTION_ORDER.map((f) => sim(E.autoDeck(f, M.STARTER), opp, node.skill, { cit: [20, node.cit], extraHand: [0, node.extraHand] }, NN));
  const r = { rate: rs.reduce((s, x) => s + x.rate, 0) / rs.length, turns: rs.reduce((s, x) => s + x.turns, 0) / rs.length };
  node.sim = r;
  console.log(`  ${node.key.padEnd(5)} ${node.title.padEnd(26)} ${M.SKILL_NAMES[node.skill].padEnd(8)} PV ${node.cit}  → joueur gagne ${(100 * r.rate).toFixed(0)} %`);
});
const nov = M.NODES[0].sim.rate;
ok(nov >= 0.7, `le premier duel (Novice) doit être facile (≥ 70 %, obtenu ${(nov * 100).toFixed(0)} %)`);

console.log(fails ? `\n${fails} échec(s) sur ${n} vérifications.` : `\nTous les tests passent (${n} vérifications).`);
process.exitCode = fails ? 1 : 0;
