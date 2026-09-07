# Score

## Envoyer sur start.gg

Si tu es connecté·e à start.gg et que le set courant vient de start.gg, un bouton **« Envoyer sur start.gg »** apparaît. Il reporte le score final directement sur la plateforme.

{% hint style="danger" %}
**start.gg est la source de vérité.** On reporte toujours le résultat sur start.gg (via ce bouton, ou via la [télécommande 3DS](../../avance/remote-3ds.md), ou directement sur start.gg). Le scoreboard n'est qu'un affichage : ce qui compte pour le bracket, c'est ce qui est sur start.gg.
{% endhint %}

Détails complets : [Reporter le score](../../startgg/reporter.md).

## Match depuis start.gg

Le bouton **« Match depuis start.gg »** (dans le panneau du milieu) ouvre une fenêtre pour charger un set directement depuis start.gg, sans quitter l'onglet **Principal**.

* Si un tournoi est déjà configuré, la fenêtre affiche la **liste des sets** en cours / en attente. Clique sur un set : les **deux joueurs** et le **round** remplissent le scoreboard automatiquement, les scores repassent à 0, et la fenêtre se ferme.
* Si aucun tournoi n'est encore connecté, la fenêtre affiche le bloc de **recherche / connexion** pour en choisir un.

{% hint style="info" %}
C'est le raccourci le plus rapide pour remplir le scoreboard en régie. Le détail complet (file de stream, vérifications avant de lancer) est sur la page [Charger un set](../../startgg/charger.md).
{% endhint %}

## Contrôle par Stream Deck

Les scores peuvent aussi se piloter depuis un Stream Deck :

* `/api/deck/score/1/add` — +1 au joueur 1
* `/api/deck/score/2/add` — +1 au joueur 2
* `/api/deck/score/reset` — remet à 0

Voir [Stream Deck](../../avance/stream-deck.md).

***

➡️ Ensuite : [Commentateurs](../casters.md)
