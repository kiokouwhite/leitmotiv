# Customisation

## Où ça se règle

Panneau → onglet **Customisation** → catégorie **SSBU** → **Scoreboard**.

<figure><img src="../../.gitbook/assets/scoreboard-custom-panneau.png" alt="Panneau de customisation du scoreboard"><figcaption><p>Les réglages à gauche, deux aperçus en direct à droite.</p></figcaption></figure>

## Les sept onglets

| Onglet | Contenu |
| --- | --- |
| **Scoreboard** | **Visibilité** des champs (pronoms, tag/sponsor, seed), **Position & taille** (ancrage, X/Y, tailles de texte), **Géométrie des cartes** (dimensions, arrondi, forme, inclinaison, disposition), fond, couleurs et effets |
| **Personnage** | Affichage des personnages : taille, position |
| **Score** | Le chiffre du score : taille, alignement, décalage, et le carré derrière |
| **Événement** | La barre du haut : texte, taille, style de la barre |
| **Logo** | Le logo central : image, taille, opacité, masquage |
| **Drapeaux** | Affichage et position des drapeaux |
| **Particules** | Type de particules et teinte |

### Aplatir le texte

Dans l'onglet **Scoreboard** → **Géométrie des cartes** → **Dimensions**, la case **« Aplatir le texte s'il dépasse la largeur »** change la façon dont un pseudo trop long est traité :

| | Décoché *(défaut)* | Coché |
| --- | --- | --- |
| **Carte joueur** | S'élargit pour contenir le texte | Reste à la **largeur min** |
| **Texte** | Taille inchangée | **Comprimé horizontalement** pour rentrer |

Avantage : les deux cartes gardent la même largeur, donc la barre reste **symétrique** et le VS naturellement centré, quelle que soit la longueur des pseudos.

{% hint style="warning" %}
Sur un pseudo très long, la compression devient forte et le texte peut finir par être difficile à lire. Augmente alors la **largeur min** plutôt que de tout miser sur l'aplatissement.
{% endhint %}

### Centrage horizontal

Dans l'onglet **Scoreboard** → **Position & taille** → **Ancrage & position**, deux modes :

| Mode | Ce qui est aligné sur le centre de l'écran |
| --- | --- |
| **Barre entière** *(défaut)* | Le bloc scoreboard dans son ensemble |
| **Logo / VS** | Le bloc central (VS / logo) — la barre se décale en conséquence |

Les deux donnent le même résultat quand les deux joueurs ont la même largeur. Dès que ce n'est plus le cas (un pseudo bien plus long que l'autre), la barre devient **asymétrique** : centrer la barre décale visuellement le VS, alors que le mode **Logo / VS** le remet pile au milieu de l'image.

{% hint style="info" %}
Sans effet si l'ancrage choisi n'est pas un ancrage **centré** (haut-centre, centre, bas-centre).
{% endhint %}

## Les aperçus en direct

Deux aperçus, à droite du panneau :

* **Preview en direct** — le scoreboard seul, tel qu'il sortira ;
* **Preview master overlay** — le même, replacé dans ton [master overlay](../../overlays/master.md), pour vérifier qu'il ne chevauche pas un autre calque.

{% hint style="info" %}
Tu peux changer le **fond de l'aperçu** (bouton *Fond preview*) pour juger le rendu sur une image de gameplay plutôt que sur du noir.
{% endhint %}

## Thèmes et presets

Les **couleurs** viennent du [thème](../../apparence/themes.md) actif (ou de ton [thème custom](../../apparence/theme-custom.md)) et s'appliquent à tous les overlays d'un coup.

Une fois ton scoreboard réglé, enregistre l'ensemble comme [preset de scoreboard](../../apparence/presets.md) pour le retrouver en un clic.
