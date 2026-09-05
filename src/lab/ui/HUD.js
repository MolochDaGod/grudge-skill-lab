// @ts-nocheck
import { ELEMENTS, ELEMENT_META, BOOST_META, MAGIC_META, FIRE_META } from '../config/settings.js';
import { ELEMENT_SIGILS, BOOST_SIGIL, MAGIC_SIGIL, FIRE_SIGIL } from './glyphs.js';
import { AURA_DEFAULTS, variantMeta } from '../rpg/auras.js';

/**
 * Heads-up display: the ability bar, controls, live stats and toasts.
 *
 * Plain DOM — no framework. The bar is built from `ELEMENTS`, so a new ability
 * appears in it on its own; the slots are the only interactive part, and they
 * mirror the keyboard shortcuts through `onAbility`.
 *
 * The three self buffs sit at the end of the same bar but are *not* slots: they
 * are never selected and never armed, so they are held separately and their
 * sweeps show the buff draining rather than a cooldown filling.
 *
 * The cooldown sweep is a `conic-gradient` driven by a CSS custom property, so
 * updating it every frame is one `setProperty` call and never touches layout.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.onAbility = null;
    this.onBoost = null;
    this.onMagic = null;
    this.onFire = null;
    this.onAuraCycle = null;
    this._toastTimer = 0;
    this._statsAccumulator = 0;
    this._frames = 0;
    this._fps = 0;
    /** Last sweep ratio pushed to the DOM, per element. */
    this._cooldownShown = new Map();
    this._armedShown = null;
    this._boostShown = { active: null, ratio: -1 };
    this._magicShown = { active: null, ratio: -1 };
    this._fireShown = { active: null, ratio: -1 };

    root.innerHTML = `
      <div class="hud__panel hud__title">
        <img class="hud__mark" src="/brand/logo.png" alt="Grudge" />
        <span data-blurb>Ability Lab · 1–3 combo · Shift dash · J combat · [ ] weapons · I sheet</span>
      </div>

      <div class="hud__panel hud__stats">
        <div>FPS <b data-stat="fps">—</b></div>
        <div>Particles <b data-stat="particles">0</b></div>
        <div>Instances <b data-stat="spikes">0</b></div>
        <div>Draw calls <b data-stat="calls">0</b></div>
      </div>

      <div class="hud__panel hud__help is-hidden">
        <div><strong>F</strong> — class T0 totem (mage fire / priest heal / virtuoso air). Pulses when you act.</div>
        <div><strong>Range</strong> — boss dummy, four pack dummies, green ally (DoT). Heals hit the ally. AoE hits the pack.</div>
        <div><strong>Shift</strong> — dash toward the nearest hostile (stamina). <strong>Shift+B / M / K</strong> — cycle aura colour.</div>
        <div><strong>B</strong> Electric · <strong>M</strong> Magic · <strong>K</strong> Fire. Variants: red, green, purple, water, electric, blue, heal.</div>
        <div><strong>J</strong> — Warlords combat panel: Skills, Stats (8 ATTR + secondaries), Live HUD.</div>
        <div><strong>Bow</strong> — hold LMB draw (green). Hold 2 Aimed Shot (orb). 3 Volley rain.</div>
        <div><strong>4–6</strong> — kit actives (weapon, off-hand, relic, back, armor), then class flavor</div>
        <div><strong>[ ]</strong> — cycle every weapon type. Class never locks a blade.</div>
        <div><strong>L</strong> — grove library: clips, effects, projectiles, editors</div>
        <div><strong>I</strong> — character sheet: 8 ATTR, secondary stats, 6 races, 8 classes</div>
        <div class="hud__help-note">
          Right-click a pack cell to wear it. Race swaps the toon mesh; class
          and gear scale the eight attributes. Pools, crit, and dummy mitigation
          come from master-attributes v2.1.0. Authored VFX knobs stay put.
        </div>
        <div><strong>7</strong> Shadow Clones · <strong>8</strong> Sky Fist · <strong>9</strong> Sky Blades · <strong>0</strong> Shadow Step</div>
        <div class="hud__help-note">
          B, M and K are self buffs — nothing to aim. Press again to let go; any of them can run
          together. Roles (stun/buff/debuff/cast/channel) pulse the matching form.
        </div>
        <div><strong>Move</strong> — aim &nbsp; <strong>Left click</strong> — cast (bow: hold to draw)</div>
        <div><strong>Esc / right click</strong> — cancel the cast</div>
        <div><strong>Right drag</strong> — orbit &nbsp; <strong>Scroll</strong> — zoom</div>
        <div style="margin-top:6px">
          <kbd>L</kbd> library &nbsp; <kbd>J</kbd> combat &nbsp; <kbd>G</kbd> editor &nbsp; <kbd>U</kbd> studio &nbsp; <kbd>P</kbd> pause &nbsp; <kbd>C</kbd> clear
        </div>
        <div><kbd>H</kbd> hide this</div>
        <div class="hud__help-note">Paused still applies every editor change.</div>
      </div>

      <div class="hud__abilities">
        ${ELEMENTS.map((element) => {
          const meta = ELEMENT_META[element];
          return `
            <div class="ability-card" data-element="${element}" style="--accent:${meta.accent}">
              <div class="ability-card__sweep" data-sweep></div>
              <div class="ability-card__key">${meta.key}</div>
              <div class="ability-card__glyph">${ELEMENT_SIGILS[element] ?? ''}</div>
              <div class="ability-card__label">${meta.label}</div>
            </div>`;
        }).join('')}

        <div class="ability-card ability-card--buff" data-boost
             style="--accent:${BOOST_META.accent}">
          <div class="ability-card__sweep" data-sweep></div>
          <div class="ability-card__key">${BOOST_META.key}</div>
          <div class="ability-card__glyph">${BOOST_SIGIL}</div>
          <div class="ability-card__label">${BOOST_META.label}</div>
        </div>

        <div class="ability-card ability-card--buff" data-magic
             style="--accent:${MAGIC_META.accent}">
          <div class="ability-card__sweep" data-sweep></div>
          <div class="ability-card__key">${MAGIC_META.key}</div>
          <div class="ability-card__glyph">${MAGIC_SIGIL}</div>
          <div class="ability-card__label">${MAGIC_META.label}</div>
        </div>

        <div class="ability-card ability-card--buff" data-fire
             style="--accent:${FIRE_META.accent}">
          <div class="ability-card__sweep" data-sweep></div>
          <div class="ability-card__key">${FIRE_META.key}</div>
          <div class="ability-card__glyph">${FIRE_SIGIL}</div>
          <div class="ability-card__label">${FIRE_META.label}</div>
        </div>
      </div>

      <div class="hud__auras" data-auras>
        ${['boost', 'magic', 'fire']
          .map((form) => {
            const id = AURA_DEFAULTS[form];
            const meta = variantMeta(id);
            const key = form === 'boost' ? 'B' : form === 'magic' ? 'M' : 'K';
            return `<button type="button" class="hud-aura" data-aura="${form}" style="--accent:${meta.accent}">
              <b>${key}</b><span data-aura-name>${meta.label}</span>
            </button>`;
          })
          .join('')}
      </div>

      <div class="hud__toast" data-toast></div>
      <div class="hud__paused" data-paused>Paused</div>
    `;

    this.cards = new Map();
    for (const card of root.querySelectorAll('.ability-card[data-element]')) {
      this.cards.set(card.dataset.element, card);
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onAbility?.(card.dataset.element);
      });
    }

    this.boostCard = root.querySelector('[data-boost]');
    this.boostCard.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.onBoost?.();
    });

    this.magicCard = root.querySelector('[data-magic]');
    this.magicCard.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.onMagic?.();
    });

    this.fireCard = root.querySelector('[data-fire]');
    this.fireCard.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.onFire?.();
    });

    this.root.querySelector('[data-auras]')?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-aura]');
      if (!btn) return;
      event.stopPropagation();
      this.onAuraCycle?.(btn.dataset.aura);
    });

    this.stats = {
      fps: root.querySelector('[data-stat="fps"]'),
      particles: root.querySelector('[data-stat="particles"]'),
      spikes: root.querySelector('[data-stat="spikes"]'),
      calls: root.querySelector('[data-stat="calls"]')
    };
    this.help = root.querySelector('.hud__help');
    this.toast = root.querySelector('[data-toast]');
    this.pausedBadge = root.querySelector('[data-paused]');
    this.abilityBar = root.querySelector('.hud__abilities');
  }

  /** @param {{silent?: boolean}} [options] */
  setElement(element, options = {}) {
    for (const [key, card] of this.cards) {
      card.classList.toggle('is-active', key === element);
    }
    const meta = ELEMENT_META[element];
    if (meta && !options.silent) this.showToast(`${meta.hint} selected`);
  }

  /** Highlight the slot while a cast is armed. */
  setArmed(armed) {
    if (armed === this._armedShown) return;
    this._armedShown = armed;
    this.abilityBar.classList.toggle('is-armed', armed);
  }

  /**
   * Drive one slot's cooldown sweep. Cooldowns are per ability, so this is
   * called once per element each frame.
   *
   * @param {string} element
   * @param {number} remaining seconds left
   * @param {number} total     the full cooldown, for the sweep angle
   */
  setCooldown(element, remaining, total) {
    const card = this.cards.get(element);
    if (!card) return;

    const ratio = Math.max(0, Math.min(1, remaining / Math.max(total, 0.001)));
    // Only touch the DOM when the sweep visibly moves.
    if (Math.abs(ratio - (this._cooldownShown.get(element) ?? -1)) < 0.01) return;
    this._cooldownShown.set(element, ratio);
    card.style.setProperty('--cooldown', ratio);
    card.classList.toggle('is-cooling', ratio > 0.001);
  }

  /**
   * Drive one self buff's slot.
   *
   * One sweep, two meanings: while the buff holds it drains from full, and once
   * it has expired it fills back up as the cooldown runs off. They are told
   * apart by the class, not by the number — charged reads as accent and keeps
   * the glyph lit, cooling reads as the same dark wipe every other slot uses.
   *
   * @param {HTMLElement} card
   * @param {{active: boolean|null, ratio: number}} shown last state pushed
   * @param {boolean} active
   * @param {number} ratio 0..1 — buff left while active, cooldown left after
   */
  _setBuff(card, shown, active, ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (active === shown.active && Math.abs(clamped - shown.ratio) < 0.01) return;
    shown.active = active;
    shown.ratio = clamped;

    card.style.setProperty('--cooldown', clamped);
    card.classList.toggle('is-charged', active);
    card.classList.toggle('is-cooling', !active && clamped > 0.001);
  }

  /** @see _setBuff */
  setBoost(active, ratio) {
    this._setBuff(this.boostCard, this._boostShown, active, ratio);
  }

  /** @see _setBuff */
  setMagic(active, ratio) {
    this._setBuff(this.magicCard, this._magicShown, active, ratio);
  }

  /** @see _setBuff */
  setFire(active, ratio) {
    this._setBuff(this.fireCard, this._fireShown, active, ratio);
  }

  setAura(form, meta) {
    const id = form === 'boost' ? 'boost' : form;
    const card =
      id === 'boost' ? this.boostCard : id === 'magic' ? this.magicCard : this.fireCard;
    const accent = meta?.accent || '#7fd6ff';
    if (card) card.style.setProperty('--accent', accent);
    const chip = this.root.querySelector(`[data-aura="${id}"]`);
    if (chip) {
      chip.style.setProperty('--accent', accent);
      const name = chip.querySelector('[data-aura-name]');
      if (name) name.textContent = meta?.label || id;
    }
  }

  setPaused(paused) {
    this.pausedBadge.classList.toggle('is-visible', paused);
  }

  toggleHelp() {
    this.help.classList.toggle('is-hidden');
  }

  showToast(message, duration = 1600) {
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), duration);
  }

  /**
   * @param {number} dt
   * @param {() => {particles:number, spikes:number, calls:number}} collect
   *   Called only when the readout actually refreshes, so gathering the numbers
   *   (which means walking the particle pools) stays off the hot path.
   */
  update(dt, collect) {
    this._frames++;
    this._statsAccumulator += dt;
    if (this._statsAccumulator < 0.4) return;

    this._fps = Math.round(this._frames / this._statsAccumulator);
    this._frames = 0;
    this._statsAccumulator = 0;

    const info = collect();
    this.stats.fps.textContent = this._fps;
    this.stats.particles.textContent = info.particles;
    this.stats.spikes.textContent = info.spikes;
    this.stats.calls.textContent = info.calls;
  }
}

/** Boot screen helper. */
export class LoadingScreen {
  constructor(root) {
    this.element = root ?? document.getElementById('loader');
    this.fill = this.element?.querySelector('[data-loader-fill]') ?? document.getElementById('loader-fill');
    this.status = this.element?.querySelector('[data-loader-status]') ?? document.getElementById('loader-status');
  }

  setProgress(ratio, message) {
    if (this.fill) this.fill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    if (message && this.status) this.status.textContent = message;
  }

  hide() {
    this.setProgress(1);
    setTimeout(() => this.element?.classList.add('is-hidden'), 220);
  }

  fail(message) {
    if (this.status) {
      this.status.textContent = message;
      this.status.style.color = '#c4786a';
    }
  }
}
