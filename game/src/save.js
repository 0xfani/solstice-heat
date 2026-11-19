// Solstice Heat — save.js: localStorage progress (cash, respect, loadout, story position).
(function () {
  const KEY = 'solstice-heat-save-v1';
  const S = {};
  SH.save = S;

  S.write = function () {
    const s = SH.state;
    if (s.mode === 'menu' || s.mode === 'boot') return;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        cash: s.cash, respect: s.respect, health: s.health,
        weapons: s.weapons.map((w) => ({ ammo: w.ammo === Infinity ? -1 : w.ammo, reserve: w.reserve === Infinity ? -1 : w.reserve, unlocked: w.unlocked })),
        weaponIndex: s.weaponIndex,
        missionIndex: s.missionIndex, missionStarted: SH.missions.started,
        x: s.player.x, z: s.player.z, heading: s.player.heading,
        radio: s.radio, clock: s.clock, time: s.time,
      }));
    } catch (e) { /* private mode — ignore */ }
  };

  S.read = function () {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  S.apply = function (data) {
    const s = SH.state;
    s.cash = data.cash; s.respect = data.respect; s.health = data.health;
    data.weapons.forEach((w, i) => {
      if (!s.weapons[i]) return;
      s.weapons[i].ammo = w.ammo < 0 ? Infinity : w.ammo;
      s.weapons[i].reserve = w.reserve < 0 ? Infinity : w.reserve;
      s.weapons[i].unlocked = w.unlocked;
    });
    s.weaponIndex = data.weaponIndex;
    s.missionIndex = data.missionIndex;
    SH.missions.started = data.missionStarted;
    SH.missions.nextT = s.time + 1.5;
    s.radio = data.radio; s.clock = data.clock;
    SH.player.respawn({ x: data.x, z: data.z });
    s.player.heading = data.heading;
  };

  S.clear = function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };
  S.exists = function () { return !!S.read(); };
})();
