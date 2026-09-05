// @ts-nocheck
/**
 * The player: race, class, gear, pools, and the resolver that turns a lab
 * skill id into the numbers this character actually throws.
 *
 * Cache is invalidated on any mutate (equip, class, race, level). Frame code
 * may call `resolve` as often as it likes.
 */

import { settings, castShapeOf, ELEMENT_META } from '../config/settings.js';
import {
  CLASSES,
  RACES,
  FACTIONS,
  ITEMS,
  SKILL_BY_ID,
  combatOf,
  variantOf,
  defaultSave,
  itemsForSlot,
  abilitiesOf,
  abilityNameOf,
  RACE_ALIASES,
  CLASS_ALIASES
} from './catalog.js';
import {
  defaultWeaponFor,
  getWeapon,
  comboHit,
  canonicalWeapon,
  classCanUse,
  CLASS_BONES,
  HUD_SLOT_COUNT
} from './weapons.js';
import {
  STAT_KEYS,
  GEAR_SLOTS,
  MAX_LEVEL,
  combineStats,
  sumGear,
  poolMax,
  xpToNext,
  statPower,
  weaponMatch,
  scaleRange,
  scaleCooldown,
  scaleAoe,
  regenRates,
  clamp
} from './formulas.js';
import { classFSkill } from './totems.js';

function copyEquip(src) {
  const out = {};
  for (const slot of GEAR_SLOTS) out[slot] = src?.[slot] ?? null;
  return out;
}

function skillLabel(skillId, row) {
  return ELEMENT_META[skillId]?.label ?? row?.catalogId?.replace(/_/g, ' ') ?? skillId;
}

const GRANT_ORDER = [
  'weapon',
  'offhand',
  'relic',
  'back',
  'helm',
  'shoulders',
  'chest',
  'hands',
  'legs',
  'feet'
];

function composeLoadout(equipped, weaponTypeId, classId) {
  const weapon = getWeapon(weaponTypeId);
  const combo = weapon.combo.map((hit) => hit.id);
  const sources = {};
  const seen = new Set();
  const slots = [];

  const push = (skillId, source) => {
    if (!skillId || seen.has(skillId)) return;
    seen.add(skillId);
    slots.push(skillId);
    sources[skillId] = source;
  };

  for (const id of combo) push(id, 'weapon');

  for (const slot of GRANT_ORDER) {
    const item = ITEMS[equipped?.[slot]];
    if (!item) continue;
    for (const skill of abilitiesOf(item)) push(skill, item.id);
  }

  const klass = CLASSES[classId];
  const fSkill = classFSkill(classId);
  if (fSkill) push(fSkill, 'class');
  for (const id of klass?.loadout || []) push(id, 'class');

  return { slots: slots.slice(0, HUD_SLOT_COUNT), sources };
}

export class Actor {
  constructor(save = defaultSave()) {
    const raceId = RACE_ALIASES[save.raceId] || save.raceId;
    const classId = CLASS_ALIASES[save.classId] || save.classId;
    this.raceId = RACES[raceId] ? raceId : 'human';
    this.classId = CLASSES[classId] ? classId : 'warrior';
    this.level = clamp(save.level || 1, 1, MAX_LEVEL);
    this.xp = Math.max(0, save.xp || 0);
    this.equipped = copyEquip(save.equipped || CLASSES[this.classId].gear);
    this.inventory = Array.isArray(save.inventory) ? [...save.inventory] : [];
    this.weaponTypeId = defaultWeaponFor(
      this.classId,
      save.weaponType || ITEMS[this.equipped.weapon]?.weaponType || CLASSES[this.classId].weapon
    );
    this._stats = null;
    this._gear = null;
    this._pools = null;
    this._derived = null;
    this._loadout = null;
    this._sources = null;
    this._dirty = true;
    this.inCombat = 0;
    this.kills = save.kills || 0;

    const pools = this.pools();
    this.hp = save.hp != null ? clamp(save.hp, 0, pools.hp) : pools.hp;
    this.sta = save.sta != null ? clamp(save.sta, 0, pools.sta) : pools.sta;
    this.mp = save.mp != null ? clamp(save.mp, 0, pools.mp) : pools.mp;
  }

  get race() {
    return RACES[this.raceId];
  }

  get klass() {
    return CLASSES[this.classId];
  }

  get faction() {
    return FACTIONS[this.race?.faction] ?? FACTIONS.crusade;
  }

  get loadout() {
    this._refresh();
    return this._loadout;
  }

  get loadoutSources() {
    this._refresh();
    return this._sources;
  }

  get displayName() {
    return `${this.race.name} ${this.klass.name}`;
  }

  get title() {
    return this.faction.name;
  }

  get weaponType() {
    return this.weaponTypeId;
  }

  get weapon() {
    return getWeapon(this.weaponTypeId);
  }

  get bones() {
    const ids = new Set(CLASS_BONES[this.classId] || []);
    for (const slot of ['offhand', 'relic', 'back']) {
      if (this.equipped[slot]) ids.add(this.equipped[slot]);
    }
    return [...ids].filter((id) => ITEMS[id]);
  }

  markDirty() {
    this._dirty = true;
    this._stats = null;
    this._gear = null;
    this._pools = null;
    this._derived = null;
    this._loadout = null;
    this._sources = null;
  }

  _refresh() {
    if (!this._dirty) return;
    this._gear = sumGear(this.equipped, ITEMS);
    this._stats = combineStats(this.race, this.klass, this._gear.stats, this.level);
    this._derived = deriveStats(this._stats);
    this._pools = poolMax(this._stats, this.race, this.klass, this.level);
    const composed = composeLoadout(this.equipped, this.weaponTypeId, this.classId);
    this._loadout = composed.slots;
    this._sources = composed.sources;
    this.hp = clamp(this.hp, 0, this._pools.hp);
    this.sta = clamp(this.sta, 0, this._pools.sta);
    this.mp = clamp(this.mp, 0, this._pools.mp);
    this._dirty = false;
  }

  gear() {
    this._refresh();
    return this._gear;
  }

  stats() {
    this._refresh();
    return this._stats;
  }

  pools() {
    this._refresh();
    return this._pools;
  }

  derived() {
    this._refresh();
    return this._derived;
  }

  setRace(id) {
    if (!RACES[id] || id === this.raceId) return false;
    this.raceId = id;
    this.markDirty();
    this.refill();
    return true;
  }

  setClass(id) {
    if (!CLASSES[id] || id === this.classId) return false;
    this.classId = id;
    const defaults = CLASSES[id].gear;
    for (const slot of GEAR_SLOTS) {
      if (!this.equipped[slot] && defaults[slot]) this.equipped[slot] = defaults[slot];
    }
    this.markDirty();
    this.refill();
    return true;
  }

  setWeapon(id) {
    const next = canonicalWeapon(id);
    if (!classCanUse(this.classId, next)) return false;
    if (next === this.weaponTypeId) return false;
    this.weaponTypeId = next;
    const match = this.inventory.find((itemId) => ITEMS[itemId]?.weaponType === next);
    if (match) this.equipped.weapon = match;
    if (getWeapon(next).hands !== '1h') this.equipped.offhand = null;
    this.markDirty();
    return true;
  }

  equip(itemId) {
    const item = ITEMS[itemId];
    if (!item || !GEAR_SLOTS.includes(item.slot)) return false;
    if (item.slot === 'offhand' && getWeapon(this.weaponTypeId).hands !== '1h') return false;
    if (this.equipped[item.slot] === itemId) return false;
    this.equipped[item.slot] = itemId;
    if (item.slot === 'weapon' && item.weaponType) {
      this.weaponTypeId = canonicalWeapon(item.weaponType);
      if (getWeapon(this.weaponTypeId).hands !== '1h') this.equipped.offhand = null;
    }
    this.markDirty();
    return true;
  }

  cycleSlot(slot) {
    const choices = itemsForSlot(slot, this.inventory);
    if (!choices.length) return false;
    const current = this.equipped[slot];
    const index = Math.max(0, choices.indexOf(current));
    return this.equip(choices[(index + 1) % choices.length]);
  }

  refill() {
    const pools = this.pools();
    this.hp = pools.hp;
    this.sta = pools.sta;
    this.mp = pools.mp;
  }

  grantXp(amount) {
    if (amount <= 0 || this.level >= MAX_LEVEL) return 0;
    this.xp += amount;
    let gained = 0;
    while (this.level < MAX_LEVEL && this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level += 1;
      gained += 1;
      this.markDirty();
      this.refill();
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
    return gained;
  }

  resolve(skillId) {
    this._refresh();
    const combat = combatOf(skillId);
    const row = SKILL_BY_ID[skillId];
    const variant = variantOf(this.classId, skillId);
    const cfg = settings[skillId] ?? {};
    const stats = this._stats;
    const derived = this._derived;
    const gear = this._gear;
    const klass = this.klass;

    const weapon = getWeapon(this.weaponTypeId);
    const hit = comboHit(this.weaponTypeId, skillId);
    const isCombo = Boolean(weapon.combo.find((entry) => entry.id === skillId));
    const grant = this._sources?.[skillId];
    const grantItem = grant && grant !== 'weapon' && grant !== 'class' ? ITEMS[grant] : null;
    const fromGear = Boolean(grantItem);
    const weights = isCombo
      ? weapon.family === 'ranged'
        ? { intellect: 0.45, wisdom: 0.25, dexterity: 0.3 }
        : { strength: 0.55, agility: 0.3, dexterity: 0.15 }
      : (variant?.weights ?? { strength: 0.35, agility: 0.3, intellect: 0.35 });
    const power = statPower(stats, weights);
    const skillWeapon = isCombo ? weapon.id : row?.weaponTypeId;
    const match = isCombo || fromGear ? 1 : weaponMatch(klass, skillWeapon, this.weaponType);
    const dmgMul = isCombo ? 1 : (variant?.dmgMul ?? 1);
    const base = combat?.damageBase ?? (isCombo ? 28 + (skillId === 'combo3' ? 18 : skillId === 'combo2' ? 8 : 0) : 24);
    const ratio = combat?.damageRatio ?? 1;
    const damage = Math.max(1, Math.round((base + power * ratio) * dmgMul * gear.skillScalar * match));

    const rangeBase = isCombo ? weapon.reach : (cfg.range ?? 12);
    const range = scaleRange(rangeBase, (isCombo ? 1 : variant?.rangeMul) ?? 1, gear.rangeMul, stats);
    const minRange = Math.max(0, (hit?.minRange ?? cfg.minRange ?? 0) * (variant?.rangeMul ?? 1));
    const cooldown = scaleCooldown(
      hit?.cooldown ?? cfg.cooldown ?? 1,
      (isCombo ? 1 : variant?.cdMul) ?? 1,
      gear.cdr,
      stats
    );
    const zoneRadius = scaleAoe(
      hit?.zoneRadius ?? cfg.zoneRadius ?? 0,
      variant?.aoeMul ?? 1,
      gear.aoeMul
    );
    const ringRadius = scaleAoe(cfg.ringRadius ?? 0, variant?.aoeMul ?? 1, gear.aoeMul);
    const gateWidth = scaleAoe(cfg.gateWidth ?? 0, variant?.aoeMul ?? 1, gear.aoeMul);
    const gateHeight = cfg.gateHeight ?? 0;

    const cost = variant?.cost ?? combat?.cost ?? { type: 'sta', amount: 10 };
    const gearName = abilityNameOf(grantItem, skillId);
    const rawName = isCombo
      ? hit.name
      : (gearName ?? variant?.name ?? skillLabel(skillId, row));
    const onWeapon = match >= 0.99;

    const slash = settings.combat || {};
    const slashIndex = skillId === 'combo3' ? 3 : skillId === 'combo2' ? 2 : skillId === 'combo1' ? 1 : 0;
    const move = isCombo
      ? (slash[`slash${slashIndex}Move`] ?? hit.move)
      : 0;
    const duration = isCombo
      ? (slash[`slash${slashIndex}Duration`] ?? hit.duration)
      : 0.32;
    const lift = isCombo ? (slash[`slash${slashIndex}Lift`] ?? hit.lift) : 0.06;

    return {
      id: skillId,
      name: rawName,
      weaponTypeId: isCombo ? weapon.id : (row?.weaponTypeId ?? null),
      school: combat?.school ?? (weapon.family === 'ranged' ? 'arcane' : 'weapon'),
      hit: combat?.hit ?? hit?.shape ?? 'line',
      shape: hit?.shape === 'zone' ? 'zone' : castShapeOf(skillId),
      width: combat?.width ?? 0.7,
      dummyRadius: combat?.dummyRadius ?? 1,
      damage,
      range,
      minRange,
      cooldown,
      zoneRadius,
      ringRadius,
      gateWidth,
      gateHeight,
      costType: cost.type,
      cost: Math.max(0, Math.round(cost.amount)),
      match,
      onWeapon,
      critChance: derived.criticalChance,
      critMul: derived.criticalDamage,
      statuses: row?.statuses ?? [],
      inLoadout: this.loadout.includes(skillId),
      family: weapon.family,
      move,
      anim: isCombo ? hit.anim : (cfg.castAnim ?? null),
      vfx: isCombo ? hit.vfx : skillId,
      duration,
      lift,
      grantedBy: grant ?? null,
      grantName: grantItem?.name ?? (grant === 'weapon' ? weapon.name : grant === 'class' ? klass.name : null)
    };
  }

  /** Overlay AimController reads — range/aoe only, never VFX knobs. */
  aimOverlay(skillId) {
    const resolved = this.resolve(skillId);
    return {
      range: resolved.range,
      minRange: resolved.minRange,
      zoneRadius: resolved.zoneRadius || undefined,
      ringRadius: resolved.ringRadius || undefined,
      gateWidth: resolved.gateWidth || undefined,
      gateHeight: resolved.gateHeight || undefined
    };
  }

  canPay(resolved) {
    if (!resolved || resolved.cost <= 0) return true;
    if (resolved.costType === 'mp') return this.mp >= resolved.cost;
    return this.sta >= resolved.cost;
  }

  pay(resolved) {
    if (!this.canPay(resolved)) return false;
    if (resolved.cost > 0) {
      if (resolved.costType === 'mp') this.mp = Math.max(0, this.mp - resolved.cost);
      else this.sta = Math.max(0, this.sta - resolved.cost);
      this.inCombat = Math.max(this.inCombat, 2.4);
    }
    return true;
  }

  regen(dt) {
    if (dt <= 0) return;
    if (this.inCombat > 0) this.inCombat = Math.max(0, this.inCombat - dt);
    const pools = this.pools();
    const rates = regenRates(this.stats(), this.inCombat > 0);
    this.hp = Math.min(pools.hp, this.hp + rates.hp * dt);
    this.sta = Math.min(pools.sta, this.sta + rates.sta * dt);
    this.mp = Math.min(pools.mp, this.mp + rates.mp * dt);
  }

  toSave() {
    return {
      version: 4,
      raceId: this.raceId,
      classId: this.classId,
      level: this.level,
      xp: this.xp,
      equipped: copyEquip(this.equipped),
      inventory: [...this.inventory],
      weaponType: this.weaponTypeId,
      hp: this.hp,
      sta: this.sta,
      mp: this.mp,
      kills: this.kills
    };
  }

  snapshot() {
    const pools = this.pools();
    const stats = this.stats();
    const gear = this.gear();
    const derived = this.derived();
    const spent = allocationSpent(stats, gear.stats);
    return {
      name: this.displayName,
      title: this.title,
      raceId: this.raceId,
      classId: this.classId,
      race: this.race,
      klass: this.klass,
      level: this.level,
      xp: this.xp,
      xpNext: xpToNext(this.level),
      hp: this.hp,
      sta: this.sta,
      mp: this.mp,
      hpMax: pools.hp,
      staMax: pools.sta,
      mpMax: pools.mp,
      stats,
      derived,
      allocation: {
        spent,
        budget: pointsBudget(this.level),
        max: ALLOCATION.maxPoints,
        perLevel: ALLOCATION.pointsPerLevel,
        start: ALLOCATION.startingPoints
      },
      gear,
      equipped: this.equipped,
      weaponType: this.weaponType,
      weaponName: this.weapon.name,
      family: this.weapon.family,
      loadout: this.loadout.map((id) => this.resolve(id)),
      sources: { ...this.loadoutSources },
      inCombat: this.inCombat > 0,
      kills: this.kills
    };
  }
}

export { STAT_KEYS, GEAR_SLOTS, ITEMS, RACES, CLASSES, FACTIONS, itemsForSlot };
