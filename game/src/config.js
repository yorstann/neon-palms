// Neon Palms — shared tuning numbers, colours and names in one place.
// The view is a fixed 1280x720 logical canvas; the world is far larger and the
// camera moves over it, so nothing here depends on the window size.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any display rate. */
export const STEP = 1 / 60;

/** Storage keys for this browser only. */
export const SAVE_KEY = 'neon-palms.save.v1';

/** The city of Palmera Bay: names the story and the HUD use. */
export const CITY_NAME = 'Palmera Bay';
export const GAME_TITLE = 'NEON PALMS';
export const FIXER_NAME = 'Mara Voss';

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  runSpeed: 292,
  health: 100,
  armour: 50,
  punchRange: 34,
  punchDamage: 26,
  punchCooldown: 0.34,
  startCash: 120,
};

export const GUN = {
  damage: 34,
  range: 560,
  speed: 1500,
  cooldown: 0.21,
  spread: 0.028,
  startAmmo: 48,
};

export const WANTED = {
  /** Heat points per star: star n shows while heat >= n * perStar. */
  perStar: 100,
  maxStars: 5,
  decayPerSecond: 3.2,
  decayHiddenPerSecond: 9,
  sightRange: 330,
};

export const PRICES = { respray: 250, armour: 150 };

/** One game day in real seconds; the clock starts at 09:40 on a new game. */
export const DAY_SECONDS = 540;
export const START_HOUR = 9.66;

export const PALETTE = {
  sky: '#0d1020',
  water: '#14586e',
  waterDeep: '#0d3d54',
  sand: '#e3c188',
  grass: '#3f7a44',
  grassDark: '#356b3b',
  lot: '#565a52',
  sidewalk: '#9aa0a3',
  sidewalkEdge: '#7c8287',
  road: '#33373d',
  roadEdge: '#26292e',
  lane: '#d8c26a',
  crosswalk: '#cfd3d6',
  neonPink: '#ff4d8d',
  neonCyan: '#37e0d8',
  neonAmber: '#ffb340',
  blood: '#b03030',
  cash: '#7dd069',
  text: '#f4f1e8',
  muted: '#a7adba',
  panel: 'rgba(10, 12, 24, 0.78)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
};

/** District accent colours, keyed by the names city.js assigns. */
export const DISTRICT_STYLES = {
  'Coral Heights': { roof: '#c96f4a', wall: '#8a4a34', ground: 'grass' },
  'Old Town': { roof: '#a8583c', wall: '#6e3a2c', ground: 'lot' },
  'Palm Beach': { roof: '#e8e3d5', wall: '#9c968a', ground: 'sand' },
  'Downtown': { roof: '#3d4b63', wall: '#232c3f', ground: 'lot' },
  'Southgate': { roof: '#7a6a55', wall: '#524739', ground: 'lot' },
  'Foundry District': { roof: '#6b6f75', wall: '#45484d', ground: 'lot' },
  'Marina Del Sol': { roof: '#4a7a8c', wall: '#2f5261', ground: 'lot' },
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
