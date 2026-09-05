// @ts-nocheck
/**
 * Shared aura palettes for the three production self-buffs (K fire, M magic, B
 * electric). One paint table, three forms — never seven copies of a boost.
 *
 * Roles (stun / buff / debuff / cast / channel) pick a form + default colour
 * so the same tongues, ribbons and arcs can read as status without new meshes.
 */

import { settings } from '../config/settings.js';

export const AURA_FORMS = Object.freeze(['fire', 'magic', 'boost']);

export const AURA_VARIANTS = Object.freeze([
  { id: 'red', label: 'Red', accent: '#ff4a12' },
  { id: 'green', label: 'Green', accent: '#3adf62' },
  { id: 'purple', label: 'Purple', accent: '#c46bff' },
  { id: 'water', label: 'Water', accent: '#3fd8ff' },
  { id: 'electric', label: 'Electric', accent: '#7fc9ff' },
  { id: 'blue', label: 'Blue', accent: '#4a8cff' },
  { id: 'heal', label: 'Heal', accent: '#ffe27a' }
]);

export const AURA_VARIANT_IDS = AURA_VARIANTS.map((row) => row.id);

export const AURA_DEFAULTS = Object.freeze({
  fire: 'red',
  magic: 'purple',
  boost: 'electric'
});

/** Status language mapped onto the three existing forms. */
export const AURA_ROLES = Object.freeze({
  stun: { form: 'boost', variant: 'electric', duration: 1.15, label: 'Stun' },
  buff: { form: 'fire', variant: 'red', duration: 2.4, label: 'Buff' },
  debuff: { form: 'magic', variant: 'purple', duration: 2.2, label: 'Debuff' },
  cast: { form: 'fire', variant: null, duration: 0.55, label: 'Cast' },
  channel: { form: 'magic', variant: 'water', duration: 5.5, label: 'Channel' }
});

const FIRE_KEYS = [
  'colorRim',
  'colorCore',
  'colorVein',
  'colorFlameCore',
  'colorFlameBody',
  'colorFlameEmber',
  'colorFlameSmoke',
  'colorOrbCore',
  'colorOrbFlame',
  'colorOrbEmber',
  'colorOrbSmoke',
  'colorEmberA',
  'colorEmberB',
  'colorEmberC',
  'colorEmberD',
  'colorSmokeA',
  'colorSmokeB',
  'colorSmokeC',
  'colorSmokeD',
  'colorGround',
  'colorGroundEmber',
  'colorFlash',
  'lightColor',
  'colorBurstC'
];

const MAGIC_KEYS = [
  'colorRim',
  'colorCore',
  'colorVein',
  'colorRibbonCore',
  'colorRibbonInner',
  'colorRibbonOuter',
  'colorRibbonHalo',
  'colorFieldSmoke',
  'colorFieldSmokeLit',
  'colorFieldPool',
  'colorFieldGlint',
  'colorSmokeA',
  'colorSmokeB',
  'colorSmokeC',
  'colorSmokeD',
  'colorMoteA',
  'colorMoteB',
  'colorMoteC',
  'colorMoteD',
  'colorGround',
  'colorGroundEmber',
  'colorFlash',
  'lightColor',
  'colorBurstC'
];

const BOOST_KEYS = [
  'colorRim',
  'colorCore',
  'colorVein',
  'colorArcCore',
  'colorArcInner',
  'colorArcOuter',
  'colorArcHalo',
  'colorSparkA',
  'colorSparkB',
  'colorSparkC',
  'colorSparkD',
  'colorMoteA',
  'colorMoteB',
  'colorMoteC',
  'colorMoteD',
  'colorGround',
  'colorGroundEmber',
  'colorFlash',
  'lightColor',
  'colorBurstC'
];

const FORM_KEYS = { fire: FIRE_KEYS, magic: MAGIC_KEYS, boost: BOOST_KEYS };

/** Production colours, captured once so "red / electric / purple" can restore. */
const ORIGINALS = {
  fire: snapshot(settings.fire, FIRE_KEYS),
  magic: snapshot(settings.magic, MAGIC_KEYS),
  boost: snapshot(settings.boost, BOOST_KEYS)
};

function snapshot(block, keys) {
  const out = {};
  for (const key of keys) if (block[key] != null) out[key] = block[key];
  return out;
}

function copyInto(block, src) {
  if (!block || !src) return;
  for (const [key, value] of Object.entries(src)) block[key] = value;
}

/**
 * Compact ramp: hot core, mid body, deep ember, dark smoke, rim.
 * Enough to retint tongues / ribbons / arcs without new shaders.
 */
const RAMPS = {
  red: { hot: '#fff3d0', mid: '#ff8a20', deep: '#e0430a', dark: '#160705', rim: '#ff6a1e' },
  green: { hot: '#eaffc8', mid: '#3adf62', deep: '#0d8a38', dark: '#04160a', rim: '#7ef08a' },
  purple: { hot: '#ffdcff', mid: '#e05cff', deep: '#8a1fd6', dark: '#2b0455', rim: '#c46bff' },
  water: { hot: '#e8fbff', mid: '#3fd8ff', deep: '#0a7ad4', dark: '#041428', rim: '#8ef4ff' },
  electric: { hot: '#ffffff', mid: '#7fc9ff', deep: '#3aa0ff', dark: '#0b3fc8', rim: '#c9ecff' },
  blue: { hot: '#e8f2ff', mid: '#4a8cff', deep: '#1a4ad0', dark: '#060e2a', rim: '#8ab4ff' },
  heal: { hot: '#fffce8', mid: '#ffe27a', deep: '#e0b050', dark: '#2a2208', rim: '#fff3b0' }
};

function firePaint(p) {
  return {
    colorRim: p.rim,
    colorCore: p.hot,
    colorVein: p.mid,
    colorFlameCore: p.hot,
    colorFlameBody: p.mid,
    colorFlameEmber: p.deep,
    colorFlameSmoke: p.dark,
    colorOrbCore: p.hot,
    colorOrbFlame: p.mid,
    colorOrbEmber: p.deep,
    colorOrbSmoke: p.dark,
    colorEmberA: p.hot,
    colorEmberB: p.mid,
    colorEmberC: p.deep,
    colorEmberD: p.dark,
    colorSmokeA: p.mid,
    colorSmokeB: p.deep,
    colorSmokeC: p.dark,
    colorSmokeD: '#080404',
    colorGround: p.dark,
    colorGroundEmber: p.mid,
    colorFlash: p.hot,
    lightColor: p.mid,
    colorBurstC: p.deep
  };
}

function magicPaint(p) {
  return {
    colorRim: p.rim,
    colorCore: p.hot,
    colorVein: p.mid,
    colorRibbonCore: p.hot,
    colorRibbonInner: p.mid,
    colorRibbonOuter: p.deep,
    colorRibbonHalo: p.dark,
    colorFieldSmoke: p.dark,
    colorFieldSmokeLit: p.dark,
    colorFieldPool: p.mid,
    colorFieldGlint: p.hot,
    colorSmokeA: p.dark,
    colorSmokeB: p.deep,
    colorSmokeC: p.dark,
    colorSmokeD: '#0a0614',
    colorMoteA: p.hot,
    colorMoteB: p.mid,
    colorMoteC: p.deep,
    colorMoteD: p.dark,
    colorGround: p.dark,
    colorGroundEmber: p.mid,
    colorFlash: p.hot,
    lightColor: p.mid,
    colorBurstC: p.deep
  };
}

function boostPaint(p) {
  return {
    colorRim: p.rim,
    colorCore: p.hot,
    colorVein: p.mid,
    colorArcCore: p.hot,
    colorArcInner: p.mid,
    colorArcOuter: p.deep,
    colorArcHalo: p.dark,
    colorSparkA: p.mid,
    colorSparkB: p.deep,
    colorSparkC: p.hot,
    colorSparkD: p.dark,
    colorMoteA: p.mid,
    colorMoteB: p.hot,
    colorMoteC: p.deep,
    colorMoteD: p.dark,
    colorGround: p.hot,
    colorGroundEmber: p.mid,
    colorFlash: p.hot,
    lightColor: p.mid,
    colorBurstC: p.deep
  };
}

const PAINTERS = { fire: firePaint, magic: magicPaint, boost: boostPaint };

export function variantMeta(id) {
  return AURA_VARIANTS.find((row) => row.id === id) ?? AURA_VARIANTS[0];
}

export function rampOf(id) {
  return RAMPS[id] ?? RAMPS.red;
}

/**
 * Write a palette into a live settings block. Restores the authored production
 * colours when the variant is that form's default.
 */
export function applyAuraToBlock(form, variantId) {
  const block = settings[form];
  if (!block) return;
  const id = AURA_VARIANT_IDS.includes(variantId) ? variantId : AURA_DEFAULTS[form];
  if (id === AURA_DEFAULTS[form]) {
    copyInto(block, ORIGINALS[form]);
    return;
  }
  const paint = PAINTERS[form]?.(rampOf(id));
  if (!paint) return;
  const keys = FORM_KEYS[form];
  for (const key of keys) {
    if (paint[key]) block[key] = paint[key];
  }
}

export function auraTint(form = 'fire') {
  const id = settings.aura?.[form] || AURA_DEFAULTS[form];
  const p = rampOf(id);
  return {
    id,
    core: p.hot,
    edge: p.mid,
    deep: p.deep,
    scorch: p.dark,
    light: p.mid,
    rim: p.rim,
    trail: [p.hot, p.mid, p.deep, p.dark]
  };
}

/** Common skill colour knobs linear / AoE / bending all already author. */
const SKILL_COLOR_KEYS = [
  ['colorCore', 'hot'],
  ['colorEdge', 'mid'],
  ['colorScorch', 'dark'],
  ['lightColor', 'mid'],
  ['colorA', 'hot'],
  ['colorB', 'mid'],
  ['colorC', 'deep'],
  ['colorTip', 'hot'],
  ['colorMid', 'mid'],
  ['colorCast', 'hot'],
  ['colorBurstC', 'deep'],
  ['colorFlash', 'hot'],
  ['colorGround', 'dark']
];

/**
 * Retint a grove skill block from a palette. Linear lances, AoE crowns, and
 * fire-bending streaks all read these keys — one paint, every family.
 */
export function paintSkillBlock(labId, variantId) {
  const block = settings[labId];
  if (!block) return false;
  const p = rampOf(variantId);
  if (!p) return false;
  for (const [key, ramp] of SKILL_COLOR_KEYS) {
    if (block[key] != null) block[key] = p[ramp];
  }
  return true;
}

export function cycleAuraId(current) {
  const index = Math.max(0, AURA_VARIANT_IDS.indexOf(current));
  return AURA_VARIANT_IDS[(index + 1) % AURA_VARIANT_IDS.length];
}
