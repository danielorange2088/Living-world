// ─────────────────────────────────────────────────────────────
// GOVERNMENT TYPES
// ─────────────────────────────────────────────────────────────
const GOVERNMENTS = {
  tribal: {
    id: 'tribal', name: 'Tribal', icon: '🪶',
    description: 'A loose confederation of clans bound by blood and tradition.',
    buffs:   [{ stat:'expansion_speed', value:1.3, label:'+30% Expansion Speed' },
              { stat:'military_morale', value:1.2, label:'+20% Military Morale' },
              { stat:'population_growth',value:1.1,label:'+10% Population Growth'}],
    debuffs: [{ stat:'stability',       value:0.8, label:'-20% Stability' },
              { stat:'gold_income',     value:0.7, label:'-30% Gold Income' },
              { stat:'max_cities',      value:4,   label:'4 City Limit' }],
    color: '#7a5c2e',
    stabilityDecay: 0.8, breakoffThreshold: 45, modernizeAt: 10,
    inkPerTurn: 18, inkSaveable: false, inkSaveMax: 18,
    autoExpand: true, autoExpandRate: 0.6,
    royalDecree: false,
    inkCosts: { mountain:6, tundra:4, desert:4, hills:3, forest:2, plains:1, coast:2 },
  },
  kingship: {
    id: 'kingship', name: 'Kingship', icon: '👑',
    description: 'A realm ruled by divine mandate of a sovereign monarch.',
    buffs:   [{ stat:'gold_income',   value:1.25, label:'+25% Gold Income' },
              { stat:'stability',     value:1.2,  label:'+20% Stability' },
              { stat:'city_loyalty',  value:1.3,  label:'+30% City Loyalty' }],
    debuffs: [{ stat:'expansion_speed',value:0.85,label:'-15% Expansion Speed' },
              { stat:'research_speed', value:0.75,label:'-25% Research Speed' },
              { stat:'succession_risk',value:1.5, label:'Succession Crisis Risk' }],
    color: '#6b1a1a',
    stabilityDecay: 0.4, breakoffThreshold: 30, modernizeAt: 15,
    inkPerTurn: 0, inkSaveable: true, inkSaveMax: 24,
    autoExpand: false, autoExpandRate: 0,
    royalDecree: true, royalDecreeCost: 40, royalDecreeInk: 24,
    inkCosts: { mountain:5, tundra:3, desert:3, hills:2, forest:1, plains:1, coast:1 },
  },
  polyarchy: {
    id: 'polyarchy', name: 'Simple Polyarchy', icon: '⚖️',
    description: 'Power shared among a council of elders or merchant lords.',
    buffs:   [{ stat:'trade_income',  value:1.4,  label:'+40% Trade Income' },
              { stat:'research_speed',value:1.3,  label:'+30% Research Speed' },
              { stat:'city_stability',value:1.15, label:'+15% City Stability' }],
    debuffs: [{ stat:'military_morale',value:0.8, label:'-20% Military Morale' },
              { stat:'expansion_speed',value:0.75,label:'-25% Expansion Speed' },
              { stat:'decision_speed', value:0.7, label:'-30% Decision Speed' }],
    color: '#1a3a6b',
    stabilityDecay: 0.3, breakoffThreshold: 25, modernizeAt: 12,
    inkPerTurn: 10, inkSaveable: true, inkSaveMax: 30,
    autoExpand: true, autoExpandRate: 0.3,
    royalDecree: false,
    inkCosts: { mountain:8, tundra:5, desert:5, hills:3, forest:2, plains:1, coast:2 },
  },
};

// ─────────────────────────────────────────────────────────────
// LAND TYPES
// ─────────────────────────────────────────────────────────────
const LAND_TYPES = {
  ocean:    { id:'ocean',    name:'Ocean',    color:'#4a7a96', passable:false, claimable:false, foodMod:0, goldMod:0, prodMod:0 },
  coast:    { id:'coast',    name:'Coast',    color:'#7ab8d0', passable:true,  claimable:true,  foodMod:1, goldMod:1, prodMod:0 },
  plains:   { id:'plains',   name:'Plains',   color:'#c4b86a', passable:true,  claimable:true,  foodMod:3, goldMod:1, prodMod:1 },
  forest:   { id:'forest',   name:'Forest',   color:'#5a8040', passable:true,  claimable:true,  foodMod:1, goldMod:0, prodMod:2 },
  hills:    { id:'hills',    name:'Hills',    color:'#a09060', passable:true,  claimable:true,  foodMod:1, goldMod:2, prodMod:2 },
  desert:   { id:'desert',   name:'Desert',   color:'#c8a040', passable:true,  claimable:true,  foodMod:0, goldMod:1, prodMod:0 },
  tundra:   { id:'tundra',   name:'Tundra',   color:'#8aaa90', passable:true,  claimable:true,  foodMod:0, goldMod:0, prodMod:1 },
  mountain: { id:'mountain', name:'Mountain', color:'#808888', passable:false, claimable:true,  foodMod:0, goldMod:3, prodMod:3 },
};

// ─────────────────────────────────────────────────────────────
// EARLY RESOURCES
// ─────────────────────────────────────────────────────────────
const RESOURCES = {
  timber: {
    id:'timber', name:'Timber', icon:'🪵', color:'#5a3a1a',
    rarity:0.10, clusterMin:3, clusterMax:7,
    spawnOn:['forest'],
    productionPerTurn:3, effect:'Enables construction. +3 Production/turn.',
  },
  stone: {
    id:'stone', name:'Stone', icon:'🪨', color:'#888888',
    rarity:0.10, clusterMin:3, clusterMax:6,
    spawnOn:['hills','mountain'],
    productionPerTurn:3, effect:'Enables buildings. +3 Production/turn.',
  },
  iron: {
    id:'iron', name:'Iron', icon:'⬟', color:'#607080',
    rarity:0.045, clusterMin:2, clusterMax:4,
    spawnOn:['hills','mountain','plains'],
    productionPerTurn:2, effect:'+2 Military/turn. Unlocks iron weapons.',
  },
  copper: {
    id:'copper', name:'Copper', icon:'◈', color:'#b87333',
    rarity:0.045, clusterMin:2, clusterMax:4,
    spawnOn:['hills','plains','desert'],
    productionPerTurn:2, effect:'+2 Gold/turn. Enables bronze tools.',
  },
};

// ─────────────────────────────────────────────────────────────
// UNITS
// ─────────────────────────────────────────────────────────────
const UNIT_TYPES = {
  trader: {
    id:'trader', name:'Trader', icon:'🐪',
    description:'Moves along your territory generating gold on trade routes.',
    cost:{ gold:30 }, goldPerRoute:5,
  },
  builder: {
    id:'builder', name:'Builder', icon:'🪚',
    description:'Place on a resource tile to extract it each turn.',
    cost:{ gold:20, production:10 }, extractsResource:true,
  },
};

// ─────────────────────────────────────────────────────────────
// FLAG COLORS
// ─────────────────────────────────────────────────────────────
const FLAG_COLORS = [
  '#c0392b','#e67e22','#f1c40f','#27ae60','#16a085',
  '#2980b9','#8e44ad','#2c3e50','#7f8c8d','#1a1208','#ecf0f1','#795548',
];
