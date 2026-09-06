# Grudge Skill Lab

Production combat range for **Grudge Warlords** weapon skills, class F totems, animation, and VFX.

Live lab: [weapon-skills.grudge-studio.com](https://weapon-skills.grudge-studio.com)  
Skill API: [weapon-skills.grudge-studio.com/api/v1](https://weapon-skills.grudge-studio.com/api/v1)  
Canon: [info.grudge-studio.com/docs](https://info.grudge-studio.com/docs) · ObjectStore `master-weaponSkills.json`

This is the editor / test bed that feeds deployable prefabs — not a dump of every mesh we have ever imported.

---

## Combat range

The grove is a clean QA scene:

| Unit | Role | Why it is here |
| --- | --- | --- |
| **Boss dummy** | Hostile, oversized | Boss-reach, big HP, mitigation |
| **Pack of 4** | Small hostiles | Cleave / nova / volley splash |
| **Ally dummy** | Light green, allied to all, DoT | Healing (Holy Light, Freya totem) |

Heals never hit hostiles. Damage never hits the ally. AoE can tag the whole pack.

---

## Controls

| Key | Action |
| --- | --- |
| `1 2 3` | Weapon-class 3-hit combo (per melee type) |
| `4–6` | Kit / class loadout |
| **`F`** | Class T0 totem (mage fire · priest heal · virtuoso air). Pulses when you act. Recast replants. |
| `7 8 9 0` | Shadow clones · sky fist · sky blades · shadow step |
| `Shift` | Dash to nearest hostile (stamina) |
| `I` | Character sheet (8 ATTR + secondaries) |
| `J` | Combat panel (Skills / Stats / Live HUD) |
| `L` | Grove library (clips, effects, projectiles) |
| `[ ]` | Cycle weapon types |

Mage / priest / virtuoso **F** is the official cooldown-0 class ability: plant the totem, fire the secondary (Arcane Bolt / Smite / wind), restore resources, then every later act pulses the standing totem.

---

## Runtime assets (git)

Kept in-repo, game-ready:

- `public/models/warlords/*.glb` — 6 race play bodies
- `public/models/valhalla/human.glb` — worge bear clip source (walk / idle)
- `public/models/valhalla/dummy.glb` — range dummy
- `public/models/valhalla/attackcombo.glb` — combo fallback
- `public/models/totems/totem_nordin_t0.glb`, `totem_nordin_t1.glb`, `totem_freya_t3.glb`, `totem_odin_t6.glb` — class F
- Mixamo fallback `Idle.fbx` + `cast1–3.fbx` + `diffuse.png`
- Ground / HDR / brand / skill icons

**Not in git** (see `.gitignore`): duplicate `public/assets/` (~23 MB), unused valhalla NPCs / foliage / frog / extra totems (~20 MB). Production meshes also live on [assets.grudge-studio.com](https://assets.grudge-studio.com/). Combo packs pull Mixamo from the CDN when local clips are missing.

---

## Skill API

`GET /api/v1` — contract index.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/skills?weapon=SWORD&wired=1` | Flattened ObjectStore skills + lab VFX (catalog cached in Postgres) |
| `GET` | `/api/v1/skills?saved=1` | Recipes saved in the lab database |
| `GET` | `/api/v1/skills/:id` | One skill (catalog + published override) |
| `PUT` | `/api/v1/skills/:id` | Save / publish a visual recipe |
| `GET` | `/api/v1/kit` | Grudge 6 race mesh / skeleton / anim pack index |

CORS is open. Auth is off: skill overlays and the catalog snapshot are unowned world rows (no accounts). Skill Studio **Save** writes the database; **Publish** marks `deploy.production`. Character sheets stay in the browser.

VFX recipe knobs: `intent`, `fromWhere`, `movement`, `projectile`, `trail`, `speed`, `castTime`, `chargeAnim`, `dropAsset`, `impact`, `aura`, `transform`.

After this repo is redeployed, ObjectStore (`info.grudge-studio.com`) should point `weapon-skills` and class F totems at this contract.

---

## Develop

```bash
npm install
npm run dev          # 0.0.0.0:8080
```

Stack: Vite + TanStack Start, Three.js r185, official Warlords math (`src/lab/rpg/grudgeMath.js`).

---

## Deploy

Push `main`. Preview / production should bind `0.0.0.0:8080` (see `startup.sh`). Keep binary meshes on R2/CDN; this repo stays source + the small runtime kit.
