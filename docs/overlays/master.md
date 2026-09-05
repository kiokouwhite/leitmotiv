# Master (tout-en-un)

L'overlay **Master** compose **plusieurs overlays en une seule** Source Navigateur OBS. Au lieu d'empiler 8–10 sources, tu as **une seule** source par scène.

## Pourquoi l'utiliser

* **Moins de sources** à gérer dans OBS.
* **Moins de charge GPU** et moins de risque de décalage entre calques.
* Une **scène = une URL** : tu bascules de scène dans OBS en changeant de source.

## URLs

* `/master` — suit le master « courant ».
* `/master/<id>` — une scène master précise. Tu peux en avoir plusieurs (une par moment du stream : pré-show, match, pause…).

Les liens exacts sont listés dans le menu **Overlays ▾ → 🎛 Master Overlay** en haut du panneau (rempli automatiquement selon les masters que tu as créés).

## Composer une scène master

Depuis le panneau, tu choisis **quels overlays** apparaissent dans le master, leur **ordre** (calques) et leur **position**. Chaque master est indépendant et persiste au redémarrage.

{% hint style="info" %}
Approche recommandée pour OBS : crée un master par **scène type** (ex. « Match », « Pause », « Bracket »), ajoute chacun comme une Browser Source dans la scène OBS correspondante, et tu changes d'ambiance en changeant de scène OBS.
{% endhint %}

{% hint style="warning" %}
Le Master est puissant mais moins souple qu'OBS pour repositionner à la volée. Si tu bouges souvent une source pendant le live, garde-la en source OBS séparée plutôt que dans le master.
{% endhint %}
