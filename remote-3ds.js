// ============================================================================
//  remote-3ds.js — Télécommande de score « 3DS only » (module additif, isolé)
// ----------------------------------------------------------------------------
//  Monté sur /remote. Ne modifie AUCUNE route existante.
//  - Accès réservé aux navigateurs Nintendo 3DS / New 3DS / 2DS (filtre User-Agent).
//  - Page volontairement « préhistorique » : aucun JavaScript, aucune variable CSS,
//    aucun WebSocket/fetch, et SURTOUT aucun formulaire POST — uniquement des liens
//    <a href> traités en GET. Le navigateur NetFront de la 3DS ignore l'attribut
//    action des <form> (il poste vers la page courante -> « Cannot POST /remote »),
//    alors qu'il suit parfaitement les liens. On met donc l'action dans l'URL.
//  - Met à jour matchState.playerX.score puis émet 'stateUpdate' : les overlays OBS
//    se mettent à jour en direct, exactement comme depuis le panneau de contrôle.
//
//  POUR RETIRER LA FONCTIONNALITÉ : supprimer ce fichier + les 2 lignes de montage
//  ajoutées dans server.js (le require en haut et l'appel mountRemote3DS).
// ============================================================================

'use strict';

// UA des navigateurs Nintendo : « Nintendo 3DS » couvre aussi « New Nintendo 3DS »
// et la 2DS ; « NintendoBrowser » apparaît sur le navigateur New 3DS. La Wii U
// n'est volontairement pas incluse.
function is3DS(req) {
  const ua = req.headers['user-agent'] || '';
  return /Nintendo 3DS/i.test(ua) || /NintendoBrowser/i.test(ua);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

// Lien stylé en gros bouton tactile. <a> = l'élément le plus fiable sur NetFront.
// height = line-height pour centrer le texte verticalement (compatible vieux moteurs).
function btnLink(href, label, opts) {
  opts = opts || {};
  const h  = opts.h  || '56px';
  const fs = opts.fs || '30px';
  const bg = opts.bg || '#f0f0f0';
  const fg = opts.fg || '#000';
  const bd = opts.bd || '2px solid #000';
  return '<a href="' + href + '" style="display:block;text-align:center;text-decoration:none;'
    + 'background:' + bg + ';color:' + fg + ';border:' + bd + ';'
    + 'height:' + h + ';line-height:' + h + ';font-size:' + fs + ';font-weight:bold;">'
    + label + '</a>';
}

// Cellule d'infos d'un joueur pour la MOITIÉ HAUTE (≈ écran du haut) :
// tag (sponsor) éventuel + nom + score géant, sur fond couleur du joueur.
function infoCell(tag, name, score, color) {
  const tagHtml = tag
    ? '<div style="font-size:15px;font-weight:bold;white-space:nowrap;overflow:hidden;">' + tag + '</div>'
    : '';
  return '<td style="width:50%;background:' + color + ';color:#fff;text-align:center;vertical-align:middle;">'
    +   tagHtml
    +   '<div style="font-size:22px;font-weight:bold;white-space:nowrap;overflow:hidden;">' + name + '</div>'
    +   '<div style="font-size:96px;font-weight:bold;line-height:1;">' + score + '</div>'
    + '</td>';
}

// base = http://<host> (URL absolue pour lever toute ambiguïté de résolution sur 3DS).
// t    = jeton anti-cache régénéré à chaque rendu (les liens d'action ne sont jamais mis en cache).
//
// Mise en page « deux écrans » :
//   - MOITIÉ HAUTE  (≈ écran du haut)         : infos joueurs + scores
//   - MOITIÉ BASSE  (≈ écran du bas, tactile) : boutons +1 / -1 par joueur + reset
// INFO_H = hauteur du bloc haut. C'EST LE RÉGLAGE à ajuster si la coupure entre les
// deux écrans ne tombe pas pile entre les infos et les boutons (≈ hauteur d'un écran).
function renderPage(state, base, t) {
  const INFO_H = 200; // px — calé d'après photo New 3DS : ~200 px de contenu visible par écran
  const p1 = state.player1 || {};
  const p2 = state.player2 || {};
  const n1 = esc(p1.name || 'P1');
  const n2 = esc(p2.name || 'P2');
  const g1 = esc(p1.tag || '');
  const g2 = esc(p2.tag || '');
  const s1 = Math.max(0, parseInt(p1.score, 10) || 0);
  const s2 = Math.max(0, parseInt(p2.score, 10) || 0);
  const c1 = esc(p1.color || '#E83030');
  const c2 = esc(p2.color || '#3070E8');

  const inc1 = base + '/remote?a=p1inc&t=' + t;
  const dec1 = base + '/remote?a=p1dec&t=' + t;
  const inc2 = base + '/remote?a=p2inc&t=' + t;
  const dec2 = base + '/remote?a=p2dec&t=' + t;
  const reset = base + '/remote?a=reset&t=' + t;

  // Boutons teintés à la couleur de chaque joueur, alignés sous sa colonne d'infos.
  // Hauteur calée pour que infos (200) + boutons tiennent dans ~2x200 px SANS défilement
  // (sinon la page se décale et les infos ne sont plus pile sur l'écran du haut).
  const bP1 = { h: '70px', fs: '40px', bg: c1, fg: '#fff', bd: '3px solid #fff' };
  const bP2 = { h: '70px', fs: '40px', bg: c2, fg: '#fff', bd: '3px solid #fff' };

  return '<!DOCTYPE html>'
    // Reset des marges EN INLINE sur <html> (le navigateur 3DS applique le style= en ligne
    // de façon fiable, mais ignore peut-être un bloc <style>). Le bloc <style> reste en
    // complément. NB : les bandes latérales de l'écran du HAUT (400px) ne viennent PAS d'ici
    // mais du cadre du navigateur (page 320px centrée) — impossible à retirer en web.
    + '<html style="margin:0;padding:0;background:#111;"><head>'
    +   '<meta charset="utf-8">'
    +   '<meta name="viewport" content="width=320">'
    +   '<title>Score 3DS</title>'
    +   '<style>html,body{margin:0;padding:0;background:#111;}</style>'
    + '</head>'
    + '<body style="margin:0;padding:0;background:#111;font-family:sans-serif;">'
    //  ── MOITIÉ HAUTE : infos + scores (≈ écran du haut) ──────────────────────
    +   '<table style="width:100%;height:' + INFO_H + 'px;border-collapse:collapse;table-layout:fixed;"><tr>'
    +     infoCell(g1, n1, s1, c1)
    +     infoCell(g2, n2, s2, c2)
    +   '</tr></table>'
    //  ── MOITIÉ BASSE : boutons (≈ écran du bas, tactile) ─────────────────────
    +   '<table style="width:100%;border-collapse:separate;border-spacing:5px;table-layout:fixed;">'
    +     '<tr><td style="width:50%;">' + btnLink(inc1, '+1', bP1) + '</td>'
    +       '<td style="width:50%;">' + btnLink(inc2, '+1', bP2) + '</td></tr>'
    +     '<tr><td>' + btnLink(dec1, '-1', bP1) + '</td>'
    +       '<td>' + btnLink(dec2, '-1', bP2) + '</td></tr>'
    +   '</table>'
    //  Ligne du bas : remise à zéro + accès au chargement d'un set start.gg
    +   '<table style="width:100%;border-collapse:separate;border-spacing:5px;table-layout:fixed;"><tr>'
    +     '<td style="width:50%;">' + btnLink(reset, 'Remise a 0', { h: '32px', fs: '15px' }) + '</td>'
    +     '<td style="width:50%;">' + btnLink(base + '/remote/sg', 'start.gg', { h: '32px', fs: '15px', bg: '#2e7d32', fg: '#fff', bd: '2px solid #fff' }) + '</td>'
    +   '</tr></table>'
    + '</body></html>';
}

// Mode calibrage (/remote?cal=1) : une règle graduée tous les 20 px depuis le haut
// EXACT de la page (aucune bordure/marge qui décalerait les graduations). On lit sur
// la console le nombre qui tombe dans la fente entre les deux écrans -> c'est INFO_H.
// Repères forts (bleus) tous les 100 px pour se repérer vite.
function renderCalibration(base) {
  let bands = '';
  for (let y = 0; y <= 520; y += 20) {
    let bg;
    if (y % 100 === 0)        bg = '#9ecbff';   // repère fort tous les 100 px
    else if ((y / 20) % 2)    bg = '#d0d0d0';
    else                      bg = '#ffffff';
    bands += '<div style="height:20px;line-height:20px;background:' + bg
      + ';color:#000;font-size:13px;font-weight:bold;padding-left:5px;">' + y + '</div>';
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=320"><title>Calibrage 3DS</title></head>'
    + '<body style="margin:0;padding:0;font-family:sans-serif;">'
    +   bands
    +   '<div style="background:#111;color:#fff;font-size:13px;padding:6px;">'
    +     'Note le nombre dans la fente entre les 2 ecrans, et celui tout en bas. '
    +     '<a href="' + base + '/remote" style="color:#9ecbff;">retour scores</a>'
    +   '</div>'
    + '</body></html>';
}

// ─── start.gg : chargement d'un set dans le scoreboard ───────────────────────
// Requêtes GraphQL, exécutées via le helper startggQuery du serveur (passé en dép.).
const SGG_Q_EVENTS =
  'query($slug:String!){tournament(slug:$slug){events{id name numEntrants}}}';

// Tous les sets NON terminés (à venir + en cours) du jeu choisi, triés par round.
const SGG_Q_EVENT_SETS =
  'query($eventId:ID!){event(id:$eventId){name sets(filters:{state:[1,2,6]},perPage:40,sortType:ROUND){nodes{'
  + 'id fullRoundText state '
  + 'slots{entrant{id name participants{gamerTag prefix}}}'
  + '}}}}';

const SGG_Q_SET_FULL =
  'query($setId:ID!){set(id:$setId){'
  + 'id fullRoundText state '
  + 'slots{entrant{id name initialSeedNum participants{gamerTag prefix player{id} user{genderPronoun}}}'
  + ' standing{stats{score{value}}}}'
  + '}}';

// Mutations pour l'envoi du résultat (mêmes que celles utilisées par le panneau PC).
const SGG_M_START =
  'mutation($setId:ID!){markSetInProgress(setId:$setId){id state}}';
const SGG_M_REPORT =
  'mutation($setId:ID!,$winnerId:ID!,$gameData:[BracketSetGameDataInput]){'
  + 'reportBracketSet(setId:$setId,winnerId:$winnerId,gameData:$gameData){id state}}';

// Liste des personnages du jeu (videogame de l'event). id = id start.gg (pour les selections).
const SGG_Q_CHARACTERS =
  'query($eventId:ID!){event(id:$eventId){videogame{id name characters{id name}}}}';

// Libellé d'affichage d'un set : { round, active, p1, p2 } (p1/p2 = « [tag] Pseudo »).
function sggSetDisplay(s) {
  const e1 = s.slots && s.slots[0] && s.slots[0].entrant;
  const e2 = s.slots && s.slots[1] && s.slots[1].entrant;
  const nm = (e) => (e && (((e.participants || [])[0] || {}).gamerTag || e.name)) || '?';
  const tg = (e) => (e && (((e.participants || [])[0] || {}).prefix)) || '';
  const lab = (e) => { const t = tg(e); return (t ? '[' + t + '] ' : '') + nm(e); };
  return { round: s.fullRoundText || '', active: s.state === 2, p1: lab(e1), p2: lab(e2) };
}

// Un set est « prêt à démarrer » quand les DEUX slots ont un joueur connu
// (sinon c'est un match qui attend le résultat d'un match précédent — TBD/bye).
function sggSetReady(s) {
  const slots = s.slots || [];
  if (slots.length < 2) return false;
  const known = (slot) => {
    const e = slot && slot.entrant;
    if (!e) return false;
    const nm = (((e.participants || [])[0] || {}).gamerTag) || e.name;
    return !!(nm && String(nm).trim());
  };
  return known(slots[0]) && known(slots[1]);
}

// Enveloppe HTML commune (marges remises à zéro, fond sombre, viewport 320).
function pageWrap(title, inner) {
  return '<!DOCTYPE html><html style="margin:0;padding:0;background:#111;"><head>'
    + '<meta charset="utf-8"><meta name="viewport" content="width=320"><title>' + esc(title) + '</title>'
    + '<style>html,body{margin:0;padding:0;background:#111;}</style></head>'
    + '<body style="margin:0;padding:6px;background:#111;font-family:sans-serif;">'
    + inner
    + '</body></html>';
}
function backBtn(base) {
  return '<a href="' + base + '/remote" style="display:block;text-align:center;text-decoration:none;'
    + 'background:#f0f0f0;color:#000;border:2px solid #000;height:40px;line-height:40px;font-size:16px;font-weight:bold;">Retour scores</a>';
}

// Étape 1 : choisir le jeu (event) du tournoi.
function renderGameList(base, events) {
  if (!events.length) return renderMsg(base, 'Aucun jeu trouve pour ce tournoi.');
  const items = events.map((ev) => {
    const href = base + '/remote/sets?event=' + encodeURIComponent(ev.id);
    return '<a href="' + href + '" style="display:block;text-decoration:none;color:#fff;'
      + 'background:#222;border:1px solid #555;padding:10px;margin-bottom:6px;font-size:17px;font-weight:bold;">'
      +   esc(ev.name || 'Jeu')
      +   (ev.numEntrants ? '<span style="color:#9ecbff;font-size:13px;font-weight:normal;"> — ' + ev.numEntrants + ' joueurs</span>' : '')
      + '</a>';
  }).join('');
  return pageWrap('Choisir un jeu',
    '<div style="color:#fff;font-size:16px;font-weight:bold;margin-bottom:6px;">Choisir un jeu</div>'
    + items + backBtn(base));
}

// Étape 2 : liste de TOUS les sets (à venir + en cours) du jeu choisi.
function renderSetList(base, sets, evName, eventId) {
  const head = '<div style="color:#fff;font-size:16px;font-weight:bold;">Charger un set</div>'
    + (evName ? '<div style="color:#9ecbff;font-size:13px;margin-bottom:6px;">' + esc(evName) + '</div>' : '<div style="margin-bottom:6px;"></div>')
    + '<a href="' + base + '/remote/sets" style="display:block;text-align:center;text-decoration:none;'
    +   'background:#333;color:#fff;border:1px solid #666;padding:6px;margin-bottom:8px;font-size:14px;">&larr; Changer de jeu</a>';
  if (!sets.length) {
    return pageWrap('Sets start.gg', head
      + '<div style="color:#fff;font-size:14px;margin-bottom:10px;">Aucun match pret a demarrer (les 2 joueurs connus) pour ce jeu.</div>'
      + backBtn(base));
  }
  const items = sets.map((s) => {
    const d = sggSetDisplay(s);
    const href = base + '/remote/sets/load?id=' + encodeURIComponent(s.id) + '&event=' + encodeURIComponent(eventId || '') + '&t=' + Date.now();
    return '<a href="' + href + '" style="display:block;text-decoration:none;color:#fff;'
      + 'background:#222;border:1px solid #555;padding:8px;margin-bottom:6px;">'
      +   '<div style="font-size:12px;color:#9ecbff;">' + esc(d.round) + (d.active ? ' — EN COURS' : '') + '</div>'
      +   '<div style="font-size:17px;font-weight:bold;">' + esc(d.p1) + '</div>'
      +   '<div style="font-size:12px;color:#aaa;margin:1px 0;">vs</div>'
      +   '<div style="font-size:17px;font-weight:bold;">' + esc(d.p2) + '</div>'
      + '</a>';
  }).join('');
  return pageWrap('Sets start.gg', head + items + backBtn(base));
}

// Page message simple (erreur / vide) avec bouton retour.
function renderMsg(base, msg) {
  return pageWrap('start.gg',
    '<div style="color:#fff;font-size:15px;line-height:1.4;margin:6px 0 12px;">' + esc(msg) + '</div>'
    + backBtn(base));
}

// Menu start.gg : charger un set / envoyer le score.
function renderSgHub(base, d) {
  const big = (href, label, bg) =>
    '<a href="' + href + '" style="display:block;text-align:center;text-decoration:none;'
    + 'background:' + bg + ';color:#fff;border:2px solid #fff;'
    + 'padding:14px;margin-bottom:8px;font-size:18px;font-weight:bold;">' + label + '</a>';
  let inner = '<div style="color:#fff;font-size:16px;font-weight:bold;margin-bottom:8px;">start.gg</div>';
  if (d.linked) {
    inner += '<div style="color:#9ecbff;font-size:13px;margin-bottom:8px;">Match lie : '
      + esc(d.p1) + ' ' + d.s1 + ' - ' + d.s2 + ' ' + esc(d.p2) + '</div>';
  }
  inner += big(base + '/remote/sets', 'Charger un set', '#2e7d32');
  if (d.linked) {
    inner += big(base + '/remote/report', 'Envoyer le score', '#1565c0');
  } else {
    inner += '<div style="color:#888;font-size:13px;margin-bottom:8px;">Charge un set pour pouvoir envoyer le score.</div>';
  }
  return pageWrap('start.gg', inner + backBtn(base));
}

// Constructeur de report : on ajoute les games un par un (qui a gagné chaque game),
// l'écran affiche le résultat courant + le vainqueur, puis on envoie.
function renderReportBuilder(base, d) {
  const c1 = d.c1 || '#E83030', c2 = d.c2 || '#3070E8';
  const games = d.games || [];
  let s1 = 0, s2 = 0;
  // Lien vers le sélecteur de perso pour (game i+1, joueur p).
  const charLink = (i, p, ch) =>
    '<a href="' + base + '/remote/report/char?g=' + (i + 1) + '&p=' + p + '&t=' + Date.now() + '"'
    + ' style="color:#ffe9a8;text-decoration:underline;">' + (ch && ch.name ? esc(ch.name) : '+ perso') + '</a>';
  const rows = games.map((g, i) => {
    const w1 = Number(g.winner) !== 2;
    if (w1) s1++; else s2++;
    return '<div style="background:' + (w1 ? c1 : c2) + ';color:#fff;padding:5px 8px;margin-bottom:3px;">'
      + '<div style="font-size:14px;font-weight:bold;">Game ' + (i + 1) + ' — ' + esc(w1 ? d.p1 : d.p2) + '</div>'
      + '<div style="font-size:12px;margin-top:2px;">'
      +   esc(d.p1) + ': ' + charLink(i, 1, g.p1Char) + ' &nbsp;|&nbsp; ' + esc(d.p2) + ': ' + charLink(i, 2, g.p2Char)
      + '</div></div>';
  }).join('');
  const tied = s1 === s2;
  let status;
  if (!games.length) status = '<div style="color:#888;font-size:13px;text-align:center;margin:4px 0 8px;">Ajoute les games dans l\'ordre joue.</div>';
  else if (tied)     status = '<div style="color:#e0a020;font-size:13px;text-align:center;margin:4px 0 8px;">Egalite — ajoute un game pour departager.</div>';
  else               status = '<div style="color:#9ecbff;font-size:13px;text-align:center;margin:4px 0 8px;">Vainqueur : ' + esc(s1 > s2 ? d.p1 : d.p2) + '</div>';
  const add = (w, name, bg) =>
    '<a href="' + base + '/remote/report/add?w=' + w + '&t=' + Date.now() + '" style="display:block;text-align:center;text-decoration:none;'
    + 'background:' + bg + ';color:#fff;border:2px solid #fff;padding:11px;margin-bottom:6px;font-size:16px;font-weight:bold;">+ Game gagne par ' + esc(name) + '</a>';
  let inner = '<div style="color:#fff;font-size:16px;font-weight:bold;margin-bottom:4px;">Reporter le set</div>'
    + rows
    + '<div style="color:#fff;font-size:20px;font-weight:bold;text-align:center;margin:6px 0;">' + esc(d.p1) + ' ' + s1 + ' - ' + s2 + ' ' + esc(d.p2) + '</div>'
    + status
    + add(1, d.p1, c1)
    + add(2, d.p2, c2);
  if (!games.length && (d.boardS1 + d.boardS2) > 0) {
    inner += '<a href="' + base + '/remote/report/seed?t=' + Date.now() + '" style="display:block;text-align:center;text-decoration:none;'
      + 'background:#333;color:#fff;border:1px solid #666;padding:7px;margin-bottom:6px;font-size:13px;">Pre-remplir depuis le score (' + d.boardS1 + '-' + d.boardS2 + ')</a>';
  }
  if (games.length) {
    inner += '<a href="' + base + '/remote/report/undo?t=' + Date.now() + '" style="display:block;text-align:center;text-decoration:none;'
      + 'background:#444;color:#fff;border:1px solid #888;padding:7px;margin-bottom:6px;font-size:13px;">Annuler le dernier game</a>';
  }
  if (games.length && !tied) {
    inner += '<a href="' + base + '/remote/report/send?t=' + Date.now() + '" style="display:block;text-align:center;text-decoration:none;'
      + 'background:#2e7d32;color:#fff;border:2px solid #fff;padding:13px;margin-bottom:6px;font-size:17px;font-weight:bold;">Envoyer le resultat</a>';
  }
  inner += '<a href="' + base + '/remote/sg" style="display:block;text-align:center;text-decoration:none;'
    + 'background:#f0f0f0;color:#000;border:2px solid #000;height:36px;line-height:36px;font-size:15px;">Retour</a>';
  return pageWrap('Reporter le set', inner);
}

// Écran de résultat après tentative d'envoi.
function renderResult(base, ok, msg) {
  const head = ok
    ? '<div style="color:#4caf50;font-size:22px;font-weight:bold;margin:8px 0;">Envoye !</div>'
    : '<div style="color:#e05050;font-size:22px;font-weight:bold;margin:8px 0;">Echec</div>';
  const retry = ok ? ''
    : '<a href="' + base + '/remote/report" style="display:block;text-align:center;text-decoration:none;'
      + 'background:#1565c0;color:#fff;border:2px solid #fff;padding:12px;margin-bottom:8px;font-size:16px;font-weight:bold;">Reessayer</a>';
  return pageWrap('start.gg',
    head + '<div style="color:#fff;font-size:15px;line-height:1.4;margin-bottom:14px;">' + esc(msg) + '</div>'
    + retry + backBtn(base));
}

// Sélecteur de personnage (liste du jeu) pour un game + joueur donnés.
function renderCharPicker(base, g, p, pname, chars, currentId) {
  const clearHref = base + '/remote/report/char/set?g=' + g + '&p=' + p + '&c=&t=' + Date.now();
  const items = (chars || []).map((c) =>
    '<a href="' + base + '/remote/report/char/set?g=' + g + '&p=' + p
    + '&c=' + encodeURIComponent(c.id) + '&cn=' + encodeURIComponent(c.name) + '&t=' + Date.now() + '"'
    + ' style="display:block;text-decoration:none;color:#fff;border:1px solid #555;padding:7px 8px;margin-bottom:3px;font-size:15px;'
    + 'background:' + (String(c.id) === String(currentId) ? '#1565c0' : '#222') + ';">' + esc(c.name) + '</a>'
  ).join('');
  return pageWrap('Choisir un perso',
    '<div style="color:#fff;font-size:15px;font-weight:bold;margin-bottom:6px;">Game ' + g + ' — perso de ' + esc(pname) + '</div>'
    + '<a href="' + clearHref + '" style="display:block;text-align:center;text-decoration:none;background:#444;color:#fff;border:1px solid #888;padding:7px;margin-bottom:8px;font-size:14px;">Aucun / retirer</a>'
    + (items || '<div style="color:#888;font-size:14px;margin-bottom:8px;">Liste de persos indisponible.</div>')
    + '<a href="' + base + '/remote/report" style="display:block;text-align:center;text-decoration:none;background:#f0f0f0;color:#000;border:2px solid #000;height:38px;line-height:38px;font-size:15px;margin-top:6px;">Retour</a>');
}

/**
 * Monte la télécommande 3DS sur l'app Express existante.
 * @param {import('express').Express} app
 * @param {{ io: any, getMatchState: () => any, startggQuery?: Function, getTournamentConfig?: Function }} deps
 *   - io                 : instance Socket.IO (pour émettre 'stateUpdate')
 *   - getMatchState      : renvoie l'objet matchState courant (lecture/écriture en place)
 *   - startggQuery       : (optionnel) helper serveur pour interroger l'API start.gg
 *   - getTournamentConfig: (optionnel) renvoie { slug, eventId, ... } du tournoi configuré
 */
function mountRemote3DS(app, { io, getMatchState, startggQuery, getTournamentConfig }) {
  // Applique un delta au score d'un joueur — même règle que le panneau PC
  // (control.js : Math.max(0, score + delta)), puis prévient les overlays.
  function applyDelta(player, delta) {
    const st = getMatchState();
    const key = player === 2 ? 'player2' : 'player1';
    if (!st || !st[key]) return;
    const cur = parseInt(st[key].score, 10) || 0;
    st[key].score = Math.max(0, cur + delta);
    io.emit('stateUpdate', st);
  }

  function resetScores() {
    const st = getMatchState();
    if (!st) return;
    if (st.player1) st.player1.score = 0;
    if (st.player2) st.player2.score = 0;
    io.emit('stateUpdate', st);
  }

  // Charge les 2 joueurs d'un set start.gg dans le scoreboard (nom, tag, seed, pronoms,
  // score), en PRÉSERVANT le reste (couleurs, perso, drapeau…), puis prévient les overlays.
  function applySetToState(set) {
    const st = getMatchState();
    if (!st) return;
    const slots = set.slots || [];
    function fill(key, slot) {
      if (!st[key]) return;
      const ent = (slot && slot.entrant) || {};
      const par = (ent.participants && ent.participants[0]) || {};
      const sc  = slot && slot.standing && slot.standing.stats && slot.standing.stats.score;
      st[key].name     = par.gamerTag || ent.name || 'TBD';
      st[key].tag      = par.prefix || '';
      st[key].seeding  = (ent.initialSeedNum != null) ? ent.initialSeedNum : null;
      st[key].pronouns = (par.user && par.user.genderPronoun) || '';
      st[key].score    = Math.max(0, parseInt(sc && sc.value, 10) || 0);
      st[key].socials  = ['', '', ''];  // évite de garder les réseaux des joueurs précédents
    }
    fill('player1', slots[0]);
    fill('player2', slots[1]);
    // Lien start.gg pour l'envoi du score ensuite : id du set + id des 2 entrants.
    const eid = (slot) => (slot && slot.entrant && slot.entrant.id != null) ? String(slot.entrant.id) : null;
    st.startggSet = { id: (set.id != null) ? String(set.id) : null, e1: eid(slots[0]), e2: eid(slots[1]) };
    io.emit('stateUpdate', st);
  }

  // Garde User-Agent : tout /remote* est réservé aux consoles Nintendo 3DS.
  app.use('/remote', (req, res, next) => {
    if (is3DS(req)) return next();
    res.status(403)
      .set('Content-Type', 'text/html; charset=utf-8')
      .send('<!DOCTYPE html><meta charset="utf-8">'
        + '<body style="font-family:sans-serif;padding:24px;">'
        + 'Cette page est réservée à la console Nintendo 3DS.</body>');
  });

  // Page principale ET traitement des actions (tout en GET).
  //   /remote            -> affiche les scores
  //   /remote?a=p1inc    -> +1 joueur 1, puis redirection vers /remote (motif PRG :
  //                         l'URL finale est propre, un rechargement ne réapplique rien)
  app.get('/remote', (req, res) => {
    noCache(res);
    // Mode calibrage de la coupure entre les deux écrans (règle graduée).
    if (req.query.cal) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderCalibration('http://' + (req.headers.host || 'localhost')));
    }
    const a = req.query.a;
    if (a) {
      if      (a === 'p1inc') applyDelta(1, +1);
      else if (a === 'p1dec') applyDelta(1, -1);
      else if (a === 'p2inc') applyDelta(2, +1);
      else if (a === 'p2dec') applyDelta(2, -1);
      else if (a === 'reset') resetScores();
      return res.redirect('/remote');
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    const base = 'http://' + (req.headers.host || 'localhost');
    res.send(renderPage(getMatchState(), base, Date.now()));
  });

  // ─── start.gg : choisir le jeu, puis lister TOUS ses sets ───────────────────
  //   /remote/sets            -> liste des jeux (events) du tournoi
  //   /remote/sets?event=<id> -> tous les sets (à venir + en cours) de ce jeu
  app.get('/remote/sets', async (req, res) => {
    noCache(res);
    res.set('Content-Type', 'text/html; charset=utf-8');
    const base = 'http://' + (req.headers.host || 'localhost');
    if (typeof startggQuery !== 'function' || typeof getTournamentConfig !== 'function') {
      return res.send(renderMsg(base, 'start.gg non disponible sur ce serveur.'));
    }
    try {
      const cfg = getTournamentConfig() || {};
      if (!cfg.slug) {
        return res.send(renderMsg(base, 'Aucun tournoi configure. Configure-le depuis le PC.'));
      }
      const eventId = req.query.event;
      // Étape 1 : aucun jeu choisi -> liste des jeux du tournoi
      if (!eventId) {
        const d = await startggQuery(SGG_Q_EVENTS, { slug: cfg.slug });
        const events = (d && d.tournament && d.tournament.events) || [];
        // Un seul jeu : on va directement à ses sets (pas de choix inutile).
        if (events.length === 1) {
          return res.redirect('/remote/sets?event=' + encodeURIComponent(events[0].id));
        }
        return res.send(renderGameList(base, events));
      }
      // Étape 2 : tous les sets non terminés du jeu choisi
      const d = await startggQuery(SGG_Q_EVENT_SETS, { eventId: parseInt(eventId, 10) });
      const ev = (d && d.event) || {};
      const all = (ev.sets && ev.sets.nodes) ? ev.sets.nodes : [];
      // On ne garde que les matchs prêts à démarrer (les 2 joueurs connus).
      const nodes = all.filter(sggSetReady);
      res.send(renderSetList(base, nodes, ev.name || '', eventId));
    } catch (e) {
      res.send(renderMsg(base, 'Erreur start.gg : ' + (e && e.message ? e.message : 'inconnue')));
    }
  });

  app.get('/remote/sets/load', async (req, res) => {
    noCache(res);
    const id = req.query.id;
    if (id && typeof startggQuery === 'function') {
      try {
        const d = await startggQuery(SGG_Q_SET_FULL, { setId: String(id) });
        if (d && d.set) {
          applySetToState(d.set);
          // Mémorise l'event du set (pour la liste des persos lors du report).
          const st = getMatchState();
          if (st && st.startggSet) {
            st.startggSet.eventId = req.query.event
              || (typeof getTournamentConfig === 'function' && getTournamentConfig().eventId) || null;
          }
        }
      } catch (e) { /* on redirige quand même vers le scoreboard */ }
    }
    res.redirect('/remote');
  });

  // ─── start.gg : envoi du score (report détaillé, par game) ──────────────────
  // Envoie le brouillon de games (qui a gagné chaque game) : markSetInProgress
  // (best-effort) puis reportBracketSet ; reflète le résultat sur le scoreboard
  // et vide le brouillon.
  async function reportLinkedSet() {
    const st = getMatchState();
    const link = st && st.startggSet;
    if (!link || !link.id || !link.e1 || !link.e2) throw new Error('Aucun set start.gg lie.');
    const games = Array.isArray(link.games) ? link.games : [];
    if (!games.length) throw new Error('Aucun game saisi.');
    let p1w = 0, p2w = 0;
    const gameData = games.map((g, i) => {
      const w2 = Number(g.winner) === 2;
      if (w2) p2w++; else p1w++;
      const entry = { gameNum: i + 1, winnerId: w2 ? String(link.e2) : String(link.e1) };
      const sel = [];
      if (g.p1Char && g.p1Char.id) sel.push({ entrantId: String(link.e1), characterId: parseInt(g.p1Char.id, 10) });
      if (g.p2Char && g.p2Char.id) sel.push({ entrantId: String(link.e2), characterId: parseInt(g.p2Char.id, 10) });
      if (sel.length) entry.selections = sel;
      return entry;
    });
    if (p1w === p2w) throw new Error('Egalite de games : impossible de determiner le vainqueur.');
    const winnerId = p1w > p2w ? String(link.e1) : String(link.e2);
    try { await startggQuery(SGG_M_START, { setId: String(link.id) }); } catch (e) { /* set déjà lancé ou non requis */ }
    const result = await startggQuery(SGG_M_REPORT, { setId: String(link.id), winnerId: winnerId, gameData: gameData });
    // Reflète le résultat reporté sur le scoreboard + vide le brouillon de games.
    const cur = getMatchState();
    if (cur) {
      if (cur.player1) cur.player1.score = p1w;
      if (cur.player2) cur.player2.score = p2w;
      if (cur.startggSet) cur.startggSet.games = [];
      io.emit('stateUpdate', cur);
    }
    return result;
  }

  // Menu start.gg : charger un set / envoyer le score.
  app.get('/remote/sg', (req, res) => {
    noCache(res);
    res.set('Content-Type', 'text/html; charset=utf-8');
    const base = 'http://' + (req.headers.host || 'localhost');
    const st = getMatchState() || {};
    const link = st.startggSet || {};
    res.send(renderSgHub(base, {
      linked: !!(link.id && link.e1 && link.e2),
      p1: (st.player1 && st.player1.name) || 'J1',
      p2: (st.player2 && st.player2.name) || 'J2',
      s1: Math.max(0, parseInt(st.player1 && st.player1.score, 10) || 0),
      s2: Math.max(0, parseInt(st.player2 && st.player2.score, 10) || 0),
    }));
  });

  // Constructeur de report : ajout des games un par un (qui a gagné chaque game).
  app.get('/remote/report', (req, res) => {
    noCache(res);
    res.set('Content-Type', 'text/html; charset=utf-8');
    const base = 'http://' + (req.headers.host || 'localhost');
    const st = getMatchState() || {};
    const link = st.startggSet || {};
    if (!(link.id && link.e1 && link.e2)) {
      return res.send(renderMsg(base, 'Aucun set start.gg lie. Charge un set d\'abord.'));
    }
    res.send(renderReportBuilder(base, {
      p1: (st.player1 && st.player1.name) || 'J1',
      p2: (st.player2 && st.player2.name) || 'J2',
      c1: (st.player1 && st.player1.color) || '#E83030',
      c2: (st.player2 && st.player2.color) || '#3070E8',
      games: Array.isArray(link.games) ? link.games : [],
      boardS1: Math.max(0, parseInt(st.player1 && st.player1.score, 10) || 0),
      boardS2: Math.max(0, parseInt(st.player2 && st.player2.score, 10) || 0),
    }));
  });

  // Ajoute un game gagné par le joueur w (1 ou 2) au brouillon de report.
  app.get('/remote/report/add', (req, res) => {
    noCache(res);
    const st = getMatchState();
    const link = st && st.startggSet;
    if (link && link.id) {
      if (!Array.isArray(link.games)) link.games = [];
      link.games.push({ winner: String(req.query.w) === '2' ? 2 : 1 });
    }
    res.redirect('/remote/report');
  });

  // Annule le dernier game du brouillon.
  app.get('/remote/report/undo', (req, res) => {
    noCache(res);
    const st = getMatchState();
    const link = st && st.startggSet;
    if (link && Array.isArray(link.games)) link.games.pop();
    res.redirect('/remote/report');
  });

  // Pré-remplit le brouillon depuis le score du scoreboard (ordre par défaut).
  app.get('/remote/report/seed', (req, res) => {
    noCache(res);
    const st = getMatchState();
    const link = st && st.startggSet;
    if (link && link.id) {
      const s1 = Math.max(0, parseInt(st.player1 && st.player1.score, 10) || 0);
      const s2 = Math.max(0, parseInt(st.player2 && st.player2.score, 10) || 0);
      link.games = [];
      for (let i = 0; i < s1; i++) link.games.push({ winner: 1 });
      for (let i = 0; i < s2; i++) link.games.push({ winner: 2 });
    }
    res.redirect('/remote/report');
  });

  // Liste des persos du jeu, mise en cache par eventId (évite de réinterroger start.gg).
  const _charCache = {};
  async function getCharacters(eventId) {
    if (!eventId || typeof startggQuery !== 'function') return [];
    const key = String(eventId);
    if (_charCache[key]) return _charCache[key];
    const d = await startggQuery(SGG_Q_CHARACTERS, { eventId: key });
    const list = ((d && d.event && d.event.videogame && d.event.videogame.characters) || [])
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    _charCache[key] = list;
    return list;
  }

  // Sélecteur de perso pour (game g, joueur p) — liste cliquable.
  app.get('/remote/report/char', async (req, res) => {
    noCache(res);
    res.set('Content-Type', 'text/html; charset=utf-8');
    const base = 'http://' + (req.headers.host || 'localhost');
    const st = getMatchState() || {};
    const link = st.startggSet || {};
    const games = Array.isArray(link.games) ? link.games : [];
    const g = parseInt(req.query.g, 10);
    const p = String(req.query.p) === '2' ? 2 : 1;
    if (!link.id || !(g >= 1 && g <= games.length)) {
      return res.send(renderMsg(base, 'Game introuvable. Reviens au report.'));
    }
    const pname = (p === 2 ? (st.player2 && st.player2.name) : (st.player1 && st.player1.name)) || ('J' + p);
    const cur = p === 2 ? games[g - 1].p2Char : games[g - 1].p1Char;
    let chars = [];
    try { chars = await getCharacters(link.eventId); } catch (e) { /* liste indispo */ }
    res.send(renderCharPicker(base, g, p, pname, chars, cur && cur.id));
  });

  // Enregistre (ou retire si c vide) le perso choisi pour (game g, joueur p).
  app.get('/remote/report/char/set', (req, res) => {
    noCache(res);
    const st = getMatchState();
    const link = st && st.startggSet;
    const g = parseInt(req.query.g, 10);
    const p = String(req.query.p) === '2' ? 2 : 1;
    if (link && Array.isArray(link.games) && g >= 1 && g <= link.games.length) {
      const val = req.query.c ? { id: req.query.c, name: req.query.cn ? String(req.query.cn) : String(req.query.c) } : null;
      if (p === 2) link.games[g - 1].p2Char = val; else link.games[g - 1].p1Char = val;
    }
    res.redirect('/remote/report');
  });

  // Exécute l'envoi UNE fois, puis redirige vers la page résultat (un rechargement ne renvoie rien).
  app.get('/remote/report/send', async (req, res) => {
    noCache(res);
    let q;
    if (typeof startggQuery !== 'function') {
      q = '?err=' + encodeURIComponent('start.gg non disponible.');
    } else {
      try { await reportLinkedSet(); q = '?ok=1'; }
      catch (e) { q = '?err=' + encodeURIComponent((e && e.message) ? e.message : 'Erreur inconnue.'); }
    }
    res.redirect('/remote/report/done' + q);
  });

  // Page résultat (sans effet de bord).
  app.get('/remote/report/done', (req, res) => {
    noCache(res);
    res.set('Content-Type', 'text/html; charset=utf-8');
    const base = 'http://' + (req.headers.host || 'localhost');
    if (req.query.ok) return res.send(renderResult(base, true, 'Resultat envoye sur start.gg !'));
    res.send(renderResult(base, false, req.query.err ? String(req.query.err) : 'Erreur inconnue.'));
  });
}

module.exports = { mountRemote3DS };
