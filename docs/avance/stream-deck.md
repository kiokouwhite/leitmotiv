# Stream Deck

Pilote l'affichage des overlays (et les scores) depuis un Stream Deck, **sans plugin**, avec les [animations](animations.md) configurées.

## Principe

Chaque action est une **URL** à appeler. On utilise l'action **Website** (catégorie *System*) du Stream Deck : quand tu presses le bouton, il ouvre l'URL (qui déclenche l'action côté Leitmotiv) et se referme aussitôt.

## Configuration d'un bouton

1. Ouvre le logiciel **Elgato Stream Deck** et sélectionne un bouton vide.
2. Glisse l'action **Website** dessus.
3. Colle une URL depuis la page **`/deck`** (elle liste toutes les URLs prêtes à copier).

## Format des URLs

| Type | Exemple | Effet |
|---|---|---|
| **show** | `/api/deck/cam/show` | Affiche (animation d'entrée) |
| **hide** | `/api/deck/cam/hide` | Masque (animation de sortie) |
| **toggle** | `/api/deck/cam/toggle` | Bascule visible / masqué |
| **score +** | `/api/deck/score/1/add` | +1 au joueur 1 |
| **score reset** | `/api/deck/score/reset` | Remet les scores à 0 |

Remplace `cam` par l'overlay voulu : `scoreboard`, `scoreboard-slim`, `casters`, `ticker`, `cam`, `frames`, `timer`, `stream-title`, `h2h`, `player-stats`, `bracket`, `top8`… La [page `/deck`](../demarrage/overlays.md) donne la liste complète.

{% hint style="info" %}
En multi-PC, remplace `localhost` par l'IP du PC serveur dans les URLs des boutons.
{% endhint %}

{% hint style="success" %}
Un bon set de boutons pour une soirée : show/hide **scoreboard**, **cam**, **casters**, **ticker**, **timer**, + **score +1 J1 / +1 J2 / reset**. Tu pilotes l'essentiel sans toucher au clavier.
{% endhint %}
