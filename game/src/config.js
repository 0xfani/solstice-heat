// Solstice Heat — config.js: tuning constants, shared state, math + low-poly geometry helpers.
window.SH = window.SH || {};

SH.CONFIG = {
  block: 64,            // city block pitch (m)
  grid: 9,              // road lines per axis (0..8)
  roadW: 16,            // asphalt width
  laneOff: 4,           // lane centre offset from road centreline
  walkW: 4,             // sidewalk width
  oceanZ: 270,          // shoreline
  beachZ: 240,          // beach begins
  bound: 292,           // drivable world half-extent
  sunDir: [-0.55, 0.22, -0.35],
  clockStart: 18 * 60 + 42, // 18:42 golden hour
  trafficCount: 40,
  parkedCount: 18,
  pedCount: 70,
  maxWanted: 5,
  playerWalk: 4.2,
  playerRun: 7.6,
  carMaxSpeed: 31,      // m/s (~112 km/h)
  carAccel: 11,
  carBrake: 22,
  carDrag: 0.55,
  carSteer: 1.9,
  policeMaxSpeed: 27,
  districts: [
    { name: 'Costa Dorada', test: (x, z) => z > 150 },
    { name: 'Malecon Boulevard', test: (x, z) => z > 220 },
    { name: 'Deco Quarter', test: (x, z) => z > 60 && Math.abs(x) > 90 },
    { name: 'Meridian Downtown', test: (x, z) => Math.abs(x) <= 90 && Math.abs(z) <= 90 },
    { name: 'Harbor Side', test: (x, z) => x < -90 },
    { name: 'Solstice Hills', test: () => true },
  ],
};

// ---- math utils ----
SH.U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
  angleLerp(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
};

// ---- low-poly geometry helpers (vertex-coloured, merged to keep draw calls low) ----
SH.U.colorize = function (geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
};
SH.U.box = function (w, h, d, x, y, z, hex, ry) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return SH.U.colorize(g, hex);
};
SH.U.cyl = function (rt, rb, h, seg, x, y, z, hex, rx, rz) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg).toNonIndexed();
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return SH.U.colorize(g, hex);
};
SH.U.cone = function (r, h, seg, x, y, z, hex, rx, rz) {
  const g = new THREE.ConeGeometry(r, h, seg).toNonIndexed();
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return SH.U.colorize(g, hex);
};
SH.U.merge = function (geos) {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
};
SH.U.vmesh = function (geos, opts) {
  const m = new THREE.Mesh(SH.U.merge(geos), SH.MAT.vc);
  if (opts && opts.shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
  return m;
};

// shared materials (three.js is loaded before this file)
SH.MAT = {
  vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glass: new THREE.MeshLambertMaterial({ color: 0x1d2733, emissive: 0x0a1420 }),
  asphalt: null, road: null, sand: null, ocean: null,
};

// ---- shared runtime state (reset by main.js on new game) ----
SH.state = {
  mode: 'boot',            // boot | menu | play | pause | busted | wasted
  rng: SH.U.mulberry32(1),
  time: 0, clock: SH.CONFIG.clockStart, day: 'FRI',
  cash: 500, respect: 0, respectRank: 'NEW BLOOD',
  health: 100, lastHurt: -99,
  heat: 0, wanted: 0,
  freeze: false,           // shot modes freeze gameplay AI, cosmetics keep running
  shot: null,
  player: { x: 0, z: 236, heading: Math.PI, onFoot: true, car: null, speed: 0, walkPhase: 0, arrestT: 0 },
  camera: { yaw: Math.PI, pitch: 0.32 },
  weapons: [], weaponIndex: 0, reloading: 0, fireCooldown: 0,
  mission: null, missionIndex: 0, dialogue: null, dialogueQueue: [],
  radio: 0, radioTrack: 0,
  errors: [],
};

SH.respectRanks = ['NEW BLOOD', 'WHEELMAN', 'SHOT CALLER', 'STREET LEGEND', 'KING OF THE BAY'];
SH.radioStations = [
  { name: 'SOLSTICE FM 98.1', tracks: ['Golden Hour Mix', 'Neon Tide', 'Palma Sunset'] },
  { name: 'RADIO DORADA 103.5', tracks: ['Cumbia del Mar', 'Sol y Sal', 'La Bahia'] },
  { name: 'HEAT WAVE 91.7', tracks: ['Turbo Nights', 'Vela Roja', 'Midnight Run'] },
];
