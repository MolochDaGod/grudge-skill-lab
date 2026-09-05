// @ts-nocheck
/**
 * Mesh-animation optimizer — shared by the Mixamo caster and the grove actors.
 *
 * Unity / Mixamo / Sketchfab clips arrive with a key on every frame, identity
 * scale tracks, and a dozen actions we never play. The mixer then samples all
 * of that every frame, including the warbear standing in the trees. This file
 * is the single place that:
 *
 *   1. strips tracks that cannot change the pose (identity scale, constants)
 *   2. collapses sequential duplicate keys (`AnimationClip.optimize`)
 *   3. drops every clip we are not going to bind
 *   4. fits skinned bounds so frustum culling does not pop a swinging dummy
 *   5. freezes matrices on props that will never be written again
 *
 * Nothing here changes how a clip *looks* — only how much work it is.
 */

const EPS = 1e-4;

function strideOf(track) {
  return track.getValueSize?.() ?? 1;
}

function valuesEqual(values, a, b, stride, eps) {
  for (let i = 0; i < stride; i++) {
    if (Math.abs(values[a + i] - values[b + i]) > eps) return false;
  }
  return true;
}

function isConstantTrack(track, eps = EPS) {
  const stride = strideOf(track);
  const values = track.values;
  if (!values || values.length <= stride) return true;
  for (let i = stride; i < values.length; i += stride) {
    if (!valuesEqual(values, 0, i, stride, eps)) return false;
  }
  return true;
}

function isIdentityScale(track) {
  if (!/\.scale$/.test(track.name)) return false;
  const values = track.values;
  for (let i = 0; i < values.length; i++) {
    if (Math.abs(values[i] - 1) > EPS) return false;
  }
  return true;
}

function collapseConstant(track) {
  const stride = strideOf(track);
  const times = track.times;
  const values = track.values;
  if (times.length <= 2) return;
  const last = times.length - 1;
  const nextTimes = new Float32Array([times[0], times[last]]);
  const nextValues = new Float32Array(stride * 2);
  for (let i = 0; i < stride; i++) {
    nextValues[i] = values[i];
    nextValues[stride + i] = values[last * stride + i];
  }
  track.times = nextTimes;
  track.values = nextValues;
}

/**
 * In-place. Returns `{ tracks, keys }` so a loader can log the cut.
 * @param {import('three').AnimationClip} clip
 */
export function optimizeClip(clip) {
  if (!clip?.tracks?.length) return { tracks: 0, keys: 0 };
  const kept = [];
  let keys = 0;
  for (const track of clip.tracks) {
    if (isIdentityScale(track)) continue;
    if (isConstantTrack(track)) collapseConstant(track);
    track.optimize?.();
    if (track.times.length === 0) continue;
    kept.push(track);
    keys += track.times.length;
  }
  clip.tracks = kept;
  clip.resetDuration?.();
  return { tracks: kept.length, keys };
}

/**
 * First clip whose name contains any of `names`, else the first clip.
 * @param {import('three').AnimationClip[]} clips
 * @param {string[]} names
 */
export function pickClip(clips, names = []) {
  if (!clips?.length) return null;
  const wanted = names
    .map((name) =>
      clips.find(
        (clip) => clip.name === name || clip.name.toLowerCase().includes(name.toLowerCase())
      )
    )
    .find(Boolean);
  return wanted ?? clips[0];
}

/**
 * Keep only the clips we will bind, optimize them, drop the rest from the
 * loader result so twelve warbear combat takes never sit in memory.
 * @param {{ animations?: import('three').AnimationClip[] }} gltf
 * @param {import('three').AnimationClip[]} keep
 */
export function retainClips(gltf, keep) {
  const unique = [];
  const seen = new Set();
  for (const clip of keep) {
    if (!clip || seen.has(clip)) continue;
    seen.add(clip);
    optimizeClip(clip);
    unique.push(clip);
  }
  if (gltf?.animations) gltf.animations.length = 0;
  return unique;
}

/**
 * Optimize every clip in place and keep them all. Use this when the library
 * is meant to be playable — dropping unused takes is `retainClips`.
 * @param {import('three').AnimationClip[]} clips
 */
export function optimizeAllClips(clips) {
  if (!clips?.length) return [];
  for (const clip of clips) optimizeClip(clip);
  return clips;
}

function hasBoneAncestor(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.isBone) return true;
    parent = parent.parent;
  }
  return false;
}

/**
 * Expand bind-pose bounds so a hit / sway clip cannot frustum-pop, then let
 * the renderer cull the mesh when it is actually off-screen.
 * @param {import('three').Object3D} root
 */
export function prepareSkinned(root) {
  root.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    node.computeBoundingBox?.();
    node.computeBoundingSphere?.();
    const sphere = node.boundingSphere;
    if (sphere && Number.isFinite(sphere.radius)) {
      sphere.radius *= 1.8;
      if (node.geometry?.boundingSphere) {
        node.geometry.boundingSphere.radius = Math.max(
          node.geometry.boundingSphere.radius,
          sphere.radius
        );
      }
    }
    node.frustumCulled = true;
  });
}

/**
 * Stop writing matrices for scenery that the mixer will never touch.
 * Bones and anything welded to a bone stay live.
 * @param {import('three').Object3D} root
 */
export function freezeStatic(root) {
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (node.isBone || node.isSkinnedMesh) return;
    if (hasBoneAncestor(node)) return;
    node.matrixAutoUpdate = false;
  });
}

const FAR_SQ = 12 * 12;
const FAR_STEP = 1 / 12;

/**
 * Tick a list of `{ mixer, root, hot, accum }` actors.
 * Close / `hot` actors run every frame; distant ones sample at 12 Hz.
 * @param {{ mixer: import('three').AnimationMixer, root: import('three').Object3D, hot?: boolean, accum?: number }[]} actors
 * @param {number} dt
 * @param {{ x: number, z: number } | null} origin
 */
export function updateActors(actors, dt, origin) {
  if (dt <= 0) return;
  const ox = origin?.x ?? 0;
  const oz = origin?.z ?? 0;
  for (const actor of actors) {
    const root = actor.root;
    const dx = (root?.position?.x ?? 0) - ox;
    const dz = (root?.position?.z ?? 0) - oz;
    const far = !actor.hot && dx * dx + dz * dz > FAR_SQ;
    if (far) {
      actor.accum = (actor.accum ?? 0) + dt;
      if (actor.accum < FAR_STEP) continue;
      actor.mixer.update(actor.accum);
      actor.accum = 0;
    } else {
      actor.mixer.update(dt);
    }
  }
}
