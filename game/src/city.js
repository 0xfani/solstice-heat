// Solstice Heat — city.js: procedural Solstice Bay — roads, sidewalks, textured buildings,
// palms, street props, ocean + beach, golden-hour sky/lighting, colliders and minimap data.
(function () {
  const C = SH.CONFIG, U = SH.U;
  const line = (i) => (i - 4) * C.block;
  const half = (C.grid - 1) / 2;
  const city = {
    group: new THREE.Group(), colliders: [], roadLines: [], sidewalkRects: [],
    buildingRects: [], parkedSlots: [], landmarks: {}, palms: [], trafficLights: [],
    ocean: null, sun: null, sunTarget: new THREE.Object3D(),
  };
  SH.city = city;

  // ---- sky, fog, lights ----
  function skyTexture() {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5a3040'); gr.addColorStop(0.2, '#c06038');
    gr.addColorStop(0.45, '#f08030'); gr.addColorStop(0.7, '#ffa04a');
    gr.addColorStop(1, '#ffd98a');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(cv); return t;
  }
  function glowSprite(color, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color.replace('1)', '0.55)'));
    gr.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
  }

  // ---- facade textures (window grids, some lit for dusk) ----
  function facade(style) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
    const ev = document.createElement('canvas'); ev.width = 128; ev.height = 256;
    const g = cv.getContext('2d'), e = ev.getContext('2d');
    const base = { glass: '#274b5e', deco: '#e8b98a', concrete: '#8f8577', brick: '#9c6b52', teal: '#7fb2a8', pink: '#d99a9a' }[style];
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    e.fillStyle = '#000'; e.fillRect(0, 0, 128, 256);
    const rng = U.mulberry32(style.length * 977 + 13);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * 32 + 6, y = row * 32 + 7, w = style === 'glass' ? 24 : 18, h = 20;
        const lit = rng() < 0.28;
        g.fillStyle = lit ? '#ffcf7e' : (style === 'glass' ? '#16323f' : '#2a3440');
        g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, w, 4);
        if (lit) { e.fillStyle = '#ffb45e'; e.fillRect(x, y, w, h); }
      }
      if (style === 'deco') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, row * 32 + 29, 128, 3); }
    }
    if (style === 'deco') { g.fillStyle = 'rgba(120,70,40,0.35)'; for (let c = 0; c < 4; c++) g.fillRect(c * 32 + 2, 0, 3, 256); }
    const map = new THREE.CanvasTexture(cv), em = new THREE.CanvasTexture(ev);
    map.wrapS = map.wrapT = em.wrapS = em.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map, emissiveMap: em, emissive: 0xffc46b, emissiveIntensity: 0.85 });
  }

  // ---- road / ground textures ----
  function asphaltTex() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#2b2e36'; g.fillRect(0, 0, 128, 256);
    const rng = U.mulberry32(42);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rng() * 0.05})`; g.fillRect(rng() * 128, rng() * 256, 2, 2); }
    g.fillStyle = '#d8c566'; g.fillRect(62, 0, 4, 60); g.fillRect(62, 128, 4, 60); // dashed centre
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(4, 0, 3, 256); g.fillRect(121, 0, 3, 256);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  function buildSky(scene) {
    scene.background = skyTexture();
    scene.fog = new THREE.FogExp2(0xe0905a, 0.0018);
    const hemi = new THREE.HemisphereLight(0xffd9a8, 0x5a3a4a, 0.66); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffa855, 1.65);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.6;
    scene.add(sun); scene.add(sun.target);
    city.sun = sun;
    const glow = glowSprite('rgba(255,214,140,1)', 260);
    glow.position.set(C.sunDir[0] * 800, C.sunDir[1] * 800 + 40, C.sunDir[2] * 800);
    scene.add(glow);
  }

  function buildGround() {
    const base = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshLambertMaterial({ color: 0x23262e }));
    base.rotation.x = -Math.PI / 2; base.position.y = -0.05; base.receiveShadow = true;
    city.group.add(base);
    // beach + ocean
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(760, C.oceanZ - C.beachZ + 8), new THREE.MeshLambertMaterial({ color: 0xe6cd97 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, (C.beachZ + C.oceanZ + 8) / 2); sand.receiveShadow = true;
    city.group.add(sand);
    const og = new THREE.PlaneGeometry(760, 300, 48, 24);
    const ocean = new THREE.Mesh(og, new THREE.MeshPhongMaterial({ color: 0x1f7a8c, emissive: 0x08222e, specular: 0xffcf9e, shininess: 120, flatShading: true }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.35, C.oceanZ + 150);
    city.group.add(ocean); city.ocean = ocean;
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(760, 3.5), new THREE.MeshBasicMaterial({ color: 0xf6efe2, transparent: true, opacity: 0.55, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.03, C.oceanZ);
    city.group.add(foam);
    // pier
    const pier = U.vmesh([U.box(10, 1.2, 46, 192, 0.6, C.oceanZ + 18, 0x8a6a48),
      ...[0, 1, 2, 3].map((i) => U.cyl(0.4, 0.4, 4, 6, 188 + (i % 2) * 8, -1, C.oceanZ + 6 + i * 10, 0x6a4f34))]);
    city.group.add(pier);
  }

  function buildRoads() {
    const texV = asphaltTex(); texV.repeat.set(1, 24);
    const texH = asphaltTex(); texH.repeat.set(1, 24); texH.rotation = Math.PI / 2; texH.center.set(0.5, 0.5);
    const matV = new THREE.MeshLambertMaterial({ map: texV });
    const matH = new THREE.MeshLambertMaterial({ map: texH });
    const len = C.block * (C.grid - 1) + C.roadW;
    for (let i = 0; i < C.grid; i++) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(C.roadW, len), matV);
      v.rotation.x = -Math.PI / 2; v.position.set(line(i), 0.02, 0); v.receiveShadow = true;
      city.group.add(v);
      city.roadLines.push({ axis: 'x', at: line(i) });
      for (let j = 0; j < C.grid - 1; j++) {
        const segLen = C.block - C.roadW;
        const h = new THREE.Mesh(new THREE.PlaneGeometry(segLen, C.roadW), matH);
        h.rotation.x = -Math.PI / 2; h.position.set(line(j) + C.block / 2, 0.02, line(i)); h.receiveShadow = true;
        city.group.add(h);
      }
      city.roadLines.push({ axis: 'z', at: line(i) });
    }
    // crosswalks at every intersection
    const cw = [];
    for (let i = 0; i < C.grid; i++) for (let j = 0; j < C.grid; j++) {
      for (let s = -3; s <= 3; s++) {
        cw.push(U.box(1.1, 0.02, 3.4, line(i) + s * 2, 0.035, line(j) + C.roadW / 2 - 1.9, 0xcfc8ba));
        cw.push(U.box(1.1, 0.02, 3.4, line(i) + s * 2, 0.035, line(j) - C.roadW / 2 + 1.9, 0xcfc8ba));
      }
    }
    const cwm = U.vmesh(cw, { shadow: false }); cwm.receiveShadow = true; city.group.add(cwm);
  }

  function buildSidewalks() {
    const geos = [];
    const inner = C.block - C.roadW;
    for (let i = 0; i < C.grid - 1; i++) for (let j = 0; j < C.grid - 1; j++) {
      const cx = line(i) + C.block / 2, cz = line(j) + C.block / 2;
      const h = inner / 2;
      geos.push(U.box(inner, 0.18, C.walkW, cx, 0.09, cz - h + C.walkW / 2, 0x9a958c));
      geos.push(U.box(inner, 0.18, C.walkW, cx, 0.09, cz + h - C.walkW / 2, 0x9a958c));
      geos.push(U.box(C.walkW, 0.18, inner - C.walkW * 2, cx - h + C.walkW / 2, 0.09, cz, 0x9a958c));
      geos.push(U.box(C.walkW, 0.18, inner - C.walkW * 2, cx + h - C.walkW / 2, 0.09, cz, 0x9a958c));
      city.sidewalkRects.push({ cx, cz, half: h - C.walkW / 2 });
      city.buildingRects.push({ cx, cz, h });
    }
    const sw = U.vmesh(geos, { shadow: false }); sw.receiveShadow = true; city.group.add(sw);
  }

  const facadeMats = {};
  const roofGeos = [];
  function building(x, z, w, d, hgt, style) {
    if (!facadeMats[style]) facadeMats[style] = facade(style);
    const roof = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    const geo = new THREE.BoxGeometry(w, hgt, d);
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      if (f === 2 || f === 3) continue;
      const span = (f < 2 ? d : w) / 16;
      for (let v = 0; v < 4; v++) {
        const idx = f * 4 + v;
        uv.setXY(idx, uv.getX(idx) * span, uv.getY(idx) * (hgt / 24));
      }
    }
    const m = new THREE.Mesh(geo, [facadeMats[style], facadeMats[style], roof, roof, facadeMats[style], facadeMats[style]]);
    m.position.set(x, hgt / 2 + 0.18, z);
    m.castShadow = true; m.receiveShadow = true;
    city.group.add(m);
    city.colliders.push({ x, z, hw: w / 2, hd: d / 2 });
    const ty = hgt + 0.18;
    roofGeos.push(U.box(w + 0.5, 0.5, d + 0.5, x, ty + 0.25, z, 0x4a4f5a));
    roofGeos.push(U.box(2, 1, 2, x + w * 0.2, ty + 0.9, z - d * 0.2, 0x6a707c));
    if (hgt > 30) roofGeos.push(U.cyl(1.2, 1.2, 2.4, 8, x - w * 0.22, ty + 1.6, z + d * 0.18, 0x8a6a48));
    return m;
  }

  function buildBuildings(rng) {
    const styles = ['concrete', 'brick', 'teal', 'glass', 'pink'];
    for (let i = 0; i < C.grid - 1; i++) for (let j = 0; j < C.grid - 1; j++) {
      const cx = line(i) + C.block / 2, cz = line(j) + C.block / 2;
      if (Math.abs(cx) < 40 && Math.abs(cz) < 40) continue; // casino plaza block
      if (Math.abs(cx) < 40 && cz > 90 && cz < 170) continue; // central plaza
      const lot = (C.block - C.roadW) / 2 - C.walkW - 1;
      const downtown = Math.abs(cx) <= 96 && Math.abs(cz) <= 96;
      const deco = cz > 120;
      if (downtown) {
        const n = rng() < 0.5 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const w = 16 + rng() * 12, d = 16 + rng() * 12;
          const hgt = 42 + rng() * 52;
          const ox = n === 1 ? 0 : (k === 0 ? -lot / 2 : lot / 2);
          building(cx + ox, cz + (rng() - 0.5) * 6, w, d, hgt, rng() < 0.6 ? 'glass' : 'concrete');
        }
      } else if (deco) {
        const n = 2 + Math.floor(rng() * 2);
        for (let k = 0; k < n; k++) {
          const w = 10 + rng() * 9, d = 10 + rng() * 9;
          const hgt = 8 + rng() * 14;
          const ox = (k - (n - 1) / 2) * (lot * 0.9);
          building(cx + U.clamp(ox, -lot + w / 2, lot - w / 2), cz + (rng() - 0.5) * 8, w, d, hgt, U.pick(rng, ['deco', 'pink', 'teal']));
        }
      } else {
        const n = 2 + Math.floor(rng() * 2);
        for (let k = 0; k < n; k++) {
          const w = 11 + rng() * 10, d = 11 + rng() * 10;
          const hgt = 12 + rng() * 24;
          const ox = (rng() - 0.5) * (lot * 2 - w), oz = (rng() - 0.5) * (lot * 2 - d);
          building(cx + U.clamp(ox, -lot + w / 2, lot - w / 2), cz + U.clamp(oz, -lot + d / 2, lot - d / 2), w, d, hgt, U.pick(rng, styles));
        }
      }
    }
    // Meridian Casino tower on the reserved downtown block
    building(0, 0, 26, 26, 78, 'glass');
    city.landmarks.casino = { x: 0, z: 20 };
    if (roofGeos.length) city.group.add(U.vmesh(roofGeos));
  }

  function palm(x, z, rng) {
    const h = 6 + rng() * 3, lean = (rng() - 0.5) * 0.8;
    const trunk = U.vmesh([
      U.cyl(0.22, 0.34, h * 0.6, 5, 0, h * 0.3, 0, 0x7a5a3a),
      U.cyl(0.18, 0.24, h * 0.45, 5, lean * 0.5, h * 0.72, 0, 0x8a6a44, 0, lean * 0.12),
    ]);
    const fronds = [];
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2 + rng();
      const g = new THREE.ConeGeometry(0.55, 3.4, 4).toNonIndexed();
      g.rotateX(Math.PI / 2 + 0.5);
      g.rotateY(a);
      g.translate(Math.cos(a) * 1.3 + lean * 0.5, h * 0.94, Math.sin(a) * 1.3);
      fronds.push(U.colorize(g, f % 2 ? 0x3f7d3a : 0x4c8f3f));
    }
    const crown = U.vmesh(fronds);
    const grp = new THREE.Group();
    grp.add(trunk); grp.add(crown);
    grp.position.set(x, 0.18, z);
    city.group.add(grp);
    city.palms.push({ crown, phase: rng() * 6.28 });
    city.colliders.push({ x, z, hw: 0.5, hd: 0.5 });
  }

  function buildPalms(rng) {
    for (let x = -250; x <= 250; x += 17) {
      palm(x, C.oceanZ - C.roadW / 2 - 3 + (rng() - 0.5), rng);
      if (rng() < 0.6) palm(x + 8, C.beachZ + 6 + rng() * 14, rng);
    }
    for (let i = 0; i < 26; i++) {
      const r = U.pick(rng, city.sidewalkRects);
      palm(r.cx + (rng() - 0.5) * r.half * 1.6, r.cz + r.half - 1.2, rng);
    }
  }

  function buildProps(rng) {
    const poles = [], heads = [];
    for (let i = 0; i < C.grid; i++) {
      for (let z = -240; z <= 240; z += 34) {
        const x = line(i) + C.roadW / 2 + 1.2;
        poles.push(U.cyl(0.12, 0.16, 7, 5, x, 3.5, z, 0x3c4048));
        poles.push(U.box(2.2, 0.12, 0.12, x - 1.1, 7, z, 0x3c4048));
        heads.push(U.box(0.7, 0.2, 0.35, x - 2.1, 6.9, z, 0xffe0a8));
      }
    }
    city.group.add(U.vmesh(poles));
    const hm = new THREE.Mesh(U.merge(heads), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffc46b, emissiveIntensity: 1.4 }));
    city.group.add(hm);
    // traffic lights at alternate intersections (synced cycle)
    const red = [], green = [], bodies = [];
    for (let i = 0; i < C.grid; i += 2) for (let j = 0; j < C.grid; j += 2) {
      const x = line(i) + C.roadW / 2 + 0.8, z = line(j) + C.roadW / 2 + 0.8;
      bodies.push(U.cyl(0.1, 0.13, 5.4, 5, x, 2.7, z, 0x2c2f36));
      bodies.push(U.box(0.5, 1.3, 0.4, x, 5.6, z, 0x1c1f26));
      red.push(U.box(0.28, 0.28, 0.1, x, 6.0, z + 0.22, 0xff4444));
      green.push(U.box(0.28, 0.28, 0.1, x, 5.2, z + 0.22, 0x44ff77));
    }
    city.group.add(U.vmesh(bodies));
    city.lightMats = {
      red: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xff2222, emissiveIntensity: 1.6 }),
      green: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x22ff66, emissiveIntensity: 0.15 }),
    };
    city.group.add(new THREE.Mesh(U.merge(red), city.lightMats.red));
    city.group.add(new THREE.Mesh(U.merge(green), city.lightMats.green));
    // billboards with original Solstice Bay ads
    const ads = [
      ['SOLSTICE BAY', 'FEEL THE HEAT', '#ff9e3d', '#2a2140'],
      ['CERVEZA DORADA', 'LA CERVEZA DEL SOL', '#ffd23d', '#7a2f1f'],
      ['MERIDIAN CASINO', 'LUCK NEVER SETS', '#35d0ba', '#14202e'],
      ["RAFA'S AUTO BODY", 'WE FIX WHAT YOU BREAK', '#f4efe6', '#3a3f4a'],
    ];
    ads.forEach((a, k) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
      const g = cv.getContext('2d');
      g.fillStyle = a[3]; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = a[2]; g.lineWidth = 10; g.strokeRect(12, 12, 488, 232);
      g.fillStyle = a[2]; g.font = 'bold 58px Arial'; g.textAlign = 'center';
      g.fillText(a[0], 256, 110);
      g.font = '30px Arial'; g.fillStyle = '#f4efe6'; g.fillText(a[1], 256, 170);
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv), emissive: 0xffffff, emissiveMap: new THREE.CanvasTexture(cv), emissiveIntensity: 0.35 });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat);
      const spots = [[-128, 20, 100], [96, 26, -64], [32, 82, 16], [-200, 16, 200]];
      board.position.set(spots[k][0], spots[k][1], spots[k][2]);
      board.rotation.y = k % 2 ? Math.PI / 2 : 0;
      city.group.add(board);
      const frame = U.vmesh([U.box(14.6, 0.4, 0.4, spots[k][0], spots[k][1] - 3.7, spots[k][2], 0x2c2f36),
        U.cyl(0.3, 0.3, spots[k][1] - 3.7, 6, spots[k][0] - 6, (spots[k][1] - 3.7) / 2, spots[k][2], 0x2c2f36),
        U.cyl(0.3, 0.3, spots[k][1] - 3.7, 6, spots[k][0] + 6, (spots[k][1] - 3.7) / 2, spots[k][2], 0x2c2f36)]);
      city.group.add(frame);
    });
    // parked-car slots along road edges
    const street = [];
    for (let i = 0; i < C.grid; i++) for (let z = -220; z <= 220; z += 64) {
      const x = line(i) + C.roadW / 2 + 2.6;
      street.push(U.box(1.8, 0.4, 0.6, x, 0.55, z, 0x6a4f34));
      street.push(U.box(1.8, 0.5, 0.12, x, 0.9, z - 0.28, 0x6a4f34));
      street.push(U.cyl(0.22, 0.26, 0.7, 6, x, 0.5, z + 16, 0xc0392b));
    }
    city.group.add(U.vmesh(street));
    for (let i = 0; i < C.grid; i++) {
      for (let k = 0; k < 3; k++) {
        const z = -200 + k * 150 + (i % 3) * 24;
        city.parkedSlots.push({ x: line(i) + C.roadW / 2 - 1.7, z, heading: 0 });
        city.parkedSlots.push({ x: line(i) - C.roadW / 2 + 1.7, z: z + 40, heading: Math.PI });
      }
    }
    // landmarks for the story
    Object.assign(city.landmarks, {
      tereGarage: { x: -160, z: 150 }, bank: { x: 34, z: -40 }, pier: { x: 192, z: 258 },
      safehouse: { x: -226, z: 96 }, depot: { x: 226, z: -160 }, courthouse: { x: 4, z: -196 },
      plaza: { x: 0, z: 128 }, beach: { x: -40, z: 250 }, start: { x: -20, z: 236 },
    });
    // plaza fountain
    city.group.add(U.vmesh([U.cyl(6, 6.5, 1, 12, 0, 0.5, 128, 0x9a958c), U.cyl(1, 1.4, 3, 8, 0, 2, 128, 0x7fb2a8)]));
  }

  city.build = function (scene, rng) {
    buildSky(scene);
    buildGround();
    buildRoads();
    buildSidewalks();
    buildBuildings(rng);
    buildPalms(rng);
    buildProps(rng);
    scene.add(city.group);
  };

  city.isRoad = function (x, z) {
    for (const l of city.roadLines) {
      if (l.axis === 'x' && Math.abs(x - l.at) < C.roadW / 2) return true;
      if (l.axis === 'z' && Math.abs(z - l.at) < C.roadW / 2) return true;
    }
    return false;
  };
  city.district = function (x, z) {
    for (const d of C.districts) if (d.test(x, z)) return d.name;
    return 'Solstice Bay';
  };
  city.collide = function (x, z, r) {
    for (const c of city.colliders) {
      const nx = U.clamp(x, c.x - c.hw, c.x + c.hw);
      const nz = U.clamp(z, c.z - c.hd, c.z + c.hd);
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return { nx, nz, dx, dz, c };
    }
    return null;
  };
  city.update = function (dt, t, focusX, focusZ) {
    // ocean swell
    const pos = city.ocean.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.06 + t * 1.1) * 0.5 + Math.cos(y * 0.09 + t * 0.8) * 0.35);
    }
    pos.needsUpdate = true;
    city.ocean.geometry.computeVertexNormals();
    for (const p of city.palms) p.crown.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.045;
    const green = Math.floor(t / 8) % 2 === 0;
    city.lightMats.red.emissiveIntensity = green ? 0.15 : 1.6;
    city.lightMats.green.emissiveIntensity = green ? 1.6 : 0.15;
    // shadow frustum follows the action
    city.sun.position.set(focusX + C.sunDir[0] * 260, C.sunDir[1] * 260 + 60, focusZ + C.sunDir[2] * 260);
    city.sun.target.position.set(focusX, 0, focusZ);
  };
})();
