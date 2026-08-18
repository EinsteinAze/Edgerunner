import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { buildCharacter, animateCharacter } from "./CharacterModel.js";

// Drop a realistic character export here (see client/public/models/README.md)
// to make it the PRIMARY character everywhere in the game — local player and
// every remote player. No other code needs to change. Until that file
// exists, every spawn silently uses the procedural fallback instead.
const GLB_PATH = "/models/character.glb";

// Human eye-line target height in meters, used to auto-scale whatever GLB is
// dropped in so it matches this game's scale (CameraRig, collision radius,
// etc. all assume a roughly 1.7–1.8m character) regardless of the source
// asset's native units/scale.
const TARGET_HEIGHT = 1.75;

const CLIP_PATTERNS = {
  idle: /idle|breath|stand/i,
  walk: /walk/i,
  run: /run|sprint/i,
  jump: /jump/i,
};

let sourcePromise = null;
// Cached once the promise above resolves, so later spawnCharacter() calls
// (e.g. a remote player joining after the local player already triggered
// the load) can use the GLB immediately instead of racing the same fetch.
let resolvedSource = null;

/**
 * Kicks off the GLB fetch (if not already in flight) and returns a promise
 * that resolves to `{ scene, clips, animations }` once loaded, or `null` if
 * no GLB is present / it failed to load or rig. Safe to call multiple times
 * — the fetch only happens once. Call this early (e.g. at app boot) so the
 * asset has a head start and is likely already resolved by the time a
 * character actually needs to spawn.
 */
export function preloadCharacterAsset() {
  if (!sourcePromise) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(draco);
    sourcePromise = loader
      .loadAsync(GLB_PATH)
      .then((gltf) => {
        const clips = {};
        for (const [key, pattern] of Object.entries(CLIP_PATTERNS)) {
          clips[key] = gltf.animations.find((c) => pattern.test(c.name));
        }
        return { scene: gltf.scene, clips, animations: gltf.animations };
      })
      .catch((err) => {
        console.info("[CharacterLoader] no usable character.glb found — using the procedural character.", err?.message || err);
        return null;
      })
      .then((source) => {
        resolvedSource = source;
        return source;
      });
  }
  return sourcePromise;
}

/**
 * Clones a loaded GLTF source into a fresh, independent character instance:
 * shadows configured, materials cloned per-instance (so cosmetic tints don't
 * bleed between players), auto-scaled/re-centered to this game's human scale
 * with feet at the local origin (matching how the procedural character and
 * PlayerController's position tracking both work), and animation clips wired
 * into a mixer.
 */
function buildGltfInstance(source, cosmetics) {
  const clone = cloneSkinned(source.scene);
  clone.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        applyCosmeticTint(o.material, cosmetics);
      }
    }
  });

  // Normalize scale/origin: whatever height/units the source asset was
  // modeled in, resize it to TARGET_HEIGHT and drop it so the feet sit
  // exactly on the wrapper's local y=0 — this is what PlayerController and
  // RemotePlayer treat as ground level.
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const wrapper = new THREE.Group();
  if (size.y > 0.001) {
    const scale = TARGET_HEIGHT / size.y;
    clone.scale.setScalar(scale);
    box.min.y *= scale;
  }
  clone.position.y -= box.min.y;
  wrapper.add(clone);

  const mixer = new THREE.AnimationMixer(clone);
  const actions = {};
  for (const [key, clip] of Object.entries(source.clips)) {
    if (clip) actions[key] = mixer.clipAction(clip);
  }

  return { root: wrapper, mixer, actions };
}

function activateGltf(handle, built) {
  handle.root = built.root;
  handle.mixer = built.mixer;
  handle.actions = built.actions;
  handle.isGltf = true;
  handle.currentAction = built.actions.idle || Object.values(built.actions)[0];
  handle.currentAction?.play();
}

/**
 * Returns a character "handle". If the GLB has already finished loading by
 * the time this is called, it's used immediately as the primary character —
 * no procedural placeholder, no pop-in swap. Otherwise a procedural
 * character is shown right away (so spawning never blocks on a network
 * fetch) and gets hot-swapped for the GLB the moment it resolves, if it
 * does. Callers only ever touch `.root` (the Object3D to add to the scene /
 * position) and call `.animate(...)` — this shape is identical whether the
 * underlying model is procedural or a loaded GLB, and identical for the
 * local player vs. any remote player, so multiplayer needs no special-casing.
 */
export function spawnCharacter(scene, cosmetics = {}) {
  const handle = {
    root: null,
    mixer: null,
    actions: {},
    isGltf: false,
    phaseRef: { value: 0 },
    currentAction: null,
  };

  if (resolvedSource) {
    try {
      activateGltf(handle, buildGltfInstance(resolvedSource, cosmetics));
    } catch (err) {
      console.warn("[CharacterLoader] GLB present but failed to build an instance — using the procedural model.", err);
    }
  }

  if (!handle.isGltf) {
    handle.root = buildCharacter(cosmetics);
    preloadCharacterAsset().then((source) => {
      if (!source || handle.isGltf) return; // no GLB, or already swapped via another path
      try {
        const built = buildGltfInstance(source, cosmetics);
        scene.remove(handle.root);
        activateGltf(handle, built);
        scene.add(handle.root);
      } catch (err) {
        console.warn("[CharacterLoader] GLB found but couldn't be rigged — staying on the procedural model.", err);
      }
    });
  }

  scene.add(handle.root);

  handle.animate = ({ speed = 0, dt = 0, jumping = false, turnRate = 0 }) => {
    if (handle.isGltf && handle.mixer) {
      const desired = jumping ? "jump" : speed > 0.65 ? "run" : speed > 0.02 ? "walk" : "idle";
      const next = handle.actions[desired] || handle.actions.idle;
      if (next && handle.currentAction !== next) {
        next.reset().fadeIn(0.25).play();
        handle.currentAction?.fadeOut(0.25);
        handle.currentAction = next;
      }
      handle.mixer.update(dt);
      return;
    }
    animateCharacter(handle.root, { speed, dt, jumping, phaseRef: handle.phaseRef, turnRate });
  };

  return handle;
}

function applyCosmeticTint(material, { hair, jacket }) {
  const name = (material.name || "").toLowerCase();
  if (hair && /hair/.test(name)) material.color?.set(hair);
  if (jacket && /(jacket|cloth|outfit|top)/.test(name)) material.color?.set(jacket);
}
