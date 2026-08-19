import { AnimationMixer, Vector3, Quaternion, Euler } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Generic, reusable GLB/GLTF loading utility for environment pieces and
 * props (as opposed to CharacterLoader.js, which is character-specific:
 * auto-scales to human height, matches animation-clip names, etc.).
 *
 * Usage:
 *   import { loadAsset, spawnAsset } from "./AssetLoader.js";
 *
 *   // Fire off a load early and let it cache (optional — spawnAsset also
 *   // triggers a load itself, so this is only useful to get a head start):
 *   loadAsset("/models/props/server-rack.glb");
 *
 *   // Later, wherever the prop is actually placed in the world:
 *   const inst = await spawnAsset("/models/props/server-rack.glb", {
 *     position: [x, y, z],
 *     rotationY: ry,
 *   });
 *   if (inst) scene.add(inst.root);
 *   else { /* fall back to the procedural version *\/ }
 */

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
loader.setDRACOLoader(draco);

// url -> Promise<{ scene, animations } | null>. A failed/missing load caches
// `null` too, so a bad path only ever gets attempted once per session.
const cache = new Map();

/**
 * Loads (or returns the cached load of) a GLB/GLTF at `url`. Resolves to
 * `{ scene, animations }` on success, or `null` on any failure — this never
 * rejects, so callers never need a try/catch.
 */
export function loadAsset(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader
        .loadAsync(url)
        .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }))
        .catch((err) => {
          console.info(`[AssetLoader] "${url}" not available — caller should keep its procedural fallback.`, err?.message || err);
          return null;
        })
    );
  }
  return cache.get(url);
}

/** Synchronous check — has this url already resolved (found or not)? */
export function isAssetCached(url) {
  return cache.has(url);
}

/**
 * Loads `url` (using the shared cache) and returns a ready-to-place, fully
 * independent instance: skeleton-safe clone, shadows configured, materials
 * cloned per-instance (so tinting/animating one instance never affects
 * another), and transform applied. Returns `null` if the asset isn't
 * available — callers should keep their procedural geometry in that case.
 *
 * `options`:
 *   position   [x, y, z]
 *   rotationY  radians
 *   scale      uniform scale factor (default 1 — the asset's native scale)
 *   castShadow / receiveShadow  (default true / true)
 */
export async function spawnAsset(url, options = {}) {
  const { position, rotationY = 0, scale = 1, castShadow = true, receiveShadow = true } = options;
  const source = await loadAsset(url);
  if (!source) return null;

  let root;
  try {
    root = cloneSkinned(source.scene);
  } catch (err) {
    console.warn(`[AssetLoader] "${url}" loaded but couldn't be cloned.`, err);
    return null;
  }

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = castShadow;
    o.receiveShadow = receiveShadow;
    // Clone materials per-instance — GLTF PBR properties (baseColor,
    // roughness, metalness, normal/emissive maps) all live on the material
    // and are preserved automatically by cloning it; we never rebuild them.
    if (Array.isArray(o.material)) o.material = o.material.map((m) => configureImportedMaterial(m.clone()));
    else if (o.material) o.material = configureImportedMaterial(o.material.clone());
  });

  if (position) root.position.set(position[0], position[1], position[2]);
  root.rotation.y = rotationY;
  if (scale !== 1) root.scale.setScalar(scale);

  let mixer = null;
  const actions = {};
  if (source.animations?.length) {
    mixer = new AnimationMixer(root);
    for (const clip of source.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
  }

  return { root, mixer, actions, animations: source.animations || [] };
}

function configureImportedMaterial(material) {
  // GLTFLoader creates MeshStandard/Physical materials for PBR assets. Keep
  // those materials intact (including base color, emissive and texture maps)
  // while ensuring they take part in the renderer's standard light pipeline.
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    material.toneMapped = true;
    if (material.emissiveMap) material.emissiveIntensity = Math.max(material.emissiveIntensity, 1);
  }
  material.needsUpdate = true;
  return material;
}

/**
 * Convenience for World.js's "procedural now, upgrade if a matching GLB
 * shows up" pattern used across the priority zones. Keeps the procedural
 * mesh's collider untouched (gameplay/physics never depends on the visual),
 * and only swaps what's rendered.
 *
 * `proceduralMesh` — the THREE.Object3D already in the scene at the right
 * transform. Its WORLD position/Y-rotation are used (not local), so this
 * works whether the mesh sits directly in the scene or is nested inside a
 * positioned/rotated group (e.g. a monitor's screen+stand group) — the
 * spawned asset is added straight to `scene`, independent of that nesting.
 */
export function trySwapForAsset(scene, proceduralMesh, url, options = {}) {
  const worldPos = new Vector3();
  proceduralMesh.getWorldPosition(worldPos);
  const worldQuat = new Quaternion();
  proceduralMesh.getWorldQuaternion(worldQuat);
  const worldEuler = new Euler().setFromQuaternion(worldQuat, "YXZ");

  spawnAsset(url, {
    position: [worldPos.x, worldPos.y, worldPos.z],
    rotationY: worldEuler.y,
    ...options,
  }).then((inst) => {
    if (!inst) return; // no matching asset — keep showing the procedural mesh
    proceduralMesh.visible = false;
    scene.add(inst.root);
  });
}
