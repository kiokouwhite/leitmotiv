# Bracket & Top 8

Deux overlays pour montrer l'état du tournoi, alimentés en direct par start.gg.

## Bracket (`/bracket`)

Affiche l'arbre du bracket en overlay.

1. Dans la section Bracket du panneau, choisis la **phase** (ou le pool / phase group) à afficher.
2. Envoie vers l'overlay.
3. Il se met à jour au fur et à mesure que les résultats sont reportés sur start.gg.

{% hint style="info" %}
Pour un gros bracket, préfère afficher une **phase précise** (ex. le bracket du Top 8) plutôt que l'intégralité, qui devient illisible à l'écran.
{% endhint %}

## Top 8 (`/top8`)

Un tableau dédié au **Top 8**, plus lisible et plus stylé que le bracket complet. Parfait pour la présentation des phases finales : on affiche le Top 8 pendant les temps morts, puis on bascule sur le scoreboard pour les matchs.

## Rafraîchissement

Les deux overlays lisent les données start.gg. Après avoir [reporté un score](reporter.md), le bracket reflète le nouvel état (parfois après un court délai / un rafraîchissement depuis le panneau).

{% hint style="warning" %}
Si le bracket semble figé, vérifie que le résultat a bien été **envoyé sur start.gg** et relance l'actualisation depuis le panneau.
{% endhint %}
