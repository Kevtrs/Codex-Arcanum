/* Importe un pack d'animations (feuilles d'images) dans fx/ : node tools/fx-import.js <dossier-du-pack> [--set 256] [--credit "texte"]
   Le pack doit contenir un fichier sheets/effects.json (format des packs « FX Free » de heyheythere : Spell, Combat, Buff, Status…).
   Résultat : fx/<nom>.png (une feuille par effet) + fx/effects.json + fx/effects.js (registre lu par le jeu). */
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
if (!dir || !fs.existsSync(dir)) { console.log("Usage : node tools/fx-import.js <dossier-du-pack> [--set 256] [--credit \"...\"]"); process.exit(1); }
const set = opt("set", "256"), out = path.join(__dirname, "../fx");

function find(d, name) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { const r = find(p, name); if (r) return r; } else if (e.name.toLowerCase() === name) return p;
  }
  return null;
}
const jsonPath = find(dir, "effects.json");
if (!jsonPath) { console.log("Aucun effects.json trouvé dans ce pack : envoyez-moi le dossier, je m'adapte à son format."); process.exit(2); }
const lic = ["license.txt", "licence.txt", "_license.txt"].map((n) => find(dir, n)).find(Boolean);
let credit = opt("credit", "");
if (!credit && lic) { const m = fs.readFileSync(lic, "utf8").match(/^\s*(.+ by .+ - https?:\/\/.+)$/m); if (m) credit = m[1].trim(); }

const src = JSON.parse(fs.readFileSync(jsonPath, "utf8")), base = path.dirname(jsonPath);
const regPath = path.join(out, "effects.json");
const reg = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, "utf8")) : {};
let n = 0;
for (const e of src.effects) {
  const cell = e.cell && (e.cell[set] || e.cell[Object.keys(e.cell)[0]]);
  const file = path.join(base, set, e.file);
  if (!cell || !fs.existsSync(file)) { console.log("  ignoré (fichier absent) :", e.name); continue; }
  fs.copyFileSync(file, path.join(out, e.name + ".png"));
  reg[e.name] = { frames: e.frames, fps: e.fps, loop: !!e.loop, cols: e.columns, rows: e.rows, w: cell[0], h: cell[1], ax: e.anchor[0], ay: e.anchor[1], element: e.element || "", shape: e.shape || "", credit };
  n++;
}
fs.writeFileSync(regPath, JSON.stringify(reg, null, 1));
fs.writeFileSync(path.join(out, "effects.js"), `/* Registre des animations (généré par tools/fx-import.js : ne pas modifier à la main). */\nwindow.CA = window.CA || {}; window.CA.FX = ${JSON.stringify(reg)};\n`);
console.log(`${n} animation(s) importée(s) depuis ${path.basename(dir)}. Registre : ${Object.keys(reg).length} animations.`);
console.log("Noms :", Object.keys(reg).join(", "));
if (credit) console.log("Crédit :", credit); else console.log("ATTENTION : aucune ligne de crédit trouvée, à ajouter dans CREDITS.md.");
