// @ts-nocheck
import {
  loadWarlordsSkills,
  WARLORDS_PANEL_URL,
  labIdForSkill
} from '../rpg/warlordsApi.js';
import { AURA_ROLES, AURA_FORMS, variantMeta } from '../rpg/auras.js';
import { attrSheetHtml } from '../rpg/grudgeMath.js';

/**
 * Native Warlords combat tray — icons + skill info from ObjectStore,
 * plus the official attribute / secondary-stat sheet.
 *
 * Live HUD iframes the production main panel (inventory / equipment /
 * crafting / quests / combat / chat). Auth often blanks HP/MP/SP there;
 * the Stats tab is the always-on math.
 */
export class CombatPanel {
  constructor(root) {
    this.root = root;
    this.open = false;
    this.skills = [];
    this.filter = '';
    this.weapon = 'ALL';
    this.tab = 'skills';
    this.snap = null;
    this._status = 'Loading Warlords skills…';

    this.onArm = null;
    this.onAuraCycle = null;
    this.onAuraPulse = null;
    this.onDash = null;
    this.onHelper = null;
    this.onShow = null;

    this.host = document.createElement('div');
    this.host.className = 'combat is-hidden';
    this.host.dataset.tab = 'skills';
    this.host.innerHTML = this._template();
    root.appendChild(this.host);

    this.els = {
      list: this.host.querySelector('[data-combat-list]'),
      status: this.host.querySelector('[data-combat-status]'),
      search: this.host.querySelector('[data-combat-search]'),
      weapon: this.host.querySelector('[data-combat-weapon]'),
      frame: this.host.querySelector('[data-combat-frame]'),
      stats: this.host.querySelector('[data-combat-stats]')
    };

    this.host.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.host.querySelector('[data-combat-close]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.close();
    });
    this.els.search?.addEventListener('input', () => {
      this.filter = this.els.search.value.trim().toLowerCase();
      this._renderList();
    });
    this.els.weapon?.addEventListener('change', () => {
      this.weapon = this.els.weapon.value;
      this._renderList();
    });
    this.host.querySelector('[data-combat-tabs]')?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      event.stopPropagation();
      this.setTab(btn.dataset.tab);
    });
    this.host.querySelector('[data-combat-list]')?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-skill]');
      if (!btn) return;
      event.stopPropagation();
      const skill = this.skills.find((row) => row.id === btn.dataset.skill);
      if (!skill) return;
      const labId = skill.labId || labIdForSkill(skill);
      this.onArm?.(labId || skill.id, skill);
    });
    this.host.querySelector('[data-combat-roles]')?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-role]');
      if (!btn) return;
      event.stopPropagation();
      this.onAuraPulse?.(btn.dataset.role);
    });
    this.host.querySelector('[data-combat-auras]')?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-form]');
      if (!btn) return;
      event.stopPropagation();
      this.onAuraCycle?.(btn.dataset.form);
    });
    this.host.querySelector('[data-combat-dash]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.onDash?.();
    });
    this.host.querySelector('[data-combat-skel]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.onHelper?.('skeleton');
    });
    this.host.querySelector('[data-combat-anim]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.onHelper?.('anim');
    });

    this.load();
  }

  _template() {
    return `
      <div class="combat__card">
        <header class="combat__head">
          <div>
            <p class="combat__kicker">Warlords</p>
            <h2>Combat panel</h2>
          </div>
          <button type="button" class="combat__close" data-combat-close>Close</button>
        </header>
        <p class="combat__lead">
          Skills from the ObjectStore. Stats from master-attributes v2.1.0.
          Live HUD is the production main panel (inventory, equipment, crafting, quests, combat, chat).
        </p>
        <div class="combat__tabs" data-combat-tabs>
          <button type="button" data-tab="skills" class="is-on">Skills</button>
          <button type="button" data-tab="stats">Stats</button>
          <button type="button" data-tab="hud">Live HUD</button>
        </div>
        <div class="combat__acts">
          <button type="button" data-combat-dash>Dash (Shift)</button>
          <button type="button" data-combat-skel>Skeleton</button>
          <button type="button" data-combat-anim>Animations</button>
        </div>
        <div class="combat__auras" data-combat-auras>
          ${AURA_FORMS.map(
            (form) =>
              `<button type="button" data-form="${form}" style="--accent:${variantMeta(form === 'fire' ? 'red' : form === 'magic' ? 'purple' : 'electric').accent}">
                <b>${form === 'boost' ? 'B' : form === 'magic' ? 'M' : 'K'}</b>
                <span data-aura-label="${form}">${form}</span>
              </button>`
          ).join('')}
        </div>
        <div class="combat__roles" data-combat-roles>
          ${Object.entries(AURA_ROLES)
            .map(
              ([id, spec]) =>
                `<button type="button" data-role="${id}">${spec.label}</button>`
            )
            .join('')}
        </div>
        <div class="combat__tools">
          <input type="search" data-combat-search placeholder="Search skills" />
          <select data-combat-weapon>
            <option value="ALL">All weapons</option>
          </select>
        </div>
        <p class="combat__status" data-combat-status>Loading Warlords skills…</p>
        <div class="combat__list" data-combat-list></div>
        <div class="combat__stats" data-combat-stats></div>
        <iframe class="combat__frame" data-combat-frame title="Warlords main panel" loading="lazy"></iframe>
      </div>
    `;
  }

  setTab(tab) {
    const next = tab === 'stats' || tab === 'hud' ? tab : 'skills';
    this.tab = next;
    this.host.dataset.tab = next;
    for (const btn of this.host.querySelectorAll('[data-combat-tabs] [data-tab]')) {
      btn.classList.toggle('is-on', btn.dataset.tab === next);
    }
    if (next === 'hud' && this.els.frame && !this.els.frame.src) {
      this.els.frame.src = WARLORDS_PANEL_URL;
    }
    if (next === 'stats') this._renderStats();
  }

  setSnapshot(snap) {
    this.snap = snap;
    if (this.tab === 'stats') this._renderStats();
  }

  _renderStats() {
    if (!this.els.stats) return;
    if (!this.snap) {
      this.els.stats.innerHTML = `<p class="combat__empty">No character snapshot yet.</p>`;
      return;
    }
    this.els.stats.innerHTML = attrSheetHtml(this.snap);
  }

  async load() {
    try {
      const { skills, meta, fromCache } = await loadWarlordsSkills();
      this.skills = skills;
      this._status = `${skills.length} skills${fromCache ? ' (cached)' : ''} · ${meta.total || skills.length} catalogued`;
      const weapons = [...new Set(skills.map((row) => row.weaponType).filter(Boolean))].sort();
      if (this.els.weapon) {
        this.els.weapon.innerHTML =
          `<option value="ALL">All weapons</option>` +
          weapons.map((id) => `<option value="${id}">${id}</option>`).join('');
      }
      this._renderList();
    } catch (error) {
      this._status = `Warlords API unreachable — ${error.message || 'network'}`;
      if (this.els.status) this.els.status.textContent = this._status;
    }
  }

  setAura(form, variantId) {
    const meta = variantMeta(variantId);
    const label = this.host.querySelector(`[data-aura-label="${form}"]`);
    if (label) label.textContent = meta.label;
    const btn = this.host.querySelector(`[data-form="${form}"]`);
    if (btn) btn.style.setProperty('--accent', meta.accent);
  }

  _renderList() {
    if (this.els.status) this.els.status.textContent = this._status;
    if (!this.els.list) return;
    const rows = this.skills.filter((skill) => {
      if (this.weapon !== 'ALL' && skill.weaponType !== this.weapon) return false;
      if (!this.filter) return true;
      const hay = `${skill.name} ${skill.id} ${skill.description} ${skill.weaponType}`.toLowerCase();
      return hay.includes(this.filter);
    });
    const shown = rows.slice(0, 80);
    this.els.list.innerHTML = shown
      .map((skill) => {
        const cost = skill.cost
          ? skill.cost.stamina
            ? `${skill.cost.stamina} sta`
            : skill.cost.mana
              ? `${skill.cost.mana} mp`
              : ''
          : '';
        const lab = skill.labId ? ` · lab ${skill.labId}` : '';
        return `<button type="button" class="combat__skill" data-skill="${skill.id}">
          <img alt="" src="${skill.iconUrl || ''}" loading="lazy" referrerpolicy="no-referrer" />
          <span>
            <b>${skill.name}</b>
            <i>${skill.weaponType || '—'} · cd ${skill.cooldown || 0}s${cost ? ' · ' + cost : ''}${lab}</i>
          </span>
        </button>`;
      })
      .join('');
    if (!shown.length) {
      this.els.list.innerHTML = `<p class="combat__empty">No skills match.</p>`;
    }
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.open = true;
    this.host.classList.remove('is-hidden');
    this.onShow?.();
  }

  close() {
    this.open = false;
    this.host.classList.add('is-hidden');
  }

  dispose() {
    this.host.remove();
  }
}
