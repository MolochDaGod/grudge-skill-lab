// @ts-nocheck
/**
 * Dummy hit tests. The lab fires a cast as origin + unit direction + distance.
 * Line skills test a thickened segment; zone/ring/gate skills test the impact
 * disc. VFX travel is presentation — damage lands with the click, same as the
 * dummy's existing hit-react.
 */

import { clamp, dummyHpFor } from './formulas.js';
import { CastShape, castShapeOf } from '../config/settings.js';

export { dummyHpFor };

const _scratch = { x: 0, z: 0, t: 0 };

function closestOnSegment(ox, oz, dx, dz, dist, px, pz) {
  const t = clamp((px - ox) * dx + (pz - oz) * dz, 0, dist);
  _scratch.x = ox + dx * t;
  _scratch.z = oz + dz * t;
  _scratch.t = t;
  return _scratch;
}

function dist2(ax, az, bx, bz) {
  const x = ax - bx;
  const z = az - bz;
  return Math.hypot(x, z);
}

function impactPoint(origin, direction, distance) {
  return {
    x: origin.x + direction.x * distance,
    z: origin.z + direction.z * distance
  };
}

/**
 * @param {object} args
 * @param {{x:number,y?:number,z:number}} args.origin
 * @param {{x:number,y?:number,z:number}} args.direction unit, flat
 * @param {number} args.distance
 * @param {object} args.resolved  actor.resolve() result
 * @param {{x:number,z:number}} args.dummy
 * @returns {{ hit: boolean, kind: string, reach: number }}
 */
export function resolveCastHit({ origin, direction, distance, resolved, dummy }) {
  if (!resolved || !dummy) return { hit: false, kind: 'none', reach: Infinity };

  const shape = resolved.shape || castShapeOf(resolved.id);
  const body = resolved.dummyRadius ?? 1;
  const ox = origin.x;
  const oz = origin.z;
  const dx = direction.x;
  const dz = direction.z;

  if (shape === CastShape.LINE || resolved.hit === 'line') {
    const closest = closestOnSegment(ox, oz, dx, dz, distance, dummy.x, dummy.z);
    const reach = dist2(closest.x, closest.z, dummy.x, dummy.z);
    const width = (resolved.width ?? 0.7) + body;
    return { hit: reach <= width, kind: 'line', reach };
  }

  const impact = impactPoint(origin, direction, distance);
  const reach = dist2(impact.x, impact.z, dummy.x, dummy.z);
  let radius = body;
  if (shape === CastShape.ZONE || resolved.hit === 'zone') {
    radius += resolved.zoneRadius ?? 1.4;
  } else if (shape === CastShape.GATE) {
    radius += Math.max(resolved.gateWidth ?? 2, 1.6) * 0.55;
  } else if (shape === CastShape.RING || shape === CastShape.SCRIBE || resolved.hit === 'ring') {
    radius += resolved.ringRadius ?? 2;
  } else {
    radius += resolved.zoneRadius || resolved.ringRadius || 1.2;
  }
  return { hit: reach <= radius, kind: shape, reach };
}

export function resolveCastHits({ origin, direction, distance, resolved, units }) {
  const hits = [];
  if (!units?.length) return hits;
  for (const unit of units) {
    if (!unit || unit.down > 0) continue;
    const dummy = unit.pos || unit;
    const test = resolveCastHit({ origin, direction, distance, resolved, dummy });
    if (test.hit) hits.push({ unit, ...test });
  }
  return hits;
}
