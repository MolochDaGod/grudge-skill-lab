// @ts-nocheck
import {
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3
} from 'three';
import { settings, CAST_ANIMATIONS } from '../config/settings.js';
import { applyFresnelAura } from '../materials/FresnelAura.js';
import { LAYER } from '../core/Layers.js';
import { MaterialLibrary } from '../loaders/MaterialLibrary.js';
import { disposeObject } from '../utils/dispose.js';
import { optimizeClip } from './optimizeMeshAnimation.js';
import { RaceAvatar } from './RaceAvatar.js';
import { bodyForm } from '../rpg/catalog.js';
import { collectBones, loadWeaponComboClips } from './comboClips.js';
import { canonicalWeapon } from '../rpg/weapons.js';

const CHARACTER_URL = './models/Idle.fbx';
/**
 * The look, as a glTF export of the same model.
 *
 * FBX is the only format the rig survives, and it carries almost none of the
 * authored surface — no metallic/roughness, no normal, no emissive. So the
 * materials come from an unrigged GLB of the same body instead, matched onto
 * the rig by material name (see `loaders/MaterialLibrary.js`). Set it to null
 * to fall back to the flat diffuse skin below.
 */
const MATERIAL_LIBRARY_URL = './textures/textures.glb';

/**
 * Rig material name -> library material name, for exports that disagree.
 *
 * Normally empty: both files come out of the same scene, so the names already
 * line up and `MaterialLibrary` matches them without help. Add an entry only
 * when a rig arrives with a material the palette calls something else.
 */
const MATERIAL_ALIASES = {
  // 'skin_mat': 'body_mat'
};

/**
 * Whether the palette's textures have to be flipped to sit on this rig.
 *
 * glTF measures V from the top of the image, FBX from the bottom, so a glTF
 * material applied to an FBX body is upside down until one of them gives. Read
 * off the rig's own format rather than hardcoded, so swapping the body for a
 * glTF export turns the correction off by itself. See
 * `MaterialLibrary#flipTextureV` for why this is not simply `texture.flipY`.
 */
const MATERIAL_LIBRARY_FLIP_V = /\.fbx$/i.test(CHARACTER_URL);

/**
 * The flat colour map, for anything the palette cannot dress.
 *
 * The FBX carries no material of its own worth the name, so before the palette
 * existed this was the whole look. It is the fallback now: a rig material the
 * library has no match for still gets a skin rather than turning grey.
 */
const CHARACTER_TEXTURE_URL = './models/diffuse.png';
/** One file per entry in `CAST_ANIMATIONS`; only their clips are kept. */
const castUrl = (name) => `./models/${name}.fbx`;
/** Mixamo exports in centimetres. */
const FBX_SCALE = 0.01;
/** Rigs vary; normalise to a believable human height so the world scale holds. */
const TARGET_HEIGHT = 1.78;

/**
 * The skeleton, as the places a body effect can be hung on.
 *
 * Each entry names a bone; the **segment** it stands for is the line from its
 * parent's joint to its own, which is what actually tiles a body — a bone's
 * world position is the joint at its head, so `LeftHand` is the forearm,
 * `LeftFoot` is the shin, and so on. Anything with no parent bone, and every
 * finger, toe tip and twist helper, is left out: they are joints a rig needs and
 * not places anyone would look for fire.
 *
 * `weight` is how many slots the segment takes in the list `writeBoneSegments`
 * builds, and effects pick a slot uniformly — so a chest listed twice simply
 * catches twice as much fire as a forearm listed once. Doing the weighting by
 * repetition rather than by a distribution is what lets a shader pick a segment
 * with one array lookup instead of walking a table of probabilities.
 *
 * `radius` is the half-width of the limb there as a fraction of the character's
 * height, so it survives the rig being re-scaled.
 *
 * Keyed on the short Mixamo names, as `_measureFacing` already is: a rig that
 * names its bones something else simply contributes nothing here, and the
 * effects that use this fall back to the height alone rather than breaking.
 */
const BONE_SEGMENTS = [
  { bone: 'Spine', weight: 2, radius: 0.085 },
  { bone: 'Spine1', weight: 2, radius: 0.09 },
  { bone: 'Spine2', weight: 2, radius: 0.09 },
  { bone: 'Neck', weight: 1, radius: 0.055 },
  { bone: 'Head', weight: 2, radius: 0.05 },
  { bone: 'LeftShoulder', weight: 1, radius: 0.05 },
  { bone: 'RightShoulder', weight: 1, radius: 0.05 },
  { bone: 'LeftArm', weight: 1, radius: 0.045 },
  { bone: 'RightArm', weight: 1, radius: 0.045 },
  { bone: 'LeftForeArm', weight: 2, radius: 0.04 }, // the upper arm
  { bone: 'RightForeArm', weight: 2, radius: 0.04 },
  { bone: 'LeftHand', weight: 2, radius: 0.033 }, // the forearm
  { bone: 'RightHand', weight: 2, radius: 0.033 },
  { bone: 'LeftUpLeg', weight: 1, radius: 0.06 },
  { bone: 'RightUpLeg', weight: 1, radius: 0.06 },
  { bone: 'LeftLeg', weight: 2, radius: 0.056 }, // the thigh
  { bone: 'RightLeg', weight: 2, radius: 0.056 },
  { bone: 'LeftFoot', weight: 2, radius: 0.042 }, // the shin
  { bone: 'RightFoot', weight: 2, radius: 0.042 },
  { bone: 'LeftToeBase', weight: 1, radius: 0.035 }, // the foot
  { bone: 'RightToeBase', weight: 1, radius: 0.035 }
];

/** Scratch for the world-space joint lookups. */
const _joint = new Vector3();

/** Strip Mixamo namespaces and 3ds Max numeric suffixes (`Bip001 Head_018`). */
const stripBone = (name) =>
  name
    .split(':')
    .pop()
    .replace(/^mixamorig/i, '')
    .replace(/_\d+$/, '');

const BIP_TO_MIXAMO = {
  'Bip001 Spine': 'Spine',
  'Bip001 Spine1': 'Spine1',
  Spine2: 'Spine2',
  'Bip001 Neck': 'Neck',
  'Bip001 Head': 'Head',
  'Bip001 L Clavicle': 'LeftShoulder',
  'Bip001 R Clavicle': 'RightShoulder',
  'Bip001 L UpperArm': 'LeftArm',
  'Bip001 R UpperArm': 'RightArm',
  'Bip001 L Forearm': 'LeftForeArm',
  'Bip001 R Forearm': 'RightForeArm',
  'Bip001 L Hand': 'LeftHand',
  'Bip001 R Hand': 'RightHand',
  'Bip001 L Thigh': 'LeftUpLeg',
  'Bip001 R Thigh': 'RightUpLeg',
  'Bip001 L Calf': 'LeftLeg',
  'Bip001 R Calf': 'RightLeg',
  'Bip001 L Foot': 'LeftFoot',
  'Bip001 R Foot': 'RightFoot',
  'Bip001 L Toe0': 'LeftToeBase',
  'Bip001 R Toe0': 'RightToeBase'
};

const BIP_TO_MIXAMO_NORM = Object.fromEntries(
  Object.entries(BIP_TO_MIXAMO).map(([key, value]) => [key.replace(/[:\s]+/g, '_'), value])
);

const shortBoneName = (name) => {
  const short = stripBone(name);
  return BIP_TO_MIXAMO[short] || BIP_TO_MIXAMO_NORM[short.replace(/[:\s]+/g, '_')] || short;
};

/**
 * Loads the rigged FBX, normalises it for the scene and drives its animation.
 *
 * The character never leaves the spot — it breathes on a loop, turns to face
 * where you are aiming, and throws one of the cast clips when you fire. Those
 * clips ship as separate Mixamo exports of the *same* skeleton, so only their
 * `AnimationClip` is kept: the mixer binds tracks by bone name, which is all
 * that a shared rig needs for a clip authored in another file to play here.
 *
 * Which clip an ability throws is `settings[element].castAnim` — a per-ability
 * choice, editable live, which is why `playCast` takes the name each time
 * rather than caching one.
 */
export class CharacterController {
  constructor(environment) {
    this.environment = environment;
    this.root = new Group();
    this.root.name = 'Character';

    // Position and heading live on `root`; the bank (walk mode leans into its
    // turns) lives on a joint underneath it, so the two never fight over the
    // same rotation.
    this.tilt = new Group();
    this.tilt.name = 'CharacterTilt';
    this.root.add(this.tilt);

    this.mixer = null;
    /** The looping breath, always running underneath a cast. */
    this.idle = null;
    /** name → one-shot cast action. */
    this.casts = new Map();
    this._cast = null;
    this._holding = false;
    this._holdAt = 0.42;
    this._bones = new Map();
    /** The authored palette the rig is dressed from, null if it failed to load. */
    this.materialLibrary = null;
    /** Materials already carrying the aura patch, so none of them gets it twice. */
    this._patched = new Set();
    this.height = 1.8;
    this.headPosition = new Vector3(0, 1.5, 0);
    /** The rig's own forward, in model space — the axis a bank rotates about. */
    this.forwardAxis = new Vector3(0, 0, 1);
    /**
     * The skeleton as a flat, already-weighted list of limb segments — see
     * `BONE_SEGMENTS`. Empty until the rig loads, and empty forever if the rig
     * does not use Mixamo's bone names.
     */
    this.boneSegments = [];

    /**
     * Yaw of the rig's own forward in model space. Bind poses are not
     * necessarily axis aligned, so `setFacing` subtracts this to make "0 faces
     * +Z" true for the caller regardless of how the FBX was authored.
     */
    this._forwardYaw = 0;
    /** 0..1 lunge envelope, decays on its own after `castLunge()`. */
    this._lunge = 0;
    /** +1 step-in (melee), −1 hop-off (ranged). */
    this._lungeSign = 1;
    /** Root-motion step: combo locomotion that actually moves the body. */
    this._step = null;
    this._hover = 0;
    this._ghost = false;
    this._moveX = 0;
    this._moveZ = 0;
    this._speed = 0;
    this._locomo = 'idle';
    this._walkSpeed = 4.6;
    this._rightAxis = new Vector3(1, 0, 0);
    /** Optional Rapier mover: `(dx, dz) => {x,z} | null`. */
    this.mover = null;
    /** Race GLB overlay. Null until `adoptAvatar`. Mixamo is fallback only. */
    this.avatar = null;
    this._avatarMixer = null;
    this._mixamoHidden = false;
    this._mixamo = null;
    this._classId = 'warrior';
    this._weaponType = 'SWORD';
    this._comboPacks = new Map();
  }

  /**
   * @param {import('../loaders/AssetLoader.js').AssetLoader} assets
   */
  async load(assets) {
    // The cast files are the same character again, so they cost a parse each
    // but nothing at run time — everything but the clip is thrown away below.
    const mixamoCasts = CAST_ANIMATIONS.filter((name) => /^cast\d+$/.test(name));
    const [fbx, skin, library, ...castFiles] = await Promise.all([
      assets.loadFBX(CHARACTER_URL),
      assets.loadTexture(CHARACTER_TEXTURE_URL),
      MATERIAL_LIBRARY_URL
        ? MaterialLibrary.load(assets, MATERIAL_LIBRARY_URL, {
            aliases: MATERIAL_ALIASES,
            flipV: MATERIAL_LIBRARY_FLIP_V
          })
        : Promise.resolve(null),
      ...mixamoCasts.map((name) => assets.loadFBX(castUrl(name)))
    ]);
    // The FBX resolves before its textures do; material prep inspects them.
    await assets.settled();

    fbx.scale.setScalar(FBX_SCALE);
    fbx.updateMatrixWorld(true);

    const box = new Box3().setFromObject(fbx);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);

    // Normalise the rig's height, then drop it onto y = 0 and centre it.
    fbx.scale.setScalar(FBX_SCALE * (TARGET_HEIGHT / Math.max(0.001, size.y)));
    fbx.updateMatrixWorld(true);
    box.setFromObject(fbx);
    box.getSize(size);
    box.getCenter(center);
    this.height = size.y;
    fbx.position.x -= center.x;
    fbx.position.z -= center.z;
    fbx.position.y -= box.min.y;

    this.materialLibrary = library;
    this._prepareMaterials(fbx, skin, library);
    this._measureFacing(fbx);
    this._measureSkeleton(fbx);

    this.tilt.add(fbx);
    this.model = fbx;
    this.headPosition.set(0, size.y * 0.86, 0);

    this.mixer = new AnimationMixer(fbx);
    this.mixer.addEventListener('finished', this._onCastFinished);

    // The breath ships inside the character file itself.
    const idleClip = (fbx.animations ?? [])[0];
    if (!idleClip) {
      console.warn('[CharacterController] no idle clip found in the FBX');
    } else {
      optimizeClip(idleClip);
      this.idle = this.mixer.clipAction(idleClip);
      this.idle.setLoop(LoopRepeat, Infinity);
      this.idle.play();
    }

    const bones = new Set();
    fbx.traverse((node) => bones.add(node.name));
    mixamoCasts.forEach((name, index) => this._registerCast(name, castFiles[index], bones));

    try {
      this._comboPacks = await loadWeaponComboClips(assets, collectBones(fbx), 'mixamo');
    } catch (error) {
      console.warn('[CharacterController] weapon combos failed', error);
    }
    this.bindCombo(this._weaponType);

    return this;
  }

  /**
   * Load official Toon-RTS race kits so a later race pick can swap bodies.
   * Mixamo stays loaded as fallback only. Worge is a class, not a bear mesh.
   */
  async adoptAvatar(assets, raceId = 'human', equipped = null, classId = 'warrior', weaponType) {
    if (weaponType) this._weaponType = weaponType;
    if (this.avatar?.ready) {
      this.setRace(raceId, equipped, classId, this._weaponType);
      return this;
    }
    const avatar = new RaceAvatar(this.environment);
    try {
      await avatar.load(assets);
    } catch (error) {
      console.warn('[CharacterController] race avatar failed', error);
      return this;
    }
    if (!avatar.ready) return this;
    this.avatar = avatar;
    avatar.onFinished = this._onCastFinished;
    this.tilt.add(avatar.group);
    this.setRace(raceId, equipped, classId, this._weaponType);
    return this;
  }

  _stashMixamo() {
    if (this._mixamo || !this.model) return;
    this._mixamo = {
      mixer: this.mixer,
      idle: this.idle,
      casts: this.casts,
      height: this.height,
      model: this.model
    };
  }

  _hideMixamo() {
    if (!this.model || this._mixamoHidden) return;
    this.model.visible = false;
    this.model.traverse((node) => {
      if (node.isMesh || node.isSkinnedMesh) node.visible = false;
    });
    this._mixamoHidden = true;
    this.mixer?.stopAllAction();
  }

  _showMixamo() {
    if (!this.model) return;
    const already = !this._mixamoHidden && this.model.visible;
    this.model.visible = true;
    this.model.traverse((node) => {
      if (node.isMesh || node.isSkinnedMesh) node.visible = true;
    });
    this._mixamoHidden = false;
    const stash = this._mixamo;
    if (stash) {
      this.mixer = stash.mixer;
      this.idle = stash.idle;
      this.casts = stash.casts;
      this.height = stash.height;
    }
    this._avatarMixer = null;
    this._cast = null;
    if (this.idle && !already) {
      this.idle.enabled = true;
      this.idle.reset().play();
    }
    this.headPosition.set(0, this.height * 0.86, 0);
    this._measureFacing(this.model);
    this._measureSkeleton(this.model);
  }

  get usingAvatar() {
    return Boolean(this._mixamoHidden && this.avatar?.ready && this.avatar.group.visible);
  }

  setRace(raceId, equipped, classId = 'warrior', weaponType) {
    this._stashMixamo();
    this._classId = classId;
    if (weaponType) this._weaponType = weaponType;
    const formId = bodyForm(raceId, classId);
    const wantsAvatar = formId !== 'mixamo' && this.avatar?.has(formId);
    if (!wantsAvatar) {
      this.avatar?.hide();
      if (this.avatar?.group?.parent) this.avatar.group.removeFromParent();
      this._showMixamo();
      this.bindCombo(this._weaponType);
      return true;
    }

    if (this.avatar.group.parent !== this.tilt) this.tilt.add(this.avatar.group);
    const group = this.avatar.setRace(formId, equipped, classId, this._weaponType);
    if (!group) {
      this.avatar?.hide();
      this._showMixamo();
      return false;
    }

    this._hideMixamo();
    this._avatarMixer = this.avatar.mixer;
    this.idle = this.avatar.idle;
    this.casts = this.avatar.casts;
    this._cast = null;

    const root = this.avatar.root;
    root.updateMatrixWorld(true);
    this.height = this.avatar.height || 1.8;
    this.headPosition.set(0, this.height * 0.86, 0);
    this._measureFacing(root);
    this._measureSkeleton(root);
    this.bindCombo(this._weaponType);
    return true;
  }

  dress(equipped, classId = this._classId, weaponType = this._weaponType) {
    this._classId = classId || this._classId;
    if (weaponType) this._weaponType = weaponType;
    this.avatar?.dress(equipped, this._classId, this._weaponType);
    this.bindCombo(this._weaponType);
  }

  /**
   * Swap 1-2-3 onto the combo pack that matches the equipped melee class.
   */
  bindCombo(weaponType) {
    if (weaponType) this._weaponType = weaponType;
    const id = canonicalWeapon(this._weaponType);
    const pack = this._comboPacks.get(id) || this._comboPacks.get('SWORD');
    if (this.usingAvatar) {
      this.avatar?.bindCombo?.(id);
      return pack?.label || id;
    }
    if (!pack?.clips?.length) return pack?.label || id;
    if (this.mixer) {
      for (const clip of pack.clips) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        action.timeScale = clip.userData.timeScale || pack.timeScale || 1;
        this.casts.set(clip.name, action);
      }
    }
    return pack.label || id;
  }

  /**
   * Keep one cast file's clip and release the duplicate rig that came with it.
   *
   * @param {string} name                 the id used by `settings[element].castAnim`
   * @param {import('three').Group} file  the freshly loaded FBX
   * @param {Set<string>} bones           every node name in *this* rig
   */
  _registerCast(name, file, bones) {
    const clip = (file?.animations ?? [])[0];
    if (!clip) {
      console.warn(`[CharacterController] "${name}.fbx" carries no animation`);
      return;
    }

    // A clip authored against another export of this rig binds by bone name, so
    // a mismatch shows up as a track that resolves to nothing rather than as an
    // error — say so here instead of letting the cast silently do nothing.
    if (!clip.tracks.some((track) => bones.has(track.name.split('.')[0]))) {
      console.warn(`[CharacterController] "${name}.fbx" does not match this skeleton`);
      return;
    }

    clip.name = name;
    optimizeClip(clip);
    const action = this.mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    // Hold the last frame rather than snapping home; the fade back to the idle
    // is what actually ends the cast.
    action.clampWhenFinished = true;
    this.casts.set(name, action);

    disposeObject(file);
  }

  listClips() {
    if (this.usingAvatar) {
      const clips = this.avatar.listClips();
      if (this.idle) clips.unshift({ name: 'idle', duration: this.idle.getClip()?.duration ?? 0 });
      return clips;
    }
    const clips = [];
    if (this.idle) {
      clips.push({ name: 'idle', duration: this.idle.getClip()?.duration ?? 0 });
    }
    for (const [name, action] of this.casts) {
      clips.push({ name, duration: action.getClip()?.duration ?? 0 });
    }
    return clips;
  }

  playLibraryClip(name) {
    if (this.usingAvatar) {
      const loop = name === 'idle' || /stand|lobby|move/i.test(name);
      return this.avatar.playClip(name, loop);
    }
    if (name === 'idle') {
      if (this._cast && this.idle) {
        this.idle.reset().play();
        this.idle.crossFadeFrom(this._cast, settings.character.castBlendIn ?? 0.2, false);
        this._cast = null;
      }
      return true;
    }
    this.playCast(name);
    return this.casts.has(name) || this.casts.size > 0;
  }

  /**
   * Dress the rig: authored materials where the palette has them, converted
   * FBX materials everywhere else.
   *
   * Each of the rig's materials is offered to `library` by name first, and the
   * match — a full glTF PBR material, with its metallic/roughness, normal and
   * emissive maps — is used as-is. Only what the palette cannot answer for goes
   * through `_toStandard`, which turns the FBX's Phong into something the HDR
   * probe and the sun's shadows can light.
   *
   * Either way the result is patched with the fresnel aura before it is applied,
   * so a body dressed from the palette still carries the self-buff charge.
   *
   * The FBX's own textures — and the diffuse skin loaded beside it — are dropped
   * once nothing is left using them: a matched palette makes them redundant, and
   * they are megabytes of decoded image.
   *
   * @param {import('three').Object3D} root
   * @param {import('three').Texture} skin the fallback colour map
   * @param {MaterialLibrary|null} library authored materials, matched by name
   */
  _prepareMaterials(root, skin, library) {
    const converted = new Map();
    /** Textures the FBX arrived with, and the subset still referenced after. */
    const imported = new Set();
    const live = new Set();
    /** Materials this class built, i.e. the ones the palette had nothing for. */
    const fallbacks = [];
    const unmatched = new Set();

    // TextureLoader assumes linear data; this one is authored colour.
    skin.colorSpace = SRGBColorSpace;
    imported.add(skin);

    root.traverse((node) => {
      if (!node.isMesh && !node.isSkinnedMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
      node.layers.set(LAYER.WORLD);
      node.layers.enable(LAYER.CONTACT); // captured by the contact shadow pass

      const source = Array.isArray(node.material) ? node.material : [node.material];
      const result = source.map((material) => {
        if (!material) return material;
        collectTextures(material, imported);
        if (converted.has(material)) return converted.get(material);

        const authored = library?.resolve(material.name, node.name) ?? null;
        if (!authored && library) unmatched.add(material.name || '(unnamed)');

        let applied = authored;
        if (!applied) {
          applied = this._toStandard(material, skin);
          fallbacks.push(applied);
        }

        // Patched once, here, rather than swapped when the buff fires: the
        // charge lives in this material's own shader behind a strength uniform,
        // so Electric Boost costs no recompile and nothing to put back. Two rig
        // materials can resolve to one palette material, and patching that twice
        // would stack the block — `converted` cannot catch it, since it is keyed
        // by the material on the way in rather than the one on the way out.
        if (!this._patched.has(applied)) {
          this._patched.add(applied);
          applyFresnelAura(applied, this.environment);
        }

        material.dispose(); // its textures are released below, not here
        converted.set(material, applied);
        return applied;
      });

      node.material = Array.isArray(node.material) ? result : result[0];
    });

    // A converted material shares the FBX's textures; an authored one does not,
    // so anything the palette displaced — the skin included — is unreferenced.
    for (const material of fallbacks) collectTextures(material, live);
    for (const texture of imported) if (!live.has(texture)) texture.dispose();

    if (unmatched.size) {
      console.warn(
        `[CharacterController] no palette material for ${[...unmatched].join(', ')} — ` +
          `the library offers ${library.names.join(', ')}. ` +
          'Rename to match, or add an entry to MATERIAL_ALIASES.'
      );
    }
  }

  /**
   * Convert one imported FBX material to PBR.
   *
   * FBX gives us Phong/Lambert; Standard is what picks up the HDR probe and the
   * sun's shadows. This export ships no texture of its own, so the skin loaded
   * alongside it is the colour map — but a file that *does* carry one embedded
   * still wins, since that map is authored against its own UVs. Exporters
   * disagree on which slot the normal map lands in, so both are passed through
   * and the empty one costs nothing.
   *
   * The tint is dropped with the map: an untextured FBX defaults to a flat grey
   * that would otherwise darken every texel of the skin.
   *
   * @param {import('three').Material} material
   * @param {import('three').Texture} skin
   */
  _toStandard(material, skin) {
    const standard = new MeshStandardMaterial({
      name: material.name,
      color: material.map ? (material.color ?? 0xffffff) : 0xffffff,
      map: material.map ?? skin,
      normalMap: material.normalMap ?? null,
      bumpMap: material.normalMap ? null : (material.bumpMap ?? null),
      roughness: 0.85,
      metalness: 0,
      transparent: material.transparent ?? false,
      opacity: material.opacity ?? 1,
      side: material.side
    });

    // Worth the samples: the character is the one thing on screen the camera
    // gets close to, and its texels sit at a grazing angle across the torso.
    for (const map of [standard.map, standard.normalMap, standard.bumpMap]) {
      if (map) map.anisotropy = 4;
    }

    return standard;
  }

  /**
   * Derive the rig's own forward from the bind pose.
   *
   * The heel → toe vector is the most reliable indicator of facing on a bind
   * pose that may not be axis aligned, and everything that turns the body reads
   * the yaw it produces.
   */
  _measureFacing(root) {
    root.updateMatrixWorld(true);

    let foot = null;
    let toe = null;
    root.traverse((node) => {
      if (!node.isBone) return;
      const short = shortBoneName(node.name);
      if (short === 'LeftFoot' && !foot) foot = node;
      else if (short === 'LeftToeBase' && !toe) toe = node;
    });

    if (foot && toe) {
      const heel = foot.getWorldPosition(new Vector3());
      const tip = toe.getWorldPosition(new Vector3()).sub(heel).setY(0);
      if (tip.lengthSq() > 1e-6) this.forwardAxis.copy(tip).normalize();
    }

    this._forwardYaw = Math.atan2(this.forwardAxis.x, this.forwardAxis.z);
    this._rightAxis.set(0, 1, 0).cross(this.forwardAxis).normalize();
  }

  /* ------------------------------------------------------------------ */
  /* cast clips                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Throw one cast clip over the idle, once.
   *
   * @param {string} [name] an id from `CAST_ANIMATIONS`; falls back to the first
   *   one so an ability configured with a clip that failed to load still moves.
   */
  playCast(name) {
    if (name === 'idle') {
      this.releaseHold();
      if (this.usingAvatar) {
        this.avatar.playCast('idle');
        this._cast = this.avatar._cast;
        this.idle = this.avatar.idle;
        return;
      }
      if (this._cast && this.idle) {
        this.idle.enabled = true;
        this.idle.setEffectiveTimeScale(1);
        this.idle.reset().play();
        this.idle.crossFadeFrom(this._cast, 0.18, false);
        this._cast = null;
      }
      return;
    }
    if (!this._holding) this._holdAt = 0;
    if (this.usingAvatar) {
      const ok = this.avatar.playCast(name);
      this._cast = this.avatar._cast;
      this.idle = this.avatar.idle;
      return;
    }
    const next = this.casts.get(name) ?? this.casts.get(CAST_ANIMATIONS[0]);
    if (!next || !this.idle) return;

    const previous = this._cast;
    this._cast = next;

    next.reset();
    next.paused = false;
    next.setEffectiveTimeScale(1);
    next.play();

    // Fade from whatever is actually on screen — the idle on a first cast, the
    // clip still finishing on a re-cast — so the body never drops to the bind
    // pose for a frame in between two throws. Re-throwing the *same* clip only
    // restarts it: `reset()` has already left it at full weight.
    const from = previous ?? this.idle;
    if (from !== next) next.crossFadeFrom(from, settings.character.castBlendIn, false);
  }

  holdCast(name, holdAt = 0.42) {
    this._holding = true;
    this._holdAt = holdAt;
    this.playCast(name);
    const action = this.usingAvatar ? this.avatar?._cast : this._cast;
    if (action) {
      action.paused = false;
      action.setEffectiveTimeScale(0.48);
    }
  }

  releaseHold() {
    this._holding = false;
    const action = this.usingAvatar ? this.avatar?._cast : this._cast;
    if (action) {
      action.paused = false;
      action.setEffectiveTimeScale(1);
    }
  }

  _freezeHold() {
    if (!this._holding) return;
    const action = this.usingAvatar ? this.avatar?._cast : this._cast;
    if (!action) return;
    const clip = action.getClip?.() || action._clip;
    const dur = clip?.duration || 1;
    if (action.time / dur >= this._holdAt) {
      action.time = dur * this._holdAt;
      action.paused = true;
    }
  }

  /** True while a cast clip is playing. */
  get isCasting() {
    if (this.usingAvatar) return this.avatar._cast !== null;
    return this._cast !== null;
  }

  _onCastFinished = (event) => {
    if (this.usingAvatar) {
      this._cast = this.avatar._cast;
      this.idle = this.avatar.idle;
      return;
    }
    // Anything else finishing is an older clip that a re-cast already faded out.
    if (event.action !== this._cast) return;
    this._cast = null;

    // The fade in disabled the idle once its weight hit zero; wake it back up
    // before asking it to come in again.
    this.idle.enabled = true;
    this.idle.setEffectiveTimeScale(1);
    this.idle.crossFadeFrom(event.action, settings.character.castBlendOut, false);
  };

  /* ------------------------------------------------------------------ */
  /* placement — driven by walk mode, inert otherwise                    */
  /* ------------------------------------------------------------------ */

  /** Heading, radians about world +Y. 0 faces +Z, whichever way the rig binds. */
  setFacing(yaw) {
    this.root.rotation.y = yaw - this._forwardYaw;
  }

  get facing() {
    return this.root.rotation.y + this._forwardYaw;
  }

  /**
   * Turn toward `yaw` over time rather than snapping.
   * @param {number} rate fraction of the angle gap left after one second
   */
  turnToward(yaw, rate, dt) {
    const current = this.facing;
    // Shortest way round, so aiming across the -Z seam does not spin the body.
    const delta = MathUtils.euclideanModulo(yaw - current + Math.PI, Math.PI * 2) - Math.PI;
    this.setFacing(current + delta * (1 - Math.pow(MathUtils.clamp(rate, 1e-6, 1), dt)));
  }

  /**
   * Punch the body, then let it settle. Sign: +1 into the facing (melee),
   * −1 off the line (ranged kite).
   */
  castLunge(sign = 1) {
    this._lunge = 1;
    this._lungeSign = sign >= 0 ? 1 : -1;
  }

  /**
   * Root-motion combo step. `dir` is world XZ. Melee passes the dummy heading;
   * ranged passes the opposite so the body hops off the target.
   */
  castStep({ x = 0, z = 1, meters = 1.4, duration = 0.36, lift = 0.08, dummy = null, sign = 1 } = {}) {
    const len = Math.hypot(x, z) || 1;
    this._step = {
      dirX: x / len,
      dirZ: z / len,
      meters: meters || 0,
      duration: Math.max(0.12, duration || 0.36),
      elapsed: 0,
      lift: Math.max(0, lift || 0),
      startX: this.root.position.x,
      startZ: this.root.position.z,
      dummy
    };
    this.castLunge(sign);
  }

  _applyLunge(dt) {
    const c = settings.character;
    if (this._lunge > 0) {
      this._lunge = Math.max(0, this._lunge - c.castSettle * dt);
    }
    const envelope = this._lunge * this._lunge * (1 + 0.35 * Math.sin(this._lunge * Math.PI));
    this.tilt.quaternion.setFromAxisAngle(this._rightAxis, envelope * c.castLean * this._lungeSign);
    this.tilt.position.copy(this.forwardAxis).multiplyScalar(envelope * (c.castRecoil || 0.12) * this._lungeSign);
  }

  _applyStep(dt) {
    if (!this._step) {
      if (this._hover > 0) this.root.position.y = this._hover;
      else if (this.root.position.y !== 0 && this._lunge <= 0) this.root.position.y = 0;
      return;
    }
    const s = this._step;
    s.elapsed += dt;
    const u = Math.min(1, s.elapsed / s.duration);
    const ease = 1 - (1 - u) * (1 - u) * (1 - u);
    let x = s.startX + s.dirX * s.meters * ease;
    let z = s.startZ + s.dirZ * s.meters * ease;
    const GROVE = 22;
    const r = Math.hypot(x, z);
    if (r > GROVE) {
      x *= GROVE / r;
      z *= GROVE / r;
    }
    if (s.dummy) {
      const dx = x - s.dummy.x;
      const dz = z - s.dummy.z;
      const d = Math.hypot(dx, dz);
      const min = (s.dummy.radius ?? 0.9) + 0.85;
      if (d < min && d > 1e-4) {
        x = s.dummy.x + (dx / d) * min;
        z = s.dummy.z + (dz / d) * min;
      }
    }
    this.root.position.x = x;
    this.root.position.z = z;
    this.root.position.y = this._hover > 0 ? this._hover : Math.sin(u * Math.PI) * s.lift;
    if (u >= 1) {
      this.root.position.y = this._hover > 0 ? this._hover : 0;
      this._step = null;
    }
  }

  setHover(height = 0) {
    this._hover = Math.max(0, height || 0);
    if (this._hover === 0 && !this._step) this.root.position.y = 0;
    else if (this._hover > 0) this.root.position.y = this._hover;
  }

  setGhost(on) {
    this._ghost = Boolean(on);
    const roots = [];
    if (this.usingAvatar && this.avatar?.group) roots.push(this.avatar.group);
    else if (this.model) roots.push(this.model);
    for (const root of roots) {
      root.visible = !this._ghost;
      root.traverse((node) => {
        if (node.isMesh || node.isSkinnedMesh) node.visible = !this._ghost;
      });
    }
  }

  /** Put the character back on the floor, upright and facing where it was. */
  resetPlacement() {
    this.root.position.y = 0;
    this._lunge = 0;
    this._hover = 0;
    this._step = null;
    this.setGhost(false);
    this.tilt.quaternion.identity();
    this.tilt.position.set(0, 0, 0);
  }

  /**
   * Resolve `BONE_SEGMENTS` against this rig, once.
   *
   * Bones are looked up by their short name and kept *by reference*, so what is
   * stored here is the live joint — no name is looked up again, and nothing is
   * copied per frame but the two positions each segment is between.
   */
  _measureSkeleton(root) {
    const bones = new Map();
    root.traverse((node) => {
      if (!node.isBone) return;
      const short = shortBoneName(node.name);
      if (!bones.has(short)) bones.set(short, node);
    });

    this.boneSegments = [];
    this._bones = bones;
    const missing = [];

    for (const entry of BONE_SEGMENTS) {
      const bone = bones.get(entry.bone);
      // The parent has to be a bone as well: the topmost joint's parent is the
      // rig's own transform node, and a segment reaching down to that would run
      // from the character's feet to its hips through nothing.
      if (!bone || !bone.parent?.isBone) {
        missing.push(entry.bone);
        continue;
      }
      const radius = entry.radius * this.height;
      // Weighted by repetition — see BONE_SEGMENTS.
      for (let i = 0; i < entry.weight; i++) {
        this.boneSegments.push({ bone, parent: bone.parent, radius });
      }
    }

    if (missing.length === BONE_SEGMENTS.length) {
      console.warn(
        '[CharacterController] no Mixamo bone names on this rig — body effects have no skeleton to hang on'
      );
    }
  }

  setMoveInput(x = 0, z = 0) {
    this._moveX = x;
    this._moveZ = z;
  }

  get speed() {
    return this._speed;
  }

  get locomo() {
    return this._locomo;
  }

  /** Scene node that actually parents Bip001 / Mixamo bones (not a SkinnedMesh). */
  skeletonRoot() {
    if (this.usingAvatar && this.avatar?.root) return this.avatar.root;
    return this.model || this.root;
  }

  skeletonInfo() {
    const root = this.skeletonRoot();
    let bones = 0;
    let skinned = 0;
    let richest = 0;
    root?.traverse((node) => {
      if (node.isBone) bones += 1;
      if (node.isSkinnedMesh && node.skeleton) {
        skinned += 1;
        richest = Math.max(richest, node.skeleton.bones?.length || 0);
      }
    });
    const walk = this.usingAvatar
      ? Boolean(this.avatar?.casts?.get('walk'))
      : Boolean(this.casts?.has('walk'));
    return {
      bones,
      skinned,
      richest,
      usingAvatar: this.usingAvatar,
      raceId: this.avatar?.raceId ?? null,
      locomo: this._locomo,
      walk,
      idle: this.idle?.getClip?.()?.name ?? null
    };
  }

  getBoneWorld(name, target) {
    const out = target || new Vector3();
    const bone = this._bones?.get(name) || this._bones?.get('RightHand') || this._bones?.get('LeftHand');
    if (bone) {
      bone.updateWorldMatrix(true, false);
      bone.getWorldPosition(out);
      return out;
    }
    out.copy(this.root.position);
    out.y += this.height * 0.72;
    return out;
  }

  /**
   * Write the live skeleton into a pair of world-space endpoint arrays.
   *
   * Packed for a shader rather than for reading: `a[i]` is the segment's start
   * joint with its radius in `w`, `b[i]` is its end joint. Both arrays are
   * written in place and neither is allocated here, so this can run every frame
   * for nothing.
   *
   * The world matrices are the ones `update()` refreshed after the mixer ran,
   * which is what makes a flame rooted on a forearm swing with the arm through a
   * cast instead of trailing a frame behind it.
   *
   * @param {import('three').Vector4[]} a start joints; `w` is the limb radius
   * @param {import('three').Vector4[]} b end joints
   * @returns {number} how many segments were written
   */
  writeBoneSegments(a, b) {
    const count = Math.min(this.boneSegments.length, a.length, b.length);
    for (let i = 0; i < count; i++) {
      const segment = this.boneSegments[i];
      _joint.setFromMatrixPosition(segment.parent.matrixWorld);
      a[i].set(_joint.x, _joint.y, _joint.z, segment.radius);
      _joint.setFromMatrixPosition(segment.bone.matrixWorld);
      b[i].set(_joint.x, _joint.y, _joint.z, 0);
    }
    return count;
  }

  _applyLocomotion(dt, camera) {
    const ix = this._moveX || 0;
    const iz = this._moveZ || 0;
    const mag = Math.hypot(ix, iz);
    const busy = this._holding || this._cast || this._step || this._ghost;
    const moving = mag > 0.15 && !busy && dt > 0;
    if (!moving) {
      this._speed = this._speed > 0.05 ? this._speed * Math.max(0, 1 - 10 * dt) : 0;
      if (this._locomo !== 'idle' && !this._cast) {
        this._locomo = 'idle';
        this.avatar?.setLocomo?.('idle');
        if (!this.usingAvatar && this.idle) this.idle.setEffectiveTimeScale(1);
      }
      return;
    }

    _joint.set(0, 0, 1);
    if (camera) {
      camera.getWorldDirection(_joint);
    }
    _joint.y = 0;
    if (_joint.lengthSq() < 1e-6) _joint.set(0, 0, 1);
    _joint.normalize();
    const fx = _joint.x;
    const fz = _joint.z;
    const rx = -fz;
    const rz = fx;
    const wishX = fx * iz + rx * ix;
    const wishZ = fz * iz + rz * ix;
    const len = Math.hypot(wishX, wishZ) || 1;
    const nx = wishX / len;
    const nz = wishZ / len;
    const speed = this._walkSpeed;
    this._speed = speed;
    let x = this.root.position.x + nx * speed * dt;
    let z = this.root.position.z + nz * speed * dt;
    const GROVE = 22;
    const r = Math.hypot(x, z);
    if (r > GROVE) {
      x *= GROVE / r;
      z *= GROVE / r;
    }
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    const blocked = this.mover?.(dx, dz);
    if (blocked) {
      this.root.position.x = blocked.x;
      this.root.position.z = blocked.z;
    } else {
      this.root.position.x = x;
      this.root.position.z = z;
    }
    this.turnToward(Math.atan2(nx, nz), 0.0008, dt);
    if (this._locomo !== 'walk') {
      this._locomo = 'walk';
      this.avatar?.setLocomo?.('walk', speed);
    } else {
      this.avatar?.setLocomo?.('walk', speed);
    }
    if (!this.usingAvatar && this.idle) this.idle.setEffectiveTimeScale(1.25);
  }

  update(dt, camera) {
    // Driven by the *simulation* delta, and re-applied every frame even at
    // dt = 0: pausing mid-cast holds the lunge, and `castLean` stays a live
    // slider against that frozen pose.
    this._applyLocomotion(dt, camera);
    this._applyStep(dt);
    this._applyLunge(dt);

    if (this.usingAvatar) {
      this.avatar.mixer.timeScale = settings.global.animationSpeed;
      this.avatar.update(dt);
      this._freezeHold();
      this.root.updateMatrixWorld(true);
      return;
    }

    if (!this.mixer) return;

    this.mixer.timeScale = settings.global.animationSpeed;
    this.mixer.update(dt);
    this._freezeHold();

    this.root.updateMatrixWorld(true);
  }

  get position() {
    return this.root.position;
  }

  dispose() {
    this.mixer?.removeEventListener('finished', this._onCastFinished);
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.idle = null;
    this.casts.clear();
    this._cast = null;
    this.avatar?.dispose();
    this.avatar = null;
    this.materialLibrary = null;
    this._patched.clear();
    disposeObject(this.root);
  }
}

/* -------------------------------------------------------------------- */

/** Add every texture a material references to `out`. */
function collectTextures(material, out) {
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) out.add(value);
  }
}
