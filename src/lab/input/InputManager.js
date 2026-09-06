// @ts-nocheck
import { Vector2 } from 'three';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Normalises pointer + keyboard input into a small event vocabulary.
 *
 * Events:
 *   `pointer:move` (ndc)          — every move, armed or not
 *   `pointer:confirm` (ndc)       — left click on the viewport
 *   `action` (name, slot)         — everything else, already named by intent.
 *                                   `ability` carries the 0-based slot index,
 *                                   which App maps through `ELEMENTS`; `boost`
 *                                   and `magic` carry nothing, because the self
 *                                   buffs have no slot and nothing to aim.
 *
 * Pointer events that begin on top of DOM UI (the editor, the HUD) are ignored
 * so dragging a slider never fires the ability.
 */
export class InputManager extends EventEmitter {
  constructor(domElement) {
    super();
    this.dom = domElement;
    this.pointer = new Vector2(); // NDC
    this.keys = new Set();
    this.enabled = true;
    this._leftDown = false;
    this._shiftHeld = false;
    this._shiftAsModifier = false;
    this.touchX = 0;
    this.touchZ = 0;

    this._bind();
  }

  _bind() {
    this.dom.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onBlur);
    this.dom.addEventListener('contextmenu', this._onContextMenu);
  }

  _onContextMenu = (event) => event.preventDefault();

  _updatePointer(event) {
    this.pointer.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
  }

  _onPointerDown = (event) => {
    if (!this.enabled) return;
    if (event.target !== this.dom) return; // started on UI

    this._updatePointer(event);

    if (event.button === 0) {
      this._leftDown = true;
      this.emit('pointer:down', this.pointer);
      this.emit('pointer:confirm', this.pointer);
    } else if (event.button === 2) {
      // Right button also orbits (OrbitControls owns the drag); putting an armed
      // cast away on the same press is the convention players expect.
      this.emit('action', 'cancel');
    }
  };

  _onPointerUp = (event) => {
    if (event.button !== 0) return;
    if (!this._leftDown) return;
    this._leftDown = false;
    this._updatePointer(event);
    this.emit('pointer:up', this.pointer);
  };

  _onPointerMove = (event) => {
    this._updatePointer(event);
    this.emit('pointer:move', this.pointer);
  };

  _onKeyDown = (event) => {
    if (event.repeat) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    this.keys.add(event.code);

    if (
      event.code === 'KeyW' ||
      event.code === 'KeyA' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight' ||
      event.code === 'Space'
    ) {
      event.preventDefault();
    }

    switch (event.code) {
      // Combat row is the class loadout (1–6). Q / E still pull the first and
      // last loadout slots — the old linear letters keep the lab extras.
      case 'Space':
        this.emit('action', 'dash');
        break;
      case 'Digit1':
      case 'KeyQ':
        this.emit('action', 'loadout', 0);
        break;
      case 'Digit2':
        this.emit('action', 'loadout', 1);
        break;
      case 'Digit3':
        this.emit('action', 'loadout', 2);
        break;
      case 'Digit4':
        this.emit('action', 'loadout', 3);
        break;
      case 'Digit5':
        this.emit('action', 'loadout', 4);
        break;
      case 'Digit6':
      case 'KeyE':
        this.emit('action', 'loadout', 5);
        break;
      case 'BracketLeft':
      case 'Comma':
        this.emit('action', 'weaponPrev');
        break;
      case 'BracketRight':
      case 'Period':
        this.emit('action', 'weaponNext');
        break;
      case 'KeyR':
        this.emit('action', 'ability', 2);
        break;
      case 'KeyF':
        this.emit('action', 'classF');
        break;
      case 'KeyV':
        this.emit('action', 'ability', 4);
        break;
      case 'KeyX':
        this.emit('action', 'ability', 5);
        break;
      case 'KeyZ':
        this.emit('action', 'ability', 6);
        break;
      case 'KeyT':
        this.emit('action', 'ability', 7);
        break;
      case 'KeyY':
        this.emit('action', 'ability', 8);
        break;
      case 'KeyN':
        this.emit('action', 'ability', 9);
        break;
      case 'Digit7':
        this.emit('action', 'named', 'shadowClone');
        break;
      case 'Digit8':
        this.emit('action', 'named', 'skyFist');
        break;
      case 'Digit9':
        this.emit('action', 'named', 'skyBlades');
        break;
      case 'Digit0':
        this.emit('action', 'named', 'shadowStep');
        break;
      case 'KeyO':
        this.emit('action', 'named', 'iceNova');
        break;
      case 'KeyL':
        this.emit('action', 'toggleLibrary');
        break;
      case 'KeyJ':
        this.emit('action', 'toggleCombat');
        break;
      // Self buffs. Shift+key cycles the aura variant instead of toggling.
      case 'KeyB':
        if (this._shiftHeld) {
          this._shiftAsModifier = true;
          this.emit('action', 'boostCycle');
        } else {
          this.emit('action', 'boost');
        }
        break;
      case 'KeyM':
        if (this._shiftHeld) {
          this._shiftAsModifier = true;
          this.emit('action', 'magicCycle');
        } else {
          this.emit('action', 'magic');
        }
        break;
      case 'KeyK':
        if (this._shiftHeld) {
          this._shiftAsModifier = true;
          this.emit('action', 'fireCycle');
        } else {
          this.emit('action', 'fire');
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this._shiftHeld = true;
        this._shiftAsModifier = false;
        break;
      case 'KeyI':
        this.emit('action', 'toggleSheet');
        break;
      case 'Escape':
        this.emit('action', 'cancel');
        break;
      case 'KeyH':
        this.emit('action', 'toggleHelp');
        break;
      case 'KeyG':
        this.emit('action', 'toggleEditor');
        break;
      case 'KeyC':
        this.emit('action', 'clear');
        break;
      case 'KeyP':
        this.emit('action', 'togglePause');
        break;
      default:
        break;
    }
  };

  _onKeyUp = (event) => {
    this.keys.delete(event.code);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      const wasModifier = this._shiftAsModifier;
      this._shiftHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      this._shiftAsModifier = false;
      if (!wasModifier && !this._shiftHeld) this.emit('action', 'dash');
    }
    if (
      event.code === 'Digit1' ||
      event.code === 'KeyQ' ||
      event.code === 'Digit2' ||
      event.code === 'Digit3'
    ) {
      this.emit('action', 'holdRelease');
    }
  };

  _onBlur = () => {
    this.keys.clear();
    this._leftDown = false;
    this._shiftHeld = false;
    this.touchX = 0;
    this.touchZ = 0;
  };

  /**
   * Camera-relative move intent. W/↑ +forward, S/↓ back, A/← left, D/→ right.
   * Touch stick and a standard gamepad left-stick/D-pad merge in here.
   */
  moveAxis() {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    x += this.touchX;
    z += this.touchZ;
    return this._clampAxis(x, z);
  }

  sampleMove() {
    let { x, z } = this.moveAxis();
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() ?? [] : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const mag = Math.hypot(ax, ay);
      if (mag > 0.18) {
        const scale = (mag - 0.18) / (1 - 0.18);
        x += (ax / mag) * scale;
        z += (-ay / mag) * scale;
      }
      if (pad.buttons[12]?.pressed) z += 1;
      if (pad.buttons[13]?.pressed) z -= 1;
      if (pad.buttons[14]?.pressed) x -= 1;
      if (pad.buttons[15]?.pressed) x += 1;
    }
    return this._clampAxis(x, z);
  }

  _clampAxis(x, z) {
    const mag = Math.hypot(x, z);
    if (mag > 1) {
      x /= mag;
      z /= mag;
    }
    return { x, z };
  }

  setTouch(x = 0, z = 0) {
    this.touchX = x;
    this.touchZ = z;
  }

  setHeld(codes = []) {
    this.keys = new Set(codes);
    this.touchX = 0;
    this.touchZ = 0;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onBlur);
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    this.clear();
  }
}
