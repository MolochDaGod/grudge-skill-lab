/**
 * Warlords / Grudge 6 mesh + animation kit — the play contract.
 *
 * Three layers, do not mix:
 *   1. ObjectStore JSON  — design (skills, races, stats)
 *   2. D1 asset registry — index (uuid, boneMap, packs)
 *   3. R2 CDN            — binaries (GLB)
 *
 * Golden body for Warlords: Toon-RTS {race}.glb, Bip001, SI 1.8 m,
 * equip by mesh visibility. Mixamo `/models/characters/*.glb` is a
 * different skeleton — never retarget onto Bip001 kits.
 */

export const CDN = "https://assets.grudge-studio.com";
export const D1 = "https://api.grudge-studio.com/assets";
export const STORE = "https://objectstore.grudge-studio.com/api/v1";

export const ANIM_PACKS = [
  "glocomotion",
  "glocomotion_combat",
  "gestures_basic",
] as const;

export const SOCKETS = {
  weapon: ["Dummy_Weapon_R_Eff", "Dummy_Hand_R", "Bip001 R Hand"],
  offhand: ["Dummy_Hand_L", "Bip001 L Hand"],
  helm: ["Dummy_Top", "Bip001 Head"],
  chest: ["Dummy_Chest", "Bip001 Spine1"],
} as const;

export const GRUDGE6_RACES = [
  {
    id: "human",
    name: "Human",
    boneMap: "bip001",
    siMeters: 1.8,
    playUrl: "/models/warlords/human.glb",
    packUrl: `${CDN}/models/grudge6/hum/HUM_Characters.glb`,
    mixamoUrl: `${CDN}/models/characters/human.glb`,
    animPacks: ANIM_PACKS,
  },
  {
    id: "barbarian",
    name: "Barbarian",
    boneMap: "bip001",
    siMeters: 1.88,
    playUrl: "/models/warlords/barbarian.glb",
    packUrl: `${CDN}/models/grudge6/brb/BRB_Characters.glb`,
    mixamoUrl: `${CDN}/models/characters/barbarian.glb`,
    animPacks: ANIM_PACKS,
  },
  {
    id: "elf",
    name: "Elf",
    boneMap: "bip001",
    siMeters: 1.82,
    playUrl: "/models/warlords/elf.glb",
    packUrl: `${CDN}/models/grudge6/elf/ELF_Characters.glb`,
    mixamoUrl: `${CDN}/models/characters/elf.glb`,
    animPacks: ANIM_PACKS,
  },
  {
    id: "dwarf",
    name: "Dwarf",
    boneMap: "bip001",
    siMeters: 1.52,
    playUrl: "/models/warlords/dwarf.glb",
    packUrl: `${CDN}/models/grudge6/dwr/DWR_Characters.glb`,
    mixamoUrl: `${CDN}/models/characters/dwarf.glb`,
    animPacks: ANIM_PACKS,
  },
  {
    id: "orc",
    name: "Orc",
    boneMap: "bip001",
    siMeters: 1.9,
    playUrl: "/models/warlords/orc.glb",
    packUrl: `${CDN}/models/grudge6/orc/ORC_Characters.glb`,
    mixamoUrl: `${CDN}/models/characters/orc.glb`,
    animPacks: ANIM_PACKS,
  },
  {
    id: "undead",
    name: "Undead",
    boneMap: "bip001",
    siMeters: 1.78,
    playUrl: "/models/warlords/undead.glb",
    packUrl: `${CDN}/models/grudge6/und/UND_Characters.glb`,
    mixamoUrl: `${CDN}/models/characters/undead.glb`,
    animPacks: ANIM_PACKS,
  },
] as const;

export const CLIP_ROLES = {
  idle: "idle / warbear_stand (pack idle, not a rest pose)",
  combo1: "T0 primary — Practice Slash",
  combo2: "T0 ability — Quick Thrust / lunge",
  combo3: "T0 ability — Wide Sweep",
  cast1: "staff / ranged release",
  cast2: "charge / style",
  cast3: "heavy / finisher",
} as const;

export const EFFECT_FAMILIES = [
  { id: "crescent", delivery: "weapon", use: "slash that leaves the blade" },
  { id: "dart", delivery: "weapon", use: "thrust / bolt along the aim" },
  { id: "sweep", delivery: "around_caster", use: "front arc, small AoE" },
  { id: "bolt", delivery: "caster_to_target", use: "staff projectile + streak" },
  { id: "beam", delivery: "caster_to_target", use: "held line" },
  { id: "burst", delivery: "impact", use: "hit flash, never a covering sphere" },
  { id: "aura", delivery: "toggle_aura", use: "K/M/B forms as status colour" },
] as const;

export const GUIDE = {
  skeleton: "Bip001 only for Warlords bodies. Scale from the Bip001 bone box, never the skinned AABB. No forceAtlas, no stretch.",
  equip: "mesh_ids visibility on the Toon-RTS kit. Parent extras to Dummy_* / Bip001 sockets listed in sockets.",
  clips: "Packs live on R2 models/animations/*.glb, indexed by D1 /assets/category/animation. Combo takes are a separate GLB.",
  effects: "One recipe per SKIL-* id. Origin is the blade or hand, not a sphere on the torso. Publish via PUT /api/v1/skills/:id.",
  mixamo: "models/characters/*.glb is Mixamo. Do not retarget those clips onto Bip001 kits.",
  worge: "The Valhalla bear GLB is a clip source / NPC, not a player race.",
} as const;

export function kitPayload() {
  return {
    contract: "grudge.warlordsKit/v1",
    golden: "toon-rts-glb",
    boneMap: "bip001",
    siMeters: 1.8,
    equip: "mesh_ids_visibility",
    sockets: SOCKETS,
    animPacks: ANIM_PACKS,
    clipRoles: CLIP_ROLES,
    races: GRUDGE6_RACES,
    effectFamilies: EFFECT_FAMILIES,
    layers: {
      design: STORE,
      index: D1,
      binaries: CDN,
    },
    endpoints: {
      skills: "/api/v1/skills",
      skill: "/api/v1/skills/:id",
      kit: "/api/v1/kit",
      d1Character: `${D1}/category/character`,
      d1Animation: `${D1}/category/animation`,
      masterSkills: `${STORE}/master-weaponSkills.json`,
    },
    guide: GUIDE,
  };
}
