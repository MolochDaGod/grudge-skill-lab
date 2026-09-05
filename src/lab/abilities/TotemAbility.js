// @ts-nocheck
/**
 * Persistent class F totem. Lands at the aim point, then pulses on every act.
 */
import { Vector3, Box3 } from 'three';
import { Ability, AbilityPhase } from './Ability.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { DecalType } from '../effects/GroundDecals.js';
import { LAYER, setLayerRecursive } from '../core/Layers.js';
import { getColor } from '../utils/color.js';
import { settings } from '../config/settings.js';
import { saturate } from '../utils/math.js';
import { totemSpec, TOTEM_SPECS } from '../rpg/totems.js';

const _box = new Box3();
const _size = new Vector3();
const _pos = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);

function sit(object, x, z, targetHeight, yaw) {
  object.rotation.set(0, yaw, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  _box.getSize(_size);
  const height = Math.max(_size.y, 1e-4);
  object.scale.multiplyScalar(Math.min(6, Math.max(0.05, targetHeight / height)));
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  object.position.set(x, object.position.y - _box.min.y, z);
  object.updateMatrixWorld(true);
}

export class TotemAbility extends Ability {
  constructor(context, element = 'mageTotem') {
    super(element, context);
    this.spec = totemSpec(element) || totemSpec('mageTotem');
    this._mesh = null;
    this._closing = false;
    this._crown = new Vector3();
  }

  get isPersistent() {
    return true;
  }

  get impactDuration() {
    return Infinity;
  }

  get fadeDuration() {
    return 0.55;
  }

  get wantsCamera() {
    return this.phase === AbilityPhase.TRAVEL || this.phase === AbilityPhase.FADE;
  }

  createShaders() {}

  onSpawn() {
    this._closing = false;
    if (this._mesh) this._mesh.visible = false;
    this.ctx.flash.trigger(getColor(this.config.colorCore), 0.12);
    this.lightBoost = 1.1;
  }

  onTravel(dt) {
    this.pointAt(this.u, _pos);
    _pos.y = 0.05 + (1 - this.u) * 2.4;
    this.position.copy(_pos);
    this.ctx.wind?.emitMist(_pos, 1, {
      palette: this.spec.palette,
      time: this.age,
      size: 0.28
    });
  }

  onImpact() {
    this.pointAt(1, _pos);
    _pos.y = 0;
    this.position.copy(_pos);
    this._ensureMesh();
    if (this._mesh) {
      const yaw = Math.atan2(this.direction.x, this.direction.z);
      sit(this._mesh, _pos.x, _pos.z, this.spec.height, yaw);
      this._mesh.visible = true;
    }
    this._crown.set(_pos.x, this.spec.crown, _pos.z);
    this.ctx.world?.registerTotem?.({
      id: this.element,
      root: this._mesh,
      palette: this.spec.palette,
      crown: this.spec.crown,
      pos: this._crown.clone(),
      pulse: this.spec.pulse,
      ability: this
    });
    this.ctx.bursts.spawn(BurstMode.AIR, this._crown, {
      radius: 0.2,
      endRadius: 1.4,
      life: 0.55,
      intensity: 0.9,
      colorA: getColor(this.config.colorCore),
      colorB: getColor(this.config.colorEdge)
    });
    this.ctx.decals.spawn(DecalType.DUSTRING, _pos, {
      radius: 1.1,
      life: 3.2,
      intensity: 0.5,
      colorA: getColor(this.config.colorScorch)
    });
    this._fireSecondary();
    this.pulse('plant');
  }

  onFade(dt, t) {
    if (this._closing || t >= 1) {
      if (this._mesh) {
        const sink = saturate((t - 1) * 1.2);
        this._mesh.position.y = -sink * this.spec.height;
        this._mesh.visible = sink < 0.98;
      }
      return;
    }
    const dummy = this.ctx.world?.dummyPos;
    if (dummy) {
      this.ctx.wind?.flow(this._crown, dummy, dt, {
        palette: this.spec.palette,
        height: 0,
        targetHeight: 1.1,
        windRate: this.spec.pulse === 'air' ? 70 : 36,
        mistRate: this.spec.pulse === 'heal' ? 28 : 14,
        leafRate: this.spec.pulse === 'air' ? 6 : 2,
        glintRate: this.spec.pulse === 'heal' ? 10 : 0,
        time: this.age
      });
    }
  }

  dismiss() {
    if (!this.isActive || this._closing) return;
    this._closing = true;
    this.phase = AbilityPhase.FADE;
    this.fadeTime = 0;
  }

  pulse(reason = 'act') {
    const dummy = this.ctx.world?.dummyPos;
    if (!dummy) return;
    const pulse = this.spec.pulse;
    if (pulse === 'heal') {
      this.ctx.wind?.emitHeal(this._crown, 16, { palette: 'heal', time: this.age });
      this.ctx.world.healDummy?.(14);
    } else if (pulse === 'fire') {
      this.ctx.wind?.emitWind(this._crown, _dir.subVectors(dummy, this._crown).setY(0.2), 10, {
        palette: 'green',
        speed: 5.5,
        time: this.age
      });
      if (reason !== 'plant') this.ctx.world.hurtDummy?.(8);
    } else {
      this.ctx.wind?.flow(this._crown, dummy, 0.08, {
        palette: 'water',
        windRate: 220,
        mistRate: 80,
        leafRate: 12,
        time: this.age
      });
    }
  }

  _fireSecondary() {
    const id = this.spec.secondary;
    if (!id || !this.ctx.abilities || id === this.element) return;
    const caster = this.ctx.character?.position || this.origin;
    _dir.subVectors(this.position, caster).setY(0);
    const dist = Math.max(1.2, _dir.length());
    if (_dir.lengthSq() < 1e-6) _dir.copy(this.direction);
    _dir.normalize();
    this.ctx.abilities.cast(caster, _dir, dist, id);
  }

  _ensureMesh() {
    if (this._mesh) return;
    const proto = this.ctx.totemKit?.[this.element];
    if (!proto) return;
    const mesh = proto.clone(true);
    mesh.visible = false;
    setLayerRecursive(mesh, LAYER.WORLD);
    mesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.ctx.scene.add(mesh);
    this._mesh = mesh;
  }

  onDestroy() {
    this.ctx.world?.unregisterTotem?.(this.element, this);
    if (this._mesh) {
      this._mesh.visible = false;
      this._mesh.position.y = -8;
    }
    this._closing = false;
  }

  dispose() {
    this._mesh?.removeFromParent();
    this._mesh = null;
    super.dispose();
  }
}

export class MageTotemAbility extends TotemAbility {
  constructor(ctx) {
    super(ctx, 'mageTotem');
  }
}

export class PriestTotemAbility extends TotemAbility {
  constructor(ctx) {
    super(ctx, 'priestTotem');
  }
}

export class VirtuosoTotemAbility extends TotemAbility {
  constructor(ctx) {
    super(ctx, 'virtuosoTotem');
  }
}

/** Preload the three F totems so the first press never hitch-loads. */
export async function loadTotemKit(assets) {
  const kit = {};
  await Promise.all(
    Object.entries(TOTEM_SPECS).map(async ([id, spec]) => {
      const gltf = await assets.loadGLTF(spec.url).catch(() =>
        spec.fallback ? assets.loadGLTF(spec.fallback).catch(() => null) : null
      );
      if (gltf?.scene) kit[id] = gltf.scene;
    })
  );
  return kit;
}
