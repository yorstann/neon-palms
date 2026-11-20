// Neon Palms — boot and the one loop. Builds the world of Palmera Bay, runs
// the simulation in fixed 1/60 s steps (traffic, people, the player, the law,
// the story), moves the camera, and paints world, HUD and screens each frame.
//
// ?seed=N fixes the city and the luck. ?shot=title|downtown|chase|mission
// (with &seed=N) stages a deterministic scene instead of running the loop,
// paints it a few times and sets window.__shotReady for a screenshot.

import { STEP, VIEW, START_HOUR, DAY_SECONDS, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { createInput, KEY } from './input.js';
import { createCity } from './city.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { defaultSave, loadSave, storeSave } from './save.js';
import { createPlayer, updatePlayer, updateBullets } from './player.js';
import {
  spawnInitialCars, trafficControl, driveCar, collideCars, recycleTraffic, doorPoint,
} from './vehicles.js';
import { spawnInitialPeds, updatePeds, maintainPeds } from './pedestrians.js';
import { createWanted, updatePolice, clearWanted, reportCrime } from './police.js';
import { updateMissions, updateMissionCars, placePackages, failMission, phoneSay } from './missions.js';
import { renderWorld, createMinimapBase } from './render.js';
import { drawHud, drawMenus, menuRects } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261120;

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

/** In screenshot mode the game stays silent: a stub with every sound a no-op. */
function silentAudio() {
  const noop = () => {};
  return {
    unlock: noop, toggleMute: () => false, muted: false, shoot: noop, dryFire: noop,
    punch: noop, hurt: noop, crash: noop, cash: noop, pickup: noop, phone: noop,
    missionDone: noop, missionFail: noop, busted: noop, horn: noop, door: noop,
    spray: noop, engine: noop, siren: noop,
  };
}

const G = {
  rng: createRandom(seed ^ 0x5f3759df),
  city: null,
  input: createInput(canvas),
  audio: shot ? silentAudio() : createAudio(),
  fx: createEffects(),
  mode: 'title',
  modeClock: 0,
  prevMode: 'title',
  time: 0,
  hour: START_HOUR,
  camera: { x: 0, y: 0 },
  player: null,
  cars: [],
  peds: [],
  cops: [],
  bullets: [],
  pickups: [],
  events: [],
  wanted: createWanted(),
  policeSpawnClock: 0,
  mission: null,
  missionOffer: null,
  missionMarker: null,
  missionTimer: null,
  taxi: { stage: 'idle', clock: 2.5, ped: null, dest: null, fareValue: 0 },
  messages: [],
  objective: '',
  prompt: '',
  resprayClock: 0,
  save: defaultSave(),
  existingSave: null,
  lastFine: 0,
  district: '',
  districtToast: null,
  menu: null,
  howtoReturn: 'title',
  crashClock: 0,
  recycleClock: 0,
  minimapBase: null,
  persist() {
    storeSave(G.save);
  },
};

function buildWorld() {
  G.city = createCity(createRandom(seed));
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  G.pickups = [];
  G.events = [];
  G.wanted = createWanted();
  G.mission = null;
  G.missionOffer = null;
  G.missionMarker = null;
  G.missionTimer = null;
  G.taxi = { stage: 'idle', clock: 2.5, ped: null, dest: null, fareValue: 0 };
  G.messages = [];
  G.objective = '';
  G.prompt = '';
  G.resprayClock = 0;
  const spawn = G.city.spots.lockup;
  G.player = createPlayer(spawn.x, spawn.y + 6);
  spawnInitialCars(G);
  spawnInitialPeds(G, G.player, 34);
  placePackages(G);
  G.pickups.push({ kind: 'ammo', x: spawn.x + 64, y: spawn.y + 14, amount: 24, clock: 0 });
  G.pickups.push({ kind: 'health', x: spawn.x - 58, y: spawn.y + 14, amount: 40, clock: 0 });
  G.minimapBase = createMinimapBase(G.city);
  G.district = 'Marina Del Sol';
  G.camera.x = Math.max(0, Math.min(G.city.width - VIEW.width, G.player.x - VIEW.width / 2));
  G.camera.y = Math.max(0, Math.min(G.city.height - VIEW.height, G.player.y - VIEW.height / 2));
}

function setTitleMenu() {
  const items = [];
  if (G.existingSave) items.push({ id: 'continue', label: 'Continue' });
  items.push({ id: 'new', label: 'New Game' });
  items.push({ id: 'howto', label: 'How to Play' });
  G.menu = { items, index: 0 };
}

function setPauseMenu() {
  G.menu = {
    items: [
      { id: 'resume', label: 'Resume' },
      { id: 'howto', label: 'How to Play' },
      { id: 'title', label: 'Save & Title Screen' },
    ],
    index: 0,
  };
}

function startCareer(fresh) {
  if (fresh) {
    G.save = defaultSave();
    G.save.money = PLAYER.startCash;
  } else {
    G.save = G.existingSave ?? defaultSave();
    if (!G.existingSave) G.save.money = PLAYER.startCash;
  }
  G.existingSave = G.save;
  buildWorld();
  G.mode = 'play';
  G.menu = null;
  if (fresh) {
    phoneSay(G, 'Mara Voss', 'Welcome to Palmera Bay, Reyes. Your first job is at the gold marker — Pier 9, where you stand.');
  }
  announce(fresh ? 'New game. Reyes arrives in Palmera Bay.' : 'Career continued.');
}

function announce(message) {
  status.textContent = message;
}

/** One-off consequences when a mode begins (fines, respawns, cleanups). */
function onModeEnter(mode) {
  const p = G.player;
  if (mode === 'busted' || mode === 'wasted') {
    const stars = G.wanted.stars;
    G.lastFine = mode === 'busted'
      ? Math.min(G.save.money, 100 + stars * 60)
      : Math.min(G.save.money, 150);
    G.save.money -= G.lastFine;
    if (mode === 'busted') G.save.stats.timesBusted += 1;
    else G.save.stats.timesWasted += 1;
    failMission(G, mode === 'busted'
      ? 'The law took you in. The job is off — come back to the marker. — M'
      : 'Heard you flatlined, briefly. The job is off — rest up. — M');
    if (p.car) {
      if (p.car.driver === 'player') p.car.driver = null;
      p.car = null;
      p.inCar = false;
    }
    G.cars = G.cars.filter((c) => c.driver !== 'police');
    G.cops = [];
    clearWanted(G);
    G.persist();
    announce(mode === 'busted' ? 'Busted.' : 'Wasted.');
  }
}

function respawn() {
  const p = G.player;
  const spot = G.mode === 'busted' ? G.city.spots.police : G.city.spots.hospital;
  p.x = spot.x;
  p.y = spot.y;
  p.health = PLAYER.health;
  p.armour = 0;
  G.mode = 'play';
  announce('Back on the street.');
}

/** District under the player, for the minimap label and the toast. */
function districtAtPlayer() {
  const p = G.player;
  if (p.x >= G.city.waterX) return 'Palmera Bay';
  if (p.x >= G.city.sandX) return 'Palm Beach';
  for (const b of G.city.blocks) {
    if (p.x >= b.x - 60 && p.x <= b.x + b.w + 60 && p.y >= b.y - 60 && p.y <= b.y + b.h + 60) return b.district;
  }
  return 'Palmera Bay';
}

function computePrompt() {
  const p = G.player;
  if (G.resprayClock > 0) {
    G.prompt = 'Shine & Go is working…';
    return;
  }
  if (!p.inCar) {
    let best = null;
    let bestD = 84;
    for (const car of G.cars) {
      if (car.dead) continue;
      const door = doorPoint(car);
      const d = Math.hypot(door.x - p.x, door.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      G.prompt = `E — Get in the ${best.spec.name}${best.driver === 'traffic' ? ' (steal it)' : ''}`;
      return;
    }
    if (G.missionOffer) {
      const d = Math.hypot(G.missionOffer.x - p.x, G.missionOffer.y - p.y);
      if (d < 150) {
        G.prompt = `New job: ${G.missionOffer.def.title} — $${G.missionOffer.def.reward}. Walk into the light`;
        return;
      }
    }
    G.prompt = '';
    return;
  }
  if (p.car.type === 'taxi' && G.taxi.stage === 'idle') {
    G.prompt = 'On the meter — a fare will flag you down';
    return;
  }
  G.prompt = '';
}

function updateWorld(dt) {
  G.time += dt;
  G.fx.update(dt);
  G.crashClock = Math.max(0, G.crashClock - dt);

  // Traffic and story cars always roll; the city never sleeps.
  for (const car of G.cars) {
    if (car.driver === 'traffic' && !car.dead) driveCar(G, car, dt, trafficControl(G, car, dt));
  }
  updateMissionCars(G, dt);
  for (let i = 0; i < G.cars.length; i += 1) {
    for (let j = i + 1; j < G.cars.length; j += 1) {
      const impact = collideCars(G.cars[i], G.cars[j]);
      if (impact > 150 && G.crashClock <= 0) {
        const near = Math.hypot(G.cars[i].x - G.player.x, G.cars[i].y - G.player.y) < 780;
        if (near) {
          G.audio.crash(Math.min(1, impact / 300));
          G.crashClock = 0.25;
        }
        G.fx.burst(G.cars[j].x, G.cars[j].y, 6, '#ffd98a', 170, 0.35, 3);
      }
    }
  }
  updatePeds(G, dt);
  maintainPeds(G);
  G.recycleClock -= dt;
  if (G.recycleClock <= 0) {
    G.recycleClock = 2.2;
    recycleTraffic(G);
  }

  if (G.mode === 'title') {
    // A slow drift over downtown behind the menu.
    G.camera.x = 1480 + Math.sin(G.time * 0.045) * 330;
    G.camera.y = 1020 + Math.cos(G.time * 0.032) * 210;
    return;
  }
  if (G.mode !== 'play') {
    G.modeClock += dt;
    return;
  }

  G.hour = (G.hour + (dt * 24) / DAY_SECONDS) % 24;
  for (let i = G.messages.length - 1; i >= 0; i -= 1) {
    G.messages[i].ttl -= dt;
    if (G.messages[i].ttl <= 0) G.messages.splice(i, 1);
  }
  if (G.districtToast) {
    G.districtToast.ttl -= dt;
    if (G.districtToast.ttl <= 0) G.districtToast = null;
  }
  const district = districtAtPlayer();
  if (district !== G.district) {
    G.district = district;
    G.districtToast = { name: district, ttl: 2.6 };
  }

  updatePlayer(G, dt);
  updateBullets(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  if (!G.mission) {
    G.missionMarker = null;
    G.missionTimer = null;
  }
  for (const ev of G.events) {
    if (ev.type === 'crime') reportCrime(G, ev.kind, ev.x, ev.y);
  }
  G.events.length = 0;
  computePrompt();

  // Camera: follow, leading a little the way the car is heading.
  const p = G.player;
  const lead = p.inCar ? 0.34 : 0.12;
  const tx = p.x + (p.inCar ? p.car.vx * lead : 0) - VIEW.width / 2;
  const ty = p.y + (p.inCar ? p.car.vy * lead : 0) - VIEW.height / 2;
  const k = Math.min(1, dt * 5.2);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.camera.x = Math.max(-60, Math.min(G.city.width - VIEW.width + 60, G.camera.x));
  G.camera.y = Math.max(-60, Math.min(G.city.height - VIEW.height + 60, G.camera.y));
}

function render() {
  const shake = G.fx.shakeValue();
  const ox = (Math.random() * 2 - 1) * shake;
  const oy = (Math.random() * 2 - 1) * shake;
  G.camera.x += ox;
  G.camera.y += oy;
  renderWorld(ctx, G);
  G.camera.x -= ox;
  G.camera.y -= oy;
  if (G.mode === 'play' || G.mode === 'paused') drawHud(ctx, G, G.minimapBase);
  if (G.mode !== 'play') drawMenus(ctx, G);
}

function handleMenuInput(top) {
  const menu = G.menu;
  if (!menu) return;
  const input = G.input;
  if (input.pressed('ArrowUp', 'KeyW')) menu.index = (menu.index + menu.items.length - 1) % menu.items.length;
  if (input.pressed('ArrowDown', 'KeyS')) menu.index = (menu.index + 1) % menu.items.length;
  const rects = menuRects(menu.items.length, top);
  rects.forEach((r, i) => {
    if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
      menu.index = i;
    }
  });
  const clicked = input.takeClick();
  if (input.pressed(...KEY.confirm) || clicked) {
    activateMenu(menu.items[menu.index].id);
  }
}

function activateMenu(id) {
  G.audio.unlock();
  if (G.mode === 'title') {
    if (id === 'continue') startCareer(false);
    else if (id === 'new') startCareer(true);
    else if (id === 'howto') {
      G.howtoReturn = 'title';
      G.mode = 'howto';
    }
  } else if (G.mode === 'paused') {
    if (id === 'resume') {
      G.mode = 'play';
      G.menu = null;
    } else if (id === 'howto') {
      G.howtoReturn = 'paused';
      G.mode = 'howto';
    } else if (id === 'title') {
      G.persist();
      G.existingSave = G.save;
      G.mode = 'title';
      setTitleMenu();
    }
  }
}

function runGame() {
  G.existingSave = loadSave();
  if (G.existingSave && G.existingSave.muted) G.audio.toggleMute();
  G.save = G.existingSave ?? defaultSave();
  buildWorld();
  setTitleMenu();
  announce('Neon Palms. Choose New Game or Continue.');

  const unlock = () => G.audio.unlock();
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('mousedown', unlock, { once: true });

  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (G.mode !== G.prevMode) {
      onModeEnter(G.mode);
      G.prevMode = G.mode;
    }

    // Screen-level input between fixed steps.
    if (G.mode === 'title') handleMenuInput(356);
    else if (G.mode === 'paused') handleMenuInput(356);
    else if (G.mode === 'howto') {
      if (G.input.pressed(...KEY.pause) || G.input.pressed(...KEY.confirm) || G.input.takeClick()) {
        G.mode = G.howtoReturn;
        if (G.mode === 'title') setTitleMenu();
        if (G.mode === 'paused') setPauseMenu();
      }
    } else if (G.mode === 'busted' || G.mode === 'wasted') {
      if (G.modeClock > 0.7 && (G.input.pressed(...KEY.confirm) || G.input.takeClick())) respawn();
    } else if (G.mode === 'play') {
      if (G.input.pressed(...KEY.pause)) {
        G.mode = 'paused';
        setPauseMenu();
        G.audio.engine(null);
        G.audio.siren(null);
      }
      if (G.input.pressed(...KEY.mute)) {
        const muted = G.audio.toggleMute();
        G.save.muted = muted;
        G.persist();
        G.fx.text(G.player.x, G.player.y - 34, muted ? 'SOUND OFF' : 'SOUND ON', '#ffd98a', 13);
      }
    }

    if (G.mode === 'play' || G.mode === 'title') {
      while (accumulator >= STEP) {
        updateWorld(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      if (G.mode === 'busted' || G.mode === 'wasted') G.modeClock += 1 / 60;
    }
    render();
    G.input.endFrame();
  }
  requestAnimationFrame(frame);
}

function runShot(name) {
  G.save = defaultSave();
  G.existingSave = null;
  buildWorld();
  const stepWorld = (n) => {
    for (let i = 0; i < n; i += 1) updateWorld(STEP);
  };
  stageShot(G, name, stepWorld);
  if (G.mode === 'title') setTitleMenu();
  let painted = 0;
  function paint() {
    render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
