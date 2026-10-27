/* Codex Arcanum — données : factions, mots-clés, 100 cartes, génération du texte.
   Les textes de cartes sont GÉNÉRÉS depuis les effets : texte et moteur ne peuvent pas diverger. */
(function (root) {
  "use strict";

  /* ───────── Univers ───────── */
  const LORE = {
    tagline: "Cinq puissances. Cinq Sceaux. Un livre qui réécrit le monde.",
    world:
      "Le Codex Arcanum est le livre où le monde est écrit. Qui tient ses cinq Sceaux peut en réécrire une ligne — et le monde avec. " +
      "Cinq puissances s'affrontent donc pour la Citadelle d'Encre, chacune convaincue que le monde doit être écrit à sa manière."
  };

  const FACTIONS = {
    AURELIA:  { name: "Royaume d'Aurélia", short: "Aurélia",  sym: "✦", color: "#b8902c", dark: "#6e520e", tint: "#fbf3da",
                motto: "L'Ordre", doctrine: "Tenir, soigner, durer. Des murs que rien ne perce, des soins qui annulent vos pertes.",
                keys: "Garde · Égide · Soutien" },
    DRACONIS: { name: "Clan Draconis",     short: "Draconis", sym: "⬥", color: "#b03a26", dark: "#601a10", tint: "#fbe6e1",
                motto: "La Force", doctrine: "Frapper avant que l'autre ne soit prêt. Peu de défense, beaucoup de dégâts directs.",
                keys: "Charge · Rage · Percée" },
    SYLVE:    { name: "Sylve Éternelle",   short: "Sylve",    sym: "❧", color: "#2f7a36", dark: "#16401a", tint: "#e4f3e2",
                motto: "L'Éveil", doctrine: "Submerger. Beaucoup de petites unités, vives et peu chères, qui étouffent le plateau.",
                keys: "Vif · Rejetons · Étourdissement" },
    ARCANES:  { name: "Ordre des Arcanes", short: "Arcanes",  sym: "✸", color: "#5a3ccf", dark: "#2c1a78", tint: "#ece7fb",
                motto: "Le Savoir", doctrine: "Contrôler. Piocher plus, renvoyer, étourdir, détruire : l'adversaire joue dans votre tempo.",
                keys: "Pioche · Renvoi · Aether" },
    ABYSSES:  { name: "Abysses Maudites",  short: "Abysses",  sym: "☽", color: "#4a6574", dark: "#1c2c36", tint: "#e6edf1",
                motto: "La Mort", doctrine: "Rien n'est perdu. Ce qui meurt blesse, revient, ou nourrit autre chose.",
                keys: "Dernier souffle · Résurrection · Drain" }
  };
  const FACTION_ORDER = ["AURELIA", "DRACONIS", "SYLVE", "ARCANES", "ABYSSES"];

  const RARITIES = {
    C: { name: "Commune",    color: "#8a98a2", max: 2 },
    R: { name: "Rare",       color: "#3f7cb8", max: 2 },
    E: { name: "Épique",     color: "#7a4cc8", max: 2 },
    L: { name: "Légendaire", color: "#c99a22", max: 1 }
  };

  const KEYWORDS = {
    charge:  { name: "Charge",  text: "Peut attaquer dès son arrivée." },
    garde:   { name: "Garde",   text: "Subit 1 dégât de moins en combat." },
    percee:  { name: "Percée",  text: "Si elle détruit son adversaire, les dégâts en trop touchent la Citadelle." },
    vif:     { name: "Vif",     text: "Frappe avant les unités sans Vif : si l'adversaire meurt, il ne riposte pas." },
    rage:    { name: "Rage",    text: "Gagne +1 Attaque chaque fois qu'elle attaque et survit." },
    egide:   { name: "Égide",   text: "Annule la prochaine source de dégâts, puis disparaît." },
    soutien: { name: "Soutien", text: "Au début de votre tour, rend 1 PV aux unités alliées adjacentes." }
  };
  const KW_ORDER = ["charge", "vif", "garde", "egide", "percee", "rage", "soutien"];

  /* ───────── Jetons (non piochables) ───────── */
  const TOKENS = {
    TK_ROOT:  { id: "TK_ROOT",  token: true, name: "Rejeton",    f: "SYLVE",    type: "unit", c: 0, atk: 1, hp: 1, kw: [],         on: {}, e: "🌱", lore: "Une graine qui n'a pas attendu le printemps." },
    TK_BONE:  { id: "TK_BONE",  token: true, name: "Os animé",   f: "ABYSSES",  type: "unit", c: 0, atk: 1, hp: 1, kw: [],         on: {}, e: "🦴", lore: "Il obéit. C'est tout ce qu'il sait faire." },
    TK_EMBER: { id: "TK_EMBER", token: true, name: "Braisillon", f: "DRACONIS", type: "unit", c: 0, atk: 2, hp: 1, kw: ["charge"], on: {}, e: "🔥", lore: "Né de la cendre, mort avant de la quitter." }
  };

  /* ───────── Constructeurs d'effets ───────── */
  const dmg    = (n, to) => ({ k: "dmg", n, to });
  const heal   = (n, to) => ({ k: "heal", n, to });
  const buff   = (a, h, to) => ({ k: "buff", a, h, to });
  const draw   = (n) => ({ k: "draw", n });
  const kill   = (to) => ({ k: "kill", to });
  const bounce = (to) => ({ k: "bounce", to });
  const stun   = (to) => ({ k: "stun", to });
  const aether = (n) => ({ k: "aether", n });
  const summon = (tok, n) => ({ k: "summon", tok, n: n || 1 });
  const grant  = (kw, to) => ({ k: "grant", kw, to });
  const raise  = (n) => ({ k: "raise", n: n || 1 });

  const U = (id, name, f, r, c, atk, hp, kw, on, e, lore) =>
    ({ id, name, f, r, c, type: "unit", atk, hp, kw: kw || [], on: on || {}, e, lore });
  const S = (id, name, f, r, c, pick, fx, e, lore) =>
    ({ id, name, f, r, c, type: "spell", pick: pick || null, fx, e, lore });
  const arrive = (...fx) => ({ arrive: fx });
  const last = (...fx) => ({ last: fx });

  /* ───────── Les 100 cartes : 5 factions × (14 unités + 6 sorts) ─────────
     Raretés par faction : unités 6C/4R/3E/1L, sorts 2C/2R/1E/1L.
     Budget de stats d'une unité de coût c : voir tools/check.js (2c+2 points). */
  const CARD_LIST = [
    /* ═══ AURÉLIA — l'Ordre ═══ */
    U("A01", "Écuyer du Lys",        "AURELIA", "C", 1, 1, 2, ["garde"], null, "⚔️", "Il garde le seuil avant même de savoir pourquoi."),
    U("A02", "Lancier Royal",        "AURELIA", "C", 2, 2, 2, ["vif"], null, "🔱", "Toute lame qui fonce droit se brise sur la sienne."),
    U("A03", "Prêtresse des Aubes",  "AURELIA", "C", 2, 1, 3, ["soutien"], null, "🕯️", "L'aube revient. Elle s'en assure."),
    U("A04", "Archer de Clairval",   "AURELIA", "C", 2, 2, 2, [], arrive(dmg(1, "facing")), "🏹", "Clairval ne tombe pas. Ses archers voient trop loin."),
    U("A05", "Garde-Bouclier",       "AURELIA", "C", 3, 2, 5, ["garde"], null, "🛡️", "Il ne recule pas. Ce n'est pas dans ses ordres."),
    U("A06", "Griffon Jeune",        "AURELIA", "C", 3, 3, 3, ["charge"], null, "🦅", "Ses serres n'ont pas encore vu la guerre. Ses yeux, si."),
    U("A07", "Chevalier du Lys",     "AURELIA", "R", 3, 3, 3, ["garde", "egide"], null, "🐴", "Chaque cicatrice est un serment tenu."),
    U("A08", "Paladine Séraphine",   "AURELIA", "R", 4, 3, 4, ["soutien"], arrive(heal(3, "ownCit")), "👼", "Elle frappe et guérit dans le même souffle."),
    U("A09", "Héraut du Rempart",    "AURELIA", "R", 4, 3, 4, ["garde"], arrive(buff(0, 1, "allies")), "📯", "Sa présence renforce les murs autant que les hommes."),
    U("A10", "Gryphus, Aile Royale", "AURELIA", "R", 5, 5, 5, ["charge"], null, "🦁", "Monture des rois depuis la première ère."),
    U("A11", "Champion de l'Aurore", "AURELIA", "E", 5, 4, 4, ["egide"], arrive(buff(1, 1, "allies")), "🌅", "Il se lève plus fort quand le royaume vacille."),
    U("A12", "Gardienne du Sanctuaire","AURELIA","E", 5, 2, 7, ["garde", "soutien"], null, "⛪", "Elle ne mourra pas. Le sanctuaire non plus."),
    U("A13", "Cavalier du Serment",  "AURELIA", "E", 6, 5, 6, ["charge", "garde"], null, "🏇", "Son serment l'appelle quand tout le reste s'effondre."),
    U("A14", "Kaelion, Lys d'Or",    "AURELIA", "L", 7, 5, 7, ["garde", "egide", "soutien"], null, "👑", "Le Lys ne plie pas. Kaelion non plus."),
    S("A15", "Prière du Rempart",    "AURELIA", "C", 1, "ally", [grant("egide", "pick")], "🙏", "La lumière répond à qui la demande."),
    S("A16", "Soin de Campagne",     "AURELIA", "C", 2, "ally", [heal(4, "pick"), draw(1)], "🩹", "Les remparts tiennent grâce aux mains derrière eux."),
    S("A17", "Formation Serrée",     "AURELIA", "R", 3, null, [buff(0, 2, "allies")], "🛡", "Serrés. Aucune lame ne passe entre eux."),
    S("A18", "Bannière Sacrée",      "AURELIA", "R", 3, null, [heal(3, "allies"), heal(3, "ownCit")], "🚩", "Là où elle flotte, les bras ne fléchissent pas."),
    S("A19", "Serment de Lumière",   "AURELIA", "E", 4, "ally", [buff(3, 2, "pick"), grant("egide", "pick")], "✨", "Certains serments changent la nature de celui qui les prononce."),
    S("A20", "Jugement du Haut-Roi", "AURELIA", "L", 7, null, [dmg(4, "foes"), heal(4, "allies")], "⚖️", "Il ne juge qu'une fois. Une fois suffit."),

    /* ═══ DRACONIS — la Force ═══ */
    U("D01", "Écailleux de Braise",  "DRACONIS", "C", 1, 2, 1, ["rage"], null, "🦎", "Petit. Rapide. Déjà en feu."),
    U("D02", "Pillard Cendré",       "DRACONIS", "C", 2, 2, 2, ["charge"], null, "🗡️", "Il n'attend pas d'avoir faim pour chasser."),
    U("D03", "Chien de Forge",       "DRACONIS", "C", 2, 2, 3, ["percee"], null, "🐕", "La forge lui a appris que le métal rend fort."),
    U("D04", "Guerrier Écaille-Rouge","DRACONIS","C", 3, 4, 3, ["rage"], null, "🪓", "La douleur allume quelque chose en lui."),
    U("D05", "Pyromancien de Faille","DRACONIS","C", 3, 3, 2, [], arrive(dmg(2, "facing")), "🔥", "Il arrive toujours avec de l'avance sur la destruction."),
    U("D06", "Drake Mineur",         "DRACONIS", "C", 4, 5, 4, ["percee"], null, "🐲", "Même mineur, un drake reste un dragon."),
    U("D07", "Forgeron Draconique",  "DRACONIS", "R", 3, 3, 3, [], arrive(buff(1, 0, "allies")), "🔨", "Il ne forge pas des armes. Il forge des victoires."),
    U("D08", "Berserker du Cratère", "DRACONIS", "R", 4, 4, 5, ["rage"], null, "😡", "Plus il tue, plus il résiste. C'est le problème."),
    U("D09", "Wyverne Rouge",        "DRACONIS", "R", 4, 3, 3, ["charge", "percee"], null, "🐉", "Elle vise ce que les autres ne peuvent pas atteindre."),
    U("D10", "Gardien du Volcan",    "DRACONIS", "R", 5, 3, 7, ["garde", "rage"], null, "🌋", "La lave coule. Lui, il reste."),
    U("D11", "Dragon de Siège",      "DRACONIS", "E", 6, 7, 6, ["percee"], null, "🏰", "Quand il avance, les murs s'interrogent sur leur utilité."),
    U("D12", "Vaelgrim, Maître Forge","DRACONIS","E", 5, 4, 4, ["garde"], arrive(buff(1, 0, "allies"), dmg(1, "foeCit")), "⚒️", "Chaque pièce qu'il forge porte une promesse de survie."),
    U("D13", "Phénix de Cendre",     "DRACONIS", "E", 6, 5, 4, ["charge"], last(summon("TK_EMBER", 1)), "🦤", "La cendre n'est pas une fin. C'est un intervalle."),
    U("D14", "Arkanor, Soleil Noir", "DRACONIS", "L", 8, 7, 8, ["charge", "percee", "rage"], null, "☀️", "Il n'éclipse pas le soleil. Il le remplace."),
    S("D15", "Jet de Flammes",       "DRACONIS", "C", 2, "foe", [dmg(3, "pick")], "🔥", "Simple. Efficace. Chaud."),
    S("D16", "Rugissement de Guerre","DRACONIS", "C", 3, null, [buff(1, 0, "allies"), grant("charge", "allies")], "📢", "Le cri précède toujours les dégâts."),
    S("D17", "Marque Incandescente", "DRACONIS", "R", 3, "foe", [dmg(2, "pick"), stun("pick")], "♨️", "Marqué par le feu. Suivi par tout le reste."),
    S("D18", "Marteau Volcanique",   "DRACONIS", "R", 4, "foe", [dmg(5, "pick")], "🔨", "Conçu pour traverser. Tout."),
    S("D19", "Frénésie de Braise",   "DRACONIS", "E", 4, "ally", [buff(4, 0, "pick"), grant("charge", "pick")], "💢", "La blessure devient carburant."),
    S("D20", "Éruption Primordiale", "DRACONIS", "L", 8, null, [dmg(3, "foes"), dmg(6, "foeCit")], "🌋", "Avant, il y avait un champ de bataille. Après, il y a de la lave."),

    /* ═══ SYLVE — l'Éveil ═══ */
    U("S01", "Lutin des Racines",    "SYLVE", "C", 1, 1, 1, [], arrive(summon("TK_ROOT", 1)), "🧚", "Il ne combat pas. Il prépare le terrain pour ceux qui combattront."),
    U("S02", "Archer Sylvain",       "SYLVE", "C", 2, 2, 2, ["vif"], null, "🏹", "La forêt lui a appris à viser sans être vu."),
    U("S03", "Louveteau des Brumes", "SYLVE", "C", 2, 2, 2, [], arrive(buff(1, 0, "adj")), "🐺", "Seul, il hésite. Avec la meute, il fonce."),
    U("S04", "Dryade Guérisseuse",   "SYLVE", "C", 2, 1, 2, [], arrive(draw(1)), "🌿", "L'écorce guérit. Les mains savent où poser."),
    U("S05", "Chasseur d'Écorce",    "SYLVE", "C", 3, 3, 3, ["vif"], null, "🪵", "Il traque ce que la corruption a marqué. Il finit le travail."),
    U("S06", "Cerf Runique",         "SYLVE", "C", 3, 2, 5, ["egide"], null, "🦌", "Les runes sur ses bois ne sont pas des décorations."),
    U("S07", "Sentinelle des Bois",  "SYLVE", "R", 3, 2, 2, ["vif", "egide"], null, "🦉", "Elle bouge avant que l'ennemi décide de la regarder."),
    U("S08", "Fenryr, Loup des Brumes","SYLVE","R", 4, 3, 2, ["vif", "charge"], null, "🐺", "Il court depuis avant la naissance des royaumes."),
    U("S09", "Gardien Roncier",      "SYLVE", "R", 4, 2, 5, ["garde"], arrive(dmg(1, "facing")), "🌵", "Les ronces ne demandent pas permission."),
    U("S10", "Élue des Clairières",  "SYLVE", "R", 4, 2, 3, [], arrive(summon("TK_ROOT", 2)), "🧝‍♀️", "La clairière répond à son appel. Les loups aussi."),
    U("S11", "Elyndra, Voix Sylvestre","SYLVE","E", 5, 3, 4, ["soutien"], arrive(buff(1, 1, "allies")), "🧝", "Quand elle parle, la forêt entière se lève."),
    U("S12", "Maelthorn, Cerf Sacré","SYLVE", "E", 5, 3, 5, ["egide"], last(heal(5, "ownCit")), "🦌", "Le voir est un présage. Le tuer, une malédiction."),
    U("S13", "Griffelune",           "SYLVE", "E", 6, 5, 4, ["vif", "charge"], null, "🐆", "Elle sent la peur avant même de voir la cible."),
    U("S14", "Sylvaros, Ancien Chêne","SYLVE","L", 8, 5, 8, ["garde"], arrive(summon("TK_ROOT", 2)), "🌳", "Il était là avant le premier roi. Il sera là après le dernier."),
    S("S15", "Flèche Marquante",     "SYLVE", "C", 1, "foe", [dmg(1, "pick"), stun("pick")], "🎯", "La marque précède toujours la mort."),
    S("S16", "Pas de Brume",         "SYLVE", "C", 1, null, [aether(1), draw(1)], "🌫️", "Un pas dans la brume. Deux dans l'autre monde."),
    S("S17", "Crocs de Loup",        "SYLVE", "R", 2, "ally", [buff(2, 0, "pick"), grant("vif", "pick")], "🐾", "Le loup n'achève pas par cruauté. Par efficacité."),
    S("S18", "Ronces Vives",         "SYLVE", "R", 4, null, [dmg(1, "foes"), stun("foes")], "🥀", "La ronce ne demande pas si le moment est opportun."),
    S("S19", "Appel de la Meute",    "SYLVE", "E", 4, null, [summon("TK_ROOT", 3), grant("charge", "allies")], "🌕", "Un hurlement. Puis deux. Puis le silence des proies."),
    S("S20", "Colère de la Forêt",   "SYLVE", "L", 7, null, [buff(2, 2, "allies"), grant("charge", "allies")], "🌲", "La forêt n'est pas en colère souvent. Ceux qui l'ont vu ne l'ont pas dit longtemps."),

    /* ═══ ARCANES — le Savoir ═══ */
    U("R01", "Apprenti Runique",     "ARCANES", "C", 1, 1, 1, [], arrive(draw(1)), "📚", "Il apprend encore. Le Réseau, lui, ne pardonne pas."),
    U("R02", "Scribe des Sceaux",    "ARCANES", "C", 2, 1, 3, [], arrive(aether(1)), "🖋️", "Il copie les sceaux. Parfois, il en comprend un."),
    U("R03", "Mage de Givre",        "ARCANES", "C", 2, 3, 2, [], arrive(stun("facing")), "❄️", "Le givre ralentit. Ça suffit souvent."),
    U("R04", "Golem d'Argile",       "ARCANES", "C", 3, 2, 5, ["garde"], null, "🗿", "Façonné pour obéir. Ce qu'on lui demande, c'est de tenir."),
    U("R05", "Élémentaire Bleu",     "ARCANES", "C", 3, 3, 2, [], last(dmg(2, "rand")), "💧", "L'énergie stockée cherche toujours à se libérer."),
    U("R06", "Veilleur Astral",      "ARCANES", "C", 3, 2, 3, ["garde"], arrive(grant("egide", "adj")), "👁️", "Il observe tout. Y compris ce qui pourrait tuer ses alliés."),
    U("R07", "Lyria, Mage des Cristaux","ARCANES","R", 4, 2, 3, [], arrive(dmg(2, "rand"), draw(1)), "🔮", "Chaque cristal contient une vie ancienne. Elle les écoute."),
    U("R08", "Golem de Cristal",     "ARCANES", "R", 4, 3, 5, ["garde", "egide"], null, "💎", "Les cristaux le protègent à l'entrée. Après, c'est lui qui protège."),
    U("R09", "Chronomancien",        "ARCANES", "R", 4, 3, 3, [], arrive(stun("facing"), aether(1)), "⏳", "Il ne manipule pas le temps. Il choisit quel moment retenir."),
    U("R10", "Arcaniste du Miroir",  "ARCANES", "R", 5, 3, 5, [], arrive(bounce("facing")), "🪞", "Le miroir ne ment pas. Il dit la vérité deux fois."),
    U("R11", "Thalor, Gardien des Runes","ARCANES","E", 5, 3, 4, ["garde"], arrive(draw(2)), "📜", "Il ne lit pas les runes. Les runes lui obéissent."),
    U("R12", "Oracle de Verre",      "ARCANES", "E", 5, 2, 3, [], arrive(dmg(3, "rand"), draw(1)), "🔭", "Elle ne prédit pas l'avenir. Elle choisit lequel arriver."),
    U("R13", "Dragon Astral Mineur", "ARCANES", "E", 6, 6, 5, ["percee"], arrive(stun("facing")), "🌌", "Invoqué par les sorts, dissous par le silence."),
    U("R14", "Astérion, Archimage",  "ARCANES", "L", 8, 4, 7, [], arrive(draw(3)), "🧙", "Trois cartes. Le monde change. Il le savait déjà."),
    S("R15", "Éclair Mineur",        "ARCANES", "C", 1, "foe", [dmg(2, "pick")], "⚡", "Petit. Suffisant. Parfois."),
    S("R16", "Barrière Runique",     "ARCANES", "C", 2, "ally", [grant("egide", "pick"), draw(1)], "🔰", "Les runes protègent ceux qui les comprennent mieux."),
    S("R17", "Téléportation Courte", "ARCANES", "R", 2, "foe", [bounce("pick")], "🌀", "Court. Ça ne prend qu'un instant. L'ennemi en aura besoin de plusieurs."),
    S("R18", "Anneau de Canalisation","ARCANES","R", 1, null, [aether(2)], "💍", "La patience est une forme de puissance."),
    S("R19", "Sceau d'Annulation",   "ARCANES", "E", 4, "foe", [kill("pick")], "🚫", "Non."),
    S("R20", "Tempête Arcanique",    "ARCANES", "L", 7, null, [dmg(4, "foes"), dmg(4, "foeCit")], "🌩️", "La tour déverse tout ce qu'elle a retenu. Les ennemis reçoivent tout."),

    /* ═══ ABYSSES — la Mort ═══ */
    U("M01", "Squelette Fissuré",    "ABYSSES", "C", 1, 2, 1, [], last(dmg(2, "foeCit")), "💀", "Il se brise. C'est son utilité."),
    U("M02", "Corbeau Funeste",      "ABYSSES", "C", 1, 1, 2, [], arrive(dmg(1, "rand")), "🐦‍⬛", "Il précède toujours les mauvaises nouvelles. Parfois, il les cause."),
    U("M03", "Acolyte Blême",        "ABYSSES", "C", 2, 2, 2, [], arrive(dmg(1, "facing")), "🕯️", "Il sourit en arrivant. Les ennemis blessés comprennent pourquoi."),
    U("M04", "Goule de Crypte",      "ABYSSES", "C", 2, 2, 3, ["rage"], null, "🧟", "La faim de la crypte ne s'éteint jamais."),
    U("M05", "Porte-Peste",          "ABYSSES", "C", 3, 2, 3, [], last(dmg(1, "foes")), "☣️", "Il touche. Il part. Le reste vient après."),
    U("M06", "Gardien Gargouille",   "ABYSSES", "C", 3, 2, 5, ["garde"], null, "🗽", "La pierre ne guérit pas. Elle endure."),
    U("M07", "Nécromancien Mineur",  "ABYSSES", "R", 3, 2, 3, [], arrive(raise(1)), "🪦", "La mort n'est qu'un matériau de construction."),
    U("M08", "Spectre des Douves",   "ABYSSES", "R", 4, 3, 3, ["vif", "egide"], null, "👻", "Il attend que la corruption fasse son travail. Puis il finit le sien."),
    U("M09", "Chevalier Déchu",      "ABYSSES", "R", 4, 4, 4, ["garde", "rage"], null, "🏴", "Il se souvient de son serment. Il l'a brisé quand même."),
    U("M10", "Dévoreur d'Âmes",      "ABYSSES", "R", 5, 5, 5, ["rage", "percee"], null, "👹", "Plus il y a de morts, plus il se porte bien."),
    U("M11", "Nocthar, Liche Couronnée","ABYSSES","E", 6, 3, 5, [], arrive(raise(1), draw(1)), "☠️", "Sa couronne fut forgée dans les os de ses prédécesseurs."),
    U("M12", "Morvath, Seigneur des Fosses","ABYSSES","E", 6, 4, 6, [], last(summon("TK_BONE", 2)), "🕳️", "Il nourrit les fosses. Les fosses le nourrissent en retour."),
    U("M13", "Banshee Voilée",       "ABYSSES", "E", 5, 3, 4, ["vif"], arrive(stun("facing")), "🌫️", "Son cri n'est pas une plainte. C'est un avertissement."),
    U("M14", "Vorak, Dragon Charognard","ABYSSES","L", 8, 5, 6, ["rage"], arrive(dmg(2, "foes")), "🦇", "Il se nourrit des corrompus. Plus il y en a, plus il grandit."),
    S("M15", "Toucher Flétrissant",  "ABYSSES", "C", 2, "foe", [dmg(3, "pick"), heal(3, "ownCit")], "🖐️", "Un frôlement. Une vie qui se dégrade."),
    S("M16", "Sacrifice Noir",       "ABYSSES", "C", 1, "ally", [kill("pick"), draw(2)], "🩸", "La mort d'un soldat acheté deux décisions. Ça vaut le prix."),
    S("M17", "Cri des Cryptes",      "ABYSSES", "R", 2, null, [dmg(1, "foes"), raise(1)], "📣", "Les cryptes se souviennent de tout le monde. Même de toi."),
    S("M18", "Chaînes Funéraires",   "ABYSSES", "R", 2, "foe", [stun("pick"), dmg(3, "foeCit")], "⛓️", "Les morts n'ont nulle part où aller. Elles non plus maintenant."),
    S("M19", "Pacte Interdit",       "ABYSSES", "E", 3, null, [draw(3), aether(2), dmg(4, "ownCit")], "📕", "Le pouvoir est immédiat. La dette, elle, prend son temps."),
    S("M20", "Nuit des Défunts",     "ABYSSES", "L", 6, null, [raise(3)], "🌑", "Cette nuit, ils reviennent tous. Une seule fois.")
  ];

  const CARDS = CARD_LIST;
  const BY_ID = {};
  CARDS.forEach((c) => (BY_ID[c.id] = c));
  Object.keys(TOKENS).forEach((k) => (BY_ID[k] = TOKENS[k]));

  /* ───────── Génération du texte ───────── */
  // Pour chaque cible : [accusatif, datif, pluriel?]
  const TGT = {
    self:    ["cette unité", "à cette unité", false],
    facing:  ["l'unité ennemie en face", "à l'unité ennemie en face", false],
    adj:     ["les unités alliées adjacentes", "aux unités alliées adjacentes", true],
    allies:  ["vos autres unités", "à vos autres unités", true],
    foes:    ["toutes les unités ennemies", "à toutes les unités ennemies", true],
    rand:    ["une unité ennemie au hasard", "à une unité ennemie au hasard", false],
    foeCit:  ["la Citadelle ennemie", "à la Citadelle ennemie", false],
    ownCit:  ["votre Citadelle", "à votre Citadelle", false],
    pick:    ["l'unité choisie", "à l'unité choisie", false]
  };
  const up = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plur = (n, s, p) => (n > 1 ? p || s + "s" : s);
  const signed = (n) => (n > 0 ? "+" + n : "" + n);

  function fxText(e, isSpell) {
    // en sort, "allies" = toutes vos unités ; en unité, "allies" = vos autres unités
    const t = TGT[e.to] ? TGT[e.to].slice() : null;
    if (isSpell && e.to === "allies") { t[0] = "toutes vos unités"; t[1] = "à toutes vos unités"; }
    switch (e.k) {
      case "dmg":    return `Inflige ${e.n} ${plur(e.n, "dégât")} ${t[1]}.`;
      case "heal":   return `Rend ${e.n} PV ${t[1]}.`;
      case "buff":   return `${up(t[0])} gagne${t[2] ? "nt" : ""} ${signed(e.a)}/${signed(e.h)}.`;
      case "draw":   return `Piochez ${e.n} ${plur(e.n, "carte")}.`;
      case "kill":   return `Détruit ${t[0]}.`;
      case "bounce": return `Renvoie ${t[0]} dans la main de son propriétaire.`;
      case "stun":   return `Étourdit ${t[0]} (elle ne pourra pas attaquer à son prochain assaut).`;
      case "aether": return `Gagnez ${e.n} Aether.`;
      case "summon": return `Invoque ${e.n} ${plur(e.n, TOKENS[e.tok].name)} (${TOKENS[e.tok].atk}/${TOKENS[e.tok].hp}${TOKENS[e.tok].kw.length ? ", " + TOKENS[e.tok].kw.map((k) => KEYWORDS[k].name).join(", ") : ""}).`;
      case "grant":  return `${up(t[0])} gagne${t[2] ? "nt" : ""} ${KEYWORDS[e.kw].name}.`;
      case "raise":  return e.n > 1
                       ? `Ramène en jeu vos ${e.n} dernières unités détruites.`
                       : `Ramène en jeu votre dernière unité détruite.`;
    }
    return "";
  }

  // Retourne des lignes : [{kind:'kw'|'trigger'|'effect', label?, text}]
  function cardLines(card) {
    const out = [];
    if (card.type === "unit") {
      if (card.on && card.on.arrive) out.push({ kind: "trigger", label: "Arrivée", text: card.on.arrive.map((e) => fxText(e)).join(" ") });
      if (card.on && card.on.last)   out.push({ kind: "trigger", label: "Dernier souffle", text: card.on.last.map((e) => fxText(e)).join(" ") });
    } else {
      const head = card.pick === "foe" ? "Choisissez une unité ennemie. " : card.pick === "ally" ? "Choisissez une unité alliée. " : "";
      out.push({ kind: "effect", text: head + card.fx.map((e) => fxText(e, true)).join(" ") });
    }
    return out;
  }
  function cardText(card) {
    return cardLines(card).map((l) => (l.label ? l.label + " : " : "") + l.text).join(" ");
  }

  const CA = root.CA = root.CA || {};
  Object.assign(CA, { LORE, FACTIONS, FACTION_ORDER, RARITIES, KEYWORDS, KW_ORDER, TOKENS, CARDS, BY_ID, cardText, cardLines, fxText });
  if (typeof module !== "undefined") module.exports = CA;
})(typeof window !== "undefined" ? window : globalThis);
