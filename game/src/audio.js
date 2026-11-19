// Solstice Heat — audio.js: pure WebAudio synthesis (engine, siren, radio music, gunfire, skid).
(function () {
  let ctx = null, master = null, engine = null, siren = null, skid = null, radioGain = null;
  let radioTimer = 0, radioStep = 0, started = false, muted = false, unlocked = false;

  function ensure() {
    if (ctx) return true;
    if (!unlocked) return false;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      // engine: sawtooth through lowpass, pitch follows speed
      const eo = ctx.createOscillator(); eo.type = 'sawtooth'; eo.frequency.value = 55;
      const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 420;
      const eg = ctx.createGain(); eg.gain.value = 0;
      eo.connect(ef); ef.connect(eg); eg.connect(master); eo.start();
      engine = { osc: eo, gain: eg, filter: ef };
      // siren: two-tone triangle
      const so = ctx.createOscillator(); so.type = 'triangle'; so.frequency.value = 660;
      const sg = ctx.createGain(); sg.gain.value = 0;
      so.connect(sg); sg.connect(master); so.start();
      siren = { osc: so, gain: sg, t: 0 };
      // skid: looped noise through bandpass
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const sn = ctx.createBufferSource(); sn.buffer = buf; sn.loop = true;
      const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 900; sf.Q.value = 0.8;
      const skg = ctx.createGain(); skg.gain.value = 0;
      sn.connect(sf); sf.connect(skg); skg.connect(master); sn.start();
      skid = { gain: skg };
      radioGain = ctx.createGain(); radioGain.gain.value = 0.16; radioGain.connect(master);
      started = true;
    } catch (e) { return false; }
    return true;
  }

  function blip(freq, dur, type, vol, when) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(radioGain || master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 2400;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  // procedural radio: a 16-step sequencer, scale + tempo per station
  const scales = [
    [0, 3, 5, 7, 10, 12, 15, 14],   // minor synthwave
    [0, 2, 4, 7, 9, 12, 9, 7],      // major latin
    [0, 3, 7, 10, 12, 10, 7, 3],    // driving
  ];
  const tempos = [0.24, 0.19, 0.16];
  const roots = [110, 130.8, 98];
  function radioTick(dt) {
    if (!ctx || muted) return;
    radioTimer -= dt;
    if (radioTimer > 0) return;
    const st = SH.state.radio % 3;
    radioTimer = tempos[st];
    const sc = scales[st], root = roots[st];
    const n = sc[radioStep % sc.length];
    const f = root * Math.pow(2, n / 12);
    blip(f, 0.22, st === 1 ? 'triangle' : 'square', 0.16);
    if (radioStep % 4 === 0) blip(root / 2, 0.3, 'sine', 0.22);
    if (radioStep % 2 === 1) noise(0.03, 0.05, 6000);
    radioStep++;
  }

  SH.audio = {
    unlock() { unlocked = true; if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    get ready() { return started; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    gunshot(kind) {
      if (!ensure() || muted) return;
      noise(kind === 'shotgun' ? 0.22 : 0.12, kind === 'shotgun' ? 0.5 : 0.32, kind === 'rifle' ? 3200 : 1800);
      blip(kind === 'shotgun' ? 90 : 160, 0.07, 'square', 0.25);
    },
    punch() { if (ensure() && !muted) noise(0.08, 0.25, 700); },
    crash(force) { if (ensure() && !muted) noise(0.25, Math.min(0.5, force * 0.04), 900); },
    explosion() { if (ensure() && !muted) { noise(0.6, 0.6, 600); blip(50, 0.5, 'sine', 0.5); } },
    pickup() { if (ensure() && !muted) { blip(660, 0.1, 'square', 0.2); blip(990, 0.14, 'square', 0.2, ctx.currentTime + 0.09); } },
    missionDone() {
      if (!ensure() || muted) return;
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.25, ctx.currentTime + i * 0.12));
    },
    update(dt) {
      if (!started || muted) { radioTick(dt); return; }
      const s = SH.state, p = s.player;
      const driving = !p.onFoot && p.car;
      const spd = driving ? Math.abs(p.car.speed) : 0;
      engine.gain.gain.value = driving ? 0.10 + Math.min(0.12, spd * 0.004) : 0;
      engine.osc.frequency.value = 48 + spd * 5.2 + (driving && SH.input.forward() > 0 ? 14 : 0);
      engine.filter.frequency.value = 320 + spd * 26;
      // siren volume from nearest police unit
      let near = 999;
      for (const u of SH.police.units) near = Math.min(near, SH.U.dist(u.car.x, u.car.z, p.x, p.z));
      const sv = s.wanted > 0 && near < 120 ? Math.max(0, 0.16 * (1 - near / 120)) : 0;
      siren.gain.gain.value = sv;
      siren.t += dt;
      siren.osc.frequency.value = (Math.floor(siren.t / 0.45) % 2 === 0) ? 660 : 880;
      const hb = driving && SH.input.down('Space') && spd > 8;
      skid.gain.gain.value = hb ? 0.14 : 0;
      radioTick(dt);
    },
  };
})();
