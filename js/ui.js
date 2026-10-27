/* Codex Arcanum — interface. Aucune règle ici : tout passe par CA.Engine. */
(function () {
  "use strict";
  const CA = window.CA, E = CA.Engine, AI = CA.AI, F = CA.FACTIONS, KW = CA.KEYWORDS;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const card = (id) => CA.BY_ID[id];

  /* ───────── Sauvegarde locale ───────── */
  const KEY = "codex-arcanum-v1";
  let S = { decks: [], w: 0, l: 0, pick: "preset:AURELIA", opp: "random" };
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.decks) S = Object.assign(S, d); } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* idem */ } };

  /* ───────── État de l'application (non sauvegardé) ───────── */
  const A = { screen: "play", g: null, me: 0, mode: null, busy: false, logOpen: false, prev: [20, 20],
              fc: { f: "", t: "", c: 0, q: "" }, fd: { f: "", t: "", c: 0, q: "" }, edit: null, listOpen: window.innerWidth >= 900 };

  /* ───────── Cartes en HTML ───────── */
  const KW_ICON = { charge: "»", vif: "✧", garde: "▣", percee: "➶", rage: "♨", soutien: "✚" };

  function cardHTML(c, o) {
    o = o || {};
    const unit = c.type === "unit", fac = F[c.f];
    const kws = (c.kw || []).map((k) => `<span class="kw">${KW[k].name}</span>`).join("");
    const lines = CA.cardLines(c).map((l) => `<p>${l.label ? `<i>${l.label} :</i> ` : ""}${esc(l.text)}</p>`).join("");
    const atk = o.atk != null ? o.atk : c.atk, hp = o.hp != null ? o.hp : c.hp;
    return `<div class="card f-${c.f} r-${c.r || "C"} ${unit ? "unit" : "spell"} ${o.mini ? "mini" : ""} ${o.dim ? "dim" : ""}" style="--rc:${CA.RARITIES[c.r || "C"].color}">
      <div class="c-cost">${c.c}</div>
      <div class="c-art"><span class="c-emoji">${c.e}</span><span class="c-sym">${fac.sym}</span><span class="c-rar"></span></div>
      <div class="c-name">${esc(c.name)}</div>
      <div class="c-type">${unit ? "Unité" : "Sort"} · ${fac.short}</div>
      <div class="c-text">${kws ? `<div class="c-kws">${kws}</div>` : ""}${lines}</div>
      ${unit ? `<div class="c-stats"><b class="atk">${atk}</b><b class="hp">${hp}</b></div>` : `<div class="c-stats"></div>`}
      ${o.count ? `<div class="count-badge">×${o.count}</div>` : ""}
    </div>`;
  }

  function defsFor(c) {
    const d = [];
    (c.kw || []).forEach((k) => d.push([KW[k].name, KW[k].text]));
    const fx = [].concat(c.fx || [], (c.on && c.on.arrive) || [], (c.on && c.on.last) || []);
    if (c.on && c.on.arrive) d.push(["Arrivée", "Se déclenche quand l'unité entre en jeu."]);
    if (c.on && c.on.last) d.push(["Dernier souffle", "Se déclenche quand l'unité est détruite."]);
    if (fx.some((e) => e.k === "stun")) d.push(["Étourdi", "Ne peut pas attaquer à son prochain assaut (elle défend normalement)."]);
    if (fx.some((e) => e.k === "grant" && e.kw !== "egide" && !(c.kw || []).includes(e.kw))) fx.filter((e) => e.k === "grant" && e.kw !== "egide").forEach((e) => d.push([KW[e.kw].name, KW[e.kw].text]));
    if (fx.some((e) => e.k === "grant" && e.kw === "egide") && !(c.kw || []).includes("egide")) d.push(["Égide", KW.egide.text]);
    if (fx.some((e) => e.k === "raise")) d.push(["Ramener", "Les unités détruites sont dans votre cimetière ; la plus récente revient en premier, sur une ligne libre, avec ses PV de départ."]);
    return d.filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i);
  }

  /* ───────── Fenêtre de détail ───────── */
  function openSheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="sheet-box" data-keep>${html}</div>`; s.hidden = false; }
  function closeSheet() { $("#sheet").hidden = true; $("#sheet").innerHTML = ""; }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 1800); }

  // ctx : { hand: index } | { unit: {side,line} } | undefined
  function showCard(id, ctx) {
    const c = card(id), fac = F[c.f];
    let u = null, actions = "", why = "", opts = {};
    if (ctx && ctx.unit) { u = A.g.p[ctx.unit.side].board[ctx.unit.line]; if (u) opts = { atk: u.atk, hp: u.hp }; }
    const status = [];
    if (u) {
      if (u.shield) status.push("Égide active"); if (u.stun) status.push("Étourdie"); if (u.hold) status.push("En retrait");
      if (u.fresh) status.push("Arrivée ce tour : ne peut pas encore attaquer");
      if (u.hp < u.max) status.push(`PV ${u.hp}/${u.max}`);
    }
    if (ctx && ctx.hand != null) {
      const chk = E.canPlay(A.g, A.me, ctx.hand);
      why = chk.ok ? "" : (A.g.active !== A.me ? "Ce n'est pas votre tour" : chk.why);
      actions = `<button class="btn gold" data-act="play" data-i="${ctx.hand}" ${chk.ok && !A.busy ? "" : "disabled"}>Jouer (${c.c} Aether)</button>`;
    } else if (u && ctx.unit.side === A.me && A.g.active === A.me && !A.busy) {
      if (!u.fresh && !u.stun) actions = `<button class="btn" data-act="hold" data-line="${ctx.unit.line}">${u.hold ? "Remettre à l'attaque" : "Garder en retrait"}</button>`;
    }
    openSheet(`${cardHTML(c, opts)}
      <div class="sheet-info">
        <h3>${esc(c.name)}</h3>
        <div class="muted">${fac.sym} ${fac.name} · ${CA.RARITIES[c.r].name} · ${c.type === "unit" ? "Unité" : "Sort"}</div>
        ${status.length ? `<p><b>${status.join(" · ")}</b></p>` : ""}
        ${defsFor(c).map((d) => `<div class="kwdef"><b>${d[0]}</b> — ${esc(d[1])}</div>`).join("")}
        <p class="lore">« ${esc(c.lore)} »</p>
      </div>
      <div class="sheet-actions">${why ? `<span class="sheet-why">${why}</span>` : ""}${actions}<button class="btn ghost" data-act="close">Fermer</button></div>`);
  }

  /* ───────── Écran : Jouer ───────── */
  function myDecks() {
    const out = CA.FACTION_ORDER.map((f) => ({ key: "preset:" + f, name: "Deck " + F[f].short, sub: F[f].keys, f, ids: E.autoDeck(f) }));
    S.decks.forEach((d) => { if (!E.deckProblems(d.ids).length) out.push({ key: "deck:" + d.id, name: d.name, sub: "Votre deck", f: card(d.ids[0]).f, ids: d.ids }); });
    return out;
  }
  function renderPlay() {
    const decks = myDecks();
    if (!decks.find((d) => d.key === S.pick)) S.pick = decks[0].key;
    const pickRow = (key, on, sym, col, name, sub, act) =>
      `<button class="pick ${on ? "on" : ""}" data-act="${act}" data-key="${key}"><span class="sym" style="background:${col}">${sym}</span><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></button>`;
    $("#screen-play").innerHTML = `
      <div class="hero"><h1>CODEX ARCANUM</h1><p>${esc(CA.LORE.world)}</p></div>
      <div class="setup">
        <div class="panel"><h2>Votre deck</h2><div class="pick-list">
          ${decks.map((d) => pickRow(d.key, d.key === S.pick, F[d.f].sym, F[d.f].color, d.name, d.sub, "pick-deck")).join("")}
        </div></div>
        <div class="panel"><h2>Adversaire</h2><div class="pick-list">
          ${pickRow("random", S.opp === "random", "?", "#5d7694", "Au hasard", "Une faction tirée au sort", "pick-opp")}
          ${CA.FACTION_ORDER.map((f) => pickRow(f, S.opp === f, F[f].sym, F[f].color, F[f].name, F[f].motto, "pick-opp")).join("")}
        </div></div>
      </div>
      <div class="row" style="justify-content:center;gap:16px;margin-bottom:22px">
        <button class="btn gold" style="font-size:18px;padding:14px 34px" data-act="start">⚔ Lancer la partie</button>
        <span class="stat-line"><span>Victoires : ${S.w}</span><span>Défaites : ${S.l}</span></span>
      </div>
      <h2>Les cinq factions</h2>
      <div class="factions">${CA.FACTION_ORDER.map((f) => `<div class="faction-box" style="--fc:${F[f].color};--ft:${F[f].tint};--fd:${F[f].dark}"><h3>${F[f].sym} ${F[f].name}</h3><p>${esc(F[f].doctrine)}</p><div class="keys">${F[f].keys}</div></div>`).join("")}</div>`;
  }

  /* ───────── Écran : Cartes ───────── */
  function filtered(f) {
    const q = f.q.trim().toLowerCase();
    return CA.CARDS.filter((c) => (!f.f || c.f === f.f) && (!f.t || c.type === f.t) && (!f.c || (f.c === 8 ? c.c >= 8 : c.c === f.c)) &&
      (!q || c.name.toLowerCase().includes(q) || CA.cardText(c).toLowerCase().includes(q)));
  }
  function chipsHTML(kind, f) {
    const chip = (key, val, label, on) => `<button class="chip ${on ? "on" : ""}" data-act="flt" data-kind="${kind}" data-key="${key}" data-val="${val}">${label}</button>`;
    return chip("f", "", "Toutes", !f.f) + CA.FACTION_ORDER.map((x) => chip("f", x, F[x].sym + " " + F[x].short, f.f === x)).join("") +
      '<span class="sep"></span>' + chip("t", "", "Tous types", !f.t) + chip("t", "unit", "Unités", f.t === "unit") + chip("t", "spell", "Sorts", f.t === "spell") +
      '<span class="sep"></span>' + chip("c", 0, "Coût", !f.c) + [1, 2, 3, 4, 5, 6, 7, 8].map((n) => chip("c", n, n === 8 ? "8+" : n, f.c === n)).join("");
  }
  function filterShell(kind, f) {
    return `<div class="filters"><input type="search" placeholder="Chercher une carte…" value="${esc(f.q)}" data-search="${kind}"></div><div class="filters" id="chips-${kind}">${chipsHTML(kind, f)}</div>`;
  }
  function renderCards() {
    $("#screen-cards").innerHTML = `<h2>Toutes les cartes</h2><p class="lead">100 cartes, toutes disponibles. Touchez une carte pour le détail.</p>${filterShell("fc", A.fc)}<div class="grid" id="grid-cards"></div>`;
    fillCards();
  }
  function fillCards() {
    const list = filtered(A.fc);
    $("#grid-cards").innerHTML = list.length ? list.map((c) => `<button data-act="info" data-id="${c.id}">${cardHTML(c)}</button>`).join("") : '<p class="muted">Aucune carte.</p>';
  }

  /* ───────── Écran : Decks ───────── */
  const uid = () => Math.random().toString(36).slice(2, 9);
  function deckCount(ids) { const m = {}; ids.forEach((i) => (m[i] = (m[i] || 0) + 1)); return m; }
  function renderDecks() {
    const root = $("#screen-decks");
    const saved = S.decks.map((d) => {
      const bad = E.deckProblems(d.ids);
      return `<div class="pick ${A.edit && A.edit.id === d.id ? "on" : ""}"><button style="flex:1;text-align:left" data-act="edit-deck" data-id="${d.id}"><b>${esc(d.name)}</b><small>${d.ids.length}/30 · ${bad.length ? "incomplet" : "prêt à jouer"}</small></button><button class="btn ghost small" data-act="del-deck" data-id="${d.id}">Supprimer</button></div>`;
    }).join("");
    let html = `<h2>Vos decks</h2><p class="lead">30 cartes, 2 exemplaires maximum (1 pour une Légendaire), 2 factions maximum.</p>
      <div class="saved">${saved || '<p class="muted">Aucun deck pour l\'instant.</p>'}</div>
      <div class="row" style="margin-bottom:18px"><button class="btn" data-act="new-deck">+ Nouveau deck</button>
      <span class="muted">ou partir d'un deck prêt :</span>${CA.FACTION_ORDER.map((f) => `<button class="chip" data-act="copy-preset" data-f="${f}">${F[f].sym} ${F[f].short}</button>`).join("")}</div>`;
    if (A.edit) {
      html += `<div class="deck-layout"><div><h2>Ajouter des cartes</h2>${filterShell("fd", A.fd)}<div class="grid" id="grid-deck"></div></div><div class="deck-panel panel" id="deck-panel"></div></div>`;
    }
    root.innerHTML = html;
    if (A.edit) { fillDeckGrid(); fillDeckPanel(); }
  }
  function fillDeckGrid() {
    const cnt = deckCount(A.edit.ids), list = filtered(A.fd);
    $("#grid-deck").innerHTML = list.map((c) => {
      const n = cnt[c.id] || 0, max = CA.RARITIES[c.r].max;
      return `<button data-act="add" data-id="${c.id}">${cardHTML(c, { count: n, dim: n >= max })}<span class="info-btn" data-act="info" data-id="${c.id}">i</span></button>`;
    }).join("");
  }
  function fillDeckPanel() {
    const d = A.edit, cnt = deckCount(d.ids), errs = E.deckProblems(d.ids).filter((x) => !x.startsWith("Le deck doit"));
    const curve = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => d.ids.filter((id) => (n === 8 ? card(id).c >= 8 : card(id).c === n)).length);
    const top = Math.max(4, ...curve);
    const rows = Object.keys(cnt).sort((a, b) => card(a).c - card(b).c || card(a).name.localeCompare(card(b).name, "fr")).map((id) => {
      const c = card(id);
      return `<button class="deck-row" style="--fc:${F[c.f].color}" data-act="remove" data-id="${id}"><span class="cost">${c.c}</span><span>${esc(c.name)}</span><span class="n">×${cnt[id]} ✕</span></button>`;
    }).join("");
    const units = d.ids.filter((id) => card(id).type === "unit").length;
    $("#deck-panel").innerHTML = `<div class="deck-head"><input value="${esc(d.name)}" maxlength="28" data-name aria-label="Nom du deck"><span class="count ${d.ids.length === 30 ? "ok" : ""}">${d.ids.length}/30</span></div>
      <div class="muted">${units} unités · ${d.ids.length - units} sorts</div>
      <div class="curve">${curve.map((n, i) => `<div><i style="height:${Math.round((n / top) * 40)}px"></i>${i === 7 ? "8+" : i + 1}</div>`).join("")}</div>
      ${errs.length ? `<div class="errs">${errs.map(esc).join("<br>")}</div>` : ""}
      <div class="row" style="margin:8px 0"><button class="btn small" data-act="save-deck">Enregistrer</button><button class="btn ghost small" data-act="clear-deck">Vider</button><button class="btn ghost small" data-act="list-toggle">${A.listOpen ? "Masquer la liste" : "Voir la liste"}</button></div>
      ${A.listOpen ? `<div class="deck-rows">${rows || '<p class="muted">Touchez des cartes pour les ajouter.</p>'}</div>` : ""}`;
  }

  /* ───────── Écran : Règles ───────── */
  function renderRules() {
    $("#screen-rules").innerHTML = `<div class="rules">
      <h2>Règles du jeu</h2>
      <p class="lead">Deux joueurs, une Citadelle chacun, quatre lignes de bataille. Tout tient sur une page.</p>
      <div class="box"><b>But.</b> Faire tomber la Citadelle adverse de 20 PV à 0.</div>

      <h2>Mise en place</h2>
      <ul><li>Chaque joueur a un deck de 30 cartes et une Citadelle de 20 PV.</li>
      <li>Le premier joueur est tiré au sort et pioche 4 cartes. Le second en pioche 5 et démarre son premier tour avec 1 Aether de plus.</li>
      <li>Le tout premier tour de la partie se joue sans pioche. Il n'y a pas de mulligan.</li></ul>

      <h2>Le plateau</h2>
      <p>Chaque joueur dispose de <b>4 lignes</b>. Une unité posée sur la ligne <i>n</i> affronte l'unité adverse de la ligne <i>n</i>. Il n'y a jamais plus d'une unité par ligne.</p>

      <h2>L'Aether</h2>
      <p>À votre <i>n</i>-ième tour, vous disposez de <b>n Aether</b> (maximum 10). L'Aether se recharge entièrement chaque tour et ne se conserve pas. Chaque carte coûte son nombre d'Aether (le chiffre dans le rond).</p>

      <h2>Un tour de jeu</h2>
      <ol>
        <li><b>Éveil</b> — votre Aether se recharge, vous piochez 1 carte (main de 8 maximum : la carte en trop est défaussée), puis les unités avec <i>Soutien</i> soignent.</li>
        <li><b>Actions</b> — jouez autant de cartes que votre Aether le permet. Une <b>unité</b> se pose sur une ligne libre. Un <b>sort</b> produit son effet puis part au cimetière. Si un sort demande une cible, vous la choisissez.</li>
        <li><b>Retrait</b> (facultatif) — touchez une de vos unités puis « Garder en retrait » : elle n'attaquera pas ce tour-ci. Utile pour ne pas envoyer une unité à la mort.</li>
        <li><b>Assaut</b> — appuyez sur « Assaut ». De la ligne 1 à la ligne 4, chacune de vos unités prêtes attaque. Le tour passe ensuite à l'adversaire.</li>
      </ol>
      <p>Une unité est <b>prête</b> si elle n'est pas arrivée ce tour-ci (sauf avec <i>Charge</i>), n'est pas étourdie et n'est pas en retrait.</p>

      <h2>Le combat</h2>
      <ul><li>Si la ligne en face est <b>vide</b>, l'unité frappe la Citadelle : elle lui inflige son Attaque.</li>
      <li>Sinon les deux unités se frappent <b>en même temps</b> : chacune inflige son Attaque à l'autre.</li>
      <li>Les dégâts restent : une unité blessée le reste jusqu'à ce qu'on la soigne. À 0 PV, elle est détruite et va au cimetière.</li>
      <li>Les unités qui défendent ne sont jamais fatiguées : seule l'attaque est facultative.</li></ul>
      <div class="box"><b>Exemple.</b> Votre Griffon Jeune (3/3, Charge) arrive en ligne 2 en face d'un Garde-Bouclier (2/5, Garde). Il attaque tout de suite : le Garde subit 3 − 1 = 2 dégâts (il survit avec 3 PV), le Griffon subit 2 dégâts (il survit avec 1 PV).</div>

      <h2>Fin de partie</h2>
      <ul><li>Une Citadelle à 0 PV (ou moins) perd la partie. Si les deux tombent en même temps, le joueur dont c'est le tour gagne.</li>
      <li><b>Épuisement</b> : piocher dans un deck vide inflige ${E.FATIGUE} dégâts à votre Citadelle.</li></ul>

      <h2>Mots-clés</h2>
      ${CA.KW_ORDER.map((k) => `<div class="kwrow"><span class="tag">${KW[k].name}</span><span>${esc(KW[k].text)}</span></div>`).join("")}
      <div class="kwrow"><span class="tag">Arrivée</span><span>Effet qui se déclenche quand l'unité entre en jeu. « En face » désigne l'unité ennemie de la même ligne.</span></div>
      <div class="kwrow"><span class="tag">Dernier souffle</span><span>Effet qui se déclenche quand l'unité est détruite.</span></div>
      <div class="kwrow"><span class="tag">Étourdi</span><span>L'unité ne peut pas attaquer à son prochain assaut. Elle défend normalement.</span></div>

      <h2>Construire un deck</h2>
      <ul><li>Exactement <b>30 cartes</b>, de <b>2 factions maximum</b>.</li>
      <li><b>2 exemplaires</b> maximum par carte, <b>1</b> seul pour les Légendaires.</li>
      <li>Toutes les cartes sont disponibles dès le départ. La rareté n'ajoute aucune puissance : chaque carte est calibrée sur son coût. Les cartes plus rares sont simplement plus spectaculaires.</li></ul>

      <h2>Les cinq factions</h2>
      ${CA.FACTION_ORDER.map((f) => `<div class="kwrow"><span class="tag" style="color:${F[f].color}">${F[f].sym} ${F[f].short}</span><span><b>${F[f].motto}.</b> ${esc(F[f].doctrine)}</span></div>`).join("")}
    </div>`;
  }

  /* ───────── Navigation ───────── */
  function go(screen) {
    A.screen = screen;
    document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.nav === screen));
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === "screen-" + screen));
    ({ play: renderPlay, cards: renderCards, decks: renderDecks, rules: renderRules })[screen]();
    window.scrollTo(0, 0);
  }

  /* ───────── Combat : affichage ───────── */
  function tileHTML(u) {
    const c = card(u.id);
    const ic = u.kw.filter((k) => KW_ICON[k]).map((k) => `<span title="${KW[k].name}">${KW_ICON[k]}</span>`).join("") + (u.shield ? "<span>◉</span>" : "");
    return `<div class="tile f-${c.f} ${u.shield ? "shield" : ""} ${u.fresh ? "fresh" : ""} ${u.stun ? "stun" : ""} ${u.hold ? "hold" : ""}">
      <div class="ic">${ic}</div><div class="em">${c.e}</div><div class="nm">${esc(c.name.split(",")[0])}</div>
      <div class="st"><b class="a ${u.atk > c.atk ? "up" : ""}">${u.atk}</b><b class="h ${u.hp < u.max ? "hurt" : ""} ${u.max > c.hp ? "up" : ""}">${u.hp}</b></div>
      ${u.stun ? '<div class="flag">💤</div>' : u.hold ? '<div class="flag">⏸</div>' : ""}</div>`;
  }
  function laneHTML(side) {
    const g = A.g, me = A.me, m = A.mode;
    let h = "";
    for (let i = 0; i < E.LINES; i++) {
      const u = g.p[side].board[i];
      let cls = "slot";
      if (m && m.kind === "line" && side === me && !u) cls += " hint";
      if (m && m.kind === "pick" && side === m.side && u) cls += " target" + (side === me ? " ally" : "");
      h += `<button class="${cls}" data-act="slot" data-side="${side}" data-line="${i}" aria-label="Ligne ${i + 1}">${u ? tileHTML(u) : ""}</button>`;
    }
    return `<div class="lane-row ${side === me ? "me-side" : "foe-side"}">${h}</div>`;
  }
  function citHTML(side, mine) {
    const p = A.g.p[side], pct = Math.max(0, Math.min(1, p.cit / E.CITADEL));
    const flash = p.cit < A.prev[side] ? "flash" : "";
    return `<div class="cit ${mine ? "mine" : ""} ${flash}"><i style="transform:scaleX(${pct})"></i><span>🏰 ${Math.max(0, p.cit)}</span></div>`;
  }
  function aetherHTML(side) {
    const p = A.g.p[side];
    return `<div class="aether" title="Aether">✸ ${p.aether}/${p.max}</div>`;
  }
  function renderBattle() {
    const g = A.g, me = A.me, foe = 1 - me, P = g.p, myTurn = g.active === me && !g.over;
    const last = g.log.slice(-2).reverse();
    const hand = P[me].hand.map((id, i) => {
      const ok = myTurn && !A.busy && E.canPlay(g, me, i).ok;
      return `<button class="hc ${A.mode && A.mode.h === i ? "pick" : ""} ${ok ? "" : "cant"}" data-act="hand" data-i="${i}">${cardHTML(card(id), { mini: true })}</button>`;
    }).join("");
    const ready = P[me].board.filter((u) => u && E.canAttack(u)).length;
    const banner = A.mode ? `<div class="banner">${A.mode.kind === "line" ? "Choisissez une ligne libre" : "Choisissez une cible"}<button data-act="cancel">Annuler</button></div>` : "";
    const win = g.winner === me;
    $("#battle").innerHTML = `
      <div class="b-bar foe"><span class="b-name">${esc(P[foe].name)}</span>${citHTML(foe, false)}${aetherHTML(foe)}
        <span class="b-meta"><span class="opp-hand">${"<i></i>".repeat(Math.min(P[foe].hand.length, 8))}</span> · pioche ${P[foe].deck.length}</span>
        <button class="btn ghost small" data-act="menu" aria-label="Journal et menu">☰</button></div>
      <div class="field">${laneHTML(foe)}
        <div class="mid ${myTurn ? "turn-me" : ""}"><div class="log0">${myTurn ? "À vous de jouer" : g.over ? "" : "Tour de l'adversaire…"}</div><div class="log1">${last.map(esc).join("<br>")}</div></div>
        ${laneHTML(me)}</div>
      <div class="hand">${hand}</div>
      <div class="b-bar me"><span class="b-name">${esc(P[me].name)}</span>${citHTML(me, true)}${aetherHTML(me)}
        <span class="b-meta">pioche ${P[me].deck.length}</span>
        <div class="b-actions"><button class="btn gold small" data-act="end" ${myTurn && !A.busy ? "" : "disabled"}>⚔ Assaut${ready ? " (" + ready + ")" : ""}</button></div></div>
      ${banner}
      ${A.logOpen ? `<div id="log-panel">${g.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join("")}<p style="margin-top:8px"><button class="btn ghost small" data-act="quit">Abandonner la partie</button></p></div>` : ""}
      ${g.over ? `<div class="over ${win ? "win" : "lose"}"><div class="panel"><h1>${win ? "Victoire !" : "Défaite"}</h1><p>${win ? "La Citadelle adverse est tombée." : "Votre Citadelle est tombée."}</p>
        <div class="row"><button class="btn gold" data-act="start">Rejouer</button><button class="btn ghost" data-act="quit">Menu</button></div></div></div>` : ""}`;
    A.prev = [P[0].cit, P[1].cit];
  }

  /* ───────── Combat : déroulement ───────── */
  function startGame() {
    const deck = myDecks().find((d) => d.key === S.pick) || myDecks()[0];
    const oppF = S.opp === "random" ? CA.FACTION_ORDER[Math.floor(Math.random() * 5)] : S.opp;
    A.me = 0;
    A.g = E.newGame({ decks: [deck.ids, E.autoDeck(oppF)], names: ["Vous", F[oppF].short], first: Math.random() < 0.5 ? 0 : 1, seed: Date.now() });
    A.mode = null; A.busy = false; A.logOpen = false; A.prev = [E.CITADEL, E.CITADEL];
    document.body.style.overflow = "hidden";
    $("#battle").hidden = false;
    closeSheet();
    renderBattle();
    toast(A.g.active === A.me ? "Vous commencez" : "L'adversaire commence");
    if (A.g.active !== A.me) aiTurn();
  }
  function quit() { A.g = null; A.mode = null; $("#battle").hidden = true; document.body.style.overflow = ""; closeSheet(); renderPlay(); }

  function afterAction() {
    renderBattle();
    if (A.g.over) finish();
  }
  let recorded = null;
  function finish() {
    if (recorded === A.g) return;
    recorded = A.g;
    if (A.g.winner === A.me) S.w++; else S.l++;
    persist();
  }

  function doPlay(h, opts) {
    const r = E.playCard(A.g, A.me, h, opts);
    A.mode = null;
    if (!r.ok) toast(r.why || "Coup impossible");
    afterAction();
  }

  async function attackAnim(side) {
    A.g.p[side].board.forEach((u, i) => {
      if (u && E.canAttack(u)) { const t = document.querySelector(`.slot[data-side="${side}"][data-line="${i}"] .tile`); if (t) t.classList.add("atk"); }
    });
    await sleep(520);
  }

  async function endMyTurn() {
    if (A.busy || A.g.over || A.g.active !== A.me) return;
    A.busy = true; A.mode = null; closeSheet();
    renderBattle();
    await attackAnim(A.me);
    E.endTurn(A.g);
    renderBattle();
    if (A.g.over) { A.busy = false; return afterAction(); }
    await aiTurn();
  }

  async function aiTurn() {
    A.busy = true;
    const g = A.g, side = 1 - A.me;
    renderBattle();
    await sleep(650);
    for (let n = 0; n < 20 && !g.over; n++) {
      if (A.g !== g) return;
      const m = AI.chooseMove(g, side);
      if (!m) break;
      E.playCard(g, side, m.h, m.opts);
      renderBattle();
      await sleep(800);
    }
    if (A.g !== g) return;
    if (!g.over) { AI.applyHolds(g, side); renderBattle(); await attackAnim(side); E.endTurn(g); }
    A.busy = false;
    afterAction();
  }

  /* ───────── Événements ───────── */
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) {
      if (ev.target.id === "sheet") closeSheet();
      const nav = ev.target.closest("[data-nav]");
      if (nav) go(nav.dataset.nav);
      return;
    }
    const act = el.dataset.act, d = el.dataset;
    switch (act) {
      case "pick-deck": S.pick = d.key; persist(); renderPlay(); break;
      case "pick-opp": S.opp = d.key; persist(); renderPlay(); break;
      case "start": recorded = null; startGame(); break;
      case "info": showCard(d.id); break;
      case "close": closeSheet(); break;
      case "flt": {
        const f = d.kind === "fc" ? A.fc : A.fd;
        f[d.key] = d.key === "c" ? parseInt(d.val, 10) : d.val;
        $("#chips-" + d.kind).innerHTML = chipsHTML(d.kind, f);
        d.kind === "fc" ? fillCards() : fillDeckGrid();
        break;
      }
      /* — decks — */
      case "new-deck": A.edit = { id: uid(), name: "Nouveau deck", ids: [], isNew: true }; renderDecks(); break;
      case "copy-preset": A.edit = { id: uid(), name: "Deck " + F[d.f].short, ids: E.autoDeck(d.f), isNew: true }; renderDecks(); break;
      case "edit-deck": { const x = S.decks.find((k) => k.id === d.id); if (x) { A.edit = { id: x.id, name: x.name, ids: x.ids.slice() }; renderDecks(); } break; }
      case "del-deck": S.decks = S.decks.filter((k) => k.id !== d.id); if (A.edit && A.edit.id === d.id) A.edit = null; persist(); renderDecks(); break;
      case "add": {
        const c = card(d.id), cnt = deckCount(A.edit.ids)[d.id] || 0, ids = A.edit.ids;
        if (ids.length >= 30) return toast("Le deck est complet (30 cartes)");
        if (cnt >= CA.RARITIES[c.r].max) return toast(`${c.name} : ${CA.RARITIES[c.r].max} exemplaire${CA.RARITIES[c.r].max > 1 ? "s" : ""} maximum`);
        const facs = new Set(ids.map((i) => card(i).f)); facs.add(c.f);
        if (facs.size > 2) return toast("2 factions maximum par deck");
        ids.push(d.id); fillDeckGrid(); fillDeckPanel(); break;
      }
      case "remove": { const i = A.edit.ids.indexOf(d.id); if (i >= 0) A.edit.ids.splice(i, 1); fillDeckGrid(); fillDeckPanel(); break; }
      case "clear-deck": A.edit.ids = []; fillDeckGrid(); fillDeckPanel(); break;
      case "list-toggle": A.listOpen = !A.listOpen; fillDeckPanel(); break;
      case "save-deck": {
        const e = A.edit, i = S.decks.findIndex((k) => k.id === e.id);
        const rec = { id: e.id, name: e.name.trim() || "Mon deck", ids: e.ids.slice() };
        if (i >= 0) S.decks[i] = rec; else S.decks.push(rec);
        persist();
        const left = E.deckProblems(rec.ids);
        toast(left.length ? "Enregistré (incomplet : " + rec.ids.length + "/30)" : "Deck enregistré, prêt à jouer");
        renderDecks(); break;
      }
      /* — combat — */
      case "hand": if (A.g) showCard(A.g.p[A.me].hand[parseInt(d.i, 10)], { hand: parseInt(d.i, 10) }); break;
      case "play": {
        const h = parseInt(d.i, 10), c = card(A.g.p[A.me].hand[h]);
        closeSheet();
        if (c.type === "unit") A.mode = { kind: "line", h };
        else if (c.pick) A.mode = { kind: "pick", h, side: c.pick === "foe" ? 1 - A.me : A.me };
        else return doPlay(h, {});
        renderBattle(); break;
      }
      case "cancel": A.mode = null; renderBattle(); break;
      case "slot": {
        const side = parseInt(d.side, 10), line = parseInt(d.line, 10), u = A.g.p[side].board[line], m = A.mode;
        if (m && m.kind === "line" && side === A.me && !u) return doPlay(m.h, { line });
        if (m && m.kind === "pick" && side === m.side && u) return doPlay(m.h, { pick: { side, line } });
        if (u && !m) showCard(u.id, { unit: { side, line } });
        break;
      }
      case "hold": E.toggleHold(A.g, A.me, parseInt(d.line, 10)); closeSheet(); renderBattle(); break;
      case "end": endMyTurn(); break;
      case "menu": A.logOpen = !A.logOpen; renderBattle(); break;
      case "quit": quit(); break;
    }
  });

  document.addEventListener("input", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.search;
    if (k) { (k === "fc" ? A.fc : A.fd).q = ev.target.value; k === "fc" ? fillCards() : fillDeckGrid(); }
    if (ev.target.dataset && ev.target.dataset.name !== undefined && A.edit) A.edit.name = ev.target.value;
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { closeSheet(); if (A.mode) { A.mode = null; renderBattle(); } } });

  // Pour les tests automatisés
  window.CA.App = { A, S, go, startGame };
  go("play");
})();
