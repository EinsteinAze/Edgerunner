# Environment assets

This folder is prepared for room-scale architectural pieces (walls,
corridor sections, structural set-dressing) — as opposed to `../props/`,
which holds smaller reused objects (racks, terminals, cameras, crates).

## Additive set-dressing (wired up)

Drop **`lucy-apartment-decor.glb`** in this folder and it's loaded
automatically and added into Zone 1 (Lucy's apartment), anchored at the
room's floor center. This is purely additive — it doesn't hide or replace
any procedural geometry or collider, it just adds your model on top. If the
file isn't there, nothing happens (no gap, no error).

Model it in real-world meters, and place everything relative to Blender's
world origin `(0,0,0)` — that point maps to the center of the apartment
floor in-game. Export via `File → Export → glTF 2.0`, format `glTF Binary
(.glb)`, with "Selected Objects" and "Apply Modifiers" checked.

See `World.js`'s `addSetDressing()` / `ENV_MODEL` for the code, and
`AssetLoader.js`'s `spawnAsset()` for the underlying loader. To add more
anchors elsewhere (e.g. a second decoration pass in another zone), add
another `ENV_MODEL` entry and another `addSetDressing(scene, url, { anchor })`
call at the relevant zone.

## Wall swaps: reserved, not yet wired

Unlike the prop swaps (server racks, terminals, security cameras,
containers, consoles — see `../props/README.md`), **no room/wall geometry
is currently hooked up to load a GLB.** That's a deliberate scope call, not
an oversight: walls double as both physical colliders (player collision)
and camera-clip-prevention geometry, and swapping them without a real asset
in hand to test against risked introducing a subtle camera bug for no
provable benefit this pass. Every other part of the visual-asset pipeline
(`AssetLoader.js`, the prop swap pattern in `World.js`) is fully built and
proven, though — wiring a wall is a small, mechanical extension of the same
pattern once there's an actual asset to validate it against.

## How to wire one in, when ready

`addRoom()` in `client/src/game/World.js` already returns its wall meshes:

```js
const room = addRoom(scene, colliders, { x, z, w, d, color, floorColor, key: "z2" });
// room.leftWall, room.rightWall, room.floor, room.ceiling are all THREE.Mesh
```

To upgrade one, import `trySwapForAsset` (already imported at the top of
`World.js`) and call it the same way every prop in `../props/` does:

```js
trySwapForAsset(scene, room.leftWall, "/models/environment/facility-wall-left.glb");
```

This keeps the original wall's collider active either way (physics never
depends on the visual), and only replaces what's rendered if the file
actually loads.

## Suggested first candidates (if you want to extend this)

Matching the priority order from the visual-asset pass — Facility,
Flashback Corridor, Archive, Data Core:

- `facility-wall.glb` — Zone 2's corridor walls
- `flashback-corridor.glb` — Zone 4's damaged/alarm-lit corridor
- `archive-wall.glb` — Zone 5's small records room
- `data-core-wall.glb` — Zone 6's server chamber

Same format requirements as props: binary `.glb`, real-world meters scale,
standard glTF PBR materials, modest triangle counts (these are large,
camera-facing surfaces — a few thousand triangles is plenty).
