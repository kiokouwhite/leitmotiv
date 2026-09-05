# Configurer OBS

Chaque overlay est une **page web transparente** qu'on ajoute dans OBS en **Source Navigateur** (Browser Source).

## Ajouter un overlay (méthode manuelle)

1. Dans OBS, sous *Sources*, clique **+** → **Source Navigateur** → *Créer*.
2. Dans le champ **URL**, colle l'adresse de l'overlay (voir [Tous les overlays](overlays.md) ou l'onglet **OBS** du panneau).
3. Règle **Largeur = 1920** et **Hauteur = 1080**.
4. Laisse le **CSS personnalisé vide** : la transparence est déjà gérée par l'overlay.
5. Valide.

{% hint style="danger" %}
**Ne coche JAMAIS** « Actualiser le navigateur quand la scène devient active ». Ça coupe les animations et remet l'overlay à zéro en plein set.
{% endhint %}

{% hint style="info" %}
Coche **« Fermer la source quand elle n'est pas visible »** uniquement si tu veux économiser des ressources ; sinon laisse décoché pour garder l'état en direct.
{% endhint %}

## Méthode rapide : importer toute la collection

L'onglet **OBS** du panneau propose un bouton **« Télécharger la collection OBS »**. Il génère un fichier qui, importé dans OBS (*Scènes → Collections de scènes → Importer*), ajoute automatiquement **tous les overlays** déjà configurés. Un énorme gain de temps pour un nouveau PC.

## Ordre des calques recommandé

Dans OBS, la source la plus **haute** dans la liste passe **au-dessus**. Ordre conseillé :

| Position | Overlay | Rôle |
|---|---|---|
| 1 (tout en haut) | **Ticker** | Bandeau d'infos, toujours visible |
| 2 | **Cam / Cadres** | Caméras des joueurs |
| 3 | **Casters** | Commentateurs |
| 4 | **Scoreboard** | Scores et infos du match |
| 5 | **VS Screen / Victoire** | Transitions |
| 6 (tout en bas) | **Fond** | Arrière-plan |

{% hint style="success" %}
Alternative : l'overlay **[Master](../overlays/master.md)** compose plusieurs overlays dans **une seule** Browser Source. Moins de sources à gérer, moins de charge GPU.
{% endhint %}

## Placer une webcam sous un overlay Cam

L'overlay **Cam** ne fait qu'afficher le cadre + les infos joueur ; il est transparent au milieu. Dans OBS, place ta **Capture de périphérique vidéo** (webcam / capture 3DS/Switch) **juste en dessous** de la source Cam, et redimensionne-la pour qu'elle rentre dans la zone.

---

➡️ Ensuite : [Tous les overlays](overlays.md)
