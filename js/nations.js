// ─────────────────────────────────────────────────────────────
// GOVERNMENT TYPES
// Each has buffs/debuffs that affect game mechanics
// ─────────────────────────────────────────────────────────────
const GOVERNMENTS = {
  tribal: {
    id: 'tribal',
    name: 'Tribal',
    icon: '🪶',
    description: 'A loose confederation of clans bound by blood and tradition. Strong warriors, weak institutions.',
    buffs: [
      { stat: 'expansion_speed', value: 1.3,  label: '+30% Expansion Speed' },
      { stat: 'military_morale', value: 1.2,  label: '+20% Military Morale' },
      { stat: 'population_growth', value: 1.1, label: '+10% Population Growth' },
    ],
    debuffs: [
      { stat: 'stability',      value: 0.8,  label: '-20% Stability Maintenance' },
      { stat: 'gold_income',    value: 0.7,  label: '-30% Gold Income' },
      { stat: 'max_cities',     value: 4,    label: 'Max 4 Cities before instability' },
    ],
    color: '#7a5c2e',
    stabilityDecay: 0.8,   // how fast stability drops per turn
    breakoffThreshold: 45, // stability % at which cities start breaking off
    modernizeAt: 10,       // year at which modernization event fires
  },
  kingship: {
    id: 'kingship',
    name: 'Kingship',
    icon: '👑',
    description: 'A realm ruled by divine mandate of a sovereign monarch. Centralized power, loyal nobility.',
    buffs: [
      { stat: 'gold_income',    value: 1.25, label: '+25% Gold Income' },
      { stat: 'stability',      value: 1.2,  label: '+20% Stability' },
      { stat: 'city_loyalty',   value: 1.3,  label: '+30% City Loyalty' },
    ],
    debuffs: [
      { stat: 'expansion_speed',value: 0.85, label: '-15% Expansion Speed' },
      { stat: 'research_speed', value: 0.75, label: '-25% Research Speed' },
      { stat: 'succession_risk',value: 1.5,  label: '+50% Succession Crisis Risk' },
    ],
    color: '#6b1a1a',
    stabilityDecay: 0.4,
    breakoffThreshold: 30,
    modernizeAt: 15,
  },
  polyarchy: {
    id: 'polyarchy',
    name: 'Simple Polyarchy',
    icon: '⚖️',
    description: 'Power shared among a council of elders or merchant lords. Slow to act, but just and prosperous.',
    buffs: [
      { stat: 'trade_income',   value: 1.4,  label: '+40% Trade Income' },
      { stat: 'research_speed', value: 1.3,  label: '+30% Research Speed' },
      { stat: 'city_stability', value: 1.15, label: '+15% City Stability' },
    ],
    debuffs: [
      { stat: 'military_morale',value: 0.8,  label: '-20% Military Morale' },
      { stat: 'expansion_speed',value: 0.75, label: '-25% Expansion Speed' },
      { stat: 'decision_speed', value: 0.7,  label: '-30% Decision Speed' },
    ],
    color: '#1a3a6b',
    stabilityDecay: 0.3,
    breakoffThreshold: 25,
    modernizeAt: 12,
  },
};

// ─────────────────────────────────────────────────────────────
// NATION COLORS (for flag customization)
// ─────────────────────────────────────────────────────────────
const FLAG_COLORS = [
  '#c0392b', // crimson
  '#e67e22', // amber
  '#f1c40f', // gold
  '#27ae60', // forest green
  '#16a085', // teal
  '#2980b9', // royal blue
  '#8e44ad', // violet
  '#2c3e50', // navy
  '#7f8c8d', // slate
  '#1a1208', // near-black
  '#ecf0f1', // white
  '#795548', // earth brown
];

// ─────────────────────────────────────────────────────────────
// RESOURCE TYPES (for future phases)
// ─────────────────────────────────────────────────────────────
const RESOURCES = {
  oil:      { name: 'Oil',      icon: '🛢️',  color: '#2c2c2c', clusterSize: [3,7], rarity: 0.04 },
  aluminum: { name: 'Aluminum', icon: '⬡',   color: '#a8c4d4', clusterSize: [2,5], rarity: 0.05 },
  iron:     { name: 'Iron',     icon: '⬟',   color: '#8a8a8a', clusterSize: [3,6], rarity: 0.06 },
  gold_ore: { name: 'Gold',     icon: '✦',   color: '#d4a017', clusterSize: [1,3], rarity: 0.03 },
  food_rich:{ name: 'Fertile',  icon: '🌾',  color: '#7ab648', clusterSize: [4,8], rarity: 0.07 },
  coal:     { name: 'Coal',     icon: '◆',   color: '#3a3a3a', clusterSize: [3,6], rarity: 0.05 },
};
