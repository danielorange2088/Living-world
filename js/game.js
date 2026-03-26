// ─────────────────────────────────────────────────────────────
// GAME ENGINE v2 — Ink expansion, resources, units, turn logic
// ─────────────────────────────────────────────────────────────
const Game = (() => {

  let state = {
    started:  false,
    turn:     0,
    year:    -3000,
    yearPerTurn: 50,

    nation: {
      name: '', capitalName: '', government: null, flagColors: [],
      gold: 100, food: 80, population: 200,
      stability: 75, military: 20, research: 0,
      production: 0,
      incGold: 8, incFood: 6, incMilitary: 1, incProduction: 2,
      cities: [], tiles: 0, culturalUnity: 80,
      resources: {},      // { timber:2, stone:1, ... } active (has builder)
    },

    ink: {
      current: 0,
      max: 0,
      paintQueue: [],  // tiles confirmed painted this turn
    },

    units: [],           // { type, r, c, id }
    breakawayNations: [],
    events: [],
  };

  // ── START ─────────────────────────────────────
  function startGame(nationName, capitalName, govId, flagColors) {
    const gov = GOVERNMENTS[govId];
    const n   = state.nation;

    n.name        = nationName;
    n.capitalName = capitalName;
    n.government  = gov;
    n.flagColors  = flagColors;
    n.stability   = govId==='kingship' ? 80 : govId==='polyarchy' ? 70 : 60;
    n.incGold     = Math.round(8 * (govId==='kingship' ? 1.25 : govId==='polyarchy' ? 1.0 : 0.7));
    n.cities      = [{ name:capitalName, isCapital:true, stability:n.stability, loyalty:90, population:200 }];

    // Ink setup
    state.ink.max     = gov.inkSaveMax || gov.inkPerTurn;
    state.ink.current = gov.inkPerTurn;

    state.started = true;
    state.turn    = 1;
    state.year    = -3000;

    addEvent(`The age of ${nationName} has begun. Your capital, ${capitalName}, rises from the earth.`, 'event');
    addEvent(`Government: ${gov.name}. ${getGovFlavor(govId)}`, 'event');
    addEvent(`You have ${state.ink.current} expansion ink. Paint your borders on the map!`, 'event');

    updateUI();
  }

  function getGovFlavor(id) {
    return { tribal:'The elders speak, and the tribe follows.', kingship:'The crown is absolute. Issue Royal Decrees to expand.', polyarchy:'The council debates. Unused ink is saved for future turns.' }[id]||'';
  }

  // ── INK SYSTEM ────────────────────────────────
  // Called by map when player tries to paint a tile
  function handleTilePaint(tile, cost) {
    if (state.ink.current < cost) {
      showToast(`Not enough ink! Need ${cost}, have ${Math.floor(state.ink.current)}.`);
      return;
    }
    state.ink.current -= cost;
    MapEngine.claimTile(tile.r, tile.c);
    state.nation.tiles++;
    updateInkUI();

    // Check if resource tile
    if (tile.resource) {
      addEvent(`✦ New territory contains ${RESOURCES[tile.resource].name}! Place a Builder to extract it.`, 'event');
    }
  }

  function issueRoyalDecree() {
    const gov = state.nation.government;
    if (!gov.royalDecree) return;
    if (state.nation.gold < gov.royalDecreeCost) {
      showToast(`Need ${gov.royalDecreeCost} gold for a Royal Decree.`);
      return;
    }
    state.nation.gold -= gov.royalDecreeCost;
    state.ink.current = Math.min(state.ink.max, state.ink.current + gov.royalDecreeInk);
    addEvent(`⚜ Royal Decree issued. ${gov.royalDecreeInk} expansion ink granted.`, 'event');
    updateUI();
    showToast('Royal Decree issued! Paint your new borders.');
  }

  function refillInk() {
    const gov = state.nation.government;
    if (gov.royalDecree) return; // kingship gets ink from decrees only

    const newInk = gov.inkPerTurn;
    if (gov.inkSaveable) {
      state.ink.current = Math.min(state.ink.max, state.ink.current + newInk);
    } else {
      // Tribal: auto-expand with unused ink, then reset
      const unused = state.ink.current;
      if (unused > 2 && gov.autoExpand) {
        const autoAmount = Math.floor(unused * gov.autoExpandRate);
        if (autoAmount > 0) {
          MapEngine.autoExpand(autoAmount);
          addEvent(`Your people spread outward on their own.`, 'event');
        }
      }
      state.ink.current = newInk;
    }
    updateInkUI();
  }

  // ── END TURN ──────────────────────────────────
  function endTurn() {
    if (!state.started) return;
    state.turn++;
    state.year += state.yearPerTurn;

    const n   = state.nation;
    const gov = n.government;

    // ── Count tiles & resources ──
    n.tiles = MapEngine.getPlayerTileCount();
    const activeRes = MapEngine.getPlayerResources();
    n.resources = activeRes;

    // ── Resource income bonuses ──
    let bonusGold=0, bonusMil=0, bonusProd=0;
    for (const [rid, count] of Object.entries(activeRes)) {
      const res = RESOURCES[rid];
      if (rid==='timber'||rid==='stone') bonusProd += count * res.productionPerTurn;
      if (rid==='iron')   bonusMil  += count * res.productionPerTurn;
      if (rid==='copper') bonusGold += count * res.productionPerTurn;
    }

    // ── Tile income ──
    let tileFood=0, tileGold=0;
    const grid = MapEngine.getGrid();
    for (let r=0;r<grid.length;r++) for (let c=0;c<grid[r].length;c++) {
      const t = grid[r][c];
      if (t.owner!=='player') continue;
      tileFood += t.land.foodMod * 0.1;
      tileGold += t.land.goldMod * 0.08;
    }

    // ── Apply income ──
    n.incGold       = Math.round(8 * (gov.buffs.find(b=>b.stat==='gold_income')?.value||1) + bonusGold + tileGold);
    n.incFood       = Math.round(6 + tileFood);
    n.incProduction = Math.round(2 + bonusProd);
    n.incMilitary   = Math.round(1 + bonusMil);

    n.gold       += n.incGold;
    n.food       += n.incFood;
    n.production += n.incProduction;
    n.military   += n.incMilitary;
    n.population += Math.max(0, Math.floor(n.food / 25));
    n.research   += 2;

    // ── Stability decay ──
    const distPenalty = Math.max(0, (n.tiles / 30 - 1) * 0.5);
    const fundPenalty = n.gold < 20 ? 4 : 0;
    n.stability = Math.max(0, Math.min(100, n.stability - gov.stabilityDecay - distPenalty - fundPenalty));

    // ── Cultural unity ──
    n.culturalUnity = Math.max(0, n.culturalUnity - 0.2 * Math.max(1, n.cities.length * 0.5));

    // ── Refill ink ──
    refillInk();

    // ── Random events ──
    rollEvent();

    // ── Breakoffs ──
    checkBreakoffs();

    // ── Modernization ──
    checkModernization();

    updateUI();
  }

  // ── EVENTS ────────────────────────────────────
  function rollEvent() {
    const n = state.nation;
    if (Math.random() < 0.15) {
      const good = [
        { txt:'A bountiful harvest. Food stores replenished.', fn:()=>{ n.food+=30; n.stability+=3; } },
        { txt:'Merchants arrive bearing coin and exotic goods.', fn:()=>{ n.gold+=25; } },
        { txt:'A period of peace. People are content.', fn:()=>{ n.stability+=5; } },
        { txt:'Young craftsmen improve tool-making techniques.', fn:()=>{ n.production+=15; } },
        { txt:'Scouts discover fertile lands to the east.', fn:()=>{ state.ink.current=Math.min(state.ink.max, state.ink.current+4); } },
      ];
      const bad = [
        { txt:'Drought strikes. Food stores dwindle.', fn:()=>{ n.food=Math.max(0,n.food-25); n.stability-=4; } },
        { txt:'Bandits raid the outskirts. Gold is lost.', fn:()=>{ n.gold=Math.max(0,n.gold-20); } },
        { txt:'Discontent spreads among the people.', fn:()=>{ n.stability-=6; } },
        { txt:'Disease sweeps through the settlements.', fn:()=>{ n.population=Math.max(10,n.population-30); n.stability-=3; } },
        { txt:'A harsh winter damages crops and morale.', fn:()=>{ n.food=Math.max(0,n.food-20); n.stability-=3; } },
      ];
      const pool = Math.random() < 0.55 ? good : bad;
      const ev   = pool[Math.floor(Math.random()*pool.length)];
      ev.fn();
      const isGood = pool === good;
      addEvent((isGood?'✦ ':'⚠ ') + ev.txt, isGood?'event':'warning');
    }
  }

  function checkBreakoffs() {
    const n = state.nation;
    for (let i=n.cities.length-1; i>=0; i--) {
      const city = n.cities[i];
      if (city.isCapital) continue;
      city.loyalty   = Math.max(0, city.loyalty - 1.2 - (n.gold<10?3:0));
      city.stability = Math.max(0, city.stability - n.government.stabilityDecay*0.5);
      let chance = 0;
      if (city.loyalty   < 30) chance += 0.15;
      else if (city.loyalty < 50) chance += 0.06;
      if (n.stability < n.government.breakoffThreshold) chance += 0.08;
      if (n.gold < 10) chance += 0.05;
      if (n.culturalUnity < 40) chance += 0.04;
      if (Math.random() < chance) {
        const newName = city.name + ' ' + ['Republic','Chiefdom','Kingdom','Commune','Alliance'][Math.floor(Math.random()*5)];
        n.cities.splice(i, 1);
        n.stability -= 10;
        n.culturalUnity -= 8;
        state.breakawayNations.push({ name:newName, originCity:city.name, foundedYear:state.year });
        addEvent(`⚔ BREAKAWAY: ${city.name} declares independence! The ${newName} is born.`, 'warning');
      }
    }
  }

  function checkModernization() {
    const gov = state.nation.government;
    if (state.turn === gov.modernizeAt) {
      if (state.nation.stability >= 60) {
        addEvent('🌅 ERA CHANGE: Your civilization has grown. A new form of governance beckons — choose your path forward.', 'event');
      } else {
        addEvent('🔥 ERA CHANGE: Instability has shattered the old ways. The people demand change.', 'warning');
        state.nation.stability = 40;
      }
    }
  }

  // ── UNITS ─────────────────────────────────────
  function recruitUnit(type) {
    const def  = UNIT_TYPES[type];
    const n    = state.nation;
    if (n.gold < (def.cost.gold||0)) { showToast(`Need ${def.cost.gold} gold.`); return; }
    if ((def.cost.production||0) > 0 && n.production < def.cost.production) { showToast(`Need ${def.cost.production} production.`); return; }
    n.gold       -= (def.cost.gold||0);
    n.production -= (def.cost.production||0);
    addEvent(`${def.icon} A new ${def.name} has been recruited.`, 'event');
    updateUI();
    showToast(`${def.name} recruited! Click a tile on the map to place them.`);
    // Placement handled by UI
  }

  // ── UI ────────────────────────────────────────
  function updateUI() {
    if (!state.started) return;
    const n   = state.nation;
    const gov = n.government;

    document.getElementById('nation-name-display').textContent = n.name;
    document.getElementById('gov-display').textContent         = gov.name;
    document.getElementById('year-display').textContent        = formatYear(state.year);

    updateFlagDisplay('topbar-flag', n.flagColors);

    setEl('chip-gold',   Math.floor(n.gold));
    setEl('chip-food',   Math.floor(n.food));
    setEl('chip-pop',    Math.floor(n.population));
    setEl('chip-mil',    Math.floor(n.military));
    setEl('chip-prod',   Math.floor(n.production));

    // Ink bar
    updateInkUI();

    // Sidebar
    const stab = Math.floor(n.stability);
    setEl('sb-stability', stab + '%');
    const fill = document.getElementById('stability-fill');
    if (fill) {
      fill.style.width      = stab + '%';
      fill.style.background = stab>60?'#4a8a4a':stab>35?'#c8a030':'#8b1a1a';
    }
    setEl('sb-unity',     Math.floor(n.culturalUnity) + '%');
    setEl('sb-cities',    n.cities.length);
    setEl('sb-tiles',     n.tiles);
    setEl('sb-breakaway', state.breakawayNations.length);
    setEl('sb-gold-inc',  '+' + n.incGold);
    setEl('sb-food-inc',  '+' + n.incFood);
    setEl('sb-prod-inc',  '+' + n.incProduction);
    setEl('sb-research',  Math.floor(n.research));

    // Resources
    const resEl = document.getElementById('sb-resources');
    if (resEl) {
      const entries = Object.entries(n.resources);
      resEl.innerHTML = entries.length === 0
        ? '<span style="font-style:italic;color:var(--ink-light);font-size:11px;">No builders deployed</span>'
        : entries.map(([id,cnt])=>`<div class="sb-stat"><span>${RESOURCES[id].icon} ${RESOURCES[id].name}</span><span class="sb-val">${cnt}</span></div>`).join('');
    }

    // Royal decree button
    const decreeBtn = document.getElementById('btn-decree');
    if (decreeBtn) {
      decreeBtn.style.display = gov.royalDecree ? 'block' : 'none';
    }

    renderLog();
  }

  function updateInkUI() {
    const ink = state.ink;
    const pct = Math.min(100, (ink.current / (state.nation.government.inkSaveMax || state.nation.government.inkPerTurn || 1)) * 100);
    setEl('ink-count', Math.floor(ink.current));
    const inkFill = document.getElementById('ink-fill');
    if (inkFill) {
      inkFill.style.width = pct + '%';
    }
  }

  function updateFlagDisplay(elId, colors) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = colors.map(c=>`<div class="flag-stripe" style="background:${c}"></div>`).join('');
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function formatYear(y) {
    return y < 0 ? Math.abs(y) + ' BCE' : y + ' CE';
  }

  function addEvent(text, type='normal') {
    state.events.unshift({ text, type, year:state.year, turn:state.turn });
    renderLog();
  }

  function renderLog() {
    const log = document.getElementById('event-log');
    if (!log) return;
    log.innerHTML = state.events.slice(0,30).map(ev=>`
      <div class="log-item ${ev.type}">
        <span class="log-year">${formatYear(ev.year)}</span>
        ${ev.text}
      </div>`).join('');
  }

  return {
    startGame, endTurn,
    handleTilePaint,
    issueRoyalDecree,
    recruitUnit,
    getState: () => state,
    addEvent,
    updateFlagDisplay,
    updateUI,
  };
})();

// Global helper
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2400);
}
