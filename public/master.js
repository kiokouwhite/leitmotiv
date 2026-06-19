// Master overlay : compose plusieurs overlays en un seul (un seul navigateur OBS).
// Chaque overlay est rendu dans un <iframe> transparent plein écran, empilé par z-index.
// L'id du master overlay vient de l'URL : /master/<id> ; sans id (/master), on prend le premier.
const socket = io();

// id d'overlay → URL de la page overlay (scoreboard est servi sur /overlay)
const urlFor = id => (id === 'scoreboard' ? '/overlay' : '/' + id);

function masterIdFromUrl() {
  const m = location.pathname.match(/^\/master\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
let MY_ID = masterIdFromUrl();

function renderMaster(cfg) {
  const root = document.getElementById('master-layers');
  if (!root) return;
  const items = (cfg && Array.isArray(cfg.items)) ? cfg.items.filter(i => i && i.enabled) : [];
  const wanted = items.map(i => String(i.id));

  // Retire les iframes qui ne sont plus voulus
  [...root.children].forEach(f => {
    if (!wanted.includes(f.dataset.id)) f.remove();
  });

  // Ajoute les manquants + applique l'ordre via z-index (sans déplacer dans le DOM
  // pour éviter de recharger les iframes existants).
  items.forEach((it, idx) => {
    const id = String(it.id);
    let f = root.querySelector(`iframe[data-id="${CSS.escape(id)}"]`);
    if (!f) {
      f = document.createElement('iframe');
      f.className = 'master-frame';
      f.dataset.id = id;
      f.setAttribute('scrolling', 'no');
      f.setAttribute('allowtransparency', 'true');
      f.src = urlFor(id);
      root.appendChild(f);
    }
    f.style.zIndex = String(idx + 1);
  });
}

// Mise à jour temps réel : on ne re-rend que si c'est NOTRE master overlay.
socket.on('masterUpdate', (data) => {
  if (data && String(data.id) === String(MY_ID)) renderMaster(data);
});

// Chargement initial
if (MY_ID) {
  fetch('/api/master/' + encodeURIComponent(MY_ID))
    .then(r => r.json())
    .then(renderMaster)
    .catch(() => {});
} else {
  // Pas d'id dans l'URL → premier master overlay de la liste
  fetch('/api/master')
    .then(r => r.json())
    .then(data => {
      const first = data && Array.isArray(data.overlays) && data.overlays[0];
      if (first) { MY_ID = first.id; renderMaster(first); }
    })
    .catch(() => {});
}
