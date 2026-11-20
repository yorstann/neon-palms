// The HUD and the screens: everything drawn in screen space over the world —
// money, clock and wanted stars; health, armour and weapon; the speedometer
// and the minimap with its blips; the objective banner and the phone feed;
// and the title, pause, busted and wasted screens the game moves between.

import { FONT, PALETTE, VIEW, GAME_TITLE, CITY_NAME } from './config.js';

const W = VIEW.width;
const H = VIEW.height;

function panel(ctx, x, y, w, h, alpha = 0.78) {
  ctx.fillStyle = `rgba(10, 12, 24, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, colour, label) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, Math.max(0, (w - 3) * Math.min(1, frac)), h - 3, 3);
    ctx.fill();
  }
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(label, x + 6, y + h - 3.5);
}

function star(ctx, cx, cy, r, filled, t) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd94d';
    ctx.shadowColor = 'rgba(255, 217, 77, 0.8)';
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

export function formatClock(hour) {
  const hh = Math.floor(hour) % 24;
  const mm = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawMinimap(ctx, G, base) {
  const mw = 220;
  const mh = 138;
  const x = W - mw - 18;
  const y = H - mh - 18;
  panel(ctx, x - 6, y - 6, mw + 12, mh + 26, 0.66);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, mw, mh, 6);
  ctx.clip();
  ctx.drawImage(base.canvas, x, y);
  const s = base.scale * (mw / base.canvas.width);
  const px = (wx) => x + wx * s;
  const py = (wy) => y + wy * s;
  // Viewport frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px(G.camera.x), py(G.camera.y), VIEW.width * s, VIEW.height * s);
  // Packages and the respray.
  ctx.fillStyle = '#37e0d8';
  for (const item of G.pickups) {
    if (item.kind === 'package') ctx.fillRect(px(item.x) - 1.6, py(item.y) - 1.6, 3.2, 3.2);
  }
  ctx.fillStyle = '#5aa2ff';
  ctx.fillRect(px(G.city.spots.respray.x) - 2.4, py(G.city.spots.respray.y) - 2.4, 4.8, 4.8);
  // Police blips flash blue and red.
  const flash = Math.sin(G.time * 9) > 0;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    ctx.fillStyle = flash ? '#ff5040' : '#4060ff';
    ctx.beginPath();
    ctx.arc(px(car.x), py(car.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The objective.
  const target = G.missionMarker
    ?? (G.taxi && G.taxi.stage === 'deliver' ? G.taxi.dest : null)
    ?? (G.taxi && G.taxi.stage === 'pickup' && G.taxi.ped ? G.taxi.ped : null)
    ?? G.missionOffer;
  if (target) {
    ctx.strokeStyle = '#ffc83c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(target.x), py(target.y), 5 + Math.sin(G.time * 5) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The player: a white arrow on the facing.
  const p = G.player;
  ctx.save();
  ctx.translate(px(p.x), py(p.y));
  ctx.rotate(p.inCar ? p.car.angle : p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -3.8);
  ctx.lineTo(-4.4, 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // District name under the map.
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(G.district ?? CITY_NAME, x + mw / 2, y + mh + 17);
}

export function drawHud(ctx, G, minimapBase) {
  const p = G.player;
  ctx.textBaseline = 'alphabetic';

  // Money and clock, top left.
  panel(ctx, 16, 14, 172, 62);
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7dd069';
  ctx.fillText(`$${G.save.money.toLocaleString('en-US')}`, 28, 44);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(formatClock(G.hour), 28, 66);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(G.hour >= 6 && G.hour < 19 ? 'Palmera Bay' : 'Palmera Bay — night', 76, 66);

  // Wanted stars, top right.
  if (G.wanted.stars > 0 || G.wanted.heat > 4) {
    panel(ctx, W - 196, 14, 180, 44);
    for (let i = 0; i < 5; i += 1) {
      star(ctx, W - 168 + i * 33, 36, 13, i < G.wanted.stars, G.time);
    }
  }
  // Busted meter under the stars.
  if (G.wanted.bustedMeter > 0.02) {
    const w = 220;
    bar(ctx, W / 2 - w / 2, 84, w, 15, G.wanted.bustedMeter, '#e33e5f', 'BUSTED');
  }

  // Phone messages, left side under the money.
  let my = 88;
  ctx.font = `12.5px ${FONT}`;
  for (const msg of G.messages) {
    const lines = wrapText(ctx, msg.text, 252);
    const h = 24 + lines.length * 16;
    panel(ctx, 16, my, 284, h, Math.min(0.85, msg.ttl));
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.neonCyan;
    ctx.fillText(`✆ ${msg.from}`, 26, my + 16);
    ctx.font = `12.5px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    lines.forEach((line, i) => ctx.fillText(line, 26, my + 34 + i * 16));
    my += h + 7;
  }

  // Objective banner, top centre.
  if (G.objective) {
    ctx.font = `bold 16px ${FONT}`;
    const tw = ctx.measureText(G.objective).width;
    const w = tw + (G.missionTimer !== null && G.missionTimer !== undefined ? 108 : 44);
    const x = W / 2 - w / 2;
    panel(ctx, x, 14, w, 42, 0.82);
    ctx.fillStyle = '#ffc83c';
    ctx.fillRect(x, 14, 5, 42);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(G.objective, x + 18, 41);
    if (G.missionTimer !== null && G.missionTimer !== undefined) {
      const secs = Math.max(0, Math.ceil(G.missionTimer));
      const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillStyle = secs < 16 ? '#ff5040' : '#ffd98a';
      ctx.textAlign = 'right';
      ctx.fillText(label, x + w - 12, 41);
    }
  }

  // District toast: the name of the ground you just rolled into.
  if (G.districtToast && G.districtToast.ttl > 0) {
    ctx.globalAlpha = Math.min(1, G.districtToast.ttl / 1.2);
    ctx.font = `bold 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(G.districtToast.name, W / 2, 118);
    ctx.globalAlpha = 1;
  }

  // Health, armour and weapon, bottom left.
  const bx = 18;
  bar(ctx, bx, H - 62, 216, 17, p.health / 100, p.health < 30 ? '#e33e5f' : '#5dbb63', 'HEALTH');
  bar(ctx, bx, H - 40, 216, 13, p.armour / 50, '#5aa2ff', 'ARMOUR');
  panel(ctx, bx, H - 108, 128, 34);
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS', bx + 11, H - 86);
  ctx.font = `10.5px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('1 / 2 · wheel', bx + 11, H - 77);

  // Speedometer above the minimap while driving.
  if (p.inCar) {
    const speed = Math.round(Math.hypot(p.car.vx, p.car.vy) * 0.42);
    ctx.font = `bold 30px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(String(speed), W - 66, H - 176);
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('km/h', W - 20, H - 176);
    ctx.font = `12px ${FONT}`;
    ctx.fillText(p.car.spec.name, W - 20, H - 160);
  }

  drawMinimap(ctx, G, minimapBase);

  // The context prompt, bottom centre.
  if (G.prompt) {
    ctx.font = `bold 15px ${FONT}`;
    const tw = ctx.measureText(G.prompt).width;
    panel(ctx, W / 2 - tw / 2 - 16, H - 52, tw + 32, 34, 0.85);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(G.prompt, W / 2, H - 29);
  }

  // Low health: a closing red vignette.
  if (p.health < 32 && G.mode === 'play') {
    const pulse = 0.16 + Math.sin(G.time * 5) * 0.06;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, 'rgba(160, 10, 20, 0)');
    g.addColorStop(1, `rgba(160, 10, 20, ${pulse + (32 - p.health) * 0.006})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Screen-space rectangles of a centred menu, for drawing and mouse hits. */
export function menuRects(count, top = 400) {
  const rects = [];
  for (let i = 0; i < count; i += 1) {
    rects.push({ x: W / 2 - 150, y: top + i * 52, w: 300, h: 42 });
  }
  return rects;
}

function drawMenu(ctx, G, top = 400) {
  const menu = G.menu;
  if (!menu) return;
  const rects = menuRects(menu.items.length, top);
  rects.forEach((r, i) => {
    const active = i === menu.index;
    panel(ctx, r.x, r.y, r.w, r.h, active ? 0.92 : 0.6);
    if (active) {
      ctx.fillStyle = PALETTE.neonPink;
      ctx.fillRect(r.x, r.y, 5, r.h);
    }
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#ffffff' : PALETTE.muted;
    ctx.fillText(menu.items[i].label, r.x + r.w / 2, r.y + 28);
  });
}

export function drawMenus(ctx, G) {
  ctx.textBaseline = 'alphabetic';
  if (G.mode === 'title') {
    // A sunset wash over the living city, the neon sign, then the menu.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(24, 8, 54, 0.55)');
    grad.addColorStop(0.55, 'rgba(60, 10, 60, 0.18)');
    grad.addColorStop(1, 'rgba(10, 6, 24, 0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `900 92px ${FONT}`;
    ctx.shadowColor = PALETTE.neonPink;
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#ff5c9e';
    ctx.fillText(GAME_TITLE, W / 2, 168);
    ctx.shadowColor = PALETTE.neonCyan;
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#aef7f2';
    ctx.font = `900 40px ${FONT}`;
    ctx.fillText('P A L M E R A   B A Y', W / 2, 224);
    ctx.shadowBlur = 0;
    ctx.font = `16.5px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText('An open-world crime story. Steal the car. Run the job. Lose the heat.', W / 2, 262);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Reyes just hit town with $120 and a phone number. Mara Voss has work for drivers who don\'t scare easy.', W / 2, 288);
    drawMenu(ctx, G, 356);
    ctx.font = `13.5px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('WASD drive & walk · E enter/exit car · Mouse aim · Click/F fight & shoot · Shift run · Space brake · Esc pause · M mute', W / 2, H - 26);
    if (G.existingSave) {
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = PALETTE.neonAmber;
      const s = G.existingSave;
      ctx.fillText(`Career on file: $${s.money.toLocaleString('en-US')} · story ${s.storyDone}/6 · packages ${s.packages.length}/20 · fares ${s.stats.fares}`, W / 2, 330);
    }
    return;
  }
  if (G.mode === 'howto') {
    ctx.fillStyle = 'rgba(6, 8, 18, 0.82)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 330, 92, 660, 520, 0.94);
    ctx.textAlign = 'center';
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('HOW TO PLAY', W / 2, 142);
    ctx.font = `15.5px ${FONT}`;
    ctx.textAlign = 'left';
    const lines = [
      ['Move / drive', 'W A S D or arrow keys (Shift to run)'],
      ['Enter / exit a car', 'E, next to any car — parked, moving or someone else\'s'],
      ['Fight & shoot', 'Mouse aims. Click or F punches; with the pistol out, hold click to fire'],
      ['Weapons', '1 fists · 2 pistol · mouse wheel swaps'],
      ['Brake / handbrake', 'Space — hold it in a chase'],
      ['The law', 'Crime seen is heat earned. Stars bring cruisers; hide and it cools'],
      ['Busted / wasted', 'Cornered too long, or health gone — the bay takes its cut'],
      ['Work', 'Gold markers are Mara\'s jobs. Drive a cab for fares. Find the cyan packages'],
      ['Cool off', 'Shine & Go Auto (blue square on the map) resprays any car for $250'],
      ['Save', 'Your career saves itself — money, story, packages — in this browser'],
    ];
    lines.forEach(([k, v], i) => {
      const y = 186 + i * 34;
      ctx.fillStyle = PALETTE.neonCyan;
      ctx.font = `bold 15.5px ${FONT}`;
      ctx.fillText(k, W / 2 - 300, y);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `15.5px ${FONT}`;
      ctx.fillText(v, W / 2 - 128, y);
    });
    ctx.textAlign = 'center';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#ffd98a';
    ctx.fillText('Esc or Enter — back', W / 2, 578);
    return;
  }
  if (G.mode === 'paused') {
    ctx.fillStyle = 'rgba(6, 8, 18, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `900 54px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('PAUSED', W / 2, 300);
    drawMenu(ctx, G, 356);
    return;
  }
  if (G.mode === 'busted') {
    const flash = Math.sin(G.time * 10) > 0;
    ctx.fillStyle = flash ? 'rgba(64, 96, 255, 0.2)' : 'rgba(255, 64, 64, 0.2)';
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = 'rgba(6, 8, 22, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `900 84px ${FONT}`;
    ctx.fillStyle = '#5aa2ff';
    ctx.fillText('BUSTED', W / 2, 320);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Palmera Bay PD takes $${G.lastFine} in fines and impounds your ride.`, W / 2, 372);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press Enter to walk out of the station', W / 2, 410);
    return;
  }
  if (G.mode === 'wasted') {
    ctx.fillStyle = 'rgba(40, 4, 8, 0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `900 84px ${FONT}`;
    ctx.fillStyle = '#e33e5f';
    ctx.fillText('WASTED', W / 2, 320);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`St. Coral Hospital patches you up for $${G.lastFine}.`, W / 2, 372);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press Enter to leave the hospital', W / 2, 410);
  }
}
