// Solstice Heat — main.js: boot the renderer and every system, run the fixed-step game loop,
// and drive the menu / play / pause / busted / wasted state machine.
(function () {
  const C = SH.CONFIG, U = SH.U;
  const M = { autosaveT: 0, testT: 0, frames: 0, fpsT: 0, fps: 0 };
  SH.main = M;

  window.addEventListener('error', (e) => {
    SH.state.errors.push(String(e.message).slice(0, 160));
  });

  function boot() {
    const canvas = document.getElementById('game');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    M.renderer = renderer;

    const scene = new THREE.Scene();
    SH.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
    SH.camera = camera;
    camera.position.set(0, 90, 200);

    const { seed, shot, test } = SH.shots.params();
    SH.state.rng = U.mulberry32(seed || 1);
    const rng = SH.state.rng;

    SH.city.build(scene, rng);
    SH.effects.init();
    SH.police.buildHeli();
    SH.missions.buildMarker();
    SH.player.build();
    SH.combat.init();
    SH.hud.init();
    SH.vehicles.spawnTraffic(rng, C.trafficCount);
    SH.vehicles.spawnParked(rng, C.parkedCount);
    SH.peds.spawnCrowd(rng, C.pedCount);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    canvas.addEventListener('click', () => {
      SH.audio.unlock();
      if (SH.state.mode === 'play' && !document.pointerLockElement && !SH.state.freeze) {
        canvas.requestPointerLock && canvas.requestPointerLock();
      }
    });
    window.addEventListener('keydown', () => SH.audio.unlock());

    if (shot) {
      SH.shots.apply();
    } else if (test) {
      M.newGame();
      M.runTest();
    } else {
      M.toMenu();
    }
    requestAnimationFrame(loop);
  }

  M.toMenu = function () {
    const s = SH.state;
    s.mode = 'menu';
    s.freeze = false;
    SH.police.clear();
    SH.player.group.visible = false;
    document.getElementById('btnContinue').classList.toggle('disabled', !SH.save.exists());
  };

  M.newGame = function () {
    const s = SH.state;
    SH.save.clear();
    s.cash = 500; s.respect = 0; s.health = 100; s.heat = 0; s.wanted = 0;
    s.clock = C.clockStart; s.time = 0; s.radio = 0;
    s.dialogue = null; s.dialogueQueue.length = 0;
    SH.combat.init();
    SH.police.clear();
    SH.missions.started = false;
    SH.missions.pendingRetry = undefined;
    s.missionIndex = 0; s.mission = null;
    SH.missions.marker.visible = false;
    SH.missions.nextT = 1.2;
    SH.player.respawn(SH.city.landmarks.start);
    s.camera.yaw = Math.PI; s.camera.pitch = 0.3;
    s.mode = 'play';
    SH.hud.toast('SOLSTICE BAY — FRIDAY, 18:42');
  };

  M.continueGame = function () {
    const data = SH.save.read();
    if (!data) { M.newGame(); return; }
    const s = SH.state;
    s.mode = 'play';
    s.time = data.time || 0;
    SH.combat.init();
    SH.police.clear();
    SH.save.apply(data);
    SH.hud.toast('WELCOME BACK TO SOLSTICE BAY');
  };

  M.resume = function () { SH.state.mode = 'play'; };

  function flashLightbars() {
    const on = Math.floor(SH.state.time * 5) % 2 === 0;
    for (const c of SH.vehicles.all) {
      if (!c.lightbar) continue;
      c.lightbar.red.material.emissiveIntensity = on ? 2.6 : 0.2;
      c.lightbar.blue.material.emissiveIntensity = on ? 0.2 : 2.6;
    }
  }

  function menuCamera(t) {
    const a = t * 0.06;
    SH.camera.position.set(Math.sin(a) * 170, 84 + Math.sin(t * 0.2) * 6, Math.cos(a) * 170 + 70);
    SH.camera.lookAt(0, 24, 70);
  }

  // Headless smoke test: drive every system through a fixed-step synchronous simulation
  // (independent of rAF timing), then dump a JSON summary into the DOM for --dump-dom.
  M.runTest = function () {
    const s = SH.state, k = SH.input.keys;
    const dt = 1 / 60;
    let entered = false, exited = false, aimed = false;
    try {
      for (let i = 0; i < 540; i++) {
        const t = i * dt;
        s.time += dt; s.clock += dt * 0.5;
        k.KeyW = false; k.KeyA = false; k.KeyD = false; k.Space = false;
        SH.input.mouse.clicked = false; SH.input.mouse.down = false;
        if (t > 1.4 && !aimed) {
          aimed = true;
          s.camera.yaw = Math.atan2(-8 - s.player.x, 244 - s.player.z);
        }
        if (t > 1.4 && t < 3.7) k.KeyW = true;
        if (t > 3.7 && !entered) {
          entered = true;
          const car = SH.vehicles.nearest(s.player.x, s.player.z, 5, () => true);
          if (car) SH.player.enter(car);
        }
        if (t > 3.9 && t < 6.5) k.KeyW = true;
        if (t > 4.5 && t < 5.2) k.KeyA = true;
        if (t > 5.6 && t < 6.0) k.Space = true;
        if (t > 4.0 && t < 5.0 && i % 20 === 0) SH.input.mouse.clicked = true;
        if (t > 6.6 && !exited) { exited = true; SH.player.exit(true); }
        if (t > 6.8) k.KeyW = true;
        if (t > 7.2 && i % 15 === 0) SH.input.mouse.clicked = true;
        SH.player.update(dt);
        SH.vehicles.update(dt, s.rng);
        SH.peds.update(dt, s.time);
        SH.police.update(dt, s.rng);
        SH.combat.update(dt);
        SH.missions.update(dt);
        SH.effects.update(dt);
        SH.player.applyCamera(dt);
      }
    } catch (e) {
      s.errors.push('TESTLOOP ' + String(e && e.message).slice(0, 140));
    }
    SH.hud.update(0.2);
    const out = {
      errors: s.errors, mode: s.mode,
      vehicles: SH.vehicles.all.length, traffic: SH.vehicles.traffic.length,
      peds: SH.peds.list.length, police: SH.police.units.length,
      wanted: s.wanted, heat: Math.round(s.heat * 100) / 100,
      mission: s.mission ? s.mission.def.name : null,
      missionStage: s.mission ? s.mission.stageIdx : -1,
      entered, exited,
      player: { x: Math.round(s.player.x), z: Math.round(s.player.z), onFoot: s.player.onFoot },
      cash: s.cash, health: Math.round(s.health),
      weaponAmmo: s.weapons[1].ammo,
    };
    const el = document.getElementById('testout');
    el.classList.remove('hidden');
    el.textContent = 'TESTRESULT ' + JSON.stringify(out);
    document.title = 'TESTDONE';
  };

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const t = now / 1000;
    let dt = last ? t - last : 0.016;
    last = t;
    dt = Math.min(dt, 0.033);
    const s = SH.state;
    s.time += dt;
    M.frames++; M.fpsT += dt;
    if (M.fpsT >= 1) { M.fps = M.frames / M.fpsT; M.frames = 0; M.fpsT = 0; }

    if (s.mode === 'menu') {
      menuCamera(s.time);
      SH.city.update(dt, s.time, 0, 70);
      SH.vehicles.updateTraffic(dt, s.rng);
      SH.peds.update(dt, s.time);
      flashLightbars();
      SH.effects.update(dt);
      M.renderer.render(SH.scene, SH.camera);
      SH.input.endFrame();
      return;
    }

    if (SH.input.hit('Escape') && !s.freeze) {
      if (s.mode === 'play') { s.mode = 'pause'; SH.save.write(); }
      else if (s.mode === 'pause') s.mode = 'play';
    }

    const focusX = s.player.x, focusZ = s.player.z;
    if (s.mode === 'play' && !s.freeze) {
      s.clock += dt * 0.5;
      SH.player.update(dt);
      SH.vehicles.update(dt, s.rng);
      SH.peds.update(dt, s.time);
      SH.police.update(dt, s.rng);
      SH.combat.update(dt);
      SH.missions.update(dt);
      SH.audio.update(dt);
      SH.player.applyCamera(dt);
      M.autosaveT += dt;
      if (M.autosaveT > 25) { M.autosaveT = 0; SH.save.write(); }
    }
    // cosmetics always run (also in frozen shot modes, except particle decay)
    SH.city.update(dt, s.time, focusX, focusZ);
    flashLightbars();
    if (!s.freeze) SH.effects.update(dt);
    SH.hud.update(dt);
    M.renderer.render(SH.scene, SH.camera);
    SH.input.endFrame();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
