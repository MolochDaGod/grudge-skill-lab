// @ts-nocheck
/**
 * Three.js Editor Manual script document.
 *
 * Scripts are stored as source strings (never compiled functions). The player
 * compiles them the same way `editor/js/libs/app.js` does: wrap, bind `this`
 * to the owning object, expose player/renderer/scene/camera.
 *
 * Keys match persistent lab objects, not ephemeral UUIDs:
 *   scene | camera | character | ability:{element}
 */

export const SCRIPT_VERSION = 1;

export const SCRIPT_EVENTS = [
  'init',
  'start',
  'stop',
  'update',
  'keydown',
  'keyup',
  'pointerdown',
  'pointerup',
  'pointermove'
];

export const SCRIPT_TARGETS = [
  { key: 'scene', label: 'Scene' },
  { key: 'camera', label: 'Camera' },
  { key: 'character', label: 'Character' },
  { key: 'totem:mageTotem', label: 'Mage F totem' },
  { key: 'totem:priestTotem', label: 'Priest F totem' },
  { key: 'totem:virtuosoTotem', label: 'Virtuoso F totem' }
];

export const SCRIPT_PRESETS = [
  {
    id: 'totem-heal-flow',
    name: 'Totem heal mist',
    key: 'totem:priestTotem',
    source: `// AAA — jade mist + heal glints off the Freya crown
function start() {
  player.fx.palette('heal');
}

function update(event) {
  const dt = event.delta * 0.001;
  const dummy = player.app.world.dummyPos;
  player.fx.flow(this.position, dummy, dt, { height: 1.7, palette: 'heal', glintRate: 18 });
}
`
  },
  {
    id: 'totem-wind',
    name: 'Totem green wind',
    key: 'totem:mageTotem',
    source: `// AAA — green wind ribbon toward the dummy
function start() {
  player.fx.palette('green');
}

function update(event) {
  const dt = event.delta * 0.001;
  player.fx.flow(this.position, player.app.world.dummyPos, dt, {
    height: 1.55,
    palette: 'green',
    windRate: 80,
    leafRate: 8
  });
}
`
  },
  {
    id: 'body-wind',
    name: 'Caster wind cloak',
    key: 'character',
    source: `// AAA — mist cloak while the body is in a cast
function update(event) {
  const dt = event.delta * 0.001;
  player.fx.palette('green');
  player.fx.mist(this.position, 1, { height: 1.1 });
}
`
  },
  {
    id: 'heal-pulse',
    name: 'Heal pulse on H',
    key: 'scene',
    source: `function keydown(event) {
  if (event.code !== 'KeyH') return;
  const dummy = player.app.world.dummyPos;
  player.fx.heal(dummy, 24, { palette: 'heal' });
  player.app.auras.pulse('channel', { silent: true });
}
`
  }
];

export const DEFAULT_SCRIPT_SOURCE = `// three.js Editor Manual
// Lifecycle: init, start, update, stop
// In scope: player, renderer, scene, camera
// player.fx.wind / mist / heal / flow / palette  — grove VFX
// this = the object that owns the script

function init() {}

function start() {}

function update(event) {
  // const dt = event.delta * 0.001;
  // player.fx.flow(this.position, player.app.world.dummyPos, dt, { palette: 'heal' });
}

function stop() {}
`;

function uid() {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

export function createScript(key, name = 'untitled') {
  return {
    id: uid(),
    key,
    name,
    source: DEFAULT_SCRIPT_SOURCE,
    enabled: true
  };
}

/** Module-level document so export/import can run without the App instance. */
export const scriptDocument = {
  version: SCRIPT_VERSION,
  scripts: []
};

export function listScripts(key) {
  if (!key) return scriptDocument.scripts.slice();
  return scriptDocument.scripts.filter((row) => row.key === key);
}

export function getScript(id) {
  return scriptDocument.scripts.find((row) => row.id === id) ?? null;
}

export function upsertScript(record) {
  if (!record?.id) return null;
  const index = scriptDocument.scripts.findIndex((row) => row.id === record.id);
  const next = {
    id: record.id,
    key: String(record.key || 'scene'),
    name: String(record.name || 'untitled'),
    source: String(record.source ?? DEFAULT_SCRIPT_SOURCE),
    enabled: record.enabled !== false
  };
  if (index >= 0) scriptDocument.scripts[index] = next;
  else scriptDocument.scripts.push(next);
  return next;
}

export function removeScript(id) {
  const index = scriptDocument.scripts.findIndex((row) => row.id === id);
  if (index < 0) return false;
  scriptDocument.scripts.splice(index, 1);
  return true;
}

export function snapshotScripts() {
  return {
    version: SCRIPT_VERSION,
    scripts: structuredClone(scriptDocument.scripts)
  };
}

export function replaceScripts(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.scripts)
      ? payload.scripts
      : [];
  scriptDocument.scripts = rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      id: String(row.id || uid()),
      key: String(row.key || 'scene'),
      name: String(row.name || 'untitled'),
      source: String(row.source ?? DEFAULT_SCRIPT_SOURCE),
      enabled: row.enabled !== false
    }));
  return scriptDocument.scripts;
}

export function scriptsForAbility(element) {
  return listScripts(`ability:${element}`);
}
