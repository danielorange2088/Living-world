// ─────────────────────────────────────────────────────────────
// GAME ENGINE — Core state and turn logic
// ─────────────────────────────────────────────────────────────

const Game = (() => {

  // ── STATE ─────────────────────────────────────
  let state = {
    started: false,
    turn: 0,
    year: -3000, // start at 3000 BCE
    yearPerTurn: 50,

    nation: {
      name: '',
      capitalName: '',
      government: null,   // ref to GOVERNMENTS[id]
      flagColors: ['#c0392b', '#f1c40f', '#2980b9'],

      // Core resources
      gold: 100,
      food: 80,
      population: 200,
      stability: 75,    // 0-100
      military: 20,
      research: 0,

      // Income per turn (base, modified by gov buffs)
      incGold: 8,
      incFood: 6,
      incMilitary: 1,

      // Empire metrics
      cities: [],       // { name, cx, cy, stability, loyalty }
      territories: 1,
      culturalUnity: 80, // 0-100, decreases with distance/time
    },

    events: [],
    breakawayNations: [],  // civilizations that broke off
  };

  // ── INIT ──────────────────────────────────────
  function startGame(nationName, capitalName, govId, flagColors) {
    const gov = GOVERNMENTS[govId];

    state.nation.name         = nationName;
    state.nation.capitalName  = capitalName;
    state.nation.government   = gov;
    state.nation.flagColors   = flagColors;

    // Apply government buffs to base income
    state.nation.incGold     = Math.round(8  * (gov.buffs.find(b=>b.stat==='gold_income')?.value || 1));
    state.nation.incFood     = Math.round(6  * (gov.buffs.find(b=>b.stat==='expansion_speed')?.value || 1));
    state.nation.stability   = govId === 'kingship' ? 80 : govId === 'polyarchy' ? 70 : 60;

    state.nation.cities = [{
      name: capitalName,
      isCapital: true,
      stability: state.nation.stability,
      loyalty: 90,
      population: 200,
    }];

    state.started = true;
    state.turn    = 1;
    state.year    = -3000;

    addEvent('Your people gather beneath the open sky. The age of ' + nationName + ' begins.', 'event');
    addEvent('Government established: ' + gov.name + '. ' + getGovFlavor(govId), 'event');

    updateUI();
  }

  function getGovFlavor(govId) {
    const flavors = {
      tribal:    'The elders speak, and the tribe listens.',
      kingship:  'The crown rests heavy, but authority is absolute.',
      polyarchy: 'The council debates, and consensus guides the realm.',
    };
    return flavors[govId] || '';
  }

  // ── END TURN ──────────────────────────────────
  function endTurn() {
    if (!state.started) return;
    state.turn++;
    state.year += state.yearPerTurn;

    const nation = state.nation;
    const gov    = nation.government;

    // ── Resource income ──
    nation.gold       += nation.incGold;
    nation.food       += nation.incFood;
    nation.population += Math.max(0, Math.floor(nation.food / 20));
    nation.military   += nation.incMilitary;
    nation.research   += Math.round(2 * (gov.buffs.find(b=>b.stat==='research_speed')?.value || 1));

    // ── Stability decay ──
    const decayRate = gov.stabilityDecay;
    const distancePenalty = Math.max(0, (nation.cities.length - 1) * 1.5);
    const fundingPenalty  = nation.gold < 20 ? 4 : 0;
    nation.stability = Math.max(0, Math.min(100,
      nation.stability - decayRate - distancePenalty - fundingPenalty
    ));

    // ── City stability update ──
    for (const city of nation.cities) {
      city.stability = Math.max(0, Math.min(100, city.stability - decayRate * 0.5));
      city.loyalty   = Math.max(0, Math.min(100,
        city.loyalty - (city.isCapital ? 0 : 1.2) - (nation.gold < 10 ? 3 : 0)
      ));
    }

    // ── Cultural unity decay ──
    nation.culturalUnity = Math.max(0, nation.culturalUnity - 0.3 * nation.cities.length * 0.5);

    // ── Random events ──
    rollRandomEvent();

    // ── Check breakoff conditions ──
    checkBreakoffs();

    // ── Check modernization ──
    checkModernization();

    updateUI();
  }

  // ── RANDOM EVENTS ─────────────────────────────
  function rollRandomEvent() {
    const n = state.nation;
    const roll = Math.random();
    if (roll < 0.12) {
      // Good event
      const goodEvents = [
        { text: 'A bountiful harvest feeds your people well.', effect: () => { n.food += 30; n.stability += 3; } },
        { text: 'Traveling merchants bring coin and goods.', effect: () => { n.gold += 25; } },
        { text: 'A period of peace brings renewed loyalty.', effect: () => { n.stability += 5; for(const c of n.cities) c.loyalty += 4; } },
        { text: 'Young warriors flock to your banner.', effect: () => { n.military += 15; } },
        { text: 'Your scholars make a breakthrough.', effect: () => { n.research += 20; } },
      ];
      const ev = goodEvents[Math.floor(Math.random() * goodEvents.length)];
      ev.effect();
      addEvent('✦ ' + ev.text, 'event');
    } else if (roll < 0.22) {
      // Bad event
      const badEvents = [
        { text: 'A drought strikes your heartland. Food stores dwindle.', effect: () => { n.food = Math.max(0, n.food - 25); n.stability -= 4; } },
        { text: 'Bandits raid the trade routes. Gold is stolen.', effect: () => { n.gold = Math.max(0, n.gold - 20); } },
        { text: 'Discontent spreads among the common people.', effect: () => { n.stability -= 6; } },
        { text: 'Disease sweeps through the settlements.', effect: () => { n.population = Math.max(10, n.population - 30); n.stability -= 3; } },
        { text: 'Harsh winter kills livestock and morale alike.', effect: () => { n.food = Math.max(0, n.food - 20); n.stability -= 3; } },
      ];
      const ev = badEvents[Math.floor(Math.random() * badEvents.length)];
      ev.effect();
      addEvent('⚠ ' + ev.text, 'warning');
    }
  }

  // ── BREAKOFF SYSTEM ───────────────────────────
  function checkBreakoffs() {
    const n = state.nation;
    const gov = n.government;

    for (let i = n.cities.length - 1; i >= 0; i--) {
      const city = n.cities[i];
      if (city.isCapital) continue;

      const breakChance = calcBreakChance(city, n, gov);
      if (Math.random() < breakChance) {
        // City breaks off!
        const breakName = city.name + ' ' + getBreakoffTitle();
        n.cities.splice(i, 1);
        n.stability -= 10;
        n.culturalUnity -= 8;
        state.breakawayNations.push({
          name: breakName,
          originCity: city.name,
          foundedYear: state.year,
        });
        addEvent(
          `⚔ BREAKAWAY: The people of ${city.name} have declared independence! The ${breakName} is born.`,
          'warning'
        );
      }
    }
  }

  function calcBreakChance(city, nation, gov) {
    let chance = 0;
    // Base: low loyalty drives breakoff
    if (city.loyalty < 30) chance += 0.15;
    else if (city.loyalty < 50) chance += 0.06;
    // Low national stability
    if (nation.stability < gov.breakoffThreshold) chance += 0.08;
    // Low gold = no funding
    if (nation.gold < 10) chance += 0.05;
    // Low cultural unity
    if (nation.culturalUnity < 40) chance += 0.04;
    // Many cities = harder to hold
    if (nation.cities.length > 5) chance += 0.02 * (nation.cities.length - 5);
    return Math.min(0.5, chance);
  }

  function getBreakoffTitle() {
    const titles = ['Republic','Chiefdom','Kingdom','Commune','Alliance','Confederation','Tribe','Domain'];
    return titles[Math.floor(Math.random() * titles.length)];
  }

  // ── MODERNIZATION ─────────────────────────────
  function checkModernization() {
    const n  = state.nation;
    const gov = n.government;

    // Only fires once at the right era
    if (state.turn === gov.modernizeAt) {
      if (n.stability >= 60) {
        addEvent(
          '🌅 ERA CHANGE: Your civilization has grown beyond its roots. ' +
          'The people look toward a new form of governance. Choose your path.',
          'event'
        );
        // TODO: Phase 7 — show modernization choice modal
      } else {
        addEvent(
          '🔥 ERA CHANGE: Instability has torn the old ways apart. The people revolt and demand change.',
          'warning'
        );
        // Force a new government (simplified for now)
        n.stability = 40;
        addEvent('A new order emerges from the chaos. Your government type will be decided by the people.', 'warning');
      }
    }
  }

  // ── UI UPDATE ─────────────────────────────────
  function updateUI() {
    if (!state.started) return;
    const n = state.nation;

    // Top bar
    document.getElementById('nation-name-display').textContent = n.name;
    document.getElementById('gov-display').textContent = n.government.name;
    document.getElementById('year-display').textContent = formatYear(state.year);

    // Flag
    updateFlagDisplay('topbar-flag', n.flagColors);

    // Stat chips
    document.getElementById('chip-gold').textContent   = Math.floor(n.gold);
    document.getElementById('chip-food').textContent   = Math.floor(n.food);
    document.getElementById('chip-pop').textContent    = Math.floor(n.population);
    document.getElementById('chip-mil').textContent    = Math.floor(n.military);

    // Sidebar
    const stabPct = Math.floor(n.stability);
    document.getElementById('sb-stability').textContent = stabPct + '%';
    const fill = document.getElementById('stability-fill');
    fill.style.width = stabPct + '%';
    fill.style.background = stabPct > 60 ? '#4a8a4a' : stabPct > 35 ? '#c8a030' : '#8b1a1a';

    document.getElementById('sb-unity').textContent   = Math.floor(n.culturalUnity) + '%';
    document.getElementById('sb-cities').textContent  = n.cities.length;
    document.getElementById('sb-gold-inc').textContent = '+' + n.incGold;
    document.getElementById('sb-food-inc').textContent = '+' + n.incFood;
    document.getElementById('sb-research').textContent = Math.floor(n.research);
    document.getElementById('sb-breakaway').textContent = state.breakawayNations.length;
  }

  function updateFlagDisplay(elId, colors) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = colors.map(c => `<div class="flag-stripe" style="background:${c}"></div>`).join('');
  }

  function formatYear(y) {
    if (y < 0) return Math.abs(y) + ' BCE';
    return y + ' CE';
  }

  function addEvent(text, type = 'normal') {
    state.events.unshift({ text, type, year: state.year, turn: state.turn });
    renderLog();
  }

  function renderLog() {
    const log = document.getElementById('event-log');
    log.innerHTML = state.events.slice(0, 30).map(ev => `
      <div class="log-item ${ev.type}">
        <span class="log-year">${formatYear(ev.year)}</span>
        ${ev.text}
      </div>
    `).join('');
  }

  // ── PUBLIC ────────────────────────────────────
  return {
    startGame,
    endTurn,
    getState: () => state,
    addEvent,
    updateFlagDisplay,
  };
})();
