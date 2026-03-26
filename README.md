# 🌍 Living World

A browser-based grand strategy game where you are the cradle of civilization. Start from a single city on a real Earth map and grow your empire — but the bigger you get, the harder it is to hold together.

## Features (Phase 1)
- 🗺️ Real Earth world map with illustrated parchment style
- 🏛️ Nation creation: name, capital city, government type, flag colors
- 👑 Three government types with unique buffs/debuffs:
  - **Tribal** — fast expansion, weak economy
  - **Kingship** — stable and wealthy, slow research
  - **Simple Polyarchy** — high trade & research, weak military
- 📅 Turn-based gameplay starting at 3000 BCE
- 📉 Stability system — cities break off if poorly managed
- 📜 Chronicle log of events and history
- 🎨 Full flag color customization

## Planned Features
- [ ] Phase 2: City founding & territory expansion
- [ ] Phase 3: Resources (oil, aluminum, iron, etc.) in geographic clusters
- [ ] Phase 4: Trade routes, autonomy, funding systems
- [ ] Phase 5: Breakaway civilizations with full AI
- [ ] Phase 6: Combat & warfare
- [ ] Phase 7: Government modernization & era progression
- [ ] Phase 8: AI-powered diplomacy (Claude API)

## How to Play
1. Open `index.html` in any modern browser
2. Name your nation and capital city
3. Choose your government type
4. Pick your nation's flag colors
5. Click **Found Your Nation**
6. Pan the map to explore · Scroll to zoom
7. Press **End Turn** to advance time

## File Structure
```
living-world/
├── index.html        ← Main game (open this)
├── css/
│   └── style.css     ← All styles
├── js/
│   ├── nations.js    ← Government & resource data
│   ├── map.js        ← World map rendering engine
│   └── game.js       ← Core game logic & turn system
└── README.md
```

## Running Locally
No build tools needed. Just open `index.html` directly in your browser.

For best results use Chrome or Firefox.
