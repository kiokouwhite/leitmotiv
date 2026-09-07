# Fonctionnement

## Les deux écrans

| Overlay | Quand | Rôle |
| --- | --- | --- |
| **VS Screen** (`/vs-screen`) | **Avant** le set | Présente les deux joueurs face à face |
| **Victoire** (`/victory`) | **Après** le set | Annonce le gagnant |

Ce sont des écrans **plein cadre** : ils recouvrent la scène le temps de l'annonce, puis s'effacent.

## Les piloter en direct

Les deux s'affichent et se masquent depuis les **boutons de l'en-tête** du panneau, toujours accessibles :

<figure><img src="../../.gitbook/assets/boutons-vs-victoire.png" alt="Boutons Victoire et VS Screen dans l'en-tête"><figcaption><p>Les deux boutons indiquent l'état courant : <strong>Masqué</strong> ou <strong>Affiché</strong>.</p></figcaption></figure>

* **⚔ VS Screen** : un clic lance l'**animation d'entrée**, un second clic lance l'**animation de sortie**.
* **🏆 Victoire** : un clic affiche l'écran de victoire, un second le masque.

Le libellé bascule sur **« Affiché »** et le bouton passe en **doré** tant que l'overlay est à l'écran — un coup d'œil suffit pour savoir ce qui est diffusé.

## Les automatismes de l'écran Victoire

{% hint style="info" %}
* Le joueur affiché est **celui qui a le plus de points** dans le scoreboard — tu n'as pas à désigner le gagnant.
* L'overlay **disparaît tout seul quand le score est remis à zéro** (donc au chargement du set suivant).
{% endhint %}

## Workflow conseillé

```
VS Screen (présentation) → le set se joue → Victoire (gagnant) → set suivant
```

{% hint style="info" %}
Combine avec un **[stinger](../../demarrage/overlays.md)** (`/stinger-*`) pour une transition animée entre l'écran VS et le gameplay.
{% endhint %}

***

➡️ Ensuite : [Customisation](customisation.md)
