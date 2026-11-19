// Solstice Heat — hud.js: the dense DOM heads-up display — circular minimap, mission panel,
// wanted stars, SBPD unit tracker, weapon bar, radio / vehicle stats, dialogue portraits,
// toasts, menus and the control hints.
(function () {
  const U = SH.U, C = SH.CONFIG;
  const H = { toasts: [], toastT: 0, vignette: 0, lastPoliceKey: '', textT: 0, hintsT: 0, hintsOn: true };
  SH.hud = H;
  const $ = (id) => document.getElementById(id);
  let mm, mctx;

  // ---- generated character portraits (flat stylised, no external art) ----
  function portrait(who) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const g = cv.getContext('2d');
    const bg = { RAFA: '#173a3a', TERE: '#3a1730', HALE: '#17203a' }[who] || '#222';
    g.fillStyle = bg; g.fillRect(0, 0, 96, 96);
    const skin = { RAFA: '#c68642', TERE: '#e0ac69', HALE: '#f1c27d' }[who];
    g.fillStyle = { RAFA: '#35d0ba', TERE: '#d99a9a', HALE: '#1f3a5f' }[who];
    g.fillRect(18, 74, 60, 22); // shoulders
    g.fillStyle = skin; g.fillRect(40, 62, 16, 16); // neck
    g.beginPath(); g.roundRect(28, 22, 40, 46, 10); g.fill(); // head
    g.fillStyle = '#1c1410';
    if (who === 'TERE') { g.fillRect(24, 18, 48, 16); g.fillRect(24, 22, 8, 40); g.fillRect(64, 22, 8, 40); }
    else if (who === 'HALE') { g.fillRect(24, 16, 48, 12); g.fillStyle = '#2c4a7c'; g.fillRect(22, 12, 52, 10); g.fillStyle = '#ffd23d'; g.fillRect(44, 14, 8, 6); }
    else { g.fillRect(28, 18, 40, 12); }
    g.fillStyle = '#14161c';
    g.fillRect(36, 40, 7, 5); g.fillRect(53, 40, 7, 5); // eyes
    g.fillRect(34, 35, 11, 2); g.fillRect(51, 35, 11, 2); // brows
    g.fillStyle = who === 'TERE' ? '#c0392b' : '#7a4a2a';
    g.fillRect(42, 56, 12, 3); // mouth
    if (who === 'RAFA') { g.fillStyle = 'rgba(20,16,12,0.4)'; g.fillRect(30, 52, 36, 12); }
    if (who === 'TERE') { g.strokeStyle = '#ffd23d'; g.lineWidth = 2; g.beginPath(); g.arc(28, 56, 4, 0, 7); g.stroke(); g.beginPath(); g.arc(68, 56, 4, 0, 7); g.stroke(); }
    if (who === 'HALE') { g.fillStyle = '#5c3a21'; g.fillRect(38, 52, 20, 4); }
    return cv.toDataURL();
  }

  H.init = function () {
    H.portraits = { RAFA: portrait('RAFA'), TERE: portrait('TERE'), HALE: portrait('HALE') };
    $('rafaPortrait').src = H.portraits.RAFA;
    mm = $('minimap'); mctx = mm.getContext('2d');
    const wb = $('weaponBar');
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'wslot'; d.id = 'ws' + i;
      d.innerHTML = '<span class="wkey">' + (i + 1) + '</span><span class="wname"></span><span class="wammo"></span>';
      wb.appendChild(d);
    }
    const stars = $('stars');
    for (let i = 0; i < 5; i++) { const s = document.createElement('span'); s.textContent = '★'; stars.appendChild(s); }
    $('btnNew').onclick = () => { SH.audio.unlock(); SH.main.newGame(); };
    $('btnContinue').onclick = () => { SH.audio.unlock(); SH.main.continueGame(); };
    $('btnResume').onclick = () => SH.main.resume();
    $('btnQuit').onclick = () => { SH.save.write(); SH.main.toMenu(); };
    $('btnOverlay').onclick = () => { /* auto-respawn handles it */ };
    const hb = $('hints');
    const shortHints = [['W A S D', 'drive / walk'], ['F', 'enter / steal'], ['MOUSE / J', 'shoot'], ['1-5', 'weapons'], ['SPACE', 'handbrake'], ['ESC', 'pause']];
    hb.innerHTML = shortHints.map((b) => '<span><b>' + b[0] + '</b> ' + b[1] + '</span>').join('');
    $('dlgPortrait').src = H.portraits.TERE;
    if (!SH.save.exists()) $('btnContinue').classList.add('disabled');
  };

  H.toast = function (msg) { H.toasts.push({ msg, t: 3.2 }); };
  H.damageFlash = function () { H.vignette = 0.55; };
  H.showOverlay = function (kind) {
    const o = $('overlay');
    o.classList.remove('hidden');
    $('overlayTitle').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    $('overlaySub').textContent = kind === 'busted' ? 'The SBPD caught up with you. −$200' : 'You bled out on the asphalt. −$150';
  };
  H.hideOverlay = function () { $('overlay').classList.add('hidden'); };

  function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
  function fmtTime(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function rankFor(r) {
    const th = [0, 50, 120, 220, 300];
    let i = 0;
    while (i < th.length - 1 && r >= th[i + 1]) i++;
    return { name: SH.respectRanks[i], cur: r - th[i], next: (th[i + 1] || th[i] + 100) - th[i] };
  }

  // ---- circular minimap ----
  function drawMinimap() {
    const s = SH.state, p = s.player;
    const c = mm.width / 2, R = 86, sc = c / R;
    mctx.clearRect(0, 0, mm.width, mm.height);
    mctx.save();
    mctx.beginPath(); mctx.arc(c, c, c - 3, 0, 7); mctx.clip();
    mctx.fillStyle = '#1a1e28'; mctx.fillRect(0, 0, mm.width, mm.height);
    mctx.translate(c, c); mctx.rotate(p.heading); mctx.scale(sc, -sc);
    mctx.translate(-p.x, -p.z);
    // ocean
    mctx.fillStyle = '#1f7a8c';
    mctx.fillRect(p.x - R, C.oceanZ, R * 2, 320);
    mctx.fillStyle = '#e6cd97';
    mctx.fillRect(p.x - R, C.beachZ, R * 2, C.oceanZ - C.beachZ);
    // blocks
    mctx.fillStyle = '#262b36';
    for (const b of SH.city.buildingRects) {
      if (Math.abs(b.cx - p.x) > R + 40 || Math.abs(b.cz - p.z) > R + 40) continue;
      mctx.fillRect(b.cx - b.h, b.cz - b.h, b.h * 2, b.h * 2);
    }
    // roads
    mctx.strokeStyle = '#4a5160'; mctx.lineWidth = C.roadW * 0.8;
    for (const l of SH.city.roadLines) {
      mctx.beginPath();
      if (l.axis === 'x') { mctx.moveTo(l.at, p.z - R); mctx.lineTo(l.at, p.z + R); }
      else { mctx.moveTo(p.x - R, l.at); mctx.lineTo(p.x + R, l.at); }
      mctx.stroke();
    }
    // traffic
    mctx.fillStyle = '#cfd4dc';
    for (const v of SH.vehicles.traffic) {
      if (U.dist(v.x, v.z, p.x, p.z) > R) continue;
      mctx.fillRect(v.x - 1.4, v.z - 1.4, 2.8, 2.8);
    }
    // pedestrians
    mctx.fillStyle = '#7d8590';
    for (const ped of SH.peds.list) {
      if (ped.dead || U.dist(ped.x, ped.z, p.x, p.z) > R) continue;
      mctx.fillRect(ped.x - 0.8, ped.z - 0.8, 1.6, 1.6);
    }
    // police blips (flashing)
    const flash = Math.floor(s.time * 4) % 2 === 0;
    for (const u of SH.police.units) {
      if (U.dist(u.car.x, u.car.z, p.x, p.z) > R) continue;
      mctx.fillStyle = flash ? '#ff4444' : '#4488ff';
      mctx.beginPath(); mctx.arc(u.car.x, u.car.z, 2.6, 0, 7); mctx.fill();
    }
    if (SH.police.heli && SH.police.heli.active) {
      mctx.fillStyle = '#ffd23d';
      mctx.beginPath(); mctx.arc(SH.police.heli.x, SH.police.heli.z, 3, 0, 7); mctx.fill();
    }
    // mission marker
    if (SH.missions.marker && SH.missions.marker.visible) {
      const mx = SH.missions.marker.position.x, mz = SH.missions.marker.position.z;
      mctx.fillStyle = '#ffd23d';
      mctx.save(); mctx.translate(mx, mz); mctx.rotate(Math.PI / 4); mctx.fillRect(-3, -3, 6, 6); mctx.restore();
    }
    mctx.restore();
    // player arrow (screen space, always up)
    mctx.save();
    mctx.translate(c, c);
    mctx.fillStyle = '#35d0ba';
    mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
    // north tick
    const nx = c + Math.sin(p.heading) * (c - 9), ny = c + Math.cos(p.heading) * (c - 9);
    mctx.fillStyle = '#ff6b5e'; mctx.font = 'bold 10px Arial'; mctx.textAlign = 'center';
    mctx.fillText('N', nx, ny + 3);
    // ring
    mctx.strokeStyle = 'rgba(255,255,255,0.35)'; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(c, c, c - 2, 0, 7); mctx.stroke();
  }

  H.update = function (dt) {
    const s = SH.state, p = s.player;
    const playing = s.mode === 'play' || s.mode === 'pause' || s.mode === 'busted' || s.mode === 'wasted';
    $('hud').classList.toggle('hidden', !playing);
    $('startScreen').classList.toggle('hidden', s.mode !== 'menu');
    $('pauseScreen').classList.toggle('hidden', s.mode !== 'pause');
    if (!playing) return;
    drawMinimap();
    // dialogue queue
    if (!s.dialogue && s.dialogueQueue.length) {
      s.dialogue = s.dialogueQueue.shift();
      s.dialogue.t = 0;
    }
    if (s.dialogue) {
      $('dlgPortrait').src = H.portraits[s.dialogue.who] || H.portraits.TERE;
      $('dlgName').textContent = { RAFA: 'RAFA SOLIS', TERE: 'TERE SOLANO', HALE: 'DET. HALE' }[s.dialogue.who] || s.dialogue.who;
      $('dlgText').textContent = s.dialogue.text;
      s.dialogue.t += dt;
      if (s.dialogue.t > s.dialogue.dur) s.dialogue = null;
    }
    $('dialogueBox').classList.toggle('hidden', !s.dialogue);
    // toasts
    if (H.toasts.length) {
      H.toastT -= dt;
      const t = H.toasts[0];
      $('toast').textContent = t.msg;
      $('toast').classList.remove('hidden');
      if (H.toastT <= 0) { H.toasts.shift(); H.toastT = 3.2; if (!H.toasts.length) $('toast').classList.add('hidden'); }
    }
    // damage vignette
    H.vignette = Math.max(0, H.vignette - dt * 0.8);
    $('vignette').style.opacity = H.vignette + (s.health < 30 ? 0.25 : 0);
    // crosshair + hints
    $('crosshair').classList.toggle('hidden', !(s.weaponIndex > 0 && s.mode === 'play'));
    H.hintsT += dt;
    if (SH.input.hit('KeyH')) H.hintsOn = !H.hintsOn;
    $('hints').classList.toggle('hidden', !H.hintsOn || H.hintsT > 40);
    // radio
    if (SH.input.hit('KeyV')) { s.radio = (s.radio + 1) % SH.radioStations.length; s.radioTrack = 0; H.toast('RADIO — ' + SH.radioStations[s.radio].name); }
    const st = SH.radioStations[s.radio];
    $('radioStation').textContent = st.name;
    $('radioTrack').textContent = st.tracks[Math.floor(s.time / 30) % st.tracks.length];

    H.textT -= dt;
    if (H.textT > 0) return;
    H.textT = 0.12;
    // stats
    $('cash').textContent = fmtCash(s.cash);
    const mins = Math.floor(s.clock) % 1440;
    $('clock').textContent = Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2);
    $('day').textContent = s.day;
    // wanted
    $('wantedLabel').textContent = s.wanted > 0 ? 'WANTED' : 'CLEAN';
    $('wantedBox').classList.toggle('hot', s.wanted > 0);
    const stars = $('stars').children;
    for (let i = 0; i < 5; i++) stars[i].className = i < s.wanted ? 'on' : '';
    // mission panel
    const m = s.mission;
    if (m) {
      const stg = m.def.stages[m.stageIdx];
      $('mpJob').textContent = 'JOB ' + (s.missionIndex + 1) + '/7 — ' + m.def.giver;
      $('mpName').textContent = m.def.name;
      $('mpObjective').textContent = stg.label;
      $('mpStageText').textContent = 'STAGE ' + (m.stageIdx + 1) + '/' + m.def.stages.length;
      $('mpStageFill').style.width = ((m.stageIdx + 1) / m.def.stages.length * 100) + '%';
      $('mpTimer').textContent = m.timer > 0 ? '⏱ ' + fmtTime(m.timer) : '';
      $('mpTimer').classList.toggle('urgent', m.timer > 0 && m.timer < 20);
      let prog = '';
      if (stg.type === 'destroy' || stg.type === 'kill') prog = m.progress + '/' + stg.count;
      if (stg.type === 'race') prog = m.raceIdx + '/' + stg.points.length;
      $('mpProgress').textContent = prog;
    } else {
      $('mpJob').textContent = 'FREE ROAM';
      $('mpName').textContent = 'SOLSTICE BAY';
      $('mpObjective').textContent = s.missionIndex >= SH.missions.defs.length - 1 && SH.missions.started ? 'Story complete — the Bay is yours.' : 'Next job incoming…';
      $('mpStageText').textContent = ''; $('mpStageFill').style.width = '0%';
      $('mpTimer').textContent = ''; $('mpProgress').textContent = '';
    }
    // police tracker
    const pp = $('policePanel');
    if (s.wanted > 0) {
      pp.classList.remove('hidden');
      let key = s.wanted + '|';
      let rows = '';
      for (const u of SH.police.units) {
        const d = Math.round(U.dist(u.car.x, u.car.z, p.x, p.z));
        key += u.name + d + u.state;
        rows += '<div class="punit"><span class="pname">' + u.name + '</span><span class="pdist">' + d + 'm</span><span class="pstate ' + u.state.toLowerCase() + '">' + u.state + '</span></div>';
      }
      if (SH.police.heli && SH.police.heli.active) {
        const d = Math.round(U.dist(SH.police.heli.x, SH.police.heli.z, p.x, p.z));
        key += 'AIR' + d;
        rows += '<div class="punit air"><span class="pname">AIR-1</span><span class="pdist">' + d + 'm</span><span class="pstate spotlight">SPOTLIGHT</span></div>';
      }
      if (key !== H.lastPoliceKey) { $('ppUnits').innerHTML = rows; H.lastPoliceKey = key; }
      $('ppTitle').textContent = 'SBPD RESPONSE — CODE 3';
    } else { pp.classList.add('hidden'); H.lastPoliceKey = ''; }
    // weapons
    const prices = ['FREE', '$150', '$1,200', '$3,800', '$6,500'];
    for (let i = 0; i < 5; i++) {
      const w = s.weapons[i], el = $('ws' + i);
      el.classList.toggle('active', i === s.weaponIndex);
      el.classList.toggle('locked', !w.unlocked);
      el.querySelector('.wname').textContent = w.name;
      el.querySelector('.wammo').textContent = !w.unlocked ? prices[i] : (w.kind === 'melee' ? '∞' : (s.reloading > 0 && i === s.weaponIndex ? 'RELOAD' : w.ammo + '/' + (w.reserve === Infinity ? '∞' : w.reserve)));
    }
    // vehicle / foot panel
    if (!p.onFoot && p.car) {
      $('vpName').textContent = p.car.name.toUpperCase();
      $('vpSpeed').textContent = Math.round(Math.abs(p.car.speed) * 3.6);
      $('vpCondFill').style.width = p.car.condition + '%';
      $('vpCondFill').className = p.car.condition > 50 ? 'good' : p.car.condition > 25 ? 'warn' : 'bad';
      $('vpCondText').textContent = 'CONDITION ' + Math.round(p.car.condition) + '%';
      $('vpMode').textContent = p.car.dead ? 'ENGINE DEAD' : 'DRIVING';
    } else {
      $('vpName').textContent = 'ON FOOT';
      $('vpSpeed').textContent = Math.round(p.speed * 3.6);
      $('vpCondFill').style.width = '100%';
      $('vpCondText').textContent = 'SPRINT READY';
      $('vpMode').textContent = 'COSTA DORADA';
    }
    // player bars
    $('healthFill').style.width = s.health + '%';
    const rk = rankFor(s.respect);
    $('respectFill').style.width = U.clamp(rk.cur / rk.next * 100, 0, 100) + '%';
    $('respectRank').textContent = 'RESPECT — ' + rk.name;
    $('respectNum').textContent = s.respect + ' RP';
    $('location').textContent = SH.city.district(p.x, p.z) + ' · Solstice Bay';
  };
})();
