// Solstice Heat — vehicles.js: low-poly car factory, grid-lane traffic AI, player driving
// physics, car-vs-car and car-vs-city collisions, stealable parked cars.
(function () {
  const C = SH.CONFIG, U = SH.U;
  const V = { all: [], traffic: [], names: { sports: 'Meridian GT', sedan: 'Vela Sedan', taxi: 'Bahia Cab', van: 'Solano Van', muscle: 'Toro V8', police: 'SBPD Cruiser' } };
  SH.vehicles = V;
  const DIRS = [
    { dx: 0, dz: 1, h: 0 }, { dx: 1, dz: 0, h: Math.PI / 2 },
    { dx: 0, dz: -1, h: Math.PI }, { dx: -1, dz: 0, h: -Math.PI / 2 },
  ];
  const line = (i) => (i - 4) * C.block;
  const COLORS = [0xc0392b, 0x2e86ab, 0xe8e4da, 0x2c3e50, 0xd4a017, 0x7f8c8d, 0x35d0ba, 0x8e44ad, 0xe67e22];

  // ---- car factory: merged vertex-coloured body, glass, wheels (+ police lightbar) ----
  V.createCar = function (kind, color, rng) {
    const sport = kind === 'sports' || kind === 'muscle';
    const L = kind === 'van' ? 5.0 : sport ? 4.5 : 4.4;
    const H = kind === 'van' ? 1.5 : sport ? 0.62 : 0.72;
    const body = [
      U.box(2.0, H, L, 0, 0.45 + H / 2, 0, color),
      U.box(2.02, 0.22, L * 0.96, 0, 0.42, 0, 0x1c1f26),
      U.box(1.7, sport ? 0.5 : 0.62, kind === 'van' ? L * 0.7 : L * 0.46, 0, 0.45 + H + (sport ? 0.25 : 0.31), kind === 'van' ? -0.2 : -0.25, color),
      U.box(2.04, 0.18, 0.3, 0, 0.5, L / 2, 0x2c2f36),
      U.box(2.04, 0.18, 0.3, 0, 0.5, -L / 2, 0x2c2f36),
    ];
    if (kind === 'police') {
      body.push(U.box(2.02, 0.5, 1.5, 0, 0.95, 0.3, 0x14161c));
      body.push(U.box(0.5, 0.16, 1.0, 0, 0.45 + H + 0.66, -0.25, 0x14161c));
    }
    if (sport) body.push(U.box(1.9, 0.12, 0.5, 0, 0.45 + H + 0.55, -L / 2 + 0.3, 0x14161c));
    const bodyMesh = U.vmesh(body);
    const glass = U.vmesh([U.box(1.62, sport ? 0.4 : 0.5, (kind === 'van' ? L * 0.66 : L * 0.42) - 0.2, 0, 0.45 + H + (sport ? 0.27 : 0.33), kind === 'van' ? -0.2 : -0.25, 0x1d2733)], { shadow: false });
    glass.material = SH.MAT.glass;
    const wheels = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      wheels.push(U.cyl(0.42, 0.42, 0.32, 8, sx * 0.98, 0.42, sz * (L / 2 - 0.9), 0x14161c, 0, Math.PI / 2));
      wheels.push(U.cyl(0.2, 0.2, 0.34, 6, sx * 0.98, 0.42, sz * (L / 2 - 0.9), 0x8a8f98, 0, Math.PI / 2));
    }
    const wheelMesh = U.vmesh(wheels);
    const lights = U.vmesh([
      U.box(0.4, 0.16, 0.08, -0.65, 0.62, L / 2 + 0.01, 0xfff2cc),
      U.box(0.4, 0.16, 0.08, 0.65, 0.62, L / 2 + 0.01, 0xfff2cc),
      U.box(0.4, 0.16, 0.08, -0.65, 0.62, -L / 2 - 0.01, 0xff3322),
      U.box(0.4, 0.16, 0.08, 0.65, 0.62, -L / 2 - 0.01, 0xff3322),
    ], { shadow: false });
    lights.material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.5 });
    const group = new THREE.Group();
    group.add(bodyMesh, glass, wheelMesh, lights);
    const car = {
      kind, color, group, x: 0, z: 0, heading: 0, speed: 0, condition: 100, health: 100,
      dead: false, isPolice: kind === 'police', isTraffic: false, isParked: false,
      lane: null, node: null, dir: 0, t: 0, cruise: 10, lightbar: null, missionTarget: false,
      name: V.names[kind] || 'Vela Sedan', smokeT: 0,
    };
    if (kind === 'police') {
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2 }));
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x000033, emissive: 0x2255ff, emissiveIntensity: 2 }));
      red.position.set(-0.28, 0.45 + H + 0.75, -0.25);
      blue.position.set(0.28, 0.45 + H + 0.75, -0.25);
      group.add(red, blue);
      car.lightbar = { red, blue };
    }
    V.all.push(car);
    SH.scene.add(group);
    return car;
  };

  V.place = function (car, x, z, heading) {
    car.x = x; car.z = z; car.heading = heading;
    car.group.position.set(x, 0, z);
    car.group.rotation.y = heading;
  };

  // ---- traffic: node-to-node grid navigation with lane offsets and car-following ----
  V.spawnTraffic = function (rng, n) {
    for (let k = 0; k < n; k++) {
      const kind = U.pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sports', 'muscle']);
      const car = V.createCar(kind, U.pick(rng, COLORS), rng);
      car.isTraffic = true;
      car.node = { i: Math.floor(rng() * C.grid), j: Math.floor(rng() * C.grid) };
      car.dir = Math.floor(rng() * 4);
      car.t = rng();
      car.cruise = 8 + rng() * 7;
      car.speed = car.cruise;
      V.traffic.push(car);
      V.navTarget(car);
      V.place(car, car.tx, car.tz, DIRS[car.dir].h);
    }
  };
  V.spawnParked = function (rng, n) {
    const slots = SH.city.parkedSlots.slice();
    for (let k = 0; k < n && slots.length; k++) {
      const s = slots.splice(Math.floor(rng() * slots.length), 1)[0];
      const car = V.createCar(U.pick(rng, ['sedan', 'sports', 'muscle', 'van']), U.pick(rng, COLORS), rng);
      car.isParked = true;
      V.place(car, s.x, s.z, s.heading);
    }
  };
  V.navTarget = function (car) {
    const d = DIRS[car.dir];
    const px = d.dz, pz = -d.dx; // lane offset to the right of travel
    car.tx = line(car.node.i) + d.dx * car.t * C.block + px * C.laneOff;
    car.tz = line(car.node.j) + d.dz * car.t * C.block + pz * C.laneOff;
    car.th = d.h;
  };
  V.chooseDir = function (car, rng) {
    const opts = [];
    for (let k = 0; k < 4; k++) {
      if (k === (car.dir + 2) % 4) continue;
      const ni = car.node.i + DIRS[k].dx, nj = car.node.j + DIRS[k].dz;
      if (ni < 0 || ni >= C.grid || nj < 0 || nj >= C.grid) continue;
      opts.push(k === car.dir ? 0.55 : 0.225);
    }
    if (!opts.length) { car.dir = (car.dir + 2) % 4; return; }
    let r = rng() * opts.reduce((a, b) => a + b, 0), pick = 0;
    const valid = [];
    for (let k = 0; k < 4; k++) {
      if (k === (car.dir + 2) % 4) continue;
      const ni = car.node.i + DIRS[k].dx, nj = car.node.j + DIRS[k].dz;
      if (ni >= 0 && ni < C.grid && nj >= 0 && nj < C.grid) valid.push(k);
    }
    for (let idx = 0; idx < valid.length; idx++) { r -= opts[idx]; if (r <= 0) { pick = idx; break; } }
    car.dir = valid[pick];
  };

  function followSpeed(car) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let cap = car.cruise;
    for (const o of V.all) {
      if (o === car || o.dead) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const ahead = dx * fx + dz * fz;
      if (ahead > 0 && ahead < 13 && Math.abs(dx * fz - dz * fx) < 3) {
        cap = Math.min(cap, ahead < 6 ? 0 : Math.max(0, o.speed * 0.85));
      }
    }
    return cap;
  }

  V.updateTraffic = function (dt, rng) {
    for (const car of V.traffic) {
      if (car.dead) continue;
      const cap = followSpeed(car);
      car.speed = U.lerp(car.speed, cap, dt * 2.5);
      car.t += (car.speed * dt) / C.block;
      if (car.t >= 1) {
        car.t -= 1;
        car.node.i += DIRS[car.dir].dx;
        car.node.j += DIRS[car.dir].dz;
        V.chooseDir(car, rng);
      }
      V.navTarget(car);
      car.x = U.lerp(car.x, car.tx, Math.min(1, dt * 5));
      car.z = U.lerp(car.z, car.tz, Math.min(1, dt * 5));
      car.heading = U.angleLerp(car.heading, car.th, Math.min(1, dt * 4));
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }
  };

  // ---- player driving ----
  V.drive = function (car, dt) {
    const inp = SH.input;
    const throttle = inp.forward();
    const steer = inp.steer();
    const hb = inp.down('Space');
    if (car.dead) { car.speed = U.lerp(car.speed, 0, dt * 2); }
    else if (throttle > 0) car.speed += C.carAccel * dt * (1 - car.speed / C.carMaxSpeed);
    else if (throttle < 0) car.speed -= (car.speed > 0 ? C.carBrake : C.carAccel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * C.carDrag * dt * 4;
    if (hb) car.speed -= Math.sign(car.speed) * C.carBrake * 0.7 * dt;
    car.speed = U.clamp(car.speed, -9, C.carMaxSpeed);
    if (Math.abs(car.speed) < 0.15 && throttle === 0) car.speed = 0;
    const grip = U.clamp(Math.abs(car.speed) / 7, 0, 1);
    car.heading += steer * C.carSteer * dt * grip * (hb ? 1.7 : 1) * Math.sign(car.speed || 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // world bounds + ocean
    car.x = U.clamp(car.x, -C.bound, C.bound);
    if (car.z > C.oceanZ - 3) { car.z = C.oceanZ - 3; car.speed *= -0.3; }
    if (car.z < -C.bound) { car.z = -C.bound; car.speed *= -0.3; }
    // buildings
    const hit = SH.city.collide(car.x, car.z, 2.3);
    if (hit) {
      const d = Math.hypot(hit.dx, hit.dz) || 0.01;
      car.x = hit.nx + (hit.dx / d) * 2.3;
      car.z = hit.nz + (hit.dz / d) * 2.3;
      const impact = Math.abs(car.speed);
      if (impact > 4) {
        car.condition = Math.max(0, car.condition - impact * 0.7);
        SH.effects.spark(car.x, 0.8, car.z, 8);
        SH.audio.crash(impact);
        if (SH.state.player.car === car) SH.state.lastHurt = SH.state.time;
      }
      car.speed *= -0.28;
      if (car.condition <= 0 && !car.dead) V.kill(car);
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.group.rotation.z = -steer * grip * 0.04;
    if (hb && Math.abs(car.speed) > 8) SH.effects.skid(car.x, car.z, car.heading);
    if (car.dead) { car.smokeT += dt; if (car.smokeT > 0.12) { car.smokeT = 0; SH.effects.smoke(car.x, 1.2, car.z); } }
  };

  V.kill = function (car) {
    if (car.dead) return;
    car.dead = true; car.speed = 0;
    SH.effects.explosion(car.x, 0.8, car.z);
    SH.audio.explosion();
    if (car.isPolice) SH.police.addHeat(1.5);
    if (car.missionTarget) SH.missions.onTargetDestroyed(car);
  };

  // ---- car-vs-car + car-vs-ped collisions ----
  V.collisions = function (dt) {
    const p = SH.state.player;
    for (let a = 0; a < V.all.length; a++) {
      const A = V.all[a];
      for (let b = a + 1; b < V.all.length; b++) {
        const B = V.all[b];
        const dx = B.x - A.x, dz = B.z - A.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) / 2, nx = dx / d, nz = dz / d;
          A.x -= nx * push; A.z -= nz * push;
          B.x += nx * push; B.z += nz * push;
          const rel = Math.abs(A.speed - B.speed);
          if (rel > 6) {
            A.condition = Math.max(0, A.condition - rel * 0.5);
            B.condition = Math.max(0, B.condition - rel * 0.5);
            SH.effects.spark((A.x + B.x) / 2, 0.7, (A.z + B.z) / 2, 6);
            SH.audio.crash(rel);
            const pc = p.car;
            if ((A === pc || B === pc) && !p.onFoot) {
              SH.state.lastHurt = SH.state.time;
              SH.state.health = Math.max(0, SH.state.health - rel * 0.25);
              const other = A === pc ? B : A;
              if (other.isPolice) SH.police.addHeat(0.4);
            }
            if (A.condition <= 0) V.kill(A);
            if (B.condition <= 0) V.kill(B);
          }
          const avg = (A.speed + B.speed) / 2;
          A.speed = U.lerp(A.speed, avg, 0.5); B.speed = U.lerp(B.speed, avg, 0.5);
        }
      }
      // run over pedestrians
      if (!A.dead && Math.abs(A.speed) > 3) {
        for (const ped of SH.peds.list) {
          if (ped.dead) continue;
          if (U.dist(A.x, A.z, ped.x, ped.z) < 2.3) {
            SH.peds.knockdown(ped, A.heading);
            A.speed *= 0.82;
            if (A === p.car) SH.police.addHeat(1.2);
          }
        }
      }
    }
  };

  V.nearest = function (x, z, maxD, filter) {
    let best = null, bd = maxD;
    for (const c of V.all) {
      if (c.dead || (filter && !filter(c))) continue;
      const d = U.dist(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };

  V.update = function (dt, rng) {
    V.updateTraffic(dt, rng);
    const p = SH.state.player;
    if (!p.onFoot && p.car) V.drive(p.car, dt);
    V.collisions(dt);
    for (const c of V.all) {
      if (c.lightbar) {
        const on = Math.floor(SH.state.time * 5) % 2 === 0;
        c.lightbar.red.material.emissiveIntensity = on ? 2.6 : 0.2;
        c.lightbar.blue.material.emissiveIntensity = on ? 0.2 : 2.6;
      }
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
    }
  };
})();
