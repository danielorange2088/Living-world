// ─────────────────────────────────────────────────────────────
// MAP ENGINE
// Renders a real-world map using Natural Earth data approximated
// as a painted canvas with territory overlays
// ─────────────────────────────────────────────────────────────

const MapEngine = (() => {
  let canvas, ctx, wrap;
  let cam = { x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 };
  let mapImg = null;
  let mapReady = false;

  // Map logical dimensions (match SVG viewBox)
  const MAP_W = 1800;
  const MAP_H = 900;

  // Territories claimed: { id, cx, cy, radius, color, name, cityName }
  let territories = [];
  let playerTerritory = null;
  let hoveredTerritory = null;

  // Spawn points scattered across land masses (normalized 0-1 coords → pixel)
  // These are approximate land-mass safe spawn locations
  const LAND_SPAWNS = [
    // North America
    [0.14,0.28],[0.17,0.32],[0.20,0.38],[0.13,0.42],[0.22,0.45],
    // South America
    [0.24,0.55],[0.27,0.62],[0.22,0.58],[0.25,0.70],[0.28,0.65],
    // Europe
    [0.46,0.22],[0.48,0.26],[0.50,0.24],[0.45,0.28],[0.52,0.28],
    [0.44,0.32],[0.49,0.30],[0.47,0.20],[0.54,0.22],
    // Africa
    [0.48,0.40],[0.50,0.48],[0.52,0.54],[0.46,0.46],[0.54,0.42],
    [0.49,0.58],[0.51,0.62],[0.48,0.52],
    // Middle East
    [0.56,0.34],[0.58,0.36],[0.60,0.32],[0.57,0.30],
    // Asia
    [0.62,0.22],[0.65,0.26],[0.68,0.28],[0.72,0.30],[0.75,0.32],
    [0.70,0.20],[0.78,0.26],[0.64,0.32],[0.80,0.22],[0.74,0.24],
    [0.66,0.36],[0.70,0.38],[0.76,0.34],
    // South Asia
    [0.66,0.40],[0.68,0.44],[0.70,0.42],[0.72,0.40],
    // Southeast Asia
    [0.74,0.44],[0.76,0.42],[0.78,0.46],[0.80,0.44],
    // Australia
    [0.80,0.60],[0.84,0.58],[0.82,0.64],[0.78,0.62],[0.86,0.62],
    // Russia / Siberia
    [0.60,0.16],[0.65,0.14],[0.70,0.14],[0.75,0.16],[0.80,0.16],
    // Central Asia
    [0.62,0.28],[0.64,0.26],[0.66,0.24],
  ];

  function init(canvasEl, wrapEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    wrap = wrapEl;
    resize();
    loadMap();
    bindEvents();
  }

  function resize() {
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    draw();
  }

  // ── Load the world map image ──
  function loadMap() {
    // Use a high-quality Natural Earth map from a public CDN
    mapImg = new Image();
    mapImg.crossOrigin = 'anonymous';

    // We'll draw our own stylized parchment map programmatically
    // since external images may not load. This gives us full control.
    mapImg = null;
    mapReady = true;
    centerMap();
    draw();
  }

  function centerMap() {
    cam.scale = Math.max(canvas.width / MAP_W, canvas.height / MAP_H) * 0.95;
    cam.x = (canvas.width  - MAP_W * cam.scale) / 2;
    cam.y = (canvas.height - MAP_H * cam.scale) / 2;
  }

  // ── DRAW ──────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.scale, cam.scale);

    drawParchmentMap();
    drawTerritories();
    drawCities();

    ctx.restore();
  }

  // ── PARCHMENT WORLD MAP ───────────────────────
  // A stylized painted world map drawn on canvas
  function drawParchmentMap() {
    // Ocean background
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, MAP_H);
    oceanGrad.addColorStop(0,   '#7ba7bc');
    oceanGrad.addColorStop(0.5, '#6a96ab');
    oceanGrad.addColorStop(1,   '#5a8599');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Ocean texture lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let y = 20; y < MAP_H; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_W, y);
      ctx.stroke();
    }

    // Draw land masses using paths
    ctx.fillStyle = '#c8b882';
    ctx.strokeStyle = '#a09060';
    ctx.lineWidth = 1.5;

    drawLandMasses();

    // Vignette edge
    const vignette = ctx.createRadialGradient(MAP_W/2, MAP_H/2, MAP_H*0.3, MAP_W/2, MAP_H/2, MAP_W*0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Parchment grain overlay
    ctx.fillStyle = 'rgba(242,232,208,0.08)';
    for (let i = 0; i < 1200; i++) {
      ctx.fillRect(
        Math.random() * MAP_W,
        Math.random() * MAP_H,
        Math.random() * 3 + 1,
        Math.random() * 2 + 1
      );
    }

    // Map border
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, MAP_W-4, MAP_H-4);
    ctx.strokeStyle = 'rgba(184,134,11,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, MAP_W-16, MAP_H-16);

    // Cardinal direction labels
    ctx.fillStyle = 'rgba(90,70,30,0.5)';
    ctx.font = 'italic 18px "IM Fell English", serif';
    ctx.textAlign = 'center';
    ctx.fillText('NORTH', MAP_W/2, 24);
    ctx.fillText('SOUTH', MAP_W/2, MAP_H - 8);
    ctx.textAlign = 'left';
    ctx.save();
    ctx.translate(18, MAP_H/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText('WEST', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(MAP_W - 12, MAP_H/2);
    ctx.rotate(Math.PI/2);
    ctx.fillText('EAST', 0, 0);
    ctx.restore();
  }

  function drawLandMasses() {
    // Each land mass is drawn as a filled shape
    // Approximate world continents as bezier paths
    const land = getLandPaths();
    for (const path of land) {
      ctx.beginPath();
      const pts = path;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 2; i++) {
        const xc = (pts[i][0] + pts[i+1][0]) / 2;
        const yc = (pts[i][1] + pts[i+1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
      }
      ctx.quadraticCurveTo(pts[pts.length-2][0], pts[pts.length-2][1], pts[pts.length-1][0], pts[pts.length-1][1]);
      ctx.closePath();

      // Land fill with slight variation
      const grad = ctx.createLinearGradient(0, 0, 0, MAP_H);
      grad.addColorStop(0,   '#d4c494');
      grad.addColorStop(0.5, '#c8b882');
      grad.addColorStop(1,   '#b8a870');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#9a8850';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function getLandPaths() {
    // Approximate continent outlines in MAP_W x MAP_H space
    // Using simplified polygon points
    const W = MAP_W, H = MAP_H;
    return [
      // North America
      [[W*.10,H*.10],[W*.18,H*.08],[W*.26,H*.12],[W*.30,H*.18],[W*.28,H*.28],
       [W*.24,H*.38],[W*.20,H*.50],[W*.18,H*.55],[W*.14,H*.48],[W*.10,H*.40],
       [W*.08,H*.32],[W*.09,H*.22],[W*.10,H*.10]],

      // Greenland
      [[W*.22,H*.04],[W*.28,H*.03],[W*.32,H*.06],[W*.30,H*.14],[W*.24,H*.15],[W*.20,H*.10],[W*.22,H*.04]],

      // South America
      [[W*.20,H*.52],[W*.26,H*.50],[W*.32,H*.52],[W*.34,H*.60],[W*.32,H*.72],
       [W*.28,H*.82],[W*.24,H*.88],[W*.20,H*.82],[W*.18,H*.70],[W*.18,H*.60],[W*.20,H*.52]],

      // Europe
      [[W*.42,H*.12],[W*.50,H*.10],[W*.56,H*.14],[W*.58,H*.20],[W*.54,H*.26],
       [W*.50,H*.32],[W*.46,H*.34],[W*.42,H*.30],[W*.40,H*.24],[W*.42,H*.12]],

      // Scandinavia bump
      [[W*.46,H*.08],[W*.50,H*.06],[W*.52,H*.10],[W*.50,H*.16],[W*.46,H*.14],[W*.46,H*.08]],

      // Africa
      [[W*.44,H*.32],[W*.52,H*.30],[W*.58,H*.34],[W*.62,H*.42],[W*.60,H*.54],
       [W*.56,H*.64],[W*.52,H*.72],[W*.48,H*.74],[W*.44,H*.68],[W*.42,H*.56],
       [W*.42,H*.44],[W*.44,H*.32]],

      // Madagascar
      [[W*.58,H*.56],[W*.60,H*.54],[W*.62,H*.60],[W*.60,H*.66],[W*.57,H*.64],[W*.58,H*.56]],

      // Asia (main)
      [[W*.56,H*.14],[W*.68,H*.10],[W*.80,H*.12],[W*.90,H*.16],[W*.94,H*.24],
       [W*.90,H*.32],[W*.84,H*.38],[W*.78,H*.44],[W*.72,H*.46],[W*.66,H*.44],
       [W*.62,H*.38],[W*.58,H*.30],[W*.56,H*.22],[W*.56,H*.14]],

      // Indian subcontinent
      [[W*.62,H*.38],[W*.68,H*.38],[W*.72,H*.42],[W*.70,H*.52],[W*.66,H*.54],[W*.62,H*.48],[W*.62,H*.38]],

      // Southeast Asia peninsula
      [[W*.72,H*.44],[W*.76,H*.44],[W*.78,H*.52],[W*.74,H*.58],[W*.70,H*.54],[W*.72,H*.44]],

      // Indonesia (simplified)
      [[W*.76,H*.52],[W*.82,H*.50],[W*.86,H*.54],[W*.84,H*.58],[W*.78,H*.58],[W*.76,H*.52]],

      // Japan
      [[W*.86,H*.24],[W*.88,H*.22],[W*.90,H*.26],[W*.88,H*.30],[W*.86,H*.28],[W*.86,H*.24]],

      // Australia
      [[W*.76,H*.56],[W*.84,H*.54],[W*.92,H*.58],[W*.94,H*.66],[W*.88,H*.74],
       [W*.80,H*.76],[W*.74,H*.70],[W*.72,H*.62],[W*.76,H*.56]],

      // New Zealand (tiny)
      [[W*.94,H*.72],[W*.96,H*.70],[W*.97,H*.74],[W*.95,H*.76],[W*.94,H*.72]],

      // UK / British Isles
      [[W*.43,H*.14],[W*.45,H*.12],[W*.46,H*.16],[W*.44,H*.18],[W*.43,H*.14]],

      // Iceland
      [[W*.36,H*.10],[W*.40,H*.09],[W*.42,H*.12],[W*.39,H*.14],[W*.36,H*.12],[W*.36,H*.10]],
    ];
  }

  // ── TERRITORIES ───────────────────────────────
  function drawTerritories() {
    for (const t of territories) {
      const isPlayer = t.isPlayer;
      const isHovered = (hoveredTerritory && hoveredTerritory.id === t.id);

      // Zone of control circle
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = t.color + (isPlayer ? '50' : '35');
      ctx.fill();

      ctx.strokeStyle = t.color + (isPlayer ? 'cc' : '88');
      ctx.lineWidth = isPlayer ? 2.5 : 1.5;
      ctx.setLineDash(isPlayer ? [] : [6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(t.cx, t.cy, t.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,200,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawCities() {
    for (const t of territories) {
      const isPlayer = t.isPlayer;

      // City dot
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, isPlayer ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isPlayer ? '#f2e8d0' : t.color;
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isPlayer) {
        // Star marker for player capital
        drawStar(t.cx, t.cy, 9, 4, 5);
      }

      // City name label
      ctx.fillStyle = isPlayer ? '#1a1208' : 'rgba(26,18,8,0.8)';
      ctx.font = `${isPlayer ? 'bold ' : ''}${isPlayer ? 12 : 10}px "Cinzel", serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.cityName, t.cx, t.cy + (isPlayer ? 22 : 18));
    }
  }

  function drawStar(cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#d4a017';
    ctx.fill();
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // ── SPAWN POINT ───────────────────────────────
  function getRandomSpawn() {
    const idx = Math.floor(Math.random() * LAND_SPAWNS.length);
    const [nx, ny] = LAND_SPAWNS[idx];
    return { cx: nx * MAP_W, cy: ny * MAP_H };
  }

  function placePlayerCity(cityName, nationColor) {
    const spawn = getRandomSpawn();
    const territory = {
      id: 'player',
      isPlayer: true,
      cx: spawn.cx,
      cy: spawn.cy,
      radius: 60,
      color: nationColor,
      cityName: cityName,
    };
    territories = territories.filter(t => !t.isPlayer);
    territories.push(territory);
    playerTerritory = territory;

    // Pan camera to center on spawn
    panToPoint(spawn.cx, spawn.cy);
    draw();
    return spawn;
  }

  function panToPoint(mapX, mapY) {
    cam.x = canvas.width  / 2 - mapX * cam.scale;
    cam.y = canvas.height / 2 - mapY * cam.scale;
    clampCam();
  }

  // ── CAMERA / INPUT ────────────────────────────
  function clampCam() {
    const minX = canvas.width  - MAP_W * cam.scale - 20;
    const minY = canvas.height - MAP_H * cam.scale - 20;
    cam.x = Math.max(minX, Math.min(20, cam.x));
    cam.y = Math.max(minY, Math.min(20, cam.y));
  }

  function screenToMap(sx, sy) {
    return {
      x: (sx - cam.x) / cam.scale,
      y: (sy - cam.y) / cam.scale,
    };
  }

  function bindEvents() {
    wrap.addEventListener('mousedown', e => {
      cam.dragging = true;
      cam.lastX = e.clientX;
      cam.lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => { cam.dragging = false; });

    window.addEventListener('mousemove', e => {
      if (cam.dragging) {
        cam.x += e.clientX - cam.lastX;
        cam.y += e.clientY - cam.lastY;
        cam.lastX = e.clientX;
        cam.lastY = e.clientY;
        clampCam();
        draw();
      }

      // Hover detection
      const rect = wrap.getBoundingClientRect();
      const mp = screenToMap(e.clientX - rect.left, e.clientY - rect.top);
      let found = null;
      for (const t of territories) {
        const dx = mp.x - t.cx, dy = mp.y - t.cy;
        if (Math.sqrt(dx*dx + dy*dy) < t.radius) { found = t; break; }
      }
      if (found !== hoveredTerritory) {
        hoveredTerritory = found;
        draw();
        updateHoverInfo(found, e);
      } else if (found) {
        updateHoverInfo(found, e);
      }
    });

    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.88 : 1.14;
      const newScale = Math.max(0.5, Math.min(4, cam.scale * delta));
      cam.x = mx - (mx - cam.x) * (newScale / cam.scale);
      cam.y = my - (my - cam.y) * (newScale / cam.scale);
      cam.scale = newScale;
      clampCam();
      draw();
    }, { passive: false });

    wrap.addEventListener('mouseleave', () => {
      hoveredTerritory = null;
      draw();
      document.getElementById('map-tooltip').style.display = 'none';
      document.getElementById('hover-info').textContent = 'Pan with mouse · Scroll to zoom';
    });
  }

  function updateHoverInfo(territory, e) {
    const tooltip = document.getElementById('map-tooltip');
    const hoverInfo = document.getElementById('hover-info');
    if (territory) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
      document.getElementById('tt-name').textContent = territory.cityName;
      document.getElementById('tt-body').innerHTML =
        `<div class="tt-row">${territory.isPlayer ? '★ Your Capital' : 'Settlement'}</div>
         <div class="tt-row">Zone radius: ${territory.radius} km</div>`;
      hoverInfo.textContent = territory.cityName + (territory.isPlayer ? ' — Your Capital' : '');
    } else {
      tooltip.style.display = 'none';
      hoverInfo.textContent = 'Pan with mouse · Scroll to zoom';
    }
  }

  return { init, resize, draw, placePlayerCity, getRandomSpawn };
})();
