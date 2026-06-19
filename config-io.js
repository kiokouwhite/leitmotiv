// config-io.js
// ─────────────────────────────────────────────────────────────────────────────
// I/O atomique de config.json — module partagé entre auth-state.js et remote-access.js.
// Aucun état interne, juste 3 helpers purs.
// writeConfig fait un écrit atomique tmp + rename pour éviter la corruption en
// cas de crash en plein milieu d'une mutation (config.json contient startggApiKey,
// layouts, secrets, etc.).
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (err) {
    console.error('[config-io] readConfig failed:', err.message);
    return {};
  }
}

function writeConfig(cfg) {
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
}

module.exports = { CONFIG_FILE, readConfig, writeConfig };
