# Dépannage (FAQ)

## Le serveur / le panneau

**`start.bat` se ferme aussitôt ou dit « Node.js non installé ».**
Node.js n'est pas installé (ou pas dans le PATH). Réinstalle-le depuis [nodejs.org](https://nodejs.org) puis relance. → [Installation](../demarrage/installation.md)

**Le panneau ne s'ouvre pas sur `localhost:3002`.**
La fenêtre noire du serveur est-elle bien ouverte ? Si un autre logiciel occupe le port 3002, ferme-le. Sinon relance `start.bat`.

**J'ai oublié le mot de passe du panneau.**
Il faut le réinitialiser côté `config.json` / relancer la configuration. Demande à la personne qui gère l'installation.

## Les overlays dans OBS

**L'overlay est tout noir (pas transparent).**
Ne mets **aucun** CSS personnalisé dans la Browser Source, et vérifie que l'URL est la bonne. La transparence est automatique.

**L'overlay ne se met pas à jour / est figé.**
1. Vérifie le voyant **« Connecté »** en haut du panneau.
2. Dans OBS, clic droit sur la source → **Actualiser**.
3. Vérifie que tu n'as **pas** coché « Actualiser au changement de scène » (ça casse les animations). → [Configurer OBS](../demarrage/obs.md)

**Les animations se coupent en changeant de scène.**
Décoche « Actualiser le navigateur quand la scène devient active » sur la source concernée (surtout le Ticker).

## start.gg

**« Clé API invalide » ou rien ne se charge.**
Regénère une clé sur start.gg (Developer Settings) et recolle-la dans Paramètres → start.gg. → [Connexion](../startgg/connexion.md)

**Je ne trouve pas mon tournoi.**
Utilise le **slug** exact (la fin de l'URL start.gg, ex. `reverie-4`), pas le titre affiché.

**Le bracket reste figé après un match.**
Le résultat a-t-il bien été **envoyé sur start.gg** ? Puis relance l'actualisation depuis le panneau. → [Reporter](../startgg/reporter.md)

## Multi-PC

**Le PC OBS ne voit pas les overlays.**
1. Même réseau que le PC serveur ?
2. Bonne **IP** (Paramètres → Multi-PC) au lieu de `localhost` ?
3. **Port 3002 autorisé** dans le pare-feu Windows du PC serveur ? → [Multi-PC](../avance/multi-pc.md)

## Presets & thèmes

**J'ai changé de PC et je n'ai plus le preset Hoplan.**
As-tu bien **cloné/pull** le repo ? `sb-presets.json` est versionné sur GitHub, donc `git pull` le ramène. En revanche `config.json` (secrets) et `public/uploads/` (images/logos uploadés) ne sont **pas** sur GitHub — recopie-les à la main. → [Presets](../apparence/presets.md)

**Mon preset n'a pas gardé le logo.**
Le logo doit être enregistré **dans** le preset. Recharge le preset, remets le logo, puis **💾 Sauvegarder**.

## La 3DS

**La page `/remote` ne s'affiche pas sur mon téléphone/PC.**
C'est normal : `/remote` est **verrouillée sur le navigateur 3DS**. Utilise une 3DS, sur le même réseau. → [Télécommande 3DS](../avance/remote-3ds.md)

## Règle d'or

{% hint style="info" %}
En cas de doute pendant un live : **start.gg fait foi**. Corrige d'abord sur start.gg si besoin, puis recharge le set dans Leitmotiv. Le reste (scoreboard, overlays) n'est qu'un affichage qu'on peut toujours réafficher.
{% endhint %}
