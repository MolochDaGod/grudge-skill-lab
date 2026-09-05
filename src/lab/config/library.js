// @ts-nocheck
/**
 * Grove library catalog — animations, projectiles, race meshes, editor hooks.
 *
 * Skill *visuals* still live in `settings.js`. This file only names what the
 * library panel can play, arm, or open, so the grove's full take list is
 * reachable without hunting keys.
 */

export const PROJECTILE_IDS = ['fireBolt', 'healBolt', 'ice', 'thunder', 'beam', 'iceNova', 'shadowClone', 'skyFist', 'skyBlades', 'shadowStep'];

export const RACE_MESHES = [
  { id: 'human', url: '/models/warlords/human.glb', label: 'Human', height: 1.8 },
  { id: 'barbarian', url: '/models/warlords/barbarian.glb', label: 'Barbarian', height: 1.88 },
  { id: 'elf', url: '/models/warlords/elf.glb', label: 'Elf', height: 1.82 },
  { id: 'dwarf', url: '/models/warlords/dwarf.glb', label: 'Dwarf', height: 1.52 },
  { id: 'orc', url: '/models/warlords/orc.glb', label: 'Orc', height: 1.9 },
  { id: 'undead', url: '/models/warlords/undead.glb', label: 'Undead', height: 1.78 },
  { id: 'warbear', url: '/models/valhalla/human.glb', label: 'Worge bear (clips / grove NPC)', height: 2.1 }
];

export const EDITOR_ACTIONS = [
  {
    id: 'combat',
    key: 'J',
    title: 'Warlords combat',
    blurb: 'ObjectStore skill icons + dash, auras, skeleton helper. Live HUD optional.'
  },
  {
    id: 'vfx',
    key: 'G',
    title: 'VFX editor',
    blurb: 'Live knobs on every wired skill, buff, and aim template. Works paused.'
  },
  {
    id: 'studio',
    key: 'U',
    title: 'Skill Studio',
    blurb: 'Pick a weapon, open its tree, type the visual, apply live.'
  },
  {
    id: 'sheet',
    key: 'I',
    title: 'Character sheet',
    blurb: 'Crusade, Fabled, Legion. Six races, eight Warlord classes, pack RMB to wear.'
  },
  {
    id: 'pause',
    key: 'P',
    title: 'Pause sim',
    blurb: 'Freeze the cast. Every slider still applies.'
  },
  {
    id: 'clear',
    key: 'C',
    title: 'Clear effects',
    blurb: 'Retire live casts, buffs, particles, and decals.'
  }
];
