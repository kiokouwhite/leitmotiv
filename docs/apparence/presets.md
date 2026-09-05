# Presets de scoreboard

Un **preset** enregistre **tout l'aspect du scoreboard** en un bloc réutilisable : disposition, géométrie des cartes, couleurs, positions/tailles de texte, image de fond, logo, particules… Idéal pour retrouver instantanément le look de l'asso (ex. nos presets **Hoplan** et **HOPLAN SF6**).

{% hint style="info" %}
**Preset vs [thème](themes.md)** : le thème = couleurs/police/particules (global à tous les overlays). Le preset = l'apparence complète du **scoreboard** uniquement. Un preset peut d'ailleurs embarquer un thème custom.
{% endhint %}

## Appliquer un preset

Onglet **Customisation** → clique la **carte du preset** (il affiche son nom, ex. *Hoplan*). Le scoreboard prend immédiatement toute sa configuration.

Le preset **Classique** (intégré) réinitialise le scoreboard aux réglages par défaut.

## Les deux boutons de sauvegarde

En bas de la Customisation :

| Bouton | Effet |
|---|---|
| **💾 Sauvegarder** | Écrase le **preset actuellement actif** avec tes changements en cours (pas de fenêtre, sauvegarde directe) |
| **➕ Nouveau preset** | Crée un **nouveau** preset : une fenêtre te demande son nom |
| **↺ Réinitialiser** | Remet le scoreboard aux valeurs par défaut |

{% hint style="success" %}
Workflow typique : tu pars du preset *Hoplan*, tu ajustes une couleur, tu cliques **Sauvegarder** → *Hoplan* est mis à jour. Pour tester une variante sans écraser, fais plutôt **Nouveau preset**.
{% endhint %}

## Modifier / renommer / supprimer

Sur la carte d'un preset (au survol), les boutons d'édition et de suppression apparaissent, comme pour les thèmes custom.

## Où sont stockés les presets (important pour le multi-PC)

Les presets sont enregistrés **côté serveur** dans le fichier `sb-presets.json`, **et ce fichier est versionné sur GitHub**.

{% hint style="success" %}
Conséquence : si tu clones / télécharges le repo Leitmotiv sur un **autre PC**, tu récupères directement nos presets (*Hoplan*, *HOPLAN SF6*…). Rien à recréer.
{% endhint %}

{% hint style="warning" %}
Si plusieurs personnes modifient les presets sur des PC différents, faites `git pull` **avant** de bosser et `git push` **après**, pour éviter les conflits sur `sb-presets.json`. À un instant donné, un seul PC devrait faire autorité sur les presets.
{% endhint %}

## Ce qu'un preset contient (aperçu)

* **Disposition** et **géométrie des cartes** (classique / cartes séparées, arrondis…)
* **Couleurs** des textes et des joueurs
* **Position & taille** des noms et du score (décalages X/Y, alignements)
* **Image de fond** (ajustement, fusion, opacité) et **effets** (contour, ombre portée)
* **Logo central** (y compris masqué)
* **Police** et **particules**
* Le **thème custom** associé, le cas échéant
