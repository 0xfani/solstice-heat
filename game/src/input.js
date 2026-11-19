// Solstice Heat — input.js: keyboard + mouse state and the binding map the HUD hints describe.
(function () {
  const keys = {};
  const pressed = {};      // edge-triggered, consumed by systems
  const mouse = { dx: 0, dy: 0, down: false, clicked: false };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  SH.input = {
    keys, mouse,
    down: (code) => !!keys[code],
    hit: (code) => { const v = !!pressed[code]; pressed[code] = false; return v; },
    endFrame() { pressed && Object.keys(pressed).forEach((k) => { pressed[k] = false; }); mouse.clicked = false; mouse.dx = 0; mouse.dy = 0; },
    // movement axes: W/S forward, A/D strafe or steer
    forward: () => (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
    steer: () => (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    run: () => !!(keys.ShiftLeft || keys.ShiftRight),
    fire: () => mouse.down || !!keys.KeyJ,
    bindings: [
      ['W A S D', 'drive / walk'], ['SHIFT', 'sprint'], ['SPACE', 'handbrake'],
      ['F', 'enter / steal car'], ['MOUSE / J', 'shoot'], ['1-5', 'weapons'], ['R', 'reload'],
      ['Q E', 'camera'], ['V', 'radio'], ['H', 'hints'], ['ESC', 'pause'],
    ],
  };
})();
