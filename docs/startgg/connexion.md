# Connexion à start.gg

start.gg est **la source de vérité** de nos tournois. Leitmotiv s'y connecte pour :

* charger automatiquement les participants et les sets,
* remplir le scoreboard en un clic,
* renvoyer les résultats sur la plateforme,
* calculer les Head-to-Head, stats et brackets.

## 1. Obtenir une clé API

{% hint style="warning" %}
La clé API est **personnelle et secrète**. Elle donne accès à ton compte start.gg. Ne la partage pas, ne la mets pas sur GitHub. Dans Leitmotiv elle vit dans `config.json`, qui est volontairement exclu de GitHub.
{% endhint %}

1. Connecte-toi sur [start.gg](https://start.gg).
2. Va dans **Developer Settings** : [start.gg/admin/profile/developer](https://start.gg/admin/profile/developer) (ou *Profil → Settings → Developer*).
3. Section **API Tokens / Personal Access Tokens** → **Create new token**.
4. Copie la clé générée (une longue suite de caractères).

## 2. Enregistrer la clé dans Leitmotiv

1. Panneau → onglet **Paramètres** → section **start.gg**.
2. Colle ta clé API dans le champ prévu.
3. Clique **Sauvegarder**.

La clé est mémorisée dans `config.json` : tu ne la ressaisis pas au prochain démarrage.

## 3. Charger un tournoi

1. Va dans la section start.gg du panneau.
2. Saisis le **slug** du tournoi. Le slug est la fin de l'URL start.gg :
   * URL : `https://start.gg/tournament/reverie-4/…`
   * slug : `reverie-4` (ou `tournament/reverie-4`)
3. Clique **Rechercher**.
4. Sélectionne l'**événement** (Smash Ultimate Singles, SF6…) dans le menu déroulant.
5. Clique **Charger** : les participants et les sets sont importés.

{% hint style="success" %}
Une fois connectée, tu retrouves : la liste des **sets en cours** (à charger sur le scoreboard), le **report de score**, le **Head-to-Head**, les **stats joueur**, le **bracket** et le **Top 8**.
{% endhint %}

---

➡️ Ensuite : [Charger un set](charger.md)
