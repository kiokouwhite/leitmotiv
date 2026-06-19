# Leitmotiv — Télécommande de score 3DS (app native homebrew)

App Nintendo 3DS (homebrew) qui se connecte au serveur Leitmotiv **en WiFi sur le
réseau local** et permet de gérer le score — sans passer par le navigateur 3DS.

> **Palier 1 (M1)** : connexion + score (+1 / −1 par joueur, remise à zéro).
> On valide d'abord en **`.3dsx`** (lancé via le Homebrew Launcher) ; le **`.cia`
> installable** vient ensuite (mêmes sources, juste l'empaquetage en plus).

---

## 1. Pré-requis (à faire une fois)

1. **3DS moddée** avec CFW (Luma3DS) + le **Homebrew Launcher**.
2. **devkitPro** installé sur le PC : https://devkitpro.org/wiki/Getting_Started
   - Pendant l'install (pacman / devkitProUpdater), choisis le groupe **`3ds-dev`**.
     Ça installe : `devkitARM`, `libctru`, `citro2d`, `citro3d` et les outils
     (`3dsxtool`, `smdhtool`, `bannertool`, `makerom`).
3. Réseau : le PC **et** la 3DS sur le **même réseau WiFi**. ⚠️ Les vieilles 3DS ne
   gèrent que le **WPA2** (pas de WPA3).

> Sur Windows, lance les commandes `make` dans le shell **MSYS2 devkitPro**
> (les variables `DEVKITPRO` / `DEVKITARM` y sont déjà définies).

---

## 2. Configurer l'IP du PC

Ouvre `source/main.c` et règle ces deux lignes (en haut) :

```c
#define SERVER_HOST "192.168.1.103"   // IP de ton PC sur le réseau local
#define SERVER_PORT 3002              // port du serveur Leitmotiv
```

> L'IP s'affiche dans le log de démarrage du serveur :
> `Contrôle → http://192.168.1.103:3002/control`. Si ton routeur change l'IP du PC,
> il faudra remettre à jour (on rendra ça configurable depuis la 3DS au palier 2).

---

## 3. Compiler

Dans le dossier `3ds-remote/` :

```sh
make
```

Ça produit **`3ds-remote.3dsx`** (+ `3ds-remote.smdh`).

> Si `make` se plaint du **Makefile** (selon ta version de devkitPro) : copie le
> `Makefile` de n'importe quel exemple citro2d de devkitPro
> (`$DEVKITPRO/examples/3ds/graphics/printing/...`) dans ce dossier, puis remets
> juste les lignes `APP_TITLE` / `APP_DESCRIPTION` / `APP_AUTHOR`. Les templates
> sont identiques. Et `make clean && make` en cas de doute.

---

## 4. Lancer (via Homebrew Launcher)

1. Copie **`3ds-remote.3dsx`** dans le dossier **`/3ds/`** de la carte SD de la 3DS.
2. Sur la 3DS : ouvre le **Homebrew Launcher** → lance **« Leitmotiv Score 3DS »**.
3. Vérifie que le **serveur tourne** sur le PC (`npm run dev` ou `start.bat`).

### Utilisation
- **Écran du haut** : noms + scores des 2 joueurs, et une ligne d'état
  (« Connecté à … » ou « Erreur réseau … »).
- **Écran du bas (tactile)** : `−1` / `+1` pour chaque joueur, `RESET`, `ACTUALISER`.
- **START** : quitter l'app.
- L'app se resynchronise toute seule (~3 s) si le score change ailleurs (PC, autre télécommande).

### Test
Tape `+1` → le score doit augmenter **sur la 3DS, dans le panneau PC, et sur
l'overlay OBS** (tout passe par le même `matchState` côté serveur).

---

## 5. En cas de souci (tu es mes yeux !)

Je ne peux pas compiler ni tester sur la 3DS de mon côté. Si ça coince :
- **Erreur de compilation** → copie-colle le message complet, je corrige.
- **« Erreur réseau (-1/-2/-3) »** sur la 3DS :
  - `-1` socket impossible, `-2` connexion refusée (mauvaise IP/port, serveur éteint,
    pare-feu Windows qui bloque le port), `-3` envoi échoué.
  - Vérifie : serveur lancé, bonne IP, même WiFi, port 3002 autorisé dans le pare-feu.
- **L'app se ferme au lancement** → souvent l'init réseau ; dis-le-moi.

---

## 6. Plus tard

- **Palier 2** : IP configurable depuis la 3DS (fichier sur la SD ou écran de saisie).
- **Palier 3** : noms/persos/stage, report start.gg, etc.
- **Empaquetage `.cia` installable** : nécessite une icône (48×48 PNG), une bannière
  (256×128 PNG) + un son, un fichier `.rsf`, puis `bannertool` + `makerom`. Quand M1
  marche, fournis-moi une icône et une bannière (ou des placeholders) et je te donne
  les commandes + le `.rsf` pour générer le `.cia`.
```

## Côté serveur (déjà en place)

Endpoints utilisés par l'app (ajoutés et testés dans `server.js`) :

| Méthode | Route                 | Corps                          | Effet                          |
|---------|-----------------------|--------------------------------|--------------------------------|
| GET     | `/api/remote/state`   | —                              | `{p1tag,p1name,p1score,p2…}`   |
| POST    | `/api/remote/score`   | `{"player":1\|2,"delta":±1}`   | incrémente (clampé à 0) + émet |
| POST    | `/api/remote/reset`   | `{}`                           | remet les deux scores à 0      |
