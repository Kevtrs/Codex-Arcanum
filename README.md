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
css/style.css     styles (écrans, plateau)
css/cards.css     les cartes (direction artistique « Codex » : parchemin, or, encre, couleur de faction)
tools/card-design.html  planche d'essai des cartes (ouvrir avec tools/serve.js)
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
fx/               feuilles d'animation des sorts (Spell FX Free, CC BY 4.0)
tools/test.js     tests du moteur, du profil et de la difficulté de la campagne
tools/art-import.py importe vos illustrations
tools/fx-import.js importe un pack d'animations dans fx/
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

Chaque carte affiche son illustration si le fichier `art/<ID>.webp` existe, sinon son emoji. [art/PROMPTS.md](art/PROMPTS.md) contient les 100 prompts prêts à l'emploi (format 1,6:1). Pour importer vos images, quels que soient leurs noms (identifiant ou nom de la carte) :

```bash
python tools/art-import.py "C:\chemin\vers\vos-images"
```

L'outil recadre, convertit en WebP, range dans `art/` et met à jour la liste.

## Animations

Voir [ANIMATIONS.md](ANIMATIONS.md) : comment brancher un pack d'animations en une commande.

## Crédits

Voir [CREDITS.md](CREDITS.md) : Spell FX Free (heyheythere, CC BY 4.0) pour les sorts, tsParticles et animate.css (MIT).

## Tests

```bash
node tools/test.js
```
