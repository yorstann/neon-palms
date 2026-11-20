// Pedestrians: the people of Palmera Bay. They stroll the sidewalks between
// random corners, run when something frightens them (a fast car, a shot, a
// crash), fall when hurt and sometimes drop the cash they were carrying.
// A few stand at kerbs with a fare marker over their heads, waiting for a cab.

const SHIRTS = ['#e8e3d5', '#37a0d8', '#e35d7a', '#f2b234', '#5dbb63', '#8a6fe3', '#d86f37', '#eef1f5', '#3f6fb3'];
const PANTS = ['#2c3242', '#4a3b2c', '#5b6e46', '#703048', '#31517a', '#22242a'];
const SKINS = ['#f2c79b', '#d9a066', '#a9713f', '#7a4a26', '#ffe0bd'];

let nextPedId = 1;

export function createPed(rng, x, y) {
  return {
    id: nextPedId++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    state: 'walk', // walk | flee | down | stand | toCar
    target: null,
    waitClock: rng.range(0, 2),
    panicClock: 0,
    danger: null,
    health: 100,
    dead: false,
    fadeClock: 0,
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    skin: rng.pick(SKINS),
    cash: rng.int(4, 42),
    fare: false,
    phase: rng.range(0, 6.28),
  };
}

/** Scatter the opening crowd around a point so the first frame is alive. */
export function spawnInitialPeds(G, around, count = 34) {
  for (let i = 0; i < count; i += 1) {
    const p = G.city.randomSidewalkPoint(G.rng);
    if (Math.hypot(p.x - around.x, p.y - around.y) > 900) continue;
    G.peds.push(createPed(G.rng, p.x, p.y));
  }
  while (G.peds.length < 18) {
    const p = G.city.randomSidewalkPoint(G.rng);
    G.peds.push(createPed(G.rng, p.x, p.y));
  }
}

/** Keep the streets populated near the player and thin them out far away. */
export function maintainPeds(G) {
  const { city, rng, player } = G;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d > 1250 && ped.state !== 'toCar' && !ped.fare) G.peds.splice(i, 1);
  }
  if (G.peds.length < 34) {
    const p = city.randomSidewalkPoint(rng);
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d > 480 && d < 1150) G.peds.push(createPed(rng, p.x, p.y));
  }
}

/** Frighten everyone in earshot of a point (a shot, a crash, a scream). */
export function scarePeds(G, x, y, radius = 260) {
  for (const ped of G.peds) {
    if (ped.dead || ped.state === 'toCar') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.danger = { x, y };
      ped.panicClock = G.rng.range(1.6, 3.4);
    }
  }
}

function movePed(G, ped, dt, tx, ty, speed) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return true;
  const desired = Math.atan2(dy, dx);
  let diff = desired - ped.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.angle += Math.max(-7 * dt, Math.min(7 * dt, diff));
  ped.speed = speed;
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const solved = G.city.collideCircle(nx, ny, 11);
  ped.x = solved.x;
  ped.y = solved.y;
  if (G.city.groundAt(ped.x, ped.y) === 'water') {
    ped.x -= Math.cos(ped.angle) * speed * dt;
    ped.y -= Math.sin(ped.angle) * speed * dt;
  }
  return dist < 22;
}

export function hurtPed(G, ped, damage, sourceX, sourceY) {
  if (ped.dead) return;
  ped.health -= damage;
  G.fx.hitPuff(ped.x, ped.y);
  if (ped.health <= 0) {
    ped.dead = true;
    ped.state = 'down';
    ped.fadeClock = 26;
    if (G.rng.chance(0.65)) {
      G.pickups.push({
        kind: 'cash', x: ped.x + G.rng.range(-14, 14), y: ped.y + G.rng.range(-14, 14),
        amount: ped.cash, clock: 0,
      });
    }
  } else {
    ped.state = 'flee';
    ped.danger = { x: sourceX, y: sourceY };
    ped.panicClock = G.rng.range(2, 3.6);
  }
}

export function updatePeds(G, dt) {
  const { city, rng } = G;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    ped.phase += dt * (2 + ped.speed * 0.05);

    if (ped.dead) {
      ped.fadeClock -= dt;
      if (ped.fadeClock <= 0) G.peds.splice(i, 1);
      continue;
    }

    // Cars are the real danger on the street: a fast car close by frightens,
    // and one that reaches a pedestrian hurts them.
    for (const car of G.cars) {
      if (car.dead) continue;
      const cs = Math.hypot(car.vx, car.vy);
      if (cs < 12) continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      const reach = car.spec.length * 0.46;
      if (d < reach) {
        const wasPlayer = G.player.car === car;
        hurtPed(G, ped, cs * 0.42, car.x, car.y);
        ped.x += car.vx * 0.06;
        ped.y += car.vy * 0.06;
        if (wasPlayer) G.events.push({ type: 'crime', kind: 'runover', x: ped.x, y: ped.y });
        else scarePeds(G, ped.x, ped.y, 200);
        G.audio.crash(0.5);
        break;
      }
      if (d < 120 && cs > 190 && ped.state === 'walk') {
        ped.state = 'flee';
        ped.danger = { x: car.x, y: car.y };
        ped.panicClock = 1.4;
      }
    }
    if (ped.dead) continue;

    if (ped.state === 'flee') {
      ped.panicClock -= dt;
      const away = Math.atan2(ped.y - ped.danger.y, ped.x - ped.danger.x);
      const tx = ped.x + Math.cos(away) * 120;
      const ty = ped.y + Math.sin(away) * 120;
      movePed(G, ped, dt, tx, ty, 238);
      if (ped.panicClock <= 0) {
        ped.state = 'walk';
        ped.target = null;
      }
    } else if (ped.state === 'toCar') {
      // Walking to a waiting car (taxi fare or a story passenger): missions
      // watch for arrival and take it from there.
      if (ped.target && movePed(G, ped, dt, ped.target.x, ped.target.y, 196)) {
        ped.state = 'stand';
        ped.arrived = true;
      }
    } else if (ped.state === 'stand') {
      ped.speed = 0;
    } else {
      // Stroll: pick a corner, walk to it, pause, pick another.
      ped.waitClock -= dt;
      if (!ped.target) {
        if (ped.waitClock <= 0) {
          const p = city.randomSidewalkPoint(rng);
          if (Math.hypot(p.x - ped.x, p.y - ped.y) < 560) ped.target = p;
          ped.waitClock = rng.range(0.4, 2.4);
        }
        ped.speed = 0;
      } else if (movePed(G, ped, dt, ped.target.x, ped.target.y, ped.fare ? 0 : 92)) {
        ped.target = null;
        ped.waitClock = rng.range(0.6, 3.2);
      }
    }
  }
}
