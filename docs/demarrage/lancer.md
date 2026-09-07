# Lancer & se connecter

## Démarrer le serveur

Dans le dossier Leitmotiv, **double-clique sur `start.bat`**.

Ce script :

1. vérifie que Node.js est installé,
2. installe les dépendances si besoin,
3. lance le serveur sur le **port 3002**,
4. ouvre automatiquement le panneau `http://localhost:3002/control` dans ton navigateur,
5. **redémarre tout seul** après une mise à jour.

{% hint style="info" %}
Alternative en ligne de commande : `npm start` (ou `node server.js`) dans le dossier du projet.
{% endhint %}

{% hint style="warning" %}
Laisse la **fenêtre noire du terminal ouverte** pendant tout le stream : c'est le serveur. Si tu la fermes, tous les overlays s'éteignent.
{% endhint %}

## Ouvrir le panneau de contrôle

Le panneau, c'est ton poste de pilotage. URL :

```
http://localhost:3002/control
```

Garde cet onglet **ouvert en permanence** pendant le stream. Tout se pilote de là.

## Les onglets du panneau

| Onglet | À quoi ça sert |
|---|---|
| **Principal** | Le match en cours : joueurs, personnages, scores, casters, import start.gg, stage veto |
| **Customisation** | L'apparence : thèmes, presets de scoreboard, réglages fins de chaque overlay |
| **OBS** | Les liens des overlays à copier dans OBS + téléchargement de la collection OBS |
| **Paramètres** | Clés API (start.gg, Twitch, YouTube), multi-PC, accès distant |

---

➡️ Ensuite : [Configuration du tournoi](configuration-tournoi.md)
