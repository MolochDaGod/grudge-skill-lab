// @ts-nocheck
/**
 * Per-weapon 3-hit combos. Mixamo packs on the Grudge CDN — not one 2H
 * "Attack Combo" for every blade.
 */
import { optimizeClip } from './optimizeMeshAnimation.js';

export const COMBO_URL = '/models/valhalla/attackcombo.glb';
export const COMBO_CDN = 'https://assets.grudge-studio.com/models/animations';
export const COMBO_SKILLS = ['combo1', 'combo2', 'combo3'];

/** Official Toon-RTS Bip001 takes — same skeleton as warlords/{race}.glb. */
export const BIP_ANIM_PACKS = {
  idle: '/models/warlords/anims/idle.glb',
  walk: '/models/warlords/anims/walk.glb',
  attack: '/models/warlords/anims/attack.glb'
};

/** Fallback windows for the local 2H Attack Combo (~6.9 s). */
export const COMBO_WINDOWS = [
  { id: 'combo1', start: 0.04, end: 2.26 },
  { id: 'combo2', start: 2.18, end: 4.52 },
  { id: 'combo3', start: 4.44, end: 6.9 }
];

/**
 * One pack per melee class. A single file is a 3-hit combo we slice; three
 * files are already the 1-2-3.
 */
export const WEAPON_COMBO_PACKS = {
  SWORD: {
    files: ['grudge6_brb/onehanded/One Hand Sword Combo.glb'],
    timeScale: 1.06,
    label: '1H sword combo'
  },
  AXE: {
    files: [
      'grudge6_brb/sword_shield/Sword And Shield Attack.glb',
      'grudge6_brb/sword_shield/Sword And Shield Attack (1).glb',
      'grudge6_brb/sword_shield/Sword And Shield Attack (2).glb'
    ],
    timeScale: 1.0,
    label: '1H axe chops'
  },
  DAGGER: {
    files: ['grudge6_brb/onehanded/Dual Weapon Combo.glb'],
    timeScale: 1.22,
    label: 'dual-weapon combo'
  },
  SPEAR: {
    files: ['standing_melee_combo_attack_ver_3.glb'],
    timeScale: 1.02,
    label: 'spear 3-hit'
  },
  MACE: {
    files: ['grudge6_brb/onehanded/One Hand Club Combo.glb'],
    timeScale: 0.96,
    label: '1H club combo'
  },
  HAMMER: {
    files: ['grudge6_brb/onehanded/One Hand Club Combo.glb'],
    timeScale: 0.96,
    label: '1H club combo'
  },
  HAMMER2H: {
    files: ['grudge6_brb/greatsword/Two Hand Club Combo.glb'],
    timeScale: 0.86,
    label: '2H club combo'
  },
  GREATSWORD: {
    files: ['grudge6_brb/greatsword/Two Hand Sword Combo.glb'],
    timeScale: 0.9,
    label: '2H sword combo'
  },
  GREATAXE: {
    files: ['grudge6_brb/greatsword/Two Hand Club Combo.glb'],
    timeScale: 0.86,
    label: '2H club combo'
  }
};

export function comboFileUrl(rel) {
  return `${COMBO_CDN}/${String(rel)
    .split('/')
    .map((part) => encodeURI(part))
    .join('/')}`;
}

export function uniqueComboFiles() {
  const set = new Set();
  for (const pack of Object.values(WEAPON_COMBO_PACKS)) {
    for (const file of pack.files) set.add(file);
  }
  return [...set];
}

const MIXAMO_TO_BIP = {
  Hips: 'Bip001_Pelvis',
  Spine: 'Bip001_Spine',
  Spine1: 'Bip001_Spine',
  Spine2: 'Bip001_Spine',
  Neck: 'Bip001_Neck',
  Head: 'Bip001_Head',
  LeftShoulder: 'Bip001_L_Clavicle',
  LeftArm: 'Bip001_L_UpperArm',
  LeftForeArm: 'Bip001_L_Forearm',
  LeftHand: 'Bip001_L_Hand',
  RightShoulder: 'Bip001_R_Clavicle',
  RightArm: 'Bip001_R_UpperArm',
  RightForeArm: 'Bip001_R_Forearm',
  RightHand: 'Bip001_R_Hand',
  LeftUpLeg: 'Bip001_L_Thigh',
  LeftLeg: 'Bip001_L_Calf',
  LeftFoot: 'Bip001_L_Foot',
  LeftToeBase: 'Bip001_L_Toe0',
  RightUpLeg: 'Bip001_R_Thigh',
  RightLeg: 'Bip001_R_Calf',
  RightFoot: 'Bip001_R_Foot',
  RightToeBase: 'Bip001_R_Toe0'
};

function normBone(name) {
  return String(name || '').replace(/[:\s]+/g, '_');
}

function shortMixamo(name) {
  return String(name || '')
    .split(':')
    .pop()
    .replace(/^mixamorig/i, '')
    .replace(/_\d+$/, '');
}

export function collectBones(root) {
  const set = new Set();
  root?.traverse((node) => {
    if (node.name) set.add(node.name);
  });
  return set;
}

function stripBoneSuffix(name) {
  return String(name || '')
    .split(':')
    .pop()
    .replace(/^mixamorig/i, '')
    .replace(/_\d+$/, '');
}

export function isMixamoClip(clip) {
  return Boolean(clip?.tracks?.some((track) => /mixamo/i.test(track.name)));
}

export function isBipClip(clip) {
  return Boolean(
    clip?.tracks?.some((track) => /^Bip001/i.test(String(track.name).split('.')[0] || ''))
  );
}

function matchBipNode(node, boneSet) {
  if (!node || /mixamo|rootjoint|sketchfab|warbear/i.test(node)) return null;
  if (boneSet.has(node)) return node;
  const spaced = node.replace(/_/g, ' ');
  if (boneSet.has(spaced)) return spaced;
  const underscored = node.replace(/\s+/g, '_');
  if (boneSet.has(underscored)) return underscored;
  const want = normBone(node);
  for (const bone of boneSet) {
    if (normBone(bone) === want) return bone;
  }
  return null;
}

/**
 * Bind a Toon-RTS / Bip001 clip onto a Warlords race kit.
 *
 * Official packs use `Bip001_L_Foot`; kits use `Bip001 L Foot`. That is a
 * spelling difference on the same skeleton — not a retarget. Mixamo and the
 * warbear (`Bip001 L Foot_010`, different bind pose) are refused: those takes
 * twist the mesh.
 *
 * Scale tracks are dropped so Bip001's authored 2.54 bind scale stays put.
 * Translation tracks are dropped too — the packs are authored in Max cm, the
 * kits already carry bone length in local bind pose. Applying those positions
 * stretches a 1.8 m Warlord into a 70 m scarecrow. Root `Bip001` stays with
 * plant() + facing.
 */
export function bindBipClip(clip, boneSet) {
  if (!clip?.tracks?.length || !boneSet?.size) return clip;
  if (isMixamoClip(clip) || !isBipClip(clip)) {
    const empty = clip.clone();
    empty.tracks = [];
    empty.name = clip.name;
    return empty;
  }
  const next = clip.clone();
  next.name = clip.name;
  next.tracks = next.tracks
    .map((track) => {
      const dot = track.name.lastIndexOf('.');
      if (dot < 0) return null;
      const node = track.name.slice(0, dot);
      const prop = track.name.slice(dot + 1);
      if (prop === 'scale' || prop === 'position') return null;
      if (node === 'Bip001' || node === 'Bip001_05') return null;
      const remapped = matchBipNode(node, boneSet);
      if (!remapped) return null;
      track.name = `${remapped}.${prop}`;
      return track;
    })
    .filter(Boolean);
  next.resetDuration?.();
  return next;
}

/**
 * Bind a clip onto a live rig. Warbear takes use `Bip001 L Foot_010`;
 * Warlords race kits use `Bip001 L Foot`. Mixamo uses `mixamorigLeftFoot`.
 * Prefer `bindBipClip` for player bodies — this helper still exists for the
 * Mixamo fallback caster.
 */
export function retargetClip(clip, boneSet, mode = 'bip') {
  if (!clip?.tracks?.length || !boneSet?.size) return clip;
  if (mode === 'bip' && (isMixamoClip(clip) || !isBipClip(clip))) return clip;
  const next = clip.clone();
  next.name = clip.name;
  next.tracks = next.tracks
    .map((track) => {
      const remapped = remapTrackName(track.name, boneSet, mode) || matchLooseBone(track.name, boneSet);
      if (!remapped) return null;
      track.name = remapped;
      return track;
    })
    .filter(Boolean);
  next.resetDuration?.();
  return next;
}

function matchLooseBone(trackName, boneSet) {
  const dot = trackName.lastIndexOf('.');
  if (dot < 0) return null;
  const node = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  if (boneSet.has(node)) return trackName;
  const short = stripBoneSuffix(node);
  if (boneSet.has(short)) return `${short}.${prop}`;
  const want = normBone(short);
  for (const bone of boneSet) {
    if (stripBoneSuffix(bone) === short || normBone(bone) === want) return `${bone}.${prop}`;
  }
  return null;
}

function remapTrackName(trackName, boneSet, mode) {
  const dot = trackName.lastIndexOf('.');
  if (dot < 0) return null;
  const node = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  if (/sword|weapon|rootjoint|object_|sketchfab/i.test(node)) return null;
  const short = shortMixamo(node);
  if (mode === 'bip') {
    const bip = MIXAMO_TO_BIP[short];
    if (!bip) return null;
    const want = normBone(bip);
    if (boneSet.has(bip)) return `${bip}.${prop}`;
    for (const bone of boneSet) {
      if (normBone(bone) === want) return `${bone}.${prop}`;
    }
    return null;
  }
  if (boneSet.has(node)) return trackName;
  for (const bone of boneSet) {
    if (shortMixamo(bone) === short) return `${bone}.${prop}`;
  }
  return null;
}

export function remapClip(clip, boneSet, mode) {
  const next = clip.clone();
  next.name = clip.name;
  next.tracks = next.tracks
    .map((track) => {
      const name = remapTrackName(track.name, boneSet, mode);
      if (!name) return null;
      track.name = name;
      return track;
    })
    .filter(Boolean);
  next.resetDuration?.();
  return next;
}

function sliceClip(clip, name, start, end) {
  const out = clip.clone();
  out.name = name;
  out.tracks = out.tracks.map((track) => {
    const next = track.clone();
    const times = next.times;
    const values = next.values;
    const stride = next.getValueSize?.() || Math.max(1, Math.round(values.length / Math.max(1, times.length)));
    let i0 = 0;
    while (i0 < times.length && times[i0] < start) i0++;
    if (i0 > 0) i0--;
    let i1 = times.length - 1;
    while (i1 > 0 && times[i1] > end) i1--;
    if (i1 < times.length - 1) i1++;
    const count = Math.max(2, i1 - i0 + 1);
    const newTimes = new Float32Array(count);
    const newValues = new Float32Array(count * stride);
    for (let i = 0; i < count; i++) {
      const src = Math.min(times.length - 1, i0 + i);
      newTimes[i] = Math.max(0, times[src] - start);
      for (let s = 0; s < stride; s++) newValues[i * stride + s] = values[src * stride + s];
    }
    next.times = newTimes;
    next.values = newValues;
    return next;
  });
  out.duration = Math.max(0.08, end - start);
  optimizeClip(out);
  return out;
}

export function windowsFor(duration, named = COMBO_WINDOWS) {
  const span = duration || 0;
  if (span <= 0.2) return named;
  if (Math.abs(span - 6.9) < 0.35) return named.map((win) => ({ ...win, end: Math.min(span, win.end) }));
  const third = span / 3;
  const overlap = Math.min(0.08, third * 0.1);
  return [0, 1, 2].map((i) => ({
    id: `combo${i + 1}`,
    start: Math.max(0, i * third - (i ? overlap : 0)),
    end: Math.min(span, (i + 1) * third + overlap)
  }));
}

export function splitCombo(sourceClip, windows) {
  if (!sourceClip) return [];
  const duration = sourceClip.duration || 6.9;
  const wins = windows || windowsFor(duration);
  return wins
    .map((win) => {
      const start = Math.max(0, win.start);
      const end = Math.min(duration, win.end);
      return sliceClip(sourceClip, win.id, start, end);
    })
    .filter((clip) => clip.tracks.length > 0);
}

export function comboTakes(sourceClip, boneSet, mode, windows) {
  if (!sourceClip) return [];
  return splitCombo(remapClip(sourceClip, boneSet, mode), windows);
}

export function isComboSkill(id) {
  return COMBO_SKILLS.includes(id);
}

/**
 * Load every unique combo file once, remap, slice, return Map(weapon -> {combo1,combo2,combo3}).
 */
export async function loadWeaponComboClips(assets, boneSet, mode) {
  const files = uniqueComboFiles();
  const loaded = await Promise.all(
    files.map((rel) =>
      assets.loadGLTF(comboFileUrl(rel)).catch((error) => {
        console.warn('[combo] failed', rel, error);
        return null;
      })
    )
  );
  const byFile = new Map();
  files.forEach((rel, i) => {
    const clip = loaded[i]?.animations?.[0];
    if (clip) byFile.set(rel, clip);
  });

  const fallbackGltf = await assets.loadGLTF(COMBO_URL).catch(() => null);
  const fallback = fallbackGltf?.animations?.[0] || null;

  const packs = new Map();
  for (const [weapon, spec] of Object.entries(WEAPON_COMBO_PACKS)) {
    let takes = [];
    if (spec.files.length >= 3) {
      takes = spec.files
        .slice(0, 3)
        .map((rel, i) => {
          const src = byFile.get(rel);
          if (!src) return null;
          const clip = remapClip(src, boneSet, mode);
          clip.name = `combo${i + 1}`;
          optimizeClip(clip);
          clip.userData.timeScale = spec.timeScale || 1;
          return clip;
        })
        .filter(Boolean);
    } else {
      const src = byFile.get(spec.files[0]) || fallback;
      takes = comboTakes(src, boneSet, mode);
      for (const clip of takes) clip.userData.timeScale = spec.timeScale || 1;
    }
    if (!takes.length && fallback) {
      takes = comboTakes(fallback, boneSet, mode);
    }
    packs.set(weapon, {
      label: spec.label,
      timeScale: spec.timeScale || 1,
      clips: takes
    });
  }
  return packs;
}
