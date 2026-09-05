# Bienvenue

**Leitmotiv** est le système d'overlays de stream de l'association pour nos tournois FGC (Smash Ultimate, SF6, etc.). Il tourne en **serveur local** sur le PC de régie et communique **en temps réel** avec OBS.

Ce guide s'adresse à **tout le staff** : après l'avoir lu, tu dois pouvoir gérer un stream de A à Z sans dépendre de personne.

## Comment ça marche en une image

```
┌────────────────┐        WebSocket        ┌────────────────┐
│  Panneau de     │  ───────────────────▶  │  Overlays OBS   │
│  contrôle       │      (temps réel)       │  (Browser       │
│  /control       │  ◀───────────────────  │   Sources)      │
└────────────────┘                          └────────────────┘
        │                                            ▲
        │  écrit / lit                               │ affiche
        ▼                                            │
┌────────────────────────────────────────────────────────────┐
│   Serveur Leitmotiv (Node.js, port 3002) + config.json      │
│   Se connecte aussi à start.gg / Twitch / YouTube           │
└────────────────────────────────────────────────────────────┘
```

* Le **panneau de contrôle** (`/control`) est l'interface web où tu configures tout, en direct.
* Les **overlays** sont des pages web transparentes (1920×1080) ajoutées comme **Browser Sources** dans OBS.
* Tout ce que tu changes dans le panneau apparaît **instantanément** dans les overlays, sans recharger.
* La config est sauvegardée dans `config.json` → **rien n'est perdu** au redémarrage.

## Par où commencer

{% hint style="info" %}
Si tu prends la régie pour la première fois, lis les 4 pages de la section **Démarrage** dans l'ordre. Le reste peut se consulter au besoin.
{% endhint %}

1. [Installation](demarrage/installation.md) — mettre l'appli sur le PC
2. [Lancer & se connecter](demarrage/lancer.md) — démarrer et ouvrir le panneau
3. [Configurer OBS](demarrage/obs.md) — brancher les overlays
4. [Workflow type d'un tournoi](aide/workflow.md) — la routine complète d'une soirée de stream

## Le principe le plus important

> **start.gg est la source de vérité.** On reporte toujours les scores sur start.gg. Leitmotiv se branche dessus pour charger les sets et renvoyer les résultats. Voir [start.gg](startgg/connexion.md).
