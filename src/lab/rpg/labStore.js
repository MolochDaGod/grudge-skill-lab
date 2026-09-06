// @ts-nocheck
/**
 * Live grove combat state. Vanilla zustand so HUD, Skill Studio, and
 * `window.__labState` share one snapshot without React in the WebGL loop.
 */
import { createStore } from 'zustand/vanilla';

export const labStore = createStore((set) => ({
  locomo: 'idle',
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  speed: 0,
  raceId: 'human',
  classId: 'warrior',
  weaponType: 'SWORD',
  skill: null,
  skeletonOn: false,
  usingAvatar: false,
  patch(partial) {
    set(partial);
  }
}));

export function labSnap() {
  return labStore.getState();
}
