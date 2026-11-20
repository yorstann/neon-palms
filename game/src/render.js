// The world renderer: Palmera Bay drawn top-down with a lift of pseudo-3D —
// building roofs are shifted north by their height over shaded walls, so the
// city reads as solid blocks rather than flat tiles. Everything is culled to
// the camera's view, and buildings, cars and people share one pass sorted by
// their ground line so nearer things overlap farther ones correctly.

import { PALETTE, VIEW } from './config.js';
import { ROAD_HALF } from './city.js';

/** How dark the world is at a given hour (0 at day, 1 in deep night). */
export function nightFactor(hour) {
  if (hour >= 7 && hour <= 17.5) return 0;
  if (hour >= 19.5 || hour <= 5) return 1;
  if (hour > 17.5) return (hour - 17.5) / 2;
  return 1 - (hour - 5) / 2;
}

function drawGround(ctx, city, view, t) {
  ctx.fillStyle = '#4c4f45';
  ctx.fillRect(view.x, view.y, view.w, view.h);

  // Water first: an animated pair of drifting highlight bands.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(city.waterX, view.y, city.width - city.waterX, view.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(city.waterX, view.y, 46, view.h);
  ctx.strokeStyle = 'rgba(190, 232, 242, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = Math.floor(view.y / 90) * 90; y < view.y + view.h; y += 90) {
    const off = Math.sin(y * 0.02 + t * 0.9) * 16;
    ctx.moveTo(city.waterX + 120 + off, y);
    ctx.lineTo(city.waterX + 210 + off, y);
    ctx.moveTo(city.waterX + 330 - off, y + 40);
    ctx.lineTo(city.waterX + 430 - off, y + 40);
  }
  ctx.stroke();

  // Sand and the promenade.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(city.sandX, view.y, city.waterX - city.sandX, view.h);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(city.waterX - 14, view.y, 8, view.h);

  // Blocks: sidewalk slab, then the district's ground inside it.
  for (const b of city.blocks) {
    if (b.x + b.w < view.x || b.x > view.x + view.w || b.y + b.h < view.y || b.y > view.y + view.h) continue;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.ground === 'grass' ? PALETTE.grass : b.ground === 'sand' ? '#dcc493' : PALETTE.lot;
    ctx.fillRect(b.x + 18, b.y + 18, b.w - 36, b.h - 36);
    if (b.ground === 'grass') {
      ctx.fillStyle = PALETTE.grassDark;
      const n = ((b.x * 7 + b.y * 13) % 5) + 2;
      for (let i = 0; i < n; i += 1) {
        const px = b.x + 30 + ((b.x * (i + 3) * 37) % (b.w - 70));
        const py = b.y + 30 + ((b.y * (i + 5) * 41) % (b.h - 70));
        ctx.fillRect(px, py, 26, 15);
      }
    }
  }

  // Roads: asphalt bands, edge lines, dashed centres, crosswalks.
  ctx.fillStyle = PALETTE.road;
  for (const rx of city.roadsX) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, city.height);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - ROAD_HALF, city.sandX + 40, ROAD_HALF * 2);
  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const rx of city.roadsX) {
    ctx.moveTo(rx - ROAD_HALF, 0);
    ctx.lineTo(rx - ROAD_HALF, city.height);
    ctx.moveTo(rx + ROAD_HALF, 0);
    ctx.lineTo(rx + ROAD_HALF, city.height);
  }
  ctx.stroke();
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const rx of city.roadsX) {
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, city.height);
  }
  for (const ry of city.roadsY) {
    ctx.moveTo(0, ry);
    ctx.lineTo(city.sandX + 40, ry);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PALETTE.crosswalk;
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      for (let s = -1; s <= 1; s += 2) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(rx + s * (ROAD_HALF + 5) - 4, ry + i * 20 - 6, 8, 12);
          ctx.fillRect(rx + i * 20 - 6, ry + s * (ROAD_HALF + 5) - 4, 12, 8);
        }
      }
    }
  }

  // The marina pier reaching into the bay.
  const pier = city.pier;
  ctx.fillStyle = '#7a5c38';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = pier.x + 12; x < pier.x + pier.w; x += 26) ctx.fillRect(x, pier.y, 3, pier.h);
}

function drawProp(ctx, prop, t, night) {
  if (prop.kind === 'palm') {
    ctx.strokeStyle = '#6e5136';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y);
    ctx.lineTo(prop.x + 3, prop.y - 7);
    ctx.stroke();
    ctx.strokeStyle = '#3f8a4a';
    ctx.lineWidth = 3.4;
    const sway = Math.sin(t * 1.3 + prop.x * 0.05) * 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + prop.x;
      ctx.beginPath();
      ctx.moveTo(prop.x + 3, prop.y - 7);
      ctx.quadraticCurveTo(
        prop.x + 3 + Math.cos(a) * 13 * prop.s, prop.y - 12 * prop.s + Math.sin(a) * 5,
        prop.x + 3 + Math.cos(a) * 21 * prop.s + sway, prop.y - 5 * prop.s + Math.sin(a) * 10 * prop.s,
      );
      ctx.stroke();
    }
  } else if (prop.kind === 'lamp') {
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
    if (night > 0.25) {
      const g = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 44);
      g.addColorStop(0, `rgba(255, 196, 110, ${0.34 * night})`);
      g.addColorStop(1, 'rgba(255, 196, 110, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(prop.x - 44, prop.y - 44, 88, 88);
    }
  } else if (prop.kind === 'bench') {
    ctx.fillStyle = '#6e5136';
    ctx.fillRect(prop.x - 13, prop.y - 4, 26, 8);
  } else if (prop.kind === 'boat') {
    ctx.save();
    ctx.translate(prop.x, prop.y + Math.sin(t * 0.8 + prop.x) * 2.4);
    ctx.rotate(prop.a);
    ctx.fillStyle = '#e8e3d5';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b3543f';
    ctx.fillRect(-12, -3, 24, 6);
    ctx.restore();
  }
}

function drawBuilding(ctx, b, night) {
  // Ground shadow, south wall, then the roof lifted north by the height.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y - b.ht * 0.4, b.w, b.h + b.ht * 0.4);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y - b.ht * 0.4, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y - b.ht * 0.4, b.w, b.h);
  // Rooftop clutter and windows that light up after dark.
  if (!b.container) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(b.x + b.w * 0.12, b.y - b.ht * 0.4 + b.h * 0.12, b.w * 0.2, b.h * 0.16);
    ctx.fillRect(b.x + b.w * 0.62, b.y - b.ht * 0.4 + b.h * 0.55, b.w * 0.16, b.h * 0.2);
    if (night > 0.2) {
      ctx.fillStyle = `rgba(255, 205, 120, ${0.75 * night})`;
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const lit = ((i * 31 + j * 57 + b.x) % 7) < 3;
          if (lit) ctx.fillRect(b.x + 8 + i * 24, b.y - b.ht * 0.4 + 8 + j * 28, 9, 12);
        }
      }
    }
    if (b.name) {
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(6, 8, 16, 0.55)';
      const w = ctx.measureText(b.name).width + 18;
      ctx.fillRect(b.x + b.w / 2 - w / 2, b.y - b.ht * 0.4 + 6, w, 23);
      ctx.fillStyle = '#ffd98a';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - b.ht * 0.4 + 22);
    }
  }
}

export function drawCar(ctx, car, t) {
  const { spec } = car;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = spec.length;
  const W = spec.width;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 4, -W / 2 + 5, L, W);
  // Wheels.
  ctx.fillStyle = '#14161a';
  const ww = 11;
  const wh = 6;
  ctx.fillRect(-L / 2 + 8, -W / 2 - 2, ww, wh);
  ctx.fillRect(L / 2 - 8 - ww, -W / 2 - 2, ww, wh);
  ctx.fillRect(-L / 2 + 8, W / 2 - 4, ww, wh);
  ctx.fillRect(L / 2 - 8 - ww, W / 2 - 4, ww, wh);
  // Body.
  ctx.fillStyle = car.dead ? '#2c2c30' : car.colour;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 9);
  ctx.fill();
  if (car.type === 'police') {
    ctx.fillStyle = '#eef1f5';
    ctx.fillRect(-L * 0.18, -W / 2, L * 0.36, W);
    const flash = Math.sin(t * 11 + car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff4040' : '#4060ff';
    ctx.fillRect(-7, -W / 2 + 5, 14, 7);
    ctx.fillStyle = flash ? '#4060ff' : '#ff4040';
    ctx.fillRect(-7, W / 2 - 12, 14, 7);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-9, -8, 18, 16);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'truck') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 4, L * 0.52, W - 8);
  }
  // Cabin glass and a sports car's stripe.
  ctx.fillStyle = 'rgba(16, 22, 34, 0.9)';
  ctx.beginPath();
  ctx.roundRect(-L * 0.16, -W / 2 + 5, L * 0.34, W - 10, 5);
  ctx.fill();
  if (car.type === 'sports') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-L / 2, -3, L, 6);
  }
  // Lights.
  ctx.fillStyle = '#ffe9b0';
  ctx.fillRect(L / 2 - 3, -W / 2 + 5, 3, 7);
  ctx.fillRect(L / 2 - 3, W / 2 - 12, 3, 7);
  ctx.fillStyle = '#ff5040';
  ctx.fillRect(-L / 2, -W / 2 + 5, 3, 7);
  ctx.fillRect(-L / 2, W / 2 - 12, 3, 7);
  ctx.restore();
}

export function drawPerson(ctx, x, y, angle, phase, colours, opts = {}) {
  const stride = Math.sin(phase) * 3.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = colours.pants;
  ctx.fillRect(-2 + stride * 0.4, -6, 4.4, 7);
  ctx.fillRect(-2 - stride * 0.4, 1, 4.4, 7);
  ctx.fillStyle = colours.shirt;
  ctx.beginPath();
  ctx.roundRect(-7, -7, 15, 14, 5);
  ctx.fill();
  if (opts.badge) {
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(1, -5, 4, 4);
  }
  if (opts.hat) {
    ctx.fillStyle = '#20304a';
    ctx.beginPath();
    ctx.arc(2, 0, 6.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = colours.skin;
  ctx.beginPath();
  ctx.arc(2.5, 0, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (opts.marker) {
    ctx.fillStyle = opts.marker;
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    const bob = Math.sin(performance.now() / 280) * 3;
    ctx.fillText('$', x, y - 24 + bob);
  }
}

/** The static half of the minimap, drawn once: water, sand, blocks, roads. */
export function createMinimapBase(city) {
  const scale = 0.05;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(city.width * scale);
  canvas.height = Math.ceil(city.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#17384a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(city.sandX * scale, 0, (city.waterX - city.sandX) * scale, canvas.height);
  ctx.fillStyle = '#5a6156';
  for (const b of city.blocks) ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
  ctx.fillStyle = '#c8ccd2';
  for (const rx of city.roadsX) ctx.fillRect((rx - ROAD_HALF) * scale, 0, ROAD_HALF * 2 * scale, city.height * scale);
  for (const ry of city.roadsY) ctx.fillRect(0, (ry - ROAD_HALF) * scale, city.width * scale, ROAD_HALF * 2 * scale);
  return { canvas, scale };
}

export function renderWorld(ctx, G) {
  const { city, camera } = G;
  const t = G.time;
  const night = nightFactor(G.hour);
  const view = { x: camera.x, y: camera.y, w: VIEW.width, h: VIEW.height };

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawGround(ctx, city, view, t);

  // Skid marks lie on the asphalt.
  ctx.strokeStyle = 'rgba(12, 12, 14, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const s of G.fx.skids) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  // Pickups: cash glows green, packages pulse cyan, meds and ammo sit still.
  for (const item of G.pickups) {
    if (item.x < view.x - 40 || item.x > view.x + view.w + 40 || item.y < view.y - 40 || item.y > view.y + view.h + 40) continue;
    item.clock = (item.clock ?? 0) + 0.016;
    const bob = Math.sin(item.clock * 3.2) * 3;
    if (item.kind === 'cash') {
      ctx.fillStyle = '#7dd069';
      ctx.fillRect(item.x - 7, item.y - 5 + bob, 14, 10);
      ctx.fillStyle = '#2c5e26';
      ctx.fillRect(item.x - 2, item.y - 5 + bob, 4, 10);
    } else if (item.kind === 'package') {
      const pulse = 12 + Math.sin(item.clock * 4) * 3.4;
      ctx.strokeStyle = '#37e0d8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(item.x, item.y + bob, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#37e0d8';
      ctx.fillRect(item.x - 5, item.y - 5 + bob, 10, 10);
    } else if (item.kind === 'ammo') {
      ctx.fillStyle = '#c8a03c';
      ctx.fillRect(item.x - 8, item.y - 5 + bob, 16, 10);
    } else if (item.kind === 'health') {
      ctx.fillStyle = '#eef1f5';
      ctx.fillRect(item.x - 8, item.y - 8 + bob, 16, 16);
      ctx.fillStyle = '#d23b3b';
      ctx.fillRect(item.x - 2, item.y - 5 + bob, 4, 10);
      ctx.fillRect(item.x - 5, item.y - 2 + bob, 10, 4);
    } else if (item.kind === 'armour') {
      ctx.fillStyle = '#3f6fb3';
      ctx.beginPath();
      ctx.roundRect(item.x - 8, item.y - 8 + bob, 16, 16, 4);
      ctx.fill();
    }
  }

  // One pass, sorted by ground line: props, people, cars, buildings.
  const drawables = [];
  for (const prop of city.props) {
    if (prop.x < view.x - 60 || prop.x > view.x + view.w + 60 || prop.y < view.y - 60 || prop.y > view.y + view.h + 60) continue;
    drawables.push({ y: prop.y, draw: () => drawProp(ctx, prop, t, night) });
  }
  for (const b of city.buildings) {
    if (b.x + b.w < view.x || b.x > view.x + view.w || b.y + b.h < view.y || b.y - 40 > view.y + view.h) continue;
    drawables.push({ y: b.y + b.h, draw: () => drawBuilding(ctx, b, night) });
  }
  for (const ped of G.peds) {
    drawables.push({
      y: ped.y + 8,
      draw: () => {
        if (ped.dead) {
          ctx.save();
          ctx.translate(ped.x, ped.y);
          ctx.rotate(ped.angle + 1.2);
          ctx.globalAlpha = Math.max(0, Math.min(1, ped.fadeClock / 6));
          ctx.fillStyle = ped.shirt;
          ctx.fillRect(-9, -5, 18, 10);
          ctx.restore();
          ctx.globalAlpha = 1;
          return;
        }
        drawPerson(ctx, ped.x, ped.y, ped.angle, ped.phase,
          { shirt: ped.shirt, pants: ped.pants, skin: ped.skin },
          { marker: ped.fare ? '#7dd069' : null });
      },
    });
  }
  for (const cop of G.cops) {
    if (cop.dead) continue;
    drawables.push({
      y: cop.y + 8,
      draw: () => drawPerson(ctx, cop.x, cop.y, cop.angle, cop.phase,
        { shirt: '#20304a', pants: '#182238', skin: '#e8b98d' }, { badge: true, hat: true }),
    });
  }
  for (const car of G.cars) {
    drawables.push({ y: car.y + car.spec.width / 2, draw: () => drawCar(ctx, car, t) });
  }
  if (!G.player.inCar) {
    const p = G.player;
    drawables.push({
      y: p.y + 8,
      draw: () => {
        drawPerson(ctx, p.x, p.y, p.angle, p.phase,
          { shirt: '#ff4d8d', pants: '#23232e', skin: '#d9a066' }, {});
        if (p.weapon === 'pistol') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = '#14161a';
          ctx.fillRect(8, -2, 13, 4);
          ctx.restore();
        }
      },
    });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Bullets as bright tracers.
  ctx.strokeStyle = '#ffe9b0';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const b of G.bullets) {
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // The objective marker: a pillar of gold light.
  const markerPos = G.missionMarker
    ?? (G.taxi && G.taxi.stage === 'deliver' ? G.taxi.dest : null)
    ?? (G.taxi && G.taxi.stage === 'pickup' && G.taxi.ped ? { x: G.taxi.ped.x, y: G.taxi.ped.y } : null)
    ?? G.missionOffer;
  if (markerPos && G.mode === 'play') {
    const pulse = 0.72 + Math.sin(t * 4.4) * 0.28;
    const grad = ctx.createLinearGradient(0, markerPos.y - 190, 0, markerPos.y);
    grad.addColorStop(0, 'rgba(255, 200, 60, 0)');
    grad.addColorStop(1, `rgba(255, 200, 60, ${0.5 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(markerPos.x - 15, markerPos.y - 190, 30, 190);
    ctx.strokeStyle = `rgba(255, 200, 60, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(markerPos.x, markerPos.y, 30 + Math.sin(t * 4.4) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Particles and floating texts ride above everything.
  for (const p of G.fx.particles) {
    const lifeK = 1 - p.age / p.life;
    if (p.colour === 'smoke') {
      ctx.fillStyle = `rgba(70, 70, 76, ${0.34 * lifeK})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - lifeK * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = Math.max(0, lifeK);
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
  ctx.textAlign = 'center';
  for (const txt of G.fx.texts) {
    ctx.globalAlpha = Math.max(0, 1 - txt.age / txt.life);
    ctx.font = `bold ${txt.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = txt.colour;
    ctx.fillText(txt.label, txt.x, txt.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Night: a blue wash over the world, headlight glow cut back in.
  if (night > 0.02) {
    ctx.fillStyle = `rgba(10, 14, 44, ${0.36 * night})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const car of G.cars) {
      const sx = car.x - camera.x;
      const sy = car.y - camera.y;
      if (sx < -260 || sy < -260 || sx > VIEW.width + 260 || sy > VIEW.height + 260) continue;
      const g = ctx.createRadialGradient(sx, sy, 10, sx + Math.cos(car.angle) * 120, sy + Math.sin(car.angle) * 120, 170);
      g.addColorStop(0, `rgba(255, 230, 160, ${0.13 * night})`);
      g.addColorStop(1, 'rgba(255, 230, 160, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 190, sy - 190, 380, 380);
    }
    ctx.restore();
  }
}
