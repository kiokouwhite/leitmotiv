// remote-access.js
// ─────────────────────────────────────────────────────────────────────────────
// Tunnel ngrok intégré — module additif isolé, pattern miroir d'auth-state.js.
// Objectif S3 : rendre /control accessible depuis Internet via une URL HTTPS
// stable (free dev domain ngrok), pilotable depuis l'UI sans toucher au .env.
//
// État privé au scope module :
//   - persistant : ngrokAuthtoken, ngrokDomain, autostart, lastChangedAt
//                  (rangés dans config.json sous la clé `remoteAccess`)
//   - runtime    : currentListener, currentUrl, currentStatus, lastError
//
// Singleton strict sur currentListener pour éviter ERR_NGROK_108 (max 3 sessions
// agent simultanées sur le free plan).
// ─────────────────────────────────────────────────────────────────────────────

const { readConfig, writeConfig } = require('./config-io');

// ─── État persistant (config.json → remoteAccess) ───
let ngrokAuthtoken = null;
let ngrokDomain    = null;
let autostart      = false;
let lastChangedAt  = null;

// ─── État runtime (non persisté) ───
let currentListener = null;
let currentUrl      = null;
let currentStatus   = 'idle';   // 'idle' | 'connecting' | 'online' | 'reconnecting' | 'closed' | 'error'
let lastError       = null;     // string | null — dernier message d'erreur user-friendly

// ─── Bootstrap depuis config.json ───
(function bootstrap() {
  const cfg = readConfig();
  const ra  = cfg.remoteAccess || {};
  ngrokAuthtoken = ra.ngrokAuthtoken || null;
  ngrokDomain    = ra.ngrokDomain    || null;
  autostart      = Boolean(ra.autostart);
  lastChangedAt  = ra.lastChangedAt  || null;
})();

function persistRemoteAccessSection() {
  const cfg = readConfig();
  cfg.remoteAccess = { ngrokAuthtoken, ngrokDomain, autostart, lastChangedAt };
  writeConfig(cfg);
}

// ─── Lecture interne (process Node uniquement, jamais HTTP) ───
function getRemoteAccessConfig() {
  return { ngrokAuthtoken, ngrokDomain, autostart, lastChangedAt };
}

// ─── Lecture safe HTTP (jamais le token en clair) ───
function getRemoteAccessStatus() {
  return {
    configured:    !!ngrokAuthtoken,
    hasAuthtoken:  !!ngrokAuthtoken,
    domain:        ngrokDomain || null,
    autostart,
    lastChangedAt,
    active:        currentStatus === 'online' || currentStatus === 'reconnecting',
    status:        currentStatus,
    publicUrl:     currentUrl,
    lastError,
  };
}

// ─── Mutation partielle (merge champ par champ) ───
async function saveRemoteAccessConfig(partial) {
  if (partial.ngrokAuthtoken !== undefined) {
    ngrokAuthtoken = (partial.ngrokAuthtoken === '' || partial.ngrokAuthtoken === null)
      ? null : String(partial.ngrokAuthtoken);
  }
  if (partial.ngrokDomain !== undefined) {
    ngrokDomain = (partial.ngrokDomain === '' || partial.ngrokDomain === null)
      ? null : String(partial.ngrokDomain).trim();
  }
  if (partial.autostart !== undefined) {
    autostart = Boolean(partial.autostart);
  }
  lastChangedAt = new Date().toISOString();
  persistRemoteAccessSection();
  return getRemoteAccessStatus();
}

// ─── Cycle de vie du tunnel ngrok ───
let emitUpdate = () => {};   // injecté par server.js (Socket.IO broadcast)
function setStatusEmitter(fn) { if (typeof fn === 'function') emitUpdate = fn; }

function _setStatus(status, errMsg) {
  currentStatus = status;
  lastError     = errMsg || null;
  try { emitUpdate(getRemoteAccessStatus()); } catch {}
}

function _humanizeError(err) {
  const msg = String(err && err.message || err);
  if (msg.includes('ERR_NGROK_107'))   return 'Authtoken invalide (vérifiez sur dashboard.ngrok.com).';
  if (msg.includes('ERR_NGROK_108'))   return 'Trop de tunnels ngrok actifs (max 3 sur free plan). Fermez les autres sessions.';
  if (msg.includes('ERR_NGROK_4018'))  return 'Authtoken manquant.';
  if (msg.includes('ERR_NGROK_120'))   return 'Version de ngrok obsolète — npm update @ngrok/ngrok.';
  if (msg.includes('ERR_NGROK_8012'))  return 'Le serveur local ne répond pas (port HTTP injoignable).';
  if (msg.toLowerCase().includes('already bound')) return 'Domaine ngrok déjà utilisé par un autre process.';
  if (msg.toLowerCase().includes('failed to connect to ngrok')) return 'Impossible de joindre ngrok (réseau / firewall ?).';
  return msg.slice(0, 240);
}

async function start(port) {
  if (currentListener) return getRemoteAccessStatus();    // singleton
  if (!ngrokAuthtoken) {
    _setStatus('error', 'Authtoken ngrok non configuré.');
    return getRemoteAccessStatus();
  }
  _setStatus('connecting', null);

  // Lazy require pour éviter l'init du natif si la feature n'est jamais utilisée.
  let ngrok;
  try { ngrok = require('@ngrok/ngrok'); }
  catch (err) { _setStatus('error', 'Module @ngrok/ngrok introuvable. npm i @ngrok/ngrok.'); return getRemoteAccessStatus(); }

  const cfg = {
    addr: port,
    authtoken: ngrokAuthtoken,
    schemes: ['HTTPS'],
    onStatusChange: (s) => {
      const map = { connected: 'online', online: 'online', reconnecting: 'reconnecting', closed: 'closed' };
      _setStatus(map[s] || s, null);
      console.log('[ngrok] status:', s);
    },
  };
  if (ngrokDomain) cfg.domain = ngrokDomain;

  try {
    currentListener = await ngrok.forward(cfg);
    currentUrl = currentListener.url();
    _setStatus('online', null);
    return getRemoteAccessStatus();
  } catch (err) {
    currentListener = null;
    currentUrl      = null;
    _setStatus('error', _humanizeError(err));
    return getRemoteAccessStatus();
  }
}

async function stop() {
  if (!currentListener) { _setStatus('idle', null); currentUrl = null; return getRemoteAccessStatus(); }
  try { await currentListener.close(); } catch (err) { console.warn('[ngrok] close error:', err.message); }
  currentListener = null;
  currentUrl      = null;
  _setStatus('closed', null);
  return getRemoteAccessStatus();
}

async function startIfConfigured(port) {
  if (!autostart || !ngrokAuthtoken) return null;
  const status = await start(port);
  return status.active ? status.publicUrl : null;
}

// ─── Signal handlers (idempotents — supportent appel multiple) ───
let handlersInstalled = false;
function installShutdownHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const shutdown = async (sig) => {
    if (!currentListener) return;
    console.log(`[ngrok] ${sig} reçu — fermeture du tunnel...`);
    try { await currentListener.close(); } catch {}
    currentListener = null;
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));   // Windows Ctrl+Break
}

module.exports = {
  // Lecture
  getRemoteAccessConfig,
  getRemoteAccessStatus,
  // Mutation persistée
  saveRemoteAccessConfig,
  // Cycle tunnel
  start,
  stop,
  startIfConfigured,
  // Hooks pour server.js
  setStatusEmitter,
  installShutdownHandlers,
};
