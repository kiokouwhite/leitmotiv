// auth-state.js
// ─────────────────────────────────────────────────────────────────────────────
// Module central d'authentification pour Leitmotiv.
// Objectif S1 : sortir le mot de passe et le session secret des `const` figées
// au boot pour permettre :
//   - le hash bcrypt du mot de passe (jamais stocké en clair)
//   - la rotation à chaud (changement via API sans redémarrer)
//   - la persistance dans config.json (section `auth`)
//   - une comparaison timing-safe (déjà fournie par bcrypt.compare)
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const { readConfig, writeConfig } = require('./config-io'); // I/O atomique partagée avec remote-access.js

// bcrypt natif en premier choix, fallback bcryptjs (compat Windows sans VS Build Tools).
// Les deux exposent la même API (hash, hashSync, compare, compareSync).
let bcrypt;
try { bcrypt = require('bcrypt'); }
catch { bcrypt = require('bcryptjs'); }

// ─── Constantes sentinelles ─────────────────────────────────────────────────
const DEFAULT_SECRET     = 'pso-dev-secret-change-me'; // valeur d'usine (à rotater impérativement)
const FACTORY_PASSWORD   = 'changeme';                  // mot de passe d'usine (à changer impérativement)
const BCRYPT_COST        = 10;                          // standard 2026, ~80ms sur CPU moderne

// ─── État privé (mutable, jamais exporté directement) ───────────────────────
let sessionSecret        = DEFAULT_SECRET;
let controlPasswordHash  = null;   // null = auth désactivée (mode dev/sans-mdp)
let lastChangedAt        = null;   // ISO-8601, info purement diagnostique

// Met à jour uniquement la section auth, en préservant tout le reste du config.
function persistAuthSection() {
  const cfg = readConfig();
  cfg.auth = {
    controlPasswordHash,
    sessionSecret,
    lastChangedAt,
  };
  writeConfig(cfg);
}

// ─── Bootstrap : appelé une seule fois au require() ─────────────────────────
// Priorité : config.json > variable d'environnement > valeur d'usine.
(function bootstrap() {
  const cfg     = readConfig();
  const authCfg = cfg.auth || {};

  // ── Session secret ──
  if (authCfg.sessionSecret) {
    sessionSecret = authCfg.sessionSecret;
  } else if (process.env.SESSION_SECRET) {
    sessionSecret = process.env.SESSION_SECRET;
  } else {
    sessionSecret = DEFAULT_SECRET;
  }

  // ── Hash du mot de passe ──
  if (authCfg.controlPasswordHash) {
    // Déjà hashé et persisté : on l'utilise tel quel.
    controlPasswordHash = authCfg.controlPasswordHash;
  } else if (process.env.CONTROL_PASSWORD) {
    // Migration douce : l'utilisateur avait défini CONTROL_PASSWORD en env.
    // On hash à la volée (~80ms au boot, acceptable) et on persiste pour
    // ne plus jamais relire la valeur claire.
    try {
      controlPasswordHash = bcrypt.hashSync(process.env.CONTROL_PASSWORD, BCRYPT_COST);
      lastChangedAt = new Date().toISOString();
      persistAuthSection();
      console.log('[auth-state] CONTROL_PASSWORD env hashé et persisté dans config.json (migration).');
    } catch (e) {
      console.error('[auth-state] échec du hash de CONTROL_PASSWORD env:', e.message);
      controlPasswordHash = null;
    }
  } else {
    // Aucun mot de passe configuré → mode auth désactivée (compat dev local).
    controlPasswordHash = null;
  }

  lastChangedAt = authCfg.lastChangedAt || lastChangedAt;

  // ── Avertissements console au démarrage ──
  if (controlPasswordHash === null) {
    console.warn('[auth-state] AUCUN mot de passe de contrôle configuré : /control est ouvert sur le LAN.');
  }
  if (sessionSecret === DEFAULT_SECRET) {
    console.warn('[auth-state] SESSION_SECRET utilise la valeur d\'usine : appelez rotateSessionSecret() ou définissez-le dans config.json.');
  }
})();

// ─── API publique ───────────────────────────────────────────────────────────

// Getter : retourne le hash courant (null si auth désactivée).
function getControlPasswordHash() {
  return controlPasswordHash;
}

// Getter : retourne le session secret courant (jamais null).
function getSessionSecret() {
  return sessionSecret;
}

// Helper : true ssi un hash est posé (= auth active).
function isAuthEnabled() {
  return controlPasswordHash !== null && controlPasswordHash !== '';
}

// Vérification timing-safe d'un mot de passe en clair.
// Retourne true si auth désactivée (parité avec l'ancien `!CONTROL_PASSWORD || password === CONTROL_PASSWORD`).
async function verifyPassword(plain) {
  if (!isAuthEnabled()) return true;
  if (typeof plain !== 'string' || plain.length === 0) return false;
  try {
    return await bcrypt.compare(plain, controlPasswordHash);
  } catch (e) {
    console.error('[auth-state] bcrypt.compare a échoué:', e.message);
    return false;
  }
}

// Setter : hash + persiste un nouveau mot de passe.
// plain === '' OU null OU undefined → désactive l'auth (controlPasswordHash = null).
// Cost 10 par défaut (override possible via 2e arg pour tests).
async function setControlPassword(plain, cost = BCRYPT_COST) {
  if (plain === null || plain === undefined || plain === '') {
    controlPasswordHash = null;
  } else {
    if (typeof plain !== 'string') throw new Error('setControlPassword: plain doit être une string');
    controlPasswordHash = await bcrypt.hash(plain, cost);
  }
  lastChangedAt = new Date().toISOString();
  persistAuthSection();
}

// Rotation du session secret. Génère 32 octets aléatoires en hex (64 chars).
// ATTENTION : invalide TOUS les cookies pso-session existants → re-login forcé partout.
function rotateSessionSecret() {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  lastChangedAt = new Date().toISOString();
  persistAuthSection();
  return sessionSecret;
}

// Détection du mot de passe d'usine.
// true si : aucun hash posé (mode désactivé) OU le hash courant valide le mot 'changeme'.
function hasDefaultPassword() {
  if (!isAuthEnabled()) return true;
  try {
    return bcrypt.compareSync(FACTORY_PASSWORD, controlPasswordHash);
  } catch {
    return false;
  }
}

// Détection du session secret d'usine (avertissement bannière UI).
function hasDefaultSessionSecret() {
  return sessionSecret === DEFAULT_SECRET;
}

module.exports = {
  getControlPasswordHash,
  getSessionSecret,
  isAuthEnabled,
  verifyPassword,
  setControlPassword,
  rotateSessionSecret,
  hasDefaultPassword,
  hasDefaultSessionSecret,
};
