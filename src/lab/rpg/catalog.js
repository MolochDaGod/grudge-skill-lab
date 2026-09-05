// @ts-nocheck
/**
 * Authored RPG data from Grudge Warlords: factions, races, classes, gear.
 *
 * Skill *visuals* live in `settings.js` / `SKILL_CATALOG`. This file only names
 * the combat identity that sits on top — what a Warrior's Cinder Slash *is*
 * versus a Ranger's, and what the dummy actually eats.
 */

import { SKILL_CATALOG } from '../config/skillCatalog.js';
import { ELEMENT_META } from '../config/settings.js';

/** Animated worge bear (`human.glb` is a misnamed export). Grove NPC + clip source — not a player body. */
export const WARBEAR_URL = '/models/valhalla/human.glb';

export const FACTIONS = {
  crusade: {
    id: 'crusade',
    name: 'The Crusade',
    short: 'Crusade',
    patron: 'Odin',
    color: '#e8b84a',
    blurb: 'Honor and fury under the Allfather.'
  },
  fabled: {
    id: 'fabled',
    name: 'The Fabled',
    short: 'Fabled',
    patron: 'The Omni',
    color: '#22d3ee',
    blurb: 'Arcane craft. The eldest alliance.'
  },
  legion: {
    id: 'legion',
    name: 'The Legion',
    short: 'Legion',
    patron: 'Madra',
    color: '#ef4444',
    blurb: 'Bloodlust and death magic.'
  }
};

export const RACES = {
  human: {
    id: 'human',
    name: 'Human',
    faction: 'crusade',
    epithet: 'Crusade',
    blurb: 'Versatile and adaptable — masters of none, capable of all.',
    trait: 'Adaptable',
    hp: 18,
    swatch: '#e8b84a',
    height: 1.8,
    mesh: '/models/warlords/human.glb',
    stats: { strength: 1, vitality: 1, endurance: 1, intellect: 1, wisdom: 1, dexterity: 1, agility: 1, tactics: 1 }
  },
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    faction: 'crusade',
    epithet: 'Crusade',
    blurb: 'Untamed fury given form — raw power and relentless aggression.',
    trait: 'Berserker Rage',
    hp: 28,
    swatch: '#c4786a',
    height: 1.88,
    mesh: '/models/warlords/barbarian.glb',
    stats: { strength: 3, vitality: 1, endurance: 1, intellect: 0, wisdom: 0, dexterity: 0, agility: 2, tactics: 1 }
  },
  dwarf: {
    id: 'dwarf',
    name: 'Dwarf',
    faction: 'fabled',
    epithet: 'Fabled',
    blurb: 'Stout mountain folk — unyielding defense and masterful craftsmanship.',
    trait: 'Stoneborn',
    hp: 34,
    swatch: '#8a6a4a',
    height: 1.52,
    mesh: '/models/warlords/dwarf.glb',
    stats: { strength: 1, vitality: 2, endurance: 3, intellect: 0, wisdom: 1, dexterity: 1, agility: 0, tactics: 0 }
  },
  elf: {
    id: 'elf',
    name: 'Elf',
    faction: 'fabled',
    epithet: 'Fabled',
    blurb: 'Ancient and graceful — wielders of arcane arts and deadly precision.',
    trait: 'Arcane Affinity',
    hp: 6,
    swatch: '#22d3ee',
    height: 1.82,
    mesh: '/models/warlords/elf.glb',
    stats: { strength: 0, vitality: 0, endurance: 0, intellect: 3, wisdom: 1, dexterity: 2, agility: 2, tactics: 0 }
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    faction: 'legion',
    epithet: 'Legion',
    blurb: 'Savage brutes bred for war — crushing power and iron will.',
    trait: 'Bloodrage',
    hp: 28,
    swatch: '#ef4444',
    height: 1.9,
    mesh: '/models/warlords/orc.glb',
    stats: { strength: 4, vitality: 2, endurance: 2, intellect: 0, wisdom: 0, dexterity: 0, agility: 0, tactics: 0 }
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    faction: 'legion',
    epithet: 'Legion',
    blurb: 'Death-touched revenants fueled by dark energy and grudges unresolved.',
    trait: 'Undying Will',
    hp: 8,
    swatch: '#8b96a8',
    height: 1.78,
    mesh: '/models/warlords/undead.glb',
    stats: { strength: 1, vitality: 3, endurance: 2, intellect: 0, wisdom: 2, dexterity: 0, agility: 0, tactics: 0 }
  }
};

export const RACE_ALIASES = { barbbear: 'barbarian' };
export const CLASS_ALIASES = {
  guardian: 'warrior',
  berserker: 'raider',
  rogue: 'thief',
  seer: 'mage',
  warden: 'verduror',
  warlock: 'priest',
  virtuso: 'virtuoso',
  bard: 'virtuoso'
};

/** Official Toon-RTS {race}.glb. Mixamo is fallback only — not the play body. */
export function raceUsesAvatar(id) {
  return Boolean(RACES[id]?.mesh);
}

/** Race is the body. Worge is a class, not a mesh swap (play contract worgeMapping: null). */
export function bodyForm(raceId, classId) {
  if (raceUsesAvatar(raceId)) return raceId;
  return 'mixamo';
}

export const CLASSES = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    family: 'warrior',
    primary: 'strength',
    secondary: 'vitality',
    weapon: 'GREATSWORD',
    weaponTypes: ['SWORD', 'AXE', 'MACE', 'HAMMER', 'HAMMER2H', 'GREATSWORD', 'GREATAXE'],
    affinity: 'weapon',
    hp: 42,
    sta: 22,
    mp: 0,
    stats: { strength: 5, vitality: 3, endurance: 2, intellect: 0, wisdom: 0, dexterity: 1, agility: 1, tactics: 0 },
    loadout: ['combo1', 'combo2', 'combo3', 'earth', 'thunder', 'firePortal'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'ashbrand',
      offhand: null,
      helm: 'ironvisor',
      shoulders: 'warpads',
      chest: 'warplate',
      hands: 'wargauntlets',
      legs: 'warleggings',
      feet: 'warboots',
      back: 'crusadecloak',
      relic: 'tyrstoken'
    },
    blurb: 'A fearless frontline fighter specializing in raw power and defense.'
  },
  raider: {
    id: 'raider',
    name: 'Raider',
    family: 'warrior',
    primary: 'strength',
    secondary: 'endurance',
    weapon: 'HAMMER2H',
    weaponTypes: ['GREATSWORD', 'GREATAXE', 'HAMMER2H'],
    affinity: 'weapon',
    hp: 36,
    sta: 28,
    mp: 0,
    stats: { strength: 5, vitality: 2, endurance: 2, intellect: 0, wisdom: 0, dexterity: 2, agility: 1, tactics: 0 },
    loadout: ['combo1', 'combo2', 'combo3', 'thunder', 'pyre', 'earth'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'stonemaul',
      offhand: null,
      helm: 'valhelm',
      shoulders: 'warpads',
      chest: 'warplate',
      hands: 'wargauntlets',
      legs: 'warleggings',
      feet: 'warboots',
      back: 'crusadecloak',
      relic: 'tyrstoken'
    },
    blurb: 'Two-hand parry tank. Timing is the armor.'
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    family: 'mage',
    primary: 'intellect',
    secondary: 'wisdom',
    weapon: 'FROST_STAFF',
    weaponTypes: ['FIRE_STAFF', 'FROST_STAFF', 'HOLY_STAFF', 'LIGHTNING_STAFF', 'ARCANE_STAFF'],
    affinity: 'spell',
    hp: 10,
    sta: 0,
    mp: 30,
    stats: { strength: 0, vitality: 1, endurance: 1, intellect: 5, wisdom: 4, dexterity: 0, agility: 0, tactics: 1 },
    loadout: ['fireBolt', 'ice', 'thunder', 'beam', 'iceNova', 'pyre'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'frosthaft',
      offhand: 'voidtome',
      helm: 'runecirclet',
      shoulders: 'runemantle',
      chest: 'runecoat',
      hands: 'runegloves',
      legs: 'runeleggings',
      feet: 'trailboots',
      back: 'fabledcape',
      relic: 'odineye'
    },
    blurb: 'Master of arcane magic and divine healing arts.'
  },
  priest: {
    id: 'priest',
    name: 'Priest',
    family: 'mage',
    primary: 'wisdom',
    secondary: 'intellect',
    weapon: 'HOLY_STAFF',
    weaponTypes: ['HOLY_STAFF', 'ARCANE_STAFF'],
    affinity: 'spell',
    hp: 16,
    sta: 0,
    mp: 28,
    stats: { strength: 0, vitality: 1, endurance: 1, intellect: 2, wisdom: 5, dexterity: 0, agility: 0, tactics: 1 },
    loadout: ['healBolt', 'aether', 'portal', 'ice', 'iceNova', 'beam'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'starwell',
      offhand: 'voidtome',
      helm: 'runecirclet',
      shoulders: 'runemantle',
      chest: 'runecoat',
      hands: 'runegloves',
      legs: 'runeleggings',
      feet: 'trailboots',
      back: 'fabledcape',
      relic: 'odineye'
    },
    blurb: 'Discipline healer — Atonement from damage, shields, mass dispel, pain reflect.'
  },
  virtuoso: {
    id: 'virtuoso',
    name: 'Virtuoso',
    family: 'mage',
    primary: 'intellect',
    secondary: 'agility',
    weapon: 'ARCANE_STAFF',
    weaponTypes: ['ARCANE_STAFF', 'LIGHTNING_STAFF', 'HOLY_STAFF'],
    affinity: 'spell',
    hp: 14,
    sta: 8,
    mp: 26,
    stats: { strength: 0, vitality: 1, endurance: 1, intellect: 4, wisdom: 2, dexterity: 1, agility: 3, tactics: 1 },
    loadout: ['aether', 'beam', 'thunder', 'ice', 'portal', 'electrical'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'voidstaff',
      offhand: 'voidtome',
      helm: 'runecirclet',
      shoulders: 'runemantle',
      chest: 'runecoat',
      hands: 'runegloves',
      legs: 'runeleggings',
      feet: 'trailboots',
      back: 'fabledcape',
      relic: 'odineye'
    },
    blurb: 'Air totem virtuoso — wind pulses when you act, jade mist on the F.'
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    family: 'ranger',
    primary: 'dexterity',
    secondary: 'agility',
    weapon: 'BOW',
    weaponTypes: ['BOW', 'CROSSBOW', 'GUN', 'DAGGER', 'GREATSWORD', 'SPEAR'],
    affinity: 'hybrid',
    hp: 22,
    sta: 14,
    mp: 12,
    stats: { strength: 1, vitality: 1, endurance: 1, intellect: 1, wisdom: 0, dexterity: 4, agility: 3, tactics: 1 },
    loadout: ['cinderSlash', 'fireBolt', 'ice', 'portal', 'aether', 'beam'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'oakbow',
      offhand: null,
      helm: 'trailhood',
      shoulders: 'warpads',
      chest: 'trailcoat',
      hands: 'runegloves',
      legs: 'trailpants',
      feet: 'trailboots',
      back: 'fabledcape',
      relic: 'lokicoin'
    },
    blurb: 'A deadly marksman with precise long-range attacks.'
  },
  thief: {
    id: 'thief',
    name: 'Thief',
    family: 'ranger',
    primary: 'dexterity',
    secondary: 'agility',
    weapon: 'DAGGER',
    weaponTypes: ['DAGGER', 'SWORD', 'GUN'],
    affinity: 'weapon',
    hp: 16,
    sta: 20,
    mp: 8,
    stats: { strength: 1, vitality: 1, endurance: 1, intellect: 0, wisdom: 0, dexterity: 4, agility: 4, tactics: 1 },
    loadout: ['cinderSlash', 'fireBolt', 'portal', 'ice', 'aether', 'thunder'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'boneknife',
      offhand: null,
      helm: 'trailhood',
      shoulders: 'warpads',
      chest: 'trailcoat',
      hands: 'runegloves',
      legs: 'trailpants',
      feet: 'trailboots',
      back: 'legioncloak',
      relic: 'lokicoin'
    },
    blurb: 'Outlaw rogue — combo, pistol interrupt, blade flurry, smoke bomb peel.'
  },
  worge: {
    id: 'worge',
    name: 'Worge',
    family: 'worge',
    primary: 'strength',
    secondary: 'agility',
    weapon: 'HAMMER',
    weaponTypes: ['FIRE_STAFF', 'SPEAR', 'DAGGER', 'BOW', 'HAMMER'],
    affinity: 'hybrid',
    hp: 32,
    sta: 16,
    mp: 12,
    stats: { strength: 2, vitality: 2, endurance: 1, intellect: 2, wisdom: 1, dexterity: 2, agility: 2, tactics: 0 },
    loadout: ['combo1', 'combo2', 'combo3', 'thunder', 'earth', 'kraken'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'stonemaul',
      offhand: null,
      helm: 'valhelm',
      shoulders: 'warpads',
      chest: 'groveplate',
      hands: 'wargauntlets',
      legs: 'warleggings',
      feet: 'warboots',
      back: 'legioncloak',
      relic: 'tyrstoken'
    },
    blurb: 'A shapeshifter who wields nature and storm magic in human form, then transforms into a devastating beast.'
  },
  verduror: {
    id: 'verduror',
    name: 'Verduror',
    family: 'worge',
    primary: 'wisdom',
    secondary: 'vitality',
    weapon: 'ARCANE_STAFF',
    weaponTypes: ['ARCANE_STAFF', 'HAMMER'],
    affinity: 'spell',
    hp: 24,
    sta: 8,
    mp: 22,
    stats: { strength: 1, vitality: 2, endurance: 1, intellect: 1, wisdom: 3, dexterity: 1, agility: 2, tactics: 0 },
    loadout: ['portal', 'aether', 'earth', 'ice', 'kraken', 'iceNova'],
    keys: ['1', '2', '3', '4', '5', '6'],
    gear: {
      weapon: 'voidstaff',
      offhand: 'voidtome',
      helm: 'runecirclet',
      shoulders: 'runemantle',
      chest: 'groveplate',
      hands: 'runegloves',
      legs: 'runeleggings',
      feet: 'trailboots',
      back: 'fabledcape',
      relic: 'valsigil'
    },
    blurb: 'Mistweaver — jade mist, crane kicks that heal, detox, celestial forms.'
  }
};

/**
 * Combat profile per lab skill. `hit` is how the dummy is tested.
 * `width` is metres of forgiveness around a line; zones use authored radius.
 */
export const SKILL_COMBAT = {
  cinderSlash: {
    school: 'fire',
    hit: 'line',
    width: 1.2,
    dummyRadius: 1.05,
    damageBase: 42,
    damageRatio: 1.18,
    cost: { type: 'sta', amount: 16 }
  },
  mageTotem: {
    school: 'arcane',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.6,
    damageBase: 8,
    damageRatio: 0.4,
    cost: { type: 'mp', amount: 25 }
  },
  priestTotem: {
    school: 'holy',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.6,
    damageBase: 0,
    damageRatio: 0,
    cost: { type: 'mp', amount: 30 }
  },
  virtuosoTotem: {
    school: 'air',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.6,
    damageBase: 6,
    damageRatio: 0.35,
    cost: { type: 'mp', amount: 25 }
  },
  combo1: {
    school: 'weapon',
    hit: 'line',
    width: 1.15,
    dummyRadius: 1.05,
    damageBase: 18,
    damageRatio: 1.05,
    cost: { type: 'sta', amount: 2 }
  },
  combo2: {
    school: 'weapon',
    hit: 'line',
    width: 0.55,
    dummyRadius: 0.95,
    damageBase: 16,
    damageRatio: 1.08,
    cost: { type: 'sta', amount: 2 }
  },
  combo3: {
    school: 'weapon',
    hit: 'zone',
    width: 1.8,
    dummyRadius: 1.1,
    damageBase: 14,
    damageRatio: 1.12,
    cost: { type: 'sta', amount: 2 }
  },
  fireBolt: {
    school: 'fire',
    hit: 'line',
    width: 0.62,
    dummyRadius: 0.95,
    damageBase: 34,
    damageRatio: 1.08,
    cost: { type: 'mp', amount: 14 }
  },
  ice: {
    school: 'frost',
    hit: 'line',
    width: 1.25,
    dummyRadius: 1.1,
    damageBase: 28,
    damageRatio: 0.95,
    cost: { type: 'mp', amount: 12 }
  },
  thunder: {
    school: 'storm',
    hit: 'line',
    width: 0.72,
    dummyRadius: 1,
    damageBase: 36,
    damageRatio: 1.12,
    cost: { type: 'mp', amount: 18 }
  },
  beam: {
    school: 'aether',
    hit: 'line',
    width: 0.58,
    dummyRadius: 0.9,
    damageBase: 40,
    damageRatio: 1.2,
    cost: { type: 'mp', amount: 22 }
  },
  earth: {
    school: 'earth',
    hit: 'line',
    width: 0.95,
    dummyRadius: 1.15,
    damageBase: 38,
    damageRatio: 1.1,
    cost: { type: 'sta', amount: 20 }
  },
  pyre: {
    school: 'fire',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.7,
    damageBase: 48,
    damageRatio: 1.05,
    cost: { type: 'mp', amount: 24 }
  },
  kraken: {
    school: 'tide',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.7,
    damageBase: 44,
    damageRatio: 1,
    cost: { type: 'mp', amount: 22 }
  },
  electrical: {
    school: 'storm',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.75,
    damageBase: 40,
    damageRatio: 1.02,
    cost: { type: 'sta', amount: 18 }
  },
  portal: {
    school: 'verdant',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.85,
    damageBase: 30,
    damageRatio: 0.85,
    cost: { type: 'mp', amount: 16 }
  },
  aether: {
    school: 'tide',
    hit: 'ring',
    width: 0,
    dummyRadius: 0.8,
    damageBase: 36,
    damageRatio: 0.98,
    cost: { type: 'mp', amount: 20 }
  },
  firePortal: {
    school: 'fire',
    hit: 'ring',
    width: 0,
    dummyRadius: 0.8,
    damageBase: 42,
    damageRatio: 1.04,
    cost: { type: 'sta', amount: 22 }
  },
  iceNova: {
    school: 'frost',
    hit: 'zone',
    width: 0,
    dummyRadius: 0.7,
    damageBase: 46,
    damageRatio: 1.08,
    cost: { type: 'mp', amount: 24 }
  }
};

/**
 * Class-specific names and coefficient sets for the six loadout skills.
 * Skills not listed fall back to SKILL_COMBAT + a neutral weight mix.
 */
export const VARIANTS = {
  warrior: {
    combo1: {
      name: 'Slash',
      weights: { might: 1, swift: 0.18, vital: 0.08 },
      dmgMul: 1.12,
      rangeMul: 1,
      cdMul: 0.9,
      aoeMul: 1,
      cost: { type: 'sta', amount: 8 }
    },
    combo2: {
      name: 'Cleave',
      weights: { might: 1.05, swift: 0.2, vital: 0.1 },
      dmgMul: 1.22,
      rangeMul: 1,
      cdMul: 0.92,
      aoeMul: 1.05,
      cost: { type: 'sta', amount: 10 }
    },
    combo3: {
      name: 'Execute',
      weights: { might: 1.2, swift: 0.12, vital: 0.12 },
      dmgMul: 1.38,
      rangeMul: 1.04,
      cdMul: 1,
      aoeMul: 1.1,
      cost: { type: 'sta', amount: 14 }
    },
    cinderSlash: {
      name: 'Slash',
      weights: { might: 1, swift: 0.18, vital: 0.08 },
      dmgMul: 1.2,
      rangeMul: 0.94,
      cdMul: 0.92,
      aoeMul: 1,
      cost: { type: 'sta', amount: 18 }
    },
    earth: {
      name: 'Cleave',
      weights: { might: 0.9, vital: 0.35 },
      dmgMul: 1.14,
      rangeMul: 0.9,
      cdMul: 1.05,
      aoeMul: 1.05,
      cost: { type: 'sta', amount: 22 }
    },
    pyre: {
      name: 'War Cry',
      weights: { might: 0.7, spirit: 0.25, vital: 0.15 },
      dmgMul: 1.08,
      rangeMul: 0.88,
      cdMul: 1.08,
      aoeMul: 0.92,
      cost: { type: 'sta', amount: 26 }
    },
    electrical: {
      name: 'Shield Bash',
      weights: { might: 0.55, swift: 0.4, spirit: 0.15 },
      dmgMul: 1.06,
      rangeMul: 0.9,
      cdMul: 0.95,
      aoeMul: 0.9,
      cost: { type: 'sta', amount: 20 }
    },
    thunder: {
      name: 'Power Strike',
      weights: { might: 0.8, swift: 0.35 },
      dmgMul: 1.12,
      rangeMul: 0.86,
      cdMul: 1.1,
      aoeMul: 1,
      cost: { type: 'sta', amount: 24 }
    },
    firePortal: {
      name: 'Demon Blade',
      weights: { might: 0.5, spirit: 0.4, vital: 0.2 },
      dmgMul: 1.05,
      rangeMul: 0.92,
      cdMul: 1.12,
      aoeMul: 1,
      cost: { type: 'sta', amount: 28 }
    }
  },
  mage: {
    fireBolt: {
      name: 'Fireball',
      weights: { mind: 1, spirit: 0.22 },
      dmgMul: 1.16,
      rangeMul: 1.1,
      cdMul: 0.92,
      aoeMul: 1,
      cost: { type: 'mp', amount: 16 }
    },
    ice: {
      name: 'Ice Storm',
      weights: { mind: 0.85, spirit: 0.4 },
      dmgMul: 1.08,
      rangeMul: 1.06,
      cdMul: 0.85,
      aoeMul: 1.08,
      cost: { type: 'mp', amount: 14 }
    },
    thunder: {
      name: 'Arcane Bolt',
      weights: { mind: 0.75, spirit: 0.45, swift: 0.1 },
      dmgMul: 1.14,
      rangeMul: 1.12,
      cdMul: 0.9,
      aoeMul: 1,
      cost: { type: 'mp', amount: 20 }
    },
    beam: {
      name: 'Arcane Blast',
      weights: { mind: 1, spirit: 0.3 },
      dmgMul: 1.22,
      rangeMul: 1.14,
      cdMul: 0.95,
      aoeMul: 1,
      cost: { type: 'mp', amount: 26 }
    },
    pyre: {
      name: 'Meteor',
      weights: { mind: 0.7, spirit: 0.5 },
      dmgMul: 1.1,
      rangeMul: 1.04,
      cdMul: 1,
      aoeMul: 1.12,
      cost: { type: 'mp', amount: 24 }
    },
    iceNova: {
      name: 'Mana Shield',
      weights: { mind: 0.8, spirit: 0.5 },
      dmgMul: 1.18,
      rangeMul: 1.08,
      cdMul: 0.95,
      aoeMul: 1.16,
      cost: { type: 'mp', amount: 26 }
    }
  },
  ranger: {
    cinderSlash: {
      name: 'Quick Shot',
      weights: { swift: 0.85, might: 0.45 },
      dmgMul: 0.94,
      rangeMul: 1.14,
      cdMul: 0.78,
      aoeMul: 1,
      cost: { type: 'sta', amount: 12 }
    },
    fireBolt: {
      name: 'Aimed Shot',
      weights: { swift: 0.7, mind: 0.45, might: 0.15 },
      dmgMul: 0.98,
      rangeMul: 1.16,
      cdMul: 0.8,
      aoeMul: 1,
      cost: { type: 'sta', amount: 10 }
    },
    ice: {
      name: 'Poison Arrow',
      weights: { swift: 0.6, mind: 0.5 },
      dmgMul: 0.96,
      rangeMul: 1.12,
      cdMul: 0.76,
      aoeMul: 1.06,
      cost: { type: 'mp', amount: 11 }
    },
    portal: {
      name: 'Evasive Roll',
      weights: { swift: 0.5, mind: 0.4, spirit: 0.2 },
      dmgMul: 0.9,
      rangeMul: 1.08,
      cdMul: 0.88,
      aoeMul: 1.1,
      cost: { type: 'mp', amount: 14 }
    },
    aether: {
      name: 'Focus',
      weights: { swift: 0.55, mind: 0.45, spirit: 0.2 },
      dmgMul: 0.95,
      rangeMul: 1.18,
      cdMul: 0.9,
      aoeMul: 1.08,
      cost: { type: 'mp', amount: 16 }
    },
    beam: {
      name: 'Arrow Volley',
      weights: { swift: 0.5, mind: 0.55 },
      dmgMul: 1.04,
      rangeMul: 1.2,
      cdMul: 0.86,
      aoeMul: 1,
      cost: { type: 'mp', amount: 18 }
    }
  },
  raider: {
    combo1: {
      name: 'Crush',
      weights: { might: 1.15, swift: 0.2 },
      dmgMul: 1.18,
      rangeMul: 1,
      cdMul: 0.88,
      aoeMul: 1.04,
      cost: { type: 'sta', amount: 9 }
    },
    combo2: {
      name: 'Smash',
      weights: { might: 1.2, swift: 0.22 },
      dmgMul: 1.3,
      rangeMul: 1.02,
      cdMul: 0.9,
      aoeMul: 1.08,
      cost: { type: 'sta', amount: 12 }
    },
    combo3: {
      name: 'Devastate',
      weights: { might: 1.3, vital: 0.15 },
      dmgMul: 1.46,
      rangeMul: 1.06,
      cdMul: 0.95,
      aoeMul: 1.12,
      cost: { type: 'sta', amount: 16 }
    },
    cinderSlash: {
      name: 'Mortal Strike',
      weights: { might: 1.15, swift: 0.2 },
      dmgMul: 1.28,
      rangeMul: 0.9,
      cdMul: 0.82,
      aoeMul: 1.06,
      cost: { type: 'sta', amount: 22 }
    },
    thunder: {
      name: 'Overpower',
      weights: { might: 0.9, swift: 0.4 },
      dmgMul: 1.2,
      rangeMul: 0.92,
      cdMul: 0.88,
      aoeMul: 1,
      cost: { type: 'sta', amount: 24 }
    },
    pyre: {
      name: 'Riposte',
      weights: { might: 0.85, spirit: 0.2 },
      dmgMul: 1.18,
      rangeMul: 0.84,
      cdMul: 0.9,
      aoeMul: 0.95,
      cost: { type: 'sta', amount: 26 }
    },
    firePortal: {
      name: 'Execute',
      weights: { might: 0.7, spirit: 0.3 },
      dmgMul: 1.12,
      rangeMul: 0.9,
      cdMul: 0.95,
      aoeMul: 1.04,
      cost: { type: 'sta', amount: 28 }
    },
    electrical: {
      name: 'Parry Window',
      weights: { might: 0.65, swift: 0.5 },
      dmgMul: 1.1,
      rangeMul: 0.88,
      cdMul: 0.8,
      aoeMul: 1.08,
      cost: { type: 'sta', amount: 20 }
    },
    earth: {
      name: 'Slam',
      weights: { might: 1, vital: 0.2 },
      dmgMul: 1.22,
      rangeMul: 0.86,
      cdMul: 0.94,
      aoeMul: 1.1,
      cost: { type: 'sta', amount: 24 }
    }
  },
  thief: {
    cinderSlash: {
      name: 'Sinister Strike',
      weights: { swift: 1, might: 0.25 },
      dmgMul: 0.98,
      rangeMul: 1.08,
      cdMul: 0.7,
      aoeMul: 0.9,
      cost: { type: 'sta', amount: 10 }
    },
    fireBolt: {
      name: 'Pistol Shot',
      weights: { swift: 0.8, mind: 0.35 },
      dmgMul: 0.94,
      rangeMul: 1.18,
      cdMul: 0.72,
      aoeMul: 1,
      cost: { type: 'sta', amount: 9 }
    },
    portal: {
      name: 'Smoke Bomb',
      weights: { swift: 0.7, mind: 0.3 },
      dmgMul: 0.82,
      rangeMul: 1.04,
      cdMul: 0.78,
      aoeMul: 0.95,
      cost: { type: 'mp', amount: 12 }
    },
    ice: {
      name: 'Between the Eyes',
      weights: { swift: 0.55, mind: 0.5 },
      dmgMul: 0.9,
      rangeMul: 1.1,
      cdMul: 0.74,
      aoeMul: 1,
      cost: { type: 'mp', amount: 10 }
    },
    aether: {
      name: 'Blade Flurry',
      weights: { swift: 0.65, mind: 0.35 },
      dmgMul: 0.88,
      rangeMul: 1.12,
      cdMul: 0.8,
      aoeMul: 1.04,
      cost: { type: 'mp', amount: 14 }
    },
    thunder: {
      name: 'Cheap Shot',
      weights: { swift: 0.8, mind: 0.3 },
      dmgMul: 1.02,
      rangeMul: 1.16,
      cdMul: 0.76,
      aoeMul: 1,
      cost: { type: 'sta', amount: 14 }
    }
  },
  verduror: {
    portal: {
      name: 'Soothing Mist',
      weights: { spirit: 0.85, mind: 0.3 },
      dmgMul: 1.02,
      rangeMul: 1.06,
      cdMul: 0.92,
      aoeMul: 1.2,
      cost: { type: 'mp', amount: 16 }
    },
    aether: {
      name: 'Jade Serpent',
      weights: { spirit: 0.8, vital: 0.3 },
      dmgMul: 1,
      rangeMul: 1.1,
      cdMul: 0.95,
      aoeMul: 1.16,
      cost: { type: 'mp', amount: 18 }
    },
    earth: {
      name: 'Crane Kick',
      weights: { spirit: 0.5, vital: 0.5, might: 0.2 },
      dmgMul: 1.08,
      rangeMul: 0.95,
      cdMul: 1.02,
      aoeMul: 1.14,
      cost: { type: 'sta', amount: 16 }
    },
    ice: {
      name: 'Detox',
      weights: { mind: 0.55, spirit: 0.6 },
      dmgMul: 1.04,
      rangeMul: 1.08,
      cdMul: 0.9,
      aoeMul: 1.12,
      cost: { type: 'mp', amount: 14 }
    },
    kraken: {
      name: 'Celestial Form',
      weights: { spirit: 0.7, mind: 0.4 },
      dmgMul: 1.1,
      rangeMul: 1.04,
      cdMul: 1,
      aoeMul: 1.18,
      cost: { type: 'mp', amount: 22 }
    },
    iceNova: {
      name: 'Essence Font',
      weights: { spirit: 0.75, mind: 0.45 },
      dmgMul: 1.12,
      rangeMul: 1.06,
      cdMul: 0.96,
      aoeMul: 1.2,
      cost: { type: 'mp', amount: 24 }
    }
  },
  priest: {
    beam: {
      name: 'Smite',
      weights: { mind: 1.05, spirit: 0.25 },
      dmgMul: 1.24,
      rangeMul: 1.18,
      cdMul: 0.92,
      aoeMul: 1,
      cost: { type: 'mp', amount: 26 }
    },
    aether: {
      name: 'Word Shield',
      weights: { mind: 0.65, spirit: 0.4 },
      dmgMul: 1.08,
      rangeMul: 1.04,
      cdMul: 0.88,
      aoeMul: 1.12,
      cost: { type: 'mp', amount: 20 }
    },
    portal: {
      name: 'Mass Dispel',
      weights: { mind: 0.7, spirit: 0.4 },
      dmgMul: 1.12,
      rangeMul: 1.1,
      cdMul: 0.9,
      aoeMul: 1.08,
      cost: { type: 'mp', amount: 22 }
    },
    ice: {
      name: 'Atonement',
      weights: { mind: 0.8, spirit: 0.4 },
      dmgMul: 1.18,
      rangeMul: 1.1,
      cdMul: 0.93,
      aoeMul: 1.14,
      cost: { type: 'mp', amount: 26 }
    },
    iceNova: {
      name: 'Pain Reflect',
      weights: { mind: 0.85, spirit: 0.3, might: 0.15 },
      dmgMul: 1.16,
      rangeMul: 1.08,
      cdMul: 0.94,
      aoeMul: 1.1,
      cost: { type: 'mp', amount: 24 }
    },
    pyre: {
      name: 'Divine Heal',
      weights: { mind: 0.7, spirit: 0.45 },
      dmgMul: 1.14,
      rangeMul: 1.06,
      cdMul: 0.98,
      aoeMul: 1.1,
      cost: { type: 'mp', amount: 24 }
    }
  },
  worge: {
    combo1: {
      name: 'Maul',
      weights: { might: 0.9, swift: 0.35 },
      dmgMul: 1.1,
      rangeMul: 1,
      cdMul: 0.86,
      aoeMul: 1,
      cost: { type: 'sta', amount: 8 }
    },
    combo2: {
      name: 'Rake',
      weights: { might: 0.95, swift: 0.4 },
      dmgMul: 1.2,
      rangeMul: 1.02,
      cdMul: 0.88,
      aoeMul: 1.04,
      cost: { type: 'sta', amount: 10 }
    },
    combo3: {
      name: 'Rend',
      weights: { might: 1.05, swift: 0.3, vital: 0.1 },
      dmgMul: 1.34,
      rangeMul: 1.05,
      cdMul: 0.94,
      aoeMul: 1.08,
      cost: { type: 'sta', amount: 14 }
    },
    cinderSlash: {
      name: 'Mace Strike',
      weights: { might: 0.8, spirit: 0.3, swift: 0.2 },
      dmgMul: 1.1,
      rangeMul: 0.96,
      cdMul: 0.9,
      aoeMul: 1,
      cost: { type: 'sta', amount: 14 }
    },
    thunder: {
      name: 'Storm Howl',
      weights: { might: 0.5, spirit: 0.5, swift: 0.2 },
      dmgMul: 1.14,
      rangeMul: 1.04,
      cdMul: 0.88,
      aoeMul: 1.08,
      cost: { type: 'mp', amount: 16 }
    },
    earth: {
      name: 'Root Maul',
      weights: { might: 0.7, vital: 0.4 },
      dmgMul: 1.16,
      rangeMul: 0.92,
      cdMul: 0.94,
      aoeMul: 1.12,
      cost: { type: 'sta', amount: 18 }
    },
    kraken: {
      name: 'Beast Unleashed',
      weights: { might: 0.6, spirit: 0.5 },
      dmgMul: 1.2,
      rangeMul: 1.02,
      cdMul: 1,
      aoeMul: 1.16,
      cost: { type: 'mp', amount: 22 }
    },
    pyre: {
      name: 'Feral Rage',
      weights: { might: 0.65, spirit: 0.35 },
      dmgMul: 1.12,
      rangeMul: 0.9,
      cdMul: 0.92,
      aoeMul: 1.04,
      cost: { type: 'sta', amount: 20 }
    },
    electrical: {
      name: 'Primal Spark',
      weights: { swift: 0.5, spirit: 0.4, might: 0.2 },
      dmgMul: 1.08,
      rangeMul: 0.94,
      cdMul: 0.84,
      aoeMul: 1.1,
      cost: { type: 'sta', amount: 16 }
    }
  }
};

export const ITEMS = {
  ashbrand: {
    id: 'ashbrand',
    name: 'Ashbrand',
    slot: 'weapon',
    weaponType: 'GREATSWORD',
    stats: { might: 4, vital: 1 },
    skillScalar: 1.06,
    abilities: ['earth'],
    abilityNames: { earth: 'Heroic Cleave' },
    blurb: 'Two-hand practice blade. The 1-2-3 lives here.'
  },
  gravemark: {
    id: 'gravemark',
    name: 'Gravemark',
    slot: 'weapon',
    weaponType: 'GREATSWORD',
    stats: { might: 7, vital: 2 },
    skillScalar: 1.14,
    abilities: ['earth'],
    abilityNames: { earth: 'Grudge of Ages' },
    blurb: 'Heavier. The dummy notices.'
  },
  frosthaft: {
    id: 'frosthaft',
    name: 'Frosthaft',
    slot: 'weapon',
    weaponType: 'FROST_STAFF',
    stats: { mind: 5, spirit: 1 },
    skillScalar: 1.08,
    rangeMul: 1.05,
    abilities: ['iceNova'],
    abilityNames: { iceNova: 'Glacial Shield' },
    blurb: 'Mage wood. Holds a lance without smoking.'
  },
  starwell: {
    id: 'starwell',
    name: 'Starwell',
    slot: 'weapon',
    weaponType: 'HOLY_STAFF',
    stats: { mind: 8, spirit: 3 },
    skillScalar: 1.18,
    rangeMul: 1.1,
    abilities: ['aether'],
    abilityNames: { aether: 'Word Shield' },
    blurb: 'A later staff. The needle runs farther.'
  },
  thornbrand: {
    id: 'thornbrand',
    name: 'Thornbrand',
    slot: 'weapon',
    weaponType: 'SWORD',
    stats: { swift: 5, might: 1 },
    skillScalar: 1.04,
    rangeMul: 1.1,
    cdr: 0.04,
    abilities: ['cinderSlash'],
    abilityNames: { cinderSlash: 'Quick Cut' },
    blurb: 'Ranger steel. A cut that wants distance.'
  },
  skybarb: {
    id: 'skybarb',
    name: 'Skybarb',
    slot: 'weapon',
    weaponType: 'SWORD',
    stats: { swift: 8, might: 2, mind: 1 },
    skillScalar: 1.1,
    rangeMul: 1.16,
    cdr: 0.07,
    abilities: ['cinderSlash'],
    abilityNames: { cinderSlash: 'Sky Cut' },
    blurb: 'Light, long, impatient.'
  },
  ironvisor: {
    id: 'ironvisor',
    name: 'Iron Visor',
    slot: 'helm',
    stats: { vital: 3, might: 1 },
    blurb: 'Keeps a face on a dummy lane.'
  },
  runecirclet: {
    id: 'runecirclet',
    name: 'Rune Circlet',
    slot: 'helm',
    stats: { mind: 3, spirit: 1 },
    rangeMul: 1.03,
    blurb: 'A thin ring. The staff listens.'
  },
  trailhood: {
    id: 'trailhood',
    name: 'Trail Hood',
    slot: 'helm',
    stats: { swift: 3, mind: 1 },
    cdr: 0.03,
    blurb: 'Cuts the wind, not the view.'
  },
  valhelm: {
    id: 'valhelm',
    name: 'Valhalla Helm',
    slot: 'helm',
    stats: { might: 2, swift: 2, mind: 2, vital: 2, spirit: 2 },
    skillScalar: 1.04,
    abilities: ['pyre'],
    abilityNames: { pyre: 'War Cry' },
    blurb: "The grove's own. Everything a little more."
  },
  warplate: {
    id: 'warplate',
    name: 'Warplate',
    slot: 'chest',
    stats: { vital: 5, might: 2 },
    skillScalar: 1.04,
    abilities: ['earth'],
    abilityNames: { earth: 'Bulwark Stomp' },
    blurb: 'Weight that turns into a hit.'
  },
  runecoat: {
    id: 'runecoat',
    name: 'Runecoat',
    slot: 'chest',
    stats: { mind: 4, spirit: 2, vital: 1 },
    blurb: 'Script along the seams. Mana sits easier.'
  },
  trailcoat: {
    id: 'trailcoat',
    name: 'Trail Leathers',
    slot: 'chest',
    stats: { swift: 4, vital: 2, might: 1 },
    cdr: 0.03,
    blurb: 'Quiet, and it does not snag a draw.'
  },
  groveplate: {
    id: 'groveplate',
    name: 'Grove Plate',
    slot: 'chest',
    stats: { vital: 4, spirit: 3, might: 1 },
    skillScalar: 1.07,
    abilities: ['kraken'],
    abilityNames: { kraken: 'Grove Pulse' },
    blurb: "Totem-worked. The dummy's cousin."
  },
  tyrstoken: {
    id: 'tyrstoken',
    name: "Tyr's Token",
    slot: 'relic',
    stats: { might: 4 },
    cdr: 0.05,
    skillScalar: 1.03,
    abilities: ['thunder'],
    abilityNames: { thunder: "Tyr's Strike" },
    blurb: 'A hand that does not miss the cut.'
  },
  odineye: {
    id: 'odineye',
    name: "Odin's Eye",
    slot: 'relic',
    stats: { mind: 4, spirit: 1 },
    rangeMul: 1.08,
    abilities: ['beam'],
    abilityNames: { beam: "Allfather's Gaze" },
    blurb: 'See the far end of the lance before it leaves.'
  },
  lokicoin: {
    id: 'lokicoin',
    name: "Loki's Coin",
    slot: 'relic',
    stats: { swift: 4, mind: 1 },
    cdr: 0.08,
    abilities: ['portal'],
    abilityNames: { portal: "Loki's Step" },
    blurb: 'Spent twice. Cooldown notices.'
  },
  valsigil: {
    id: 'valsigil',
    name: 'Valhalla Sigil',
    slot: 'relic',
    stats: { might: 2, swift: 2, mind: 2, vital: 2, spirit: 2 },
    skillScalar: 1.08,
    rangeMul: 1.04,
    cdr: 0.04,
    abilities: ['kraken'],
    abilityNames: { kraken: 'Valhalla Call' },
    blurb: "The ring's own seal. Everything scales."
  },
  oakbow: {
    id: 'oakbow',
    name: 'Oak Bow',
    slot: 'weapon',
    weaponType: 'BOW',
    stats: { swift: 6, might: 1 },
    skillScalar: 1.05,
    rangeMul: 1.14,
    cdr: 0.05,
    abilities: ['aether'],
    abilityNames: { aether: 'Focus Shot' },
    blurb: 'Ranger wood. A long, quiet draw.'
  },
  stonemaul: {
    id: 'stonemaul',
    name: 'Stone Maul',
    slot: 'weapon',
    weaponType: 'HAMMER2H',
    stats: { might: 8, vital: 2 },
    skillScalar: 1.16,
    rangeMul: 0.92,
    abilities: ['earth'],
    abilityNames: { earth: 'Ground Slam' },
    blurb: 'Raider iron. Slow, and the dummy feels it.'
  },
  wardshield: {
    id: 'wardshield',
    name: 'Ward Shield',
    slot: 'offhand',
    stats: { vital: 5, might: 1 },
    skillScalar: 1.04,
    abilities: ['electrical'],
    abilityNames: { electrical: 'Shield Bash' },
    blurb: 'A grove face. Holds the line.'
  },
  voidtome: {
    id: 'voidtome',
    name: 'Void Tome',
    slot: 'offhand',
    stats: { mind: 5, spirit: 2 },
    skillScalar: 1.1,
    rangeMul: 1.06,
    abilities: ['iceNova'],
    abilityNames: { iceNova: 'Page of Night' },
    blurb: 'Priest paper. The page does not end.'
  },
  hewingaxe: {
    id: 'hewingaxe',
    name: 'Hewing Axe',
    slot: 'weapon',
    weaponType: 'AXE',
    stats: { might: 5, swift: 1 },
    skillScalar: 1.08,
    abilities: ['pyre'],
    abilityNames: { pyre: 'Bloodletting' },
    blurb: '1H axe. The grove remembers the cut.'
  },
  boneknife: {
    id: 'boneknife',
    name: 'Bone Knife',
    slot: 'weapon',
    weaponType: 'DAGGER',
    stats: { swift: 6, might: 1 },
    skillScalar: 1.04,
    cdr: 0.05,
    abilities: ['portal'],
    abilityNames: { portal: 'Phantom Dash' },
    blurb: 'Thief steel. In, then out.'
  },
  ashspear: {
    id: 'ashspear',
    name: 'Ash Spear',
    slot: 'weapon',
    weaponType: 'SPEAR',
    stats: { might: 3, swift: 3 },
    skillScalar: 1.06,
    rangeMul: 1.12,
    abilities: ['aether'],
    abilityNames: { aether: 'Pole Guard' },
    blurb: 'Long wood. The dummy is still in reach.'
  },
  oathmace: {
    id: 'oathmace',
    name: 'Oath Mace',
    slot: 'weapon',
    weaponType: 'MACE',
    stats: { might: 5, vital: 2 },
    skillScalar: 1.07,
    abilities: ['electrical'],
    abilityNames: { electrical: 'Consecrate' },
    blurb: '1H crush. Honor in the plant.'
  },
  handhammer: {
    id: 'handhammer',
    name: 'Hand Hammer',
    slot: 'weapon',
    weaponType: 'HAMMER',
    stats: { might: 5, vital: 1 },
    skillScalar: 1.08,
    abilities: ['thunder'],
    abilityNames: { thunder: 'Skullbash' },
    blurb: '1H hammer. Step into the hit.'
  },
  clangreat: {
    id: 'clangreat',
    name: 'Clan Greatsword',
    slot: 'weapon',
    weaponType: 'GREATSWORD',
    stats: { might: 7, vital: 1 },
    skillScalar: 1.12,
    rangeMul: 1.04,
    abilities: ['earth'],
    abilityNames: { earth: 'Great Cleave' },
    blurb: 'Two-hand blade. Walk the cut in.'
  },
  rendaxe: {
    id: 'rendaxe',
    name: 'Rend Greataxe',
    slot: 'weapon',
    weaponType: 'GREATAXE',
    stats: { might: 8, vital: 1 },
    skillScalar: 1.14,
    abilities: ['pyre'],
    abilityNames: { pyre: 'Ragnarok Cleave' },
    blurb: 'Two-hand axe. Commit the body.'
  },
  siegebow: {
    id: 'siegebow',
    name: 'Siege Crossbow',
    slot: 'weapon',
    weaponType: 'CROSSBOW',
    stats: { swift: 5, might: 2 },
    skillScalar: 1.08,
    rangeMul: 1.1,
    abilities: ['earth'],
    abilityNames: { earth: 'Pinning Bolt' },
    blurb: 'Heavy bolt. Kick off the line after.'
  },
  flintgun: {
    id: 'flintgun',
    name: 'Flint Gun',
    slot: 'weapon',
    weaponType: 'GUN',
    stats: { swift: 6, might: 1 },
    skillScalar: 1.07,
    rangeMul: 1.08,
    cdr: 0.04,
    abilities: ['thunder'],
    abilityNames: { thunder: 'Explosive Round' },
    blurb: 'Powder and distance. Recoil is the kite.'
  },
  cinderstaff: {
    id: 'cinderstaff',
    name: 'Cinder Staff',
    slot: 'weapon',
    weaponType: 'FIRE_STAFF',
    stats: { mind: 6, spirit: 1 },
    skillScalar: 1.1,
    rangeMul: 1.06,
    abilities: ['pyre'],
    abilityNames: { pyre: 'Flame Wave' },
    blurb: 'Fire wood. Cast, then give ground.'
  },
  stormstaff: {
    id: 'stormstaff',
    name: 'Storm Staff',
    slot: 'weapon',
    weaponType: 'LIGHTNING_STAFF',
    stats: { mind: 5, swift: 2 },
    skillScalar: 1.09,
    rangeMul: 1.05,
    abilities: ['electrical'],
    abilityNames: { electrical: 'Chain Lightning' },
    blurb: 'Lightning wood. Arc, then hop off.'
  },
  voidstaff: {
    id: 'voidstaff',
    name: 'Void Staff',
    slot: 'weapon',
    weaponType: 'ARCANE_STAFF',
    stats: { mind: 6, spirit: 2 },
    skillScalar: 1.12,
    rangeMul: 1.08,
    abilities: ['beam'],
    abilityNames: { beam: 'Arcane Barrage' },
    blurb: 'Arcane wood. Warp, then open space.'
  },
  warleggings: {
    id: 'warleggings',
    name: 'War Leggings',
    slot: 'legs',
    stats: { vital: 3, might: 1 },
    blurb: 'Plate that plants the stance.'
  },
  runeleggings: {
    id: 'runeleggings',
    name: 'Rune Leggings',
    slot: 'legs',
    stats: { mind: 2, spirit: 2 },
    blurb: 'Scripted cloth. Mana walks easier.'
  },
  trailpants: {
    id: 'trailpants',
    name: 'Trail Pants',
    slot: 'legs',
    stats: { swift: 3, agility: 1 },
    cdr: 0.02,
    blurb: 'Quiet step. The draw does not snag.'
  },
  wargauntlets: {
    id: 'wargauntlets',
    name: 'War Gauntlets',
    slot: 'hands',
    stats: { might: 2, vital: 1 },
    abilities: ['thunder'],
    abilityNames: { thunder: 'Gauntlet Smash' },
    blurb: 'A fist that still holds a hilt.'
  },
  runegloves: {
    id: 'runegloves',
    name: 'Rune Gloves',
    slot: 'hands',
    stats: { mind: 2, spirit: 1 },
    rangeMul: 1.03,
    blurb: 'Thread that listens to a staff.'
  },
  warboots: {
    id: 'warboots',
    name: 'War Boots',
    slot: 'feet',
    stats: { vital: 2, endurance: 1 },
    blurb: 'Weight that does not slip.'
  },
  trailboots: {
    id: 'trailboots',
    name: 'Trail Boots',
    slot: 'feet',
    stats: { swift: 3 },
    cdr: 0.03,
    abilities: ['portal'],
    abilityNames: { portal: 'Evasive Roll' },
    blurb: 'A step that is already gone.'
  },
  warpads: {
    id: 'warpads',
    name: 'War Pauldrons',
    slot: 'shoulders',
    stats: { might: 2, vital: 1 },
    blurb: 'The first thing a dummy sees.'
  },
  runemantle: {
    id: 'runemantle',
    name: 'Rune Mantle',
    slot: 'shoulders',
    stats: { mind: 2, spirit: 1 },
    blurb: 'Cloth that carries a school.'
  },
  crusadecloak: {
    id: 'crusadecloak',
    name: 'Crusade Cloak',
    slot: 'back',
    stats: { might: 2, vital: 2 },
    abilities: ['firePortal'],
    abilityNames: { firePortal: 'Banner Charge' },
    blurb: 'Odin cloth. The line follows it.'
  },
  fabledcape: {
    id: 'fabledcape',
    name: 'Fabled Cape',
    slot: 'back',
    stats: { mind: 2, spirit: 2 },
    abilities: ['aether'],
    abilityNames: { aether: 'Omni Veil' },
    blurb: 'Arcane weave. The eldest banner.'
  },
  legioncloak: {
    id: 'legioncloak',
    name: 'Legion Cloak',
    slot: 'back',
    stats: { might: 2, swift: 2 },
    abilities: ['pyre'],
    abilityNames: { pyre: 'Blood Banner' },
    blurb: 'Madra cloth. It wants a fight.'
  }
};

export const DEFAULT_INVENTORY = Object.keys(ITEMS);

export const SKILL_BY_ID = Object.fromEntries(SKILL_CATALOG.map((row) => [row.id, row]));

export function itemsForSlot(slot, inventory = DEFAULT_INVENTORY) {
  return inventory.filter((id) => ITEMS[id]?.slot === slot);
}

/** Active skills an item puts on the HUD. Combo 1-2-3 is the weapon type, not here. */
export function abilitiesOf(item) {
  if (!item) return [];
  const list = [];
  if (item.ability) list.push(item.ability);
  if (Array.isArray(item.abilities)) list.push(...item.abilities);
  if (item.signature) list.push(item.signature);
  return list.filter(Boolean);
}

export function abilityNameOf(item, skillId) {
  if (!item || !skillId) return null;
  return item.abilityNames?.[skillId] ?? null;
}

export function variantOf(classId, skillId) {
  return VARIANTS[classId]?.[skillId] ?? null;
}

export function combatOf(skillId) {
  return SKILL_COMBAT[skillId] ?? null;
}

export function metaOf(skillId) {
  return ELEMENT_META[skillId] ?? null;
}

export function defaultSave() {
  const klass = CLASSES.warrior;
  return {
    version: 4,
    raceId: 'human',
    classId: 'warrior',
    level: 1,
    xp: 0,
    equipped: { ...klass.gear },
    inventory: [...DEFAULT_INVENTORY],
    weaponType: 'GREATSWORD'
  };
}

