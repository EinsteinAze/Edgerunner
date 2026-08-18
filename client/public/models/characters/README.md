# Character assets

## Important: the primary player/remote character does NOT load from here

Per the loader's expected path (`GLB_PATH` in
`client/src/game/CharacterLoader.js`), the one character model that's
actually wired up — used for both the local player and every remote
player — loads from:

```
client/public/models/character.glb
```

(directly in `models/`, one level up from this folder) — see
`../README.md` for its full spec.

## What this folder is for

Reserved for *additional* character-type assets beyond the primary player
model — for example, if you later want a distinct realistic model for the
memory/hologram figures (Mara, Noah, Sera, Kian), which currently render as
tinted, translucent versions of the same procedural character
(`buildCharacter()` + `makeHologram()` in `CharacterModel.js`), not as
loaded GLBs. Nothing currently loads from this folder — it's prepared, not
wired up, since the priority was getting the primary player character
pipeline right first.

If you want to extend it: `AssetLoader.js`'s `spawnAsset()` is the same
general-purpose loader used everywhere else in the asset pipeline and would
work here too; it just isn't called against this folder anywhere yet.
