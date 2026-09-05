// @ts-nocheck
import {
  Mesh,
  ConeGeometry,
  CylinderGeometry,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  Vector3,
  DoubleSide
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

const _pos = new Vector3();
const _dir = new Vector3();
const _fwd = new Vector3(0, 0, 1);
const _up = new Vector3(0, 1, 0);
const _look = new Vector3();
const _emit = {};

const DART_VERT = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vN;
  varying float vAlong;
  void main() {
    vAlong = uv.y;
    float n = snoise(vec3(position.x * 8.0, position.y * 4.0, uTime * 6.0));
    vec3 p = position;
    p.x += n * 0.012;
    p.y += n * 0.008;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const DART_FRAG = /* glsl */ `
  ${commonGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  varying vec3 vN;
  varying float vAlong;
  void main() {
    float rim = pow(1.0 - abs(vN.z), 1.45);
    float core = pow(max(0.0, 1.0 - rim), 1.8);
    vec3 col = mix(uColorB, uColorA, core + vAlong * 0.25);
    col += uColorA * rim * 0.9;
    float alpha = (0.4 + core * 0.85 + rim * 0.35) * uOpacity;
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

/**
 * STAFF FIRE BOLT — dart projectile with a fire-bending streak trail.
 *
 * The old icosphere orb read as a large circle. This is a spear of fire that
 * races the aimed line, dragging the same STREAK tongue the Fire Boost uses,
 * tinted by the current K aura variant.
 */
export class FireBoltAbility extends Ability {
  constructor(context) {
    super('fireBolt', context);
    this._trail = new RateEmitter(140);
  }

  get impactDuration() {
    return this.config.impactTime;
  }

  get fadeDuration() {
    return this.config.fadeTime;
  }

  createShaders() {
    this.dartMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 0.95, 0.7) },
        uColorB: { value: new Color(1, 0.28, 0.04) },
        uIntensity: { value: 2.4 },
        uOpacity: { value: 1 }
      }),
      vertexShader: DART_VERT,
      fragmentShader: DART_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });

    const shaftGeo = new CylinderGeometry(1, 0.45, 1, 12, 1, true);
    shaftGeo.translate(0, 0.5, 0);
    shaftGeo.rotateX(Math.PI / 2);
    this.shaft = new Mesh(shaftGeo, this.dartMat);
    this.shaft.layers.set(LAYER.VFX);
    this.shaft.frustumCulled = false;
    this.shaft.renderOrder = 23;
    this.group.add(this.shaft);

    const tipGeo = new ConeGeometry(1, 1, 10, 1, true);
    tipGeo.translate(0, 0.5, 0);
    tipGeo.rotateX(Math.PI / 2);
    this.tip = new Mesh(tipGeo, this.dartMat);
    this.tip.layers.set(LAYER.VFX);
    this.tip.frustumCulled = false;
    this.tip.renderOrder = 24;
    this.group.add(this.tip);

    this.wakeMat = this.dartMat.clone();
    const wakeGeo = new CylinderGeometry(1.8, 0.2, 1, 10, 1, true);
    wakeGeo.translate(0, -0.5, 0);
    wakeGeo.rotateX(Math.PI / 2);
    this.wake = new Mesh(wakeGeo, this.wakeMat);
    this.wake.layers.set(LAYER.VFX);
    this.wake.frustumCulled = false;
    this.wake.renderOrder = 22;
    this.group.add(this.wake);
  }

  createParticles() {
    this.trail = this.ctx.particles.get('fire-bolt-trail', {
      capacity: 1600,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.impact = this.ctx.particles.get('fire-bolt-impact', {
      capacity: 700,
      shape: ParticleShape.SOFT,
      additive: true
    });
    this.smoke = this.ctx.particles.get('fire-bolt-smoke', {
      capacity: 400,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true
    });
    this._applyTint(auraTint('fire'));
  }

  _applyTint(tint) {
    this.trail.setGradient(
      getColor(tint.trail[0]),
      getColor(tint.trail[1]),
      getColor(tint.trail[2]),
      getColor(tint.trail[3])
    );
    this.impact.setGradient(
      getColor('#ffffff'),
      getColor(tint.core),
      getColor(tint.edge),
      getColor(tint.scorch)
    );
    this.smoke.setGradient(
      getColor(tint.edge),
      getColor(tint.deep),
      getColor(tint.scorch),
      getColor('#0a0604')
    );
  }

  onSpawn() {
    this._trail._accumulator = 0;
    this.shaft.visible = true;
    this.tip.visible = true;
    this.wake.visible = true;
    const c = this.config;
    const tint = settings.combat?.tintFromAura ? auraTint('fire') : {
      core: c.colorCore,
      edge: c.colorEdge,
      deep: c.colorEdge,
      scorch: c.colorScorch,
      light: c.lightColor,
      trail: [c.colorCore, c.colorEdge, c.colorScorch, '#1a0600']
    };
    this._tint = tint;
    this._applyTint(tint);
    this.dartMat.uniforms.uColorA.value.copy(getColor(tint.core));
    this.dartMat.uniforms.uColorB.value.copy(getColor(tint.edge));
    this.wakeMat.uniforms.uColorA.value.copy(getColor(tint.core));
    this.wakeMat.uniforms.uColorB.value.copy(getColor(tint.deep));
    this.dartMat.uniforms.uOpacity.value = 1;
    this.wakeMat.uniforms.uOpacity.value = 1;
    this.ctx.flash.trigger(getColor(tint.core), 0.14);
    this.lightBoost = 1.2;
  }

  _orient(at) {
    const c = this.config;
    _look.copy(this.direction);
    _look.y = 0.05;
    if (_look.lengthSq() < 1e-8) _look.copy(_fwd);
    _look.normalize();
    this.shaft.position.copy(at);
    this.shaft.quaternion.setFromUnitVectors(_fwd, _look);
    const radius = c.dartRadius ?? c.orbRadius ?? 0.045;
    const length = c.dartLength ?? 0.62;
    this.shaft.scale.set(radius, radius, length);
    this.shaft.updateMatrix();

    this.tip.position.copy(at).addScaledVector(_look, length * 0.52);
    this.tip.quaternion.copy(this.shaft.quaternion);
    this.tip.scale.set(radius * 1.15, radius * 1.15, radius * 2.4);
    this.tip.updateMatrix();

    this.wake.position.copy(at).addScaledVector(_look, -length * 0.35);
    this.wake.quaternion.copy(this.shaft.quaternion);
    this.wake.scale.set(radius * 1.8, radius * 1.8, length * 1.4);
    this.wake.updateMatrix();
  }

  onTravel(dt) {
    const c = this.config;
    this.pointAt(this.u, _pos);
    _pos.y = c.flightHeight;
    this._orient(_pos);

    const glow = c.glow * settings.global.glow;
    this.dartMat.uniforms.uIntensity.value = glow * 2.4;
    this.wakeMat.uniforms.uIntensity.value = glow * 1.4;

    const n = this._trail.tick(dt, c.trailRate);
    if (n > 0) {
      _dir.copy(this.direction).multiplyScalar(-1);
      _dir.y = 0.12;
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = c.trailSpeed;
      _emit.spread = 0.18;
      _emit.radius = (c.dartRadius ?? 0.045) * 0.6;
      _emit.size = c.trailSize * settings.global.particleSize;
      _emit.life = 0.38;
      _emit.time = this.age;
      this.trail.emit(n, _emit);
    }

    this.lightColor.copy(getColor(this._tint?.light || c.colorCore));
    this.position.y = c.flightHeight;
  }

  onImpact() {
    const c = this.config;
    const tint = this._tint || auraTint('fire');
    this.pointAt(1, _pos);
    _pos.y = 0.22;
    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: 0.22,
      endRadius: Math.min(1.8, c.burstRadius * 0.55),
      life: 0.55,
      intensity: 1.35,
      displace: 0.35,
      colorA: getColor(tint.core),
      colorB: getColor(tint.edge),
      colorC: getColor(tint.scorch)
    });
    this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
      radius: Math.min(1.4, c.scorchRadius * 0.65),
      life: c.scorchLife,
      intensity: 1.05,
      colorA: getColor(tint.scorch)
    });
    this.ctx.shake.add(c.shake * settings.global.cameraShake, 2.6, 28);
    this.ctx.flash.trigger(getColor(tint.core), c.flash * 0.85);
    _emit.position = _pos;
    _emit.direction = _up;
    _emit.speed = 7.2;
    _emit.spread = 0.7;
    _emit.radius = 0.22;
    _emit.size = 0.12;
    _emit.life = 0.55;
    _emit.time = this.age;
    this.impact.emit(36, _emit);
    _emit.speed = 1.4;
    _emit.size = 0.38;
    _emit.life = 0.9;
    this.smoke.emit(12, _emit);
    this.lightBoost = 3.2;
    this.shaft.visible = false;
    this.tip.visible = false;
    this.wake.visible = false;
  }

  onFade(_dt, t) {
    const fade = saturate(t);
    this.dartMat.uniforms.uOpacity.value = 1 - fade;
    this.wakeMat.uniforms.uOpacity.value = 1 - fade;
  }

  onDestroy() {
    this.shaft.visible = false;
    this.tip.visible = false;
    this.wake.visible = false;
  }

  lightShimmer() {
    return 0.8 + 0.45 * Math.abs(Math.sin(this.age * 18));
  }
}
