const socket = io();
let currentState = null;

// ── Logo particules (thèmes custom) ──────────────────────────
const _lp = { parts: [], rafId: null, src: null, count: 3 };
const CUSTOM_THEMES = ['cyberpunk', 'synthwave', 'midnight', 'egypt', 'city', 'eco', 'water', 'fire',
  'pkpsy', 'pktenebres', 'pkelectrik', 'pkfee', 'pkspectre', 'pkdragon', 'pkglace', 'pkcombat',
  'pkpoison', 'pksol', 'pkvol', 'pkinsecte', 'pkroche', 'pkacier', 'pknormal', 'pkplante', 'pkfeu', 'pkeau',
  'rainbow', 'trans', 'pan', 'bi', 'lesbian', 'plage',
  'botw', 'totk', 'yoshiwool', 'mario64', 'minecraft', 'pacman', 'megaman', 'tekken', 'sf2',
  'custom',
  'smario','sdk','slink','ssamus','sdsamus','syoshi','skirby','sfox','spikachu','sluigi',
  'sness','sfalcon','sjigglypuff','speach','sdaisy','sbowser','siceclimbers','ssheik','szelda','sdrmario',
  'spichu','sfalco','smarth','slucina','sylink','sganondorf','smewtwo','sroy','schrom','sgamewatch',
  'smetaknight','spit','sdarkpit','szss','swario','ssnake','sike','spktrainer','sdiddy','slucas',
  'ssonic','sdedede','solimar','slucario','srob','stoonlink','swolf','svilager','smegaman','swiifit',
  'srosalina','slittlemac','sgreninja','spalutena','spacman','srobin','sshulk','sbowserjr','sduckhunt','sryu',
  'sken','scloud','scorrin','sbayonetta','sinkling','sridley','ssimon','srichter','skrool','sisabelle',
  'sincineroar','spiranha','sjoker','shero','sbanjo','sterry','sbyleth','sminmin','ssteve','ssephiroth',
  'spyra','smythra','skazuya','ssora','smii_brawl','smii_sword','smii_gun'];

function _lpSetCount(n) {
  const bg = document.getElementById('theme-logo-bg');
  // Remove excess
  while (_lp.parts.length > n) {
    const p = _lp.parts.pop();
    p.el.remove();
  }
  // Add missing
  while (_lp.parts.length < n) {
    const img = document.createElement('img');
    img.style.cssText = 'position:absolute;height:28px;width:auto;pointer-events:none;opacity:0.5;display:none;';
    bg.appendChild(img);
    _lp.parts.push({ el: img, x: 0, y: 0, vx: 0, vy: 0 });
  }
  _lp.count = n;
}

function _lpStart(src, count) {
  _lpSetCount(count);
  const bg = document.getElementById('theme-logo-bg');
  _lp.parts.forEach(p => {
    p.el.src = src;
    p.el.style.display = 'block';
    const W = bg.offsetWidth  || 600;
    const H = bg.offsetHeight || 80;
    p.x = Math.random() * W;
    p.y = Math.random() * H;
    const angle = Math.random() * Math.PI * 2;
    const spd   = 0.3 + Math.random() * 0.5;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
  });
  if (_lp.rafId) cancelAnimationFrame(_lp.rafId);
  (function tick() {
    const W = bg.offsetWidth;
    const H = bg.offsetHeight;
    _lp.parts.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      const iW = p.el.offsetWidth  || 40;
      const iH = p.el.offsetHeight || 28;
      if (p.x >  W + iW) p.x = -iW;
      if (p.x < -iW)     p.x =  W + iW;
      if (p.y >  H + iH) p.y = -iH;
      if (p.y < -iH)     p.y =  H + iH;
      p.el.style.left = p.x + 'px';
      p.el.style.top  = p.y + 'px';
    });
    _lp.rafId = requestAnimationFrame(tick);
  })();
}

function _lpStop() {
  if (_lp.rafId) { cancelAnimationFrame(_lp.rafId); _lp.rafId = null; }
  _lp.parts.forEach(p => { p.el.style.display = 'none'; });
}

const PS = createParticleSystem('particle-canvas', 'scoreboard');


// ── Couleurs de référence par thème personnage (pour le mode Dual) ─────────────
const CHAR_THEME_COLORS = {
  smario:      { primary:'#E52222', glow:'rgba(229,34,34,0.38)',    bg:'rgba(26,4,0,0.94)'    },
  sdk:         { primary:'#8B4513', glow:'rgba(139,69,19,0.38)',    bg:'rgba(12,6,0,0.94)'    },
  slink:       { primary:'#5BAD20', glow:'rgba(91,173,32,0.38)',    bg:'rgba(4,18,0,0.94)'    },
  ssamus:      { primary:'#FF6A00', glow:'rgba(255,106,0,0.38)',    bg:'rgba(18,6,0,0.94)'    },
  sdsamus:     { primary:'#9D00FF', glow:'rgba(157,0,255,0.38)',    bg:'rgba(10,0,20,0.94)'   },
  syoshi:      { primary:'#5DCB14', glow:'rgba(93,203,20,0.38)',    bg:'rgba(4,16,0,0.94)'    },
  skirby:      { primary:'#FF8CB4', glow:'rgba(255,140,180,0.38)',  bg:'rgba(20,4,12,0.94)'   },
  sfox:        { primary:'#CC5500', glow:'rgba(204,85,0,0.38)',     bg:'rgba(18,6,0,0.94)'    },
  spikachu:    { primary:'#FFD700', glow:'rgba(255,215,0,0.38)',    bg:'rgba(20,16,0,0.94)'   },
  sluigi:      { primary:'#2AA000', glow:'rgba(42,160,0,0.38)',     bg:'rgba(2,14,0,0.94)'    },
  sness:       { primary:'#CC1100', glow:'rgba(204,17,0,0.38)',     bg:'rgba(18,0,0,0.94)'    },
  sfalcon:     { primary:'#FF4400', glow:'rgba(255,68,0,0.38)',     bg:'rgba(20,4,0,0.94)'    },
  sjigglypuff: { primary:'#FF8CB4', glow:'rgba(255,140,180,0.38)',  bg:'rgba(20,4,12,0.94)'   },
  speach:      { primary:'#F9A8D4', glow:'rgba(249,168,212,0.38)',  bg:'rgba(20,4,14,0.94)'   },
  sdaisy:      { primary:'#FFD700', glow:'rgba(255,215,0,0.38)',    bg:'rgba(20,16,0,0.94)'   },
  sbowser:     { primary:'#009A00', glow:'rgba(0,154,0,0.38)',      bg:'rgba(0,14,0,0.94)'    },
  siceclimbers:{ primary:'#7AB8FF', glow:'rgba(122,184,255,0.38)',  bg:'rgba(4,10,20,0.94)'   },
  ssheik:      { primary:'#00A0C0', glow:'rgba(0,160,192,0.38)',    bg:'rgba(0,10,16,0.94)'   },
  szelda:      { primary:'#C080FF', glow:'rgba(192,128,255,0.38)',  bg:'rgba(10,4,20,0.94)'   },
  sdrmario:    { primary:'#E52222', glow:'rgba(229,34,34,0.38)',    bg:'rgba(26,4,0,0.94)'    },
  spichu:      { primary:'#FFD700', glow:'rgba(255,215,0,0.38)',    bg:'rgba(20,16,0,0.94)'   },
  sfalco:      { primary:'#0088CC', glow:'rgba(0,136,204,0.38)',    bg:'rgba(0,8,18,0.94)'    },
  smarth:      { primary:'#8855FF', glow:'rgba(136,85,255,0.38)',   bg:'rgba(8,4,20,0.94)'    },
  slucina:     { primary:'#CC6688', glow:'rgba(204,102,136,0.38)',  bg:'rgba(18,4,10,0.94)'   },
  sylink:      { primary:'#2A7040', glow:'rgba(42,112,64,0.38)',    bg:'rgba(2,10,4,0.94)'    },
  sganondorf:  { primary:'#6600AA', glow:'rgba(102,0,170,0.38)',    bg:'rgba(8,0,16,0.94)'    },
  smewtwo:     { primary:'#C070FF', glow:'rgba(192,112,255,0.38)',  bg:'rgba(12,4,20,0.94)'   },
  sroy:        { primary:'#FF3300', glow:'rgba(255,51,0,0.38)',     bg:'rgba(20,2,0,0.94)'    },
  schrom:      { primary:'#4488FF', glow:'rgba(68,136,255,0.38)',   bg:'rgba(2,6,20,0.94)'    },
  sgamewatch:  { primary:'#AAAAAA', glow:'rgba(170,170,170,0.28)',  bg:'rgba(4,4,4,0.94)'     },
  smetaknight: { primary:'#4466BB', glow:'rgba(68,102,187,0.38)',   bg:'rgba(2,4,16,0.94)'    },
  spit:        { primary:'#AACC55', glow:'rgba(170,204,85,0.38)',   bg:'rgba(10,14,2,0.94)'   },
  sdarkpit:    { primary:'#6688AA', glow:'rgba(102,136,170,0.38)',  bg:'rgba(4,6,12,0.94)'    },
  szss:        { primary:'#CC66FF', glow:'rgba(204,102,255,0.38)',  bg:'rgba(14,4,20,0.94)'   },
  swario:      { primary:'#DDAA00', glow:'rgba(221,170,0,0.38)',    bg:'rgba(16,12,0,0.94)'   },
  ssnake:      { primary:'#448822', glow:'rgba(68,136,34,0.38)',    bg:'rgba(4,10,2,0.94)'    },
  sike:        { primary:'#0066CC', glow:'rgba(0,102,204,0.38)',    bg:'rgba(0,6,18,0.94)'    },
  spktrainer:  { primary:'#CC3300', glow:'rgba(204,51,0,0.38)',     bg:'rgba(18,2,0,0.94)'    },
  sdiddy:      { primary:'#BB5500', glow:'rgba(187,85,0,0.38)',     bg:'rgba(16,6,0,0.94)'    },
  slucas:      { primary:'#CC8833', glow:'rgba(204,136,51,0.38)',   bg:'rgba(18,8,2,0.94)'    },
  ssonic:      { primary:'#1A6BFF', glow:'rgba(26,107,255,0.38)',   bg:'rgba(0,4,20,0.94)'    },
  sdedede:     { primary:'#CC0055', glow:'rgba(204,0,85,0.38)',     bg:'rgba(16,0,6,0.94)'    },
  solimar:     { primary:'#DDAA00', glow:'rgba(221,170,0,0.38)',    bg:'rgba(18,12,0,0.94)'   },
  slucario:    { primary:'#4488CC', glow:'rgba(68,136,204,0.38)',   bg:'rgba(2,6,18,0.94)'    },
  srob:        { primary:'#AAAAAA', glow:'rgba(170,170,170,0.28)',  bg:'rgba(10,10,10,0.94)'  },
  stoonlink:   { primary:'#55AA22', glow:'rgba(85,170,34,0.38)',    bg:'rgba(4,12,2,0.94)'    },
  swolf:       { primary:'#6688AA', glow:'rgba(102,136,170,0.38)',  bg:'rgba(4,8,14,0.94)'    },
  svilager:    { primary:'#88CC44', glow:'rgba(136,204,68,0.38)',   bg:'rgba(8,14,2,0.94)'    },
  smegaman:    { primary:'#0099DD', glow:'rgba(0,153,221,0.38)',    bg:'rgba(0,10,18,0.94)'   },
  swiifit:     { primary:'#AADDAA', glow:'rgba(170,221,170,0.28)',  bg:'rgba(10,16,10,0.94)'  },
  srosalina:   { primary:'#88AAFF', glow:'rgba(136,170,255,0.38)',  bg:'rgba(6,8,20,0.94)'    },
  slittlemac:  { primary:'#FF8822', glow:'rgba(255,136,34,0.38)',   bg:'rgba(20,8,2,0.94)'    },
  sgreninja:   { primary:'#2266AA', glow:'rgba(34,102,170,0.38)',   bg:'rgba(2,6,16,0.94)'    },
  spalutena:   { primary:'#CCAAFF', glow:'rgba(204,170,255,0.38)',  bg:'rgba(16,12,20,0.94)'  },
  spacman:     { primary:'#FFDD00', glow:'rgba(255,221,0,0.38)',    bg:'rgba(20,18,0,0.94)'   },
  srobin:      { primary:'#CC5500', glow:'rgba(204,85,0,0.38)',     bg:'rgba(16,6,0,0.94)'    },
  sshulk:      { primary:'#CCAA55', glow:'rgba(204,170,85,0.38)',   bg:'rgba(18,16,4,0.94)'   },
  sbowserjr:   { primary:'#DD9900', glow:'rgba(221,153,0,0.38)',    bg:'rgba(18,12,0,0.94)'   },
  sduckhunt:   { primary:'#886644', glow:'rgba(136,102,68,0.38)',   bg:'rgba(12,8,4,0.94)'    },
  sryu:        { primary:'#FFFFFF', glow:'rgba(255,255,255,0.22)',  bg:'rgba(6,6,10,0.94)'    },
  sken:        { primary:'#FF6600', glow:'rgba(255,102,0,0.38)',    bg:'rgba(20,6,0,0.94)'    },
  scloud:      { primary:'#6699CC', glow:'rgba(102,153,204,0.38)',  bg:'rgba(4,8,16,0.94)'    },
  scorrin:     { primary:'#CC7755', glow:'rgba(204,119,85,0.38)',   bg:'rgba(18,10,6,0.94)'   },
  sbayonetta:  { primary:'#8888CC', glow:'rgba(136,136,204,0.38)',  bg:'rgba(6,6,14,0.94)'    },
  sinkling:    { primary:'#FF4499', glow:'rgba(255,68,153,0.38)',   bg:'rgba(20,2,12,0.94)'   },
  sridley:     { primary:'#8844AA', glow:'rgba(136,68,170,0.38)',   bg:'rgba(10,2,14,0.94)'   },
  ssimon:      { primary:'#CC8844', glow:'rgba(204,136,68,0.38)',   bg:'rgba(18,12,4,0.94)'   },
  srichter:    { primary:'#997744', glow:'rgba(153,119,68,0.38)',   bg:'rgba(14,10,4,0.94)'   },
  skrool:      { primary:'#AA6600', glow:'rgba(170,102,0,0.38)',    bg:'rgba(16,8,0,0.94)'    },
  sisabelle:   { primary:'#FFCC44', glow:'rgba(255,204,68,0.38)',   bg:'rgba(20,18,2,0.94)'   },
  sincineroar: { primary:'#CC3366', glow:'rgba(204,51,102,0.38)',   bg:'rgba(18,2,8,0.94)'    },
  spiranha:    { primary:'#33BB33', glow:'rgba(51,187,51,0.38)',    bg:'rgba(2,16,2,0.94)'    },
  sjoker:      { primary:'#DD0000', glow:'rgba(221,0,0,0.38)',      bg:'rgba(18,0,0,0.94)'    },
  shero:       { primary:'#4455CC', glow:'rgba(68,85,204,0.38)',    bg:'rgba(2,4,18,0.94)'    },
  sbanjo:      { primary:'#CC9933', glow:'rgba(204,153,51,0.38)',   bg:'rgba(18,14,2,0.94)'   },
  sterry:      { primary:'#FF3300', glow:'rgba(255,51,0,0.38)',     bg:'rgba(20,2,0,0.94)'    },
  sbyleth:     { primary:'#996633', glow:'rgba(153,102,51,0.38)',   bg:'rgba(14,8,4,0.94)'    },
  sminmin:     { primary:'#FF6688', glow:'rgba(255,102,136,0.38)',  bg:'rgba(20,6,10,0.94)'   },
  ssteve:      { primary:'#887766', glow:'rgba(136,119,102,0.38)',  bg:'rgba(10,8,6,0.94)'    },
  ssephiroth:  { primary:'#AAAAFF', glow:'rgba(170,170,255,0.38)',  bg:'rgba(8,8,20,0.94)'    },
  spyra:       { primary:'#FF9900', glow:'rgba(255,153,0,0.38)',    bg:'rgba(20,14,0,0.94)'   },
  smythra:     { primary:'#FF5500', glow:'rgba(255,85,0,0.38)',     bg:'rgba(20,4,0,0.94)'    },
  skazuya:     { primary:'#5500CC', glow:'rgba(85,0,204,0.38)',     bg:'rgba(6,0,18,0.94)'    },
  ssora:       { primary:'#4477FF', glow:'rgba(68,119,255,0.38)',   bg:'rgba(2,4,20,0.94)'    },
  smii_brawl:  { primary:'#AA4400', glow:'rgba(170,68,0,0.38)',     bg:'rgba(16,4,0,0.94)'    },
  smii_sword:  { primary:'#7799BB', glow:'rgba(119,153,187,0.38)',  bg:'rgba(6,8,14,0.94)'    },
  smii_gun:    { primary:'#448866', glow:'rgba(68,136,102,0.38)',   bg:'rgba(2,10,6,0.94)'    },
  default:     { primary:'#888888', glow:'rgba(136,136,136,0.22)',  bg:'rgba(10,10,14,0.94)'  },
};


function renderPlayerName(elId, player) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  if (player.seeding != null) {
    const seed = document.createElement('span');
    seed.className = 'player-seed';
    seed.textContent = '#' + player.seeding;
    el.appendChild(seed);
  }
  if (player.tag) {
    const tag = document.createElement('span');
    tag.className = 'player-tag';
    tag.textContent = player.tag;
    el.appendChild(tag);
  }
  const name = document.createElement('span');
  name.className = 'player-name-text';
  name.textContent = player.name;
  el.appendChild(name);
  if (player.pronouns) {
    const pro = document.createElement('span');
    pro.className = 'player-pronouns';
    pro.textContent = player.pronouns;
    el.appendChild(pro);
  }
}

// ── Custom theme application ──────────────────────────────────────────────

function applyCustomTheme(ct, sb) {
  const defaults = {
    bgType: 'gradient', bgColor1: '#0E0E12', bgColor2: '#16161E', bgAngle: 135,
    accentColor: '#E8B830', p1Color: '#E83030', p2Color: '#3070E8',
    nameColor: '#F0EEF8', tagColor: '#E8B830', pronounsColor: '#5A5A7A',
    scoreColor: '#F0EEF8', eventColor: '#5A5A7A', scoreSepColor: '#E8B830',
    neonEnabled: false, neonColor: '#E8B830', neonIntensity: 8,
    neonName: true, neonScore: true, neonTag: false, neonEvent: false, neonAccent: true,
    fontFamily: 'Russo One', letterSpacing: 2, nameFontSize: 24,
    particleType: 'sparkle', particleCount: 60,
    coverImage: null, coverOpacity: 50, coverMode: 'cover',
  };
  const c = { ...defaults, ...ct };

  // ── Google Fonts dynamic loading ─────────────────────────────
  const builtinFonts = ['Russo One'];
  if (!builtinFonts.includes(c.fontFamily)) {
    let gfLink = document.getElementById('pso-gfont');
    const fontParam = c.fontFamily.replace(/ /g, '+');
    const gfUrl = `https://fonts.googleapis.com/css2?family=${fontParam}:wght@400;700&display=swap`;
    if (!gfLink) {
      gfLink = document.createElement('link');
      gfLink.id = 'pso-gfont';
      gfLink.rel = 'stylesheet';
      document.head.appendChild(gfLink);
    }
    if (gfLink.href !== gfUrl) gfLink.href = gfUrl;
  }

  // ── CSS vars on scoreboard element ───────────────────────────
  // Background
  let bgValue;
  if (c.bgType === 'transparent' || c.bgType === 'texture') {
    bgValue = 'transparent';
  } else if (c.bgType === 'gradient') {
    bgValue = `linear-gradient(${c.bgAngle}deg, ${c.bgColor1}, ${c.bgColor2})`;
  } else {
    bgValue = c.bgColor1;
  }
  sb.style.setProperty('--sb-bg', bgValue);
  sb.style.setProperty('--name-color',      c.nameColor);
  sb.style.setProperty('--tag-color',       c.tagColor);
  sb.style.setProperty('--pronouns-color',  c.pronounsColor);
  sb.style.setProperty('--event-text-color',c.eventColor);
  sb.style.setProperty('--score-color',     c.scoreColor);
  sb.style.setProperty('--smash-gold',      c.scoreSepColor);
  sb.style.setProperty('--custom-font',     `'${c.fontFamily}'`);

  // ── Player accent colors ─────────────────────────────────────
  const p1Block = document.getElementById('player1-block');
  const p2Block = document.getElementById('player2-block');
  const p1BlockSlim = document.getElementById('player1-block-slim');
  const p2BlockSlim = document.getElementById('player2-block-slim');
  if (p1Block) p1Block.style.setProperty('--p1-color', c.p1Color);
  if (p2Block) p2Block.style.setProperty('--p2-color', c.p2Color);
  if (p1BlockSlim) p1BlockSlim.style.setProperty('--p1-color', c.p1Color);
  if (p2BlockSlim) p2BlockSlim.style.setProperty('--p2-color', c.p2Color);

  // ── Dynamic CSS (neon, cover image) ─────────────────────────
  let styleEl = document.getElementById('pso-custom-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'pso-custom-theme';
    document.head.appendChild(styleEl);
  }

  const n   = c.neonEnabled ? c.neonIntensity : 0;
  const nc  = c.neonColor;
  const acc = c.accentColor;

  let css = '';

  // Letter spacing & font size for player names
  css += `.scoreboard.theme-custom .player-name { letter-spacing: ${c.letterSpacing}px; font-size: ${c.nameFontSize}px; }\n`;
  css += `.scoreboard.theme-custom .score-vs { color: ${c.scoreSepColor}; }\n`;

  // Neon effects
  if (c.neonEnabled) {
    if (c.neonName) {
      css += `.scoreboard.theme-custom .player-name-text { text-shadow: 0 0 ${n}px ${nc}, 0 0 ${n*2}px ${nc}, 0 0 ${n*3}px ${nc}; }\n`;
    } else {
      css += `.scoreboard.theme-custom .player-name-text { text-shadow: none; }\n`;
    }
    if (c.neonScore) {
      css += `.scoreboard.theme-custom .score { text-shadow: 0 0 ${n}px ${nc}, 0 0 ${n*2}px ${nc}; }\n`;
      css += `.scoreboard.theme-custom .score-vs { text-shadow: 0 0 ${n}px ${nc}, 0 0 ${n*2}px ${nc}; }\n`;
    } else {
      css += `.scoreboard.theme-custom .score { text-shadow: none; }\n`;
    }
    if (c.neonTag) {
      css += `.scoreboard.theme-custom .player-tag { text-shadow: 0 0 ${n}px ${nc}; }\n`;
    } else {
      css += `.scoreboard.theme-custom .player-tag { text-shadow: none; }\n`;
    }
    if (c.neonEvent) {
      css += `.scoreboard.theme-custom .event-bar { text-shadow: 0 0 ${n}px ${nc}; }\n`;
    } else {
      css += `.scoreboard.theme-custom .event-bar { text-shadow: none; }\n`;
    }
    if (c.neonAccent) {
      css += `.scoreboard.theme-custom .players-container { border-color: ${acc}; box-shadow: 0 0 ${n}px ${acc}, inset 0 0 ${n}px ${acc}; }\n`;
    }
  } else {
    css += `.scoreboard.theme-custom .player-name-text { text-shadow: none; }\n`;
    css += `.scoreboard.theme-custom .score { text-shadow: none; }\n`;
    css += `.scoreboard.theme-custom .player-tag { text-shadow: none; }\n`;
    css += `.scoreboard.theme-custom .event-bar { text-shadow: none; }\n`;
  }

  // Texture background
  if (c.bgType === 'texture' && c.bgTexture) {
    const op = (c.bgTextureOpacity ?? 80) / 100;
    const sz = c.bgTextureSize === 'repeat' ? 'auto' : (c.bgTextureSize || 'cover');
    const rp = c.bgTextureSize === 'repeat' ? 'repeat' : 'no-repeat';
    css += `.scoreboard.theme-custom { position: relative; }\n`;
    css += `.scoreboard.theme-custom::before { content: ''; position: absolute; inset: 0; background: url('${c.bgTexture}') center / ${sz} ${rp}; opacity: ${op}; pointer-events: none; z-index: 0; border-radius: inherit; }\n`;
  } else {
    css += `.scoreboard.theme-custom::before { content: none; }\n`;
  }

  // Cover image overlay
  if (c.coverImage && c.bgType !== 'transparent') {
    const op = (c.coverOpacity ?? 50) / 100;
    const mode = c.coverMode || 'cover';
    css += `.scoreboard.theme-custom .players-container { position: relative; overflow: hidden; }\n`;
    css += `.scoreboard.theme-custom .players-container::before { content: ''; position: absolute; inset: 0; background: url('${c.coverImage}') center / ${mode} no-repeat; opacity: ${op}; pointer-events: none; z-index: 0; }\n`;
  } else {
    css += `.scoreboard.theme-custom .players-container::before { content: none; }\n`;
  }

  styleEl.textContent = css;
}

function getFormatMax(fmt, custom) {
  if (fmt === 'Bo1') return 1;
  if (fmt === 'Bo3') return 3;
  if (fmt === 'Bo5') return 5;
  // format custom = texte libre : on récupère un nombre s'il y en a un (ex "FT5"→5), sinon défaut
  const m = String(custom == null ? '' : custom).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function renderDots(containerId, score, totalGames, color) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const winsNeeded = Math.ceil(totalGames / 2);
  el.innerHTML = '';
  for (let i = 0; i < winsNeeded; i++) {
    const dot = document.createElement('div');
    dot.className = 'win-dot' + (i < score ? ' filled' : '');
    dot.style.setProperty('--dot-color', color);
    el.appendChild(dot);
  }
}

// ── Lower-third : carousel réseaux sociaux ──────────────────────
const _ltCarousel = { p1: { idx: 0, timer: null, socials: [] }, p2: { idx: 0, timer: null, socials: [] } };

function _ltSetSocial(player, textEl) {
  const c = _ltCarousel[player];
  const active = c.socials.filter(s => s.trim());
  if (!active.length) { textEl.textContent = ''; return; }
  const text = active[c.idx % active.length];
  textEl.classList.add('fading');
  setTimeout(() => {
    textEl.textContent = text;
    textEl.classList.remove('fading');
  }, 400);
}

function _ltStartCarousel(player, socials, textEl) {
  const c = _ltCarousel[player];
  clearInterval(c.timer);
  c.socials = socials || [];
  c.idx = 0;
  const active = c.socials.filter(s => s.trim());
  if (!active.length) { textEl.textContent = ''; return; }
  textEl.textContent = active[0];
  if (active.length > 1) {
    c.timer = setInterval(() => {
      c.idx = (c.idx + 1) % active.length;
      _ltSetSocial(player, textEl);
    }, 4000);
  }
}

function _ltSetFlag(imgEl, codeEl, boxEl, flagPath) {
  if (flagPath) {
    imgEl.src = '/' + flagPath;
    imgEl.style.display = 'block';
    const code = flagPath.replace(/^flags\//, '').replace(/\.[^.]+$/, '');
    codeEl.textContent = code;
    boxEl.style.display = '';
  } else {
    imgEl.style.display = 'none';
    codeEl.textContent = '';
    boxEl.style.display = 'none';
  }
}

function _ltUpdate(s) {
  const p1 = s.player1;
  const p2 = s.player2;

  // Player 1
  document.getElementById('lt-p1-name').textContent  = p1.name || 'PLAYER 1';
  document.getElementById('lt-p1-tag').textContent   = p1.tag  || '';
  document.getElementById('lt-p1-score').textContent = p1.score ?? 0;
  const ltP1Pron = document.getElementById('lt-p1-pronouns');
  if (ltP1Pron) ltP1Pron.textContent = p1.pronouns || '';
  _ltSetFlag(
    document.getElementById('lt-p1-flag-img'),
    document.getElementById('lt-p1-flag-code'),
    document.getElementById('lt-p1-flag-box'),
    p1.flag
  );
  document.getElementById('lt-p1').style.setProperty('--p1-color', p1.color || '#E83030');
  _ltStartCarousel('p1', p1.socials || [], document.getElementById('lt-p1-social-text'));

  // Player 2
  document.getElementById('lt-p2-name').textContent  = p2.name || 'PLAYER 2';
  document.getElementById('lt-p2-tag').textContent   = p2.tag  || '';
  document.getElementById('lt-p2-score').textContent = p2.score ?? 0;
  const ltP2Pron = document.getElementById('lt-p2-pronouns');
  if (ltP2Pron) ltP2Pron.textContent = p2.pronouns || '';
  _ltSetFlag(
    document.getElementById('lt-p2-flag-img'),
    document.getElementById('lt-p2-flag-code'),
    document.getElementById('lt-p2-flag-box'),
    p2.flag
  );
  document.getElementById('lt-p2').style.setProperty('--p2-color', p2.color || '#3070E8');
  _ltStartCarousel('p2', p2.socials || [], document.getElementById('lt-p2-social-text'));
}

function update(s) {
  const prev = currentState;

  const sb = document.getElementById('scoreboard');
  const isTransparent = (s.overlayTheme || 'default') === 'transparent';
  sb.classList.toggle('hidden', !s.visible);
  // swapped est géré côté données (player1/player2 physiquement échangés)
  const _style = s.overlayStyle || 'full';
  ['slim', 'full-rounded', 'compact-rounded', 'lower-third'].forEach(st => {
    sb.classList.toggle('style-' + st, _style === st);
  });
  const _scoreDisplay = s.scoreDisplay || 'numbers';
  ['numbers', 'dots'].forEach(d => {
    sb.classList.toggle('score-display-' + d, _scoreDisplay === d);
  });
  // Position 9-points (top/middle/bottom × left/center/right) + legacy 'top'/'bottom'
  const _ebPos = s.eventBarPosition === 'top' ? 'top-center'
              : s.eventBarPosition === 'bottom' ? 'bottom-center'
              : (s.eventBarPosition || 'top-center');
  const _ebRow = _ebPos.split('-')[0];
  sb.classList.toggle('event-bar-bottom', _ebRow === 'bottom');
  document.querySelectorAll('.event-bar').forEach(b => { b.dataset.anchor = _ebPos; });

  // Theme class
  ['default', 'cyberpunk', 'synthwave', 'midnight', 'egypt', 'city', 'eco', 'water', 'fire',
   'pkpsy', 'pktenebres', 'pkelectrik', 'pkfee', 'pkspectre', 'pkdragon', 'pkglace', 'pkcombat',
   'pkpoison', 'pksol', 'pkvol', 'pkinsecte', 'pkroche', 'pkacier', 'pknormal', 'pkplante', 'pkfeu', 'pkeau',
   'rainbow', 'trans', 'pan', 'bi', 'lesbian', 'plage',
   'botw', 'totk', 'yoshiwool', 'mario64', 'minecraft', 'pacman', 'megaman', 'tekken', 'sf2',
   'smario','sdk','slink','ssamus','sdsamus','syoshi','skirby','sfox','spikachu','sluigi',
   'sness','sfalcon','sjigglypuff','speach','sdaisy','sbowser','siceclimbers','ssheik','szelda','sdrmario',
   'spichu','sfalco','smarth','slucina','sylink','sganondorf','smewtwo','sroy','schrom','sgamewatch',
   'smetaknight','spit','sdarkpit','szss','swario','ssnake','sike','spktrainer','sdiddy','slucas',
   'ssonic','sdedede','solimar','slucario','srob','stoonlink','swolf','svilager','smegaman','swiifit',
   'srosalina','slittlemac','sgreninja','spalutena','spacman','srobin','sshulk','sbowserjr','sduckhunt','sryu',
   'sken','scloud','scorrin','sbayonetta','sinkling','sridley','ssimon','srichter','skrool','sisabelle',
   'sincineroar','spiranha','sjoker','shero','sbanjo','sterry','sbyleth','sminmin','ssteve','ssephiroth',
   'spyra','smythra','skazuya','ssora','smii_brawl','smii_sword','smii_gun',
   'dual','transparent','custom'].forEach(t => {
    sb.classList.toggle('theme-' + t, (s.overlayTheme || 'default') === t);
  });

  // ── Dual character theme — CSS vars ─────────────────────────
  const isDual = (s.overlayTheme || 'default') === 'dual';
  if (isDual) {
    const kA = s.player1.character?.id ? 's' + s.player1.character.id : 'default';
    const kB = s.player2.character?.id ? 's' + s.player2.character.id : 'default';
    const kLeft  = kA;
    const kRight = kB;
    const cLeft  = CHAR_THEME_COLORS[kLeft]  || CHAR_THEME_COLORS.default;
    const cRight = CHAR_THEME_COLORS[kRight] || CHAR_THEME_COLORS.default;
    sb.style.setProperty('--p1-theme-primary', cLeft.primary);
    sb.style.setProperty('--p1-theme-glow',    cLeft.glow);
    sb.style.setProperty('--p1-theme-bg',      cLeft.bg);
    sb.style.setProperty('--p2-theme-primary', cRight.primary);
    sb.style.setProperty('--p2-theme-glow',    cRight.glow);
    sb.style.setProperty('--p2-theme-bg',      cRight.bg);
  }

  // ── Custom theme ─────────────────────────────────────────────
  if ((s.overlayTheme || 'default') === 'custom') {
    applyCustomTheme(s.customTheme || {}, sb);
  } else {
    const oldStyle = document.getElementById('pso-custom-theme');
    if (oldStyle) oldStyle.remove();
    // Reset custom CSS vars that may have been set
    sb.style.removeProperty('--score-color');
    sb.style.removeProperty('--custom-font');
    sb.style.removeProperty('--smash-gold');
  }

  // Logo particules
  const isCustomTheme = CUSTOM_THEMES.includes(s.overlayTheme || 'default');
  const lpCount = Math.min(100, Math.max(1, s.logoParticleCount || 3));
  if (isCustomTheme && s.centerLogo && !s.centerLogoHidden) {
    if (_lp.src !== s.centerLogo || _lp.count !== lpCount || !_lp.rafId) {
      _lp.src = s.centerLogo;
      _lpStart(s.centerLogo, lpCount);
    }
  } else {
    _lp.src = null;
    _lpStop();
  }

  // Canvas particules
  if (s.particlesEnabled === false) {
    if (PS.type) PS.stop();
  } else if (isDual) {
    const kA = s.player1.character?.id ? 's' + s.player1.character.id : 'default';
    const kB = s.player2.character?.id ? 's' + s.player2.character.id : 'default';
    const kLeft  = kA;
    const kRight = kB;
    const tpLeft  = THEME_PARTICLES[kLeft];
    const tpRight = THEME_PARTICLES[kRight];
    const typeLeft   = tpLeft?.type   || 'sparkle';
    const countLeft  = Math.round((tpLeft?.count  || 40) * 0.55);
    const typeRight  = tpRight?.type  || 'sparkle';
    const countRight = Math.round((tpRight?.count || 40) * 0.55);
    const key = `${typeLeft}|${countLeft}|${typeRight}|${countRight}`;
    if (PS.type !== '__dual__' || PS.dualKey !== key) {
      PS.startDual(typeLeft, countLeft, typeRight, countRight);
    }
  } else if ((s.overlayTheme || 'default') === 'custom') {
    const ct = s.customTheme || {};
    const pType  = ct.particleType  || 'sparkle';
    const pCount = ct.particleCount || 60;
    if (pType !== PS.type) PS.start(pType, pCount);
  } else {
    const tpConf = THEME_PARTICLES[s.overlayTheme || 'default'];
    if (tpConf) {
      if (tpConf.type !== PS.type) PS.start(tpConf.type, tpConf.count);
    } else if (PS.type) {
      PS.stop();
    }
  }

  // Background color + opacity (+ Lot 4 : dégradé G→D optionnel)
  const hex = (s.sbBgColor || '#0E0E12').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const a = (s.sbBgOpacity ?? 100) / 100;
  let sbBgValue = `rgba(${r},${g},${b},${a})`;
  if (s.sbBgColor2 && s.sbBgColor2 !== s.sbBgColor) {
    const hex2 = s.sbBgColor2.replace('#', '');
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    sbBgValue = `linear-gradient(to right, rgba(${r},${g},${b},${a}), rgba(${r2},${g2},${b2},${a}))`;
  }
  // Image de fond du scoreboard — si définie, remplace couleur/dégradé.
  // Posée par-dessus la couleur (qui sert de fallback si l'image a de la
  // transparence / ne charge pas). Ajustement + opacité réglables.
  if (s.sbBgImage) {
    document.body.classList.add('sb-has-bg-image');
    sb.style.setProperty('--sb-bg-blend', s.sbBgImageBlend || 'normal');
    const fit = s.sbBgImageFit || 'cover';
    // repeat → mosaïque à taille native ; sinon image unique (cover/contain/étirer).
    let imgLayer;
    if (fit === 'repeat') {
      imgLayer = `url('${s.sbBgImage}') top left / auto repeat`;
    } else {
      const sizeCSS = fit === 'stretch' ? '100% 100%' : fit; // cover | contain | 100% 100%
      imgLayer = `url('${s.sbBgImage}') center / ${sizeCSS} no-repeat`;
    }
    const imgOp = (s.sbBgImageOpacity ?? 100) / 100;
    if (imgOp >= 1) {
      sbBgValue = `${imgLayer}, ${sbBgValue}`;
    } else {
      // Pas d'opacité par-couche en CSS : on voile l'image avec la couleur de
      // fond à (1 - opacité) posée par-dessus, ce qui la fait fondre vers le fond.
      const veilA = (1 - imgOp) * a;
      const veil = `linear-gradient(rgba(${r},${g},${b},${veilA}), rgba(${r},${g},${b},${veilA}))`;
      sbBgValue = `${veil}, ${imgLayer}, ${sbBgValue}`;
    }
    // Adapter le bloc à l'image (proportions) — aspect-ratio = largeur/hauteur native.
    if (s.sbBgImageAdapt && s.sbBgImageW && s.sbBgImageH) {
      document.body.classList.add('sb-bg-adapt');
      sb.style.setProperty('--sb-bg-ar', (s.sbBgImageW / s.sbBgImageH).toFixed(4));
    } else {
      document.body.classList.remove('sb-bg-adapt');
    }
  } else {
    document.body.classList.remove('sb-bg-adapt');
    document.body.classList.remove('sb-has-bg-image');
    sb.style.setProperty('--sb-bg-blend', 'normal');
  }
  sb.style.setProperty('--sb-bg', sbBgValue);

  // Particule opacity & count scale
  const pOp = (s.particleOpacity ?? 100) / 100;
  if (PS.opacity !== pOp) PS.setOpacity(pOp);
  const pScale = (s.particleCountScale ?? 100) / 100;
  if (Math.abs(PS.countScale - pScale) > 0.001) PS.setCountScale(pScale);

  sb.style.setProperty('--sb-scale', (s.sbScale ?? 100) / 100);
  sb.style.setProperty('--sb-x', (s.sbX ?? 0) + 'px');
  sb.style.setProperty('--sb-y', (s.sbY ?? 0) + 'px');

  // Alignement vertical des noms/tags dans les cartes (haut / milieu / bas).
  const valignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
  sb.style.setProperty('--sb-valign', valignMap[s.sbNameAlign] || 'center');
  sb.style.setProperty('--sb-name-x', (s.sbNameX ?? 0) + 'px');
  sb.style.setProperty('--sb-name-y', (s.sbNameY ?? 0) + 'px');

  // Lot 2 : logo central enrichi + écart entre cartes (Customisation > Scoreboard).
  sb.style.setProperty('--center-logo-size',           (s.centerLogoSize ?? 52) + 'px');
  sb.style.setProperty('--center-logo-offset-y',       (s.centerLogoOffsetY ?? 0) + 'px');
  sb.style.setProperty('--center-logo-opacity',        (s.centerLogoOpacity ?? 100) / 100);
  sb.style.setProperty('--center-logo-glow-color',     s.centerLogoGlowColor || 'transparent');
  sb.style.setProperty('--center-logo-glow-intensity', (s.centerLogoGlowIntensity ?? 0) + 'px');
  sb.style.setProperty('--players-gap',                (s.playersGap ?? 0) + 'px');
  // Forme du logo central — classe body sb-logo-shape-<id>
  const shape = ['none','circle','square','hex'].includes(s.centerLogoShape) ? s.centerLogoShape : 'none';
  document.body.classList.forEach(c => { if (c.startsWith('sb-logo-shape-')) document.body.classList.remove(c); });
  if (shape !== 'none') document.body.classList.add('sb-logo-shape-' + shape);

  // Lot 3 : géométrie des cartes joueur (Customisation > Scoreboard).
  sb.style.setProperty('--player-min-width',     (s.playerCardMinWidth ?? 320) + 'px');
  const sbHeight = parseInt(s.scoreboardHeight ?? 0);
  sb.style.setProperty('--sb-height',            sbHeight > 0 ? (sbHeight + 'px') : 'auto');
  sb.style.setProperty('--player-card-radius',   (s.playerCardRadius ?? 0) + 'px');
  // Contour du scoreboard (carte « Contour »)
  sb.style.setProperty('--sb-border-color', s.sbBorderColor || '#2A2A3E');
  sb.style.setProperty('--sb-border-width', (s.sbBorderWidth ?? 1) + 'px');
  sb.style.setProperty('--sb-border-style', ['solid','dashed','dotted','double'].includes(s.sbBorderStyle) ? s.sbBorderStyle : 'solid');
  // Contour à 0 → efface aussi les bordures d'accent (couleur joueur sous
  // les cartes, portrait, dots, barre événement) via body.sb-no-border.
  document.body.classList.toggle('sb-no-border', parseInt(s.sbBorderWidth ?? 1) === 0);
  // Position du contour — Interne (border) / Milieu / Externe (outline + offset)
  const _bw = parseInt(s.sbBorderWidth ?? 1);
  const _bpos = ['inside','center','outside'].includes(s.sbBorderPosition) ? s.sbBorderPosition : 'inside';
  document.body.classList.toggle('sb-border-pos-center',  _bpos === 'center');
  document.body.classList.toggle('sb-border-pos-outside', _bpos === 'outside');
  // Milieu = outline à cheval (offset = -moitié de l'épaisseur) ; Externe = 0.
  sb.style.setProperty('--sb-border-offset', (_bpos === 'center' ? -_bw / 2 : 0) + 'px');
  // Forme des cartes joueur — clip-path trapèze / parallélogramme via body class + var.
  // Skew négatif = sens inversé : on flip la forme vers son opposé et on prend l'abs.
  // Trapezoid ↔ trapezoid-out, parallelogram ↔ parallelogram-rev. Permet à l'utilisateur
  // de tester les 2 directions sans avoir à changer manuellement le select Forme.
  let _shapeVal = ['trapezoid','trapezoid-out','parallelogram','parallelogram-rev'].includes(s.playerCardShape) ? s.playerCardShape : '';
  let _skewVal  = parseInt(s.playerCardSkew ?? 20);
  if (_skewVal < 0 && _shapeVal) {
    const _flip = { trapezoid:'trapezoid-out', 'trapezoid-out':'trapezoid', parallelogram:'parallelogram-rev', 'parallelogram-rev':'parallelogram' };
    _shapeVal = _flip[_shapeVal] || _shapeVal;
    _skewVal  = Math.abs(_skewVal);
  }
  document.body.style.setProperty('--player-card-skew', _skewVal + 'px');
  ['trapezoid','trapezoid-out','parallelogram','parallelogram-rev'].forEach(sh => {
    document.body.classList.toggle('sb-shape-' + sh, _shapeVal === sh);
  });
  sb.style.setProperty('--player-card-padding',  (s.playerCardPadding ?? 0) + 'px');
  sb.style.setProperty('--sb-shadow-intensity',  (s.sbShadowIntensity ?? 32) + 'px');
  sb.style.setProperty('--sb-shadow-color',      s.sbShadowColor || 'rgba(0,0,0,0.8)');
  // Ombre portée du scoreboard — chaîne de drop-shadow façon Photoshop.
  // Spread émulé en stackant N drop-shadows à 8 directions autour du
  // point de base, comme l'ombre de la barre événement.
  // Valeur OFF = un drop-shadow TRANSPARENT (no-op visible) plutôt que
  // 'none'. Raison : la règle .scoreboard.hidden compose le filtre avec
  // « blur(4px) ». « none blur(4px) » est invalide → le navigateur
  // ignorait la déclaration et retombait sur le fallback (= une vraie
  // ombre visible le temps de la transition d'apparition). Un drop-shadow
  // transparent compose proprement avec blur() et ne rend rien.
  let _sbShadowFilter = 'drop-shadow(0px 0px 0px rgba(0,0,0,0))';
  let _sbShadowBlendMode = 'normal';
  if (s.sbShadowOn !== false) {
    const _sbHex = (s.sbShadowColor || '#000000').replace('#', '').replace(/rgba?\(.*/, '');
    const _hex6 = /^[0-9a-f]{6}$/i.test(_sbHex) ? _sbHex : '000000';
    const _sbRad = (s.sbShadowAngle ?? 270) * Math.PI / 180;
    const _sbDist = parseInt(s.sbShadowDistance ?? 4);
    const _sbBx = -Math.cos(_sbRad) * _sbDist;
    const _sbBy = -Math.sin(_sbRad) * _sbDist;
    const _sbBlur = parseInt(s.sbShadowIntensity ?? 32);
    const _sbSpread = Math.max(0, Math.min(10, parseInt(s.sbShadowSpread ?? 0)));
    const _sbR = parseInt(_hex6.substring(0, 2), 16);
    const _sbG = parseInt(_hex6.substring(2, 4), 16);
    const _sbB = parseInt(_hex6.substring(4, 6), 16);
    const _sbA = (s.sbShadowOpacity ?? 80) / 100;
    const _sbCol = `rgba(${_sbR},${_sbG},${_sbB},${_sbA})`;
    const _sbLayers = [`drop-shadow(${_sbBx.toFixed(1)}px ${_sbBy.toFixed(1)}px ${_sbBlur}px ${_sbCol})`];
    // Spread : UN seul anneau de 8 directions au rayon = spread (≤ 9 couches au
    // total). L'ancien empilement r=1..spread × 8 générait jusqu'à 80 drop-shadows
    // flous sur tout le scoreboard → surcharge GPU et crash du navigateur.
    if (_sbSpread > 0) {
      for (let a = 0; a < 8; a++) {
        const ang = (a * 45) * Math.PI / 180;
        const ox = _sbBx + Math.cos(ang) * _sbSpread;
        const oy = _sbBy + Math.sin(ang) * _sbSpread;
        _sbLayers.push(`drop-shadow(${ox.toFixed(1)}px ${oy.toFixed(1)}px ${_sbBlur}px ${_sbCol})`);
      }
    }
    _sbShadowFilter = _sbLayers.join(' ');
    _sbShadowBlendMode = s.sbShadowBlend || 'normal';
  }
  sb.style.setProperty('--sb-shadow-filter', _sbShadowFilter);
  sb.style.setProperty('--sb-shadow-blend',  _sbShadowBlendMode);
  sb.style.setProperty('--char-size',            (s.characterSize ?? 100) + 'px');
  sb.style.setProperty('--name-font-size',       (s.nameFontSize ?? 24) + 'px');
  sb.style.setProperty('--tag-font-size',        (s.tagFontSize ?? 16) + 'px');
  // Position du score — classe body sb-score-<between|above>
  const scorePos = ['above','in-cards'].includes(s.scorePositionMode) ? s.scorePositionMode : 'between';
  document.body.classList.toggle('sb-score-above',    scorePos === 'above');
  document.body.classList.toggle('sb-score-in-cards', scorePos === 'in-cards');
  // Mode in-cards : déplace les <span class="score"> dans chaque carte joueur
  // (p1-score à la fin de player1-block, p2-score au début de player2-block)
  // pour reproduire le rendu façon TSH. Mémorise le parent d'origine pour
  // restaurer quand on revient à 'between' ou 'above'.
  const _p1Sc = document.getElementById('p1-score');
  const _p2Sc = document.getElementById('p2-score');
  const _p1Cd = document.getElementById('player1-block');
  const _p2Cd = document.getElementById('player2-block');
  if (_p1Sc && !_p1Sc._origParent) { _p1Sc._origParent = _p1Sc.parentElement; _p1Sc._origNext = _p1Sc.nextSibling; }
  if (_p2Sc && !_p2Sc._origParent) { _p2Sc._origParent = _p2Sc.parentElement; _p2Sc._origNext = _p2Sc.nextSibling; }
  if (scorePos === 'in-cards') {
    if (_p1Sc && _p1Cd && _p1Sc.parentElement !== _p1Cd) _p1Cd.appendChild(_p1Sc);
    if (_p2Sc && _p2Cd && _p2Sc.parentElement !== _p2Cd) _p2Cd.insertBefore(_p2Sc, _p2Cd.firstChild);
  } else {
    if (_p1Sc?._origParent && _p1Sc.parentElement !== _p1Sc._origParent) _p1Sc._origParent.insertBefore(_p1Sc, _p1Sc._origNext);
    if (_p2Sc?._origParent && _p2Sc.parentElement !== _p2Sc._origParent) _p2Sc._origParent.insertBefore(_p2Sc, _p2Sc._origNext);
  }
  document.body.classList.toggle('sb-score-between', scorePos === 'between');
  // Miroir P1 ↔ P2
  document.body.classList.toggle('sb-mirror', s.swapPlayers === true);
  document.body.classList.toggle('sb-cards-separated', s.cardsSeparated === true);

  // Ancrage 9 points du scoreboard. Préfère sbAnchor (nouveau, 9 valeurs)
  // sinon dérive depuis sbAnchorY legacy (top/middle/bottom → *-center).
  const _sbAnch = s.sbAnchor
    || (s.sbAnchorY ? `${s.sbAnchorY}-center` : 'top-center');
  document.body.setAttribute('data-sb-anchor', _sbAnch);
  // Conserve les classes legacy par row pour les CSS externes éventuelles.
  const _sbRow = _sbAnch.split('-')[0];
  document.body.classList.toggle('sb-anchor-top',    _sbRow === 'top');
  document.body.classList.toggle('sb-anchor-middle', _sbRow === 'middle');
  document.body.classList.toggle('sb-anchor-bottom', _sbRow === 'bottom');

  // Lot 4 / 6 : event-bar — vars posées sur <body> (et pas sur #scoreboard) pour
  // qu'elles restent accessibles à .event-bar même en mode détaché, où la barre
  // est sortie du DOM du scoreboard (cf. déplacement plus bas).
  const _docBody = document.body;
  const ebL = parseInt(s.eventBarLeftWidth ?? 0);
  const ebR = parseInt(s.eventBarRightWidth ?? 0);
  _docBody.style.setProperty('--eb-left-width',  ebL > 0 ? `${ebL}%` : '0fr');
  _docBody.style.setProperty('--eb-right-width', ebR > 0 ? `${ebR}%` : '0fr');
  const leftAlign = ['left','center','right'].includes(s.eventBarLeftAlign) ? s.eventBarLeftAlign : 'left';
  _docBody.style.setProperty('--eb-left-align', leftAlign);
  _docBody.style.setProperty('--eb-left-justify', leftAlign === 'right' ? 'flex-end' : (leftAlign === 'center' ? 'center' : 'flex-start'));
  _docBody.classList.toggle('sb-eb-tripartite', ebL > 0 || ebR > 0);
  _docBody.classList.toggle('sb-event-stack-vertical', s.eventStacking === 'vertical');
  applyEventBarTripartite();
  // Séparateur
  const sepMap = { dot: '·', pipe: '|', slash: '/', dash: '—', bullet: '•', diamond: '◆', star: '★', none: '' };
  const sepCh  = sepMap[s.eventSlotSeparator] != null ? sepMap[s.eventSlotSeparator] : '·';
  document.querySelectorAll('.event-bar .sep').forEach(el => { el.textContent = sepCh; el.style.display = sepCh ? '' : 'none'; });

  _docBody.style.setProperty('--event-text-size', `${s.eventTextSize ?? 12}px`);
  const fw = s.flagSize ?? 52;
  sb.style.setProperty('--flag-w', fw + 'px');
  sb.style.setProperty('--flag-h', Math.round(fw * 34 / 52) + 'px');
  _docBody.style.setProperty('--event-text-color', s.eventTextColor || '#5A5A7A');

  // Lot 6 : onglet Événement — typo + chrome de la barre. Toutes les valeurs
  // ont des défauts qui reproduisent le rendu d'origine (avant onglet).
  _docBody.style.setProperty('--event-text-weight',    s.eventTextWeight ?? 600);
  _docBody.style.setProperty('--event-letter-spacing', (s.eventLetterSpacing ?? 3) + 'px');
  const _txTrans = ['none','uppercase','lowercase','capitalize'].includes(s.eventTextTransform) ? s.eventTextTransform : 'uppercase';
  _docBody.style.setProperty('--event-text-transform', _txTrans);
  const _glow = parseInt(s.eventTextGlow ?? 0);
  _docBody.style.setProperty('--event-text-shadow', _glow > 0 ? `0 0 ${_glow}px ${s.eventTextGlowColor || s.eventTextColor || '#EAB830'}` : 'none');
  // Fond barre : combine couleur + opacité en rgba()
  const _bgHex = (s.eventBarBgColor || '').replace('#','');
  if (_bgHex.length === 6) {
    const _br = parseInt(_bgHex.substring(0,2), 16);
    const _bg = parseInt(_bgHex.substring(2,4), 16);
    const _bb = parseInt(_bgHex.substring(4,6), 16);
    const _ba = (s.eventBarBgOpacity ?? 100) / 100;
    _docBody.style.setProperty('--event-bar-bg', `rgba(${_br},${_bg},${_bb},${_ba})`);
  } else {
    _docBody.style.removeProperty('--event-bar-bg');
  }
  _docBody.style.setProperty('--event-bar-border-color', s.eventBarBorderColor || '#EAB830');
  _docBody.style.setProperty('--event-bar-border-width', (s.eventBarBorderWidth ?? 2) + 'px');
  _docBody.style.setProperty('--event-bar-padding-x',    (s.eventBarPaddingX ?? 32) + 'px');
  _docBody.style.setProperty('--event-bar-gap',          (s.eventBarGap ?? 10) + 'px');
  _docBody.style.setProperty('--event-bar-bevel',        (s.eventBarBevel ?? 12) + 'px');
  _docBody.style.setProperty('--event-bar-detach',       (s.eventBarDetach ?? 0) + 'px');
  // Arrondi (radius) — quand > 0, on bascule .event-bar en mode .eb-rounded
  // qui remplace le clip-path polygon (biseaux) par inset(0 round Xpx).
  const _ebRadius = parseInt(s.eventBarRadius ?? 0);
  _docBody.style.setProperty('--event-bar-radius', _ebRadius + 'px');
  document.querySelectorAll('.event-bar').forEach(b => b.classList.toggle('eb-rounded', _ebRadius > 0));
  _docBody.style.setProperty('--eb-offset-x', (s.eventBarOffsetX ?? 0) + 'px');
  _docBody.style.setProperty('--eb-offset-y', (s.eventBarOffsetY ?? 0) + 'px');
  // Ombre portée — convention angle façon Photoshop (math, Y up = lumière) :
  // l'ombre tombe du côté opposé à la lumière. On flip Y pour le repère CSS.
  // Intensité (spread) émulée en stackant N drop-shadows à 8 directions autour
  // de la position de base, car filter:drop-shadow() n'a pas de spread natif.
  let _shadowCss = 'none';
  let _shadowBlend = 'normal';
  if (s.eventBarShadowOn) {
    const _shHex = (s.eventBarShadowColor || '#000000').replace('#','');
    if (_shHex.length === 6) {
      const _rad = (s.eventBarShadowAngle ?? 315) * Math.PI / 180;
      const _dist = parseInt(s.eventBarShadowDistance ?? 10);
      const _bx = -Math.cos(_rad) * _dist;
      const _by = -Math.sin(_rad) * _dist;
      const _blur = parseInt(s.eventBarShadowBlur ?? 4);
      const _spread = Math.max(0, Math.min(10, parseInt(s.eventBarShadowSpread ?? 0)));
      const _r = parseInt(_shHex.substring(0,2), 16);
      const _g = parseInt(_shHex.substring(2,4), 16);
      const _b = parseInt(_shHex.substring(4,6), 16);
      const _a = (s.eventBarShadowOpacity ?? 50) / 100;
      const _col = `rgba(${_r},${_g},${_b},${_a})`;
      const _layers = [`drop-shadow(${_bx.toFixed(1)}px ${_by.toFixed(1)}px ${_blur}px ${_col})`];
      // Spread : UN seul anneau de 8 directions au rayon = spread (≤ 9 couches).
      // L'ancien empilement r=1..spread × 8 pouvait générer 80 drop-shadows flous
      // → surcharge GPU et crash. Un anneau suffit visuellement avec le flou.
      if (_spread > 0) {
        for (let a = 0; a < 8; a++) {
          const ang = (a * 45) * Math.PI / 180;
          const ox = _bx + Math.cos(ang) * _spread;
          const oy = _by + Math.sin(ang) * _spread;
          _layers.push(`drop-shadow(${ox.toFixed(1)}px ${oy.toFixed(1)}px ${_blur}px ${_col})`);
        }
      }
      _shadowCss = _layers.join(' ');
      _shadowBlend = s.eventBarShadowBlend || 'multiply';
    }
  }
  _docBody.style.setProperty('--event-bar-shadow', _shadowCss);
  _docBody.style.setProperty('--event-bar-shadow-blend', _shadowBlend);
  // Mode détaché : la barre sort du DOM du scoreboard et est greffée à <body>
  // pour s'affranchir du transform/scale qui en fait un containing block.
  // On mémorise le parent d'origine pour restaurer en mode attaché.
  const _ebDetached = s.eventBarMode === 'detached';
  document.querySelectorAll('.event-bar').forEach(b => {
    if (!b._origParent && b.parentElement !== document.body) {
      b._origParent      = b.parentElement;
      b._origNextSibling = b.nextSibling;
    }
    if (_ebDetached) {
      if (b.parentElement !== document.body) document.body.appendChild(b);
    } else if (b._origParent && b.parentElement !== b._origParent) {
      b._origParent.insertBefore(b, b._origNextSibling);
    }
    b.classList.toggle('eb-detached', _ebDetached);
  });
  sb.style.setProperty('--tag-color', s.tagColor || '#E8B830');
  sb.style.setProperty('--name-color', s.nameColor || '#F0EEF8');
  sb.style.setProperty('--pronouns-color', s.pronounsColor || '#5A5A7A');
  // Onglet Score — couleur/taille du chiffre + VS + dots remplis
  if (s.scoreColor)     sb.style.setProperty('--score-color',    s.scoreColor);
  if (s.scoreVsColor)   sb.style.setProperty('--score-vs-color', s.scoreVsColor);
  sb.style.setProperty('--score-font-size', (s.scoreFontSize ?? 52) + 'px');
  if (s.dotColor)       sb.style.setProperty('--dot-color',      s.dotColor);
  // Position du texte du score : alignement vertical + décalage X/Y.
  const scoreValignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
  sb.style.setProperty('--score-valign', scoreValignMap[s.scoreAlign] || 'flex-start');
  sb.style.setProperty('--score-x', (s.scoreX ?? 0) + 'px');
  sb.style.setProperty('--score-y', (s.scoreY ?? 0) + 'px');
  // Toggles couleur joueur (chiffre) + carré derrière + vars associées
  document.body.classList.toggle('sb-score-player-color',    s.scoreUsePlayerColor === true);
  document.body.classList.toggle('sb-score-box',             s.scoreBgOn === true);
  document.body.classList.toggle('sb-score-bg-player-color', s.scoreBgUsePlayerColor === true);
  if (s.scoreBgColor)   sb.style.setProperty('--score-bg-color-p1', s.scoreBgColor);
  if (s.scoreBgColorP2) sb.style.setProperty('--score-bg-color-p2', s.scoreBgColorP2);
  sb.style.setProperty('--score-bg-padding', (s.scoreBgPadding ?? 12) + 'px');
  sb.style.setProperty('--score-bg-radius',  (s.scoreBgRadius  ?? 6)  + 'px');

  // Colors — full layout
  const c1 = s.hidePlayerColors ? 'transparent' : s.player1.color;
  const c2 = s.hidePlayerColors ? 'transparent' : s.player2.color;
  document.getElementById('player1-block').style.setProperty('--p1-color', c1);
  document.getElementById('player2-block').style.setProperty('--p2-color', c2);
  // Aussi sur #scoreboard pour que les scores en position 'between'/'above'
  // (qui vivent hors des player-block) puissent y accéder via cascade.
  sb.style.setProperty('--p1-color', c1);
  sb.style.setProperty('--p2-color', c2);
  // Colors — slim layout
  document.getElementById('player1-block-slim').style.setProperty('--p1-color', c1);
  document.getElementById('player2-block-slim').style.setProperty('--p2-color', c2);

  // Player names — both layouts
  renderPlayerName('p1-name', s.player1);
  renderPlayerName('p2-name', s.player2);
  renderPlayerName('p1-name-slim', s.player1);
  renderPlayerName('p2-name-slim', s.player2);
  document.getElementById('event-name').textContent = s.event;
  document.getElementById('event-stage').textContent = s.stage;
  document.getElementById('format-info').textContent = s.format === 'custom' ? (s.customWins || 'Custom') : s.format;

  // Current stage
  const stageSep = document.getElementById('current-stage-sep');
  const stageName = document.getElementById('current-stage-name');
  if (s.currentStage) {
    stageSep.style.display = 'inline';
    stageName.textContent = s.currentStage;
  } else {
    stageSep.style.display = 'none';
    stageName.textContent = '';
  }

  // Characters — Player 1
  const p1Img = document.getElementById('p1-char-img');
  const p1Ph  = document.getElementById('p1-char-placeholder');
  const p1Char = document.getElementById('p1-character');
  if (s.charDisplayMode === 'off') {
    // Personnages désactivés : on masque image, placeholder ET le conteneur parent
    // (qui a un fond/bordure thématique qui resterait visible sinon — voir .player-character).
    p1Img.onerror = null;
    p1Img.style.display = 'none';
    p1Ph.style.display  = 'none';
    if (p1Char) p1Char.style.display = 'none';
  } else if (s.player1.character) {
    if (p1Char) p1Char.style.display = '';
    const n1    = s.player1.character.name.replace(/\s*\/\s*/g, '-');
    const mural = s.charDisplayMode === 'mural';
    const src1  = mural ? `/murals/chara_1_${n1}_mural.png`
                        : `/full/chara_1_${n1}_${String(s.player1.stockColor ?? 0).padStart(2,'0')}.png`;
    p1Img.onerror = null;
    p1Img.onerror = mural
      ? () => { p1Img.onerror = null; p1Img.style.display = 'none'; p1Ph.style.display = 'flex'; p1Ph.textContent = n1.charAt(0); }
      : () => {
          console.warn('[PSO] p1 img error for', src1, '— trying _00 fallback');
          p1Img.onerror = () => { p1Img.onerror = null; p1Img.style.display = 'none'; p1Ph.style.display = 'flex'; p1Ph.textContent = n1.charAt(0); };
          p1Img.src = `/full/chara_1_${n1}_00.png`;
        };
    console.log('[PSO] p1 char src →', src1);
    p1Img.src = src1;
    p1Img.style.display = 'block';
    p1Ph.style.display = 'none';
  } else {
    if (p1Char) p1Char.style.display = ''; // réversibilité si on revient d'un mode off précédent
    p1Img.onerror = null;
    p1Img.style.display = 'none';
    p1Ph.style.display = 'flex';
    p1Ph.textContent = '?';
  }

  // Stock icon — Player 1 (slim)
  const p1Stock = document.getElementById('p1-stock-icon');
  const p1Sep   = document.getElementById('p1-icon-sep');
  if (s.player1.character) {
    const color1 = String(s.player1.stockColor ?? 0).padStart(2, '0');
    const name1  = s.player1.character.name.replace(/\s*\/\s*/g, '-');
    const src1s  = `/Stock Icons/chara_2_${name1}_${color1}.png`;
    p1Stock.onerror = null;
    p1Stock.onerror = () => { p1Stock.onerror = null; p1Stock.style.display = 'none'; p1Sep.style.display = 'none'; };
    p1Stock.src = src1s;
    p1Stock.style.display = 'block';
    p1Sep.style.display = 'block';
  } else {
    p1Stock.onerror = null;
    p1Stock.style.display = 'none';
    p1Sep.style.display = 'none';
  }

  // Characters — Player 2
  const p2Img = document.getElementById('p2-char-img');
  const p2Ph  = document.getElementById('p2-char-placeholder');
  const p2Char = document.getElementById('p2-character');
  if (s.charDisplayMode === 'off') {
    // Personnages désactivés : on masque image, placeholder ET le conteneur parent
    // (qui a un fond/bordure thématique qui resterait visible sinon).
    p2Img.onerror = null;
    p2Img.style.display = 'none';
    p2Ph.style.display  = 'none';
    if (p2Char) p2Char.style.display = 'none';
  } else if (s.player2.character) {
    if (p2Char) p2Char.style.display = '';
    const n2    = s.player2.character.name.replace(/\s*\/\s*/g, '-');
    const mural2 = s.charDisplayMode === 'mural';
    const src2  = mural2 ? `/murals/chara_1_${n2}_mural.png`
                         : `/full/chara_1_${n2}_${String(s.player2.stockColor ?? 0).padStart(2,'0')}.png`;
    p2Img.onerror = null;
    p2Img.onerror = mural2
      ? () => { p2Img.onerror = null; p2Img.style.display = 'none'; p2Ph.style.display = 'flex'; p2Ph.textContent = n2.charAt(0); }
      : () => {
          console.warn('[PSO] p2 img error for', src2, '— trying _00 fallback');
          p2Img.onerror = () => { p2Img.onerror = null; p2Img.style.display = 'none'; p2Ph.style.display = 'flex'; p2Ph.textContent = n2.charAt(0); };
          p2Img.src = `/full/chara_1_${n2}_00.png`;
        };
    console.log('[PSO] p2 char src →', src2);
    p2Img.src = src2;
    p2Img.style.display = 'block';
    p2Ph.style.display = 'none';
  } else {
    if (p2Char) p2Char.style.display = ''; // réversibilité si on revient d'un mode off précédent
    p2Img.onerror = null;
    p2Img.style.display = 'none';
    p2Ph.style.display = 'flex';
    p2Ph.textContent = '?';
  }

  // Stock icon — Player 2 (slim)
  const p2Stock = document.getElementById('p2-stock-icon');
  const p2Sep   = document.getElementById('p2-icon-sep');
  if (s.player2.character) {
    const color2 = String(s.player2.stockColor ?? 0).padStart(2, '0');
    const name2  = s.player2.character.name.replace(/\s*\/\s*/g, '-');
    const src2s  = `/Stock Icons/chara_2_${name2}_${color2}.png`;
    p2Stock.onerror = null;
    p2Stock.onerror = () => { p2Stock.onerror = null; p2Stock.style.display = 'none'; p2Sep.style.display = 'none'; };
    p2Stock.src = src2s;
    p2Stock.style.display = 'block';
    p2Sep.style.display = 'block';
  } else {
    p2Stock.onerror = null;
    p2Stock.style.display = 'none';
    p2Sep.style.display = 'none';
  }

  // Player flags — avec option placeholder (Customisation > Scoreboard > Drapeaux).
  // Quand s.placeholderFlags === true et qu'aucun drapeau n'est sélectionné,
  // on affiche un SVG gris « ? » pour visualiser la position/taille en preview
  // sans coller un vrai pays. Ce flag n'est qu'un aide visuel — il n'est pas
  // envoyé à OBS si l'utilisatrice le coche ; coupe-le avant de streamer.
  const FLAG_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 34">' +
    '<defs><pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.18)" stroke-width="3"/></pattern></defs>' +
    '<rect width="52" height="34" fill="#3a3a4e"/><rect width="52" height="34" fill="url(#d)"/>' +
    '<text x="26" y="23" font-family="Russo One, Arial, sans-serif" font-size="18" font-weight="700" ' +
    'text-anchor="middle" fill="rgba(255,255,255,0.6)">?</text>' +
    '<rect x="0.5" y="0.5" width="51" height="33" fill="none" stroke="rgba(255,255,255,0.2)"/></svg>'
  );
  const p1FlagImg = document.getElementById('p1-flag-img');
  const p2FlagImg = document.getElementById('p2-flag-img');
  if (p1FlagImg) {
    const f1 = s.player1?.flag;
    if (f1)                     { p1FlagImg.src = '/' + f1;       p1FlagImg.style.display = 'block'; }
    else if (s.placeholderFlags) { p1FlagImg.src = FLAG_PLACEHOLDER; p1FlagImg.style.display = 'block'; }
    else                         { p1FlagImg.style.display = 'none'; }
    sb.style.setProperty('--p1-flag-x', (s.player1?.flagOffsetX ?? 0) + 'px');
    sb.style.setProperty('--p1-flag-y', (s.player1?.flagOffsetY ?? 0) + 'px');
  }
  if (p2FlagImg) {
    const f2 = s.player2?.flag;
    if (f2)                     { p2FlagImg.src = '/' + f2;       p2FlagImg.style.display = 'block'; }
    else if (s.placeholderFlags) { p2FlagImg.src = FLAG_PLACEHOLDER; p2FlagImg.style.display = 'block'; }
    else                         { p2FlagImg.style.display = 'none'; }
    sb.style.setProperty('--p2-flag-x', (s.player2?.flagOffsetX ?? 0) + 'px');
    sb.style.setProperty('--p2-flag-y', (s.player2?.flagOffsetY ?? 0) + 'px');
  }

  // Center logo — full layout
  const centerImg = document.getElementById('center-logo-img');
  const vsEl = document.getElementById('score-vs');
  if (s.centerLogo && !s.centerLogoHidden) {
    centerImg.src = s.centerLogo;
    centerImg.style.display = 'block';
    vsEl.style.display = 'none';
  } else {
    centerImg.style.display = 'none';
    vsEl.style.display = 'inline';
  }
  // Center logo — slim layout
  const centerImgSlim = document.getElementById('center-logo-img-slim');
  const vsSlim = document.getElementById('slim-vs');
  if (s.centerLogo && !s.centerLogoHidden) {
    centerImgSlim.src = s.centerLogo;
    centerImgSlim.style.display = 'block';
    vsSlim.style.display = 'none';
  } else {
    centerImgSlim.style.display = 'none';
    vsSlim.style.display = 'inline';
  }

  // Scores with flash animation
  const s1El = document.getElementById('p1-score');
  const s2El = document.getElementById('p2-score');
  if (prev && prev.player1.score !== s.player1.score) {
    s1El.classList.remove('updated');
    void s1El.offsetWidth;
    s1El.classList.add('updated');
  }
  if (prev && prev.player2.score !== s.player2.score) {
    s2El.classList.remove('updated');
    void s2El.offsetWidth;
    s2El.classList.add('updated');
  }
  s1El.textContent = s.player1.score;
  s2El.textContent = s.player2.score;

  // Scores — slim layout
  const s1Slim = document.getElementById('p1-score-slim');
  const s2Slim = document.getElementById('p2-score-slim');
  if (prev && prev.player1.score !== s.player1.score) {
    s1Slim.classList.remove('updated'); void s1Slim.offsetWidth; s1Slim.classList.add('updated');
  }
  if (prev && prev.player2.score !== s.player2.score) {
    s2Slim.classList.remove('updated'); void s2Slim.offsetWidth; s2Slim.classList.add('updated');
  }
  s1Slim.textContent = s.player1.score;
  s2Slim.textContent = s.player2.score;

  // Series dots
  const max = getFormatMax(s.format, s.customWins);
  const dotsOrientation = s.dotsOrientation || 'row';
  sb.classList.toggle('dots-column', dotsOrientation === 'column');
  renderDots('p1-dots',     s.player1.score, max, c1);
  renderDots('p2-dots',     s.player2.score, max, c2);
  renderDots('p1-dots-col', s.player1.score, max, c1);
  renderDots('p2-dots-col', s.player2.score, max, c2);

  // ── Lower-third layout ───────────────────────────────────────
  const ltEl = document.getElementById('lt-layout');
  if (ltEl) {
    // Sync theme class
    const _theme = s.overlayTheme || 'default';
    [...ltEl.classList].filter(c => c.startsWith('theme-')).forEach(c => ltEl.classList.remove(c));
    ltEl.classList.add('theme-' + _theme);

    // Sync background var from scoreboard so lt-inner adapts to user's bg color
    ltEl.style.setProperty('--sb-bg', sb.style.getPropertyValue('--sb-bg') || '#0E0E12');

    // Dual theme: copy per-player character theme vars for glow effects
    if (isDual) {
      ['--p1-theme-primary','--p1-theme-glow','--p1-theme-bg',
       '--p2-theme-primary','--p2-theme-glow','--p2-theme-bg'].forEach(v => {
        ltEl.style.setProperty(v, sb.style.getPropertyValue(v));
      });
    }

    const showLt = !!s.ltVisible || _style === 'lower-third';
    ltEl.classList.toggle('lt-visible', showLt);
    ltEl.style.setProperty('--lt-bottom',    (s.ltBottom   ?? 150) + 'px');
    ltEl.style.setProperty('--lt-padding-x', (s.ltPaddingX ?? 60)  + 'px');
    if (showLt) _ltUpdate(s);
  }

  // ── Transparent theme — positions CSS vars ───────────────────
  if (isTransparent) {
    const pos = s.transparentPositions || {};
    // Barre de scores (position Y unique)
    const barY = (pos.barY ?? 20);
    sb.style.setProperty('--tp-bar-y', barY + 'px');
    // Barre événement (position libre)
    const ev = pos.event || {};
    sb.style.setProperty('--tp-event-x', (ev.x ?? 720) + 'px');
    sb.style.setProperty('--tp-event-y', (ev.y ?? 0) + 'px');
  }

  currentState = JSON.parse(JSON.stringify(s));
}

socket.on('stateUpdate', (s) => {
  console.log('[PSO] stateUpdate — p1 char:', s.player1?.character?.name ?? 'none', '| p2 char:', s.player2?.character?.name ?? 'none', '| mode:', s.charDisplayMode);
  window._psoLastState = s;
  applyScoreboardLayout(s && s.scoreboardLayout);
  applyVisibilityToggles(s);
  applyCompactCorner(s);
  update(s);
});

// Applique la classe de disposition (Customisation > SSBU > Scoreboard > Presets).
// Une seule classe « sb-layout-<id> » est appliquée à <body> à la fois.
function applyScoreboardLayout(layout) {
  const cls = 'sb-layout-' + (layout || 'classic');
  if (document.body.dataset.sbLayout === cls) return;
  document.body.classList.forEach(c => { if (c.startsWith('sb-layout-')) document.body.classList.remove(c); });
  document.body.classList.add(cls);
  document.body.dataset.sbLayout = cls;
}

// Visibilités individuelles des champs (Customisation > Scoreboard > Affichage).
// Pour chaque (stateField → bodyClass) : si state[stateField] === false, on ajoute
// la classe à <body>, sinon on la retire. Défaut : visible (champ absent = true).
const VISIBILITY_TOGGLES = [
  { stateField: 'showEventName',  bodyClass: 'sb-hide-event-name' },
  { stateField: 'showTournament', bodyClass: 'sb-hide-tournament' },
  { stateField: 'showFormat',     bodyClass: 'sb-hide-format'     },
  { stateField: 'showRound',      bodyClass: 'sb-hide-round'      },
  { stateField: 'showFlags',      bodyClass: 'sb-hide-flags'      },
  { stateField: 'showPronouns',   bodyClass: 'sb-hide-pronouns'   },
  { stateField: 'showTag',        bodyClass: 'sb-hide-tag'        },
  { stateField: 'showCharacter',  bodyClass: 'sb-hide-character'  },
  { stateField: 'showSeed',       bodyClass: 'sb-hide-seed'       },
];
function applyVisibilityToggles(s) {
  if (!s) return;
  for (const v of VISIBILITY_TOGGLES) {
    const visible = (s[v.stateField] !== false);
    document.body.classList.toggle(v.bodyClass, !visible);
  }
}

// Lot 4 : redistribue les enfants de .event-bar dans 3 wrappers gauche/centre/droite.
// Idempotent : si les wrappers existent déjà, on ne touche pas au DOM.
// Distribution par défaut :
//   gauche  : #event-name + #event-stage (Tournoi)
//   centre  : #format-info (BO) + #current-stage-name (Phase)
//   droite  : (vide par défaut — réservée à un usage futur)
function applyEventBarTripartite() {
  const bar = document.querySelector('.event-bar');
  if (!bar) return;
  if (bar.querySelector('.eb-left')) return; // déjà fait
  const eventName  = bar.querySelector('#event-name');
  const sep1       = eventName?.nextElementSibling; // .sep
  const eventStage = bar.querySelector('#event-stage');
  const sep2       = eventStage?.nextElementSibling;
  const formatInfo = bar.querySelector('#format-info');
  const sep3       = bar.querySelector('#current-stage-sep');
  const roundName  = bar.querySelector('#current-stage-name');
  const left  = document.createElement('span'); left.className  = 'eb-left';
  const mid   = document.createElement('span'); mid.className   = 'eb-center';
  const right = document.createElement('span'); right.className = 'eb-right';
  if (eventName)  left.appendChild(eventName);
  if (sep1 && sep1.classList?.contains('sep') && !sep1.id) left.appendChild(sep1);
  if (eventStage) left.appendChild(eventStage);
  if (sep2 && sep2.classList?.contains('sep') && !sep2.id) mid.appendChild(sep2);
  if (formatInfo) mid.appendChild(formatInfo);
  if (sep3)       mid.appendChild(sep3);
  if (roundName)  mid.appendChild(roundName);
  bar.append(left, mid, right);
}

// Liste des CSS vars du thème à propager aux racines de presets (Coin compact, etc.).
// Les vars sont posées sur #scoreboard par applyTheme()/update() ; on les recopie ici
// pour que tout preset hors-scoreboard hérite du même thème (background, polices, couleurs).
const PRESET_THEME_VARS = [
  '--sb-bg', '--custom-font',
  '--name-color', '--tag-color', '--pronouns-color',
  '--event-text-color', '--score-color', '--smash-gold',
];
function syncThemeVarsToPreset(root) {
  if (!root) return;
  const sb = document.getElementById('scoreboard');
  if (!sb) return;
  const inline = sb.style;
  for (const v of PRESET_THEME_VARS) {
    const val = inline.getPropertyValue(v);
    if (val) root.style.setProperty(v, val);
    else root.style.removeProperty(v);
  }
}

// Peuple le bloc « Coin compact » (#sb-compact-corner). Cette fonction tourne
// toujours, même quand la disposition n'est pas active : c'est CSS qui décide
// de l'afficher (body.sb-layout-compact-corner). Coût négligeable.
function applyCompactCorner(s) {
  const root = document.getElementById('sb-compact-corner');
  if (!root || !s) return;
  // Propage les vars du thème (couleurs, police, fond) vers ce preset.
  syncThemeVarsToPreset(root);
  // En-tête : nom du tournoi/événement
  const ev = document.getElementById('cc-event');
  if (ev) ev.textContent = s.event || '';
  // Lignes joueur
  ccSetPlayer(1, s.player1, root);
  ccSetPlayer(2, s.player2, root);
  // Pied : phase + format
  const st = document.getElementById('cc-stage');
  if (st) st.textContent = s.stage || '';
  const fmt = document.getElementById('cc-format');
  if (fmt) fmt.textContent = (s.format === 'custom') ? (s.customWins || 'Custom') : (s.format || '');
}

function ccSetPlayer(n, p, root) {
  if (!p) return;
  const nameEl  = document.getElementById('cc-p' + n + '-name');
  const scoreEl = document.getElementById('cc-p' + n + '-score');
  const flagEl  = document.getElementById('cc-p' + n + '-flag');
  const portEl  = document.getElementById('cc-p' + n + '-portrait');
  if (nameEl)  nameEl.textContent  = p.name || '';
  if (scoreEl) scoreEl.textContent = (p.score != null) ? p.score : 0;
  if (p.color && root) root.style.setProperty('--cc-p' + n + '-color', p.color);
  if (flagEl) {
    if (p.flag) { flagEl.setAttribute('src', '/' + p.flag); }
    else        { flagEl.removeAttribute('src'); }
  }
  if (portEl) {
    if (p.character && p.character.name) {
      const charName = p.character.name.replace(/\s*\/\s*/g, '-');
      const color    = String(p.stockColor ?? 0).padStart(2, '0');
      portEl.setAttribute('src', '/Stock Icons/chara_2_' + charName + '_' + color + '.png');
    } else {
      portEl.removeAttribute('src');
    }
  }
}

PS.init();

fetch('/api/state')
  .then(r => r.json())
  .then(s => {
    document.getElementById('scoreboard').classList.add('animate-in');
    applyScoreboardLayout(s && s.scoreboardLayout);
    applyVisibilityToggles(s);
    applyCompactCorner(s);
    update(s);
  });
