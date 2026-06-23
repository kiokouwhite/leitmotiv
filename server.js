const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const auth = require('./auth-state'); // S1 : module central d'authentification (hash + rotation à chaud)
const remoteAccess = require('./remote-access'); // S3 : tunnel ngrok intégré (module additif isolé)
const updater = require('./update-checker'); // S4 : check + DL + apply mises à jour GitHub (release v1.0.0+)
const { mountRemote3DS } = require('./remote-3ds'); // télécommande de score « 3DS only » (module additif isolé)

const RULESETS_FILE      = path.join(__dirname, 'data', 'rulesets.json');

function loadRulesets() {
  try {
    if (!fs.existsSync(path.dirname(RULESETS_FILE))) {
      fs.mkdirSync(path.dirname(RULESETS_FILE), { recursive: true });
    }
    if (!fs.existsSync(RULESETS_FILE)) return [];
    return JSON.parse(fs.readFileSync(RULESETS_FILE, 'utf8'));
  } catch { return []; }
}

function saveRulesets(list) {
  fs.writeFileSync(RULESETS_FILE, JSON.stringify(list, null, 2));
}

const PORT     = process.env.PORT || 3002;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// S1 : SESSION_SECRET et CONTROL_PASSWORD ne sont plus capturés en `const`.
// L'état vit dans auth-state.js et est lu via getters → permet la rotation à chaud.

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function signToken(payload) {
  const data = JSON.stringify(payload);
  const sig  = crypto.createHmac('sha256', auth.getSessionSecret()).update(data).digest('base64url');
  return Buffer.from(data).toString('base64url') + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const [dataPart, sig] = token.split('.');
  if (!dataPart || !sig) return null;
  const expected = crypto.createHmac('sha256', auth.getSessionSecret()).update(Buffer.from(dataPart, 'base64url').toString()).digest('base64url');
  // Garde anti-throw : timingSafeEqual exige des buffers de même longueur.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try { return JSON.parse(Buffer.from(dataPart, 'base64url').toString()); } catch { return null; }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(c => {
    const i = c.indexOf('=');
    return i < 0
      ? [decodeURIComponent(c.trim()), '']
      : [decodeURIComponent(c.slice(0, i).trim()), decodeURIComponent(c.slice(i + 1).trim())];
  }));
}

function requireAuth(req, res, next) {
  if (!auth.isAuthEnabled()) return next();
  const cookies = parseCookies(req);
  const payload = verifyToken(cookies['pso-session']);
  if (payload && payload.auth === true) return next();
  if (req.path === '/login' || req.path === '/api/login') return next();
  // Réponse 401 JSON dès qu'on tape une API (Accept JSON OU /api/*), sinon redirect HTML.
  const wantsJson = (req.headers.accept && req.headers.accept.includes('application/json'))
                 || req.path.startsWith('/api/');
  if (wantsJson) return res.status(401).json({ error: 'Non authentifié' });
  res.redirect('/login');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 25e6,
});

// S3 : pousse les mises à jour de statut ngrok à tous les clients /control en live.
remoteAccess.setStatusEmitter((status) => { io.emit('remoteAccessUpdate', status); });
updater.setEmitter((payload) => { io.emit('updateStatus', payload); });

app.use(express.json({ limit: '25mb' }));

// S1 : trust proxy pour que req.ip reflète le vrai client (rate-limit par IP).
// Sans ça, derrière un reverse-proxy tout le monde partage la même IP → rate-limit global.
app.set('trust proxy', 1);

// S1 : rate-limiter dédié au login. 5 tentatives par IP / 15 min, ne décompte que les échecs.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});

// Auth check on /control and write-API routes — overlays stay public
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  const isControl  = p === '/control' || p === '/control.html';
  const isWriteApi = req.method !== 'GET' && p.startsWith('/api/') && p !== '/api/login';
  // S1 : /api/server-info passe désormais par l'auth (expose la topologie réseau LAN).
  const isServerInfo = p === '/api/server-info';
  if (isControl || isWriteApi || isServerInfo) return requireAuth(req, res, next);
  next();
});


// Favicon inline (évite le 404 + l'indicateur de chargement permanent du navigateur).
// Wordmark PSO sur fond sombre arrondi — même teinte gold que le footer.
const _FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="12" fill="#02030e"/>' +
  '<g transform="translate(6 23) scale(0.0286)" fill="#EAB830">' +
  '<path d="M1548.6,-0l70.732,-0c132.75,-0 200.498,57.678 200.498,187.681l0,256.345c0,130.003 -67.748,188.596 -200.498,188.596l-154.722,0c-132.75,0 -200.499,-58.593 -200.499,-188.596l0,-256.345c0,-124.086 61.721,-182.28 182.775,-187.321c-0.411,102.633 -1.286,321.656 -1.286,326.364c0,60.112 48.803,108.915 108.915,108.915c60.112,-0 108.915,-48.803 108.915,-108.915c-0,-60.111 -48.803,-108.914 -108.915,-108.914c-1.984,-0 -3.957,0.053 -5.915,0.158l0,-217.968Z"/>' +
  '<path d="M58.373,511.306c-0.996,0.054 -1.998,0.081 -3.007,0.081c-30.557,-0 -55.366,-24.809 -55.366,-55.366c-0,-30.557 24.809,-55.366 55.366,-55.366c18.196,0 34.354,8.797 44.449,22.367c1.509,2.086 4.191,2.96 6.639,2.163c2.448,-0.796 4.102,-3.082 4.094,-5.656c-0.174,-55.802 -0.576,-155.87 -0.576,-155.87l176.109,-64.099l-0,107.739c-0.809,-0.035 -1.621,-0.052 -2.438,-0.052c-30.558,-0 -55.366,24.808 -55.366,55.365c-0,30.558 24.808,55.366 55.366,55.366c30.557,0 55.366,-24.808 55.366,-55.366c-0,-3.178 -0.778,-175.54 -1.143,-256.436c-0.041,-9.765 -4.644,-18.949 -12.442,-24.826c-7.798,-5.877 -17.895,-7.771 -27.292,-5.12l-239.759,67.637l-0,-134.712l331.417,0c120.848,0 183.103,53.1 183.103,170.286l0,161.66c0,117.186 -62.255,170.286 -183.103,170.286l-181.273,-0l0,111.165l-150.144,-0l-0,-111.246Z"/>' +
  '<path d="M887.439,315.844l0.062,0.009l-0,58.888l-81.151,-12.196c-119.933,-18.311 -162.047,-71.411 -162.047,-172.117l0,-14.649c0,-120.848 62.256,-174.863 200.499,-174.863l123.594,-0c137.328,-0 199.583,53.1 199.583,174.863l0,33.874l-150.145,0l0,-90.564c0,-38.452 -21.85,-44.169 -68.541,-44.169l-96.13,0c-47.606,0 -75.62,-0.279 -75.62,38.173l0,135.633c0,28.848 20.993,51.82 58.058,58.927c-0.223,-55.755 -0.521,-130.74 -0.521,-132.7c0,-30.557 24.809,-55.365 55.366,-55.365c30.557,-0 55.366,24.808 55.366,55.365c-0,30.558 -24.809,55.366 -55.366,55.366c-1.009,0 -2.011,-0.027 -3.007,-0.08l0,85.605Zm37.404,1.85l-0.061,-0.01l0,-58.887l81.151,12.196c119.932,18.31 162.046,71.41 162.046,172.117l0,14.648c0,120.849 -62.255,174.864 -200.498,174.864l-123.595,0c-137.327,0 -199.583,-53.1 -199.583,-174.864l0,-33.874l150.145,0l0,90.565c0,38.451 21.851,44.168 68.542,44.168l96.129,0c47.607,0 75.621,0.28 75.621,-38.172l-0,-135.634c-0,-28.847 -20.994,-51.819 -58.058,-58.926c0.222,55.754 0.52,130.74 0.52,132.699c0,30.557 -24.808,55.366 -55.366,55.366c-30.557,0 -55.365,-24.809 -55.365,-55.366c-0,-30.557 24.808,-55.366 55.365,-55.366c1.009,0 2.012,0.027 3.007,0.081l0,-85.605Z"/>' +
  '</g></svg>';
app.get('/favicon.ico', (req, res) => {
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(_FAVICON_SVG);
});

app.use('/full', express.static(path.join(__dirname, 'public', 'full'), { maxAge: '7d' }));
// Static principal : no-cache sur HTML/JS/CSS pour que le panneau de contrôle
// et les overlays récupèrent toujours la dernière version après une mise à
// jour (sinon le navigateur sert un ancien overlay.js/css en cache et on
// croit qu'un bug persiste alors qu'il est déjà corrigé). Les assets lourds
// (images, polices) gardent un cache court par défaut.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
}));
app.use('/companion', express.static(path.join(__dirname, 'companion')));

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.get('/login', (req, res) => {
  if (!auth.isAuthEnabled()) return res.redirect('/control');
  const cookies = parseCookies(req);
  if (verifyToken(cookies['pso-session'])?.auth) return res.redirect('/control');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { password } = req.body || {};
  // verifyPassword retourne true si auth désactivée (préserve la sémantique d'origine).
  const ok = await auth.verifyPassword(password || '');
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
  const token  = signToken({ auth: true, ts: Date.now() });
  const maxAge = 7 * 24 * 3600;
  const secureFlag = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `pso-session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`);
  res.json({ ok: true });
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'pso-session=; HttpOnly; Path=/; Max-Age=0');
  res.redirect('/login');
});

// S1 : API admin pour changer le mot de passe à chaud (sans restart).
// Protégée par le middleware global (POST + /api/ + pas /api/login).
app.post('/api/auth/change-password', async (req, res) => {
  const { current, next: nextPwd } = req.body || {};
  if (typeof nextPwd !== 'string' || nextPwd.length < 4) {
    return res.status(400).json({ error: 'Nouveau mot de passe requis (4 chars min)' });
  }
  // Si une auth est déjà active, exiger le mdp actuel (en plus du cookie déjà validé par requireAuth).
  if (auth.isAuthEnabled()) {
    const ok = await auth.verifyPassword(current || '');
    if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }
  try {
    await auth.setControlPassword(nextPwd);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// S1 : rotation du session secret (invalide tous les cookies → re-login forcé).
app.post('/api/auth/rotate-secret', (req, res) => {
  try {
    auth.rotateSessionSecret();
    res.setHeader('Set-Cookie', 'pso-session=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// S1 : statut auth (pour bannière UI « mot de passe par défaut / secret d'usine »).
app.get('/api/auth/status', requireAuth, (req, res) => {
  res.json({
    authEnabled: auth.isAuthEnabled(),
    hasDefaultPassword: auth.hasDefaultPassword(),
    hasDefaultSessionSecret: auth.hasDefaultSessionSecret(),
  });
});

// ─── Server info (baseUrl + réseau) ──────────────────────────────────────────

function getLocalIPs() {
  const result = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) result.push(addr.address);
    }
  }
  return result;
}

app.get('/api/server-info', (req, res) => {
  res.json({ baseUrl: BASE_URL, port: PORT, ips: getLocalIPs() });
});

// ─── State ────────────────────────────────────────────────────────────────────

let vsConfig = (() => {
  const saved = (() => { try { return JSON.parse(fs.readFileSync('./data/vs-config.json','utf8')); } catch { return {}; } })();
  return Object.assign({
    bg:         { blur: 18, brightness: 30, saturation: 140, opacity: 100 },
    vignette:   { intensity: 100 },
    scanlines:  { visible: true, opacity: 8 },
    particles:  { p1Override: 'auto', p2Override: 'auto', density: 100, opacity: 100 },
    animation:  { entryType: 'slide', exitType: 'fade', flashEnabled: true, autoHide: 0, duration: 700 },
    tint:       { visible: false, color: '#000000', opacity: 0 },
  }, saved);
})();

function saveVsConfig() {
  try { fs.writeFileSync('./data/vs-config.json', JSON.stringify(vsConfig, null, 2)); } catch {}
}

let victoryConfig = (() => {
  const saved = (() => { try { return JSON.parse(fs.readFileSync('./data/victory-config.json','utf8')); } catch { return {}; } })();
  return Object.assign({
    bg:        { blur: 18, brightness: 30, saturation: 140, opacity: 100 },
    vignette:  { intensity: 100 },
    scanlines: { visible: true, opacity: 8 },
    particles: { p1Override: 'auto', p2Override: 'auto', density: 100, opacity: 100 },
    animation: { entryType: 'fade', exitType: 'fade', flashEnabled: true, autoHide: 0, duration: 700 },
    tint:      { visible: false, color: '#000000', opacity: 0 },
  }, saved);
})();

function saveVictoryConfig() {
  try { fs.writeFileSync('./data/victory-config.json', JSON.stringify(victoryConfig, null, 2)); } catch {}
}

let matchState = {
  player1: { name: 'PLAYER 1', score: 0, character: null, color: '#E83030', tag: '', pronouns: '', stockColor: 0, flag: '', flagOffsetX: 0, flagOffsetY: 0, seeding: null, socials: ['', '', ''] },
  player2: { name: 'PLAYER 2', score: 0, character: null, color: '#3070E8', tag: '', pronouns: '', stockColor: 0, flag: '', flagOffsetX: 0, flagOffsetY: 0, seeding: null, socials: ['', '', ''] },
  flagSize: 52,
  format: 'Bo3',
  customWins: 2,
  event: 'TOURNAMENT',
  stage: 'Grand Final',
  currentStage: '',
  centerLogo: '',
  swapped: false,
  overlayStyle: 'full',
  sbBgColor: '#0E0E12',
  sbBgOpacity: 100,
  eventTextSize: 12,
  eventTextColor: '#EAB830',
  tagColor: '#E8B830',
  nameColor: '#F0EEF8',
  pronounsColor: '#5A5A7A',
  overlayTheme: 'default',
  logoParticleCount: 3,
  particleOpacity: 100,
  particleCountScale: 100,
  particlesEnabled: true,
  hidePlayerColors: false,
  charDisplayMode: 'normal',
  visible: true,
  sbScale: 100,
  sbX: 0,
  sbY: 0,
  eventBarPosition: 'top',
  scoreDisplay: 'numbers',
  dotsOrientation: 'row',
  ltVisible: false,
  ltBottom: 150,
  ltPaddingX: 60,
  transparentPositions: {
    event:  { x: 720,  y: 0  },
    p1Icon: { x: 631,  y: 28 },
    p1Name: { x: 724,  y: 50 },
    score:  { x: 886,  y: 28 },
    p2Name: { x: 1056, y: 50 },
    p2Icon: { x: 1222, y: 28 },
  },
  overlayTexture:        null,
  overlayTextureOpacity: 50,
  overlayTextureBlend:   'normal',
  overlayTextureSize:    'repeat',
};

let characterList = [
  { id: 'mario',           name: 'Mario',               image: '' },
  { id: 'donkey_kong',     name: 'Donkey Kong',          image: '' },
  { id: 'link',            name: 'Link',                 image: '' },
  { id: 'samus',           name: 'Samus',                image: '' },
  { id: 'dark_samus',      name: 'Dark Samus',           image: '' },
  { id: 'yoshi',           name: 'Yoshi',                image: '' },
  { id: 'kirby',           name: 'Kirby',                image: '' },
  { id: 'fox',             name: 'Fox',                  image: '' },
  { id: 'pikachu',         name: 'Pikachu',              image: '' },
  { id: 'luigi',           name: 'Luigi',                image: '' },
  { id: 'ness',            name: 'Ness',                 image: '' },
  { id: 'captain_falcon',  name: 'Captain Falcon',       image: '' },
  { id: 'jigglypuff',      name: 'Jigglypuff',           image: '' },
  { id: 'peach',           name: 'Peach',                image: '' },
  { id: 'daisy',           name: 'Daisy',                image: '' },
  { id: 'bowser',          name: 'Bowser',               image: '' },
  { id: 'ice_climbers',    name: 'Ice Climbers',         image: '' },
  { id: 'sheik',           name: 'Sheik',                image: '' },
  { id: 'zelda',           name: 'Zelda',                image: '' },
  { id: 'dr_mario',        name: 'Dr. Mario',            image: '' },
  { id: 'pichu',           name: 'Pichu',                image: '' },
  { id: 'falco',           name: 'Falco',                image: '' },
  { id: 'marth',           name: 'Marth',                image: '' },
  { id: 'lucina',          name: 'Lucina',               image: '' },
  { id: 'young_link',      name: 'Young Link',           image: '' },
  { id: 'ganondorf',       name: 'Ganondorf',            image: '' },
  { id: 'mewtwo',          name: 'Mewtwo',               image: '' },
  { id: 'roy',             name: 'Roy',                  image: '' },
  { id: 'chrom',           name: 'Chrom',                image: '' },
  { id: 'mr_game_watch',   name: 'Mr. Game & Watch',     image: '' },
  { id: 'meta_knight',     name: 'Meta Knight',          image: '' },
  { id: 'pit',             name: 'Pit',                  image: '' },
  { id: 'dark_pit',        name: 'Dark Pit',             image: '' },
  { id: 'zero_suit_samus', name: 'Zero Suit Samus',      image: '' },
  { id: 'wario',           name: 'Wario',                image: '' },
  { id: 'snake',           name: 'Snake',                image: '' },
  { id: 'ike',             name: 'Ike',                  image: '' },
  { id: 'pokemon_trainer', name: 'Pokémon Trainer',      image: '' },
  { id: 'diddy_kong',      name: 'Diddy Kong',           image: '' },
  { id: 'lucas',           name: 'Lucas',                image: '' },
  { id: 'sonic',           name: 'Sonic',                image: '' },
  { id: 'king_dedede',     name: 'King Dedede',          image: '' },
  { id: 'olimar',          name: 'Olimar',               image: '' },
  { id: 'lucario',         name: 'Lucario',              image: '' },
  { id: 'rob',             name: 'R.O.B.',               image: '' },
  { id: 'toon_link',       name: 'Toon Link',            image: '' },
  { id: 'wolf',            name: 'Wolf',                 image: '' },
  { id: 'villager',        name: 'Villager',             image: '' },
  { id: 'mega_man',        name: 'Mega Man',             image: '' },
  { id: 'wii_fit_trainer', name: 'Wii Fit Trainer',      image: '' },
  { id: 'rosalina',        name: 'Rosalina & Luma',      image: '' },
  { id: 'little_mac',      name: 'Little Mac',           image: '' },
  { id: 'greninja',        name: 'Greninja',             image: '' },
  { id: 'mii_brawler',     name: 'Mii Brawler',          image: '' },
  { id: 'mii_swordfighter',name: 'Mii Swordfighter',     image: '' },
  { id: 'mii_gunner',      name: 'Mii Gunner',           image: '' },
  { id: 'palutena',        name: 'Palutena',             image: '' },
  { id: 'pac_man',         name: 'Pac-Man',              image: '' },
  { id: 'robin',           name: 'Robin',                image: '' },
  { id: 'shulk',           name: 'Shulk',                image: '' },
  { id: 'bowser_jr',       name: 'Bowser Jr.',           image: '' },
  { id: 'duck_hunt',       name: 'Duck Hunt',            image: '' },
  { id: 'ryu',             name: 'Ryu',                  image: '' },
  { id: 'ken',             name: 'Ken',                  image: '' },
  { id: 'cloud',           name: 'Cloud',                image: '' },
  { id: 'corrin',          name: 'Corrin',               image: '' },
  { id: 'bayonetta',       name: 'Bayonetta',            image: '' },
  { id: 'inkling',         name: 'Inkling',              image: '' },
  { id: 'ridley',          name: 'Ridley',               image: '' },
  { id: 'simon',           name: 'Simon',                image: '' },
  { id: 'richter',         name: 'Richter',              image: '' },
  { id: 'king_k_rool',     name: 'King K. Rool',         image: '' },
  { id: 'isabelle',        name: 'Isabelle',             image: '' },
  { id: 'incineroar',      name: 'Incineroar',           image: '' },
  { id: 'piranha_plant',   name: 'Piranha Plant',        image: '' },
  { id: 'joker',           name: 'Joker',                image: '' },
  { id: 'hero',            name: 'Hero',                 image: '' },
  { id: 'banjo_kazooie',   name: 'Banjo & Kazooie',      image: '' },
  { id: 'terry',           name: 'Terry',                image: '' },
  { id: 'byleth',          name: 'Byleth',               image: '' },
  { id: 'min_min',         name: 'Min Min',              image: '' },
  { id: 'steve',           name: 'Steve',                image: '' },
  { id: 'sephiroth',       name: 'Sephiroth',            image: '' },
  { id: 'pyra_mythra',     name: 'Pyra-Mythra',          image: '' },
  { id: 'kazuya',          name: 'Kazuya',               image: '' },
  { id: 'sora',            name: 'Sora',                 image: '' },
];

let rulesetState = {
  stages: [],
  banPatternGame1: '2-2',
  banPatternGame2: '1',
  firstBanner: 1,
  stageClause: false,
  pickG1: true,
  pickG2: true,
};

let castersState = {
  visible: false,
  layout: 'row',
  bgColor: '#0E0E12',
  bgOpacity: 100,
  casters: [
    { name: '', twitter: '', twitch: '', youtube: '' },
    { name: '', twitter: '', twitch: '', youtube: '' },
  ],
  showLabel:    true,
  c1ShowName:   true, c1NameSize: 22, c1NameColor: '#F0EEF8',
  c1ShowTwitter: true, c1ShowTwitch: true, c1ShowYoutube: true,
  c2ShowName:   true, c2NameSize: 22, c2NameColor: '#F0EEF8',
  c2ShowTwitter: true, c2ShowTwitch: true, c2ShowYoutube: true,
};

let twitchChatState = {
  visible: false,
  channel: '',
  maxMessages: 15,
  x: 0,
  y: 0,
  width: 360,
  maxHeight: 600,
  particleBorder: 28,
  transparentMode: false,
};

let twitchAlertsState = {
  subsEnabled: true,
  bitsEnabled: true,
  bitsMinAmount: 1,
  duration: 6000,
  position: 'bottom-right',
};

(function () {
  const cfg = getConfig();
  const saved = cfg.twitchAlerts || {};
  twitchAlertsState = { ...twitchAlertsState, ...saved };
})();

let playerStatsState = {
  visible: false,
  playerName: '',
  playerTag: '',
  playerColor: '#E8B830',
  eventName: '',
  wins: 0,
  losses: 0,
  topCharacters: [],  // [{ name, image, games }]
  allMatches: [],   // [{ round, opponentName, opponentTag, result, score, opponentScore }]
  nextMatch: null,  // { round, opponentName, opponentTag, state } ou null
};

// ─── Veto helpers ─────────────────────────────────────────────────────────────

function generateVetoSequence(pattern, firstBanner) {
  const seq = [];
  const parts = String(pattern).split('-').map(n => parseInt(n)).filter(n => n > 0);
  let current = firstBanner === 2 ? 2 : 1;
  for (const count of parts) {
    for (let i = 0; i < count; i++) {
      seq.push({ action: 'ban', player: current, mapId: null });
    }
    current = current === 1 ? 2 : 1;
  }
  seq.push({ action: 'decider', player: 0, mapId: null });
  return seq;
}

function makeVetoState(gameNumber = 1, playedStageIds = [], visible = true) {
  const pattern = gameNumber === 1 ? rulesetState.banPatternGame1 : rulesetState.banPatternGame2;
  const stages = rulesetState.stages
    .filter(s => !rulesetState.stageClause || !playedStageIds.includes(s.id))
    .map(s => ({ ...s, status: 'available' }));
  return {
    stages,
    sequence: generateVetoSequence(pattern, rulesetState.firstBanner),
    currentStep: 0,
    player1Name: matchState.player1.name,
    player2Name: matchState.player2.name,
    player1Color: matchState.player1.color,
    player2Color: matchState.player2.color,
    banPatternGame1: rulesetState.banPatternGame1,
    banPatternGame2: rulesetState.banPatternGame2,
    firstBanner: rulesetState.firstBanner,
    stageClause: rulesetState.stageClause,
    gameNumber,
    playedStageIds,
    done: false,
    visible,
  };
}

let vetoState = makeVetoState();

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.redirect('/control'));
app.get('/guide', (req, res) => res.sendFile(path.join(__dirname, 'public', 'guide.html')));
app.get('/deck',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'deck.html')));
app.get('/regie', (req, res) => res.sendFile(path.join(__dirname, 'public', 'regie.html')));
app.get('/overlay',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));
app.get('/overlay-slim', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay-slim.html')));
app.get('/h2h',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'h2h.html')));
app.get('/youtube-chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'youtube-chat.html')));
app.get('/twitch-alerts',(req, res) => res.sendFile(path.join(__dirname, 'public', 'twitch-alerts.html')));
app.get('/stageveto', (req, res) => res.sendFile(path.join(__dirname, 'public', 'stageveto.html')));
app.get('/casters', (req, res) => res.sendFile(path.join(__dirname, 'public', 'casters.html')));
app.get('/control', (req, res) => res.sendFile(path.join(__dirname, 'public', 'control.html')));
app.get('/vs-screen', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vs-screen.html')));
app.get('/victory',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'victory.html')));
app.get('/player-stats', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player-stats.html')));
app.get('/nextmatch',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'nextmatch.html')));
app.get('/twitch-viewer',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'twitch-viewer.html')));
app.get('/youtube-viewer',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'youtube-viewer.html')));
app.get('/youtube-alerts',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'youtube-alerts.html')));
app.get('/combined-chat',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'combined-chat.html')));
app.get('/ticker', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ticker.html')));
app.get('/frames', (req, res) => res.sendFile(path.join(__dirname, 'public', 'frames.html')));
app.get('/stream-title',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'stream-title.html')));
app.get('/pso',           (req, res) => res.sendFile(path.join(__dirname, 'public', 'pso.html')));
app.get('/avsync',              (req, res) => res.sendFile(path.join(__dirname, 'public', 'avsync.html')));

// ─── Collection OBS ───────────────────────────────────────────────────────────
app.get('/api/obs-collection', (req, res) => {
  const host = req.protocol + '://' + req.hostname + ':3002';
  const CSS  = 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }';

  const OVERLAYS = [
    // ── Smash / Général ──────────────────────────────────────────────────────
    { scene: 'PSO – Scoreboard',           source: 'PSO Scoreboard',           path: '/overlay' },
    { scene: 'PSO – Scoreboard Slim',      source: 'PSO Scoreboard Slim',      path: '/overlay-slim' },
    { scene: 'PSO – Scoreboard Custom',    source: 'PSO Scoreboard Custom',    path: '/scoreboard-custom' },
    { scene: 'PSO – VS Screen',            source: 'PSO VS Screen',            path: '/vs-screen' },
    { scene: 'PSO – Victory',              source: 'PSO Victory',              path: '/victory' },
    { scene: 'PSO – Casters',              source: 'PSO Casters',              path: '/casters' },
    { scene: 'PSO – Casters Custom',       source: 'PSO Casters Custom',       path: '/casters-custom' },
    { scene: 'PSO – Head to Head',         source: 'PSO Head to Head',         path: '/h2h' },
    { scene: 'PSO – Stage Veto',           source: 'PSO Stage Veto',           path: '/stageveto' },
    { scene: 'PSO – Stats Joueur',         source: 'PSO Stats Joueur',         path: '/player-stats' },
    { scene: 'PSO – Historique Tournoi',   source: 'PSO Historique Tournoi',   path: '/tournament-history' },
    { scene: 'PSO – Bracket',              source: 'PSO Bracket',              path: '/bracket' },
    { scene: 'PSO – Top 8',               source: 'PSO Top 8',               path: '/top8' },
    { scene: 'PSO – Timer',               source: 'PSO Timer',               path: '/timer' },
    { scene: 'PSO – Prochain Match',       source: 'PSO Prochain Match',       path: '/upcoming' },
    // ── Caméra & layout ──────────────────────────────────────────────────────
    { scene: 'PSO – Cam Overlay',          source: 'PSO Cam Overlay',          path: '/cam' },
    { scene: 'PSO – Cadres',               source: 'PSO Cadres',               path: '/frames' },
    { scene: 'PSO – Ticker',               source: 'PSO Ticker',               path: '/ticker' },
    { scene: 'PSO – Stream Title',         source: 'PSO Stream Title',         path: '/stream-title' },
    { scene: 'PSO',                         source: 'PSO',                      path: '/pso' },
    // ── Twitch ───────────────────────────────────────────────────────────────
    { scene: 'PSO – Next Match',           source: 'PSO Next Match',           path: '/nextmatch' },
    { scene: 'PSO – Twitch Viewers',       source: 'PSO Twitch Viewers',       path: '/twitch-viewer' },
    { scene: 'PSO – Twitch Chat',          source: 'PSO Twitch Chat',          path: '/twitch-chat' },
    { scene: 'PSO – Twitch Alertes',       source: 'PSO Twitch Alertes',       path: '/twitch-alerts' },
    // ── YouTube ───────────────────────────────────────────────────────────────
    { scene: 'PSO – YouTube Viewers',      source: 'PSO YouTube Viewers',      path: '/youtube-viewer' },
    { scene: 'PSO – YouTube Chat',         source: 'PSO YouTube Chat',         path: '/youtube-chat' },
    { scene: 'PSO – YouTube Alertes',      source: 'PSO YouTube Alertes',      path: '/youtube-alerts' },
    // ── Chat & Divers ─────────────────────────────────────────────────────────
    { scene: 'PSO – Chat Combiné',         source: 'PSO Chat Combiné',         path: '/combined-chat' },
  ];

  function makeBrowserSource(name, url) {
    return {
      balance_val: 0.5,
      deinterlace_field_order: 0,
      deinterlace_mode: 0,
      enabled: true,
      flags: 0,
      hotkeys: {},
      id: 'browser_source',
      mixers: 0,
      monitoring_type: 0,
      muted: false,
      name,
      prev_ver: 503316480,
      private_settings: {},
      'push-to-mute-delay': 0,
      'push-to-talk-delay': 0,
      settings: {
        css: CSS,
        fps: 60,
        fps_custom: false,
        height: 1080,
        reroute_audio: false,
        restart_when_active: false,
        shutdown: false,
        url,
        webpage_control_level: 1,
        width: 1920,
      },
      sync: 0,
      versioned_id: 'browser_source',
      volume: 1.0,
    };
  }

  function makeScene(name, sourceName, itemId) {
    return {
      id: 'scene',
      name,
      private_settings: {},
      settings: {
        custom_size: false,
        id_counter: itemId,
        items: [{
          align: 5,
          bounds: { x: 0.0, y: 0.0 },
          bounds_align: 0,
          bounds_type: 0,
          crop_bottom: 0, crop_left: 0, crop_right: 0, crop_top: 0,
          group_item_backup: false,
          id: itemId,
          locked: true,
          name: sourceName,
          pos: { x: 0.0, y: 0.0 },
          private_settings: {},
          rot: 0.0,
          scale: { x: 1.0, y: 1.0 },
          scale_filter: 'disable',
          show_in_multiview: true,
          visible: true,
        }],
      },
      versioned_id: 'scene',
    };
  }

  const sources = [];
  const sceneOrder = [];
  OVERLAYS.forEach((ov, i) => {
    sources.push(makeBrowserSource(ov.source, host + ov.path));
    sources.push(makeScene(ov.scene, ov.source, i + 1));
    sceneOrder.push({ name: ov.scene });
  });

  const collection = {
    current_program_scene: OVERLAYS[0].scene,
    current_scene: OVERLAYS[0].scene,
    current_transition: 'Fade',
    global_audio_devices: null,
    modules: {
      'auto-scene-switcher': { active: false, interval: 300, scene_conditions: [], scene_no_match: '' },
    },
    name: 'PSO Overlays',
    preview_locked: false,
    quick_transitions: [],
    saved_projectors: [],
    scaling_enabled: false,
    scene_order: sceneOrder,
    sources,
    transition_duration: 300,
    transitions: [],
  };

  res.setHeader('Content-Disposition', 'attachment; filename="PSO-Overlays.json"');
  res.json(collection);
});


// ─── Titre du stream ──────────────────────────────────────────────────────────

let titleState = {
  visible:     false,
  title:       '',
  subtitle:    '',
  tag:         'LIVE',
  showTag:     false,
  showSubtitle:true,
  position:    'tl',      // tl, tc, tr, ml, mc, mr, bl, bc, br, custom
  x:           60,
  y:           60,
  maxWidth:    700,
  fontSize:    38,
  fontSizeSub: 17,
  bgOpacity:   94,        // 0-100
  animation:   'slide',   // slide, drop, bounce, fade, none
  align:       'left',    // left, center, right
};

// ─── Title ────────────────────────────────────────────────────────────────────

app.get('/api/title', (req, res) => res.json(titleState));

app.post('/api/title', (req, res) => {
  const bools   = ['visible','showTag','showSubtitle'];
  const numbers = ['x','y','maxWidth','fontSize','fontSizeSub','bgOpacity'];
  const strings = ['title','subtitle','tag','position','animation','align'];
  bools.forEach(k   => { if (req.body[k] !== undefined) titleState[k] = !!req.body[k]; });
  numbers.forEach(k => { if (req.body[k] !== undefined) titleState[k] = Number(req.body[k]); });
  strings.forEach(k => { if (req.body[k] !== undefined) titleState[k] = String(req.body[k]); });
  io.emit('titleUpdate', titleState);
  res.json({ ok: true });
});

// ─── Cam overlay ───────────────────────────────────────────────────────────────

let camState = {
  visible:   false,
  width:     360,
  height:    270,
  offsetX:   0,
  offsetY:   40,
  label:     'CAM',
  showLabel: true,
  cam2: {
    visible:   false,
    width:     360,
    height:    270,
    offsetX:   0,
    offsetY:   40,
    label:     'CAM 2',
    showLabel: true,
  },
};

app.get('/cam',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'cam.html')));
app.get('/api/cam',  (req, res) => res.json(camState));
app.post('/api/cam', (req, res) => {
  const s = req.body;
  if (s.visible   !== undefined) camState.visible   = !!s.visible;
  if (s.width     !== undefined) camState.width     = Math.max(80, Number(s.width));
  if (s.height    !== undefined) camState.height    = Math.max(60, Number(s.height));
  if (s.offsetX   !== undefined) camState.offsetX   = Number(s.offsetX);
  if (s.offsetY   !== undefined) camState.offsetY   = Number(s.offsetY);
  if (s.label     !== undefined) camState.label     = String(s.label).slice(0, 30);
  if (s.showLabel !== undefined) camState.showLabel = !!s.showLabel;
  if (s.cam2 !== undefined) {
    const c2 = s.cam2;
    if (c2.visible   !== undefined) camState.cam2.visible   = !!c2.visible;
    if (c2.width     !== undefined) camState.cam2.width     = Math.max(80, Number(c2.width));
    if (c2.height    !== undefined) camState.cam2.height    = Math.max(60, Number(c2.height));
    if (c2.offsetX   !== undefined) camState.cam2.offsetX   = Number(c2.offsetX);
    if (c2.offsetY   !== undefined) camState.cam2.offsetY   = Number(c2.offsetY);
    if (c2.label     !== undefined) camState.cam2.label     = String(c2.label).slice(0, 30);
    if (c2.showLabel !== undefined) camState.cam2.showLabel = !!c2.showLabel;
  }
  io.emit('camUpdate', camState);
  res.json({ ok: true });
});

// ─── Cadres (multi-frame overlay) ─────────────────────────────────────────────

let framesState = {
  count: 1,
  frames: [
    { visible: true, x: 320,  y: 250, width: 560, height: 420, label: '', showBg: false },
    { visible: true, x: 920,  y: 250, width: 560, height: 420, label: '', showBg: false },
    { visible: true, x: 920,  y: 710, width: 560, height: 420, label: '', showBg: false },
    { visible: true, x: 320,  y: 658, width: 560, height: 315, label: '', showBg: false },
    { visible: true, x: 1580, y: 198, width: 560, height: 315, label: '', showBg: false },
    { visible: true, x: 1580, y: 578, width: 560, height: 315, label: '', showBg: false },
  ],
};

app.get('/api/frames', (req, res) => res.json(framesState));

app.post('/api/frames', (req, res) => {
  const { count, frames } = req.body;
  if (count !== undefined) framesState.count = Math.max(1, Math.min(6, Number(count)));
  if (Array.isArray(frames)) {
    frames.forEach((f, i) => {
      if (!framesState.frames[i]) return;
      const t = framesState.frames[i];
      if (f.visible  !== undefined) t.visible  = !!f.visible;
      if (f.x        !== undefined) t.x        = Number(f.x);
      if (f.y        !== undefined) t.y        = Number(f.y);
      if (f.width    !== undefined) t.width    = Math.max(50, Number(f.width));
      if (f.height   !== undefined) t.height   = Math.max(50, Number(f.height));
      if (f.label    !== undefined) t.label    = String(f.label).slice(0, 40);
      if (f.showBg   !== undefined) t.showBg   = !!f.showBg;
    });
  }
  io.emit('framesUpdate', framesState);
  res.json({ ok: true });
});

// ─── Ticker (bandeau défilant) ─────────────────────────────────────────────────

let tickerState = {
  visible:   false,
  position:  'bottom',   // 'top' | 'bottom'
  label:     'INFO',
  separator: '◆',
  speed:     80,          // px/s
  messages:  [],
};

app.get('/api/ticker', (req, res) => res.json(tickerState));

app.post('/api/ticker', (req, res) => {
  const { visible, position, label, separator, speed, messages } = req.body;
  if (visible   !== undefined) tickerState.visible   = !!visible;
  if (position  !== undefined) tickerState.position  = position;
  if (label     !== undefined) tickerState.label     = String(label).slice(0, 20);
  if (separator !== undefined) tickerState.separator = String(separator).slice(0, 8);
  if (speed     !== undefined) tickerState.speed     = Math.max(20, Math.min(400, Number(speed)));
  if (messages  !== undefined) tickerState.messages  = (Array.isArray(messages) ? messages : []).map(m => String(m).trim()).filter(Boolean);
  io.emit('tickerUpdate', tickerState);
  res.json({ ok: true });
});

// ─── Twitch Viewers ────────────────────────────────────────────────────────────

let twitchState = {
  channel: '',
  clientId: '',
  clientSecret: '',
  viewers: null,      // null = hors ligne / inconnu
  live: false,
  _token: null,
  _tokenExpiry: 0,
};

async function twitchGetToken() {
  if (twitchState._token && Date.now() < twitchState._tokenExpiry - 60000) {
    return twitchState._token;
  }
  const { clientId, clientSecret } = twitchState;
  if (!clientId || !clientSecret) throw new Error('Identifiants Twitch manquants');
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error('Token Twitch invalide : ' + JSON.stringify(data));
  twitchState._token = data.access_token;
  twitchState._tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return twitchState._token;
}

async function twitchFetchViewers() {
  const { channel, clientId } = twitchState;
  if (!channel || !clientId) return;
  try {
    const token = await twitchGetToken();
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      { headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json();
    const stream = data.data && data.data[0];
    const viewers = stream ? stream.viewer_count : null;
    const live    = !!stream;
    if (viewers !== twitchState.viewers || live !== twitchState.live) {
      twitchState.viewers = viewers;
      twitchState.live    = live;
      io.emit('twitch-viewers', { viewers, live, channel });
    }
  } catch (e) {
    console.error('[twitch viewers]', e.message);
  }
}

let _twitchInterval = null;

function twitchStartPolling() {
  if (_twitchInterval) clearInterval(_twitchInterval);
  twitchFetchViewers();
  _twitchInterval = setInterval(twitchFetchViewers, 60000);
}

// Routes config Twitch
app.get('/api/twitch/config', (req, res) => {
  const cfg = getConfig();
  res.json({
    channel:      cfg.twitchChannel      || '',
    clientId:     cfg.twitchClientId     || '',
    hasSecret:    !!cfg.twitchClientSecret,
    viewers:      twitchState.viewers,
    live:         twitchState.live,
  });
});

app.post('/api/twitch/config', (req, res) => {
  const { channel, clientId, clientSecret } = req.body;
  const cfg = getConfig();
  if (channel    !== undefined) { cfg.twitchChannel      = channel;      twitchState.channel      = channel; }
  if (clientId   !== undefined) { cfg.twitchClientId     = clientId;     twitchState.clientId     = clientId; }
  if (clientSecret !== undefined && clientSecret !== '') {
    cfg.twitchClientSecret = clientSecret;
    twitchState.clientSecret = clientSecret;
  }
  twitchState._token       = null; // reset token
  twitchState._tokenExpiry = 0;
  saveConfig(cfg);
  if (twitchState.channel && twitchState.clientId && twitchState.clientSecret) {
    twitchStartPolling();
  }
  res.json({ ok: true });
});

// Initialisation au démarrage
(function () {
  const cfg = getConfig();
  twitchState.channel      = cfg.twitchChannel      || '';
  twitchState.clientId     = cfg.twitchClientId     || '';
  twitchState.clientSecret = cfg.twitchClientSecret || '';
  if (twitchState.channel && twitchState.clientId && twitchState.clientSecret) {
    twitchStartPolling();
  }
})();

// ── Twitch OAuth User (broadcaster) ──────────────────────────────────────────

let twitchUserAuth = {
  accessToken:      null,
  refreshToken:     null,
  expiresAt:        0,
  broadcasterId:    null,
  broadcasterLogin: null,
  displayName:      null,
  avatar:           null,
};

(function () {
  const cfg = getConfig();
  const saved = cfg.twitchUserToken || {};
  twitchUserAuth.accessToken      = saved.accessToken      || null;
  twitchUserAuth.refreshToken     = saved.refreshToken     || null;
  twitchUserAuth.expiresAt        = saved.expiresAt        || 0;
  twitchUserAuth.broadcasterId    = saved.broadcasterId    || null;
  twitchUserAuth.broadcasterLogin = saved.broadcasterLogin || null;
  twitchUserAuth.displayName      = saved.displayName      || null;
  twitchUserAuth.avatar           = saved.avatar           || null;
})();

function saveTwitchUserAuth() {
  const cfg = getConfig();
  cfg.twitchUserToken = { ...twitchUserAuth };
  saveConfig(cfg);
}

const TWITCH_SCOPES = [
  'channel:read:subscriptions',
  'channel:manage:predictions',
  'channel:read:predictions',
  'moderator:read:followers',
  'bits:read',
  'chat:read',
  'chat:edit',
  'user:read:email',
].join(' ');

app.get('/auth/twitch', (req, res) => {
  const { clientId } = twitchState;
  if (!clientId) return res.status(400).send('Client ID Twitch non configuré. Configure-le dans l\'onglet Twitch d\'abord.');
  const redirectUri = encodeURIComponent(`${BASE_URL}/auth/twitch/callback`);
  const scopes = encodeURIComponent(TWITCH_SCOPES);
  res.redirect(`https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&force_verify=true`);
});

app.get('/auth/twitch/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send('Erreur OAuth Twitch : ' + error);
  if (!code)  return res.status(400).send('Code manquant');
  const { clientId, clientSecret } = twitchState;
  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:    clientId,
        client_secret: clientSecret,
        code,
        grant_type:   'authorization_code',
        redirect_uri: `${BASE_URL}/auth/twitch/callback`,
      }),
    });
    const td = await tokenRes.json();
    if (!td.access_token) throw new Error('Token invalide : ' + JSON.stringify(td));

    twitchUserAuth.accessToken  = td.access_token;
    twitchUserAuth.refreshToken = td.refresh_token;
    twitchUserAuth.expiresAt    = Date.now() + (td.expires_in || 3600) * 1000;

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${td.access_token}` },
    });
    const ud = await userRes.json();
    const u  = ud.data && ud.data[0];
    if (u) {
      twitchUserAuth.broadcasterId    = u.id;
      twitchUserAuth.broadcasterLogin = u.login;
      twitchUserAuth.displayName      = u.display_name;
      twitchUserAuth.avatar           = u.profile_image_url || null;
    }
    saveTwitchUserAuth();

    // Auto-configure le channel depuis l'utilisateur authentifié
    if (u && u.login) {
      const prev = twitchState.channel;
      twitchState.channel = u.login;
      const cfg2 = getConfig();
      cfg2.twitchChannel = u.login;
      saveConfig(cfg2);
      if (twitchChatState.visible && (twitchChatState.channel !== prev || !twitchChatState.connected)) {
        twitchChatState.channel = u.login;
        ircConnect(u.login);
      } else if (!twitchChatState.channel) {
        twitchChatState.channel = u.login;
        io.emit('twitchChatUpdate', twitchChatState);
      }
    }

    io.emit('twitch-auth-status', {
      authenticated: true,
      displayName:   twitchUserAuth.displayName,
      login:         twitchUserAuth.broadcasterLogin,
      avatar:        twitchUserAuth.avatar || null,
    });
    res.send('<html><body style="font-family:sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#6bc96c">✅ Connecté avec Twitch !</h2><p style="color:#aaa">Tu peux fermer cette fenêtre.</p><script>if(window.opener)window.opener.postMessage({type:\'twitch-auth-ok\'},\'*\');setTimeout(()=>window.close(),1200)</script></div></body></html>');
  } catch (e) {
    console.error('[twitch oauth]', e.message);
    res.status(500).send('Erreur : ' + e.message);
  }
});

async function twitchRefreshUserToken() {
  const { clientId, clientSecret } = twitchState;
  if (!twitchUserAuth.refreshToken) throw new Error('Pas de refresh token');
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: twitchUserAuth.refreshToken,
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('Refresh échoué : ' + JSON.stringify(d));
  twitchUserAuth.accessToken  = d.access_token;
  twitchUserAuth.refreshToken = d.refresh_token || twitchUserAuth.refreshToken;
  twitchUserAuth.expiresAt    = Date.now() + (d.expires_in || 3600) * 1000;
  saveTwitchUserAuth();
}

async function twitchUserApi(method, url, body) {
  if (!twitchUserAuth.accessToken) throw new Error('Non authentifié avec Twitch');
  if (Date.now() > twitchUserAuth.expiresAt - 60000) await twitchRefreshUserToken();
  const opts = {
    method,
    headers: {
      'Client-Id':     twitchState.clientId,
      'Authorization': `Bearer ${twitchUserAuth.accessToken}`,
      'Content-Type':  'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  let r = await fetch(url, opts);
  if (r.status === 401) {
    await twitchRefreshUserToken();
    opts.headers['Authorization'] = `Bearer ${twitchUserAuth.accessToken}`;
    r = await fetch(url, opts);
  }
  return r;
}

app.get('/api/twitch/auth-status', (req, res) => {
  res.json({
    authenticated: !!twitchUserAuth.accessToken,
    displayName:   twitchUserAuth.displayName,
    login:         twitchUserAuth.broadcasterLogin,
    avatar:        twitchUserAuth.avatar,
    clientId:      twitchState.clientId ? '••••' : '',
    hasSecret:     !!getConfig().twitchClientSecret,
  });
});

app.delete('/api/twitch/auth', (req, res) => {
  Object.assign(twitchUserAuth, { accessToken: null, refreshToken: null, expiresAt: 0, broadcasterId: null, broadcasterLogin: null, displayName: null });
  saveTwitchUserAuth();
  io.emit('twitch-auth-status', { authenticated: false });
  res.json({ ok: true });
});

app.get('/api/twitch/subscribers', async (req, res) => {
  try {
    const bid = twitchUserAuth.broadcasterId;
    if (!bid) return res.status(401).json({ error: 'Non authentifié' });
    const r = await twitchUserApi('GET', `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${bid}&first=100`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/twitch/predictions', async (req, res) => {
  try {
    const bid = twitchUserAuth.broadcasterId;
    if (!bid) return res.status(401).json({ error: 'Non authentifié' });
    const r = await twitchUserApi('GET', `https://api.twitch.tv/helix/predictions?broadcaster_id=${bid}&first=5`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/twitch/predictions', async (req, res) => {
  try {
    const bid = twitchUserAuth.broadcasterId;
    if (!bid) return res.status(401).json({ error: 'Non authentifié' });
    const { title, outcomes, predictionWindow } = req.body;
    const r = await twitchUserApi('POST', 'https://api.twitch.tv/helix/predictions', {
      broadcaster_id:    bid,
      title,
      outcomes:          outcomes.map(o => ({ title: o })),
      prediction_window: predictionWindow || 120,
    });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/twitch/predictions', async (req, res) => {
  try {
    const bid = twitchUserAuth.broadcasterId;
    if (!bid) return res.status(401).json({ error: 'Non authentifié' });
    const { id, status, winning_outcome_id } = req.body;
    const body = { broadcaster_id: bid, id, status };
    if (winning_outcome_id) body.winning_outcome_id = winning_outcome_id;
    const r = await twitchUserApi('PATCH', 'https://api.twitch.tv/helix/predictions', body);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────

app.get('/twitch-chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'twitch-chat.html')));

// ── Twitch IRC (TCP natif) ────────────────────────────────────────────────────

let _ircSocket = null;
let _ircChannel = '';
let _ircBuffer  = '';

function ircDisconnect() {
  if (_ircSocket) { try { _ircSocket.destroy(); } catch {} _ircSocket = null; }
  _ircChannel = '';
  _ircBuffer  = '';
  twitchChatState.connected = false;
}

function ircConnect(channel) {
  ircDisconnect();
  if (!channel) return;
  const chan = channel.toLowerCase()
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/^#/, '')
    .trim();
  const sock = net.createConnection(6667, 'irc.chat.twitch.tv');
  _ircSocket = sock;

  sock.on('connect', () => {
    const oauthToken = twitchUserAuth.accessToken;
    if (oauthToken && twitchUserAuth.broadcasterLogin) {
      sock.write(`PASS oauth:${oauthToken}\r\n`);
      sock.write(`NICK ${twitchUserAuth.broadcasterLogin}\r\n`);
    } else {
      sock.write(`PASS SCHMOOPIIE\r\n`);
      sock.write(`NICK justinfan${Math.floor(Math.random() * 80000 + 10000)}\r\n`);
    }
    sock.write(`CAP REQ :twitch.tv/tags twitch.tv/commands\r\n`);
    sock.write(`JOIN #${chan}\r\n`);
    _ircChannel = chan;
    twitchChatState.connected = true;
    io.emit('twitchChatUpdate', twitchChatState);
  });

  sock.on('data', chunk => {
    _ircBuffer += chunk.toString('utf8');
    const lines = _ircBuffer.split('\r\n');
    _ircBuffer = lines.pop();
    lines.forEach(ircHandleLine);
  });

  sock.on('error', () => {
    twitchChatState.connected = false;
    io.emit('twitchChatUpdate', twitchChatState);
    if (_ircSocket === sock) _ircSocket = null;
  });

  sock.on('close', () => {
    twitchChatState.connected = false;
    io.emit('twitchChatUpdate', twitchChatState);
    if (_ircSocket === sock) _ircSocket = null;
  });
}

function ircHandleLine(line) {
  if (!line) return;
  if (line.startsWith('PING')) {
    if (_ircSocket) _ircSocket.write('PONG :tmi.twitch.tv\r\n');
    return;
  }

  let rest = line;
  const tags = {};

  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    rest.slice(1, sp).split(';').forEach(p => {
      const eq = p.indexOf('=');
      tags[p.slice(0, eq)] = eq >= 0 ? p.slice(eq + 1) : '';
    });
    rest = rest.slice(sp + 1);
  }

  if (!rest.startsWith(':')) return;
  const parts   = rest.slice(1).split(' ');
  const prefix  = parts[0];
  const command = parts[1];

  if (command === 'PRIVMSG') {
    const chan    = parts[2];
    const trIdx   = rest.indexOf(` :`, rest.indexOf(chan));
    let   message = trIdx >= 0 ? rest.slice(trIdx + 2) : '';
    const isAction = message.startsWith('\x01ACTION ') && message.endsWith('\x01');
    if (isAction) message = message.slice(8, -1);

    const username = prefix.split('!')[0];
    const emotes = {};
    (tags['emotes'] || '').split('/').filter(Boolean).forEach(p => {
      const [id, pos] = p.split(':');
      if (id && pos) emotes[id] = pos.split(',');
    });
    const badges = {};
    (tags['badges'] || '').split(',').filter(Boolean).forEach(b => {
      const [name, ver] = b.split('/');
      if (name) badges[name] = ver || '1';
    });

    io.emit('twitchChatMessage', {
      displayName: tags['display-name'] || username,
      color:       tags['color'] || null,
      badges,
      emotes,
      message,
      isAction,
    });

    const bitsAmount = parseInt(tags['bits'] || '0', 10);
    if (bitsAmount > 0 && twitchAlertsState.bitsEnabled && bitsAmount >= (twitchAlertsState.bitsMinAmount || 1)) {
      io.emit('twitchBitsAlert', {
        username: tags['display-name'] || username,
        amount:   bitsAmount,
        message,
        color:    tags['color'] || null,
      });
    }
  }

  if (command === 'USERNOTICE') {
    const trIdx  = rest.indexOf(' :');
    const notice = trIdx >= 0 ? rest.slice(trIdx + 2) : '';
    const msgId  = tags['msg-id'] || '';
    const login  = tags['login'] || tags['display-name'] || '';
    let text = '';
    if (msgId === 'sub' || msgId === 'resub') {
      const months = tags['msg-param-cumulative-months'] || '';
      text = `⭐ ${login} est abonné${months ? ` depuis ${months} mois` : ''} !${notice ? '  ' + notice : ''}`;
      if (twitchAlertsState.subsEnabled) {
        io.emit('twitchSubAlert', {
          type:     msgId,
          username: login,
          months:   parseInt(months || '0', 10),
          tier:     tags['msg-param-sub-plan'] || '1000',
          message:  notice,
        });
      }
    } else if (msgId === 'subgift') {
      const recipient = tags['msg-param-recipient-display-name'] || tags['msg-param-recipient-user-name'] || '';
      text = `🎁 ${login} offre un abonnement à ${recipient} !`;
      if (twitchAlertsState.subsEnabled) {
        io.emit('twitchSubAlert', {
          type:      'subgift',
          username:  login,
          recipient,
          tier:      tags['msg-param-sub-plan'] || '1000',
        });
      }
    } else if (msgId === 'raid') {
      const viewers = tags['msg-param-viewerCount'] || '';
      text = `🚀 ${login} raid avec ${viewers} viewers !`;
    }
    if (text) io.emit('twitchChatNotice', { text });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/twitch-chat', (req, res) => res.json(twitchChatState));
app.post('/api/twitch-chat', (req, res) => {
  const prev = twitchChatState.channel;
  twitchChatState = { ...twitchChatState, ...req.body };
  if (twitchChatState.channel !== prev || (twitchChatState.visible && !twitchChatState.connected)) {
    if (twitchChatState.channel) ircConnect(twitchChatState.channel);
    else ircDisconnect();
  }
  io.emit('twitchChatUpdate', twitchChatState);
  res.json(twitchChatState);
});

// ─────────────────────────────────────────────────────────────────────────────
// ── YouTube OAuth ─────────────────────────────────────────────────────────────

let youtubeOAuth = {
  accessToken:  null,
  refreshToken: null,
  expiresAt:    0,
  channelId:    null,
  channelName:  null,
  avatar:       null,
};

(function () {
  const cfg  = getConfig();
  const saved = cfg.youtubeOAuth || {};
  youtubeOAuth.accessToken  = saved.accessToken  || null;
  youtubeOAuth.refreshToken = saved.refreshToken || null;
  youtubeOAuth.expiresAt    = saved.expiresAt    || 0;
  youtubeOAuth.channelId    = saved.channelId    || null;
  youtubeOAuth.channelName  = saved.channelName  || null;
  youtubeOAuth.avatar       = saved.avatar       || null;
})();

function saveYoutubeOAuth() {
  const cfg = getConfig();
  cfg.youtubeOAuth = { ...youtubeOAuth };
  saveConfig(cfg);
}

async function ytRefreshAccessToken() {
  const cfg = getConfig();
  const { googleClientId, googleClientSecret } = cfg;
  if (!youtubeOAuth.refreshToken) throw new Error('Pas de refresh token YouTube');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     googleClientId,
      client_secret: googleClientSecret,
      grant_type:    'refresh_token',
      refresh_token: youtubeOAuth.refreshToken,
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('Refresh YouTube échoué : ' + JSON.stringify(d));
  youtubeOAuth.accessToken = d.access_token;
  youtubeOAuth.expiresAt   = Date.now() + (d.expires_in || 3600) * 1000;
  saveYoutubeOAuth();
}

async function ytGetToken() {
  if (!youtubeOAuth.accessToken) throw new Error('Non connecté à YouTube');
  if (Date.now() > youtubeOAuth.expiresAt - 60000) await ytRefreshAccessToken();
  return youtubeOAuth.accessToken;
}

function ytAuthHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// Routes OAuth
app.get('/auth/youtube', (req, res) => {
  const cfg = getConfig();
  const { googleClientId } = cfg;
  if (!googleClientId) return res.status(400).send('Client ID Google non configuré.');
  const redirectUri = encodeURIComponent(`${BASE_URL}/auth/youtube/callback`);
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly');
  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`
  );
});

app.get('/auth/youtube/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send('Erreur OAuth Google : ' + error);
  if (!code)  return res.status(400).send('Code manquant');
  const cfg = getConfig();
  const { googleClientId, googleClientSecret } = cfg;
  if (!googleClientId || !googleClientSecret) return res.status(400).send('Identifiants Google manquants');
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     googleClientId,
        client_secret: googleClientSecret,
        redirect_uri:  `${BASE_URL}/auth/youtube/callback`,
        grant_type:    'authorization_code',
      }),
    });
    const td = await tokenRes.json();
    if (!td.access_token) throw new Error('Token invalide : ' + JSON.stringify(td));

    youtubeOAuth.accessToken  = td.access_token;
    youtubeOAuth.refreshToken = td.refresh_token || youtubeOAuth.refreshToken;
    youtubeOAuth.expiresAt    = Date.now() + (td.expires_in || 3600) * 1000;

    // Récupère la chaîne de l'utilisateur connecté
    const chanRes  = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: ytAuthHeaders(td.access_token) }
    );
    const chanData = await chanRes.json();
    const chan     = chanData.items && chanData.items[0];
    if (chan) {
      youtubeOAuth.channelId   = chan.id;
      youtubeOAuth.channelName = chan.snippet.title;
      youtubeOAuth.avatar      = chan.snippet.thumbnails?.default?.url || null;
      // Auto-configure le channelId
      youtubeChatState.channelId = chan.id;
      cfg.youtubeChannelId       = chan.id;
      saveConfig(cfg);
    }
    saveYoutubeOAuth();
    io.emit('youtube-auth-status', {
      authenticated: true,
      channelName: youtubeOAuth.channelName,
      channelId:   youtubeOAuth.channelId,
      avatar:      youtubeOAuth.avatar,
    });
    res.send('<html><body style="font-family:sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#6bc96c">✅ Connecté avec YouTube !</h2><p style="color:#aaa">Tu peux fermer cette fenêtre.</p><script>if(window.opener)window.opener.postMessage({type:\'youtube-auth-ok\'},\'*\');setTimeout(()=>window.close(),1200)</script></div></body></html>');
  } catch (e) {
    console.error('[youtube oauth]', e.message);
    res.status(500).send('Erreur : ' + e.message);
  }
});

app.get('/api/youtube/auth-status', (req, res) => {
  const cfg = getConfig();
  res.json({
    authenticated: !!youtubeOAuth.accessToken,
    channelName:   youtubeOAuth.channelName,
    channelId:     youtubeOAuth.channelId,
    avatar:        youtubeOAuth.avatar,
    hasClientId:   !!cfg.googleClientId,
    hasSecret:     !!cfg.googleClientSecret,
  });
});

app.post('/api/youtube/auth-credentials', (req, res) => {
  const { clientId, clientSecret } = req.body;
  const cfg = getConfig();
  if (clientId)     cfg.googleClientId     = clientId;
  if (clientSecret) cfg.googleClientSecret = clientSecret;
  saveConfig(cfg);
  res.json({ ok: true });
});

app.delete('/api/youtube/auth', (req, res) => {
  youtubeOAuth = { accessToken: null, refreshToken: null, expiresAt: 0, channelId: null, channelName: null, avatar: null };
  const cfg = getConfig();
  cfg.youtubeOAuth = {};
  saveConfig(cfg);
  io.emit('youtube-auth-status', { authenticated: false });
  res.json({ ok: true });
});

// ── YouTube Chat ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

let youtubeChatState = {
  visible:        false,
  channelId:      '',
  liveChatId:     null,
  connected:      false,
  maxMessages:    15,
  x:              0,
  y:              0,
  width:          360,
  maxHeight:      600,
  transparentMode: false,
};

let combinedChatState = {
  visible:        true,
  x:              0,
  y:              0,
  width:          380,
  maxHeight:      620,
  maxMessages:    20,
  transparentMode: false,
};

(function () {
  const cfg = getConfig();
  youtubeChatState.channelId = cfg.youtubeChannelId || '';
})();

let _ytPollTimer   = null;
let _ytNextToken   = null;
let _ytViewerTimer = null;
let _ytVideoId     = null;

let youtubeAlertsState = {
  duration: 7000,
  position: 'bottom-right',
};

let youtubeViewerState = {
  viewers: 0,
  live: false,
};

function ytApiHeaders() {
  const cfg    = getConfig();
  const apiKey = cfg.youtubeApiKey || '';
  return { _apiKey: apiKey, _oauthToken: youtubeOAuth.accessToken };
}

function ytApiUrl(base, params) {
  const cfg    = getConfig();
  const apiKey = cfg.youtubeApiKey || '';
  const token  = youtubeOAuth.accessToken;
  const url    = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!token) url.searchParams.set('key', apiKey);
  return url.toString();
}

function ytFetchOptions() {
  const token = youtubeOAuth.accessToken;
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

async function ytFindLiveChatId() {
  const cfg       = getConfig();
  const apiKey    = cfg.youtubeApiKey || '';
  const oauthToken = youtubeOAuth.accessToken;
  const channelId = youtubeChatState.channelId || youtubeOAuth.channelId;
  if (!channelId) throw new Error('Channel ID requis');
  if (!oauthToken && !apiKey) throw new Error('Connexion YouTube requise (OAuth ou clé API)');

  // Si OAuth : cherche le live sur la propre chaîne de l'utilisateur
  if (oauthToken) {
    // Refresh si nécessaire
    if (Date.now() > youtubeOAuth.expiresAt - 60000) await ytRefreshAccessToken();
  }

  const searchRes  = await fetch(
    ytApiUrl('https://www.googleapis.com/youtube/v3/search', {
      part: 'snippet', channelId, eventType: 'live', type: 'video',
    }),
    ytFetchOptions()
  );
  const searchData = await searchRes.json();
  if (searchData.error) throw new Error(searchData.error.message);
  const items = searchData.items || [];
  if (!items.length) throw new Error('Aucun live en cours sur cette chaîne');

  const videoId  = items[0].id.videoId;
  const videoRes = await fetch(
    ytApiUrl('https://www.googleapis.com/youtube/v3/videos', {
      part: 'liveStreamingDetails', id: videoId,
    }),
    ytFetchOptions()
  );
  const videoData = await videoRes.json();
  if (videoData.error) throw new Error(videoData.error.message);
  const liveChatId = (videoData.items || [])[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!liveChatId) throw new Error('Impossible d\'obtenir le liveChatId');
  return { liveChatId, videoId };
}

async function ytPollViewers() {
  const cfg    = getConfig();
  const apiKey = cfg.youtubeApiKey || '';
  if (!_ytVideoId) return;
  if (!apiKey && !youtubeOAuth.accessToken) return;
  try {
    const res  = await fetch(
      ytApiUrl('https://www.googleapis.com/youtube/v3/videos', { part: 'liveStreamingDetails', id: _ytVideoId }),
      ytFetchOptions()
    );
    const data = await res.json();
    const viewers = parseInt(data.items?.[0]?.liveStreamingDetails?.concurrentViewers || '0', 10);
    youtubeViewerState = { viewers, live: true };
    io.emit('youtube-viewers', youtubeViewerState);
  } catch(e) {
    console.error('[YouTube viewers]', e.message);
  }
  _ytViewerTimer = setTimeout(ytPollViewers, 30000);
}

async function ytPollMessages() {
  const cfg    = getConfig();
  const apiKey = cfg.youtubeApiKey || '';
  const { liveChatId } = youtubeChatState;
  if (!liveChatId) return;
  if (!apiKey && !youtubeOAuth.accessToken) return;

  try {
    const params = { liveChatId, part: 'snippet,authorDetails', maxResults: '200' };
    if (_ytNextToken) params.pageToken = _ytNextToken;
    const url = ytApiUrl('https://www.googleapis.com/youtube/v3/liveChat/messages', params);

    const res  = await fetch(url, ytFetchOptions());
    const data = await res.json();

    if (data.error) {
      console.error('[YouTube] Erreur polling:', data.error.message);
      youtubeChatState.connected = false;
      io.emit('youtubeChatUpdate', youtubeChatState);
      return;
    }

    _ytNextToken = data.nextPageToken || null;

    for (const item of (data.items || [])) {
      const { snippet, authorDetails } = item;
      if (!snippet || !authorDetails) continue;

      if (snippet.type === 'textMessageEvent') {
        io.emit('youtubeChatMessage', {
          displayName:  authorDetails.displayName,
          profileImage: authorDetails.profileImageUrl,
          isOwner:      !!authorDetails.isChatOwner,
          isModerator:  !!authorDetails.isChatModerator,
          isMember:     !!authorDetails.isChatSponsor,
          message:      snippet.textMessageDetails?.messageText || '',
        });
      } else if (snippet.type === 'superChatEvent') {
        const scAmount = snippet.superChatDetails?.amountDisplayString || '';
        const scTier   = snippet.superChatDetails?.tier || 1;
        const scMsg    = snippet.superChatDetails?.userComment || '';
        io.emit('youtubeChatMessage', {
          displayName:  authorDetails.displayName,
          profileImage: authorDetails.profileImageUrl,
          isOwner:      !!authorDetails.isChatOwner,
          isModerator:  !!authorDetails.isChatModerator,
          isMember:     !!authorDetails.isChatSponsor,
          message:      scMsg,
          superChat: { amount: scAmount, tier: scTier },
        });
        io.emit('youtubeAlertSuperChat', {
          displayName: authorDetails.displayName,
          profileImage: authorDetails.profileImageUrl,
          amount:  scAmount,
          tier:    scTier,
          message: scMsg,
        });
      } else if (snippet.type === 'superStickerEvent') {
        io.emit('youtubeAlertSuperSticker', {
          displayName: authorDetails.displayName,
          profileImage: authorDetails.profileImageUrl,
          amount: snippet.superStickerDetails?.amountDisplayString || '',
          tier:   snippet.superStickerDetails?.tier || 1,
        });
      } else if (snippet.type === 'memberMilestoneChatEvent') {
        const months = snippet.memberMilestoneChatDetails?.memberMonth || '';
        io.emit('youtubeChatNotice', {
          text: `🏅 ${authorDetails.displayName} — ${months} mois de membership !`,
        });
        io.emit('youtubeAlertMilestone', {
          displayName: authorDetails.displayName,
          profileImage: authorDetails.profileImageUrl,
          months,
          message: snippet.memberMilestoneChatDetails?.userComment || '',
        });
      } else if (snippet.type === 'newSponsorEvent') {
        io.emit('youtubeChatNotice', {
          text: `⭐ ${authorDetails.displayName} vient de rejoindre les membres !`,
        });
        io.emit('youtubeAlertMember', {
          displayName: authorDetails.displayName,
          profileImage: authorDetails.profileImageUrl,
          message: '',
        });
      }
    }

    const pollMs = Math.max(data.pollingIntervalMillis || 5000, 3000);
    _ytPollTimer = setTimeout(ytPollMessages, pollMs);
  } catch (e) {
    console.error('[YouTube] Erreur poll:', e.message);
    _ytPollTimer = setTimeout(ytPollMessages, 10000);
  }
}

async function ytConnect() {
  ytDisconnect();
  try {
    const { liveChatId, videoId } = await ytFindLiveChatId();
    youtubeChatState.liveChatId = liveChatId;
    youtubeChatState.connected  = true;
    _ytNextToken = null;
    _ytVideoId   = videoId;
    io.emit('youtubeChatUpdate', youtubeChatState);
    ytPollMessages();
    ytPollViewers();
  } catch (e) {
    console.error('[YouTube] Connexion échouée:', e.message);
    youtubeChatState.connected  = false;
    youtubeChatState.liveChatId = null;
    io.emit('youtubeChatUpdate', { ...youtubeChatState, error: e.message });
  }
}

function ytDisconnect() {
  if (_ytPollTimer)   { clearTimeout(_ytPollTimer);   _ytPollTimer   = null; }
  if (_ytViewerTimer) { clearTimeout(_ytViewerTimer); _ytViewerTimer = null; }
  youtubeChatState.connected  = false;
  youtubeChatState.liveChatId = null;
  _ytNextToken = null;
  _ytVideoId   = null;
  youtubeViewerState = { viewers: 0, live: false };
  io.emit('youtube-viewers', youtubeViewerState);
}

app.get('/api/youtube-chat', (req, res) => {
  const cfg = getConfig();
  res.json({ ...youtubeChatState, hasApiKey: !!cfg.youtubeApiKey });
});

app.post('/api/youtube-chat', (req, res) => {
  const prevChannel = youtubeChatState.channelId;
  const prevVisible = youtubeChatState.visible;

  const { apiKey, channelId, ...rest } = req.body;

  const cfg = getConfig();
  if (apiKey && apiKey !== '••••') {
    cfg.youtubeApiKey = apiKey;
    saveConfig(cfg);
  }
  if (channelId !== undefined) {
    youtubeChatState.channelId = channelId;
    cfg.youtubeChannelId = channelId;
    saveConfig(cfg);
  }
  youtubeChatState = { ...youtubeChatState, ...rest };

  const shouldConnect = youtubeChatState.visible &&
    (youtubeChatState.channelId !== prevChannel || !prevVisible || !youtubeChatState.connected);
  const hasCredentials = youtubeChatState.channelId && cfg.youtubeApiKey;

  if (youtubeChatState.visible && hasCredentials && shouldConnect) {
    ytConnect();
  } else if (!youtubeChatState.visible) {
    ytDisconnect();
    io.emit('youtubeChatUpdate', youtubeChatState);
  } else {
    io.emit('youtubeChatUpdate', youtubeChatState);
  }

  res.json({ ...youtubeChatState, hasApiKey: !!cfg.youtubeApiKey });
});

// ── Twitch Alerts ─────────────────────────────────────────────────────────────

app.get('/api/twitch-alerts', (req, res) => res.json(twitchAlertsState));

app.post('/api/twitch-alerts', (req, res) => {
  twitchAlertsState = { ...twitchAlertsState, ...req.body };
  const cfg = getConfig();
  cfg.twitchAlerts = twitchAlertsState;
  saveConfig(cfg);
  io.emit('twitchAlertsUpdate', twitchAlertsState);
  res.json(twitchAlertsState);
});

app.post('/api/twitch-alerts/test-sub', (req, res) => {
  io.emit('twitchSubAlert', {
    type: 'sub',
    username: 'TestUser',
    months: 3,
    tier: '1000',
    message: 'PogChamp content d\'être là !',
  });
  res.json({ ok: true });
});

app.post('/api/twitch-alerts/test-bits', (req, res) => {
  io.emit('twitchBitsAlert', {
    username: 'TestUser',
    amount: 200,
    message: 'Cheer200 Super stream !',
    color: '#9147ff',
  });
  res.json({ ok: true });
});

// ── Combined Chat API ─────────────────────────────────────────────────────────

app.get('/api/combined-chat', (req, res) => res.json(combinedChatState));

app.post('/api/combined-chat', (req, res) => {
  combinedChatState = { ...combinedChatState, ...req.body };
  io.emit('combinedChatUpdate', combinedChatState);
  res.json(combinedChatState);
});

// ── YouTube Alerts API ────────────────────────────────────────────────────────

app.get('/api/youtube-alerts', (req, res) => res.json(youtubeAlertsState));

app.post('/api/youtube-alerts', (req, res) => {
  youtubeAlertsState = { ...youtubeAlertsState, ...req.body };
  io.emit('youtubeAlertsUpdate', youtubeAlertsState);
  res.json(youtubeAlertsState);
});

app.post('/api/youtube-alerts/test-superchat', (req, res) => {
  io.emit('youtubeAlertSuperChat', {
    displayName: 'TestUser',
    amount: '50,00 €',
    tier: 5,
    message: 'Super stream ! Continuez comme ça !',
  });
  res.json({ ok: true });
});

app.post('/api/youtube-alerts/test-member', (req, res) => {
  io.emit('youtubeAlertMember', {
    displayName: 'TestUser',
    message: '',
  });
  res.json({ ok: true });
});

app.post('/api/youtube-alerts/test-milestone', (req, res) => {
  io.emit('youtubeAlertMilestone', {
    displayName: 'TestUser',
    months: 6,
    message: 'Déjà 6 mois !',
  });
  res.json({ ok: true });
});

app.get('/api/casters', (req, res) => res.json(castersState));

app.get('/api/player-stats', (req, res) => res.json(playerStatsState));
app.post('/api/player-stats', (req, res) => {
  playerStatsState = { ...playerStatsState, ...req.body };
  io.emit('playerStatsUpdate', playerStatsState);
  res.json(playerStatsState);
});

app.get('/api/state', (req, res) => res.json(matchState));
app.post('/api/state', (req, res) => {
  matchState = { ...matchState, ...req.body };
  io.emit('stateUpdate', matchState);
  res.json(matchState);
});

// ── Télécommande native (app 3DS homebrew) : API JSON simple, NON verrouillée UA. ──
// (Les routes /remote* sont réservées au navigateur 3DS ; une app native a un autre
//  User-Agent, donc elle passe par cette API dédiée.) Met à jour matchState + émet 'stateUpdate'.
function _remotePlayerKey(p) {
  return (p === 2 || p === '2' || p === 'p2' || p === 'player2') ? 'player2' : 'player1';
}
app.post('/api/remote/score', (req, res) => {
  const key = _remotePlayerKey(req.body && req.body.player);
  const cur = parseInt(matchState[key].score, 10) || 0;
  const delta = parseInt(req.body && req.body.delta, 10) || 0;
  matchState[key].score = Math.max(0, cur + delta);
  io.emit('stateUpdate', matchState);
  res.json({ ok: true, player1: matchState.player1.score, player2: matchState.player2.score });
});
app.post('/api/remote/reset', (req, res) => {
  matchState.player1.score = 0;
  matchState.player2.score = 0;
  io.emit('stateUpdate', matchState);
  res.json({ ok: true, player1: 0, player2: 0 });
});
// Lecture « à plat » destinée à l'app 3DS (parsing trivial côté homebrew, pas d'objet imbriqué).
app.get('/api/remote/state', (req, res) => {
  const p1 = matchState.player1 || {}, p2 = matchState.player2 || {};
  res.json({
    p1tag: p1.tag || '', p1name: p1.name || '', p1score: p1.score || 0,
    p2tag: p2.tag || '', p2name: p2.name || '', p2score: p2.score || 0,
  });
});

// ── Victory test ───────────────────────────────────────────────
app.post('/api/victory/test', (req, res) => {
  io.emit('victoryTest', matchState);
  res.json({ ok: true });
});
app.post('/api/victory/hide', (req, res) => {
  io.emit('victoryHide');
  res.json({ ok: true });
});

// ── Logo upload ────────────────────────────────────────────────
const LOGOS_DIR = path.join(__dirname, 'public', 'logos');
if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

app.post('/api/logo/upload', (req, res) => {
  const { filename, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'filename and data required' });
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const b64  = data.includes(',') ? data.split(',')[1] : data;
  fs.writeFileSync(path.join(LOGOS_DIR, safe), Buffer.from(b64, 'base64'));
  res.json({ url: '/logos/' + safe });
});

app.delete('/api/logo/upload', (req, res) => {
  const { filename } = req.body || {};
  if (filename) {
    const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    try { fs.unlinkSync(path.join(LOGOS_DIR, safe)); } catch (e) {}
  }
  res.json({ ok: true });
});

// ── Texture upload ─────────────────────────────────────────────
const TEXTURES_DIR = path.join(__dirname, 'public', 'textures');
if (!fs.existsSync(TEXTURES_DIR)) fs.mkdirSync(TEXTURES_DIR, { recursive: true });

app.post('/api/texture/upload', (req, res) => {
  const { filename, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'filename and data required' });
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const b64  = data.includes(',') ? data.split(',')[1] : data;
  fs.writeFileSync(path.join(TEXTURES_DIR, safe), Buffer.from(b64, 'base64'));
  res.json({ url: '/textures/' + safe });
});

app.delete('/api/texture/upload', (req, res) => {
  const { filename } = req.body || {};
  if (filename) {
    const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    try { fs.unlinkSync(path.join(TEXTURES_DIR, safe)); } catch (e) {}
  }
  res.json({ ok: true });
});

app.get('/api/veto', (req, res) => res.json(vetoState));
app.post('/api/veto', (req, res) => {
  vetoState = { ...vetoState, ...req.body };
  io.emit('vetoUpdate', vetoState);
  res.json(vetoState);
});
app.post('/api/veto/reset', (req, res) => {
  vetoState = makeVetoState();
  io.emit('vetoUpdate', vetoState);
  res.json(vetoState);
});

app.get('/api/characters', (req, res) => res.json(characterList));
app.post('/api/characters', (req, res) => {
  characterList = req.body;
  io.emit('characterUpdate', characterList);
  res.json(characterList);
});

app.get('/api/ruleset', (req, res) => res.json(rulesetState));
app.post('/api/ruleset', (req, res) => {
  rulesetState = { ...rulesetState, ...req.body };
  vetoState = makeVetoState();
  io.emit('rulesetUpdate', rulesetState);
  io.emit('vetoUpdate', vetoState);
  res.json(rulesetState);
});

app.get('/api/rulesets/saved', (req, res) => res.json(loadRulesets()));

app.post('/api/rulesets/saved', (req, res) => {
  const { name, ruleset } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const list = loadRulesets().filter(r => r.name !== name);
  list.push({ name, ruleset });
  saveRulesets(list);
  res.json(list);
});

app.delete('/api/rulesets/saved/:name', (req, res) => {
  const list = loadRulesets().filter(r => r.name !== decodeURIComponent(req.params.name));
  saveRulesets(list);
  res.json(list);
});


// ─── Socket.io ────────────────────────────────────────────────────────────────

// S1 : middleware Socket.IO. Politique :
//  - Pas d'auth configurée → tout le monde passe (parité avec requireAuth HTTP).
//  - Auth configurée → on lit le cookie pso-session OU socket.handshake.auth.token,
//    on stocke socket.data.auth = payload | null. La connexion est TOUJOURS
//    acceptée (overlays publics doivent recevoir les broadcasts en lecture seule).
//  - Les 9 events de mutation sont gatés individuellement plus bas via requireSocketAuth.
io.use((socket, next) => {
  if (!auth.isAuthEnabled()) { socket.data.auth = { anonymous: true }; return next(); }
  const cookies    = parseCookies({ headers: socket.handshake.headers });
  const fromCookie = verifyToken(cookies['pso-session']);
  const fromAuth   = verifyToken(socket.handshake.auth && socket.handshake.auth.token);
  const payload    = (fromCookie && fromCookie.auth) ? fromCookie
                   : (fromAuth   && fromAuth.auth)   ? fromAuth
                   : null;
  socket.data.auth = payload; // null = overlay public (lecture seule)
  next();
});

io.on('connection', (socket) => {
  // Helper : ignore silencieusement un event si le socket n'est pas authentifié.
  // Silence volontaire pour ne pas leaker la liste des events à un attaquant.
  const requireSocketAuth = (handler) => (...args) => {
    if (!auth.isAuthEnabled() || socket.data.auth) return handler(...args);
  };
  socket.emit('stateUpdate', matchState);
  socket.emit('vetoUpdate', vetoState);
  socket.emit('rulesetUpdate', rulesetState);
  socket.emit('characterUpdate', characterList);
  socket.emit('castersUpdate', castersState);
  socket.emit('playerStatsUpdate', playerStatsState);
  socket.emit('tournamentHistoryUpdate', tournamentHistoryState);
  socket.emit('twitch-viewers', { viewers: twitchState.viewers, live: twitchState.live, channel: twitchState.channel });
  socket.emit('tickerUpdate', tickerState);
  socket.emit('camUpdate', camState);
  socket.emit('framesUpdate', framesState);
  socket.emit('titleUpdate', titleState);
  socket.emit('top8Update', top8State);

  // Déclenche l'animation d'entrée sur la VS screen
  socket.on('triggerVsScreen', requireSocketAuth(() => {
    io.emit('vsScreenTrigger');
  }));

  socket.on('hideVsScreen', requireSocketAuth(() => {
    io.emit('vsScreenHide');
  }));

  socket.on('updateState', requireSocketAuth((data) => {
    matchState = { ...matchState, ...data };
    io.emit('stateUpdate', matchState);
  }));

  socket.on('updateVeto', requireSocketAuth((data) => {
    vetoState = { ...vetoState, ...data };
    io.emit('vetoUpdate', vetoState);
  }));

  socket.on('updateRuleset', requireSocketAuth((data) => {
    rulesetState = { ...rulesetState, ...data };
    vetoState = makeVetoState();
    io.emit('rulesetUpdate', rulesetState);
    io.emit('vetoUpdate', vetoState);
  }));

  socket.on('updateCharacters', requireSocketAuth((data) => {
    characterList = data;
    io.emit('characterUpdate', characterList);
  }));

  socket.on('updateCasters', requireSocketAuth((data) => {
    castersState = { ...castersState, ...data };
    io.emit('castersUpdate', castersState);
  }));

  socket.on('vetoAction', requireSocketAuth(({ stageId }) => {
    const step = vetoState.sequence[vetoState.currentStep];
    if (!step || step.action === 'decider') return;
    const stage = vetoState.stages.find(s => s.id === stageId);
    if (!stage || stage.status !== 'available') return;

    stage.status = step.player === 1 ? 'banned_p1' : 'banned_p2';
    step.mapId = stageId;
    vetoState.currentStep++;

    const next = vetoState.sequence[vetoState.currentStep];
    if (next && next.action === 'decider') {
      const remaining = vetoState.stages.find(s => s.status === 'available');
      if (remaining) {
        remaining.status = 'selected';
        next.mapId = remaining.id;
        vetoState.currentStep++;
        vetoState.done = true;
        matchState.currentStage = remaining.name;
        io.emit('stateUpdate', matchState);
      }
    }

    io.emit('vetoUpdate', vetoState);
  }));

  socket.on('vetoNextGame', requireSocketAuth(() => {
    const selected = vetoState.stages.find(s => s.status === 'selected');
    const newPlayed = [...(vetoState.playedStageIds || [])];
    if (selected) newPlayed.push(selected.id);
    vetoState = makeVetoState(vetoState.gameNumber + 1, newPlayed, vetoState.visible);
    io.emit('vetoUpdate', vetoState);
  }));
});

// ─── start.gg API ─────────────────────────────────────────────────────────────

const CONFIG_FILE = path.join(__dirname, 'config.json');

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

async function startggQuery(query, variables = {}) {
  const apiKey = getConfig().startggApiKey;
  if (!apiKey) throw new Error('Clé API start.gg non configurée');
  const res = await fetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  // Limite de requêtes start.gg (80/min) — marqueur reconnaissable côté client
  if (res.status === 429) {
    const ra = parseInt(res.headers.get('retry-after'), 10);
    throw new Error('RATE_LIMIT' + (Number.isFinite(ra) && ra > 0 ? ':' + ra : ''));
  }
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch(e) {
    console.error('[startgg] réponse non-JSON (status', res.status, '):', raw.slice(0, 500));
    throw new Error('Réponse invalide de start.gg (status ' + res.status + ')');
  }
  if (data.errors) {
    console.error('[startgg] Erreurs GraphQL :');
    data.errors.forEach((e, i) => console.error(`  [${i}]`, JSON.stringify(e)));
    throw new Error(data.errors[0].message);
  }
  // start.gg renvoie aussi une enveloppe d'erreur NON-GraphQL (statut 4xx) du type
  // { success:false, message:"Invalid authentication token", ... }. Sans ce contrôle,
  // l'erreur passait inaperçue et la route affichait « Tournoi introuvable » (trompeur).
  if (data && data.success === false) {
    const msg = data.message || '';
    console.error('[startgg] erreur API (status', res.status + '):', msg);
    if (/authentication token/i.test(msg))
      throw new Error('Clé API start.gg invalide ou expirée');
    throw new Error(msg || ('Erreur start.gg (status ' + res.status + ')'));
  }
  return data.data ?? {};
}

app.get('/api/startgg/config', (req, res) => {
  const cfg = getConfig();
  res.json({ hasKey: !!cfg.startggApiKey });
});

app.post('/api/startgg/config', (req, res) => {
  const cfg = getConfig();
  if (req.body.apiKey !== undefined) cfg.startggApiKey = req.body.apiKey;
  saveConfig(cfg);
  res.json({ ok: true });
});

app.get('/api/startgg/tournament/:slug', async (req, res) => {
  try {
    const data = await startggQuery(`
      query TournamentQuery($slug: String!) {
        tournament(slug: $slug) {
          id name slug
          images { url type ratio }
          events { id name numEntrants }
        }
      }
    `, { slug: req.params.slug });
    if (!data.tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    res.json(data.tournament);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/startgg/event/:id/entrants', async (req, res) => {
  try {
    const data = await startggQuery(`
      query EventEntrants($eventId: ID!, $page: Int!) {
        event(id: $eventId) {
          id name
          entrants(query: { page: $page, perPage: 100 }) {
            pageInfo { total totalPages }
            nodes {
              id name initialSeedNum
              participants { gamerTag prefix player { id user { slug } } }
            }
          }
        }
      }
    `, { eventId: parseInt(req.params.id), page: parseInt(req.query.page || 1) });
    if (!data.event) return res.status(404).json({ error: 'Évènement introuvable' });
    res.json(data.event);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/startgg/event/:id/sets', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    // Requête 1 : sets actifs/en attente — données complètes, limite basse pour rester sous 1000 objets
    const dataActive = await startggQuery(`
      query EventSetsActive($eventId: ID!) {
        event(id: $eventId) {
          id name
          sets(filters: { state: [1, 2, 6] }, perPage: 40, sortType: ROUND) {
            nodes {
              id fullRoundText round state
              phaseGroup { displayIdentifier phase { name phaseOrder } }
              slots {
                entrant { id name initialSeedNum participants { gamerTag prefix player { id } user { genderPronoun } } }
                standing { stats { score { value } } }
              }
            }
          }
        }
      }
    `, { eventId });
    if (!dataActive.event) return res.status(404).json({ error: 'Évènement introuvable' });

    // Requête 2 : sets terminés — données minimales pour la jauge de progression
    const dataDone = await startggQuery(`
      query EventSetsDone($eventId: ID!) {
        event(id: $eventId) {
          sets(filters: { state: [3] }, perPage: 100, sortType: ROUND) {
            nodes {
              id fullRoundText round state
              phaseGroup { phase { name phaseOrder } }
            }
          }
        }
      }
    `, { eventId });

    const activeNodes = dataActive.event.sets?.nodes || [];
    const doneNodes   = dataDone?.event?.sets?.nodes || [];
    const allNodes    = [...activeNodes, ...doneNodes];

    res.json({ ...dataActive.event, sets: { nodes: allNodes } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/startgg/tournament/:slug/stream-queue', async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug);
    const data = await startggQuery(`
      query StreamQueue($slug: String!) {
        tournament(slug: $slug) {
          streamQueue {
            stream { streamName streamSource }
            sets {
              id fullRoundText round state
              phaseGroup { displayIdentifier phase { name phaseOrder } }
              slots {
                entrant { id name initialSeedNum participants { gamerTag prefix player { id } user { genderPronoun } } }
                standing { stats { score { value } } }
              }
            }
          }
        }
      }
    `, { slug });
    res.json(data?.tournament?.streamQueue || []);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Détail d'un set unique (score à jour, quel que soit son état) — utilisé pour la synchro scoreboard
app.get('/api/startgg/set/:id', async (req, res) => {
  try {
    const data = await startggQuery(`
      query SingleSet($setId: ID!) {
        set(id: $setId) {
          id fullRoundText round state
          slots {
            entrant { id name participants { gamerTag prefix } }
            standing { stats { score { value } } }
          }
        }
      }
    `, { setId: req.params.id });
    if (!data.set) return res.status(404).json({ error: 'Set introuvable' });
    res.json(data.set);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/startgg/set/:id/start', async (req, res) => {
  try {
    const data = await startggQuery(`
      mutation MarkSetInProgress($setId: ID!) {
        markSetInProgress(setId: $setId) {
          id
          state
        }
      }
    `, { setId: req.params.id });
    if (!data.markSetInProgress) return res.status(400).json({ error: 'Impossible de démarrer le set' });
    res.json(data.markSetInProgress);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/startgg/player-socials/:playerId', async (req, res) => {
  try {
    const data = await startggQuery(`
      query PlayerSocials($playerId: ID!) {
        player(id: $playerId) {
          user {
            authorizations(types: [TWITTER, TWITCH, DISCORD]) {
              type
              externalUsername
            }
          }
        }
      }
    `, { playerId: parseInt(req.params.playerId) });
    const auths = data?.player?.user?.authorizations || [];
    const socials = {};
    auths.forEach(a => { socials[a.type.toLowerCase()] = a.externalUsername || ''; });
    res.json(socials);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Recherche d'un joueur par son profil start.gg (slug) → pseudo + réseaux
app.get('/api/startgg/user/:slug', async (req, res) => {
  try {
    const data = await startggQuery(`
      query UserLookup($slug: String!) {
        user(slug: $slug) {
          player { gamerTag }
          authorizations(types: [TWITTER, TWITCH, DISCORD]) {
            type
            externalUsername
          }
        }
      }
    `, { slug: req.params.slug });
    const u = data?.user;
    if (!u) return res.json({ error: 'Joueur introuvable' });
    const socials = {};
    (u.authorizations || []).forEach(a => { socials[a.type.toLowerCase()] = a.externalUsername || ''; });
    res.json({
      name:    u.player?.gamerTag || '',
      twitter: socials.twitter || '',
      twitch:  socials.twitch  || '',
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Mapping start.gg ↔ Leitmotiv (SSBU characters) ──
// On matche par NOM canonique start.gg (stable) plutôt que par sgg id (renuméroté par start.gg, instable).
const SGG_NAME_ALIASES = {
  'Pokemon Trainer': 'pokemon_trainer',
  'Simon Belmont':   'simon',
  'Banjo-Kazooie':   'banjo_kazooie',
  'Pyra & Mythra':   'pyra_mythra',
  'Rosalina':        'rosalina',
  'Random Character': null,
};
function sggNameToInternalId(name) {
  if (!name) return null;
  if (Object.prototype.hasOwnProperty.call(SGG_NAME_ALIASES, name)) return SGG_NAME_ALIASES[name];
  const norm = name.toLowerCase();
  const c = characterList.find(c => c.name.toLowerCase() === norm);
  return c ? c.id : null;
}

// Snapshot canonique des character IDs start.gg pour SSBU (videogame 1386), capturé le 2026-06-15
// via : query { videogame(id: 1386) { characters { id name } } }
// Les noms ici sont ceux retournés par start.gg ; le mapping vers nos internalIds passe par sggNameToInternalId.
const SGG_ID_TO_NAME = {
  1271:'Bayonetta',        1272:'Bowser Jr.',       1273:'Bowser',           1274:'Captain Falcon',
  1275:'Cloud',            1276:'Corrin',           1277:'Daisy',            1278:'Dark Pit',
  1279:'Diddy Kong',       1280:'Donkey Kong',      1282:'Dr. Mario',        1283:'Duck Hunt',
  1285:'Falco',            1286:'Fox',              1287:'Ganondorf',        1289:'Greninja',
  1290:'Ice Climbers',     1291:'Ike',              1292:'Inkling',          1293:'Jigglypuff',
  1294:'King Dedede',      1295:'Kirby',            1296:'Link',             1297:'Little Mac',
  1298:'Lucario',          1299:'Lucas',            1300:'Lucina',           1301:'Luigi',
  1302:'Mario',            1304:'Marth',            1305:'Mega Man',         1307:'Meta Knight',
  1310:'Mewtwo',           1311:'Mii Brawler',      1313:'Ness',             1314:'Olimar',
  1315:'Pac-Man',          1316:'Palutena',         1317:'Peach',            1318:'Pichu',
  1319:'Pikachu',          1320:'Pit',              1321:'Pokemon Trainer',  1322:'Ridley',
  1323:'R.O.B.',           1324:'Robin',            1325:'Rosalina',         1326:'Roy',
  1327:'Ryu',              1328:'Samus',            1329:'Sheik',            1330:'Shulk',
  1331:'Snake',            1332:'Sonic',            1333:'Toon Link',        1334:'Villager',
  1335:'Wario',            1336:'Wii Fit Trainer',  1337:'Wolf',             1338:'Yoshi',
  1339:'Young Link',       1340:'Zelda',            1341:'Zero Suit Samus',  1405:'Mr. Game & Watch',
  1406:'Incineroar',       1407:'King K. Rool',     1408:'Dark Samus',       1409:'Chrom',
  1410:'Ken',              1411:'Simon Belmont',    1412:'Richter',          1413:'Isabelle',
  1414:'Mii Swordfighter', 1415:'Mii Gunner',       1441:'Piranha Plant',    1453:'Joker',
  1526:'Hero',             1530:'Banjo-Kazooie',    1532:'Terry',            1539:'Byleth',
  1746:'Random Character', 1747:'Min Min',          1766:'Steve',            1777:'Sephiroth',
  1795:'Pyra & Mythra',    1846:'Kazuya',           1897:'Sora',
};
function sggCharIdToInternalId(id) {
  const sggName = SGG_ID_TO_NAME[id];
  if (!sggName) return null;
  return sggNameToInternalId(sggName);
}

// Maps dérivées du snapshot — SSBU_CHAR_MAP pour les lookups bruts conservés, INTERNAL_TO_STARTGG_CHAR
// pour POST /api/startgg/set/:id/report qui doit renvoyer l'id sgg attendu.
const SSBU_CHAR_MAP = Object.fromEntries(
  Object.entries(SGG_ID_TO_NAME)
    .map(([id, name]) => [id, sggNameToInternalId(name)])
    .filter(([, internalId]) => internalId)
);
const INTERNAL_TO_STARTGG_CHAR = Object.fromEntries(
  Object.entries(SSBU_CHAR_MAP).map(([id, internalId]) => [internalId, parseInt(id)])
);

// ── Détection du main character d'un user start.gg sur ses N derniers events SSBU ──
const SSBU_VIDEOGAME_ID = 1386;
const MAIN_CHAR_CACHE_TTL_MS = 60 * 60 * 1000;
const mainCharCache = new Map();

function _mainCharCacheGet(playerId) {
  const hit = mainCharCache.get(playerId);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > MAIN_CHAR_CACHE_TTL_MS) {
    mainCharCache.delete(playerId);
    return null;
  }
  return hit.value;
}
function _mainCharCacheSet(playerId, value) {
  mainCharCache.set(playerId, { value, cachedAt: Date.now() });
}

app.get('/api/startgg/user/:playerId/main', async (req, res) => {
  const playerId = parseInt(req.params.playerId, 10);
  const limit    = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 5);
  if (!Number.isFinite(playerId) || playerId <= 0) {
    return res.status(400).json({ error: 'playerId invalide' });
  }

  const cached = _mainCharCacheGet(playerId);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const dataA = await startggQuery(`
      query UserRecentSsbuEvents($playerId: ID!, $perPage: Int!) {
        player(id: $playerId) {
          id
          gamerTag
          user {
            events(query: { perPage: $perPage, page: 1, sortBy: "endAt desc", filter: { videogameId: [${SSBU_VIDEOGAME_ID}] } }) {
              nodes { id name tournament { id name endAt } }
            }
          }
        }
      }
    `, { playerId, perPage: limit });

    if (!dataA?.player?.user) {
      const value = { character: null, reason: 'no_user', sampledEvents: 0 };
      _mainCharCacheSet(playerId, value);
      return res.json({ ...value, fromCache: false });
    }
    const events = dataA.player.user.events?.nodes || [];
    if (!events.length) {
      const value = { character: null, reason: 'no_ssbu_events', sampledEvents: 0 };
      _mainCharCacheSet(playerId, value);
      return res.json({ ...value, fromCache: false });
    }
    const eventIds = events.map(e => String(e.id));

    const dataB = await startggQuery(`
      query PlayerSetsWithSelections($playerId: ID!, $eventIds: [ID]!, $perPage: Int!) {
        player(id: $playerId) {
          sets(perPage: $perPage, page: 1, filters: { eventIds: $eventIds, hideEmpty: true }) {
            nodes {
              id completedAt
              event { id videogame { id } }
              games {
                id orderNum
                selections {
                  orderNum selectionType selectionValue
                  entrant { participants { player { id } } }
                  character { id name }
                }
              }
            }
          }
        }
      }
    `, { playerId, eventIds, perPage: 30 });

    const sets = dataB?.player?.sets?.nodes || [];
    // Compter par NOM start.gg (stable), pas par ID (renuméroté). On résout en internal id à la fin.
    const counts = new Map();
    let sampledGames = 0;
    let totalSelections = 0;

    for (const s of sets) {
      if (s?.event?.videogame?.id && parseInt(s.event.videogame.id) !== SSBU_VIDEOGAME_ID) continue;
      const completedAt = s.completedAt || 0;
      for (const g of (s.games || [])) {
        sampledGames++;
        for (const sel of (g.selections || [])) {
          if (sel.selectionType && sel.selectionType !== 'CHARACTER') continue;
          const ourSel = (sel.entrant?.participants || []).some(p => parseInt(p?.player?.id) === playerId);
          if (!ourSel) continue;
          totalSelections++;
          const sggName = sel.character?.name || null;
          if (!sggName) continue;
          const cur = counts.get(sggName) || { count: 0, lastSeen: 0 };
          cur.count++;
          if (completedAt > cur.lastSeen) cur.lastSeen = completedAt;
          counts.set(sggName, cur);
        }
      }
    }

    if (!counts.size) {
      const value = { character: null, reason: 'no_selections', sampledEvents: events.length, sampledGames, totalSelections: 0 };
      _mainCharCacheSet(playerId, value);
      return res.json({ ...value, fromCache: false });
    }

    let topName = null, topMeta = { count: -1, lastSeen: -1 };
    for (const [name, meta] of counts.entries()) {
      if (meta.count > topMeta.count || (meta.count === topMeta.count && meta.lastSeen > topMeta.lastSeen)) {
        topName = name; topMeta = meta;
      }
    }

    const internalId = sggNameToInternalId(topName);
    const charEntry  = internalId ? characterList.find(c => c.id === internalId) : null;
    if (!charEntry) {
      console.log(`[startgg main] playerId=${playerId} no_mappable_character — topName="${topName}" count=${topMeta.count}`);
      const value = { character: null, reason: 'no_mappable_character', sampledEvents: events.length, sampledGames, totalSelections, topName };
      _mainCharCacheSet(playerId, value);
      return res.json({ ...value, fromCache: false });
    }

    const value = {
      character: { id: charEntry.id, name: charEntry.name, image: charEntry.image || '' },
      sampledEvents: events.length,
      sampledGames,
      totalSelections,
      topCount: topMeta.count,
    };
    _mainCharCacheSet(playerId, value);
    console.log(`[startgg main] playerId=${playerId} events=${events.length} games=${sampledGames} sels=${totalSelections} top=${charEntry.id} count=${topMeta.count}`);
    return res.json({ ...value, fromCache: false });
  } catch (e) {
    if (/RATE_LIMIT/.test(e.message)) {
      return res.json({ character: null, reason: 'rate_limited' });
    }
    if (/Clé API/.test(e.message)) {
      return res.json({ character: null, reason: 'no_api_key' });
    }
    console.error('[startgg main] erreur:', e.message);
    return res.json({ character: null, reason: 'startgg_error' });
  }
});

app.post('/api/startgg/set/:id/report', async (req, res) => {
  try {
    const setId = req.params.id;
    const { p1EntrantId, p2EntrantId, p1Score, p2Score, p1Character, p2Character, games } = req.body;

    console.log('[startgg report] ── NOUVELLE REQUÊTE ──────────────────');
    console.log('[startgg report] setId    :', setId);
    console.log('[startgg report] body     :', JSON.stringify(req.body));

    if (!p1EntrantId || !p2EntrantId) {
      console.error('[startgg report] ÉCHEC : IDs entrants manquants — p1EntrantId=%s p2EntrantId=%s', p1EntrantId, p2EntrantId);
      return res.status(400).json({ error: 'IDs entrants manquants' });
    }

    let gameData = [];
    let winnerId;

    if (Array.isArray(games) && games.length) {
      // ── Mode détaillé : un objet par game (gagnant + persos start.gg fournis par l'UI) ──
      let p1wins = 0, p2wins = 0;
      gameData = games.map((g, i) => {
        const winner2 = Number(g.winner) === 2;
        if (winner2) p2wins++; else p1wins++;
        const wId = winner2 ? p2EntrantId : p1EntrantId;
        const sel = [];
        if (g.p1CharId) sel.push({ entrantId: String(p1EntrantId), characterId: parseInt(g.p1CharId) });
        if (g.p2CharId) sel.push({ entrantId: String(p2EntrantId), characterId: parseInt(g.p2CharId) });
        const entry = { gameNum: i + 1, winnerId: String(wId) };
        if (sel.length) entry.selections = sel;
        return entry;
      });
      if (p1wins === p2wins) {
        return res.status(400).json({ error: 'Égalité de games, impossible de déterminer le vainqueur' });
      }
      winnerId = p1wins > p2wins ? String(p1EntrantId) : String(p2EntrantId);
    } else {
      // ── Mode simple (rétrocompat) : reconstruit depuis le score + 1 perso/joueur ──
      if (p1Score === p2Score) {
        return res.status(400).json({ error: 'Score à égalité, impossible de déterminer le vainqueur' });
      }
      winnerId = p1Score > p2Score ? String(p1EntrantId) : String(p2EntrantId);
      const p1CharId = p1Character ? INTERNAL_TO_STARTGG_CHAR[p1Character] || null : null;
      const p2CharId = p2Character ? INTERNAL_TO_STARTGG_CHAR[p2Character] || null : null;
      let gameNum = 1;
      const pushGames = (count, winnerEntrant) => {
        for (let i = 0; i < count; i++) {
          const entry = { gameNum: gameNum++, winnerId: String(winnerEntrant) };
          const sel = [];
          if (p1CharId) sel.push({ entrantId: String(p1EntrantId), characterId: p1CharId });
          if (p2CharId) sel.push({ entrantId: String(p2EntrantId), characterId: p2CharId });
          if (sel.length) entry.selections = sel;
          gameData.push(entry);
        }
      };
      pushGames(p1Score, p1EntrantId);
      pushGames(p2Score, p2EntrantId);
    }

    console.log('[startgg report] winnerId:', winnerId, '| gameData:', JSON.stringify(gameData));

    const data = await startggQuery(`
      mutation ReportSet($setId: ID!, $winnerId: ID!, $gameData: [BracketSetGameDataInput]) {
        reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
          id state
        }
      }
    `, { setId: String(setId), winnerId, gameData });

    console.log('[startgg report] success:', JSON.stringify(data));
    res.json({ success: true, set: data.reportBracketSet });
  } catch (e) {
    console.error('[startgg report] ÉCHEC :', e.message);
    res.status(400).json({ error: e.message });
  }
});

// Liste des personnages du jeu de l'event (pour le « report game data ») — tous jeux
app.get('/api/startgg/event/:id/characters', async (req, res) => {
  try {
    const data = await startggQuery(`
      query EventCharacters($eventId: ID!) {
        event(id: $eventId) {
          videogame { id name characters { id name } }
        }
      }
    `, { eventId: req.params.id });
    const vg = data?.event?.videogame;
    const characters = (vg?.characters || [])
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    res.json({ videogame: vg ? { id: vg.id, name: vg.name } : null, characters });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/startgg/event/:id/player-stats/:entrantId', async (req, res) => {
  try {
    // IDs kept as strings — start.gg GraphQL ID type accepts both string and int
    const eventId  = req.params.id;
    const entrantId = req.params.entrantId;

    let allSets = [];
    let page = 1;
    let totalPages = 1;
    let eventName = '';
    let playerName = '';
    let playerTag = '';
    let playerId = null;

    while (page <= totalPages) {
      const data = await startggQuery(`
        query PlayerStats($eventId: ID!, $entrantId: ID!, $page: Int!) {
          event(id: $eventId) {
            id name
            sets(
              filters: { entrantIds: [$entrantId] }
              perPage: 50
              page: $page
              sortType: RECENT
            ) {
              pageInfo { total totalPages }
              nodes {
                id fullRoundText state winnerId
                slots {
                  entrant {
                    id name
                    participants { gamerTag prefix player { id } }
                  }
                  standing { stats { score { value } } }
                }
                games {
                  winnerId
                  selections {
                    entrant { id }
                    selectionType
                    selectionValue
                  }
                }
              }
            }
          }
        }
      `, { eventId, entrantId, page });

      if (!data.event) return res.status(404).json({ error: 'Évènement introuvable' });
      eventName = data.event.name;
      totalPages = data.event.sets?.pageInfo?.totalPages || 1;
      allSets = allSets.concat(data.event.sets?.nodes || []);
      page++;
    }

    // Séparer sets terminés (state 3) et prochain match (state 1=appelé, 2=actif)
    const completedSets = allSets.filter(s => s.state === 3);
    const upcomingSets  = allSets.filter(s => s.state === 1 || s.state === 2);

    // Extract player name + playerId depuis les sets terminés ou à venir
    const allForInfo = [...completedSets, ...upcomingSets];
    for (const set of allForInfo) {
      const mySlot = (set.slots || []).find(s => String(s.entrant?.id) === String(entrantId));
      if (mySlot?.entrant?.participants?.[0]) {
        playerName = mySlot.entrant.participants[0].gamerTag || mySlot.entrant.name || '';
        playerTag  = mySlot.entrant.participants[0].prefix || '';
        playerId   = mySlot.entrant.participants[0].player?.id || null;
        break;
      }
    }

    // Compute wins/losses sur sets terminés
    let wins = 0, losses = 0;
    for (const set of completedSets) {
      if (String(set.winnerId) === String(entrantId)) wins++;
      else losses++;
    }

    // Compute top characters from game-level selections
    const charCounts = {};
    for (const set of completedSets) {
      for (const game of (set.games || [])) {
        for (const sel of (game.selections || [])) {
          if (String(sel.entrant?.id) === String(entrantId) && sel.selectionType === 'CHARACTER') {
            const charId = sel.selectionValue;
            charCounts[charId] = (charCounts[charId] || 0) + 1;
          }
        }
      }
    }

    const topCharacters = Object.entries(charCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([charId, games]) => {
        const internalId = sggCharIdToInternalId(parseInt(charId));
        const charEntry  = internalId ? characterList.find(c => c.id === internalId) : null;
        return {
          charId: parseInt(charId),
          name:  charEntry?.name || `Perso #${charId}`,
          image: internalId ? `/Stock Icons/chara_2_${internalId}_00.png` : '',
          games,
        };
      });

    // Tous les matchs joués (les plus récents en premier)
    function slotInfo(set) {
      const mySlot  = (set.slots || []).find(s => String(s.entrant?.id) === String(entrantId));
      const oppSlot = (set.slots || []).find(s => String(s.entrant?.id) !== String(entrantId));
      return { mySlot, oppSlot };
    }

    const allMatches = completedSets.map(set => {
      const { mySlot, oppSlot } = slotInfo(set);
      const isWin    = String(set.winnerId) === String(entrantId);
      const myScore  = mySlot?.standing?.stats?.score?.value ?? null;
      const oppScore = oppSlot?.standing?.stats?.score?.value ?? null;
      const oppName  = oppSlot?.entrant?.participants?.[0]?.gamerTag
                     || oppSlot?.entrant?.name || '?';
      const oppTag   = oppSlot?.entrant?.participants?.[0]?.prefix || '';
      return {
        round:        set.fullRoundText || '',
        opponentName: oppName,
        opponentTag:  oppTag,
        result:       isWin ? 'W' : 'L',
        score:        myScore  !== null ? Math.max(0, myScore)  : undefined,
        opponentScore: oppScore !== null ? Math.max(0, oppScore) : undefined,
      };
    });

    // Prochain match (premier set appelé ou actif)
    let nextMatch = null;
    if (upcomingSets.length > 0) {
      const next = upcomingSets[0];
      const { oppSlot } = slotInfo(next);
      const oppName = oppSlot?.entrant?.participants?.[0]?.gamerTag
                    || oppSlot?.entrant?.name || 'TBD';
      const oppTag  = oppSlot?.entrant?.participants?.[0]?.prefix || '';
      nextMatch = {
        round:        next.fullRoundText || '',
        opponentName: oppName,
        opponentTag:  oppTag,
        state:        next.state,
      };
    }

    res.json({ playerName, playerTag, eventName, wins, losses, topCharacters, allMatches, nextMatch });
  } catch (e) {
    console.error('[player-stats]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ─── H2H State & API ─────────────────────────────────────────────────────────

let h2hState = {
  visible: false,
  eventName: '',
  player1: { tag: '', name: '', color: '#E83030', currentStats: {} },
  player2: { tag: '', name: '', color: '#3070E8', currentStats: {} },
  h2h: { totalSets: 0, player1Wins: 0, player2Wins: 0, topCharsP1: [], topCharsP2: [], sets: [] },
};

app.get('/api/h2h', (req, res) => res.json(h2hState));
app.post('/api/h2h', (req, res) => {
  h2hState = { ...h2hState, ...req.body };
  io.emit('h2hUpdate', h2hState);
  res.json({ ok: true });
});

// Calcul H2H entre deux entrants sur un event
app.get('/api/startgg/event/:id/h2h/:e1/:e2', async (req, res) => {
  try {
    const { id: eventId, e1: entrantId1, e2: entrantId2 } = req.params;

    // Fetch all sets for entrant1
    let allSets = [];
    let page = 1;
    let totalPages = 1;
    let eventName = '';

    while (page <= totalPages) {
      const data = await startggQuery(`
        query H2H($eventId: ID!, $entrantId: ID!, $page: Int!) {
          event(id: $eventId) {
            id name
            sets(
              filters: { entrantIds: [$entrantId] }
              perPage: 50 page: $page sortType: RECENT
            ) {
              pageInfo { total totalPages }
              nodes {
                id fullRoundText state winnerId
                slots {
                  entrant { id name participants { gamerTag prefix player { id } } }
                  standing { stats { score { value } } }
                }
                games {
                  winnerId
                  selections {
                    entrant { id }
                    selectionType selectionValue
                  }
                }
              }
            }
          }
        }
      `, { eventId, entrantId: entrantId1, page });

      if (!data.event) return res.status(404).json({ error: 'Évènement introuvable' });
      eventName = data.event.name;
      totalPages = data.event.sets?.pageInfo?.totalPages || 1;
      allSets = allSets.concat(data.event.sets?.nodes || []);
      page++;
    }

    // Filter sets where opponent is entrant2
    const h2hSets = allSets.filter(s =>
      s.state === 3 &&
      (s.slots || []).some(sl => String(sl.entrant?.id) === String(entrantId2))
    );

    // Also compute full stats for each player (all completed sets)
    const completedSets1 = allSets.filter(s => s.state === 3);

    function getSlots(s, myId) {
      const mySlot  = (s.slots || []).find(sl => String(sl.entrant?.id) === String(myId));
      const oppSlot = (s.slots || []).find(sl => String(sl.entrant?.id) !== String(myId));
      return { mySlot, oppSlot };
    }

    function playerInfo(sets, myId) {
      for (const s of sets) {
        const { mySlot } = getSlots(s, myId);
        if (mySlot?.entrant?.participants?.[0]) {
          return {
            tag:  mySlot.entrant.participants[0].prefix || '',
            name: mySlot.entrant.participants[0].gamerTag || mySlot.entrant.name || '',
          };
        }
      }
      return { tag: '', name: '' };
    }

    function computeStats(sets, myId) {
      let wins = 0, losses = 0;
      const charCounts = {};
      for (const s of sets) {
        if (String(s.winnerId) === String(myId)) wins++; else losses++;
        for (const g of (s.games || [])) {
          for (const sel of (g.selections || [])) {
            if (String(sel.entrant?.id) === String(myId) && sel.selectionType === 'CHARACTER') {
              const cid = sel.selectionValue;
              charCounts[cid] = (charCounts[cid] || 0) + 1;
            }
          }
        }
      }
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      const topChars = Object.entries(charCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([charId]) => {
          const internalId = sggCharIdToInternalId(parseInt(charId));
          const charEntry  = internalId ? characterList.find(c => c.id === internalId) : null;
          return { name: charEntry?.name || `#${charId}`, image: internalId ? `/Stock Icons/chara_2_${internalId}_00.png` : '' };
        });
      return { wins, losses, winRate, topChars };
    }

    const p1info = playerInfo(allSets, entrantId1);
    const stats1 = computeStats(completedSets1, entrantId1);

    // For player 2, fetch separately (only need completed sets in this event)
    let allSets2 = [];
    page = 1; totalPages = 1;
    while (page <= totalPages) {
      const data2 = await startggQuery(`
        query H2HP2($eventId: ID!, $entrantId: ID!, $page: Int!) {
          event(id: $eventId) {
            sets(filters: { entrantIds: [$entrantId] } perPage: 50 page: $page sortType: RECENT) {
              pageInfo { totalPages }
              nodes {
                id state winnerId
                slots { entrant { id name participants { gamerTag prefix } } standing { stats { score { value } } } }
                games { winnerId selections { entrant { id } selectionType selectionValue } }
              }
            }
          }
        }
      `, { eventId, entrantId: entrantId2, page });
      totalPages = data2.event?.sets?.pageInfo?.totalPages || 1;
      allSets2 = allSets2.concat(data2.event?.sets?.nodes || []);
      page++;
    }

    const completedSets2 = allSets2.filter(s => s.state === 3);
    const p2info = playerInfo(allSets2, entrantId2);
    const stats2 = computeStats(completedSets2, entrantId2);

    // H2H record
    let p1wins = 0, p2wins = 0;
    const h2hCharCounts1 = {}, h2hCharCounts2 = {};
    const setsSummary = [];

    for (const s of h2hSets) {
      const isP1Win = String(s.winnerId) === String(entrantId1);
      if (isP1Win) p1wins++; else p2wins++;

      const { mySlot, oppSlot } = getSlots(s, entrantId1);
      const s1 = mySlot?.standing?.stats?.score?.value ?? null;
      const s2 = oppSlot?.standing?.stats?.score?.value ?? null;
      setsSummary.push({ round: s.fullRoundText || '', p1wins: isP1Win ? 1 : 0, p2wins: isP1Win ? 0 : 1, score: s1 !== null && s2 !== null ? `${Math.max(0,s1)}-${Math.max(0,s2)}` : '' });

      for (const g of (s.games || [])) {
        for (const sel of (g.selections || [])) {
          const cid = sel.selectionValue;
          if (sel.selectionType !== 'CHARACTER') continue;
          if (String(sel.entrant?.id) === String(entrantId1)) h2hCharCounts1[cid] = (h2hCharCounts1[cid] || 0) + 1;
          else if (String(sel.entrant?.id) === String(entrantId2)) h2hCharCounts2[cid] = (h2hCharCounts2[cid] || 0) + 1;
        }
      }
    }

    function topH2HChars(counts) {
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([charId]) => {
        const internalId = sggCharIdToInternalId(parseInt(charId));
        const charEntry  = internalId ? characterList.find(c => c.id === internalId) : null;
        return { name: charEntry?.name || `#${charId}`, image: internalId ? `/Stock Icons/chara_2_${internalId}_00.png` : '' };
      });
    }

    res.json({
      eventName,
      player1: { tag: p1info.tag, name: p1info.name, currentStats: stats1 },
      player2: { tag: p2info.tag, name: p2info.name, currentStats: stats2 },
      h2h: { totalSets: p1wins + p2wins, player1Wins: p1wins, player2Wins: p2wins, topCharsP1: topH2HChars(h2hCharCounts1), topCharsP2: topH2HChars(h2hCharCounts2), sets: setsSummary },
    });
  } catch (e) {
    console.error('[h2h]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ─── Tournament History State & API ──────────────────────────────────────────

let tournamentHistoryState = {
  visible: false,
  playerName: '',
  playerTag: '',
  playerColor: '#E8B830',
  tournaments: [], // [{ tournamentName, eventName, placement, numEntrants, startAt, sets[] }]
};

app.get('/tournament-history', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'tournament-history.html')));

app.get('/api/tournament-history', (req, res) => res.json(tournamentHistoryState));
app.post('/api/tournament-history', (req, res) => {
  tournamentHistoryState = { ...tournamentHistoryState, ...req.body };
  io.emit('tournamentHistoryUpdate', tournamentHistoryState);
  res.json(tournamentHistoryState);
});

// Récupère l'historique des anciens tournois via entrantId + eventId
app.get('/api/startgg/event/:id/player-history/:entrantId', async (req, res) => {
  try {
    const eventId   = req.params.id;
    const entrantId = req.params.entrantId;

    // 1) Récupérer le playerId depuis les sets du tournoi en cours
    let playerId   = null;
    let playerName = '';
    let playerTag  = '';

    const setsData = await startggQuery(`
      query GetPlayerId($eventId: ID!, $entrantId: ID!) {
        event(id: $eventId) {
          sets(filters: { entrantIds: [$entrantId] }, perPage: 1, page: 1) {
            nodes {
              slots {
                entrant {
                  id name
                  participants { gamerTag prefix player { id } }
                }
              }
            }
          }
        }
      }
    `, { eventId, entrantId });

    const firstSet = setsData.event?.sets?.nodes?.[0];
    if (firstSet) {
      const mySlot = (firstSet.slots || []).find(s => String(s.entrant?.id) === String(entrantId));
      if (mySlot?.entrant?.participants?.[0]) {
        playerName = mySlot.entrant.participants[0].gamerTag || mySlot.entrant.name || '';
        playerTag  = mySlot.entrant.participants[0].prefix || '';
        playerId   = mySlot.entrant.participants[0].player?.id || null;
      }
    }

    if (!playerId) return res.status(404).json({ error: 'playerId introuvable pour cet entrant' });

    // 2) Récupérer les standings récents (hors tournoi en cours)
    const standingsData = await startggQuery(`
      query PlayerStandings($playerId: ID!) {
        player(id: $playerId) {
          recentStandings(limit: 15) {
            placement
            entrant {
              id
              event {
                id name numEntrants
                tournament { name startAt }
              }
            }
          }
        }
      }
    `, { playerId });

    const standings = (standingsData.player?.recentStandings || [])
      .filter(s => String(s.entrant?.event?.id) !== String(eventId));

    // 3) Pour chaque tournoi, récupérer les sets joués
    const tournaments = [];
    for (const standing of standings.slice(0, 8)) {
      const evId  = standing.entrant?.event?.id;
      const entId = standing.entrant?.id;
      if (!evId || !entId) continue;

      try {
        const evSets = await startggQuery(`
          query EventHistory($eventId: ID!, $entrantId: ID!) {
            event(id: $eventId) {
              sets(
                filters: { entrantIds: [$entrantId], state: [3] }
                perPage: 50
                sortType: RECENT
              ) {
                nodes {
                  id fullRoundText winnerId
                  slots {
                    entrant { id name participants { gamerTag prefix } }
                    standing { stats { score { value } } }
                  }
                }
              }
            }
          }
        `, { eventId: evId, entrantId: entId });

        const sets = (evSets.event?.sets?.nodes || []).map(set => {
          const mySlot  = (set.slots || []).find(s => String(s.entrant?.id) === String(entId));
          const oppSlot = (set.slots || []).find(s => String(s.entrant?.id) !== String(entId));
          const isWin   = String(set.winnerId) === String(entId);
          const myScore  = mySlot?.standing?.stats?.score?.value ?? null;
          const oppScore = oppSlot?.standing?.stats?.score?.value ?? null;
          return {
            round:        set.fullRoundText || '',
            opponentName: oppSlot?.entrant?.participants?.[0]?.gamerTag || oppSlot?.entrant?.name || '?',
            opponentTag:  oppSlot?.entrant?.participants?.[0]?.prefix || '',
            result:       isWin ? 'W' : 'L',
            score:        myScore  !== null ? Math.max(0, myScore)  : undefined,
            opponentScore: oppScore !== null ? Math.max(0, oppScore) : undefined,
          };
        });

        tournaments.push({
          tournamentName: standing.entrant?.event?.tournament?.name || standing.entrant?.event?.name || '',
          eventName:      standing.entrant?.event?.name || '',
          placement:      standing.placement || null,
          numEntrants:    standing.entrant?.event?.numEntrants || null,
          startAt:        standing.entrant?.event?.tournament?.startAt || null,
          sets,
        });
      } catch (e) {
        console.error('[history] sets error for event', evId, e.message);
      }
    }

    res.json({ playerName, playerTag, tournaments });
  } catch (e) {
    console.error('[player-history]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ─── Bracket API ─────────────────────────────────────────────────────────────

let bracketState = {
  visible:      false,
  phaseName:    '',
  bracketType:  'DOUBLE_ELIMINATION',
  sets:         [],   // sets traités
  posX:         0,
  posY:         0,
  scale:        90,
};

app.get('/api/bracket', (req, res) => res.json(bracketState));

app.post('/api/bracket', (req, res) => {
  const allowed = ['visible','phaseName','bracketType','sets','posX','posY','scale'];
  const body = req.body || {};
  allowed.forEach(k => { if (k in body) bracketState[k] = body[k]; });
  io.emit('bracketUpdate', bracketState);
  res.json(bracketState);
});

app.get('/bracket', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bracket.html'));
});

// Phases + groupes d'un event
app.get('/api/startgg/event/:id/phases', async (req, res) => {
  try {
    const data = await startggQuery(`
      query EventPhases($eventId: ID!) {
        event(id: $eventId) {
          id name
          phases {
            id name bracketType
            phaseGroups(query: { page: 1, perPage: 50 }) {
              nodes { id displayIdentifier }
            }
          }
        }
      }
    `, { eventId: parseInt(req.params.id) });
    if (!data.event) return res.status(404).json({ error: 'Évènement introuvable' });
    res.json(data.event);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Sets d'un phaseGroup
app.get('/api/startgg/phasegroup/:id/sets', async (req, res) => {
  try {
    const data = await startggQuery(`
      query PhaseGroupSets($pgId: ID!) {
        phaseGroup(id: $pgId) {
          id displayIdentifier
          phase { name bracketType }
          sets(perPage: 128, page: 1, sortType: ROUND) {
            nodes {
              id round fullRoundText identifier state winnerId
              slots {
                entrant { id name participants { gamerTag prefix } }
                standing { stats { score { value } } }
              }
            }
          }
        }
      }
    `, { pgId: parseInt(req.params.id) });
    if (!data.phaseGroup) return res.status(404).json({ error: 'Phase group introuvable' });
    const pg = data.phaseGroup;
    const sets = (pg.sets?.nodes || []).map(s => {
      const [sl1, sl2] = s.slots || [];
      return {
        id:            s.id,
        round:         s.round,
        fullRoundText: s.fullRoundText || '',
        identifier:    s.identifier || '',
        state:         s.state,       // 1=pending, 2=in-progress, 3=complete
        winnerId:      s.winnerId,
        p1: {
          id:    sl1?.entrant?.id,
          name:  sl1?.entrant?.participants?.[0]?.gamerTag || sl1?.entrant?.name || 'TBD',
          tag:   sl1?.entrant?.participants?.[0]?.prefix  || '',
          score: sl1?.standing?.stats?.score?.value ?? null,
        },
        p2: {
          id:    sl2?.entrant?.id,
          name:  sl2?.entrant?.participants?.[0]?.gamerTag || sl2?.entrant?.name || 'TBD',
          tag:   sl2?.entrant?.participants?.[0]?.prefix  || '',
          score: sl2?.standing?.stats?.score?.value ?? null,
        },
      };
    });
    res.json({
      phaseGroupId:  pg.id,
      phaseName:     pg.phase?.name || '',
      bracketType:   pg.phase?.bracketType || 'DOUBLE_ELIMINATION',
      sets,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Top 8 API ───────────────────────────────────────────────────────────────

let top8State = {
  visible:        false,
  eventName:      '',
  tournamentName: '',
  eventDate:      '',
  tournamentLogo: '',
  players:        [],
  posX:      0,
  posY:      0,
  scale:     100,
};

app.get('/api/top8', (req, res) => res.json(top8State));

app.post('/api/top8', (req, res) => {
  const allowed = ['visible','eventName','tournamentName','eventDate','tournamentLogo','players','posX','posY','scale'];
  const body = req.body || {};
  allowed.forEach(k => { if (k in body) top8State[k] = body[k]; });
  io.emit('top8Update', top8State);
  res.json(top8State);
});

app.get('/top8', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'top8.html'));
});

// Standings top 8 d'un event start.gg (avec personnages les plus joués)
app.get('/api/startgg/event/:id/standings', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    // 1) Standings top 8
    const standingsData = await startggQuery(`
      query EventStandings($eventId: ID!) {
        event(id: $eventId) {
          id name
          startAt
          tournament {
            name
            images { url type }
          }
          standings(query: { page: 1, perPage: 8 }) {
            nodes {
              placement
              entrant {
                id name
                participants { gamerTag prefix }
              }
            }
          }
        }
      }
    `, { eventId });
    if (!standingsData.event) return res.status(404).json({ error: 'Évènement introuvable' });

    const ev       = standingsData.event;
    const standings = ev.standings?.nodes || [];

    // Métadonnées tournoi
    const tournamentName = ev.tournament?.name || '';
    const eventDate = ev.startAt
      ? new Date(ev.startAt * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const images = ev.tournament?.images || [];
    const tournamentLogo = (images.find(img => img.type === 'profile') || images.find(img => img.type === 'banner') || images[0])?.url || '';

    // 2) W/L + Personnages en deux requêtes séparées (éviter la limite de complexité)
    const charMap = {}; // entrantId → character name
    const wlMap   = {}; // entrantId → { wins, losses }
    try {
      const top8EntrantIds = standings
        .map(n => n.entrant?.id)
        .filter(Boolean)
        .map(Number);

      // Requête A : W/L uniquement (winnerId + slots, sans games)
      const wlData = await startggQuery(`
        query EventWL($eventId: ID!, $entrantIds: [ID]) {
          event(id: $eventId) {
            sets(filters: { state: [3], entrantIds: $entrantIds }, perPage: 100, page: 1) {
              nodes {
                winnerId
                slots { entrant { id } }
              }
            }
          }
        }
      `, { eventId, entrantIds: top8EntrantIds });

      (wlData.event?.sets?.nodes || []).forEach(set => {
        const wid = String(set.winnerId || '');
        (set.slots || []).forEach(slot => {
          const eid = String(slot.entrant?.id || '');
          if (!eid) return;
          if (!wlMap[eid]) wlMap[eid] = { wins: 0, losses: 0 };
          if (wid && wid === eid) wlMap[eid].wins++;
          else if (wid)          wlMap[eid].losses++;
        });
      });

      // Requête B : personnages uniquement (games.selections, sans slots)
      const charsData = await startggQuery(`
        query EventChars($eventId: ID!, $entrantIds: [ID]) {
          event(id: $eventId) {
            sets(filters: { state: [3], entrantIds: $entrantIds }, perPage: 30, page: 1) {
              nodes {
                games {
                  selections {
                    entrant { id }
                    selectionType
                    selectionValue
                  }
                }
              }
            }
          }
        }
      `, { eventId, entrantIds: top8EntrantIds });

      const counts = {}; // { entrantId: { charId: count } }
      (charsData.event?.sets?.nodes || []).forEach(set => {
        (set.games || []).forEach(game => {
          (game.selections || []).forEach(sel => {
            if (sel.selectionType !== 'CHARACTER') return;
            const eid = String(sel.entrant?.id);
            if (!counts[eid]) counts[eid] = {};
            const cid = Number(sel.selectionValue);
            counts[eid][cid] = (counts[eid][cid] || 0) + 1;
          });
        });
      });

      Object.entries(counts).forEach(([eid, charCounts]) => {
        const top = Object.entries(charCounts).sort((a, b) => b[1] - a[1])[0];
        if (!top) return;
        const internalId = sggCharIdToInternalId(Number(top[0]));
        const charEntry  = characterList.find(c => c.id === internalId);
        if (charEntry) charMap[eid] = charEntry.name;
      });
    } catch (e) {
      console.error('[top8 chars]', e.message);
    }

    const players = standings.map(n => ({
      placement:      n.placement,
      name:           n.entrant?.participants?.[0]?.gamerTag || n.entrant?.name || 'TBD',
      tag:            n.entrant?.participants?.[0]?.prefix || '',
      character:      charMap[String(n.entrant?.id)] || null,
      characterColor: 0,
      wins:           wlMap[String(n.entrant?.id)]?.wins   || 0,
      losses:         wlMap[String(n.entrant?.id)]?.losses || 0,
    }));

    res.json({ eventName: ev.name, tournamentName, eventDate, tournamentLogo, players });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Timer API ───────────────────────────────────────────────────────────────

let timerState = {
  mode:       'countdown', // 'countdown' | 'stopwatch'
  duration:   300,         // secondes (mode countdown)
  running:    false,
  startedAt:  null,        // timestamp ms du dernier démarrage
  elapsed:    0,           // secondes accumulées avant le dernier start
  visible:    true,
  label:      'TIMER',
  showLabel:  true,
  posX:       960,
  posY:       540,
  style:      'default',   // 'default' | 'minimal' | 'big'
  fontSize:   80,
  alertAt:           60,   // seuil alerte (countdown, secondes restantes)
  showMillis:        false,
  particlesEnabled:  false,
  particleCountScale: 100, // 10–300 (%)
};

app.get('/api/timer', (req, res) => {
  res.json(timerState);
});

app.post('/api/timer', (req, res) => {
  const body = req.body || {};

  // Actions spéciales
  if (body.action === 'start') {
    if (!timerState.running) {
      timerState.running   = true;
      timerState.startedAt = Date.now();
    }
  } else if (body.action === 'stop') {
    if (timerState.running) {
      const now = Date.now();
      timerState.elapsed  += (now - (timerState.startedAt || now)) / 1000;
      timerState.running   = false;
      timerState.startedAt = null;
    }
  } else if (body.action === 'reset') {
    timerState.running   = false;
    timerState.startedAt = null;
    timerState.elapsed   = 0;
  } else {
    // Mise à jour des propriétés de configuration
    const allowed = ['mode','duration','visible','label','showLabel','posX','posY','style','fontSize','alertAt','showMillis','particlesEnabled','particleCountScale'];
    allowed.forEach(k => { if (k in body) timerState[k] = body[k]; });
  }

  io.emit('timerUpdate', timerState);
  res.json(timerState);
});

app.get('/timer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'timer.html'));
});

// ─── VS Background API ───────────────────────────────────────────────────────

const BG_DIR = path.join(__dirname, 'public', 'background');
const BG_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

function getVsBgUrl() {
  if (!fs.existsSync(BG_DIR)) return null;
  for (const ext of BG_EXTS) {
    if (fs.existsSync(path.join(BG_DIR, 'vs-background' + ext)))
      return '/background/vs-background' + ext;
  }
  return null;
}

app.get('/api/vs-background', (req, res) => {
  res.json({ url: getVsBgUrl() });
});

app.post('/api/vs-background', (req, res) => {
  const { filename, data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });
  const ext = (path.extname(filename || '').toLowerCase()) || '.png';
  if (!BG_EXTS.includes(ext)) return res.status(400).json({ error: 'Format non supporté' });
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
  // Supprimer l'ancien fichier quelle que soit son extension
  BG_EXTS.forEach(e => {
    const old = path.join(BG_DIR, 'vs-background' + e);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  });
  fs.writeFileSync(path.join(BG_DIR, 'vs-background' + ext), Buffer.from(data, 'base64'));
  const url = '/background/vs-background' + ext;
  io.emit('vsBgUpdate', { url });
  res.json({ url });
});

app.delete('/api/vs-background', (req, res) => {
  BG_EXTS.forEach(e => {
    const f = path.join(BG_DIR, 'vs-background' + e);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  io.emit('vsBgUpdate', { url: null });
  res.json({ ok: true });
});

// ─── VS Config API ───────────────────────────────────────────────────────────

app.get('/api/vs-config', (req, res) => res.json(vsConfig));

app.post('/api/vs-config', (req, res) => {
  const body = req.body;
  if (body.bg)        vsConfig.bg        = { ...vsConfig.bg,        ...body.bg };
  if (body.vignette)  vsConfig.vignette  = { ...vsConfig.vignette,  ...body.vignette };
  if (body.scanlines) vsConfig.scanlines = { ...vsConfig.scanlines, ...body.scanlines };
  if (body.particles) vsConfig.particles = { ...vsConfig.particles, ...body.particles };
  if (body.animation) vsConfig.animation = { ...vsConfig.animation, ...body.animation };
  if (body.tint)      vsConfig.tint      = { ...vsConfig.tint,      ...body.tint };
  saveVsConfig();
  io.emit('vsConfigUpdate', vsConfig);
  res.json(vsConfig);
});

// ─── Victory Background API ──────────────────────────────────────────────────

function getVictoryBgUrl() {
  for (const ext of BG_EXTS)
    if (fs.existsSync(path.join(BG_DIR, 'victory-background' + ext)))
      return '/background/victory-background' + ext;
  return null;
}

app.get('/api/victory-background', (req, res) => res.json({ url: getVictoryBgUrl() }));

app.post('/api/victory-background', (req, res) => {
  const { filename, data } = req.body;
  if (!data) return res.status(400).json({ error: 'no data' });
  const ext = path.extname(filename).toLowerCase() || '.png';
  BG_EXTS.forEach(e => {
    const old = path.join(BG_DIR, 'victory-background' + e);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  });
  fs.writeFileSync(path.join(BG_DIR, 'victory-background' + ext), Buffer.from(data, 'base64'));
  const url = '/background/victory-background' + ext;
  io.emit('victoryBgUpdate', { url });
  res.json({ url });
});

app.delete('/api/victory-background', (req, res) => {
  BG_EXTS.forEach(e => {
    const f = path.join(BG_DIR, 'victory-background' + e);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  io.emit('victoryBgUpdate', { url: null });
  res.json({ ok: true });
});

// ─── Victory Config API ──────────────────────────────────────────────────────

app.get('/api/victory-config', (req, res) => res.json(victoryConfig));

app.post('/api/victory-config', (req, res) => {
  const body = req.body;
  if (body.bg)        victoryConfig.bg        = { ...victoryConfig.bg,        ...body.bg };
  if (body.vignette)  victoryConfig.vignette  = { ...victoryConfig.vignette,  ...body.vignette };
  if (body.scanlines) victoryConfig.scanlines = { ...victoryConfig.scanlines, ...body.scanlines };
  if (body.particles) victoryConfig.particles = { ...victoryConfig.particles, ...body.particles };
  if (body.animation) victoryConfig.animation = { ...victoryConfig.animation, ...body.animation };
  if (body.tint)      victoryConfig.tint      = { ...victoryConfig.tint,      ...body.tint };
  saveVictoryConfig();
  io.emit('victoryConfigUpdate', victoryConfig);
  res.json(victoryConfig);
});

// ─── Flags API ───────────────────────────────────────────────────────────────

app.get('/api/flags', (req, res) => {
  const flagsDir = path.join(__dirname, 'public', 'state_flag');
  try {
    const countries = fs.readdirSync(flagsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => ({
        code: d.name,
        files: fs.readdirSync(path.join(flagsDir, d.name))
          .filter(f => /\.png$/i.test(f))
          .sort()
      }));
    res.json(countries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Endpoint « /api/server/reload » retiré avec le bouton ↺ Serveur (évite un kill-switch
// exposé sur le réseau). Redémarrage : relancer start.bat, ou « npm run dev » (nodemon).

// ─── Scoreboard builder layouts ───────────────────────────────────────────────

let sbLayouts = (function () {
  try { return getConfig().sbLayouts || []; } catch { return []; }
})();

function saveSbLayouts() {
  const cfg = getConfig();
  cfg.sbLayouts = sbLayouts;
  saveConfig(cfg);
}

app.get('/api/sb-layouts', (req, res) => res.json({ layouts: sbLayouts }));

app.post('/api/sb-layouts', (req, res) => {
  const layout = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: req.body.name || 'Nouveau scoreboard',
    shapes: [],
  };
  sbLayouts.push(layout);
  saveSbLayouts();
  res.json({ layout });
});

app.patch('/api/sb-layouts/:id', (req, res) => {
  const idx = sbLayouts.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  sbLayouts[idx] = { ...sbLayouts[idx], ...req.body };
  saveSbLayouts();
  io.emit('sbLayoutUpdate', { id: sbLayouts[idx].id, shapes: sbLayouts[idx].shapes, sequences: sbLayouts[idx].sequences || [] });
  res.json({ layout: sbLayouts[idx] });
});

app.post('/api/sb-layouts/:id/sequences/:seqId/play', (req, res) => {
  const l = sbLayouts.find(l => l.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not found' });
  (l.sequences || []).forEach(s => { s.playing = s.id === req.params.seqId; });
  saveSbLayouts();
  io.emit('sbLayoutUpdate', { id: l.id, shapes: l.shapes, sequences: l.sequences || [] });
  res.json({ ok: true });
});

app.post('/api/sb-layouts/:id/sequences/:seqId/stop', (req, res) => {
  const l = sbLayouts.find(l => l.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not found' });
  (l.sequences || []).forEach(s => { s.playing = false; });
  saveSbLayouts();
  io.emit('sbLayoutUpdate', { id: l.id, shapes: l.shapes, sequences: l.sequences || [] });
  res.json({ ok: true });
});

app.delete('/api/sb-layouts/:id', (req, res) => {
  const idx = sbLayouts.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  sbLayouts.splice(idx, 1);
  saveSbLayouts();
  res.json({ ok: true });
});

app.get('/scoreboard-custom', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scoreboard-custom.html'));
});

// ─── Caster builder layouts ────────────────────────────────────────────────────

let casterLayouts = (function () {
  try { return getConfig().casterLayouts || []; } catch { return []; }
})();

function saveCasterLayouts() {
  const cfg = getConfig();
  cfg.casterLayouts = casterLayouts;
  saveConfig(cfg);
}

app.get('/api/caster-layouts', (req, res) => res.json({ layouts: casterLayouts }));

app.post('/api/caster-layouts', (req, res) => {
  const layout = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: req.body.name || 'Nouveau layout casters',
    shapes: [],
  };
  casterLayouts.push(layout);
  saveCasterLayouts();
  res.json({ layout });
});

app.patch('/api/caster-layouts/:id', (req, res) => {
  const idx = casterLayouts.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  casterLayouts[idx] = { ...casterLayouts[idx], ...req.body };
  saveCasterLayouts();
  io.emit('casterLayoutUpdate', { id: casterLayouts[idx].id, shapes: casterLayouts[idx].shapes, sequences: casterLayouts[idx].sequences || [] });
  res.json({ layout: casterLayouts[idx] });
});

app.post('/api/caster-layouts/:id/sequences/:seqId/play', (req, res) => {
  const l = casterLayouts.find(l => l.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not found' });
  (l.sequences || []).forEach(s => { s.playing = s.id === req.params.seqId; });
  saveCasterLayouts();
  io.emit('casterLayoutUpdate', { id: l.id, shapes: l.shapes, sequences: l.sequences || [] });
  res.json({ ok: true });
});

app.post('/api/caster-layouts/:id/sequences/:seqId/stop', (req, res) => {
  const l = casterLayouts.find(l => l.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not found' });
  (l.sequences || []).forEach(s => { s.playing = false; });
  saveCasterLayouts();
  io.emit('casterLayoutUpdate', { id: l.id, shapes: l.shapes, sequences: l.sequences || [] });
  res.json({ ok: true });
});

app.delete('/api/caster-layouts/:id', (req, res) => {
  const idx = casterLayouts.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  casterLayouts.splice(idx, 1);
  saveCasterLayouts();
  res.json({ ok: true });
});

app.get('/casters-custom', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'casters-custom.html'));
});

// ─── Master overlays (compositeurs NOMMÉS : chacun = plusieurs overlays empilés) ─────
// Modèle : masterOverlays = [{ id (stable), name (éditable), items:[{id,enabled}] }].
// Chaque master a son URL OBS /master/<id>. items dans l'ordre d'empilement (derniers au-dessus).
function _normItems(arr) {
  return Array.isArray(arr) ? arr.map(it => ({ id: String(it.id), enabled: !!it.enabled })) : [];
}
let masterOverlays = (function () {
  const cfg = (() => { try { return getConfig(); } catch { return {}; } })();
  // Nouveau format (liste)
  if (Array.isArray(cfg.masterOverlays) && cfg.masterOverlays.length) {
    return cfg.masterOverlays.map(o => ({ id: String(o.id), name: String(o.name || 'Master'), items: _normItems(o.items) }));
  }
  // Migration depuis l'ancien format (un seul masterOverlay)
  const old = cfg.masterOverlay;
  const items = (old && Array.isArray(old.items)) ? _normItems(old.items) : [
    { id: 'cam', enabled: true }, { id: 'frames', enabled: true },
    { id: 'scoreboard', enabled: true }, { id: 'casters', enabled: true },
  ];
  return [{ id: 'm1', name: 'Master 1', items }];
})();

function saveMasterOverlays() {
  try { const cfg = getConfig(); cfg.masterOverlays = masterOverlays; saveConfig(cfg); } catch {}
}
function findMaster(id) { return masterOverlays.find(o => o.id === String(id)); }
function newMasterId() {
  const ids = new Set(masterOverlays.map(o => o.id));
  let n = 1; while (ids.has('m' + n)) n++;
  return 'm' + n;
}

// Liste complète (panneau de contrôle)
app.get('/api/master', (req, res) => res.json({ overlays: masterOverlays }));

// Créer (défini AVANT /:id pour ne pas capturer "create" comme un id)
app.post('/api/master/create', (req, res) => {
  const id = newMasterId();
  const name = String((req.body && req.body.name) || ('Master ' + (masterOverlays.length + 1))).slice(0, 60);
  const o = { id, name, items: _normItems(req.body && req.body.items) };
  masterOverlays.push(o);
  saveMasterOverlays();
  res.json(o);
});

// Supprimer (jamais le dernier)
app.post('/api/master/:id/delete', (req, res) => {
  if (masterOverlays.length <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier master overlay' });
  const idx = masterOverlays.findIndex(o => o.id === String(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Master overlay introuvable' });
  masterOverlays.splice(idx, 1);
  saveMasterOverlays();
  res.json({ ok: true });
});

// Un master précis (master.js / OBS)
app.get('/api/master/:id', (req, res) => {
  const o = findMaster(req.params.id);
  if (!o) return res.status(404).json({ error: 'Master overlay introuvable' });
  res.json(o);
});

// Mettre à jour items et/ou nom
app.post('/api/master/:id', (req, res) => {
  const o = findMaster(req.params.id);
  if (!o) return res.status(404).json({ error: 'Master overlay introuvable' });
  if (req.body && Array.isArray(req.body.items)) o.items = _normItems(req.body.items);
  if (req.body && typeof req.body.name === 'string') o.name = req.body.name.slice(0, 60);
  saveMasterOverlays();
  io.emit('masterUpdate', { id: o.id, name: o.name, items: o.items });
  res.json(o);
});

// /master (sans id → premier) et /master/:id : master.js lit l'id depuis l'URL
app.get('/master', (req, res) => res.sendFile(path.join(__dirname, 'public', 'master.html')));
app.get('/master/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'master.html')));

// ─── Transitions / Animations overlays ───────────────────────────────────────

const TRANSITION_IDS = [
  'scoreboard', 'casters', 'stageveto',
  'ticker', 'cam', 'frames', 'stream-title', 'h2h', 'player-stats',
  'tournament-history', 'bracket', 'top8', 'timer', 'nextmatch', 'upcoming',
  'twitch-chat', 'twitch-viewer', 'youtube-chat', 'combined-chat',
  'victory', 'vs-screen',
];

function defaultTransition() {
  return { animIn: 'fade', animOut: 'fade', dur: 500, visible: true };
}

function getTransitionState() {
  const cfg = getConfig();
  if (!cfg.transitions) return {};
  return cfg.transitions;
}

function saveTransitionState(state) {
  const cfg = getConfig();
  cfg.transitions = state;
  saveConfig(cfg);
}

/* Initialise les entrées manquantes */
let transitionState = (() => {
  const saved = getTransitionState();
  const out = {};
  for (const id of TRANSITION_IDS) {
    out[id] = Object.assign(defaultTransition(), saved[id] || {});
  }
  return out;
})();

app.get('/api/transitions', (req, res) => res.json(transitionState));

app.get('/api/transitions/:id', (req, res) => {
  const id = req.params.id;
  if (!transitionState[id]) return res.status(404).json({ error: 'unknown overlay' });
  res.json(transitionState[id]);
});

app.patch('/api/transitions/:id', (req, res) => {
  const id = req.params.id;
  if (!transitionState[id]) return res.status(404).json({ error: 'unknown overlay' });
  const allowed = ['animIn', 'animOut', 'dur', 'visible'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) transitionState[id][k] = req.body[k];
  }
  saveTransitionState(transitionState);
  io.emit('transitionsUpdate', transitionState);
  res.json(transitionState[id]);
});

app.post('/api/transitions/:id/show', (req, res) => {
  const id = req.params.id;
  if (!transitionState[id]) return res.status(404).json({ error: 'unknown overlay' });
  transitionState[id].visible = true;
  saveTransitionState(transitionState);

  io.emit('overlayShow', {
    id,
    animIn:  transitionState[id].animIn,
    animOut: transitionState[id].animOut,
    dur:     transitionState[id].dur,
  });
  io.emit('transitionsUpdate', transitionState);
  res.json({ ok: true });
});

app.post('/api/transitions/:id/hide', (req, res) => {
  const id = req.params.id;
  if (!transitionState[id]) return res.status(404).json({ error: 'unknown overlay' });
  transitionState[id].visible = false;
  saveTransitionState(transitionState);
  io.emit('overlayHide', {
    id,
    animIn:  transitionState[id].animIn,
    animOut: transitionState[id].animOut,
    dur:     transitionState[id].dur,
  });
  io.emit('transitionsUpdate', transitionState);
  res.json({ ok: true });
});

// ─── Stream Deck ─────────────────────────────────────────────────────────────
//
// Endpoints GET sans auth — appelables directement depuis le Stream Deck.
// Utilise le système de transitions (animIn/animOut/dur configurés dans le panneau).
// URL exemple : http://localhost:3002/api/deck/cam/toggle

const DECK_LABELS = {
  'scoreboard':         'Scoreboard',
  'casters':            'Commentateurs',
  'stageveto':          'Stage Veto',
  'ticker':             'Bandeau défilant',
  'cam':                'Cam',
  'frames':             'Cadres',
  'stream-title':       'Titre du stream',
  'h2h':                'Head-to-Head',
  'player-stats':       'Stats Joueur',
  'tournament-history': 'Historique',
  'bracket':            'Bracket',
  'top8':               'Top 8',
  'timer':              'Minuteur',
  'nextmatch':          'Next Match',
  'upcoming':           'Prochains matchs',
  'twitch-chat':        'Chat Twitch',
  'twitch-viewer':      'Viewers Twitch',
  'youtube-chat':       'Chat YouTube',
  'combined-chat':      'Chat Combiné',
  'victory':            'Victoire',
  'vs-screen':          'VS Screen',
};

app.get('/api/deck', (req, res) => {
  const base = `http://${req.hostname}:${PORT}`;
  const overlays = TRANSITION_IDS.map(id => ({
    id,
    label:   DECK_LABELS[id] || id,
    visible: transitionState[id]?.visible ?? true,
    animIn:  transitionState[id]?.animIn  || 'fade',
    animOut: transitionState[id]?.animOut || 'fade',
    dur:     transitionState[id]?.dur     ?? 500,
    urls: {
      show:   `${base}/api/deck/${id}/show`,
      hide:   `${base}/api/deck/${id}/hide`,
      toggle: `${base}/api/deck/${id}/toggle`,
    },
  }));
  res.json({ overlays });
});

// ─── Stream Deck — Scores ─────────────────────────────────────────────────────
// Ces routes doivent être définies AVANT /api/deck/:overlay/:action
// pour éviter que /api/deck/score/reset soit intercepté par le handler générique.

app.get('/api/deck/score/reset', (req, res) => {
  matchState.player1.score = 0;
  matchState.player2.score = 0;
  io.emit('stateUpdate', matchState);

  if (req.headers.accept?.includes('text/html')) return res.send('<script>window.close();</script>');
  res.json({ ok: true, p1: 0, p2: 0 });
});

app.get('/api/deck/score/:player/:action', (req, res) => {
  const { player, action } = req.params;
  if (!['p1', 'p2'].includes(player))
    return res.status(400).json({ error: 'Joueur invalide (p1 ou p2)' });
  if (!['inc', 'dec'].includes(action))
    return res.status(400).json({ error: 'Action invalide (inc ou dec)' });

  const key = player === 'p1' ? 'player1' : 'player2';
  const cur = matchState[key].score || 0;
  matchState[key].score = action === 'inc' ? cur + 1 : Math.max(0, cur - 1);
  io.emit('stateUpdate', matchState);

  if (req.headers.accept?.includes('text/html')) return res.send('<script>window.close();</script>');
  res.json({ ok: true, player, score: matchState[key].score });
});

app.get('/api/deck/:overlay/:action', (req, res) => {
  const { overlay, action } = req.params;
  if (!['show', 'hide', 'toggle', 'reveal'].includes(action))
    return res.status(400).json({ error: `Action invalide: ${action}` });

if (!transitionState[overlay])
    return res.status(404).json({ error: `Overlay inconnu: ${overlay}`, available: TRANSITION_IDS });

  const t = transitionState[overlay];
  const isReveal = action === 'reveal';
  const doShow = isReveal ? true : (action === 'toggle' ? !t.visible : action === 'show');
  t.visible = doShow;
  saveTransitionState(transitionState);

  if (overlay === 'victory') {
    io.emit(doShow ? 'victoryTest' : 'victoryHide', doShow ? matchState : undefined);
  } else if (overlay === 'vs-screen') {
    io.emit(doShow ? 'vsScreenTrigger' : 'vsScreenHide');
  } else {
    io.emit(doShow ? 'overlayShow' : 'overlayHide', {
      id:     overlay,
      animIn:  t.animIn,
      animOut: t.animOut,
      dur:     t.dur,
    });
  }
  io.emit('transitionsUpdate', transitionState);

  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.send('<script>window.close();</script>');
  }
  res.json({ ok: true, overlay, action, visible: doShow });
});

// ── Notes internes ───────────────────────────────────────────────────────────
let notesState = [];
let _notesIdSeq = 1;

app.get('/notes', (req, res) => res.sendFile(path.join(__dirname, 'public', 'notes.html')));

app.get('/api/notes', (req, res) => res.json(notesState));

app.post('/api/notes', (req, res) => {
  const { author = 'Régie', text, tag = 'info' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texte requis' });
  const note = {
    id:     _notesIdSeq++,
    author: String(author).trim().slice(0, 40),
    text:   String(text).trim().slice(0, 500),
    tag:    ['info', 'warn', 'urgent'].includes(tag) ? tag : 'info',
    ts:     Date.now(),
  };
  notesState.unshift(note);
  if (notesState.length > 100) notesState = notesState.slice(0, 100);
  io.emit('notesUpdate', notesState);
  res.json(note);
});

app.delete('/api/notes/all', (req, res) => {
  notesState = [];
  io.emit('notesUpdate', notesState);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  notesState = notesState.filter(n => n.id !== id);
  io.emit('notesUpdate', notesState);
  res.json({ ok: true });
});

// ─── Configuration Tournoi ───────────────────────────────────────────────────

function getTournamentConfig() {
  const cfg = getConfig();
  return {
    name:      cfg.tournamentName      || '',
    slug:      cfg.tournamentSlug      || '',
    logoUrl:   cfg.tournamentLogoUrl   || '',
    bannerUrl: cfg.tournamentBannerUrl || '',
    id:        cfg.tournamentId        || null,
    eventId:   cfg.tournamentEventId   || null,
    eventName: cfg.tournamentEventName || '',
    phaseId:   cfg.tournamentPhaseId   || null,
    phaseName: cfg.tournamentPhaseName || '',
  };
}

app.get('/api/tournament-config', (req, res) => res.json(getTournamentConfig()));

app.post('/api/tournament-config', (req, res) => {
  const cfg = getConfig();
  if (req.body.name      !== undefined) cfg.tournamentName      = String(req.body.name).trim();
  if (req.body.slug      !== undefined) cfg.tournamentSlug      = String(req.body.slug).trim();
  if (req.body.logoUrl   !== undefined) cfg.tournamentLogoUrl   = String(req.body.logoUrl).trim();
  if (req.body.bannerUrl !== undefined) cfg.tournamentBannerUrl = String(req.body.bannerUrl).trim();
  if (req.body.id        !== undefined) cfg.tournamentId        = req.body.id;
  if (req.body.eventId   !== undefined) cfg.tournamentEventId   = req.body.eventId || null;
  if (req.body.eventName !== undefined) cfg.tournamentEventName = String(req.body.eventName || '').trim();
  if (req.body.phaseId   !== undefined) cfg.tournamentPhaseId   = req.body.phaseId   || null;
  if (req.body.phaseName !== undefined) cfg.tournamentPhaseName = String(req.body.phaseName || '').trim();
  if (req.body.apiKey    !== undefined && req.body.apiKey) cfg.startggApiKey = String(req.body.apiKey).trim();
  saveConfig(cfg);
  /* Sync upcoming slug + eventId */
  const slugChanged    = req.body.slug    !== undefined && cfg.tournamentSlug   !== upcomingState.slug;
  const eventChanged   = req.body.eventId !== undefined && cfg.tournamentEventId !== upcomingState.eventId;
  upcomingState.slug    = cfg.tournamentSlug    || '';
  upcomingState.eventId = cfg.tournamentEventId || null;
  upcomingState.phaseId = cfg.tournamentPhaseId || null;
  if ((slugChanged || eventChanged) && upcomingState.eventId) {
    refreshUpcoming().catch(() => {});
  }
  const tc = getTournamentConfig();
  io.emit('tournamentConfigUpdate', tc);
  res.json(tc);
});

/* Récupère le nom + logo depuis l'API Start.gg pour préremplir le formulaire */
app.post('/api/tournament-config/fetch', async (req, res) => {
  const { slug, apiKey } = req.body;
  if (!slug) return res.status(400).json({ error: 'Slug manquant' });

  const cfg = getConfig();
  if (apiKey && apiKey !== cfg.startggApiKey) {
    cfg.startggApiKey = apiKey;
    saveConfig(cfg);
  }

  try {
    const data = await startggQuery(`
      query TournamentSetup($slug: String!) {
        tournament(slug: $slug) {
          id name slug
          images { url type ratio width height }
          events { id name numEntrants }
        }
      }
    `, { slug });

    if (!data?.tournament) throw new Error('Tournoi introuvable — vérifiez le slug et la clé API');

    const t    = data.tournament;
    const imgs = t.images || [];
    const logoImg  = imgs.find(i => i.type === 'profile')
                  || imgs.find(i => Math.abs((i.ratio || 1) - 1) < 0.25)
                  || imgs[0];
    const bannerImg = imgs.find(i => i.type === 'banner')
                   || imgs.find(i => (i.ratio || 1) > 1.4);

    res.json({
      id:        t.id,
      name:      t.name,
      slug:      t.slug,
      logoUrl:   logoImg?.url   || '',
      bannerUrl: bannerImg?.url || '',
      events:    (t.events || []).map(e => ({ id: e.id, name: e.name, numEntrants: e.numEntrants })),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Stinger overlay ──────────────────────────────────────────────────────────

let stingerConfig = (() => {
  const cfg = getConfig();
  return Object.assign({ logoUrl: '', bgUrl: '' }, cfg.stinger || cfg.bonus || {});
})();

function saveStingerConfig() {
  const cfg = getConfig();
  cfg.stinger = stingerConfig;
  saveConfig(cfg);
}

app.get('/stinger-overlay',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-overlay.html')));
app.get('/stinger-tranches',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-tranches.html')));
app.get('/stinger-slash',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-slash.html')));
app.get('/stinger-explosion',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-explosion.html')));
app.get('/stinger-glitch',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-glitch.html')));
app.get('/stinger-zoom',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-zoom.html')));
app.get('/stinger-horloge',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-horloge.html')));
app.get('/stinger-stores',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-stores.html')));
app.get('/stinger-pixels',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-pixels.html')));
app.get('/stinger-vague',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-vague.html')));
app.get('/stinger-rideau',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-rideau.html')));
app.get('/stinger-vortex',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-vortex.html')));
app.get('/stinger-brisure',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-brisure.html')));
app.get('/stinger-diamants',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-diamants.html')));
app.get('/stinger-eclair',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-eclair.html')));
app.get('/stinger-dual',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-dual.html')));
app.get('/stinger-default',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-default.html')));
app.get('/stinger-cyberpunk',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-cyberpunk.html')));
app.get('/stinger-synthwave',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-synthwave.html')));
app.get('/stinger-midnight',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-midnight.html')));
app.get('/stinger-egypte',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-egypte.html')));
app.get('/stinger-grandeville',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-grandeville.html')));
app.get('/stinger-plage',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-plage.html')));
app.get('/stinger-alsace',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-alsace.html')));
app.get('/stinger-whitespace',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-whitespace.html')));
app.get('/stinger-monochrome',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-monochrome.html')));
app.get('/stinger-brutaliste',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-brutaliste.html')));
app.get('/stinger-flatdesign',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-flatdesign.html')));
app.get('/stinger-glass',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-glass.html')));
app.get('/stinger-neuro',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-neuro.html')));
app.get('/stinger-clay',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-clay.html')));
app.get('/stinger-paper',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-paper.html')));
app.get('/stinger-grain',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-grain.html')));
app.get('/stinger-darkelegant',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-darkelegant.html')));
app.get('/stinger-neonoir',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-neonoir.html')));
app.get('/stinger-pastel',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-pastel.html')));
app.get('/stinger-duotone',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-duotone.html')));
app.get('/stinger-aurora',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-aurora.html')));
app.get('/stinger-bauhaus',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-bauhaus.html')));
app.get('/stinger-artdeco',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-artdeco.html')));
app.get('/stinger-y2k',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-y2k.html')));
app.get('/stinger-wabisabi',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-wabisabi.html')));
app.get('/stinger-swiss',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-swiss.html')));
app.get('/stinger-biomorphic',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-biomorphic.html')));
app.get('/stinger-earthy',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-earthy.html')));
app.get('/stinger-botanik',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-botanik.html')));
app.get('/stinger-aquarelle',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-aquarelle.html')));
app.get('/stinger-cosmos',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-cosmos.html')));
app.get('/stinger-brutalism',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-brutalism.html')));
app.get('/stinger-skeuo',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-skeuo.html')));
app.get('/stinger-hud',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-hud.html')));
app.get('/stinger-pixelart',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-pixelart.html')));
app.get('/stinger-dataviz',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'stinger-dataviz.html')));

app.get('/api/stinger', (req, res) => res.json(stingerConfig));

app.post('/api/stinger/logo', (req, res) => {
  const { filename, data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });
  const ext = (path.extname(filename || '').toLowerCase()) || '.png';
  if (!BG_EXTS.includes(ext)) return res.status(400).json({ error: 'Format non supporté' });
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
  BG_EXTS.forEach(e => { const old = path.join(BG_DIR, 'stinger-logo' + e); if (fs.existsSync(old)) fs.unlinkSync(old); });
  fs.writeFileSync(path.join(BG_DIR, 'stinger-logo' + ext), Buffer.from(data, 'base64'));
  const url = '/background/stinger-logo' + ext;
  stingerConfig.logoUrl = url;
  saveStingerConfig();
  io.emit('stingerConfig', stingerConfig);
  res.json({ url });
});

app.delete('/api/stinger/logo', (req, res) => {
  BG_EXTS.forEach(e => { const f = path.join(BG_DIR, 'stinger-logo' + e); if (fs.existsSync(f)) fs.unlinkSync(f); });
  stingerConfig.logoUrl = '';
  saveStingerConfig();
  io.emit('stingerConfig', stingerConfig);
  res.json({ ok: true });
});

app.post('/api/stinger/background', (req, res) => {
  const { filename, data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });
  const ext = (path.extname(filename || '').toLowerCase()) || '.png';
  if (!BG_EXTS.includes(ext)) return res.status(400).json({ error: 'Format non supporté' });
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
  BG_EXTS.forEach(e => { const old = path.join(BG_DIR, 'stinger-bg' + e); if (fs.existsSync(old)) fs.unlinkSync(old); });
  fs.writeFileSync(path.join(BG_DIR, 'stinger-bg' + ext), Buffer.from(data, 'base64'));
  const url = '/background/stinger-bg' + ext;
  stingerConfig.bgUrl = url;
  saveStingerConfig();
  io.emit('stingerConfig', stingerConfig);
  res.json({ url });
});

app.delete('/api/stinger/background', (req, res) => {
  BG_EXTS.forEach(e => { const f = path.join(BG_DIR, 'stinger-bg' + e); if (fs.existsSync(f)) fs.unlinkSync(f); });
  stingerConfig.bgUrl = '';
  saveStingerConfig();
  io.emit('stingerConfig', stingerConfig);
  res.json({ ok: true });
});

// ─── Prochains matchs (stream queue overlay) ──────────────────────────────────

let upcomingState = (() => {
  const cfg = getConfig();
  return {
    sets:           [],
    slug:           cfg.upcomingSlug || cfg.tournamentSlug || '',
    eventId:        cfg.tournamentEventId  || null,
    phaseId:        cfg.tournamentPhaseId  || null,
    streamFilter:   cfg.upcomingStreamFilter   || '',
    maxSets:        cfg.upcomingMaxSets        || 16,
    frameWidthPct:  cfg.upcomingFrameWidthPct  || 30,
    frameRatio:     cfg.upcomingFrameRatio     || '16:9',
    frameLabel:     cfg.upcomingFrameLabel     || '',
    textColor:      cfg.upcomingTextColor      || '',
    lastUpdate:     null,
    error:          null,
    visible:        true,
  };
})();

function saveUpcomingConfig() {
  const cfg = getConfig();
  cfg.upcomingStreamFilter  = upcomingState.streamFilter;
  cfg.upcomingMaxSets       = upcomingState.maxSets;
  cfg.upcomingFrameWidthPct = upcomingState.frameWidthPct;
  cfg.upcomingFrameRatio    = upcomingState.frameRatio;
  cfg.upcomingFrameLabel    = upcomingState.frameLabel;
  cfg.upcomingTextColor     = upcomingState.textColor;
  saveConfig(cfg);
}

function processUpcomingSlot(slot) {
  const ent = slot?.entrant;
  if (!ent) return { tag: '?', prefix: '', seed: null };
  const p = ent.participants?.[0];
  return {
    tag:    p?.gamerTag || ent.name || '?',
    prefix: p?.prefix   || '',
    seed:   ent.initialSeedNum || null,
    score:  slot?.standing?.stats?.score?.value ?? null,
  };
}

async function refreshUpcoming() {
  const { eventId, phaseId, maxSets } = upcomingState;
  if (!eventId) { upcomingState.error = 'Aucun bracket sélectionné'; io.emit('upcomingUpdate', upcomingState); return; }
  try {
    const phaseFilter = phaseId ? `, phaseIds: [${phaseId}]` : '';
    const data = await startggQuery(`
      query UpcomingSets($eventId: ID!) {
        event(id: $eventId) {
          sets(page: 1, perPage: 64, sortType: MAGIC, filters: { state: [1, 2, 4, 6]${phaseFilter} }) {
            nodes {
              id fullRoundText totalGames
              phaseGroup { displayIdentifier phase { name } }
              slots {
                entrant { id name initialSeedNum participants { gamerTag prefix } }
                standing { stats { score { value } } }
              }
            }
          }
        }
      }
    `, { eventId });

    const nodes = data?.event?.sets?.nodes || [];
    /* Exclure les BYEs (un slot sans entrant) */
    const valid = nodes.filter(s => s.slots?.[0]?.entrant && s.slots?.[1]?.entrant);

    upcomingState.sets = valid.slice(0, maxSets).map((s, idx) => ({
      id:         s.id,
      position:   idx + 1,
      roundName:  s.fullRoundText || '',
      phase:      s.phaseGroup?.phase?.name || '',
      group:      s.phaseGroup?.displayIdentifier || '',
      p1:         processUpcomingSlot(s.slots?.[0]),
      p2:         processUpcomingSlot(s.slots?.[1]),
      totalGames: s.totalGames || null,
    }));
    upcomingState.lastUpdate = Date.now();
    upcomingState.error      = null;
  } catch (e) {
    upcomingState.error = e.message;
  }
  io.emit('upcomingUpdate', upcomingState);
}

let _upcomingTimer = null;
function scheduleUpcomingRefresh() {
  clearTimeout(_upcomingTimer);
  const interval = (getConfig().upcomingRefreshInterval || 60) * 1000;
  if (interval > 0 && upcomingState.eventId) {
    _upcomingTimer = setTimeout(async () => {
      await refreshUpcoming();
      scheduleUpcomingRefresh();
    }, interval);
  }
}

app.get('/upcoming', (req, res) => res.sendFile(path.join(__dirname, 'public', 'upcoming.html')));

app.get('/api/upcoming', (req, res) => res.json(upcomingState));

app.post('/api/upcoming/config', (req, res) => {
  if (req.body.streamFilter   !== undefined) upcomingState.streamFilter   = String(req.body.streamFilter).trim();
  if (req.body.maxSets        !== undefined) upcomingState.maxSets        = Math.min(20, Math.max(1, parseInt(req.body.maxSets, 10)));
  if (req.body.frameWidthPct  !== undefined) upcomingState.frameWidthPct  = Math.min(70, Math.max(10, parseInt(req.body.frameWidthPct, 10)));
  if (req.body.frameRatio     !== undefined) upcomingState.frameRatio     = ['16:9','4:3'].includes(req.body.frameRatio) ? req.body.frameRatio : '16:9';
  if (req.body.frameLabel     !== undefined) upcomingState.frameLabel     = String(req.body.frameLabel);
  if (req.body.textColor      !== undefined) upcomingState.textColor      = /^#[0-9A-Fa-f]{6}$/.test(req.body.textColor) ? req.body.textColor : '';
  if (req.body.refreshInterval !== undefined) {
    const cfg = getConfig(); cfg.upcomingRefreshInterval = parseInt(req.body.refreshInterval, 10); saveConfig(cfg);
  }
  saveUpcomingConfig();
  io.emit('upcomingUpdate', upcomingState);
  scheduleUpcomingRefresh();
  res.json({ ok: true });
});

app.post('/api/upcoming/refresh', async (req, res) => {
  if (req.body.maxSets !== undefined) upcomingState.maxSets = Math.min(20, Math.max(1, parseInt(req.body.maxSets, 10)));
  saveUpcomingConfig();
  if (!upcomingState.eventId) return res.status(400).json({ error: 'Aucun bracket sélectionné — configurez le tournoi depuis le menu en haut' });
  await refreshUpcoming();
  scheduleUpcomingRefresh();
  res.json(upcomingState);
});

// ─── Télécommande de score « 3DS only » (additif, voir remote-3ds.js) ─────────
mountRemote3DS(app, { io, getMatchState: () => matchState, startggQuery, getTournamentConfig });

// ─── S3 : Endpoints HTTP du tunnel ngrok ─────────────────────────────────────
// Toutes les écritures POST passent par le middleware d'auth global (requireAuth).
// Le GET status n'est pas protégé (pas de secret renvoyé — le token n'est jamais en clair).

app.get('/api/remote-access/status', (req, res) => {
  res.json(remoteAccess.getRemoteAccessStatus());
});

app.post('/api/remote-access/config', async (req, res) => {
  try {
    const { authtoken, domain, autostart } = req.body || {};
    const partial = {};
    if (authtoken !== undefined) partial.ngrokAuthtoken = authtoken;
    if (domain    !== undefined) partial.ngrokDomain    = domain;
    if (autostart !== undefined) partial.autostart      = autostart;
    const status = await remoteAccess.saveRemoteAccessConfig(partial);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/api/remote-access/start', async (req, res) => {
  const status = await remoteAccess.start(PORT);
  if (status.status === 'error') return res.status(400).json(status);
  res.json(status);
});

app.post('/api/remote-access/stop', async (req, res) => {
  const status = await remoteAccess.stop();
  res.json(status);
});

// ─── Start ────────────────────────────────────────────────────────────────────

// S4 : endpoints update — status (read-only), check (force re-poll), apply, dismiss.
app.get('/api/update/status', async (req, res) => {
  try { res.json(await updater.getUpdateState()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/update/check', async (req, res) => {
  try { res.json(await updater.checkNow()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/update/dismiss', (req, res) => {
  const v = (req.body && req.body.version) || '';
  if (!v) return res.status(400).json({ error: 'version requise' });
  updater.dismissVersion(v);
  res.json({ ok: true, dismissed: v });
});
app.post('/api/update/apply', async (req, res) => {
  try {
    // Lance l'update en arrière-plan, puis quitte le process avec le code
    // de restart. Le wrapper start.bat relance le serveur, qui repart avec
    // la nouvelle version.
    res.json({ ok: true, status: 'started' });
    setTimeout(async () => {
      try {
        const state = await updater.getUpdateState({ force: true });
        await updater.applyUpdate({ release: state.release });
        console.log('[update] applied — exiting with code', updater.RESTART_EXIT_CODE);
        process.exit(updater.RESTART_EXIT_CODE);
      } catch (e) {
        console.error('[update] FAILED:', e.message);
        // On émet l'erreur via socket — le client peut la montrer.
        try { updater.setEmitter && io.emit('updateStatus', { phase: 'error', error: e.message }); } catch (_) {}
      }
    }, 150);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// S3 : ferme proprement le tunnel ngrok sur SIGINT/SIGTERM/SIGBREAK (Ctrl+C, etc.).
remoteAccess.installShutdownHandlers();

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('🎮 PSO démarré !');
  console.log('');
  console.log('  ── Ce PC (localhost) ──────────────────────────────────────');
  console.log('   Contrôle   → http://localhost:' + PORT + '/control');
  console.log('   Overlays   → http://localhost:' + PORT + '/overlay  (etc.)');
  if (ips.length > 0) {
    console.log('');
    console.log('  ── Autre PC (réseau local) ────────────────────────────────');
    ips.forEach(ip => {
      console.log('   Contrôle   → http://' + ip + ':' + PORT + '/control');
      console.log('   Overlays   → http://' + ip + ':' + PORT + '/overlay  (etc.)');
      console.log('   Score 3DS  → http://' + ip + ':' + PORT + '/remote   (réservé Nintendo 3DS)');
    });
  }
  console.log('');

  // S3 : autostart du tunnel ngrok si configuré. Fire-and-forget pour ne pas
  // bloquer le boot — logge son propre bloc d'URL quand le tunnel est prêt.
  // S4 : démarre la boucle de check des mises à jour (5s + toutes les 6h).
  updater.startBackgroundChecks();

  remoteAccess.startIfConfigured(PORT)
    .then((url) => {
      if (!url) return;
      console.log('  ── Accès distant (Internet) ──────────────────────────────');
      console.log('   Contrôle   → ' + url + '/control');
      console.log('   Overlays   → ' + url + '/overlay  (etc.)');
      console.log('');
    })
    .catch((err) => {
      console.warn('[ngrok] autostart échec (mode LAN seulement) :', err && err.message || err);
    });
});
