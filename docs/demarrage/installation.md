# Installation

À faire **une seule fois** sur le PC de régie. Si l'appli est déjà installée, passe à [Lancer & se connecter](lancer.md).

## 1. Installer Node.js

Leitmotiv tourne sur Node.js.

1. Va sur [nodejs.org](https://nodejs.org/en/download) et installe la version **LTS** (18 ou supérieure).
2. Vérifie dans un terminal (PowerShell) :

```bash
node --version
npm --version
```

Les deux commandes doivent afficher un numéro de version.

## 2. Récupérer Leitmotiv

Le projet est sur GitHub. Deux options :

**Avec Git (recommandé, permet les mises à jour)**

```bash
git clone https://github.com/kiokouwhite/leitmotiv.git
cd leitmotiv
```

**Sans Git** : sur la page GitHub → bouton vert **Code → Download ZIP**, puis décompresse le dossier.

## 3. Installer les dépendances

Dans le dossier du projet :

```bash
npm install
```

Ça installe automatiquement Express et Socket.IO (le serveur et la communication temps réel).

## 4. Créer le fichier `config.json`

{% hint style="danger" %}
`config.json` contient la **clé API start.gg** et le **mot de passe** du panneau. Il n'est **jamais** partagé sur GitHub (il est ignoré volontairement). Sur un nouveau PC, il faut donc le recréer ou le recopier depuis une clé USB / le PC principal.
{% endhint %}

Au premier lancement, l'appli crée un `config.json` par défaut si besoin. Tu renseigneras ensuite depuis le panneau :

* la clé API start.gg → voir [Connexion à start.gg](../startgg/connexion.md)
* les identifiants Twitch / YouTube (optionnel) → voir [Plateformes](../plateformes/twitch.md)
* le mot de passe du panneau → voir [Lancer & se connecter](lancer.md)

{% hint style="info" %}
**Ce qui EST sur GitHub** : le code, et le fichier `sb-presets.json` (nos thèmes et presets, ex. _Hoplan_). Donc en clonant le repo tu récupères directement nos presets de scoreboard. **Ce qui n'y est PAS** : `config.json` (secrets) et le dossier `public/uploads/` (images uploadées).
{% endhint %}

## 5. Mettre à jour plus tard

Pour récupérer les dernières améliorations :

```bash
git pull
npm install
```

L'appli affiche aussi une bannière **« Mise à jour disponible »** dans le panneau quand une nouvelle version existe.

***

➡️ Ensuite : [Lancer & se connecter](lancer.md)
