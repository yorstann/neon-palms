// Missions and the story. Mara Voss, a fixer who works out of the Pier 9
// lockup, takes Reyes on across six jobs — a fare, a theft, a chase, a heat
// run, a checkpoint race and a goodbye — each a short chain of steps (go
// somewhere, collect someone, deliver, escape) watched by one update loop.
// Around the story sit the city's side work: taxi fares while you drive a
// cab, twenty hidden packages, and the Shine & Go respray that cools the law.

import { FIXER_NAME } from './config.js';
import { createCar, driveCar, forwardSpeed } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { clearWanted } from './police.js';

export function phoneSay(G, from, text) {
  G.messages.push({ from, text, ttl: 7 });
  if (G.messages.length > 4) G.messages.shift();
  G.audio.phone();
}

function marker(x, y, label, extra = {}) {
  return { x, y, label, radius: 64, ...extra };
}

/** The six chapters of Mara's story, in order. Positions come from the city. */
export function storyMissions(G) {
  const { spots } = G.city;
  const dock = { x: G.city.waterX - 210, y: 2240 };
  const diner = { x: 1352, y: 1052 };
  return [
    {
      title: 'First Fare',
      reward: 300,
      startAt: spots.lockup,
      intro: [
        'Reyes? Mara Voss. I move things and people around this bay, quiet and quick.',
        'A courier of mine is stranded at the marina dock. Pick her up, take her to Rosie\'s Diner. Easy money.',
      ],
      outro: ['Clean work. The bay could use a driver like you. — M'],
      build: () => [
        { kind: 'pickupPed', ...marker(dock.x, dock.y, 'Pick up the courier'), pedName: 'the courier' },
        { kind: 'deliver', ...marker(diner.x, diner.y, 'Take the courier to Rosie\'s Diner') },
      ],
    },
    {
      title: 'Hot Merchandise',
      reward: 450,
      startAt: spots.lockup,
      intro: [
        'A Vireo GT in the Foundry District has the wrong owner. Tonight it gets the right one.',
        'Take it, bring it to my lockup. The owner will call it in — drive like you mean it.',
      ],
      outro: ['She purrs. Your cut is in your account. — M'],
      build: (data) => {
        data.carSpawn = { x: 700, y: 2130, type: 'sports' };
        return [
          { kind: 'getCar', ...marker(700, 2130, 'Find the Vireo GT in the Foundry District') },
          { kind: 'deliver', ...marker(spots.lockup.x, spots.lockup.y, 'Deliver the Vireo to the lockup'), timed: 165, needHeat: 105 },
        ];
      },
    },
    {
      title: 'The Accountant',
      reward: 600,
      startAt: { x: diner.x, y: diner.y },
      intro: [
        'My accountant ran with a briefcase that isn\'t his. He drives a grey sedan, Old Town.',
        'Ram him until he stops, take the case from the wreck, bring it home.',
      ],
      outro: ['The case, the money, the lesson. All delivered. — M'],
      build: (data) => {
        data.chaseSpawn = { x: 1240, y: 700, type: 'sedan' };
        return [
          { kind: 'chaseCar', ...marker(1240, 700, 'Stop the accountant\'s sedan') },
          { kind: 'collectCase', label: 'Take the briefcase', radius: 40 },
          { kind: 'deliver', ...marker(spots.lockup.x, spots.lockup.y, 'Bring the briefcase to the lockup') },
        ];
      },
    },
    {
      title: 'Heat Run',
      reward: 750,
      startAt: spots.lockup,
      intro: [
        'A package waits in a Southgate warehouse yard. The moment you touch it, every cop in the bay wakes up.',
        'Lose the heat, then bring it to me. Not before — I can\'t be seen with it hot.',
      ],
      outro: ['Cool head, cold trail. Exactly what I pay for. — M'],
      build: () => [
        { kind: 'collectCase', ...marker(2290, 2380, 'Take the package in the Southgate yard'), onFoot: true },
        { kind: 'escape', label: 'Lose the police', heat: 310 },
        { kind: 'deliver', ...marker(spots.lockup.x, spots.lockup.y, 'Deliver the package to the lockup') },
      ],
    },
    {
      title: 'Bay Run',
      reward: 900,
      startAt: spots.lockup,
      intro: [
        'My clients bet on a street run: eight gates across the bay, one clock.',
        'Any car you like. Just be quick — the clock is the only cop that matters tonight.',
      ],
      outro: ['Eight for eight. The bay talks about you now. — M'],
      build: () => {
        const gates = [
          [660, 660], [1580, 200], [2500, 660], [3420, 1120],
          [2500, 1580], [1580, 2040], [660, 2500], [2040, 1120],
        ];
        return gates.map(([x, y], i) => ({
          kind: 'goto', ...marker(x, y, `Gate ${i + 1} of ${gates.length}`), inCar: true, timed: i === 0 ? 150 : null, bonus: 11,
        }));
      },
    },
    {
      title: 'Neon Goodbye',
      reward: 1500,
      startAt: spots.hotel,
      intro: [
        'It\'s me they\'re after tonight, Reyes. I\'m at the Palmera Grand and I am done with this town.',
        'Get me to the boat at the marina. My old crew will try to stop us — the law will just watch the fireworks.',
      ],
      outro: ['If the bay ever calls you again, answer. — M'],
      build: (data) => {
        data.ambush = true;
        return [
          { kind: 'pickupPed', ...marker(spots.hotel.x, spots.hotel.y, 'Pick up Mara at the Palmera Grand'), pedName: 'Mara' },
          { kind: 'deliver', ...marker(dock.x, dock.y, 'Get Mara to the boat at the marina'), heat: 210 },
        ];
      },
    },
  ];
}

function startMission(G, def) {
  const data = {};
  const steps = def.build(data);
  G.mission = { def, steps, index: 0, data, clock: 0, startedStep: false };
  for (const line of def.intro) phoneSay(G, FIXER_NAME, line);
  G.audio.phone();
}

export function failMission(G, reason) {
  if (!G.mission) return;
  phoneSay(G, FIXER_NAME, reason ?? 'It went wrong. Come back and we try again. — M');
  cleanupMissionEntities(G);
  G.mission = null;
  G.objective = '';
  G.audio.missionFail();
}

function cleanupMissionEntities(G) {
  const m = G.mission;
  if (!m) return;
  if (m.data.car && m.data.car.driver !== 'player') m.data.car.driver = null;
  if (m.data.targetCar && m.data.targetCar.driver === 'mission') m.data.targetCar.driver = 'traffic';
  if (m.data.ped) {
    const idx = G.peds.indexOf(m.data.ped);
    if (idx !== -1) G.peds.splice(idx, 1);
  }
  for (const rival of m.data.rivals ?? []) {
    if (rival.driver === 'mission') rival.driver = 'traffic';
  }
}

function completeMission(G) {
  const { def } = G.mission;
  G.save.money += def.reward;
  G.save.stats.earned += def.reward;
  G.save.storyDone += 1;
  for (const line of def.outro) phoneSay(G, FIXER_NAME, line);
  G.fx.text(G.player.x, G.player.y - 44, `MISSION COMPLETE +$${def.reward}`, '#7dd069', 20);
  G.audio.missionDone();
  G.audio.cash();
  cleanupMissionEntities(G);
  G.mission = null;
  G.objective = '';
  G.persist();
}

function currentStep(G) {
  return G.mission ? G.mission.steps[G.mission.index] : null;
}

/** Set up whatever a step needs the moment it becomes the active one. */
function beginStep(G, step) {
  const m = G.mission;
  if (step.timed) m.timer = step.timed;
  if (step.heat) G.wanted.heat = Math.max(G.wanted.heat, step.heat);
  if (step.kind === 'pickupPed' && !m.data.ped) {
    const ped = createPed(G.rng, step.x, step.y);
    ped.state = 'stand';
    ped.fare = true;
    m.data.ped = ped;
    G.peds.push(ped);
  }
  if (step.kind === 'getCar' && !m.data.car) {
    const s = m.data.carSpawn;
    const car = createCar(G.rng, s.type, s.x, s.y, Math.PI / 2);
    car.driver = null;
    m.data.car = car;
    G.cars.push(car);
  }
  if (step.kind === 'chaseCar' && !m.data.targetCar) {
    const s = m.data.chaseSpawn;
    const car = createCar(G.rng, s.type, s.x, s.y, 0);
    car.driver = 'mission';
    car.fleeing = true;
    m.data.targetCar = car;
    G.cars.push(car);
  }
  if (step.kind === 'collectCase' && step.x === undefined) {
    const car = m.data.targetCar;
    step.x = car ? car.x + 30 : G.player.x;
    step.y = car ? car.y + 10 : G.player.y;
  }
  if (m.data.ambush && step.kind === 'deliver' && !m.data.rivals) {
    m.data.rivals = [];
    for (let i = 0; i < 2; i += 1) {
      const car = createCar(G.rng, 'sports', G.player.x + 500 + i * 90, G.player.y - 420, Math.PI);
      car.driver = 'mission';
      car.hostile = true;
      m.data.rivals.push(car);
      G.cars.push(car);
    }
    phoneSay(G, 'Mara', 'That\'s them. Drive, Reyes!');
  }
}

function advanceStep(G) {
  const m = G.mission;
  m.index += 1;
  m.startedStep = false;
  if (m.index >= m.steps.length) completeMission(G);
}

/** A fleeing or hostile story car: run from (or hunt) the player, simply. */
function missionCarControl(G, car, dt) {
  const p = G.player;
  const target = car.hostile ? { x: p.x, y: p.y } : null;
  let aimX;
  let aimY;
  if (target) {
    aimX = target.x;
    aimY = target.y;
  } else {
    const away = Math.atan2(car.y - p.y, car.x - p.x);
    aimX = car.x + Math.cos(away) * 300;
    aimY = car.y + Math.sin(away) * 300;
    if (!G.city.segmentClear(car.x, car.y, aimX, aimY)) {
      const inter = G.city.nearestIntersection(car.x, car.y);
      aimX = inter.x;
      aimY = inter.y;
    }
  }
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const control = { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2.4)), brake: false, handbrake: false };
  if (Math.abs(diff) > 2.6 && forwardSpeed(car) > 40) control.brake = true;
  return control;
}

export function updateMissionCars(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'mission' || car.dead) continue;
    driveCar(G, car, dt, missionCarControl(G, car, dt));
  }
}

/** Taxi work, packages and the respray run whether or not a story job is on. */
function updateSideWork(G, dt) {
  const p = G.player;
  // Taxi fares: only while Reyes is the one driving a cab.
  const taxi = G.taxi;
  if (p.inCar && p.car.type === 'taxi') {
    if (taxi.stage === 'idle') {
      taxi.clock -= dt;
      if (taxi.clock <= 0) {
        const spot = G.city.randomSidewalkPoint(G.rng);
        if (Math.hypot(spot.x - p.x, spot.y - p.y) > 380) {
          const ped = createPed(G.rng, spot.x, spot.y);
          ped.state = 'stand';
          ped.fare = true;
          taxi.ped = ped;
          taxi.stage = 'pickup';
          G.peds.push(ped);
          phoneSay(G, 'Dispatch', 'Fare waiting — follow the $ marker.');
        } else {
          taxi.clock = 1.2;
        }
      }
    } else if (taxi.stage === 'pickup') {
      if (Math.hypot(p.x - taxi.ped.x, p.y - taxi.ped.y) < 58 && Math.hypot(p.car.vx, p.car.vy) < 30) {
        taxi.ped.state = 'toCar';
        taxi.ped.target = { x: p.car.x, y: p.car.y };
        taxi.stage = 'boarding';
      }
    } else if (taxi.stage === 'boarding') {
      taxi.ped.target = { x: p.car.x, y: p.car.y };
      if (taxi.ped.arrived) {
        const idx = G.peds.indexOf(taxi.ped);
        if (idx !== -1) G.peds.splice(idx, 1);
        const dest = G.city.randomRoadPoint(G.rng);
        taxi.dest = dest;
        taxi.fareValue = Math.round(34 + Math.hypot(dest.x - p.x, dest.y - p.y) / 14);
        taxi.stage = 'deliver';
        G.objective = 'Take the fare to the gold marker';
      }
    } else if (taxi.stage === 'deliver') {
      if (Math.hypot(p.x - taxi.dest.x, p.y - taxi.dest.y) < 74 && Math.hypot(p.car.vx, p.car.vy) < 30) {
        G.save.money += taxi.fareValue;
        G.save.stats.earned += taxi.fareValue;
        G.save.stats.fares += 1;
        G.fx.text(p.x, p.y - 40, `FARE +$${taxi.fareValue}`, '#7dd069', 17);
        G.audio.cash();
        const drop = createPed(G.rng, p.x + 34, p.y + 10);
        drop.state = 'walk';
        G.peds.push(drop);
        taxi.stage = 'idle';
        taxi.clock = G.rng.range(4, 9);
        taxi.dest = null;
        G.objective = '';
        G.persist();
      }
    }
  } else if (taxi.stage !== 'idle') {
    if (taxi.ped) {
      const idx = G.peds.indexOf(taxi.ped);
      if (idx !== -1) G.peds.splice(idx, 1);
      taxi.ped = null;
    }
    taxi.stage = 'idle';
    taxi.clock = 3;
    taxi.dest = null;
  }

  // Hidden packages, collected on foot.
  for (const item of G.pickups) {
    if (item.kind !== 'package' || item.taken) continue;
    if (!p.inCar && Math.hypot(item.x - p.x, item.y - p.y) < 28) {
      item.taken = true;
      G.save.packages.push(item.id);
      G.save.money += 100;
      G.save.stats.earned += 100;
      const found = G.save.packages.length;
      G.fx.text(p.x, p.y - 30, `HIDDEN PACKAGE ${found}/20  +$100`, '#37e0d8', 15);
      G.audio.pickup();
      G.persist();
    }
  }
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    if (G.pickups[i].taken) G.pickups.splice(i, 1);
  }

  // Shine & Go: roll in wanted, roll out clean — for a price.
  const spot = G.city.spots.respray;
  if (p.inCar && G.wanted.stars > 0 && Math.hypot(p.x - spot.x, p.y - spot.y) < 96
    && Math.hypot(p.car.vx, p.car.vy) < 26) {
    G.resprayClock += dt;
    G.prompt = 'Shine & Go is working…';
    if (G.resprayClock > 1.1) {
      G.resprayClock = 0;
      if (G.save.money >= 250) {
        G.save.money -= 250;
        clearWanted(G);
        G.fx.text(p.x, p.y - 40, 'RESPRAYED — HEAT GONE', '#9fd8ff', 16);
        G.audio.spray();
        G.persist();
      } else {
        G.fx.text(p.x, p.y - 40, 'RESPRAY COSTS $250', '#ff9d5c', 14);
      }
    }
  } else {
    G.resprayClock = 0;
  }
}

export function updateMissions(G, dt) {
  updateSideWork(G, dt);
  const p = G.player;
  const defs = storyMissions(G);

  if (!G.mission) {
    // Offer the next chapter at its start marker.
    if (G.save.storyDone < defs.length && G.mode === 'play') {
      const def = defs[G.save.storyDone];
      const at = def.startAt;
      G.missionOffer = { x: at.x, y: at.y, def };
      if (Math.hypot(p.x - at.x, p.y - at.y) < 62 && !p.inCar) {
        startMission(G, def);
      }
    } else {
      G.missionOffer = null;
    }
    return;
  }
  G.missionOffer = null;
  const m = G.mission;
  const step = currentStep(G);
  if (!step) return;
  if (!m.startedStep) {
    m.startedStep = true;
    beginStep(G, step);
  }
  G.objective = step.label ?? '';
  G.missionMarker = { x: step.x, y: step.y };

  if (step.timed || m.timer !== undefined) {
    if (m.timer !== undefined) {
      m.timer -= dt;
      G.missionTimer = m.timer;
      if (m.timer <= 0) {
        failMission(G, 'Out of time. The offer stands — come back. — M');
        return;
      }
    }
  }

  const dist = step.x !== undefined ? Math.hypot(p.x - step.x, p.y - step.y) : Infinity;
  switch (step.kind) {
    case 'goto':
      if (dist < step.radius && (!step.inCar || p.inCar)) {
        if (step.bonus) m.timer = (m.timer ?? 0) + step.bonus;
        G.audio.pickup();
        advanceStep(G);
      }
      break;
    case 'deliver':
      if (dist < step.radius && p.inCar) {
        if (step.needHeat) {
          // Arriving in the stolen car draws the law's eye, as promised.
          G.wanted.heat = Math.max(G.wanted.heat, 0); // heat was set when the car was taken
        }
        advanceStep(G);
      }
      break;
    case 'getCar':
      if (m.data.car && p.car === m.data.car) {
        // The owner calls it in the moment Reyes drives off: heat, guaranteed.
        G.wanted.heat += 105;
        phoneSay(G, FIXER_NAME, 'That\'s the one. The owner just called it in — move!');
        advanceStep(G);
      }
      break;
    case 'pickupPed': {
      const ped = m.data.ped;
      if (ped) {
        if (p.inCar && Math.hypot(p.x - ped.x, p.y - ped.y) < 76) {
          ped.state = 'toCar';
          ped.target = { x: p.car.x, y: p.car.y };
        } else if (!p.inCar && Math.hypot(p.x - ped.x, p.y - ped.y) < 40) {
          ped.state = 'toCar';
          ped.target = { x: p.x, y: p.y };
        }
        if (ped.arrived) {
          const idx = G.peds.indexOf(ped);
          if (idx !== -1) G.peds.splice(idx, 1);
          m.data.ped = null;
          m.data.passenger = true;
          phoneSay(G, step.pedName === 'Mara' ? 'Mara' : 'Courier', 'Let\'s go. And — thank you.');
          advanceStep(G);
        }
      }
      break;
    }
    case 'chaseCar': {
      const target = m.data.targetCar;
      if (target) {
        step.x = target.x;
        step.y = target.y;
        G.missionMarker = { x: target.x, y: target.y };
        if (target.dead || target.health <= 26) {
          target.driver = null;
          target.fleeing = false;
          G.fx.text(target.x, target.y - 40, 'STOPPED!', '#ffd98a', 17);
          advanceStep(G);
        }
      }
      break;
    }
    case 'collectCase':
      if (dist < step.radius && !p.inCar) {
        G.fx.text(p.x, p.y - 30, 'GOT THE CASE', '#ffd98a', 15);
        G.audio.pickup();
        advanceStep(G);
      }
      break;
    case 'escape':
      if (G.wanted.stars === 0) advanceStep(G);
      break;
    default:
      break;
  }
}

/** Twenty glowing packages tucked around the bay, seeded once per world. */
export function placePackages(G) {
  const spots = [];
  const { city, rng } = G;
  let id = 0;
  while (spots.length < 18) {
    const block = rng.pick(city.blocks);
    const x = block.x + rng.range(24, block.w - 24);
    const y = block.y + rng.range(24, block.h - 24);
    if (city.groundAt(x, y) === 'water') continue;
    const solved = city.collideCircle(x, y, 16);
    if (solved.hit) continue;
    id += 1;
    spots.push({ kind: 'package', id, x, y, clock: rng.range(0, 6) });
  }
  // Two specials: one on the pier, one on the sand.
  spots.push({ kind: 'package', id: ++id, x: city.waterX + 130, y: 2207, clock: 0 });
  spots.push({ kind: 'package', id: ++id, x: city.sandX + 120, y: 900, clock: 0 });
  for (const s of spots) {
    if (!G.save.packages.includes(s.id)) G.pickups.push(s);
  }
}
