// Solstice Heat — police.js: wanted heat, SBPD pursuit / ramming / roadblock units,
// Air-1 helicopter with searchlight, heat decay, arrests and busted respawn.
(function () {
  const C = SH.CONFIG, U = SH.U;
  const NAMES = ['MARLIN', 'BARRACUDA', 'OSPREY', 'TARPON', 'HERON', 'PELICAN', 'MANTA'];
  const P = { units: [], heli: null, heatSafeT: 0, shotT: 0, unitSeq: 1 };
  SH.police = P;

  P.addHeat = function (n) {
    const s = SH.state;
    if (s.mode !== 'play') return;
    s.heat = U.clamp(s.heat + n, 0, C.maxWanted);
    s.wanted = Math.min(C.maxWanted, Math.floor(s.heat + 0.001));
    if (s.wanted === 0 && s.heat > 0) s.wanted = 1;
    P.heatSafeT = 0;
  };

  function spawnPos(rng, pl) {
    const a = rng() * Math.PI * 2, r = 95 + rng() * 55;
    let x = U.clamp(pl.x + Math.cos(a) * r, -C.bound + 8, C.bound - 8);
    let z = U.clamp(pl.z + Math.sin(a) * r, -C.bound + 8, C.oceanZ - 10);
    // snap to the nearest road centreline so units arrive on streets
    const li = U.clamp(Math.round((x + 4 * C.block) / C.block), 0, C.grid - 1);
    const lj = U.clamp(Math.round((z + 4 * C.block) / C.block), 0, C.grid - 1);
    if (Math.abs(x - (li - 4) * C.block) < Math.abs(z - (lj - 4) * C.block)) x = (li - 4) * C.block;
    else z = (lj - 4) * C.block;
    return { x, z };
  }

  P.spawnUnit = function (rng, role) {
    const s = SH.state;
    const car = SH.vehicles.createCar('police', 0xe8e4da, rng);
    car.isPolice = true;
    const pos = spawnPos(rng, s.player);
    SH.vehicles.place(car, pos.x, pos.z, Math.atan2(s.player.x - pos.x, s.player.z - pos.z));
    const name = NAMES[(P.unitSeq - 1) % NAMES.length] + '-' + (10 + P.unitSeq);
    P.unitSeq++;
    const unit = { car, name, state: 'RESPONDING', role: role || 'pursuit', blockT: 0 };
    P.units.push(unit);
    return unit;
  };

  P.buildHeli = function () {
    const g = new THREE.Group();
    const body = SH.U.vmesh([
      SH.U.box(2.2, 1.6, 5.2, 0, 0, 0, 0x1f3a5f),
      SH.U.box(1.6, 1.2, 1.6, 0, 0.2, 2.6, 0x274b6e),
      SH.U.box(0.5, 0.5, 4.5, 0, 0.4, -4.2, 0x1f3a5f),
      SH.U.box(0.3, 1.4, 0.8, 0, 1.0, -6.2, 0xe8e4da),
      SH.U.box(2.6, 0.2, 0.5, 0, -1.0, 0.6, 0x2c2f36),
      SH.U.box(2.6, 0.2, 0.5, 0, -1.0, -0.8, 0x2c2f36),
      SH.U.box(1.7, 0.9, 0.1, 0, 0.3, 2.62, 0x1d2733),
    ]);
    g.add(body);
    const rotor = SH.U.vmesh([SH.U.box(9.5, 0.08, 0.4, 0, 0, 0, 0x14161c), SH.U.box(0.4, 0.08, 9.5, 0, 0, 0, 0x14161c)], { shadow: false });
    rotor.position.y = 1.2;
    g.add(rotor);
    const tailRotor = SH.U.vmesh([SH.U.box(0.1, 2.2, 0.3, 0, 0, 0, 0x14161c)], { shadow: false });
    tailRotor.position.set(0.3, 1.0, -6.2);
    g.add(tailRotor);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 44, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.position.y = -22;
    g.add(cone);
    const spot = new THREE.SpotLight(0xfff0c0, 1.4, 130, 0.42, 0.55, 1.2);
    spot.position.set(0, -1, 0);
    const spotTarget = new THREE.Object3D();
    g.add(spot); g.add(spotTarget);
    spot.target = spotTarget;
    g.visible = false;
    SH.scene.add(g);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 22), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.visible = false;
    SH.scene.add(pool);
    P.heli = { group: g, rotor, tailRotor, cone, spot, spotTarget, pool, angle: 0, active: false, name: 'AIR-1', state: 'SPOTLIGHT', x: 0, z: 0, y: 44 };
  };

  function aiDrive(car, tx, tz, dt, maxSpd) {
    const want = Math.atan2(tx - car.x, tz - car.z);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += U.clamp(diff, -2.4 * dt, 2.4 * dt);
    const d = U.dist(car.x, car.z, tx, tz);
    const target = d < 9 ? maxSpd * 0.45 : maxSpd;
    car.speed = U.lerp(car.speed, target, dt * 1.6);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = U.clamp(car.x, -C.bound, C.bound);
    car.z = U.clamp(car.z, -C.bound, C.oceanZ - 3);
    const hit = SH.city.collide(car.x, car.z, 2.3);
    if (hit) {
      const dd = Math.hypot(hit.dx, hit.dz) || 0.01;
      car.x = hit.nx + (hit.dx / dd) * 2.3;
      car.z = hit.nz + (hit.dz / dd) * 2.3;
      car.speed *= 0.4;
      car.heading += 0.5 * dt * Math.sign(diff || 1);
    }
  }

  P.update = function (dt, rng) {
    const s = SH.state, pl = s.player;
    const desired = [0, 1, 2, 3, 4, 5][s.wanted] || 0;
    const pursuers = P.units.filter((u) => u.role !== 'roadblock').length;
    if (pursuers < desired && !s.freeze) P.spawnUnit(rng, 'pursuit');
    if (s.wanted >= 3 && !P.units.some((u) => u.role === 'roadblock') && !s.freeze) P.spawnUnit(rng, 'roadblock');
    while (P.units.length > desired + (s.wanted >= 3 ? 1 : 0)) {
      const u = P.units.pop();
      SH.scene.remove(u.car.group);
      const idx = SH.vehicles.all.indexOf(u.car);
      if (idx >= 0) SH.vehicles.all.splice(idx, 1);
    }
    // helicopter at 3+
    if (P.heli) {
      const wantHeli = s.wanted >= 3;
      P.heli.active = wantHeli;
      P.heli.group.visible = wantHeli;
      P.heli.pool.visible = wantHeli;
      if (wantHeli) {
        P.heli.angle += dt * 0.55;
        const hx = pl.x + Math.cos(P.heli.angle) * 30;
        const hz = pl.z + Math.sin(P.heli.angle) * 30;
        P.heli.x = hx; P.heli.z = hz;
        P.heli.group.position.set(hx, P.heli.y + Math.sin(s.time * 1.3) * 1.2, hz);
        P.heli.group.rotation.y = Math.atan2(pl.x - hx, pl.z - hz);
        P.heli.rotor.rotation.y += dt * 22;
        P.heli.tailRotor.rotation.x += dt * 30;
        P.heli.spotTarget.position.set(pl.x - hx, -P.heli.y, pl.z - hz);
        P.heli.pool.position.set(pl.x, 0.06, pl.z);
        P.heli.state = 'SPOTLIGHT';
      }
    }
    let nearest = 999;
    const fx = Math.sin(pl.heading), fz = Math.cos(pl.heading);
    for (const u of P.units) {
      const car = u.car;
      if (car.dead) { u.state = 'DISABLED'; continue; }
      const d = U.dist(car.x, car.z, pl.x, pl.z);
      nearest = Math.min(nearest, d);
      u.dist = d;
      if (u.role === 'roadblock') {
        const bx = pl.x + fx * 58, bz = pl.z + fz * 58;
        if (U.dist(car.x, car.z, bx, bz) > 6 && u.blockT < 14) {
          u.blockT += dt;
          aiDrive(car, bx, bz, dt, C.policeMaxSpeed);
          u.state = 'ROADBLOCK';
        } else {
          car.speed = U.lerp(car.speed, 0, dt * 3);
          car.heading = U.angleLerp(car.heading, pl.heading + Math.PI / 2, dt * 2);
          u.state = 'ROADBLOCK';
        }
      } else {
        const tx = pl.x + (pl.car ? Math.sin(pl.car.heading) * pl.car.speed * 0.5 : 0);
        const tz = pl.z + (pl.car ? Math.cos(pl.car.heading) * pl.car.speed * 0.5 : 0);
        aiDrive(car, tx, tz, dt, C.policeMaxSpeed);
        u.state = d < 14 ? 'RAMMING' : 'PURSUIT';
        if (s.wanted >= 4) {
          P.shotT -= dt;
          if (P.shotT <= 0 && d < 48 && d > 6) {
            P.shotT = 1.4;
            SH.effects.tracer(car.x, 1.1, car.z, pl.x, 1.2, pl.z, 0xff6644);
            SH.combat.hurtPlayer(3);
            SH.audio.gunshot('pistol');
          }
        }
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }
    // arrest on foot
    if (pl.onFoot && s.wanted >= 1 && nearest < 3.2) {
      pl.arrestT += dt;
      if (pl.arrestT > 1.3) P.busted();
    } else pl.arrestT = Math.max(0, pl.arrestT - dt * 2);
    // heat decay when out of contact
    if (nearest > 78) {
      P.heatSafeT += dt;
      if (P.heatSafeT > 5) {
        s.heat = Math.max(0, s.heat - dt * 0.45);
        s.wanted = s.heat <= 0.01 ? 0 : Math.min(C.maxWanted, Math.floor(s.heat + 0.001));
        if (s.wanted === 0) { s.heat = 0; P.heatSafeT = 0; }
      }
    } else P.heatSafeT = 0;
  };

  P.clear = function () {
    const s = SH.state;
    s.heat = 0; s.wanted = 0; P.heatSafeT = 0;
    for (const u of P.units) {
      SH.scene.remove(u.car.group);
      const idx = SH.vehicles.all.indexOf(u.car);
      if (idx >= 0) SH.vehicles.all.splice(idx, 1);
    }
    P.units.length = 0;
    if (P.heli) { P.heli.active = false; P.heli.group.visible = false; P.heli.pool.visible = false; }
  };

  P.busted = function () {
    const s = SH.state;
    if (s.mode !== 'play') return;
    s.mode = 'busted';
    SH.hud.showOverlay('busted');
    SH.audio.crash(10);
    setTimeout(() => {
      if (SH.state.mode !== 'busted') return;
      SH.missions.fail('Busted — the job went cold.');
      P.clear();
      s.cash = Math.max(0, s.cash - 200);
      s.health = 100;
      SH.player.respawn(SH.city.landmarks.safehouse);
      SH.hud.hideOverlay();
      SH.state.mode = 'play';
    }, 2600);
  };

  P.wasted = function () {
    const s = SH.state;
    if (s.mode !== 'play') return;
    s.mode = 'wasted';
    SH.hud.showOverlay('wasted');
    setTimeout(() => {
      if (SH.state.mode !== 'wasted') return;
      SH.missions.fail('Wasted — you bled out on the asphalt.');
      P.clear();
      s.cash = Math.max(0, s.cash - 150);
      s.health = 100;
      SH.player.respawn(SH.city.landmarks.courthouse);
      SH.hud.hideOverlay();
      SH.state.mode = 'play';
    }, 2600);
  };
})();
