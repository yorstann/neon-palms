// The law: a wanted level fed by witnessed crime, police cars that hunt the
// player across the road grid, and officers who get out and give chase on
// foot when they are close. Stay unseen and the heat cools; get cornered by
// an officer for too long and you are busted.

import { WANTED } from './config.js';
import { createCar, driveCar, forwardSpeed } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

/** Heat each crime adds when somebody sees it happen. */
const CRIME_HEAT = {
  carjack: 48,
  shot: 20,
  punch: 38,
  runover: 88,
  pedDown: 70,
  copHit: 130,
  copCarRam: 42,
  carCrash: 14,
  theft: 30,
};

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    unseenClock: 0, // seconds since any officer last had eyes on the player
    lastSeen: null, // last position the law knows about
    bustedMeter: 0,
    boxedClock: 0,
  };
}

export function starsForHeat(heat) {
  return Math.max(0, Math.min(WANTED.maxStars, Math.floor(heat / WANTED.perStar)));
}

function witnessed(G, x, y) {
  for (const cop of G.cops) {
    if (Math.hypot(cop.x - x, cop.y - y) < 470 && G.city.segmentClear(cop.x, cop.y, x, y)) return true;
  }
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    if (Math.hypot(car.x - x, car.y - y) < 470 && G.city.segmentClear(car.x, car.y, x, y)) return true;
  }
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < 250 && G.city.segmentClear(ped.x, ped.y, x, y)) return true;
  }
  return false;
}

/**
 * Report a crime at a place. Heat only rises when a pedestrian or an officer
 * actually sees it; violent crimes also scatter the crowd either way.
 */
export function reportCrime(G, kind, x, y) {
  if (kind === 'shot' || kind === 'runover' || kind === 'punch' || kind === 'copHit') {
    scarePeds(G, x, y, kind === 'shot' ? 300 : 220);
  }
  const saw = kind === 'copHit' ? true : witnessed(G, x, y);
  if (!saw) return false;
  G.wanted.heat += CRIME_HEAT[kind] ?? 20;
  G.wanted.lastSeen = { x: G.player.x, y: G.player.y };
  G.wanted.unseenClock = 0;
  return true;
}

export function clearWanted(G) {
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.wanted.bustedMeter = 0;
  G.wanted.boxedClock = 0;
}

function desiredCopCars(stars) {
  return [0, 2, 3, 4, 5, 6][stars] ?? 0;
}

function spawnCopCar(G) {
  const { city, rng, player } = G;
  for (let tries = 0; tries < 14; tries += 1) {
    const p = city.randomRoadPoint(rng);
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < 640 || d > 1150) continue;
    const car = createCar(rng, 'police', p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    car.driver = 'police';
    car.officerOut = false;
    G.cars.push(car);
    return car;
  }
  return null;
}

/** Steering for a hunting police car: direct chase when the way is clear. */
function policeControl(G, car, dt, tx, ty) {
  const control = { throttle: 0, steer: 0, brake: false, handbrake: false };
  let aimX = tx;
  let aimY = ty;
  if (!G.city.segmentClear(car.x, car.y, tx, ty)) {
    // No line to the target: head for the intersection nearest the target
    // until the street opens up again.
    const inter = G.city.nearestIntersection(tx, ty);
    aimX = inter.x;
    aimY = inter.y;
    if (Math.hypot(car.x - aimX, car.y - aimY) < 90) {
      aimX = tx;
      aimY = ty;
    }
  }
  // Aim a touch ahead of a moving target so intercepts actually meet.
  const target = G.player.car;
  if (target && G.player.inCar) {
    aimX += target.vx * 0.35;
    aimY += target.vy * 0.35;
  }
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  control.steer = Math.max(-1, Math.min(1, diff * 2.6));
  const fSpeed = forwardSpeed(car);
  const dist = Math.hypot(tx - car.x, ty - car.y);
  if (Math.abs(diff) > 2.4 && fSpeed > 60) {
    control.brake = true;
  } else if (Math.abs(diff) > 2.7) {
    control.throttle = -0.7; // swing the nose around
  } else {
    control.throttle = 1;
  }
  if (dist < 60 && !G.player.inCar) control.brake = fSpeed > 10;
  // Unstick: if the car strains and barely moves, back out and try again.
  car.stuckClock = Math.abs(fSpeed) < 14 && control.throttle > 0 ? car.stuckClock + dt : 0;
  if (car.stuckClock > 1.1) {
    car.stuckClock = -0.7; // negative: the reversing window
  }
  if (car.stuckClock < 0) {
    control.throttle = -0.85;
    control.steer = -control.steer;
    control.brake = false;
  }
  return control;
}

function spawnOfficer(G, car) {
  const officer = {
    x: car.x - Math.sin(car.angle) * 30,
    y: car.y + Math.cos(car.angle) * 30,
    angle: car.angle,
    car,
    state: 'chase',
    health: 100,
    dead: false,
    phase: Math.random() * 6,
    speed: 0,
  };
  car.officerOut = true;
  G.cops.push(officer);
  return officer;
}

export function hurtOfficer(G, officer, damage) {
  if (officer.dead) return;
  officer.health -= damage;
  G.fx.hitPuff(officer.x, officer.y);
  if (officer.health <= 0) {
    officer.dead = true;
    reportCrime(G, 'copHit', officer.x, officer.y);
  }
}

export function updatePolice(G, dt) {
  const { city, player, wanted } = G;
  wanted.stars = starsForHeat(wanted.heat);

  // Who can see the player right now?
  let seen = false;
  let nearestCop = Infinity;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    nearestCop = Math.min(nearestCop, d);
    if (d < WANTED.sightRange && city.segmentClear(car.x, car.y, player.x, player.y)) seen = true;
  }
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    nearestCop = Math.min(nearestCop, d);
    if (d < WANTED.sightRange * 0.8 && city.segmentClear(cop.x, cop.y, player.x, player.y)) seen = true;
  }
  if (seen) {
    wanted.unseenClock = 0;
    wanted.lastSeen = { x: player.x, y: player.y };
  } else {
    wanted.unseenClock += dt;
    if (wanted.heat > 0 && wanted.unseenClock > 2.5) {
      const rate = nearestCop > 520 ? WANTED.decayHiddenPerSecond : WANTED.decayPerSecond;
      wanted.heat = Math.max(0, wanted.heat - rate * dt);
    }
  }

  // Siren loudness follows the nearest unit.
  if (wanted.stars > 0 && nearestCop < 700) G.audio.siren(1 - nearestCop / 700);
  else G.audio.siren(null);

  // Keep the fleet at the strength the stars demand.
  const active = G.cars.filter((c) => c.driver === 'police');
  if (wanted.stars > 0 && active.length < desiredCopCars(wanted.stars)) {
    G.policeSpawnClock -= dt;
    if (G.policeSpawnClock <= 0) {
      G.policeSpawnClock = 1.6;
      spawnCopCar(G);
    }
  }
  // Retire units that are wrecked or hopelessly far away.
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.driver !== 'police') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (car.dead || (wanted.stars === 0 && d > 500) || d > 2100) {
      if (car.officerOut) {
        const idx = G.cops.findIndex((c) => c.car === car);
        if (idx !== -1) G.cops.splice(idx, 1);
      }
      G.cars.splice(i, 1);
    }
  }

  // Drive the fleet, and let officers out when the moment is right.
  const hunt = wanted.lastSeen ?? { x: player.x, y: player.y };
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    const playerSlow = !player.inCar || Math.hypot(player.car.vx, player.car.vy) < 42;
    if (!car.officerOut && d < 150 && playerSlow && wanted.stars > 0) spawnOfficer(G, car);
    if (car.officerOut) {
      // Parked while its officer is out, unless the player speeds off.
      if (!playerSlow && d > 190) {
        const idx = G.cops.findIndex((c) => c.car === car);
        if (idx !== -1) G.cops.splice(idx, 1);
        car.officerOut = false;
      } else {
        driveCar(G, car, dt, { throttle: 0, steer: 0, brake: true, handbrake: false });
        continue;
      }
    }
    const tx = seen || d < 420 ? player.x : hunt.x;
    const ty = seen || d < 420 ? player.y : hunt.y;
    const impact = driveCar(G, car, dt, policeControl(G, car, dt, tx, ty));
    if (impact > 150 && player.car && Math.hypot(car.x - player.car.x, car.y - player.car.y) < 90) {
      reportCrime(G, 'copCarRam', car.x, car.y);
    }
  }

  // Officers on foot.
  let busting = false;
  for (let i = G.cops.length - 1; i >= 0; i -= 1) {
    const cop = G.cops[i];
    if (cop.dead) continue;
    cop.phase += dt * 9;
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (cop.state === 'chase') {
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      cop.angle = Math.atan2(dy, dx);
      const speed = d > 26 ? 252 : 0;
      cop.speed = speed;
      const solved = city.collideCircle(cop.x + Math.cos(cop.angle) * speed * dt, cop.y + Math.sin(cop.angle) * speed * dt, 11);
      cop.x = solved.x;
      cop.y = solved.y;
      if (d < 34 && !player.inCar) busting = true;
      if (d > 620) { // left behind: give up and fade back to the station
        G.cops.splice(i, 1);
        if (cop.car) cop.car.officerOut = false;
      }
    }
  }

  // The busted meter: cornered on foot, or boxed in while driving.
  if (busting) wanted.bustedMeter += dt / 1.5;
  else if (player.inCar && wanted.stars > 0 && Math.hypot(player.car.vx, player.car.vy) < 16) {
    const nearCopCar = G.cars.some((c) => c.driver === 'police' && !c.dead
      && Math.hypot(c.x - player.car.x, c.y - player.car.y) < 96);
    if (nearCopCar) wanted.boxedClock += dt;
    else wanted.boxedClock = Math.max(0, wanted.boxedClock - dt * 2);
    if (wanted.boxedClock > 2.4) wanted.bustedMeter = 1;
  } else {
    wanted.bustedMeter = Math.max(0, wanted.bustedMeter - dt * 0.7);
  }
  if (wanted.bustedMeter >= 1 && G.mode === 'play') {
    G.mode = 'busted';
    G.modeClock = 0;
    G.audio.busted();
    G.audio.siren(null);
    G.audio.engine(null);
  }
}
