# VS Screen & Victoire

Deux écrans plein cadre pour rythmer le stream : la **présentation** d'un set, et sa **conclusion**.

## Les piloter en direct

Les deux s'affichent et se masquent depuis les **boutons de l'en-tête** du panneau, toujours accessibles :

<figure><img src="../.gitbook/assets/boutons-vs-victoire.png" alt="Boutons Victoire et VS Screen dans l'en-tête"><figcaption><p>Les deux boutons indiquent l'état courant : <strong>Masqué</strong> ou <strong>Affiché</strong>.</p></figcaption></figure>

* **⚔ VS Screen** : un clic lance l'**animation d'entrée**, un second clic lance l'**animation de sortie**.
* **🏆 Victoire** : un clic affiche l'écran de victoire, un second le masque.

Le libellé bascule sur **« Affiché »** et le bouton passe en **doré** tant que l'overlay est à l'écran — un coup d'œil suffit pour savoir ce qui est diffusé.

## VS Screen

Écran de présentation affiché **avant** un set : les deux joueurs face à face.

Réglages : onglet **Customisation** → catégorie **SSBU** → **VS Screen**.

<figure><img src="../.gitbook/assets/vs-screen-panneau.png" alt="Panneau de réglages du VS Screen"><figcaption><p>Réglages du VS Screen, avec l'aperçu en direct à droite. (L'URL affichée dépend du port ; chez toi c'est <code>3002</code>.)</p></figcaption></figure>

Le panneau est découpé en cinq sections :

| Section | Contenu |
| --- | --- |
| **OBS** | Le rappel d'intégration : URL à coller, résolution 1920 × 1080, fond transparent |
| **Fond** | **Image de fond** (PNG/JPG/WebP en 1920×1080) et **filtres** : flou, luminosité, saturation, opacité |
| **Effets** | Vignette, scanlines, teinte de couleur |
| **Particules** | Les particules du thème en surcouche |
| **Animation** | Animations d'entrée/sortie et **minuterie d'auto-masquage** |

L'**aperçu en direct** à droite montre le rendu réel pendant que tu règles.

{% hint style="success" %}
Règle une **minuterie d'auto-masquage** (ex. 5–8 s) : l'écran se retire tout seul, tu n'as pas à y penser en plein live.
{% endhint %}

## Overlay Victoire

Écran de fin de set annonçant le **gagnant**. Mêmes sections de réglages (OBS, Fond, Effets, Particules, Animation), via **Customisation** → **SSBU** → **Victory**.

<figure><img src="../.gitbook/assets/victoire-panneau.png" alt="Panneau de réglages de l'overlay Victoire"><figcaption><p>Réglages de l'overlay Victoire — ici avec une image de fond personnalisée.</p></figcaption></figure>

{% hint style="info" %}
**Deux automatismes à connaître :**

* Le joueur affiché est **celui qui a le plus de points** dans le scoreboard — tu n'as pas à désigner le gagnant.
* L'overlay **disparaît tout seul quand le score est remis à zéro** (donc au chargement du set suivant).
{% endhint %}

## Workflow conseillé

```
VS Screen (présentation) → le set se joue → Victoire (gagnant) → set suivant
```

{% hint style="info" %}
Combine avec un **[stinger](../demarrage/overlays.md)** (`/stinger-*`) pour une transition animée entre l'écran VS et le gameplay.
{% endhint %}
