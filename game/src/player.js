// Solstice Heat — player.js: Rafa Solis on foot and behind the wheel — movement, car
// theft / entry / exit, the third-person chase camera, and respawn.
(function () {
  const C = SH.CONFIG, U = SH.U;
  const PL = { mesh: null };
  SH.player = PL;

  PL.build = function () {
    const geos = [
      U.box(0.24, 0.8, 0.26, -0.14, 0.4, 0, 0x263238),
      U.box(0.24, 0.8, 0.26, 0.14, 0.4, 0, 0x263238),
      U.box(0.54, 0.64, 0.3, 0, 1.12, 0, 0x35d0ba),
      U.box(0.56, 0.2, 0.32, 0, 1.42, 0, 0x2a9d8f),
      U.box(0.17, 0.58, 0.19, -0.36, 1.05, 0, 0x35d0ba),
      U.box(0.17, 0.58, 0.19, 0.36, 1.05, 0, 0x35d0ba),
      U.box(0.15, 0.15, 0.17, -0.36, 0.72, 0, 0xc68642),
      U.box(0.15, 0.15, 0.17, 0.36, 0.72, 0, 0xc68642),
      U.box(0.32, 0.34, 0.3, 0, 1.62, 0, 0xc68642),
      U.box(0.34, 0.13, 0.32, 0, 1.8, 0, 0x1c1410),
      U.box(0.34, 0.06, 0.1, 0, 1.5, 0.16, 0x2c2216),
    ];
    PL.mesh = U.vmesh(geos);
    PL.group = new THREE.Group();
    PL.group.add(PL.mesh);
    PL.gun = U.vmesh([
      U.box(0.12, 0.16, 0.95, 0, 0, 0.3, 0x3c4250),
      U.box(0.1, 0.26, 0.14, 0, -0.16, -0.05, 0x22262e),
      U.box(0.07, 0.07, 0.4, 0, 0.04, 0.72, 0x14161c),
      U.box(0.06, 0.2, 0.1, 0, -0.13, 0.4, 0x22262e),
    ], { shadow: false });
    PL.gun.position.set(0.34, 1.35, 0.45);
    PL.gun.visible = false;
    PL.group.add(PL.gun);
    SH.scene.add(PL.group);
  };

  PL.respawn = function (loc) {
    const s = SH.state, p = s.player;
    if (p.car) PL.exit(true);
    p.x = loc.x; p.z = loc.z; p.heading = Math.PI;
    p.onFoot = true; p.car = null; p.arrestT = 0;
    s.health = 100;
    PL.group.visible = true;
    PL.place();
    SH.camera.position.set(p.x - Math.sin(p.heading) * 7, 4, p.z - Math.cos(p.heading) * 7);
  };

  PL.place = function () {
    const p = SH.state.player;
    PL.group.position.set(p.x, 0.18, p.z);
    PL.group.rotation.y = p.heading;
  };

  PL.enter = function (car) {
    const s = SH.state, p = s.player;
    if (car.isTraffic) {
      car.isTraffic = false;
      const idx = SH.vehicles.traffic.indexOf(car);
      if (idx >= 0) SH.vehicles.traffic.splice(idx, 1);
      const driver = SH.peds.spawnAt(s.rng, car.x + 2.4, car.z, false);
      SH.peds.panic(car.x, car.z, 12);
      driver.panic = 6; driver.panicX = 0.7; driver.panicZ = 0.7;
    }
    if (car.isPolice) SH.police.addHeat(2);
    else SH.police.addHeat(0.6);
    car.isParked = false;
    p.onFoot = false; p.car = car; p.speed = 0;
    PL.group.visible = false;
    SH.hud.toast('ENTERED ' + car.name.toUpperCase());
    SH.audio.pickup();
  };

  PL.exit = function (silent) {
    const s = SH.state, p = s.player;
    if (!p.car) return;
    const car = p.car;
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    p.x = U.clamp(car.x + rx * 2.4, -C.bound, C.bound);
    p.z = U.clamp(car.z + rz * 2.4, -C.bound, C.oceanZ - 2);
    p.heading = car.heading;
    p.onFoot = true; p.car = null;
    car.isParked = true; car.speed = 0;
    PL.group.visible = true;
    PL.place();
    if (!silent) SH.audio.pickup();
  };

  PL.update = function (dt) {
    const s = SH.state, p = s.player, inp = SH.input;
    // camera yaw input
    if (inp.down('KeyQ')) s.camera.yaw += 2.2 * dt;
    if (inp.down('KeyE')) s.camera.yaw -= 2.2 * dt;
    if (inp.mouse.dx) s.camera.yaw -= inp.mouse.dx * 0.0022;
    if (inp.mouse.dy) s.camera.pitch = U.clamp(s.camera.pitch + inp.mouse.dy * 0.0015, -0.1, 0.8);

    if (inp.hit('KeyF')) {
      if (p.onFoot) {
        const car = SH.vehicles.nearest(p.x, p.z, 4.0, (c) => !c.isPolice || s.wanted >= 1);
        if (car) PL.enter(car);
      } else PL.exit();
    }

    if (p.onFoot) {
      const f = inp.forward(), st = inp.steer();
      const yaw = s.camera.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = -Math.cos(yaw), rz = Math.sin(yaw);
      let mx = fx * f + rx * st, mz = fz * f + rz * st;
      const ml = Math.hypot(mx, mz);
      const spd = inp.run() ? C.playerRun : C.playerWalk;
      if (ml > 0.01) {
        mx /= ml; mz /= ml;
        p.heading = U.angleLerp(p.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
        let nx = p.x + mx * spd * dt, nz = p.z + mz * spd * dt;
        const hit = SH.city.collide(nx, nz, 0.5);
        if (hit) {
          const dd = Math.hypot(hit.dx, hit.dz) || 0.01;
          nx = hit.nx + (hit.dx / dd) * 0.5;
          nz = hit.nz + (hit.dz / dd) * 0.5;
        }
        p.x = U.clamp(nx, -C.bound, C.bound);
        p.z = U.clamp(nz, -C.bound, C.oceanZ - 2);
        p.walkPhase += dt * (inp.run() ? 13 : 8);
        p.speed = spd;
      } else p.speed = 0;
      PL.group.position.y = 0.18 + (ml > 0.01 ? Math.abs(Math.sin(p.walkPhase)) * 0.06 : 0);
      PL.place();
      // on-foot camera
      const cd = 6.4, ch = 2.6 + s.camera.pitch * 4;
      const tx = p.x - Math.sin(s.camera.yaw) * cd;
      const tz = p.z - Math.cos(s.camera.yaw) * cd;
      PL.camTarget = { x: tx, y: ch, z: tz, lx: p.x, ly: 1.5, lz: p.z };
      PL.gun.visible = s.weaponIndex > 0;
    } else {
      const car = p.car;
      p.x = car.x; p.z = car.z; p.heading = car.heading; p.speed = car.speed;
      s.camera.yaw = U.angleLerp(s.camera.yaw, car.heading, Math.min(1, dt * 3.2));
      const back = 8.6 + Math.abs(car.speed) * 0.14;
      const ch = 3.9 + Math.abs(car.speed) * 0.03 + s.camera.pitch * 3;
      const tx = car.x - Math.sin(s.camera.yaw) * back;
      const tz = car.z - Math.cos(s.camera.yaw) * back;
      PL.camTarget = {
        x: tx, y: ch, z: tz,
        lx: car.x + Math.sin(car.heading) * 5, ly: 1.3, lz: car.z + Math.cos(car.heading) * 5,
      };
    }
  };

  PL.applyCamera = function (dt) {
    const t = PL.camTarget;
    if (!t) return;
    const k = 1 - Math.exp(-dt * 6.5);
    SH.camera.position.lerp(new THREE.Vector3(t.x, t.y, t.z), k);
    PL.look = PL.look || new THREE.Vector3(t.lx, t.ly, t.lz);
    PL.look.lerp(new THREE.Vector3(t.lx, t.ly, t.lz), k);
    SH.camera.lookAt(PL.look);
  };
})();
