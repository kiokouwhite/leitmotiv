# Fonctionnement

## Ce que l'overlay affiche

Un ou deux **cadres de caméra**, accompagnés d'un bloc d'**infos joueur** (tag, nom, pronoms…).

Le centre du cadre est **transparent** : l'overlay ne diffuse pas d'image, il **habille** une source vidéo que tu places dessous dans OBS.

## Deux caméras indépendantes

L'overlay gère **CAM 1** et **CAM 2**, activables séparément. Chacune a sa propre taille, sa position et son label.

* **Une seule cam** : la webcam de la régie, ou une face-cam unique.
* **Les deux** : un cadre par joueur, en 1v1 offline.

## Repères de position

Les coordonnées ne partent **pas** du coin supérieur gauche :

* **X** se mesure **depuis le centre** de l'écran (0 = centré, négatif = vers la gauche),
* **Y** se mesure **depuis le bas** de l'écran.

L'overlay est calibré pour une scène **1920 × 1080**.

## Couleurs & thème

Avec un [thème custom](../../apparence/theme-custom.md), la **bordure** de la cam prend la couleur **principale** et l'**aura** la couleur **secondaire**. Aucun réglage manuel : ça suit le thème.

## Dans OBS

1. Ajoute l'overlay `/cam` en **Source Navigateur** (1920 × 1080).
2. Ajoute ta **Capture de périphérique vidéo** (webcam / capture console) **juste en dessous** dans la liste des sources.
3. Redimensionne la capture pour qu'elle remplisse la zone du cadre.

{% hint style="info" %}
Pour plusieurs cadres décoratifs indépendants (jusqu'à 6), regarde plutôt l'overlay [Cadres](../frames.md).
{% endhint %}

***

➡️ Ensuite : [Customisation](customisation.md)
