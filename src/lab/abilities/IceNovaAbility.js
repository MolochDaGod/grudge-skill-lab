// @ts-nocheck
import {
  Mesh,
  CylinderGeometry,
  CircleGeometry,
  ConeGeometry,
  IcosahedronGeometry,
  BoxGeometry,
  ShaderMaterial,
  AdditiveBlending,
  DoubleSide,
  Color,
  Vector3,
  Group
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
import { saturate, Easing } from '../utils/math.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';

const _pos = new Vector3();
const _target = new Vector3();
const _dir = new Vector3();
const _fwd = new Vector3(0, 0, 1);
const _up = new Vector3(0, 1, 0);
const _emit = {};
const SPIKE_COUNT = 14;
const TRAIL_CRYSTALS = 22;
const TAU = Math.PI * 2;

const WALL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vPos = position;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WALL_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uLife;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    float n = fbm3(vec3(vUv * 7.5, uTime * 0.45));
    float crest = pow(max(0.0, 1.0 - abs(vUv.y - 0.22 - n * 0.08) * 2.6), 1.5);
    float sheet = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
    float plates = smoothstep(0.38, 0.78, n);
    float fres = pow(max(0.0, 1.0 - abs(vN.z)), 1.8);
    vec3 col = mix(uColorB, uColorA, plates);
    col += uColorA * (crest * 0.8 + fres * 0.55);
    float alpha = (sheet * 0.55 + crest * 0.85 + plates * 0.28) * uOpacity * (1.0 - uLife);
    gl_FragColor = vec4(col * uIntensity, clamp(alpha, 0.0, 1.0));
  }
`;

const PLATE_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uLife;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float n = fbm3(vec3(p * 4.2, uTime * 0.3));
    float ring = smoothstep(0.18, 0.0, abs(r - 0.82 - n * 0.04));
    float fill = (1.0 - smoothstep(0.55, 1.0, r)) * (0.22 + n * 0.2);
    float plates = smoothstep(0.45, 0.85, n) * (1.0 - smoothstep(0.7, 1.0, r));
    vec3 col = mix(uColorB, uColorA, plates + ring);
    float alpha = (fill + ring * 0.9 + plates * 0.35) * uOpacity * (1.0 - uLife * 0.7);
    gl_FragColor = vec4(col * uIntensity, clamp(alpha, 0.0, 1.0));
  }
`;

const SPIKE_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uLife;
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    float n = fbm3(vPos * 4.0 + vec3(0.0, uTime * 0.8, 0.0));
    float fres = pow(max(0.0, 1.0 - abs(vN.z)), 2.0);
    vec3 col = mix(uColorB, uColorA, n * 0.5 + fres);
    float alpha = (0.45 + fres * 0.55) * uOpacity * (1.0 - uLife);
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

const TRAIL_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uLife;
  uniform float uTime;
  uniform float uFront;
  varying vec3 vPos;
  varying vec2 vUv;
  void main() {
    vec2 cell = voronoi2(vec2(vPos.x * 7.0, vPos.z * 5.5 + uTime * 0.15));
    float plates = smoothstep(0.22, 0.02, cell.x);
    float n = fbm3(vec3(vPos.x * 4.0, uTime * 0.6, vPos.z * 3.0));
    float edge = pow(max(0.0, 1.0 - abs(vPos.x) * 2.0), 1.45);
    float run = smoothstep(0.0, 0.06, vPos.z) * (1.0 - smoothstep(0.86, 1.0, vPos.z));
    float crawl = smoothstep(uFront - 0.22, uFront, vPos.z);
    float frost = plates * 0.7 + n * 0.35;
    vec3 col = mix(uColorB, uColorA, frost);
    col += uColorA * plates * 0.55;
    float alpha = edge * run * crawl * (0.4 + frost * 0.7) * uOpacity * (1.0 - uLife);
    gl_FragColor = vec4(col * uIntensity, clamp(alpha, 0.0, 1.0));
  }
`;

const LANCE_VERT = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    float n = fbm3(position * 3.2 + vec3(0.0, uTime * 1.4, 0.0));
    vec3 p = position * (1.0 + n * 0.08);
    vPos = p;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const LANCE_FRAG = /* glsl */ `
  ${commonGLSL}
  ${noiseGLSL}
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    float n = fbm3(vPos * 4.5 - vec3(0.0, uTime * 2.2, 0.0));
    float fres = pow(max(0.0, 1.0 - abs(vN.z)), 1.7);
    vec2 cell = voronoi2(vN.xy * 5.0 + vN.z);
    float facet = smoothstep(0.18, 0.0, cell.x);
    vec3 col = mix(uColorB, uColorA, n * 0.45 + facet);
    col += uColorA * fres * 1.1;
    float alpha = (0.55 + fres * 0.5 + facet * 0.25) * uOpacity;
    gl_FragColor = vec4(col * uIntensity, clamp(alpha, 0.0, 1.0));
  }
`;

/**
 * ICE NOVA — freeze AOE (far / zone cast).
 *
 * A crystalline lance races the aimed line, freezing a frost ribbon and
 * planting icicles as it goes, then detonates into a freeze wall at the
 * footprint. Catalog id: `staff_ice_nova`.
 */
export class IceNovaAbility extends Ability {
  constructor(context) {
    super('iceNova', context);
    this._mist = new RateEmitter(70);
    this._trail = new RateEmitter(90);
    this._chips = new RateEmitter(50);
    this._lastCrystal = 0;
    this._lastFrost = 0;
    this._crystalCount = 0;
  }

  get impactDuration() {
    return this.config.impactTime;
  }

  get fadeDuration() {
    return this.config.fadeTime;
  }

  createShaders() {
    const wallGeo = new CylinderGeometry(1, 1, 1, 72, 1, true);
    wallGeo.translate(0, 0.5, 0);
    this.wallMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(0.9, 0.98, 1) },
        uColorB: { value: new Color(0.22, 0.55, 0.92) },
        uIntensity: { value: 1.6 },
        uOpacity: { value: 1 },
        uLife: { value: 0 }
      }),
      vertexShader: WALL_VERT,
      fragmentShader: WALL_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.wall = new Mesh(wallGeo, this.wallMat);
    this.wall.layers.set(LAYER.VFX);
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 18;
    this.group.add(this.wall);

    const plateGeo = new CircleGeometry(1, 64);
    plateGeo.rotateX(-Math.PI * 0.5);
    this.plateMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(0.92, 0.98, 1) },
        uColorB: { value: new Color(0.28, 0.62, 0.95) },
        uIntensity: { value: 1.3 },
        uOpacity: { value: 1 },
        uLife: { value: 0 }
      }),
      vertexShader: WALL_VERT,
      fragmentShader: PLATE_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.plate = new Mesh(plateGeo, this.plateMat);
    this.plate.layers.set(LAYER.VFX);
    this.plate.frustumCulled = false;
    this.plate.renderOrder = 16;
    this.group.add(this.plate);

    const ribbonGeo = new BoxGeometry(1, 1, 1, 1, 1, 10);
    ribbonGeo.translate(0, 0.5, 0.5);
    this.ribbonMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(0.94, 0.99, 1) },
        uColorB: { value: new Color(0.3, 0.66, 0.95) },
        uIntensity: { value: 1.8 },
        uOpacity: { value: 1 },
        uLife: { value: 0 },
        uFront: { value: 1 }
      }),
      vertexShader: WALL_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.ribbon = new Mesh(ribbonGeo, this.ribbonMat);
    this.ribbon.layers.set(LAYER.VFX);
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 17;
    this.group.add(this.ribbon);

    const lanceGeo = new ConeGeometry(0.22, 1, 6);
    lanceGeo.translate(0, 0.5, 0);
    lanceGeo.rotateX(Math.PI * 0.5);
    this.lanceMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(1, 1, 1) },
        uColorB: { value: new Color(0.4, 0.76, 1) },
        uIntensity: { value: 2.4 },
        uOpacity: { value: 1 }
      }),
      vertexShader: LANCE_VERT,
      fragmentShader: LANCE_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.lance = new Mesh(lanceGeo, this.lanceMat);
    this.lance.layers.set(LAYER.VFX);
    this.lance.frustumCulled = false;
    this.lance.renderOrder = 24;
    this.group.add(this.lance);

    const haloGeo = new IcosahedronGeometry(1, 1);
    this.haloMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(0.85, 0.96, 1) },
        uColorB: { value: new Color(0.35, 0.7, 1) },
        uIntensity: { value: 1.5 },
        uOpacity: { value: 1 }
      }),
      vertexShader: LANCE_VERT,
      fragmentShader: LANCE_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.halo = new Mesh(haloGeo, this.haloMat);
    this.halo.layers.set(LAYER.VFX);
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 23;
    this.group.add(this.halo);

    const spikeGeo = new ConeGeometry(0.18, 1, 5);
    spikeGeo.translate(0, 0.5, 0);
    this.spikeMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(0.95, 0.99, 1) },
        uColorB: { value: new Color(0.35, 0.7, 0.98) },
        uIntensity: { value: 1.7 },
        uOpacity: { value: 1 },
        uLife: { value: 0 }
      }),
      vertexShader: WALL_VERT,
      fragmentShader: SPIKE_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.spikes = new Group();
    this.spikeMeshes = [];
    for (let i = 0; i < SPIKE_COUNT; i++) {
      const mesh = new Mesh(spikeGeo, this.spikeMat);
      mesh.layers.set(LAYER.VFX);
      mesh.frustumCulled = false;
      mesh.renderOrder = 19;
      this.spikes.add(mesh);
      this.spikeMeshes.push(mesh);
    }
    this.group.add(this.spikes);

    const trailGeo = new ConeGeometry(0.14, 1, 5);
    trailGeo.translate(0, 0.5, 0);
    this.trailCrystalMat = new ShaderMaterial({
      uniforms: sharedUniforms({
        uColorA: { value: new Color(0.96, 0.99, 1) },
        uColorB: { value: new Color(0.4, 0.74, 1) },
        uIntensity: { value: 1.6 },
        uOpacity: { value: 1 },
        uLife: { value: 0 }
      }),
      vertexShader: WALL_VERT,
      fragmentShader: SPIKE_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    this.trailCrystals = [];
    for (let i = 0; i < TRAIL_CRYSTALS; i++) {
      const mesh = new Mesh(trailGeo, this.trailCrystalMat);
      mesh.layers.set(LAYER.VFX);
      mesh.frustumCulled = false;
      mesh.renderOrder = 20;
      mesh.visible = false;
      mesh.userData.spawnFront = 0;
      mesh.userData.side = i % 2 === 0 ? 1 : -1;
      mesh.userData.lean = 0.15 + (i % 5) * 0.05;
      mesh.userData.height = 0.35 + (i % 4) * 0.12;
      this.group.add(mesh);
      this.trailCrystals.push(mesh);
    }
  }

  createParticles() {
    this.mist = this.ctx.particles.get('ice-nova-mist', {
      capacity: 1000,
      shape: ParticleShape.SMOKE,
      additive: true,
      curl: true
    });
    this.shards = this.ctx.particles.get('ice-nova-shards', {
      capacity: 600,
      shape: ParticleShape.CHIP,
      additive: true,
      lit: true
    });
    this.rings = this.ctx.particles.get('ice-nova-rings', {
      capacity: 80,
      shape: ParticleShape.RING,
      additive: true
    });
    this.trail = this.ctx.particles.get('ice-nova-trail', {
      capacity: 1100,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.chips = this.ctx.particles.get('ice-nova-chips', {
      capacity: 500,
      shape: ParticleShape.CHIP,
      additive: true,
      lit: true
    });
    this.mist.setGradient(getColor('#e8f8ff'), getColor('#9ad8ff'), getColor('#3e8fd0'), getColor('#0a2038'));
    this.shards.setGradient(getColor('#ffffff'), getColor('#c8f0ff'), getColor('#5ab0e8'), getColor('#123048'));
    this.rings.setGradient(getColor('#f4ffff'), getColor('#7fd8ff'), getColor('#2a78c8'), getColor('#081828'));
    this.trail.setGradient(getColor('#ffffff'), getColor('#c8ecff'), getColor('#5aa8e0'), getColor('#123048'));
    this.chips.setGradient(getColor('#f4ffff'), getColor('#b8e0ff'), getColor('#4a90d0'), getColor('#0c2038'));
    this.mist.uniforms.uGravity.value.set(0, 0.28, 0);
    this.trail.uniforms.uGravity.value.set(0, -1.6, 0);
    this.chips.uniforms.uGravity.value.set(0, -7.5, 0);
    this.shards.uniforms.uGravity.value.set(0, -5.5, 0);
  }

  _placeSpikes(radius, height, visible) {
    this.pointAt(1, _target);
    _target.y = 0;
    this.spikes.position.copy(_target);
    this.spikes.visible = visible;
    const lean = 0.22;
    for (let i = 0; i < this.spikeMeshes.length; i++) {
      const mesh = this.spikeMeshes[i];
      const a = (i / SPIKE_COUNT) * TAU;
      const r = radius * (0.72 + (i % 3) * 0.08);
      mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      mesh.rotation.set(lean, -a, 0);
      const h = height * (0.55 + (i % 4) * 0.18);
      mesh.scale.set(0.55 + (i % 3) * 0.18, Math.max(0.05, h), 0.55 + (i % 3) * 0.18);
      mesh.visible = visible && h > 0.08;
    }
  }

  _growTrailCrystals(c) {
    const grow = Math.max(0.12, c.crystalGrow ?? 0.35);
    for (let i = 0; i < this._crystalCount; i++) {
      const mesh = this.trailCrystals[i];
      const age = this.front - mesh.userData.spawnFront;
      const k = saturate(age / grow);
      const risen = Easing.outCubic(k);
      const h = mesh.userData.height * risen * (c.crystalHeight ?? 0.55);
      mesh.scale.set(0.45 + (i % 3) * 0.12, Math.max(0.04, h), 0.45 + (i % 3) * 0.12);
      mesh.visible = h > 0.05;
    }
  }

  onSpawn() {
    this._mist._accumulator = 0;
    this._trail._accumulator = 0;
    this._chips._accumulator = 0;
    this._lastCrystal = 0;
    this._lastFrost = 0;
    this._crystalCount = 0;
    const c = this.config;
    this.lance.visible = true;
    this.halo.visible = true;
    this.ribbon.visible = true;
    this.wall.visible = true;
    this.plate.visible = true;
    this.spikes.visible = false;
    this.lance.scale.set(0.2, 0.2, 0.4);
    this.halo.scale.setScalar(0.2);
    this.ribbon.scale.set(0.2, 0.1, 0.2);
    this.wall.scale.set(0.15, 0.05, 0.15);
    this.plate.scale.set(0.2, 1, 0.2);
    for (const mesh of this.trailCrystals) mesh.visible = false;
    for (const mat of [
      this.wallMat,
      this.plateMat,
      this.lanceMat,
      this.haloMat,
      this.spikeMat,
      this.ribbonMat,
      this.trailCrystalMat
    ]) {
      mat.uniforms.uColorA.value.copy(getColor(c.colorCore));
      mat.uniforms.uColorB.value.copy(getColor(c.colorEdge));
      if (mat.uniforms.uLife) mat.uniforms.uLife.value = 0;
      mat.uniforms.uOpacity.value = 1;
    }
  }

  onTravel(dt) {
    const c = this.config;
    const g = settings.global;
    const len = Math.max(0.4, this.front);

    this.ribbon.position.copy(this.origin);
    this.ribbon.position.y = 0.06;
    this.ribbon.quaternion.setFromUnitVectors(_fwd, this.direction);
    this.ribbon.scale.set(c.trailWidth ?? 0.58, c.trailHeight ?? 0.38, len);
    this.ribbon.updateMatrix();
    this.ribbonMat.uniforms.uFront.value = 1;
    this.ribbonMat.uniforms.uIntensity.value = c.glow * g.glow * 1.7;
    this.ribbonMat.uniforms.uOpacity.value = 0.85 + this.u * 0.15;

    this.pointAt(this.u, _pos);
    _pos.y = c.lanceHeight ?? 0.48;
    this.lance.position.copy(_pos);
    this.lance.quaternion.setFromUnitVectors(_fwd, this.direction);
    const pulse = 1 + 0.08 * Math.sin(this.age * 28);
    this.lance.scale.set(
      (c.lanceRadius ?? 0.16) * pulse,
      (c.lanceRadius ?? 0.16) * pulse,
      (c.lanceLength ?? 0.95) * pulse
    );
    this.lance.updateMatrix();
    this.halo.position.copy(_pos);
    this.halo.scale.setScalar((c.lanceRadius ?? 0.16) * 2.4 * pulse);
    this.halo.updateMatrix();
    this.lanceMat.uniforms.uIntensity.value = c.glow * g.glow * 2.5;
    this.haloMat.uniforms.uIntensity.value = c.glow * g.glow * 1.35;

    this.pointAt(1, _target);
    _target.y = 0.02;
    const telegraph = 0.15 + this.u * 0.22;
    this.plate.position.copy(_target);
    this.plate.scale.setScalar(c.zoneRadius * telegraph);
    this.plateMat.uniforms.uOpacity.value = 0.35 + this.u * 0.4;
    this.wall.position.copy(_target);
    this.wall.scale.set(c.zoneRadius * telegraph * 0.85, 0.12, c.zoneRadius * telegraph * 0.85);
    this.wallMat.uniforms.uOpacity.value = 0.25 + this.u * 0.2;

    const spacing = c.crystalSpacing ?? 0.65;
    while (
      this.front - this._lastCrystal > spacing &&
      this._crystalCount < TRAIL_CRYSTALS
    ) {
      this._lastCrystal += spacing;
      const mesh = this.trailCrystals[this._crystalCount];
      const along = saturate(this._lastCrystal / this.length);
      this.pointAt(along, _pos);
      const side = mesh.userData.side * (0.42 + (this._crystalCount % 3) * 0.14);
      _pos.addScaledVector(this.side, side);
      _pos.y = 0;
      mesh.position.copy(_pos);
      mesh.rotation.set(mesh.userData.lean, Math.random() * TAU, 0);
      mesh.userData.spawnFront = this._lastCrystal;
      mesh.scale.set(0.2, 0.04, 0.2);
      mesh.visible = true;
      this._crystalCount++;
    }
    this._growTrailCrystals(c);

    if (this.front - this._lastFrost > (c.frostSpacing ?? 1.05)) {
      this._lastFrost = this.front;
      this.pointAt(this.u, _pos);
      _pos.y = 0.02;
      this.ctx.decals.spawn(DecalType.FROST, _pos, {
        radius: c.trailFrost ?? 0.7,
        life: c.frostLife * 0.55,
        intensity: 0.7,
        colorA: getColor(c.colorFrost)
      });
    }

    _dir.copy(this.direction).multiplyScalar(-1);
    _dir.y = 0.12;
    this.pointAt(this.u, _pos);
    _pos.y = c.lanceHeight ?? 0.48;
    const streaks = this._trail.tick(dt, c.trailRate ?? 170);
    if (streaks > 0) {
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = c.trailSpeed ?? 2.4;
      _emit.spread = 0.28;
      _emit.radius = 0.12;
      _emit.size = (c.trailSize ?? 0.09) * g.particleSize;
      _emit.life = 0.5 * g.particleLifetime;
      _emit.time = this.age;
      this.trail.emit(streaks, _emit);
    }
    const chips = this._chips.tick(dt, c.chipRate ?? 55);
    if (chips > 0) {
      _emit.position = _pos;
      _emit.direction = _up;
      _emit.speed = 1.8;
      _emit.spread = 0.85;
      _emit.radius = 0.18;
      _emit.size = 0.07;
      _emit.life = 0.7;
      _emit.time = this.age;
      this.chips.emit(chips, _emit);
    }
    const mistN = this._mist.tick(dt, c.mistRate * 0.7);
    if (mistN > 0) {
      _emit.position = _pos;
      _emit.direction = _up;
      _emit.speed = 0.35;
      _emit.spread = 0.6;
      _emit.radius = 0.22;
      _emit.size = c.mistSize * 0.6;
      _emit.life = 0.85;
      _emit.time = this.age;
      this.mist.emit(mistN, _emit);
    }

    this.lightColor.copy(getColor(c.colorCore));
    this.position.y = c.lanceHeight ?? 0.48;
  }

  onImpact() {
    const c = this.config;
    this.pointAt(1, _pos);
    _pos.y = 0.15;
    this.lance.visible = false;
    this.halo.visible = false;
    this.ctx.bursts.spawn(BurstMode.FROST, _pos, {
      radius: 0.55,
      endRadius: c.zoneRadius * 1.05,
      life: 0.95,
      intensity: 1.25,
      fresnel: 1.4,
      squash: 0.72,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorEdge),
      colorC: getColor('#ffffff')
    });
    this.ctx.decals.spawn(DecalType.FROST, _pos, {
      radius: c.zoneRadius * 1.05,
      life: c.frostLife,
      intensity: 1.25,
      growth: 1.6,
      colorA: getColor(c.colorFrost)
    });
    this.ctx.decals.spawn(DecalType.SHOCKWAVE, _pos, {
      radius: c.zoneRadius * 1.25,
      life: 0.6,
      growth: 2.8,
      colorA: getColor(c.colorCore)
    });
    this.ctx.shake.add(c.shake * settings.global.cameraShake, 1.9, 18);
    this.ctx.flash.trigger(getColor(c.colorCore), c.flash);

    _emit.position = _pos;
    _emit.direction = _up;
    _emit.speed = 7.5;
    _emit.spread = 1;
    _emit.radius = c.zoneRadius * 0.45;
    _emit.size = 0.14;
    _emit.life = 0.9;
    _emit.time = this.age;
    this.shards.emit(56, _emit);
    _emit.size = c.zoneRadius * 0.85;
    _emit.life = 0.75;
    _emit.speed = 0.25;
    this.rings.emit(4, _emit);
    this.lightBoost = 3.4;
    this._placeSpikes(c.zoneRadius * 0.4, 0.2, true);
  }

  onFade(dt, t) {
    const c = this.config;
    const expand = Easing.outCubic(saturate(t));
    const melt = saturate(t - 1);
    this.pointAt(1, _pos);
    _pos.y = 0.02;
    const r = c.zoneRadius * (0.28 + expand * 0.72);
    const h = c.wallHeight * (0.35 + expand * 0.65) * (1 - melt * 0.85);
    this.wall.position.copy(_pos);
    this.wall.scale.set(r, Math.max(0.08, h), r);
    this.wall.updateMatrix();
    this.plate.position.copy(_pos);
    this.plate.scale.setScalar(r * (1.02 + melt * 0.08));
    this.plate.updateMatrix();

    this.wallMat.uniforms.uLife.value = melt;
    this.plateMat.uniforms.uLife.value = melt;
    this.spikeMat.uniforms.uLife.value = melt;
    this.trailCrystalMat.uniforms.uLife.value = melt;
    this.ribbonMat.uniforms.uLife.value = melt;
    this.wallMat.uniforms.uOpacity.value = 1 - melt * 0.75;
    this.plateMat.uniforms.uOpacity.value = 0.9 - melt * 0.7;
    this.spikeMat.uniforms.uOpacity.value = 1 - melt;
    this.ribbonMat.uniforms.uOpacity.value = 0.85 * (1 - melt);
    this.trailCrystalMat.uniforms.uOpacity.value = 1 - melt;
    const glow = c.glow * settings.global.glow * (1.25 - melt * 0.7);
    this.wallMat.uniforms.uIntensity.value = glow;
    this.plateMat.uniforms.uIntensity.value = glow * 0.85;
    this.spikeMat.uniforms.uIntensity.value = glow * 1.1;
    this.ribbonMat.uniforms.uIntensity.value = glow * 1.2;

    this._placeSpikes(r * 0.92, h * 0.85 * (1 - melt), true);
    this._growTrailCrystals(c);
    for (const mesh of this.trailCrystals) {
      if (!mesh.visible) continue;
      mesh.scale.y *= 1 - melt * 0.08;
    }

    const n = this._mist.tick(dt, c.mistRate * (1.1 - melt));
    if (n > 0) {
      _emit.position = _pos;
      _emit.direction = _up;
      _emit.speed = 0.55;
      _emit.spread = 1;
      _emit.radius = r * 0.75;
      _emit.size = c.mistSize;
      _emit.life = 1.05;
      _emit.time = this.age;
      this.mist.emit(n, _emit);
    }

    this.position.copy(_pos);
    this.position.y = Math.max(0.4, h * 0.45);
  }

  onDestroy() {
    this.wall.visible = false;
    this.plate.visible = false;
    this.lance.visible = false;
    this.halo.visible = false;
    this.ribbon.visible = false;
    this.spikes.visible = false;
    for (const mesh of this.trailCrystals) mesh.visible = false;
  }
}
