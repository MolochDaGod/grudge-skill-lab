// @ts-nocheck
import {
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopOnce,
  LoopRepeat,
  Quaternion,
  Vector3
} from 'three';
import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js';
import { LAYER, setLayerRecursive } from '../core/Layers.js';
import {
  pickClip,
  optimizeAllClips,
  prepareSkinned,
  freezeStatic,
  updateActors
} from '../animation/optimizeMeshAnimation.js';
import { dressToonKit } from '../rpg/equipment.js';

const DUMMY_URL = '/models/valhalla/dummy.glb';
const ALLY_TINT = new Color('#9af0b8');
const ALLY_GLOW = new Color('#3adf62');

const RANGE_LAYOUT = {
  boss: { x: 0.2, z: 9.4, height: 4.85, yaw: Math.PI, radius: 1.65, hpMul: 12, name: 'Boss Dummy' },
  pack: [
    { x: 4.6, z: 3.8, yaw: -0.4 },
    { x: 6.1, z: 4.4, yaw: -0.7 },
    { x: 5.0, z: 5.5, yaw: -0.15 },
    { x: 6.6, z: 5.8, yaw: -0.9 }
  ],
  ally: { x: -5.15, z: 4.35, height: 1.82, yaw: 0.55, radius: 0.7, hpMul: 0.9, name: 'Ally Dummy' }
};

const _box = new Box3();
const _size = new Vector3();
const _hit = new Vector3();
const _worldPos = new Vector3();
const _worldQuat = new Quaternion();
const _worldScale = new Vector3();

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prepareMesh(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.map) material.map.anisotropy = 8;
      if (material.alphaMap || material.transparent || (material.map && material.map.format)) {
        if (material.opacity < 1 || material.transparent) {
          material.alphaTest = Math.max(material.alphaTest || 0, 0.35);
          material.transparent = true;
          material.depthWrite = false;
        }
      }
    }
  });
  setLayerRecursive(root, LAYER.WORLD);
  return root;
}

/** Drop onto y = 0 and scale so the world AABB height matches `targetHeight`. */
function plant(object, x, z, targetHeight, yaw = 0) {
  object.rotation.y = yaw;
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  _box.getSize(_size);
  const height = Math.max(_size.y, 1e-4);
  // Degenerate or animation-expanded boxes used to blow these up to arena-scale.
  const factor = Math.min(6, Math.max(0.05, targetHeight / height));
  object.scale.multiplyScalar(factor);
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  object.position.set(x, object.position.y - _box.min.y, z);
  object.updateMatrixWorld(true);
  return object;
}

function cloneWithWorld(source) {
  const copy = source.clone(true);
  source.updateWorldMatrix(true, false);
  source.matrixWorld.decompose(_worldPos, _worldQuat, _worldScale);
  copy.position.copy(_worldPos);
  copy.quaternion.copy(_worldQuat);
  copy.scale.copy(_worldScale);
  return copy;
}

function namedChild(root, name) {
  let found = null;
  root.traverse((node) => {
    if (!found && node.name === name) found = node;
  });
  return found;
}

function paintAlly(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    const next = list.map((material) => {
      if (!material) return material;
      const copy = material.clone();
      if (copy.color) copy.color.multiply(ALLY_TINT);
      if ('emissive' in copy) {
        copy.emissive.copy(ALLY_GLOW);
        copy.emissiveIntensity = Math.max(copy.emissiveIntensity || 0, 0.22);
      }
      return copy;
    });
    node.material = Array.isArray(node.material) ? next : next[0];
  });
}

/** Mixamo / Sketchfab extras: a grey floor plane, locators, empty cubes. */
function stripStageHelpers(root) {
  const drop = [];
  root.traverse((node) => {
    const name = `${node.name || ''} ${node.parent?.name || ''}`;
    if (/^(floor|grid|ground|shadowcatcher|shadow_catcher|locator)/i.test(node.name)) {
      drop.push(node);
      return;
    }
    if (node.isMesh && /floor|grid|ground|shadowcatcher/i.test(name)) drop.push(node);
  });
  for (const node of drop) node.removeFromParent();
  return root;
}

function bindLibrary(id, label, gltf, root, idleNames, { hot = false } = {}) {
  const clips = optimizeAllClips(gltf.animations ?? []);
  const mixer = new AnimationMixer(root);
  const actions = new Map();
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.enabled = true;
    actions.set(clip.name, action);
  }
  const idleClip = pickClip(clips, idleNames);
  const idle = idleClip ? actions.get(idleClip.name) : null;
  if (idle) {
    idle.setLoop(LoopRepeat, Infinity);
    idle.play();
  }
  return {
    id,
    label,
    root,
    mixer,
    clips,
    actions,
    idle,
    current: idle,
    hot,
    accum: 0
  };
}

/**
 * Combat range: one boss dummy, a pack of four small hostiles, and a light-green
 * ally that ticks damage so heals can be proven. Totems are class F summons.
 */
export class WorldProps {
  constructor(scene) {
    this.scene = scene;
    this.root = new Group();
    this.root.name = 'ValhallaGrove';
    scene.add(this.root);

    this.mixers = [];
    this.libraries = {};
    this.racePad = new Vector3(11.4, 0, -4.4);
    this.raceMeshes = new Map();
    this.raceShown = null;
    this.units = [];
    this.boss = null;
    this.ally = null;
    this.pack = [];
    this.totems = [];
    this._totemCrown = new Vector3();
    this._dummyPos = new Vector3(RANGE_LAYOUT.boss.x, 0, RANGE_LAYOUT.boss.z);
  }

  get dummy() {
    return this.boss?.root ?? null;
  }

  get dummyPos() {
    return this.boss?.pos ?? this._dummyPos;
  }

  get dummyHp() {
    return this.boss?.hp ?? 0;
  }

  get dummyHpMax() {
    return this.boss?.hpMax ?? 1;
  }

  get dummyDown() {
    return this.boss?.down ?? 0;
  }

  get dummyRadius() {
    return this.boss?.radius ?? 1.65;
  }

  get dummyHit() {
    return this.boss?.hit ?? null;
  }

  hostiles() {
    return this.units.filter((unit) => unit.role === 'hostile');
  }

  /**
   * @param {import('../loaders/AssetLoader.js').AssetLoader} assets
   */
  async load(assets) {
    const dummyGltf = await assets.loadGLTF(DUMMY_URL);
    this._seedRange(dummyGltf);
  }

  _seedRange(gltf) {
    const proto = prepareMesh(gltf.scene);
    stripStageHelpers(proto);

    this.boss = this._spawnUnit({
      id: 'boss',
      role: 'hostile',
      name: RANGE_LAYOUT.boss.name,
      gltf,
      proto,
      x: RANGE_LAYOUT.boss.x,
      z: RANGE_LAYOUT.boss.z,
      height: RANGE_LAYOUT.boss.height,
      yaw: RANGE_LAYOUT.boss.yaw,
      radius: RANGE_LAYOUT.boss.radius,
      hpMul: RANGE_LAYOUT.boss.hpMul
    });

    this.pack = RANGE_LAYOUT.pack.map((row, index) =>
      this._spawnUnit({
        id: `pack-${index + 1}`,
        role: 'hostile',
        name: `Pack Dummy ${index + 1}`,
        gltf,
        proto,
        x: row.x,
        z: row.z,
        height: 1.12,
        yaw: row.yaw,
        radius: 0.42,
        hpMul: 0.32
      })
    );

    this.ally = this._spawnUnit({
      id: 'ally',
      role: 'ally',
      name: RANGE_LAYOUT.ally.name,
      gltf,
      proto,
      x: RANGE_LAYOUT.ally.x,
      z: RANGE_LAYOUT.ally.z,
      height: RANGE_LAYOUT.ally.height,
      yaw: RANGE_LAYOUT.ally.yaw,
      radius: RANGE_LAYOUT.ally.radius,
      hpMul: RANGE_LAYOUT.ally.hpMul,
      tint: true,
      dot: 18
    });
  }

  _spawnUnit({ id, role, name, gltf, proto, x, z, height, yaw, radius, hpMul, tint = false, dot = 0 }) {
    const root = SkeletonUtils.clone(proto);
    prepareMesh(root);
    plant(root, x, z, height, yaw);
    prepareSkinned(root);
    freezeStatic(root);
    if (tint) paintAlly(root);
    root.name = `Range_${id}`;
    this.root.add(root);

    const library = bindLibrary(id, name, { animations: gltf.animations ?? [] }, root, ['Damaged_Small', 'small'], {
      hot: role !== 'ally'
    });
    this.libraries[id] = library;
    this.mixers.push(library);
    this._bindHit(library);

    const unit = {
      id,
      role,
      name,
      root,
      library,
      pos: new Vector3(x, 0, z),
      radius,
      height,
      hpMul,
      hpMax: 200,
      hp: 200,
      down: 0,
      dot,
      hit: library.actions.get(pickClip(library.clips, ['Damaged_Big', 'big'])?.name) || null,
      idle: library.idle
    };
    this.units.push(unit);
    return unit;
  }

  _bindHit(library) {
    const small = pickClip(library.clips, ['Damaged_Small', 'small']);
    const big = pickClip(library.clips, ['Damaged_Big', 'big']);
    const idle = small ? library.actions.get(small.name) : library.idle;
    const hit = big ? library.actions.get(big.name) : null;
    if (idle) {
      idle.setLoop(LoopRepeat, Infinity);
      idle.play();
      library.idle = idle;
      library.current = idle;
    }
    if (hit) {
      hit.setLoop(LoopOnce, 1);
      hit.clampWhenFinished = true;
      library.mixer.addEventListener('finished', (event) => {
        if (event.action === hit && library.current === hit) {
          hit.fadeOut(0.15);
          idle?.reset().fadeIn(0.2).play();
          library.current = idle;
        }
      });
    }
  }

  registerTotem(entry) {
    this.unregisterTotem(entry.id, entry.ability);
    this.totems.push(entry);
  }

  unregisterTotem(id, ability) {
    this.totems = this.totems.filter((row) => row.id !== id || (ability && row.ability !== ability));
  }

  pulseTotems(reason = 'act') {
    for (const row of this.totems) row.ability?.pulse?.(reason);
  }

  /**
   * Green / heal wind from each live class totem toward the dummy.
   */
  flowTotems(dt, wind, attractor, time = 0) {
    if (!wind || !this.totems.length) return;
    const target = attractor || this.dummyPos;
    for (const totem of this.totems) {
      this._totemCrown.set(totem.pos.x, totem.crown, totem.pos.z);
      wind.flow(this._totemCrown, target, dt, {
        palette: totem.palette,
        height: 0,
        targetHeight: 1.15,
        windRate: 48,
        mistRate: 22,
        leafRate: totem.palette === 'green' ? 5 : 2,
        glintRate: totem.palette === 'heal' ? 12 : 0,
        time
      });
    }
  }

  /**
   * Play the dummy's big-hit clip. Combat owns whether the body was actually hit.
   */
  notifyHit(unit = this.boss) {
    const target = unit || this.boss;
    if (!target?.hit) return;
    const library = target.library;
    target.idle?.fadeOut(0.08);
    target.hit.reset().setEffectiveWeight(1).fadeIn(0.05).play();
    if (library) library.current = target.hit;
  }

  nearestHostile(from) {
    let best = null;
    let bestD = Infinity;
    for (const unit of this.hostiles()) {
      if (unit.down > 0) continue;
      const d = Math.hypot((from?.x || 0) - unit.pos.x, (from?.z || 0) - unit.pos.z);
      if (d < bestD) {
        best = unit;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Play a named clip from a grove actor's full library.
   * @param {string} actorId
   * @param {string} clipName
   * @param {{ loop?: boolean }} [options]
   */
  playClip(actorId, clipName, options = {}) {
    const library = this.libraries[actorId];
    if (!library) return false;
    const wanted = String(clipName || '');
    let action = library.actions.get(wanted);
    if (!action) {
      const clip = pickClip(library.clips, [wanted]);
      action = clip ? library.actions.get(clip.name) : null;
    }
    if (!action) return false;
    const loop = options.loop !== false;
    if (library.current && library.current !== action) library.current.fadeOut(0.12);
    action.reset();
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.setEffectiveWeight(1).fadeIn(0.08).play();
    library.current = action;
    library.hot = true;
    return true;
  }

  listLibraries() {
    return Object.values(this.libraries).map((library) => ({
      id: library.id,
      label: library.label,
      clips: library.clips.map((clip) => ({ name: clip.name, duration: clip.duration }))
    }));
  }

  /**
   * Plant a race mesh on the grove pad. Caller loads the GLTF.
   * @param {string} id
   * @param {{ scene: import('three').Object3D }} gltf
   * @param {number} [height]
   */
  showRaceMesh(id, gltf, height = 1.78) {
    for (const mesh of this.raceMeshes.values()) mesh.visible = false;
    let model = this.raceMeshes.get(id);
    if (!model && gltf?.scene) {
      model = prepareMesh(gltf.scene);
      dressToonKit(model, 'warrior');
      plant(model, this.racePad.x, this.racePad.z, height, Math.PI * 0.2);
      prepareSkinned(model);
      freezeStatic(model);
      this.root.add(model);
      this.raceMeshes.set(id, model);
    }
    if (!model) return false;
    model.visible = true;
    this.raceShown = id;
    return true;
  }

  hideRaceMeshes() {
    for (const mesh of this.raceMeshes.values()) mesh.visible = false;
    this.raceShown = null;
  }

  setDummyMax(hpMax) {
    const base = Math.max(80, Math.round(hpMax || 200));
    for (const unit of this.units) {
      const next = Math.max(40, Math.round(base * (unit.hpMul || 1)));
      const ratio = unit.hpMax > 0 ? unit.hp / unit.hpMax : 1;
      unit.hpMax = next;
      if (unit.down > 0) unit.hp = 0;
      else unit.hp = Math.max(1, Math.round(next * ratio));
    }
  }

  hurtUnit(unit, amount) {
    if (!unit || unit.role === 'ally') {
      return { dealt: 0, hp: unit?.hp ?? 0, hpMax: unit?.hpMax ?? 1, killed: false, overkill: 0, unit };
    }
    if (unit.down > 0 || unit.hp <= 0) {
      return { dealt: 0, hp: 0, hpMax: unit.hpMax, killed: false, overkill: 0, unit };
    }
    const dealt = Math.min(unit.hp, Math.max(1, Math.round(amount)));
    unit.hp -= dealt;
    this.notifyHit(unit);
    const killed = unit.hp <= 0;
    if (killed) {
      unit.hp = 0;
      unit.down = unit.id === 'boss' ? 3.4 : 2.4;
    }
    return {
      dealt,
      hp: unit.hp,
      hpMax: unit.hpMax,
      killed,
      overkill: Math.max(0, Math.round(amount) - dealt),
      unit
    };
  }

  hurtDummy(amount) {
    return this.hurtUnit(this.boss, amount);
  }

  healUnit(unit, amount) {
    const target = unit || this.ally || this.boss;
    if (!target) return { healed: 0, hp: 0, hpMax: 1, revived: false, unit: null };
    if (target.down > 0) {
      return { healed: 0, hp: 0, hpMax: target.hpMax, revived: false, unit: target };
    }
    const room = Math.max(0, target.hpMax - target.hp);
    const healed = Math.min(room, Math.max(1, Math.round(amount)));
    target.hp = Math.min(target.hpMax, target.hp + healed);
    return { healed, hp: target.hp, hpMax: target.hpMax, revived: false, unit: target };
  }

  healDummy(amount) {
    return this.healUnit(this.ally, amount);
  }

  /**
   * Play the dummy's big-hit clip when a cast lands near it.
   */
  notifyCast(origin, direction, distance) {
    _hit.copy(direction).multiplyScalar(Math.min(distance, 14)).add(origin);
    for (const unit of this.hostiles()) {
      const reach = Math.hypot(_hit.x - unit.pos.x, _hit.z - unit.pos.z);
      if (reach <= unit.radius + 1.4) this.notifyHit(unit);
    }
  }

  snapshotUnits() {
    return this.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      role: unit.role,
      hp: unit.hp,
      hpMax: unit.hpMax,
      down: unit.down > 0,
      x: unit.pos.x,
      z: unit.pos.z,
      height: unit.height
    }));
  }

  update(dt, origin) {
    updateActors(this.mixers, dt, origin);
    for (const unit of this.units) {
      if (unit.down > 0) {
        unit.down -= dt;
        if (unit.down <= 0) {
          unit.down = 0;
          unit.hp = unit.hpMax;
        }
      } else if (unit.role === 'ally' && unit.dot > 0) {
        const floor = unit.hpMax * 0.12;
        unit.hp = Math.max(floor, unit.hp - unit.dot * dt);
      }
    }
  }

  dispose() {
    for (const actor of this.mixers) actor.mixer?.stopAllAction();
    this.mixers.length = 0;
    this.root.removeFromParent();
  }
}
