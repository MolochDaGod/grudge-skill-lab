import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { loadWeaponTrees } from "@/lab/rpg/warlordsApi.js";
import { WEAPON_ORDER, WEAPON_TYPES } from "@/lab/rpg/weapons.js";
import { groveSkills, familyOf } from "@/lab/config/skillCatalog.js";
import { ELEMENT_META } from "@/lab/config/settings.js";
import {
  AURAS,
  CAST_STAGES,
  CHARGE_ANIMS,
  EFFECT_OPTIONS,
  FAMILIES,
  FROM_WHERE,
  IMPACTS,
  MOVEMENT,
  PALETTES,
  PROJECTILES,
  TRAILS,
  applyRecipeToSettings,
  emptyRecipe,
  emptyStage,
  exportRecipe,
  hydrateRecipesFromRemote,
  listSavedRecipes,
  parseIntent,
  persistRecipeRemote,
  recipeFor,
  saveRecipe,
  saveRecipeAs,
} from "@/lab/rpg/skillRecipe.js";

type Skill = {
  id: string;
  name: string;
  iconUrl?: string;
  weaponType?: string;
  slot?: string;
  family?: string;
  tier?: number;
  cooldown?: number;
  description?: string;
  damage?: number;
  labId?: string | null;
  source?: string;
  key?: string;
  accent?: string;
  wired?: boolean;
};

type Slot = { type: string; label: string; unlockTier?: number; skills: Skill[] };
type Tree = { id: string; name: string; icon?: string; slots: Slot[] };
type Shelf = "grove" | "saved" | "weapons";
type StageId = "charge" | "cast" | "travel" | "impact" | "fade";

type LabApp = {
  element?: string;
  selectAbility?: (id: string, opts?: { silent?: boolean }) => void;
  editor?: { refresh: () => void; presets: { persistSession: () => boolean } };
  hud?: { showToast: (message: string) => void };
  auras?: { pulse: (role: string, opts?: object) => void; setVariant?: (form: string, id: string) => void };
};

function lab(): LabApp | undefined {
  return (window as unknown as { app?: LabApp }).app;
}

function rpg() {
  return (window as unknown as { __rpg?: { setWeapon: (id: string) => string } }).__rpg;
}

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toast(message: string) {
  lab()?.hud?.showToast?.(message);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((row) => (
        <option key={row.id} value={row.id}>
          {row.label}
        </option>
      ))}
    </select>
  );
}

function matchesFamily(skill: Skill, family: string, recipe?: { family?: string; bending?: boolean }) {
  if (family === "all") return true;
  if (family === "bending") return Boolean(recipe?.bending) || skill.family === "bending" || recipe?.family === "bending";
  const resolved = recipe?.family || skill.family || familyOf(skill.labId || skill.id);
  return resolved === family;
}

export function SkillStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [shelf, setShelf] = useState<Shelf>("grove");
  const [trees, setTrees] = useState<Tree[]>([]);
  const [status, setStatus] = useState("Loading skills…");
  const [weaponId, setWeaponId] = useState("SWORD");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [recipe, setRecipe] = useState(emptyRecipe());
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [saved, setSaved] = useState<Skill[]>([]);
  const [stageId, setStageId] = useState<StageId>("cast");
  const grove = useMemo(() => groveSkills() as Skill[], []);

  const refreshSaved = () => {
    const paint = () => {
      const local = listSavedRecipes().map((row) => {
        const groveHit = grove.find((g) => g.id === row.id || g.labId === row.id);
        return {
          id: row.id,
          name: row.recipe.name || groveHit?.name || row.id,
          labId: row.recipe.labId || groveHit?.labId || (ELEMENT_META[row.id] ? row.id : null),
          weaponType: row.recipe.weaponType || groveHit?.weaponType,
          family: row.recipe.family || groveHit?.family,
          slot: "saved",
          source: "saved",
          description: row.recipe.intent || groveHit?.description,
          wired: Boolean(groveHit?.labId || ELEMENT_META[row.id]),
        } as Skill;
      });
      setSaved(local);
    };
    paint();
    void hydrateRecipesFromRemote()
      .then(() => paint())
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStatus("Loading skills…");
    refreshSaved();
    void loadWeaponTrees()
      .then((pack) => {
        if (!alive) return;
        const list = (pack.trees || []) as Tree[];
        const total =
          (pack.meta as { total?: number } | undefined)?.total ?? pack.skills?.length ?? 0;
        setTrees(list);
        setStatus(`${grove.length} grove · ${total} Warlords · recipes in lab DB`);
        setWeaponId((current) =>
          list.some((row) => row.id === current) ? current : list[0]?.id || current
        );
      })
      .catch((error) => {
        if (!alive) return;
        setStatus(error instanceof Error ? error.message : "Catalog failed");
      });
    return () => {
      alive = false;
    };
  }, [open, grove.length]);

  const ordered = useMemo(() => {
    const rank = new Map(WEAPON_ORDER.map((id, index) => [id, index]));
    return [...trees].sort((a, b) => {
      const da = rank.has(a.id) ? (rank.get(a.id) as number) : 99;
      const db = rank.has(b.id) ? (rank.get(b.id) as number) : 99;
      return da - db || a.name.localeCompare(b.name);
    });
  }, [trees]);

  const weapon = ordered.find((row) => row.id === weaponId) ?? ordered[0] ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (list: Skill[]) =>
      list.filter((row) => {
        if (!matchesFamily(row, family, recipeFor(row.id))) return false;
        if (!q) return true;
        return `${row.name} ${row.id} ${row.weaponType || ""} ${row.family || ""} ${row.description || ""}`
          .toLowerCase()
          .includes(q);
      });
    if (shelf === "grove") return filter(grove);
    if (shelf === "saved") return filter(saved);
    return filter(weapon ? weapon.slots.flatMap((slot) => slot.skills) : []);
  }, [shelf, grove, saved, weapon, query, family]);

  const skill = visible.find((row) => row.id === skillId) ?? visible[0] ?? null;

  useEffect(() => {
    if (!skill) return;
    const next = recipeFor(skill.id);
    if (!next.family) next.family = skill.family || familyOf(skill.labId || skill.id);
    setRecipe(next);
    setNote("");
  }, [skill?.id]);

  if (!open) return null;

  const patch = (partial: Record<string, unknown>) => {
    setRecipe((prev) => ({ ...prev, ...partial }));
  };

  const patchStage = (partial: Record<string, unknown>) => {
    const current = recipe.stages?.[stageId] || emptyStage();
    patch({
      stages: {
        ...(recipe.stages || {}),
        [stageId]: { ...emptyStage(), ...current, ...partial },
      },
    });
  };

  const saveNew = () => {
    if (!skill) return;
    const label = window.prompt("Name this VFX recipe", `${skill.name} variant`);
    if (!label) return;
    const id = saveRecipeAs(skill.id, {
      ...recipe,
      name: label,
      labId: skill.labId,
      weaponType: skill.weaponType,
    }, label);
    refreshSaved();
    setShelf("saved");
    setSkillId(id);
    setNote(`Saved new recipe · ${label}`);
    toast(`Saved ${label}`);
    void persistRecipeRemote(
      { ...skill, id, name: label },
      { ...recipe, name: label, labId: skill.labId, weaponType: skill.weaponType },
    ).catch(() => undefined);
  };

  const apply = async (andTry = false, publish = false) => {
    if (!skill) return;
    const payload = {
      ...recipe,
      name: skill.name,
      labId: skill.labId,
      weaponType: skill.weaponType,
    };
    saveRecipe(skill.id, payload);
    refreshSaved();
    const labId = skill.labId || (ELEMENT_META[skill.id] ? skill.id : null);
    const wired = labId ? applyRecipeToSettings(labId, recipe) : false;
    lab()?.editor?.refresh?.();
    lab()?.editor?.presets?.persistSession?.();
    if (recipe.aura && recipe.aura !== "none") {
      lab()?.auras?.pulse?.(recipe.aura, { silent: true });
    }
    if (recipe.variant) {
      lab()?.auras?.setVariant?.("fire", recipe.variant);
    }
    try {
      await persistRecipeRemote({ ...skill, labId }, payload, { production: publish });
      if (publish) {
        setNote("Published. Warlords can fetch this id.");
        toast(`${skill.name} published`);
      } else {
        setNote(
          wired
            ? `Saved to lab DB · ${recipe.variant} on ${recipe.family}${recipe.bending ? " + bending" : ""}.`
            : "Saved to lab DB.",
        );
        toast(wired ? `${skill.name} applied` : `${skill.name} saved`);
      }
    } catch (error) {
      if (publish) {
        setNote(error instanceof Error ? error.message : "Publish failed");
        toast("Publish failed");
        return;
      }
      setNote(
        wired
          ? `Applied locally · lab DB unreachable.`
          : "Saved locally. Lab DB unreachable.",
      );
      toast(wired ? `${skill.name} applied` : `${skill.name} saved`);
    }
    if (andTry && labId) {
      rpg()?.setWeapon?.(skill.weaponType || weaponId);
      lab()?.selectAbility?.(labId, { silent: true });
      const cast = (window as unknown as { __labCast?: (id: string) => void }).__labCast;
      cast?.(labId);
    }
  };

  const readIntent = () => {
    const next = parseIntent(recipe.intent, recipe);
    setRecipe(next);
    setNote("Intent read into knobs, palette, and family.");
  };

  const branches =
    shelf === "weapons" && weapon
      ? weapon.slots.map((slot) => ({
          key: slot.type + slot.label,
          label: slot.label,
          hint: `T${slot.unlockTier ?? 0}`,
          skills: slot.skills.filter((node) => visible.some((row) => row.id === node.id)),
        }))
      : [
          {
            key: shelf,
            label: shelf === "grove" ? "Grove generics" : "Saved recipes",
            hint: `${visible.length}`,
            skills: visible,
          },
        ];

  return (
    <aside className="studio-desk" onPointerDown={(event) => event.stopPropagation()}>
      <header className="studio-desk__head">
        <div>
          <p className="studio-desk__kicker">All skills</p>
          <h2>Skill Studio</h2>
        </div>
        <p className="studio-desk__status">{status}</p>
        <button type="button" className="studio-desk__close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="studio-toolbar">
        <nav className="studio-tabs" aria-label="Skill shelves">
          {(
            [
              ["grove", "Grove"],
              ["saved", "Saved"],
              ["weapons", "Weapons"],
            ] as [Shelf, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={shelf === id ? "is-on" : undefined}
              onClick={() => {
                setShelf(id);
                setSkillId(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <label className="studio-search">
          <span className="sr-only">Search skills</span>
          <input
            value={query}
            placeholder="Search grove, saved, or Warlords…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <nav className="studio-families" aria-label="Families">
        {FAMILIES.map((row) => (
          <button
            key={row.id}
            type="button"
            className={family === row.id ? "is-on" : undefined}
            onClick={() => setFamily(row.id)}
          >
            {row.label}
          </button>
        ))}
      </nav>

      {shelf === "weapons" ? (
        <nav className="studio-weapons" aria-label="Weapons">
          {ordered.map((row) => {
            const meta = WEAPON_TYPES[row.id as keyof typeof WEAPON_TYPES];
            const on = row.id === weapon?.id;
            return (
              <button
                key={row.id}
                type="button"
                className={on ? "is-on" : undefined}
                onClick={() => {
                  setWeaponId(row.id);
                  setSkillId(null);
                  rpg()?.setWeapon?.(row.id);
                }}
              >
                {row.icon ? <img src={row.icon} alt="" /> : null}
                <span>{meta?.name || row.name}</span>
              </button>
            );
          })}
        </nav>
      ) : null}

      <div className="studio-desk__body">
        <section className="studio-tree" aria-label="Skill list">
          {visible.length === 0 ? (
            <p className="studio-empty">
              {shelf === "saved"
                ? "Nothing saved yet. Apply a grove skill and it lands here."
                : "No skills in this filter."}
            </p>
          ) : (
            branches.map((branch) =>
              branch.skills.length ? (
                <div className="studio-branch" key={branch.key}>
                  <header>
                    <b>{branch.label}</b>
                    <span>{branch.hint}</span>
                  </header>
                  <div className="studio-nodes">
                    {branch.skills.map((node) => {
                      const on = skill?.id === node.id;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          className={on ? "is-on" : undefined}
                          onClick={() => setSkillId(node.id)}
                        >
                          {node.iconUrl ? <img src={node.iconUrl} alt="" /> : <i />}
                          <span>
                            <b>{node.name}</b>
                            <em>
                              {node.labId ? "wired" : node.source || "catalog"}
                              {node.family ? ` · ${node.family}` : ""}
                              {node.key ? ` · ${node.key}` : ""}
                            </em>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null
            )
          )}
        </section>

        <section className="studio-inspect" aria-label="Skill editor">
          {!skill ? (
            <p className="studio-empty">Select a skill.</p>
          ) : (
            <>
              <div className="studio-inspect__hero">
                {skill.iconUrl ? <img src={skill.iconUrl} alt="" /> : null}
                <div>
                  <h3>{skill.name}</h3>
                  <p>
                    {skill.weaponType || "grove"} · {skill.family || skill.slot || "skill"}
                    {skill.labId ? ` · ${skill.labId}` : " · not wired"}
                    {skill.key ? ` · ${skill.key}` : ""}
                  </p>
                  {skill.description ? <p>{skill.description}</p> : null}
                </div>
              </div>

              <Field label="Palette — linear, AoE, and bending">
                <div className="studio-palettes" role="radiogroup" aria-label="Colour variant">
                  {PALETTES.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={recipe.variant === row.id ? "is-on" : undefined}
                      style={{ "--swatch": row.accent } as CSSProperties}
                      onClick={() => patch({ variant: row.id })}
                      title={row.label}
                    >
                      <i />
                      <span>{row.label}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={Boolean(recipe.bending)}
                  onChange={(event) =>
                    patch({
                      bending: event.target.checked,
                      family: event.target.checked ? "bending" : recipe.family,
                      trail: event.target.checked ? "streak" : recipe.trail,
                    })
                  }
                />
                Fire-bending streak on this cast
              </label>

              <Field label="What should happen visually">
                <textarea
                  rows={3}
                  value={recipe.intent}
                  placeholder="Blue linear lance, fire-bending trail, burst on hit…"
                  onChange={(event) => patch({ intent: event.target.value })}
                />
              </Field>
              <div className="studio-inspect__row">
                <button type="button" onClick={readIntent}>
                  Read intent
                </button>
                <span className="studio-hint">Fills knobs, family, and palette from that sentence.</span>
              </div>

              <Field label="Cast stage — assign a grove effect">
                <div className="studio-stages" role="tablist" aria-label="Cast stages">
                  {CAST_STAGES.map((row) => {
                    const id = row.id as StageId;
                    const wired = recipe.stages?.[id]?.effect && recipe.stages[id].effect !== "none";
                    return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={stageId === id}
                      className={stageId === id ? "is-on" : undefined}
                      onClick={() => setStageId(id)}
                    >
                      {row.label}
                      {wired ? <i /> : null}
                    </button>
                    );
                  })}
                </div>
              </Field>
              <div className="studio-grid">
                <Field label={`${CAST_STAGES.find((row) => row.id === stageId)?.label || "Stage"} effect`}>
                  <Select
                    value={recipe.stages?.[stageId]?.effect || "none"}
                    onChange={(id) => patchStage({ effect: id })}
                    options={EFFECT_OPTIONS}
                  />
                </Field>
                <Field label="Stage trail">
                  <Select
                    value={recipe.stages?.[stageId]?.trail || "none"}
                    onChange={(id) => patchStage({ trail: id })}
                    options={TRAILS}
                  />
                </Field>
                <Field label="Stage aura">
                  <Select
                    value={recipe.stages?.[stageId]?.aura || "none"}
                    onChange={(id) => patchStage({ aura: id })}
                    options={AURAS}
                  />
                </Field>
              </div>
              <p className="studio-hint">
                Charge fires as you start the skill. Cast / travel / impact / fade play on that Ability phase.
              </p>

              <div className="studio-grid">
                <Field label="Family">
                  <Select
                    value={recipe.family}
                    onChange={(id) => patch({ family: id, bending: id === "bending" ? true : recipe.bending })}
                    options={FAMILIES.filter((row) => row.id !== "all")}
                  />
                </Field>
                <Field label="From where">
                  <Select
                    value={recipe.fromWhere}
                    onChange={(id) => patch({ fromWhere: id })}
                    options={FROM_WHERE}
                  />
                </Field>
                <Field label="Movement">
                  <Select
                    value={recipe.movement}
                    onChange={(id) => patch({ movement: id })}
                    options={MOVEMENT}
                  />
                </Field>
                <Field label="Projectile">
                  <Select
                    value={recipe.projectile}
                    onChange={(id) => patch({ projectile: id })}
                    options={PROJECTILES}
                  />
                </Field>
                <Field label="Trail">
                  <Select
                    value={recipe.trail}
                    onChange={(id) => patch({ trail: id })}
                    options={TRAILS}
                  />
                </Field>
                <Field label="Charge animation">
                  <Select
                    value={recipe.chargeAnim}
                    onChange={(id) => patch({ chargeAnim: id })}
                    options={CHARGE_ANIMS}
                  />
                </Field>
                <Field label="Impact">
                  <Select
                    value={recipe.impact}
                    onChange={(id) => patch({ impact: id })}
                    options={IMPACTS}
                  />
                </Field>
                <Field label="Aura">
                  <Select
                    value={recipe.aura}
                    onChange={(id) => patch({ aura: id })}
                    options={AURAS}
                  />
                </Field>
                <Field label="Drop asset">
                  <input
                    type="text"
                    value={recipe.dropAsset}
                    placeholder="optional GLB / effect id"
                    onChange={(event) => patch({ dropAsset: event.target.value })}
                  />
                </Field>
                <Field label="Speed">
                  <input
                    type="number"
                    min={4}
                    max={80}
                    value={recipe.speed}
                    onChange={(event) => patch({ speed: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Cast time (s)">
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={recipe.castTime}
                    onChange={(event) => patch({ castTime: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Transform">
                  <input
                    type="text"
                    value={recipe.transform}
                    placeholder="spin, scale, bank…"
                    onChange={(event) => patch({ transform: event.target.value })}
                  />
                </Field>
              </div>

              {note ? <p className="studio-note">{note}</p> : null}

              <div className="studio-actions">
                <button type="button" className="primary" onClick={() => void apply(false)}>
                  Apply
                </button>
                <button type="button" onClick={saveNew}>
                  Save new
                </button>
                <button type="button" onClick={() => void apply(true)}>
                  Try in grove
                </button>
                <button type="button" onClick={() => void apply(false, true)}>
                  Publish
                </button>
                <button
                  type="button"
                  onClick={() => download(`${skill.id}.recipe.json`, exportRecipe(skill, recipe))}
                >
                  Export
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </aside>
  );
}
