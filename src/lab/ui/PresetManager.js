// @ts-nocheck
import { settings, applySettings, snapshotSettings, DEFAULT_SETTINGS } from '../config/settings.js';
import { replaceScripts, snapshotScripts } from '../scripts/scriptDocument.js';
import { importLabPayload } from '../config/skillCatalog.js';

const STORAGE_KEY = 'grudge-lab.presets.v2';
const LAST_KEY = 'grudge-lab.lastPreset';
const SESSION_KEY = 'grudge-lab.session.v1';
const SESSION_BACKUP = 'grudge-lab.session.v1.bak';
const LEGACY_PRESETS = 'frost-sandbox.presets.v1';
const LEGACY_LAST = 'frost-sandbox.lastPreset';

/**
 * Preset + session persistence.
 *
 * A preset is `{ settings, scripts }` so VFX knobs and object scripts travel
 * together. Loading merges settings in place (shader bindings stay valid) and
 * replaces the script document, then the player recompiles.
 */
export class PresetManager {
  constructor() {
    this.presets = this._read();
  }

  _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn('[PresetManager] could not read presets', error);
    }
    try {
      const legacy = localStorage.getItem(LEGACY_PRESETS);
      if (!legacy) return {};
      const parsed = JSON.parse(legacy);
      const migrated = {};
      for (const [name, value] of Object.entries(parsed)) {
        migrated[name] = wrapPreset(value);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      console.warn('[PresetManager] legacy migrate failed', error);
      return {};
    }
  }

  _write() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets));
    } catch (error) {
      console.warn('[PresetManager] could not persist presets', error);
    }
  }

  get names() {
    return Object.keys(this.presets).sort();
  }

  has(name) {
    return Object.prototype.hasOwnProperty.call(this.presets, name);
  }

  capture() {
    return {
      version: 2,
      schema: 'grudge-lab-preset',
      settings: snapshotSettings(),
      scripts: snapshotScripts()
    };
  }

  applyPreset(preset) {
    const pack = wrapPreset(preset);
    if (pack.settings) applySettings(pack.settings);
    if (pack.scripts) replaceScripts(pack.scripts);
    return pack;
  }

  save(name) {
    if (!name) return false;
    this.presets[name] = this.capture();
    this._write();
    localStorage.setItem(LAST_KEY, name);
    this.persistSession();
    return true;
  }

  load(name) {
    const preset = this.presets[name];
    if (!preset) return false;
    this.applyPreset(preset);
    localStorage.setItem(LAST_KEY, name);
    this.persistSession();
    return true;
  }

  duplicate(name) {
    if (!this.has(name)) return null;
    let copy = `${name} copy`;
    let index = 2;
    while (this.has(copy)) copy = `${name} copy ${index++}`;
    this.presets[copy] = structuredClone(wrapPreset(this.presets[name]));
    this._write();
    return copy;
  }

  remove(name) {
    if (!this.has(name)) return false;
    delete this.presets[name];
    this._write();
    return true;
  }

  reset() {
    applySettings(structuredClone(DEFAULT_SETTINGS));
    replaceScripts([]);
  }

  lastName() {
    return localStorage.getItem(LAST_KEY) || localStorage.getItem(LEGACY_LAST) || '';
  }

  persistSession() {
    try {
      const prev = localStorage.getItem(SESSION_KEY);
      if (prev) localStorage.setItem(SESSION_BACKUP, prev);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          version: 1,
          schema: 'grudge-lab-session',
          lastPreset: this.lastName(),
          ...this.capture()
        })
      );
      return true;
    } catch (error) {
      console.warn('[PresetManager] session save failed', error);
      return false;
    }
  }

  restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_BACKUP);
      if (!raw) {
        const last = this.lastName();
        if (last && this.has(last)) return this.load(last);
        return false;
      }
      const data = JSON.parse(raw);
      this.applyPreset(data);
      return true;
    } catch (error) {
      console.warn('[PresetManager] session restore failed', error);
      return false;
    }
  }

  /** Trigger a download of the current settings + scripts (or a named preset). */
  exportJSON(name = null) {
    const data = name && this.has(name) ? this.presets[name] : this.capture();
    downloadJson(`${(name ?? 'grudge-lab').replace(/\s+/g, '-').toLowerCase()}.json`, data);
  }

  exportAll() {
    downloadJson('grudge-lab-presets.json', this.presets);
  }

  /**
   * Import from a JSON file chosen by the user.
   * Accepts a session, a settings snapshot, a preset map, or a skill prefab.
   * @returns {Promise<{ imported: string[], applied: boolean, kind: string }>}
   */
  importFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve({ imported: [], applied: false, kind: 'empty' });
        try {
          const data = JSON.parse(await file.text());
          const result = this.ingest(data, file.name);
          resolve(result);
        } catch (error) {
          console.error('[PresetManager] import failed', error);
          resolve({ imported: [], applied: false, kind: 'error' });
        }
      };
      input.click();
    });
  }

  ingest(data, filename = '') {
    const kind = classifyPayload(data);
    if (kind === 'skill' || kind === 'catalog') {
      const applied = importLabPayload(data);
      this.persistSession();
      return { imported: [], applied, kind };
    }
    if (kind === 'session' || kind === 'preset' || kind === 'settings') {
      this.applyPreset(data);
      this.persistSession();
      return { imported: [], applied: true, kind };
    }
    if (kind === 'library') {
      const names = [];
      for (const [name, preset] of Object.entries(data)) {
        if (preset && typeof preset === 'object') {
          this.presets[name] = wrapPreset(preset);
          names.push(name);
        }
      }
      this._write();
      return { imported: names, applied: false, kind };
    }
    return { imported: [], applied: false, kind: filename ? 'unknown' : 'empty' };
  }

  get current() {
    return settings;
  }
}

function wrapPreset(value) {
  if (!value || typeof value !== 'object') {
    return { version: 2, schema: 'grudge-lab-preset', settings: {}, scripts: { scripts: [] } };
  }
  if (value.settings || value.schema === 'grudge-lab-preset' || value.schema === 'grudge-lab-session') {
    return {
      version: 2,
      schema: 'grudge-lab-preset',
      settings: value.settings ?? stripScripts(value),
      scripts: value.scripts ?? { scripts: [] }
    };
  }
  return {
    version: 2,
    schema: 'grudge-lab-preset',
    settings: value,
    scripts: { scripts: [] }
  };
}

function stripScripts(value) {
  const { scripts, schema, version, lastPreset, ...rest } = value;
  return rest;
}

function classifyPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'unknown';
  if (data.schema === 'weapon-skill-production-override' || data.labId || data.vfx) return 'skill';
  if (data.schema === 'grudge-lab-session') return 'session';
  if (data.schema === 'grudge-lab-preset') return 'preset';
  if (Array.isArray(data.skills)) return 'catalog';
  if (data.settings && data.global) return 'session';
  if (data.global && typeof data.global === 'object') return 'settings';
  const values = Object.values(data);
  if (
    values.length &&
    values.every(
      (value) =>
        value &&
        typeof value === 'object' &&
        (value.settings || value.global || value.schema === 'grudge-lab-preset')
    )
  ) {
    return 'library';
  }
  return 'unknown';
}

function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
