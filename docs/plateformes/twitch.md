# Twitch

Intégration Twitch : compteur de viewers, chat, alertes, prédictions.

## Connexion

1. Va sur [dev.twitch.tv/console](https://dev.twitch.tv/console) → **Register Your Application**.
2. **OAuth Redirect URL** : `http://localhost:3002/auth/twitch/callback`
3. Récupère le **Client ID** et génère un **Client Secret**.
4. Panneau → onglet **Paramètres** → section **Twitch** : colle Client ID + Secret → **Sauvegarder**.
5. Clique **Connecter le compte Twitch** pour autoriser le compte broadcaster (nécessaire pour les abonnés et les prédictions).

{% hint style="info" %}
Deux niveaux d'accès :
- **App token** (Client ID/Secret) : suffit pour le **compteur de viewers**.
- **OAuth broadcaster** (le bouton *Connecter*) : requis pour **abonnés**, **prédictions**, followers, bits.
{% endhint %}

{% hint style="warning" %}
La Redirect URL configurée sur Twitch doit correspondre **exactement** à `http://localhost:3002/auth/twitch/callback`. En multi-PC avec une autre adresse, adapte-la.
{% endhint %}

## Ce que tu obtiens

| Fonction | Overlay / endroit |
|---|---|
| **Viewers** | `/twitch-viewer` |
| **Chat** | `/twitch-chat` (filtrable par badge) |
| **Alertes** | `/twitch-alerts` (follows, subs, raids, bits) |
| **Prédictions** | Lancées et gérées depuis le panneau |

Voir aussi [Chat & alertes](chat.md).
