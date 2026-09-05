// @ts-nocheck
/**
 * Versioned localStorage for the grove RPG. Small blob, written on mutate and
 * on hide — never from the frame loop.
 */

import { defaultSave, CLASSES, RACES, ITEMS, DEFAULT_INVENTORY, RACE_ALIASES, CLASS_ALIASES } from './catalog.js';
import { GEAR_SLOTS } from './formulas.js';

export const SAVE_KEY = 'grudge-rpg-v1';
export const SAVE_VERSION = 4;
const BACKUP_KEY = 'grudge-rpg-v1.bak';

function migrate(raw) {
  const save = { ...defaultSave(), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!save.version) save.version = 1;
  if (RACE_ALIASES[save.raceId]) save.raceId = RACE_ALIASES[save.raceId];
  if (CLASS_ALIASES[save.classId]) save.classId = CLASS_ALIASES[save.classId];
  save.version = SAVE_VERSION;
  if (!RACES[save.raceId]) save.raceId = 'human';
  if (!CLASSES[save.classId]) save.classId = 'warrior';
  const gear = { ...CLASSES[save.classId].gear, ...(save.equipped || {}) };
  if (gear.relic === 'wardshield') {
    gear.offhand = gear.offhand || 'wardshield';
    gear.relic = CLASSES[save.classId].gear.relic ?? 'tyrstoken';
  }
  if (gear.relic === 'voidtome') {
    gear.offhand = gear.offhand || 'voidtome';
    gear.relic = CLASSES[save.classId].gear.relic ?? 'odineye';
  }
  for (const slot of GEAR_SLOTS) {
    if (gear[slot] && (!ITEMS[gear[slot]] || ITEMS[gear[slot]].slot !== slot)) {
      gear[slot] = CLASSES[save.classId].gear[slot] ?? null;
    }
  }
  save.equipped = gear;
  const itemType = ITEMS[gear.weapon]?.weaponType;
  save.weaponType = itemType || save.weaponType || CLASSES[save.classId].weapon;
  if (!Array.isArray(save.inventory) || !save.inventory.length) save.inventory = [...DEFAULT_INVENTORY];
  else {
    for (const id of DEFAULT_INVENTORY) {
      if (!save.inventory.includes(id)) save.inventory.push(id);
    }
  }
  return save;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw));
  } catch {
    try {
      const bak = localStorage.getItem(BACKUP_KEY);
      if (bak) return migrate(JSON.parse(bak));
    } catch {
      /* fall through */
    }
    return defaultSave();
  }
}

export function persistActor(actor) {
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(actor.toSave()));
    return true;
  } catch {
    return false;
  }
}

export function bindAutosave(write) {
  let timer = 0;
  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    write();
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    clearTimeout(timer);
    flush();
  };
}

export function schedulePersist(write, delay = 360) {
  let timer = 0;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      write();
    }, delay);
  };
}
