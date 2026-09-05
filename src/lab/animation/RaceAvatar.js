// @ts-nocheck
/**
 * Official Toon-RTS {race}.glb kits as the visible player.
 *
 * Play contract: `asset-packs/toon-rts-characters/glb/characters/{race}.glb`,
 * Bip001, 0 embedded clips, equip by mesh visibility. Mixamo is fallback only.
 * The animated worge bear (`valhalla/human.glb`) is the clip source and grove
 * NPC — never a player body. Worge is a class, not a mesh swap.
 */
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { LAYER } from '../core/Layers.js';
import { RACES, WARBEAR_URL } from '../rpg/catalog.js';
import { dressToonKit } from '../rpg/equipment.js';
import { applyFresnelAura } from '../materials/FresnelAura.js';
import { optimizeAllClips } from './optimizeMeshAnimation.js';
import { collectBones, loadWeaponComboClips } from './comboClips.js';
import { canonicalWeapon } from '../rpg/weapons.js';

export const RACE_ORDER = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];

const CAST_ALIAS = {
  idle: 'warbear_stand',
  cast1: 'warbear_activeSkill',
  cast2: 'warbear_attack00',
  cast3: 'warbear_attack01',
  combo1: 'combo1',
  combo2: 'combo2',
  combo3: 'combo3'
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

    const [clipGltf] = await Promise.all([
      assets.loadGLTF(WARBEAR_URL).catch((error) => {
        console.warn('[RaceAvatar] warbear clips failed', error);
        return null;
      })
    ]);

    const loaded = await Promise.all(
      entries.map(async (entry) => {
        try {
          const gltf = await assets.loadGLTF(entry.url);
          return { ...entry, gltf };
        } catch (error) {
          console.warn('[RaceAvatar] failed', entry.id, error);
          return { ...entry, gltf: null };
        }
      })
    );

    const extra = loaded.flatMap((row) => row.gltf?.animations ?? []);
    this.clips = optimizeAllClips([...(clipGltf?.animations ?? []), ...extra]);
    const seen = new Set();
    this.clips = this.clips.filter((clip) => {
      if (seen.has(clip.name)) return false;
      seen.add(clip.name);
      return true;
    });
    for (const clip of this.clips) this.clipByName.set(clip.name, clip);

    for (const row of loaded) {
      if (!row.gltf?.scene) continue;
      const clone = cloneSkinned(row.gltf.scene);
      clone.name = `Race_${row.id}`;
      prepareMeshes(clone, this.environment, this._patched);
      dressToonKit(clone, 'warrior');
      plant(clone, row.height);
      clone.visible = false;
      this.rigs.set(row.id, { root: clone, height: row.height });
    }

    const firstRig = this.rigs.values().next().value?.root;
    if (firstRig) {
      try {
        this._comboPacks = await loadWeaponComboClips(assets, collectBones(firstRig), 'bip');
      } catch (error) {
        console.warn('[RaceAvatar] weapon combos failed', error);
        this._comboPacks = new Map();
      }
      this.bindCombo('SWORD');
    }
    if (!this.clipByName.has('combo1')) {
      const fallback = ['warbear_attack00', 'warbear_attack01', 'warbear_activeSkill'];
      ['combo1', 'combo2', 'combo3'].forEach((id, index) => {
        const src = this.clipByName.get(fallback[index]);
        if (src) this.clipByName.set(id, src);
      });
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

  bindCombo(weaponType, pack) {
    if (weaponType) this.weaponType = weaponType;
    const id = canonicalWeapon(this.weaponType);
    const resolved = pack || this._comboPacks.get(id) || this._comboPacks.get('SWORD');
    if (!resolved?.clips?.length) return;
    for (const clip of resolved.clips) {
      this.clipByName.set(clip.name, clip);
      if (this.mixer) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        action.timeScale = clip.userData.timeScale || resolved.timeScale || 1;
        this.casts.set(clip.name, action);
      }
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
    if (!this.root) return;

    this.mixer = new AnimationMixer(this.root);
    this.mixer.addEventListener('finished', this._onFinished);

    for (const clip of this.clips) {
      const action = this.mixer.clipAction(clip);
      this.casts.set(clip.name, action);
    }
    for (const [name, clip] of this.clipByName) {
      if (this.casts.has(name)) continue;
      this.casts.set(name, this.mixer.clipAction(clip));
    }

    const stand = this.clipByName.get('warbear_stand') ?? this.clips[0];
    if (stand) {
      this.idle = this.mixer.clipAction(stand);
      this.idle.setLoop(LoopRepeat, Infinity);
      this.idle.enabled = true;
      this.idle.play();
    }

    for (const [alias, name] of Object.entries(CAST_ALIAS)) {
      const action = this.casts.get(name);
      if (action) this.casts.set(alias, action);
    }
    for (const name of ['warbear_activeSkill', 'warbear_attack00', 'warbear_attack01', 'combo1', 'combo2', 'combo3']) {
      const action = this.casts.get(name);
      if (!action) continue;
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
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
