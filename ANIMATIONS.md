# Ajouter des animations

Le jeu utilise des **feuilles d'animation** (une image PNG qui contient toutes les images d'un effet, fond transparent). Chaque événement du jeu cherche l'animation qui lui convient **par mot-clé** ; s'il n'en trouve pas, il utilise des particules.

## Brancher un nouveau pack

1. Télécharger le pack, le décompresser dans un dossier.
2. Lancer l'importeur :

```bash
node tools/fx-import.js "C:\chemin\vers\le-pack"
```

3. Vérifier la ligne de crédit affichée, l'ajouter à [CREDITS.md](CREDITS.md) si besoin, puis recharger le jeu.

L'importeur lit le fichier `sheets/effects.json` des packs « FX Free » de heyheythere (même format pour tous ses packs) et copie les feuilles dans `fx/`. Pour un pack d'un autre auteur sans ce fichier, envoyez le dossier : l'adaptation prend quelques minutes.

## Quel mot-clé déclenche quoi

| Événement du jeu | Mots-clés cherchés dans les noms d'animations |
|---|---|
| Coup de mêlée | `slash`, `hit`, `spark` |
| Gros coup (5 dégâts ou plus) | `crit`, `slash`, `hit` |
| Dégâts d'un sort | `<élément>_impact` (voir ci-dessous) |
| Projectile d'un sort | `<élément>_bolt` |
| Soin | `heal` |
| Renfort | `buff`, `power`, `aura` |
| Égide / bouclier | `shield`, `ward` |
| Étourdissement | `stun` |
| Unité détruite | `splat`, `explosion`, `death` |
| Gros dégât à une Citadelle | `crit` |

**Éléments par faction** (le jeu prend le premier présent, sinon une teinte) : Aurélia `holy`, Draconis `fire`, Sylve `nature` puis `poison`, Arcanes `arcane` puis `storm`, Abysses `shadow`.

## Packs recommandés (même auteur, même style)

À chercher sur itch.io, page de [heyheythere](https://heyheythere.itch.io/) :

- **Combat FX Free** : slash, claw, hit, spark, crit, splat.
- **Buff FX Free** : buff, heal, shield, power up, sparkle, loot beam.
- **Status FX Free** : burn, poison, stun.
- **Explosion FX** (version gratuite si disponible).
- **Spell FX** (version complète, payante) : ajoute lumière, ombre, tempête et poison, plus portails, téléportations, cercles magiques, auras, murs et météores.

Vérifier la licence sur la page de chaque pack avant de l'importer.

## Animations actuellement dans le jeu

| Usage | Pack | Licence |
|---|---|---|
| Boules d'énergie et explosions de sorts (feu, glace, arcane) | Spell FX Free, heyheythere | CC BY 4.0 (crédit dans le jeu) |
| Entailles de mêlée (or, feu, violet, bleu, vert et sombre par teinte) | Weapon Slash, Cethiel | CC0 |
| Sorts de lumière (Aurélia), d'ombre (Abysses) et de nature (Sylve) | Light, Blood, Projectile, Nature, Cethiel | CC0 |
| Soins et renforts (ailes en 6 couleurs, vignes pour Sylve) | Wings, Nature, Cethiel | CC0 |
| Égide, étourdissement, invocation, mort, coups critiques | Angel Shield, Cosmic, Projectile, Light, Cethiel | CC0 |

Les feuilles de Cethiel arrivent en images séparées. `tools/fx-build.py` les assemble en feuilles et remplit le registre :

```bash
python tools/fx-build.py "<dossier des téléchargements>"
```

Les packs sont sur [OpenGameArt, page de Cethiel](https://opengameart.org/users/cethiel) : Weapon Slash, Light Magic, Blood Magic, Nature Magic, Pure Projectile, Wings, Cosmic Time, Angel Shield. Cethiel publie aussi des versions plus haute résolution sur Patreon.
