# THE CHILDREN OF ARASAKA

A browser-based, third-person, multiplayer narrative game — an original story in the
spirit of *Cyberpunk: Edgerunners*, told across six acts as Lucy returns to the Arasaka
facility where she and four other children were raised as netrunners.

Not affiliated with CD PROJEKT RED or Studio Trigger. Original characters, map, and
dialogue.

## Running it

Two processes: a Socket.IO relay server (multiplayer) and a Vite dev server (the game).

```bash
cd server && npm install && npm start
```

```bash
cd client && npm install && npm run dev
```

Then open the client URL (default `http://localhost:5173`) in a browser. Open it in a
second tab/window to play with another "runner" in the same space.

## Structure

- `server/` — Express + Socket.IO. Tracks connected players in a shared room and relays
  position, animation state, act number, and chat.
- `client/` — Three.js + Vite. No external 3D assets; everything (map, characters,
  hologram figures) is procedural low-poly geometry.
  - `src/game/StoryManager.js` — the six acts, their beats (interactive story moments),
    dialogue lines, and the three branching endings.
  - `src/game/World.js` — the six connected zones (apartment → facility → training room →
    flashback corridor → archive → data core), gated between acts.
  - `src/game/Interactables.js` — finds the nearest active story beat and fires it, on
    proximity or on `E`.
  - `src/game/Dialogue.js` — the line-by-line dialogue sequencer.
  - `src/game/Game.js` — ties it all together: player, camera, world, story, dialogue,
    networking, render loop.
  - `src/main.js` — screens (login, menu, HUD, pause, act transitions) and DOM wiring.

## Controls

`WASD` move · `Shift` sprint · `Space` jump · mouse look (click to lock cursor) ·
`Scroll` zoom · `E` interact / advance dialogue · `Enter` chat · `Esc` pause.

## Story choice

Act VI ends with three consoles: **DESTROY**, **JOIN**, and a hidden third option,
**RELEASE**, tucked in a back corner of the data core. Each gives a different ending.
