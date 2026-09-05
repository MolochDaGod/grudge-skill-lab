// @ts-nocheck
/**
 * Class F (T0) totems — mage, priest, virtuoso.
 *
 * Official classes.json: cooldown-0 F restores resources and “when you act”
 * the standing totem pulses (heal / attack / wind). They are summons, not grove
 * furniture.
 */

export const CLASS_F = {
  mage: 'mageTotem',
  priest: 'priestTotem',
  virtuoso: 'virtuosoTotem',
  verduror: 'virtuosoTotem',
  worge: 'mageTotem'
};

export const TOTEM_SPECS = {
  mageTotem: {
    id: 'mageTotem',
    classId: 'mage',
    name: 'Nordin Totem',
    url: '/models/totems/totem_nordin_t0.glb',
    fallback: '/models/totems/totem_nordin_t1.glb',
    palette: 'green',
    pulse: 'fire',
    secondary: 'fireBolt',
    height: 2.15,
    crown: 1.55,
    manaGain: 8,
    staminaGain: 5,
    description: 'F — Arcane Bolt. Plants a fire totem that attacks when you act.'
  },
  priestTotem: {
    id: 'priestTotem',
    classId: 'priest',
    name: 'Freya Totem',
    url: '/models/totems/totem_freya_t3.glb',
    palette: 'heal',
    pulse: 'heal',
    secondary: 'healBolt',
    height: 2.3,
    crown: 1.7,
    atonement: true,
    manaGain: 0,
    staminaGain: 0,
    description: 'F — Smite. Plants a heal totem; Atonement ticks when you act.'
  },
  virtuosoTotem: {
    id: 'virtuosoTotem',
    classId: 'virtuoso',
    name: 'Air Totem',
    url: '/models/totems/totem_nordin_t1.glb',
    fallback: '/models/totems/totem_odin_t6.glb',
    palette: 'water',
    pulse: 'air',
    secondary: null,
    height: 2.2,
    crown: 1.6,
    manaGain: 6,
    staminaGain: 6,
    description: 'F — Wind pulse. Plants an air totem that breathes when you act.'
  }
};

export function classFSkill(classId) {
  return CLASS_F[classId] || null;
}

export function totemSpec(id) {
  return TOTEM_SPECS[id] || null;
}
