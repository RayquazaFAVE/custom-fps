const test = require("node:test");
const assert = require("node:assert/strict");
const catalog = require("../weapons.js");

test("the arsenal has 6 classes: 5 primary + sidearm, 23 total weapons", () => {
  assert.equal(catalog.classes.length, 6);
  assert.equal(catalog.weapons.length, 23);
  const sidearms = catalog.weapons.filter(w => w.classId === "sidearm");
  assert.equal(sidearms.length, 6);
  const primaries = catalog.primaries();
  assert.equal(primaries.length, 17);
  const secondaries = catalog.secondaries();
  assert.equal(secondaries.length, 6);
});

test("all five ARs are present with correct stats", () => {
  const ars = catalog.coresInClass("ar");
  assert.equal(ars.length, 5);
  const ids = ars.map(w => w.id).sort();
  assert.deepEqual(ids, ["bulldog", "guardian", "phantom", "vandal", "warden"]);
  const vandal = catalog.getWeapon("vandal");
  assert.equal(vandal.base.damage, 40);
  assert.equal(vandal.base.headshot, 160);
  assert.equal(vandal.base.legs, 34);
  assert.equal(vandal.base.rate, 585);
  const phantom = catalog.getWeapon("phantom");
  assert.equal(phantom.base.damageDrop, true);
  assert.equal(phantom.base.rangeStart, 20);
  assert.equal(phantom.base.rangeEnd, 50);
  assert.equal(phantom.base.minHeadshot, 140);
  const warden = catalog.getWeapon("warden");
  assert.equal(warden.base.headshot, 200);
  assert.equal(warden.base.rate, 390);
  const guardian = catalog.getWeapon("guardian");
  assert.equal(guardian.fireMode, "semi");
  assert.equal(guardian.base.headshot, 195);
  const bulldog = catalog.getWeapon("bulldog");
  assert.equal(bulldog.base.adsFireMode, "burst");
  assert.equal(bulldog.base.adsRate, 379);
  assert.equal(bulldog.base.adsBurst, 3);
});

test("all six secondaries are present with correct costs and stats", () => {
  const secs = catalog.secondaries();
  const ids = secs.map(w => w.id).sort();
  assert.deepEqual(ids, ["bandit", "classic", "frenzy", "ghost", "sheriff", "shorty"]);

  const classic = catalog.getWeapon("classic");
  assert.equal(classic.cost, 0);
  assert.equal(classic.base.rate, 405);
  assert.equal(classic.base.headshot, 78);
  assert.equal(classic.base.altFireMode, "burst");
  assert.equal(classic.base.altFireBurst, 3);
  assert.equal(classic.base.altFirePellets, 3);

  const shorty = catalog.getWeapon("shorty");
  assert.equal(shorty.cost, 200);
  assert.equal(shorty.base.rate, 198);
  assert.equal(shorty.base.pellets, 15);
  assert.equal(shorty.base.headshot, 22);

  const frenzy = catalog.getWeapon("frenzy");
  assert.equal(frenzy.cost, 450);
  assert.equal(frenzy.fireMode, "auto");
  assert.equal(frenzy.base.rate, 600);
  assert.equal(frenzy.base.recoil, 2.20);

  const ghost = catalog.getWeapon("ghost");
  assert.equal(ghost.cost, 500);
  assert.equal(ghost.base.suppressed, true);
  assert.equal(ghost.base.rate, 405);
  assert.equal(ghost.base.headshot, 105);

  const bandit = catalog.getWeapon("bandit");
  assert.equal(bandit.cost, 600);
  assert.equal(bandit.base.rate, 306);
  assert.ok(Array.isArray(bandit.base.damageBrackets));
  assert.equal(bandit.base.damageBrackets.length, 3);
  assert.equal(bandit.base.damageBrackets[0].headshot, 150);
  assert.equal(bandit.base.damageBrackets[0].end, 10);

  const sheriff = catalog.getWeapon("sheriff");
  assert.equal(sheriff.cost, 800);
  assert.equal(sheriff.base.rate, 240);
  assert.equal(sheriff.base.oneTapHeadRange, 30);
  assert.equal(sheriff.base.headshot, 159);
});

test("speed multipliers by weapon class", () => {
  assert.equal(catalog.speedMultiplier("smg"), 0.85);
  assert.equal(catalog.speedMultiplier("ar"), 0.80);
  assert.equal(catalog.speedMultiplier("sniper"), 0.76);
  assert.equal(catalog.speedMultiplier("lmg"), 0.76);
  assert.equal(catalog.speedMultiplier("shotgun"), 0.74);
  assert.equal(catalog.speedMultiplier("sidearm"), 1.00);
});

test("default loadout returns vandal primary and classic secondary", () => {
  const loadout = catalog.defaultLoadout();
  assert.equal(loadout.core, "vandal");
  assert.equal(loadout.secondary, "classic");
});

test("normalizeLoadout preserves secondary and falls back to classic", () => {
  const result = catalog.normalizeLoadout({ core: "phantom", secondary: "sheriff" });
  assert.equal(result.core, "phantom");
  assert.equal(result.secondary, "sheriff");
  const bad = catalog.normalizeLoadout({ core: "vandal", secondary: "nonexistent" });
  assert.equal(bad.secondary, "classic");
});

test("matchWeapon passes through secondary-specific fields", () => {
  const ghost = catalog.getWeapon("ghost");
  const match = catalog.matchWeapon(ghost);
  assert.equal(match.suppressed, true);
  assert.equal(match.id, "ghost");

  const bandit = catalog.getWeapon("bandit");
  const banditMatch = catalog.matchWeapon(bandit);
  assert.ok(Array.isArray(banditMatch.damageBrackets));
  assert.equal(banditMatch.damageBrackets[0].headshot, 150);

  const classic = catalog.getWeapon("classic");
  const classicMatch = catalog.matchWeapon(classic);
  assert.equal(classicMatch.altFireMode, "burst");
  assert.equal(classicMatch.altFireBurst, 3);
});

test("calculateStats includes cost and fire mode", () => {
  const stats = catalog.calculateStats({ core: "sheriff" });
  assert.equal(stats.cost, 800);
  assert.equal(stats.fireMode, "semi");
  assert.equal(stats.automatic, false);
  const frenzyStats = catalog.calculateStats({ core: "frenzy" });
  assert.equal(frenzyStats.automatic, true);
});

test("all weapons have valid base stats and unique IDs", () => {
  const ids = new Set();
  for (const w of catalog.weapons) {
    assert.ok(w.id && !ids.has(w.id), "duplicate weapon id: " + w.id);
    ids.add(w.id);
    assert.ok(w.name && w.role && w.description);
    assert.ok(["auto", "semi", "pump", "bolt"].includes(w.fireMode));
    assert.ok(Number.isFinite(w.base.damage) && w.base.damage > 0);
    assert.ok(Number.isFinite(w.base.rate) && w.base.rate > 0);
    assert.ok(Number.isFinite(w.base.range) && w.base.range > 0);
    assert.ok(Number.isInteger(w.base.capacity) && w.base.capacity > 0);
    assert.ok(typeof w.cost === "number" && w.cost >= 0);
  }
});