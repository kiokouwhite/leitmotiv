# Tous les overlays

Chaque overlay est une page à ajouter en **Source Navigateur** dans OBS (1920×1080). Préfixe toutes les URLs par `http://localhost:3002` (ou l'IP du PC serveur en multi-PC).

{% hint style="info" %}
L'onglet **OBS** du panneau liste ces mêmes URLs avec un clic pour copier, et un bouton pour importer toute la collection d'un coup.
{% endhint %}

## Overlays principaux

| Overlay | URL | Description |
|---|---|---|
| **Scoreboard** | `/overlay` | Le scoreboard complet : joueurs, persos, scores, infos |
| **Scoreboard Slim** | `/overlay-slim` | Version barre compacte |
| **Commentateurs** | `/casters` | Noms + réseaux des casters |
| **Stage Veto** | `/stageveto` | Sélection de stage en direct |
| **Cam** | `/cam` | Cadre caméra + infos joueur |
| **Cadres** | `/frames` | Jusqu'à 6 cadres décoratifs |
| **Bandeau défilant** | `/ticker` | Infos qui défilent |
| **Minuteur** | `/timer` | Compte à rebours / chrono |
| **Titre du stream** | `/stream-title` | Titre / sous-titre à l'écran |

## Transitions & présentation

| Overlay | URL | Description |
|---|---|---|
| **VS Screen** | `/vs-screen` | Écran de présentation d'un set |
| **Victoire** | `/victory` | Écran de fin de set |
| **Next Match** | `/nextmatch` | Le prochain match |
| **Prochains matchs** | `/upcoming` | File des matchs à venir |
| **Stingers** | `/stinger-*` | ~60 transitions animées (ex. `/stinger-cyberpunk`, `/stinger-glitch`…) |

## Données start.gg

| Overlay | URL | Description |
|---|---|---|
| **Bracket** | `/bracket` | Arbre du bracket |
| **Top 8** | `/top8` | Tableau du Top 8 |
| **Head-to-Head** | `/h2h` | Confrontation directe entre 2 joueurs |
| **Stats joueur** | `/player-stats` | Statistiques d'un joueur |
| **Historique tournoi** | `/tournament-history` | Parcours d'un joueur dans le tournoi |

## Plateformes de stream

| Overlay | URL | Description |
|---|---|---|
| **Viewers Twitch** | `/twitch-viewer` | Compteur de viewers |
| **Chat Twitch** | `/twitch-chat` | Chat en overlay |
| **Alertes Twitch** | `/twitch-alerts` | Follows, subs, raids, bits |
| **Viewers YouTube** | `/youtube-viewer` | Compteur YouTube |
| **Chat YouTube** | `/youtube-chat` | Chat YouTube |
| **Alertes YouTube** | `/youtube-alerts` | Super Chats, membres |
| **Chat combiné** | `/combined-chat` | Twitch + YouTube fusionnés |

## Tout-en-un & outils

| Overlay | URL | Description |
|---|---|---|
| **Master** | `/master` (ou `/master/:id`) | Compose plusieurs overlays en une seule source |
| **Régie** | `/regie` | Panneau de contrôle allégé |
| **Notes** | `/notes` | Bloc-notes / rundown pour le staff |
| **AV Sync** | `/avsync` | Mire pour régler la synchro audio/vidéo |
| **Créateur de scoreboard** | `/scoreboard-custom` | Scoreboard entièrement personnalisé |
| **Créateur de casters** | `/casters-custom` | Layout casters personnalisé |
| **Ce guide** | `/guide` | Version intégrée à l'appli |

{% hint style="success" %}
Tu n'as pas besoin d'ajouter **tous** ces overlays dans OBS. Choisis ceux dont tu te sers réellement pour ton format de stream.
{% endhint %}
