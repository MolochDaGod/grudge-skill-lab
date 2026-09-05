// @ts-nocheck
/**
 * Per-skill visual recipes for Skill Studio.
 *
 * Typed intent + knobs, stored locally, applied onto `settings[labId]`
 * when the skill is wired in the grove.
 */

import { settings, applySettings, CAST_ANIMATIONS } from '../config/settings.js';
import { AURA_VARIANTS, applyAuraToBlock, paintSkillBlock } from './auras.js';

export const RECIPE_STORE = 'grudge-lab.skill-recipes.v1';

export const FROM_WHERE = [
  { id: 'blade', label: 'Blade / weapon' },
  { id: 'hand', label: 'Hand' },
  { id: 'caster', label: 'Caster body' },
  { id: 'ground', label: 'Ground impact' },
  { id: 'above', label: 'Above target' }
];

export const MOVEMENT = [
  { id: 'fly', label: 'Fly at target' },
  { id: 'arc', label: 'Arc / sweep' },
  { id: 'lunge', label: 'Lunge / close' },
  { id: 'stay', label: 'Stay on caster' },
  { id: 'drop', label: 'Drop from above' }
];

export const PROJECTILES = [
  { id: 'none', label: 'None (melee only)' },
  { id: 'crescent', label: 'Crescent slash' },
  { id: 'dart', label: 'Thrust dart' },
  { id: 'sweep', label: 'Wide sweep' },
  { id: 'bolt', label: 'Bolt' },
  { id: 'beam', label: 'Beam' }
];

export const TRAILS = [
  { id: 'none', label: 'None' },
  { id: 'streak', label: 'Elemental streak' },
  { id: 'wind', label: 'Green wind' },
  { id: 'mist', label: 'Heal mist' },
  { id: 'embers', label: 'Embers' },
  { id: 'frost', label: 'Frost' },
  { id: 'spark', label: 'Sparks' }
];

export const IMPACTS = [
  { id: 'none', label: 'None' },
  { id: 'burst', label: 'Burst' },
  { id: 'scorch', label: 'Scorch' },
  { id: 'pierce', label: 'Pierce' },
  { id: 'shatter', label: 'Shatter' }
];

export const AURAS = [
  { id: 'none', label: 'None' },
  { id: 'cast', label: 'Cast pulse' },
  { id: 'stun', label: 'Stun' },
  { id: 'buff', label: 'Buff' },
  { id: 'debuff', label: 'Debuff' },
  { id: 'channel', label: 'Channel' }
];

export const CHARGE_ANIMS = CAST_ANIMATIONS.map((id) => ({ id, label: id }));

export const FAMILIES = [
  { id: 'all', label: 'All' },
  { id: 'linear', label: 'Linear' },
  { id: 'aoe', label: 'AoE' },
  { id: 'bending', label: 'Bending' },
  { id: 'weapon', label: 'Weapon' }
];

export const PALETTES = AURA_VARIANTS.map((row) => ({
  id: row.id,
  label: row.label,
  accent: row.accent
}));

export function emptyRecipe() {
  return {
    intent: '',
    fromWhere: 'blade',
    movement: 'fly',
    projectile: 'crescent',
    trail: 'streak',
    speed: 28,
    castTime: 0.2,
    chargeAnim: 'combo1',
    dropAsset: '',
    impact: 'burst',
    aura: 'none',
    transform: '',
    variant: 'red',
    family: 'weapon',
    bending: false
  };
}

const RULES = [
  { re: /from (the )?blade|off the blade|weapon tip/i, patch: { fromWhere: 'blade' } },
  { re: /from (the )?hand|from (the )?hilt|off the fist/i, patch: { fromWhere: 'hand' } },
  { re: /from (the )?ground|ground skip|dirt/i, patch: { fromWhere: 'ground' } },
  { re: /above|overhead|from the sky/i, patch: { fromWhere: 'above', movement: 'drop' } },
  { re: /around (the )?caster|stay on|on the body/i, patch: { movement: 'stay', fromWhere: 'caster' } },
  { re: /lunge|gap.?close|dash in/i, patch: { movement: 'lunge' } },
  { re: /crescent|slash wave|flying slash/i, patch: { projectile: 'crescent', movement: 'fly' } },
  { re: /thrust|poke|stab|dart/i, patch: { projectile: 'dart', movement: 'lunge' } },
  { re: /sweep|cleave|wide arc/i, patch: { projectile: 'sweep', movement: 'arc' } },
  { re: /\bbolt\b|projectile/i, patch: { projectile: 'bolt', movement: 'fly' } },
  { re: /\bbeam\b|lance/i, patch: { projectile: 'beam', movement: 'fly' } },
  { re: /no projectile|melee only/i, patch: { projectile: 'none' } },
  { re: /ember|cinder|fire trail/i, patch: { trail: 'embers' } },
  { re: /frost|ice trail/i, patch: { trail: 'frost' } },
  { re: /spark|electric trail/i, patch: { trail: 'spark' } },
  { re: /streak|elemental trail|trail/i, patch: { trail: 'streak' } },
  { re: /no trail/i, patch: { trail: 'none' } },
  { re: /slow/i, patch: { speed: 12 } },
  { re: /fast|quick|snappy/i, patch: { speed: 48 } },
  { re: /charge/i, patch: { chargeAnim: 'cast2', castTime: 0.55 } },
  { re: /scorch/i, patch: { impact: 'scorch' } },
  { re: /shatter|ice break/i, patch: { impact: 'shatter' } },
  { re: /pierce/i, patch: { impact: 'pierce' } },
  { re: /burst|explode|impact/i, patch: { impact: 'burst' } },
  { re: /\bstun\b/i, patch: { aura: 'stun' } },
  { re: /\bbuff\b/i, patch: { aura: 'buff' } },
  { re: /debuff/i, patch: { aura: 'debuff' } },
  { re: /channel/i, patch: { aura: 'channel' } },
  { re: /cast pulse|casting/i, patch: { aura: 'cast' } },
  { re: /\bred\b|cinder|flame/i, patch: { variant: 'red' } },
  { re: /\bgreen\b|poison|nature/i, patch: { variant: 'green' } },
  { re: /\bpurple\b|void|arcane/i, patch: { variant: 'purple' } },
  { re: /\bwater\b|aqua|tide/i, patch: { variant: 'water' } },
  { re: /\belectric\b|lightning|spark/i, patch: { variant: 'electric' } },
  { re: /\bblue\b|frost|ice\b/i, patch: { variant: 'blue' } },
  { re: /\bheal\b|holy|yellow|light\b/i, patch: { variant: 'heal' } },
  { re: /bend|tongue|body fire|fire.?bend/i, patch: { bending: true, trail: 'streak', family: 'bending' } },
  { re: /wind trail|green wind|jade wind/i, patch: { trail: 'wind', variant: 'green' } },
  { re: /mist|heal dart|holy light|jade mist/i, patch: { trail: 'mist', variant: 'heal', family: 'linear' } },
  { re: /\baoe\b|nova|crown|zone/i, patch: { family: 'aoe' } },
  { re: /linear|lance|beam|line/i, patch: { family: 'linear' } }
];

export function parseIntent(text, base = emptyRecipe()) {
  const next = { ...base, intent: text };
  for (const rule of RULES) {
    if (rule.re.test(text)) Object.assign(next, rule.patch);
  }
  const seconds = text.match(/(\d+(?:\.\d+)?)\s*(s|sec|seconds)\b/i);
  if (seconds) next.castTime = Number(seconds[1]);
  const metres = text.match(/(\d+(?:\.\d+)?)\s*m(eters?)?\b/i);
  if (metres && /speed|fast|slow/.test(text)) next.speed = Number(metres[1]);
  return next;
}

export function loadRecipes() {
  try {
    const raw = localStorage.getItem(RECIPE_STORE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRecipe(skillId, recipe) {
  if (!skillId) return;
  const all = loadRecipes();
  all[skillId] = { ...recipe, updatedAt: Date.now() };
  try {
    localStorage.setItem(RECIPE_STORE, JSON.stringify(all));
  } catch {
    /* quota */
  }
  return all[skillId];
}

export function recipeFor(skillId) {
  const stored = loadRecipes()[skillId];
  return stored ? { ...emptyRecipe(), ...stored } : emptyRecipe();
}

/**
 * Patch live grove knobs for a wired lab ability. Unknown keys are ignored
 * so unmapped catalog skills can still store a recipe without crashing.
 */
export function applyRecipeToSettings(labId, recipe) {
  if (!labId || !settings[labId] || !recipe) return false;
  const patch = {};
  if (Number.isFinite(recipe.speed)) patch.speed = recipe.speed;
  if (Number.isFinite(recipe.castTime)) patch.cooldown = recipe.castTime;
  if (recipe.chargeAnim && CAST_ANIMATIONS.includes(recipe.chargeAnim)) {
    patch.castAnim = recipe.chargeAnim;
  }
  if (recipe.fromWhere === 'blade' || recipe.fromWhere === 'hand') {
    patch.handForward = recipe.fromWhere === 'blade' ? 0.4 : 0.28;
    patch.release = 0.75;
    patch.flightHeight = 1.1;
  }
  if (recipe.fromWhere === 'ground') {
    patch.flightHeight = 0.14;
    patch.release = 0.9;
  }
  if (recipe.fromWhere === 'above') patch.flightHeight = 1.85;
  if (recipe.projectile === 'dart') {
    patch.dartLength = 0.78;
    patch.dartRadius = 0.026;
  }
  if (recipe.projectile === 'crescent') patch.slashOuter = 0.72;
  if (recipe.projectile === 'sweep') {
    patch.sweepRadius = 1.7;
    patch.zoneRadius = 2.1;
  }
  if (recipe.trail === 'none') {
    patch.emberRate = 0;
    patch.trailRate = 0;
  } else if (recipe.trail) {
    patch.emberRate = recipe.trail === 'embers' ? 220 : 160;
    patch.trailRate = 180;
  }
  if (recipe.trail === 'wind') {
    patch.trailPalette = 'green';
    patch.variant = recipe.variant || 'green';
  }
  if (recipe.trail === 'mist') {
    patch.trailPalette = 'heal';
    patch.variant = recipe.variant || 'heal';
  }
  if (recipe.impact === 'none') patch.burstRadius = 0.2;
  else if (recipe.impact === 'burst') patch.burstRadius = 1.2;
  if (recipe.bending || recipe.family === 'bending') {
    patch.trailRate = Math.max(patch.trailRate || 0, 180);
    patch.emberRate = Math.max(patch.emberRate || 0, 160);
  }
  applySettings({ [labId]: patch });
  if (recipe.variant) paintSkillBlock(labId, recipe.variant);
  if (recipe.bending || recipe.family === 'bending') {
    applyAuraToBlock('fire', recipe.variant || settings.aura?.fire || 'red');
  }
  return true;
}

export function listSavedRecipes() {
  const all = loadRecipes();
  return Object.entries(all).map(([id, recipe]) => ({
    id,
    name: recipe.name || id,
    recipe,
    updatedAt: recipe.updatedAt || 0
  }));
}

export function exportRecipe(skill, recipe) {
  return {
    source: 'grudge-ability-lab',
    schema: 'weapon-skill-visual-recipe',
    version: '1.0.0',
    id: skill?.id ?? null,
    name: skill?.name ?? null,
    weaponType: skill?.weaponType ?? null,
    labId: skill?.labId ?? null,
    recipe
  };
}
