/* Génère css/cards.css (mise en page des cartes) à partir de card/parts.json : node tools/card-css.js
   Toutes les pièces sont positionnées en pourcentages du plan d'origine (1062 x 1471), donc la carte garde ses proportions à toute taille. */
const fs = require("fs"), path = require("path");
const P = JSON.parse(fs.readFileSync(path.join(__dirname, "../card/parts.json"), "utf8"));
const [CW, CH] = P.canvas;
const pc = (v, t) => (Math.round((v / t) * 10000) / 100) + "%";
const box = (m) => `left:${pc(m.x, CW)};top:${pc(m.y, CH)};width:${pc(m.w, CW)};height:${pc(m.h, CH)};`;
const at = (cx, cy, w, h) => box({ x: cx - w / 2, y: cy - h / 2, w, h });

const css = `/* GÉNÉRÉ par tools/card-css.js à partir de card/parts.json : ne pas modifier à la main.
   Cartes : pièces du pack Mechanized Magic de Dumivid (CC0), assemblées en calques. */
.card { --fc: #888; --fd: #444; position: relative; width: 100%; aspect-ratio: ${CW} / ${CH}; container-type: inline-size; user-select: none; text-align: left; color: #fff; filter: drop-shadow(0 4px 6px rgba(10, 20, 40, .35)); }
.card > * { position: absolute; }
.card .p { background: center / 100% 100% no-repeat; pointer-events: none; }
.card .back { ${box(P.back)} background-image: url(../card/back.png); }
.card .downmark { ${box(P.downmark)} background-image: url(../card/downmark.png); }
.card .stats { ${box(P.stats)} background-image: url(../card/stats.png); }
.card .ringb { ${box(P.ring_back)} background-image: url(../card/ring_back.png); }
.card .ringf { ${box(P.ring_front)} background-image: url(../card/ring_front.png); }
.card .descb { ${box(P.desc)} background-image: url(../card/desc.png); }
.card .nameb { ${box(P.name)} background-image: url(../card/name.png); }
.card .costb { ${box(P.cost)} background-image: url(../card/cost.png); }
/* couleur de la plaque selon la faction (la plaque d'origine est dorée) */
.card.f-AURELIA .back { filter: saturate(1.05); }
.card.f-DRACONIS .back { filter: hue-rotate(-44deg) saturate(1.35) brightness(.95); }
.card.f-SYLVE .back { filter: hue-rotate(78deg) saturate(.95) brightness(.92); }
.card.f-ARCANES .back { filter: hue-rotate(212deg) saturate(1.05) brightness(.95); }
.card.f-ABYSSES .back { filter: hue-rotate(160deg) saturate(.5) brightness(.78); }
.card.f-AURELIA { --fc: #d9a62e; --fd: #6e520e; } .card.f-DRACONIS { --fc: #cf402a; --fd: #601a10; } .card.f-SYLVE { --fc: #3a9a44; --fd: #16401a; }
.card.f-ARCANES { --fc: #6a48e0; --fd: #2c1a78; } .card.f-ABYSSES { --fc: #5d7e8e; --fd: #1c2c36; }
/* fenêtre d'illustration */
.card .c-win { ${box(P.window)} border-radius: 50%; overflow: hidden; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--fc) 55%, #fff), var(--fc) 45%, var(--fd)); }
.card .c-sym { position: absolute; inset: 0; display: grid; place-items: center; font-size: 55cqw; color: #fff; opacity: .16; }
.card .c-emoji { position: relative; font-size: 32cqw; line-height: 1; filter: drop-shadow(0 3px 4px rgba(0, 0, 0, .5)); }
.card .c-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* textes */
.card .c-cost { ${at(530, 128, 250, 150)} display: grid; place-items: center; font: 700 17.5cqw/1 var(--T); color: #fff; text-shadow: 0 .6cqw 0 rgba(10, 40, 100, .55), 0 0 2cqw rgba(0, 0, 0, .35); }
.card .c-name { ${at(528, 268, 600, 120)} display: grid; place-items: center; transform: rotate(-2.6deg); text-align: center; font: 700 7.3cqw/1.02 var(--T); color: #fff; text-shadow: 0 .5cqw 0 rgba(10, 20, 40, .75); text-wrap: balance; }
.card .c-name span { max-width: 100%; }
.card .c-text { ${box({ x: 236, y: 790, w: 590, h: 410 })} font-size: 6.3cqw; line-height: 1.13; color: #e9eef7; overflow: hidden; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.card .c-text p { margin: 0 0 1.2cqw; } .card .c-text i { font-style: normal; font-weight: 700; color: #ffd978; }
.card .c-kws { display: flex; flex-wrap: wrap; gap: 1cqw; justify-content: center; margin-bottom: 1.6cqw; }
.card .kw { font-weight: 700; font-size: 5.6cqw; padding: .2cqw 2cqw; border-radius: 99px; background: #fff; color: var(--fd); }
.card .c-type { ${at(530, 1366, 470, 90)} display: grid; place-items: center; font: 700 4.5cqw/1 var(--T); letter-spacing: .25cqw; text-transform: uppercase; color: #dfe7f3; white-space: nowrap; }
.card .atk, .card .hp { width: 13.4%; height: 9.5%; top: ${pc(1274 - 70, CH)}; display: grid; place-items: center; font: 700 11cqw/1 var(--T); color: #fff; text-shadow: 0 .5cqw 0 rgba(0, 0, 0, .45), 0 0 1.5cqw rgba(0, 0, 0, .4); }
.card .atk { left: ${pc(194 - 71, CW)}; } .card .hp { left: ${pc(862 - 71, CW)}; }
.card .c-gem { ${at(531, 786, 120, 120)} background: center / contain no-repeat; filter: drop-shadow(0 .6cqw 1cqw rgba(0, 0, 0, .55)); }
.card.r-C .c-gem { background-image: url(../ui/gem_C.png); } .card.r-R .c-gem { background-image: url(../ui/gem_R.png); }
.card.r-E .c-gem { background-image: url(../ui/gem_E.png); } .card.r-L .c-gem { background-image: url(../ui/gem_L.png); }
/* rareté : halo, et reflet qui traverse la plaque des Légendaires (limité à la forme de la plaque par un masque) */
.card.r-R { filter: drop-shadow(0 0 5px rgba(70, 150, 230, .8)) drop-shadow(0 4px 6px rgba(10, 20, 40, .35)); }
.card.r-E { filter: drop-shadow(0 0 7px rgba(150, 90, 240, .9)) drop-shadow(0 4px 6px rgba(10, 20, 40, .35)); }
.card.r-L { filter: drop-shadow(0 0 9px rgba(255, 200, 60, .95)) drop-shadow(0 4px 6px rgba(10, 20, 40, .35)); }
.card.r-L::after { content: ""; position: absolute; ${box(P.back)} pointer-events: none; z-index: 5;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .55) 50%, transparent 65%) 0 0 / 260% 100%;
  -webkit-mask: url(../card/back.png) center / 100% 100% no-repeat; mask: url(../card/back.png) center / 100% 100% no-repeat; animation: foil 3.2s linear infinite; }
@keyframes foil { from { background-position: 160% 0; } to { background-position: -110% 0; } }
@media (prefers-reduced-motion: reduce) { .card.r-L::after { animation: none; } }
/* sorts : pas d'hexagones de stats ; main : version réduite sans texte */
.card.spell .stats, .card.spell .atk, .card.spell .hp { display: none; }
.card.mini .c-type { display: none; }
.card.mini .c-text { font-size: 8cqw; } .card.mini .kw { font-size: 7.4cqw; padding: .4cqw 2.2cqw; }
.card.mini .c-name { font-size: 10.5cqw; }
.card.dim { filter: grayscale(.7) opacity(.62); }
.card .count-badge { position: absolute; right: 3cqw; top: 3cqw; z-index: 6; min-width: 13cqw; height: 13cqw; border-radius: 99px; background: #fff; color: var(--fd); display: grid; place-items: center; font: 700 8.5cqw var(--T); border: .7cqw solid var(--fc); }
.card .lock { inset: 0; z-index: 7; display: grid; place-items: center; font-size: 26cqw; background: rgba(235, 241, 248, .4); }
`;
fs.writeFileSync(path.join(__dirname, "../css/cards.css"), css);
console.log("css/cards.css écrit (" + css.length + " octets)");
