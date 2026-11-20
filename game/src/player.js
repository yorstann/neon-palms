// The player: Reyes, a driver-for-hire new in Palmera Bay. On foot he walks,
// runs, fights with fists or a pistol aimed by the mouse, and picks things up;
// E gets him into any car (pulling its driver out if it has one — a crime when
// seen) and the same key gets him out again. In a car he is the driver every
// other system reads: G.player.car is the car, G.player.x/y ride along.

import { PLAYER, GUN } from './config.js';
import { KEY } from './input.js';
import { doorPoint, driveCar, forwardSpeed } from './vehicles.js';
import { createPed, hurtPed } from './pedestrians.js';
import { hurtOfficer, reportCrime } from './police.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    armour: 0,
    car: null,
    inCar: false,
    weapon: 'pistol',
    ammo: GUN.startAmmo,
    punchClock: 0,
    shootClock: 0,
    phase: 0,
    moving: false,
  };
}

/** Damage the player; armour soaks most of it. Death hands over to 'wasted'. */
export function hurtPlayer(G, amount) {
  const p = G.player;
  if (G.mode !== 'play') return;
  const soaked = Math.min(p.armour, amount * 0.65);
  p.armour -= soaked;
  p.health -= amount - soaked;
  G.fx.shake(Math.min(7, 2 + amount * 0.08));
  if (p.health <= 0) {
    p.health = 0;
    G.mode = 'wasted';
    G.modeClock = 0;
    G.audio.engine(null);
    G.audio.siren(null);
  }
}

/** World-space position the mouse is aiming at. */
export function aimPoint(G) {
  return {
    x: G.camera.x + G.input.mouse.x,
    y: G.camera.y + G.input.mouse.y,
  };
}

function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // Jacked: the driver is pulled out onto the street and runs.
    const door = doorPoint(car);
    const victim = createPed(G.rng, door.x, door.y);
    victim.state = 'flee';
    victim.danger = { x: p.x, y: p.y };
    victim.panicClock = 3;
    G.peds.push(victim);
    reportCrime(G, 'carjack', car.x, car.y);
    G.save.stats.carsJacked += 1;
    G.fx.text(car.x, car.y - 40, 'JACKED!', '#ff9d5c', 15);
  }
  if (car.driver === 'police') reportCrime(G, 'copHit', car.x, car.y);
  car.driver = 'player';
  car.route = null;
  p.car = car;
  p.inCar = true;
  p.x = car.x;
  p.y = car.y;
  G.audio.door();
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const door = doorPoint(car);
  const solved = G.city.collideCircle(door.x, door.y, PLAYER.radius);
  p.x = solved.x;
  p.y = solved.y;
  if (car.driver === 'player') car.driver = null;
  p.car = null;
  p.inCar = false;
  G.audio.door();
  G.audio.engine(null);
}

function tryInteract(G) {
  const p = G.player;
  if (p.inCar) {
    if (Math.abs(forwardSpeed(p.car)) < 60) exitCar(G);
    return;
  }
  // The nearest car with a reachable door wins.
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
  if (best) enterCar(G, best);
}

function punch(G) {
  const p = G.player;
  p.punchClock = PLAYER.punchCooldown;
  G.audio.punch();
  const reach = PLAYER.punchRange;
  const tx = p.x + Math.cos(p.angle) * reach * 0.7;
  const ty = p.y + Math.sin(p.angle) * reach * 0.7;
  let connected = false;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - tx, ped.y - ty) < reach * 0.75) {
      hurtPed(G, ped, PLAYER.punchDamage, p.x, p.y);
      connected = true;
    }
  }
  for (const cop of G.cops) {
    if (cop.dead) continue;
    if (Math.hypot(cop.x - tx, cop.y - ty) < reach * 0.75) {
      hurtOfficer(G, cop, PLAYER.punchDamage);
      connected = true;
    }
  }
  if (connected) reportCrime(G, 'punch', p.x, p.y);
}

function shoot(G) {
  const p = G.player;
  if (p.ammo <= 0) {
    p.shootClock = 0.3;
    G.audio.dryFire();
    G.fx.text(p.x, p.y - 30, 'NO AMMO', '#ff9d5c', 13);
    return;
  }
  p.ammo -= 1;
  p.shootClock = GUN.cooldown;
  G.save.stats.shotsFired += 1;
  const aim = aimPoint(G);
  const base = Math.atan2(aim.y - p.y, aim.x - p.x);
  const angle = base + G.rng.range(-GUN.spread, GUN.spread);
  p.angle = base;
  G.bullets.push({
    x: p.x + Math.cos(base) * 18,
    y: p.y + Math.sin(base) * 18,
    vx: Math.cos(angle) * GUN.speed,
    vy: Math.sin(angle) * GUN.speed,
    life: GUN.range / GUN.speed,
  });
  G.fx.burst(p.x + Math.cos(base) * 22, p.y + Math.sin(base) * 22, 3, '#ffd98a', 120, 0.16, 2.4);
  G.fx.shake(1.2);
  G.audio.shoot();
  reportCrime(G, 'shot', p.x, p.y);
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!G.city.segmentClear(b.x, b.y, nx, ny)) {
      G.fx.burst(nx, ny, 3, '#ffe9b0', 130, 0.25, 2);
      dead = true;
    }
    if (!dead) {
      for (const ped of G.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - nx, ped.y - ny) < 14) {
          const wasAlive = ped.health > 0;
          hurtPed(G, ped, GUN.damage, b.x, b.y);
          if (wasAlive && ped.dead) reportCrime(G, 'pedDown', ped.x, ped.y);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const cop of G.cops) {
        if (cop.dead) continue;
        if (Math.hypot(cop.x - nx, cop.y - ny) < 14) {
          hurtOfficer(G, cop, GUN.damage);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of G.cars) {
        if (car === G.player.car) continue;
        if (Math.abs(nx - car.x) < car.spec.length / 2 && Math.abs(ny - car.y) < car.spec.length / 2
          && Math.hypot(nx - car.x, ny - car.y) < car.spec.length * 0.44) {
          car.health -= GUN.damage * 0.55;
          G.fx.burst(nx, ny, 4, '#ffd98a', 170, 0.3, 2.4);
          if (car.driver === 'police') reportCrime(G, 'copCarRam', car.x, car.y);
          dead = true;
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
    else {
      b.x = nx;
      b.y = ny;
    }
  }
}

function collectPickups(G) {
  const p = G.player;
  if (p.inCar) return;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const item = G.pickups[i];
    if (Math.hypot(item.x - p.x, item.y - p.y) > 27) continue;
    if (item.kind === 'cash') {
      G.save.money += item.amount;
      G.save.stats.earned += item.amount;
      G.fx.text(p.x, p.y - 26, `+$${item.amount}`, '#7dd069', 14);
      G.fx.cashBurst(p.x, p.y);
      G.audio.cash();
    } else if (item.kind === 'ammo') {
      p.ammo += item.amount;
      G.fx.text(p.x, p.y - 26, `+${item.amount} AMMO`, '#ffd98a', 13);
      G.audio.pickup();
    } else if (item.kind === 'health') {
      p.health = Math.min(PLAYER.health, p.health + item.amount);
      G.fx.text(p.x, p.y - 26, `+${item.amount} HEALTH`, '#7dd069', 13);
      G.audio.pickup();
    } else if (item.kind === 'armour') {
      p.armour = PLAYER.armour;
      G.fx.text(p.x, p.y - 26, 'ARMOUR', '#9fd8ff', 13);
      G.audio.pickup();
    } else {
      continue; // packages are the missions module's business
    }
    G.pickups.splice(i, 1);
  }
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  p.punchClock = Math.max(0, p.punchClock - dt);
  p.shootClock = Math.max(0, p.shootClock - dt);

  if (input.pressed(...KEY.interact)) tryInteract(G);

  if (p.inCar) {
    const car = p.car;
    const control = {
      throttle: (input.down(...KEY.up) ? 1 : 0) - (input.down(...KEY.down) ? 1 : 0),
      steer: (input.down(...KEY.right) ? 1 : 0) - (input.down(...KEY.left) ? 1 : 0),
      brake: input.down('Space'),
      handbrake: input.down('Space'),
    };
    const impact = driveCar(G, car, dt, control);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    const speed = Math.hypot(car.vx, car.vy);
    G.audio.engine(Math.min(1, speed / car.spec.topSpeed));
    if (impact > 175) {
      G.audio.crash(Math.min(1, impact / 320));
      G.fx.shake(Math.min(9, impact * 0.02));
      if (impact > 235) hurtPlayer(G, (impact - 225) * 0.06);
      if (impact > 200) reportCrime(G, 'carCrash', car.x, car.y);
    }
    return;
  }

  G.audio.engine(null);

  // On foot.
  let mx = (input.down(...KEY.right) ? 1 : 0) - (input.down(...KEY.left) ? 1 : 0);
  let my = (input.down(...KEY.down) ? 1 : 0) - (input.down(...KEY.up) ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = input.down(...KEY.run) ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const solved = G.city.collideCircle(p.x + mx * speed * dt, p.y + my * speed * dt, PLAYER.radius);
    if (G.city.groundAt(solved.x, solved.y) !== 'water') {
      p.x = solved.x;
      p.y = solved.y;
    }
    p.phase += dt * (input.down(...KEY.run) ? 11 : 8);
    if (!input.mouse.down) p.angle = Math.atan2(my, mx);
  }

  // Combat: mouse aims whenever it is used; F or a click swings a fist.
  const aim = aimPoint(G);
  if (input.mouse.down) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  if (input.pressed(...KEY.melee) || (input.takeClick() && p.weapon === 'fists')) {
    if (p.punchClock <= 0) punch(G);
  }
  if (input.mouse.down && p.weapon === 'pistol' && p.shootClock <= 0) shoot(G);
  if (input.pressed('Digit1')) p.weapon = 'fists';
  if (input.pressed('Digit2')) p.weapon = 'pistol';
  const wheel = input.takeWheel();
  if (wheel !== 0) p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';

  collectPickups(G);
}
