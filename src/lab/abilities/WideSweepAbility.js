// @ts-nocheck
import {
  Mesh,
  RingGeometry,
  ShaderMaterial,
  AdditiveBlending,
  DoubleSide,
  Color,
  Vector3
} from 'three';
import { Ability } from './Ability.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { DecalType } from '../effects/GroundDecals.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { LAYER } from '../core/Layers.js';
import { sharedUniforms } from '../core/FrameUniforms.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate } from '../utils/math.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { auraTint } from '../rpg/auras.js';

const _center = new Vector3();
const _pos = new Vector3();
const _dir = new Vector3();
const _look = new Vector3();
const _fwd = new Vector3(0, 0, 1);
const _up = new Vector3(0, 1, 0);
const _emit = {};

const SLASH_VERT = /* glsl */ `
  ${noiseGLSL}
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float n = snoise(vec3(uv.x * 5.0, uv.y * 3.0, 0.3));
    p += normal * n * 0.01;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SLASH_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uLife;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float along = vUv.x;
    float across = vUv.y;
    float n = fbm3(vec3(along * 7.0, across * 3.5, uTime * 5.0));
    float edge = pow(1.0 - abs(across * 2.0 - 1.0), 1.55);
    float tips = smoothstep(0.0, 0.1, along) * (1.0 - smoothstep(0.86, 1.0, along));
    vec3 col = mix(uColorB, uColorA, edge + n * 0.25);
    col += uColorA * pow(edge, 2.2) * 0.5;
    float alpha = edge * tips * uOpacity * (1.0 - uLife);
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

/**
 * T0 Wide Sweep — `t0_sword_wide_sweep`.
 * A slow front arc that stays around the caster. Not a flying projectile.
 */
export class WideSweepAbility extends Ability {
  constructor(context) {
    super('combo3', context);
    this._ember = new RateEmitter(70);
    this._lastScorch = 0;
    this._tint = null;
  }

  get impactDuration() {
    return this.config.impactTime ?? 0.28;
  }

  get fadeDuration() {
    return this.config.fadeTime ?? 0.45;
  }

  createShaders() {
    const arc = Math.PI * 0.88;
    const geo = new RingGeometry(0.55, 1, 52, 1, Math.PI * 0.1, arc);
    this.bladeMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 0.88, 0.4) },
        uColorB: { value: new Color(1, 0.22, 0.04) },
        uIntensity: { value: 2.3 },
        uOpacity: { value: 1 },
        uLife: { value: 0 }
      }),
      vertexShader: SLASH_VERT,
      fragmentShader: SLASH_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide
    });
    this.blade = new Mesh(geo, this.bladeMat);
    this.blade.name = 'WideSweep:blade';
    this.blade.layers.set(LAYER.VFX);
    this.blade.frustumCulled = false;
    this.blade.renderOrder = 22;
    this.group.add(this.blade);

    this.glowMat = this.bladeMat.clone();
    this.glow = new Mesh(geo, this.glowMat);
    this.glow.name = 'WideSweep:glow';
    this.glow.layers.set(LAYER.VFX);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 21;
    this.group.add(this.glow);
  }

  createParticles() {
    this.embers = this.ctx.particles.get('wide-sweep-embers', {
      capacity: 1000,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.sparks = this.ctx.particles.get('wide-sweep-sparks', {
      capacity: 400,
      shape: ParticleShape.SOFT,
      additive: true
    });
  }

  _paint(tint) {
    this._tint = tint;
    for (const mat of [this.bladeMat, this.glowMat]) {
      mat.uniforms.uColorA.value.copy(getColor(tint.core));
      mat.uniforms.uColorB.value.copy(getColor(tint.edge));
    }
    this.embers.setGradient(
      getColor(tint.trail[0]),
      getColor(tint.trail[1]),
      getColor(tint.trail[2]),
      getColor(tint.trail[3])
    );
    this.sparks.setGradient(
      getColor('#ffffff'),
      getColor(tint.core),
      getColor(tint.edge),
      getColor(tint.scorch)
    );
  }

  _pivot(out) {
    const character = this.ctx.character;
    if (character?.position) {
      out.copy(character.position);
      out.y = 0;
      return out;
    }
    return out.copy(this.origin);
  }

  onSpawn() {
    this._ember._accumulator = 0;
    this._lastScorch = 0;
    this.blade.visible = true;
    this.glow.visible = true;
    const c = this.config;
    const tint = settings.combat?.tintFromAura
      ? auraTint('fire')
      : {
          core: c.colorCore,
          edge: c.colorEdge,
          deep: c.colorEdge,
          scorch: c.colorScorch,
          trail: [c.colorCore, c.colorEdge, c.colorScorch, '#1a0600']
        };
    this._paint(tint);
    for (const mat of [this.bladeMat, this.glowMat]) {
      mat.uniforms.uLife.value = 0;
      mat.uniforms.uOpacity.value = 1;
    }
    this.ctx.flash.trigger(getColor(tint.core), 0.06);
  }

  onTravel(dt) {
    const c = this.config;
    const g = settings.global;
    this._pivot(_center);
    const sweep = c.sweepRadians ?? 2.35;
    const radius = Math.max(0.95, c.sweepRadius ?? 1.65);
    const facing = Math.atan2(this.direction.x, this.direction.z);
    const angle = facing - sweep * 0.5 + this.u * sweep;
    const height = c.flightHeight ?? 1.02;

    _pos.set(
      _center.x + Math.sin(angle) * radius,
      height,
      _center.z + Math.cos(angle) * radius
    );
    _look.set(Math.cos(angle), 0.08, -Math.sin(angle)).normalize();

    const span = c.slashOuter ?? 0.82;
    this.blade.position.copy(_pos);
    this.blade.quaternion.setFromUnitVectors(_fwd, _look);
    this.blade.rotateZ(c.slashBank ?? 1.05);
    this.blade.scale.setScalar(span);
    this.blade.updateMatrix();

    this.glow.position.copy(_pos);
    this.glow.quaternion.copy(this.blade.quaternion);
    this.glow.scale.setScalar(span * 1.22);
    this.glow.updateMatrix();

    const glow = (c.glow ?? 2.4) * g.glow;
    this.bladeMat.uniforms.uIntensity.value = glow * 2.4;
    this.glowMat.uniforms.uIntensity.value = glow * 1.2;

    const n = this._ember.tick(dt, c.emberRate ?? 180);
    if (n > 0) {
      _dir.copy(_look).multiplyScalar(-0.35).addScaledVector(_up, 0.15);
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = c.emberSpeed ?? 3.4;
      _emit.spread = 0.28;
      _emit.radius = 0.05;
      _emit.size = (c.emberSize ?? 0.08) * g.particleSize;
      _emit.life = 0.3 * g.particleLifetime;
      _emit.time = this.age;
      this.embers.emit(n, _emit);
    }

    if (this.front - this._lastScorch > (c.scorchSpacing ?? 0.35)) {
      this._lastScorch = this.front;
      _pos.y = 0.02;
      this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
        radius: (c.scorchRadius ?? 0.45) * 0.55,
        life: 1.8,
        intensity: 0.5,
        colorA: getColor(this._tint?.scorch || c.colorScorch)
      });
    }

    this.lightColor.copy(getColor(this._tint?.core || c.colorCore));
    this.position.copy(this.blade.position);
  }

  onImpact() {
    const c = this.config;
    const tint = this._tint || auraTint('fire');
    this._pivot(_center);
    _pos.copy(_center).addScaledVector(this.direction, c.sweepRadius ?? 1.65);
    _pos.y = 0.12;
    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: 0.14,
      endRadius: Math.min(1.1, (c.burstRadius ?? 1.8) * 0.45),
      life: 0.36,
      intensity: 1,
      colorA: getColor(tint.core),
      colorB: getColor(tint.edge),
      colorC: getColor(tint.scorch)
    });
    _pos.y = 0.03;
    this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
      radius: (c.impactScorch ?? 1.6) * 0.55,
      life: 2.2,
      intensity: 0.75,
      colorA: getColor(tint.scorch)
    });
    this.ctx.shake.add((c.shake ?? 0.28) * settings.global.cameraShake, 2.1, 24);
    _emit.position = _pos.setY(c.flightHeight ?? 1.02);
    _emit.direction = _up;
    _emit.speed = 4;
    _emit.spread = 0.8;
    _emit.radius = 0.2;
    _emit.size = 0.1;
    _emit.life = 0.4;
    _emit.time = this.age;
    this.sparks.emit(18, _emit);
    this.lightBoost = 1.8;
  }

  onFade(_dt, t) {
    const fade = saturate(t);
    for (const mat of [this.bladeMat, this.glowMat]) {
      mat.uniforms.uLife.value = fade;
      mat.uniforms.uOpacity.value = 1 - fade;
    }
    const span = (this.config.slashOuter ?? 0.82) * (1 - fade * 0.55);
    this.blade.scale.setScalar(span);
    this.glow.scale.setScalar(span * 1.22);
  }

  onDestroy() {
    this.blade.visible = false;
    this.glow.visible = false;
  }
}
