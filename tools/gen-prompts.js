/* Génère la fiche des 100 prompts d'illustration : node tools/gen-prompts.js  →  art/PROMPTS.md et art/prompts.json */
const fs = require("fs"), path = require("path");
global.CA = {}; require("../js/cards.js");
const FAC = {
  AURELIA:  "radiant golden kingdom of knights, ivory and gold plate armor, lily (fleur-de-lis) heraldry, warm dawn light, white marble, gold and ivory palette",
  DRACONIS: "volcanic dragon-blooded warrior clan, red scaled armor, forges and lava, flying embers, molten orange and black palette",
  SYLVE:    "ancient living forest, elves, wolves and sacred stags, glowing moss and roots, silver mist, deep green and silver palette",
  ARCANES:  "arcane academy of mages, floating runes and crystals, starry night, electric blue and violet palette",
  ABYSSES:  "cursed crypts and necromancy, bones, pale ghost light, cold fog, desaturated teal, slate grey and sickly purple palette"
};
const STYLE = "Painterly digital fantasy card-game illustration, dramatic rim lighting, strong silhouette readable at small size, one clear focal subject centered, rich colors, soft atmospheric depth. No text, no letters, no logo, no border, no frame, no watermark. Wide crop, aspect ratio 1.8:1 (for example 1440x800), subject kept in the central 60% of the width.";
const list = CA.CARDS.map((c) => {
  const fac = CA.FACTIONS[c.f];
  const what = c.type === "unit"
    ? `Portrait or dynamic pose of "${c.name}", a ${c.r === "L" ? "legendary " : ""}fantasy character or creature of ${fac.name}. Inspiration: ${c.lore}`
    : `Magical effect scene for the spell "${c.name}": ${CA.cardText(c).replace(/Choisissez une unité (ennemie|alliée)\. ?/, "")}. Inspiration: ${c.lore}. Show the spell being unleashed, not a character portrait.`;
  return { id: c.id, file: `${c.id}.webp`, name: c.name, faction: c.f, type: c.type, rarity: c.r, prompt: `${what} Setting: ${FAC[c.f]}. ${STYLE}` };
});
fs.writeFileSync(path.join(__dirname, "../art/prompts.json"), JSON.stringify(list, null, 2));
let md = `# Illustrations des cartes\n\n100 illustrations à produire, une par carte. Le jeu les affiche automatiquement dès qu'elles sont dans ce dossier ; tant qu'une illustration manque, la carte montre son emoji.\n\n## Format\n- Nom de fichier : \`<ID>.webp\` (par exemple \`A02.webp\`), dans ce dossier \`art/\`.\n- Format conseillé : 1440 × 800 px (rapport 1,8:1), WebP, moins de 200 Ko chacune.\n- Le sujet reste dans le tiers central : l'image est recadrée selon la taille de la carte.\n- Après avoir ajouté des images : \`node tools/art-manifest.js\` met à jour la liste.\n\n## Droits\nVérifiez les conditions d'usage commercial de l'outil utilisé. Gardez le même outil et le même style pour les 100 images, pour que le jeu reste cohérent.\n\n## Style commun (inclus dans chaque prompt)\n${STYLE}\n\n## Direction par faction\n${Object.keys(FAC).map((k) => `- **${CA.FACTIONS[k].name}** : ${FAC[k]}`).join("\n")}\n\n`;
CA.FACTION_ORDER.forEach((f) => {
  md += `## ${CA.FACTIONS[f].name}\n\n`;
  list.filter((x) => x.faction === f).forEach((x) => { md += `### ${x.id} · ${x.name} (${x.type === "unit" ? "unité" : "sort"}, ${CA.RARITIES[x.rarity].name})\n\`${x.file}\`\n\n${x.prompt}\n\n`; });
});
fs.writeFileSync(path.join(__dirname, "../art/PROMPTS.md"), md);
console.log("art/PROMPTS.md et art/prompts.json écrits :", list.length, "prompts");
