/* Régénère art/manifest.js à partir des fichiers art/<ID>.webp présents. Usage : node tools/art-manifest.js */
const fs = require("fs"), path = require("path");
global.CA = {}; require("../js/cards.js");
const dir = path.join(__dirname, "../art");
const have = {};
CA.CARDS.forEach((c) => { if (fs.existsSync(path.join(dir, c.id + ".webp"))) have[c.id] = 1; });
fs.writeFileSync(path.join(dir, "manifest.js"), `/* Liste des illustrations présentes dans art/ (généré par : node tools/art-manifest.js). */\nwindow.CA = window.CA || {}; window.CA.ART = ${JSON.stringify(have)};\n`);
const missing = CA.CARDS.filter((c) => !have[c.id]).map((c) => c.id);
console.log(`${Object.keys(have).length}/100 illustrations présentes.` + (missing.length ? ` Manquantes : ${missing.join(" ")}` : " Collection complète."));
