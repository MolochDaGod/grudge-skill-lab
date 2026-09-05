// @ts-nocheck
import {
  Group,
  Mesh,
  IcosahedronGeometry,
  SphereGeometry,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  Vector3,
  BackSide
} from 'three';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { LAYER } from '../core/Layers.js';
import { sharedUniforms, frame } from '../core/FrameUniforms.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _emit = {};
const _tint = new Color('#fff4c0');

const ORB_VERT = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vPos;
  void main() {
    float n = fbm3(position * 2.4 + vec3(0.0, uTime * 3.1, 0.0));
    vec3 p = position * (1.0 + n * 0.28);
    vPos = p;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const ORB_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vPos;
  void main() {
    float n = fbm3(vPos * 3.2 - vec3(0.0, uTime * 4.0, 0.0));
    float fres = pow(max(0.0, 1.0 - abs(vN.z)), 2.1);
    vec3 col = mix(uColorB, uColorA, clamp(n, 0.0, 1.0));
    col += uColorA * fres * 1.3;
    gl_FragColor = vec4(col * uIntensity, (0.7 + fres * 0.5) * uOpacity);
  }
`;

const HALO_FRAG = /* glsl */ `
  ${commonGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vPos;
  void main() {
    float fres = pow(max(0.0, 1.0 - abs(vN.z)), 1.25);
    vec3 col = mix(uColorB, uColorA, fres);
    gl_FragColor = vec4(col * uIntensity, fres * 0.62 * uOpacity);
  }
`;

/**
 * Aimed Shot wind-up: a power orb at the arrow tip with motes sucking in.
 * App owns start/stop; this only paints.
 */
export class BowChargeFx {
  constructor(particles) {
    this.group = new Group();
    this.group.name = 'BowChargeFx';
    this.group.visible = false;

    const geo = new IcosahedronGeometry(1, 3);
    this.orbMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color('#fff6c8') },
        uColorB: { value: new Color('#7adf4a') },
        uIntensity: { value: 2.4 },
        uOpacity: { value: 1 }
      }),
      vertexShader: ORB_VERT,
      fragmentShader: ORB_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.orb = new Mesh(geo, this.orbMat);
    this.orb.layers.set(LAYER.VFX);
    this.orb.frustumCulled = false;
    this.orb.renderOrder = 26;
    this.group.add(this.orb);

    this.haloMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color('#d8ff9a') },
        uColorB: { value: new Color('#3a8a28') },
        uIntensity: { value: 1.5 },
        uOpacity: { value: 1 }
      }),
      vertexShader: ORB_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide
    });
    this.halo = new Mesh(new SphereGeometry(1, 24, 16), this.haloMat);
    this.halo.layers.set(LAYER.VFX);
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 25;
    this.group.add(this.halo);

    this.motes = particles.get('bow-charge-in', {
      capacity: 900,
      shape: ParticleShape.SOFT,
      additive: true,
      curl: true
    });
    this.motes.setGradient(
      new Color('#ffffff'),
      new Color('#c8f080'),
      new Color('#5aaa32'),
      new Color('#142808')
    );
    this._emitter = new RateEmitter(70);
    this.active = false;
    this.power = 0;
  }

  get object3D() {
    return this.group;
  }

  start() {
    this.active = true;
    this.power = 0;
    this.group.visible = true;
    this._emitter.reset();
  }

  stop() {
    this.active = false;
    this.group.visible = false;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,z:number}} tip  arrow-tip world position
   * @param {number} power 0..1 charge
   */
  update(dt, tip, power) {
    if (!this.active || !tip) {
      this.group.visible = false;
      return;
    }
    this.power = power;
    this.group.visible = true;
    this.group.position.set(tip.x, tip.y, tip.z);
    const swell = 0.07 + power * 0.22;
    const pulse = 1 + 0.08 * Math.sin(performance.now() * 0.018);
    this.orb.scale.setScalar(swell * pulse);
    this.halo.scale.setScalar(swell * 2.3 * pulse);
    this.orbMat.uniforms.uIntensity.value = 1.6 + power * 2.4;
    this.haloMat.uniforms.uIntensity.value = 1.1 + power * 1.6;
    this.orbMat.uniforms.uOpacity.value = 0.55 + power * 0.45;
    this.haloMat.uniforms.uOpacity.value = 0.4 + power * 0.55;

    const n = this._emitter.tick(dt, 40 + power * 110);
    for (let i = 0; i < n; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.45 + Math.random() * 0.85;
      _pos.set(
        tip.x + r * Math.sin(phi) * Math.cos(theta),
        tip.y + r * Math.cos(phi),
        tip.z + r * Math.sin(phi) * Math.sin(theta)
      );
      _dir.set(tip.x - _pos.x, tip.y - _pos.y, tip.z - _pos.z).normalize();
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = 1.4 + power * 2.6;
      _emit.spread = 0.08;
      _emit.radius = 0;
      _emit.size = 0.035 + power * 0.04;
      _emit.life = 0.28 + power * 0.18;
      _emit.time = frame.uTime.value;
      _emit.tint = _tint;
      this.motes.emit(1, _emit);
    }
  }
}
