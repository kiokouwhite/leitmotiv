# Construire le ruleset

Le **ruleset** définit la liste des stages et la façon dont on les banni. Tu le configures une fois pour ton format, puis tu le réutilises.

{% hint style="info" %}
Le stage veto concerne surtout **Smash Ultimate** (striking de stages). Pour un jeu sans sélection de stage (ex. SF6), tu n'as simplement pas besoin de cet overlay.
{% endhint %}

## Liste des stages

Le ruleset contient des stages classés **Starter** (jeu 1) et **Counterpick** (jeux suivants).

* **Ajouter un stage** : ouvre une grille visuelle avec toutes les maps disponibles (leurs images) et clique pour l'ajouter.
* **Supprimer** un stage : depuis la liste des stages actifs.

{% hint style="info" %}
Les images de stages sont dans `public/maps/`, nommées `SSBU-<NomDuStage>.png`. Elles sont associées automatiquement.
{% endhint %}

## Séquence de bans

On définit **qui banni combien**, avec un builder visuel :

* **Séquence jeu 1** : ex. `J1×2 → J2×2` puis le stage restant est joué.
* **Séquence jeux suivants** : ex. `J1×1` (le gagnant banni 1), puis le perdant choisit.

Chaque bloc s'ajuste avec `−` / `+`.

Formats courants :

| Format | Séquence jeu 1 | Jeux suivants | Stages requis |
|---|---|---|---|
| Bo3 (5 stages) | `J1×2 → J2×2` | `J1×1` | 5 |
| Bo5 (larger list) | `J1×3 → J2×4` | `J1×1` | 8 |

## Stage clause (DSR)

Coche **Stage clause** pour empêcher de rejouer un stage déjà gagné dans le même set.

## Appliquer & sauvegarder

* **Appliquer le ruleset** : envoie la config au veto.
* **Sauvegarder / Charger** : enregistre des rulesets nommés (dans `data/rulesets.json`) et recharge-les d'un clic. Crée un ruleset par format/jeu que vous utilisez.

---

➡️ Ensuite : [Dérouler le veto](deroulement.md)
