// @ts-nocheck
import { settings } from '../config/settings.js';
import {
  AURA_DEFAULTS,
  AURA_FORMS,
  AURA_ROLES,
  AURA_VARIANT_IDS,
  applyAuraToBlock,
  cycleAuraId,
  variantMeta
} from '../rpg/auras.js';

/**
 * Owns colour variants + short role pulses on the three production boosts.
 *
 * B / M / K still toggle the form. Shift+B/M/K cycles that form's palette.
 * Roles (stun, buff, debuff, cast, channel) briefly light the matching form
 * without stacking a second mesh set.
 */
export class AuraDirector {
  /**
   * @param {object} opts
   * @param {{fire: object, magic: object, boost: object}} opts.buffs
   * @param {(msg: string) => void} [opts.onToast]
   * @param {(form: string, variant: object) => void} [opts.onChange]
   */
  constructor({ buffs, onToast, onChange } = {}) {
    this.buffs = buffs;
    this.onToast = onToast;
    this.onChange = onChange;
    this._pulses = { fire: null, magic: null, boost: null };
    this._time = 0;
    this._userHeld = { fire: false, magic: false, boost: false };

    if (!settings.aura) settings.aura = { ...AURA_DEFAULTS };
    for (const form of AURA_FORMS) {
      if (!AURA_VARIANT_IDS.includes(settings.aura[form])) {
        settings.aura[form] = AURA_DEFAULTS[form];
      }
      applyAuraToBlock(form, settings.aura[form]);
    }
  }

  variantOf(form) {
    return settings.aura?.[form] || AURA_DEFAULTS[form];
  }

  setVariant(form, variantId, { silent = false } = {}) {
    if (!AURA_FORMS.includes(form)) return this.variantOf(form);
    const id = AURA_VARIANT_IDS.includes(variantId) ? variantId : AURA_DEFAULTS[form];
    settings.aura[form] = id;
    applyAuraToBlock(form, id);
    const meta = variantMeta(id);
    this.onChange?.(form, meta);
    if (!silent) this.onToast?.(`${labelOf(form)} · ${meta.label}`);
    return id;
  }

  cycle(form) {
    return this.setVariant(form, cycleAuraId(this.variantOf(form)));
  }

  markUser(form, held) {
    this._userHeld[form] = Boolean(held);
    if (held && this._pulses[form]) this._pulses[form].owned = false;
  }

  /**
   * Flash a form as a status tell. If the buff is already user-held, only
   * punch the light; if not, activate it for `duration` seconds then release.
   */
  pulse(role, opts = {}) {
    const spec = AURA_ROLES[role];
    if (!spec && !opts.form) return false;
    const form = opts.form || spec.form;
    const variant = opts.variant || spec?.variant || this.variantOf(form);
    if (variant) this.setVariant(form, variant, { silent: true });

    const buff = this.buffs[form];
    if (!buff) return false;

    const owned = !buff.active && !this._userHeld[form];
    if (!buff.active) {
      if (!buff.activate()) return false;
    } else {
      buff._lightBoost = (buff._lightBoost || 0) + 6;
    }

    const duration = Math.max(0.2, opts.duration ?? spec?.duration ?? 0.6);
    this._pulses[form] = {
      role: role || 'cast',
      until: this._time + duration,
      owned
    };
    if (!opts.silent) {
      const name = spec?.label || role || 'Aura';
      this.onToast?.(`${name} · ${variantMeta(this.variantOf(form)).label}`);
    }
    return true;
  }

  releasePulse(form) {
    const pulse = this._pulses[form];
    if (!pulse) return;
    if (pulse.owned && !this._userHeld[form]) this.buffs[form]?.cancel();
    this._pulses[form] = null;
  }

  update(dt) {
    this._time += dt;
    for (const form of AURA_FORMS) {
      const pulse = this._pulses[form];
      if (!pulse) continue;
      if (this._time < pulse.until) continue;
      if (pulse.owned && !this._userHeld[form]) this.buffs[form]?.cancel();
      this._pulses[form] = null;
    }
  }

  snapshot() {
    return {
      fire: this.variantOf('fire'),
      magic: this.variantOf('magic'),
      boost: this.variantOf('boost'),
      pulses: Object.fromEntries(
        AURA_FORMS.map((form) => [form, this._pulses[form]?.role ?? null])
      )
    };
  }
}

function labelOf(form) {
  if (form === 'fire') return 'Fire Boost';
  if (form === 'magic') return 'Magic Boost';
  return 'Electric Boost';
}
