# Codex Arcanum

Jeu de cartes à collectionner fantasy, jouable dans le navigateur contre une IA. 100 cartes, 5 factions, 4 lignes de bataille, des parties de 5 à 10 minutes.

**Jouer :** ouvrir `index.html` (ou publier le dépôt sur GitHub Pages). Aucune installation, aucune dépendance.

## Contenu

| Écran | Rôle |
|---|---|
| Jouer | Choisir son deck (5 decks prêts + vos decks) et la faction adverse, puis lancer la partie |
| Cartes | Les 100 cartes, avec filtres (faction, type, coût) et recherche |
| Decks | Construire et enregistrer ses decks (sauvegarde locale du navigateur) |
| Règles | Les règles complètes, aussi dans [RULES.md](RULES.md) |

## Structure du code

```
index.html        page unique
css/style.css     styles
js/cards.js       données : factions, mots-clés, 100 cartes, génération du texte des cartes
js/engine.js      TOUTES les règles (sans interface, testable)
js/ai.js          adversaire automatique
js/ui.js          interface (n'implémente aucune règle)
tools/check.js    audit des cartes + tournoi IA contre IA
tools/serve.js    petit serveur local
```

Le texte de chaque carte est **généré** à partir de ses effets : le texte affiché et ce que fait le moteur ne peuvent pas diverger.

## Vérifier l'équilibre

```bash
node tools/check.js 40
```

Affiche l'audit du budget de chaque carte, la validité des decks prêts à jouer, puis un tournoi (taux de victoire par faction, durée moyenne, avantage du premier joueur). Voir [AUDIT.md](AUDIT.md).

## Ajouter une carte

Une carte est une ligne dans `js/cards.js` (voir les exemples en tête de fichier). Après ajout, lancer `node tools/check.js` : l'audit signale toute carte hors du budget de puissance de son coût.
