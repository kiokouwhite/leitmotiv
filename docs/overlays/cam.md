# Cam

L'overlay **Cam** (`/cam`) affiche un ou deux **cadres de caméra** avec les infos des joueurs.

## Où la customiser

Panneau → onglet **Customisation** → catégorie **Générique** → **Cam**.

C'est la même barre qui donne accès aux autres overlays génériques : **Cam · Cadres · Titre · Bandeau · Minuteur · Test A/V**.

<figure><img src="../.gitbook/assets/cam-panneau.png" alt="Panneau de réglages de la Cam"><figcaption><p>Les deux caméras se règlent côte à côte, avec un <strong>aperçu</strong> à droite.</p></figcaption></figure>

En haut du panneau, deux raccourcis pratiques : **📋 OBS** copie l'URL à coller dans OBS, et **Ouvrir ↗** ouvre l'overlay dans un onglet.

## Deux caméras indépendantes

Le panneau gère **CAM 1** et **CAM 2**, chacune avec sa propre case pour l'activer et ses propres réglages :

| Réglage | Détail |
| --- | --- |
| **Taille** | Slider **Largeur px** + champ numérique, et 4 presets : `320×240`, `360×270`, `480×270`, `640×360` |
| **Ratio libre** | Décoché (par défaut), les proportions sont conservées. Coche-le pour régler largeur et hauteur indépendamment |
| **Position** | **X depuis le centre** et **Y du bas**, plus trois presets : **Centre**, **Gauche**, **Droite** |
| **Label** | Une case pour l'afficher + le texte du cadre (ex. `CAM`, `CAM 2`) |

{% hint style="info" %}
Les positions sont exprimées **depuis le centre** (X) et **depuis le bas** (Y) de l'écran 1920 × 1080 — pas depuis le coin supérieur gauche.
{% endhint %}

## Infos joueur

Un bloc commun aux deux cams, activable par son interrupteur :

<figure><img src="../.gitbook/assets/cam-infos-joueur.png" alt="Réglages Infos joueur de la Cam"><figcaption><p>Le bloc <strong>Infos joueur</strong> : qui afficher, où, et quels champs.</p></figcaption></figure>

| Réglage | Détail |
| --- | --- |
| **Joueur affiché** | **J1**, **J2** ou **Les deux** |
| **Position** | **↓ Dessous** ou **↑ Dessus** du cadre |
| **Champs affichés** | Tag, Nom, Pronoms, Seeding, Réseau social, Personnage — à cocher au choix |
| **Taille police px** | Taille du texte des infos |
| **Opacité fond %** | Transparence du bandeau derrière le texte |

## Couleurs & thème

Avec un [thème custom](../apparence/theme-custom.md), la **bordure** de la cam prend la couleur **principale** et l'**aura** la couleur **secondaire**. Aucun réglage manuel : ça suit le thème.

## Dans OBS

L'overlay Cam est **transparent au centre** : place ta **Capture vidéo** (webcam / capture console) **juste en dessous** de la source Cam dans la liste OBS, et ajuste-la à la zone du cadre.

{% hint style="info" %}
Pour plusieurs cadres décoratifs indépendants (jusqu'à 6), regarde plutôt l'overlay [Cadres](frames.md).
{% endhint %}
