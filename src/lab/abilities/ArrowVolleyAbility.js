// @ts-nocheck
import { Vector3 } from 'three';
import { Ability } from './Ability.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { DecalType } from '../effects/GroundDecals.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate } from '../utils/math.js';
import { frame } from '../core/FrameUniforms.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _impact = new Vector3();
const _up = new Vector3(0, 1, 0);
const _emit = {};

/**
 * Arrow Volley — rain of arrows on a ground circle. The old hotkey-6 volley.
 * Catalog: t0_bow_volley.
 */
export class ArrowVolleyAbility extends Ability {
  constructor(context) {
    super('volley', context);
    this._rain = new RateEmitter(90);
    this._dust = new RateEmitter(40);
  }

  get impactDuration() {
    return this.config.lifetime ?? 1.15;
  }

  get fadeDuration() {
    return this.config.fadeTime ?? 0.4;
  }

  createShaders() {}

  createParticles() {
    this.arrows = this.ctx.particles.get('arrow-volley', {
      capacity: 1800,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true
    });
    this.hits = this.ctx.particles.get('arrow-volley-hit', {
      capacity: 900,
      shape: ParticleShape.SOFT,
      additive: true
    });
    this.dust = this.ctx.particles.get('arrow-volley-dust', {
      capacity: 600,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true
    });
    this.arrows.setGradient(getColor('#fff4d0'), getColor('#c8a05a'), getColor('#6a4a22'), getColor('#1a1208'));
    this.hits.setGradient(getColor('#ffe8a0'), getColor('#d09040'), getColor('#6a3010'), getColor('#1a0c04'));
    this.dust.setGradient(getColor('#c8b080'), getColor('#6a5840'), getColor('#2a2418'), getColor('#0a0804'));
  }

  onSpawn() {
    this._rain.reset();
    this._dust.reset();
    this.pointAt(1, _impact);
    _impact.y = 0.05;
    this.arrows.uniforms.uGravity.value.set(0, this.config.arrowGravity ?? -38, 0);
    this.hits.uniforms.uGravity.value.set(0, -6, 0);
    this.dust.uniforms.uGravity.value.set(0, 0.4, 0);
    this.ctx.flash.trigger(getColor(this.config.colorCore), 0.14);
    this.lightBoost = 1.1;
  }

  onTravel() {
    this.pointAt(this.u, this.position);
    this.position.y = 0.2;
    this.lightColor.copy(getColor(this.config.lightColor ?? this.config.colorCore));
  }

  _drop(dt, rateScale) {
    const c = this.config;
    this.pointAt(1, _impact);
    const radius = Math.max(0.6, c.zoneRadius ?? 3.4);
    const n = this._rain.tick(dt, (c.arrowRate ?? 85) * rateScale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      _pos.set(_impact.x + Math.cos(a) * r, c.skyHeight ?? 7.4, _impact.z + Math.sin(a) * r);
      _dir.set((Math.random() - 0.5) * 0.12, -1, (Math.random() - 0.5) * 0.12).normalize();
      _emit.position = _pos;
      _emit.direction = _dir;
      _emit.speed = c.arrowSpeed ?? 18;
      _emit.spread = 0.04;
      _emit.radius = 0;
      _emit.size = 0.16;
      _emit.life = 0.55;
      _emit.time = frame.uTime.value;
      this.arrows.emit(1, _emit);
    }
    const hits = this._dust.tick(dt, (c.hitRate ?? 28) * rateScale);
    if (hits > 0) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius * 0.9;
      _pos.set(_impact.x + Math.cos(a) * r, 0.08, _impact.z + Math.sin(a) * r);
      _emit.position = _pos;
      _emit.direction = _up;
      _emit.speed = 2.4;
      _emit.spread = 0.8;
      _emit.radius = 0.12;
      _emit.size = 0.09;
      _emit.life = 0.35;
      _emit.time = frame.uTime.value;
      this.hits.emit(hits, _emit);
      this.dust.emit(Math.max(1, (hits / 2) | 0), _emit);
    }
  }

  onImpact() {
    const c = this.config;
    this.pointAt(1, _impact);
    _impact.y = 0.12;
    this.ctx.bursts.spawn(BurstMode.EARTH, _impact, {
      radius: 0.4,
      endRadius: (c.zoneRadius ?? 3.4) * 0.7,
      life: 0.7,
      intensity: 1.05,
      displace: 0.25,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorEdge),
      colorC: getColor(c.colorScorch ?? '#2a1a0c')
    });
    this.ctx.decals.spawn(DecalType.SCORCH, _impact, {
      radius: (c.zoneRadius ?? 3.4) * 0.85,
      life: c.scorchLife ?? 2.6
    });
    this.ctx.shake.add((c.shake ?? 0.28) * settings.global.cameraShake, 2.4, 18);
    this.lightBoost = 1.6;
    this._drop(0.05, 2.4);
  }

  onFade(dt, t) {
    const falling = t < 1 ? 1 : 1 - saturate(t - 1);
    this._drop(dt, falling);
    this.pointAt(1, this.position);
    this.position.y = 0.4;
    this.lightColor.copy(getColor(this.config.lightColor ?? this.config.colorCore));
  }
}
