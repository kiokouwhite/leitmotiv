# Télécommande 3DS (WIP)

{% hint style="warning" %}
**Fonctionnalité en cours de développement (work in progress).** La télécommande fonctionne, mais elle n'est pas encore stabilisée : les écrans et les comportements peuvent changer, et des bugs restent possibles en conditions réelles. Sur un vrai tournoi, garde la régie prête à reprendre la main et le report classique comme solution de repli.
{% endhint %}

La **télécommande 3DS** (`/remote`) laisse les **joueurs reporter leur score eux-mêmes**, depuis une vieille 3DS (ou un appareil équivalent), sans toucher à la régie.

## Pourquoi une 3DS ?

Le navigateur de la 3DS ne gère pas le JavaScript moderne : la page `/remote` est donc faite **100 % en liens** (navigation par clics, redirections), sans JS. Elle est **verrouillée** sur le navigateur 3DS (elle vérifie le User-Agent) : ouverte depuis un PC ou un téléphone classique, elle ne répond pas. C'est voulu — c'est un poste dédié pour la table de match.

## Ce que les joueurs peuvent faire

Depuis `/remote`, en quelques clics :

1. **Choisir leur set** dans la liste (`/remote/sets`) et le charger.
2. **Saisir le score** game par game (`+` sur le gagnant de chaque game).
3. Éventuellement renseigner **seed** et **personnage** joué.
4. **Envoyer** le résultat directement sur **start.gg**.

Tout ce qu'ils font met aussi à jour le scoreboard en régie en temps réel.

## Mise en place

1. Connecte la 3DS au **même réseau** que le PC serveur.
2. Ouvre le navigateur de la 3DS sur `http://<IP-du-PC>:3002/remote` (voir l'IP dans [Multi-PC](multi-pc.md)).
3. Laisse la 3DS à la table de match.

{% hint style="success" %}
Énorme gain de temps sur les gros tournois : les joueurs reportent seuls, la régie n'a plus qu'à streamer. start.gg reste la source de vérité, alimentée directement par les joueurs.
{% endhint %}

{% hint style="warning" %}
Ne « modernise » pas cette page (pas d'ajout de JS, garde le verrouillage 3DS) : c'est ce qui la fait marcher sur la console.
{% endhint %}
