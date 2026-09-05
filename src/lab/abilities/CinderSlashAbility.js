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

const _from = new Vector3();
const _to = new Vector3();
const _pos = new Vector3();
const _dir = new Vector3();
const _look = new Vector3(0, 0, 1);
const _fwd = new Vector3(0, 0, 1);
const _up = new Vector3(0, 1, 0);
const _emit = {};

const SLASH_VERT = /* glsl */ `
  ${noiseGLSL}
  varying vec2 vUv;
  varying float vAlong;
  void main() {
    vUv = uv;
    vAlong = uv.x;
    vec3 p = position;
    float n = snoise(vec3(uv.x * 6.0, uv.y * 3.0, 0.4));
    p += normal * n * 0.012;
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
  varying float vAlong;
  void main() {
    float along = vUv.x;
    float across = vUv.y;
    float n = fbm3(vec3(along * 8.0, across * 4.0, uTime * 6.0));
    float edge = pow(1.0 - abs(across * 2.0 - 1.0), 1.65);
    float tips = smoothstep(0.0, 0.1, along) * (1.0 - smoothstep(0.86, 1.0, along));
    float core = pow(edge, 2.4);
    vec3 col = mix(uColorB, uColorA, core + n * 0.28);
    col += uColorA * core * 0.55;
    float alpha = edge * tips * uOpacity * (1.0 - uLife);
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

const SKIP_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uLife;
  uniform float uTime;
  varying vec2 vUv;
  varying float vAlong;
  void main() {
    float along = vUv.x;
    float across = vUv.y;
    float n = fbm3(vec3(along * 10.0, uTime * 7.0, across * 5.0));
    float edge = pow(1.0 - abs(across * 2.0 - 1.0), 1.35);
    float tips = smoothstep(0.0, 0.14, along) * (1.0 - smoothstep(0.8, 1.0, along));
    vec3 col = mix(uColorB, uColorA, edge + n * 0.3);
    float alpha = edge * tips * 0.7 * uOpacity * (1.0 - uLife);
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

/**
 * CINDER SLASH — a shaped crescent that leaves the blade (or skips off the
 * dirt) and flies at the target. Nothing is drawn through the caster: the
 * projectile starts at the hand and the ground rip only after the first step.
 */
export class CinderSlashAbility extends Ability {
  constructor(context) {
    super('cinderSlash', context);
    this._lastScorch = 0;
    this._ember = new RateEmitter(80);
    this._skip = new RateEmitter(50);
    this._tint = null;
  }

  get impactDuration() {
    return this.config.impactTime;
  }

  get fadeDuration() {
    return this.config.fadeTime;
  }

  createShaders() {
    const arc = Math.PI * 0.92;
    const cresGeo = new RingGeometry(0.58, 1, 56, 1, Math.PI * 0.12, arc);
    this.crescentMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 0.85, 0.4) },
        uColorB: { value: new Color(1, 0.2, 0.04) },
        uIntensity: { value: 2.4 },
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
    this.crescent = new Mesh(cresGeo, this.crescentMat);
    this.crescent.name = 'CinderSlash:crescent';
    this.crescent.layers.set(LAYER.VFX);
    this.crescent.frustumCulled = false;
    this.crescent.renderOrder = 22;
    this.group.add(this.crescent);

    this.glowMat = this.crescentMat.clone();
    this.glow = new Mesh(cresGeo, this.glowMat);
    this.glow.name = 'CinderSlash:glow';
    this.glow.layers.set(LAYER.VFX);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 21;
    this.group.add(this.glow);

    const skipGeo = new RingGeometry(0.42, 1, 40, 1, Math.PI * 0.18, arc * 0.82);
    this.skipMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 0.7, 0.25) },
        uColorB: { value: new Color(1, 0.18, 0.02) },
        uIntensity: { value: 1.6 },
        uOpacity: { value: 1 },
        uLife: { value: 0 }
      }),
      vertexShader: SLASH_VERT,
      fragmentShader: SKIP_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide
    });
    this.skip = new Mesh(skipGeo, this.skipMat);
    this.skip.name = 'CinderSlash:skip';
    this.skip.layers.set(LAYER.VFX);
    this.skip.frustumCulled = false;
    this.skip.renderOrder = 18;
    this.group.add(this.skip);
  }

  createParticles() {
    this.embers = this.ctx.particles.get('cinder-slash-embers', {
      capacity: 1200,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.sparks = this.ctx.particles.get('cinder-slash-sparks', {
      capacity: 500,
      shape: ParticleShape.SOFT,
      additive: true
    });
    this.embers.setGradient(getColor('#fff6c8'), getColor('#ff7a1e'), getColor('#c42800'), getColor('#2a0800'));
    this.sparks.setGradient(getColor('#ffffff'), getColor('#ffd08a'), getColor('#ff5a12'), getColor('#5a1200'));
  }

  _paint(tint) {
    this._tint = tint;
    for (const mat of [this.crescentMat, this.glowMat, this.skipMat]) {
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

  _bladeFrom(out) {
    const c = this.config;
    const character = this.ctx.character;
    const release = Math.max(0.45, c.release ?? 0.85);
    if (character?.getBoneWorld) {
      character.getBoneWorld('RightHand', out);
      out.addScaledVector(this.direction, c.handForward ?? 0.32);
      if (out.y < 0.35) out.y = c.flightHeight ?? 1.05;
      return out;
    }
    out.copy(this.origin).addScaledVector(this.direction, release);
    out.y = c.flightHeight ?? 1.05;
    return out;
  }

  _impactAt(out) {
    const c = this.config;
    this.pointAt(1, out);
    out.y = c.impactHeight ?? 1.02;
    return out;
  }

  _orient(mesh, dir, bank) {
    _look.copy(dir);
    if (_look.lengthSq() < 1e-8) _look.copy(_fwd);
    _look.normalize();
    mesh.quaternion.setFromUnitVectors(_fwd, _look);
    if (bank) mesh.rotateZ(bank);
  }

  onSpawn() {
    this._lastScorch = 0;
    this._ember._accumulator = 0;
    this._skip._accumulator = 0;
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
    for (const mat of [this.crescentMat, this.glowMat, this.skipMat]) {
      mat.uniforms.uLife.value = 0;
      mat.uniforms.uOpacity.value = 1;
    }
    this.crescent.visible = true;
    this.glow.visible = true;
    this.skip.visible = false;
    this.ctx.flash.trigger(getColor(tint.core), Math.min(0.08, (c.flash ?? 0.2) * 0.28));
  }

  onTravel(dt) {
    const c = this.config;
    const g = settings.global;
    const span =
      (c.slashOuter ?? 0.5) * (settings.combat?.slashArc ?? 1) * (settings.combat?.slashSpan ?? 1);
    const bank = c.slashBank ?? 0.45;
    const glow = c.glow * g.glow;

    this._bladeFrom(_from);
    this._impactAt(_to);
    _pos.lerpVectors(_from, _to, this.u);
    _dir.copy(_to).sub(_from);
    if (_dir.lengthSq() < 1e-8) _dir.copy(this.direction);
    _dir.normalize();

    this.crescent.position.copy(_pos);
    this._orient(this.crescent, _dir, bank);
    this.crescent.scale.setScalar(span);
    this.crescent.updateMatrix();

    this.glow.position.copy(_pos);
    this._orient(this.glow, _dir, bank);
    this.glow.scale.setScalar(span * 1.28);
    this.glow.updateMatrix();

    this.crescentMat.uniforms.uIntensity.value = glow * 2.5;
    this.glowMat.uniforms.uIntensity.value = glow * 1.35;

    const skipOn = this.u > 0.12 && this.u < 0.98 && this._clearOfCaster(_pos);
    this.skip.visible = skipOn;
    if (skipOn) {
      this.skip.position.copy(_pos);
      this.skip.position.y = 0.045;
      this._orient(this.skip, this.direction, 0);
      this.skip.rotateX(-1.12);
      this.skip.scale.set(span * 0.85, span * 0.55, span * 1.15);
      this.skip.updateMatrix();
      this.skipMat.uniforms.uIntensity.value = glow * 1.15;
    }

    const n = this._ember.tick(dt, c.emberRate);
    if (n > 0) {
      _look.copy(_dir).multiplyScalar(-1).addScaledVector(_up, 0.12);
      _emit.position = _pos;
      _emit.direction = _look;
      _emit.speed = (c.emberSpeed ?? 3.4) * 1.15;
      _emit.spread = 0.22;
      _emit.radius = 0.04;
      _emit.size = (c.emberSize ?? 0.08) * g.particleSize;
      _emit.life = 0.32 * g.particleLifetime;
      _emit.time = this.age;
      this.embers.emit(n, _emit);
    }

    const skipN = this._skip.tick(dt, (c.emberRate ?? 140) * 0.55);
    if (skipOn && skipN > 0) {
      _pos.y = 0.06;
      _look.set(this.direction.x, 0.28, this.direction.z).normalize();
      _emit.position = _pos;
      _emit.direction = _look;
      _emit.speed = 4.6;
      _emit.spread = 0.28;
      _emit.radius = 0.08;
      _emit.size = 0.07 * g.particleSize;
      _emit.life = 0.38 * g.particleLifetime;
      _emit.time = this.age;
      this.embers.emit(skipN, _emit);
    }

    if (skipOn && this.front - this._lastScorch > (c.scorchSpacing ?? 0.5)) {
      this._lastScorch = this.front;
      _pos.y = 0.02;
      this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
        radius: (c.scorchRadius ?? 0.5) * 0.45,
        life: (c.scorchLife ?? 2.4) * 0.7,
        intensity: 0.55,
        colorA: getColor(this._tint?.scorch || c.colorScorch)
      });
    }

    this.lightColor.copy(getColor(this._tint?.core || c.colorCore));
    this.position.copy(this.crescent.position);
  }

  _clearOfCaster(point) {
    const character = this.ctx.character;
    if (!character?.position) return this.u > 0.14;
    const dx = point.x - character.position.x;
    const dz = point.z - character.position.z;
    return dx * dx + dz * dz > 0.95 * 0.95;
  }

  onImpact() {
    const c = this.config;
    const tint = this._tint || auraTint('fire');
    this._impactAt(_pos);
    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: 0.16,
      endRadius: Math.min(1.05, (c.burstRadius ?? 1.6) * 0.42),
      life: 0.38,
      intensity: 1.05,
      colorA: getColor(tint.core),
      colorB: getColor(tint.edge),
      colorC: getColor(tint.scorch)
    });
    _pos.y = 0.03;
    this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
      radius: (c.impactScorch ?? 1.4) * 0.55,
      life: (c.scorchLife ?? 2.4) * 1.1,
      intensity: 0.9,
      colorA: getColor(tint.scorch)
    });
    this.ctx.shake.add((c.shake ?? 0.2) * settings.global.cameraShake, 2.2, 26);
    this.ctx.flash.trigger(getColor(tint.core), Math.min(0.18, c.flash ?? 0.22));
    _emit.position = _pos.setY(c.impactHeight ?? 1.02);
    _emit.direction = _up;
    _emit.speed = 4.2;
    _emit.spread = 0.7;
    _emit.radius = 0.18;
    _emit.size = 0.1;
    _emit.life = 0.42;
    _emit.time = this.age;
    this.sparks.emit(22, _emit);
    this.lightBoost = 2.1;
  }

  onFade(_dt, t) {
    const fade = saturate(t);
    for (const mat of [this.crescentMat, this.glowMat, this.skipMat]) {
      mat.uniforms.uLife.value = fade;
      mat.uniforms.uOpacity.value = 1 - fade;
    }
    const span =
      (this.config.slashOuter ?? 0.5) *
      (settings.combat?.slashArc ?? 1) *
      (settings.combat?.slashSpan ?? 1);
    const k = 1 - fade * 0.65;
    this.crescent.scale.setScalar(span * k);
    this.glow.scale.setScalar(span * 1.28 * k);
  }

  onDestroy() {
    this.crescent.visible = false;
    this.glow.visible = false;
    this.skip.visible = false;
  }

  lightShimmer() {
    return 0.8 + 0.25 * Math.abs(Math.sin(this.age * 18));
  }
}
