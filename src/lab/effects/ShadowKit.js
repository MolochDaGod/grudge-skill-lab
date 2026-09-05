// @ts-nocheck
/**
 * Shared samurai-arts helpers: silhouette clones, ghost the caster,
 * nearby hunt marks, fire-body blink trail.
 */
import { MeshBasicMaterial, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const _mark = new Vector3();

export function visibleRoot(character) {
  if (!character) return null;
  if (character.usingAvatar && character.avatar?.group) return character.avatar.group;
  return character.model || character.root;
}

export function setGhost(character, on) {
  if (!character) return;
  if (typeof character.setGhost === 'function') {
    character.setGhost(on);
    return;
  }
  const root = visibleRoot(character);
  if (!root) return;
  root.visible = !on;
  root.traverse((node) => {
    if (node.isMesh || node.isSkinnedMesh) node.visible = !on;
  });
}

export function cloneShadow(source, hex = '#08080c') {
  if (!source) return null;
  const root = cloneSkinned(source);
  const material = new MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity: 0.9,
    depthWrite: true
  });
  root.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.material = material;
    node.castShadow = false;
    node.receiveShadow = false;
    node.frustumCulled = false;
    node.visible = true;
  });
  source.updateWorldMatrix(true, true);
  root.matrix.copy(source.matrixWorld);
  root.matrix.decompose(root.position, root.quaternion, root.scale);
  root.matrixAutoUpdate = true;
  root.visible = true;
  return { root, material };
}

export function disposeShadow(entry) {
  if (!entry) return;
  entry.root?.removeFromParent();
  entry.material?.dispose();
}

/** Dummy + flanks + frog. Two clones always have a body to hunt. */
export function huntMarks(world, origin, count = 2) {
  const marks = [];
  const hostiles = world?.hostiles?.() || [];
  if (hostiles.length) {
    for (const unit of hostiles) {
      marks.push(new Vector3(unit.pos.x, 0.95, unit.pos.z));
    }
  } else {
    const dummy = world?.dummyPos;
    if (dummy) {
      marks.push(new Vector3(dummy.x, 0.95, dummy.z));
      marks.push(new Vector3(dummy.x - 2.15, 0.95, dummy.z + 0.55));
      marks.push(new Vector3(dummy.x + 1.85, 0.95, dummy.z + 1.35));
    }
  }
  const frog = world?.libraries?.frog?.root;
  if (frog) marks.push(frog.position.clone().setY(0.35));
  const bear = world?.libraries?.bear?.root;
  if (bear) marks.push(bear.position.clone().setY(1.15));
  if (!marks.length && origin) {
    marks.push(origin.clone().add(new Vector3(2.2, 0.9, 3.1)));
    marks.push(origin.clone().add(new Vector3(-1.6, 0.9, 2.4)));
  }
  return marks.slice(0, Math.max(1, count));
}

export function boneTrail(character, out) {
  if (!out) return out;
  if (character?.getBoneWorld) {
    character.getBoneWorld('Hips', out);
    if (out.lengthSq() > 0.01) return out;
  }
  out.copy(character?.position || originZero());
  out.y += (character?.height || 1.7) * 0.55;
  return out;
}

function originZero() {
  return new Vector3();
}
