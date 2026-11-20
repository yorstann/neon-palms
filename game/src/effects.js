// Transient visual juice: particles (sparks, smoke, splashes, confetti cash),
// skid marks that fade slowly, floating text popups and a camera shake value.
// One pooled system the whole game feeds; the renderer draws what is alive.

const MAX_PARTICLES = 420;
const MAX_SKIDS = 300;
const MAX_TEXTS = 24;

export function createEffects() {
  const particles = [];
  const skids = [];
  const texts = [];
  let shake = 0;

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  return {
    particles,
    skids,
    texts,

    /** A burst of n sparks/dust at a point. */
    burst(x, y, n, colour, speed = 160, life = 0.5, size = 3) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.9);
        spawn({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: life * (0.6 + Math.random() * 0.8),
          age: 0,
          colour,
          size: size * (0.6 + Math.random() * 0.9),
          gravity: 0,
          drag: 2.2,
        });
      }
    },

    /** A slow grey smoke puff that rises and grows (damaged cars, burnouts). */
    smoke(x, y, big = false) {
      spawn({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 22,
        vy: -34 - Math.random() * 26,
        life: 1.1 + Math.random() * 0.7,
        age: 0,
        colour: 'smoke',
        size: (big ? 13 : 8) + Math.random() * 6,
        gravity: -12,
        drag: 0.4,
      });
    },

    /** A ring of spray where something lands in the shallows. */
    splash(x, y) {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = 60 + Math.random() * 110;
        spawn({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 40,
          life: 0.45,
          age: 0,
          colour: '#bfe8f2',
          size: 2.4,
          gravity: 260,
          drag: 0.6,
        });
      }
    },

    /** Green banknote flutter when cash changes hands. */
    cashBurst(x, y) {
      for (let i = 0; i < 8; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = 40 + Math.random() * 80;
        spawn({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 60,
          life: 0.8,
          age: 0,
          colour: '#7dd069',
          size: 3.4,
          gravity: 190,
          drag: 1.4,
        });
      }
    },

    /** Blood puff (kept small and brief) when a person is hurt. */
    hitPuff(x, y) {
      for (let i = 0; i < 6; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = 30 + Math.random() * 70;
        spawn({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.35,
          age: 0,
          colour: '#b03030',
          size: 2.6,
          gravity: 0,
          drag: 2.6,
        });
      }
    },

    /** A short tyre mark segment; stored as a fading line on the ground. */
    skid(x1, y1, x2, y2) {
      if (skids.length >= MAX_SKIDS) skids.shift();
      skids.push({ x1, y1, x2, y2, age: 0, life: 7 });
    },

    /** Floating label ("+$250", "BUSTED", ...) that rises and fades. */
    text(x, y, label, colour = '#f4f1e8', size = 17) {
      if (texts.length >= MAX_TEXTS) texts.shift();
      texts.push({ x, y, label, colour, size, age: 0, life: 1.5 });
    },

    /** Add camera shake (0..14); decays on its own. */
    shake(amount) {
      shake = Math.min(15, shake + amount);
    },
    shakeValue() {
      return shake;
    },

    update(dt) {
      shake = Math.max(0, shake - dt * 26);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        const dragK = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragK;
        p.vy = p.vy * dragK + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].age += dt;
        if (skids[i].age >= skids[i].life) skids.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.age += dt;
        t.y -= 26 * dt;
        if (t.age >= t.life) texts.splice(i, 1);
      }
    },
  };
}
