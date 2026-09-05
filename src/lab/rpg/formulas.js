// @ts-nocheck
/**
 * Combat math for the grove RPG layer.
 *
 * Official Warlords attributes (ObjectStore master-attributes.json):
 * STR VIT END INT WIS DEX AGI TAC. Old grove keys still fold in via STAT_ALIAS
 * so gear and class variants authored as might/swift keep working.
 *
 * VFX knobs in `settings.js` stay authored. Nothing here writes back into them.
 */

import { sameWeaponFamily } from './weapons.js';
import { deriveStats } from './grudgeMath.js';

export { deriveStats };

export const STAT_KEYS = [
  'strength',
  'vitality',
  'endurance',
  'intellect',
  'wisdom',
  'dexterity',
  'agility',
  'tactics'
];

/** Grove 5-stat names → official 8. */
export const STAT_ALIAS = {
  might: 'strength',
  swift: 'agility',
  mind: 'intellect',
  vital: 'vitality',
  spirit: 'wisdom',
  str: 'strength',
  vit: 'vitality',
  end: 'endurance',
  int: 'intellect',
  wis: 'wisdom',
  dex: 'dexterity',
  agi: 'agility',
  tac: 'tactics'
};

export const GEAR_SLOTS = [
  'weapon',
  'offhand',
  'helm',
  'shoulders',
  'chest',
  'hands',
  'legs',
  'feet',
  'back',
  'relic'
];

/** Off-hand / off-school penalty when the skill's weapon does not match. */
export const OFF_WEAPON = 0.68;

export const MAX_LEVEL = 20;

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function emptyStats() {
  return {
    strength: 0,
    vitality: 0,
    endurance: 0,
    intellect: 0,
    wisdom: 0,
    dexterity: 0,
    agility: 0,
    tactics: 0
  };
}

export function canonicalStat(key) {
  return STAT_ALIAS[key] || key;
}

export function addStats(into, extra) {
  if (!extra) return into;
  for (const [key, value] of Object.entries(extra)) {
    const dest = canonicalStat(key);
    if (dest in into) into[dest] += value || 0;
  }
  return into;
}

/**
 * Level spreads into the class primary, then secondary, then a trickle.
 * Official spend is 20 start + 7/level (3 primary, 2 secondary, 1 vitality
 * or endurance, 1 tactics trickle). Gear is added on top of that budget.
 */
export function combineStats(race, klass, gearStats, level) {
  const gained = Math.max(0, (level || 1) - 1);
  const out = emptyStats();
  addStats(out, race.stats);
  addStats(out, klass.stats);
  const primary = canonicalStat(klass.primary);
  const secondary = canonicalStat(klass.secondary);
  const tertiary =
    primary !== 'vitality' && secondary !== 'vitality'
      ? 'vitality'
      : primary !== 'endurance' && secondary !== 'endurance'
        ? 'endurance'
        : 'tactics';
  const leftover = ['tactics', 'agility', 'dexterity', 'wisdom', 'intellect'].find(
    (key) => key !== primary && key !== secondary && key !== tertiary
  );
  if (gained) {
    out[primary] += 3 * gained;
    out[secondary] += 2 * gained;
    out[tertiary] += gained;
    if (leftover) out[leftover] += gained;
  }
  addStats(out, gearStats);
  return out;
}

export function sumGear(equipped, items) {
  const stats = emptyStats();
  let skillScalar = 1;
  let rangeMul = 1;
  let cdr = 0;
  let aoeMul = 1;
  for (const slot of GEAR_SLOTS) {
    const item = items[equipped?.[slot]];
    if (!item) continue;
    addStats(stats, item.stats);
    skillScalar *= item.skillScalar ?? 1;
    rangeMul *= item.rangeMul ?? 1;
    aoeMul *= item.aoeMul ?? 1;
    cdr += item.cdr ?? 0;
  }
  return {
    stats,
    skillScalar,
    rangeMul,
    aoeMul,
    cdr: clamp(cdr, 0, 0.35)
  };
}

export function poolMax(stats, race, klass, level) {
  const derived = deriveStats(stats);
  const lvl = Math.max(1, level || 1);
  return {
    hp: Math.max(1, Math.round(derived.health + (race.hp || 0) + (klass.hp || 0) + (lvl - 1) * 4)),
    sta: Math.max(1, Math.round(derived.stamina + (klass.sta || 0))),
    mp: Math.max(0, Math.round(derived.mana + (klass.mp || 0)))
  };
}

export function xpToNext(level) {
  const lvl = Math.max(1, level || 1);
  return Math.round(34 + lvl * 20 + lvl * lvl * 3);
}

export function dummyHpFor(level) {
  return Math.round(360 + Math.max(1, level || 1) * 48);
}

export function dummyXp(level, killed) {
  const lvl = Math.max(1, level || 1);
  return killed ? 26 + lvl * 5 : 0;
}

/** Weighted power. Weights are coefficients, not a mix that gets normalised. */
export function statPower(stats, weights) {
  if (!weights) return stats.strength;
  let total = 0;
  for (const [key, value] of Object.entries(weights)) {
    const dest = canonicalStat(key);
    total += (stats[dest] || 0) * (value || 0);
  }
  return total;
}

/**
 * How faithfully a skill is thrown from the weapon in hand.
 *
 * Staff catalog ids match any *_STAFF. Same familyId (blade, blunt, missile)
 * also counts as on-weapon. Hybrid classes still get a small off-family cut.
 */
export function weaponMatch(klass, skillWeapon, equippedWeapon) {
  if (!skillWeapon) return 1;
  if (skillWeapon === equippedWeapon) return 1;
  if (sameWeaponFamily(skillWeapon, equippedWeapon)) return 1;
  if (klass?.affinity === 'hybrid') return 0.96;
  return OFF_WEAPON;
}

export function critChance(stats) {
  return deriveStats(stats).criticalChance;
}

export function critMultiplier(stats) {
  return deriveStats(stats).criticalDamage;
}

/**
 * Tight variance on the authored skill number. Block and crit belong to
 * mitigateIncoming so blocked hits cannot crit.
 */
export function rollDamage(resolved, rng = Math.random) {
  const spread = 0.94 + rng() * 0.12;
  const amount = Math.max(1, Math.round(resolved.damage * spread));
  return { amount, crit: false };
}

export function scaleRange(base, variantMul = 1, gearMul = 1, stats = emptyStats()) {
  const agi = stats.agility || 0;
  const tac = stats.tactics || 0;
  return Math.max(1, (base || 0) * variantMul * gearMul * (1 + agi * 0.004 + tac * 0.003));
}

export function scaleCooldown(base, variantMul = 1, cdr = 0, stats = emptyStats()) {
  const agi = stats.agility || 0;
  return Math.max(0.18, (base || 0) * variantMul * (1 - clamp(cdr, 0, 0.35)) * (1 - agi * 0.002));
}

export function scaleAoe(base, variantMul = 1, gearMul = 1) {
  return Math.max(0, (base || 0) * variantMul * (gearMul || 1));
}

export function regenRates(stats, inCombat) {
  const out = inCombat ? 0.38 : 1;
  const staMul = inCombat ? 0.46 : 1;
  const mpMul = inCombat ? 0.42 : 1;
  return {
    hp: (2.2 + stats.vitality * 0.18 + stats.endurance * 0.08) * out,
    sta: (8.4 + stats.endurance * 0.4 + stats.agility * 0.22) * staMul,
    mp: (6.2 + stats.intellect * 0.28 + stats.wisdom * 0.35) * mpMul
  };
}
