# Bandeau défilant

L'overlay **Ticker** (`/ticker`) fait défiler des informations en bas (ou en haut) de l'écran.

## Réglages

| Réglage | Détail |
|---|---|
| **Messages** | Un message par ligne ; ils défilent en boucle |
| **Séparateur** | Symbole entre les messages (◆, ●, ★, //, · ou personnalisé) |
| **Vitesse** | De 20 à 400 px/s (80 px/s est confortable à lire) |
| **Position** | Bas (défaut) ou haut de l'écran |
| **Style** | Couleurs de la barre et du texte (suit le thème) |

## Bonnes pratiques

* Garde des messages **courts** : planning des matchs, réseaux de l'asso, prochain event, remerciements sponsors.
* Vitesse trop rapide = illisible. Reste autour de 80–120 px/s.

{% hint style="warning" %}
Dans OBS, **ne coche jamais** « Actualiser au changement de scène » sur le Ticker : ça casse la boucle d'animation.
{% endhint %}
