# Environment assets

This folder is prepared for room-scale architectural pieces (walls,
corridor sections, structural set-dressing) — as opposed to `../props/`,
which holds smaller reused objects (racks, terminals, cameras, crates).

## Current status: reserved, not yet wired

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
