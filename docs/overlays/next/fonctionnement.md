# Fonctionnement

## Deux overlays complémentaires

| Overlay | URL | Ce qu'il affiche |
| --- | --- | --- |
| **Next Match** | `/nextmatch` | Un **bandeau « à suivre »** avec les deux joueurs du prochain match, l'événement et le round |
| **Prochains matchs** | `/upcoming` | Une **file de plusieurs matchs** à venir, avec un titre de phase et un compteur |

**Next Match** sert de bandeau discret pendant un temps mort ; **Prochains matchs** sert d'écran d'attente entre deux phases.

## D'où viennent les données

Les deux se nourrissent des sets chargés depuis **start.gg** (notamment la file de stream). Garde start.gg à jour et la liste est juste toute seule — voir [Charger un set](../../startgg/charger.md).

{% hint style="info" %}
Dans le menu **Overlays ▾** de l'appli, Next Match est rangé sous **Twitch → Layout**. C'est le même overlay que `/nextmatch`.
{% endhint %}

***

➡️ Ensuite : [Customisation](customisation.md)
