// The screenshot scenes behind ?shot=title|downtown|chase|mission. Each one
// builds the seeded world, places the cast by hand and steps the real
// simulation a fixed number of steps, so the frame is a true moment of the
// game and the same seed always deals the same frame.

import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';

/** A few extra citizens and cars around a point, for a lived-in frame. */
function dress(G, x, y, peds = 5, cars = 3) {
  for (let i = 0; i < peds; i += 1) {
    const p = G.city.randomSidewalkPoint(G.rng);
    if (Math.hypot(p.x - x, p.y - y) < 620) G.peds.push(createPed(G.rng, p.x, p.y));
  }
  for (let i = 0; i < cars; i += 1) {
    const p = G.city.randomRoadPoint(G.rng);
    if (Math.hypot(p.x - x, p.y - y) < 700) {
      const car = createCar(G.rng, G.rng.pick(['sedan', 'taxi', 'sports', 'truck']), p.x, p.y, 0);
      car.driver = 'traffic';
      G.cars.push(car);
    }
  }
}

function stageTitle(G, stepWorld) {
  G.mode = 'title';
  G.hour = 17.9; // golden hour over the bay
  // The camera drifts over downtown while the traffic rolls beneath the menu.
  G.camera.x = 1500;
  G.camera.y = 1050;
  dress(G, 2040, 1580, 6, 4);
  stepWorld(150);
  G.camera.x = 1500;
  G.camera.y = 1050;
}

function stageDowntown(G, stepWorld) {
  G.mode = 'play';
  G.hour = 11.2;
  G.save.money = 860;
  const p = G.player;
  // Reyes on the corner by the police station, late morning: citizens pass,
  // a cab rolls through the crossing, the towers lean over all of it.
  p.x = 1962;
  p.y = 1306;
  p.angle = 0.4;
  const cab = createCar(G.rng, 'taxi', 1750, 1093, Math.PI);
  cab.driver = 'traffic';
  cab.vx = -190;
  G.cars.push(cab);
  const sedan = createCar(G.rng, 'sedan', 2067, 880, Math.PI / 2);
  sedan.driver = 'traffic';
  sedan.vy = 210;
  G.cars.push(sedan);
  const corners = [[1890, 1290], [2052, 1338], [1866, 1420], [2100, 1240], [1760, 1352]];
  for (const [x, y] of corners) G.peds.push(createPed(G.rng, x, y));
  dress(G, p.x, p.y, 4, 2);
  stepWorld(80);
  p.x = 1962;
  p.y = 1306;
  p.angle = 0.4;
  G.camera.x = p.x - 640;
  G.camera.y = p.y - 360;
}

function stageChase(G, stepWorld) {
  G.mode = 'play';
  G.hour = 18.7; // dusk: headlights, lit windows, neon
  G.save.money = 1240;
  const p = G.player;
  const car = createCar(G.rng, 'sports', 1330, 1580, 0);
  car.colour = '#e33e5f';
  car.driver = 'player';
  car.vx = 330;
  G.cars.push(car);
  p.car = car;
  p.inCar = true;
  p.x = car.x;
  p.y = car.y;
  // Two interceptors on his tail and a third cutting in from a side street.
  const cop1 = createCar(G.rng, 'police', 1130, 1546, 0);
  cop1.driver = 'police';
  cop1.vx = 320;
  const cop2 = createCar(G.rng, 'police', 990, 1618, 0);
  cop2.driver = 'police';
  cop2.vx = 300;
  const cop3 = createCar(G.rng, 'police', 1610, 1160, Math.PI / 2);
  cop3.driver = 'police';
  cop3.vy = 240;
  G.cars.push(cop1, cop2, cop3);
  G.wanted.heat = 330; // three stars
  G.wanted.lastSeen = { x: p.x, y: p.y };
  dress(G, p.x, p.y, 3, 3);
  stepWorld(46);
  // Skid scars and a burst of sparks sell the speed in a still frame.
  for (let i = 0; i < 7; i += 1) {
    G.fx.skid(1330 - i * 34 - 40, 1606, 1330 - i * 34 - 6, 1604);
    G.fx.skid(1330 - i * 34 - 40, 1554, 1330 - i * 34 - 6, 1556);
  }
  G.fx.burst(p.x - 60, p.y + 26, 10, '#ffd98a', 200, 0.7, 3);
  G.camera.x = p.x - 700;
  G.camera.y = p.y - 380;
}

function stageMission(G, stepWorld) {
  G.mode = 'play';
  G.hour = 15.4;
  const p = G.player;
  // Walk into Mara's marker: the first job starts and its phone lines land.
  p.x = G.city.spots.lockup.x;
  p.y = G.city.spots.lockup.y;
  stepWorld(2); // the offer triggers, the step begins, the courier appears
  // Reyes is already rolling east along the coast road toward the dock,
  // the gold pillar of the pickup standing over the marina ahead.
  const car = createCar(G.rng, 'sedan', 3150, 2473, 0);
  car.driver = 'player';
  car.vx = 205;
  G.cars.push(car);
  p.car = car;
  p.inCar = true;
  p.x = car.x;
  p.y = car.y;
  dress(G, 3300, 2200, 4, 2);
  stepWorld(22);
  for (const msg of G.messages) msg.ttl = 7;
  G.camera.x = p.x - 560;
  G.camera.y = p.y - 400;
}

const SCENES = {
  title: stageTitle,
  downtown: stageDowntown,
  chase: stageChase,
  mission: stageMission,
};

/** Set G to the named scene; unknown names fall back to the title. */
export function stageShot(G, name, stepWorld) {
  const scene = SCENES[name] ?? stageTitle;
  scene(G, stepWorld);
}
