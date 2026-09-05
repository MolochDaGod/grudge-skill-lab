// @ts-nocheck
import {
  Mesh,
  ConeGeometry,
  CylinderGeometry,
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
const _look = new Vector3();
const _dir = new Vector3();
const _fwd = new Vector3(0, 0, 1);
const _up = new Vector3(0, 1, 0);
const _emit = {};

const DART_VERT = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vN;
  varying float vAlong;
  void main() {
    vAlong = uv.y;
    float n = snoise(vec3(position.x * 10.0, position.y * 5.0, uTime * 8.0));
    vec3 p = position;
    p.x += n * 0.008;
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
    float rim = pow(1.0 - abs(vN.z), 1.35);
    float core = pow(max(0.0, 1.0 - rim), 2.1);
    vec3 col = mix(uColorB, uColorA, core + vAlong * 0.2);
    col += uColorA * rim * 0.7;
    float alpha = (0.35 + core * 0.9 + rim * 0.25) * uOpacity;
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

/**
 * T0 Quick Thrust — `t0_sword_quick_thrust`.
 * A thin poke that leaves the blade and races the aimed line. Not a slash.
 */
export class QuickThrustAbility extends Ability {
  constructor(context) {
    super('combo2', context);
    this._trail = new RateEmitter(90);
    this._tint = null;
  }

  get impactDuration() {
    return this.config.impactTime ?? 0.18;
  }

  get fadeDuration() {
    return this.config.fadeTime ?? 0.28;
  }

  createShaders() {
    this.dartMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 0.95, 0.75) },
        uColorB: { value: new Color(1, 0.45, 0.08) },
        uIntensity: { value: 2.2 },
        uOpacity: { value: 1 }
      }),
      vertexShader: DART_VERT,
      fragmentShader: DART_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide
    });

    const shaftGeo = new CylinderGeometry(1, 0.35, 1, 10, 1, true);
    shaftGeo.translate(0, 0.5, 0);
    shaftGeo.rotateX(Math.PI / 2);
    this.shaft = new Mesh(shaftGeo, this.dartMat);
    this.shaft.name = 'QuickThrust:shaft';
    this.shaft.layers.set(LAYER.VFX);
    this.shaft.frustumCulled = false;
    this.shaft.renderOrder = 23;
    this.group.add(this.shaft);

    const tipGeo = new ConeGeometry(1, 1, 8, 1, true);
    tipGeo.translate(0, 0.5, 0);
    tipGeo.rotateX(Math.PI / 2);
    this.tip = new Mesh(tipGeo, this.dartMat);
    this.tip.name = 'QuickThrust:tip';
    this.tip.layers.set(LAYER.VFX);
    this.tip.frustumCulled = false;
    this.tip.renderOrder = 24;
    this.group.add(this.tip);
  }

  createParticles() {
    this.trail = this.ctx.particles.get('quick-thrust-trail', {
      capacity: 900,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.sparks = this.ctx.particles.get('quick-thrust-sparks', {
      capacity: 320,
      shape: ParticleShape.SOFT,
      additive: true
    });
  }

  _paint(tint) {
    this._tint = tint;
    this.dartMat.uniforms.uColorA.value.copy(getColor(tint.core));
    this.dartMat.uniforms.uColorB.value.copy(getColor(tint.edge));
    this.trail.setGradient(
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

  _fromHand(out) {
    const c = this.config;
    const character = this.ctx.character;
    if (character?.getBoneWorld) {
      character.getBoneWorld('RightHand', out);
      out.addScaledVector(this.direction, c.handForward ?? 0.42);
      if (out.y < 0.4) out.y = c.flightHeight ?? 1.12;
      return out;
    }
    out.copy(this.origin).addScaledVector(this.direction, c.release ?? 0.7);
    out.y = c.flightHeight ?? 1.12;
    return out;
  }

  onSpawn() {
    this._trail._accumulator = 0;
    this.shaft.visible = true;
    this.tip.visible = true;
    const c = this.config;
    const tint = settings.combat?.tintFromAura
      ? auraTint('boost')
      : {
          core: c.colorCore,
          edge: c.colorEdge,
          deep: c.colorEdge,
          scorch: c.colorScorch,
          trail: [c.colorCore, c.colorEdge, c.colorScorch, '#1a0800']
        };
    this._paint(tint);
    this.dartMat.uniforms.uOpacity.value = 1;
    this.ctx.flash.trigger(getColor(tint.core), 0.05);
  }

  onTravel(dt) {
    const c = this.config;
    this._fromHand(_from);
    this.pointAt(1, _to);
    _to.y = c.impactHeight ?? 1.05;
    _pos.lerpVectors(_from, _to, this.u);
    _look.copy(_to).sub(_from);
    if (_look.lengthSq() < 1e-8) _look.copy(this.direction);
    _look.normalize();

    const radius = c.dartRadius ?? 0.028;
    const length = c.dartLength ?? 0.72;
    this.shaft.position.copy(_pos);
    this.shaft.quaternion.setFromUnitVectors(_fwd, _look);
    this.shaft.scale.set(radius, radius, length);
    this.shaft.updateMatrix();
    this.tip.position.copy(_pos).addScaledVector(_look, length * 0.52);
    this.tip.quaternion.copy(this.shaft.quaternion);
    this.tip.scale.set(radius * 1.2, radius * 1.2, radius * 2.6);
    this.tip.updateMatrix();

    const glow = (c.glow ?? 2) * settings.global.glow;
    this.dartMat.uniforms.uIntensity.value = glow * 2.2;

    const n = this._trail.tick(dt, c.trailRate ?? 160);
    if (n > 0) {
      _dir.copy(_look).multiplyScalar(-1).addScaledVector(_up, 0.04);
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = c.trailSpeed ?? 4.2;
      _emit.spread = 0.1;
      _emit.radius = 0.02;
      _emit.size = (c.trailSize ?? 0.06) * settings.global.particleSize;
      _emit.life = 0.22;
      _emit.time = this.age;
      this.trail.emit(n, _emit);
    }

    this.lightColor.copy(getColor(this._tint?.core || c.colorCore));
    this.position.copy(_pos);
  }

  onImpact() {
    const c = this.config;
    const tint = this._tint || auraTint('boost');
    this.pointAt(1, _pos);
    _pos.y = c.impactHeight ?? 1.05;
    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: 0.08,
      endRadius: Math.min(0.55, (c.burstRadius ?? 0.7) * 0.4),
      life: 0.22,
      intensity: 0.85,
      colorA: getColor(tint.core),
      colorB: getColor(tint.edge),
      colorC: getColor(tint.scorch)
    });
    _pos.y = 0.03;
    this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
      radius: 0.35,
      life: 1.4,
      intensity: 0.5,
      colorA: getColor(tint.scorch)
    });
    this.ctx.shake.add((c.shake ?? 0.12) * settings.global.cameraShake, 1.6, 22);
    _emit.position = _pos.setY(c.impactHeight ?? 1.05);
    _emit.direction = _up;
    _emit.speed = 3.4;
    _emit.spread = 0.45;
    _emit.radius = 0.08;
    _emit.size = 0.07;
    _emit.life = 0.28;
    _emit.time = this.age;
    this.sparks.emit(12, _emit);
    this.lightBoost = 1.4;
  }

  onFade(_dt, t) {
    const fade = saturate(t);
    this.dartMat.uniforms.uOpacity.value = 1 - fade;
    const k = 1 - fade * 0.7;
    const radius = (this.config.dartRadius ?? 0.028) * k;
    const length = (this.config.dartLength ?? 0.72) * k;
    this.shaft.scale.set(radius, radius, length);
    this.tip.scale.set(radius * 1.2, radius * 1.2, radius * 2.6);
  }

  onDestroy() {
    this.shaft.visible = false;
    this.tip.visible = false;
  }
}
