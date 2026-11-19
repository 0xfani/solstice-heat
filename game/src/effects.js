// Solstice Heat — effects.js: pooled spark/smoke particles, muzzle flashes, bullet tracers,
// skid marks and explosions — all generated, no external assets.
(function () {
  const U = SH.U;
  const E = {};
  SH.effects = E;
  const SPARKS = 500, SMOKES = 200, TRACERS = 28, SKIDS = 90, FLASHES = 6;
  let sparkPts, smokePts, sparkData, smokeData, tracerPool, skidPool, flashPool;

  function makePoints(n, size, blending, opacity) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, blending, depthWrite: false, sizeAttenuation: true });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    SH.scene.add(p);
    return p;
  }

  E.init = function () {
    sparkPts = makePoints(SPARKS, 0.32, THREE.AdditiveBlending, 1);
    smokePts = makePoints(SMOKES, 1.5, THREE.NormalBlending, 0.4);
    sparkData = Array.from({ length: SPARKS }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }));
    smokeData = Array.from({ length: SMOKES }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 }));
    tracerPool = [];
    const tg = new THREE.CylinderGeometry(0.06, 0.06, 1, 4);
    for (let i = 0; i < TRACERS; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; SH.scene.add(m);
      tracerPool.push({ mesh: m, life: 0 });
    }
    skidPool = [];
    const sg = new THREE.PlaneGeometry(0.32, 1.6);
    for (let i = 0; i < SKIDS; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x14161c, transparent: true, opacity: 0.5, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.visible = false; SH.scene.add(m);
      skidPool.push({ mesh: m, life: 0 });
    }
    flashPool = [];
    for (let i = 0; i < FLASHES; i++) {
      const l = new THREE.PointLight(0xffc46b, 0, 16, 2);
      SH.scene.add(l);
      flashPool.push({ light: l, life: 0 });
    }
    E.sparkCursor = 0; E.smokeCursor = 0; E.tracerCursor = 0; E.skidCursor = 0; E.flashCursor = 0;
    E.muzzlePool = [];
    const mcv = document.createElement('canvas'); mcv.width = mcv.height = 64;
    const mg = mcv.getContext('2d');
    const mgr = mg.createRadialGradient(32, 32, 2, 32, 32, 30);
    mgr.addColorStop(0, 'rgba(255,255,230,1)'); mgr.addColorStop(0.4, 'rgba(255,200,90,0.85)'); mgr.addColorStop(1, 'rgba(255,150,40,0)');
    mg.fillStyle = mgr; mg.fillRect(0, 0, 64, 64);
    const mtex = new THREE.CanvasTexture(mcv);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mtex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.set(1.7, 1.7, 1); sp.visible = false; SH.scene.add(sp);
      E.muzzlePool.push({ sprite: sp, life: 0 });
    }
    E.muzzleCursor = 0;
  };

  function spawnSpark(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = E.sparkCursor; E.sparkCursor = (E.sparkCursor + 1) % SPARKS;
    const d = sparkData[i];
    d.life = life; d.vx = vx; d.vy = vy; d.vz = vz; d.r = r; d.g = g; d.b = b;
    const pos = sparkPts.geometry.attributes.position;
    pos.setXYZ(i, x, y, z);
  }
  E.spark = function (x, y, z, n) {
    for (let k = 0; k < n; k++) {
      spawnSpark(x, y, z, (Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7, 0.3 + Math.random() * 0.25, 1, 0.75, 0.3);
    }
  };
  E.blood = function (x, y, z) {
    for (let k = 0; k < 8; k++) {
      spawnSpark(x, y, z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.4, 0.7, 0.08, 0.08);
    }
  };
  E.smoke = function (x, y, z) {
    const i = E.smokeCursor; E.smokeCursor = (E.smokeCursor + 1) % SMOKES;
    const d = smokeData[i];
    d.life = 1.4; d.vx = (Math.random() - 0.5) * 1.2; d.vy = 1.6 + Math.random(); d.vz = (Math.random() - 0.5) * 1.2;
    smokePts.geometry.attributes.position.setXYZ(i, x, y, z);
  };
  E.explosion = function (x, y, z) {
    for (let k = 0; k < 34; k++) {
      spawnSpark(x, y, z, (Math.random() - 0.5) * 14, Math.random() * 11, (Math.random() - 0.5) * 14, 0.5 + Math.random() * 0.4, 1, 0.5 + Math.random() * 0.4, 0.15);
    }
    for (let k = 0; k < 12; k++) E.smoke(x + (Math.random() - 0.5) * 2, y + 0.5, z + (Math.random() - 0.5) * 2);
    E.flash(x, y + 1, z, 5, 0.25);
  };
  E.flash = function (x, y, z, intensity, life) {
    const i = E.flashCursor; E.flashCursor = (E.flashCursor + 1) % FLASHES;
    const f = flashPool[i];
    f.light.position.set(x, y, z);
    f.light.intensity = intensity;
    f.life = life;
  };
  E.muzzle = function (x, y, z, melee) {
    E.flash(x, y, z, melee ? 1.2 : 3.2, 0.05);
    if (!melee) spawnSpark(x, y, z, 0, 0.5, 0, 0.06, 1, 0.9, 0.5);
    const mi = E.muzzleCursor; E.muzzleCursor = (E.muzzleCursor + 1) % 6;
    const ms = E.muzzlePool[mi];
    ms.sprite.position.set(x, y, z);
    ms.sprite.scale.set(melee ? 0.8 : 1.7, melee ? 0.8 : 1.7, 1);
    ms.sprite.visible = true;
    ms.life = 0.06;
  };
  E.tracer = function (x1, y1, z1, x2, y2, z2, color) {
    const i = E.tracerCursor; E.tracerCursor = (E.tracerCursor + 1) % TRACERS;
    const t = tracerPool[i];
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    t.mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    t.mesh.scale.set(1, len, 1);
    t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    t.mesh.material.color.setHex(color);
    t.mesh.visible = true;
    t.life = 0.07;
  };
  E.skid = function (x, z, heading) {
    for (const side of [-0.9, 0.9]) {
      const i = E.skidCursor; E.skidCursor = (E.skidCursor + 1) % SKIDS;
      const s = skidPool[i];
      s.mesh.position.set(x + Math.cos(heading) * side, 0.035, z - Math.sin(heading) * side);
      s.mesh.rotation.z = -heading;
      s.mesh.visible = true;
      s.mesh.material.opacity = 0.5;
      s.life = 6;
    }
  };

  E.update = function (dt) {
    const sp = sparkPts.geometry.attributes.position, sc = sparkPts.geometry.attributes.color;
    for (let i = 0; i < SPARKS; i++) {
      const d = sparkData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { sp.setY(i, -999); continue; }
      d.vy -= 14 * dt;
      sp.setXYZ(i, sp.getX(i) + d.vx * dt, Math.max(0.05, sp.getY(i) + d.vy * dt), sp.getZ(i) + d.vz * dt);
      const f = Math.min(1, d.life * 3);
      sc.setXYZ(i, d.r * f, d.g * f, d.b * f);
    }
    sp.needsUpdate = true; sc.needsUpdate = true;
    const mp = smokePts.geometry.attributes.position, mc = smokePts.geometry.attributes.color;
    for (let i = 0; i < SMOKES; i++) {
      const d = smokeData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { mp.setY(i, -999); continue; }
      mp.setXYZ(i, mp.getX(i) + d.vx * dt, mp.getY(i) + d.vy * dt, mp.getZ(i) + d.vz * dt);
      const f = 0.25 + d.life * 0.2;
      mc.setXYZ(i, f, f, f);
    }
    mp.needsUpdate = true; mc.needsUpdate = true;
    for (const t of tracerPool) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const s of skidPool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.min(0.5, s.life * 0.12);
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const f of flashPool) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.light.intensity *= Math.max(0, 1 - dt * 18);
      if (f.life <= 0) f.light.intensity = 0;
    }
    for (const m of E.muzzlePool) {
      if (m.life <= 0) continue;
      m.life -= dt;
      if (m.life <= 0) m.sprite.visible = false;
    }
  };
})();
