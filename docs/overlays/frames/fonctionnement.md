# Fonctionnement

## Ce que l'overlay affiche

Jusqu'à **6 cadres décoratifs**, vides et **transparents à l'intérieur**. Ils ne diffusent aucune image : ils **habillent** des sources vidéo que tu places dessous dans OBS (webcams, captures de console, médias).

Chaque cadre a sa propre position, sa taille, son ratio, et peut porter un **label** (ex. `Player 1`) et un **fond**.

Les couleurs suivent le **thème actif** — aucun réglage manuel.

## Cadres ou Cam ?

| | [Cam](../cam.md) | **Cadres** |
| --- | --- | --- |
| Nombre | 1 ou 2 | jusqu'à **6** |
| Infos joueur | oui (tag, pronoms, perso…) | non, juste un label |
| Usage type | face-cam des joueurs | grille de setups, multi-sources |

## Dans OBS

1. Ajoute l'overlay `/frames` en **Source Navigateur** (1920 × 1080).
2. Place chaque **Capture de périphérique vidéo** **en dessous** de la source Cadres.
3. Redimensionne chaque capture pour qu'elle remplisse la zone du cadre correspondant.

{% hint style="info" %}
Commence toujours par une **disposition rapide** (grille 4, 3 colonnes…), puis ajuste : c'est bien plus rapide que de placer six cadres à la main.
{% endhint %}

***

➡️ Ensuite : [Customisation](customisation.md)
