import { getSql } from "@/lib/db";
import { flattenSkills, labIdForSkill } from "@/lab/rpg/warlordsApi.js";

const STORE = "https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json";
const CONTRACT = "grudge.weaponSkill/v2";

type CatalogSkill = {
  id: string;
  name: string;
  iconUrl?: string;
  weaponType?: string;
  slot?: string;
  tier?: number;
  cooldown?: number;
  description?: string;
  damage?: number;
  labId?: string | null;
  uuid?: string | null;
};

type SkillDoc = Record<string, unknown>;

let catalogAt = 0;
let catalog: CatalogSkill[] = [];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: cors });
}

export function preflight() {
  return new Response(null, { status: 204, headers: cors });
}

function emptyVfx() {
  return {
    intent: "",
    fromWhere: "blade",
    movement: "fly",
    projectile: "crescent",
    trail: "streak",
    speed: 28,
    castTime: 0.2,
    chargeAnim: "combo1",
    dropAsset: "",
    impact: "burst",
    aura: "none",
    transform: "",
  };
}

async function catalogSkills(): Promise<CatalogSkill[]> {
  if (catalog.length && Date.now() - catalogAt < 1000 * 60 * 10) return catalog;
  const response = await fetch(STORE, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ObjectStore ${response.status}`);
  const data = await response.json();
  catalog = flattenSkills(data) as CatalogSkill[];
  catalogAt = Date.now();
  return catalog;
}

function animPackFor(weapon: string) {
  const id = String(weapon || "").toUpperCase();
  if (id.includes("BOW") || id.includes("GUN") || id.includes("CROSS")) return "bow";
  if (id.includes("STAFF") || id.includes("WAND") || id.includes("TOME")) return "staff";
  if (id.includes("GREAT")) return "greatsword";
  return "sword_shield";
}

function animRoleFor(skill: CatalogSkill) {
  const lab = skill.labId || labIdForSkill(skill);
  if (lab === "combo1") return "combo1";
  if (lab === "combo2") return "combo2";
  if (lab === "combo3") return "combo3";
  if (skill.slot === "primary" || skill.tier === 0) return "combo1";
  return "cast1";
}

function defaultVfx(skill: CatalogSkill) {
  const lab = skill.labId || labIdForSkill(skill);
  const recipe = emptyVfx();
  if (lab === "combo2") {
    recipe.projectile = "dart";
    recipe.movement = "lunge";
    recipe.chargeAnim = "combo2";
    recipe.castTime = 3;
  } else if (lab === "combo3") {
    recipe.projectile = "sweep";
    recipe.movement = "arc";
    recipe.fromWhere = "caster";
    recipe.chargeAnim = "combo3";
    recipe.castTime = 4;
  } else if (lab === "fireBolt" || lab === "aimedShot") {
    recipe.projectile = lab === "aimedShot" ? "beam" : "bolt";
    recipe.fromWhere = "hand";
    recipe.chargeAnim = "cast1";
  }
  return recipe;
}

export function toDocument(skill: CatalogSkill, overlay?: SkillDoc | null): SkillDoc {
  const labId = skill.labId || labIdForSkill(skill);
  const weaponType = String(skill.weaponType || "").toUpperCase();
  const base: SkillDoc = {
    contract: CONTRACT,
    id: skill.id,
    name: skill.name,
    weaponType,
    slot: skill.slot || "",
    tier: skill.tier ?? 0,
    uuid: skill.uuid || null,
    description: skill.description || "",
    runtime: {
      meshSlot: weaponType.toLowerCase() || "sword",
      dmgMul: 1,
      moveDistanceM: labId === "combo2" ? 1.9 : labId === "combo3" ? 1.15 : 1.45,
      animRole: animRoleFor(skill),
      cd: Number(skill.cooldown) || 0,
      animPack: animPackFor(weaponType),
      move: labId === "combo2" ? "toward" : labId === "combo3" ? "around" : "toward",
      labId: labId || null,
      damage: skill.damage ?? null,
    },
    vfx: defaultVfx(skill),
    assets: {
      iconUrl: skill.iconUrl || null,
      modelUrl: null,
    },
    surfaces: ["warlords", "casting", "multiverse"],
    identity: { id: skill.id, name: skill.name, weaponType },
    deploy: {
      warlords: true,
      casting: Boolean(labId),
      production: false,
      promotedAt: null,
    },
    updatedAt: Date.now(),
  };
  if (!overlay) return base;
  return {
    ...base,
    ...overlay,
    id: skill.id,
    runtime: { ...(base.runtime as object), ...((overlay.runtime as object) || {}) },
    vfx: { ...(base.vfx as object), ...((overlay.vfx as object) || {}) },
    assets: { ...(base.assets as object), ...((overlay.assets as object) || {}) },
    deploy: { ...(base.deploy as object), ...((overlay.deploy as object) || {}) },
    identity: base.identity,
    contract: CONTRACT,
  };
}

async function overlays(): Promise<Map<string, SkillDoc>> {
  const sql = await getSql();
  const rows = await sql<{ id: string; payload: string }>`select id, payload from grudge_skills`;
  const map = new Map<string, SkillDoc>();
  for (const row of rows) {
    try {
      map.set(row.id, JSON.parse(row.payload) as SkillDoc);
    } catch {
      /* skip bad row */
    }
  }
  return map;
}

export async function listSkills(filter: { weapon?: string; wired?: string } = {}) {
  const [skills, saved] = await Promise.all([catalogSkills(), overlays()]);
  const weapon = filter.weapon?.toUpperCase();
  const wiredOnly = filter.wired === "1" || filter.wired === "true";
  const docs = skills
    .filter((skill) => !weapon || String(skill.weaponType).toUpperCase() === weapon)
    .map((skill) => toDocument(skill, saved.get(skill.id) || null))
    .filter((doc) => {
      if (!wiredOnly) return true;
      const runtime = doc.runtime as { labId?: string } | undefined;
      return Boolean(runtime?.labId);
    });
  return {
    contract: "grudge.weaponSkillList/v2",
    count: docs.length,
    source: STORE,
    skills: docs,
  };
}

export async function getSkill(id: string) {
  const [skills, saved] = await Promise.all([catalogSkills(), overlays()]);
  const skill = skills.find((row) => row.id === id);
  if (skill) return toDocument(skill, saved.get(id) || null);
  const orphan = saved.get(id);
  if (orphan) return orphan;
  return null;
}

export async function putSkill(id: string, patch: SkillDoc) {
  const current = (await getSkill(id)) || {
    contract: CONTRACT,
    id,
    name: String(patch.name || id),
    vfx: emptyVfx(),
    runtime: {},
    assets: {},
    deploy: { warlords: true, casting: true, production: false },
  };
  const next: SkillDoc = {
    ...current,
    ...patch,
    id,
    runtime: { ...((current.runtime as object) || {}), ...((patch.runtime as object) || {}) },
    vfx: { ...((current.vfx as object) || {}), ...((patch.vfx as object) || {}) },
    assets: { ...((current.assets as object) || {}), ...((patch.assets as object) || {}) },
    deploy: { ...((current.deploy as object) || {}), ...((patch.deploy as object) || {}) },
    updatedAt: Date.now(),
    contract: CONTRACT,
  };
  const sql = await getSql();
  const payload = JSON.stringify(next);
  await sql`
    insert into grudge_skills (id, payload, updated_at)
    values (${id}, ${payload}, now())
    on conflict (id) do update set payload = ${payload}, updated_at = now()
  `;
  return next;
}
