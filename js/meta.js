/* Codex Arcanum — contenu de progression : cartes de départ, campagne, défi du jour, quêtes, succès, niveaux.
   Données seulement (aucun état) : les calculs sont dans profile.js. */
(function (root) {
  "use strict";
  const CA = root.CA;

  /* ───────── Cartes de départ ─────────
     Toutes les Communes et Rares + l'unité Épique la moins chère de chaque faction : 75 cartes,
     ce qui donne exactement 30 cartes jouables (2 exemplaires max) par faction. Les 25 autres cartes
     (Épiques et Légendaires) se débloquent en jouant. */
  const STARTER = {};
  CA.CARDS.forEach((c) => { if (c.r === "C" || c.r === "R") STARTER[c.id] = true; });
  CA.FACTION_ORDER.forEach((f) => {
    const e = CA.CARDS.filter((c) => c.f === f && c.r === "E" && c.type === "unit").sort((a, b) => a.c - b.c || a.id.localeCompare(b.id))[0];
    STARTER[e.id] = true;
  });

  /* ───────── Niveaux ───────── */
  const xpForLevel = (lvl) => 80 + 20 * lvl;           // XP pour passer du niveau lvl à lvl+1

  /* ───────── Campagne : la Voie du Codex ───────── */
  const CHAPTERS = [
    { f: "AURELIA",  seal: "Sceau de l'Ordre",  title: "Le Seuil d'Or",
      intro: "Vous êtes Archiviste. Le Codex s'effrite, et ses cinq Sceaux sont tenus par cinq puissances. Le premier est gardé par Aurélia, derrière ses murs.",
      outro: "Le Sceau de l'Ordre est à vous. Les murs d'Aurélia ne s'ouvrent plus que devant vous.",
      nodes: [["Les Remparts", "Un écuyer vous barre la route. Il n'a pas encore appris la peur."], ["La Garde du Lys", "Les chevaliers du Lys ne quittent jamais leurs rangs."], ["Kaelion, Lys d'Or", "Le Haut-Roi ne cède rien sans combat."]] },
    { f: "SYLVE",    seal: "Sceau de l'Éveil",  title: "Les Sentiers de Brume",
      intro: "La forêt a senti le Sceau passer dans vos mains. Elle se réveille, et elle n'est pas seule.",
      outro: "Le Sceau de l'Éveil brille. La brume se dissipe sur votre passage.",
      nodes: [["La Lisière", "Les premiers rejetons vous encerclent, curieux."], ["La Meute", "Les loups avancent en silence, les uns derrière les autres."], ["Sylvaros, Ancien Chêne", "Il était là avant le premier roi."]] },
    { f: "DRACONIS", seal: "Sceau de la Force", title: "Les Forges Rouges",
      intro: "Au sud, les forges ne s'éteignent jamais. Le clan Draconis ne négocie pas : il frappe d'abord.",
      outro: "Le Sceau de la Force est à vous, encore chaud entre vos doigts.",
      nodes: [["Les Forges", "Un pillard cendré rit de votre taille."], ["Le Cratère", "La lave lèche déjà les bottes de vos adversaires."], ["Arkanor, Soleil Noir", "Il ne remplace pas le soleil : il le mange."]] },
    { f: "ARCANES",  seal: "Sceau du Savoir",   title: "La Bibliothèque Close",
      intro: "L'Ordre des Arcanes a scellé sa bibliothèque. Chaque porte exige une réponse, et il connaît déjà la vôtre.",
      outro: "Le Sceau du Savoir s'inscrit dans votre mémoire. Quatre sont à vous.",
      nodes: [["Le Scriptorium", "Les scribes copient vos gestes avant que vous les fassiez."], ["La Salle des Miroirs", "Votre reflet joue contre vous."], ["Astérion, Archimage", "Trois cartes. Le monde change. Il le savait déjà."]] },
    { f: "ABYSSES",  seal: "Sceau de la Mort",  title: "Les Fosses",
      intro: "Le dernier Sceau dort là où rien ne dort vraiment. Les Abysses vous attendent depuis le début.",
      outro: "Les cinq Sceaux sont réunis. Le Codex s'ouvre, et une nouvelle ligne n'attend que votre plume. Vous êtes la Légende.",
      nodes: [["Les Ossuaires", "Les squelettes se brisent, puis se relèvent."], ["La Crypte", "Ce qui meurt ici revient toujours."], ["Vorak, Dragon Charognard", "Il se nourrit de ce que vous laisserez."]] }
  ];
  const SKILL_NAMES = ["Novice", "Adepte", "Maître"];
  // 15 duels linéaires
  const NODES = [];
  CHAPTERS.forEach((ch, ci) => ch.nodes.forEach((n, ni) => {
    const boss = ni === 2;
    NODES.push({
      key: `c${ci + 1}n${ni + 1}`, chapter: ci, index: ni, boss, faction: ch.f, title: n[0], story: n[1],
      skill: ci === 0 && !boss ? 0 : boss ? 2 : 1,
      pool: ci < 3 || (ci === 3 && !boss) ? "starter" : "full",
      cit: boss ? [24, 25, 26, 26, 28][ci] : 20, extraHand: 0,
      xp: boss ? 100 : 60
    });
  }));

  /* ───────── Défi du jour ───────── */
  const DAILY_MODS = [
    { id: "fragile", name: "Citadelles fragiles", text: "Les deux Citadelles n'ont que 12 PV.", opts: { cit: [12, 12] } },
    { id: "erudit", name: "Main d'érudit", text: "Vous commencez avec 2 cartes de plus.", opts: { extraHand: [2, 0] } },
    { id: "maree", name: "Marée d'idées", text: "Chacun pioche 2 cartes par tour.", opts: { drawPerTurn: [2, 2] } },
    { id: "geant", name: "Le Géant", text: "L'adversaire a 30 PV, mais vous piochez 2 cartes par tour.", opts: { cit: [20, 30], drawPerTurn: [2, 1] } }
  ];

  /* ───────── Quêtes quotidiennes ───────── */
  const FAC = CA.FACTION_ORDER;
  const QUESTS = [
    { id: "win1",   text: "Remporter 1 partie",                          goal: 1,  inc: (s) => (s.win ? 1 : 0) },
    { id: "play3",  text: "Terminer 3 parties",                          goal: 3,  inc: () => 1 },
    { id: "units8", text: "Jouer 8 unités",                              goal: 8,  inc: (s) => s.st.units },
    { id: "spell4", text: "Lancer 4 sorts",                              goal: 4,  inc: (s) => s.st.spells },
    { id: "cit20",  text: "Infliger 20 dégâts aux Citadelles ennemies",  goal: 20, inc: (s) => s.st.cit },
    { id: "kill6",  text: "Détruire 6 unités ennemies",                  goal: 6,  inc: (s) => s.st.kills }
  ].concat(FAC.map((f) => ({ id: "fac-" + f, text: `Jouer 6 cartes ${CA.FACTIONS[f].short}`, goal: 6, inc: (s) => s.st.fac[f] || 0 })));

  /* ───────── Succès ───────── */
  // test(P, s) est évalué après chaque partie (s = résumé de la partie), P = profil déjà mis à jour
  const ACH = [
    { id: "first",    name: "Première victoire",     text: "Gagner une partie.",                              test: (P, s) => s.win },
    { id: "wins10",   name: "Habitué des remparts",  text: "Gagner 10 parties.",                              test: (P) => P.stats.w >= 10 },
    { id: "wins50",   name: "Maître du Codex",       text: "Gagner 50 parties.",                              test: (P) => P.stats.w >= 50 },
    { id: "flawless", name: "Intact",                text: "Gagner sans perdre un seul PV.",                  test: (P, s) => s.win && s.citLeft >= s.citMax },
    { id: "comeback", name: "Remontada",             text: "Gagner avec 3 PV ou moins.",                      test: (P, s) => s.win && s.citLeft <= 3 },
    { id: "rush",     name: "Fulgurant",             text: "Gagner en 6 tours ou moins.",                     test: (P, s) => s.win && s.myTurns <= 6 },
    { id: "streak3",  name: "Série de 3",            text: "Gagner 3 parties d'affilée.",                     test: (P) => P.stats.run >= 3 },
    { id: "legend",   name: "Cartes de légende",     text: "Jouer une carte Légendaire.",                     test: (P, s) => s.st.legend > 0 },
    { id: "allfoes",  name: "Tour du monde",         text: "Battre chacune des 5 factions.",                  test: (P) => FAC.every((f) => (P.stats.beat[f] || 0) > 0) },
    { id: "custom",   name: "Artisan",               text: "Gagner avec un deck que vous avez construit.",    test: (P, s) => s.win && s.custom },
    { id: "chap1",    name: "Premier Sceau",         text: "Terminer le premier chapitre.",                   test: (P) => ["c1n1", "c1n2", "c1n3"].every((k) => P.campaign[k]) },
    { id: "campaign", name: "Le Codex est ouvert",   text: "Terminer la campagne.",                           test: (P) => NODES.every((n) => P.campaign[n.key]) },
    { id: "coll90",   name: "Collectionneur",        text: "Posséder 90 cartes.",                             test: (P) => Object.keys(P.owned).length >= 90 },
    { id: "coll100",  name: "Complet",               text: "Posséder les 100 cartes.",                        test: (P) => Object.keys(P.owned).length >= 100 },
    { id: "lvl10",    name: "Archiviste confirmé",   text: "Atteindre le niveau 10.",                         test: (P) => P.lvl >= 10 },
    { id: "days7",    name: "Une semaine",           text: "Jouer 7 jours de suite.",                         test: (P) => P.streak.n >= 7 }
  ];

  CA.Meta = { STARTER, xpForLevel, CHAPTERS, NODES, SKILL_NAMES, DAILY_MODS, QUESTS, ACH };
  if (typeof module !== "undefined") module.exports = CA.Meta;
})(typeof window !== "undefined" ? window : globalThis);
