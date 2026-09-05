// @ts-nocheck
import {
  Mesh,
  CylinderGeometry,
  IcosahedronGeometry,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  Vector3,
  Quaternion,
  DoubleSide
} from 'three';
import { Ability } from './Ability.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { DecalType } from '../effects/GroundDecals.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { LAYER } from '../core/Layers.js';
import { sharedUniforms, frame } from '../core/FrameUniforms.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate } from '../utils/math.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';

const _hand = new Vector3();
const _tip = new Vector3();
const _mid = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);
const _quat = new Quaternion();
const _emit = {};
const _look = new Vector3();

const BEAM_VERT = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vN;
  varying float vAlong;
  void main() {
    vAlong = uv.y;
    float n = snoise(vec3(uv.x * 4.0, uv.y * 8.0, uTime * 4.0));
    vec3 p = position;
    p.x += n * 0.015;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const BEAM_FRAG = /* glsl */ `
  ${commonGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  varying vec3 vN;
  varying float vAlong;
  void main() {
    float rim = pow(1.0 - abs(vN.z), 1.4);
    float core = pow(1.0 - rim, 2.2);
    vec3 col = mix(uColorB, uColorA, core);
    col += uColorA * rim * 0.85;
    float alpha = (0.35 + core * 0.9 + rim * 0.4) * uOpacity;
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

/**
 * Aimed Shot — a linear beam that races the aimed line after a hold-charge.
 * Catalog: t0_bow_aimed_shot.
 */
export class AimedShotAbility extends Ability {
  constructor(context) {
    super('aimedShot', context);
    this._trail = new RateEmitter(160);
  }

  get impactDuration() {
    return this.config.impactTime ?? 0.22;
  }

  get fadeDuration() {
    return this.config.fadeTime ?? 0.35;
  }

  createShaders() {
    const geo = new CylinderGeometry(1, 0.55, 1, 18, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);
    this.mat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 0.96, 0.7) },
        uColorB: { value: new Color(0.45, 0.85, 0.22) },
        uIntensity: { value: 2.6 },
        uOpacity: { value: 1 }
      }),
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.beam = new Mesh(geo, this.mat);
    this.beam.layers.set(LAYER.VFX);
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 24;
    this.group.add(this.beam);

    this.haloMat = this.mat.clone();
    this.halo = new Mesh(geo, this.haloMat);
    this.halo.layers.set(LAYER.VFX);
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 23;
    this.group.add(this.halo);

    this.muzzle = new Mesh(new IcosahedronGeometry(1, 2), this.mat);
    this.muzzle.layers.set(LAYER.VFX);
    this.muzzle.frustumCulled = false;
    this.muzzle.renderOrder = 25;
    this.group.add(this.muzzle);
  }

  createParticles() {
    this.streaks = this.ctx.particles.get('aimed-shot-beam', {
      capacity: 1400,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.impact = this.ctx.particles.get('aimed-shot-hit', {
      capacity: 700,
      shape: ParticleShape.SOFT,
      additive: true
    });
    this.streaks.setGradient(getColor('#ffffff'), getColor('#d8ff88'), getColor('#5aaa28'), getColor('#1a3008'));
    this.impact.setGradient(getColor('#ffffff'), getColor('#e8ffb0'), getColor('#7adf4a'), getColor('#204010'));
  }

  _hand() {
    const c = this.config;
    return _hand
      .copy(this.origin)
      .addScaledVector(this.direction, c.handForward ?? 0.55)
      .addScaledVector(this.side, c.handSide ?? 0.12)
      .setY(c.handHeight ?? 1.28);
  }

  onSpawn() {
    this._trail.reset();
    this.beam.visible = true;
    this.halo.visible = true;
    this.muzzle.visible = true;
    const c = this.config;
    this.mat.uniforms.uColorA.value.copy(getColor(c.colorCore));
    this.mat.uniforms.uColorB.value.copy(getColor(c.colorEdge));
    this.haloMat.uniforms.uColorA.value.copy(getColor(c.colorCore));
    this.haloMat.uniforms.uColorB.value.copy(getColor(c.colorEdge));
    this.ctx.flash.trigger(getColor(c.colorCore), 0.22);
    this.lightBoost = 1.8;
    this.ctx.shake.add((c.shake ?? 0.22) * settings.global.cameraShake, 2.2, 26);
  }

  _place(length) {
    const hand = this._hand();
    this.pointAt(this.u, _tip);
    _tip.y = this.config.endHeight ?? 1.05;
    _dir.copy(_tip).sub(hand);
    const len = Math.max(0.12, _dir.length());
    _dir.multiplyScalar(1 / len);
    this.beam.position.copy(hand);
    _look.copy(hand).add(_dir);
    this.beam.lookAt(_look);
    const radius = this.config.radius ?? 0.055;
    this.beam.scale.set(radius, radius, len);
    this.halo.position.copy(hand);
    this.halo.quaternion.copy(this.beam.quaternion);
    this.halo.scale.set(radius * 2.4, radius * 2.4, len);
    this.muzzle.position.copy(hand);
    this.muzzle.scale.setScalar(radius * 3.2);
    this.position.copy(_tip);
  }

  onTravel(dt) {
    const c = this.config;
    this._place();
    const glow = (c.glow ?? 2.4) * settings.global.glow;
    this.mat.uniforms.uIntensity.value = glow * 2.2;
    this.haloMat.uniforms.uIntensity.value = glow * 1.1;
    this.mat.uniforms.uOpacity.value = 1;
    this.haloMat.uniforms.uOpacity.value = 0.7;

    const n = this._trail.tick(dt, c.trailRate ?? 180);
    if (n > 0) {
      this._hand();
      this.pointAt(this.u, _tip);
      _mid.copy(_hand).lerp(_tip.setY(c.endHeight ?? 1.05), 0.65);
      _emit.position = _mid;
      _emit.direction = this.direction;
      _emit.speed = 8;
      _emit.spread = 0.12;
      _emit.radius = 0.04;
      _emit.size = 0.07;
      _emit.life = 0.28;
      _emit.time = frame.uTime.value;
      this.streaks.emit(n, _emit);
    }
    this.lightColor.copy(getColor(c.lightColor ?? c.colorCore));
  }

  onImpact() {
    const c = this.config;
    this.pointAt(1, _tip);
    _tip.y = 0.2;
    this.ctx.bursts.spawn(BurstMode.AIR, _tip, {
      radius: 0.3,
      endRadius: c.burstRadius ?? 1.6,
      life: 0.55,
      intensity: 1.4,
      displace: 0.4,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorEdge),
      colorC: getColor(c.colorScorch ?? '#1a3010')
    });
    _emit.position = _tip;
    _emit.direction = _up;
    _emit.speed = 4.5;
    _emit.spread = 1.1;
    _emit.radius = 0.2;
    _emit.size = 0.12;
    _emit.life = 0.45;
    _emit.time = frame.uTime.value;
    this.impact.emit(42, _emit);
    this.ctx.decals.spawn(DecalType.SCORCH, _tip, {
      radius: c.scorchRadius ?? 0.7,
      life: c.scorchLife ?? 2.2
    });
    this.lightBoost = 2.2;
  }

  onFade(_dt, t) {
    const fade = t <= 1 ? 1 : 1 - saturate(t - 1);
    this.mat.uniforms.uOpacity.value = fade;
    this.haloMat.uniforms.uOpacity.value = fade * 0.65;
    const radius = (this.config.radius ?? 0.055) * (0.4 + 0.6 * fade);
    this.beam.scale.x = radius;
    this.beam.scale.y = radius;
    this.halo.scale.x = radius * 2.4;
    this.halo.scale.y = radius * 2.4;
    this.muzzle.scale.setScalar(radius * 3.2 * fade);
    if (fade <= 0.02) {
      this.beam.visible = false;
      this.halo.visible = false;
      this.muzzle.visible = false;
    }
  }
}
