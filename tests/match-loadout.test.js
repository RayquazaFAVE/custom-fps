const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const catalog = require("../weapons.js");

const gameSource = fs.readFileSync(path.join(__dirname, "../game.js"), "utf8");
const gameHtml = fs.readFileSync(path.join(__dirname, "../game.html"), "utf8");

test("default loadout deploys Vandal primary and Classic secondary", () => {
  const loadout = catalog.normalizeLoadout(null);
  assert.equal(loadout.core, "vandal");
  assert.equal(loadout.secondary, "classic");
  const primary = catalog.matchWeapon(catalog.getWeapon(loadout.core));
  assert.equal(primary.name, "VANDAL");
  assert.equal(primary.mag, 25);
  assert.equal(primary.damage, 40);
  const secondary = catalog.matchWeapon(catalog.getWeapon(loadout.secondary));
  assert.equal(secondary.name, "CLASSIC");
  assert.equal(secondary.mag, 12);
  assert.equal(secondary.damage, 26);
});

test("match game.js snapshots both primary and secondary weapons", () => {
  assert.match(gameSource, /const matchPrimary=catalog\.getWeapon\(matchLoadout\.core\)/);
  assert.match(gameSource, /const matchSecondary=catalog\.getWeapon\(matchLoadout\.secondary\|\|"classic"\)/);
  assert.match(gameSource, /const activeWeapon=Object\.freeze\(catalog\.matchWeapon\(matchPrimary\)\)/);
  assert.match(gameSource, /const activeSecondary=Object\.freeze\(catalog\.matchWeapon\(matchSecondary\)\)/);
});

test("match code has weapon swap via Digit1/Digit2/Q and no runtime equip path", () => {
  assert.doesNotMatch(gameSource, /function (?:equipWeapon|equipClass|cycleWeapon|renderWeaponChoices)\b/);
  assert.match(gameSource, /e\.code==="Digit1"/);
  assert.match(gameSource, /e\.code==="Digit2"/);
  assert.match(gameSource, /e\.code==="KeyQ"/);
});

test("match HUD shows credits, primary/secondary, reload only", () => {
  assert.match(gameHtml, /id="credits"/);
  assert.match(gameHtml, /id="weapon-name"/);
  assert.match(gameHtml, /id="weapon-class"/);
  assert.match(gameHtml, /id="deployed-weapon"/);
  assert.match(gameHtml, /id="deployed-secondary"/);
  assert.match(gameHtml, /id="reload"/);
  assert.doesNotMatch(gameHtml, /part-barrel|part-stock|part-magazine|part-scope/);
});

test("movement speed is 6.75 base with class multipliers", () => {
  assert.match(gameSource, /const MOVE_SPEED=6\.75/);
  assert.match(gameSource, /catalog\.speedMultiplier\(getCurrentWeapon\(\)\.classId\)/);
  assert.match(gameSource, /adjustedSpeed=speed\*speedMult/);
});

test("ghost suppressor hides tracer lines", () => {
  assert.match(gameSource, /w\.suppressed ?\? "#11191e" : w\.color/);
});

test("classic alt-fire shotgun burst and shorty 15 pellets", () => {
  assert.match(gameSource, /function altFire\(\)/);
  assert.match(gameSource, /w\.altFireMode/);
  assert.match(gameSource, /w\.altFireBurst/);
  assert.match(fs.readFileSync(path.join(__dirname, "../weapons.js"), "utf8"), /altFirePellets/);
  const classic = catalog.getWeapon("classic");
  assert.equal(classic.base.altFirePellets, 3);
  const shorty = catalog.getWeapon("shorty");
  assert.equal(shorty.base.pellets, 15);
});

test("shop prices match spec", () => {
  assert.equal(catalog.getWeapon("classic").cost, 0);
  assert.equal(catalog.getWeapon("shorty").cost, 200);
  assert.equal(catalog.getWeapon("frenzy").cost, 450);
  assert.equal(catalog.getWeapon("ghost").cost, 500);
  assert.equal(catalog.getWeapon("bandit").cost, 600);
  assert.equal(catalog.getWeapon("sheriff").cost, 800);
});

test("damage brackets for Bandit work correctly", () => {
  const bandit = catalog.getWeapon("bandit");
  const brackets = bandit.base.damageBrackets;
  assert.equal(brackets[0].start, 0);
  assert.equal(brackets[0].end, 10);
  assert.equal(brackets[0].headshot, 150);
  assert.equal(brackets[1].start, 10);
  assert.equal(brackets[1].end, 30);
  assert.equal(brackets[1].headshot, 128);
  assert.equal(brackets[2].start, 30);
  assert.equal(brackets[2].end, 50);
  assert.equal(brackets[2].headshot, 112);
});

test("Phantom damage dropoff config", () => {
  const phantom = catalog.getWeapon("phantom");
  assert.equal(phantom.base.damageDrop, true);
  assert.equal(phantom.base.rangeStart, 20);
  assert.equal(phantom.base.rangeEnd, 50);
  assert.equal(phantom.base.minHeadshot, 140);
  assert.equal(phantom.base.minBody, 35);
  assert.equal(phantom.base.minLegs, 30);
});