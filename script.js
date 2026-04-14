/**
 * ════════════════════════════════════════════════════════
 *  MOTOGP WORLD CHAMPIONSHIP — script.js
 *  Full championship system: 15 circuits, points, save/load
 * ════════════════════════════════════════════════════════
 */

'use strict';

// ─────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────
const randInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle  = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Convert #RRGGBB to "R,G,B" string for rgba() usage
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const TEAMS = [
  { id: 'ducati',  name: 'Ducati Lenovo Team',  color: '#D90429', colorRGB: '217,4,41' },
  { id: 'prima',  name: 'Prima Pramac Racing',  color: '#6A0DAD', colorRGB: '106,13,173' },
  { id: 'redbull',   name: 'Red Bull KTM Factory Racing',   color: '#FF6D00', colorRGB: '255,109,0' },
  { id: 'aprilia', name: 'Aprilia Racing', color: '#2EC4B6', colorRGB: '46,196,182' },
  { id: 'vr46',     name: 'VR46 Racing Team',     color: '#FFD60A', colorRGB: '255,214,10' },
  { id: 'lcr',     name: 'LCR Honda',     color: '#F1FAEE', colorRGB: '241,250,238' },
  { id: 'gresini',     name: 'Gresini Racing',     color: '#4CC9F0', colorRGB: '76,201,240' },
  { id: 'tech3',     name: 'Tech3 GASGAS',     color: '#1a120a', colorRGB: '247,127,0' },
  { id: 'trackhouse',     name: 'Trackhouse Racing',     color: '#1E90FF', colorRGB: '30,144,255' },
  { id: 'repsol',     name: 'Honda Repsol Team',     color: '#FF3C38', colorRGB: '247,127,0' },
];

// Fixed circuit order — all 15 circuits, played in sequence
const CIRCUITS = [
  'Circuit Losail',       // 1  — Qatar
  'Circuit Portimão',     // 2  — Portugal
  'Circuit Jerez',        // 3  — Spain
  'Circuit Le Mans',      // 4  — France
  'Circuit Mugello',      // 5  — Italy
  'Circuit Sachsenring',  // 6  — Germany
  'Circuit Assen',        // 7  — Netherlands
  'Circuit Silverstone',  // 8  — UK
  'Circuit Misano',       // 9  — San Marino
  'Circuit Aragon',       // 10 — Aragon
  'Circuit Motegi',       // 11 — Japan
  'Circuit Phillip Island',// 12 — Australia
  'Circuit Sepang',       // 13 — Malaysia
  'Circuit Valencia',     // 14 — Valencia
  'Circuit Mandalika',    // 15 — Indonesia
];

const TOTAL_CIRCUITS = CIRCUITS.length; // 15
const TOTAL_CELLS    = randInt(50,70);
const TOTAL_LAPS     = 3;

// Points per finishing position (index 0 = 1st place)
const POINTS_TABLE = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0];

// Dice values 4–9 (index 0 = 4, index 5 = 9)
const DICE_FACES = ['4', '5', '6', '7', '8', '9'];
const SAVE_KEY   = 'motogp_championships';

// ─────────────────────────────────────────────────────────────
//  ORGANIC CLOSED-LOOP CIRCUIT GENERATOR
//
//  Strategy: build a closed polygon of "waypoints" on a coarse
//  grid, then expand each segment into individual cells so the
//  total count lands close to TOTAL_CELLS.  The last cell is
//  always adjacent to cell 0, forming a visual loop.
//
//  Returns { path:[{row,col}], cols, rows }
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  ORGANIC CLOSED-LOOP CIRCUIT GENERATOR  (v3 — adjacency-safe)
//
//  Core guarantee: every consecutive pair of cells in path[]
//  is exactly Manhattan-distance 1 apart (no gaps, ever).
//
//  Strategy:
//  1. Pick a circuit "shape template" — a list of axis-aligned
//     direction commands (R/L/U/D) with run-lengths.
//  2. Walk the commands cell-by-cell on a grid, collecting coords.
//  3. The template always returns to origin → true closed loop.
//  4. Scale run-lengths so total cells ≈ TARGET.
//  5. Deduplicate coordinates (keep first) to remove any
//     self-intersections that sneak in via jitter.
//  6. Verify final adjacency — guaranteed because every step is ±1.
// ─────────────────────────────────────────────────────────────

function generateBoard(circuitIdx) {
  // ─────────────────────────────────────────────────────────────
  //  Each of the 15 circuits has a FIXED layout template that
  //  mirrors the real-world track's character. The shape is
  //  always the same per circuit (deterministic), but scale/jitter
  //  gives a slightly different cell count each playthrough for
  //  variety. Adjacency is guaranteed: every step is Manhattan ±1.
  //
  //  Template format: array of {d, w} segments where
  //    d = direction ('R','L','U','D')
  //    w = weight (relative steps; scaled to hit ~TARGET cells)
  //  Net displacement must always be (0,0) → closed loop.
  // ─────────────────────────────────────────────────────────────

  // One dedicated template per circuit index 0-14
  const CIRCUIT_TEMPLATES = [
    // 0 — Circuit Losail (Qatar)
    // Wide oval, fast back straight, tight chicane at end
    { target:56, segs:[
      {d:'R',w:6},{d:'D',w:1},{d:'R',w:1},{d:'D',w:3},
      {d:'L',w:7},{d:'U',w:4}
    ]},
    // 1 — Circuit Portimão (Portugal)
    // Flowing uphill/downhill, double-back section
    { target:60, segs:[
      {d:'R',w:5},{d:'U',w:1},{d:'R',w:2},{d:'D',w:3},
      {d:'L',w:2},{d:'D',w:2},{d:'L',w:2},{d:'U',w:1},
      {d:'L',w:3},{d:'U',w:1}
    ]},
    // 2 — Circuit Jerez (Spain)
    // Technical, tight infield loop, short back straight
    { target:54, segs:[
      {d:'R',w:4},{d:'D',w:2},{d:'L',w:2},{d:'D',w:2},
      {d:'R',w:1},{d:'D',w:1},{d:'L',w:3},{d:'U',w:5}
    ]},
    // 3 — Circuit Le Mans (France)
    // Famous long Bugatti straight, tight bus-stop chicane
    { target:62, segs:[
      {d:'R',w:7},{d:'D',w:1},{d:'L',w:1},{d:'D',w:2},
      {d:'R',w:1},{d:'D',w:2},{d:'L',w:7},{d:'U',w:5}
    ]},
    // 4 — Circuit Mugello (Italy)
    // Long flowing sweepers, big elevation, Arrabbiata corners
    { target:58, segs:[
      {d:'R',w:6},{d:'D',w:1},{d:'R',w:2},{d:'D',w:3},
      {d:'L',w:4},{d:'D',w:1},{d:'L',w:4},{d:'U',w:5}
    ]},
    // 5 — Circuit Sachsenring (Germany)
    // Tight hairpin-heavy, narrow track, mostly left-hand turns
    { target:52, segs:[
      {d:'R',w:4},{d:'D',w:2},{d:'R',w:1},{d:'D',w:2},
      {d:'L',w:1},{d:'D',w:2},{d:'L',w:4},{d:'U',w:6}
    ]},
    // 6 — Circuit Assen (Netherlands)
    // Cathedral of speed, smooth flowing, long sweepers
    { target:58, segs:[
      {d:'R',w:6},{d:'D',w:2},{d:'L',w:3},{d:'D',w:2},
      {d:'L',w:3},{d:'U',w:4}
    ]},
    // 7 — Circuit Silverstone (UK)
    // Fast corners, Maggots/Becketts complex, long pit straight
    { target:64, segs:[
      {d:'R',w:5},{d:'D',w:1},{d:'R',w:2},{d:'D',w:2},
      {d:'L',w:2},{d:'D',w:2},{d:'R',w:1},{d:'D',w:1},
      {d:'L',w:6},{d:'U',w:6}
    ]},
    // 8 — Circuit Misano (San Marino)
    // Narrow, high-speed, hard braking zones
    { target:52, segs:[
      {d:'R',w:5},{d:'D',w:4},{d:'L',w:2},{d:'U',w:2},
      {d:'L',w:3},{d:'U',w:2}
    ]},
    // 9 — Circuit Aragon (Spain)
    // Very long back straight, technical stadium section
    { target:60, segs:[
      {d:'R',w:7},{d:'D',w:3},{d:'L',w:3},{d:'U',w:1},
      {d:'L',w:4},{d:'U',w:2}
    ]},
    // 10 — Circuit Motegi (Japan)
    // Twin-ring, technical infield chicanes
    { target:60, segs:[
      {d:'R',w:4},{d:'D',w:2},{d:'R',w:2},{d:'D',w:2},
      {d:'L',w:2},{d:'D',w:2},{d:'L',w:4},{d:'U',w:6}
    ]},
    // 11 — Circuit Phillip Island (Australia)
    // High-speed triangle, famous Gardner Straight
    { target:56, segs:[
      {d:'R',w:5},{d:'D',w:2},{d:'R',w:2},{d:'D',w:2},
      {d:'L',w:4},{d:'U',w:1},{d:'L',w:3},{d:'U',w:3}
    ]},
    // 12 — Circuit Sepang (Malaysia)
    // Double-apex turns, long back straight, complex infield
    { target:64, segs:[
      {d:'R',w:6},{d:'D',w:2},{d:'L',w:2},{d:'D',w:2},
      {d:'R',w:2},{d:'D',w:2},{d:'L',w:6},{d:'U',w:6}
    ]},
    // 13 — Circuit Valencia (Spain)
    // Tight and twisty, street-style layout
    { target:58, segs:[
      {d:'R',w:3},{d:'D',w:1},{d:'R',w:3},{d:'D',w:3},
      {d:'L',w:3},{d:'D',w:1},{d:'L',w:3},{d:'U',w:5}
    ]},
    // 14 — Circuit Mandalika (Indonesia)
    // Coastal S-curves, flowing seaside layout
    { target:62, segs:[
      {d:'R',w:3},{d:'D',w:2},{d:'R',w:2},{d:'U',w:1},
      {d:'R',w:2},{d:'D',w:4},{d:'L',w:2},{d:'D',w:1},
      {d:'L',w:5},{d:'U',w:6}
    ]},
  ];

  const idx = (circuitIdx >= 0 && circuitIdx < CIRCUIT_TEMPLATES.length)
    ? circuitIdx : 0;
  const tpl = CIRCUIT_TEMPLATES[idx];
  const TARGET = tpl.target;

  // ── Scale segments to target cell count ───────────────────
  const totalWeight = tpl.segs.reduce((s, seg) => s + seg.w, 0);
  const scale = Math.max(1, Math.round(TARGET / totalWeight));

  // Small per-playthrough jitter on each segment (±1 step) so the
  // board feels slightly fresh even on repeat, but overall shape
  // and character of the circuit stays recognisable.
  const segs = tpl.segs.map(s => ({
    d: s.d,
    steps: Math.max(1, s.w * scale + randInt(-1, 1))
  }));

  // ── Re-balance to guarantee closed loop (net displacement = 0) ─
  function rebalance(segs) {
    const netH = segs.reduce((s,x) => s+(x.d==='R'?x.steps:x.d==='L'?-x.steps:0), 0);
    const netV = segs.reduce((s,x) => s+(x.d==='D'?x.steps:x.d==='U'?-x.steps:0), 0);
    if (netH !== 0) {
      const dir = netH > 0 ? 'L' : 'R'; let rem = Math.abs(netH);
      for (const seg of segs) { if (seg.d===dir && rem>0) { const a=Math.min(rem,Math.ceil(rem/2)); seg.steps+=a; rem-=a; } }
      if (rem > 0) { const opp = netH>0?'R':'L'; for (const seg of segs) { if (seg.d===opp && rem>0 && seg.steps>1) { const a=Math.min(rem,seg.steps-1); seg.steps-=a; rem-=a; } } }
    }
    if (netV !== 0) {
      const dir = netV > 0 ? 'U' : 'D'; let rem = Math.abs(netV);
      for (const seg of segs) { if (seg.d===dir && rem>0) { const a=Math.min(rem,Math.ceil(rem/2)); seg.steps+=a; rem-=a; } }
      if (rem > 0) { const opp = netV>0?'D':'U'; for (const seg of segs) { if (seg.d===opp && rem>0 && seg.steps>1) { const a=Math.min(rem,seg.steps-1); seg.steps-=a; rem-=a; } } }
    }
  }
  rebalance(segs);

  // ── Walk the path cell by cell (Manhattan ±1 each step) ──────
  const dirMap = { R:[0,1], L:[0,-1], D:[1,0], U:[-1,0] };
  const rawPath = [];
  let r = 0, c = 0;
  for (const seg of segs) {
    const [dr, dc] = dirMap[seg.d];
    for (let s = 0; s < seg.steps; s++) {
      rawPath.push({ row: r, col: c });
      r += dr; c += dc;
    }
  }

  // ── Shift to non-negative coordinates ────────────────────────
  let minRow = 0, minCol = 0;
  rawPath.forEach(cell => {
    if (cell.row < minRow) minRow = cell.row;
    if (cell.col < minCol) minCol = cell.col;
  });
  const shiftedPath = rawPath.map(cell => ({
    row: cell.row - minRow,
    col: cell.col - minCol,
  }));

  // ── Remove duplicate coordinates (keep first occurrence) ─────
  const seenCoords = new Set();
  const dedupedPath = [];
  shiftedPath.forEach(cell => {
    const key = cell.row + ',' + cell.col;
    if (!seenCoords.has(key)) {
      seenCoords.add(key);
      dedupedPath.push(cell);
    }
  });

  // ── Bridge any gaps caused by dedup ──────────────────────────
  function bridgePath(path) {
    const out  = [];
    const used = new Set(path.map(c => c.row + ',' + c.col));
    for (let i = 0; i < path.length; i++) {
      out.push(path[i]);
      const next = path[(i + 1) % path.length];
      const dr = next.row - path[i].row;
      const dc = next.col - path[i].col;
      if (Math.abs(dr) + Math.abs(dc) > 1) {
        const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
        const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
        let cr = path[i].row, cc = path[i].col;
        while (cc !== next.col) {
          cc += stepC;
          if (cc === next.col && cr === next.row) break;
          const key = cr + ',' + cc;
          if (!used.has(key)) { used.add(key); out.push({ row: cr, col: cc }); }
          else break;
        }
        while (cr !== next.row) {
          cr += stepR;
          if (cr === next.row && cc === next.col) break;
          const key = cr + ',' + cc;
          if (!used.has(key)) { used.add(key); out.push({ row: cr, col: cc }); }
          else break;
        }
      }
    }
    return out;
  }

  let finalPath = bridgePath(dedupedPath);

  // ── Safety fallback ───────────────────────────────────────────
  if (finalPath.length < 20) {
    const fbC = 10, fbR = 5;
    const fb = [];
    for (let col = 0; col < fbC; col++) fb.push({ row: 0, col });
    for (let row = 1; row < fbR; row++) fb.push({ row, col: fbC - 1 });
    for (let col = fbC - 2; col >= 0; col--) fb.push({ row: fbR - 1, col });
    for (let row = fbR - 2; row >= 1; row--) fb.push({ row, col: 0 });
    return { path: fb, cols: fbC, rows: fbR, isLoop: true };
  }

  // ── Bounding box ──────────────────────────────────────────────
  let maxRow = 0, maxCol = 0;
  finalPath.forEach(({ row, col }) => {
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  });

  return {
    path: finalPath,
    cols: maxCol + 1,
    rows: maxRow + 1,
    isLoop: true,
  };
}

// ─────────────────────────────────────────────────────────────
//  CHAMPIONSHIP STATE
//  Persisted to localStorage between sessions.
// ─────────────────────────────────────────────────────────────
const CS = {
  id: null,            // save slot ID
  saveName: '',        // display name
  currentCircuit: 0,   // index into CIRCUITS (0-based)
  players: [],         // [{id, name, number, teamId, totalPts, wins, podiums[3], raceHistory[]}]
  circuitResults: [],  // [{circuitIdx, finishOrder:[playerId...]}] — one per completed circuit
};

// ─────────────────────────────────────────────────────────────
//  RACE STATE  (reset each circuit)
// ─────────────────────────────────────────────────────────────
const RS = {
  board: [],           // [{row,col}]
  cols: 0,
  racePlayers: [],     // race-local player objects (position, lap, finished, finishRank)
  turnOrder: [],       // player ids shuffled
  currentTurnIdx: 0,
  finished: [],        // player ids in finish order
  isRolling: false,
  gameOver: false,

  get currentPlayer() {
    return this.racePlayers.find(p => p.id === this.turnOrder[this.currentTurnIdx]);
  },
};

// ─────────────────────────────────────────────────────────────
//  SAVE / LOAD  (localStorage)
// ─────────────────────────────────────────────────────────────
function getAllSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); }
  catch { return {}; }
}

function saveChampionship() {
  const all = getAllSaves();
  all[CS.id] = {
    id:             CS.id,
    saveName:       CS.saveName,
    savedAt:        new Date().toISOString(),
    currentCircuit: CS.currentCircuit,
    players:        CS.players,
    circuitResults: CS.circuitResults,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
}

function loadChampionshipSlot(id) {
  const all  = getAllSaves();
  const slot = all[id];
  if (!slot) return false;
  CS.id             = slot.id;
  CS.saveName       = slot.saveName;
  CS.currentCircuit = slot.currentCircuit;
  CS.players        = slot.players;
  CS.circuitResults = slot.circuitResults;
  return true;
}

function deleteSave(id) {
  const all = getAllSaves();
  delete all[id];
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
}

// ─────────────────────────────────────────────────────────────
//  SCREEN SWITCHER
// ─────────────────────────────────────────────────────────────
const SCREEN_IDS = ['home-screen','setup-screen','qualifying-screen','game-screen','championship-screen'];

function showScreen(id) {
  SCREEN_IDS.forEach(s => {
    const el = document.getElementById(s);
    el.classList.remove('active');
    el.style.display = 'none';
  });
  const target = document.getElementById(id);
  target.style.display = 'flex';
  target.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
//  HOME SCREEN
// ─────────────────────────────────────────────────────────────
function renderHome() {
  showScreen('home-screen');
  document.getElementById('saved-games-list').classList.add('hidden');
}

function renderSavedGamesList() {
  const panel = document.getElementById('saved-games-list');
  panel.classList.remove('hidden');
  const all   = getAllSaves();
  const slots = Object.values(all);

  if (slots.length === 0) {
    panel.innerHTML = '<div class="saved-games-empty">Belum ada championship yang tersimpan</div>';
    return;
  }

  panel.innerHTML = '';
  slots.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).forEach(slot => {
    const done = slot.currentCircuit >= TOTAL_CIRCUITS;
    const d    = new Date(slot.savedAt);
    const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;

    const row = document.createElement('div');
    row.className = 'saved-game-row';
    row.innerHTML = `
      <div class="saved-game-info">
        <div class="saved-game-name">${slot.saveName}</div>
        <div class="saved-game-meta">Ronde ${slot.currentCircuit}/${TOTAL_CIRCUITS} · ${dateStr}${done?' · ✅ SELESAI':''}</div>
      </div>
      <div class="saved-game-actions">
        <button class="btn-sg-load" data-id="${slot.id}">${done ? '📊 RECAP' : '▶ LANJUT'}</button>
        <button class="btn-sg-del"  data-id="${slot.id}">✕</button>
      </div>`;
    panel.appendChild(row);
  });

  panel.querySelectorAll('.btn-sg-load').forEach(btn => {
    btn.addEventListener('click', () => {
      if (loadChampionshipSlot(btn.dataset.id)) {
        if (CS.currentCircuit >= TOTAL_CIRCUITS) {
          renderChampionshipScreen(true);
        } else {
          startNextCircuit();
        }
      }
    });
  });
  panel.querySelectorAll('.btn-sg-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Hapus save ini?')) {
        deleteSave(btn.dataset.id);
        renderSavedGamesList();
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  SETUP SCREEN — build team forms
// ─────────────────────────────────────────────────────────────
function buildSetupUI(existingPlayers) {
  const grid = document.getElementById('teams-grid');
  grid.innerHTML = '';

  // Build a flat list of 20 players sorted by their current teamId assignment
  // so each team slot gets the right player pre-filled.
  // For next season: existingPlayers may have mixed team assignments,
  // so we lay them out in the grid in their CURRENT team slots (by id order).
  const playersBySlot = existingPlayers
    ? [...existingPlayers].sort((a, b) => a.id - b.id)
    : [];

  TEAMS.forEach((team, ti) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.setProperty('--team-color', team.color);
    card.style.setProperty('--team-color-rgb', team.colorRGB);
    card.innerHTML = `
      <div class="team-header">
        <div class="team-color-bar" style="background:${team.color};box-shadow:0 0 10px ${team.color}"></div>
        <div class="team-name">${team.name.toUpperCase()}</div>
      </div>
      <div class="team-players">
        ${[0,1].map(pi => {
          const idx = ti * 2 + pi;
          const existing = playersBySlot[idx];
          const prefillName = existing ? existing.name : '';
          const prefillNum  = existing ? existing.number : '';
          return `
            <div class="player-input-row">
              <div class="player-badge" style="border-color:${team.color};color:${team.color}">P${idx+1}</div>
              <div class="input-group">
                <div class="input-row-inline">
                  <input class="input-field" type="text" id="name-${idx}" placeholder="Nama Pemain ${idx+1}" value="${prefillName}"/>
                  <input class="input-field num-input" type="number" id="num-${idx}" placeholder="#" min="1" max="99" value="${prefillNum}"/>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
    grid.appendChild(card);
  });

  document.querySelectorAll('.input-field').forEach(inp => inp.addEventListener('input', checkSetupReady));
  checkSetupReady();
}

function checkSetupReady() {
  let ok = true;
  for (let i = 0; i < 10; i++) {
    const name = document.getElementById(`name-${i}`)?.value.trim();
    const num  = document.getElementById(`num-${i}`)?.value.trim();
    if (!name || !num) { ok = false; break; }
  }
  document.getElementById('start-btn').disabled = !ok;
}

// ─────────────────────────────────────────────────────────────
//  INIT NEW CHAMPIONSHIP
// ─────────────────────────────────────────────────────────────
function initNewChampionship() {
  // Collect player data from form
  CS.players = [];
  TEAMS.forEach((team, ti) => {
    [0,1].forEach(pi => {
      const idx = ti * 2 + pi;
      CS.players.push({
        id:           idx,
        name:         document.getElementById(`name-${idx}`).value.trim(),
        number:       document.getElementById(`num-${idx}`).value.trim(),
        teamId:       team.id,
        totalPts:     0,
        wins:         0,
        podiums:      [0, 0, 0], // [1st, 2nd, 3rd]
        raceHistory:  [], // [{circuitIdx, rank, pts}]
      });
    });
  });

  CS.currentCircuit = 0;
  CS.circuitResults = [];
  CS.id       = `save_${Date.now()}`;

  // Ask for save name
  const firstName = CS.players[0].name;
  CS.saveName = `${firstName} & friends`;

  saveChampionship();
  startNextCircuit();
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING STATE  (reset each circuit, 1-lap session)
// ─────────────────────────────────────────────────────────────
const QS = {
  board: [],
  cols: 0,
  rows: 0,
  qualPlayers: [],     // same shape as racePlayers but for 1 qualifying lap
  turnOrder: [],
  currentTurnIdx: 0,
  finished: [],        // player ids in qualifying finish order (best = pole)
  isRolling: false,
  gameOver: false,

  get currentPlayer() {
    return this.qualPlayers.find(p => p.id === this.turnOrder[this.currentTurnIdx]);
  },
};

// ─────────────────────────────────────────────────────────────
//  START NEXT CIRCUIT — launches qualifying first
// ─────────────────────────────────────────────────────────────
function startNextCircuit() {
  if (CS.currentCircuit >= TOTAL_CIRCUITS) {
    renderChampionshipScreen(true);
    return;
  }
  startQualifying();
}

// ─────────────────────────────────────────────────────────────
//  START QUALIFYING
// ─────────────────────────────────────────────────────────────
function startQualifying() {
  const { path, cols, rows, isLoop } = generateBoard(CS.currentCircuit);
  QS.board   = path;
  QS.cols    = cols;
  QS.rows    = rows;
  QS.finished = [];
  QS.isRolling = false;
  QS.gameOver  = false;
  QS.currentTurnIdx = 0;

  // All players start at cell 0, turn order random for qualifying
  QS.qualPlayers = CS.players.map(cp => ({
    id:         cp.id,
    name:       cp.name,
    number:     cp.number,
    teamId:     cp.teamId,
    position:   0,
    lap:        1,
    finished:   false,
    crashed:    false,
    finishRank: null,
  }));

  QS.turnOrder = shuffle(CS.players.map(p => p.id));

  renderQualifyingScreen();
  showScreen('qualifying-screen');
}

// ─────────────────────────────────────────────────────────────
//  RENDER QUALIFYING SCREEN
// ─────────────────────────────────────────────────────────────
function renderQualifyingScreen() {
  const circuitIdx  = CS.currentCircuit;
  const circuitName = CIRCUITS[circuitIdx].toUpperCase();

  document.getElementById('qual-circuit-name').textContent  = circuitName;
  document.getElementById('qual-circuit-round').textContent = circuitIdx + 1;
  document.getElementById('qual-circuit-total').textContent = TOTAL_CIRCUITS;
  document.getElementById('qual-total-boxes').textContent   = QS.board.length;
  document.getElementById('qual-dice-face').textContent     = '⏱';
  document.getElementById('qual-race-log').innerHTML        = '';

  renderQualBoard();
  renderQualSidebar();
  updateQualRollButton();
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING BOARD
// ─────────────────────────────────────────────────────────────
function renderQualBoard() {
  const wrapper = document.getElementById('qual-circuit-wrapper');
  wrapper.innerHTML = '';

  const { board, cols, rows: boardRows } = QS;
  let maxRow = 0;
  board.forEach(({ row }) => { if (row > maxRow) maxRow = row; });
  const rows = boardRows || (maxRow + 1);

  wrapper.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  wrapper.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;

  const cellMap = {};
  board.forEach(({ row, col }, i) => { cellMap[`${row},${col}`] = i; });

  const byCell = {};
  QS.qualPlayers.forEach(p => {
    if (p.position < 0) return;
    if (!byCell[p.position]) byCell[p.position] = [];
    byCell[p.position].push(p);
  });

  const cur = QS.currentPlayer;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ci  = cellMap[`${r},${c}`];
      const div = document.createElement('div');

      if (ci === undefined) {
        div.className = 'cell empty';
      } else {
        div.className = 'cell';
        div.id = `qual-cell-${ci}`;

        if (ci > 0) {
          const prev = board[ci - 1];
          const curC = board[ci];
          const inDr = curC.row - prev.row;
          const inDc = curC.col - prev.col;
          let arrow = '';
          if (inDr === 0 && inDc > 0) arrow = '→';
          else if (inDr === 0 && inDc < 0) arrow = '←';
          else if (inDr > 0 && inDc === 0) arrow = '↓';
          else if (inDr < 0 && inDc === 0) arrow = '↑';
          if (arrow) div.dataset.arrow = arrow;

          if (ci > 1) {
            const pprev = board[ci - 2];
            const prevDr = prev.row - pprev.row;
            const prevDc = prev.col - pprev.col;
            if (prevDr !== inDr || prevDc !== inDc) div.classList.add('cell-corner');
          }
        }

        const numEl = document.createElement('span');
        numEl.className = 'cell-number';
        numEl.textContent = ci + 1;
        div.appendChild(numEl);

        if (ci === 0) {
          div.classList.add('cell-start');
          const lbl = document.createElement('span');
          lbl.className = 'cell-start-label';
          lbl.textContent = '⬤ START/FIN';
          div.appendChild(lbl);
        }
        if (ci === board.length - 1) {
          div.classList.add('cell-finish');
          const lbl = document.createElement('span');
          lbl.className = 'cell-finish-label';
          lbl.textContent = '→ QUAL';
          div.appendChild(lbl);
        }

        if (!QS.gameOver && cur && cur.position === ci) {
          div.classList.add('cell-active-player');
        }

        const here = byCell[ci];
        if (here?.length) {
          const container = document.createElement('div');
          container.className = 'players-on-cell';
          here.forEach(p => {
            container.appendChild(createPlayerToken(p, !QS.gameOver && p.id === cur?.id));
          });
          div.appendChild(container);
        }
      }
      wrapper.appendChild(div);
    }
  }

  // Loop-back connector
  const firstCell = board[0];
  const lastCell  = board[board.length - 1];
  const dr = Math.abs(firstCell.row - lastCell.row);
  const dc = Math.abs(firstCell.col - lastCell.col);
  if (dr + dc > 1) {
    requestAnimationFrame(() => {
      const wrapRect = wrapper.getBoundingClientRect();
      const c0El     = document.getElementById('qual-cell-0');
      const cEndEl   = document.getElementById(`qual-cell-${board.length - 1}`);
      if (!c0El || !cEndEl || !wrapRect.width) return;
      const r0 = c0El.getBoundingClientRect();
      const rE = cEndEl.getBoundingClientRect();
      const x0 = r0.left - wrapRect.left + r0.width  / 2;
      const y0 = r0.top  - wrapRect.top  + r0.height / 2;
      const xE = rE.left - wrapRect.left + rE.width  / 2;
      const yE = rE.top  - wrapRect.top  + rE.height / 2;
      const oldSvg = wrapper.querySelector('.loop-connector');
      if (oldSvg) oldSvg.remove();
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg   = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'loop-connector');
      svg.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0;`;
      const cx1 = xE + (x0 - xE) * 0.5 - (y0 - yE) * 0.35;
      const cy1 = yE + (y0 - yE) * 0.5 + (x0 - xE) * 0.35;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M ${xE} ${yE} Q ${cx1} ${cy1} ${x0} ${y0}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(0,200,255,0.45)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('stroke-linecap', 'round');
      const anim = document.createElementNS(svgNS, 'animate');
      anim.setAttribute('attributeName', 'stroke-dashoffset');
      anim.setAttribute('from', '0');
      anim.setAttribute('to', '-20');
      anim.setAttribute('dur', '0.8s');
      anim.setAttribute('repeatCount', 'indefinite');
      path.appendChild(anim);
      svg.appendChild(path);
      wrapper.style.position = 'relative';
      wrapper.appendChild(svg);
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING SIDEBAR
// ─────────────────────────────────────────────────────────────
function renderQualSidebar() {
  renderQualCurrentTurn();
  renderQualStandings();
}

function renderQualCurrentTurn() {
  const el = document.getElementById('qual-current-turn-display');
  const qp = QS.currentPlayer;
  if (!qp || QS.gameOver) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center">Qualifying Selesai!</div>';
    return;
  }
  const team = TEAMS.find(t => t.id === qp.teamId);
  el.innerHTML = `
    <div class="turn-token" style="background:${team.color}">${qp.number}</div>
    <div class="turn-info">
      <div class="turn-name">${qp.name}</div>
      <div class="turn-team">${team.name.toUpperCase()}</div>
    </div>
    <div class="turn-pos">1 Lap<br>Pos #${qp.position+1}</div>`;
}

function renderQualStandings() {
  const list = document.getElementById('qual-standings-list');
  list.innerHTML = '';

  const sorted = [...QS.qualPlayers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishRank - b.finishRank;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.position - a.position;
  });

  const cur = QS.currentPlayer;
  sorted.forEach((qp, i) => {
    const pos  = i + 1;
    const team = TEAMS.find(t => t.id === qp.teamId);
    const row  = document.createElement('div');
    row.className = 'standing-row'
      + (qp.id === cur?.id && !QS.gameOver ? ' is-active' : '')
      + (qp.finished ? ' is-finished' : '');
    row.innerHTML = `
      <div class="standing-pos ${pos<=3?'pos-'+pos:''}">${pos === 1 ? 'P' : pos}</div>
      <div class="standing-dot" style="background:${team.color}"></div>
      <div class="standing-name">${qp.name}</div>
      <div class="standing-detail">${qp.finished ? (pos===1?'🟡 POLE':'✓ DONE') : `#${qp.position+1}`}</div>`;
    list.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING LOG
// ─────────────────────────────────────────────────────────────
function addQualLog(msg, type = 'log-roll') {
  const log   = document.getElementById('qual-race-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = msg;
  log.insertBefore(entry, log.firstChild);
  while (log.children.length > 60) log.removeChild(log.lastChild);
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING — STEP COMPUTATION (1 lap only)
// ─────────────────────────────────────────────────────────────
function computeQualSteps(qp, steps) {
  const seq = [];
  let pos = qp.position;
  const totalCells = QS.board.length;

  for (let s = 0; s < steps; s++) {
    pos++;
    let evt = null;
    if (pos >= totalCells) {
      pos = 0;
      evt = 'finish'; // 1 lap = done
    }
    seq.push({ pos, evt });
    if (evt === 'finish') break;
  }
  return seq;
}

function applyQualSequence(qp, seq) {
  if (!seq.length) return null;
  const last = seq[seq.length - 1];
  qp.position = last.pos;
  let evt = null;
  for (const s of seq) {
    if (s.evt === 'finish') { evt = 'finish'; break; }
  }
  if (evt === 'finish') {
    qp.finished   = true;
    qp.finishRank = QS.finished.length + 1;
    QS.finished.push(qp.id);
    qp.position = -1;
  }
  return evt;
}

function animateQualSteps(qp, seq, onDone) {
  let si = 0;
  function next() {
    if (si >= seq.length) { onDone(); return; }
    const { pos, evt } = seq[si++];
    qp.position = pos;

    refreshQualTokensOnBoard(qp);

    const cell = document.getElementById(`qual-cell-${pos}`);
    if (cell) {
      cell.classList.add('step-bounce');
      setTimeout(() => cell.classList.remove('step-bounce'), STEP_MS);
      cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    const delay = evt === 'finish' ? STEP_MS * 3 : STEP_MS;
    setTimeout(next, delay);
  }
  next();
}

function refreshQualTokensOnBoard(movingQp) {
  document.querySelectorAll(`#qual-circuit-wrapper .player-token[data-player-id="${movingQp.id}"]`).forEach(t => t.remove());
  document.querySelectorAll('#qual-circuit-wrapper .players-on-cell').forEach(c => { if (!c.children.length) c.remove(); });

  const cur = QS.currentPlayer;
  const byCell = {};
  QS.qualPlayers.forEach(p => {
    if (p.position < 0) return;
    if (!byCell[p.position]) byCell[p.position] = [];
    byCell[p.position].push(p);
  });

  Object.entries(byCell).forEach(([ci, players]) => {
    const cellEl = document.getElementById(`qual-cell-${ci}`);
    if (!cellEl) return;
    let container = cellEl.querySelector('.players-on-cell');
    if (!container) {
      container = document.createElement('div');
      container.className = 'players-on-cell';
      cellEl.appendChild(container);
    }
    container.innerHTML = '';
    players.forEach(p => {
      const tok = createPlayerToken(p, !QS.gameOver && p.id === cur?.id);
      if (p.id === movingQp.id) { tok.classList.add('moving'); setTimeout(() => tok.classList.remove('moving'), 400); }
      container.appendChild(tok);
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING TURN HANDLER
// ─────────────────────────────────────────────────────────────
function handleQualTurn() {
  if (QS.isRolling || QS.gameOver) return;
  QS.isRolling = true;
  document.getElementById('qual-roll-btn').disabled = true;

  const qp      = QS.currentPlayer;
  const diceVal = rollDice();

  addQualLog(`<b>${qp.name}</b> melempar: <b>${diceVal}</b>`, 'log-roll');

  animateDice_qual(diceVal, () => {
    const seq = computeQualSteps(qp, diceVal);
    animateQualSteps(qp, seq, () => {
      const evt = applyQualSequence(qp, seq);

      const cell = document.getElementById(`qual-cell-${qp.position}`);
      if (cell) { cell.classList.add('just-landed'); setTimeout(() => cell.classList.remove('just-landed'), 700); }

      if (evt === 'finish') {
        addQualLog(`🏁 <b>${qp.name}</b> selesai qualifying! P${qp.finishRank}`, 'log-finish');
      } else {
        addQualLog(`<b>${qp.name}</b> maju ke kotak ${qp.position + 1}`, 'log-roll');
      }

      renderQualBoard();

      const activeCount = QS.qualPlayers.filter(p => !p.finished).length;
      if (activeCount === 0) {
        QS.gameOver = true;
        renderQualSidebar();
        QS.isRolling = false;
        document.getElementById('qual-roll-btn').disabled = true;
        setTimeout(onQualifyingFinished, 800);
        return;
      }

      advanceQualTurn();
      renderQualSidebar();
      QS.isRolling = false;
      updateQualRollButton();
    });
  });
}

function animateDice_qual(value, onDone) {
  const face    = document.getElementById('qual-dice-face');
  const display = document.getElementById('qual-dice-display');
  display.classList.add('rolling');
  let frames = 0;
  const iv = setInterval(() => {
    face.textContent = DICE_FACES[randInt(0, 5)];
    if (++frames >= 8) {
      clearInterval(iv);
      face.textContent = DICE_FACES[value - 4];
      display.classList.remove('rolling');
      onDone();
    }
  }, 60);
}

function advanceQualTurn() {
  const n = QS.turnOrder.length;
  let tries = 0;
  do {
    QS.currentTurnIdx = (QS.currentTurnIdx + 1) % n;
    if (++tries > n) break;
  } while (QS.currentPlayer.finished);
}

function updateQualRollButton() {
  const btn = document.getElementById('qual-roll-btn');
  if (!btn) return;
  btn.disabled = QS.isRolling || QS.gameOver;

  // Auto-advance: delay before next turn so animation is visible
  const activeCount = QS.qualPlayers.filter(p => !p.finished).length;
  if (activeCount > 0 && !QS.isRolling && !QS.gameOver) {
    setTimeout(() => {
      if (!QS.isRolling && !QS.gameOver) handleQualTurn();
    }, 300);
  }
}

// ─────────────────────────────────────────────────────────────
//  QUALIFYING FINISHED — show grid result, then start race
// ─────────────────────────────────────────────────────────────
function onQualifyingFinished() {
  // QS.finished = qualifying finish order, index 0 = pole (fastest)
  const circuitName = CIRCUITS[CS.currentCircuit].toUpperCase();
  document.getElementById('qual-result-circuit-name').textContent =
    `Ronde ${CS.currentCircuit + 1} — ${circuitName}`;

  const fullEl = document.getElementById('qual-finish-standings');
  fullEl.innerHTML = '';
  QS.finished.forEach((pid, i) => {
    const pos  = i + 1;
    const cp   = CS.players.find(p => p.id === pid);
    const team = TEAMS.find(t => t.id === cp.teamId);
    const row  = document.createElement('div');
    row.className = 'finish-row';
    row.innerHTML = `
      <div class="finish-row-pos ${pos<=3?'pos-'+pos:''}">${pos}</div>
      <div class="finish-row-dot" style="background:${team.color}"></div>
      <div class="finish-row-name">${cp.name}</div>
      <div class="finish-row-team"></div>
      <div class="finish-row-pts" style="color:${pos===1?'#ffd700':'var(--text-secondary)'}">${pos===1?'🟡 POLE':pos===2?'FRONT ROW':pos<=3?'2ND ROW':'P'+pos}</div>`;
    fullEl.appendChild(row);
  });

  document.getElementById('qual-result-overlay').classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  START RACE AFTER QUALIFYING
// ─────────────────────────────────────────────────────────────
function startRaceAfterQualifying() {
  document.getElementById('qual-result-overlay').classList.add('hidden');

  // QS.finished is the qualifying order: index 0 = pole = best start position
  // Pole sitter starts at highest cell (front of grid), last qualifier at cell 0
  const qualOrder = QS.finished; // array of playerIds, index 0 = pole

  const { path, cols, rows, isLoop } = generateBoard(CS.currentCircuit);
  RS.board   = path;
  RS.cols    = cols;
  RS.rows    = rows;
  RS.isLoop  = isLoop;
  RS.finished = [];
  RS.isRolling = false;
  RS.gameOver  = false;
  RS.currentTurnIdx = 0;

  // Grid positions based on qualifying: pole starts at cell GRID_CELLS, last at cell 0
  const total = qualOrder.length;
  const GRID_CELLS = 19;
  const gridStartMap = {};
  qualOrder.forEach((pid, i) => {
    // i=0 (pole) → cell GRID_CELLS (ahead), i=last → cell 0
    const startCell = Math.round((total - 1 - i) / (total - 1) * GRID_CELLS);
    gridStartMap[pid] = startCell;
  });
  CS.players.forEach(cp => {
    if (gridStartMap[cp.id] === undefined) gridStartMap[cp.id] = 0;
  });

  // Build race players — store startGridPos for post-race gain/loss display
  RS.racePlayers = CS.players.map(cp => ({
    id:           cp.id,
    name:         cp.name,
    number:       cp.number,
    teamId:       cp.teamId,
    position:     gridStartMap[cp.id],
    startGridPos: gridStartMap[cp.id], // saved once, never updated
    startGridRank: null,               // 1-based grid rank (set below)
    lap:          1,
    finished:     false,
    crashed:      false,
    finishRank:   null,
  }));

  // Assign 1-based grid ranks (rank 1 = furthest ahead = pole sitter)
  const byStartDesc = [...RS.racePlayers].sort((a, b) => b.startGridPos - a.startGridPos);
  byStartDesc.forEach((rp, i) => { rp.startGridRank = i + 1; });

  // Turn order in race = qualifying order (pole goes first)
  RS.turnOrder = [...qualOrder];

  renderGameScreen();
  showScreen('game-screen');
}

// ─────────────────────────────────────────────────────────────
//  START NEXT CIRCUIT (original game-only launch, now unused directly)
// ─────────────────────────────────────────────────────────────
function _startRaceDirect() {
  // kept for load-game compatibility — builds RS from championship standings
  const { path, cols, rows, isLoop } = generateBoard(CS.currentCircuit);
  RS.board   = path;
  RS.cols    = cols;
  RS.rows    = rows;
  RS.isLoop  = isLoop;
  RS.finished = [];
  RS.isRolling = false;
  RS.gameOver  = false;
  RS.currentTurnIdx = 0;

  const standingsOrder = [...CS.players]
    .sort((a, b) => b.totalPts - a.totalPts || b.wins - a.wins)
    .map(p => p.id);
  const total = standingsOrder.length;
  const GRID_CELLS = 19;
  const gridStartMap = {};
  standingsOrder.forEach((pid, i) => {
    gridStartMap[pid] = Math.round((total - 1 - i) / (total - 1) * GRID_CELLS);
  });
  CS.players.forEach(cp => { if (gridStartMap[cp.id] === undefined) gridStartMap[cp.id] = 0; });

  RS.racePlayers = CS.players.map(cp => ({
    id: cp.id, name: cp.name, number: cp.number, teamId: cp.teamId,
    position: gridStartMap[cp.id], lap: 1,
    finished: false, crashed: false, finishRank: null,
  }));
  RS.turnOrder = [...standingsOrder];

  renderGameScreen();
  showScreen('game-screen');
}

// ─────────────────────────────────────────────────────────────
//  RENDER GAME SCREEN
// ─────────────────────────────────────────────────────────────
function renderGameScreen() {
  const circuitIdx  = CS.currentCircuit;
  const circuitName = CIRCUITS[circuitIdx].toUpperCase();

  document.getElementById('circuit-name').textContent  = circuitName;
  document.getElementById('circuit-round').textContent = circuitIdx + 1;
  document.getElementById('circuit-total').textContent = TOTAL_CIRCUITS;
  document.getElementById('total-laps').textContent    = TOTAL_LAPS;
  document.getElementById('total-boxes').textContent   = RS.board.length;
  document.getElementById('dice-face').textContent     = '🎲';
  document.getElementById('race-log').innerHTML        = '';

  renderBoard();
  renderSidebar();
  updateRollButton();
}

// ─────────────────────────────────────────────────────────────
//  RENDER BOARD
// ─────────────────────────────────────────────────────────────
function renderBoard() {
  const wrapper = document.getElementById('circuit-wrapper');
  wrapper.innerHTML = '';

  const { board, cols, rows: boardRows } = RS;
  let maxRow = 0;
  board.forEach(({ row }) => { if (row > maxRow) maxRow = row; });
  const rows = boardRows || (maxRow + 1);

  wrapper.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  wrapper.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;

  // Lookup grid position → cell index
  const cellMap = {};
  board.forEach(({ row, col }, i) => { cellMap[`${row},${col}`] = i; });

  // Players per cell (skip crashed players who are off-board)
  const byCell = {};
  RS.racePlayers.forEach(p => {
    if (p.position < 0) return; // off-board (crashed or finished and hidden)
    if (!byCell[p.position]) byCell[p.position] = [];
    byCell[p.position].push(p);
  });

  const cur = RS.currentPlayer;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ci  = cellMap[`${r},${c}`];
      const div = document.createElement('div');

      if (ci === undefined) {
        div.className = 'cell empty';
      } else {
        div.className = 'cell';
        div.id = `cell-${ci}`;

        // Compute incoming direction arrow for this cell
        if (ci > 0) {
          const prev = board[ci - 1];
          const cur  = board[ci];
          const inDr = cur.row - prev.row;
          const inDc = cur.col - prev.col;
          let arrow = '';
          if (inDr === 0 && inDc > 0) arrow = '→';
          else if (inDr === 0 && inDc < 0) arrow = '←';
          else if (inDr > 0 && inDc === 0) arrow = '↓';
          else if (inDr < 0 && inDc === 0) arrow = '↑';
          if (arrow) div.dataset.arrow = arrow;

          // Detect if this cell is a corner (direction changed from previous)
          if (ci > 1) {
            const pprev = board[ci - 2];
            const prevDr = prev.row - pprev.row;
            const prevDc = prev.col - pprev.col;
            const isCorner = (prevDr !== inDr || prevDc !== inDc);
            if (isCorner) div.classList.add('cell-corner');
          }
        }

        const numEl = document.createElement('span');
        numEl.className = 'cell-number';
        numEl.textContent = ci + 1;
        div.appendChild(numEl);

        if (ci === 0) {
          div.classList.add('cell-start');
          const lbl = document.createElement('span');
          lbl.className = 'cell-start-label';
          lbl.textContent = '⬤ START/FIN';
          div.appendChild(lbl);
        }
        if (ci === board.length - 1) {
          div.classList.add('cell-finish');
          // Compute direction from last cell back to first cell for the arrow
          const last  = board[board.length - 1];
          const first = board[0];
          let arrow = '↻';
          if      (first.row < last.row && first.col === last.col) arrow = '↑';
          else if (first.row > last.row && first.col === last.col) arrow = '↓';
          else if (first.col < last.col && first.row === last.row) arrow = '←';
          else if (first.col > last.col && first.row === last.row) arrow = '→';
          const lbl = document.createElement('span');
          lbl.className = 'cell-finish-label';
          lbl.textContent = arrow + ' LAP';
          div.appendChild(lbl);
        }

        if (!RS.gameOver && cur && cur.position === ci) {
          div.classList.add('cell-active-player');
        }

        const here = byCell[ci];
        if (here?.length) {
          const container = document.createElement('div');
          container.className = 'players-on-cell';
          here.forEach(p => {
            container.appendChild(createPlayerToken(p, !RS.gameOver && p.id === cur?.id));
          });
          div.appendChild(container);
        }
      }
      wrapper.appendChild(div);
    }
  }

  // ── Draw SVG loop-back connector between last cell and cell 0 ──
  // Only draw if they are NOT already adjacent (loop is visible in path)
  const firstCell = board[0];
  const lastCell  = board[board.length - 1];
  const dr = Math.abs(firstCell.row - lastCell.row);
  const dc = Math.abs(firstCell.col - lastCell.col);
  if (dr + dc > 1) {
    // Use a requestAnimationFrame so cell positions are committed to DOM
    requestAnimationFrame(() => {
      const wrapRect = wrapper.getBoundingClientRect();
      const c0El     = document.getElementById('cell-0');
      const cEndEl   = document.getElementById(`cell-${board.length - 1}`);
      if (!c0El || !cEndEl || !wrapRect.width) return;

      const r0 = c0El.getBoundingClientRect();
      const rE = cEndEl.getBoundingClientRect();

      // Centre points relative to wrapper
      const x0 = r0.left - wrapRect.left + r0.width  / 2;
      const y0 = r0.top  - wrapRect.top  + r0.height / 2;
      const xE = rE.left - wrapRect.left + rE.width  / 2;
      const yE = rE.top  - wrapRect.top  + rE.height / 2;

      // Remove old connector if any
      const oldSvg = wrapper.querySelector('.loop-connector');
      if (oldSvg) oldSvg.remove();

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg   = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'loop-connector');
      svg.style.cssText = `
        position:absolute; inset:0; width:100%; height:100%;
        pointer-events:none; overflow:visible; z-index:0;`;

      // Curved dashed path from last cell back to first
      const cx1 = xE + (x0 - xE) * 0.5 - (y0 - yE) * 0.35;
      const cy1 = yE + (y0 - yE) * 0.5 + (x0 - xE) * 0.35;

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M ${xE} ${yE} Q ${cx1} ${cy1} ${x0} ${y0}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(255,77,0,0.55)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('stroke-linecap', 'round');

      // Animated dash
      const animEl = document.createElementNS(svgNS, 'animateTransform');
      const anim   = document.createElementNS(svgNS, 'animate');
      anim.setAttribute('attributeName', 'stroke-dashoffset');
      anim.setAttribute('from', '0');
      anim.setAttribute('to', '-20');
      anim.setAttribute('dur', '0.8s');
      anim.setAttribute('repeatCount', 'indefinite');
      path.appendChild(anim);

      // Arrowhead marker
      const defs   = document.createElementNS(svgNS, 'defs');
      const marker = document.createElementNS(svgNS, 'marker');
      marker.setAttribute('id', 'loop-arrow');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('refX', '3');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      const arrowPoly = document.createElementNS(svgNS, 'polygon');
      arrowPoly.setAttribute('points', '0 0, 6 3, 0 6');
      arrowPoly.setAttribute('fill', 'rgba(255,77,0,0.7)');
      marker.appendChild(arrowPoly);
      defs.appendChild(marker);
      svg.appendChild(defs);

      path.setAttribute('marker-end', 'url(#loop-arrow)');
      svg.appendChild(path);
      wrapper.style.position = 'relative';
      wrapper.appendChild(svg);
    });
  }
}

function createPlayerToken(rp, isActive) {
  const team = TEAMS.find(t => t.id === rp.teamId);
  const tok  = document.createElement('div');
  tok.className = 'player-token' + (isActive ? ' active-token' : '');
  tok.style.background  = team.color;
  tok.style.borderColor = isActive ? '#fff' : 'rgba(255,255,255,0.25)';
  tok.dataset.playerId  = rp.id;
  tok.title = `${rp.name} (${team.name}) | Lap ${rp.lap}/${TOTAL_LAPS}`;
  tok.textContent = rp.number;
  return tok;
}

// ─────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────
function renderSidebar() {
  renderCurrentTurn();
  renderRaceStandings();
  renderChampMini();
}

function renderCurrentTurn() {
  const el = document.getElementById('current-turn-display');
  const rp = RS.currentPlayer;
  if (!rp || RS.gameOver) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center">Race Selesai!</div>';
    return;
  }
  const team = TEAMS.find(t => t.id === rp.teamId);
  el.innerHTML = `
    <div class="turn-token" style="background:${team.color}">${rp.number}</div>
    <div class="turn-info">
      <div class="turn-name">${rp.name}</div>
      <div class="turn-team">${team.name.toUpperCase()}</div>
    </div>
    <div class="turn-pos">Lap ${rp.lap}/${TOTAL_LAPS}<br>Pos #${rp.position+1}</div>`;
}

function renderRaceStandings() {
  const list = document.getElementById('standings-list');
  list.innerHTML = '';

  const sorted = [...RS.racePlayers].sort((a, b) => {
    // Crashed always at the very bottom (check before finished, since crashed players also have finished=true)
    if (a.crashed && b.crashed) return 0;
    if (a.crashed) return 1;
    if (b.crashed) return -1;
    // Non-crashed finishers sorted by finish rank
    if (a.finished && b.finished) return a.finishRank - b.finishRank;
    if (a.finished) return -1;
    if (b.finished) return 1;
    // Active players sorted by lap then position
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.position - a.position;
  });

  const cur = RS.currentPlayer;
  sorted.forEach((rp, i) => {
    const pos  = i + 1;
    const team = TEAMS.find(t => t.id === rp.teamId);
    const row  = document.createElement('div');
    row.className = 'standing-row'
      + (rp.id === cur?.id && !RS.gameOver ? ' is-active' : '')
      + (rp.finished && !rp.crashed ? ' is-finished' : '')
      + (rp.crashed ? ' is-crashed' : '');
    row.innerHTML = `
      <div class="standing-pos ${!rp.crashed && pos<=3?'pos-'+pos:''}">${rp.crashed ? '💥' : pos}</div>
      <div class="standing-dot" style="background:${team.color};opacity:${rp.crashed?0.4:1}"></div>
      <div class="standing-name" style="${rp.crashed?'opacity:0.5;text-decoration:line-through':''}">${rp.name}</div>
      <div class="standing-detail">${rp.crashed ? 'CRASH' : rp.finished ? '✓ FINISH' : `L${rp.lap} #${rp.position+1}`}</div>`;
    list.appendChild(row);
  });
}

function renderChampMini() {
  const list = document.getElementById('champ-mini-list');
  if (!list) return;
  list.innerHTML = '';
  const sorted = [...CS.players].sort((a, b) => b.totalPts - a.totalPts);
  const leaderPts = sorted[0]?.totalPts || 0;
  sorted.forEach((cp, i) => {
    const team = TEAMS.find(t => t.id === cp.teamId);
    const gap  = i === 0 ? '' : `-${leaderPts - cp.totalPts}`;
    const row  = document.createElement('div');
    row.className = 'champ-mini-row' + (i === 0 ? ' champ-mini-leader' : '');
    row.innerHTML = `
      <div class="champ-mini-pos ${i < 3 ? 'pos-' + (i+1) : ''}">${i+1}</div>
      <div class="champ-mini-dot" style="background:${team.color}"></div>
      <div class="champ-mini-name">${cp.name}</div>
      <div class="champ-mini-gap">${gap}</div>
      <div class="champ-mini-pts">${cp.totalPts}</div>`;
    list.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────
//  RACE LOG
// ─────────────────────────────────────────────────────────────
function addLog(msg, type = 'log-roll') {
  const log   = document.getElementById('race-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = msg;
  log.insertBefore(entry, log.firstChild);
  while (log.children.length > 60) log.removeChild(log.lastChild);
}

// ─────────────────────────────────────────────────────────────
//  DICE
// ─────────────────────────────────────────────────────────────
function rollDice() { return randInt(4, 9); }

function animateDice(value, onDone) {
  const face    = document.getElementById('dice-face');
  const display = document.getElementById('dice-display');
  display.classList.add('rolling');
  let frames = 0;
  const iv = setInterval(() => {
    face.textContent = DICE_FACES[randInt(0, 5)]; // random 4–9 during spin
    if (++frames >= 8) {
      clearInterval(iv);
      face.textContent = DICE_FACES[value - 4]; // value 4→index 0, 9→index 5
      display.classList.remove('rolling');
      onDone();
    }
  }, 60);
}

// ─────────────────────────────────────────────────────────────
//  STEP ANIMATION
// ─────────────────────────────────────────────────────────────
const STEP_MS = 60;

/** Compute the sequence of positions for step-by-step animation */
function computeSteps(rp, steps) {
  const seq = [];
  let pos = rp.position;
  let lap = rp.lap;
  const totalCells = RS.board.length;

  for (let s = 0; s < steps; s++) {
    pos++;
    let evt = null;
    if (pos >= totalCells) {
      pos = 0;
      if (lap >= TOTAL_LAPS) { evt = 'finish'; }
      else { lap++; evt = 'lap'; }
    }
    seq.push({ pos, lap, evt });
    if (evt === 'finish') break;
  }
  return seq;
}

/** Commit final position/lap/finish state from sequence */
function applySequence(rp, seq) {
  if (!seq.length) return null;
  const last = seq[seq.length - 1];
  rp.position = last.pos;
  rp.lap      = last.lap;

  let lapEvent = null;
  for (const s of seq) {
    if (s.evt === 'finish') { lapEvent = 'finish'; break; }
    if (s.evt === 'lap')    { lapEvent = 'lap'; }
  }
  if (lapEvent === 'finish') {
    rp.finished   = true;
    rp.finishRank = RS.finished.length + 1;
    RS.finished.push(rp.id);
    rp.position = -1; // move off-board so token disappears from circuit
  }
  return lapEvent;
}

function animateSteps(rp, seq, onDone) {
  let si = 0;
  function next() {
    if (si >= seq.length) { onDone(); return; }
    const { pos, lap, evt } = seq[si++];
    rp.position = pos;
    rp.lap      = lap;

    refreshTokensOnBoard(rp);

    const cell = document.getElementById(`cell-${pos}`);
    if (cell) {
      cell.classList.add('step-bounce');
      setTimeout(() => cell.classList.remove('step-bounce'), STEP_MS);
      cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    const delay = evt === 'finish' ? STEP_MS * 3 : evt === 'lap' ? STEP_MS * 2 : STEP_MS;
    setTimeout(next, delay);
  }
  next();
}

/** Lightweight token refresh — only update DOM tokens, no full board rebuild */
function refreshTokensOnBoard(movingRp) {
  document.querySelectorAll(`.player-token[data-player-id="${movingRp.id}"]`).forEach(t => t.remove());
  document.querySelectorAll('.players-on-cell').forEach(c => { if (!c.children.length) c.remove(); });

  const cur    = RS.currentPlayer;
  const byCell = {};
  RS.racePlayers.forEach(p => {
    if (p.position < 0) return; // off-board (crashed)
    if (!byCell[p.position]) byCell[p.position] = [];
    byCell[p.position].push(p);
  });

  Object.entries(byCell).forEach(([ci, players]) => {
    const cellEl = document.getElementById(`cell-${ci}`);
    if (!cellEl) return;
    let container = cellEl.querySelector('.players-on-cell');
    if (!container) {
      container = document.createElement('div');
      container.className = 'players-on-cell';
      cellEl.appendChild(container);
    }
    container.innerHTML = '';
    players.forEach(p => {
      const tok = createPlayerToken(p, !RS.gameOver && p.id === cur?.id);
      if (p.id === movingRp.id) { tok.classList.add('moving'); setTimeout(() => tok.classList.remove('moving'), 400); }
      container.appendChild(tok);
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  HANDLE TURN
// ─────────────────────────────────────────────────────────────
function handleTurn() {
  if (RS.isRolling || RS.gameOver) return;
  RS.isRolling = true;
  document.getElementById('roll-btn').disabled = true;

  const rp      = RS.currentPlayer;
  const diceVal = rollDice();

  // ── CRASH CHECK (0.5% chance) ───────────────────────────────
  const isCrash = Math.random() < 0.005;

  addLog(`<b>${rp.name}</b> melempar dadu: <b>${diceVal}</b>`, 'log-roll');

  animateDice(diceVal, () => {
    if (isCrash) {
      // Mark player as crashed — out of the race, 0 points
      // NOTE: do NOT set rp.finished=true so sort keeps crashed at the bottom
      rp.crashed    = true;
      rp.finishRank = null;

      addLog(`💥 <b>${rp.name}</b> CRASH! OUT of the race!`, 'log-crash');
      showToast(`💥 ${rp.name} CRASH! Keluar dari race!`);

      // Flash crash animation on player's cell
      const cell = document.getElementById(`cell-${rp.position}`);
      if (cell) {
        cell.classList.add('cell-crash');
        setTimeout(() => cell.classList.remove('cell-crash'), 1200);
      }

      // Move token off board (position = -1) so pion disappears
      rp.position = -1;

      renderBoard();

      // Check if race is over: all non-crashed players must have finished
      const activeCount = RS.racePlayers.filter(p => !p.finished && !p.crashed).length;
      if (activeCount === 0) {
        RS.gameOver = true;
        renderSidebar();
        RS.isRolling = false;
        document.getElementById('roll-btn').disabled = true;
        setTimeout(onRaceFinished, 800);
        return;
      }

      advanceTurn();
      renderSidebar();
      RS.isRolling = false;
      updateRollButton();
      return;
    }

    const seq = computeSteps(rp, diceVal);
    animateSteps(rp, seq, () => {
      const lapEvent = applySequence(rp, seq);

      const cell = document.getElementById(`cell-${rp.position}`);
      if (cell) { cell.classList.add('just-landed'); setTimeout(() => cell.classList.remove('just-landed'), 700); }

      if (lapEvent === 'finish') {
        addLog(`🏁 <b>${rp.name}</b> FINISH! Peringkat #${rp.finishRank}`, 'log-finish');
      } else if (lapEvent === 'lap') {
        addLog(`🔄 <b>${rp.name}</b> mulai Lap ${rp.lap}!`, 'log-lap');
      } else {
        addLog(`<b>${rp.name}</b> maju ke kotak ${rp.position + 1}`, 'log-roll');
      }

      renderBoard();

      // Race over when no active (non-finished, non-crashed) players remain
      const activeCount = RS.racePlayers.filter(p => !p.finished && !p.crashed).length;
      if (activeCount === 0) {
        RS.gameOver = true;
        renderSidebar();
        RS.isRolling = false;
        document.getElementById('roll-btn').disabled = true;
        setTimeout(onRaceFinished, 800);
        return;
      }

      advanceTurn();
      renderSidebar();
      RS.isRolling = false;
      updateRollButton();
    });
  });
}

function advanceTurn() {
  const n = RS.turnOrder.length;
  let tries = 0;
  do {
    RS.currentTurnIdx = (RS.currentTurnIdx + 1) % n;
    if (++tries > n) break;
  } while (RS.currentPlayer.finished || RS.currentPlayer.crashed);
}

function updateRollButton() {
  const btn = document.getElementById('roll-btn');
  if (!btn) return;
  btn.disabled = RS.isRolling || RS.gameOver;

  // Auto-advance: delay before next turn so animation is visible
  const activeCount = RS.racePlayers.filter(p => !p.finished && !p.crashed).length;
  if (activeCount > 0 && !RS.isRolling && !RS.gameOver) {
    setTimeout(() => {
      if (!RS.isRolling && !RS.gameOver) handleTurn();
    }, 300);
  }
}

// ─────────────────────────────────────────────────────────────
//  RACE FINISHED — award points & show result modal
// ─────────────────────────────────────────────────────────────
function onRaceFinished() {
  const circuitIdx  = CS.currentCircuit;

  // Separate finishers (non-crashed) from crashed players
  const finishOrder = RS.finished.filter(pid => {
    const rp = RS.racePlayers.find(p => p.id === pid);
    return rp && !rp.crashed;
  });
  const crashedIds = RS.racePlayers.filter(p => p.crashed).map(p => p.id);

  // Award points to non-crashed finishers
  finishOrder.forEach((pid, i) => {
    const pts = POINTS_TABLE[i] || 0;
    const cp  = CS.players.find(p => p.id === pid);
    if (!cp) return;
    cp.totalPts += pts;
    cp.raceHistory.push({ circuitIdx, rank: i + 1, pts });
    if (i === 0) cp.wins++;
    if (i < 3)  cp.podiums[i]++;
  });

  // Crashed players get 0 points
  crashedIds.forEach(pid => {
    const cp = CS.players.find(p => p.id === pid);
    if (!cp) return;
    cp.raceHistory.push({ circuitIdx, rank: null, pts: 0, crashed: true });
  });

  // Record circuit result — full order includes crashes at the end
  const fullOrder = [...finishOrder, ...crashedIds];
  CS.circuitResults.push({ circuitIdx, finishOrder: fullOrder, crashedIds });

  // Advance circuit counter & autosave
  CS.currentCircuit++;
  saveChampionship();

  showRaceResultModal(circuitIdx, finishOrder, crashedIds);
}

function showRaceResultModal(circuitIdx, finishOrder, crashedIds = []) {
  const overlay = document.getElementById('race-result-overlay');
  document.getElementById('race-result-circuit-name').textContent =
    `Ronde ${circuitIdx + 1} — ${CIRCUITS[circuitIdx].toUpperCase()}`;

  // Points chips
  const ptsEl = document.getElementById('race-result-pts');
  ptsEl.innerHTML = '';
  finishOrder.forEach((pid, i) => {
    const pts  = POINTS_TABLE[i] || 0;
    const cp   = CS.players.find(p => p.id === pid);
    const team = TEAMS.find(t => t.id === cp.teamId);
    const chip = document.createElement('div');
    chip.className = 'pts-chip';
    chip.innerHTML = `
      <div class="pts-chip-dot" style="background:${team.color}"></div>
      <span>${cp.name}</span>
      <span class="pts-chip-pts">+${pts}</span>`;
    ptsEl.appendChild(chip);
  });

  // Podium (top 3)
  const podiumEl = document.getElementById('finish-podium');
  podiumEl.innerHTML = '';
  const top3    = finishOrder.slice(0, 3).map(pid => CS.players.find(p => p.id === pid));
  const visual  = [top3[1], top3[0], top3[2]]; // 2nd | 1st | 3rd
  const clsMap  = ['p2','p1','p3'];
  const ranks   = [2, 1, 3];
  visual.forEach((cp, vi) => {
    if (!cp) return;
    const team = TEAMS.find(t => t.id === cp.teamId);
    const item = document.createElement('div');
    item.className = 'podium-item';
    item.innerHTML = `
      <div class="podium-token" style="background:${team.color}">${cp.number}</div>
      <div class="podium-name">${cp.name}</div>
      <div class="podium-block ${clsMap[vi]}">${ranks[vi]}</div>`;
    podiumEl.appendChild(item);
  });

  // Full standings
  const fullEl = document.getElementById('finish-full-standings');
  fullEl.innerHTML = '';
  finishOrder.forEach((pid, i) => {
    const pos  = i + 1;
    const cp   = CS.players.find(p => p.id === pid);
    const team = TEAMS.find(t => t.id === cp.teamId);
    const pts  = POINTS_TABLE[i] || 0;
    const rp   = RS.racePlayers.find(p => p.id === pid);
    const startRank = rp?.startGridRank ?? '?';
    const delta = rp ? (rp.startGridRank - pos) : 0; // positive = gained positions
    const deltaStr = delta > 0 ? `<span class="pos-gain">▲${delta}</span>`
                   : delta < 0 ? `<span class="pos-loss">▼${Math.abs(delta)}</span>`
                   : `<span class="pos-same">●0</span>`;
    const row  = document.createElement('div');
    row.className = 'finish-row';
    row.innerHTML = `
      <div class="finish-row-pos ${pos<=3?'pos-'+pos:''}">${pos}</div>
      <div class="finish-row-dot" style="background:${team.color}"></div>
      <div class="finish-row-name">${cp.name}</div>
      <div class="finish-row-start">P${startRank}</div>
      <div class="finish-row-delta">${deltaStr}</div>
      <div class="finish-row-pts">+${pts}</div>`;
    fullEl.appendChild(row);
  });
  // Crashed players at the bottom
  crashedIds.forEach(pid => {
    const cp   = CS.players.find(p => p.id === pid);
    const team = TEAMS.find(t => t.id === cp.teamId);
    const rp   = RS.racePlayers.find(p => p.id === pid);
    const startRank = rp?.startGridRank ?? '?';
    const row  = document.createElement('div');
    row.className = 'finish-row finish-row-crash';
    row.innerHTML = `
      <div class="finish-row-pos" style="color:#ff4444">💥</div>
      <div class="finish-row-dot" style="background:${team.color};opacity:0.5"></div>
      <div class="finish-row-name" style="opacity:0.6;text-decoration:line-through">${cp.name}</div>
      <div class="finish-row-start" style="opacity:0.5">P${startRank}</div>
      <div class="finish-row-delta"><span class="pos-loss">CRASH</span></div>
      <div class="finish-row-pts" style="color:#ff4444">0</div>`;
    fullEl.appendChild(row);
  });

  // Show/hide "Next Circuit" based on remaining
  const nextBtn  = document.getElementById('next-circuit-btn');
  const isLast   = CS.currentCircuit >= TOTAL_CIRCUITS;
  nextBtn.textContent = isLast ? '🏆 LIHAT FINAL RECAP' : '🏁 NEXT CIRCUIT';

  overlay.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  CHAMPIONSHIP SCREEN
// ─────────────────────────────────────────────────────────────
function renderChampionshipScreen(isFinal = false) {
  showScreen('championship-screen');

  document.getElementById('champ-progress-label').textContent =
    `Ronde ${CS.currentCircuit}/${TOTAL_CIRCUITS}${isFinal ? ' — CHAMPIONSHIP SELESAI!' : ''}`;

  const champTitle = document.getElementById('champ-title');
  champTitle.textContent = isFinal ? '🏆 FINAL CHAMPIONSHIP' : 'WORLD CHAMPIONSHIP';

  renderDriverStandings();
  renderConstructorStandings();
  renderCircuitResultsList();
  renderChampFooter(isFinal);
  renderFinalBanner(isFinal);
}

function renderDriverStandings() {
  const el = document.getElementById('driver-standings');
  el.innerHTML = '';

  // Header row
  const hdr = document.createElement('div');
  hdr.className = 'driver-row driver-row-header';
  hdr.innerHTML = `<div></div><div></div><div>DRIVER</div><div>WIN</div><div>🥇</div><div>🥈🥉</div><div style="text-align:right">PTS</div>`;
  el.appendChild(hdr);

  const sorted = [...CS.players].sort((a, b) => b.totalPts - a.totalPts);
  sorted.forEach((cp, i) => {
    const pos  = i + 1;
    const team = TEAMS.find(t => t.id === cp.teamId);
    const row  = document.createElement('div');
    row.className = 'driver-row' + (i === 0 ? ' driver-leader' : '');
    row.dataset.teamId = cp.teamId;
    row.innerHTML = `
      <div class="driver-row-pos ${pos<=3?'pos-'+pos:''}">${pos}</div>
      <div class="driver-row-dot" style="background:${team.color};width:10px;height:10px;border-radius:50%"></div>
      <div class="driver-row-name">${cp.name} (${cp.number})<br><span style="font-size:10px;color:var(--text-dim);font-weight:400">${team.name}</span></div>
      <div class="driver-stat gold">${cp.wins}</div>
      <div class="driver-stat gold">${cp.podiums[0]}</div>
      <div class="driver-stat silver">${cp.podiums[1] + cp.podiums[2]}</div>
      <div class="driver-pts">${cp.totalPts}</div>`;
    el.appendChild(row);
  });
}

function renderConstructorStandings() {
  const el = document.getElementById('constructor-standings');
  el.innerHTML = '';

  // Aggregate team points
  const teamPts = {};
  TEAMS.forEach(t => { teamPts[t.id] = 0; });
  CS.players.forEach(cp => { teamPts[cp.teamId] += cp.totalPts; });

  const sorted = [...TEAMS].sort((a, b) => teamPts[b.id] - teamPts[a.id]);
  sorted.forEach((team, i) => {
    const pos = i + 1;
    const row = document.createElement('div');
    row.className = 'constructor-row' + (i === 0 ? ' constructor-leader' : '');
    row.dataset.teamId = team.id;
    row.innerHTML = `
      <div class="constructor-pos ${pos<=3?'pos-'+pos:''}">${pos}</div>
      <div style="width:6px;height:28px;border-radius:3px;background:${team.color};box-shadow:0 0 8px ${team.color}"></div>
      <div class="constructor-name">${team.name.toUpperCase()}</div>
      <div class="constructor-pts">${teamPts[team.id]}</div>`;

    // Hover: glow matching driver rows in driver standings
    row.addEventListener('mouseenter', () => {
      document.querySelectorAll('#driver-standings .driver-row[data-team-id]').forEach(dr => {
        if (dr.dataset.teamId === team.id) {
          dr.style.boxShadow = `0 0 0 2px ${team.color}, 0 0 18px ${team.color}88`;
          dr.style.background = `rgba(${hexToRgb(team.color)}, 0.18)`;
          dr.style.transform = 'scale(1.02)';
          dr.style.transition = 'all 0.2s ease';
          dr.style.zIndex = '2';
        } else {
          dr.style.opacity = '0.35';
          dr.style.transition = 'opacity 0.2s ease';
        }
      });
    });
    row.addEventListener('mouseleave', () => {
      document.querySelectorAll('#driver-standings .driver-row[data-team-id]').forEach(dr => {
        dr.style.boxShadow = '';
        dr.style.background = '';
        dr.style.transform = '';
        dr.style.opacity = '';
        dr.style.zIndex = '';
      });
    });

    el.appendChild(row);
  });
}

function renderCircuitResultsList() {
  const el = document.getElementById('circuit-results-list');
  el.innerHTML = '';

  CIRCUITS.forEach((name, i) => {
    const result = CS.circuitResults.find(r => r.circuitIdx === i);
    const row    = document.createElement('div');
    row.className = 'circuit-result-row';

    let rightContent = '';
    if (result) {
      const winnerId = result.finishOrder[0];
      const cp       = CS.players.find(p => p.id === winnerId);
      const team     = TEAMS.find(t => t.id === cp.teamId);
      rightContent = `
        <div class="circuit-result-winner">
          <div class="circuit-result-dot" style="background:${team.color}"></div>
          <span>${cp.name}</span>
          <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--accent)">+25</span>
        </div>`;
    } else if (i === CS.currentCircuit) {
      rightContent = `<span style="color:var(--accent);font-size:11px;font-weight:700;font-family:'Orbitron',sans-serif">▶ NOW</span>`;
    } else {
      rightContent = `<span class="circuit-result-pending">—</span>`;
    }

    row.innerHTML = `
      <div class="circuit-result-round">${i+1}</div>
      <div class="circuit-result-name">${name}</div>
      ${rightContent}`;
    el.appendChild(row);
  });
}

function startNextSeason() {
  // Preserve player data but start a fresh championship with same players (editable)
  const prevPlayers = CS.players.map(p => ({ ...p }));

  showScreen('setup-screen');

  // Update setup header to show it's a new season
  const desc = document.querySelector('#setup-screen .setup-desc');
  if (desc) {
    desc.innerHTML = `Musim baru! Edit pemain &amp; tim jika ada perpindahan — <strong>15 sirkuit</strong> menanti`;
  }

  buildSetupUI(prevPlayers);
}

function renderChampFooter(isFinal) {
  const footer = document.getElementById('champ-footer');
  footer.innerHTML = '';

  if (isFinal) {
    const home = document.createElement('button');
    home.className = 'btn-to-home';
    home.innerHTML = '🏠 MAIN MENU';
    home.addEventListener('click', () => { renderHome(); });
    footer.appendChild(home);

    const nextSeason = document.createElement('button');
    nextSeason.className = 'btn-continue-race';
    nextSeason.innerHTML = '🔄 NEXT SEASON';
    nextSeason.addEventListener('click', () => { startNextSeason(); });
    footer.appendChild(nextSeason);

    const newGame = document.createElement('button');
    newGame.className = 'btn-to-home';
    newGame.style.cssText = 'background:transparent;border-color:var(--text-dim);color:var(--text-dim)';
    newGame.innerHTML = '🚀 NEW CHAMPIONSHIP';
    newGame.addEventListener('click', () => { showScreen('setup-screen'); buildSetupUI(); });
    footer.appendChild(newGame);
  } else {
    const cont = document.createElement('button');
    cont.className = 'btn-continue-race';
    cont.innerHTML = `🏁 LANJUT — ${CIRCUITS[CS.currentCircuit].toUpperCase()}`;
    cont.addEventListener('click', () => { startNextCircuit(); });
    footer.appendChild(cont);

    const home = document.createElement('button');
    home.className = 'btn-to-home';
    home.innerHTML = '🏠 MAIN MENU';
    home.addEventListener('click', () => { renderHome(); });
    footer.appendChild(home);
  }
}

function renderFinalBanner(isFinal) {
  const banner = document.getElementById('final-champion-banner');
  if (!isFinal) { banner.classList.add('hidden'); return; }

  const champion = [...CS.players].sort((a, b) => b.totalPts - a.totalPts)[0];
  const team     = TEAMS.find(t => t.id === champion.teamId);
  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div style="font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:.3em;color:var(--text-dim);margin-bottom:6px">WORLD CHAMPION</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap">
      <div style="width:48px;height:48px;border-radius:50%;background:${team.color};display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;color:#fff;box-shadow:0 0 20px ${team.color}">${champion.number}</div>
      <div>
        <div style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900;color:var(--accent)">${champion.name}</div>
        <div style="font-size:13px;color:var(--text-secondary);font-weight:600">${team.name.toUpperCase()} · ${champion.totalPts} PTS</div>
      </div>
      <span style="font-size:48px;filter:drop-shadow(0 0 20px rgba(232,180,0,.8))">🏆</span>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const old = document.getElementById('toast-notif');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast-notif';
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:#0f1628;border:1px solid #e8b400;border-radius:8px;padding:9px 20px;
    font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;color:#e8b400;
    z-index:500;box-shadow:0 4px 20px rgba(232,180,0,.25);animation:fadeInUp .3s ease;`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; }, 1800);
  setTimeout(() => t.remove(), 2200);
}

// ─────────────────────────────────────────────────────────────
//  INJECT GLOBAL CSS ANIMATIONS
// ─────────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
  @keyframes fadeInUp {
    from { opacity:0; transform:translateX(-50%) translateY(10px); }
    to   { opacity:1; transform:translateX(-50%) translateY(0); }
  }
  .log-crash {
    color: #ff4444 !important;
    font-weight: 700;
    background: rgba(255,68,68,0.08);
    border-left: 3px solid #ff4444;
    padding-left: 6px;
  }
  @keyframes crashFlash {
    0%   { background: rgba(255,50,50,0.8); transform: scale(1.15); }
    50%  { background: rgba(255,50,50,0.4); transform: scale(1.05); }
    100% { background: ''; transform: scale(1); }
  }
  .cell-crash {
    animation: crashFlash 1.2s ease forwards;
    box-shadow: 0 0 20px rgba(255,50,50,0.9) !important;
  }
  .finish-row-crash {
    background: rgba(255,68,68,0.05);
    border-left: 2px solid rgba(255,68,68,0.4);
  }
`;
document.head.appendChild(_style);

// ─────────────────────────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── HOME ──
  document.getElementById('btn-new-game').addEventListener('click', () => {
    const desc = document.querySelector('#setup-screen .setup-desc');
    if (desc) desc.innerHTML = `Daftarkan 10 pemain — <strong>15 sirkuit</strong> menanti`;
    showScreen('setup-screen');
    buildSetupUI();
  });

  document.getElementById('btn-load-game').addEventListener('click', () => {
    renderSavedGamesList();
  });

  // ── SETUP ──
  document.getElementById('btn-back-home').addEventListener('click', () => {
    const desc = document.querySelector('#setup-screen .setup-desc');
    if (desc) desc.innerHTML = `Daftarkan 10 pemain — <strong>15 sirkuit</strong> menanti`;
    renderHome();
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    initNewChampionship();
  });

  // ── QUALIFYING ──
  document.getElementById('qual-roll-btn').addEventListener('click', handleQualTurn);

  document.getElementById('qual-start-race-btn').addEventListener('click', () => {
    startRaceAfterQualifying();
  });

  // ── GAME ──
  document.getElementById('roll-btn').addEventListener('click', handleTurn);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight') {
        handleTurn();
    }
  }); 

  document.getElementById('exit-btn').addEventListener('click', () => {
    if (confirm('Kembali ke menu? Progress race ini belum tersimpan, tapi championship sudah disimpan.')) {
      renderHome();
    }
  });

  // Race result modal buttons
  document.getElementById('next-circuit-btn').addEventListener('click', () => {
    document.getElementById('race-result-overlay').classList.add('hidden');
    if (CS.currentCircuit >= TOTAL_CIRCUITS) {
      renderChampionshipScreen(true);
    } else {
      startNextCircuit();
    }
  });

  document.getElementById('view-championship-btn').addEventListener('click', () => {
    document.getElementById('race-result-overlay').classList.add('hidden');
    renderChampionshipScreen(CS.currentCircuit >= TOTAL_CIRCUITS);
  });

  // ── CHAMPIONSHIP ──
  document.getElementById('champ-back-btn').addEventListener('click', () => {
    // If in middle of championship, go back to game screen with result modal visible
    if (CS.currentCircuit > 0 && CS.currentCircuit <= TOTAL_CIRCUITS) {
      showScreen('game-screen');
      // Re-show the race result overlay if it was dismissed to view standings
      const overlay = document.getElementById('race-result-overlay');
      overlay.classList.remove('hidden');
    } else {
      renderHome();
    }
  });

  // Initial state
  renderHome();
});
