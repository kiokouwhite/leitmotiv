# Dérouler le veto

L'overlay **Stage Veto** (`/stageveto`) montre aux joueurs et aux viewers la sélection de stage en direct.

## Étapes

1. **Lancer** : clique **Nouveau veto**.
2. **Premier bannisseur** :
   * **Shifumi** : Leitmotiv tire au sort qui banni en premier (relance automatiquement en cas d'égalité), ou
   * sélectionne manuellement **J1** ou **J2**.
3. **Bannir** : clique les stages à bannir, dans l'ordre. La grille et la barre de séquence (BAN / SELECT) se mettent à jour en temps réel.
4. **Confirmer** : quand il ne reste que le stage à jouer, il est mis en évidence. Confirme pour passer à l'affichage « stage sélectionné ».

## Jeu suivant

Après un game, clique **Jeu suivant** : le veto repart avec la **séquence jeux suivants** définie dans le ruleset. Si la **stage clause** est active, les stages déjà gagnés sont grisés.

## Boutons utiles

| Bouton | Effet |
|---|---|
| **Nouveau veto** | Démarre un veto (jeu 1) |
| **Jeu suivant** | Relance avec la séquence des games suivants |
| **Reset** | Réinitialise le veto |
| **Afficher / Masquer** | Contrôle la visibilité de l'overlay dans OBS |

{% hint style="success" %}
Workflow typique : charge le set → **Nouveau veto** → shifumi → bans → stage confirmé → on joue → **Jeu suivant** → … → set fini → [report du score](../startgg/reporter.md).
{% endhint %}
