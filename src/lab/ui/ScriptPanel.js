// @ts-nocheck
import { ELEMENTS, ELEMENT_META } from '../config/settings.js';
import {
  SCRIPT_TARGETS,
  SCRIPT_PRESETS,
  createScript,
  getScript,
  listScripts,
  removeScript,
  upsertScript
} from '../scripts/scriptDocument.js';

/**
 * Object-script editor matching the three.js Editor Manual.
 * Source is saved on the document and compiled by ScriptHost.
 */
export class ScriptPanel {
  constructor({ host, onChange, onToast } = {}) {
    this.host = host;
    this.onChange = onChange;
    this.onToast = onToast;
    this.open = false;
    this.selectedId = null;

    this.root = document.createElement('aside');
    this.root.className = 'script-panel';
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());

    this.root.innerHTML = `
      <header class="script-panel__head">
        <h2>Object scripts</h2>
        <button type="button" data-act="close">Close</button>
      </header>
      <p class="script-panel__blurb">
        init / start / update / stop. player.fx.wind / mist / heal / flow for AAA trails.
      </p>
      <label class="script-panel__field">
        <span>Object</span>
        <select data-field="key"></select>
      </label>
      <div class="script-panel__row">
        <select data-field="pick"></select>
        <button type="button" data-act="new">New</button>
      </div>
      <label class="script-panel__field">
        <span>AAA preset</span>
        <select data-field="preset">
          <option value="">Load a preset…</option>
        </select>
      </label>
      <label class="script-panel__field">
        <span>Name</span>
        <input type="text" data-field="name" maxlength="48" />
      </label>
      <label class="script-panel__check">
        <input type="checkbox" data-field="enabled" />
        Enabled
      </label>
      <textarea data-field="source" spellcheck="false"></textarea>
      <p class="script-panel__status" data-field="status"></p>
      <div class="script-panel__actions">
        <button type="button" class="primary" data-act="save">Save & run</button>
        <button type="button" data-act="delete">Delete</button>
      </div>
    `;

    this.els = {
      key: this.root.querySelector('[data-field="key"]'),
      pick: this.root.querySelector('[data-field="pick"]'),
      preset: this.root.querySelector('[data-field="preset"]'),
      name: this.root.querySelector('[data-field="name"]'),
      enabled: this.root.querySelector('[data-field="enabled"]'),
      source: this.root.querySelector('[data-field="source"]'),
      status: this.root.querySelector('[data-field="status"]')
    };

    this.root.addEventListener('click', (event) => {
      const act = event.target?.closest?.('[data-act]')?.dataset?.act;
      if (act === 'close') this.hide();
      else if (act === 'new') this._new();
      else if (act === 'save') this._save();
      else if (act === 'delete') this._delete();
    });
    this.els.key.addEventListener('change', () => {
      this.selectedId = listScripts(this.els.key.value)[0]?.id ?? null;
      this.refresh();
    });
    this.els.pick.addEventListener('change', () => {
      this.selectedId = this.els.pick.value || null;
      this.refresh();
    });
    this.els.preset?.addEventListener('change', () => this._loadPreset(this.els.preset.value));

    document.body.appendChild(this.root);
    this._fillTargets();
    this._fillPresets();
    this.refresh();
  }

  _targets() {
    const extras = ELEMENTS.map((id) => ({
      key: `ability:${id}`,
      label: ELEMENT_META[id]?.label ?? id
    }));
    extras.push(
      { key: 'ability:aimedShot', label: ELEMENT_META.aimedShot?.label ?? 'Aimed Shot' },
      { key: 'ability:volley', label: ELEMENT_META.volley?.label ?? 'Volley' }
    );
    return [...SCRIPT_TARGETS, ...extras];
  }

  _fillTargets() {
    this.els.key.replaceChildren(
      ...this._targets().map((target) => {
        const option = document.createElement('option');
        option.value = target.key;
        option.textContent = target.label;
        return option;
      })
    );
  }

  _fillPresets() {
    if (!this.els.preset) return;
    this.els.preset.replaceChildren(
      Object.assign(document.createElement('option'), { value: '', textContent: 'Load a preset…' }),
      ...SCRIPT_PRESETS.map((row) => {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = row.name;
        return option;
      })
    );
  }

  _loadPreset(id) {
    const preset = SCRIPT_PRESETS.find((row) => row.id === id);
    if (!preset) return;
    const record = createScript(preset.key, preset.name);
    record.source = preset.source;
    upsertScript(record);
    this.els.key.value = preset.key;
    this.selectedId = record.id;
    this.refresh();
    this.els.preset.value = '';
    this.onToast?.(`Loaded "${preset.name}"`);
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  show() {
    this.open = true;
    this.root.hidden = false;
    this.refresh();
  }

  hide() {
    this.open = false;
    this.root.hidden = true;
  }

  current() {
    return getScript(this.selectedId);
  }

  refresh() {
    const key = this.els.key.value || 'scene';
    const rows = listScripts(key);
    if (!rows.some((row) => row.id === this.selectedId)) {
      this.selectedId = rows[0]?.id ?? null;
    }
    this.els.pick.replaceChildren(
      ...rows.map((row) => {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = row.enabled ? row.name : `${row.name} (off)`;
        return option;
      })
    );
    this.els.pick.value = this.selectedId ?? '';
    const record = this.current();
    this.els.name.value = record?.name ?? '';
    this.els.enabled.checked = record ? record.enabled !== false : true;
    this.els.source.value = record?.source ?? '';
    this.els.source.disabled = !record;
    this._setStatus();
  }

  _setStatus(message) {
    if (message) {
      this.els.status.textContent = message;
      return;
    }
    const errors = this.host?.errors ?? [];
    const record = this.current();
    const mine = record ? errors.filter((error) => error.id === record.id) : [];
    if (mine.length) this.els.status.textContent = mine[0].message;
    else if (errors.length) this.els.status.textContent = `${errors.length} script error(s)`;
    else this.els.status.textContent = record ? 'Compiled' : 'No script on this object';
  }

  _new() {
    const record = createScript(this.els.key.value || 'scene', 'untitled');
    upsertScript(record);
    this.selectedId = record.id;
    this.refresh();
    this.onToast?.('New script');
  }

  _save() {
    const record = this.current();
    if (!record) {
      this._new();
      return this._save();
    }
    upsertScript({
      ...record,
      name: this.els.name.value.trim() || 'untitled',
      source: this.els.source.value,
      enabled: this.els.enabled.checked
    });
    const errors = this.onChange?.() ?? this.host?.compile?.() ?? [];
    this.refresh();
    if (errors?.length) {
      this._setStatus(errors[0].message);
      this.onToast?.(`Script error: ${errors[0].message}`);
    } else {
      this.onToast?.(`Saved "${this.els.name.value || 'untitled'}"`);
    }
  }

  _delete() {
    if (!this.selectedId) return;
    removeScript(this.selectedId);
    this.selectedId = null;
    this.onChange?.();
    this.refresh();
    this.onToast?.('Script deleted');
  }

  dispose() {
    this.root.remove();
  }
}
