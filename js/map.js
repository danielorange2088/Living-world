// ─────────────────────────────────────────────────────────────
// MAP ENGINE v2 — Tile grid, land types, ink expansion system
// ─────────────────────────────────────────────────────────────
const MapEngine = (() => {

  // ── CONFIG ────────────────────────────────────
  const TILE = 18;          // px per tile
  const COLS = 120;
  const ROWS = 60;
  const MAP_W = COLS * TILE;
  const MAP_H = ROWS * TILE;

  let canvas, ctx, wrap;
  let cam = { x:0, y:0, scale:1, dragging:false, lx:0, ly:0 };

  // Tile grid: each cell = { land, resource, owner, hasBuilder, hasTrader }
  let grid = [];

  // Ink painting state
  let inkMode   = false;
  let inkPainting = false;

  // Callbacks set by game
  let onTilePainted = null;  // (tile, cost) => void
  let onTileHover   = null;  // (tile) => void

  // Player color for painting
  let playerColor = '#c0392b';
  let playerGovId = 'tribal';

  // ── INIT ──────────────────────────────────────
  function init(canvasEl, wrapEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    wrap   = wrapEl;
    resize();
    generateGrid();
    centerMap();
    bindEvents();
    draw();
  }

  function resize() {
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    draw();
  }

  function centerMap() {
    cam.scale = Math.max(canvas.width / MAP_W, canvas.height / MAP_H) * 0.9;
    cam.x = (canvas.width  - MAP_W * cam.scale) / 2;
    cam.y = (canvas.height - MAP_H * cam.scale) / 2;
  }

  // ── GRID GENERATION ───────────────────────────
  function generateGrid() {
    // Simple noise for terrain
    const noise = makeNoise(COLS, ROWS, 42);
    const tempN  = makeNoise(COLS, ROWS, 99);

    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      const lat = Math.abs((r / ROWS) - 0.5) * 2;
      for (let c = 0; c < COLS; c++) {
        const h = noise[r][c];
        const t = 1 - lat * 0.85 - h * 0.2 + tempN[r][c] * 0.1;
        let landId;

        if (h < 0.32)       landId = 'ocean';
        else if (h < 0.38)  landId = 'coast';
        else if (h > 0.80)  landId = t < 0.3 ? 'mountain' : 'mountain';
        else if (t < 0.22)  landId = 'tundra';
        else if (t > 0.85 && h < 0.65) landId = 'desert';
        else if (h > 0.65)  landId = 'hills';
        else if (Math.random() < 0.38) landId = 'forest';
        else                landId = 'plains';

        grid[r][c] = {
          r, c,
          land: LAND_TYPES[landId],
          resource: null,
          owner: null,      // null = unclaimed, 'player' = player
          hasBuilder: false,
          hasTrader: false,
        };
      }
    }

    placeResources();
  }

  function makeNoise(cols, rows, seed) {
    // Simple seeded value noise with smoothing
    let s = seed;
    const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s>>>0)/0xffffffff; };
    const raw = Array.from({length:rows}, () => Array.from({length:cols}, rng));
    const out = Array.from({length:rows}, () => new Array(cols).fill(0));
    const r = 4;
    for (let y=0;y<rows;y++) for (let x=0;x<cols;x++) {
      let sum=0,cnt=0;
      for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++) {
        const ny=y+dy,nx=x+dx;
        if (ny>=0&&ny<rows&&nx>=0&&nx<cols){sum+=raw[ny][nx];cnt++;}
      }
      out[y][x]=sum/cnt;
    }
    return out;
  }

  function placeResources() {
    for (const [rid, res] of Object.entries(RESOURCES)) {
      // Place several clusters
      const attempts = Math.floor(COLS * ROWS * res.rarity / res.clusterMin);
      for (let a = 0; a < attempts; a++) {
        const cr = Math.floor(Math.random() * ROWS);
        const cc = Math.floor(Math.random() * COLS);
        const tile = grid[cr]?.[cc];
        if (!tile || !res.spawnOn.includes(tile.land.id)) continue;

        // Place cluster
        const size = res.clusterMin + Math.floor(Math.random() * (res.clusterMax - res.clusterMin));
        const visited = [[cr, cc]];
        tile.resource = rid;
        for (let i = 1; i < size; i++) {
          const [pr, pc] = visited[Math.floor(Math.random() * visited.length)];
          const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
          dirs.sort(() => Math.random()-0.5);
          for (const [dr,dc] of dirs) {
            const nr=pr+dr, nc=pc+dc;
            if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&grid[nr][nc].resource===null
                &&res.spawnOn.includes(grid[nr][nc].land.id)) {
              grid[nr][nc].resource = rid;
              visited.push([nr,nc]);
              break;
            }
          }
        }
      }
    }
  }

  // ── PLAYER SPAWN ──────────────────────────────
  // Safe land spawns (normalized coords)
  const LAND_SPAWNS = [
    [0.14,0.30],[0.17,0.35],[0.20,0.40],[0.13,0.44],[0.22,0.46],
    [0.24,0.55],[0.27,0.62],[0.22,0.58],[0.25,0.68],
    [0.46,0.24],[0.48,0.27],[0.50,0.25],[0.45,0.29],[0.52,0.28],
    [0.44,0.33],[0.49,0.31],[0.47,0.22],[0.54,0.23],
    [0.48,0.42],[0.50,0.50],[0.52,0.55],[0.46,0.47],[0.54,0.43],
    [0.49,0.60],[0.51,0.64],[0.48,0.53],
    [0.56,0.35],[0.58,0.37],[0.60,0.33],
    [0.62,0.23],[0.65,0.27],[0.68,0.29],[0.72,0.31],[0.75,0.33],
    [0.70,0.21],[0.78,0.27],[0.64,0.33],[0.80,0.23],[0.74,0.25],
    [0.66,0.41],[0.68,0.45],[0.70,0.43],[0.72,0.41],
    [0.74,0.45],[0.76,0.43],[0.78,0.47],
    [0.80,0.61],[0.84,0.59],[0.82,0.65],[0.78,0.63],
    [0.60,0.17],[0.65,0.15],[0.70,0.15],[0.75,0.17],
    [0.62,0.29],[0.64,0.27],
  ];

  function placePlayerCapital(cityName, color, govId) {
    playerColor = color;
    playerGovId = govId;

    // Pick a random land spawn and find nearest passable tile
    let spawn = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const [nx, ny] = LAND_SPAWNS[Math.floor(Math.random() * LAND_SPAWNS.length)];
      const r = Math.floor(ny * ROWS);
      const c = Math.floor(nx * COLS);
      if (grid[r]?.[c]?.land?.claimable) {
        spawn = { r, c };
        break;
      }
    }
    if (!spawn) spawn = { r: 30, c: 60 };

    // Claim starting tiles (3x3 around capital)
    for (let dr=-2; dr<=2; dr++) for (let dc=-2; dc<=2; dc++) {
      const nr=spawn.r+dr, nc=spawn.c+dc;
      if (grid[nr]?.[nc]?.land?.claimable) grid[nr][nc].owner = 'player';
    }
    grid[spawn.r][spawn.c].isCapital = true;
    grid[spawn.r][spawn.c].cityName  = cityName;

    panTo(spawn.r, spawn.c);
    draw();
    return spawn;
  }

  function panTo(r, c) {
    const tx = c * TILE + TILE/2;
    const ty = r * TILE + TILE/2;
    cam.x = canvas.width/2  - tx * cam.scale;
    cam.y = canvas.height/2 - ty * cam.scale;
    clampCam();
  }

  // ── INK PAINTING ──────────────────────────────
  function setInkMode(active) {
    inkMode = active;
    wrap.style.cursor = active ? 'crosshair' : 'grab';
  }

  function getInkCostForTile(tile) {
    if (!tile.land.claimable) return Infinity;
    const gov = GOVERNMENTS[playerGovId];
    return gov.inkCosts[tile.land.id] ?? 2;
  }

  function tryPaintTile(r, c) {
    const tile = grid[r]?.[c];
    if (!tile || tile.owner === 'player') return 0;
    if (!tile.land.claimable) return 0;

    // Must be adjacent to existing player territory
    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    const adjacent = dirs.some(([dr,dc]) => grid[r+dr]?.[c+dc]?.owner === 'player');
    if (!adjacent) return 0;

    const cost = getInkCostForTile(tile);
    if (onTilePainted) onTilePainted(tile, cost);
    return cost;
  }

  // Called by game when a tile is confirmed painted
  function claimTile(r, c) {
    if (grid[r]?.[c]) grid[r][c].owner = 'player';
    draw();
  }

  // Auto-expand: claim tiles adjacent to player territory
  function autoExpand(inkAmount) {
    const candidates = [];
    for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
      if (grid[r][c].owner !== 'player') continue;
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr,dc] of dirs) {
        const nr=r+dr,nc=c+dc;
        if (grid[nr]?.[nc]?.land?.claimable && grid[nr][nc].owner !== 'player') {
          candidates.push({r:nr,c:nc,cost:getInkCostForTile(grid[nr][nc])});
        }
      }
    }
    candidates.sort((a,b) => a.cost - b.cost);
    let used = 0;
    for (const t of candidates) {
      if (used + t.cost > inkAmount) break;
      grid[t.r][t.c].owner = 'player';
      used += t.cost;
    }
    draw();
    return used;
  }

  // Count player tiles
  function getPlayerTileCount() {
    let n = 0;
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c].owner==='player') n++;
    return n;
  }

  // Count player resource tiles
  function getPlayerResources() {
    const res = {};
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const t = grid[r][c];
      if (t.owner==='player' && t.resource && t.hasBuilder) {
        res[t.resource] = (res[t.resource]||0) + 1;
      }
    }
    return res;
  }

  // ── DRAWING ───────────────────────────────────
  function draw() {
    if (!canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.scale, cam.scale);

    drawTiles();
    drawGrid();
    drawResources();
    drawCities();
    drawUnits();
    drawBorders();

    ctx.restore();
  }

  function drawTiles() {
    const sc = Math.max(0, Math.floor(-cam.x / (TILE*cam.scale)));
    const ec = Math.min(COLS, Math.ceil((-cam.x + canvas.width)  / (TILE*cam.scale)) + 1);
    const sr = Math.max(0, Math.floor(-cam.y / (TILE*cam.scale)));
    const er = Math.min(ROWS, Math.ceil((-cam.y + canvas.height) / (TILE*cam.scale)) + 1);

    for (let r=sr; r<er; r++) {
      for (let c=sc; c<ec; c++) {
        const tile = grid[r][c];
        const x = c * TILE, y = r * TILE;

        // Base terrain color
        ctx.fillStyle = tile.land.color;
        ctx.fillRect(x, y, TILE, TILE);

        // Player ownership overlay
        if (tile.owner === 'player') {
          ctx.fillStyle = playerColor + '30';
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  function drawGrid() {
    // Only draw grid lines at higher zoom
    if (cam.scale < 1.2) return;
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    const sc = Math.max(0, Math.floor(-cam.x / (TILE*cam.scale)));
    const ec = Math.min(COLS, Math.ceil((-cam.x + canvas.width)  / (TILE*cam.scale)) + 1);
    const sr = Math.max(0, Math.floor(-cam.y / (TILE*cam.scale)));
    const er = Math.min(ROWS, Math.ceil((-cam.y + canvas.height) / (TILE*cam.scale)) + 1);
    for (let r=sr; r<er; r++) {
      for (let c=sc; c<ec; c++) {
        ctx.strokeRect(c*TILE, r*TILE, TILE, TILE);
      }
    }
  }

  function drawResources() {
    if (cam.scale < 0.8) return;
    const fontSize = Math.max(8, Math.min(14, TILE * 0.65));
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const t = grid[r][c];
      if (!t.resource) continue;
      const res = RESOURCES[t.resource];
      ctx.fillText(res.icon, c*TILE + TILE/2, r*TILE + TILE/2);
    }
  }

  function drawCities() {
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const t = grid[r][c];
      if (!t.cityName) continue;
      const x = c*TILE + TILE/2;
      const y = r*TILE + TILE/2;

      // City dot
      ctx.beginPath();
      ctx.arc(x, y, TILE*0.35, 0, Math.PI*2);
      ctx.fillStyle = '#f2e8d0';
      ctx.fill();
      ctx.strokeStyle = playerColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Star
      if (t.isCapital) drawStar(x, y, TILE*0.28, TILE*0.14, 5);

      // Label
      if (cam.scale >= 1.0) {
        ctx.fillStyle = '#1a1208';
        ctx.font = `bold ${Math.max(7, TILE*0.55)}px "Cinzel", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(t.cityName, x, y + TILE*0.45);
      }
    }
  }

  function drawUnits() {
    if (cam.scale < 0.9) return;
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const t = grid[r][c];
      if (t.hasBuilder) {
        ctx.font = `${TILE*0.6}px serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('🪚', c*TILE + TILE - 1, r*TILE + TILE - 1);
      }
      if (t.hasTrader) {
        ctx.font = `${TILE*0.6}px serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('🐪', c*TILE + 1, r*TILE + TILE - 1);
      }
    }
  }

  function drawBorders() {
    ctx.lineWidth = 1.8;
    for (let r=0;r<ROWS;r++) {
      for (let c=0;c<COLS;c++) {
        const t = grid[r][c];
        if (t.owner !== 'player') continue;
        const x = c*TILE, y = r*TILE;

        // Draw border on edges that face non-player tiles
        const edges = [
          { dr:-1, dc:0, x1:x, y1:y, x2:x+TILE, y2:y },
          { dr:1,  dc:0, x1:x, y1:y+TILE, x2:x+TILE, y2:y+TILE },
          { dr:0,  dc:-1,x1:x, y1:y, x2:x, y2:y+TILE },
          { dr:0,  dc:1, x1:x+TILE, y1:y, x2:x+TILE, y2:y+TILE },
        ];
        for (const e of edges) {
          const nb = grid[r+e.dr]?.[c+e.dc];
          if (!nb || nb.owner !== 'player') {
            ctx.strokeStyle = playerColor + 'cc';
            ctx.beginPath();
            ctx.moveTo(e.x1, e.y1);
            ctx.lineTo(e.x2, e.y2);
            ctx.stroke();
          }
        }
      }
    }
  }

  function drawStar(cx, cy, outerR, innerR, pts) {
    ctx.beginPath();
    for (let i=0;i<pts*2;i++) {
      const r = i%2===0?outerR:innerR;
      const a = (i*Math.PI)/pts - Math.PI/2;
      i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = '#d4a017';
    ctx.fill();
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // ── CAMERA & INPUT ────────────────────────────
  function screenToTile(sx, sy) {
    const mx = (sx - cam.x) / cam.scale;
    const my = (sy - cam.y) / cam.scale;
    const c  = Math.floor(mx / TILE);
    const r  = Math.floor(my / TILE);
    if (r>=0&&r<ROWS&&c>=0&&c<COLS) return grid[r][c];
    return null;
  }

  function clampCam() {
    const minX = canvas.width  - MAP_W * cam.scale - 20;
    const minY = canvas.height - MAP_H * cam.scale - 20;
    cam.x = Math.max(minX, Math.min(20, cam.x));
    cam.y = Math.max(minY, Math.min(20, cam.y));
  }

  function bindEvents() {
    wrap.addEventListener('mousedown', e => {
      if (inkMode) {
        inkPainting = true;
        const rect = wrap.getBoundingClientRect();
        const t = screenToTile(e.clientX - rect.left, e.clientY - rect.top);
        if (t) tryPaintTile(t.r, t.c);
      } else {
        cam.dragging = true;
        cam.lx = e.clientX; cam.ly = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      cam.dragging = false;
      inkPainting = false;
    });

    window.addEventListener('mousemove', e => {
      const rect = wrap.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (cam.dragging && !inkMode) {
        cam.x += e.clientX - cam.lx;
        cam.y += e.clientY - cam.ly;
        cam.lx = e.clientX; cam.ly = e.clientY;
        clampCam();
        draw();
      }

      if (inkMode && inkPainting) {
        const t = screenToTile(sx, sy);
        if (t) tryPaintTile(t.r, t.c);
      }

      // Hover info
      const t = screenToTile(sx, sy);
      if (onTileHover) onTileHover(t, e);
    });

    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.88 : 1.14;
      const ns = Math.max(0.4, Math.min(5, cam.scale * delta));
      cam.x = mx - (mx - cam.x) * (ns / cam.scale);
      cam.y = my - (my - cam.y) * (ns / cam.scale);
      cam.scale = ns;
      clampCam();
      draw();
    }, { passive:false });

    wrap.addEventListener('mouseleave', () => {
      inkPainting = false;
      if (onTileHover) onTileHover(null, null);
    });
  }

  return {
    init, resize, draw,
    placePlayerCapital,
    setInkMode,
    claimTile,
    autoExpand,
    getPlayerTileCount,
    getPlayerResources,
    getGrid: () => grid,
    setOnTilePainted: (fn) => { onTilePainted = fn; },
    setOnTileHover:   (fn) => { onTileHover   = fn; },
    setPlayerColor:   (c)  => { playerColor   = c;  },
    setPlayerGov:     (g)  => { playerGovId   = g;  },
  };
})();
