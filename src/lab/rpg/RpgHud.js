// @ts-nocheck
import { ELEMENT_META } from '../config/settings.js';
import { ELEMENT_SIGILS } from '../ui/glyphs.js';
import { RACES, CLASSES, FACTIONS, ITEMS, GEAR_SLOTS, itemsForSlot } from './actor.js';
import { getWeapon, isPreferredWeapon, WEAPON_ORDER } from './weapons.js';
import { attrSheetHtml, formatSecondary, takenPercent, dummyDefenseFor } from './grudgeMath.js';

const SLOT_LABEL = {
  weapon: 'Weapon',
  offhand: 'Off-hand',
  helm: 'Head',
  shoulders: 'Shoulders',
  chest: 'Chest',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  back: 'Back',
  relic: 'Relic'
};
const SLOT_GROUPS = [
  { title: 'Arms', slots: ['weapon', 'offhand'] },
  { title: 'Armor', slots: ['helm', 'shoulders', 'chest', 'hands', 'legs', 'feet'] },
  { title: 'Back & relic', slots: ['back', 'relic'] }
];
const RUNES = {
  warrior: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L54 18 V42 L32 58 L10 42 V18 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M32 16 V48 M22 28 H42" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`,
  raider: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 18 L50 46 M50 18 L14 46 M32 10 V54" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`,
  mage: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M32 12 V52 M18 24 L46 40 M46 24 L18 40" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  priest: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 L48 28 H16 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M32 28 V54 M20 54 H44" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  ranger: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 32 L32 8 L52 32 L32 56 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M32 16 V48 M20 32 H44" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  thief: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 48 L32 8 L44 48" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M24 36 H40" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  worge: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 40 C16 18 48 18 52 40 C44 52 20 52 12 40 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M22 24 L18 12 M42 24 L46 12" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  verduror: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 C44 20 44 36 32 56 C20 36 20 20 32 8 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M32 20 V48" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`
};

function fmt(n, digits = 0) {
  if (!Number.isFinite(n)) return '—';
  return digits ? n.toFixed(digits) : String(Math.round(n));
}

function itemMark(id) {
  const item = ITEMS[id];
  if (!item) return '';
  const bits = item.name.split(/\s+/).filter(Boolean);
  if (bits.length === 1) return bits[0].slice(0, 3).toUpperCase();
  return bits
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function slotMarkup(id, i, keys, mini = false) {
  const meta = ELEMENT_META[id] ?? {};
  const cls = mini ? 'rpg-mini' : 'rpg-slot';
  const key = keys[i] ?? String(i + 1);
  return `
    <button type="button" class="${cls}" data-slot="${i}" data-skill="${id}"
            style="--accent:${meta.accent ?? '#6a8f72'}">
      <span class="${cls}__sweep" data-sweep></span>
      <span class="${cls}__key">${key}</span>
      <span class="${cls}__glyph">${ELEMENT_SIGILS[id] ?? ''}</span>
    </button>`;
}

/**
 * Tight Valhalla chrome: unit frame, six-slot hotbar, 5×4 pack.
 * Sheet is factions → races, then the eight Warlord classes, then worn kit.
 */
export class RpgHud {
  constructor(root, actor) {
    this.root = root;
    this.actor = actor;
    this.onArm = null;
    this.onMutate = null;
    this.onWeapon = null;
    this.sheetOpen = false;
    this._selected = actor.loadout[0];
    this._hpShown = -1;
    this._dummyShown = -1;
    this._caption = '';
    this._slotCd = new Map();
    this._inspectItem = null;

    this.host = document.createElement('div');
    this.host.className = 'rpg';
    this.host.innerHTML = this._template();
    root.appendChild(this.host);

    this.els = {
      name: this.host.querySelector('[data-name]'),
      title: this.host.querySelector('[data-title]'),
      level: this.host.querySelector('[data-level]'),
      rune: this.host.querySelector('[data-rune]'),
      portrait: this.host.querySelector('[data-open-sheet]'),
      hpFill: this.host.querySelector('[data-hp-fill]'),
      staFill: this.host.querySelector('[data-sta-fill]'),
      mpFill: this.host.querySelector('[data-mp-fill]'),
      hpText: this.host.querySelector('[data-hp-text]'),
      staText: this.host.querySelector('[data-sta-text]'),
      mpText: this.host.querySelector('[data-mp-text]'),
      xpFill: this.host.querySelector('[data-xp-fill]'),
      staBar: this.host.querySelector('[data-sta-bar]'),
      mpBar: this.host.querySelector('[data-mp-bar]'),
      loadout: this.host.querySelector('[data-loadout]'),
      bones: this.host.querySelector('[data-bones]'),
      boneWeapons: this.host.querySelector('[data-bone-weapons]'),
      boneItems: this.host.querySelector('[data-bone-items]'),
      weaponName: this.host.querySelector('[data-weapon-name]'),
      minis: this.host.querySelector('[data-minis]'),
      caption: this.host.querySelector('[data-caption]'),
      pack: this.host.querySelector('[data-pack]'),
      dummy: this.host.querySelector('[data-dummy]'),
      dummyFill: this.host.querySelector('[data-dummy-fill]'),
      dummyText: this.host.querySelector('[data-dummy-text]'),
      dummyName: this.host.querySelector('[data-dummy-name]'),
      range: this.host.querySelector('[data-range]'),
      worldBars: this.host.querySelector('[data-world-bars]'),
      floats: this.host.querySelector('[data-floats]'),
      draw: this.host.querySelector('[data-draw]'),
      drawTick: this.host.querySelector('[data-draw-tick]'),
      drawLabel: this.host.querySelector('[data-draw-label]'),
      sheet: this.host.querySelector('[data-sheet]'),
      races: this.host.querySelector('[data-races]'),
      classes: this.host.querySelector('[data-classes]'),
      stats: this.host.querySelector('[data-stats]'),
      gear: this.host.querySelector('[data-gear]'),
      inspect: this.host.querySelector('[data-inspect]')
    };

    this.slots = [];
    this._bindLoadout();
    this._bindBones();
    this._paintBones();

    this.host.querySelector('[data-open-sheet]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.toggleSheet();
    });
    this.host.querySelector('[data-close-sheet]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.closeSheet();
    });
    this.els.sheet.addEventListener('pointerdown', (event) => {
      if (event.target === this.els.sheet) this.closeSheet();
    });

    this.els.pack.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const cell = event.target.closest('[data-item]');
      if (!cell) return;
      this._wear(cell.dataset.item);
    });
    this.els.pack.addEventListener('pointerdown', (event) => {
      const cell = event.target.closest('[data-item]');
      if (!cell) return;
      event.stopPropagation();
      this._inspectItem = cell.dataset.item;
      if (event.button === 2) return;
      this._writeItemCaption(cell.dataset.item);
      if (this.sheetOpen) this._paintSheet(this.actor.snapshot());
    });
    this.els.pack.addEventListener('dblclick', (event) => {
      const cell = event.target.closest('[data-item]');
      if (!cell) return;
      event.stopPropagation();
      this._wear(cell.dataset.item);
    });

    this.paintStatic();
    this.refresh();
  }

  _template() {
    const loadout = this.actor.loadout;
    const keys = this.actor.klass.keys;
    return `
      <div class="rpg__hud">
        <div class="rpg__unit">
          <button type="button" class="rpg__portrait" data-open-sheet title="Character sheet (I)">
            <img class="rpg__helm" src="/brand/helmet.png" alt="" />
          </button>
          <div class="rpg__id">
            <div class="rpg__name" data-name></div>
            <div class="rpg__meta"><span data-title></span> · Lv <span data-level></span></div>
          </div>
          <div class="rpg__bars">
            <div class="rpg-bar rpg-bar--hp" title="Health">
              <i data-hp-fill></i><span data-hp-text></span>
            </div>
            <div class="rpg-bar rpg-bar--sta" data-sta-bar title="Stamina">
              <i data-sta-fill></i><span data-sta-text></span>
            </div>
            <div class="rpg-bar rpg-bar--mp" data-mp-bar title="Mana">
              <i data-mp-fill></i><span data-mp-text></span>
            </div>
            <div class="rpg-bar rpg-bar--xp" title="Experience">
              <i data-xp-fill></i>
            </div>
          </div>
          <div class="rpg__minis" data-minis>
            ${loadout.map((id, i) => slotMarkup(id, i, keys, true)).join('')}
          </div>
        </div>

        <div class="rpg__dock">
          <div class="rpg__bones" data-bones>
            <div class="rpg__bones-head">
              <span>Bones of Holding</span>
              <em data-weapon-name></em>
            </div>
            <div class="rpg__bones-row" data-bone-weapons></div>
            <div class="rpg__bones-row rpg__bones-row--items" data-bone-items></div>
          </div>
          <div class="rpg__loadout" data-loadout>
            ${loadout.map((id, i) => slotMarkup(id, i, keys, false)).join('')}
          </div>
          <div class="rpg__caption" data-caption></div>
        </div>

        <div class="rpg__pack" data-pack title="Right click to wear"></div>
      </div>

      <div class="rpg__range" data-range></div>
      <div class="rpg__world-bars" data-world-bars></div>
      <div class="rpg__dummy is-hidden" data-dummy hidden>
        <div class="rpg__dummy-name" data-dummy-name>Boss Dummy</div>
        <div class="rpg-bar rpg-bar--hp rpg-bar--dummy">
          <i data-dummy-fill></i><span data-dummy-text></span>
        </div>
      </div>
      <div class="rpg__floats" data-floats></div>

      <div class="rpg-draw is-hidden" data-draw>
        <div class="rpg-draw__track">
          <span class="rpg-draw__tick" data-draw-tick></span>
        </div>
        <em data-draw-label>Draw</em>
      </div>

      <div class="rpg__sheet is-hidden" data-sheet>
        <div class="rpg__sheet-card">
          <header class="rpg__sheet-head">
            <div>
              <p class="rpg__kicker">Warlords · attributes v2.1.0</p>
              <h2>Warlord Sheet</h2>
            </div>
            <button type="button" class="rpg__ghost" data-close-sheet>Close</button>
          </header>
          <p class="rpg__lead">Eight ATTR ratings fold into HP / MP / SP, crit, block, and √Defense mitigation. Class is flavor — every Warlord can wear every weapon. The weapon owns the 1-2-3. Right-click pack cells to wear kit.</p>

          <section>
            <h3>Race</h3>
            <div class="rpg__factions" data-races></div>
          </section>
          <section data-class-section>
            <h3>Class</h3>
            <div class="rpg__classes" data-classes></div>
          </section>
          <section>
            <h3>Attributes</h3>
            <div class="rpg__stats" data-stats></div>
          </section>
          <section>
            <h3>Worn</h3>
            <div class="rpg__gear" data-gear></div>
          </section>
          <section>
            <h3>Armed skill</h3>
            <div class="rpg__inspect" data-inspect></div>
          </section>
        </div>
      </div>
    `;
  }

  _bindBones() {
    this.els.boneWeapons?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-weapon]');
      if (!btn) return;
      event.stopPropagation();
      if (this.actor.setWeapon(btn.dataset.weapon)) {
        this.rebuildLoadout();
        this._mutated('weapon');
      }
    });
    this.els.boneItems?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-item]');
      if (!btn) return;
      event.stopPropagation();
      this._wear(btn.dataset.item);
    });
  }

  _paintBones() {
    const classId = this.actor.classId;
    const current = this.actor.weaponType;
    const weapon = getWeapon(current);
    if (this.els.weaponName) {
      this.els.weaponName.textContent = weapon.draw
        ? `${weapon.name} · hold LMB, release green`
        : `${weapon.name} · ${weapon.family === 'melee' ? 'step in' : 'make space'}`;
    }
    if (this.els.boneWeapons) {
      this.els.boneWeapons.innerHTML = WEAPON_ORDER
        .map((id) => {
          const row = getWeapon(id);
          const preferred = isPreferredWeapon(classId, id);
          return `<button type="button" class="rpg-bone${id === current ? ' is-on' : ''}${preferred ? ' is-pref' : ''}" data-weapon="${id}" title="${row.name} — ${row.blurb}${preferred ? ' · class flavor' : ''}">
            <span class="rpg-bone__mark">${row.mark}</span>
            <span class="rpg-bone__name">${row.name}</span>
          </button>`;
        })
        .join('');
    }
    if (this.els.boneItems) {
      const bones = this.actor.bones;
      this.els.boneItems.innerHTML = bones
        .map((id) => {
          const item = ITEMS[id];
          if (!item) return '';
          const on = this.actor.equipped[item.slot] === id;
          return `<button type="button" class="rpg-bone rpg-bone--item${on ? ' is-on' : ''}" data-item="${id}" title="${item.name} — ${item.blurb}">
            <b>${itemMark(id)}</b>
            <span class="rpg-bone__name">${item.name}</span>
          </button>`;
        })
        .join('');
    }
  }

  _bindLoadout() {
    const nodes = [
      ...this.els.loadout.querySelectorAll('[data-slot]'),
      ...this.els.minis.querySelectorAll('[data-slot]')
    ];
    this.slots = nodes;
    for (const slot of nodes) {
      slot.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const id = slot.dataset.skill;
        if (id) this.onArm?.(id);
      });
    }
  }

  paintStatic() {
    this.els.races.innerHTML = Object.values(FACTIONS)
      .map((faction) => {
        const races = Object.values(RACES).filter((race) => race.faction === faction.id);
        const buttons = races
          .map(
            (race) => `
        <button type="button" class="rpg-race" data-race="${race.id}" style="--swatch:${race.swatch ?? faction.color}">
          <span class="rpg-race__mark" aria-hidden="true"></span>
          <b>${race.name}</b>
        </button>`
          )
          .join('');
        return `<div class="rpg__faction" style="--faction:${faction.color}">
          <p>${faction.short}</p>
          <div class="rpg__races">${buttons}</div>
        </div>`;
      })
      .join('');
    this.els.classes.innerHTML = Object.values(CLASSES)
      .map(
        (klass) => `
        <button type="button" class="rpg-class" data-class="${klass.id}">
          <span class="rpg-class__rune">${RUNES[klass.id] ?? RUNES.warrior}</span>
          <b>${klass.name}</b>
          <span>${klass.blurb}</span>
        </button>`
      )
      .join('');

    this.els.races.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-race]');
      if (!btn) return;
      event.stopPropagation();
      if (this.actor.setRace(btn.dataset.race)) this._mutated('race');
    });
    this.els.classes.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-class]');
      if (!btn) return;
      event.stopPropagation();
      if (this.actor.setClass(btn.dataset.class)) {
        this._selected = this.actor.loadout[0];
        this.rebuildLoadout();
        this._mutated('class');
      }
    });
    this.els.gear.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-item]');
      if (!btn) return;
      event.stopPropagation();
      this._wear(btn.dataset.item);
    });

    this._paintIdentity(this.actor.snapshot());
  }

  rebuildLoadout() {
    const loadout = this.actor.loadout;
    const keys = this.actor.klass.keys;
    this.els.loadout.innerHTML = loadout.map((id, i) => slotMarkup(id, i, keys, false)).join('');
    this.els.minis.innerHTML = loadout.map((id, i) => slotMarkup(id, i, keys, true)).join('');
    this._slotCd.clear();
    this._bindLoadout();
    this._paintBones();
    this._selected = loadout.includes(this._selected) ? this._selected : loadout[0];
  }

  _wear(itemId) {
    if (!itemId || !ITEMS[itemId]) return;
    const item = ITEMS[itemId];
    if (this.actor.equip(itemId)) {
      this._inspectItem = itemId;
      this.rebuildLoadout();
      this._mutated(item.slot === 'weapon' || item.slot === 'offhand' ? 'weapon' : 'gear');
      this._writeItemCaption(itemId, true);
    }
  }

  _mutated(kind = 'stats') {
    this.refresh();
    this.onMutate?.(kind);
  }

  toggleSheet() {
    this.sheetOpen = !this.sheetOpen;
    this.els.sheet.classList.toggle('is-hidden', !this.sheetOpen);
    if (this.sheetOpen) this.refresh();
  }

  closeSheet() {
    if (!this.sheetOpen) return;
    this.sheetOpen = false;
    this.els.sheet.classList.add('is-hidden');
  }

  setSelected(id) {
    this._selected = id;
    for (const slot of this.slots) {
      slot.classList.toggle('is-active', slot.dataset.skill === id);
    }
    this._writeCaption(this.actor.resolve(id));
    if (this.sheetOpen) this._paintInspect(this.actor.snapshot());
  }

  setArmed(armed) {
    this.els.loadout.classList.toggle('is-armed', armed);
  }

  setCooldown(skillId, remaining, total) {
    const ratio = Math.max(0, Math.min(1, remaining / Math.max(total, 0.001)));
    const last = this._slotCd.get(skillId) ?? -1;
    if (Math.abs(ratio - last) < 0.01) return;
    this._slotCd.set(skillId, ratio);
    for (const slot of this.slots) {
      if (slot.dataset.skill !== skillId) continue;
      slot.style.setProperty('--cooldown', String(ratio));
      slot.classList.toggle('is-cooling', ratio > 0.001);
    }
  }

  setDummy(state) {
    this.setRange(state ? [ { ...state, id: 'boss', name: 'Boss Dummy', role: 'hostile' } ] : []);
  }

  setRange(frames) {
    if (!this.els.range || !this.els.worldBars) return;
    const list = Array.isArray(frames) ? frames : [];
    if (this._rangeIds !== list.map((row) => row.id).join(',')) {
      this._rangeIds = list.map((row) => row.id).join(',');
      this.els.range.innerHTML = list
        .map(
          (row) => `
        <div class="rpg-range__row" data-range-id="${row.id}" data-role="${row.role}">
          <b>${row.name}</b>
          <div class="rpg-bar rpg-bar--hp rpg-bar--dummy">
            <i data-range-fill></i><span data-range-text></span>
          </div>
        </div>`
        )
        .join('');
      this.els.worldBars.innerHTML = list
        .map(
          (row) => `
        <div class="rpg__dummy" data-world-id="${row.id}" data-role="${row.role}">
          <div class="rpg__dummy-name">${row.name}</div>
          <div class="rpg-bar rpg-bar--hp rpg-bar--dummy">
            <i data-world-fill></i><span data-world-text></span>
          </div>
        </div>`
        )
        .join('');
    }
    for (const row of list) {
      const roster = this.els.range.querySelector(`[data-range-id="${row.id}"]`);
      if (roster) {
        roster.classList.toggle('is-down', !!row.down);
        const fill = roster.querySelector('[data-range-fill]');
        const text = roster.querySelector('[data-range-text]');
        const ratio = row.hp / Math.max(row.hpMax, 1);
        if (fill) fill.style.width = `${Math.round(ratio * 1000) / 10}%`;
        if (text) text.textContent = row.down ? 'Reforming' : `${Math.round(row.hp)} / ${Math.round(row.hpMax)}`;
      }
      const world = this.els.worldBars.querySelector(`[data-world-id="${row.id}"]`);
      if (world) {
        world.classList.toggle('is-visible', row.visible !== false);
        world.classList.toggle('is-down', !!row.down);
        if (typeof row.x === 'number' && typeof row.y === 'number') {
          world.style.transform = `translate(${Math.round(row.x)}px, ${Math.round(row.y)}px) translate(-50%, -130%)`;
        }
        const fill = world.querySelector('[data-world-fill]');
        const text = world.querySelector('[data-world-text]');
        const ratio = row.hp / Math.max(row.hpMax, 1);
        if (fill) fill.style.width = `${Math.round(ratio * 1000) / 10}%`;
        if (text) text.textContent = row.down ? 'Reforming' : `${Math.round(row.hp)} / ${Math.round(row.hpMax)}`;
      }
    }
  }

  floatDamage({ amount, crit, blocked, tag, x, y }) {
    const node = document.createElement('div');
    node.className = `rpg-float${crit ? ' is-crit' : ''}${blocked ? ' is-block' : ''}${tag === 'heal' ? ' is-heal' : ''}`;
    node.textContent = blocked ? `${amount} block` : crit ? `${amount} crit` : String(amount);
    if (tag) {
      const sub = document.createElement('em');
      sub.textContent = tag;
      node.appendChild(sub);
    }
    const originX = x ?? innerWidth * 0.62;
    const originY = y ?? innerHeight * 0.42;
    node.style.left = `${originX}px`;
    node.style.top = `${originY}px`;
    this.els.floats.appendChild(node);
    requestAnimationFrame(() => node.classList.add('is-on'));
    setTimeout(() => {
      node.classList.remove('is-on');
      node.classList.add('is-off');
    }, 520);
    setTimeout(() => node.remove(), 900);
  }

  _paintIdentity(snap) {
    this.els.name.textContent = snap.name;
    this.els.title.textContent = snap.title;
    this.els.level.textContent = snap.level;
    this.els.rune && (this.els.rune.innerHTML = RUNES[snap.classId] ?? RUNES.warrior);
    this.host.dataset.class = snap.classId;
    this.host.dataset.race = snap.raceId;
    const swatch = snap.race?.swatch ?? '#6a8f72';
    this.els.portrait?.style.setProperty('--swatch', swatch);
  }

  _writeCaption(resolved) {
    if (!resolved) return;
    const cost = resolved.cost
      ? `${resolved.cost} ${resolved.costType === 'mp' ? 'MP' : 'STA'}`
      : 'free';
    const grant = resolved.grantName ? ` · ${resolved.grantName}` : '';
    const off = resolved.onWeapon ? '' : ' · off-hand';
    const text = `${resolved.name} · ${resolved.damage} dmg · ${fmt(resolved.range, 1)}m · ${fmt(resolved.cooldown, 2)}s · ${cost}${grant}${off}`;
    if (text === this._caption) return;
    this._caption = text;
    this.els.caption.textContent = text;
  }

  _writeItemCaption(itemId, worn = false) {
    const item = ITEMS[itemId];
    if (!item) return;
    const verb = worn ? 'Worn' : 'Right click to wear';
    this._caption = `${item.name} · ${SLOT_LABEL[item.slot] ?? item.slot} · ${verb}`;
    this.els.caption.textContent = this._caption;
  }

  _paintPack(snap) {
    const worn = GEAR_SLOTS.map((slot) => snap.equipped[slot]).filter(Boolean);
    const rest = this.actor.inventory.filter((id) => !worn.includes(id));
    const bag = [...new Set([...worn, ...rest])].slice(0, 30);
    while (bag.length < 30) bag.push(null);
    this.els.pack.innerHTML = bag
      .map((id) => {
        if (!id || !ITEMS[id]) return `<div class="rpg-cell is-empty"></div>`;
        const item = ITEMS[id];
        const on = snap.equipped[item.slot] === id;
        const actives = (item.abilities || []).length;
        return `<button type="button" class="rpg-cell${on ? ' is-on' : ''}" data-item="${id}" data-slot="${item.slot}" title="${item.name} — ${SLOT_LABEL[item.slot] ?? item.slot}${actives ? ` · ${actives} HUD skill${actives > 1 ? 's' : ''}` : ''} — Right click to wear">
          <b>${itemMark(id)}</b>
          <span>${item.name}</span>
        </button>`;
      })
      .join('');
  }

  _paintSheet(snap) {
    for (const btn of this.els.races.querySelectorAll('[data-race]')) {
      btn.classList.toggle('is-on', btn.dataset.race === snap.raceId);
    }
    for (const btn of this.els.classes.querySelectorAll('[data-class]')) {
      btn.classList.toggle('is-on', btn.dataset.class === snap.classId);
    }

    this.els.stats.innerHTML = attrSheetHtml(snap);

    this.els.gear.innerHTML = SLOT_GROUPS.map((group) => {
      const blocks = group.slots
        .map((slot) => {
          const equipped = snap.equipped[slot];
          const item = ITEMS[equipped];
          const choices = itemsForSlot(slot, this.actor.inventory);
          const empty = !choices.length
            ? `<span class="rpg-slot-block__empty">${slot === 'offhand' && snap.family !== 'melee' ? 'Two-hand — no off-hand' : 'none in pack'}</span>`
            : '';
          return `
            <div class="rpg-slot-block">
              <div class="rpg-slot-block__label">${SLOT_LABEL[slot]} · ${item?.name ?? 'empty'}${item?.abilities?.length ? ' · HUD' : ''}</div>
              <div class="rpg-slot-block__items">
                ${choices
                  .map((id) => {
                    const row = ITEMS[id];
                    const on = id === equipped;
                    const skills = (row.abilities || []).map((skill) => row.abilityNames?.[skill] || skill).join(', ');
                    return `<button type="button" class="rpg-item${on ? ' is-on' : ''}" data-item="${id}">
                      <b>${row.name}</b>
                      <span>${skills ? `${skills} · ${row.blurb}` : row.blurb}</span>
                    </button>`;
                  })
                  .join('')}
                ${empty}
              </div>
            </div>`;
        })
        .join('');
      return `<div class="rpg-slot-group"><h4>${group.title}</h4>${blocks}</div>`;
    }).join('');

    this._paintInspect(snap);
  }

  _paintInspect(snap) {
    const resolved = this.actor.resolve(this._selected);
    const match = Math.round(resolved.match * 100);
    const grantLine = resolved.grantName
      ? `<p>Granted by ${resolved.grantName}${resolved.grantedBy === 'weapon' ? ' combo' : resolved.grantedBy === 'class' ? ' flavor' : ''}</p>`
      : '';
    const item = ITEMS[this._inspectItem];
    const itemLine = item
      ? `<p>${item.name} · ${SLOT_LABEL[item.slot] ?? item.slot}${item.abilities?.length ? ` · HUD: ${(item.abilities || []).map((id) => item.abilityNames?.[id] || id).join(', ')}` : ''} · ${item.blurb}</p>`
      : '';
    this.els.inspect.innerHTML = `
      <div class="rpg-inspect">
        <div class="rpg-inspect__title">${resolved.name}</div>
        <div class="rpg-inspect__grid">
          <div><span>Damage</span><b>${resolved.damage}</b></div>
          <div><span>Range</span><b>${fmt(resolved.range, 1)} m</b></div>
          <div><span>Cooldown</span><b>${fmt(resolved.cooldown, 2)} s</b></div>
          <div><span>Cost</span><b>${resolved.cost} ${resolved.costType === 'mp' ? 'MP' : 'STA'}</b></div>
          <div><span>Weapon</span><b>${snap.weaponName ?? snap.weaponType}</b></div>
          <div><span>Motion</span><b>${snap.family === 'ranged' ? 'make space' : 'step in'}</b></div>
          <div><span>Crit</span><b>${formatSecondary('criticalChance', resolved.critChance)}</b></div>
          <div><span>Crit factor</span><b>${formatSecondary('criticalDamage', resolved.critMul)}</b></div>
          <div><span>Dummy take</span><b>${takenPercent(dummyDefenseFor(snap.level))}%</b></div>
        </div>
        <p>Gear scalar ${snap.gear.skillScalar.toFixed(2)} · reach ${snap.gear.rangeMul.toFixed(2)} · CDR ${Math.round(snap.gear.cdr * 100)}%</p>
        ${grantLine}
        ${itemLine}
      </div>`;
  }

  refresh() {
    const snap = this.actor.snapshot();
    this._paintIdentity(snap);
    this._setBar(this.els.hpFill, this.els.hpText, snap.hp, snap.hpMax);
    this._setBar(this.els.staFill, this.els.staText, snap.sta, snap.staMax);
    this._setBar(this.els.mpFill, this.els.mpText, snap.mp, snap.mpMax);
    this.els.staBar?.classList.toggle('is-empty', snap.staMax <= 0);
    this.els.mpBar?.classList.toggle('is-empty', snap.mpMax <= 0);
    const xpRatio = snap.level >= 20 ? 1 : snap.xp / Math.max(snap.xpNext, 1);
    this.els.xpFill.style.width = `${Math.round(xpRatio * 1000) / 10}%`;

    for (const slot of this.slots) {
      const id = slot.dataset.skill;
      const resolved = this.actor.resolve(id);
      slot.classList.toggle('is-active', id === this._selected);
      slot.classList.toggle('is-offhand', !resolved.onWeapon);
      slot.title = `${resolved.name} — ${resolved.damage} dmg`;
    }
    this._writeCaption(this.actor.resolve(this._selected));
    this._paintBones();
    this._paintPack(snap);
    if (this.sheetOpen) this._paintSheet(snap);
  }

  _setBar(fill, text, value, max) {
    const ratio = value / Math.max(max, 1);
    fill.style.width = `${Math.round(ratio * 1000) / 10}%`;
    text.textContent = `${Math.round(value)} / ${Math.round(max)}`;
  }

  tick() {
    const pools = this.actor.pools();
    this._setBar(this.els.hpFill, this.els.hpText, this.actor.hp, pools.hp);
    this._setBar(this.els.staFill, this.els.staText, this.actor.sta, pools.sta);
    this._setBar(this.els.mpFill, this.els.mpText, this.actor.mp, pools.mp);
  }

  setDraw(state) {
    const el = this.els.draw;
    if (!el) return;
    const active = Boolean(state?.active);
    el.classList.toggle('is-hidden', !active);
    if (!active) {
      el.dataset.band = '';
      return;
    }
    const t = Math.max(0, Math.min(1, state.t ?? 0));
    const zone = state.zone;
    if (this.els.drawTick) this.els.drawTick.style.bottom = `${(t * 100).toFixed(1)}%`;
    el.dataset.band = zone?.band || '';
    if (this.els.drawLabel) this.els.drawLabel.textContent = zone?.label || 'Draw';
  }

  dispose() {
    this.host.remove();
  }
}
