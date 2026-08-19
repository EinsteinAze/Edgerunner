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
        o.material = createCharacterMaterial(o.name, cosmetics);
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
  addCharacterFillLight(wrapper);

  const mixer = new THREE.AnimationMixer(clone);
  const actions = {};
  for (const [key, clip] of Object.entries(source.clips)) {
    if (clip) actions[key] = mixer.clipAction(clip);
  }

  return { root: wrapper, mixer, actions, walkRig: createProceduralWalkRig(clone) };
}

function createProceduralWalkRig(model) {
  const findPart = (pattern) => {
    let match = null;
    model.traverse((node) => {
      if (!match && node.isBone && pattern.test(node.name.toLowerCase())) match = node;
    });
    return match;
  };
  const capture = (node) => (node ? { node, baseX: node.rotation.x } : null);
  return {
    model,
    baseY: model.position.y,
    baseRoll: model.rotation.z,
    elapsed: 0,
    hip: capture(findPart(/hips|pelvis/)),
    armL: capture(findPart(/left.*(arm|shoulder)|(^|[_-])l.*arm/)),
    armR: capture(findPart(/right.*(arm|shoulder)|(^|[_-])r.*arm/)),
    legL: capture(findPart(/left.*(leg|thigh|upleg)|(^|[_-])l.*(leg|thigh)/)),
    legR: capture(findPart(/right.*(leg|thigh|upleg)|(^|[_-])r.*(leg|thigh)/)),
  };
}

function animateProceduralWalk(rig, { speed, dt, jumping, walking = false, walkTime = 0 }) {
  rig.elapsed += dt;
  const moving = walking && speed > 0.02 && !jumping;
  const wave = Math.sin(walkTime * 8);
  const blend = Math.min(1, dt * 11);
  const target = (part, amount) => (moving ? part.baseX + wave * amount * speed : part.baseX);
  const apply = (part, amount) => {
    if (part) part.node.rotation.x = THREE.MathUtils.lerp(part.node.rotation.x, target(part, amount), blend);
  };

  apply(rig.legL, 0.55);
  if (rig.legR) rig.legR.node.rotation.x = THREE.MathUtils.lerp(rig.legR.node.rotation.x, moving ? rig.legR.baseX - wave * 0.55 * speed : rig.legR.baseX, blend);
  if (rig.armL) rig.armL.node.rotation.x = THREE.MathUtils.lerp(rig.armL.node.rotation.x, moving ? rig.armL.baseX - wave * 0.6 : rig.armL.baseX, blend);
  if (rig.armR) rig.armR.node.rotation.x = THREE.MathUtils.lerp(rig.armR.node.rotation.x, moving ? rig.armR.baseX + wave * 0.6 : rig.armR.baseX, blend);

  const hasLimbBones = rig.armL || rig.armR || rig.legL || rig.legR;
  if (!hasLimbBones) {
    // Static GLBs have no joints to swing, so animate the mesh itself. The
    // small bob/roll is restored smoothly when input and velocity stop.
    const bob = moving ? Math.sin(rig.elapsed * 10) * 0.08 : 0;
    const roll = moving ? Math.sin(rig.elapsed * 5) * 0.05 : 0;
    rig.model.position.y = THREE.MathUtils.lerp(rig.model.position.y, rig.baseY + bob, blend);
    rig.model.rotation.z = THREE.MathUtils.lerp(rig.model.rotation.z, rig.baseRoll + roll, blend);
    return;
  }

  const bob = moving ? Math.abs(wave) * 0.035 * speed : 0;
  rig.model.position.y = THREE.MathUtils.lerp(rig.model.position.y, rig.baseY + bob, blend);
  rig.model.rotation.z = THREE.MathUtils.lerp(rig.model.rotation.z, rig.baseRoll, blend);
}

function createCharacterMaterial(meshName, cosmetics) {
  const name = meshName.toLowerCase();
  let material;
  if (name.includes("hair")) {
    material = new THREE.MeshStandardMaterial({
      color: cosmetics.hair || "#e0e7ff",
      emissive: "#38bdf8",
      emissiveIntensity: 0.2,
      roughness: 0.45,
    });
  } else if (name.includes("jacket") || name.includes("top") || name.includes("cloth") || name.includes("outfit")) {
    material = new THREE.MeshStandardMaterial({ color: cosmetics.jacket || "#ffffff", roughness: 0.4 });
  } else if (name.includes("body") || name.includes("skin") || name.includes("face") || name.includes("head")) {
    material = new THREE.MeshStandardMaterial({ color: cosmetics.skin || "#ffdfd3", roughness: 0.6 });
  } else {
    material = new THREE.MeshStandardMaterial({ color: "#111115", roughness: 0.7, metalness: 0.1 });
  }
  material.visible = true;
  material.needsUpdate = true;
  return material;
}

function addCharacterFillLight(root) {
  // This follows the character (and survives GLB hot-swaps because it is
  // attached to the new root) without casting extra shadows into the room.
  const fill = new THREE.PointLight("#ffffff", 2.5, 6);
  fill.position.set(0, 2, 1.5);
  fill.castShadow = false;
  root.add(fill);
}

function activateGltf(handle, built) {
  handle.root = built.root;
  handle.mixer = built.mixer;
  handle.actions = built.actions;
  handle.walkRig = built.walkRig;
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
    walkRig: null,
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
    addCharacterFillLight(handle.root);
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

  handle.animate = ({ speed = 0, dt = 0, jumping = false, turnRate = 0, walking = false, walkTime = 0 }) => {
    if (handle.isGltf && handle.mixer) {
      const desired = jumping ? "jump" : speed > 0.65 ? "run" : speed > 0.02 ? "walk" : "idle";
      const next = handle.actions[desired] || handle.actions.idle;
      if (next && handle.currentAction !== next) {
        next.reset().fadeIn(0.25).play();
        handle.currentAction?.fadeOut(0.25);
        handle.currentAction = next;
      }
      handle.mixer.update(dt);
      animateProceduralWalk(handle.walkRig, { speed, dt, jumping, walking, walkTime });
      return;
    }
    animateCharacter(handle.root, { speed, dt, jumping, phaseRef: handle.phaseRef, turnRate, walking, walkTime });
  };

  return handle;
}
