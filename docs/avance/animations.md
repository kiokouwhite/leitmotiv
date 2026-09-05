# Animations entrée/sortie

Configure comment chaque overlay **apparaît** et **disparaît** quand tu l'affiches ou le masques.

## Types d'animation

| Type | Entrée | Sortie |
|---|---|---|
| **Fondu** | Opacité 0→1 | Opacité 1→0 |
| **Glisse haut** | Vient du bas | Part vers le haut |
| **Glisse bas** | Vient du haut | Part vers le bas |
| **Glisse gauche / droite** | Vient du côté opposé | Part sur le côté |
| **Échelle** | Grandit depuis 0 | Rétrécit |
| **Zoom** | Zoom avant | Zoom arrière |
| **Flou** | Déflou progressif | Flou progressif |

## Durée

Slider de 100 ms à 3000 ms. **400–700 ms** donne un rendu propre et professionnel.

## Tester

Les boutons **Afficher / Masquer** déclenchent l'animation directement depuis le panneau : teste avant le live.

{% hint style="success" %}
Les animations sont respectées par le **[Stream Deck](stream-deck.md)** : si tu changes le type ou la durée dans le panneau, tous tes boutons Stream Deck utilisent automatiquement la nouvelle config.
{% endhint %}

{% hint style="warning" %}
La visibilité gérée par les animations et celle gérée ailleurs (onglet du scoreboard) sont **indépendantes**. Utilise un seul système par overlay pour éviter les surprises.
{% endhint %}
