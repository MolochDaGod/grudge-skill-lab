// @ts-nocheck
import { Vector3, MathUtils } from 'three';

import { Renderer } from './Renderer.js';
import { Time } from './Time.js';
import { CameraRig } from './CameraRig.js';
import { frame } from './FrameUniforms.js';

import { Environment } from '../world/Environment.js';
import { Ground } from '../world/Ground.js';
import { DustMotes } from '../world/DustMotes.js';
import { ContactShadows } from '../world/ContactShadows.js';
import { WorldProps } from '../world/WorldProps.js';

import { AssetLoader } from '../loaders/AssetLoader.js';
import { CharacterController } from '../animation/CharacterController.js';

import { InputManager } from '../input/InputManager.js';
import { AimController } from '../input/AimController.js';

import { ParticleEngine } from '../particles/ParticleEngine.js';
import { LightPool } from '../effects/LightPool.js';
import { DecalSystem } from '../effects/GroundDecals.js';
import { BurstSystem } from '../effects/BurstSphere.js';
import { CameraShake } from '../effects/CameraShake.js';
import { ScreenFlash } from '../effects/ScreenFlash.js';
import { ElectricBoost } from '../effects/ElectricBoost.js';
import { MagicBoost } from '../effects/MagicBoost.js';
import { FireBoost } from '../effects/FireBoost.js';
import { AuraDirector } from '../effects/AuraDirector.js';
import { WindMist } from '../effects/WindMist.js';
import { loadTotemKit } from '../abilities/TotemAbility.js';
import { classFSkill, totemSpec } from '../rpg/totems.js';
import { RigHelpers } from '../animation/RigHelpers.js';
import { CombatPanel } from '../ui/CombatPanel.js';
import { variantMeta } from '../rpg/auras.js';

import { AbilityManager } from '../abilities/AbilityManager.js';
import { PostProcessing } from '../postprocessing/PostProcessing.js';

import { HUD, LoadingScreen } from '../ui/HUD.js';
import { Editor } from '../ui/Editor.js';
import { LibraryPanel } from '../ui/LibraryPanel.js';

import { settings, ELEMENTS, CastShape } from '../config/settings.js';
import { RACE_MESHES } from '../config/library.js';
import { Actor } from '../rpg/actor.js';
import { loadSave, persistActor, bindAutosave, schedulePersist } from '../rpg/save.js';
import { RpgHud } from '../rpg/RpgHud.js';
import { resolveCastHit, resolveCastHits, dummyHpFor } from '../rpg/combat.js';
import { rollDamage, dummyXp } from '../rpg/formulas.js';
import { mitigateIncoming, dummyDerivedFor } from '../rpg/grudgeMath.js';
import { isComboSkill } from '../animation/comboClips.js';
import {
  getWeapon,
  weaponsForClass,
  usesDraw,
  drawSpec,
  drawZoneAt,
  chargeSpec,
  skillCastMode,
  comboHit
} from '../rpg/weapons.js';
import { BowChargeFx } from '../effects/BowChargeFx.js';
import { ScriptHost } from '../scripts/ScriptHost.js';
import { ScriptPanel } from '../ui/ScriptPanel.js';

const HDR_URL = './hdri/spruit_sunrise.hdr';

/**
 * Application root: owns every subsystem and the frame loop.
 *
 * The wiring is deliberately one-directional — App builds the systems, hands the
 * ability manager a context object of the shared services, and then does nothing
 * but order the per-frame updates. No subsystem reaches back into App.
 *
 * The interaction is a single loop: select and arm an ability (Q / E), swing the
 * ground arrow with the mouse, click to fire. `AimController` owns the targeting
 * and emits one `cast` event; App turns that into an ability, a heading for the
 * character and a cooldown.
 *
 * The three boosts (B, M, K) are the things outside that loop: self buffs with
 * nothing to aim, so they skip targeting entirely and are simply switched on.
 * They are independent — any of them, all of them or none can be running.
 */
export class App {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.time = new Time();
    this.elapsed = 0;
    this.paused = false;
    this._raf = 0;

    /**
     * Seconds left before each ability can be armed again. Per element, so
     * spending one slot never locks the other out.
     */
    this.cooldowns = new Map(ELEMENTS.map((element) => [element, 0]));

    /* ---- core ---- */
    this.renderer = new Renderer(canvas);
    this.rig = new CameraRig(canvas);
    this.camera = this.rig.camera;

    this.environment = new Environment(this.renderer, this.camera);
    this.scene = this.environment.scene;

    /* ---- world ---- */
    this.ground = new Ground(this.environment);
    this.dust = new DustMotes();
    this.contactShadows = new ContactShadows(this.renderer, { size: 2.6, height: 2.4, blur: 2.0 });

    this.scene.add(this.ground.mesh, this.dust.points, this.contactShadows.group);

    this.world = new WorldProps(this.scene);
    this.dust.setPixelRatio(this.renderer.gl.getPixelRatio());

    /* ---- shared VFX services ---- */
    this.particles = new ParticleEngine(this.scene);
    this.wind = new WindMist(this.particles);
    this.lights = new LightPool(this.scene);
    this.decals = new DecalSystem(this.scene);
    this.bursts = new BurstSystem(this.scene);
    this.shake = new CameraShake(this.rig);
    this.flash = new ScreenFlash();

    this.abilities = new AbilityManager({
      scene: this.scene,
      camera: this.camera,
      environment: this.environment,
      particles: this.particles,
      lights: this.lights,
      decals: this.decals,
      bursts: this.bursts,
      shake: this.shake,
      flash: this.flash,
      wind: this.wind
    });
    this.abilities.ctx.abilities = this.abilities;

    /* ---- character ---- */
    this.character = new CharacterController(this.environment);
    this.scene.add(this.character.root);
    this.abilities.ctx.character = this.character;
    this.abilities.ctx.world = this.world;

    /* ---- the self buffs ---- */
    // Built after the character because they are worn *by* it: the arcs are
    // struck on the body's own capsule, the ribbons are wound around it, the
    // flames are rooted on it and the fresnel is on the rig's own materials.
    // None is an ability — nothing aims them and nothing casts them — so they
    // sit beside the ability manager rather than inside it, and take the same
    // services an ability would.
    const buffContext = {
      scene: this.scene,
      particles: this.particles,
      lights: this.lights,
      decals: this.decals,
      bursts: this.bursts,
      shake: this.shake,
      flash: this.flash,
      character: this.character
    };
    this.boost = new ElectricBoost(buffContext);
    this.magic = new MagicBoost(buffContext);
    this.fire = new FireBoost(buffContext);
    this.auras = new AuraDirector({
      buffs: { fire: this.fire, magic: this.magic, boost: this.boost },
      onToast: (message) => this.hud.showToast(message),
      onChange: (form, meta) => {
        this.hud.setAura?.(form, meta);
        this.combatPanel?.setAura(form, meta.id);
        this.editor.refresh();
      }
    });
    this._dashCd = 0;

    /* ---- input & targeting ---- */
    this.input = new InputManager(canvas);
    this.aim = new AimController(this.camera);
    this.aim.shapeWith((id) => {
      const hit = comboHit(this.actor?.weaponType, id);
      if (hit?.cast === 'zone' || hit?.shape === 'zone') return CastShape.ZONE;
      return null;
    });
    this.scene.add(this.aim.object3D);
    this.bowCharge = new BowChargeFx(this.particles);
    this.scene.add(this.bowCharge.object3D);
    this._chargeTip = new Vector3();

    /* ---- post ---- */
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);

    /* ---- UI ---- */
    this.loading = new LoadingScreen(options.loader);
    this.hud = new HUD(options.hud ?? document.getElementById('hud'));
    this.editor = new Editor({
      onClear: () => this.clearEffects(),
      onToast: (message) => this.hud.showToast(message),
      onScripts: () => this.scriptPanel?.toggle(),
      onRecompile: () => {
        const errors = this.scripts?.compile() ?? [];
        this.hud.showToast(errors[0] ? `Script error: ${errors[0].message}` : 'Scripts compiled');
        this.scriptPanel?.refresh();
      },
      onAura: (form, id) => this.auras.setVariant(form, id)
    });

    this.actor = new Actor(loadSave());
    this.hud.root?.classList.add('is-rpg');
    this.rpgHud = new RpgHud(this.hud.root, this.actor);
    this.rpgHud.onArm = (id) => this.activateSkill(id);
    this.rpgHud.onMutate = (kind) => this._onRpgMutate(kind);
    this.library = new LibraryPanel(this.hud.root);
    this.library.onPlay = (actor, clip, loop) => this._playLibraryClip(actor, clip, loop);
    this.library.onArm = (id) => this.activateSkill(id);
    this.library.onBuff = (id) => this._toggleNamedBuff(id);
    this.library.onEditor = () => this.editor.toggle();
    this.library.onStudio = () => window.dispatchEvent(new CustomEvent('lab:toggleStudio'));
    this.library.onSheet = () => this.rpgHud.toggleSheet();
    this.library.onPause = () => this._handleAction('togglePause');
    this.library.onClear = () => this._handleAction('clear');
    this.library.onRace = (id) => this._showRaceMesh(id);
    this.library.onCombat = () => this.combatPanel?.toggle();
    this.library.onHelper = (kind) => {
      if (kind === 'skeleton') {
        this.helpers.setSkeleton(!this.helpers.skeletonOn);
        this.hud.showToast(this.helpers.skeletonOn ? 'Skeleton on' : 'Skeleton off');
      } else {
        this.helpers.togglePanel();
      }
    };
    this.library.onAuraPulse = (role) => {
      this.auras.pulse(role);
      const clip = role === 'channel' ? 'cast2' : role === 'stun' ? 'cast3' : 'cast1';
      this.character.playCast(clip);
    };
    this.combatPanel = new CombatPanel(this.hud.root);
    this.combatPanel.onArm = (id, skill) => {
      if (id && ELEMENTS.includes(id)) {
        this.activateSkill(id);
        this.hud.showToast(skill?.name || id);
      } else {
        this.hud.showToast(`${skill?.name || id} — no lab VFX wired`);
      }
    };
    this.combatPanel.onAuraCycle = (form) => this.auras.cycle(form);
    this.combatPanel.onAuraPulse = (role) => {
      this.auras.pulse(role);
      const clip = role === 'channel' ? 'cast2' : role === 'stun' ? 'cast3' : 'cast1';
      this.character.playCast(clip);
    };
    this.combatPanel.onDash = () => this.tryDash();
    this.combatPanel.onHelper = (kind) => {
      if (kind === 'skeleton') {
        this.helpers.setSkeleton(!this.helpers.skeletonOn);
        this.hud.showToast(this.helpers.skeletonOn ? 'Skeleton on' : 'Skeleton off');
      } else {
        this.helpers.togglePanel();
      }
    };
    this.combatPanel.onShow = () => this.combatPanel.setSnapshot(this.actor.snapshot());
    this.helpers = new RigHelpers({
      character: this.character,
      scene: this.scene,
      root: this.hud.root,
      onPlay: (actor, clip, loop) => this._playLibraryClip(actor, clip, loop)
    });
    this._onLibEvent = () => this._handleAction('toggleLibrary');
    this._onEditorEvent = () => this._handleAction('toggleEditor');
    window.addEventListener('lab:toggleLibrary', this._onLibEvent);
    window.addEventListener('lab:toggleEditor', this._onEditorEvent);
    this.aim.scaleWith((element) => this.actor.aimOverlay(element));
    this._persist = schedulePersist(() => persistActor(this.actor));
    this._saveUnbind = bindAutosave(() => persistActor(this.actor));
    this._sessionPersist = schedulePersist(() => this.editor.presets.persistSession(), 800);
    this._sessionUnbind = bindAutosave(() => this.editor.presets.persistSession());
    this._dummyScreen = new Vector3();
    this._dummyNdc = new Vector3();
    this._draw = { active: false, t: 0, duration: 1.32, skill: 'combo1' };
    this._charge = { active: false, t: 0, duration: 0.92, skill: 'combo2' };
    this._shotQuality = null;

    this._bindEvents();
    this.selectAbility(this.actor.loadout[0], { silent: true });
    for (const form of ['fire', 'magic', 'boost']) {
      this.hud.setAura(form, variantMeta(this.auras.variantOf(form)));
      this.combatPanel.setAura(form, this.auras.variantOf(form));
    }

    this._focusPoint = new Vector3();
  }

  /** The ability currently in the slot. */
  get element() {
    return this.abilities.selected;
  }

  /* ------------------------------------------------------------------ */

  _bindEvents() {
    this.renderer.onResize((width, height, pixelRatio) => {
      this.rig.resize(width, height);
      this.post.setSize(width, height, pixelRatio);
      this.dust.setPixelRatio(pixelRatio);
    });

    this.input.on('pointer:move', (pointer) => this.aim.point(pointer));
    this.input.on('pointer:down', (pointer) => {
      this.aim.point(pointer);
      if (this._shouldCharge()) {
        this._beginCharge();
        return;
      }
      if (this._shouldDraw()) {
        this._beginDraw();
        return;
      }
      this.aim.confirm();
    });
    this.input.on('pointer:up', () => this._releaseHoldSkill());
    this.input.on('action', (action, slot) => this._handleAction(action, slot));

    this.aim.on('cast', (origin, direction, distance) => this._cast(origin, direction, distance));
    this.aim.on('reject', () => this.hud.showToast('Too close — aim further out'));

    this.hud.onAbility = (element) => this.activateSkill(element);
    this.hud.onBoost = () => this.toggleBoost();
    this.hud.onMagic = () => this.toggleMagic();
    this.hud.onFire = () => this.toggleFire();
    this.hud.onAuraCycle = (form) => this.auras.cycle(form);
  }

  _handleAction(action, slot) {
    switch (action) {
      case 'loadout': {
        const element = this.actor.loadout[slot];
        if (!element) break;
        const mode = skillCastMode(this.actor.weaponType, element);
        if (mode === 'draw') this._beginDraw();
        else if (mode === 'charge') this._beginCharge();
        else this.activateSkill(element);
        break;
      }
      case 'classF': {
        const id = classFSkill(this.actor.classId);
        if (id) this.activateSkill(id);
        else this.activateSkill(this.actor.loadout[0]);
        break;
      }
      case 'ability': {
        const element = ELEMENTS[slot] ?? this.element;
        // Pressing the *same* key again puts an armed cast away, as it does in a
        // MOBA; pressing a different one swaps the slot without disarming.
        if (this.aim.isArmed && element === this.element) this.aim.cancel();
        else this.armAbility(element);
        break;
      }
      case 'boost':
        this.toggleBoost();
        break;
      case 'magic':
        this.toggleMagic();
        break;
      case 'fire':
        this.toggleFire();
        break;
      case 'boostCycle':
        this.auras.cycle('boost');
        break;
      case 'magicCycle':
        this.auras.cycle('magic');
        break;
      case 'fireCycle':
        this.auras.cycle('fire');
        break;
      case 'dash':
        this.tryDash();
        break;
      case 'toggleCombat':
        this.combatPanel?.toggle();
        break;
      case 'named': {
        const element = slot;
        if (this.aim.isArmed && element === this.element) this.aim.cancel();
        else this.armAbility(element);
        break;
      }
      case 'weaponPrev':
        this._cycleWeapon(-1);
        break;
      case 'weaponNext':
        this._cycleWeapon(1);
        break;
      case 'holdRelease':
      case 'drawRelease':
        this._releaseHoldSkill();
        break;
      case 'cancel':
        if (this._draw.active || this._charge.active) this._cancelHoldSkill();
        else if (this.library?.open) this.library.close();
        else if (this.combatPanel?.open) this.combatPanel.close();
        else if (this.rpgHud.sheetOpen) this.rpgHud.closeSheet();
        else this.aim.cancel();
        break;
      case 'toggleSheet':
        this.library?.close();
        this.rpgHud.toggleSheet();
        break;
      case 'toggleLibrary':
        if (this.rpgHud.sheetOpen) this.rpgHud.closeSheet();
        this.library.toggle();
        break;
      case 'toggleHelp':
        this.hud.toggleHelp();
        break;
      case 'toggleEditor':
        this.editor.toggle();
        break;
      case 'clear':
        this.clearEffects();
        this.hud.showToast('Effects cleared');
        break;
      case 'togglePause':
        this.paused = !this.paused;
        this.hud.setPaused(this.paused);
        this.hud.showToast(this.paused ? 'Paused — the editor still applies' : 'Resumed');
        break;
      default:
        break;
    }
  }

  /**
   * Put an ability in the slot. The aim indicator and the HUD both follow,
   * because `range` and `minRange` are the ability's, not the app's.
   */
  selectAbility(element, options = {}) {
    if (!ELEMENTS.includes(element)) return;
    this.abilities.select(element);
    this.aim.setElement(element);
    this.hud.setElement(element, { silent: true });
    this.rpgHud?.setSelected(element);
    this.library?.setArmed(element);
    if (!options.silent) {
      const resolved = this.actor.resolve(element);
      const off = resolved.onWeapon ? '' : ' · off-hand';
      this.hud.showToast(`${resolved.name} · ${resolved.damage} dmg${off}`);
    }
  }

  activateSkill(element) {
    if (!element) return;
    const mode = skillCastMode(this.actor.weaponType, element);
    if (mode === 'draw') {
      this.selectAbility(element, { silent: true });
      this.hud.showToast('Hold LMB to draw — release in the green');
      return;
    }
    if (mode === 'charge') {
      this.selectAbility(element, { silent: true });
      this.hud.showToast('Hold 2 / LMB to aim — orb at the arrow tip');
      return;
    }
    if (mode === 'zone') {
      if (this.aim.isArmed && element === this.element) this.aim.cancel();
      else this.armAbility(element);
      return;
    }
    if (isComboSkill(element)) {
      this._fireCombo(element);
      return;
    }
    if (this.aim.isArmed && element === this.element) this.aim.cancel();
    else this.armAbility(element);
  }

  _shouldDraw() {
    if (this._charge.active) return false;
    if (this._draw.active) return true;
    if (this.rpgHud?.sheetOpen || this.library?.open) return false;
    if (this.aim.isArmed && this.element && !isComboSkill(this.element)) return false;
    const mode = skillCastMode(this.actor.weaponType, this.element);
    if (mode === 'charge' || mode === 'zone') return false;
    return usesDraw(this.actor.weaponType);
  }

  _shouldCharge() {
    if (this._draw.active) return false;
    if (this._charge.active) return true;
    if (this.rpgHud?.sheetOpen || this.library?.open) return false;
    if (this.aim.isArmed && this.element && !isComboSkill(this.element)) return false;
    return skillCastMode(this.actor.weaponType, this.element) === 'charge';
  }

  _beginDraw() {
    if (this._charge.active) this._cancelCharge();
    const spec = drawSpec(this.actor.weaponType);
    if (!spec || this._draw.active) return false;
    const skill = spec.skill || 'combo1';
    if ((this.cooldowns.get(skill) ?? 0) > 0) {
      this.hud.showToast('Not ready');
      return false;
    }
    const resolved = this.actor.resolve(skill);
    if (!this.actor.canPay(resolved)) {
      this.hud.showToast(resolved.costType === 'mp' ? 'Not enough mana' : 'Not enough stamina');
      return false;
    }
    this.selectAbility(skill, { silent: true });
    this._draw.active = true;
    this._draw.t = 0;
    this._draw.duration = spec.duration || 1.32;
    this._draw.skill = skill;
    this.aim.arm();
    this.character.holdCast(spec.anim || 'cast1', spec.holdAt ?? 0.42);
    this.rpgHud.setDraw({ active: true, t: 0, zone: drawZoneAt(this.actor.weaponType, 0) });
    return true;
  }

  _beginCharge() {
    if (this._draw.active) this._cancelDraw();
    const spec = chargeSpec(this.actor.weaponType);
    if (!spec || this._charge.active) return false;
    const skill = spec.skill || 'combo2';
    if ((this.cooldowns.get(skill) ?? 0) > 0) {
      this.hud.showToast('Not ready');
      return false;
    }
    const resolved = this.actor.resolve(skill);
    if (!this.actor.canPay(resolved)) {
      this.hud.showToast(resolved.costType === 'mp' ? 'Not enough mana' : 'Not enough stamina');
      return false;
    }
    this.selectAbility(skill, { silent: true });
    this._charge.active = true;
    this._charge.t = 0;
    this._charge.duration = spec.duration || 0.92;
    this._charge.skill = skill;
    this.aim.arm();
    this.character.holdCast(spec.anim || 'cast2', spec.holdAt ?? 0.58);
    this.bowCharge.start();
    return true;
  }

  _releaseHoldSkill() {
    if (this._draw.active) this._releaseDraw();
    else if (this._charge.active) this._releaseCharge();
  }

  _cancelHoldSkill() {
    if (this._draw.active) this._cancelDraw();
    if (this._charge.active) this._cancelCharge();
  }

  _releaseDraw() {
    if (!this._draw.active) return;
    const spec = drawSpec(this.actor.weaponType);
    const skill = this._draw.skill;
    const t = this._draw.t;
    const zone = drawZoneAt(this.actor.weaponType, t);
    this._shotQuality = zone;
    this._draw.active = false;
    this.character.releaseHold();
    this.rpgHud.setDraw({ active: false, t, zone });
    this.aim.cancel();
    if (!spec || !zone) return;
    this.hud.showToast(`${zone.label} · ${Math.round(zone.dmg * 100)}%${zone.band === 'green' ? ' crit window' : ''}`);
    this._fireCombo(skill);
  }

  _releaseCharge() {
    if (!this._charge.active) return;
    const spec = chargeSpec(this.actor.weaponType);
    const skill = this._charge.skill;
    const t = this._charge.t;
    const full = t >= 0.82;
    this._shotQuality = {
      dmg: 0.58 + 0.82 * t,
      crit: full ? 0.88 : 0.06 + t * 0.18,
      band: full ? 'green' : t >= 0.4 ? 'yellow' : 'red',
      label: full ? 'Aimed' : t >= 0.4 ? 'Partial' : 'Rushed'
    };
    this._charge.active = false;
    this.character.releaseHold();
    this.bowCharge.stop();
    this.aim.cancel();
    if (!spec) return;
    this.hud.showToast(
      full ? 'Aimed Shot · full charge' : `${this._shotQuality.label} · ${Math.round(this._shotQuality.dmg * 100)}%`
    );
    this._fireCombo(skill);
  }

  _cancelDraw() {
    this._draw.active = false;
    this._shotQuality = null;
    this.character.releaseHold();
    this.character.playCast('idle');
    this.aim.cancel();
    this.rpgHud.setDraw({ active: false });
  }

  _cancelCharge() {
    this._charge.active = false;
    this._shotQuality = null;
    this.character.releaseHold();
    this.character.playCast('idle');
    this.bowCharge.stop();
    this.aim.cancel();
  }

  tryDash({ fromCombo = false } = {}) {
    const c = settings.combat;
    if (this._dashCd > 0) {
      if (!fromCombo) this.hud.showToast('Dash not ready');
      return false;
    }
    const paid = this.actor.pay({ cost: c.dashCost, costType: 'sta' });
    if (!paid) {
      this.hud.showToast('Not enough stamina');
      return false;
    }
    const pos = this.character.position;
    const dummy = this.world.nearestHostile?.(pos) || this.world.boss;
    let x;
    let z;
    if (dummy && dummy.down <= 0) {
      x = dummy.pos.x - pos.x;
      z = dummy.pos.z - pos.z;
    } else {
      const yaw = this.character.facing;
      x = Math.sin(yaw);
      z = Math.cos(yaw);
    }
    const dist = Math.hypot(x, z) || 1;
    const keep = dummy ? (dummy.radius ?? 0.9) + 0.85 : 0;
    const meters = Math.min(c.dashMeters, dummy ? Math.max(0.4, dist - keep) : c.dashMeters);
    this.character.setFacing(Math.atan2(x, z));
    this.character.castStep({
      x,
      z,
      meters,
      duration: c.dashDuration,
      lift: c.dashLift,
      dummy: dummy ? { x: dummy.pos.x, z: dummy.pos.z, radius: dummy.radius } : null,
      sign: 1
    });
    this.character.playCast(c.dashAnim || 'combo2');
    this.auras.pulse('cast', { silent: true, form: 'fire', duration: 0.45 });
    this._dashCd = c.dashCooldown;
    if (!fromCombo) this.hud.showToast(`Dash · ${c.dashCost} sta`);
    return true;
  }

  _fireCombo(element) {
    if ((this.cooldowns.get(element) ?? 0) > 0) {
      this.hud.showToast('Not ready');
      return;
    }
    const resolved = this.actor.resolve(element);
    if (!this.actor.canPay(resolved)) {
      this.hud.showToast(resolved.costType === 'mp' ? 'Not enough mana' : 'Not enough stamina');
      return;
    }
    if (element !== this.element) this.selectAbility(element, { silent: true });

    const origin = this.character.position.clone();
    origin.y = 0;
    this.aim.setElement(element);
    this.aim.setOrigin(origin);
    this.aim._resolve();

    const direction = this.aim.direction.clone();
    let distance = resolved.range;
    const dummy = this.world?.dummyPos;
    if (dummy && this.world.dummyDown <= 0) {
      const dx = dummy.x - origin.x;
      const dz = dummy.z - origin.z;
      const reach = Math.hypot(dx, dz);
      const forgive = (resolved.dummyRadius ?? 1) + (resolved.width ?? 0.7) + 0.35;
      if (reach > 1e-4 && reach <= resolved.range + forgive) {
        direction.set(dx / reach, 0, dz / reach);
        distance = reach;
      }
      const weaponReach = getWeapon(this.actor.weaponType).reach;
      if (
        settings.combat.gapClose &&
        element === (settings.combat.gapCloseSkill || 'combo2') &&
        this.actor.weapon.family === 'melee' &&
        reach > weaponReach + 0.45
      ) {
        this.tryDash({ fromCombo: true });
      }
    }
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    this._cast(origin, direction, distance);
  }

  /** Select an ability and arm it, unless it is still cooling down. */
  armAbility(element = this.element) {
    if ((this.cooldowns.get(element) ?? 0) > 0) {
      this.hud.showToast('Not ready');
      return;
    }
    const resolved = this.actor.resolve(element);
    if (!this.actor.canPay(resolved)) {
      this.hud.showToast(resolved.costType === 'mp' ? 'Not enough mana' : 'Not enough stamina');
      return;
    }
    // Selecting before arming means the arrow is already drawn to the new
    // ability's range on the frame it appears.
    if (element !== this.element) this.selectAbility(element);
    this.aim.arm();
  }

  _cycleWeapon(dir) {
    const list = weaponsForClass(this.actor.classId);
    if (!list.length) return;
    const index = Math.max(0, list.indexOf(this.actor.weaponType));
    const next = list[(index + dir + list.length) % list.length];
    this._setWeapon(next);
  }

  _setWeapon(id) {
    if (this._draw.active || this._charge.active) this._cancelHoldSkill();
    if (!this.actor.setWeapon(id)) return false;
    this.rpgHud.rebuildLoadout();
    this._onRpgMutate('weapon');
    const weapon = getWeapon(this.actor.weaponType);
    const combo = this.character.bindCombo(this.actor.weaponType);
    this.hud.showToast(
      `${weapon.name} · ${combo || (weapon.family === 'melee' ? 'weapon combo' : 'make space')}`
    );
    return true;
  }

  _onRpgMutate(kind) {
    if (this._draw.active || this._charge.active) this._cancelHoldSkill();
    if (kind === 'class' || kind === 'weapon' || kind === 'gear') {
      this.rpgHud.rebuildLoadout();
    }
    this.aim.cancel();
    const keep = kind !== 'class' && this.actor.loadout.includes(this.element);
    this.selectAbility(keep ? this.element : this.actor.loadout[0], { silent: true });
    this.world?.setDummyMax(dummyHpFor(this.actor.level));
    if (kind === 'race' || kind === 'class' || kind === 'weapon') {
      this.character.setRace(this.actor.raceId, this.actor.equipped, this.actor.classId, this.actor.weaponType);
    } else if (kind === 'gear') this.character.dress(this.actor.equipped, this.actor.classId, this.actor.weaponType);
    this.rpgHud.refresh();
    this.combatPanel?.setSnapshot(this.actor.snapshot());
    this._persist();
  }

  /**
   * Switch a self buff on, or let go early.
   *
   * Pressing the key while the buff is running releases it rather than
   * re-arming — the same "press it again to put it away" the ability slots use,
   * and the only way to end one before its duration is up.
   *
   * @param {object} buff   the effect itself
   * @param {object} config its settings block
   * @param {string} label  what the toast calls it
   */
  _toggleBuff(buff, config, label) {
    const form = buff === this.fire ? 'fire' : buff === this.magic ? 'magic' : 'boost';
    if (buff.active) {
      buff.cancel();
      this.auras.markUser(form, false);
      this.hud.showToast(`${label} released`);
      return;
    }

    if (!buff.activate()) {
      this.hud.showToast('Not ready');
      return;
    }

    this.auras.markUser(form, true);
    this.hud.showToast(`${label} · ${variantMeta(this.auras.variantOf(form)).label}`);
    if (config.playAnimation) {
      this.character.playCast(config.castAnim);
      this.character.castLunge();
    }
  }

  /** Charge up, or let go early. */
  toggleBoost() {
    this._toggleBuff(this.boost, settings.boost, 'Electric Boost');
  }

  /**
   * Open the channel, or let go early.
   *
   * Independent of the charge in every way: its own key, its own cooldown and
   * its own envelope. Holding both is allowed, and the character's shader
   * resolves the two claims on it by strength (see `materials/FresnelAura.js`).
   */
  toggleMagic() {
    this._toggleBuff(this.magic, settings.magic, 'Magic Boost');
  }

  /** Catch fire, or put it out early. */
  toggleFire() {
    this._toggleBuff(this.fire, settings.fire, 'Fire Boost');
  }

  _toggleNamedBuff(id) {
    if (id === 'boost') this.toggleBoost();
    else if (id === 'magic') this.toggleMagic();
    else if (id === 'fire') this.toggleFire();
  }

  _playLibraryClip(actorId, clipName, loop) {
    if (actorId === 'caster') {
      const ok = this.character.playLibraryClip(clipName);
      if (ok) this.hud.showToast(`${clipName}`);
      return ok;
    }
    const ok = this.world.playClip(actorId, clipName, { loop });
    if (ok) this.hud.showToast(`${actorId} · ${clipName}`);
    return ok;
  }

  async _showRaceMesh(id) {
    const spec = RACE_MESHES.find((row) => row.id === id);
    if (!spec || !this.assets) return;
    try {
      const gltf = await this.assets.loadGLTF(spec.url);
      this.world.showRaceMesh(id, gltf, spec.height);
      this.hud.showToast(spec.label);
    } catch (error) {
      console.warn('[library] race mesh failed', id, error);
      this.hud.showToast('Mesh failed to load');
    }
  }

  _bindLibraryCatalog() {
    const actors = [
      { id: 'caster', label: 'Caster', clips: this.character.listClips() },
      ...this.world.listLibraries()
    ];
    this.library.setActors(actors);
    this.helpers?.refreshClips();
  }

  _cast(origin, direction, distance) {
    const element = this.element;
    let resolved = this.actor.resolve(element);
    if (this._shotQuality) {
      const zone = this._shotQuality;
      this._shotQuality = null;
      resolved = {
        ...resolved,
        damage: Math.max(1, Math.round(resolved.damage * zone.dmg)),
        critChance: zone.crit,
        drawBand: zone.band,
        drawLabel: zone.label
      };
    }
    if (!this.actor.pay(resolved)) {
      this.hud.showToast(resolved.costType === 'mp' ? 'Not enough mana' : 'Not enough stamina');
      return;
    }

    origin = origin.clone();
    direction = direction.clone();
    const weapon = getWeapon(this.actor.weaponType);
    const melee = weapon.family === 'melee';
    const vfxId = resolved.vfx || element;
    const dummy = this.world.nearestHostile?.(origin) || this.world.boss;
    const dummyPos = dummy?.pos || this.world.dummyPos;
    const dirX = direction.x;
    const dirZ = direction.z;
    if (isComboSkill(element) && melee && dummy && dummy.down <= 0) {
      const close = Math.min((resolved.move || 1.4) * 0.55, Math.max(0, distance - 1.15));
      origin.x += dirX * close;
      origin.z += dirZ * close;
      distance = Math.max(0.55, distance - close);
    }

    this.abilities.cast(origin, direction, distance, vfxId);
    this.cooldowns.set(element, resolved.cooldown);
    const spec = totemSpec(vfxId);
    if (spec) {
      const pools = this.actor._pools || {};
      if (spec.manaGain) this.actor.mp = Math.min(pools.mp ?? this.actor.mp, this.actor.mp + spec.manaGain);
      if (spec.staminaGain) this.actor.sta = Math.min(pools.sta ?? this.actor.sta, this.actor.sta + spec.staminaGain);
      this.auras.pulse(spec.pulse === 'heal' ? 'channel' : 'cast', { silent: true, duration: 0.4 });
    }
    if (vfxId === 'fireBolt') {
      this.auras.pulse('cast', { silent: true, duration: 0.35 });
    }
    if (vfxId === 'healBolt' || spec?.pulse === 'heal') {
      this.auras.setVariant('magic', 'heal', { silent: true });
      this.auras.pulse('channel', { silent: true, duration: 0.4 });
    }

    const isHeal = vfxId === 'healBolt' || spec?.pulse === 'heal' || resolved.statuses?.some((s) => s.id === 'heal');
    if (!spec) {
      if (isHeal && this.world.ally) {
        const test = resolveCastHit({
          origin,
          direction,
          distance,
          resolved,
          dummy: this.world.ally.pos
        });
        if (test.hit) {
          const result = this.world.healUnit(this.world.ally, Math.max(8, Math.round(resolved.damage * 0.85)));
          if (result.healed) {
            const screen = this._projectUnit(this.world.ally);
            this.rpgHud.floatDamage({
              amount: result.healed,
              tag: 'heal',
              x: screen.x,
              y: screen.y
            });
          }
        }
      } else {
        const hits = resolveCastHits({
          origin,
          direction,
          distance,
          resolved,
          units: this.world.hostiles()
        });
        let granted = 0;
        for (const landed of hits) {
          const rolled = rollDamage(resolved);
          const hit = mitigateIncoming(
            rolled.amount,
            dummyDerivedFor(this.actor.level),
            { criticalChance: resolved.critChance, criticalDamage: resolved.critMul }
          );
          const result = this.world.hurtUnit(landed.unit, hit.taken);
          const tag = resolved.statuses?.[0]?.id;
          const screen = this._projectUnit(landed.unit);
          this.rpgHud.floatDamage({
            amount: result.dealt,
            crit: hit.crit,
            blocked: hit.blocked,
            tag: hit.blocked ? 'block' : hit.crit ? 'crit' : (resolved.drawLabel || tag),
            x: screen.x,
            y: screen.y
          });
          this.actor.inCombat = Math.max(this.actor.inCombat, 3.4);
          granted += Math.max(1, Math.round(result.dealt * 0.14)) + dummyXp(this.actor.level, result.killed);
          if (result.killed) {
            this.actor.kills += 1;
            this.hud.showToast(`${landed.unit.name} down`);
          }
        }
        if (granted) {
          const levels = this.actor.grantXp(granted);
          if (levels) {
            this.world.setDummyMax(dummyHpFor(this.actor.level));
            this.rpgHud.refresh();
            this.combatPanel?.setSnapshot(this.actor.snapshot());
            this.hud.showToast(`Level ${this.actor.level}`);
            this._persist();
          }
        }
      }
    }

    if (vfxId !== 'mageTotem' && vfxId !== 'priestTotem' && vfxId !== 'virtuosoTotem') {
      this.world.pulseTotems('act');
    }

    this.character.setFacing(this.aim.facing);
    const drawAnim = resolved.drawBand ? drawSpec(this.actor.weaponType)?.releaseAnim : null;
    this.character.playCast(drawAnim || resolved.anim || settings[element].castAnim);
    const meters = isComboSkill(element) ? (resolved.move || 1.4) : melee ? 0.7 : 0.95;
    this.character.castStep({
      x: melee ? dirX : -dirX,
      z: melee ? dirZ : -dirZ,
      meters,
      duration: resolved.duration || (melee ? 0.36 : 0.32),
      lift: resolved.lift || (melee ? 0.06 : 0.16),
      dummy: dummyPos ? { x: dummyPos.x, z: dummyPos.z, radius: dummy?.radius ?? this.world.dummyRadius } : null,
      sign: melee ? 1 : -1
    });
  }

  _projectUnit(unit) {
    if (!unit?.pos) return { x: this._dummyScreen.x, y: this._dummyScreen.y };
    this._dummyNdc.copy(unit.pos);
    this._dummyNdc.y = (unit.height || 1.8) * 0.92;
    this._dummyNdc.project(this.camera);
    const sx = (this._dummyNdc.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-this._dummyNdc.y * 0.5 + 0.5) * window.innerHeight;
    return { x: sx, y: sy, onScreen: this._dummyNdc.z > -1 && this._dummyNdc.z < 1 };
  }

  clearEffects() {
    this.aim.cancel();
    this.abilities.clear();
    this.boost.cancel();
    this.magic.cancel();
    this.fire.cancel();
    this.auras.markUser('fire', false);
    this.auras.markUser('magic', false);
    this.auras.markUser('boost', false);
    this.particles.reset();
    this.decals.clear();
    this.bursts.clear();
    this.lights.reset();
    this.shake.reset();
    this.flash.reset();
  }

  /* ------------------------------------------------------------------ */

  /** Load assets, warm the shader cache, then start the loop. */
  async load() {
    const assets = new AssetLoader();
    this.assets = assets;

    this.loading.setProgress(0.05, 'Loading environment…');
    const hdr = await assets.loadHDR(HDR_URL);
    await this.environment.loadEnvironment(hdr);
    frame.uEnvMap.value = this.environment.equirect;

    this.loading.setProgress(0.35, 'Loading floor…');
    await this.ground.loadTextures(assets);

    this.loading.setProgress(0.5, 'Loading character…');
    await this.character.load(assets);

    this.loading.setProgress(0.62, 'Raising the grove…');
    const grove = this.world.load(assets);
    const avatar = this.character.adoptAvatar(
      assets,
      this.actor.raceId,
      this.actor.equipped,
      this.actor.classId,
      this.actor.weaponType
    );
    await Promise.all([grove, avatar]);
    const kit = await loadTotemKit(assets);
    this.abilities.ctx.totemKit = kit;
    this.world.setDummyMax(dummyHpFor(this.actor.level));
    this._bindLibraryCatalog();

    this.loading.setProgress(0.85, 'Compiling shaders…');
    // Compile everything up front so the first cast never stutters.
    await this.renderer.gl.compileAsync(this.scene, this.camera);

    this.editor.presets.restoreSession();
    this.editor.refresh();
    this.scripts = new ScriptHost(this);
    this.scriptPanel = new ScriptPanel({
      host: this.scripts,
      onChange: () => {
        const errors = this.scripts.compile();
        this._sessionPersist();
        return errors;
      },
      onToast: (message) => this.hud.showToast(message)
    });
    const scriptErrors = this.scripts.compile();
    if (scriptErrors.length) {
      this.hud.showToast(`Script error: ${scriptErrors[0].message}`);
    }

    this.loading.setProgress(1, 'Ready');
    this.loading.hide();

    if (typeof window !== 'undefined') {
      window.__labCast = (element) => {
        const id = ELEMENTS.includes(element) ? element : this.element;
        this.selectAbility(id, { silent: true });
        const origin = this.character.position;
        const direction = new Vector3(0, 0, -1);
        const resolved = this.actor.resolve(id);
        const distance = Math.max(6, resolved.range * 0.9);
        this._cast(origin, direction, distance);
        return id;
      };
      window.__rpg = {
        actor: this.actor,
        resolve: (id) => this.actor.resolve(id),
        snapshot: () => this.actor.snapshot(),
        body: () => {
          const meshes = [];
          this.character.root?.traverse((node) => {
            if (!(node.isMesh || node.isSkinnedMesh)) return;
            if (!node.visible) return;
            meshes.push(node.name || node.parent?.name || '(unnamed)');
          });
          return {
            raceId: this.actor.raceId,
            classId: this.actor.classId,
            faction: this.actor.faction?.id ?? null,
            form: this.character.usingAvatar
              ? (this.character.avatar?.raceId ?? 'avatar')
              : 'mixamo',
            usingAvatar: this.character.usingAvatar,
            mixamoVisible: Boolean(this.character.model?.visible),
            mixamoName: this.character.model?.name ?? null,
            avatarRace: this.character.avatar?.raceId ?? null,
            avatarVisible: Boolean(this.character.avatar?.group?.visible),
            idle: this.character.idle?.getClip()?.name ?? null,
            combo: ['combo1', 'combo2', 'combo3'].filter((id) => this.character.casts?.has(id) || this.character.avatar?.casts?.has(id)),
            loadout: [...this.actor.loadout],
            sources: { ...this.actor.loadoutSources },
            equipped: { ...this.actor.equipped },
            weaponType: this.actor.weaponType,
            weaponFamily: this.actor.weapon.family,
            draw: { ...this._draw, quality: this._shotQuality },
            charge: { ...this._charge },
            pos: { x: this.character.position.x, z: this.character.position.z },
            grove: this.world.listLibraries().map((row) => row.id),
            meshes: meshes.slice(0, 24)
          };
        },
        hitDummy: (n) => this.world.hurtDummy(n),
        setRace: (id) => {
          if (this.actor.setRace(id)) this._onRpgMutate('race');
          return this.actor.raceId;
        },
        setClass: (id) => {
          if (this.actor.setClass(id)) {
            this.rpgHud.rebuildLoadout();
            this._onRpgMutate('class');
          }
          return this.actor.classId;
        },
        wear: (id) => {
          if (this.actor.equip(id)) this._onRpgMutate('gear');
          return this.actor.equipped;
        },
        setWeapon: (id) => {
          this._setWeapon(id);
          return this.actor.weaponType;
        },
        beginDraw: () => this._beginDraw(),
        releaseDraw: () => this._releaseDraw(),
        beginCharge: () => this._beginCharge(),
        releaseCharge: () => this._releaseCharge(),
        dash: () => this.tryDash(),
        aura: () => this.auras.snapshot(),
        cycleAura: (form) => this.auras.cycle(form),
        pulse: (role) => this.auras.pulse(role)
      };
      window.__auras = {
        snapshot: () => this.auras.snapshot(),
        cycle: (form) => this.auras.cycle(form),
        pulse: (role) => this.auras.pulse(role),
        set: (form, id) => this.auras.setVariant(form, id)
      };
      window.__combat = {
        dash: () => this.tryDash(),
        panel: () => this.combatPanel.toggle(),
        stats: () => this.actor.snapshot(),
        skeleton: () => this.helpers.setSkeleton(!this.helpers.skeletonOn),
        anim: () => this.helpers.togglePanel()
      };
      window.__library = {
        list: () => this.world.listLibraries(),
        caster: () => this.character.listClips(),
        play: (actor, clip, loop = true) => this._playLibraryClip(actor, clip, loop),
        arm: (id) => this.armAbility(id),
        open: () => this.library.show(),
        elements: () => [...ELEMENTS]
      };
      window.__scripts = {
        compile: () => this.scripts.compile(),
        panel: () => this.scriptPanel.toggle(),
        errors: () => this.scripts.errors
      };
    }

    this.start();
    this.scripts?.start();
  }

  start() {
    this.time.reset();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.frame();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }

  /* ------------------------------------------------------------------ */

  frame() {
    const gl = this.renderer.gl;
    gl.info.reset();

    const raw = this.time.tick();
    const dt = this.paused ? 0 : raw * settings.global.timeScale;
    this.elapsed += dt;

    /* ---- shared uniforms ---- */
    frame.uTime.value = this.elapsed;
    frame.uDelta.value = dt;
    frame.uShaderIntensity.value = settings.global.shaderIntensity;
    frame.uGlobalGlow.value = settings.global.glow;
    frame.uCameraNear.value = this.camera.near;
    frame.uCameraFar.value = this.camera.far;

    /* ---- simulation ---- */
    this.renderer.syncSettings();

    this.environment.setFocus(this.character.position.x, this.character.position.z);
    this.environment.update();

    // Targeting runs on *real* time so the arrow keeps sweeping and animating
    // while the sandbox is paused — pausing freezes the effects, not the UI.
    this.aim.setOrigin(this.character.position);
    this.aim.update(raw);

    if (this._draw.active) {
      const drawDt = this.paused ? 0 : raw;
      this._draw.t = Math.min(1, this._draw.t + drawDt / Math.max(0.2, this._draw.duration));
      const zone = drawZoneAt(this.actor.weaponType, this._draw.t);
      this.rpgHud.setDraw({ active: true, t: this._draw.t, zone });
    }
    if (this._charge.active) {
      const chargeDt = this.paused ? 0 : raw;
      this._charge.t = Math.min(1, this._charge.t + chargeDt / Math.max(0.2, this._charge.duration));
    }

    if (settings.character.turnToAim && (this.aim.isArmed || this._draw.active || this._charge.active)) {
      this.character.turnToward(this.aim.facing, settings.character.turnRate, raw);
    }
    this.character.update(dt);
    if (this._charge.active) {
      this.character.getBoneWorld('RightHand', this._chargeTip);
      this._chargeTip.x += this.aim.direction.x * 0.28;
      this._chargeTip.z += this.aim.direction.z * 0.28;
      this._chargeTip.y += 0.06;
      this.bowCharge.update(dt, this._chargeTip, this._charge.t);
    } else if (this.bowCharge.active) {
      this.bowCharge.stop();
    }
    this.world.update(dt, this.character.position);
    this.actor.regen(dt);

    for (const [element, remaining] of this.cooldowns) {
      if (remaining > 0) this.cooldowns.set(element, Math.max(0, remaining - raw));
    }

    this.ground.update(this.elapsed);
    this.dust.update(this.elapsed, this.character.position);

    this.abilities.update(dt);
    this.scripts?.update();
    // After the character has been placed, so the arcs are struck on where the
    // body *is* this frame; before the flush, so its particles go out with
    // everything else's. Driven by the simulation delta, so pausing holds the
    // charge on screen and every slider in the editor stays live against it.
    this.boost.update(dt);
    this.magic.update(dt);
    this.fire.update(dt);
    this.auras.update(dt);
    if (this._dashCd > 0) this._dashCd = Math.max(0, this._dashCd - dt);
    this.helpers?.update();
    this.particles.flush();
    this.decals.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);

    /* ---- camera ---- */
    const focus = this.abilities.focus;
    if (focus) this.rig.lookAt(focus.position, MathUtils.clamp(1 - focus.u * 0.4, 0, 1));
    this.rig.setAnchor(this.character.position.x, 0, this.character.position.z);
    this.shake.update(raw);
    this.flash.update(raw);
    this.rig.update(raw);

    this.contactShadows.setPosition(this.character.position.x, this.character.position.z);
    this.contactShadows.render(this.scene);

    /* ---- render ---- */
    // Exactly one cascade shadow update per frame (see Renderer).
    gl.shadowMap.needsUpdate = true;
    this.post.sync(this.elapsed, this.flash);
    this.post.render();

    /* ---- readouts ---- */
    for (const element of ELEMENTS) {
      const total = this.actor.resolve(element).cooldown;
      this.hud.setCooldown(element, this.cooldowns.get(element) ?? 0, total);
    }
    this.hud.setArmed(this.aim.isArmed);
    this.rpgHud.setArmed(this.aim.isArmed);
    this.rpgHud.tick();
    for (const id of this.actor.loadout) {
      const resolved = this.actor.resolve(id);
      this.rpgHud.setCooldown(id, this.cooldowns.get(id) ?? 0, resolved.cooldown);
    }
    if (this.world.units?.length) {
      const frames = this.world.units.map((unit) => {
        const screen = this._projectUnit(unit);
        const onScreen =
          screen.onScreen &&
          screen.x > -80 &&
          screen.x < window.innerWidth + 80 &&
          screen.y > -40 &&
          screen.y < window.innerHeight + 40;
        if (unit.id === 'boss') this._dummyScreen.set(screen.x, screen.y, 0);
        return {
          id: unit.id,
          name: unit.name,
          role: unit.role,
          hp: unit.hp,
          hpMax: unit.hpMax,
          down: unit.down > 0,
          x: screen.x,
          y: screen.y,
          visible: onScreen
        };
      });
      this.rpgHud.setRange(frames);
    }
    // One sweep, two meanings: the charge draining while it holds, the cooldown
    // running off once it has gone.
    const boost = settings.boost;
    this.hud.setBoost(
      this.boost.active,
      this.boost.active
        ? this.boost.remaining / Math.max(boost.duration, 0.001)
        : this.boost.cooldown / Math.max(boost.cooldown, 0.001)
    );
    const magic = settings.magic;
    this.hud.setMagic(
      this.magic.active,
      this.magic.active
        ? this.magic.remaining / Math.max(magic.duration, 0.001)
        : this.magic.cooldown / Math.max(magic.cooldown, 0.001)
    );
    const fire = settings.fire;
    this.hud.setFire(
      this.fire.active,
      this.fire.active
        ? this.fire.remaining / Math.max(fire.duration, 0.001)
        : this.fire.cooldown / Math.max(fire.cooldown, 0.001)
    );
    this.hud.update(raw, () => ({
      particles: this.particles.countLive(this.elapsed),
      calls: gl.info.render.calls,
      spikes:
        this.abilities.active.reduce((total, ability) => total + ability.instanceCount, 0) +
        this.boost.instanceCount +
        this.magic.instanceCount +
        this.fire.instanceCount,
      abilities: this.abilities.active.length
    }));
  }

  /* ------------------------------------------------------------------ */

  dispose() {
    this.stop();
    this.scripts?.dispose();
    this.scriptPanel?.dispose();
    this.editor.presets.persistSession();
    this.input.dispose();
    this.aim.dispose();
    this.abilities.dispose();
    this.boost.dispose();
    this.magic.dispose();
    this.fire.dispose();
    this.helpers?.dispose();
    this.combatPanel?.dispose();
    this.particles.dispose();
    this.decals.dispose();
    this.bursts.dispose();
    this.lights.dispose();
    this.character.dispose();
    this.world.dispose();
    this.rpgHud?.dispose();
    this.library?.dispose();
    window.removeEventListener('lab:toggleLibrary', this._onLibEvent);
    window.removeEventListener('lab:toggleEditor', this._onEditorEvent);
    this._saveUnbind?.();
    this._sessionUnbind?.();
    this.ground.dispose();
    this.dust.dispose();
    this.contactShadows.dispose();
    this.post.dispose();
    this.environment.dispose();
    this.editor.dispose();
    this.rig.dispose();
    this.renderer.dispose();
  }
}
