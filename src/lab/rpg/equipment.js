// @ts-nocheck
/**
 * Toon-RTS kits dress by mesh *visibility* (play contract:
 * `equip: mesh_ids_visibility_SLOT_DEFS`). Mixamo casters still parent
 * procedural Dummy_* pieces — those kits have empty attach sockets and no
 * embedded WK_/BRB_ weapons.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
} from 'three';
import { LAYER } from '../core/Layers.js';
import { ITEMS } from './catalog.js';
import { kitFor } from './weapons.js';
import { disposeObject } from '../utils/dispose.js';

const SOCKETS = {
  weapon: ['Dummy_Weapon_R_Eff', 'Dummy_Hand_R', 'Bip001 R Hand'],
  offhand: ['Dummy_Hand_L', 'Bip001 L Hand'],
  helm: ['Dummy_Top', 'Bip001 Head'],
  chest: ['Dummy_Chest', 'Bip001 Spine1', 'Bip001 Spine'],
  shoulders: ['Dummy_Chest', 'Bip001 Spine1', 'Bip001 Spine2'],
  back: ['Dummy_Chest', 'Bip001 Spine1', 'Bip001 Spine'],
  relic: ['Dummy_Lead', 'Dummy_Chest', 'Bip001 Spine1']
};

const KIND = {
  ashbrand: { kind: 'sword', tint: '#c4786a' },
  gravemark: { kind: 'sword', tint: '#8a6a4a' },
  thornbrand: { kind: 'sword', tint: '#6a8f72' },
  skybarb: { kind: 'sword', tint: '#7ec8e3' },
  frosthaft: { kind: 'staff', tint: '#7ec8e3' },
  starwell: { kind: 'staff', tint: '#d8e6f0' },
  ironvisor: { kind: 'helm', tint: '#8b96a8' },
  runecirclet: { kind: 'circlet', tint: '#7ec8e3' },
  trailhood: { kind: 'hood', tint: '#5a6a58' },
  valhelm: { kind: 'helm', tint: '#c6a45a' },
  warplate: { kind: 'plate', tint: '#8a6a4a' },
  runecoat: { kind: 'coat', tint: '#4a6a88' },
  trailcoat: { kind: 'coat', tint: '#5a6a58' },
  groveplate: { kind: 'plate', tint: '#6a8f72' },
  tyrstoken: { kind: 'relic', tint: '#c4786a' },
  odineye: { kind: 'relic', tint: '#7ec8e3' },
  lokicoin: { kind: 'relic', tint: '#c6a45a' },
  valsigil: { kind: 'relic', tint: '#d8e6f0' },
  oakbow: { kind: 'bow', tint: '#8a6a4a' },
  stonemaul: { kind: 'hammer', tint: '#8b96a8' },
  wardshield: { kind: 'shield', tint: '#6a8f72' },
  voidtome: { kind: 'relic', tint: '#6a5a78' },
  hewingaxe: { kind: 'hammer', tint: '#c4786a' },
  boneknife: { kind: 'sword', tint: '#8b96a8' },
  ashspear: { kind: 'staff', tint: '#8a6a4a' },
  oathmace: { kind: 'hammer', tint: '#6a8f72' },
  handhammer: { kind: 'hammer', tint: '#8b96a8' },
  clangreat: { kind: 'sword', tint: '#c6a45a' },
  rendaxe: { kind: 'hammer', tint: '#c4786a' },
  siegebow: { kind: 'bow', tint: '#5a6a58' },
  flintgun: { kind: 'bow', tint: '#8b96a8' },
  cinderstaff: { kind: 'staff', tint: '#c4786a' },
  stormstaff: { kind: 'staff', tint: '#7ec8e3' },
  voidstaff: { kind: 'staff', tint: '#6a5a78' },
  warleggings: { kind: 'plate', tint: '#8a6a4a' },
  runeleggings: { kind: 'coat', tint: '#4a6a88' },
  trailpants: { kind: 'coat', tint: '#5a6a58' },
  wargauntlets: { kind: 'plate', tint: '#8b96a8' },
  runegloves: { kind: 'coat', tint: '#4a6a88' },
  warboots: { kind: 'plate', tint: '#8a6a4a' },
  trailboots: { kind: 'coat', tint: '#5a6a58' },
  warpads: { kind: 'plate', tint: '#8a6a4a' },
  runemantle: { kind: 'coat', tint: '#4a6a88' },
  crusadecloak: { kind: 'cape', tint: '#e8b84a' },
  fabledcape: { kind: 'cape', tint: '#22d3ee' },
  legioncloak: { kind: 'cape', tint: '#ef4444' }
};

const TOON_PREFIX = /^(wk_|brb_|elf_|dwf_|orc_|ud_)/i;

/** Class → body letter on the Toon-RTS kit (A plate, B trail, C robe, D vestment). */
const CLASS_FORM = {
  warrior: { letter: 'a', pads: true },
  raider: { letter: 'a', pads: true },
  worge: { letter: 'a', pads: true },
  ranger: { letter: 'b', pads: false },
  thief: { letter: 'b', pads: false },
  mage: { letter: 'c', pads: false },
  virtuoso: { letter: 'c', pads: false },
  priest: { letter: 'd', pads: false },
  verduror: { letter: 'd', pads: false }
};

/** Class → preferred embedded weapon tokens (first match wins). */
const CLASS_KIT = {
  warrior: { weapons: ['sword_a', 'sword', 'hammer_a'], shield: false, extras: [] },
  raider: { weapons: ['hammer_a', 'hammer', 'axe_a', 'axe', 'sword_a'], shield: false, extras: [] },
  mage: { weapons: ['staff_a', 'staff'], shield: false, extras: [] },
  priest: { weapons: ['staff_b', 'staff_a', 'staff'], shield: false, extras: [] },
  virtuoso: { weapons: ['staff_a', 'staff'], shield: false, extras: [] },
  ranger: { weapons: ['bow'], shield: false, extras: ['quiver'] },
  thief: { weapons: ['dagger', 'sword_b', 'sword'], shield: false, extras: [] },
  worge: { weapons: ['hammer', 'mace', 'axe_a', 'spear', 'axe'], shield: false, extras: [] },
  verduror: { weapons: ['staff_a', 'staff', 'hammer'], shield: false, extras: [] }
};

function mat(tint, extras = {}) {
  return new MeshStandardMaterial({
    color: tint,
    roughness: extras.roughness ?? 0.62,
    metalness: extras.metalness ?? 0.08,
    emissive: tint,
    emissiveIntensity: extras.emit ?? 0.04,
    flatShading: true
  });
}

function mesh(geo, material) {
  const m = new Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.layers.set(LAYER.WORLD);
  m.layers.enable(LAYER.CONTACT);
  m.frustumCulled = false;
  return m;
}

function makeSword(tint) {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.07, 0.07, 1.05), mat(tint, { metalness: 0.35 })));
  g.children[0].position.z = 0.52;
  g.add(mesh(new BoxGeometry(0.28, 0.08, 0.07), mat('#d8e6f0', { metalness: 0.4 })));
  g.add(mesh(new CylinderGeometry(0.04, 0.045, 0.22, 6), mat('#3a322c')));
  g.children[2].rotation.x = Math.PI / 2;
  g.children[2].position.z = -0.14;
  return g;
}

function makeStaff(tint) {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.035, 0.04, 1.55, 6), mat('#5a4638')));
  g.children[0].rotation.x = Math.PI / 2;
  g.children[0].position.z = 0.55;
  const head = mesh(new IcosahedronGeometry(0.14, 0), mat(tint, { emit: 0.35, metalness: 0.2 }));
  head.position.z = 1.28;
  g.add(head);
  return g;
}

function makeBow(tint) {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.05, 0.7, 0.05), mat(tint)));
  g.add(mesh(new BoxGeometry(0.03, 0.03, 0.55), mat('#d8e6f0')));
  g.children[1].position.z = 0.12;
  return g;
}

function makeHammer(tint) {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.04, 0.04, 0.9, 6), mat('#5a4638')));
  g.children[0].rotation.x = Math.PI / 2;
  g.children[0].position.z = 0.35;
  const head = mesh(new BoxGeometry(0.22, 0.18, 0.32), mat(tint, { metalness: 0.25 }));
  head.position.z = 0.82;
  g.add(head);
  return g;
}

function makeShield(tint) {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.28, 0.3, 0.06, 8), mat(tint, { metalness: 0.2 })));
  g.children[0].rotation.x = Math.PI / 2;
  return g;
}

function makeHelm(tint) {
  const g = new Group();
  g.add(mesh(new SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58), mat(tint, { metalness: 0.22 })));
  g.children[0].position.y = 0.04;
  g.add(mesh(new BoxGeometry(0.18, 0.08, 0.22), mat(tint, { metalness: 0.22 })));
  g.children[1].position.set(0, -0.02, 0.1);
  g.position.y = 0.12;
  return g;
}

function makeCirclet(tint) {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.16, 0.16, 0.04, 10), mat(tint, { emit: 0.2, metalness: 0.45 })));
  g.position.y = 0.16;
  return g;
}

function makeHood(tint) {
  const g = new Group();
  g.add(mesh(new ConeGeometry(0.24, 0.32, 8), mat(tint, { metalness: 0 })));
  g.children[0].position.y = 0.18;
  return g;
}

function makePlate(tint) {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.42, 0.38, 0.16), mat(tint, { metalness: 0.28 })));
  const l = mesh(new BoxGeometry(0.18, 0.16, 0.22), mat(tint, { metalness: 0.28 }));
  const r = l.clone();
  l.position.set(-0.28, 0.12, 0);
  r.position.set(0.28, 0.12, 0);
  g.add(l, r);
  g.position.z = 0.12;
  return g;
}

function makeCoat(tint) {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.4, 0.5, 0.14), mat(tint, { metalness: 0 })));
  g.position.z = 0.1;
  return g;
}

function makeRelic(tint) {
  const g = new Group();
  g.add(mesh(new IcosahedronGeometry(0.09, 0), mat(tint, { emit: 0.45, metalness: 0.3 })));
  g.position.set(0.18, 0.16, 0.12);
  return g;
}

function makeCape(tint) {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.46, 0.62, 0.06), mat(tint, { metalness: 0 })));
  g.position.set(0, -0.08, -0.16);
  g.rotation.x = 0.18;
  return g;
}

const BUILDERS = {
  sword: makeSword,
  staff: makeStaff,
  bow: makeBow,
  hammer: makeHammer,
  shield: makeShield,
  helm: makeHelm,
  circlet: makeCirclet,
  hood: makeHood,
  plate: makePlate,
  coat: makeCoat,
  relic: makeRelic,
  cape: makeCape
};

export function itemVisual(itemId) {
  return KIND[itemId] ?? { kind: 'relic', tint: '#8b96a8' };
}

export function buildGear(itemId) {
  const spec = itemVisual(itemId);
  const build = BUILDERS[spec.kind] ?? makeRelic;
  const group = build(spec.tint);
  group.name = `Gear_${itemId}`;
  group.userData.itemId = itemId;
  group.userData.kind = spec.kind;
  return group;
}

export function findSocket(root, names) {
  if (!root) return null;
  const want = names.map((n) => n.toLowerCase().replace(/\s+/g, ''));
  let found = null;
  root.traverse((node) => {
    if (found) return;
    const n = (node.name || '').toLowerCase().replace(/\s+/g, '');
    if (!n) return;
    if (want.some((w) => n === w || n.startsWith(w) || n.includes(w))) found = node;
  });
  return found;
}

export function socketFor(slot, itemId) {
  const kind = KIND[itemId]?.kind;
  if (kind === 'bow' || kind === 'shield' || kind === 'cape') {
    if (kind === 'cape') return SOCKETS.back;
    return SOCKETS.offhand;
  }
  if (slot === 'weapon') return SOCKETS.weapon;
  if (slot === 'offhand') return SOCKETS.offhand;
  if (slot === 'back') return SOCKETS.back;
  return SOCKETS[slot] ?? SOCKETS.relic;
}

const _up = new Vector3(0, 1, 0);

export function mountGear(root, slot, itemId) {
  const socket = findSocket(root, socketFor(slot, itemId));
  if (!socket) return null;
  const piece = buildGear(itemId);
  // Weapon dummies in the Max/RTS kit face local +Y; rotate the blade onto it.
  if (slot === 'weapon') piece.rotation.x = -Math.PI / 2;
  if (slot === 'helm') piece.rotation.x = 0;
  socket.add(piece);
  piece.updateMatrixWorld(true);
  return piece;
}

export { SOCKETS, _up };

export function clearMounted(root) {
  if (!root) return;
  const doomed = [];
  root.traverse((node) => {
    if (node.userData?.itemId || (node.name && node.name.startsWith('Gear_'))) doomed.push(node);
  });
  for (const node of doomed) {
    node.parent?.remove(node);
    disposeObject(node);
  }
}

export function isToonKit(root) {
  if (!root) return false;
  let hit = false;
  root.traverse((node) => {
    if (hit) return;
    if (!(node.isMesh || node.isSkinnedMesh)) return;
    if (TOON_PREFIX.test(node.name || '')) hit = true;
  });
  return hit;
}

function letterOf(name) {
  const match = String(name || '').toLowerCase().match(/_([a-z])$/);
  return match ? match[1] : '';
}

function classifyToon(name) {
  const n = String(name || '').toLowerCase();
  if (!TOON_PREFIX.test(n)) return null;
  if (/shield/.test(n)) return { kind: 'shield', letter: letterOf(n), key: n };
  if (/xtra|quiver|bag|wood/.test(n)) return { kind: 'extra', key: n };
  if (/weapon/.test(n)) return { kind: 'weapon', key: n };
  if (/shoulder/.test(n)) return { kind: 'shoulders', letter: letterOf(n) || 'a' };
  if (/body/.test(n)) return { kind: 'body', letter: letterOf(n) || 'a' };
  if (/head/.test(n)) return { kind: 'head', letter: letterOf(n) || 'a' };
  if (/arm/.test(n)) return { kind: 'arms', letter: letterOf(n) || 'a' };
  if (/leg/.test(n)) return { kind: 'legs', letter: letterOf(n) || 'a' };
  return { kind: 'other', key: n };
}

function pickLetter(entries, prefer = 'a') {
  if (!entries.length) return null;
  return entries.find((row) => row.letter === prefer) ?? entries[0];
}

function pickWeapon(entries, tokens) {
  const lower = entries.map((row) => ({ ...row, key: row.key || '' }));
  for (const token of tokens) {
    const hit = lower.find((row) => row.key.includes(token));
    if (hit) return hit;
  }
  return lower[0] ?? null;
}

/**
 * Official play dress: hide every embedded variant, then show one body letter
 * and the class weapon. Never parents Dummy_* geometry onto a Toon kit
 * (`whole_body_glb_swap_for_equip` is banned).
 */
export function dressToonKit(root, classId = 'warrior', weaponType, equipped) {
  if (!root) return false;
  const buckets = {
    body: [],
    head: [],
    arms: [],
    legs: [],
    shoulders: [],
    weapon: [],
    shield: [],
    extra: [],
    other: []
  };
  const meshes = [];
  root.traverse((node) => {
    if (!(node.isMesh || node.isSkinnedMesh)) return;
    const row = classifyToon(node.name);
    if (!row) return;
    meshes.push(node);
    const list = buckets[row.kind] || buckets.other;
    list.push({ node, ...row });
  });
  if (!meshes.length) return false;

  const kit = kitFor(weaponType, classId, equipped) || CLASS_KIT[classId] || CLASS_KIT.warrior;
  const form = CLASS_FORM[classId] || CLASS_FORM.warrior;
  const show = new Set();
  for (const part of ['body', 'head', 'arms', 'legs']) {
    const pick = pickLetter(buckets[part], form.letter);
    if (pick) show.add(pick.node);
  }
  if (form.pads) {
    const pick = pickLetter(buckets.shoulders, form.letter);
    if (pick) show.add(pick.node);
  }
  const weapon = pickWeapon(buckets.weapon, kit.weapons);
  if (weapon) show.add(weapon.node);
  if (kit.shield) {
    const shield = pickLetter(buckets.shield, 'a');
    if (shield) show.add(shield.node);
  }
  for (const extra of kit.extras) {
    const hit = buckets.extra.find((row) => row.key.includes(extra));
    if (hit) show.add(hit.node);
  }

  for (const node of meshes) node.visible = show.has(node);
  root.userData.toonClass = classId;
  root.userData.toonWeapon = weaponType || null;
  return true;
}

export function dressSlots(root, equipped, classId = 'warrior', weaponType) {
  if (isToonKit(root)) {
    clearMounted(root);
    dressToonKit(root, classId, weaponType, equipped);
    return;
  }
  clearMounted(root);
  if (!equipped) return;
  for (const slot of ['weapon', 'offhand', 'helm', 'chest', 'back', 'relic']) {
    const id = equipped[slot];
    if (id && ITEMS[id]) mountGear(root, slot, id);
  }
}
