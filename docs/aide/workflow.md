# Workflow type d'un tournoi

La routine complète d'une soirée de stream, du montage au rangement. À suivre dans l'ordre.

## Avant le stream (préparation)

1. **Lancer le serveur** : double-clic sur `start.bat`. Le panneau s'ouvre. → [Lancer](../demarrage/lancer.md)
2. **Vérifier OBS** : toutes les Browser Sources sont là et à jour ? → [Configurer OBS](../demarrage/obs.md)
3. **Choisir l'apparence** : applique le **preset** de l'asso (ex. *Hoplan*) et/ou le **thème**. → [Presets](../apparence/presets.md)
4. **Connecter start.gg** : clé API + recherche du tournoi + chargement de l'événement. → [Connexion](../startgg/connexion.md)
5. **Connecter Twitch / YouTube** si besoin (viewers, chat, alertes).
6. **Préparer le veto** (Smash) : charge/applique le bon ruleset. → [Ruleset](../veto/ruleset.md)
7. **Test rapide** : affiche/masque le scoreboard, la cam, le ticker ; teste une alerte.

## Pendant un set

```
1. Charger le set depuis start.gg      → scoreboard rempli, scores à 0
2. (Smash) Nouveau veto → shifumi → bans → stage confirmé
3. Afficher le scoreboard, lancer le gameplay
4. Suivre le score avec + / − (ou Stream Deck, ou la 3DS des joueurs)
5. Fin du set → Envoyer le score sur start.gg
6. (option) Afficher H2H / stats / Top 8 pendant la transition
7. Charger le set suivant
```

→ [Charger un set](../startgg/charger.md) · [Reporter le score](../startgg/reporter.md)

## Entre les phases / pauses

* Bascule sur un écran **Pause** avec [Minuteur](../overlays/timer.md) en compte à rebours.
* Affiche les **[Prochains matchs](../overlays/next.md)** ou le **[Top 8](../startgg/bracket.md)**.
* Mets à jour le **[Ticker](../overlays/ticker.md)** (planning, réseaux, sponsors).

## Fin de soirée

1. Vérifie que **tous les résultats sont bien sur start.gg**.
2. Si tu as modifié des **presets/thèmes** et que vous travaillez à plusieurs PC : `git add sb-presets.json && git commit && git push`. → [Presets](../apparence/presets.md)
3. Coupe l'**accès distant** s'il était actif. → [Multi-PC](../avance/multi-pc.md)
4. Ferme OBS, puis la fenêtre du serveur.

{% hint style="success" %}
**Répartition à 2 personnes** : une personne sur le **panneau complet** (mise en scène, thèmes, transitions), une autre sur la **[Régie](../avance/regie.md)** ou le **[Stream Deck](../avance/stream-deck.md)** (suivi des matchs et scores).
{% endhint %}
