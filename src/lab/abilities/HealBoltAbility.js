// @ts-nocheck
/**
 * HOLY LIGHT — misty heal dart with a green wind trail.
 *
 * Same dart language as Fire Bolt, but the wake is wind + volume mist, impact
 * is a pale air burst (not fire), and the dummy is restored instead of burned.
 */
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
import { DecalType } from '../effects/GroundDecals.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { LAYER } from '../core/Layers.js';
import { sharedUniforms } from '../core/FrameUniforms.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate } from '../utils/math.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { rampOf } from '../rpg/auras.js';

const _pos = new Vector3();
const _look = new Vector3();
const _fwd = new Vector3(0, 0, 1);
const _back = new Vector3();

const DART_VERT = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vN;
  varying float vAlong;
  void main() {
    vAlong = uv.y;
    float n = snoise(vec3(position.x * 6.0, position.y * 3.0, uTime * 3.4));
    vec3 p = position;
    p.x += n * 0.018;
    p.y += n * 0.012;
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
    float core = pow(max(0.0, 1.0 - rim), 1.6);
    vec3 col = mix(uColorB, uColorA, core + vAlong * 0.3);
    col += uColorA * rim * 0.65;
    float alpha = (0.28 + core * 0.7 + rim * 0.4) * uOpacity;
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

function paletteOf(config) {
  const id = config.variant || settings.aura?.magic || 'heal';
  const p = rampOf(id === 'green' || id === 'heal' || id === 'water' ? id : 'heal');
  return {
    id,
    core: p.hot,
    edge: p.mid,
    deep: p.deep,
    mist: p.rim,
    light: p.mid
  };
}

export class HealBoltAbility extends Ability {
  constructor(context) {
    super('healBolt', context);
    this._wind = new RateEmitter(140);
    this._mist = new RateEmitter(60);
    this._glint = new RateEmitter(18);
  }

  get impactDuration() {
    return this.config.impactTime ?? 0.48;
  }

  createShaders() {
    const c = this.config;
    this.dartMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: sharedUniforms({
        uColorA: { value: new Color(c.colorCore) },
        uColorB: { value: new Color(c.colorEdge) },
        uIntensity: { value: 1 },
        uOpacity: { value: 1 }
      }),
      vertexShader: DART_VERT,
      fragmentShader: DART_FRAG
    });
    this.wakeMat = this.dartMat.clone();

    const shaft = new Mesh(new CylinderGeometry(1, 0.55, 1, 10, 1, true), this.dartMat);
    shaft.geometry.rotateX(Math.PI * 0.5);
    shaft.frustumCulled = false;
    shaft.layers.set(LAYER.VFX);
    shaft.renderOrder = 14;
    this.group.add(shaft);
    this.shaft = shaft;

    const tip = new Mesh(new ConeGeometry(1, 1.6, 8, 1, true), this.dartMat);
    tip.geometry.rotateX(Math.PI * 0.5);
    tip.frustumCulled = false;
    tip.layers.set(LAYER.VFX);
    tip.renderOrder = 15;
    this.group.add(tip);
    this.tip = tip;

    const wake = new Mesh(new CylinderGeometry(1.4, 0.4, 1, 10, 1, true), this.wakeMat);
    wake.geometry.rotateX(Math.PI * 0.5);
    wake.frustumCulled = false;
    wake.layers.set(LAYER.VFX);
    wake.renderOrder = 13;
    this.group.add(wake);
    this.wake = wake;
  }

  onSpawn() {
    const c = this.config;
    this._tint = paletteOf(c);
    const tint = this._tint;
    this.dartMat.uniforms.uColorA.value.copy(getColor(tint.core));
    this.dartMat.uniforms.uColorB.value.copy(getColor(tint.edge));
    this.wakeMat.uniforms.uColorA.value.copy(getColor(tint.core));
    this.wakeMat.uniforms.uColorB.value.copy(getColor(tint.deep));
    this.dartMat.uniforms.uOpacity.value = 1;
    this.wakeMat.uniforms.uOpacity.value = 1;
    this.shaft.visible = true;
    this.tip.visible = true;
    this.wake.visible = true;
    this.ctx.wind?.setPalette(c.trailPalette || (tint.id === 'green' ? 'green' : 'heal'));
    this.ctx.flash.trigger(getColor(tint.core), 0.1);
    this.lightBoost = 0.9;
  }

  _orient(at) {
    const c = this.config;
    _look.copy(this.direction);
    _look.y = 0.04;
    if (_look.lengthSq() < 1e-8) _look.copy(_fwd);
    _look.normalize();
    this.shaft.position.copy(at);
    this.shaft.quaternion.setFromUnitVectors(_fwd, _look);
    const radius = c.dartRadius ?? 0.04;
    const length = c.dartLength ?? 0.7;
    this.shaft.scale.set(radius, radius, length);
    this.shaft.updateMatrix();
    this.tip.position.copy(at).addScaledVector(_look, length * 0.52);
    this.tip.quaternion.copy(this.shaft.quaternion);
    this.tip.scale.set(radius * 1.1, radius * 1.1, radius * 2.2);
    this.tip.updateMatrix();
    this.wake.position.copy(at).addScaledVector(_look, -length * 0.4);
    this.wake.quaternion.copy(this.shaft.quaternion);
    this.wake.scale.set(radius * 2.2, radius * 2.2, length * 1.6);
    this.wake.updateMatrix();
  }

  onTravel(dt) {
    const c = this.config;
    this.pointAt(this.u, _pos);
    _pos.y = c.flightHeight;
    this._orient(_pos);
    const glow = c.glow * settings.global.glow;
    this.dartMat.uniforms.uIntensity.value = glow * 1.8;
    this.wakeMat.uniforms.uIntensity.value = glow * 1.1;
    _back.copy(this.direction).multiplyScalar(-1);
    _back.y = 0.18;
    const wind = this.ctx.wind;
    if (wind) {
      const n = this._wind.tick(dt, c.trailRate ?? 140);
      wind.emitWind(_pos, _back, n, {
        speed: c.trailSpeed ?? 2.8,
        size: c.trailSize ?? 0.12,
        life: 0.62,
        radius: 0.06,
        spread: 0.24,
        time: this.age,
        palette: c.trailPalette || 'heal'
      });
      const m = this._mist.tick(dt, (c.trailRate ?? 140) * 0.4);
      wind.emitMist(_pos, m, { size: 0.32, life: 0.9, radius: 0.1, time: this.age });
      const g = this._glint.tick(dt, 14);
      if (g) wind.emitHeal(_pos, g, { time: this.age, palette: 'heal', radius: 0.05 });
    }
    this.lightColor.copy(getColor(this._tint?.light || c.colorCore));
    this.position.y = c.flightHeight;
  }

  onImpact() {
    const c = this.config;
    const tint = this._tint || paletteOf(c);
    this.pointAt(1, _pos);
    _pos.y = 0.28;
    this.ctx.bursts.spawn(BurstMode.AIR, _pos, {
      radius: 0.18,
      endRadius: Math.min(2.2, c.burstRadius * 0.7),
      life: 0.7,
      intensity: 1.05,
      displace: 0.22,
      colorA: getColor(tint.core),
      colorB: getColor(tint.edge),
      colorC: getColor(tint.deep)
    });
    this.ctx.decals.spawn(DecalType.FROST, _pos, {
      radius: Math.min(1.6, c.scorchRadius * 0.7),
      life: c.scorchLife,
      intensity: 0.7,
      colorA: getColor(tint.mist || tint.core)
    });
    this.ctx.decals.spawn(DecalType.DUSTRING, _pos, {
      radius: Math.min(1.8, c.scorchRadius * 0.85),
      life: c.scorchLife * 0.7,
      intensity: 0.45,
      colorA: getColor(tint.deep)
    });
    this.ctx.wind?.emitHeal(_pos, 28, { time: this.age, palette: 'heal', radius: 0.28 });
    this.ctx.shake.add(c.shake * settings.global.cameraShake * 0.6, 1.8, 18);
    this.ctx.flash.trigger(getColor(tint.core), c.flash * 0.7);
    this.lightBoost = 2.4;
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
}
