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

### Débordement du texte

Dans l'onglet **Scoreboard** → **Géométrie des cartes** → **Débordement du texte**, le menu **« Si le texte est plus grand que la carte »** propose trois comportements :

| Option | Carte joueur | Texte |
| --- | --- | --- |
| **Agrandir la carte** *(défaut)* | S'élargit pour tout contenir | Taille inchangée |
| **Aplatir le texte** | Reste à la **largeur min** | **Comprimé** horizontalement |
| **Rétrécir le texte (…)** | Reste à la **largeur min** | **Coupé**, suivi de points de suspension |

Avec « Aplatir » et « Rétrécir », les deux cartes gardent la même largeur : la barre reste **symétrique** et le VS naturellement centré, quelle que soit la longueur des pseudos.

{% hint style="warning" %}
Les deux ont un défaut opposé : **Aplatir** garde le pseudo entier mais le déforme (très condensé sur un nom long), **Rétrécir** garde la typo intacte mais perd la fin du pseudo. Si aucun des deux ne convient, augmente plutôt la **largeur min**.
{% endhint %}

### Le logo qui dépasse

Dans l'onglet **Logo**, la case **« Le logo dépasse (survole le scoreboard) »** fait deux choses :

* le logo peut **sortir des cartes** au lieu d'être rogné par leurs bords ;
* il devient **indépendant des décalages X px / Y px** de la barre : quand tu déplaces le scoreboard, le logo **garde sa position à l'écran**.

Pratique pour un logo qui déborde volontairement au-dessus de la barre : tu peux recaler le scoreboard sans avoir à repositionner le logo derrière.

{% hint style="info" %}
Le **VS** n'est pas concerné : il reste solidaire de la barre (et il est de toute façon masqué dès qu'un logo est posé). La **Taille %** du scoreboard continue elle aussi de s'appliquer au logo.
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
