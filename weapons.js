/* Shared by the loadout builder, the match, and the catalog tests.
 * Rates are rounds per minute; reload is seconds (per shell for shotguns).
 * These are arcade balance values, not real-world ballistic simulations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CustomFPSWeapons = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const classes = [
    { id: "ar", slot: 0, key: "1", name: "ASSAULT RIFLE", shortName: "AR", color: "#b7f34a", silhouette: "ar-silhouette", defaultCore: "vandal" },
    { id: "smg", slot: 1, key: "2", name: "SUBMACHINE GUN", shortName: "SMG", color: "#63d7ff", silhouette: "smg-silhouette", defaultCore: "viper" },
    { id: "shotgun", slot: 2, key: "3", name: "SHOTGUN", shortName: "SG", color: "#ffbd59", silhouette: "shotgun-silhouette", defaultCore: "breacher" },
    { id: "sniper", slot: 3, key: "4", name: "SNIPER RIFLE", shortName: "SR", color: "#ff78a8", silhouette: "sniper-silhouette", defaultCore: "scope" },
    { id: "lmg", slot: 4, key: "5", name: "LIGHT MACHINE GUN", shortName: "LMG", color: "#c7a5ff", silhouette: "lmg-silhouette", defaultCore: "bastion" },
    { id: "sidearm", slot: 5, key: "6", name: "SIDEARM", shortName: "PISTOL", color: "#ffd166", silhouette: "sidearm-silhouette", defaultCore: "classic" }
  ];

  const weapons = [
    // --- Primaries: Assault Rifles ---
    { id: "vandal", name: "VANDAL", classId: "ar", model: "vandal", fireMode: "auto", cost: 0, role: "Precise · No damage dropoff", description: "Rifle with consistent head, body, and leg damage at any distance.", base: { damage: 40, rate: 585, recoil: 1.40, reload: 2.50, range: 100, capacity: 25, spread: .014, pellets: 1, headshot: 160, legs: 34 } },
    { id: "phantom", name: "PHANTOM", classId: "ar", model: "phantom", fireMode: "auto", cost: 0, role: "Fast fire · Damage falls off at range", description: "Quick close-range rifle. Damage drops between 20 and 50 meters to reduced head/body/leg values.", base: { damage: 39, rate: 660, recoil: 1.10, reload: 2.25, range: 50, capacity: 30, spread: .016, pellets: 1, headshot: 156, legs: 33, damageDrop: true, rangeStart: 20, rangeEnd: 50, minHeadshot: 140, minBody: 35, minLegs: 30 } },
    { id: "warden", name: "WARDEN", classId: "ar", model: "warden", fireMode: "auto", cost: 0, role: "Heavy hits · No damage dropoff", description: "Slow automatic rifle with the highest body damage and no damage dropoff.", base: { damage: 50, rate: 390, recoil: 2.10, reload: 2.80, range: 100, capacity: 20, spread: .018, pellets: 1, headshot: 200, legs: 42 } },
    { id: "guardian", name: "GUARDIAN", classId: "ar", model: "guardian", fireMode: "semi", cost: 0, role: "Lethal headshots · Semi-auto", description: "Semi-auto rifle with high headshot damage and consistent range performance.", base: { damage: 65, rate: 324, recoil: 1.20, reload: 2.60, range: 100, capacity: 12, spread: .010, pellets: 1, headshot: 195, legs: 49 } },
    { id: "bulldog", name: "BULLDOG", classId: "ar", model: "bulldog", fireMode: "auto", cost: 0, role: "Dual fire modes · Burst when aimed", description: "Automatic rifle at hip; aiming down sights engages a semi-auto 3-round burst at 379 RPM.", base: { damage: 35, rate: 600, recoil: 1.30, reload: 2.40, range: 75, capacity: 24, spread: .015, pellets: 1, headshot: 116, legs: 30, adsFireMode: "burst", adsRate: 379, adsBurst: 3 } },

    // --- Primaries: SMGs ---
    { id: "viper", name: "MP5", classId: "smg", model: "mp5", fireMode: "auto", cost: 0, role: "Balanced · Close-range", description: "A flexible close-range core with a manageable rate of fire.", base: { damage: 20, rate: 800, recoil: 1.45, reload: 2.0, range: 38, capacity: 30, spread: .025, pellets: 1 } },
    { id: "ump45", name: "UMP45", classId: "smg", model: "ump45", fireMode: "auto", cost: 0, role: "Heavy hits · Slow fire", description: "Trades fire rate and magazine size for more damage and a little more range.", base: { damage: 28, rate: 600, recoil: 1.65, reload: 2.25, range: 42, capacity: 25, spread: .022, pellets: 1 } },
    { id: "vector", name: "KRISS VECTOR", classId: "smg", model: "vector", fireMode: "auto", cost: 0, role: "Low recoil · Rapid fire", description: "Very fast follow-up shots and light recoil, but less damage per bullet.", base: { damage: 16, rate: 1100, recoil: 1.10, reload: 1.8, range: 32, capacity: 33, spread: .028, pellets: 1 } },

    // --- Primaries: Shotguns ---
    { id: "breacher", name: "REMINGTON 870", classId: "shotgun", model: "remington870", fireMode: "pump", cost: 0, role: "Pump-action · Close-range", description: "A dependable pump-action baseline. Reloads one shell at a time.", base: { damage: 12, rate: 75, recoil: 3.1, reload: .55, range: 20, capacity: 7, spread: .09, pellets: 6 } },
    { id: "mossberg590", name: "MOSSBERG 590", classId: "shotgun", model: "mossberg590", fireMode: "pump", cost: 0, role: "Hard-hitting · Slow pump", description: "More damage per shell and a larger tube, with a slower pump and reload.", base: { damage: 15, rate: 60, recoil: 3.5, reload: .65, range: 22, capacity: 8, spread: .10, pellets: 6 } },
    { id: "benellim4", name: "BENELLI M4", classId: "shotgun", model: "benellim4", fireMode: "semi", cost: 0, role: "Semi-auto · Fast follow-up", description: "Less damage per shell, but much faster follow-up shots. Click for each shot.", base: { damage: 10, rate: 180, recoil: 2.6, reload: .45, range: 24, capacity: 7, spread: .075, pellets: 6 } },

    // --- Primaries: Snipers ---
    { id: "scope", name: "ARCTIC WARFARE", classId: "sniper", model: "aw", fireMode: "bolt", cost: 0, role: "One-shot power · Bolt-action", description: "The original precision baseline: 100 base damage against 100-health drones.", base: { damage: 100, rate: 40, recoil: 3.4, reload: 2.8, range: 150, capacity: 5, spread: .001, pellets: 1 } },
    { id: "barrettm82", name: "BARRETT M82", classId: "sniper", model: "m82", fireMode: "semi", cost: 0, role: "Maximum damage · Very slow fire", description: "150 base damage and the longest reach. Slow follow-up shots, heavy recoil, and a long reload punish misses.", base: { damage: 150, rate: 30, recoil: 4.5, reload: 3.6, range: 180, capacity: 10, spread: .0008, pellets: 1 } },
    { id: "svd", name: "SVD DRAGUNOV", classId: "sniper", model: "svd", fireMode: "semi", cost: 0, role: "Okay damage · Decent fire rate", description: "75 base damage needs two body hits on a fresh drone, but faster shots and lighter recoil make it more forgiving.", base: { damage: 75, rate: 100, recoil: 2.6, reload: 2.4, range: 125, capacity: 10, spread: .002, pellets: 1 } },

    // --- Primaries: LMGs ---
    { id: "bastion", name: "M249 SAW", classId: "lmg", model: "m249", fireMode: "auto", cost: 0, role: "Sustained fire · Heavy", description: "A 100-round box built for sustained fire, with a lengthy reload.", base: { damage: 24, rate: 750, recoil: 2.35, reload: 4.5, range: 85, capacity: 100, spread: .02, pellets: 1 } },
    { id: "pkm", name: "PKM", classId: "lmg", model: "pkm", fireMode: "auto", cost: 0, role: "High damage · Slow fire", description: "Hard-hitting sustained fire with more recoil and the slowest reload in its class.", base: { damage: 34, rate: 600, recoil: 2.9, reload: 5.2, range: 95, capacity: 100, spread: .026, pellets: 1 } },
    { id: "rpk", name: "RPK", classId: "lmg", model: "rpk", fireMode: "auto", cost: 0, role: "Lighter recoil · Faster reload", description: "A smaller magazine and lower damage, offset by faster handling and recoil control.", base: { damage: 27, rate: 800, recoil: 1.95, reload: 3.6, range: 88, capacity: 75, spread: .018, pellets: 1 } },

    // --- Secondaries: Sidearms ---
    { id: "classic", name: "CLASSIC", classId: "sidearm", model: "classic", fireMode: "semi", cost: 0, role: "Free sidearm · Shotgun burst alt-fire", description: "Standard issue pistol. Right-click fires a 3-round shotgun burst.", base: { damage: 26, rate: 405, recoil: 1.10, reload: 2.0, range: 50, capacity: 12, spread: .018, pellets: 1, headshot: 78, legs: 22, damageDrop: true, rangeStart: 30, rangeEnd: 50, minHeadshot: 66, minBody: 22, minLegs: 18, altFireMode: "burst", altFirePellets: 3, altFireBurst: 3 } },
    { id: "shorty", name: "SHORTY", classId: "sidearm", model: "shorty", fireMode: "pump", cost: 200, role: "Double-barrel · 15 pellets", description: "Sawed-off double-barrel shotgun. Devastating at point-blank range.", base: { damage: 11, rate: 198, recoil: 3.5, reload: 2.0, range: 15, capacity: 2, spread: .15, pellets: 15, headshot: 22, legs: 9, damageDrop: true, rangeStart: 7, rangeEnd: 15, minHeadshot: 12, minBody: 6, minLegs: 5 } },
    { id: "frenzy", name: "FRENZY", classId: "sidearm", model: "frenzy", fireMode: "auto", cost: 450, role: "Full auto · High recoil", description: "Fully automatic machine pistol with high recoil.", base: { damage: 26, rate: 600, recoil: 2.20, reload: 2.0, range: 50, capacity: 13, spread: .025, pellets: 1, headshot: 78, legs: 22, damageDrop: true, rangeStart: 20, rangeEnd: 50, minHeadshot: 63, minBody: 21, minLegs: 17 } },
    { id: "ghost", name: "GHOST", classId: "sidearm", model: "ghost", fireMode: "semi", cost: 500, role: "Suppressed · No tracer", description: "Suppressed barrel; hides bullet tracer lines.", base: { damage: 33, rate: 405, recoil: 1.00, reload: 2.0, range: 50, capacity: 15, spread: .012, pellets: 1, headshot: 105, legs: 26, damageDrop: true, rangeStart: 30, rangeEnd: 50, minHeadshot: 88, minBody: 28, minLegs: 23, suppressed: true } },
    { id: "bandit", name: "BANDIT", classId: "sidearm", model: "bandit", fireMode: "semi", cost: 600, role: "1-tap headshot · Wall penetration", description: "1-tap headshot within 10m. Medium wall penetration.", base: { damage: 38, rate: 306, recoil: 1.80, reload: 2.5, range: 50, capacity: 6, spread: .010, pellets: 1, headshot: 150, legs: 32, damageBrackets: [ { start: 0, end: 10, headshot: 150, body: 38, legs: 32 }, { start: 10, end: 30, headshot: 128, body: 32, legs: 28 }, { start: 30, end: 50, headshot: 112, body: 28, legs: 23 } ] } },
    { id: "sheriff", name: "SHERIFF", classId: "sidearm", model: "sheriff", fireMode: "semi", cost: 800, role: "1-tap headshot · High wall penetration", description: "1-tap headshot up to 30m. High wall penetration.", base: { damage: 55, rate: 240, recoil: 2.50, reload: 3.0, range: 50, capacity: 6, spread: .008, pellets: 1, headshot: 159, legs: 46, damageDrop: true, rangeStart: 30, rangeEnd: 50, minHeadshot: 145, minBody: 50, minLegs: 42, oneTapHeadRange: 30 } }
  ];

  const weaponById = Object.fromEntries(weapons.map(core => [core.id, core]));
  const has = (object, key) => typeof key === "string" && Object.hasOwn(object, key);
  const getWeapon = id => has(weaponById, id) ? weaponById[id] : null;
  const getClass = id => classes.find(group => group.id === id) || null;
  const coresInClass = id => weapons.filter(core => core.classId === id);
  const primaries = () => weapons.filter(core => core.classId !== "sidearm");
  const secondaries = () => weapons.filter(core => core.classId === "sidearm");

  function defaultLoadout(coreId = "vandal") {
    const core = getWeapon(coreId) || weaponById.vandal;
    return { core: core.id, secondary: "classic" };
  }

  function normalizeLoadout(value) {
    const input = value && typeof value === "object" ? (value.loadout || value) : {};
    const result = defaultLoadout(input.core);
    if (has(input, "secondary") && getWeapon(input.secondary) && getWeapon(input.secondary).classId === "sidearm") {
      result.secondary = input.secondary;
    }
    return result;
  }

  function calculateStats(loadout) {
    const normalized = normalizeLoadout(loadout);
    const core = getWeapon(normalized.core);
    const result = { ...core.base };
    result.fireMode = core.fireMode;
    result.automatic = core.fireMode === "auto";
    result.cost = core.cost;
    return result;
  }

  function matchWeapon(core, stats = calculateStats({ core: core.id })) {
    return {
      id: core.id, name: core.name, classId: core.classId, model: core.model,
      color: getClass(core.classId).color, fireMode: core.fireMode,
      damage: stats.damage, rate: 60 / stats.rate, recoil: stats.recoil / 100,
      spread: stats.spread, mag: stats.capacity, range: stats.range,
      reload: stats.reload, pellets: stats.pellets, zoom: 1,
      automatic: stats.automatic,
      headshot: stats.headshot, legs: stats.legs,
      damageDrop: stats.damageDrop, rangeStart: stats.rangeStart, rangeEnd: stats.rangeEnd,
      minHeadshot: stats.minHeadshot, minBody: stats.minBody, minLegs: stats.minLegs,
      damageBrackets: stats.damageBrackets,
      adsFireMode: stats.adsFireMode, adsRate: stats.adsRate, adsBurst: stats.adsBurst,
      altFireMode: stats.altFireMode, altFirePellets: stats.altFirePellets, altFireBurst: stats.altFireBurst,
      suppressed: stats.suppressed, oneTapHeadRange: stats.oneTapHeadRange,
      cost: stats.cost
    };
  }

  function speedMultiplier(classId) {
    switch (classId) {
      case "smg": return 0.85;
      case "ar": return 0.80;
      case "sniper": return 0.76;
      case "lmg": return 0.76;
      case "shotgun": return 0.74;
      case "sidearm": return 1.00;
      default: return 1.00;
    }
  }

  return { classes, weapons, getWeapon, getClass, coresInClass, primaries, secondaries, defaultLoadout, normalizeLoadout, calculateStats, matchWeapon, speedMultiplier };
});