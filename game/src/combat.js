// Solstice Heat — combat.js: weapon loadout (fists..shotgun), hitscan fire, reloads,
// damage to peds / cars / the player, drive-by shooting and health regen.
(function () {
  const U = SH.U;
  const DEFS = [
    { name: 'FISTS', clip: Infinity, reserve: Infinity, rate: 0.42, dmg: 26, range: 2.6, auto: false, kind: 'melee' },
    { name: 'PISTOL', clip: 12, reserve: 60, rate: 0.26, dmg: 34, range: 62, auto: false, kind: 'pistol' },
    { name: 'SMG', clip: 30, reserve: 120, rate: 0.085, dmg: 22, range: 55, auto: true, kind: 'smg' },
    { name: 'RIFLE', clip: 30, reserve: 90, rate: 0.12, dmg: 31, range: 85, auto: true, kind: 'rifle' },
    { name: 'SHOTGUN', clip: 8, reserve: 32, rate: 0.8, dmg: 17, range: 30, auto: false, kind: 'shotgun', pellets: 6 },
  ];
  const CB = { lastShotHeat: -9 };
  SH.combat = CB;

  CB.init = function () {
    SH.state.weapons = DEFS.map((d, i) => ({ ...d, ammo: d.clip, reserve: d.reserve, unlocked: i <= 1 }));
    SH.state.weaponIndex = 1;
  };
  CB.unlock = function (i) {
    const w = SH.state.weapons[i];
    if (w && !w.unlocked) { w.unlocked = true; SH.hud.toast(w.name + ' UNLOCKED'); SH.audio.pickup(); }
  };
  CB.select = function (i) {
    const w = SH.state.weapons[i];
    if (w && w.unlocked) { SH.state.weaponIndex = i; SH.state.reloading = 0; }
  };
  CB.current = function () { return SH.state.weapons[SH.state.weaponIndex]; };

  CB.reload = function () {
    const s = SH.state, w = CB.current();
    if (w.kind === 'melee' || s.reloading > 0 || w.ammo >= w.clip || w.reserve <= 0) return;
    s.reloading = 1.15;
  };

  function aimDir() {
    const v = new THREE.Vector3();
    SH.camera.getWorldDirection(v);
    return v;
  }
  function origin() {
    const p = SH.state.player;
    return { x: p.x, y: p.onFoot ? 1.45 : 1.25, z: p.z };
  }
  function rayHit(o, dir, range, radius, targets) {
    let best = null, bt = range;
    for (const t of targets) {
      const rx = t.x - o.x, ry = (t.y || 0.9) - o.y, rz = t.z - o.z;
      const along = rx * dir.x + ry * dir.y + rz * dir.z;
      if (along <= 0 || along > bt) continue;
      const px = rx - dir.x * along, py = ry - dir.y * along, pz = rz - dir.z * along;
      if (px * px + py * py + pz * pz < radius * radius) { bt = along; best = t; }
    }
    return best ? { t: best, at: bt } : null;
  }

  CB.fire = function () {
    const s = SH.state, w = CB.current();
    if (s.reloading > 0) return;
    if (w.kind !== 'melee' && w.ammo <= 0) { CB.reload(); return; }
    s.fireCooldown = w.rate;
    const o = origin(), dir = aimDir();
    if (w.kind === 'melee') {
      SH.audio.punch();
      SH.effects.muzzle(o.x + dir.x, o.y, o.z + dir.z, true);
      const fx = Math.sin(s.player.heading), fz = Math.cos(s.player.heading);
      for (const ped of SH.peds.list) {
        if (ped.dead) continue;
        const dx = ped.x - s.player.x, dz = ped.z - s.player.z;
        if (Math.hypot(dx, dz) < w.range && dx * fx + dz * fz > 0) {
          SH.peds.damage(ped, w.dmg, s.player.x, s.player.z);
          SH.police.addHeat(0.5);
        }
      }
      return;
    }
    w.ammo--;
    SH.audio.gunshot(w.kind);
    const pellets = w.pellets || 1;
    const carTargets = SH.vehicles.all.filter((c) => !c.dead).map((c) => ({ x: c.x, y: 0.9, z: c.z, car: c }));
    const pedTargets = SH.peds.list.filter((p) => !p.dead).map((p) => ({ x: p.x, y: 1.0, z: p.z, ped: p }));
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      if (pellets > 1) { d.x += (Math.random() - 0.5) * 0.09; d.y += (Math.random() - 0.5) * 0.05; d.z += (Math.random() - 0.5) * 0.09; d.normalize(); }
      const hitCar = rayHit(o, d, w.range, 2.1, carTargets);
      const hitPed = rayHit(o, d, w.range, 0.7, pedTargets);
      let hit = null;
      if (hitCar && hitPed) hit = hitCar.at < hitPed.at ? hitCar : hitPed;
      else hit = hitCar || hitPed;
      const end = hit ? hit.at : w.range;
      SH.effects.tracer(o.x + d.x * 1.1, o.y, o.z + d.z * 1.1, o.x + d.x * end, o.y + d.y * end, o.z + d.z * end, 0xffd98a);
      if (hit) {
        const hx = o.x + d.x * end, hy = o.y + d.y * end, hz = o.z + d.z * end;
        if (hit.t.car) {
          const c = hit.t.car;
          c.condition = Math.max(0, c.condition - w.dmg * 0.6);
          c.health -= w.dmg;
          SH.effects.spark(hx, hy, hz, 5);
          if (c.isPolice) SH.police.addHeat(0.3);
          if (c.condition <= 0 || c.health <= 0) SH.vehicles.kill(c);
          if (c === SH.state.player.car) CB.hurtPlayer(w.dmg * 0.2);
        } else if (hit.t.ped) {
          SH.peds.damage(hit.t.ped, w.dmg, o.x, o.z);
        }
      }
    }
    SH.effects.muzzle(o.x + dir.x * 1.2, o.y, o.z + dir.z * 1.2, false);
    SH.peds.panic(o.x, o.z, 28);
    if (s.time - CB.lastShotHeat > 1.2) { SH.police.addHeat(0.9); CB.lastShotHeat = s.time; }
  };

  CB.hurtPlayer = function (dmg) {
    const s = SH.state;
    if (s.mode !== 'play') return;
    s.health = Math.max(0, s.health - dmg);
    s.lastHurt = s.time;
    SH.hud.damageFlash();
    if (s.health <= 0) SH.police.wasted();
  };

  CB.update = function (dt) {
    const s = SH.state, inp = SH.input;
    for (let i = 0; i < 5; i++) if (inp.hit('Digit' + (i + 1))) CB.select(i);
    if (inp.hit('KeyR')) CB.reload();
    if (s.reloading > 0) {
      s.reloading -= dt;
      if (s.reloading <= 0) {
        const w = CB.current();
        const need = w.clip - w.ammo;
        const take = Math.min(need, w.reserve);
        w.ammo += take;
        if (w.reserve !== Infinity) w.reserve -= take;
      }
    }
    s.fireCooldown -= dt;
    const w = CB.current();
    const wantFire = w.auto ? inp.fire() : (inp.mouse.clicked || inp.hit('KeyJ'));
    if (wantFire && s.fireCooldown <= 0 && s.mode === 'play') CB.fire();
    if (s.time - s.lastHurt > 6 && s.health < 100) s.health = Math.min(100, s.health + dt * 3);
  };
})();
