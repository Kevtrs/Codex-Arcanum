# Audit de l'ancien prototype et refonte

## Ce qu'était le dépôt
Un seul fichier `index.html` de 581 Ko / 7 200 lignes : 120 cartes, 10 onglets, et au moins 12 blocs `<script>` empilés par patchs successifs (« product depth », « investor polish », surcharges de fonctions par réaffectation).

## Problèmes constatés

**1. Il n'y avait pas de jeu.** Le « duel » comparait un score de deck à un nombre aléatoire :
`victoire = deckScore() >= 110 + random()*85`. Aucune carte n'était jouée, aucune règle appliquée. Les quelque 40 effets décrits sur les cartes (`APPLY_STATUS`, `COUNTERSPELL`, `TELEPORT_UNIT`…) n'étaient exécutés par aucun code.

**2. Textes et données sans lien.** Le texte d'une carte était saisi à la main, à côté de données d'effets séparées. Rien ne garantissait qu'ils disent la même chose.

**3. Cartes sans trame.** 120 cartes avec des mots-clés utilisés 1 à 2 fois (`AGILE` : 1 carte, `PROTEGE`/`RIPOSTE` : 2) et trois types de cartes (équipements, techniques, ultimes) dont le fonctionnement n'était défini nulle part. Les statistiques n'obéissaient à aucun budget (rareté et coût indépendants de la puissance).

**4. Le produit était un pitch, pas un jeu.** Wallet simulé, marketplace, « valeur estimée », Codex Pass, pitch investisseur, whitepaper, packs payants, mises en or : tout cela au détriment du jeu lui-même. Plusieurs versions du même écran coexistaient.

**5. Code non maintenable.** Fonctions redéfinies par réaffectation (`updateOrDisplay = function…`), CSS dupliqué, logique de jeu mêlée au rendu, aucun test.

## Ce qui a été fait

| Avant | Après |
|---|---|
| 1 fichier de 7 200 lignes | 4 fichiers JS séparés par responsabilité (données, règles, IA, interface) |
| Duel = score vs hasard | Vrai jeu : plateau à 4 lignes, Aether, assaut, combat, mots-clés, sorts |
| 120 cartes, 4 types | **100 cartes, 2 types** (unité, sort), 5 factions × 14 unités + 6 sorts |
| Textes écrits à la main | Textes **générés** depuis les effets |
| Stats libres | **Budget de puissance** : une unité de coût *c* vaut 2c + 2 points, chaque mot-clé et effet a un prix |
| Raretés = puissance | Raretés = spectacle ; une carte rare n'est pas plus forte à coût égal |
| Économie (or, packs, marché, wallet, pass) | Supprimée. Toutes les cartes sont disponibles, on construit son deck |
| Aucun test | `node tools/check.js` : audit des cartes + tournoi IA contre IA |

## La trame des cartes
Chaque faction a une doctrine, et chaque carte découle de sa doctrine, de son rôle et de sa position sur la courbe de coût :

- **Aurélia** défend (Garde, Égide, Soutien) et soigne.
- **Draconis** attaque (Charge, Rage, Percée) et brûle la Citadelle.
- **Sylve** submerge (Vif, Rejetons, étourdissement).
- **Arcanes** contrôle (pioche, renvoi, Aether, destruction).
- **Abysses** recycle (Dernier souffle, résurrection, drain).

Chaque faction a la même structure : 14 unités (6 communes, 4 rares, 3 épiques, 1 légendaire) et 6 sorts (2 / 2 / 1 / 1). Les noms et l'ambiance de l'univers d'origine ont été conservés.

## Résultats de l'équilibrage
Tournoi IA contre IA, 1 200 parties, un deck prêt à jouer par faction :

| Faction | Taux de victoire |
|---|---|
| Aurélia | 52,1 % |
| Draconis | 46,9 % |
| Sylve | 49,2 % |
| Arcanes | 53,8 % |
| Abysses | 48,1 % |

Avantage du premier joueur : 53 % (compensé par la 5e carte et l'Aether bonus du second). Durée moyenne : 9,4 tours par joueur. Aucune partie sans vainqueur.

## Limites connues
- L'équilibre est mesuré avec l'IA du jeu, pas avec des humains : les écarts réels peuvent différer. À revérifier après quelques parties humaines.
- L'IA est correcte mais n'anticipe pas plus d'un coup (elle ne joue pas autour des sorts adverses).
- Pas de mode en ligne ni de collection à débloquer : volontaire, pour livrer un jeu complet et lisible.
- Les illustrations sont des emojis ; remplaçables carte par carte via le champ `e` de `js/cards.js`.
