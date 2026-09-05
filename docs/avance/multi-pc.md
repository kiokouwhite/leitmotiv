# Multi-PC & accès distant

## Multi-PC (réseau local)

Utilise Leitmotiv sur un PC dédié pendant qu'OBS tourne sur un autre PC du **même réseau**.

1. **Relie les deux PC** au même réseau (Ethernet de préférence, plus stable que le Wi-Fi).
2. **Trouve l'IP** du PC serveur : l'onglet **Paramètres → Multi-PC** liste les IP locales disponibles (ex. `192.168.1.42`).
3. **Sur le PC OBS**, ajoute les Browser Sources avec l'IP à la place de `localhost` :
   ```
   http://192.168.1.42:3002/overlay
   ```
4. Tu peux aussi ouvrir le **panneau** depuis un autre PC : `http://192.168.1.42:3002/control`.

{% hint style="warning" %}
**Pare-feu** : si la connexion échoue, autorise le **port 3002** sur le PC serveur. *Panneau de configuration → Pare-feu Windows → Règles de trafic entrant → Nouvelle règle → Port → TCP 3002 → Autoriser*.
{% endhint %}

{% hint style="danger" %}
Dès que le panneau est joignable depuis d'autres machines, **mets un mot de passe** (onglet Paramètres). Voir [Lancer & se connecter](../demarrage/lancer.md).
{% endhint %}

## Accès distant (hors réseau local)

Leitmotiv intègre un **tunnel d'accès distant** : il expose ton serveur local sur une URL publique temporaire, pour qu'une personne **en dehors de ton réseau** (un commentateur à distance, la [télécommande 3DS](remote-3ds.md) d'un autre lieu…) puisse y accéder.

* Se configure et se démarre/arrête depuis l'onglet **Paramètres → Accès distant**.
* Une URL publique est générée quand le tunnel est actif.

{% hint style="danger" %}
Une URL publique rend ton panneau **accessible depuis Internet**. **Toujours** un mot de passe fort, et **coupe le tunnel** dès que tu n'en as plus besoin.
{% endhint %}

{% hint style="info" %}
Pour un usage 24/7 (bot, services de l'asso), on passe plutôt par l'hébergement dédié — mais pour un simple accès ponctuel pendant un event, le tunnel intégré suffit.
{% endhint %}
