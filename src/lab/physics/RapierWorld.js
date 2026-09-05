// @ts-nocheck
/**
 * Rapier 3D (compat / inlined WASM) for the grove.
 *
 * Production rules we follow:
 * - `@dimforge/rapier3d-compat` so Vite/Nitro never has to fetch a raw .wasm
 * - fixed 1/60 step + clamped accumulator (Fix Your Timestep)
 * - kinematic capsule for the caster (animation drives pose; physics blocks)
 * - static capsules for dummies; CCD off on statics, on for fast sensors
 * - never step Rapier from variable dt
 */

const STEP = 1 / 60;
const MAX_ACC = 0.25;

export class RapierWorld {
  constructor() {
    this.ready = false;
    this.RAPIER = null;
    this.world = null;
    this.controller = null;
    this.player = null;
    this.bodies = new Map();
    this._acc = 0;
  }

  async init() {
    const RAPIER = (await import('@dimforge/rapier3d-compat')).default;
    await RAPIER.init();
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(48, 0.3, 48).setTranslation(0, -0.3, 0));

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0)
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.48, 0.32).setTranslation(0, 0.8, 0),
      body
    );
    this.player = { body, collider };

    this.controller = this.world.createCharacterController(0.02);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.enableAutostep(0.4, 0.22, true);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    this.ready = true;
    return this;
  }

  addCapsule(id, x, z, radius, height) {
    if (!this.ready || this.bodies.has(id)) return;
    const r = Math.max(0.18, radius);
    const half = Math.max(0.12, height * 0.5 - r);
    const desc = this.RAPIER.ColliderDesc.capsule(half, r).setTranslation(x, half + r, z);
    const collider = this.world.createCollider(desc);
    this.bodies.set(id, { collider, x, z, radius: r, height });
  }

  syncPlayer(pos) {
    if (!this.ready || !this.player) return;
    this.player.body.setNextKinematicTranslation({ x: pos.x, y: Math.max(0, pos.y), z: pos.z });
  }

  step(dt) {
    if (!this.ready || dt <= 0) return;
    this._acc = Math.min(this._acc + dt, MAX_ACC);
    while (this._acc >= STEP) {
      this.world.step();
      this._acc -= STEP;
    }
  }

  /**
   * Aim / projectile query. Returns first hit distance, or null.
   */
  raycast(origin, dir, maxToi = 28) {
    if (!this.ready) return null;
    const ray = new this.RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z }
    );
    const hit = this.world.castRay(ray, maxToi, true);
    if (!hit) return null;
    return { toi: hit.timeOfImpact, dist: hit.timeOfImpact };
  }

  dispose() {
    try {
      this.world?.free();
    } catch {
      /* already freed */
    }
    this.world = null;
    this.ready = false;
    this.bodies.clear();
  }
}
