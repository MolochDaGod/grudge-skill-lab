// @ts-nocheck
/**
 * Wind ribbons + mist volume shared by heal bolts, totem flow, and scripts.
 *
 * Green air STREAK (same tongue family as fire-bending, retinted) plus a
 * Normal-blended mist and a few leaves. Heal palette adds pale glints.
 */
import { Vector3, Color } from 'three';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { getColor } from '../utils/color.js';

export const WIND_PALETTES = {
  green: {
    hot: '#f2ffe4',
    mid: '#7ef08a',
    deep: '#2fbe62',
    mist: '#c8f4d4',
    glint: '#eaffc8',
    dark: '#07180c'
  },
  heal: {
    hot: '#fffce8',
    mid: '#c8f8d4',
    deep: '#7ee0a0',
    mist: '#e8fff2',
    glint: '#fff6c0',
    dark: '#142418'
  },
  water: {
    hot: '#e8fbff',
    mid: '#8ef4ff',
    deep: '#3fd8ff',
    mist: '#d4f6ff',
    glint: '#ffffff',
    dark: '#041428'
  }
};

const _emit = {};
const _dir = new Vector3();
const _from = new Vector3();
const _to = new Vector3();
const _tint = new Color();

export class WindMist {
  /**
   * @param {import('../particles/ParticleEngine.js').ParticleEngine} particles
   */
  constructor(particles) {
    this.particles = particles;
    this.paletteId = 'green';
    this.windAcc = new RateEmitter(90);
    this.mistAcc = new RateEmitter(42);
    this.leafAcc = new RateEmitter(6);
    this.glintAcc = new RateEmitter(16);
    this._ready = false;
  }

  get wind() {
    return this.particles.get('wind-streak', {
      name: 'wind-streak',
      capacity: 2200,
      shape: ParticleShape.STREAK,
      additive: true,
      curl: true,
      stretch: true
    });
  }

  get mist() {
    return this.particles.get('wind-mist', {
      name: 'wind-mist',
      capacity: 1600,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true
    });
  }

  get leaves() {
    return this.particles.get('wind-leaf', {
      name: 'wind-leaf',
      capacity: 480,
      shape: ParticleShape.LEAF,
      additive: false,
      curl: true,
      lit: true
    });
  }

  get glint() {
    return this.particles.get('heal-glint', {
      name: 'heal-glint',
      capacity: 900,
      shape: ParticleShape.SOFT,
      additive: true,
      curl: true
    });
  }

  palette() {
    return WIND_PALETTES[this.paletteId] || WIND_PALETTES.green;
  }

  setPalette(id) {
    if (WIND_PALETTES[id]) this.paletteId = id;
    this._paint();
  }

  _ensure() {
    if (this._ready) return;
    this._ready = true;
    const wind = this.wind;
    wind.uniforms.uGravity.value.set(0, 0.35, 0);
    wind.uniforms.uDrag.value = 0.88;
    wind.uniforms.uTurbulence.value = 1.15;
    wind.uniforms.uTurbFrequency.value = 0.55;
    wind.uniforms.uStretch.value = 0.42;
    wind.uniforms.uEndSize.value = 0.15;
    wind.uniforms.uFadeOut.value = 0.62;

    const mist = this.mist;
    mist.uniforms.uGravity.value.set(0, 0.22, 0);
    mist.uniforms.uDrag.value = 0.96;
    mist.uniforms.uTurbulence.value = 0.85;
    mist.uniforms.uOpacity.value = 0.72;
    mist.uniforms.uEndSize.value = 1.6;
    mist.uniforms.uFadeOut.value = 0.7;

    const leaves = this.leaves;
    leaves.uniforms.uGravity.value.set(0, -0.55, 0);
    leaves.uniforms.uDrag.value = 0.82;
    leaves.uniforms.uTurbulence.value = 1.4;
    leaves.uniforms.uEndSize.value = 0.7;

    const glint = this.glint;
    glint.uniforms.uGravity.value.set(0, 0.8, 0);
    glint.uniforms.uDrag.value = 0.9;
    glint.uniforms.uTurbulence.value = 0.4;
    glint.uniforms.uEndSize.value = 0.2;
    this._paint();
  }

  _paint() {
    const p = this.palette();
    this.wind.setGradient(getColor(p.hot), getColor(p.mid), getColor(p.deep), getColor(p.dark));
    this.mist.setGradient(getColor(p.mist), getColor(p.mid), getColor(p.deep), getColor(p.dark));
    this.leaves.setGradient(getColor(p.mid), getColor(p.deep), getColor(p.mist), getColor(p.dark));
    this.glint.setGradient(getColor(p.glint), getColor(p.hot), getColor(p.mid), getColor(p.mist));
  }

  emitWind(position, direction, count, opts = {}) {
    if (count <= 0) return;
    this._ensure();
    const paint = WIND_PALETTES[opts.palette] || this.palette();
    _tint.set(paint.mid);
    _dir.copy(direction);
    if (_dir.lengthSq() < 1e-8) _dir.set(0, 0.2, 1);
    _dir.normalize();
    _emit.position = position;
    _emit.direction = _dir;
    _emit.speed = opts.speed ?? 3.4;
    _emit.speedVariance = 0.45;
    _emit.spread = opts.spread ?? 0.28;
    _emit.radius = opts.radius ?? 0.08;
    _emit.size = opts.size ?? 0.11;
    _emit.life = opts.life ?? 0.55;
    _emit.lifeVariance = 0.3;
    _emit.time = opts.time ?? 0;
    _emit.tint = _tint;
    this.wind.emit(count, _emit);
  }

  emitMist(position, count, opts = {}) {
    if (count <= 0) return;
    this._ensure();
    const paint = WIND_PALETTES[opts.palette] || this.palette();
    _tint.set(paint.mist);
    _dir.set(0, 1, 0);
    _emit.position = position;
    _emit.direction = _dir;
    _emit.speed = opts.speed ?? 0.55;
    _emit.spread = opts.spread ?? 0.85;
    _emit.radius = opts.radius ?? 0.18;
    _emit.size = opts.size ?? 0.42;
    _emit.life = opts.life ?? 1.35;
    _emit.time = opts.time ?? 0;
    _emit.tint = _tint;
    this.mist.emit(count, _emit);
  }

  emitHeal(position, count, opts = {}) {
    this._ensure();
    this.setPalette(opts.palette || 'heal');
    this.emitMist(position, Math.max(1, Math.round(count * 0.45)), {
      ...opts,
      size: (opts.size ?? 0.42) * 1.15,
      life: 1.6
    });
    _dir.set(0, 1, 0);
    _emit.position = position;
    _emit.direction = _dir;
    _emit.speed = 1.1;
    _emit.spread = 0.7;
    _emit.radius = opts.radius ?? 0.12;
    _emit.size = 0.07;
    _emit.life = 0.8;
    _emit.time = opts.time ?? 0;
    this.glint.emit(count, _emit);
  }

  /**
   * Ribbon of air from `from` toward `to` — totem crowns, heal bolts, scripts.
   */
  flow(from, to, dt, opts = {}) {
    this._ensure();
    _from.copy(from);
    _from.y += opts.height ?? 0;
    _to.copy(to);
    _to.y += opts.targetHeight ?? 1.1;
    _dir.subVectors(_to, _from);
    const span = _dir.length();
    if (span < 0.05) return;
    _dir.multiplyScalar(1 / span);

    const windN = this.windAcc.tick(dt, opts.windRate ?? 70);
    if (windN) {
      this.emitWind(_from, _dir, windN, {
        speed: Math.min(6.5, 2.2 + span * 0.35),
        size: 0.13,
        life: Math.min(1.8, 0.4 + span * 0.08),
        radius: 0.12,
        spread: 0.22,
        time: opts.time ?? 0,
        palette: opts.palette
      });
    }
    const mistN = this.mistAcc.tick(dt, opts.mistRate ?? 28);
    if (mistN) this.emitMist(_from, mistN, { radius: 0.22, size: 0.38, time: opts.time ?? 0, palette: opts.palette });
    const leafN = this.leafAcc.tick(dt, opts.leafRate ?? 4);
    if (leafN) {
      _emit.position = _from;
      _emit.direction = _dir;
      _emit.speed = 1.6;
      _emit.spread = 0.55;
      _emit.radius = 0.2;
      _emit.size = 0.09;
      _emit.life = 1.6;
      _emit.time = opts.time ?? 0;
      this.leaves.emit(leafN, _emit);
    }
    if (opts.palette === 'heal' || this.paletteId === 'heal') {
      const g = this.glintAcc.tick(dt, opts.glintRate ?? 10);
      if (g) this.emitHeal(_from, g, { time: opts.time ?? 0, palette: 'heal' });
    }
  }
}
