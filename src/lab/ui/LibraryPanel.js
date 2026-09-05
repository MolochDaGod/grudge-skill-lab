// @ts-nocheck
import { ELEMENTS, ELEMENT_META, BOOST_META, MAGIC_META, FIRE_META } from '../config/settings.js';
import { ELEMENT_SIGILS, BOOST_SIGIL, MAGIC_SIGIL, FIRE_SIGIL } from './glyphs.js';
import { PROJECTILE_IDS, RACE_MESHES, EDITOR_ACTIONS } from '../config/library.js';

const TABS = [
  { id: 'clips', label: 'Clips' },
  { id: 'effects', label: 'Effects' },
  { id: 'projectiles', label: 'Projectiles' },
  { id: 'editors', label: 'Editors' }
];

function fmtDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return `${seconds.toFixed(2)}s`;
}

/**
 * Playable archive of every grove clip, wired ability, projectile, and editor.
 *
 * Plain DOM, same chrome as the RPG sheet. The lab already owns the data —
 * this panel is the index so nothing sits behind a forgotten key.
 */
export class LibraryPanel {
  constructor(root) {
    this.root = root;
    this.open = false;
    this.tab = 'clips';
    this.loop = true;
    this._playing = '';
    this._armed = '';

    this.onPlay = null;
    this.onArm = null;
    this.onBuff = null;
    this.onEditor = null;
    this.onStudio = null;
    this.onSheet = null;
    this.onPause = null;
    this.onClear = null;
    this.onRace = null;
    this.onCombat = null;
    this.onHelper = null;
    this.onAuraPulse = null;

    this.actors = [];
    this.races = RACE_MESHES;

    this.host = document.createElement('div');
    this.host.className = 'lib is-hidden';
    this.host.innerHTML = this._template();
    root.appendChild(this.host);

    this.els = {
      tabs: this.host.querySelector('[data-lib-tabs]'),
      panes: this.host.querySelector('[data-lib-panes]'),
      loop: this.host.querySelector('[data-lib-loop]'),
      status: this.host.querySelector('[data-lib-status]')
    };

    this.host.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.host.querySelector('[data-lib-close]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.close();
    });
    this.els.loop?.addEventListener('change', () => {
      this.loop = Boolean(this.els.loop.checked);
    });
    this.els.tabs?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      event.stopPropagation();
      this.setTab(btn.dataset.tab);
    });
    this.els.panes?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-lib-act]');
      if (!btn) return;
      event.stopPropagation();
      this._act(btn.dataset.libAct, btn.dataset);
    });
  }

  _template() {
    return `
      <div class="lib__card">
        <header class="lib__head">
          <div>
            <p class="lib__kicker">Archive</p>
            <h2>Grove library</h2>
          </div>
          <button type="button" class="lib__close" data-lib-close>Close</button>
        </header>
        <p class="lib__lead">
          Boss dummy, pack of four, green ally, and the caster — including the equipped weapon's 1-2-3 combo.
          Every wired effect and projectile. Skeleton helper, Warlords combat panel, Skill Studio.
        </p>
        <nav class="lib__tabs" data-lib-tabs>
          ${TABS.map(
            (tab) =>
              `<button type="button" data-tab="${tab.id}" class="${tab.id === this.tab ? 'is-on' : ''}">${tab.label}</button>`
          ).join('')}
        </nav>
        <label class="lib__loop">
          <input type="checkbox" data-lib-loop checked />
          Loop clips
        </label>
        <div class="lib__panes" data-lib-panes></div>
        <p class="lib__status" data-lib-status>Press a clip to play it on the grove actor.</p>
      </div>
    `;
  }

  setActors(actors) {
    this.actors = Array.isArray(actors) ? actors : [];
    this._render();
  }

  setArmed(id) {
    this._armed = id || '';
    for (const node of this.host.querySelectorAll('[data-lib-act="arm"]')) {
      node.classList.toggle('is-on', node.dataset.id === this._armed);
    }
  }

  setPlaying(actorId, clipName) {
    this._playing = clipName ? `${actorId}:${clipName}` : '';
    for (const node of this.host.querySelectorAll('[data-lib-act="play"]')) {
      const key = `${node.dataset.actor}:${node.dataset.clip}`;
      node.classList.toggle('is-on', key === this._playing);
    }
  }

  setStatus(text) {
    if (this.els.status) this.els.status.textContent = text;
  }

  setTab(id) {
    if (!TABS.some((tab) => tab.id === id)) return;
    this.tab = id;
    for (const btn of this.els.tabs.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-on', btn.dataset.tab === id);
    }
    this._render();
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.open = true;
    this.host.classList.remove('is-hidden');
    this._render();
  }

  close() {
    this.open = false;
    this.host.classList.add('is-hidden');
  }

  _act(kind, data) {
    switch (kind) {
      case 'play':
        this.onPlay?.(data.actor, data.clip, this.loop);
        this.setPlaying(data.actor, data.clip);
        this.setStatus(`Playing ${data.clip} on ${data.actor}`);
        break;
      case 'arm':
        this.onArm?.(data.id);
        this.setArmed(data.id);
        this.setStatus(`Armed ${data.id}`);
        break;
      case 'buff':
        this.onBuff?.(data.id);
        this.setStatus(`Toggled ${data.id}`);
        break;
      case 'race':
        this.onRace?.(data.id);
        this.setStatus(`Showing ${data.id}`);
        break;
      case 'editor':
        this.onEditor?.();
        this.setStatus('VFX editor');
        break;
      case 'studio':
        this.onStudio?.();
        this.setStatus('Skill Studio');
        break;
      case 'sheet':
        this.onSheet?.();
        break;
      case 'pause':
        this.onPause?.();
        break;
      case 'clear':
        this.onClear?.();
        break;
      case 'combat':
        this.onCombat?.();
        this.setStatus('Warlords combat panel');
        break;
      case 'skeleton':
        this.onHelper?.('skeleton');
        this.setStatus('Skeleton helper');
        break;
      case 'anim':
        this.onHelper?.('anim');
        this.setStatus('Animation helper');
        break;
      case 'role':
        this.onAuraPulse?.(data.role);
        this.setStatus(`Aura ${data.role}`);
        break;
      default:
        break;
    }
  }

  _render() {
    if (!this.els.panes) return;
    if (this.tab === 'clips') this.els.panes.innerHTML = this._clipsPane();
    else if (this.tab === 'effects') this.els.panes.innerHTML = this._effectsPane();
    else if (this.tab === 'projectiles') this.els.panes.innerHTML = this._projectilesPane();
    else this.els.panes.innerHTML = this._editorsPane();
    this.setArmed(this._armed);
    const [actor, clip] = this._playing.split(':');
    if (actor && clip) this.setPlaying(actor, clip);
  }

  _clipsPane() {
    const actors = this.actors
      .map((actor) => {
        const clips = (actor.clips ?? [])
          .map((clip) => {
            const name = clip.name || 'clip';
            const on = `${actor.id}:${name}` === this._playing ? ' is-on' : '';
            return `<button type="button" class="lib__chip${on}" data-lib-act="play" data-actor="${actor.id}" data-clip="${name}">
              <b>${name}</b>
              <span>${fmtDuration(clip.duration)}</span>
            </button>`;
          })
          .join('');
        return `<section class="lib__group">
          <h3>${actor.label} <span>${actor.clips?.length ?? 0}</span></h3>
          <div class="lib__grid">${clips || '<p class="lib__empty">No clips on this mesh.</p>'}</div>
        </section>`;
      })
      .join('');
    const races = `<section class="lib__group">
      <h3>Race meshes <span>${RACE_MESHES.length}</span></h3>
      <p class="lib__note">Static kits — no authored clips. Shown on the grove pad.</p>
      <div class="lib__grid">${RACE_MESHES.map(
        (race) =>
          `<button type="button" class="lib__chip lib__chip--ghost" data-lib-act="race" data-id="${race.id}">
            <b>${race.label}</b>
            <span>mesh</span>
          </button>`
      ).join('')}</div>
    </section>`;
    return (actors || '<p class="lib__empty">Grove clips load with the lab.</p>') + races;
  }

  _effectsPane() {
    const cards = ELEMENTS.map((id) => {
      const meta = ELEMENT_META[id] ?? {};
      const on = id === this._armed ? ' is-on' : '';
      return `<button type="button" class="lib__skill${on}" data-lib-act="arm" data-id="${id}" style="--accent:${meta.accent || '#7ec8e3'}">
        <span class="lib__glyph">${ELEMENT_SIGILS[id] ?? ''}</span>
        <span class="lib__skill-meta">
          <b>${meta.label ?? id}</b>
          <span>${meta.cast ?? 'line'} · ${meta.key ?? ''}</span>
        </span>
      </button>`;
    }).join('');
    const buffs = [
      { id: 'boost', meta: BOOST_META, glyph: BOOST_SIGIL },
      { id: 'magic', meta: MAGIC_META, glyph: MAGIC_SIGIL },
      { id: 'fire', meta: FIRE_META, glyph: FIRE_SIGIL }
    ]
      .map(
        ({ id, meta, glyph }) =>
          `<button type="button" class="lib__skill" data-lib-act="buff" data-id="${id}" style="--accent:${meta.accent}">
            <span class="lib__glyph">${glyph}</span>
            <span class="lib__skill-meta">
              <b>${meta.label}</b>
              <span>self buff · ${meta.key}</span>
            </span>
          </button>`
      )
      .join('');
    return `<section class="lib__group">
      <h3>Abilities <span>${ELEMENTS.length}</span></h3>
      <div class="lib__skills">${cards}</div>
    </section>
    <section class="lib__group">
      <h3>Buffs <span>3</span></h3>
      <div class="lib__skills">${buffs}</div>
    </section>`;
  }

  _projectilesPane() {
    const cards = PROJECTILE_IDS.map((id) => {
      const meta = ELEMENT_META[id] ?? {};
      const on = id === this._armed ? ' is-on' : '';
      return `<button type="button" class="lib__skill${on}" data-lib-act="arm" data-id="${id}" style="--accent:${meta.accent || '#7ec8e3'}">
        <span class="lib__glyph">${ELEMENT_SIGILS[id] ?? ''}</span>
        <span class="lib__skill-meta">
          <b>${meta.label ?? id}</b>
          <span>${meta.cast ?? 'line'} · arm and click</span>
        </span>
      </button>`;
    }).join('');
    return `<section class="lib__group">
      <h3>Traveling VFX <span>${PROJECTILE_IDS.length}</span></h3>
      <p class="lib__note">Staff bolts, lances, the beam, and Ice Nova's freeze line. Arm, then click the dummy.</p>
      <div class="lib__skills">${cards}</div>
    </section>`;
  }

  _editorsPane() {
    const actions = EDITOR_ACTIONS.map((item) => {
      const act =
        item.id === 'vfx'
          ? 'editor'
          : item.id === 'studio'
            ? 'studio'
            : item.id === 'sheet'
              ? 'sheet'
              : item.id === 'pause'
                ? 'pause'
                : item.id === 'combat'
                  ? 'combat'
                  : 'clear';
      return `<button type="button" class="lib__editor" data-lib-act="${act}">
        <span class="lib__key">${item.key}</span>
        <span>
          <b>${item.title}</b>
          <span>${item.blurb}</span>
        </span>
      </button>`;
    }).join('');
    return `<section class="lib__group">
      <h3>Editors</h3>
      <div class="lib__editors">${actions}</div>
    </section>
    <section class="lib__group">
      <h3>Helpers</h3>
      <div class="lib__editors">
        <button type="button" class="lib__editor" data-lib-act="skeleton">
          <span class="lib__key">Sk</span>
          <span><b>Skeleton helper</b><span>three.js SkeletonHelper on the caster rig.</span></span>
        </button>
        <button type="button" class="lib__editor" data-lib-act="anim">
          <span class="lib__key">An</span>
          <span><b>Animation helper</b><span>Clip list, mixer, bone axes.</span></span>
        </button>
      </div>
    </section>
    <section class="lib__group">
      <h3>Aura roles</h3>
      <p class="lib__note">Stun, buff, debuff, cast and channel pulse B / K / M in the current colour.</p>
      <div class="lib__grid">
        <button type="button" class="lib__chip" data-lib-act="role" data-role="stun"><b>Stun</b><span>B electric</span></button>
        <button type="button" class="lib__chip" data-lib-act="role" data-role="buff"><b>Buff</b><span>K fire</span></button>
        <button type="button" class="lib__chip" data-lib-act="role" data-role="debuff"><b>Debuff</b><span>M magic</span></button>
        <button type="button" class="lib__chip" data-lib-act="role" data-role="cast"><b>Cast</b><span>brief</span></button>
        <button type="button" class="lib__chip" data-lib-act="role" data-role="channel"><b>Channel</b><span>M water</span></button>
      </div>
    </section>`;
  }

  dispose() {
    this.host.remove();
  }
}
