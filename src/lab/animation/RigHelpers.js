// @ts-nocheck
import { SkeletonHelper, AxesHelper } from 'three';

/**
 * Skeleton + animation helpers for the caster.
 *
 * SkeletonHelper is the official three.js overlay on a SkinnedMesh skeleton.
 * The animation readout is a small DOM panel: clip list, mixer time, play.
 */
export class RigHelpers {
  /**
   * @param {object} opts
   * @param {import('./CharacterController.js').CharacterController} opts.character
   * @param {import('three').Scene} opts.scene
   * @param {HTMLElement} opts.root
   * @param {(actor: string, clip: string, loop: boolean) => void} [opts.onPlay]
   */
  constructor({ character, scene, root, onPlay } = {}) {
    this.character = character;
    this.scene = scene;
    this.onPlay = onPlay;
    this.skeletonOn = false;
    this.axesOn = false;
    this.panelOn = false;
    this._helper = null;
    this._axes = [];
    this._skinned = null;

    this.host = document.createElement('div');
    this.host.className = 'rig-help is-hidden';
    this.host.innerHTML = `
      <header>
        <p class="rig-help__kicker">Animation</p>
        <h3 data-rig-title>Caster</h3>
        <button type="button" data-rig-close>Hide</button>
      </header>
      <p class="rig-help__now" data-rig-now>idle</p>
      <div class="rig-help__row">
        <button type="button" data-rig-skel>Skeleton</button>
        <button type="button" data-rig-axes>Bone axes</button>
      </div>
      <div class="rig-help__clips" data-rig-clips></div>
    `;
    root?.appendChild(this.host);

    this.host.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.host.querySelector('[data-rig-close]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.setPanel(false);
    });
    this.host.querySelector('[data-rig-skel]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.setSkeleton(!this.skeletonOn);
    });
    this.host.querySelector('[data-rig-axes]')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.setAxes(!this.axesOn);
    });
    this.host.querySelector('[data-rig-clips]')?.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('[data-clip]');
      if (!btn) return;
      event.stopPropagation();
      this.onPlay?.('caster', btn.dataset.clip, /idle|stand|lobby|move/i.test(btn.dataset.clip));
    });
  }

  _findSkinned() {
    let best = null;
    let bestBones = -1;
    const consider = (node) => {
      if (!node.isSkinnedMesh || !node.skeleton) return;
      const n = node.skeleton.bones?.length || 0;
      if (n > bestBones) {
        best = node;
        bestBones = n;
      }
    };
    const roots = [];
    if (this.character?.usingAvatar && this.character.avatar?.group) {
      roots.push(this.character.avatar.group);
    } else if (this.character?.model) {
      roots.push(this.character.model);
    }
    if (this.character?.root) roots.push(this.character.root);
    for (const root of roots) root.traverse(consider);
    return best;
  }

  _bindSkeleton() {
    this._clearSkeleton();
    const skinned = this._findSkinned();
    this._skinned = skinned;
    if (!skinned || !this.skeletonOn) return;
    this._helper = new SkeletonHelper(skinned);
    this._helper.name = 'RigSkeleton';
    this.scene.add(this._helper);
    if (this.axesOn) this._bindAxes(skinned);
  }

  _bindAxes(skinned) {
    this._clearAxes();
    const bones = skinned?.skeleton?.bones ?? [];
    const cap = Math.min(bones.length, 48);
    for (let i = 0; i < cap; i++) {
      const axes = new AxesHelper(0.08);
      axes.name = `BoneAxis:${bones[i].name || i}`;
      bones[i].add(axes);
      this._axes.push(axes);
    }
  }

  _clearSkeleton() {
    if (this._helper) {
      this._helper.parent?.remove(this._helper);
      this._helper = null;
    }
    this._clearAxes();
  }

  _clearAxes() {
    for (const axes of this._axes) axes.parent?.remove(axes);
    this._axes.length = 0;
  }

  setSkeleton(on) {
    this.skeletonOn = Boolean(on);
    this.host.querySelector('[data-rig-skel]')?.classList.toggle('is-on', this.skeletonOn);
    if (this.skeletonOn) this._bindSkeleton();
    else this._clearSkeleton();
  }

  setAxes(on) {
    this.axesOn = Boolean(on);
    this.host.querySelector('[data-rig-axes]')?.classList.toggle('is-on', this.axesOn);
    if (this.axesOn && this.skeletonOn) {
      const skinned = this._skinned || this._findSkinned();
      if (skinned) this._bindAxes(skinned);
    } else {
      this._clearAxes();
    }
  }

  setPanel(on) {
    this.panelOn = Boolean(on);
    this.host.classList.toggle('is-hidden', !this.panelOn);
    if (this.panelOn) this.refreshClips();
  }

  togglePanel() {
    this.setPanel(!this.panelOn);
  }

  refreshClips() {
    const clips = this.character?.listClips?.() ?? [];
    const box = this.host.querySelector('[data-rig-clips]');
    if (!box) return;
    box.innerHTML = clips
      .map(
        (clip) =>
          `<button type="button" data-clip="${clip.name}"><b>${clip.name}</b><span>${
            Number.isFinite(clip.duration) ? clip.duration.toFixed(2) + 's' : '—'
          }</span></button>`
      )
      .join('');
    const title = this.host.querySelector('[data-rig-title]');
    if (title) {
      title.textContent = this.character?.usingAvatar
        ? `Avatar · ${this.character.avatar?.raceId ?? 'rig'}`
        : 'Mixamo caster';
    }
  }

  update() {
    if (this.skeletonOn) {
      const skinned = this._findSkinned();
      if (skinned !== this._skinned) this._bindSkeleton();
    }
    if (!this.panelOn) return;
    const now = this.host.querySelector('[data-rig-now]');
    if (!now) return;
    const idle = this.character?.idle?.getClip?.()?.name ?? 'idle';
    const cast = this.character?._cast?.getClip?.()?.name;
    const avatar = this.character?.avatar;
    const playing = avatar?.playing || cast || idle;
    now.textContent = playing;
  }

  dispose() {
    this._clearSkeleton();
    this.host.remove();
  }
}
