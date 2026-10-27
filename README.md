# Codex Arcanum

Jeu de cartes à collectionner fantasy, jouable dans le navigateur contre une IA. 100 cartes, 5 factions, 4 lignes de bataille, des parties de 5 à 10 minutes.

**Jouer :** ouvrir `index.html` (ou publier le dépôt sur GitHub Pages). Aucune installation, aucune dépendance.

## Contenu

| Écran | Rôle |
|---|---|
| Jouer | Niveau, série de jours, campagne, défi du jour, quêtes, partie libre |
| Voie | La campagne : 5 chapitres, 15 duels, histoire |
| Cartes | Les 100 cartes (25 à débloquer), filtres et recherche |
| Decks | Construire, enregistrer, partager (code) ses decks |
| Profil | Statistiques, collection, 16 succès, réglages |
| Règles | Règles complètes, aussi dans [RULES.md](RULES.md) |

## Structure du code

```
index.html        page unique (installable, fonctionne hors-ligne)
css/style.css     styles (cartes Vitrail, plateau, effets)
js/cards.js       données : factions, mots-clés, 100 cartes, génération du texte
js/engine.js      TOUTES les règles (sans interface, testable)
js/ai.js          adversaire automatique (3 niveaux)
js/meta.js        campagne, quêtes, succès, niveaux : données de progression
js/profile.js     profil du joueur : XP, récompenses, série, sauvegarde
js/audio.js       sons synthétisés et vibrations
js/vfx.js         effets visuels des sorts (tsParticles) et mouvements (animate.css)
js/ui.js          écrans (accueil, campagne, cartes, decks, profil, règles)
js/battle.js      combat : plateau, animations, mulligan, conseils, résultat
art/              illustrations des cartes (voir art/PROMPTS.md)
vendor/           tsParticles et animate.css (licence MIT), copiés pour le hors-ligne
tools/test.js     tests du moteur, du profil et de la difficulté de la campagne
tools/check.js    audit du budget des cartes + tournois IA contre IA
```

Le texte de chaque carte est **généré** à partir de ses effets : le texte affiché et ce que fait le moteur ne peuvent pas diverger.

## Vérifier l'équilibre

```bash
node tools/check.js 40
```

Affiche l'audit du budget de chaque carte, la validité des decks prêts à jouer, puis un tournoi (taux de victoire par faction, durée moyenne, avantage du premier joueur). Voir [AUDIT.md](AUDIT.md).

## Ajouter une carte

Une carte est une ligne dans `js/cards.js` (voir les exemples en tête de fichier). Après ajout, lancer `node tools/check.js` : l'audit signale toute carte hors du budget de puissance de son coût.

## Illustrations

Chaque carte affiche son illustration si le fichier `art/<ID>.webp` existe, sinon son emoji. [art/PROMPTS.md](art/PROMPTS.md) contient les 100 prompts prêts à l'emploi et le format attendu. Après avoir ajouté des images : `node tools/art-manifest.js`.

## Crédits des effets

- [tsParticles](https://github.com/tsparticles/tsparticles) (MIT) pour les particules.
- [animate.css](https://github.com/animate-css/animate.css) (MIT) pour les mouvements d'interface.

## Tests

```bash
node tools/test.js
```
