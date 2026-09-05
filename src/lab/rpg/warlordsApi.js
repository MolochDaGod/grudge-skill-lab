// @ts-nocheck
/**
 * Grudge Studio Warlords ObjectStore — skill catalog + icon CDN.
 *
 * Native combat HUD reads this. The authenticated main-panel iframe is optional
 * chrome on top; the lab always has a working panel from this JSON.
 */

export const WARLORDS_SKILLS_URL = 'https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json';
export const WARLORDS_PREFABS_URL = 'https://objectstore.grudge-studio.com/api/v1/master-weapon-prefabs.json';
export const WARLORDS_ICON_CDN = 'https://assets.grudge-studio.com/game-assets';
export const WARLORDS_PANEL_URL = 'https://ui.grudge-studio.com/main-panel.html?era=warlords';

const CACHE_KEY = 'grudge-lab.warlords-skills.v2';
const CACHE_MS = 1000 * 60 * 30;

/** Lab ability ids we can actually arm from a Warlords skill id / name. */
export const LAB_SKILL_MAP = {
  staff_fire_bolt: 'fireBolt',
  t0_sword_practice_slash: 'combo1',
  t0_sword_quick_thrust: 'combo2',
  t0_sword_wide_sweep: 'combo3',
  sword_vengeful_slash: 'combo1',
  sword_lunging_strike: 'combo2',
  staff_ice_nova: 'iceNova',
  ice_nova: 'iceNova',
  fire_bolt: 'fireBolt',
  cinder_slash: 'cinderSlash',
  pyre_crown: 'pyre',
  storm_lance: 'thunder',
  frost_lance: 'ice',
  nova_beam: 'beam',
  electrical_sphere: 'electrical',
  aimed_shot: 'aimedShot',
  t0_bow_aimed_shot: 'aimedShot',
  volley: 'volley',
  arrow_volley: 'volley',
  shadow_clone: 'shadowClone',
  sky_fist: 'skyFist',
  judgement: 'skyFist',
  sky_blades: 'skyBlades',
  shadow_step: 'shadowStep'
};

export function resolveIconUrl(icon, iconUrl) {
  if (iconUrl && /^https?:\/\//.test(iconUrl)) return iconUrl;
  const path = iconUrl || icon || '';
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean.startsWith('/icons/')) return `${WARLORDS_ICON_CDN}${clean}`;
  if (clean.startsWith('/game-assets/')) return `https://assets.grudge-studio.com${clean}`;
  return `${WARLORDS_ICON_CDN}${clean}`;
}

export function labIdForSkill(skill) {
  if (!skill) return null;
  if (skill.lab?.labId && LAB_SKILL_MAP[skill.lab.labId]) return LAB_SKILL_MAP[skill.lab.labId];
  if (LAB_SKILL_MAP[skill.id]) return LAB_SKILL_MAP[skill.id];
  const id = String(skill.id || '').toLowerCase();
  const name = String(skill.name || '').toLowerCase();
  if (id.includes('fire_bolt') || name.includes('fire bolt')) return 'fireBolt';
  if (id.includes('ice_nova') || name.includes('ice nova')) return 'iceNova';
  if (id.includes('quick_thrust') || name.includes('thrust') || name.includes('lunge')) return 'combo2';
  if (id.includes('wide_sweep') || name.includes('sweep') || name.includes('cleave')) return 'combo3';
  if (id.includes('practice_slash') || name.includes('practice slash')) return 'combo1';
  if (id.includes('slash') || name.includes('slash') || name.includes('cut')) return 'combo1';
  if (id.includes('aimed') || name.includes('aimed shot')) return 'aimedShot';
  if (id.includes('volley')) return 'volley';
  if (id.includes('pyre')) return 'pyre';
  if (name.includes('bolt') && (id.includes('staff') || id.includes('wand'))) return 'fireBolt';
  return null;
}

function looksLikeSkill(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  if (!node.id || !node.name) return false;
  return Boolean(
    node.iconUrl ||
      node.icon ||
      node.cooldown != null ||
      node.description ||
      node.damage != null ||
      node.slot ||
      node.resourceCost ||
      node.uuid
  );
}

function slotLabel(slot) {
  const raw = String(slot || 'ability').replace(/_/g, ' ');
  if (!raw) return 'Ability';
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSkill(node, weapon) {
  const weaponType = String(node.weaponType || node.weapon || weapon || '').toUpperCase();
  return {
    id: node.id,
    name: node.name,
    iconUrl: resolveIconUrl(node.icon, node.iconUrl),
    weaponType,
    slot: node.slot || node.slotRole || '',
    tier: Number(node.tier) || 0,
    cooldown: Number(node.cooldown) || 0,
    description: node.description || (Array.isArray(node.effects) ? node.effects.join(' · ') : ''),
    damage: node.damage,
    cost: node.resourceCost || null,
    labId: labIdForSkill(node),
    uuid: node.uuid || null
  };
}

export function flattenSkills(data) {
  const out = [];
  const seen = new Set();
  const walk = (node, weapon) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, weapon);
      return;
    }
    if (looksLikeSkill(node) && !seen.has(node.id)) {
      seen.add(node.id);
      out.push(normalizeSkill(node, weapon));
    }
    const nextWeapon =
      typeof node.id === 'string' && (node.slots || node.totalSkills || node.starterSlots)
        ? node.id
        : weapon;
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') walk(value, nextWeapon);
    }
  };
  walk(data, '');
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function treesFromSkills(skills) {
  const order = [];
  const map = new Map();
  for (const skill of skills) {
    const id = String(skill.weaponType || 'OTHER').toUpperCase() || 'OTHER';
    if (!map.has(id)) {
      map.set(id, { id, name: slotLabel(id), icon: skill.iconUrl || '', slots: new Map() });
      order.push(id);
    }
    const weapon = map.get(id);
    if (!weapon.icon && skill.iconUrl) weapon.icon = skill.iconUrl;
    const slotKey = String(skill.slot || 'ability') || 'ability';
    if (!weapon.slots.has(slotKey)) {
      weapon.slots.set(slotKey, {
        type: slotKey,
        label: slotLabel(slotKey),
        unlockTier: skill.tier ?? 0,
        skills: []
      });
    }
    weapon.slots.get(slotKey).skills.push(skill);
  }
  const rank = (type) => {
    const t = String(type).toLowerCase();
    if (t.includes('starter') || t === 'primary') return 0;
    if (t === 'secondary') return 1;
    if (t === 'ability') return 2;
    if (t.includes('ultimate') || t === 'special') return 3;
    return 4;
  };
  return order.map((id) => {
    const weapon = map.get(id);
    const slots = [...weapon.slots.values()].sort((a, b) => rank(a.type) - rank(b.type));
    return { id: weapon.id, name: weapon.name, icon: weapon.icon, slots };
  });
}

export function extractWeaponTrees(data) {
  const list = data?.weaponTypes || data?.weapons || [];
  if (!Array.isArray(list) || !list.length) return [];
  const trees = [];
  for (const weapon of list) {
    const slots = [];
    const push = (slot, fallback) => {
      if (!slot) return;
      const skills = (slot.skills || []).filter(looksLikeSkill).map((node) =>
        normalizeSkill(node, weapon.id)
      );
      if (!skills.length) return;
      slots.push({
        type: slot.type || fallback || 'ability',
        label: slot.label || slotLabel(slot.type || fallback),
        unlockTier: slot.unlockTier ?? (fallback === 'starter' ? 0 : 1),
        skills
      });
    };
    for (const slot of weapon.starterSlots || []) push(slot, 'starter');
    for (const slot of weapon.slots || []) push(slot);
    if (!slots.length) continue;
    trees.push({
      id: String(weapon.id || '').toUpperCase(),
      name: weapon.name || weapon.id,
      icon: resolveIconUrl(weapon.icon, weapon.iconUrl),
      slots
    });
  }
  return trees;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > CACHE_MS) return null;
    if (!Array.isArray(parsed.skills)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(skills, trees, meta) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), skills, trees, meta }));
  } catch {
    /* quota */
  }
}

/**
 * @returns {Promise<{skills: object[], trees: object[], meta: object, fromCache: boolean}>}
 */
export async function loadWarlordsSkills() {
  const cached = readCache();
  if (cached) {
    const trees = cached.trees?.length ? cached.trees : treesFromSkills(cached.skills);
    return { ...cached, trees, fromCache: true };
  }

  const response = await fetch(WARLORDS_SKILLS_URL, { mode: 'cors' });
  if (!response.ok) throw new Error(`Warlords skills ${response.status}`);
  const data = await response.json();
  const skills = flattenSkills(data);
  const extracted = extractWeaponTrees(data);
  const trees = extracted.length ? extracted : treesFromSkills(skills);
  const meta = {
    total: data.totalSkills || skills.length,
    source: WARLORDS_SKILLS_URL
  };
  writeCache(skills, trees, meta);
  return { skills, trees, meta, fromCache: false };
}

export async function loadWeaponTrees() {
  const pack = await loadWarlordsSkills();
  return pack;
}

const PREFAB_CACHE = 'grudge-lab.t8-prefabs.v1';

const CATEGORY_TYPE = {
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
  natureStaves: 'ARCANE_STAFF',
  arcaneStaves: 'ARCANE_STAFF',
  claws: 'CLAW',
  shields: 'SHIELD',
  tools: 'TOOL',
  'offhand-tome': 'TOME',
  wands: 'WAND'
};

export function studioTypeForPrefab(prefab) {
  if (!prefab) return 'SWORD';
  if (CATEGORY_TYPE[prefab.category]) return CATEGORY_TYPE[prefab.category];
  const type = String(prefab.weaponType || '').toUpperCase();
  if (type === 'HAMMER' && /2h/i.test(prefab.subCategory || '')) return 'HAMMER2H';
  if (type === 'STAFF') return 'ARCANE_STAFF';
  return type || 'SWORD';
}

function slimPrefab(prefab) {
  const name = String(prefab.baseName || prefab.name || '').replace(/\s*T8$/i, '');
  return {
    id: prefab.id || prefab.uuid,
    name,
    weaponType: studioTypeForPrefab(prefab),
    rawType: String(prefab.weaponType || '').toUpperCase(),
    category: prefab.category || '',
    iconUrl: resolveIconUrl(prefab.assets?.icon, prefab.assets?.iconUrl || prefab.iconUrl),
    signature: prefab.signature || prefab.skills?.signatureAbility || '',
    passives: prefab.passives || prefab.skills?.passives || [],
    stats: prefab.stats || {},
    modelUrl: prefab.assets?.modelUrl || prefab.modelUrl || null,
    slots: (prefab.skills?.slots || []).map((slot) => ({
      type: slot.type || 'ability',
      label: slot.label || slot.type || 'Skill',
      unlockTier: slot.unlockTier ?? 1,
      skillIds: slot.skillIds || [],
      signature: Boolean(slot.signature) || slot.type === 'ultimate'
    }))
  };
}

/**
 * T8 combat + gather weapons from ObjectStore prefabs (113 items).
 * Slimmed so the studio can list every named weapon, not just the type.
 */
export async function loadT8Weapons() {
  try {
    const raw = localStorage.getItem(PREFAB_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.at && Date.now() - parsed.at < CACHE_MS && Array.isArray(parsed.weapons)) {
        return parsed.weapons;
      }
    }
  } catch {
    /* ignore */
  }

  const response = await fetch(WARLORDS_PREFABS_URL, { mode: 'cors' });
  if (!response.ok) throw new Error(`Weapon prefabs ${response.status}`);
  const data = await response.json();
  const prefabs = data.prefabs || [];
  const weapons = prefabs.filter((row) => Number(row.tier) === 8).map(slimPrefab);
  try {
    localStorage.setItem(PREFAB_CACHE, JSON.stringify({ at: Date.now(), weapons }));
  } catch {
    /* quota */
  }
  return weapons;
}
