# Chat & alertes

## Chat en overlay

| Overlay | Source |
|---|---|
| `/twitch-chat` | Chat Twitch |
| `/youtube-chat` | Chat YouTube |
| `/combined-chat` | **Twitch + YouTube fusionnés**, avec un badge de couleur différente par plateforme |

Réglages courants : couleurs de fond et de texte (suivent le thème), filtrage par type de badge côté Twitch.

{% hint style="info" %}
Le **chat combiné** est le plus pratique quand tu streames sur les deux plateformes : un seul overlay, tout le monde dans la même colonne, la source (Twitch/YouTube) reste identifiable par la couleur.
{% endhint %}

## Alertes

| Overlay | Événements |
|---|---|
| `/twitch-alerts` | Follows, subs, raids, bits |
| `/youtube-alerts` | Super Chats, nouveaux membres, paliers |

Tu peux **tester** les alertes depuis le panneau (boutons de test sub / bits / super chat / membre) pour vérifier le rendu avant le live.

## Bonnes pratiques OBS

* Mets les overlays de chat/alertes **au-dessus** du reste dans la liste des sources.
* Les alertes sont ponctuelles : place-les là où elles ne masquent pas le scoreboard ni le gameplay.
