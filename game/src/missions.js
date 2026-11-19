// Solstice Heat — missions.js: the 7-job story of Rafa Solis clearing his name, with
// objective stages, timers, markers, dialogue, cash/respect rewards and weapon unlocks.
(function () {
  const U = SH.U, L = () => SH.city.landmarks;
  const M = { defs: [], marker: null, ring: null, nextT: 0, started: false };
  SH.missions = M;

  M.defs = [
    {
      name: 'HOT WHEELS', giver: 'TERE', reward: { cash: 300, respect: 20 },
      intro: [
        { who: 'TERE', text: 'Rafa! Half the Bay thinks you robbed the Meridian. Keep your head down and get to my garage.' },
        { who: 'RAFA', text: 'I need wheels first, Tere. That Vela on the curb is calling my name.' },
      ],
      stages: [
        { type: 'steal', label: 'Boost the Vela Sedan on the curb', x: -8, z: 244 },
        { type: 'goto', label: 'Reach Tere’s garage in the Deco Quarter', x: -160, z: 150, r: 9 },
      ],
      outro: [{ who: 'TERE', text: 'Clean ride. Detective Hale is leaning on every cop in Solstice Bay — we clear your name my way.' }],
    },
    {
      name: 'THE DROP', giver: 'TERE', reward: { cash: 500, respect: 30 }, unlock: 2,
      intro: [{ who: 'TERE', text: 'A package landed at the pier. Bring it to the plaza fountain before Hale’s scanners catch the scent.' }],
      stages: [
        { type: 'goto', label: 'Collect the package at the pier', x: 192, z: 258, r: 9, timer: 95 },
        { type: 'goto', label: 'Deliver it to the plaza fountain', x: 0, z: 128, r: 9, timer: 95 },
      ],
      outro: [{ who: 'TERE', text: 'Delivered. The package was a ledger page — Hale’s payoff sheet. Take this SMG, you’ll need it.' }],
    },
    {
      name: 'CLEAN GETAWAY', giver: 'TERE', reward: { cash: 800, respect: 40 },
      intro: [{ who: 'TERE', text: 'The bank on Meridian holds the safety-deposit box with the rest of the ledger. Grab it and vanish.' }],
      stages: [
        { type: 'goto', label: 'Hit the Meridian bank safety-deposit', x: 34, z: -40, r: 9 },
        { type: 'escape', label: 'Lose the SBPD or reach the safehouse', alarm: 2, safe: { x: -226, z: 96 } },
      ],
      outro: [{ who: 'HALE', text: 'Solis. Every scanner in this city has your face. Run all you want — the Bay is mine.' }],
    },
    {
      name: 'STREET SWEEP', giver: 'TERE', reward: { cash: 900, respect: 50 }, unlock: 3,
      intro: [{ who: 'TERE', text: 'Hale hired the Toro crew to torch our cars. Wreck their three rides near the depot, then meet me at the plaza.' }],
      stages: [
        { type: 'destroy', label: 'Wreck the Toro crew cars', count: 3, spawn: [{ x: 210, z: -150 }, { x: 238, z: -172 }, { x: 222, z: -138 }] },
        { type: 'goto', label: 'Regroup at the plaza fountain', x: 0, z: 128, r: 9 },
      ],
      outro: [{ who: 'TERE', text: 'The crew is scrap. A rifle for the wheelman who just became a shot caller.' }],
    },
    {
      name: 'GOLDEN HOUR RUN', giver: 'TERE', reward: { cash: 1200, respect: 60 }, unlock: 4,
      intro: [{ who: 'TERE', text: 'Sun’s setting, the coast road is clear. Six checkpoints, one hundred seconds. Show the Bay why they call you the Wheelman.' }],
      stages: [
        { type: 'race', label: 'Hit every coast checkpoint', timer: 105, points: [{ x: -180, z: 250 }, { x: -90, z: 250 }, { x: 0, z: 250 }, { x: 90, z: 250 }, { x: 170, z: 250 }, { x: 236, z: 250 }] },
      ],
      outro: [{ who: 'TERE', text: 'A record run. Take the shotgun — the finale won’t be polite.' }],
    },
    {
      name: 'THE SETUP', giver: 'TERE', reward: { cash: 1500, respect: 70 },
      intro: [{ who: 'TERE', text: 'Hale’s goons are waiting at the harbor to end this. Three shooters. Put them down, then walk into the courthouse with the ledger.' }],
      stages: [
        { type: 'kill', label: 'Take out Hale’s harbor shooters', count: 3, spawn: [{ x: -220, z: -150 }, { x: -238, z: -168 }, { x: -210, z: -176 }] },
        { type: 'goto', label: 'Reach the courthouse steps', x: 4, z: -196, r: 9 },
      ],
      outro: [{ who: 'HALE', text: 'You think a ledger scares me? I AM the law in Solstice Bay!' }],
    },
    {
      name: 'SOLSTICE HEAT', giver: 'TERE', reward: { cash: 3000, respect: 120 },
      intro: [{ who: 'TERE', text: 'The original evidence van sits in Hale’s depot. Boost it, shake every unit he has, and park it at the courthouse. End this, Rafa.' }],
      stages: [
        { type: 'steal', label: 'Steal the evidence van from the depot', x: 226, z: -160, van: true },
        { type: 'escape', label: 'Lose the SBPD or reach the courthouse', alarm: 4, safe: { x: 4, z: -196 } },
      ],
      outro: [
        { who: 'TERE', text: 'The van’s at the courthouse. The ledger, the payoffs, all of it — Hale is finished.' },
        { who: 'RAFA', text: 'The Bay knows the truth now. Solstice Heat? More like Solstice Sweet. Thanks, Tere.' },
      ],
    },
  ];

  M.buildMarker = function () {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 16, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.y = 8;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 24), new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23d }));
    arrow.rotation.x = Math.PI; arrow.position.y = 5;
    const grp = new THREE.Group();
    grp.add(beam, ring, arrow);
    grp.visible = false;
    SH.scene.add(grp);
    M.marker = grp; M.arrow = arrow;
  };

  M.say = function (lines) {
    for (const l of lines) SH.state.dialogueQueue.push({ ...l, dur: 4.4 });
  };

  M.start = function (index) {
    const s = SH.state;
    const def = M.defs[index];
    if (!def) return;
    s.missionIndex = index;
    s.mission = { def, stageIdx: 0, timer: 0, progress: 0, targets: [], targetCar: null, raceIdx: 0 };
    M.say(def.intro);
    M.enterStage();
    SH.hud.toast('JOB ' + (index + 1) + '/7 — ' + def.name);
  };

  M.enterStage = function () {
    const s = SH.state, m = s.mission;
    if (!m) return;
    const st = m.def.stages[m.stageIdx];
    m.timer = st.timer || 0;
    m.progress = 0; m.raceIdx = 0;
    // clear previous targets
    for (const t of m.targets) {
      if (t.car) { SH.scene.remove(t.car.group); const i = SH.vehicles.all.indexOf(t.car); if (i >= 0) SH.vehicles.all.splice(i, 1); }
      if (t.ped) { t.ped.dead = true; t.ped.respawnT = 9999; }
    }
    m.targets = []; m.targetCar = null;
    if (st.type === 'steal') {
      const car = SH.vehicles.createCar(st.van ? 'van' : 'sedan', st.van ? 0xe8e4da : 0x2e86ab, s.rng);
      car.missionTarget = true;
      SH.vehicles.place(car, st.x, st.z, 0);
      m.targetCar = car; m.targets.push({ car });
    }
    if (st.type === 'destroy') {
      for (const p of st.spawn) {
        const car = SH.vehicles.createCar('muscle', 0x1c1f26, s.rng);
        car.missionTarget = true;
        SH.vehicles.place(car, p.x, p.z, s.rng() * 6.28);
        m.targets.push({ car });
      }
    }
    if (st.type === 'kill') {
      for (const p of st.spawn) m.targets.push({ ped: SH.peds.spawnAt(s.rng, p.x, p.z, true) });
    }
    if (st.type === 'escape' && st.alarm) SH.police.addHeat(st.alarm);
    M.placeMarker();
  };

  M.placeMarker = function () {
    const m = SH.state.mission;
    if (!m || !M.marker) return;
    const st = m.def.stages[m.stageIdx];
    let pos = null;
    if (st.type === 'goto' || st.type === 'steal') pos = { x: st.x, z: st.z };
    else if (st.type === 'escape') pos = st.safe;
    else if (st.type === 'race') pos = st.points[m.raceIdx];
    else if (st.type === 'destroy' || st.type === 'kill') {
      const live = m.targets.find((t) => (t.car && !t.car.dead) || (t.ped && !t.ped.dead));
      if (live) pos = { x: live.car ? live.car.x : live.ped.x, z: live.car ? live.car.z : live.ped.z };
    }
    M.marker.visible = !!pos;
    if (pos) M.marker.position.set(pos.x, 0, pos.z);
  };

  M.completeStage = function () {
    const s = SH.state, m = s.mission;
    SH.audio.pickup();
    m.stageIdx++;
    if (m.stageIdx >= m.def.stages.length) M.complete();
    else M.enterStage();
  };

  M.complete = function () {
    const s = SH.state, m = s.mission;
    const def = m.def;
    s.cash += def.reward.cash;
    s.respect += def.reward.respect;
    if (def.unlock !== undefined) SH.combat.unlock(def.unlock);
    M.say(def.outro);
    SH.hud.toast('JOB COMPLETE — ' + def.name + '  +$' + def.reward.cash);
    SH.audio.missionDone();
    s.mission = null;
    M.marker.visible = false;
    M.nextT = s.time + 5;
    SH.save.write();
    if (s.missionIndex + 1 >= M.defs.length) {
      SH.hud.toast('STORY COMPLETE — SOLSTICE BAY IS YOURS');
      s.respect = Math.max(s.respect, 300);
    }
  };

  M.fail = function (reason) {
    const s = SH.state;
    if (!s.mission) return;
    SH.hud.toast('JOB FAILED — ' + reason);
    const idx = s.missionIndex;
    s.mission = null;
    M.marker.visible = false;
    M.nextT = s.time + 3;
    s.missionIndex = idx; // retry the same job
    M.pendingRetry = idx;
  };

  M.onTargetDestroyed = function (car) {
    const m = SH.state.mission;
    if (!m) return;
    const st = m.def.stages[m.stageIdx];
    if (st.type !== 'destroy') return;
    if (m.targets.some((t) => t.car === car)) {
      m.progress++;
      SH.hud.toast('TORO CREW ' + m.progress + '/' + st.count);
      if (m.progress >= st.count) M.completeStage();
      else M.placeMarker();
    }
  };
  M.onTargetKilled = function (ped) {
    const m = SH.state.mission;
    if (!m) return;
    const st = m.def.stages[m.stageIdx];
    if (st.type !== 'kill') return;
    if (m.targets.some((t) => t.ped === ped)) {
      m.progress++;
      SH.hud.toast('SHOOTER DOWN ' + m.progress + '/' + st.count);
      if (m.progress >= st.count) M.completeStage();
      else M.placeMarker();
    }
  };

  M.update = function (dt) {
    const s = SH.state, pl = s.player;
    if (M.marker && M.marker.visible) {
      M.arrow.position.y = 5 + Math.sin(s.time * 2.4) * 0.5;
      M.arrow.rotation.y += dt * 1.5;
    }
    if (!s.mission) {
      if (s.mode === 'play' && s.time > M.nextT) {
        const idx = M.pendingRetry !== undefined ? M.pendingRetry : s.missionIndex + (M.started ? 1 : 0);
        M.pendingRetry = undefined;
        if (idx < M.defs.length) { M.started = true; M.start(idx); }
      }
      return;
    }
    const m = s.mission, st = m.def.stages[m.stageIdx];
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) { M.fail('Out of time.'); return; }
    }
    const d = (x, z) => U.dist(pl.x, pl.z, x, z);
    if (st.type === 'goto' && d(st.x, st.z) < (st.r || 8)) M.completeStage();
    else if (st.type === 'steal' && !pl.onFoot && pl.car === m.targetCar) M.completeStage();
    else if (st.type === 'escape' && (s.wanted === 0 || d(st.safe.x, st.safe.z) < 9)) M.completeStage();
    else if (st.type === 'race') {
      const p = st.points[m.raceIdx];
      if (d(p.x, p.z) < 10) {
        m.raceIdx++;
        SH.audio.pickup();
        if (m.raceIdx >= st.points.length) M.completeStage();
        else { SH.hud.toast('CHECKPOINT ' + m.raceIdx + '/' + st.points.length); M.placeMarker(); }
      }
    }
  };
})();
