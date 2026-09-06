// @ts-nocheck
/**
 * Official Toon-RTS {race}.glb kits as the visible player.
 *
 * Play contract: `asset-packs/toon-rts-characters/glb/characters/{race}.glb`,
 * Bip001, 0 embedded clips, equip by mesh visibility. Mixamo is fallback only.
 * Locomotion / attack takes are the official Bip001 packs in
 * `/models/warlords/anims` — never the warbear (`valhalla/human.glb`) and
 * never Mixamo. Those skeletons have a different bind pose and will melt the
 * mesh. Worge is a class, not a mesh swap.
 */
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { LAYER } from '../core/Layers.js';
import { RACES } from '../rpg/catalog.js';
import { dressToonKit } from '../rpg/equipment.js';
import { applyFresnelAura } from '../materials/FresnelAura.js';
import { optimizeAllClips, prepareSkinned } from './optimizeMeshAnimation.js';
import { BIP_ANIM_PACKS, bindBipClip, collectBones } from './comboClips.js';

export const RACE_ORDER = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];

const CAST_ALIAS = {
  idle: 'idle',
  walk: 'walk',
  move: 'walk',
  cast1: 'attack',
  cast2: 'attack',
  cast3: 'attack',
  combo1: 'attack',
  combo2: 'attack',
  combo3: 'attack'
};

const _box = new Box3();
const _size = new Vector3();
const _bone = new Vector3();

function boneBox(object, target) {
  target.makeEmpty();
  let any = false;
  object.updateMatrixWorld(true);
  object.traverse((node) => {
    const name = node.name || '';
    if (!name.startsWith('Bip001')) return;
    if (/Footsteps|Nub/i.test(name)) return;
    node.getWorldPosition(_bone);
    target.expandByPoint(_bone);
    any = true;
  });
  return any;
}

/** Scale from Bip001 structural bbox — not skinned mesh AABB (banned SI fit). */
function plant(object, targetHeight) {
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  if (!boneBox(object, _box)) {
    _box.setFromObject(object);
  }
  _box.getSize(_size);
  const height = Math.max(_size.y, 1e-4);
  const factor = Math.min(8, Math.max(0.004, targetHeight / height));
  object.scale.setScalar(factor);
  object.updateMatrixWorld(true);
  if (!boneBox(object, _box)) _box.setFromObject(object);
  object.position.y -= _box.min.y;
  object.updateMatrixWorld(true);
  return object;
}

function prepareMeshes(root, environment, patched) {
  root.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
    node.layers.set(LAYER.WORLD);
    node.layers.enable(LAYER.CONTACT);
    const source = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of source) {
      if (!material || patched.has(material)) continue;
      patched.add(material);
      applyFresnelAura(material, environment);
    }
  });
}

/**
 * Shared clip list from the worge bear. Bone names match across the race
 * kits (Bip001), so the same takes bind on every Warlord body.
 */
export class RaceAvatar {
  constructor(environment) {
    this.environment = environment;
    this.group = new Group();
    this.group.name = 'RaceAvatar';
    this.group.visible = false;
    this.rigs = new Map();
    this.clips = [];
    this.clipByName = new Map();
    this.raceId = null;
    this.classId = 'warrior';
    this.root = null;
    this.mixer = null;
    this.idle = null;
    this.casts = new Map();
    this._cast = null;
    this._patched = new Set();
    this.ready = false;
    this.onFinished = null;
    this.height = 1.8;
    this._comboPacks = new Map();
    this.weaponType = 'SWORD';
    this._walk = null;
    this._locomo = 'idle';
  }

  /**
   * @param {import('../loaders/AssetLoader.js').AssetLoader} assets
   */
  async load(assets) {
    const entries = RACE_ORDER.map((id) => {
      const race = RACES[id];
      if (!race?.mesh) return null;
      return { id, url: race.mesh, height: race.height ?? 1.8 };
    }).filter(Boolean);

    const packEntries = Object.entries(BIP_ANIM_PACKS);
    const [loaded, packs] = await Promise.all([
      Promise.all(
        entries.map(async (entry) => {
          try {
            const gltf = await assets.loadGLTF(entry.url);
            return { ...entry, gltf };
          } catch (error) {
            console.warn('[RaceAvatar] failed', entry.id, error);
            return { ...entry, gltf: null };
          }
        })
      ),
      Promise.all(
        packEntries.map(async ([role, url]) => {
          try {
            const gltf = await assets.loadGLTF(url);
            return { role, clip: gltf?.animations?.[0] || null };
          } catch (error) {
            console.warn('[RaceAvatar] bip pack failed', role, error);
            return { role, clip: null };
          }
        })
      )
    ]);

    for (const row of loaded) {
      if (!row.gltf?.scene) continue;
      const clone = cloneSkinned(row.gltf.scene);
      clone.name = `Race_${row.id}`;
      prepareMeshes(clone, this.environment, this._patched);
      dressToonKit(clone, 'warrior');
      plant(clone, row.height);
      prepareSkinned(clone);
      clone.visible = false;
      this.rigs.set(row.id, { root: clone, height: row.height });
    }

    const firstRig = this.rigs.values().next().value?.root;
    this.clips = [];
    this.clipByName.clear();
    if (firstRig) {
      const bones = collectBones(firstRig);
      for (const { role, clip } of packs) {
        if (!clip) continue;
        const bound = bindBipClip(clip, bones);
        if (!bound?.tracks?.length) continue;
        bound.name = role;
        this.clips.push(bound);
        this.clipByName.set(role, bound);
      }
      this.clips = optimizeAllClips(this.clips);
      const attack = this.clipByName.get('attack');
      if (attack) {
        for (const id of ['combo1', 'combo2', 'combo3', 'cast1', 'cast2', 'cast3']) {
          this.clipByName.set(id, attack);
        }
      }
    }

    this.ready = this.rigs.size > 0;
    return this;
  }

  has(id) {
    return this.rigs.has(id);
  }

  setRace(raceId, equipped, classId = 'warrior', weaponType) {
    const spec = this.rigs.get(raceId);
    if (!spec) return null;

    this.group.visible = true;

    if (this.root && this.root !== spec.root) {
      this.root.visible = false;
      this.group.remove(this.root);
    }

    this.raceId = raceId;
    this.classId = classId || this.classId || 'warrior';
    if (weaponType) this.weaponType = weaponType;
    this.root = spec.root;
    this.height = spec.height;
    this.root.visible = true;
    if (this.root.parent !== this.group) this.group.add(this.root);

    this._bindMixer();
    this.dress(equipped, this.classId, this.weaponType);
    this.bindCombo(this.weaponType);
    return this.group;
  }

  hide() {
    this.group.visible = false;
    if (this.root) this.root.visible = false;
    this.mixer?.stopAllAction();
    this._cast = null;
  }

  dress(equipped, classId, weaponType) {
    if (!this.root) return;
    if (classId) this.classId = classId;
    if (weaponType) this.weaponType = weaponType;
    dressToonKit(this.root, this.classId || 'warrior', this.weaponType, equipped);
    this.bindCombo(this.weaponType);
  }

  bindCombo(weaponType) {
    if (weaponType) this.weaponType = weaponType;
    const attack = this.clipByName.get('attack');
    if (!attack) return;
    for (const id of ['combo1', 'combo2', 'combo3', 'cast1', 'cast2', 'cast3']) {
      this.clipByName.set(id, attack);
    }
    if (!this.mixer) return;
    const action = this.casts.get('attack');
    if (!action) return;
    for (const id of ['combo1', 'combo2', 'combo3', 'cast1', 'cast2', 'cast3']) {
      this.casts.set(id, action);
    }
  }

  _bindMixer() {
    if (this.mixer) {
      this.mixer.removeEventListener('finished', this._onFinished);
      this.mixer.stopAllAction();
    }
    this.casts.clear();
    this.idle = null;
    this._cast = null;
    this._walk = null;
    this._locomo = 'idle';
    if (!this.root) return;

    this.mixer = new AnimationMixer(this.root);
    this.mixer.addEventListener('finished', this._onFinished);

    const bones = collectBones(this.root);
    const bindClip = (clip) => {
      if (!clip) return null;
      const bound = bindBipClip(clip, bones);
      if (!bound?.tracks?.length) return null;
      return this.mixer.clipAction(bound);
    };

    for (const clip of this.clips) {
      const action = bindClip(clip);
      if (action) this.casts.set(clip.name, action);
    }
    for (const [name, clip] of this.clipByName) {
      if (this.casts.has(name)) continue;
      const action = bindClip(clip);
      if (action) this.casts.set(name, action);
    }

    const stand = this.casts.get('idle');
    if (stand) {
      this.idle = stand;
      this.idle.setLoop(LoopRepeat, Infinity);
      this.idle.enabled = true;
      this.idle.play();
    }

    for (const [alias, name] of Object.entries(CAST_ALIAS)) {
      const action = this.casts.get(name);
      if (action) this.casts.set(alias, action);
    }
    for (const name of ['attack', 'combo1', 'combo2', 'combo3', 'cast1', 'cast2', 'cast3']) {
      const action = this.casts.get(name);
      if (!action) continue;
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    const walk = this.casts.get('walk');
    if (walk) {
      walk.setLoop(LoopRepeat, Infinity);
      this.casts.set('move', walk);
    }
    if (!this._loggedBind) {
      this._loggedBind = true;
      console.info(
        `[RaceAvatar] ${this.raceId || 'rig'} bones=${bones.size} idleTracks=${stand?.getClip?.()?.tracks?.length ?? 0} walkTracks=${walk?.getClip?.()?.tracks?.length ?? 0}`
      );
    }
  }

  setLocomo(mode, speed = 4.6) {
    if (!this.mixer || this._cast) return this._locomo;
    const walk = this.casts.get('walk');
    if (mode === 'walk' && walk) {
      walk.setEffectiveTimeScale(Math.max(0.65, (speed || 4.6) / 4.6));
      if (this._locomo === 'walk') return 'walk';
      this._locomo = 'walk';
      this._walk = walk;
      walk.enabled = true;
      walk.setLoop(LoopRepeat, Infinity);
      walk.setEffectiveWeight(1);
      walk.play();
      if (this.idle && this.idle !== walk) walk.crossFadeFrom(this.idle, 0.14, false);
      return 'walk';
    }
    if (this._locomo === 'idle') return 'idle';
    this._locomo = 'idle';
    if (this._walk && this.idle) {
      this.idle.enabled = true;
      this.idle.setEffectiveWeight(1);
      this.idle.play();
      this.idle.crossFadeFrom(this._walk, 0.16, false);
    }
    this._walk = null;
    return 'idle';
  }

  resolveClip(name) {
    if (!name) return this.idle;
    if (name === 'idle') return this.idle;
    return this.casts.get(name) ?? this.casts.get(CAST_ALIAS[name]) ?? this.casts.get('cast2') ?? this.idle;
  }

  playCast(name) {
    const next = this.resolveClip(name);
    if (!next || !this.idle) return false;
    if (next === this.idle) {
      if (this._cast) {
        this.idle.reset().play();
        this.idle.crossFadeFrom(this._cast, 0.2, false);
        this._cast = null;
      }
      return true;
    }

    const previous = this._cast;
    this._cast = next;
    next.reset();
    next.setLoop(LoopOnce, 1);
    next.clampWhenFinished = true;
    next.setEffectiveTimeScale(1);
    next.play();
    const from = previous ?? this.idle;
    if (from !== next) next.crossFadeFrom(from, 0.12, false);
    return true;
  }

  playClip(name, loop = false) {
    const action = this.resolveClip(name);
    if (!action) return false;
    if (action === this.idle) return this.playCast('idle');
    const previous = this._cast;
    this._cast = action;
    action.reset();
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.play();
    const from = previous ?? this.idle;
    if (from && from !== action) action.crossFadeFrom(from, 0.1, false);
    return true;
  }

  listClips() {
    return this.clips.map((clip) => ({ name: clip.name, duration: clip.duration }));
  }

  _onFinished = (event) => {
    if (event.action !== this._cast) return;
    this._cast = null;
    if (this.idle) {
      this.idle.enabled = true;
      this.idle.setEffectiveTimeScale(1);
      this.idle.crossFadeFrom(event.action, 0.22, false);
    }
    this.onFinished?.(event);
  };

  update(dt) {
    this.mixer?.update(dt);
  }

  dispose() {
    this.mixer?.removeEventListener('finished', this._onFinished);
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.casts.clear();
    this.root = null;
    this.group.clear();
  }
}

export { CAST_ALIAS };
