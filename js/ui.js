/* Codex Arcanum — interface générale : navigation, accueil, campagne, cartes, decks, profil, règles, récompenses.
   Le combat est dans battle.js. Aucune règle de jeu ici : tout passe par CA.Engine / CA.Profile. */
(function () {
  "use strict";
  const CA = window.CA, E = CA.Engine, M = CA.Meta, Pr = CA.Profile, F = CA.FACTIONS, KW = CA.KEYWORDS, Au = CA.Audio;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const card = (id) => CA.BY_ID[id];
  const P = Pr.load();
  Au.on = P.settings.sound; Au.haptic = P.settings.haptic;
  const persist = () => Pr.save(P);
  const A = { screen: "play", g: null, me: 0, mode: null, busy: false, logOpen: false, ctx: null,
              fc: { f: "", t: "", c: 0, q: "", lock: false }, fd: { f: "", t: "", c: 0, q: "" }, edit: null, listOpen: window.innerWidth >= 900, node: null };
  const UI = CA.UI = { P, A, $, esc, card, persist };

  /* ───────── Petits utilitaires d'affichage ───────── */
  UI.wait = (ms) => new Promise((r) => setTimeout(r, ms * (P.settings.speed || 1)));
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200); }
  UI.toast = toast;
  const bar = (frac, cls) => `<div class="bar ${cls || ""}"><i style="transform:scaleX(${Math.max(0, Math.min(1, frac))})"></i></div>`;
  const frFac = (f) => F[f].short;

  /* ───────── Cartes en HTML ───────── */
  const KW_ICON = { charge: "»", vif: "✧", garde: "▣", percee: "➶", rage: "♨", soutien: "✚" };
  UI.KW_ICON = KW_ICON;

  // Illustration : art/<id>.webp si le fichier existe, sinon l'emoji reste affiché.
  const artImg = (c) => (c.token || !(CA.ART && CA.ART[c.id]) ? "" : `<img class="c-img" src="art/${c.id}.webp" alt="" loading="lazy" onerror="this.remove()">`);
  UI.artImg = artImg;
  function cardHTML(c, o) {
    o = o || {};
    const unit = c.type === "unit", fac = F[c.f];
    const kws = (c.kw || []).map((k) => `<span class="kw">${KW[k].name}</span>`).join("");
    const lines = CA.cardLines(c).map((l) => `<p>${l.label ? `<i>${l.label} :</i> ` : ""}${esc(l.text)}</p>`).join("");
    const atk = o.atk != null ? o.atk : c.atk, hp = o.hp != null ? o.hp : c.hp;
    return `<div class="card f-${c.f} r-${c.r || "C"} ${unit ? "unit" : "spell"} ${o.mini ? "mini" : ""} ${o.dim ? "dim" : ""} ${o.locked ? "locked" : ""}" style="--rc:${CA.RARITIES[c.r || "C"].color}">
      <div class="c-cost">${c.c}</div>
      <div class="c-art"><span class="c-sym">${fac.sym}</span><span class="c-emoji">${c.e}</span>${artImg(c)}<span class="c-rar"></span></div>
      <div class="c-name">${esc(c.name)}</div>
      <div class="c-type">${unit ? "Unité" : "Sort"} · ${fac.short}</div>
      <div class="c-text">${kws ? `<div class="c-kws">${kws}</div>` : ""}${lines}</div>
      ${unit ? `<div class="c-stats"><b class="atk">${atk}</b><b class="hp">${hp}</b></div>` : `<div class="c-stats"></div>`}
      ${o.count ? `<div class="count-badge">×${o.count}</div>` : ""}
      ${o.locked ? '<div class="lock">🔒</div>' : ""}
    </div>`;
  }
  UI.cardHTML = cardHTML;

  function defsFor(c) {
    const d = [];
    (c.kw || []).forEach((k) => d.push([KW[k].name, KW[k].text]));
    const fx = [].concat(c.fx || [], (c.on && c.on.arrive) || [], (c.on && c.on.last) || []);
    if (c.on && c.on.arrive) d.push(["Arrivée", "Se déclenche quand l'unité entre en jeu."]);
    if (c.on && c.on.last) d.push(["Dernier souffle", "Se déclenche quand l'unité est détruite."]);
    if (fx.some((e) => e.k === "stun")) d.push(["Étourdi", "Ne peut pas attaquer à son prochain assaut (elle défend normalement)."]);
    fx.filter((e) => e.k === "grant" && !(c.kw || []).includes(e.kw)).forEach((e) => d.push([KW[e.kw].name, KW[e.kw].text]));
    if (fx.some((e) => e.k === "raise")) d.push(["Ramener", "La plus récente de vos unités détruites revient sur une ligne libre, avec ses PV de départ."]);
    return d.filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i);
  }

  /* ───────── Fenêtre (feuille) ───────── */
  function openSheet(html, cls) { const s = $("#sheet"); s.innerHTML = `<div class="sheet-box ${cls || ""}">${html}</div>`; s.hidden = false; }
  function closeSheet() { $("#sheet").hidden = true; $("#sheet").innerHTML = ""; A.node = null; }
  Object.assign(UI, { openSheet, closeSheet });

  // ctx : { hand: index } | { unit: {side,line} } | undefined
  function showCard(id, ctx) {
    const c = card(id), fac = F[c.f], g = A.g;
    let u = null, actions = "", why = "", opts = {}, status = [];
    if (ctx && ctx.unit && g) { u = g.p[ctx.unit.side].board[ctx.unit.line]; if (u) opts = { atk: u.atk, hp: u.hp }; }
    if (u) {
      if (u.shield) status.push("Égide active"); if (u.stun) status.push("Étourdie"); if (u.hold) status.push("En retrait");
      if (u.fresh) status.push("Arrivée ce tour : n'attaquera qu'au prochain");
      if (u.hp < u.max) status.push(`PV ${u.hp}/${u.max}`);
    }
    if (ctx && ctx.hand != null && g) {
      const chk = E.canPlay(g, A.me, ctx.hand);
      why = chk.ok ? "" : (g.active !== A.me ? "Ce n'est pas votre tour" : chk.why);
      actions = `<button class="btn gold" data-act="play" data-i="${ctx.hand}" ${chk.ok && !A.busy ? "" : "disabled"}>Jouer (${c.c} Aether)</button>`;
    } else if (u && g && ctx.unit.side === A.me && g.active === A.me && !A.busy && !u.fresh && !u.stun) {
      actions = `<button class="btn" data-act="hold" data-line="${ctx.unit.line}">${u.hold ? "Remettre à l'attaque" : "Garder en retrait"}</button>`;
    }
    const locked = !P.owned[c.id] && !c.token;
    openSheet(`${cardHTML(c, Object.assign({ locked }, opts))}
      <div class="sheet-info">
        <h3>${esc(c.name)}</h3>
        <div class="muted">${fac.sym} ${fac.name} · ${CA.RARITIES[c.r || "C"].name} · ${c.type === "unit" ? "Unité" : "Sort"}</div>
        ${locked ? `<p class="lockline">🔒 À débloquer : gagnez des niveaux, terminez la campagne et les quêtes pour la choisir comme récompense.</p>` : ""}
        ${status.length ? `<p><b>${status.join(" · ")}</b></p>` : ""}
        ${defsFor(c).map((d) => `<div class="kwdef"><b>${d[0]}</b> — ${esc(d[1])}</div>`).join("")}
        <p class="lore">« ${esc(c.lore)} »</p>
      </div>
      <div class="sheet-actions">${why ? `<span class="sheet-why">${why}</span>` : ""}${actions}<button class="btn ghost" data-act="close">Fermer</button></div>`);
  }
  UI.showCard = showCard;

  /* ───────── Decks du joueur ───────── */
  function myDecks() {
    const out = CA.FACTION_ORDER.map((f) => ({ key: "preset:" + f, name: "Deck " + F[f].short, sub: F[f].keys, f, ids: E.autoDeck(f, P.owned), custom: false }));
    P.decks.forEach((d) => { if (!E.deckProblems(d.ids).length && d.ids.every((id) => P.owned[id])) out.push({ key: "deck:" + d.id, name: d.name, sub: "Votre deck", f: card(d.ids[0]).f, ids: d.ids, custom: true }); });
    return out;
  }
  UI.myDecks = myDecks;
  function currentDeck() { const l = myDecks(); return l.find((d) => d.key === P.pick) || l[0]; }
  UI.currentDeck = currentDeck;
  const pickRow = (key, on, sym, col, name, sub, act, extra) =>
    `<button class="pick ${on ? "on" : ""}" data-act="${act}" data-key="${key}"><span class="sym" style="background:${col}">${sym}</span><span><b>${esc(name)}</b><small>${esc(sub)}</small></span>${extra || ""}</button>`;
  function deckPicker() {
    const decks = myDecks();
    if (!decks.find((d) => d.key === P.pick)) P.pick = decks[0].key;
    return `<div class="pick-list compact">${decks.map((d) => pickRow(d.key, d.key === P.pick, F[d.f].sym, F[d.f].color, d.name, d.sub, "pick-deck")).join("")}</div>`;
  }

  /* ───────── Récompenses : choisir 1 carte parmi 3 ───────── */
  function openPick() {
    const offer = Pr.openOffer(P);
    persist();
    if (!offer) { closeSheet(); render(); return; }
    Au.play("reward");
    openSheet(`<div class="pick-offer"><h2>🎁 Choisissez une carte</h2><p class="muted">Elle rejoint votre collection pour de bon. Il vous reste ${P.picks} choix.</p>
      <div class="offer-grid">${offer.map((id, i) => `<button class="offer animate__animated animate__flipInY" style="animation-delay:${i * 0.15}s" data-act="take" data-id="${id}">${cardHTML(card(id))}</button>`).join("")}</div>
      <div class="sheet-actions"><button class="btn ghost" data-act="close">Plus tard</button></div></div>`, "wide");
  }
  UI.openPick = openPick;

  /* ───────── Écran : Jouer (accueil) ───────── */
  function levelCard() {
    const need = M.xpForLevel(P.lvl), days = Pr.streakDays(P);
    return `<div class="panel level-card">
      <div class="lvl-row"><div class="lvl-badge">${P.lvl}</div>
        <div class="grow"><b>Archiviste · niveau ${P.lvl}</b>${bar(P.xp / need)}<small class="muted">${P.xp} / ${need} XP · chaque niveau offre une carte</small></div>
        <div class="streak ${days ? "on" : ""}" title="Jours consécutifs">🔥<b>${days}</b></div></div>
      ${P.picks ? `<button class="btn gold block pulse" data-act="open-pick">🎁 ${P.picks} carte${P.picks > 1 ? "s" : ""} à choisir</button>` : ""}
    </div>`;
  }
  function renderPlay() {
    Pr.refreshDaily(P);
    const next = Pr.nextNode(P), ch = Pr.dailyChallenge(), dailyDone = P.daily.won;
    const quests = P.daily.quests.map((q) => {
      const d = M.QUESTS.find((x) => x.id === q.id);
      return `<div class="quest ${q.done ? "done" : ""}"><span>${q.done ? "✓ " : ""}${esc(d.text)}</span>${bar(q.prog / d.goal, "sm")}<small>${q.prog}/${d.goal}</small></div>`;
    }).join("");
    const nextName = next ? `${M.CHAPTERS[next.chapter].title} · ${next.title}` : "";
    $("#screen-play").innerHTML = `
      <div class="hero"><h1>CODEX ARCANUM</h1><p>${esc(CA.LORE.tagline)}</p></div>
      ${levelCard()}
      <div class="home-grid">
        <div class="panel cta">
          <h2>🗺 La Voie du Codex</h2>
          ${next ? `<p class="muted">Chapitre ${next.chapter + 1} · ${esc(M.CHAPTERS[next.chapter].seal)}</p><button class="btn gold block big" data-act="node" data-key="${next.key}">▶ ${esc(next.title)}</button><p class="muted small">${M.NODES.filter((n) => P.campaign[n.key]).length}/15 duels terminés</p>`
                 : `<p>Les cinq Sceaux sont réunis. La campagne est terminée : il reste le défi du jour et les parties libres.</p>`}
        </div>
        <div class="panel daily">
          <h2>⚡ Défi du jour</h2>
          <p><b>${esc(ch.mod.name)}</b> — ${esc(ch.mod.text)}</p>
          <p class="muted">Adversaire : ${F[ch.faction].sym} ${F[ch.faction].name}. ${dailyDone ? "" : "Première victoire du jour : 60 XP et une carte à choisir."}</p>
          <button class="btn ${dailyDone ? "ghost" : ""} block" data-act="daily">${dailyDone ? "✓ Relevé aujourd'hui · rejouer" : "Relever le défi"}</button>
        </div>
        <div class="panel quests"><h2>📜 Quêtes du jour</h2>${quests}<p class="muted small">${P.daily.claimed ? "✓ Les trois quêtes sont terminées : carte gagnée." : "Terminez les trois pour gagner une carte à choisir."}</p></div>
        <div class="panel quick">
          <h2>⚔ Partie libre</h2>
          <h3>Votre deck</h3>${deckPicker()}
          <h3>Adversaire</h3>
          <div class="row opp-row">${["random"].concat(CA.FACTION_ORDER).map((f) => `<button class="chip ${P.opp === f ? "on" : ""}" data-act="pick-opp" data-key="${f}">${f === "random" ? "? Hasard" : F[f].sym + " " + F[f].short}</button>`).join("")}</div>
          <h3>Niveau</h3>
          <div class="row">${M.SKILL_NAMES.map((n, i) => `<button class="chip ${P.diff === i ? "on" : ""}" data-act="pick-diff" data-key="${i}">${n}</button>`).join("")}<small class="muted">Plus c'est dur, plus l'XP grimpe.</small></div>
          <button class="btn block" style="margin-top:12px" data-act="quick">⚔ Lancer la partie</button>
        </div>
      </div>`;
  }

  /* ───────── Écran : Campagne ───────── */
  function renderCampaign() {
    const done = M.NODES.filter((n) => P.campaign[n.key]).length;
    $("#screen-campaign").innerHTML = `<h2>🗺 La Voie du Codex</h2><p class="lead">Cinq Sceaux, cinq puissances, quinze duels. Chaque première victoire offre une carte à choisir. ${done}/15</p>` +
      M.CHAPTERS.map((ch, ci) => {
        const nodes = M.NODES.filter((n) => n.chapter === ci), open = Pr.nodeUnlocked(P, nodes[0].key), cleared = nodes.every((n) => P.campaign[n.key]);
        return `<div class="panel chapter ${open ? "" : "closed"}" style="--fc:${F[ch.f].color};--ft:${F[ch.f].tint};--fd:${F[ch.f].dark}">
          <div class="ch-head"><span class="ch-sym">${F[ch.f].sym}</span><div><h3>Chapitre ${ci + 1} · ${esc(ch.title)}</h3><small class="muted">${esc(ch.seal)} ${cleared ? "· ✓ obtenu" : ""}</small></div></div>
          ${open ? `<p class="small">${esc(cleared ? ch.outro : ch.intro)}</p>` : `<p class="small muted">🔒 Terminez le chapitre précédent.</p>`}
          <div class="nodes">${nodes.map((n) => {
            const st = P.campaign[n.key] ? "done" : Pr.nodeUnlocked(P, n.key) ? "next" : "lock";
            return `<button class="node ${st} ${n.boss ? "boss" : ""}" ${st === "lock" ? "disabled" : ""} data-act="node" data-key="${n.key}"><span class="n-ico">${st === "done" ? "✓" : st === "lock" ? "🔒" : n.boss ? "👑" : "⚔"}</span><b>${esc(n.title)}</b><small>${M.SKILL_NAMES[n.skill]}${n.cit > 20 ? " · " + n.cit + " PV" : ""}</small></button>`;
          }).join("")}</div></div>`;
      }).join("");
  }

  function openNode(key) {
    const n = M.NODES.find((x) => x.key === key); if (!n) return;
    A.node = key;
    const ch = M.CHAPTERS[n.chapter], cleared = !!P.campaign[key];
    openSheet(`<div class="node-sheet" style="--fc:${F[n.faction].color}">
      <h2>${F[n.faction].sym} ${esc(n.title)}</h2>
      <p class="muted">Chapitre ${n.chapter + 1} · ${esc(ch.title)}</p>
      <p class="story">${esc(n.story)}</p>
      <div class="row"><span class="chip">${F[n.faction].name}</span><span class="chip">${M.SKILL_NAMES[n.skill]}</span><span class="chip">Citadelle ${n.cit} PV</span><span class="chip">${cleared ? "Terminé" : "Récompense : carte + " + n.xp + " XP"}</span></div>
      <h3>Votre deck</h3>${deckPicker()}
      <div class="sheet-actions"><button class="btn ghost" data-act="close">Retour</button><button class="btn gold" data-act="start-node">⚔ Combattre</button></div></div>`, "wide");
  }

  /* ───────── Écran : Cartes ───────── */
  function filtered(f, onlyOwned) {
    const q = f.q.trim().toLowerCase();
    return CA.CARDS.filter((c) => (!f.f || c.f === f.f) && (!f.t || c.type === f.t) && (!f.c || (f.c === 8 ? c.c >= 8 : c.c === f.c)) &&
      (!onlyOwned || P.owned[c.id]) && (!f.lock || !P.owned[c.id]) &&
      (!q || c.name.toLowerCase().includes(q) || CA.cardText(c).toLowerCase().includes(q)));
  }
  function chipsHTML(kind, f) {
    const chip = (key, val, label, on) => `<button class="chip ${on ? "on" : ""}" data-act="flt" data-kind="${kind}" data-key="${key}" data-val="${val}">${label}</button>`;
    return chip("f", "", "Toutes", !f.f) + CA.FACTION_ORDER.map((x) => chip("f", x, F[x].sym + " " + F[x].short, f.f === x)).join("") +
      '<span class="sep"></span>' + chip("t", "", "Tous types", !f.t) + chip("t", "unit", "Unités", f.t === "unit") + chip("t", "spell", "Sorts", f.t === "spell") +
      '<span class="sep"></span>' + chip("c", 0, "Coût", !f.c) + [1, 2, 3, 4, 5, 6, 7, 8].map((n) => chip("c", n, n === 8 ? "8+" : n, f.c === n)).join("") +
      (kind === "fc" ? '<span class="sep"></span>' + chip("lock", "1", "🔒 À débloquer", f.lock) : "");
  }
  function filterShell(kind, f) {
    return `<div class="filters"><input type="search" placeholder="Chercher une carte…" value="${esc(f.q)}" data-search="${kind}"></div><div class="filters" id="chips-${kind}">${chipsHTML(kind, f)}</div>`;
  }
  function renderCards() {
    $("#screen-cards").innerHTML = `<h2>Collection · ${Pr.ownedCount(P)}/100</h2><p class="lead">Les cartes grisées se débloquent en jouant.</p>${filterShell("fc", A.fc)}<div class="grid" id="grid-cards"></div>`;
    fillCards();
  }
  function fillCards() {
    const list = filtered(A.fc);
    $("#grid-cards").innerHTML = list.length ? list.map((c) => `<button data-act="info" data-id="${c.id}">${cardHTML(c, { dim: !P.owned[c.id], locked: !P.owned[c.id] })}</button>`).join("") : '<p class="muted">Aucune carte.</p>';
  }

  /* ───────── Écran : Decks ───────── */
  const uid = () => Math.random().toString(36).slice(2, 9);
  const deckCount = (ids) => { const m = {}; ids.forEach((i) => (m[i] = (m[i] || 0) + 1)); return m; };
  // Code de partage : "CA1" + 2 caractères hexadécimaux par carte (position dans la liste des cartes)
  const deckCode = (ids) => "CA1" + ids.map((id) => CA.CARDS.findIndex((c) => c.id === id).toString(16).padStart(2, "0")).join("");
  function parseCode(txt) {
    const t = (txt || "").trim().replace(/\s+/g, "");
    if (!/^CA1[0-9a-fA-F]+$/.test(t) || (t.length - 3) % 2) return null;
    const ids = [];
    for (let i = 3; i < t.length; i += 2) { const c = CA.CARDS[parseInt(t.slice(i, i + 2), 16)]; if (!c) return null; ids.push(c.id); }
    return ids;
  }
  function renderDecks() {
    const saved = P.decks.map((d) => {
      const bad = E.deckProblems(d.ids), miss = d.ids.filter((id) => !P.owned[id]).length;
      return `<div class="pick ${A.edit && A.edit.id === d.id ? "on" : ""}"><button class="grow-btn" data-act="edit-deck" data-id="${d.id}"><b>${esc(d.name)}</b><small>${d.ids.length}/30 · ${bad.length ? "incomplet" : miss ? miss + " carte(s) à débloquer" : "prêt à jouer"}</small></button><button class="btn ghost small" data-act="del-deck" data-id="${d.id}">Supprimer</button></div>`;
    }).join("");
    let html = `<h2>Vos decks</h2><p class="lead">30 cartes, 2 exemplaires maximum (1 pour une Légendaire), 2 factions maximum.</p>
      <div class="saved">${saved || '<p class="muted">Aucun deck pour l\'instant. Les decks prêts à jouer sont disponibles dans l\'accueil.</p>'}</div>
      <div class="row" style="margin-bottom:12px"><button class="btn" data-act="new-deck">+ Nouveau deck</button>
      <span class="muted">partir d'un deck prêt :</span>${CA.FACTION_ORDER.map((f) => `<button class="chip" data-act="copy-preset" data-f="${f}">${F[f].sym} ${F[f].short}</button>`).join("")}</div>
      <div class="row" style="margin-bottom:18px"><input class="code-in" id="code-in" placeholder="Coller un code de deck (CA1…)" aria-label="Code de deck"><button class="btn ghost small" data-act="import-deck">Importer</button></div>`;
    if (A.edit) html += `<div class="deck-layout"><div><h2>Ajouter des cartes</h2>${filterShell("fd", A.fd)}<div class="grid" id="grid-deck"></div></div><div class="deck-panel panel" id="deck-panel"></div></div>`;
    $("#screen-decks").innerHTML = html;
    if (A.edit) { fillDeckGrid(); fillDeckPanel(); }
  }
  function fillDeckGrid() {
    const cnt = deckCount(A.edit.ids), list = filtered(A.fd, true);
    $("#grid-deck").innerHTML = list.map((c) => {
      const n = cnt[c.id] || 0, max = CA.RARITIES[c.r].max;
      return `<button data-act="add" data-id="${c.id}">${cardHTML(c, { count: n, dim: n >= max })}<span class="info-btn" data-act="info" data-id="${c.id}">i</span></button>`;
    }).join("");
  }
  function fillDeckPanel() {
    const d = A.edit, cnt = deckCount(d.ids), errs = E.deckProblems(d.ids).filter((x) => !x.startsWith("Le deck doit"));
    const miss = d.ids.filter((id) => !P.owned[id]).length;
    const curve = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => d.ids.filter((id) => (n === 8 ? card(id).c >= 8 : card(id).c === n)).length), top = Math.max(4, ...curve);
    const rows = Object.keys(cnt).sort((a, b) => card(a).c - card(b).c || card(a).name.localeCompare(card(b).name, "fr")).map((id) => {
      const c = card(id);
      return `<button class="deck-row" style="--fc:${F[c.f].color}" data-act="remove" data-id="${id}"><span class="cost">${c.c}</span><span>${esc(c.name)}</span><span class="n">×${cnt[id]} ✕</span></button>`;
    }).join("");
    const units = d.ids.filter((id) => card(id).type === "unit").length;
    $("#deck-panel").innerHTML = `<div class="deck-head"><input value="${esc(d.name)}" maxlength="28" data-name aria-label="Nom du deck"><span class="count ${d.ids.length === 30 ? "ok" : ""}">${d.ids.length}/30</span></div>
      <div class="muted">${units} unités · ${d.ids.length - units} sorts</div>
      <div class="curve">${curve.map((n, i) => `<div><i style="height:${Math.round((n / top) * 40)}px"></i>${i === 7 ? "8+" : i + 1}</div>`).join("")}</div>
      ${errs.length ? `<div class="errs">${errs.map(esc).join("<br>")}</div>` : ""}${miss ? `<div class="errs">${miss} carte(s) pas encore débloquée(s).</div>` : ""}
      <div class="row" style="margin:8px 0"><button class="btn small" data-act="save-deck">Enregistrer</button><button class="btn ghost small" data-act="share-deck">Partager</button><button class="btn ghost small" data-act="clear-deck">Vider</button><button class="btn ghost small" data-act="list-toggle">${A.listOpen ? "Masquer" : "Liste"}</button></div>
      ${A.listOpen ? `<div class="deck-rows">${rows || '<p class="muted">Touchez des cartes pour les ajouter.</p>'}</div>` : ""}`;
  }

  /* ───────── Écran : Profil ───────── */
  function renderProfile() {
    const s = P.stats, rate = s.g ? Math.round((100 * s.w) / s.g) : 0, need = M.xpForLevel(P.lvl);
    const owned = (f) => CA.CARDS.filter((c) => c.f === f && P.owned[c.id]).length;
    $("#screen-profile").innerHTML = `
      <h2>Profil</h2>
      <div class="panel level-card"><div class="lvl-row"><div class="lvl-badge">${P.lvl}</div><div class="grow"><b>Archiviste · niveau ${P.lvl}</b>${bar(P.xp / need)}<small class="muted">${P.xp} / ${need} XP</small></div><div class="streak ${Pr.streakDays(P) ? "on" : ""}">🔥<b>${Pr.streakDays(P)}</b></div></div></div>
      <div class="stat-grid">
        <div class="stat"><b>${s.g}</b><small>parties</small></div><div class="stat"><b>${s.w}</b><small>victoires</small></div><div class="stat"><b>${rate} %</b><small>de victoires</small></div>
        <div class="stat"><b>${s.bestRun}</b><small>meilleure série</small></div><div class="stat"><b>${P.streak.best}</b><small>jours d'affilée (record)</small></div><div class="stat"><b>${Pr.ownedCount(P)}</b><small>cartes sur 100</small></div>
      </div>
      <h2>Collection</h2>
      <div class="panel">${CA.FACTION_ORDER.map((f) => `<div class="coll-row"><span>${F[f].sym} ${F[f].short}</span>${bar(owned(f) / 20, "sm")}<small>${owned(f)}/20</small></div>`).join("")}</div>
      <h2>Succès · ${Object.keys(P.ach).length}/${M.ACH.length}</h2>
      <div class="ach-grid">${M.ACH.map((a) => `<div class="ach ${P.ach[a.id] ? "got" : ""}"><span>${P.ach[a.id] ? "🏆" : "🔒"}</span><div><b>${esc(a.name)}</b><small>${esc(a.text)}</small></div></div>`).join("")}</div>
      <h2>Réglages</h2>
      <div class="panel settings">
        <button class="set" data-act="set" data-key="sound"><span>Sons</span><b>${P.settings.sound ? "Activés" : "Coupés"}</b></button>
        <button class="set" data-act="set" data-key="haptic"><span>Vibrations</span><b>${P.settings.haptic ? "Activées" : "Coupées"}</b></button>
        <button class="set" data-act="set" data-key="speed"><span>Vitesse des animations</span><b>${P.settings.speed === 1 ? "Normale" : "Rapide"}</b></button>
        <button class="set" data-act="reset-tips"><span>Revoir les conseils de combat</span><b>Réactiver</b></button>
        <button class="set danger" data-act="reset-all"><span>Effacer toute la progression</span><b>Effacer…</b></button>
      </div>`;
  }

  /* ───────── Écran : Règles ───────── */
  function renderRules() {
    $("#screen-rules").innerHTML = `<div class="rules">
      <h2>Règles du jeu</h2>
      <p class="lead">Deux joueurs, une Citadelle chacun, quatre lignes de bataille.</p>
      <div class="box"><b>But.</b> Faire tomber la Citadelle adverse de 20 PV à 0.</div>
      <h2>Mise en place</h2>
      <ul><li>Chaque joueur a un deck de 30 cartes et une Citadelle de 20 PV.</li>
      <li>Le premier joueur est tiré au sort et pioche 4 cartes. Le second en pioche 5 et démarre son premier tour avec 1 Aether de plus.</li>
      <li>Avant de jouer, vous pouvez <b>remplacer</b> les cartes de votre main que vous ne voulez pas (mulligan, une seule fois).</li>
      <li>Le tout premier tour de la partie se joue sans pioche.</li></ul>
      <h2>Le plateau</h2>
      <p>Chaque joueur dispose de <b>4 lignes</b>. Une unité posée sur la ligne <i>n</i> affronte l'unité adverse de la ligne <i>n</i>. Une seule unité par ligne.</p>
      <h2>L'Aether</h2>
      <p>À votre <i>n</i>-ième tour, vous disposez de <b>n Aether</b> (maximum 10). Il se recharge entièrement chaque tour et ne se conserve pas. Chaque carte coûte son nombre d'Aether (le chiffre dans le rond).</p>
      <h2>Un tour de jeu</h2>
      <ol>
        <li><b>Éveil</b> — Aether rechargé, pioche d'1 carte (main de 8 maximum), les unités avec <i>Soutien</i> soignent.</li>
        <li><b>Actions</b> — jouez autant de cartes que votre Aether le permet. Une <b>unité</b> se pose sur une ligne libre. Un <b>sort</b> produit son effet puis part au cimetière.</li>
        <li><b>Retrait</b> (facultatif) — touchez une de vos unités puis « Garder en retrait » : elle n'attaquera pas ce tour-ci.</li>
        <li><b>Assaut</b> — appuyez sur « Assaut ». De la ligne 1 à la ligne 4, chacune de vos unités prêtes attaque. Le tour passe ensuite à l'adversaire.</li>
      </ol>
      <p>Une unité est <b>prête</b> si elle n'est pas arrivée ce tour (sauf avec <i>Charge</i>), n'est pas étourdie et n'est pas en retrait. Les unités fatiguées sont grisées.</p>
      <h2>Le combat</h2>
      <ul><li>Si la ligne en face est <b>vide</b>, l'unité inflige son Attaque à la Citadelle.</li>
      <li>Sinon les deux unités se frappent <b>en même temps</b> : chacune inflige son Attaque à l'autre.</li>
      <li>Les dégâts restent jusqu'à un soin. À 0 PV, l'unité est détruite (cimetière).</li>
      <li>Quand vous posez une unité, une étiquette indique l'issue probable du duel face à l'unité en face.</li></ul>
      <h2>Fin de partie</h2>
      <ul><li>Citadelle à 0 PV ou moins : défaite. Chutes simultanées : le joueur dont c'est le tour gagne.</li>
      <li><b>Épuisement</b> : piocher dans un deck vide inflige ${E.FATIGUE} dégâts à votre Citadelle.</li></ul>
      <h2>Mots-clés</h2>
      ${CA.KW_ORDER.map((k) => `<div class="kwrow"><span class="tag">${KW[k].name}</span><span>${esc(KW[k].text)}</span></div>`).join("")}
      <div class="kwrow"><span class="tag">Arrivée</span><span>Effet quand l'unité entre en jeu. « En face » désigne l'unité ennemie de la même ligne.</span></div>
      <div class="kwrow"><span class="tag">Dernier souffle</span><span>Effet quand l'unité est détruite.</span></div>
      <div class="kwrow"><span class="tag">Étourdi</span><span>L'unité ne peut pas attaquer à son prochain assaut. Elle défend normalement.</span></div>
      <h2>Progression</h2>
      <ul><li>Vous commencez avec 75 cartes (toutes les Communes et Rares, plus une Épique par faction). Les 25 autres, Épiques et Légendaires, se débloquent.</li>
      <li>Chaque <b>niveau</b>, chaque <b>première victoire de campagne</b>, le <b>défi du jour</b> et les <b>trois quêtes du jour</b> offrent le choix d'une carte parmi trois.</li>
      <li>Jouer chaque jour construit une <b>série</b> : +10 % d'XP par jour consécutif (jusqu'à +50 %).</li>
      <li>La rareté n'ajoute aucune puissance à coût égal : une carte plus rare est plus spectaculaire, pas meilleure.</li></ul>
      <h2>Construire un deck</h2>
      <ul><li>Exactement <b>30 cartes</b>, <b>2 factions maximum</b>, <b>2 exemplaires</b> par carte (<b>1</b> pour les Légendaires).</li></ul>
      <h2>Les cinq factions</h2>
      ${CA.FACTION_ORDER.map((f) => `<div class="kwrow"><span class="tag" style="color:${F[f].color}">${F[f].sym} ${F[f].short}</span><span><b>${F[f].motto}.</b> ${esc(F[f].doctrine)}</span></div>`).join("")}
    </div>`;
  }

  /* ───────── Navigation ───────── */
  const RENDER = { play: renderPlay, campaign: renderCampaign, cards: renderCards, decks: renderDecks, profile: renderProfile, rules: renderRules };
  function render() { RENDER[A.screen](); }
  function go(screen) {
    A.screen = screen;
    document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.nav === screen));
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === "screen-" + screen));
    render(); updateHeader();
    window.scrollTo(0, 0);
  }
  function updateHeader() {
    $("#hd-lvl").textContent = P.lvl;
    $("#hd-streak").textContent = Pr.streakDays(P);
    $("#hd-picks").hidden = !P.picks; $("#hd-picks").textContent = "🎁 " + P.picks;
    $("#hd-sound").textContent = P.settings.sound ? "🔊" : "🔇";
  }
  Object.assign(UI, { go, render, updateHeader, openNode, filtered });

  /* ───────── Événements ───────── */
  const BATTLE_ACTS = ["hand", "play", "cancel", "slot", "hold", "end", "menu", "quit", "mull", "mull-ok", "tip-ok", "result-next", "result-again", "result-pick", "result-quit"];
  document.addEventListener("click", (ev) => {
    Au.unlock();
    const el = ev.target.closest("[data-act]");
    if (!el) {
      if (ev.target.id === "sheet") closeSheet();
      const nav = ev.target.closest("[data-nav]");
      if (nav) { Au.play("click"); closeSheet(); go(nav.dataset.nav); }
      return;
    }
    const act = el.dataset.act, d = el.dataset;
    if (BATTLE_ACTS.includes(act)) { if (CA.Battle) CA.Battle.handle(act, d); return; }
    if (act !== "add" && act !== "remove") Au.play("click");
    switch (act) {
      case "pick-deck": P.pick = d.key; persist(); if (A.node) openNode(A.node); else render(); break;
      case "pick-opp": P.opp = d.key; persist(); render(); break;
      case "pick-diff": P.diff = parseInt(d.key, 10); persist(); render(); break;
      case "quick": CA.Battle.startQuick(); break;
      case "daily": CA.Battle.startDaily(); break;
      case "node": openNode(d.key); break;
      case "start-node": { const key = A.node; closeSheet(); CA.Battle.startNode(key); break; }
      case "open-pick": openPick(); break;
      case "take": {
        const c = card(d.id);
        if (Pr.takeOffer(P, d.id)) { persist(); Au.play("level"); toast(`${c.name} ajoutée à votre collection`); updateHeader(); if (P.picks) openPick(); else { closeSheet(); render(); } }
        break;
      }
      case "info": showCard(d.id); break;
      case "close": closeSheet(); break;
      case "flt": {
        const f = d.kind === "fc" ? A.fc : A.fd;
        if (d.key === "lock") f.lock = !f.lock; else f[d.key] = d.key === "c" ? parseInt(d.val, 10) : d.val;
        $("#chips-" + d.kind).innerHTML = chipsHTML(d.kind, f);
        d.kind === "fc" ? fillCards() : fillDeckGrid();
        break;
      }
      /* — decks — */
      case "new-deck": A.edit = { id: uid(), name: "Nouveau deck", ids: [] }; renderDecks(); break;
      case "copy-preset": A.edit = { id: uid(), name: "Deck " + F[d.f].short, ids: E.autoDeck(d.f, P.owned) }; renderDecks(); break;
      case "edit-deck": { const x = P.decks.find((k) => k.id === d.id); if (x) { A.edit = { id: x.id, name: x.name, ids: x.ids.slice() }; renderDecks(); } break; }
      case "del-deck": P.decks = P.decks.filter((k) => k.id !== d.id); if (A.edit && A.edit.id === d.id) A.edit = null; persist(); renderDecks(); break;
      case "add": {
        const c = card(d.id), cnt = deckCount(A.edit.ids)[d.id] || 0, ids = A.edit.ids, max = CA.RARITIES[c.r].max;
        if (ids.length >= 30) return toast("Le deck est complet (30 cartes)");
        if (cnt >= max) return toast(`${c.name} : ${max} exemplaire${max > 1 ? "s" : ""} maximum`);
        const facs = new Set(ids.map((i) => card(i).f)); facs.add(c.f);
        if (facs.size > 2) return toast("2 factions maximum par deck");
        ids.push(d.id); Au.play("click"); fillDeckGrid(); fillDeckPanel(); break;
      }
      case "remove": { const i = A.edit.ids.indexOf(d.id); if (i >= 0) A.edit.ids.splice(i, 1); fillDeckGrid(); fillDeckPanel(); break; }
      case "clear-deck": A.edit.ids = []; fillDeckGrid(); fillDeckPanel(); break;
      case "list-toggle": A.listOpen = !A.listOpen; fillDeckPanel(); break;
      case "save-deck": {
        const e = A.edit, i = P.decks.findIndex((k) => k.id === e.id), rec = { id: e.id, name: e.name.trim() || "Mon deck", ids: e.ids.slice() };
        if (i >= 0) P.decks[i] = rec; else P.decks.push(rec);
        persist();
        toast(E.deckProblems(rec.ids).length ? `Enregistré (incomplet : ${rec.ids.length}/30)` : "Deck enregistré, prêt à jouer");
        renderDecks(); break;
      }
      case "share-deck": {
        const code = deckCode(A.edit.ids);
        const done = () => toast("Code du deck copié");
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => window.prompt("Copiez ce code :", code));
        else window.prompt("Copiez ce code :", code);
        break;
      }
      case "import-deck": {
        const ids = parseCode($("#code-in").value);
        if (!ids) return toast("Code invalide");
        A.edit = { id: uid(), name: "Deck importé", ids }; renderDecks();
        const miss = ids.filter((id) => !P.owned[id]).length;
        toast(miss ? `Importé : ${miss} carte(s) pas encore débloquée(s)` : "Deck importé");
        break;
      }
      /* — profil — */
      case "set": {
        if (d.key === "speed") P.settings.speed = P.settings.speed === 1 ? 0.45 : 1; else P.settings[d.key] = !P.settings[d.key];
        Au.on = P.settings.sound; Au.haptic = P.settings.haptic; persist(); renderProfile(); updateHeader(); break;
      }
      case "reset-tips": P.tips = {}; persist(); toast("Les conseils réapparaîtront en combat"); break;
      case "reset-all": if (window.confirm("Effacer toute la progression (cartes débloquées, niveaux, decks) ?")) { Object.assign(P, Pr.reset()); A.edit = null; go("play"); } break;
      case "hd-sound": P.settings.sound = !P.settings.sound; Au.on = P.settings.sound; persist(); updateHeader(); break;
      case "rules": go("rules"); break;
    }
  });
  document.addEventListener("input", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.search;
    if (k) { (k === "fc" ? A.fc : A.fd).q = ev.target.value; k === "fc" ? fillCards() : fillDeckGrid(); }
    if (ev.target.dataset && ev.target.dataset.name !== undefined && A.edit) A.edit.name = ev.target.value;
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { closeSheet(); if (CA.Battle) CA.Battle.escape(); } });

  window.CA.App = { A, P, go };
  go("play");
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => { /* hors-ligne indisponible : sans conséquence */ });
})();
