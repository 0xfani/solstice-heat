// Solstice Heat — shots.js: deterministic screenshot modes (?shot=chase|foot|mission|combat&seed=N).
// Each poses the real game systems — player, police, traffic, peds, mission, HUD — then freezes
// gameplay so headless Chrome captures a stable, real render of the running game.
(function () {
  const U = SH.U;
  const S = {};
  SH.shots = S;

  function params() {
    const q = new URLSearchParams(location.search);
    return { shot: q.get('shot'), seed: parseInt(q.get('seed') || '1', 10), test: q.get('test') === '1' };
  }
  S.params = params;

  function playerCar(kind, color, x, z, heading, speed) {
    const car = SH.vehicles.createCar(kind, color, SH.state.rng);
    SH.vehicles.place(car, x, z, heading);
    car.speed = speed;
    const p = SH.state.player;
    p.onFoot = false; p.car = car; p.x = x; p.z = z; p.heading = heading; p.speed = speed;
    SH.player.group.visible = false;
    return car;
  }
  function foot(x, z, heading) {
    const p = SH.state.player;
    p.onFoot = true; p.car = null; p.x = x; p.z = z; p.heading = heading;
    SH.player.group.visible = true;
    SH.player.place();
  }
  function cop(x, z, heading, name, state, role) {
    const car = SH.vehicles.createCar('police', 0xe8e4da, SH.state.rng);
    SH.vehicles.place(car, x, z, heading);
    SH.police.units.push({ car, name, state, role: role || 'pursuit', dist: 0 });
    return car;
  }
  function traffic(x, z, heading, kind, color, speed) {
    const car = SH.vehicles.createCar(kind || 'sedan', color || 0x2e86ab, SH.state.rng);
    car.isTraffic = true; car.speed = speed || 11;
    SH.vehicles.place(car, x, z, heading);
    SH.vehicles.traffic.push(car);
    return car;
  }
  function parked(x, z, heading, kind, color) {
    const car = SH.vehicles.createCar(kind || 'sedan', color || 0x2e86ab, SH.state.rng);
    car.isParked = true;
    SH.vehicles.place(car, x, z, heading);
    return car;
  }
  function heli(x, z, y) {
    const h = SH.police.heli, pl = SH.state.player;
    h.active = true; h.group.visible = true;
    h.x = x; h.z = z; h.y = y || 24;
    h.group.position.set(x, h.y, z);
    h.group.rotation.y = Math.atan2(pl.x - x, pl.z - z);
    h.cone.scale.y = h.y / 44;
    h.cone.position.y = -h.y / 2;
    h.spotTarget.position.set(pl.x - x, -h.y, pl.z - z);
    h.pool.visible = true;
    h.pool.position.set(pl.x, 0.06, pl.z);
  }
  function cam(x, y, z, lx, ly, lz) {
    SH.camera.position.set(x, y, z);
    SH.camera.lookAt(lx, ly, lz);
    SH.player.camTarget = null;
  }
  function missionSnapshot(defIdx, stageIdx, extra) {
    const def = SH.missions.defs[defIdx];
    SH.state.missionIndex = defIdx;
    SH.state.mission = { def, stageIdx, timer: 0, progress: 0, targets: [], targetCar: null, raceIdx: 0, ...extra };
    SH.missions.placeMarker();
  }
  function say(who, text) {
    SH.state.dialogue = { who, text, dur: 999, t: 0 };
    SH.state.dialogueQueue.length = 0;
  }

  S.apply = function () {
    const { shot } = params();
    if (!shot) return false;
    const s = SH.state;
    s.mode = 'play';
    s.freeze = true;
    s.shot = shot;
    SH.police.clear();
    SH.missions.marker.visible = false;
    const W = -Math.PI / 2, E = Math.PI / 2;

    if (shot === 'chase') {
      // COVER: golden-hour coast run, 4 stars, Air-1 overhead, roadblock ahead, mission clock live
      playerCar('sports', 0xc0392b, -30, 252, W, 31);
      s.heat = 4; s.wanted = 4;
      cop(-35, 259, W, 'MARLIN-11', 'RAMMING');
      cop(-43, 249, W, 'BARRACUDA-12', 'PURSUIT');
      cop(-98, 256, 0, 'OSPREY-13', 'ROADBLOCK', 'roadblock');
      heli(-62, 238, 12);
      traffic(-72, 260, E, 'sedan', 0xe8e4da, 12);
      traffic(-120, 252, W, 'taxi', 0xd4a017, 10);
      SH.peds.spawnAt(s.rng, -42, 246, false);
      SH.peds.spawnAt(s.rng, -55, 246, false);
      SH.peds.spawnAt(s.rng, -18, 266, false);
      cop(-52, 259, W, 'MANTA-16', 'PURSUIT');
      cop(-60, 249, W, 'PELICAN-17', 'PURSUIT');
      traffic(-50, 260, E, 'muscle', 0x35d0ba, 13);
      traffic(-90, 252, W, 'sedan', 0x2c3e50, 10);
      traffic(-140, 260, E, 'van', 0xe8e4da, 9);
      SH.peds.spawnAt(s.rng, -30, 246, false);
      SH.peds.spawnAt(s.rng, -64, 246, false);
      SH.peds.spawnAt(s.rng, -48, 266, false);
      SH.peds.spawnAt(s.rng, -76, 266, false);
      missionSnapshot(4, 0, { timer: 107, raceIdx: 2 });
      SH.missions.marker.position.set(0, 0, 250);
      SH.missions.marker.visible = true;
      say('TERE', 'The chopper’s on you, Rafa! Cut under the pier and lose them before the run clock dies!');
      s.cash = 12450; s.respect = 220; s.health = 84;
      s.weapons[3].unlocked = true; s.weaponIndex = 3; s.weapons[3].ammo = 24;
      s.player.car.condition = 86;
      cam(-17, 5.2, 256.5, -42, 1.6, 251);
    } else if (shot === 'foot') {
      // on the promenade: palms, beach, traffic, crowd, first job marker
      foot(-44, 246, E);
      s.heat = 0; s.wanted = 0;
      traffic(-30, 260, E, 'sedan', 0x2e86ab, 11);
      traffic(2, 252, W, 'taxi', 0xd4a017, 10);
      traffic(24, 252, W, 'muscle', 0x8e44ad, 13);
      parked(-8, 244, 0, 'sedan', 0x2e86ab);
      for (const [px, pz] of [[-36, 246], [-38, 245], [-30, 266], [-46, 266], [-24, 246], [-30, 246]]) SH.peds.spawnAt(s.rng, px, pz, false);
      traffic(40, 260, E, 'sedan', 0xe8e4da, 10);
      SH.peds.spawnAt(s.rng, -18, 246, false);
      SH.peds.spawnAt(s.rng, -44, 266, false);
      SH.peds.spawnAt(s.rng, -12, 266, false);
      missionSnapshot(0, 0, {});
      say('TERE', 'Rafa! Half the Bay thinks you robbed the Meridian. Grab those wheels and get to my garage.');
      s.cash = 500; s.respect = 0; s.health = 100; s.weaponIndex = 1;
      SH.player.gun.visible = true;
      cam(-50, 3.4, 243.5, -38, 0.9, 249);
    } else if (shot === 'mission') {
      // downtown bank job: objective beam, towers, a responding unit, dialogue
      playerCar('sedan', 0x2e86ab, 34, -28, Math.PI, 6);
      s.heat = 1; s.wanted = 1;
      cop(38, -56, Math.PI, 'MARLIN-11', 'RESPONDING');
      traffic(0, -60, E, 'van', 0xe8e4da, 9);
      traffic(-30, -34, W, 'sedan', 0xc0392b, 10);
      SH.peds.spawnAt(s.rng, 44, -22, false);
      SH.peds.spawnAt(s.rng, 24, -20, false);
      SH.peds.spawnAt(s.rng, 40, -50, false);
      traffic(34, -8, E, 'taxi', 0xd4a017, 9);
      SH.peds.spawnAt(s.rng, 28, -44, false);
      SH.peds.spawnAt(s.rng, 42, -36, false);
      missionSnapshot(2, 0, {});
      say('TERE', 'The safety-deposit box is in the Meridian bank. Grab the ledger page — then vanish before Hale’s scanners light up.');
      s.cash = 2350; s.respect = 90; s.health = 100; s.weaponIndex = 2; s.weapons[2].unlocked = true;
      cam(34, 5.2, -19, 34, 2.2, -44);
    } else if (shot === 'combat') {
      // harbor ambush: rifle muzzle flash + tracer mid-shot, gang shooters, 3 stars, Air-1
      foot(192, -140, Math.PI);
      s.heat = 3; s.wanted = 3;
      SH.peds.spawnAt(s.rng, 191, -156, true);
      SH.peds.spawnAt(s.rng, 197, -166, true);
      SH.peds.spawnAt(s.rng, 187, -172, true);
      SH.peds.panic(192, -150, 34);
      SH.peds.spawnAt(s.rng, 200, -132, false);
      traffic(192, -110, Math.PI, 'sedan', 0x2e86ab, 10);
      cop(200, -148, Math.PI, 'TARPON-14', 'PURSUIT');
      cop(184, -156, Math.PI, 'HERON-15', 'PURSUIT');
      heli(194, -168, 13);
      missionSnapshot(5, 0, { progress: 1 });
      SH.missions.marker.position.set(191, 0, -156);
      SH.missions.marker.visible = true;
      say('HALE', 'You think a ledger scares me, Solis? I AM the law in Solstice Bay!');
      s.cash = 4100; s.respect = 180; s.health = 72;
      s.weapons[3].unlocked = true; s.weaponIndex = 3; s.weapons[3].ammo = 18;
      SH.player.gun.visible = true;
      // frozen mid-shot visuals down the road at the gang shooter
      SH.effects.tracer(191.7, 1.55, -141.3, 191, 1.1, -155, 0xffd98a);
      SH.effects.muzzle(191.7, 1.55, -141.3, false);
      SH.effects.spark(191, 1.1, -155, 6);
      cam(194.6, 2.7, -136.5, 190.5, 1.2, -158);
    }
    s.clock = 18 * 60 + 42;
    window.__shotReady = true;
    return true;
  };
})();
