# VS Screen & Victoire

Deux écrans plein cadre pour rythmer le stream : la **présentation** d'un set et sa **conclusion**.

## VS Screen (`/vs-screen`)

Écran de présentation affiché **avant** un set : les deux joueurs face à face.

* **Image de fond** : upload (PNG/JPG/WebP) ou URL, avec filtres (luminosité, contraste, saturation), vignette, scanlines, teinte de couleur.
* **Overrides par joueur** : tu peux forcer une image/couleur spécifique pour J1 et J2.
* **Particules** du thème en surcouche (désactivables).
* **Animations** d'entrée et de sortie + **minuteur d'auto-masquage** (l'écran se retire seul après X secondes).

## Overlay Victoire (`/victory`)

Écran de fin de set annonçant le **gagnant**. Mêmes options visuelles (fond, filtres, vignette, scanlines, teinte, overrides joueur, animations, auto-masquage).

Tu peux le **tester** depuis le panneau (bouton de test) et le **masquer** manuellement.

## Workflow conseillé

```
VS Screen (présentation) → le set se joue → Victoire (gagnant) → set suivant
```

{% hint style="info" %}
Combine avec un **[stinger](../demarrage/overlays.md)** (`/stinger-*`) pour une transition animée entre l'écran VS et le gameplay.
{% endhint %}

{% hint style="success" %}
Règle un **auto-masquage** (ex. 5–8 s) pour ne pas avoir à masquer l'écran à la main pendant le live.
{% endhint %}
