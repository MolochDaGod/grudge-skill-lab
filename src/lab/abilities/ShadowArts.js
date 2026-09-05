// @ts-nocheck
/**
 * Samurai third-person arts, shared kit:
 *   shadowClone — two black bodies step out and hunt
 *   skyFist     — seal + portal over the mark, fist falls through
 *   skyBlades   — rise 3 m, forge swords, loose them
 *   shadowStep  — hide, fire-body blink, portal above/behind, dive
 */
import {
  Mesh,
  Group,
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  RingGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  AdditiveBlending,
  DoubleSide,
  Color,
  Vector3,
  Quaternion
} from 'three';
import { Ability } from './Ability.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { DecalType } from '../effects/GroundDecals.js';
import { LAYER } from '../core/Layers.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate } from '../utils/math.js';
import { auraTint } from '../rpg/auras.js';
import {
  visibleRoot,
  setGhost,
  cloneShadow,
  disposeShadow,
  huntMarks
} from '../effects/ShadowKit.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _side = new Vector3();
const _up = new Vector3(0, 1, 0);
const _look = new Vector3();
const _quat = new Quaternion();
const _emit = {};
const _from = new Vector3();
const _to = new Vector3();

function tintHex() {
  return auraTint('fire').core;
}

function punch(ctx, amount, at) {
  ctx.world?.hurtDummy?.(amount || 24);
  ctx.shake?.add?.(0.22, 1.4, 16);
  ctx.flash?.trigger?.(getColor(auraTint('fire').core), 0.12);
  if (at) {
    ctx.bursts?.spawn?.(BurstMode.FIRE, at, {
      radius: 0.2,
      endRadius: 1.4,
      life: 0.4,
      intensity: 1,
      colorA: getColor(auraTint('fire').core),
      colorB: getColor(auraTint('fire').edge)
    });
  }
}

function portalMat(colorA, colorB) {
  return new ShaderMaterial({
    uniforms: {
      uA: { value: new Color(colorA) },
      uB: { value: new Color(colorB) },
      uOpen: { value: 0 },
      uTime: { value: 0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform float uOpen; uniform float uTime;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv*2.0-1.0;
        float r = length(p);
        float ring = smoothstep(0.08, 0.0, abs(r-0.72));
        float hole = 1.0 - smoothstep(0.18, 0.7, r);
        float spin = 0.5 + 0.5*sin(atan(p.y,p.x)*6.0 + uTime*8.0);
        vec3 col = mix(uB, uA, ring + hole*spin);
        float a = (hole*0.85 + ring)*uOpen;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide
  });
}

class ShadowArt extends Ability {
  constructor(element, context) {
    super(element, context);
    this._owned = [];
  }

  get impactDuration() {
    return this.config.impactTime ?? 0.4;
  }

  get fadeDuration() {
    return this.config.fadeTime ?? 0.55;
  }

  _clearOwned() {
    for (const entry of this._owned) disposeShadow(entry);
    this._owned.length = 0;
    for (const mesh of this._meshes || []) mesh.visible = false;
  }

  onDestroy() {
    this._clearOwned();
    setGhost(this.ctx.character, false);
    this.ctx.character?.setHover?.(0);
  }
}

export class ShadowCloneAbility extends ShadowArt {
  constructor(context) {
    super('shadowClone', context);
    this._trail = new RateEmitter(90);
  }

  createParticles() {
    this.trail = this.ctx.particles.get('shadow-clone-trail', {
      shape: ParticleShape.STREAK,
      colorA: getColor(this.config.colorCore),
      colorB: getColor(this.config.colorEdge),
      size: 0.07,
      drag: 1.4
    });
  }

  onSpawn() {
    this._clearOwned();
    this._trail._accumulator = 0;
    const cfg = this.config;
    const character = this.ctx.character;
    const source = visibleRoot(character);
    const count = Math.max(1, Math.min(4, cfg.cloneCount || 2));
    const marks = huntMarks(this.ctx.world, this.origin, count);
    const hex = cfg.variant === 'cinder' ? tintHex() : '#07070c';
    this._clones = [];
    for (let i = 0; i < count; i++) {
      const shadow = source ? cloneShadow(source, hex) : null;
      if (!shadow) continue;
      this.group.add(shadow.root);
      this._owned.push(shadow);
      const side = i % 2 === 0 ? 1 : -1;
      const row = Math.floor(i / 2);
      this._clones.push({
        shadow,
        mark: marks[i % marks.length],
        rest: this.origin.clone().addScaledVector(this.side, side * (1.35 + row * 0.55)),
        delay: i * 0.08
      });
    }
    this._struck = new Set();
  }

  onTravel(dt) {
    const t = this.u;
    const cfg = this.config;
    for (const clone of this._clones || []) {
      const local = saturate((t - clone.delay) / 0.85);
      const slide = saturate(local / 0.28);
      const hunt = saturate((local - 0.34) / 0.5);
      _pos.copy(this.origin);
      _pos.y = 0;
      _pos.lerp(clone.rest, slide);
      if (hunt > 0 && clone.mark) _pos.lerpVectors(_pos, clone.mark, hunt);
      _pos.y = Math.sin(Math.min(1, local) * Math.PI) * 0.08;
      clone.shadow.root.position.copy(_pos);
      if (clone.mark) {
        _look.copy(clone.mark).sub(_pos);
        _look.y = 0;
        if (_look.lengthSq() > 0.01) clone.shadow.root.lookAt(clone.mark);
      }
      if (cfg.variant === 'echo') {
        const n = this._trail.tick(dt, 90);
        if (n > 0 && this.trail) {
          _dir.copy(this.direction).multiplyScalar(-1);
          _emit.position = _pos.clone().setY(_pos.y + 0.9);
          _emit.direction = _dir;
          _emit.speed = 2.2;
          _emit.spread = 0.3;
          _emit.size = 0.07;
          _emit.life = 0.4;
          _emit.time = this.age;
          this.trail.emit(n, _emit);
        }
      }
      if (hunt > 0.92 && !this._struck.has(clone)) {
        this._struck.add(clone);
        punch(this.ctx, cfg.damage || 18, _pos);
      }
    }
  }

  onImpact() {
    punch(this.ctx, (this.config.damage || 18) * 0.35);
  }

  onFade(_dt, t) {
    const fade = saturate((t - 1) / 1);
    for (const clone of this._clones || []) {
      clone.shadow.material.opacity = 0.9 * (1 - fade);
    }
  }
}

export class SkyFistAbility extends ShadowArt {
  constructor(context) {
    super('skyFist', context);
    this._fists = [];
  }

  createShaders() {
    const geo = new BoxGeometry(0.42, 1.7, 0.42);
    geo.translate(0, -0.65, 0);
    this._fistGeo = geo;
    this._fistMat = new MeshBasicMaterial({ color: '#1a120e', transparent: true, opacity: 0.96 });
    this._sealMat = new MeshBasicMaterial({
      color: '#e8c070',
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this._seal = new Mesh(new RingGeometry(0.55, 1.15, 48), this._sealMat);
    this._seal.rotation.x = -Math.PI / 2;
    this._seal.visible = false;
    this._seal.layers.set(LAYER.VFX);
    this.group.add(this._seal);
    this._portalMat = portalMat('#fff4c0', '#ff6a18');
    this._portal = new Mesh(new PlaneGeometry(2.4, 2.4), this._portalMat);
    this._portal.visible = false;
    this._portal.layers.set(LAYER.VFX);
    this.group.add(this._portal);
    this._meshes = [this._seal, this._portal];
  }

  onSpawn() {
    this._clearFists();
    const n = Math.max(1, Math.min(4, this.config.fistCount || 1));
    const target = this.origin.clone().addScaledVector(this.direction, this.length);
    target.y = 0;
    this._target = target;
    this._seal.visible = true;
    this._seal.position.set(target.x, 3.15, target.z);
    this._portal.visible = true;
    this._portal.position.set(target.x, 3.25, target.z);
    this._portal.rotation.set(-Math.PI / 2, 0, 0);
    this._fists = [];
    for (let i = 0; i < n; i++) {
      const fist = new Mesh(this._fistGeo, this._fistMat.clone());
      fist.layers.set(LAYER.VFX);
      this.group.add(fist);
      const ox = (i - (n - 1) / 2) * 0.85;
      this._fists.push({ mesh: fist, delay: i * 0.12, ox, landed: false });
    }
  }

  onTravel() {
    const cfg = this.config;
    const t = this.u;
    this._sealMat.opacity = saturate(t * 3.2) * 0.85;
    this._seal.rotation.z = -t * Math.PI * 2;
    this._portalMat.uniforms.uOpen.value = saturate((t - 0.12) * 3);
    this._portalMat.uniforms.uTime.value = this.age;
    const dropStart = 0.28;
    for (const fist of this._fists) {
      const local = saturate((t - dropStart - fist.delay) / 0.55);
      const fall = local * local;
      const y = 8.2 * (1 - fall) + 0.15;
      fist.mesh.position.set(this._target.x + fist.ox, y, this._target.z);
      fist.mesh.rotation.x = 0.12;
      fist.mesh.visible = t > dropStart + fist.delay * 0.4;
      if (fall > 0.96 && !fist.landed) {
        fist.landed = true;
        punch(this.ctx, cfg.damage || 42, _pos.set(this._target.x + fist.ox, 0.2, this._target.z));
        this.ctx.decals?.spawn?.(DecalType.SCORCH, _pos, {
          radius: cfg.scorchRadius || 1.4,
          life: 2.4,
          intensity: 0.9
        });
      }
    }
  }

  onFade(_dt, t) {
    const fade = saturate((t - 1) / 1);
    this._sealMat.opacity *= 1 - fade;
    this._portalMat.uniforms.uOpen.value *= 1 - fade;
    for (const fist of this._fists) {
      fist.mesh.position.y = 0.15 + fade * 6.5;
      fist.mesh.material.opacity = 0.96 * (1 - fade);
    }
  }

  _clearFists() {
    for (const fist of this._fists || []) {
      fist.mesh.removeFromParent();
      fist.mesh.material.dispose();
    }
    this._fists = [];
  }

  onDestroy() {
    this._clearFists();
    super.onDestroy();
  }
}

export class SkyBladesAbility extends ShadowArt {
  constructor(context) {
    super('skyBlades', context);
    this._blades = [];
  }

  createShaders() {
    this._bladeGeo = new BoxGeometry(0.08, 1.15, 0.16);
    this._bladeGeo.translate(0, 0.4, 0);
    this._bladeMat = new MeshBasicMaterial({ color: '#c8ccd4', transparent: true, opacity: 0.95 });
  }

  onSpawn() {
    this._clearBlades();
    const cfg = this.config;
    const n = Math.max(3, Math.min(12, cfg.bladeCount || 6));
    const character = this.ctx.character;
    character?.setHover?.(cfg.lift || 3);
    character?.playCast?.(cfg.castAnim || 'cast2');
    this._home = this.origin.clone();
    this._home.y = cfg.lift || 3;
    const marks = huntMarks(this.ctx.world, this.origin, n);
    const hex = cfg.variant === 'shadow' ? '#0a0a10' : cfg.variant === 'cinder' ? tintHex() : '#d8dce4';
    this._blades = [];
    for (let i = 0; i < n; i++) {
      const mat = this._bladeMat.clone();
      mat.color.set(hex);
      const mesh = new Mesh(this._bladeGeo, mat);
      mesh.layers.set(LAYER.VFX);
      this.group.add(mesh);
      const angle = (i / n) * Math.PI * 2;
      this._blades.push({
        mesh,
        angle,
        mark: marks[i % marks.length],
        loosed: false
      });
    }
  }

  onTravel() {
    const cfg = this.config;
    const t = this.u;
    const lift = cfg.lift || 3;
    this.ctx.character?.setHover?.(lift * saturate(t * 4) * (t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18));
    const forge = saturate(t / 0.28);
    const loose = saturate((t - 0.38) / 0.5);
    for (const blade of this._blades) {
      const orbit = blade.angle + this.age * 2.4;
      _from.set(this._home.x + Math.cos(orbit) * 1.35, lift + 0.4, this._home.z + Math.sin(orbit) * 1.35);
      _to.copy(blade.mark);
      _to.y = 1.05;
      _pos.lerpVectors(_from, _to, loose * loose);
      blade.mesh.position.copy(_pos);
      blade.mesh.lookAt(_to);
      blade.mesh.scale.setScalar(0.4 + forge * 0.6);
      blade.mesh.visible = forge > 0.05;
      if (loose > 0.92 && !blade.loosed) {
        blade.loosed = true;
        punch(this.ctx, (cfg.damage || 14) / this._blades.length + 8, _to);
      }
    }
  }

  onFade(_dt, t) {
    const fade = saturate((t - 1) / 1);
    this.ctx.character?.setHover?.(0);
    for (const blade of this._blades) blade.mesh.material.opacity = 0.95 * (1 - fade);
  }

  _clearBlades() {
    for (const blade of this._blades || []) {
      blade.mesh.removeFromParent();
      blade.mesh.material.dispose();
    }
    this._blades = [];
    this.ctx.character?.setHover?.(0);
  }

  onDestroy() {
    this._clearBlades();
    super.onDestroy();
  }
}

export class ShadowStepAbility extends ShadowArt {
  constructor(context) {
    super('shadowStep', context);
    this._trail = new RateEmitter(160);
  }

  createShaders() {
    this._portalMat = portalMat('#fff1b0', '#ff4a08');
    this._portal = new Mesh(new PlaneGeometry(2.2, 2.2), this._portalMat);
    this._portal.visible = false;
    this._portal.layers.set(LAYER.VFX);
    this.group.add(this._portal);
    this._fistMat = new MeshBasicMaterial({ color: '#140c08', transparent: true, opacity: 0 });
    this._fist = new Mesh(new CylinderGeometry(0.18, 0.32, 1.4, 8), this._fistMat);
    this._fist.visible = false;
    this._fist.layers.set(LAYER.VFX);
    this.group.add(this._fist);
    this._meshes = [this._portal, this._fist];
  }

  createParticles() {
    this.trail = this.ctx.particles.get('shadow-step-trail', {
      shape: ParticleShape.STREAK,
      colorA: getColor(this.config.colorCore),
      colorB: getColor(this.config.colorEdge),
      size: 0.08,
      drag: 0.9
    });
  }

  onSpawn() {
    const character = this.ctx.character;
    this._start = character?.position.clone() || this.origin.clone();
    this._end = this.origin.clone().addScaledVector(this.direction, this.length);
    this._end.y = 0;
    this._behind = this._end.clone().addScaledVector(this.direction, -1.15);
    this._behind.y = 3.2;
    setGhost(character, true);
    character?.playCast?.(this.config.castAnim || 'combo3');
    this._portal.visible = false;
    this._landed = false;
  }

  onTravel(dt) {
    const t = this.u;
    const character = this.ctx.character;
    const hide = t < 0.62;
    setGhost(character, hide);
    const along = saturate(t / 0.55);
    _pos.lerpVectors(this._start, this._end, along);
    _pos.y = 0.2 + Math.sin(along * Math.PI) * 1.6;
    const n = this._trail.tick(dt, this.config.trailRate || 160);
    if (n > 0 && this.trail) {
      _dir.copy(this.direction);
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = 3.4;
      _emit.spread = 0.35;
      _emit.size = 0.08;
      _emit.life = 0.45;
      _emit.time = this.age;
      this.trail.emit(n, _emit);
    }
    const open = saturate((t - 0.38) * 4);
    this._portal.visible = open > 0.02;
    this._portal.position.copy(this._behind);
    this._portal.lookAt(this._end.x, 1.2, this._end.z);
    this._portalMat.uniforms.uOpen.value = open;
    this._portalMat.uniforms.uTime.value = this.age;
    const dive = saturate((t - 0.58) / 0.38);
    if (dive > 0) {
      this._fist.visible = true;
      this._fistMat.opacity = 0.9;
      const y = this._behind.y * (1 - dive * dive) + 0.4;
      this._fist.position.set(this._end.x, y, this._end.z);
      if (dive > 0.92 && !this._landed) {
        this._landed = true;
        setGhost(character, false);
        if (character?.root) character.root.position.set(this._end.x, 0, this._end.z);
        character?.playCast?.('combo1');
        punch(this.ctx, this.config.damage || 36, this._end);
      }
    }
  }

  onImpact() {
    setGhost(this.ctx.character, false);
  }

  onFade() {
    this._portalMat.uniforms.uOpen.value *= 0.85;
    this._fistMat.opacity *= 0.8;
  }

  onDestroy() {
    setGhost(this.ctx.character, false);
    super.onDestroy();
  }
}
