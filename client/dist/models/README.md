# 3D assets

This game ships with zero external 3D model files — every character and
every piece of the environment is procedural geometry, generated in code.
This folder is the drop-in point for real GLB assets that upgrade specific
things without touching any gameplay code. Everything here is **optional**:
nothing in this folder currently exists, and the game runs, looks, and
plays identically to before this pipeline was added until you add files.

## Layout

| Path | What it's for | Wired up? |
|---|---|---|
| `character.glb` (this folder, directly) | The primary player + all remote players | **Yes** — becomes the primary character the moment it's present |
| `props/*.glb` | Server racks, terminals, security cameras, containers, consoles in the Facility / Flashback Corridor / Archive / Data Core | **Yes** — see `props/README.md` |
| `environment/*.glb` | Room-scale walls/corridor pieces | Reserved, not yet wired — see `environment/README.md` |
| `characters/*.glb` | Additional character-type assets beyond the primary player | Reserved, not yet wired — see `characters/README.md` |

## `character.glb` — the primary player character

Place a file named **`character.glb`** directly in this folder
(`client/public/models/character.glb`). The loader
(`client/src/game/CharacterLoader.js`) starts fetching it as early as
possible (at app boot, before the login screen is even interacted with), so
by the time a character actually needs to spawn it's very likely already
loaded — in which case it's used immediately as the **primary** character,
with no pop-in swap. If it's still loading, the built-in procedural
character is shown first and gets hot-swapped the instant the GLB resolves.
If it's missing or fails to load/rig, the procedural character is used the
whole time — the game never blocks or crashes on this file.

This applies identically to the local player and every remote multiplayer
player — there's exactly one code path for both.

### What the loader expects

- **Format:** `.glb` (binary glTF). Draco-compressed meshes are supported.
- **Scale:** doesn't matter — the loader measures the model's bounding box
  and auto-scales it to ~1.75m tall, and drops it so the feet sit exactly
  on the ground. Model it at whatever scale is convenient.
- **Rig:** a skinned mesh with a skeleton (for animation). A T-pose/A-pose
  static mesh will still load and display, just without animation.
- **Materials:** standard glTF PBR (base color, roughness, metalness,
  normal map, emissive map) — maps onto Three.js's `MeshStandardMaterial`
  automatically, no extra work needed.
- **Animation clips:** the loader fuzzy-matches clip names (case-insensitive)
  against these patterns — name your clips so at least one of each matches:
  - Idle: contains "idle", "breath", or "stand"
  - Walk: contains "walk"
  - Run: contains "run" or "sprint"
  - Jump: contains "jump"

  Mixamo exports (e.g. "Idle", "Walking", "Running", "Jumping") match these
  out of the box.

### Where to get one

Any of these give you a rigged, animated, CC-friendly humanoid GLB:

- **Mixamo** (mixamo.com, free with an Adobe account) — pick a character,
  download the model as FBX, download "Idle", "Walking", "Running", "Jumping"
  animations separately, then combine and convert to GLB (e.g. with
  [Blender](https://www.blender.org/) or the
  [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) tool).
- **Ready Player Me** (readyplayer.me) — generates a rigged GLB avatar
  directly; pair it with Mixamo animations retargeted in Blender.
- **Quaternius** or **Kenney** asset packs (quaternius.com, kenney.nl) —
  free, pre-rigged, low-poly-realistic humanoid characters, some with
  built-in walk/run/idle clips.

## The underlying loading system

`client/src/game/AssetLoader.js` is the general-purpose GLB loader behind
`props/` and `environment/` — it caches by URL, clones safely (including
skinned meshes, via `SkeletonUtils`), configures shadows, preserves
materials/animations, and never throws (a failed load just resolves to
`null` so callers keep their procedural fallback). `CharacterLoader.js` is
a character-specific wrapper around the same idea, adding the human-scale
auto-fit and animation-clip matching described above.
