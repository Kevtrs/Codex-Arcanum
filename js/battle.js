/* Codex Arcanum — interface de combat : plateau, animations, sons, aperçu des duels, mulligan, conseils, résultat. */
(function () {
  "use strict";
  const CA = window.CA, E = CA.Engine, AI = CA.AI, M = CA.Meta, Pr = CA.Profile, Au = CA.Audio, F = CA.FACTIONS, KW = CA.KEYWORDS;
  const UI = CA.UI, { P, A, $, esc, card, persist, cardHTML, showCard, closeSheet, toast, wait } = UI;
  const B = (CA.Battle = {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ───────── Lancement ───────── */
  function begin(spec) {
    const g = E.newGame({ decks: [spec.mine, spec.foeIds], names: ["Vous", F[spec.foeFaction].short], first: Math.random() < 0.5 ? 0 : 1,
                          seed: Date.now(), cit: spec.cit, extraHand: spec.extraHand, drawPerTurn: spec.drawPerTurn });
    Object.assign(A, { g, spec, me: 0, mode: null, busy: true, logOpen: false, result: null, tip: null, mull: new Set(), stage: "mulligan", prev: [g.p[0].cit, g.p[1].cit] });
    g.fx = [];
    document.body.style.overflow = "hidden";
    const b = $("#battle");
    b.hidden = false; b.dataset.foe = spec.foeFaction;
    closeSheet();
    render();
  }
  function build(mode, o) {
    const d = UI.currentDeck();
    return Object.assign({ mine: d.ids, custom: d.custom, ctx: { mode } }, o);
  }
  B.startQuick = function () {
    const f = P.opp === "random" ? CA.FACTION_ORDER[Math.floor(Math.random() * 5)] : P.opp;
    begin(build("quick", { foeFaction: f, foeIds: E.autoDeck(f, P.diff === 2 ? null : M.STARTER), diff: P.diff, skill: P.diff === 0 ? 0 : 1 }));
  };
  B.startDaily = function () {
    const ch = Pr.dailyChallenge();
    begin(build("daily", Object.assign({ foeFaction: ch.faction, foeIds: E.autoDeck(ch.faction), diff: 1, skill: 1 }, ch.mod.opts)));
  };
  B.startNode = function (key) {
    const n = M.NODES.find((x) => x.key === key);
    const b = build("campaign", { foeFaction: n.faction, foeIds: E.autoDeck(n.faction, n.pool === "starter" ? M.STARTER : null), diff: n.skill, skill: n.skill === 0 ? 0 : 1, cit: [20, n.cit], extraHand: [0, n.extraHand] });
    b.ctx.nodeKey = key;
    begin(b);
  };

  /* ───────── Aperçu du duel (étiquette sur les lignes libres) ───────── */
  function previewUnit(id, line) {
    const g = A.g, me = A.me, foe = 1 - me, d = g.p[foe].board[line], c = card(id);
    if (!d) return `🏰 −${c.atk}`;
    const t = E.clone(g);
    const a = E.makeUnit(t, id, me); a.fresh = false;
    t.p[me].board[line] = a; t.active = me;
    E.duel(t, a, t.p[foe].board[line], me, foe);
    const aDead = a.hp <= 0, dDead = t.p[foe].board[line].hp <= 0;
    return aDead && dDead ? "⚖ échange" : dDead ? "✔ gagne" : aDead ? "✖ perd" : "= tient";
  }
  function previewSpell(h, pick) {
    const g = A.g, t = E.clone(g), side = pick.side, before = t.p[side].board[pick.line];
    if (!before) return "";
    const uid = before.uid;
    E.playCard(t, A.me, h, { pick });
    const now = t.p[side].board[pick.line];
    if (!now || now.uid !== uid) return side === A.me ? "☠" : (t.p[side].hand.length > g.p[side].hand.length ? "↩" : "☠");
    return "";
  }

  /* ───────── Affichage ───────── */
  function tileHTML(u) {
    const c = card(u.id);
    const ic = u.kw.filter((k) => UI.KW_ICON[k]).map((k) => `<span title="${KW[k].name}">${UI.KW_ICON[k]}</span>`).join("") + (u.shield ? "<span>◉</span>" : "");
    return `<div class="tile f-${c.f} ${u.shield ? "shield" : ""} ${u.fresh ? "fresh" : ""} ${u.stun ? "stun" : ""} ${u.hold ? "hold" : ""}">
      <div class="ic">${ic}</div><div class="em">${c.e}</div>${c.token || !(CA.ART && CA.ART[c.id]) ? "" : `<img class="t-img" src="art/${c.id}.webp" alt="" onerror="this.remove()">`}<div class="nm">${esc(c.name.split(",")[0])}</div>
      <div class="st"><b class="a ${u.atk > c.atk ? "up" : ""}">${u.atk}</b><b class="h ${u.hp < u.max ? "hurt" : ""} ${u.max > c.hp ? "up" : ""}">${u.hp}</b></div>
      ${u.stun ? '<div class="flag">💤</div>' : u.hold ? '<div class="flag">⏸</div>' : ""}</div>`;
  }
  function laneHTML(side) {
    const g = A.g, me = A.me, m = A.mode;
    let h = "";
    for (let i = 0; i < E.LINES; i++) {
      const u = g.p[side].board[i];
      let cls = "slot", lab = "";
      if (m && m.kind === "line" && side === me && !u) { cls += " hint"; lab = previewUnit(g.p[me].hand[m.h], i); }
      if (m && m.kind === "pick" && side === m.side && u) { cls += " target" + (side === me ? " ally" : ""); lab = previewSpell(m.h, { side, line: i }); }
      h += `<button class="${cls}" data-act="slot" data-side="${side}" data-line="${i}" data-line-no="${i + 1}" aria-label="Ligne ${i + 1}">${u ? tileHTML(u) : ""}${lab ? `<span class="prev">${lab}</span>` : ""}</button>`;
    }
    return `<div class="lane-row ${side === me ? "me-side" : "foe-side"}">${h}</div>`;
  }
  const citHTML = (side, mine) => {
    const p = A.g.p[side], pct = Math.max(0, Math.min(1, p.cit / p.citMax));
    return `<div class="cit ${mine ? "mine" : ""} ${p.cit < A.prev[side] ? "flash" : ""}" data-cit="${side}"><i style="transform:scaleX(${pct})"></i><span>🏰 ${Math.max(0, p.cit)}</span></div>`;
  };
  const aetherHTML = (side) => { const p = A.g.p[side]; return `<div class="aether" title="Aether">✸ ${p.aether}/${p.max}</div>`; };

  function render() {
    const g = A.g; if (!g) return;
    const me = A.me, foe = 1 - me, P_ = g.p, myTurn = g.active === me && !g.over && A.stage === "play";
    const last = g.log.slice(-2).reverse();
    const hand = P_[me].hand.map((id, i) => {
      const ok = myTurn && !A.busy && E.canPlay(g, me, i).ok;
      return `<button class="hc ${A.mode && A.mode.h === i ? "sel" : ""} ${ok ? "" : "cant"}" data-act="hand" data-i="${i}">${cardHTML(card(id), { mini: true })}</button>`;
    }).join("");
    const ready = P_[me].board.filter((u) => u && E.canAttack(u)).length;
    const nothingToPlay = myTurn && !P_[me].hand.some((_, i) => E.canPlay(g, me, i).ok);
    const banner = A.mode ? `<div class="banner">${A.mode.kind === "line" ? "Choisissez une ligne libre" : "Choisissez une cible"}<button data-act="cancel">Annuler</button></div>` : "";
    $("#b-main").innerHTML = `
      <div class="b-bar foe"><span class="b-name">${F[A.spec.foeFaction].sym} ${esc(P_[foe].name)}</span>${citHTML(foe, false)}${aetherHTML(foe)}
        <span class="b-meta"><span class="opp-hand">${"<i></i>".repeat(Math.min(P_[foe].hand.length, 8))}</span> · pioche ${P_[foe].deck.length}</span>
        <button class="btn ghost small" data-act="menu" aria-label="Journal et menu">☰</button></div>
      <div class="field">${laneHTML(foe)}
        <div class="mid ${myTurn ? "turn-me" : ""}"><div class="log0">${A.stage === "mulligan" ? "Préparation…" : myTurn ? (A.busy ? "…" : "À vous de jouer") : g.over ? "" : "Tour de l'adversaire…"}</div><div class="log1">${last.map(esc).join("<br>")}</div></div>
        ${laneHTML(me)}</div>
      <div class="hand">${hand}</div>
      <div class="b-bar me"><span class="b-name">Vous</span>${citHTML(me, true)}${aetherHTML(me)}
        <span class="b-meta">pioche ${P_[me].deck.length}</span>
        <div class="b-actions"><button class="btn gold small ${nothingToPlay && ready && !A.busy ? "pulse" : ""}" data-act="end" ${myTurn && !A.busy ? "" : "disabled"}>⚔ Assaut${ready ? " (" + ready + ")" : ""}</button></div></div>
      ${banner}${coachHTML()}
      ${A.logOpen ? `<div id="log-panel">${g.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join("")}<p style="margin-top:8px"><button class="btn ghost small" data-act="quit">Abandonner la partie</button></p></div>` : ""}
      ${A.stage === "mulligan" ? mulliganHTML() : ""}${A.result ? resultHTML() : ""}`;
    A.prev = [P_[0].cit, P_[1].cit];
    if (A.stage === "play" && !A.busy && myTurn) maybeTip();
  }

  /* ───────── Conseils (affichés une seule fois) ───────── */
  const TIPS = {
    welcome: "Chaque camp a 4 lignes. Votre unité affronte celle d'en face. Faites tomber la Citadelle adverse (🏰) avant qu'elle ne fasse tomber la vôtre.",
    aether:  "Votre Aether (✸) s'affiche en bas. Chaque carte coûte son chiffre en Aether. Touchez une carte pour la lire, puis « Jouer ».",
    place:   "Bien joué ! Une unité posée ce tour-ci est grisée : elle attaquera à votre prochain tour. Les étiquettes montrent l'issue d'un duel avant de poser.",
    assault: "Plus rien à jouer : appuyez sur « Assaut ». Vos unités prêtes attaquent de gauche à droite, puis le tour passe à l'adversaire.",
    hold:    "Cette unité mourrait sans rien détruire. Touchez-la puis « Garder en retrait » : elle ne sortira pas ce tour.",
    spell:   "Un sort : effet immédiat, puis il part au cimetière. Certains demandent de choisir une cible, qui s'illumine."
  };
  function wouldDie(u, i) {
    const d = A.g.p[1 - A.me].board[i]; if (!d || u.shield) return false;
    const gd = (x) => (E.has(x, "garde") ? 1 : 0), dealt = Math.max(0, u.atk - gd(d)), taken = Math.max(0, d.atk - gd(u));
    const first = E.has(u, "vif") && !E.has(d, "vif");
    return taken >= u.hp && !(first && !d.shield && dealt >= d.hp) && !(!d.shield && dealt >= d.hp);
  }
  function maybeTip() {
    if (A.tip || A.mode) return;
    const g = A.g, me = A.me, p = g.p[me], seen = P.tips;
    const order = [
      ["welcome", () => true],
      ["aether", () => p.turns <= 1 && seen.welcome],
      ["place", () => p.board.some((u) => u && u.fresh) && seen.aether],
      ["spell", () => p.hand.some((id, i) => card(id).type === "spell" && E.canPlay(g, me, i).ok)],
      ["hold", () => p.board.some((u, i) => u && E.canAttack(u) && wouldDie(u, i))],
      ["assault", () => seen.place && !p.hand.some((_, i) => E.canPlay(g, me, i).ok) && p.board.some((u) => u && E.canAttack(u))]
    ];
    for (const [id, cond] of order) if (!seen[id] && cond()) { A.tip = id; render(); return; }
  }
  function coachHTML() { return A.tip ? `<div class="coach"><p>${esc(TIPS[A.tip])}</p><button class="btn small" data-act="tip-ok">Compris</button></div>` : ""; }

  /* ───────── Mulligan ───────── */
  function mulliganHTML() {
    const p = A.g.p[A.me], n = A.mull.size;
    return `<div class="over mull"><div class="panel"><h2>Votre main de départ</h2><p class="muted">Touchez les cartes que vous voulez remplacer (une seule fois).</p>
      <div class="mull-hand">${p.hand.map((id, i) => `<button class="hc ${A.mull.has(i) ? "sel swap" : ""}" data-act="mull" data-i="${i}">${cardHTML(card(id), { mini: true })}${A.mull.has(i) ? '<span class="swap-tag">↻</span>' : ""}</button>`).join("")}</div>
      <button class="btn gold block" data-act="mull-ok">${n ? `Remplacer ${n} carte${n > 1 ? "s" : ""}` : "Garder cette main"}</button></div></div>`;
  }
  async function startPlay() {
    const g = A.g, foe = 1 - A.me;
    if (A.spec.skill > 0) {            // l'adversaire change ses cartes les plus chères s'il en a plusieurs
      const idx = []; g.p[foe].hand.forEach((id, i) => { if (card(id).c >= 5) idx.push(i); });
      if (idx.length >= 2) E.mulligan(g, foe, idx.slice(1));
    }
    A.stage = "play"; A.busy = false;
    g.fx = [];
    render();
    if (g.active === A.me) { banner("Vous commencez"); Au.play("turn"); } else { banner("L'adversaire commence"); await sleep(900 * P.settings.speed); await aiTurn(); }
  }

  /* ───────── Effets visuels ───────── */
  function layer() { return $("#b-fx"); }
  function rectOf(sel) { const el = $(sel, $("#b-main")); return el ? el.getBoundingClientRect() : null; }
  function floater(r, text, cls) {
    if (!r) return;
    const s = document.createElement("span");
    s.className = "float " + cls; s.textContent = text;
    s.style.left = r.left + r.width / 2 + "px"; s.style.top = r.top + r.height / 2 + "px";
    layer().appendChild(s); setTimeout(() => s.remove(), 1100);
  }
  function banner(text, cls) {
    const b = document.createElement("div");
    b.className = "big-banner animate__animated animate__bounceIn " + (cls || ""); b.textContent = text;
    layer().appendChild(b); setTimeout(() => (b.style.opacity = 0), 950); setTimeout(() => b.remove(), 1250);
  }
  const slotRect = (side, line) => rectOf(`.slot[data-side="${side}"][data-line="${line}"]`);
  const citRect = (side) => rectOf(`.cit[data-cit="${side}"]`);
  const tileEl = (side, line) => $(`.slot[data-side="${side}"][data-line="${line}"] .tile`, $("#b-main"));
  const VFX = CA.VFX;
  function shake() { const x = $("#battle"); x.classList.remove("shake"); void x.offsetWidth; x.classList.add("shake"); }
  function vignette() { const x = $("#battle"); x.classList.remove("vig"); void x.offsetWidth; x.classList.add("vig"); }
  function ringAt(r) {
    if (!r) return;
    const d = document.createElement("i"); d.className = "ring";
    d.style.left = r.left + r.width / 2 + "px"; d.style.top = r.top + r.height / 2 + "px";
    layer().appendChild(d); setTimeout(() => d.remove(), 600);
  }

  // Un événement du moteur → son + animation. Ne renvoie une promesse que pour les sorts (le projectile doit arriver avant les impacts).
  function fxOne(ev) {
    if (!A.g) return;
    const src = ev.src || null;
    switch (ev.k) {
      case "swing": Au.play("swing"); { const foeTile = tileEl(1 - ev.side, ev.line); ringAt(slotRect(1 - ev.side, ev.line)); if (foeTile) { foeTile.classList.add("recoil"); } } break;
      case "hit": {
        floater(slotRect(ev.side, ev.line), "−" + ev.n, "dmg dmgB"); Au.play("hit");
        const t = tileEl(ev.side, ev.line); if (t) { t.classList.remove("hurt"); void t.offsetWidth; t.classList.add("hurt"); }
        VFX.impact(slotRect(ev.side, ev.line), src || "DRACONIS", ev.n);
        break;
      }
      case "heal": floater(slotRect(ev.side, ev.line), "+" + ev.n, "heal"); Au.play("heal"); VFX.heal(slotRect(ev.side, ev.line)); break;
      case "buff": VFX.buff(slotRect(ev.side, ev.line), src || "AURELIA"); VFX.anim(tileEl(ev.side, ev.line), "pulse"); Au.play("heal"); break;
      case "shield": floater(slotRect(ev.side, ev.line), "🛡", "info"); Au.play("shield"); VFX.anim(tileEl(ev.side, ev.line), "pulse"); break;
      case "cit": floater(citRect(ev.side), "−" + ev.n, "dmg big"); Au.play("cit"); vignette(); VFX.impact(citRect(ev.side), src || "DRACONIS", ev.n); if (ev.n >= 4) shake(); break;
      case "healcit": floater(citRect(ev.side), "+" + ev.n, "heal big"); Au.play("heal"); VFX.heal(citRect(ev.side)); break;
      case "die": floater(slotRect(ev.side, ev.line), "💥", "info"); Au.play("die"); VFX.death(slotRect(ev.side, ev.line), src); break;
      case "place": Au.play("play"); VFX.anim(tileEl(ev.side, ev.line), "bounceIn"); if (src) VFX.summon(slotRect(ev.side, ev.line), src); break;
      case "spell": return castSpell(ev);
    }
  }
  // Lancer de sort : la boule d'énergie part de la Citadelle du lanceur vers la cible, puis les impacts se déclenchent.
  function castSpell(ev) {
    const c = card(ev.id), f = c.f, from = citRect(ev.side);
    Au.play("spell");
    const tag = document.createElement("div"); tag.className = "spell-tag animate__animated animate__fadeInUp"; tag.textContent = c.name;
    tag.style.cssText = `--g:${VFX.look(f).glow}`; layer().appendChild(tag); setTimeout(() => tag.remove(), 1500);
    const wide = c.r === "L" || c.fx.some((x) => x.to === "foes" || x.to === "allies");
    if (wide) { VFX.flash(f); if (c.r === "L") shake(); }
    if (ev.pick) return VFX.projectile(from, slotRect(ev.pick.side, ev.pick.line), f);
    VFX.buff(from, f);
    return sleep(wide ? 260 : 160);
  }
  // Rejoue les événements dans l'ordre. Les impacts d'un même sort partent ensemble, un sort attend son projectile.
  function drainFx() {
    const evs = A.g.fx.splice(0); if (!evs.length) return Promise.resolve();
    let chain = Promise.resolve();
    evs.forEach((ev, i) => { chain = chain.then(() => fxOne(ev)).then(() => (ev.k === "spell" ? null : sleep(Math.min(i, 5) * 22 * P.settings.speed))); });
    return chain;
  }

  /* ───────── Déroulement ───────── */
  function after() { render(); drainFx(); if (A.g.over) finish(); }

  function doPlay(h, opts) {
    const r = E.playCard(A.g, A.me, h, opts);
    A.mode = null;
    if (!r.ok) toast(r.why || "Coup impossible");
    after();
  }

  async function runAssault(side) {
    const g = A.g;
    for (let i = 0; i < E.LINES && !g.over; i++) {
      if (A.g !== g) return;
      const u = g.p[side].board[i], will = u && E.canAttack(u);
      if (!will) { E.assaultLine(g, i); if (g.fx.length) { render(); drainFx(); } continue; }     // étourdie, en retrait, ou rien : pas de charge
      const t = tileEl(side, i);
      if (t) t.classList.add("atk");
      await wait(330);                           // la charge atteint la cible ici
      if (t) t.style.animationPlayState = "paused";   // hit-stop : le temps se fige une fraction de seconde au moment du choc
      E.assaultLine(g, i);                       // règles appliquées maintenant ; l'affichage suit
      const fx = drainFx();
      await wait(95);
      if (t) t.style.animationPlayState = "";
      await wait(260);
      await fx;
      render();
    }
    E.assaultEnd(g);
  }

  async function endMyTurn() {
    const g = A.g;
    if (A.busy || g.over || g.active !== A.me || A.stage !== "play") return;
    A.busy = true; A.mode = null; closeSheet(); render();
    await runAssault(A.me);
    if (A.g !== g) return;
    if (g.over) { A.busy = false; return after(); }
    E.passTurn(g); render(); drainFx();
    await aiTurn();
  }

  async function aiTurn() {
    const g = A.g, side = 1 - A.me, skill = A.spec.skill;
    A.busy = true; render();
    await wait(650);
    for (let n = 0; n < 20 && !g.over; n++) {
      if (A.g !== g) return;
      const m = AI.chooseMove(g, side, skill);
      if (!m) break;
      E.playCard(g, side, m.h, m.opts);
      render(); drainFx();
      await wait(850);
    }
    if (A.g !== g) return;
    if (!g.over) {
      if (skill !== 0) AI.applyHolds(g, side);
      render(); await runAssault(side);
      if (A.g !== g) return;
    }
    if (!g.over) { E.passTurn(g); banner("Votre tour"); Au.play("turn"); }
    A.busy = false;
    after();
  }

  /* ───────── Résultat ───────── */
  function finish() {
    if (A.result) return;
    const g = A.g, spec = A.spec, win = g.winner === A.me, me = g.p[A.me];
    const lvl0 = P.lvl;
    const events = Pr.recordGame(P, { win, st: me.st, citLeft: Math.max(0, me.cit), citMax: me.citMax, myTurns: me.turns, custom: spec.custom, foeFaction: spec.foeFaction },
                                 { mode: spec.ctx.mode, nodeKey: spec.ctx.nodeKey, skill: spec.diff });
    persist();
    A.result = { win, events, lvl0 };
    Au.play(win ? "win" : "lose");
    if (events.some((e) => e.t === "level")) setTimeout(() => Au.play("level"), 900);
    if (win) setTimeout(() => { const s = $("#b-main .seal"); if (s) VFX.win(s.getBoundingClientRect()); }, 1150);
    UI.updateHeader();
    setTimeout(() => { if (A.g === g) { render(); } }, 700);
  }
  function resultHTML() {
    const r = A.result, spec = A.spec, nodeKey = spec.ctx.nodeKey, node = nodeKey && M.NODES.find((n) => n.key === nodeKey);
    const xp = r.events.find((e) => e.t === "xp").n;
    const lines = [`<div class="r-line xp">+${xp} XP</div>`];
    r.events.forEach((e) => {
      if (e.t === "level") lines.push(`<div class="r-line gold animate__animated animate__tada">⬆ Niveau ${e.lvl} · une carte à choisir</div>`);
      if (e.t === "node") lines.push(`<div class="r-line gold">🗺 Duel terminé · une carte à choisir</div>`);
      if (e.t === "chapter") lines.push(`<div class="r-line gold">✦ ${esc(e.seal)} obtenu !</div><div class="r-story">${esc(M.CHAPTERS[e.chapter].outro)}</div>`);
      if (e.t === "daily") lines.push(`<div class="r-line gold">⚡ Défi du jour relevé · une carte à choisir</div>`);
      if (e.t === "quest") lines.push(`<div class="r-line">📜 Quête : ${esc(M.QUESTS.find((q) => q.id === e.id).text)}</div>`);
      if (e.t === "questsAll") lines.push(`<div class="r-line gold">📜 Trois quêtes terminées · une carte à choisir</div>`);
      if (e.t === "ach") lines.push(`<div class="r-line">🏆 ${esc(M.ACH.find((a) => a.id === e.id).name)}</div>`);
    });
    const nextNode = r.win && node ? Pr.nextNode(P) : null;
    return `<div class="over ${r.win ? "win" : "lose"}"><div class="panel ${r.win ? "stamp" : "animate__animated animate__fadeIn"}">${r.win ? '<div class="seal">✦</div>' : ""}<h1>${r.win ? "Victoire !" : "Défaite"}</h1>
      <p class="muted">${r.win ? "La Citadelle adverse est tombée." : "Votre Citadelle est tombée. On apprend plus d'une défaite que d'une victoire."}</p>
      ${node && r.win ? `<p class="r-story">${esc(node.title)} est derrière vous.</p>` : ""}
      <div class="r-lines">${lines.join("")}</div>
      <div class="r-btns">
        ${P.picks ? `<button class="btn gold block pulse" data-act="result-pick">🎁 Choisir ma carte (${P.picks})</button>` : ""}
        ${nextNode ? `<button class="btn block" data-act="result-next">▶ Duel suivant : ${esc(nextNode.title)}</button>` : ""}
        <button class="btn ${nextNode ? "ghost" : ""} block" data-act="result-again">↻ Rejouer</button>
        <button class="btn ghost block" data-act="result-quit">Menu</button></div></div></div>`;
  }

  function quit() {
    A.g = null; A.mode = null; A.result = null; A.stage = null;
    $("#battle").hidden = true; $("#b-main").innerHTML = ""; $("#b-fx").innerHTML = "";
    document.body.style.overflow = ""; closeSheet(); UI.render(); UI.updateHeader();
  }

  /* ───────── Actions ───────── */
  B.escape = function () { if (A.mode) { A.mode = null; render(); } };
  B.handle = function (act, d) {
    Au.unlock();
    const g = A.g; if (!g) return;
    switch (act) {
      case "mull": { const i = parseInt(d.i, 10); A.mull.has(i) ? A.mull.delete(i) : A.mull.add(i); Au.play("click"); render(); break; }
      case "mull-ok": { if (A.mull.size) E.mulligan(g, A.me, Array.from(A.mull)); A.mull = new Set(); Au.play("play"); startPlay(); break; }
      case "tip-ok": P.tips[A.tip] = 1; A.tip = null; persist(); render(); break;
      case "hand": if (A.stage === "play") { Au.play("click"); showCard(g.p[A.me].hand[parseInt(d.i, 10)], { hand: parseInt(d.i, 10) }); } break;
      case "play": {
        const h = parseInt(d.i, 10), c = card(g.p[A.me].hand[h]);
        closeSheet();
        if (c.type === "unit") A.mode = { kind: "line", h };
        else if (c.pick) A.mode = { kind: "pick", h, side: c.pick === "foe" ? 1 - A.me : A.me };
        else return doPlay(h, {});
        render(); break;
      }
      case "cancel": A.mode = null; render(); break;
      case "slot": {
        const side = parseInt(d.side, 10), line = parseInt(d.line, 10), u = g.p[side].board[line], m = A.mode;
        if (m && m.kind === "line" && side === A.me && !u) return doPlay(m.h, { line });
        if (m && m.kind === "pick" && side === m.side && u) return doPlay(m.h, { pick: { side, line } });
        if (u && !m) showCard(u.id, { unit: { side, line } });
        break;
      }
      case "hold": E.toggleHold(g, A.me, parseInt(d.line, 10)); closeSheet(); render(); break;
      case "end": endMyTurn(); break;
      case "menu": A.logOpen = !A.logOpen; render(); break;
      case "quit": if (g.over || window.confirm("Abandonner la partie ? Aucune progression ne sera gagnée.")) quit(); break;
      case "result-quit": quit(); break;
      case "result-again": { const s = A.spec; A.result = null; A.g = null; replay(s); break; }
      case "result-next": { const n = Pr.nextNode(P); A.result = null; A.g = null; if (n) B.startNode(n.key); break; }
      case "result-pick": quit(); UI.openPick(); break;
    }
  };
  function replay(s) {
    const d = UI.currentDeck();
    begin(Object.assign({}, s, { mine: d.ids, custom: d.custom }));
  }

  CA.Battle = B;
})();
