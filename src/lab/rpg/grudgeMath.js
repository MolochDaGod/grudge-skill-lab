// @ts-nocheck
/**
 * Canonical Warlords attribute math.
 *
 * SSOT: objectstore `master-attributes.json` v2.1.0 (WCS attributeSystem.ts)
 * + `_meta/weapon-stats-attributes.json`. `attributes.json` is archived.
 *
 * Eight ATTR-* ids. Thirty-seven derived / secondary stats. Three resource
 * pools (HP / MP / SP) plus armour. Need pools (O2 / hunger / thirst) are
 * not allocation attributes.
 *
 * Allocation: 20 start + 7/level, cap 160, diminishing returns after 25.
 * Combat pipeline (master-attributes.combatFormulas):
 *   taken = incoming × (100 − √defense) / 100
 *   if rand < block → taken × (1 − blockEffect); blocked hits cannot crit
 *   if rand < crit  → taken × critFactor
 *   debuff = clamp(accuracy − resistance, 5%, 95%)
 */

export const ATTR_VERSION = '2.1.0';
export const ATTR_URL = 'https://objectstore.grudge-studio.com/api/v1/master-attributes.json';
export const ATTR_META_URL =
  'https://objectstore.grudge-studio.com/api/v1/_meta/weapon-stats-attributes.json';

export const ATTR_ORDER = [
  'strength',
  'vitality',
  'endurance',
  'intellect',
  'wisdom',
  'dexterity',
  'agility',
  'tactics'
];

export const ATTR_ABBREV = {
  strength: 'STR',
  vitality: 'VIT',
  endurance: 'END',
  intellect: 'INT',
  wisdom: 'WIS',
  dexterity: 'DEX',
  agility: 'AGI',
  tactics: 'TAC'
};

export const ALLOCATION = {
  startingPoints: 20,
  pointsPerLevel: 7,
  maxLevel: 20,
  maxPoints: 160,
  diminishingReturns: { threshold: 25, tier1: 0.5, tier2: 0.25 }
};

/** Weapon / design-layer primaryStat → ATTR (weapon-stats-attributes.json). */
export const PRIMARY_STAT_TO_ATTR = {
  damage: 'strength',
  block: 'strength',
  defense: 'vitality',
  crit: 'dexterity',
  burn: 'intellect',
  lifesteal: 'strength',
  armorPen: 'tactics',
  speed: 'agility',
  mana: 'intellect',
  health: 'vitality',
  heal: 'wisdom',
  stun: 'endurance',
  range: 'tactics',
  fire: 'intellect',
  bleed: 'dexterity',
  charge: 'strength',
  combo: 'dexterity',
  hp: 'vitality',
  slow: 'agility',
  freeze: 'intellect',
  root: 'wisdom',
  luck: 'dexterity',
  quality: 'tactics',
  efficiency: 'endurance'
};

export const DAMAGE_TYPE_SCALING = {
  physical: ['strength', 'dexterity'],
  nature: ['wisdom', 'intellect'],
  arcane: ['intellect', 'wisdom'],
  fire: ['intellect', 'wisdom'],
  frost: ['intellect', 'wisdom'],
  holy: ['wisdom', 'intellect'],
  lightning: ['intellect', 'dexterity'],
  poison: ['dexterity', 'intellect']
};

export const WEAPON_PRIMARY_ATTR = {
  SWORD: 'strength',
  AXE: 'strength',
  GREATSWORD: 'strength',
  GREATAXE: 'strength',
  HAMMER: 'strength',
  HAMMER2H: 'strength',
  SPEAR: 'dexterity',
  DAGGER: 'dexterity',
  BOW: 'dexterity',
  CROSSBOW: 'dexterity',
  GUN: 'dexterity',
  FIRE_STAFF: 'intellect',
  FROST_STAFF: 'intellect',
  HOLY_STAFF: 'intellect',
  LIGHTNING_STAFF: 'intellect',
  ARCANE_STAFF: 'intellect',
  STAFF: 'intellect',
  WAND: 'intellect',
  TOME: 'intellect',
  SHIELD: 'vitality',
  MACE: 'intellect'
};

export const COMBAT_FORMULAS = {
  mitigation: 'Damage Taken = Incoming × (100 − √Defense) / 100',
  block: 'IF Random < Block Chance → Damage × (1 − Block Factor). Blocked hits cannot crit.',
  critical: 'IF Random < Crit Chance → Damage × Crit Factor',
  debuff: 'Success = clamp(Accuracy − Resistance, 5%, 95%)'
};

export const STAT_CAPS = {
  block: 0.75,
  blockEffect: 0.9,
  criticalChance: 0.75,
  criticalDamage: 3,
  accuracy: 0.95,
  resistance: 0.95,
  drainHealth: 0.5,
  manaRegen: 0.5,
  damageReduction: 0.5,
  healthRegen: 0.5,
  abilityCost: 0.5,
  defenseBreak: 0.75,
  blockPenetration: 0.75,
  criticalEvasion: 0.5,
  evasion: 0.5
};

const RATE = new Set([
  'block',
  'criticalChance',
  'accuracy',
  'resistance',
  'evasion',
  'dodge',
  'criticalEvasion',
  'ccResistance',
  'bleedResist',
  'spellblock',
  'cdrResist',
  'defenseBreakResist',
  'cooldownReduction',
  'drainHealth',
  'manaRegen',
  'healthRegen',
  'abilityCost',
  'damageReduction',
  'defenseBreak',
  'blockPenetration',
  'armorPenetration',
  'spellAccuracy',
  'comboCooldownRed'
]);

const FACTOR = new Set(['criticalDamage', 'blockEffect', 'attackSpeed', 'movementSpeed']);

export const ATTR_TABLE = [
  {
    id: 'strength',
    name: 'Strength',
    abbrev: 'STR',
    role: 'Tank / Melee DPS',
    color: '#e74c3c',
    icon: 'https://assets.grudge-studio.com/icons/sigils/strength.png',
    gains: {
      health: { flat: 26, percent: 0.8 },
      damage: { flat: 3, percent: 2 },
      defense: { flat: 12, percent: 1.5 },
      block: { flat: 0.5, percent: 5 },
      criticalChance: { flat: 0.32, percent: 7 },
      blockEffect: { flat: 0.85, percent: 26.3 },
      criticalDamage: { flat: 1.1, percent: 1.5 }
    }
  },
  {
    id: 'vitality',
    name: 'Vitality',
    abbrev: 'VIT',
    role: 'Tank / Survivability',
    color: '#27ae60',
    icon: 'https://assets.grudge-studio.com/icons/sigils/vitality.png',
    gains: {
      health: { flat: 25, percent: 0.5 },
      mana: { flat: 2, percent: 0.2 },
      stamina: { flat: 5, percent: 0.1 },
      damage: { flat: 2, percent: 0.1 },
      defense: { flat: 12 },
      blockEffect: { flat: 0.3, percent: 17 },
      resistance: { flat: 0.5 }
    }
  },
  {
    id: 'endurance',
    name: 'Endurance',
    abbrev: 'END',
    role: 'Defensive Specialist',
    color: '#95a5a6',
    icon: 'https://assets.grudge-studio.com/icons/sigils/endurance.png',
    gains: {
      health: { flat: 10, percent: 0.1 },
      stamina: { flat: 1, percent: 0.3 },
      defense: { flat: 12, percent: 12 },
      block: { flat: 0.11, percent: 73.5 },
      blockEffect: { flat: 0.27 },
      resistance: { flat: 0.46 }
    }
  },
  {
    id: 'intellect',
    name: 'Intellect',
    abbrev: 'INT',
    role: 'Mage / Caster',
    color: '#3498db',
    icon: 'https://assets.grudge-studio.com/icons/sigils/intellect.png',
    gains: {
      mana: { flat: 5, percent: 5 },
      damage: { flat: 4, percent: 2.5 },
      defense: { flat: 2 },
      criticalChance: { flat: 0.23, percent: 0.1 },
      accuracy: { flat: 0.12, percent: 33.8 },
      resistance: { flat: 0.38, percent: 17 }
    }
  },
  {
    id: 'wisdom',
    name: 'Wisdom',
    abbrev: 'WIS',
    role: 'Healer / Support',
    color: '#9b59b6',
    icon: 'https://assets.grudge-studio.com/icons/sigils/wisdom.png',
    gains: {
      health: { flat: 10 },
      mana: { flat: 20, percent: 3 },
      damage: { flat: 2, percent: 1.5 },
      defense: { flat: 2 },
      criticalChance: { flat: 0.5, percent: 0.15 },
      resistance: { flat: 0.5 }
    }
  },
  {
    id: 'dexterity',
    name: 'Dexterity',
    abbrev: 'DEX',
    role: 'Rogue / Precision Fighter',
    color: '#f39c12',
    icon: 'https://assets.grudge-studio.com/icons/sigils/dexterity.png',
    gains: {
      damage: { flat: 3, percent: 1.8 },
      defense: { flat: 10, percent: 1 },
      block: { flat: 0.41, percent: 1 },
      criticalChance: { flat: 0.5, percent: 1.2 },
      accuracy: { flat: 0.7, percent: 1.5 }
    }
  },
  {
    id: 'agility',
    name: 'Agility',
    abbrev: 'AGI',
    role: 'Mobile DPS / Dodge Tank',
    color: '#1abc9c',
    icon: 'https://assets.grudge-studio.com/icons/sigils/agility.png',
    gains: {
      health: { flat: 2, percent: 0.6 },
      stamina: { flat: 5, percent: 0.5 },
      damage: { flat: 3, percent: 1.6 },
      defense: { flat: 5, percent: 0.8 },
      criticalChance: { flat: 0.42, percent: 1 }
    }
  },
  {
    id: 'tactics',
    name: 'Tactics',
    abbrev: 'TAC',
    role: 'Strategic Fighter / Commander',
    color: '#34495e',
    icon: 'https://assets.grudge-studio.com/icons/sigils/tactics.png',
    gains: {
      health: { flat: 10, percent: 8.4 },
      mana: { percent: 8.2 },
      stamina: { flat: 1 },
      damage: { flat: 3, percent: 0.2 },
      defense: { flat: 5, percent: 0.5 },
      block: { flat: 0.27, percent: 0.8 }
    }
  }
];

export const ATTR_BY_ID = Object.fromEntries(ATTR_TABLE.map((row) => [row.id, row]));

export const SECONDARY_GROUPS = [
  {
    id: 'pools',
    label: 'Resource pools',
    keys: ['health', 'mana', 'stamina', 'armor']
  },
  {
    id: 'offense',
    label: 'Offense',
    keys: [
      'damage',
      'criticalChance',
      'criticalDamage',
      'attackSpeed',
      'accuracy',
      'spellAccuracy',
      'armorPenetration',
      'defenseBreak',
      'blockPenetration',
      'statusEffect'
    ]
  },
  {
    id: 'defense',
    label: 'Defense',
    keys: [
      'defense',
      'block',
      'blockEffect',
      'resistance',
      'evasion',
      'dodge',
      'criticalEvasion',
      'ccResistance',
      'damageReduction',
      'spellblock',
      'bleedResist',
      'cdrResist',
      'defenseBreakResist'
    ]
  },
  {
    id: 'utility',
    label: 'Utility',
    keys: [
      'cooldownReduction',
      'comboCooldownRed',
      'movementSpeed',
      'drainHealth',
      'manaRegen',
      'healthRegen',
      'abilityCost',
      'stagger',
      'reflexTime',
      'fallDamage'
    ]
  }
];

export const STAT_LABEL = {
  health: 'Health',
  mana: 'Mana',
  stamina: 'Stamina',
  armor: 'Armour',
  damage: 'Damage',
  defense: 'Defense',
  block: 'Block',
  blockEffect: 'Block factor',
  evasion: 'Evasion',
  accuracy: 'Accuracy',
  criticalChance: 'Crit chance',
  criticalDamage: 'Crit factor',
  attackSpeed: 'Attack speed',
  movementSpeed: 'Move speed',
  resistance: 'Resistance',
  cdrResist: 'CDR resist',
  defenseBreakResist: 'Def-break resist',
  armorPenetration: 'Armor pen',
  blockPenetration: 'Block pen',
  defenseBreak: 'Defense break',
  drainHealth: 'Lifesteal',
  manaRegen: 'Mana on hit',
  healthRegen: 'Heal on hit',
  cooldownReduction: 'CDR',
  abilityCost: 'Cost return',
  spellAccuracy: 'Spell accuracy',
  stagger: 'Stagger',
  ccResistance: 'CC resist',
  damageReduction: 'Reflect',
  bleedResist: 'Bleed resist',
  statusEffect: 'Status power',
  spellblock: 'Spell block',
  dodge: 'Dodge',
  reflexTime: 'Reflex',
  criticalEvasion: 'Crit evasion',
  fallDamage: 'Fall reduction',
  comboCooldownRed: 'Combo CDR'
};

const BASE = {
  health: 100,
  mana: 40,
  stamina: 50,
  armor: 0,
  damage: 12,
  defense: 8,
  block: 0.04,
  blockEffect: 0.18,
  criticalChance: 0.05,
  criticalDamage: 1.5,
  accuracy: 0.7,
  resistance: 0.05,
  attackSpeed: 1,
  movementSpeed: 1,
  evasion: 0.02,
  dodge: 0.02
};

/**
 * Diminishing returns on allocated points (threshold 25 → 50%, then 25%).
 */
export function effectivePoints(n) {
  const x = Math.max(0, Number(n) || 0);
  const t = ALLOCATION.diminishingReturns.threshold;
  const a = Math.min(x, t);
  const b = Math.min(Math.max(x - t, 0), t);
  const c = Math.max(x - t * 2, 0);
  return a + b * ALLOCATION.diminishingReturns.tier1 + c * ALLOCATION.diminishingReturns.tier2;
}

function emptyDerived() {
  const out = {};
  for (const group of SECONDARY_GROUPS) {
    for (const key of group.keys) out[key] = BASE[key] ?? 0;
  }
  return out;
}

function capStat(key, value) {
  const cap = STAT_CAPS[key];
  if (cap == null) return value;
  return Math.min(cap, Math.max(0, value));
}

/**
 * Fold the 8 ATTR ratings into the 37 secondaries.
 * Chance stats: `flat` is percentage points. Factor stats: `flat` is percent of 1.0.
 */
export function deriveStats(attrRatings = {}) {
  const derived = emptyDerived();
  const flats = {};
  const percents = {};

  for (const attr of ATTR_TABLE) {
    const points = effectivePoints(attrRatings[attr.id] || 0);
    if (points <= 0) continue;
    for (const [stat, gain] of Object.entries(attr.gains || {})) {
      flats[stat] = (flats[stat] || 0) + (gain.flat || 0) * points;
      percents[stat] = (percents[stat] || 0) + (gain.percent || 0) * points;
    }
  }

  for (const stat of Object.keys({ ...derived, ...flats, ...percents })) {
    let value = BASE[stat] ?? 0;
    const flat = flats[stat] || 0;
    const pct = percents[stat] || 0;
    if (RATE.has(stat)) {
      value = (value * 100 + flat) / 100;
      value *= 1 + pct / 100;
    } else if (FACTOR.has(stat)) {
      value = value + flat / 100;
      value *= 1 + pct / 100;
    } else {
      value = value + flat;
      value *= 1 + pct / 100;
    }
    derived[stat] = capStat(stat, value);
  }

  derived.armor = derived.defense * 0.35;
  return derived;
}

export function formatSecondary(key, value) {
  if (!Number.isFinite(value)) return '—';
  if (RATE.has(key)) return `${Math.round(value * 1000) / 10}%`;
  if (key === 'criticalDamage' || key === 'blockEffect' || key === 'attackSpeed' || key === 'movementSpeed') {
    return `${Math.round(value * 100) / 100}×`;
  }
  return String(Math.round(value));
}

/**
 * Official mitigation + block/crit roll.
 * Defender supplies defense/block; attacker supplies crit.
 * Blocked hits cannot crit (combatFormulas.critical).
 *
 * mitigateIncoming(incoming, defender, attacker?, rng?)
 * Third arg may be a rng function for the two-argument test form.
 */
export function mitigateIncoming(incoming, defender = {}, attackerOrRng, rng) {
  let attacker = {};
  let rand = Math.random;
  if (typeof attackerOrRng === 'function') rand = attackerOrRng;
  else if (attackerOrRng && typeof attackerOrRng === 'object') {
    attacker = attackerOrRng;
    if (typeof rng === 'function') rand = rng;
  }
  const defense = Math.max(0, defender.defense || 0);
  let taken = (incoming * (100 - Math.sqrt(defense))) / 100;
  const blocked = rand() < (defender.block || 0);
  if (blocked) taken *= 1 - (defender.blockEffect || 0);
  const chance = attacker.criticalChance ?? 0;
  const factor = attacker.criticalDamage ?? 1.5;
  const crit = !blocked && rand() < chance;
  if (crit) taken *= factor;
  const rounded = Math.max(1, Math.round(taken));
  return {
    taken: rounded,
    blocked,
    crit,
    mitigated: Math.max(0, incoming - rounded)
  };
}

/** Training dummy sits in the official mitigation curve. */
export function dummyDefenseFor(level) {
  return 48 + Math.max(1, level || 1) * 7;
}

export function dummyDerivedFor(level) {
  const lvl = Math.max(1, level || 1);
  return {
    defense: dummyDefenseFor(lvl),
    block: Math.min(0.22, 0.05 + lvl * 0.005),
    blockEffect: 0.26,
    resistance: 0.08
  };
}

export function debuffChance(attacker, defender) {
  const acc = attacker?.accuracy ?? 0.7;
  const res = defender?.resistance ?? 0.05;
  return Math.max(0.05, Math.min(0.95, acc - res));
}

export function pointsBudget(level) {
  const lvl = Math.max(1, Math.min(ALLOCATION.maxLevel, level || 1));
  return Math.min(
    ALLOCATION.maxPoints,
    ALLOCATION.startingPoints + ALLOCATION.pointsPerLevel * (lvl - 1)
  );
}

export function allocationSpent(stats = {}, gearStats = {}) {
  let spent = 0;
  for (const key of ATTR_ORDER) {
    spent += (stats[key] || 0) - (gearStats[key] || 0);
  }
  return Math.max(0, spent);
}

export function takenPercent(defense) {
  const d = Math.max(0, defense || 0);
  return Math.max(0, Math.round((100 - Math.sqrt(d)) * 10) / 10);
}

/** Shared markup for the sheet Stats block and the combat-panel Stats tab. */
export function attrSheetHtml(snap = {}) {
  const stats = snap.stats || {};
  const gear = snap.gear?.stats || {};
  const derived = snap.derived || deriveStats(stats);
  const shown = { ...derived };
  if (snap.hpMax != null) shown.health = snap.hpMax;
  if (snap.mpMax != null) shown.mana = snap.mpMax;
  if (snap.staMax != null) shown.stamina = snap.staMax;
  const level = snap.level || 1;
  const budget = snap.allocation?.budget ?? pointsBudget(level);
  const spent = snap.allocation?.spent ?? allocationSpent(stats, gear);
  const attrs = ATTR_TABLE.map((row) => {
    const total = stats[row.id] || 0;
    const fromGear = gear[row.id] || 0;
    const eff = effectivePoints(total);
    const over = total > ALLOCATION.diminishingReturns.threshold;
    const note = over ? `eff ${Math.round(eff * 10) / 10}` : fromGear ? `+${fromGear} gear` : 'base';
    return `<div class="rpg-attr" style="--attr:${row.color}" title="${row.name} · ${row.role}">
      <i class="rpg-attr__swatch" aria-hidden="true"></i>
      <span>${row.abbrev}</span>
      <b>${total}</b>
      <em>${note}</em>
    </div>`;
  }).join('');

  const groups = SECONDARY_GROUPS.map((group) => {
    const rows = group.keys
      .map((key) => {
        const value = shown[key];
        return `<div class="rpg-sec"><span>${STAT_LABEL[key] || key}</span><b>${formatSecondary(key, value)}</b></div>`;
      })
      .join('');
    return `<div class="rpg-sec-group"><h4>${group.label}</h4><div class="rpg-sec-grid">${rows}</div></div>`;
  }).join('');

  const def = derived.defense || 0;
  return `
    <div class="rpg-attr-grid">${attrs}</div>
    <p class="rpg-attr-note">Allocation ${spent} / ${budget} · 20 start + 7/level · DR after 25 · master-attributes v${ATTR_VERSION}</p>
    ${groups}
    <div class="rpg-formulas">
      <p>${COMBAT_FORMULAS.mitigation}</p>
      <p>${COMBAT_FORMULAS.block}</p>
      <p>${COMBAT_FORMULAS.critical}</p>
      <p>${COMBAT_FORMULAS.debuff}</p>
      <p>Your defense ${Math.round(def)} → you would take ${takenPercent(def)}% of incoming. Dummy uses its own defense.</p>
    </div>`;
}
