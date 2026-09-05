// @ts-nocheck
/**
 * Official Warlords weapon types (ObjectStore docs — 17 combat categories).
 * Class is flavor: every Warlord can wield every type. The weapon owns idle,
 * the 1-2-3, and the root-motion close/kite. Gear actives sit on the HUD
 * beside that combo — they never replace it.
 */

const MARK = (d) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const MARKS = {
  SWORD: MARK('M18 46 L42 14 M28 18 L46 22 M16 44 L28 50'),
  AXE: MARK('M14 50 L30 22 M28 20 L50 28 L42 42 Z'),
  DAGGER: MARK('M22 48 L42 16 M20 44 L30 50'),
  SPEAR: MARK('M12 52 L48 12 M44 12 L52 20 M18 40 L28 50'),
  MACE: MARK('M18 50 L34 28 M32 18 L46 32 L38 40 L24 26 Z'),
  HAMMER: MARK('M16 50 L32 28 M26 18 H50 V32 H26 Z'),
  HAMMER2H: MARK('M12 54 L30 24 M22 14 H54 V34 H22 Z'),
  GREATSWORD: MARK('M16 52 L46 10 M26 16 L52 22 M14 48 L32 56'),
  GREATAXE: MARK('M12 54 L28 22 M24 14 L56 30 L44 48 Z'),
  BOW: MARK('M18 12 C44 20 44 44 18 52 M22 16 L22 48 M20 32 H40'),
  CROSSBOW: MARK('M12 32 H52 M20 18 L44 46 M44 18 L20 46 M36 32 H50'),
  GUN: MARK('M10 36 H42 L52 28 V22 H36 M18 36 V46 H28'),
  FIRE_STAFF: MARK('M20 54 L36 12 M32 10 C44 10 48 24 36 24 C28 24 28 10 36 10'),
  FROST_STAFF: MARK('M22 54 L34 14 M32 18 L44 10 M32 18 L20 10 M32 18 V4'),
  HOLY_STAFF: MARK('M22 54 L34 18 M32 8 V22 M24 14 H40'),
  LIGHTNING_STAFF: MARK('M22 54 L32 28 L24 28 L40 8 L32 28 L40 28 L28 54'),
  ARCANE_STAFF: MARK('M22 54 L34 16 M32 12 C44 8 48 24 34 26 C22 26 24 8 34 12')
};

function meleeHits(names, move, anims = ['combo1', 'combo2', 'combo3']) {
  const [a, b, c] = move;
  return [
    { id: 'combo1', name: names[0], anim: anims[0], vfx: 'combo1', move: a, duration: 0.36, lift: 0.05, cast: 'instant' },
    { id: 'combo2', name: names[1], anim: anims[1], vfx: 'combo2', move: b, duration: 0.42, lift: 0.07, cast: 'instant' },
    { id: 'combo3', name: names[2], anim: anims[2], vfx: 'combo3', move: c, duration: 0.52, lift: 0.1, cast: 'instant' }
  ];
}

function rangedHits(names, move, vfx, anims = ['cast1', 'cast2', 'cast3'], extra = []) {
  return [0, 1, 2].map((i) => ({
    id: `combo${i + 1}`,
    name: names[i],
    anim: anims[i],
    vfx: vfx[i],
    move: move[i],
    duration: 0.3 + i * 0.07,
    lift: 0.14 + i * 0.04,
    cast: 'instant',
    ...(extra[i] || {})
  }));
}

function type(spec) {
  return {
    idle: 'idle',
    walk: 'idle',
    run: 'idle',
    mark: MARKS[spec.id],
    ...spec
  };
}

/** ObjectStore table: 17 combat weapon categories (tomes / shields are off-hand). */
export const WEAPON_ORDER = [
  'SWORD',
  'AXE',
  'DAGGER',
  'SPEAR',
  'MACE',
  'HAMMER',
  'HAMMER2H',
  'GREATSWORD',
  'GREATAXE',
  'BOW',
  'CROSSBOW',
  'GUN',
  'FIRE_STAFF',
  'FROST_STAFF',
  'HOLY_STAFF',
  'LIGHTNING_STAFF',
  'ARCANE_STAFF'
];

export const HUD_SLOT_COUNT = 6;

export const WEAPON_TYPES = {
  SWORD: type({
    id: 'SWORD',
    name: 'Sword',
    catalog: 'swords',
    hands: '1h',
    family: 'melee',
    familyId: 'blade',
    reach: 2.2,
    kit: { weapons: ['sword_a', 'sword'], shield: true, extras: [] },
    preferred: ['warrior', 'thief'],
    combo: meleeHits(['Practice Slash', 'Quick Thrust', 'Wide Sweep'], [1.45, 1.9, 1.15]),
    blurb: 'T0 sword. 1 Practice Slash, 2 Quick Thrust, 3 Wide Sweep.'
  }),
  AXE: type({
    id: 'AXE',
    name: 'Axe',
    catalog: 'axes1h',
    hands: '1h',
    family: 'melee',
    familyId: 'axe',
    reach: 2.1,
    kit: { weapons: ['axe_a', 'axe', 'hammer_a'], shield: true, extras: [] },
    preferred: ['warrior', 'raider'],
    combo: meleeHits(['Practice Chop', 'Wind-Up', 'Cleaving Swing'], [1.5, 2.0, 2.55]),
    blurb: 'T0 axe. 1 chop, 2 wind-up, 3 cleave.'
  }),
  DAGGER: type({
    id: 'DAGGER',
    name: 'Dagger',
    catalog: 'daggers',
    hands: '1h',
    family: 'melee',
    familyId: 'blade',
    reach: 1.7,
    kit: { weapons: ['dagger', 'sword_b', 'sword'], shield: false, extras: [] },
    preferred: ['thief', 'ranger', 'worge'],
    combo: meleeHits(['Practice Stab', 'Evade Step', 'Backstab'], [1.15, 1.55, 2.05], ['combo1', 'combo2', 'combo1']),
    blurb: 'T0 dagger. 1 stab, 2 evade, 3 backstab.'
  }),
  SPEAR: type({
    id: 'SPEAR',
    name: 'Spear',
    catalog: 'spears',
    hands: '2h',
    family: 'melee',
    familyId: 'pole',
    reach: 3.1,
    kit: { weapons: ['spear', 'staff_a', 'staff'], shield: false, extras: [] },
    preferred: ['ranger', 'worge'],
    combo: meleeHits(['Practice Thrust', 'Reach Strike', 'Sweeping Jab'], [2.05, 2.4, 3.05]),
    blurb: 'T0 spear. 1 thrust, 2 reach, 3 sweep.'
  }),
  MACE: type({
    id: 'MACE',
    name: 'Mace',
    catalog: 'maces',
    hands: '1h',
    family: 'melee',
    familyId: 'blunt',
    reach: 2.0,
    kit: { weapons: ['mace', 'hammer_a', 'hammer'], shield: true, extras: [] },
    preferred: ['warrior', 'priest'],
    combo: meleeHits(['Practice Smash', 'Brace', 'Shockwave'], [1.4, 1.85, 2.4]),
    blurb: 'T0 mace. 1 smash, 2 brace, 3 shockwave.'
  }),
  HAMMER: type({
    id: 'HAMMER',
    name: 'Hammer',
    catalog: 'hammers1h',
    hands: '1h',
    family: 'melee',
    familyId: 'blunt',
    reach: 2.05,
    kit: { weapons: ['hammer_a', 'hammer', 'mace'], shield: true, extras: [] },
    preferred: ['warrior', 'worge', 'verduror'],
    combo: meleeHits(['Practice Smash', 'Brace', 'Shockwave'], [1.5, 1.95, 2.5]),
    blurb: 'T0 hammer. 1 smash, 2 brace, 3 shockwave.'
  }),
  HAMMER2H: type({
    id: 'HAMMER2H',
    name: 'Hammer (2H)',
    catalog: 'hammers2h',
    hands: '2h',
    family: 'melee',
    familyId: 'blunt',
    reach: 2.5,
    kit: { weapons: ['hammer', 'hammer_a', 'axe_a'], shield: false, extras: [] },
    preferred: ['warrior', 'raider'],
    combo: meleeHits(['Practice Smash', 'Brace', 'Ground Slam'], [1.75, 2.25, 2.95]),
    blurb: 'T0 2H hammer. 1 smash, 2 brace, 3 slam.'
  }),
  GREATSWORD: type({
    id: 'GREATSWORD',
    name: 'Greatsword',
    catalog: 'greatswords',
    hands: '2h',
    family: 'melee',
    familyId: 'blade',
    reach: 2.7,
    kit: { weapons: ['sword_a', 'sword'], shield: false, extras: [] },
    preferred: ['warrior', 'raider', 'ranger'],
    combo: meleeHits(['Practice Cleave', 'Power Stance', 'Overhead Swing'], [1.7, 2.15, 2.85]),
    blurb: 'T0 greatsword. 1 cleave, 2 stance, 3 overhead.'
  }),
  GREATAXE: type({
    id: 'GREATAXE',
    name: 'Greataxe',
    catalog: 'greataxes',
    hands: '2h',
    family: 'melee',
    familyId: 'axe',
    reach: 2.6,
    kit: { weapons: ['axe_a', 'axe', 'hammer'], shield: false, extras: [] },
    preferred: ['warrior', 'raider'],
    combo: meleeHits(['Practice Hew', 'Lumber Stance', 'Wide Arc'], [1.8, 2.3, 3.0]),
    blurb: 'T0 greataxe. 1 hew, 2 stance, 3 wide arc.'
  }),
  BOW: type({
    id: 'BOW',
    name: 'Bow',
    catalog: 'bows',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'missile',
    reach: 14,
    kit: { weapons: ['bow'], shield: false, extras: ['quiver'] },
    preferred: ['ranger', 'worge'],
    combo: rangedHits(
      ['Draw', 'Aimed Shot', 'Volley'],
      [1.05, 1.25, 1.85],
      ['fireBolt', 'aimedShot', 'volley'],
      ['cast1', 'cast2', 'cast3'],
      [
        { cast: 'draw' },
        { cast: 'charge', duration: 0.92 },
        { cast: 'zone', shape: 'zone', zoneRadius: 3.6, cooldown: 2.2, minRange: 2.0 }
      ]
    ),
    draw: {
      duration: 1.32,
      anim: 'cast1',
      releaseAnim: 'cast2',
      holdAt: 0.42,
      skill: 'combo1',
      hop: 1.2,
      zones: [
        { id: 'early', from: 0, to: 0.28, band: 'red', label: 'Early', dmg: 0.5, crit: 0 },
        { id: 'good', from: 0.28, to: 0.46, band: 'yellow', label: 'Good', dmg: 0.95, crit: 0.08 },
        { id: 'perfect', from: 0.46, to: 0.72, band: 'green', label: 'Perfect', dmg: 1.42, crit: 0.62 },
        { id: 'late', from: 0.72, to: 0.86, band: 'yellow', label: 'Late', dmg: 0.9, crit: 0.06 },
        { id: 'over', from: 0.86, to: 1.01, band: 'red', label: 'Overdraw', dmg: 0.46, crit: 0 }
      ]
    },
    charge: {
      duration: 0.92,
      anim: 'cast2',
      holdAt: 0.58,
      skill: 'combo2',
      hop: 1.25
    },
    blurb: 'T0 bow. Hold LMB draw. Hold 2 to aim. 3 volley.'
  }),
  CROSSBOW: type({
    id: 'CROSSBOW',
    name: 'Crossbow',
    catalog: 'crossbows',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'missile',
    reach: 13,
    kit: { weapons: ['bow'], shield: false, extras: ['quiver'] },
    preferred: ['ranger'],
    combo: rangedHits(['Practice Bolt', 'Heavy Bolt', 'Repeater'], [1.1, 1.55, 2.05], ['earth', 'fireBolt', 'thunder']),
    blurb: 'T0 crossbow. Same missile family as the bow.'
  }),
  GUN: type({
    id: 'GUN',
    name: 'Gun',
    catalog: 'guns',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'missile',
    reach: 12,
    kit: { weapons: ['bow', 'dagger'], shield: false, extras: [] },
    preferred: ['ranger', 'thief'],
    combo: rangedHits(['Practice Shot', 'Burst', 'Snipe'], [1.35, 1.8, 2.35], ['fireBolt', 'thunder', 'beam']),
    blurb: 'T0 gun. Recoil walks you off the line.'
  }),
  FIRE_STAFF: type({
    id: 'FIRE_STAFF',
    name: 'Fire Staff',
    catalog: 'fireStaves',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'staff',
    reach: 12,
    kit: { weapons: ['staff_a', 'staff'], shield: false, extras: [] },
    preferred: ['mage', 'worge'],
    combo: rangedHits(['Fire Bolt', 'Flame Wave', 'Meteor'], [0.95, 1.4, 1.9], ['fireBolt', 'pyre', 'firePortal']),
    blurb: 'T0 fire staff. Bolt, wave, meteor.'
  }),
  FROST_STAFF: type({
    id: 'FROST_STAFF',
    name: 'Frost Staff',
    catalog: 'frostStaves',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'staff',
    reach: 12,
    kit: { weapons: ['staff_a', 'staff'], shield: false, extras: [] },
    preferred: ['mage'],
    combo: rangedHits(['Frost Bolt', 'Ice Nova', 'Blizzard'], [0.95, 1.45, 1.95], ['ice', 'iceNova', 'beam']),
    blurb: 'T0 frost staff. Bolt, nova, blizzard.'
  }),
  HOLY_STAFF: type({
    id: 'HOLY_STAFF',
    name: 'Holy Staff',
    catalog: 'holyStaves',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'staff',
    reach: 11,
    kit: { weapons: ['staff_b', 'staff_a', 'staff'], shield: false, extras: [] },
    preferred: ['mage', 'priest'],
    combo: rangedHits(['Holy Light', 'Atonement', 'Radiance'], [0.9, 1.3, 1.8], ['healBolt', 'aether', 'portal']),
    blurb: 'T0 holy staff. Misty heal dart, atonement, radiance.'
  }),
  LIGHTNING_STAFF: type({
    id: 'LIGHTNING_STAFF',
    name: 'Lightning Staff',
    catalog: 'lightningStaves',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'staff',
    reach: 12,
    kit: { weapons: ['staff_a', 'staff'], shield: false, extras: [] },
    preferred: ['mage'],
    combo: rangedHits(['Spark', 'Chain', 'Thunderfall'], [1.05, 1.5, 2.05], ['thunder', 'electrical', 'beam']),
    blurb: 'T0 lightning staff. Spark, chain, thunderfall.'
  }),
  ARCANE_STAFF: type({
    id: 'ARCANE_STAFF',
    name: 'Arcane Staff',
    catalog: 'arcaneStaves',
    hands: 'ranged',
    family: 'ranged',
    familyId: 'staff',
    reach: 12,
    kit: { weapons: ['staff_a', 'staff'], shield: false, extras: [] },
    preferred: ['mage', 'priest', 'verduror'],
    combo: rangedHits(['Arcane Pulse', 'Aether Lance', 'Rift'], [0.95, 1.4, 1.95], ['aether', 'beam', 'portal']),
    blurb: 'T0 arcane staff. Pulse, lance, rift.'
  })
};

/** Relics, capes, and off-hands that sit in Bones of Holding beside the weapons. */
export const CLASS_BONES = {
  warrior: ['tyrstoken', 'wardshield', 'crusadecloak'],
  raider: ['tyrstoken', 'valhelm', 'crusadecloak'],
  mage: ['odineye', 'voidtome', 'fabledcape'],
  priest: ['odineye', 'voidtome', 'fabledcape'],
  virtuoso: ['odineye', 'voidtome', 'fabledcape'],
  ranger: ['lokicoin', 'oakbow', 'fabledcape'],
  thief: ['lokicoin', 'skybarb', 'legioncloak'],
  worge: ['tyrstoken', 'valsigil', 'legioncloak'],
  verduror: ['valsigil', 'frosthaft', 'fabledcape']
};

export const WEAPON_ALIASES = {
  STAFF: 'ARCANE_STAFF',
  HAMMER: 'HAMMER',
  SWORD: 'SWORD',
  BOW: 'BOW',
  AXE: 'AXE',
  GUN: 'GUN',
  PISTOL: 'GUN',
  pistols: 'GUN',
  shields: 'SWORD',
  swords: 'SWORD',
  axes1h: 'AXE',
  daggers: 'DAGGER',
  spears: 'SPEAR',
  maces: 'MACE',
  hammers1h: 'HAMMER',
  hammers2h: 'HAMMER2H',
  greatswords: 'GREATSWORD',
  greataxes: 'GREATAXE',
  bows: 'BOW',
  crossbows: 'CROSSBOW',
  guns: 'GUN',
  fireStaves: 'FIRE_STAFF',
  frostStaves: 'FROST_STAFF',
  holyStaves: 'HOLY_STAFF',
  lightningStaves: 'LIGHTNING_STAFF',
  arcaneStaves: 'ARCANE_STAFF',
  natureStaves: 'ARCANE_STAFF',
  tomes: 'ARCANE_STAFF',
  orbs: 'HOLY_STAFF',
  claws: 'DAGGER'
};

export function canonicalWeapon(id) {
  if (!id) return 'SWORD';
  if (WEAPON_TYPES[id]) return id;
  return WEAPON_ALIASES[id] || WEAPON_ALIASES[String(id).toLowerCase()] || 'SWORD';
}

export function getWeapon(id) {
  return WEAPON_TYPES[canonicalWeapon(id)] || WEAPON_TYPES.SWORD;
}

/** Freeform: every class can take every weapon. */
export function weaponsForClass(_classId) {
  return WEAPON_ORDER;
}

export function classCanUse(_classId, weaponId) {
  return Boolean(WEAPON_TYPES[canonicalWeapon(weaponId)]);
}

export function isPreferredWeapon(classId, weaponId) {
  const weapon = getWeapon(weaponId);
  return Boolean(classId && weapon.preferred?.includes(classId));
}

export function defaultWeaponFor(classId, fallback) {
  const want = fallback ? canonicalWeapon(fallback) : null;
  if (want && WEAPON_TYPES[want]) return want;
  return 'SWORD';
}

export function comboHit(weaponId, skillId) {
  const weapon = getWeapon(weaponId);
  return weapon.combo.find((hit) => hit.id === skillId) || weapon.combo[0];
}

export function isMeleeWeapon(id) {
  return getWeapon(id).family === 'melee';
}

export function usesDraw(id) {
  return Boolean(getWeapon(id).draw);
}

export function drawSpec(id) {
  return getWeapon(id).draw || null;
}

export function drawZoneAt(weaponId, t) {
  const spec = drawSpec(weaponId);
  if (!spec) return null;
  const u = Math.max(0, Math.min(1, t));
  return spec.zones.find((zone) => u >= zone.from && u < zone.to) || spec.zones[spec.zones.length - 1];
}

export function chargeSpec(id) {
  return getWeapon(id).charge || null;
}

export function skillCastMode(weaponId, skillId) {
  const hit = comboHit(weaponId, skillId);
  if (hit?.cast) return hit.cast;
  if (drawSpec(weaponId)?.skill === skillId) return 'draw';
  if (chargeSpec(weaponId)?.skill === skillId) return 'charge';
  return 'instant';
}

export function sameWeaponFamily(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const wa = getWeapon(a);
  const wb = getWeapon(b);
  if (a === 'STAFF' && wb.familyId === 'staff') return true;
  if (b === 'STAFF' && wa.familyId === 'staff') return true;
  if (wa.familyId && wa.familyId === wb.familyId) return true;
  return false;
}

export function kitFor(weaponId, classId, equipped) {
  const weapon = getWeapon(weaponId);
  const kit = { ...weapon.kit, extras: [...(weapon.kit.extras || [])] };
  const twoHand = weapon.hands === '2h' || weapon.hands === 'ranged';
  if (twoHand) kit.shield = false;
  else if (equipped) kit.shield = Boolean(equipped.offhand);
  if (classId === 'ranger' && weapon.id === 'BOW' && !kit.extras.includes('quiver')) kit.extras.push('quiver');
  return kit;
}

export const GROVE_RADIUS = 7.4;
export const DUMMY_KEEP_OFF = 1.55;
