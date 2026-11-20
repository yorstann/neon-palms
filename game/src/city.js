// Palmera Bay: the city's layout, generated once from a seed. A grid of roads
// cuts the map into blocks; each block belongs to a district and is filled with
// buildings of that district's kind. The east edge is beach and open water.
// Everything else in the game asks this module where things are: what is road,
// what is water, what a moving circle bumps into, and where the named places
// (police station, hospital, respray garage, lockup) stand.

import { DISTRICT_STYLES } from './config.js';

export const ROAD_HALF = 60;
export const WORLD = { width: 4400, height: 2760 };
const ROAD_STEP = 460;
const SAND_X = 3560;
const WATER_X = 3840;

/** District of the block in column `col`, row `row` of the block grid. */
function districtAt(col, row) {
  if (row <= 1) {
    if (col <= 1) return 'Coral Heights';
    if (col <= 4) return 'Old Town';
    return 'Palm Beach';
  }
  if (row === 2) {
    if (col <= 1) return 'Old Town';
    if (col <= 4) return 'Downtown';
    return 'Palm Beach';
  }
  if (row === 3) {
    if (col <= 1) return 'Foundry District';
    if (col <= 4) return 'Downtown';
    return 'Marina Del Sol';
  }
  if (col <= 1) return 'Foundry District';
  if (col <= 4) return 'Southgate';
  return 'Marina Del Sol';
}

/** Lighten (positive amount) or darken a #rrggbb colour. */
function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 0xff) + amount);
  const b = clamp((n & 0xff) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

export function createCity(rng) {
  const roadsX = [];
  const roadsY = [];
  for (let i = 0; i < 8; i += 1) roadsX.push(200 + i * ROAD_STEP);
  for (let j = 0; j < 6; j += 1) roadsY.push(200 + j * ROAD_STEP);

  const buildings = [];
  const blocks = [];
  const props = [];
  const colliders = [];

  function addBuilding(x, y, w, h, ht, style, name) {
    const jitter = rng.int(-9, 9);
    const building = {
      x, y, w, h, ht,
      roof: shade(style.roof, jitter),
      wall: shade(style.wall, jitter),
      name: name ?? null,
    };
    buildings.push(building);
    colliders.push(building);
    return building;
  }

  function addContainer(x, y, w, h, colour) {
    const box = { x, y, w, h, ht: 9, roof: colour, wall: colour, name: null, container: true };
    buildings.push(box);
    colliders.push(box);
    return box;
  }

  // Named places the story and the systems use, keyed by block.
  const specials = new Map([
    ['3,2', { name: 'Palmera Bay PD', spot: 'police' }],
    ['6,0', { name: 'St. Coral Hospital', spot: 'hospital' }],
    ['0,4', { name: 'Shine & Go Auto', spot: 'respray' }],
    ['6,4', { name: 'Pier 9 Lockup', spot: 'lockup' }],
    ['5,0', { name: 'The Palmera Grand', spot: 'hotel' }],
    ['2,1', { name: "Rosie's Diner", spot: null }],
    ['4,3', { name: 'Bayview Mall', spot: null }],
  ]);
  const spots = {};

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 5; row += 1) {
      const bx = roadsX[col] + ROAD_HALF;
      const by = roadsY[row] + ROAD_HALF;
      const size = ROAD_STEP - ROAD_HALF * 2;
      const district = districtAt(col, row);
      const style = DISTRICT_STYLES[district];
      blocks.push({ x: bx, y: by, w: size, h: size, district, ground: style.ground });
      const inner = { x: bx + 18, y: by + 18, w: size - 36, h: size - 36 };
      const special = specials.get(`${col},${row}`);

      if (special) {
        const big = addBuilding(inner.x + 30, inner.y + 55, inner.w - 60, inner.h - 110,
          district === 'Downtown' ? 40 : 26, style, special.name);
        if (special.spot) {
          spots[special.spot] = {
            x: big.x + big.w / 2,
            y: big.y + big.h + 26,
            doorX: big.x + big.w / 2,
            doorY: big.y + big.h,
            building: big,
          };
        }
        continue;
      }

      if (district === 'Coral Heights') {
        // Four houses with yards.
        const hw = (inner.w - 26) / 2;
        const hh = (inner.h - 26) / 2;
        for (let a = 0; a < 2; a += 1) {
          for (let b = 0; b < 2; b += 1) {
            addBuilding(inner.x + a * (hw + 26) + 8, inner.y + b * (hh + 26) + 8,
              hw - 16, hh - 16, rng.range(8, 15), style);
          }
        }
      } else if (district === 'Downtown') {
        if (rng.chance(0.5)) {
          addBuilding(inner.x + 22, inner.y + 22, inner.w - 44, inner.h - 44, rng.range(52, 92), style);
        } else {
          addBuilding(inner.x + 8, inner.y + 8, (inner.w - 24) / 2, inner.h - 16, rng.range(40, 70), style);
          addBuilding(inner.x + inner.w / 2 + 8, inner.y + 8, (inner.w - 24) / 2, inner.h - 16, rng.range(40, 78), style);
        }
      } else if (district === 'Foundry District' || district === 'Marina Del Sol') {
        addBuilding(inner.x + 6, inner.y + 10, inner.w - 12, 128, rng.range(13, 20), style);
        addBuilding(inner.x + 6, inner.y + inner.h - 138, inner.w - 12, 128, rng.range(13, 20), style);
        for (let k = 0; k < 3; k += 1) {
          addContainer(inner.x + rng.range(10, inner.w - 70), inner.y + rng.range(150, inner.h - 175),
            52, 22, rng.pick(['#b3543f', '#3f6fb3', '#4d8a5a', '#8a8f96']));
        }
      } else {
        // Old Town, Palm Beach, Southgate: four mid-size buildings.
        const bw = (inner.w - 22) / 2;
        const bh = (inner.h - 22) / 2;
        const tall = district === 'Palm Beach' ? 26 : 14;
        for (let a = 0; a < 2; a += 1) {
          for (let b = 0; b < 2; b += 1) {
            addBuilding(inner.x + a * (bw + 22) + 4, inner.y + b * (bh + 22) + 4,
              bw - 8, bh - 8, rng.range(tall, tall + 26), style);
          }
        }
      }

      // Sidewalk palms and benches dress the block's corners.
      if (district === 'Palm Beach' || district === 'Old Town' || rng.chance(0.3)) {
        props.push({ kind: 'palm', x: bx + 8, y: by + 8, s: rng.range(0.8, 1.25) });
        props.push({ kind: 'palm', x: bx + size - 8, y: by + size - 8, s: rng.range(0.8, 1.25) });
      }
      if (district === 'Old Town') props.push({ kind: 'bench', x: bx + size / 2, y: by + 6 });
    }
  }

  // Street lamps at every intersection corner.
  for (const rx of roadsX) {
    for (const ry of roadsY) {
      props.push({ kind: 'lamp', x: rx - ROAD_HALF - 6, y: ry - ROAD_HALF - 6 });
      props.push({ kind: 'lamp', x: rx + ROAD_HALF + 6, y: ry + ROAD_HALF + 6 });
    }
  }
  // The beach: a row of palms on the sand and boats moored off the marina.
  for (let y = 120; y < WORLD.height - 80; y += rng.range(70, 130)) {
    props.push({ kind: 'palm', x: SAND_X + rng.range(30, 130), y, s: rng.range(0.9, 1.5) });
  }
  for (let i = 0; i < 7; i += 1) {
    props.push({ kind: 'boat', x: WATER_X + rng.range(90, 420), y: rng.range(150, WORLD.height - 200), a: rng.range(-0.4, 0.4) });
  }
  const pier = { x: WATER_X, y: 2180, w: 300, h: 54 };

  function isRoad(x, y) {
    if (x > roadsX[roadsX.length - 1] + ROAD_HALF) return false;
    for (const rx of roadsX) if (Math.abs(x - rx) <= ROAD_HALF) return true;
    for (const ry of roadsY) if (Math.abs(y - ry) <= ROAD_HALF) return true;
    return false;
  }

  function groundAt(x, y) {
    if (x >= WATER_X) return 'water';
    if (x >= SAND_X) return 'sand';
    if (isRoad(x, y)) return 'road';
    for (const b of blocks) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const inset = 18;
        if (x < b.x + inset || x > b.x + b.w - inset || y < b.y + inset || y > b.y + b.h - inset) return 'sidewalk';
        return b.ground;
      }
    }
    return 'lot';
  }

  /** Push a circle out of every building and container it overlaps; report if it hit anything. */
  function collideCircle(x, y, r) {
    let hit = false;
    for (const b of colliders) {
      if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) continue;
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - cx;
      let dy = y - cy;
      let d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 < 0.0001) {
        // Centre inside the rect: leave by the nearest face.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
        continue;
      }
      const d = Math.sqrt(d2);
      dx /= d;
      dy /= d;
      x = cx + dx * r;
      y = cy + dy * r;
    }
    if (x < r) { x = r; hit = true; }
    if (y < r) { y = r; hit = true; }
    if (x > WORLD.width - r) { x = WORLD.width - r; hit = true; }
    if (y > WORLD.height - r) { y = WORLD.height - r; hit = true; }
    return { x, y, hit };
  }

  /** True when a straight line between the points stays clear of buildings (sampled). */
  function segmentClear(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 22));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (const b of colliders) {
        if (x > b.x - 3 && x < b.x + b.w + 3 && y > b.y - 3 && y < b.y + b.h + 3) return false;
      }
    }
    return true;
  }

  function nearestIntersection(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of roadsX) {
      for (const ry of roadsY) {
        const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
        if (d < bestD) {
          bestD = d;
          best = { x: rx, y: ry, ix: roadsX.indexOf(rx), iy: roadsY.indexOf(ry) };
        }
      }
    }
    return best;
  }

  function randomRoadPoint(rand) {
    if (rand.chance(0.5)) {
      const rx = rand.pick(roadsX);
      return { x: rx + rand.range(-ROAD_HALF + 16, ROAD_HALF - 16), y: rand.range(90, WORLD.height - 420) };
    }
    const ry = rand.pick(roadsY);
    return { x: rand.range(90, roadsX[roadsX.length - 1] + 40), y: ry + rand.range(-ROAD_HALF + 16, ROAD_HALF - 16) };
  }

  function randomSidewalkPoint(rand) {
    const b = rand.pick(blocks);
    const side = rand.int(0, 3);
    const t = rand.range(0.08, 0.92);
    if (side === 0) return { x: b.x + b.w * t, y: b.y + 9 };
    if (side === 1) return { x: b.x + b.w * t, y: b.y + b.h - 9 };
    if (side === 2) return { x: b.x + 9, y: b.y + b.h * t };
    return { x: b.x + b.w - 9, y: b.y + b.h * t };
  }

  return {
    width: WORLD.width,
    height: WORLD.height,
    sandX: SAND_X,
    waterX: WATER_X,
    roadsX,
    roadsY,
    buildings,
    blocks,
    props,
    pier,
    spots,
    isRoad,
    groundAt,
    collideCircle,
    segmentClear,
    nearestIntersection,
    randomRoadPoint,
    randomSidewalkPoint,
  };
}
