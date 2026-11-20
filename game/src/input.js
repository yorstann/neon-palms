// Keyboard and mouse state for the game. The rest of the game reads plain
// fields (keys held, mouse position in logical canvas coordinates, clicks that
// happened since the last frame) instead of touching DOM events itself.

export const KEY = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  melee: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  mute: ['KeyM'],
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };
  let wheel = 0;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toLogical(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toLogical(event);
    mouse.x = p.x;
    mouse.y = p.y;
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
    if (event.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    wheel += Math.sign(event.deltaY);
  }, { passive: true });

  return {
    mouse,
    /** True while any of the given key codes is held down. */
    down(...codes) {
      return codes.some((code) => held.has(code));
    },
    /** True once per physical press; reading it consumes it. */
    pressed(...codes) {
      for (const code of codes) {
        if (pressed.has(code)) {
          pressed.delete(code);
          return true;
        }
      }
      return false;
    },
    /** Was the left mouse button clicked since the last call? Consumes it. */
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
    /** Mouse wheel notches since the last call. Consumes them. */
    takeWheel() {
      const was = wheel;
      wheel = 0;
      return was;
    },
    /** Drop per-frame leftovers (call at the end of each frame). */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
