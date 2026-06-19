// Vérificateur de mise à jour Leitmotiv
//
// Polle GitHub Releases (api.github.com — pas d'auth requise pour repo public),
// compare la dernière version au package.json local, et expose un état de mise
// à jour disponible. Le téléchargement et l'application sont aussi gérés ici.
//
// L'état persistant (lastCheckAt, dismissedVersion, autoCheck) vit dans
// config.json sous la clé `update`, via le module config-io.

const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const os       = require('os');
const { spawnSync } = require('child_process');
const AdmZip   = require('adm-zip');
const { readConfig, writeConfig } = require('./config-io');

const ROOT_DIR    = __dirname;
const PKG_PATH    = path.join(ROOT_DIR, 'package.json');
const REPO_OWNER  = 'kiokouwhite';
const REPO_NAME   = 'leitmotiv';
const API_URL     = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const RESTART_EXIT_CODE = 42; // start.bat redémarre sur ce code
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

// Chemins préservés pendant l'update (jamais écrasés par les fichiers de la release).
const PRESERVE_PATHS = new Set([
  'config.json',
  '.env',
  '.env.local',
  'ngrok.txt',
]);
// Dossiers préservés (tout sous ces racines reste intact).
const PRESERVE_DIRS = [
  'data/',
  'public/data/',
  'public/textures/',
  'public/logos/',
  'node_modules/',
  '.git/',
  '.claude/',
];

// Cache mémoire : évite de re-hit GitHub sur chaque GET /api/update/status.
let _cached = null; // { fetchedAt, release }
let _checkTimer = null;
let _emitter = null;
let _inProgress = false;

function setEmitter(fn) { _emitter = fn; }
function _emit(payload) { try { _emitter && _emitter(payload); } catch (_) {} }

function getCurrentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch { return '0.0.0'; }
}

// Comparaison semver simple : 1.2.3 → [1,2,3]. Renvoie -1, 0, ou 1.
function _normVer(v) {
  return String(v || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}
function compareVersions(a, b) {
  const A = _normVer(a), B = _normVer(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0, y = B[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// GET https avec timeout + redirect.
function _httpsGet(url, { headers = {}, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      protocol: u.protocol, hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'leitmotiv-update-checker', Accept: 'application/json', ...headers },
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        return resolve(_httpsGet(new URL(res.headers.location, url).toString(), { headers, timeoutMs }));
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}

async function fetchLatestRelease() {
  const { body } = await _httpsGet(API_URL);
  const data = JSON.parse(body);
  return {
    tagName:     data.tag_name,                  // ex: "v1.0.0"
    name:        data.name || data.tag_name,
    body:        data.body || '',                // release notes (markdown)
    htmlUrl:     data.html_url,
    publishedAt: data.published_at,
    zipballUrl:  data.zipball_url,               // source code zip
    assets:      (data.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
  };
}

// État courant : current vs latest + dismissed.
async function getUpdateState({ force = false } = {}) {
  const current = getCurrentVersion();
  const cfg = readConfig();
  const updCfg = cfg.update || {};

  let release = null;
  let error = null;
  // Cache 1h sauf si force.
  const now = Date.now();
  if (!force && _cached && (now - _cached.fetchedAt < 60 * 60 * 1000)) {
    release = _cached.release;
  } else {
    try {
      release = await fetchLatestRelease();
      _cached = { fetchedAt: now, release };
      // Persiste le timestamp dans config.json
      cfg.update = { ...updCfg, lastCheckAt: new Date().toISOString() };
      writeConfig(cfg);
    } catch (e) {
      error = e.message;
      release = _cached?.release || null;
    }
  }

  const latest = release ? release.tagName.replace(/^v/i, '') : current;
  const available = !!release && compareVersions(latest, current) > 0;
  const dismissed = updCfg.dismissedVersion === latest;

  return {
    current,
    latest,
    available,
    dismissed,
    release,
    lastCheckAt: cfg.update?.lastCheckAt || null,
    error,
  };
}

// Force un re-fetch et émet via socket si un changement est détecté.
async function checkNow() {
  const state = await getUpdateState({ force: true });
  _emit(state);
  return state;
}

// Démarre le polling périodique (et exécute un check initial 5s après boot).
function startBackgroundChecks() {
  setTimeout(() => checkNow().catch(() => {}), 5000);
  if (_checkTimer) clearInterval(_checkTimer);
  _checkTimer = setInterval(() => checkNow().catch(() => {}), CHECK_INTERVAL_MS);
}

// Marque la version dispo comme "ignorée" pour ne plus notifier dessus.
function dismissVersion(version) {
  const cfg = readConfig();
  cfg.update = { ...(cfg.update || {}), dismissedVersion: version };
  writeConfig(cfg);
}

// ── Téléchargement + extraction ───────────────────────────────────────────

function _streamDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const doGet = (u) => https.get(u, { headers: { 'User-Agent': 'leitmotiv-update-checker' } }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) return doGet(res.headers.location);
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    doGet(url);
  });
}

function _isPreserved(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (PRESERVE_PATHS.has(norm)) return true;
  return PRESERVE_DIRS.some(d => norm === d.slice(0, -1) || norm.startsWith(d));
}

// Copie un dossier sur un autre en sautant les chemins préservés.
function _copyDirOver(srcDir, dstDir) {
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcFull = path.join(srcDir, ent.name);
    const rel     = path.relative(ROOT_DIR, path.join(dstDir, ent.name)).replace(/\\/g, '/');
    if (_isPreserved(rel + (ent.isDirectory() ? '/' : ''))) continue;
    if (_isPreserved(rel)) continue;
    const dstFull = path.join(dstDir, ent.name);
    if (ent.isDirectory()) {
      if (!fs.existsSync(dstFull)) fs.mkdirSync(dstFull, { recursive: true });
      _copyDirOver(srcFull, dstFull);
    } else {
      fs.copyFileSync(srcFull, dstFull);
    }
  }
}

// Applique l'update : DL zip → extract → copie sur ROOT en préservant les
// chemins listés → npm install (best effort) → renvoie un statut. La sortie
// avec RESTART_EXIT_CODE est gérée par l'appelant (server.js) pour permettre
// au wrapper start.bat de relancer.
async function applyUpdate({ release } = {}) {
  if (_inProgress) throw new Error('Update déjà en cours');
  _inProgress = true;
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'leitmotiv-update-'));
  const zipPath  = path.join(tmpDir, 'release.zip');
  const extract  = path.join(tmpDir, 'extracted');
  fs.mkdirSync(extract, { recursive: true });

  try {
    const rel = release || (await fetchLatestRelease());
    if (!rel?.zipballUrl) throw new Error('zipball_url absent');

    _emit({ phase: 'download' });
    await _streamDownload(rel.zipballUrl, zipPath);

    _emit({ phase: 'extract' });
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extract, true);

    // Le zipball GitHub crée un dossier racine `<owner>-<repo>-<sha>/`.
    const subs = fs.readdirSync(extract).filter(n => fs.statSync(path.join(extract, n)).isDirectory());
    if (!subs.length) throw new Error('Archive vide');
    const sourceRoot = path.join(extract, subs[0]);

    _emit({ phase: 'apply' });
    _copyDirOver(sourceRoot, ROOT_DIR);

    _emit({ phase: 'npm-install' });
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const res = spawnSync(npm, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: ROOT_DIR, stdio: 'inherit', shell: true,
    });
    if (res.status !== 0) console.warn('[update] npm install code', res.status);

    _emit({ phase: 'done' });
    return { ok: true, version: rel.tagName };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    _inProgress = false;
  }
}

module.exports = {
  RESTART_EXIT_CODE,
  getCurrentVersion,
  compareVersions,
  fetchLatestRelease,
  getUpdateState,
  checkNow,
  startBackgroundChecks,
  dismissVersion,
  applyUpdate,
  setEmitter,
};
