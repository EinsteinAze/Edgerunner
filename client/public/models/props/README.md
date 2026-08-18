# Prop assets

Drop matching `.glb` files here and `World.js` will automatically swap the
matching procedural prop for the real model, in the four priority zones
(Facility, Flashback Corridor, Archive, Data Core). Every file below is
**optional** — until it exists, the existing procedural version keeps
rendering exactly as it does today.

All are loaded/cloned/cached through `client/src/game/AssetLoader.js`.

## Expected files

| File | Used in | Count | Real-world size (W×H×D, meters) | Notes |
|---|---|---|---|---|
| `server-rack.glb` | Facility, Archive, Data Core | 11 | ~0.9 × 2.2 × 0.7 | Data Core instances are auto-scaled ~2.7× taller (they replace 6m-tall procedural racks) — model at the 2.2m height above and the scale-up happens automatically. |
| `terminal.glb` | Facility, Archive | 2 | ~0.56 × 0.9 × 0.3 (screen+frame only; a glowing screen overlay stays on top of it, so the model itself doesn't need an emissive display) | |
| `security-camera.glb` | Facility | 2 | ~0.06 × 0.08 × 0.22 | Small wall-mounted dome/box camera. Mount bracket + lens + blink LED are kept as procedural overlay detail. |
| `container.glb` | Facility, Flashback Corridor | 2 | ~0.9 × 0.9 × 0.6 | Crate/container. A "TOXIC" warning decal is placed next to it automatically — no need to bake one into the model. |
| `data-console.glb` | Data Core | 2 | ~1.1 × 1.8 × 1.1 | The two "DESTROY" / "JOIN" story-choice consoles. These are **interactable anchors** — swapping the visual never changes their position, so this is safe to add at any time. |
| `hidden-console.glb` | Data Core | 1 | ~0.6 × 1.1 × 0.6 | The secret third ending's console — keep this visually subdued/unlit to preserve the "hidden" framing. |

## What "swap" means here

Each procedural prop above is still built in full, every time — the model
load is attempted in parallel, and only replaces the *rendered* mesh once
it actually resolves. Colliders, interaction anchors, and any story logic
keep using the original procedural transform regardless of whether the
visual swap happens. So: nothing breaks if a file is missing, wrong, or
slow to load, and you can add these one at a time.

## Format requirements

- Binary glTF (`.glb`), not `.gltf` + separate texture files.
- Origin at the object's base/center as appropriate — same convention as
  the size column above (these already match this game's real-world scale
  in meters, so a 1:1 export from a modeling tool set to meters will fit
  with no extra scale parameter).
- PBR materials (`MeshStandardMaterial`-compatible: base color, roughness,
  metalness, normal map, emissive map) — glTF's standard PBR material model
  maps onto Three.js's `MeshStandardMaterial` automatically, no extra work
  needed on the code side.
- Keep triangle counts modest (low thousands per prop, not tens of
  thousands) — these are reused many times per zone.
