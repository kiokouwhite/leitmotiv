# Fonctionnement

## Ce que le bandeau affiche

Une bande qui **défile en boucle** en haut ou en bas de l'écran, composée de deux parties :

* un **badge fixe** à gauche (par défaut `INFO`),
* tes **messages**, qui défilent à la suite, séparés par un symbole.

Le bandeau **s'adapte au thème actif** : ses couleurs suivent le thème sans réglage manuel.

## L'afficher et le positionner

Dans la section **Activation** du panneau :

* **▶ Afficher le bandeau** l'envoie à l'écran (le bouton sert aussi à le masquer).
* **↑ Haut** / **↓ Bas** choisissent le bord de l'écran. L'animation d'entrée/sortie glisse depuis ce bord.

## Bonnes pratiques

* Garde des messages **courts** : planning des matchs, réseaux de l'asso, prochain event, remerciements sponsors.
* Une vitesse trop rapide est illisible. Reste autour de **80–120 px/s**.
* Trois ou quatre messages suffisent : au-delà, un viewer n'attend pas la boucle complète.

{% hint style="danger" %}
Dans OBS, **ne coche jamais** « Actualiser le navigateur quand la scène devient active » sur le Ticker : ça casse la boucle d'animation.
{% endhint %}

***

➡️ Ensuite : [Customisation](customisation.md)
