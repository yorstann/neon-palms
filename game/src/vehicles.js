// Cars: the types that fill Palmera Bay, an arcade driving model (throttle,
// steering, grip and drift shared by every driver), and the traffic driver
// that keeps civilian cars flowing along the road grid in right-hand lanes.
// Police and the player drive through the same physics with their own
// controls, so every car on the street behaves the same way.

/** Lateral distance from a road's centre line to the centre of a lane. */
export const LANE = 27;

export const CAR_TYPES = {
  sedan: {
    name: 'Marina Sedan', length: 92, width: 44, topSpeed: 335, accel: 250, grip: 5.2, mass: 1,
    colours: ['#c0c6cc', '#7a8899', '#4a5568', '#8c2f39', '#2e5e4e', '#d8d3c3', '#333a45', '#b5893c'],
  },
  taxi: {
    name: 'Palmera Cab', length: 92, width: 44, topSpeed: 325, accel: 245, grip: 5.2, mass: 1,
    colours: ['#f2b234'],
  },
  sports: {
    name: 'Vireo GT', length: 88, width: 43, topSpeed: 478, accel: 430, grip: 6.4, mass: 0.9,
    colours: ['#e33e5f', '#ff7a1a', '#37e0d8', '#f2e14c', '#7a4de3', '#f4f1e8'],
  },
  truck: {
    name: 'Hauler Pickup', length: 116, width: 52, topSpeed: 268, accel: 175, grip: 4.4, mass: 1.5,
    colours: ['#8a4a34', '#5b6e46', '#6e6e6e', '#31517a'],
  },
  police: {
    name: 'PBPD Interceptor', length: 94, width: 45, topSpeed: 438, accel: 372, grip: 6.1, mass: 1.05,
    colours: ['#1c2733'],
  },
};

let nextCarId = 1;

export function createCar(rng, type, x, y, angle) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    type,
    spec,
    colour: type === 'police' ? '#1c2733' : rng.pick(spec.colours),
    x, y, angle,
    vx: 0, vy: 0,
    steer: 0,
    driver: null, // null = parked empty, 'traffic', 'police', 'player', 'mission'
    health: 100,
    dead: false,
    smokeClock: 0,
    honkClock: rng.range(0, 4),
    stuckClock: 0,
    route: null,
    turnCooldown: 0,
    lastSkid: null,
    sirenPhase: rng.range(0, 6),
  };
}

/** Speed along the car's nose, signed. */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

export function speedOf(car) {
  return Math.hypot(car.vx, car.vy);
}

/** Where a person stands to get in: beside the driver's door. */
export function doorPoint(car) {
  const rx = -Math.sin(car.angle);
  const ry = Math.cos(car.angle);
  return { x: car.x + rx * (car.spec.width / 2 + 16), y: car.y + ry * (car.spec.width / 2 + 16) };
}

/**
 * One physics step for any car. `control` is {throttle -1..1, steer -1..1,
 * brake, handbrake}. Handles ground drag (sand and grass slow a car), building
 * collisions and the smoke a damaged car trails. Returns the impact speed of
 * any crash this step (0 when none) so callers can react.
 */
export function driveCar(G, car, dt, control) {
  const { city, fx } = G;
  const spec = car.spec;
  const fxCos = Math.cos(car.angle);
  const fxSin = Math.sin(car.angle);
  let fSpeed = car.vx * fxCos + car.vy * fxSin;
  let latX = car.vx - fxCos * fSpeed;
  let latY = car.vy - fxSin * fSpeed;

  const ground = city.groundAt(car.x, car.y);
  const offRoad = ground === 'sand' || ground === 'grass' || ground === 'lot';
  const topSpeed = spec.topSpeed * (offRoad ? 0.55 : 1) * (car.health < 25 ? 0.6 : 1);

  if (control.throttle > 0) {
    fSpeed += spec.accel * control.throttle * dt * (fSpeed < 0 ? 2.2 : 1);
  } else if (control.throttle < 0) {
    fSpeed += spec.accel * 0.62 * control.throttle * dt * (fSpeed > 0 ? 2.4 : 1);
  }
  if (control.brake) fSpeed -= Math.sign(fSpeed) * Math.min(Math.abs(fSpeed), 620 * dt);
  // Rolling drag and the top speed.
  fSpeed -= fSpeed * 0.55 * dt;
  if (fSpeed > topSpeed) fSpeed = Math.max(topSpeed, fSpeed - 300 * dt);
  if (fSpeed < -120) fSpeed = -120;

  // Steering bites with speed; the handbrake trades grip for rotation.
  const steerTarget = control.steer * (control.handbrake ? 1 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 9);
  const speedFactor = Math.max(-1, Math.min(1, fSpeed / 120));
  const turnRate = car.steer * 2.35 * speedFactor * (control.handbrake ? 1.5 : 1);
  car.angle += turnRate * dt * Math.min(1, Math.abs(fSpeed) / 60 + 0.25);

  const grip = control.handbrake ? 1.6 : spec.grip;
  latX -= latX * Math.min(1, grip * dt);
  latY -= latY * Math.min(1, grip * dt);

  const nCos = Math.cos(car.angle);
  const nSin = Math.sin(car.angle);
  car.vx = nCos * fSpeed + latX;
  car.vy = nSin * fSpeed + latY;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Skid marks and smoke while sliding or burning rubber.
  const lateral = Math.abs(latX * -nSin + latY * nCos);
  const sliding = (lateral > 65 && Math.abs(fSpeed) > 60) || (control.handbrake && Math.abs(fSpeed) > 90);
  if (sliding && fx) {
    const bx = car.x - nCos * (spec.length / 2 - 8);
    const by = car.y - nSin * (spec.length / 2 - 8);
    const ox = -nSin * (spec.width / 2 - 5);
    const oy = nCos * (spec.width / 2 - 5);
    if (car.lastSkid) {
      fx.skid(car.lastSkid.x + ox, car.lastSkid.y + oy, bx + ox, by + oy);
      fx.skid(car.lastSkid.x - ox, car.lastSkid.y - oy, bx - ox, by - oy);
    }
    car.lastSkid = { x: bx, y: by };
  } else {
    car.lastSkid = null;
  }

  let impact = 0;
  const before = { x: car.x, y: car.y, vx: car.vx, vy: car.vy };
  const solved = city.collideCircle(car.x, car.y, spec.length * 0.40);
  if (solved.hit) {
    impact = Math.abs(fSpeed);
    car.x = solved.x;
    car.y = solved.y;
    // Kill the velocity component that ran into the wall.
    const pushX = car.x - before.x;
    const pushY = car.y - before.y;
    const pushLen = Math.hypot(pushX, pushY) || 1;
    const nx = pushX / pushLen;
    const ny = pushY / pushLen;
    const into = car.vx * nx + car.vy * ny;
    if (into < 0) {
      car.vx -= into * nx * 1.4;
      car.vy -= into * ny * 1.4;
    }
    if (impact > 130) {
      car.health -= (impact - 110) * 0.16 * (2 - spec.mass * 0.4);
      if (fx) fx.burst(car.x + nCos * spec.length * 0.4, car.y + nSin * spec.length * 0.4, 7, '#ffd98a', 190, 0.4, 3);
    }
  }
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    car.health = 0;
  }
  if (car.health < 55 && fx) {
    car.smokeClock -= dt;
    if (car.smokeClock <= 0) {
      car.smokeClock = car.health < 25 ? 0.07 : 0.16;
      fx.smoke(car.x + nCos * spec.length * 0.32, car.y + nSin * spec.length * 0.32, car.health < 25);
    }
  }
  return impact;
}

/** Push two cars apart where their bodies overlap; returns impact speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = (a.spec.length + b.spec.length) * 0.36;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 === 0) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (minD - d) / 2;
  const totalMass = a.spec.mass + b.spec.mass;
  a.x -= nx * overlap * (b.spec.mass / totalMass) * 2 * 0.5;
  a.y -= ny * overlap * (b.spec.mass / totalMass) * 2 * 0.5;
  b.x += nx * overlap * (a.spec.mass / totalMass) * 2 * 0.5;
  b.y += ny * overlap * (a.spec.mass / totalMass) * 2 * 0.5;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    const impulse = -rel * 0.72;
    a.vx -= impulse * nx * (b.spec.mass / totalMass);
    a.vy -= impulse * ny * (b.spec.mass / totalMass);
    b.vx += impulse * nx * (a.spec.mass / totalMass);
    b.vy += impulse * ny * (a.spec.mass / totalMass);
    const impact = -rel;
    if (impact > 120) {
      a.health -= (impact - 100) * 0.1;
      b.health -= (impact - 100) * 0.1;
    }
    return impact;
  }
  return 0;
}

/** The route a traffic car is following: which road, which way along it. */
function newRoute(city, car) {
  // Start along whichever road the car is nearest, in a random direction.
  const inter = city.nearestIntersection(car.x, car.y);
  const alongX = Math.abs(car.y - inter.y) < Math.abs(car.x - inter.x);
  if (alongX) return { axis: 'x', line: inter.y, dir: car.x <= inter.x ? 1 : -1, ix: inter.ix, iy: inter.iy };
  return { axis: 'y', line: inter.x, dir: car.y <= inter.y ? 1 : -1, ix: inter.ix, iy: inter.iy };
}

/** Control inputs for a civilian driver: stay in lane, follow the grid, keep gaps. */
export function trafficControl(G, car, dt) {
  const { city } = G;
  if (!car.route) car.route = newRoute(city, car);
  const route = car.route;
  const control = { throttle: 0, steer: 0, brake: false, handbrake: false };

  // Where the lane centre is, and how far off it the car sits.
  let laneCoord;
  let crossError;
  let heading;
  if (route.axis === 'x') {
    laneCoord = route.line + (route.dir > 0 ? LANE : -LANE);
    crossError = laneCoord - car.y;
    heading = route.dir > 0 ? 0 : Math.PI;
  } else {
    laneCoord = route.line + (route.dir > 0 ? -LANE : LANE);
    crossError = laneCoord - car.x;
    heading = route.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  // Approaching the next intersection: maybe turn onto the crossing road.
  const inter = city.nearestIntersection(car.x, car.y);
  const distToInter = Math.hypot(inter.x - car.x, inter.y - car.y);
  car.turnCooldown -= dt;
  if (distToInter < 52 && car.turnCooldown <= 0) {
    car.turnCooldown = 1.2;
    const roll = G.rng.next();
    if (roll > 0.52) {
      // Turn: swap the route onto the crossing road at this intersection.
      const turning = route.axis === 'x'
        ? { axis: 'y', line: inter.x, dir: roll > 0.76 ? 1 : -1, ix: inter.ix, iy: inter.iy }
        : { axis: 'x', line: inter.y, dir: roll > 0.76 ? 1 : -1, ix: inter.ix, iy: inter.iy };
      const atEdge = (turning.axis === 'y' && (inter.ix === 0 || inter.ix === city.roadsX.length - 1))
        || (turning.axis === 'x' && (inter.iy === 0 || inter.iy === city.roadsY.length - 1));
      if (!atEdge) car.route = turning;
    }
  }
  // Near the map's driving edge, turn around rather than leave the grid.
  if ((route.axis === 'x' && ((route.dir > 0 && car.x > city.roadsX[city.roadsX.length - 1] - 30)
      || (route.dir < 0 && car.x < city.roadsX[0] + 30)))
    || (route.axis === 'y' && ((route.dir > 0 && car.y > city.roadsY[city.roadsY.length - 1] - 30)
      || (route.dir < 0 && car.y < city.roadsY[0] + 30)))) {
    route.dir *= -1;
  }

  // Desired heading: along the road, corrected toward the lane centre.
  const correction = Math.max(-0.55, Math.min(0.55, crossError * 0.012));
  const desired = heading + (route.axis === 'x' ? -correction * route.dir : correction * route.dir);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  control.steer = Math.max(-1, Math.min(1, diff * 2.4));

  // Traffic ahead: match it or stop. Peds on the road count too.
  let gap = Infinity;
  const noseX = car.x + Math.cos(car.angle) * (car.spec.length / 2 + 34);
  const noseY = car.y + Math.sin(car.angle) * (car.spec.length / 2 + 34);
  for (const other of G.cars) {
    if (other === car) continue;
    const d = Math.hypot(other.x - noseX, other.y - noseY);
    if (d < 66) gap = Math.min(gap, d);
  }
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - noseX, ped.y - noseY);
    if (d < 44) gap = Math.min(gap, d * 0.8);
  }
  const playerCar = G.player.car;
  if (playerCar && playerCar !== car) {
    const d = Math.hypot(playerCar.x - noseX, playerCar.y - noseY);
    if (d < 66) gap = Math.min(gap, d);
  }

  const cruise = car.spec.topSpeed * 0.52;
  const fSpeed = forwardSpeed(car);
  if (gap < 26) {
    control.brake = fSpeed > 4;
    control.throttle = fSpeed < -2 ? 0.4 : 0;
    car.stuckClock += dt;
    if (car.stuckClock > 2.2) {
      car.honkClock -= dt;
      if (car.honkClock <= 0) {
        car.honkClock = G.rng.range(1.4, 3.4);
        G.audio.horn();
        G.fx.text(car.x, car.y - 34, 'HONK!', '#ffd98a', 13);
      }
    }
  } else {
    car.stuckClock = 0;
    const target = gap < 60 ? cruise * 0.45 : cruise;
    control.throttle = fSpeed < target ? 0.75 : 0;
    if (fSpeed > target + 26) control.brake = true;
  }
  return control;
}

/** Fill the streets: moving traffic, parked cars, a few taxis waiting for fares. */
export function spawnInitialCars(G, trafficCount = 26, parkedCount = 34) {
  const { city, rng } = G;
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'truck'];
  for (let i = 0; i < trafficCount; i += 1) {
    const p = city.randomRoadPoint(rng);
    const type = rng.pick(types);
    const car = createCar(rng, type, p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    car.driver = 'traffic';
    car.route = newRoute(city, car);
    // Face along the route at once so the first frames look settled.
    car.angle = car.route.axis === 'x' ? (car.route.dir > 0 ? 0 : Math.PI) : (car.route.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    G.cars.push(car);
  }
  // Parked cars live off the driving lanes: nose-in along the map's quiet
  // margins and the beach parking strip, where traffic never needs to pass.
  const strips = [
    { fixed: 70, axis: 'y', from: 260, to: G.city.height - 260, angle: 0 },
    { fixed: 70, axis: 'x', from: 320, to: 3300, angle: Math.PI / 2 },
    { fixed: G.city.height - 70, axis: 'x', from: 320, to: 3300, angle: -Math.PI / 2 },
    { fixed: 3525, axis: 'y', from: 260, to: G.city.height - 260, angle: Math.PI },
  ];
  for (let i = 0; i < parkedCount; i += 1) {
    const strip = rng.pick(strips);
    const along = rng.range(strip.from, strip.to);
    const x = strip.axis === 'y' ? strip.fixed : along;
    const y = strip.axis === 'y' ? along : strip.fixed;
    const type = rng.pick(['sedan', 'sedan', 'sports', 'truck', 'taxi']);
    const car = createCar(rng, type, x, y, strip.angle + (rng.chance(0.5) ? Math.PI : 0));
    car.driver = null;
    G.cars.push(car);
  }
}

/** Keep traffic near the player: far cars quietly re-enter closer to the action. */
export function recycleTraffic(G) {
  const { city, rng, player } = G;
  for (const car of G.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d > 1750) {
      const p = city.randomRoadPoint(rng);
      if (Math.hypot(p.x - player.x, p.y - player.y) < 620) continue;
      car.x = p.x;
      car.y = p.y;
      car.vx = 0;
      car.vy = 0;
      car.route = newRoute(city, car);
      car.angle = car.route.axis === 'x' ? (car.route.dir > 0 ? 0 : Math.PI) : (car.route.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
}
