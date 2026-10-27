/* Banc d'essai : node tools/check.js [parties-par-duel]
   1) audit statique des 100 cartes (budget de puissance par coût)
   2) validité des decks prêts à jouer
   3) tournoi IA contre IA : taux de victoire de chaque faction et durée des parties */
const path = require("path");
global.CA = {};
require(path.join(__dirname, "../js/cards.js"));
require(path.join(__dirname, "../js/engine.js"));
require(path.join(__dirname, "../js/ai.js"));
const CA = global.CA, E = CA.Engine;

/* ───── 1. Budget de puissance ─────
   Une unité de coût c « vaut » 2c+2 points (une vanille 2/2 coûte 1... 4 points, etc.).
   Chaque mot-clé / effet retire des points de stats : ce tableau est LA référence d'équilibrage. */
const KW_VAL = { charge: 2, vif: 2, garde: 1, egide: 1.5, percee: 1, rage: 1.5, soutien: 2 };
let spellCtx = null;
function fxVal(e) {
  switch (e.k) {
    case "dmg":    return e.n * (e.to === "foes" ? 3 : e.to === "foeCit" ? 0.5 : e.to === "ownCit" ? -0.5 : 1.5);
    case "heal":   return e.n * 0.5 * (e.to === "allies" ? 2 : 1);
    case "buff":   return (e.a + e.h) * (e.to === "allies" ? (spellCtx ? 2.5 : 1.5) : 1);
    case "draw":   return e.n * 2.5;
    case "aether": return e.n * 2;
    case "stun":   return e.to === "foes" ? 4 : 2;
    case "bounce": return 4;
    case "kill":   return spellCtx && spellCtx.pick === "ally" ? -3 : 7;
    case "summon": return e.n * 2.5;
    case "grant":  return (e.kw === "egide" ? 1.5 : 2) * (e.to === "allies" ? 2.5 : 1);
    case "raise":  return e.n * 4;
  }
  return 0;
}
function unitValue(c) {
  let v = c.atk + c.hp;
  c.kw.forEach((k) => (v += KW_VAL[k]));
  Object.keys(c.on).forEach((w) => c.on[w].forEach((e) => (v += fxVal(e) * (w === "last" ? 0.9 : 1))));
  return v;
}
function spellValue(c) { spellCtx = c; const v = c.fx.reduce((s, e) => s + fxVal(e), 0); spellCtx = null; return v; }

let bad = 0;
console.log("== AUDIT DES CARTES ==");
const byF = {};
CA.CARDS.forEach((c) => {
  byF[c.f] = byF[c.f] || { unit: 0, spell: 0, C: 0, R: 0, E: 0, L: 0 };
  byF[c.f][c.type]++; byF[c.f][c.r]++;
  if (c.type === "unit") {
    const budget = 2 * c.c + 2, v = unitValue(c), tol = c.r === "L" ? [-1.5, 3] : [-1.5, 1.5];
    const d = v - budget;
    if (d < tol[0] || d > tol[1]) { bad++; console.log(`  ! ${c.id} ${c.name} (coût ${c.c}) : valeur ${v.toFixed(1)} pour un budget de ${budget} (écart ${d.toFixed(1)})`); }
  } else {
    const v = spellValue(c), lo = c.c * 2 - (c.r === "L" ? 6 : 2), hi = c.c * 2 + 5;
    if (v < lo || v > hi) { bad++; console.log(`  ! ${c.id} ${c.name} (coût ${c.c}) : valeur ${v.toFixed(1)}, attendu entre ${lo} et ${hi}`); }
  }
});
console.log(byF);
console.log(bad ? `${bad} carte(s) hors budget.` : "Toutes les cartes sont dans leur budget.");
const ids = new Set(CA.CARDS.map((c) => c.id));
if (ids.size !== CA.CARDS.length) { console.log("IDS DUPLIQUÉS"); process.exitCode = 1; }
console.log("Total cartes :", CA.CARDS.length);

/* ───── 2. Decks prêts à jouer ───── */
console.log("\n== DECKS PRÊTS À JOUER ==");
const decks = {};
CA.FACTION_ORDER.forEach((f) => {
  decks[f] = E.autoDeck(f);
  const probs = E.deckProblems(decks[f]);
  const units = decks[f].filter((id) => E.card(id).type === "unit").length;
  const avg = decks[f].reduce((s, id) => s + E.card(id).c, 0) / decks[f].length;
  console.log(f, probs.length ? probs : "OK", `unités ${units}/30, coût moyen ${avg.toFixed(2)}`);
});

/* ───── 3. Tournoi ───── */
const N = parseInt(process.argv[2] || "20", 10);
console.log(`\n== TOURNOI IA vs IA (${N} parties par face-à-face et par ordre) ==`);
function play(deckA, deckB, first, seed) {
  const g = E.newGame({ decks: [deckA, deckB], names: ["A", "B"], first, seed });
  let guard = 0;
  while (!g.over && guard++ < 80) {
    CA.AI.playTurn(g, g.active);
    E.endTurn(g);
  }
  return { winner: g.over ? g.winner : -1, turns: g.turn, g };
}
const wins = {}, games = {}, firstWins = [0, 0];
let turnsTotal = 0, nGames = 0, draws = 0, seed = 1;
CA.FACTION_ORDER.forEach((f) => { wins[f] = 0; games[f] = 0; });
const matrix = {};
const t0 = Date.now();
for (const fa of CA.FACTION_ORDER) for (const fb of CA.FACTION_ORDER) {
  if (fa === fb) continue;
  matrix[fa + ">" + fb] = 0;
  for (let k = 0; k < N; k++) {
    const first = k % 2;
    const r = play(decks[fa], decks[fb], first, seed++);
    nGames++; turnsTotal += r.turns;
    games[fa]++; games[fb]++;
    if (r.winner < 0) { draws++; continue; }
    const wf = r.winner === 0 ? fa : fb;
    wins[wf]++;
    if (wf === fa) matrix[fa + ">" + fb]++;
    firstWins[r.winner === first ? 0 : 1]++;
  }
}
console.log("Taux de victoire par faction :");
CA.FACTION_ORDER.forEach((f) => console.log("  " + f.padEnd(9), (100 * wins[f] / games[f]).toFixed(1) + " %"));
console.log("Face-à-face (victoires de la ligne sur la colonne, sur " + N + " parties) :");
console.log("            " + CA.FACTION_ORDER.map((f) => f.slice(0, 5).padStart(6)).join(""));
CA.FACTION_ORDER.forEach((fa) => console.log(fa.padEnd(11) + CA.FACTION_ORDER.map((fb) => (fa === fb ? "   -  " : String(matrix[fa + ">" + fb]).padStart(6))).join("")));
console.log(`Durée moyenne : ${(turnsTotal / nGames / 2).toFixed(1)} tours par joueur`);
console.log(`Avantage du premier joueur : ${(100 * firstWins[0] / (firstWins[0] + firstWins[1])).toFixed(1)} %`);
console.log(`Parties sans vainqueur : ${draws}/${nGames}   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
