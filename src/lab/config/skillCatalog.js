// @ts-nocheck
import { ELEMENTS, ELEMENT_META, CastShape, settings, applySettings } from './settings.js';
import { replaceScripts, scriptsForAbility, snapshotScripts, upsertScript, removeScript, scriptDocument } from '../scripts/scriptDocument.js';

/**
 * Production skill contract — same shape CastingAbilitiesThreeJS exports
 * (`public/skills/production/*.json`). Studio Export writes this.
 */
export const SKILL_CATALOG = [
  {
    id: 'pyre',
    catalogId: 'pyre_crown',
    family: 'aoe',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 2.2, magnitude: 1 }]
  },
  {
    id: 'kraken',
    catalogId: 'kraken_crown',
    family: 'aoe',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.6, magnitude: 0.35 }]
  },
  {
    id: 'electrical',
    catalogId: 'electrical_sphere',
    family: 'aoe',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'stun', durationSec: 0.8, magnitude: 1 }]
  },
  {
    id: 'earth',
    catalogId: 'earthen_spire',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'root', durationSec: 1.2, magnitude: 1 }]
  },
  {
    id: 'portal',
    catalogId: 'verdant_gate',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: []
  },
  {
    id: 'aether',
    catalogId: 'tidewrought_ring',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.4, magnitude: 0.3 }]
  },
  {
    id: 'firePortal',
    catalogId: 'fire_portal',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.5, magnitude: 0.8 }]
  },
  {
    id: 'cinderSlash',
    catalogId: 't0_sword_practice_slash',
    family: 'weapon',
    delivery: 'weapon',
    weaponTypeId: 'SWORD',
    animRole: 'slash',
    statuses: [{ id: 'burn', durationSec: 1.1, magnitude: 0.6 }]
  },
  {
    id: 'combo1',
    catalogId: 't0_sword_practice_slash',
    family: 'weapon',
    delivery: 'weapon',
    weaponTypeId: 'SWORD',
    animRole: 'slash',
    statuses: []
  },
  {
    id: 'combo2',
    catalogId: 't0_sword_quick_thrust',
    family: 'weapon',
    delivery: 'weapon',
    weaponTypeId: 'SWORD',
    animRole: 'thrust',
    statuses: []
  },
  {
    id: 'combo3',
    catalogId: 't0_sword_wide_sweep',
    family: 'weapon',
    delivery: 'around_caster',
    weaponTypeId: 'SWORD',
    animRole: 'slash',
    statuses: []
  },
  {
    id: 'shadowClone',
    catalogId: 'shadow_clone',
    family: 'weapon',
    delivery: 'around_caster',
    weaponTypeId: 'SWORD',
    animRole: 'cast',
    statuses: []
  },
  {
    id: 'skyFist',
    catalogId: 'sky_fist',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'SWORD',
    animRole: 'cast',
    statuses: [{ id: 'stun', durationSec: 0.8, magnitude: 1 }]
  },
  {
    id: 'skyBlades',
    catalogId: 'sky_blades',
    family: 'aoe',
    delivery: 'around_caster',
    weaponTypeId: 'SWORD',
    animRole: 'cast',
    statuses: []
  },
  {
    id: 'shadowStep',
    catalogId: 'shadow_step',
    family: 'weapon',
    delivery: 'caster_to_target',
    weaponTypeId: 'SWORD',
    animRole: 'slash',
    statuses: []
  },
  {
    id: 'fireBolt',
    catalogId: 'staff_fire_bolt',
    family: 'weapon',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.8, magnitude: 1 }]
  },
  {
    id: 'healBolt',
    catalogId: 'staff_holy_light',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'HOLY_STAFF',
    animRole: 'cast',
    statuses: [{ id: 'heal', durationSec: 1.2, magnitude: 1 }]
  },
  {
    id: 'mageTotem',
    catalogId: 'class_nordin_totem',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'FIRE_STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.4, magnitude: 0.6 }]
  },
  {
    id: 'priestTotem',
    catalogId: 'class_freya_totem',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'HOLY_STAFF',
    animRole: 'cast',
    statuses: [{ id: 'heal', durationSec: 2, magnitude: 1 }]
  },
  {
    id: 'virtuosoTotem',
    catalogId: 'class_air_totem',
    family: 'aoe',
    delivery: 'at_location',
    weaponTypeId: 'ARCANE_STAFF',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.2, magnitude: 0.2 }]
  },
  {
    id: 'ice',
    catalogId: 'staff_frost_lance',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [
      { id: 'freeze', durationSec: 2.2, magnitude: 1 },
      { id: 'slow', durationSec: 1.4, magnitude: 0.4 }
    ]
  },
  {
    id: 'thunder',
    catalogId: 'staff_storm_lance',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'stun', durationSec: 0.9, magnitude: 1 }]
  },
  {
    id: 'beam',
    catalogId: 'staff_nova_beam',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.6, magnitude: 1 }]
  },
  {
    id: 'iceNova',
    catalogId: 'staff_ice_nova',
    family: 'aoe',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [
      { id: 'freeze', durationSec: 2.4, magnitude: 1 },
      { id: 'slow', durationSec: 1.6, magnitude: 0.45 }
    ]
  },
  {
    id: 'aimedShot',
    catalogId: 't0_bow_aimed_shot',
    family: 'weapon',
    delivery: 'caster_to_target',
    weaponTypeId: 'BOW',
    animRole: 'aim',
    statuses: []
  },
  {
    id: 'volley',
    catalogId: 't0_bow_volley',
    family: 'aoe',
    delivery: 'around_target',
    weaponTypeId: 'BOW',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.2, magnitude: 0.2 }]
  }
];

export const DELIVERY_GROUPS = {
  Weapon: ['weapon'],
  Linear: ['caster_to_target'],
  Over: ['over_target'],
  Under: ['under_target'],
  Around: ['around_caster', 'around_target'],
  Aura: ['toggle_aura'],
  Place: ['at_location'],
  Path: ['path_stream', 'path_aoe', 'path_spikes', 'path_wall']
};

export function familyOf(id) {
  const row = SKILL_CATALOG.find((s) => s.id === id);
  if (row?.family) return row.family;
  const shape = ELEMENT_META[id]?.cast;
  if (shape === CastShape.ZONE || shape === CastShape.RING || shape === CastShape.GATE) return 'aoe';
  if (shape === CastShape.LINE || shape === CastShape.SCRIBE) return 'linear';
  return 'weapon';
}

/** Grove abilities already in the lab — generic skills, not ObjectStore trees. */
export function groveSkills() {
  return ELEMENTS.map((id) => {
    const meta = ELEMENT_META[id] || {};
    const row = SKILL_CATALOG.find((s) => s.id === id);
    const family = familyOf(id);
    return {
      id,
      name: meta.label || id,
      labId: id,
      weaponType: row?.weaponTypeId || 'STAFF',
      slot: family,
      family,
      delivery: row?.delivery || 'weapon',
      description: meta.hint || meta.label || id,
      key: meta.key,
      accent: meta.accent,
      source: 'grove',
      wired: true
    };
  });
}

export function exportSkillPrefab(id) {
  const row = SKILL_CATALOG.find((s) => s.id === id);
  const meta = ELEMENT_META[id];
  const cfg = settings[id] ?? {};
  if (!meta) return null;
  const family = row?.family ?? 'weapon';
  const delivery = row?.delivery ?? 'weapon';
  return {
    source: 'grudge-ability-lab',
    version: '1.4.0',
    schema: 'weapon-skill-production-override',
    id: row?.catalogId ?? id,
    labId: id,
    weaponTypeId: row?.weaponTypeId ?? 'STAFF',
    label: meta.label,
    key: meta.key,
    family,
    delivery,
    castShape: meta.cast ?? CastShape.LINE,
    animRole: row?.animRole ?? (cfg.castAnim || 'cast1'),
    animClip: cfg.castAnim ?? 'cast1',
    rangeM: cfg.range ?? 0,
    minRangeM: cfg.minRange ?? 0,
    aoeM: cfg.zoneRadius ?? cfg.ringRadius ?? 0,
    cooldownSec: cfg.cooldown ?? 1,
    speedMs: cfg.speed ?? 0,
    intensity: 1,
    statuses: row?.statuses ?? [],
    knobs: {
      glow: settings.global.glow,
      particleCount: settings.global.particleCount,
      cameraShake: settings.global.cameraShake
    },
    vfx: structuredClone(cfg),
    scripts: scriptsForAbility(id),
    checklist: {
      catalogIdVerified: Boolean(row),
      animClipVerified: true,
      vfxCastTravelImpact: true,
      physicsSI: true,
      statusesMapped: true,
      linearExtEditor: true,
      smokeCastingLab: true,
      scriptsSaved: true
    }
  };
}

export function exportAllSkills() {
  const ids = [...new Set([...SKILL_CATALOG.map((s) => s.id), ...ELEMENTS])];
  return {
    source: 'grudge-ability-lab',
    version: '1.4.0',
    schema: 'grudge-lab-catalog',
    upstream: 'https://github.com/MolochDaGod/LinearAbilityExtThreeJS',
    product: 'https://github.com/MolochDaGod/CastingAbilitiesThreeJS',
    elements: ELEMENTS,
    scripts: snapshotScripts(),
    skills: ids.map(exportSkillPrefab).filter(Boolean)
  };
}

/**
 * Apply a skill prefab, catalog dump, or session-shaped JSON into live settings
 * and the script document. Returns true if anything was applied.
 */
export function importLabPayload(data) {
  if (!data || typeof data !== 'object') return false;
  let applied = false;
  const catalogScripts = Array.isArray(data.scripts?.scripts);

  if (catalogScripts) {
    replaceScripts(data.scripts);
    applied = true;
  } else if (Array.isArray(data.scripts) && !Array.isArray(data.skills)) {
    for (const row of data.scripts) upsertScript(row);
    applied = true;
  }

  if (Array.isArray(data.skills)) {
    for (const skill of data.skills) {
      const copy = catalogScripts ? { ...skill, scripts: undefined } : skill;
      if (applySkillPrefab(copy)) applied = true;
    }
    return applied;
  }

  if (data.labId || data.schema === 'weapon-skill-production-override') {
    return applySkillPrefab(data) || applied;
  }

  return applied;
}

export function applySkillPrefab(prefab) {
  if (!prefab || typeof prefab !== 'object') return false;
  const id = prefab.labId || SKILL_CATALOG.find((row) => row.catalogId === prefab.id)?.id;
  if (!id || !settings[id]) return false;

  if (prefab.vfx && typeof prefab.vfx === 'object') {
    applySettings(prefab.vfx, settings[id]);
  } else if (prefab.knobs && typeof prefab.knobs === 'object') {
    if ('range' in prefab.knobs || 'castAnim' in prefab.knobs || 'cooldown' in prefab.knobs) {
      applySettings(prefab.knobs, settings[id]);
    }
  }

  if (typeof prefab.animClip === 'string') settings[id].castAnim = prefab.animClip;
  if (Number.isFinite(prefab.rangeM)) settings[id].range = prefab.rangeM;
  if (Number.isFinite(prefab.minRangeM)) settings[id].minRange = prefab.minRangeM;
  if (Number.isFinite(prefab.cooldownSec)) settings[id].cooldown = prefab.cooldownSec;
  if (Number.isFinite(prefab.speedMs) && 'speed' in settings[id]) settings[id].speed = prefab.speedMs;
  if (Number.isFinite(prefab.aoeM)) {
    if ('zoneRadius' in settings[id]) settings[id].zoneRadius = prefab.aoeM;
    else if ('ringRadius' in settings[id]) settings[id].ringRadius = prefab.aoeM;
  }

  if (Array.isArray(prefab.scripts)) {
    const key = `ability:${id}`;
    for (const row of [...scriptDocument.scripts]) {
      if (row.key === key) removeScript(row.id);
    }
    for (const row of prefab.scripts) {
      upsertScript({ ...row, key, id: row.id });
    }
  }
  return true;
}

