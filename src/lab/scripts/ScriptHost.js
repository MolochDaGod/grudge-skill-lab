// @ts-nocheck
/**
 * three.js editor player, adapted to this lab.
 *
 * Compiles object scripts exactly as `editor/js/libs/app.js`:
 *   new Function('player,renderer,scene,camera,init,start,...', source + '\\nreturn {init,start,...}')
 *   .bind(object)(player, renderer, scene, camera)
 *
 * Lifecycle: init (on compile) → start (play) → update({time,delta} ms) → stop.
 * Pointer/key events match the Editor Manual set.
 */

import { SCRIPT_EVENTS, listScripts } from './scriptDocument.js';

const WRAP_PARAMS = `player,renderer,scene,camera,${SCRIPT_EVENTS.join(',')}`;
const WRAP_RESULT = `{${SCRIPT_EVENTS.map((name) => `${name}:${name}`).join(',')}}`;

export class ScriptHost {
  /**
   * @param {object} app  the lab App (player)
   */
  constructor(app) {
    this.app = app;
    this.player = {
      app,
      renderer: app.renderer?.gl ?? app.renderer,
      get scene() {
        return app.scene;
      },
      get camera() {
        return app.camera;
      },
      settings: null,
      fx: {
        palette: (id) => app.wind?.setPalette(id),
        wind: (pos, dir, count, opts) => app.wind?.emitWind(pos, dir, count, opts),
        mist: (pos, count, opts) => app.wind?.emitMist(pos, count, opts),
        heal: (pos, count, opts) => app.wind?.emitHeal(pos, count, opts),
        flow: (from, to, dt, opts) => app.wind?.flow(from, to, dt, opts)
      }
    };
    this.events = emptyEvents();
    this.errors = [];
    this._started = false;
    this._startTime = 0;
    this._prevTime = 0;
    this._bound = {
      keydown: (event) => this.dispatch('keydown', event),
      keyup: (event) => this.dispatch('keyup', event),
      pointerdown: (event) => this.dispatch('pointerdown', event),
      pointerup: (event) => this.dispatch('pointerup', event),
      pointermove: (event) => this.dispatch('pointermove', event)
    };
  }

  resolve(key) {
    const app = this.app;
    if (key === 'scene') return app.scene;
    if (key === 'camera') return app.camera;
    if (key === 'character') return app.character?.root ?? app.character;
    if (key?.startsWith('totem:')) {
      const id = key.slice(6);
      const row = app.world?.totems?.find((t) => t.id === id || t.id === `${id}Totem` || t.id.startsWith(id));
      return row?.root ?? null;
    }
    if (key?.startsWith('ability:')) {
      return app.abilities?.anchor?.(key.slice('ability:'.length)) ?? null;
    }
    return app.scene?.getObjectByProperty?.('uuid', key, true) ?? null;
  }

  compile() {
    const wasStarted = this._started;
    if (wasStarted) this.stop();
    this.events = emptyEvents();
    this.errors = [];
    this.player.settings = this.app.editor?.presets?.current ?? null;

    const renderer = this.app.renderer?.gl ?? this.app.renderer;
    const scene = this.app.scene;
    const camera = this.app.camera;

    for (const record of listScripts()) {
      if (!record.enabled) continue;
      const object = this.resolve(record.key);
      if (!object) {
        this.errors.push({ id: record.id, name: record.name, message: `No object for "${record.key}"` });
        continue;
      }
      try {
        const compile = new Function(WRAP_PARAMS, `${record.source}\nreturn ${WRAP_RESULT};`);
        const functions = compile.bind(object)(this.player, renderer, scene, camera);
        for (const name of SCRIPT_EVENTS) {
          const fn = functions?.[name];
          if (typeof fn !== 'function') continue;
          this.events[name].push({ id: record.id, name: record.name, fn: fn.bind(object) });
        }
      } catch (error) {
        const message = error?.message || String(error);
        this.errors.push({ id: record.id, name: record.name, message });
        console.error(`[ScriptHost] ${record.name}:`, error);
      }
    }

    this.dispatch('init', {});
    if (wasStarted) this.start();
    return this.errors;
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._startTime = this._prevTime = performance.now();
    const canvas = this.app.canvas;
    window.addEventListener('keydown', this._bound.keydown);
    window.addEventListener('keyup', this._bound.keyup);
    canvas?.addEventListener('pointerdown', this._bound.pointerdown);
    canvas?.addEventListener('pointerup', this._bound.pointerup);
    canvas?.addEventListener('pointermove', this._bound.pointermove);
    this.dispatch('start', {});
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    const canvas = this.app.canvas;
    window.removeEventListener('keydown', this._bound.keydown);
    window.removeEventListener('keyup', this._bound.keyup);
    canvas?.removeEventListener('pointerdown', this._bound.pointerdown);
    canvas?.removeEventListener('pointerup', this._bound.pointerup);
    canvas?.removeEventListener('pointermove', this._bound.pointermove);
    this.dispatch('stop', {});
  }

  update() {
    if (!this._started) return;
    const time = performance.now();
    try {
      this.dispatch('update', { time: time - this._startTime, delta: time - this._prevTime });
    } catch (error) {
      console.error('[ScriptHost] update', error);
    }
    this._prevTime = time;
  }

  dispatch(type, event) {
    const list = this.events[type];
    if (!list?.length) return;
    for (let i = 0, n = list.length; i < n; i++) {
      try {
        list[i].fn(event);
      } catch (error) {
        console.error(`[ScriptHost] ${type} (${list[i].name}):`, error);
      }
    }
  }

  dispose() {
    this.stop();
    this.events = emptyEvents();
  }
}

function emptyEvents() {
  const events = {};
  for (const name of SCRIPT_EVENTS) events[name] = [];
  return events;
}
