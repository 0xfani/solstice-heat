// Solstice Heat — pedestrians.js: sidewalk crowd AI (loop walking, panic fleeing, knockdowns)
// and the hostile gang members some missions send you after.
(function () {
  const U = SH.U;
  const P = { list: [] };
  SH.peds = P;
  const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xecf0f1, 0x9b59b6, 0xe67e22, 0x1abc9c];
  const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x263238, 0x4a5568];
  const SKINS = [0xc68642, 0x8d5524, 0xe0ac69, 0xf1c27d, 0x5c3a21];

  P.create = function (rng, hostile) {
    const shirt = hostile ? 0x8e2b2b : U.pick(rng, SHIRTS);
    const pants = U.pick(rng, PANTS);
    const skin = U.pick(rng, SKINS);
    const geos = [
      U.box(0.22, 0.75, 0.24, -0.13, 0.375, 0, pants),
      U.box(0.22, 0.75, 0.24, 0.13, 0.375, 0, pants),
      U.box(0.5, 0.6, 0.28, 0, 1.05, 0, shirt),
      U.box(0.16, 0.55, 0.18, -0.34, 1.0, 0, shirt),
      U.box(0.16, 0.55, 0.18, 0.34, 1.0, 0, shirt),
      U.box(0.14, 0.14, 0.16, -0.34, 0.68, 0, skin),
      U.box(0.14, 0.14, 0.16, 0.34, 0.68, 0, skin),
      U.box(0.3, 0.32, 0.28, 0, 1.55, 0, skin),
      U.box(0.32, 0.12, 0.3, 0, 1.72, 0, hostile ? 0x14161c : 0x2c2216),
    ];
    if (hostile) geos.push(U.box(0.1, 0.1, 0.5, 0.34, 0.95, 0.25, 0x2c2f36));
    const mesh = U.vmesh(geos, { shadow: false });
    const group = new THREE.Group();
    group.add(mesh);
    const ped = {
      group, mesh, x: 0, z: 0, heading: 0, speed: 1.2 + rng() * 0.8,
      rect: null, p: 0, dir: rng() < 0.5 ? 1 : -1, panic: 0, panicX: 0, panicZ: 0,
      dead: false, fallT: 0, respawnT: 0, phase: rng() * 6.28, hostile: !!hostile, health: hostile ? 60 : 30,
    };
    P.list.push(ped);
    SH.scene.add(group);
    return ped;
  };

  P.spawnCrowd = function (rng, n) {
    const rects = SH.city.sidewalkRects;
    for (let k = 0; k < n; k++) {
      const ped = P.create(rng, false);
      ped.rect = U.pick(rng, rects);
      ped.p = rng() * 8 * ped.rect.half;
      P.loopPos(ped);
      P.place(ped);
    }
  };
  P.spawnAt = function (rng, x, z, hostile) {
    const ped = P.create(rng, hostile);
    ped.x = x; ped.z = z; ped.rect = null; ped.heading = rng() * 6.28;
    P.place(ped);
    return ped;
  };
  P.place = function (ped) {
    ped.group.position.set(ped.x, ped.dead ? 0.28 : 0.18, ped.z);
    ped.group.rotation.y = ped.heading;
  };
  P.loopPos = function (ped) {
    const r = ped.rect, h = r.half, per = 8 * h;
    let p = ((ped.p % per) + per) % per;
    const side = Math.floor(p / (2 * h)), f = p - side * 2 * h;
    if (side === 0) { ped.x = r.cx - h + f; ped.z = r.cz - h; ped.heading = Math.PI / 2; }
    else if (side === 1) { ped.x = r.cx + h; ped.z = r.cz - h + f; ped.heading = 0; }
    else if (side === 2) { ped.x = r.cx + h - f; ped.z = r.cz + h; ped.heading = -Math.PI / 2; }
    else { ped.x = r.cx - h; ped.z = r.cz + h - f; ped.heading = Math.PI; }
    if (ped.dir < 0) ped.heading += Math.PI;
  };

  P.panic = function (x, z, radius) {
    for (const ped of P.list) {
      if (ped.dead || ped.hostile) continue;
      const d = U.dist(x, z, ped.x, ped.z);
      if (d < radius) {
        ped.panic = 5 + Math.random() * 3;
        const dx = ped.x - x, dz = ped.z - z, dd = Math.hypot(dx, dz) || 1;
        ped.panicX = dx / dd; ped.panicZ = dz / dd;
      }
    }
  };

  P.knockdown = function (ped, heading) {
    if (ped.dead) return;
    ped.dead = true; ped.fallT = 0; ped.respawnT = 22;
    ped.heading = heading;
    SH.effects.blood(ped.x, 0.9, ped.z);
    if (ped.hostile) SH.missions.onTargetKilled(ped);
  };
  P.damage = function (ped, dmg, fromX, fromZ) {
    if (ped.dead) return;
    ped.health -= dmg;
    SH.effects.blood(ped.x, 1.2, ped.z);
    if (ped.health <= 0) { P.knockdown(ped, Math.atan2(ped.x - fromX, ped.z - fromZ)); SH.police.addHeat(ped.hostile ? 0.6 : 1.4); }
    else P.panic(ped.x, ped.z, 30);
  };

  P.update = function (dt, t) {
    const s = SH.state, pl = s.player;
    for (const ped of P.list) {
      if (ped.dead) {
        ped.fallT = Math.min(1, ped.fallT + dt * 4);
        ped.group.rotation.x = -Math.PI / 2 * ped.fallT;
        ped.group.position.y = 0.18 + 0.1 * ped.fallT;
        ped.respawnT -= dt;
        if (ped.respawnT <= 0 && !ped.hostile) {
          ped.dead = false; ped.health = 30; ped.group.rotation.x = 0;
          ped.rect = SH.city.sidewalkRects[Math.floor(Math.random() * SH.city.sidewalkRects.length)];
          ped.p = Math.random() * 8 * ped.rect.half;
          P.loopPos(ped); P.place(ped);
        }
        continue;
      }
      if (ped.hostile) {
        // gang members hold ground near their spawn, face the player when close
        const d = U.dist(ped.x, ped.z, pl.x, pl.z);
        if (d < 40) ped.heading = U.angleLerp(ped.heading, Math.atan2(pl.x - ped.x, pl.z - ped.z), dt * 3);
        P.place(ped);
        continue;
      }
      if (ped.panic > 0) {
        ped.panic -= dt;
        const sp = 5.6;
        let nx = ped.x + ped.panicX * sp * dt, nz = ped.z + ped.panicZ * sp * dt;
        const hit = SH.city.collide(nx, nz, 0.4);
        if (hit) { ped.panicX = -ped.panicX; ped.panicZ = -ped.panicZ; nx = ped.x; nz = ped.z; }
        ped.x = U.clamp(nx, -SH.CONFIG.bound, SH.CONFIG.bound);
        ped.z = U.clamp(nz, -SH.CONFIG.bound, SH.CONFIG.oceanZ - 2);
        ped.heading = Math.atan2(ped.panicX, ped.panicZ);
        ped.group.position.y = 0.18 + Math.abs(Math.sin(t * 14 + ped.phase)) * 0.1;
      } else if (ped.rect) {
        ped.p += ped.speed * ped.dir * dt;
        P.loopPos(ped);
        ped.group.position.y = 0.18 + Math.abs(Math.sin(t * 7 + ped.phase)) * 0.05;
      }
      // startled by a speeding car nearby
      if (!ped.panic && pl.car && Math.abs(pl.car.speed) > 14 && U.dist(ped.x, ped.z, pl.x, pl.z) < 8) P.panic(pl.x, pl.z, 9);
      P.place(ped);
    }
  };
})();
