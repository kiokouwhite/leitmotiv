# YouTube

Chat, viewers et alertes pour les streams YouTube Live.

## Connexion

La connexion YouTube utilise **OAuth 2** via la Google Cloud Console.

1. Sur [console.cloud.google.com](https://console.cloud.google.com) : crée un projet, active l'**API YouTube Data v3**.
2. Crée des identifiants **OAuth 2.0 Client ID** (type *Application Web*).
3. **Redirect URI autorisée** : `http://localhost:3002/auth/youtube/callback`
4. Panneau → onglet **Paramètres** → section **YouTube** : colle **Client ID** + **Client Secret** → **Sauvegarder**.
5. Autorise le compte quand l'appli te le demande.

{% hint style="warning" %}
Les quotas de l'API YouTube sont limités par jour. Évite de rafraîchir le chat de façon excessive si tu enchaînes de longues sessions.
{% endhint %}

## Overlays disponibles

| Overlay | URL |
|---|---|
| **Chat YouTube** | `/youtube-chat` |
| **Viewers YouTube** | `/youtube-viewer` |
| **Alertes YouTube** | `/youtube-alerts` (Super Chats, nouveaux membres, paliers) |
| **Chat combiné** | `/combined-chat` (Twitch + YouTube ensemble) |

Voir [Chat & alertes](chat.md).
