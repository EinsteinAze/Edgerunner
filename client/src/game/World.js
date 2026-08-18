import * as THREE from "three";
import { buildCharacter, makeHologram } from "./CharacterModel.js";
import { grungeSet, metalSet, floorSet, screenTexture, warningSignTexture, drawingTexture } from "./Textures.js";
import { trySwapForAsset } from "./AssetLoader.js";

// ---------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------

function neonMat(color, intensity = 1.2) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

function wallMat(color, key) {
  const tex = grungeSet(color, key);
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: tex.map, roughnessMap: tex.roughnessMap, roughness: 1, metalness: 0.05 });
  tex.map.repeat.set(2, 1);
  tex.roughnessMap.repeat.set(2, 1);
  return mat;
}

function floorMat(color, key) {
  const tex = floorSet(color, key);
  return new THREE.MeshStandardMaterial({ color: "#ffffff", map: tex.map, roughness: 0.75, metalness: 0.15 });
}

function metalMat(color, key, { rough = 0.4, metal = 0.75, emissive, emissiveIntensity = 1 } = {}) {
  const tex = metalSet(color, key);
  return new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: tex.map,
    roughness: rough,
    metalness: metal,
    emissive: emissive || "#000000",
    emissiveIntensity: emissive ? emissiveIntensity : 0,
  });
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

function addBox(scene, colliders, { w, h, d, x, y, z, mat, ry = 0, collide = true, castShadow = true, receiveShadow = true }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  if (collide) colliders.push({ mesh, x, z, hw: w / 2, hd: d / 2, ry });
  return mesh;
}

function addNeonSign(scene, { x, y, z, w = 1.6, h = 0.5, color, ry = 0, intensity = 5, distance = 8 }) {
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), neonMat(color, 2.2));
  sign.position.set(x, y, z);
  sign.rotation.y = ry;
  scene.add(sign);
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  scene.add(light);
  return sign;
}

function addGround(scene, { w, d, x, z, color, key }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat(color, key));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addCeiling(scene, { w, d, x, z, y = 6, color, key }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wallMat(color, key + ":ceil"));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/**
 * A rectangular room: floor + ceiling + two side walls (open front/back for
 * the corridor flow). Returns the wall meshes too (not just x/z/w/d) so a
 * caller can optionally upgrade them with a real environment asset later —
 * e.g. `trySwapForAsset(scene, room.leftWall, "/models/environment/facility-wall.glb")`
 * — using the exact same pattern already wired up for props. No zone does
 * this yet (see client/public/models/environment/README.md).
 */
function addRoom(scene, colliders, { x, z, w, d, color, floorColor, key, ceiling = true, h = 6 }) {
  const floor = addGround(scene, { w, d, x, z, color: floorColor, key: `${key}:floor` });
  const ceilingMesh = ceiling ? addCeiling(scene, { w, d, x, z, y: h, color, key }) : null;
  const mat = wallMat(color, key);
  const leftWall = addBox(scene, colliders, { w: 0.6, h, d, x: x - w / 2, y: h / 2, z, mat });
  const rightWall = addBox(scene, colliders, { w: 0.6, h, d, x: x + w / 2, y: h / 2, z, mat });
  return { x, z, w, d, floor, ceiling: ceilingMesh, leftWall, rightWall };
}

function addDoorGate(scene, colliders, gates, key, { x, y = 3, z, w = 5, h = 6, color = "#c94a3a" }) {
  gates[key] = addBox(scene, colliders, { w, h, d: 0.4, x, y, z, mat: metalMat(color, `gate:${key}`, { rough: 0.3, metal: 0.6, emissive: color, emissiveIntensity: 0.5 }) });
  addNeonSign(scene, { x, y: y + h / 2 + 0.4, z: z + 0.3, w: w * 0.55, h: 0.4, color, intensity: 3 });
  return gates[key];
}

function addHologramFigure(scene, { x, y = 0, z, hair = "#18e0e0", jacket = "#18e0e0", ry = 0 }) {
  const fig = buildCharacter({ hair, jacket, skin: "#dfe8f0" });
  makeHologram(fig, hair);
  fig.position.set(x, y, z);
  fig.rotation.y = ry;
  scene.add(fig);
  return fig;
}

/**
 * `modelUrl`, when given, is attempted as a visual upgrade via AssetLoader —
 * the procedural box is always built first (so the collider and the
 * fallback visual both exist immediately and unconditionally), and only
 * gets hidden in favor of the GLB if that GLB actually loads. The collider
 * entry keeps using the procedural box's dimensions either way, so physics/
 * interaction-anchor positions are never affected by whether the swap
 * happens. See client/public/models/props/README.md for expected assets.
 */
function addPropBox(scene, colliders, { x, y, z, w, h, d, color, emissive = false, ry = 0, collide = true, key, modelUrl, modelScale = 1 }) {
  const mat = emissive ? neonMat(color, 1) : metalMat(color, key || `${x}:${y}:${z}`, { rough: 0.55, metal: 0.3 });
  const mesh = addBox(scene, colliders, { w, h, d, x, y, z, mat, ry, collide });
  if (modelUrl) trySwapForAsset(scene, mesh, modelUrl, { scale: modelScale });
  return mesh;
}

// ---------------------------------------------------------------------------
// detail props — purely decorative unless noted (no story anchors here)
// ---------------------------------------------------------------------------

/** Practical ceiling light fixture. Optionally registers a flicker (broken light). */
function addCeilingLight(scene, flickerList, { x, y = 5.8, z, color = "#cfe0ff", intensity = 3.2, distance = 9, flicker = false }) {
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.35), metalMat("#0c0d12", "fixture", { rough: 0.35, metal: 0.7 }));
  housing.position.set(x, y, z);
  scene.add(housing);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.22), neonMat(color, flicker ? 0.5 : 1.0));
  glow.rotation.x = Math.PI / 2;
  glow.position.set(x, y - 0.06, z);
  scene.add(glow);
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y - 0.3, z);
  light.castShadow = false;
  scene.add(light);
  if (flicker) flickerList.push({ light, glow, base: intensity, glowBase: 0.6, speed: 3 + Math.random() * 4, seed: Math.random() * 100, broken: Math.random() < 0.5 });
  return light;
}

/**
 * Emissive server rack — a bank of blinking status LEDs on a dark metal
 * cabinet. If `modelUrl` resolves, the cabinet mesh is replaced with the
 * real asset (scaled to match this rack's height); the blinking LEDs are
 * left as-is as an overlay detail — see client/public/models/props/README.md.
 */
function addServerRack(scene, colliders, { x, z, ry = 0, h = 2.2, key, modelUrl, modelBaseHeight = 2.2 }) {
  const body = addBox(scene, colliders, { w: 0.9, h, d: 0.7, x, y: h / 2, z, mat: metalMat("#0d0e14", `rack:${key}`, { rough: 0.45, metal: 0.7 }), ry });
  if (modelUrl) trySwapForAsset(scene, body, modelUrl, { scale: h / modelBaseHeight });
  const ledColors = ["#18e0e0", "#ff2fd0", "#3ad66b", "#f6c93a"];
  const rows = Math.floor(h / 0.16);
  for (let i = 0; i < rows; i++) {
    if (Math.random() > 0.6) continue;
    const c = ledColors[Math.floor(Math.random() * ledColors.length)];
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), neonMat(c, 3));
    const localX = (Math.random() - 0.5) * 0.7;
    const localY = i * 0.16 - h / 2 + 0.15;
    led.position.set(localX * Math.cos(ry), localY, localX * Math.sin(ry));
    led.position.x += x;
    led.position.y += h / 2;
    led.position.z += z;
    led.userData.blink = { phase: Math.random() * 10, speed: 2 + Math.random() * 6 };
    scene.add(led);
  }
  return body;
}

/**
 * A monitor/terminal with a live-looking readout screen — casts real light.
 * If `modelUrl` resolves, the frame mesh is replaced with the real asset;
 * the glowing screen (with its live-generated readout texture) stays as an
 * overlay so the "live data" feel survives the swap either way.
 */
function addMonitor(scene, { x, y, z, ry = 0, key, title, color = "#18e0e0", accent = "#ff2fd0", standH = 0.9, modelUrl, modelScale = 1 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, standH, 8), metalMat("#14151d", `standmat:${key}`, { rough: 0.4, metal: 0.6 }));
  stand.position.y = standH / 2;
  stand.castShadow = true;
  group.add(stand);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), metalMat("#0e0f16", `base:${key}`, { rough: 0.4, metal: 0.6 }));
  base.position.y = 0.02;
  group.add(base);

  const tex = screenTexture(key, { title, color, accent });
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.1 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), screenMat);
  screen.position.set(0, standH + 0.14, 0.02);
  group.add(screen);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.04), metalMat("#101218", `frame:${key}`, { rough: 0.5, metal: 0.5 }));
  frame.position.set(0, standH + 0.14, -0.01);
  frame.castShadow = true;
  group.add(frame);
  if (modelUrl) trySwapForAsset(scene, frame, modelUrl, { scale: modelScale });

  const light = new THREE.PointLight(color, 2.5, 3, 2);
  light.position.set(0, standH + 0.14, 0.3);
  group.add(light);

  return group;
}

/** Office desk + chair, thematically dressed with clutter. */
function addDesk(scene, colliders, { x, z, ry = 0, key }) {
  const topMat = metalMat("#1c1a22", `desk:${key}`, { rough: 0.5, metal: 0.2 });
  addBox(scene, colliders, { w: 1.3, h: 0.06, d: 0.65, x, y: 0.78, z, mat: topMat, ry });
  const legMat = metalMat("#101014", `desklegs:${key}`, { rough: 0.4, metal: 0.6 });
  for (const [lx, lz] of [[-0.58, -0.27], [0.58, -0.27], [-0.58, 0.27], [0.58, 0.27]]) {
    const wx = x + lx * Math.cos(ry) - lz * Math.sin(ry);
    const wz = z + lx * Math.sin(ry) + lz * Math.cos(ry);
    addBox(scene, colliders, { w: 0.05, h: 0.78, d: 0.05, x: wx, y: 0.39, z: wz, mat: legMat, collide: false });
  }
  // chair
  const chairMat = metalMat("#22242e", `chair:${key}`, { rough: 0.6, metal: 0.2 });
  const seatX = x - 0.5 * Math.cos(ry);
  const seatZ = z - 0.5 * Math.sin(ry);
  addBox(scene, colliders, { w: 0.4, h: 0.06, d: 0.4, x: seatX, y: 0.46, z: seatZ, mat: chairMat, ry, collide: false });
  addBox(scene, colliders, { w: 0.4, h: 0.5, d: 0.06, x: seatX - 0.2 * Math.cos(ry), z: seatZ - 0.2 * Math.sin(ry), y: 0.72, mat: chairMat, ry, collide: false });
}

/**
 * Wall-mounted security camera with a slow blinking status LED. If
 * `modelUrl` resolves, the camera body is replaced with the real asset;
 * the mount/lens/blinking LED stay as overlay detail either way.
 */
function addSecurityCamera(scene, { x, y, z, ry = 0, modelUrl, modelScale = 1 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.2), metalMat("#0c0d12", "cammount", { rough: 0.4, metal: 0.7 }));
  mount.position.z = -0.1;
  group.add(mount);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 10), metalMat("#14151c", "cambody", { rough: 0.35, metal: 0.75 }));
  body.rotation.z = Math.PI / 2;
  group.add(body);
  if (modelUrl) trySwapForAsset(scene, body, modelUrl, { scale: modelScale });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), new THREE.MeshStandardMaterial({ color: "#040406", roughness: 0.1, metalness: 0.9 }));
  lens.rotation.z = Math.PI / 2;
  lens.position.x = 0.12;
  group.add(lens);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), neonMat("#ff2f3d", 3));
  led.position.set(0.1, 0.05, 0);
  led.userData.blink = { phase: Math.random() * 10, speed: 1.2 };
  group.add(led);
  return group;
}

function addWarningSign(scene, { x, y, z, ry = 0, text }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: warningSignTexture(text), roughness: 0.6, metalness: 0.1 }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  scene.add(mesh);
  return mesh;
}

function addDrawing(scene, { x, y, z, ry = 0, key, scale = 0.55 }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), new THREE.MeshStandardMaterial({ map: drawingTexture(key), roughness: 0.85, metalness: 0 }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  scene.add(mesh);
  return mesh;
}

/**
 * A slack cable run between two points, sagging under its own weight.
 * Built as a chain of short cylinder segments along a sampled quadratic
 * curve — avoids three.js's TubeGeometry/CatmullRom Frenet-frame computation,
 * which throws on short or near-straight three-point curves.
 */
function addCable(scene, { from, to, sag = 0.25, color = "#0a0a0a", radius = 0.02, segments = 10 }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3()
      .addScaledVector(a, (1 - t) * (1 - t))
      .addScaledVector(mid, 2 * (1 - t) * t)
      .addScaledVector(b, t * t);
    points.push(p);
  }

  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const len = p0.distanceTo(p1);
    if (len < 1e-5) continue;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 5), mat);
    seg.position.copy(p0).lerp(p1, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    seg.castShadow = true;
    group.add(seg);
  }
  scene.add(group);
  return group;
}

function addPipe(scene, colliders, { x, y, z, length, radius = 0.08, ry = 0, rz = 0, color = "#2a2d38", collide = false }) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), metalMat(color, `pipe:${x}:${y}:${z}`, { rough: 0.35, metal: 0.8 }));
  mesh.position.set(x, y, z);
  mesh.rotation.set(0, ry, rz + Math.PI / 2);
  mesh.castShadow = true;
  scene.add(mesh);
  if (collide) colliders.push({ mesh, x, z, hw: radius, hd: length / 2, ry });
  return mesh;
}

function addVent(scene, { x, y, z, ry = 0, w = 0.5, h = 0.3 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), metalMat("#15161d", "ventframe", { rough: 0.4, metal: 0.7 }));
  group.add(frame);
  const slats = Math.floor(h / 0.05);
  for (let i = 0; i < slats; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.012, 0.04), metalMat("#0a0a0e", "ventslat", { rough: 0.5, metal: 0.6 }));
    slat.position.set(0, -h / 2 + i * 0.05 + 0.025, 0.03);
    group.add(slat);
  }
  return group;
}

/** Scattered floor debris (papers, small containers) via one instanced mesh — cheap on draw calls. */
function addDebrisPatch(scene, { x, z, count = 10, radius = 1.4, seedOffset = 0 }) {
  const geo = new THREE.PlaneGeometry(0.22, 0.3);
  const mat = new THREE.MeshStandardMaterial({ color: "#cfc7ae", roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = ((i * 137.5 + seedOffset) % 360) * (Math.PI / 180);
    const r = ((i * 0.61803 + seedOffset * 0.1) % 1) * radius;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    m.makeRotationX(-Math.PI / 2);
    m.setPosition(px, 0.01 + i * 0.0005, pz);
    const rot = new THREE.Matrix4().makeRotationZ(a * 3.1);
    m.multiply(rot);
    inst.setMatrixAt(i, m);
  }
  inst.receiveShadow = true;
  scene.add(inst);
  return inst;
}

function addContainer(scene, colliders, { x, z, ry = 0, key, color = "#2c3a2c", modelUrl, modelScale = 1 }) {
  const box = addBox(scene, colliders, { w: 0.9, h: 0.9, d: 0.6, x, y: 0.45, z, mat: metalMat(color, `container:${key}`, { rough: 0.6, metal: 0.4 }), ry });
  if (modelUrl) trySwapForAsset(scene, box, modelUrl, { scale: modelScale });
  addWarningSign(scene, { x: x + 0.46 * Math.cos(ry), y: 0.5, z: z + 0.46 * Math.sin(ry), ry: ry + Math.PI / 2, text: "TOXIC" });
}

// ---------------------------------------------------------------------------
// optional environment/prop GLB assets — wired into the priority zones
// (Facility, Flashback Corridor, Archive, Data Core) per the visual-asset
// pass. Every path below is OPTIONAL: if the file isn't there, the existing
// procedural prop it's attached to keeps rendering exactly as before — see
// client/public/models/props/README.md for what each one should look like.
// ---------------------------------------------------------------------------
const PROPS = "/models/props";
const MODEL = {
  serverRack: `${PROPS}/server-rack.glb`,
  terminal: `${PROPS}/terminal.glb`,
  securityCamera: `${PROPS}/security-camera.glb`,
  container: `${PROPS}/container.glb`,
  dataConsole: `${PROPS}/data-console.glb`,
  hiddenConsole: `${PROPS}/hidden-console.glb`,
};

// ---------------------------------------------------------------------------
// world
// ---------------------------------------------------------------------------

/**
 * Builds the six connected story zones for "The Children of Arasaka":
 * Apartment -> Facility -> Training Room -> Flashback Corridor -> Archive -> Data Core.
 * A guided, Uncharted-style corridor rather than an open world — dark,
 * grounded environments with practical lighting and colored accents used
 * intentionally rather than everything glowing neon.
 */
export function createWorld(scene) {
  const colliders = [];
  const gates = {};
  const anchors = {};
  const holograms = [];
  const flickerList = [];
  const blinkers = [];

  // Lift the ambient fill just enough to keep room detail readable without
  // flattening the darker cyberpunk mood or competing with the neon lights.
  scene.fog = new THREE.FogExp2("#0a0d14", 0.02);
  const hemi = new THREE.HemisphereLight("#4d5f8d", "#15131c", 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#6f89c4", 0.55);
  key.position.set(-15, 25, -10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -80;
  key.shadow.camera.right = 80;
  key.shadow.camera.top = 80;
  key.shadow.camera.bottom = -80;
  key.shadow.bias = -0.0015;
  scene.add(key);

  // ================= ZONE 1 — LUCY'S APARTMENT =================
  addRoom(scene, colliders, { x: 0, z: 3, w: 11, d: 16, color: "#1c1e2a", floorColor: "#232018", key: "z1" });
  anchors.spawn = new THREE.Vector3(0, 0, 8);
  addBox(scene, colliders, { w: 11, h: 6, d: 0.6, x: 0, y: 3, z: 10.7, mat: wallMat("#1c1e2a", "z1:endcap") });

  addCeilingLight(scene, flickerList, { x: 0, z: 6, color: "#e6c99a", intensity: 1.8 });
  addCeilingLight(scene, flickerList, { x: 0, z: -2, color: "#cfe0ff", intensity: 1.4, flicker: true });

  anchors.window = addPropBox(scene, colliders, { x: -5.2, y: 2, z: 4, w: 0.3, h: 2.6, d: 3.2, color: "#18e0e0", key: "window" });
  addNeonSign(scene, { x: -5.4, y: 2, z: 4, w: 2.6, h: 2, color: "#101a30", ry: Math.PI / 2, intensity: 2.4, distance: 6 });
  // city-glow strips leaking through the blinds
  for (const yy of [1.2, 2.0, 2.8]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.05), neonMat("#3a6fb0", 1.6));
    strip.rotation.y = Math.PI / 2;
    strip.position.set(-5.35, yy, 4);
    scene.add(strip);
  }

  anchors.bed = addPropBox(scene, colliders, { x: 3.4, y: 0.35, z: 6.5, w: 2, h: 0.7, d: 3, color: "#332845", key: "bed" });
  addBox(scene, colliders, { w: 2, h: 0.15, d: 0.8, x: 3.4, y: 0.78, z: 5.3, mat: metalMat("#443458", "pillow", { rough: 0.8, metal: 0 }), collide: false });
  anchors.dataShards = addPropBox(scene, colliders, { x: 3.6, y: 0.9, z: 3.2, w: 0.8, h: 0.4, d: 0.6, color: "#f6e94a", emissive: true, collide: false, key: "shards" });
  anchors.cyberdeck = addPropBox(scene, colliders, { x: -2.4, y: 0.55, z: -1, w: 1.4, h: 1.1, d: 0.8, color: "#ff2fd0", emissive: true, key: "cyberdeck" });
  addMonitor(scene, { x: -2.4, y: 1.1, z: -1.42, ry: Math.PI, key: "cyberdeck-screen", title: "NET-ACCESS", color: "#ff2fd0", accent: "#18e0e0", standH: 0.4 });
  addDesk(scene, colliders, { x: -2.4, z: -0.5, ry: 0, key: "apt-desk" });

  addDrawing(scene, { x: 5.17, y: 1.6, z: 0, ry: -Math.PI / 2, key: "apt-drawing", scale: 0.6 });
  addWarningSign(scene, { x: -5.17, y: 1.1, z: -1.5, ry: Math.PI / 2, text: "NO SIGNAL" });
  addDebrisPatch(scene, { x: 2, z: -3, count: 6, radius: 1 });
  addCable(scene, { from: [-2.4, 0.9, -1.4], to: [-4.8, 0.1, -3.5], sag: 0.3 });

  addDoorGate(scene, colliders, gates, "gate1", { x: 0, z: -4.6, w: 4, color: "#c94a3a" });

  // ================= ZONE 2 — ARASAKA FACILITY =================
  addRoom(scene, colliders, { x: 0, z: -26, w: 14, d: 42, color: "#181920", floorColor: "#101115", key: "z2" });
  anchors.zone2Spawn = new THREE.Vector3(0, 0, -10);

  for (let i = 0; i < 5; i++) addCeilingLight(scene, flickerList, { x: 0, z: -6 - i * 8, color: "#7f96c0", intensity: 1.5, flicker: i === 2 || i === 4 });
  addSecurityCamera(scene, { x: -6.2, y: 5, z: -14, ry: 0.5, modelUrl: MODEL.securityCamera });
  addSecurityCamera(scene, { x: 6.2, y: 5, z: -36, ry: -0.5, modelUrl: MODEL.securityCamera });

  anchors.nameWall = addPropBox(scene, colliders, { x: -6.4, y: 1.5, z: -20, w: 0.3, h: 3, d: 5, color: "#20222e", key: "namewall" });
  for (let i = 0; i < 5; i++) {
    addDrawing(scene, { x: -6.55, y: 1.2 + (i % 2) * 0.4, z: -22 + i * 0.9, ry: Math.PI / 2, key: `namewall-mark-${i}`, scale: 0.28 });
  }
  addWarningSign(scene, { x: -6.55, y: 2.6, z: -17.5, ry: Math.PI / 2, text: "SUBLEVEL 23" });

  anchors.securityTerminal = addPropBox(scene, colliders, { x: 5.4, y: 0.65, z: -34, w: 1, h: 1.3, d: 0.7, color: "#18e0e0", emissive: true, key: "secterm" });
  addMonitor(scene, { x: 5.4, y: 1.3, z: -34.4, ry: Math.PI, key: "sec-screen", title: "ARASAKA SEC", color: "#18e0e0", accent: "#f6c93a", standH: 0.3, modelUrl: MODEL.terminal });
  addDesk(scene, colliders, { x: 5.2, z: -35.6, ry: 0, key: "sec-desk" });

  addServerRack(scene, colliders, { x: 6.4, z: -14, key: "z2-a", modelUrl: MODEL.serverRack });
  addServerRack(scene, colliders, { x: 6.4, z: -15.2, key: "z2-b", modelUrl: MODEL.serverRack });
  addServerRack(scene, colliders, { x: -6.4, z: -30, key: "z2-c", modelUrl: MODEL.serverRack });
  for (let i = 0; i < 4; i++) {
    addPropBox(scene, colliders, { x: (i % 2 === 0 ? -1 : 1) * 5.6, y: 1, z: -10 - i * 6, w: 0.8, h: 2, d: 0.8, color: "#1c1520", key: `crate2-${i}` });
  }
  addContainer(scene, colliders, { x: -5.2, z: -8, ry: 0.2, key: "z2cont1", modelUrl: MODEL.container });
  addDebrisPatch(scene, { x: 3, z: -18, count: 8, radius: 1.2, seedOffset: 5 });
  addVent(scene, { x: -6.62, y: 4.6, z: -26, ry: Math.PI / 2, w: 0.7, h: 0.4 });
  addPipe(scene, colliders, { x: 6.62, y: 5.2, z: -20, length: 12, ry: Math.PI / 2, color: "#232838" });

  addDoorGate(scene, colliders, gates, "gate2", { x: 0, z: -46.6, w: 5, color: "#c94a3a" });

  // ================= ZONE 3 — TRAINING + MEMORY ROOM =================
  addRoom(scene, colliders, { x: 0, z: -70, w: 16, d: 38, color: "#171522", floorColor: "#0e0c16", key: "z3" });
  anchors.zone3Spawn = new THREE.Vector3(0, 0, -52);

  for (let i = 0; i < 4; i++) addCeilingLight(scene, flickerList, { x: 0, z: -54 - i * 9, color: "#8a7fc0", intensity: 1.6, flicker: i === 1 });

  anchors.trainingChairs = addPropBox(scene, colliders, { x: 0, y: 0.5, z: -60, w: 5, h: 1, d: 4, color: "#241f38", emissive: false, key: "chairsbase" });
  for (const dx of [-2.2, -1.1, 0, 1.1, 2.2]) {
    const chair = addPropBox(scene, colliders, { x: dx, y: 0.4, z: -61.5, w: 0.6, h: 0.8, d: 0.6, color: "#2a2440", collide: false, key: `chair-${dx}` });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.02), neonMat("#7a2fff", 1.6));
    ledStrip.position.set(dx, 0.82, -61.2);
    scene.add(ledStrip);
    void chair;
  }
  addMonitor(scene, { x: 0, y: 1.6, z: -57.4, ry: Math.PI, key: "training-screen", title: "NEURAL SYNC", color: "#7a2fff", accent: "#f6c93a", standH: 0.55 });
  addWarningSign(scene, { x: -7.62, y: 1.4, z: -60, ry: Math.PI / 2, text: "AUTH REQ." });

  anchors.memoryRoom = addPropBox(scene, colliders, { x: 0, y: 0.6, z: -82, w: 1.6, h: 1.2, d: 1, color: "#18e0e0", emissive: true, key: "memroom" });
  const memChildren = [
    { hair: "#ff2fd0", jacket: "#ff2fd0", dx: -2 },
    { hair: "#f6e94a", jacket: "#f6e94a", dx: -0.7 },
    { hair: "#18e0e0", jacket: "#18e0e0", dx: 0.7 },
    { hair: "#7a2fff", jacket: "#7a2fff", dx: 2 },
  ];
  for (const c of memChildren) {
    holograms.push(addHologramFigure(scene, { x: c.dx, z: -85, hair: c.hair, jacket: c.jacket, ry: Math.PI }));
  }
  const memLight = new THREE.PointLight("#18e0e0", 3, 10, 2);
  memLight.position.set(0, 2, -85);
  scene.add(memLight);

  addServerRack(scene, colliders, { x: 7.4, z: -68, key: "z3-a" });
  addServerRack(scene, colliders, { x: -7.4, z: -76, key: "z3-b" });
  addCable(scene, { from: [-7.4, 2, -76], to: [-7.4, 0.2, -70], sag: 0.15, radius: 0.03 });
  addDebrisPatch(scene, { x: -2, z: -66, count: 10, radius: 1.6, seedOffset: 11 });

  addDoorGate(scene, colliders, gates, "gate3", { x: 0, z: -88.6, w: 5.5, color: "#c94a3a" });

  // ================= ZONE 4 — FLASHBACK: THE ESCAPE (corridor) =================
  addRoom(scene, colliders, { x: 0, z: -110, w: 9, d: 34, color: "#241014", floorColor: "#180a0d", key: "z4" });
  anchors.zone4Spawn = new THREE.Vector3(0, 0, -95);

  const alarmLight = new THREE.PointLight("#ff2f3d", 3.5, 22, 2);
  alarmLight.position.set(0, 4, -110);
  scene.add(alarmLight);
  anchors.alarmLight = alarmLight;
  flickerList.push({ light: alarmLight, base: 3.5, glowBase: 0, speed: 9, seed: 3, broken: false, siren: true });

  for (let i = 0; i < 3; i++) {
    const strobe = new THREE.PointLight("#ff2f3d", 0, 10, 2);
    strobe.position.set(0, 5.6, -98 - i * 10);
    scene.add(strobe);
    flickerList.push({ light: strobe, base: 2.2, glowBase: 0, speed: 9, seed: i * 2.1, broken: false, siren: true });
  }

  anchors.seraProp = addPropBox(scene, colliders, { x: -1.5, y: 0.25, z: -108, w: 1.8, h: 0.5, d: 0.7, color: "#c9b8a8", ry: 0.3, collide: false, key: "sera" });
  holograms.push(addHologramFigure(scene, { x: 1.2, z: -109, hair: "#ff2fd0", jacket: "#ff2fd0", ry: -0.4 }));
  addDebrisPatch(scene, { x: 0, z: -102, count: 14, radius: 2, seedOffset: 17 });
  addContainer(scene, colliders, { x: 3, z: -100, ry: -0.3, key: "z4cont", color: "#3a2020", modelUrl: MODEL.container });
  addPipe(scene, colliders, { x: -4.1, y: 4.8, z: -110, length: 30, ry: Math.PI / 2, color: "#2a1a1c" });
  addVent(scene, { x: 4.12, y: 4.6, z: -116, ry: -Math.PI / 2, w: 0.6, h: 0.4 });
  addWarningSign(scene, { x: -4.12, y: 1.3, z: -118, ry: Math.PI / 2, text: "EVACUATE" });

  anchors.escapeDoor = addPropBox(scene, colliders, { x: 0, y: 2.5, z: -124, w: 3.5, h: 5, d: 0.4, color: "#ff2f3d", emissive: true, key: "escapedoor" });
  addNeonSign(scene, { x: 0, y: 5.6, z: -123.7, w: 2.4, h: 0.5, color: "#ff2f3d", intensity: 4 });

  addDoorGate(scene, colliders, gates, "gate4", { x: 0, z: -126.6, w: 4, color: "#c94a3a" });

  // ================= ZONE 5 — CLASSIFIED ARCHIVE =================
  addRoom(scene, colliders, { x: 0, z: -140, w: 9, d: 14, color: "#141520", floorColor: "#0b0c14", key: "z5" });
  anchors.zone5Spawn = new THREE.Vector3(0, 0, -134);

  addCeilingLight(scene, flickerList, { x: 0, z: -136, color: "#c8d4f2", intensity: 1.6 });
  addServerRack(scene, colliders, { x: -3.6, z: -142, key: "z5-a", modelUrl: MODEL.serverRack });
  addServerRack(scene, colliders, { x: 3.6, z: -142, key: "z5-b", modelUrl: MODEL.serverRack });

  anchors.archiveTerminal = addPropBox(scene, colliders, { x: 0, y: 0.7, z: -144, w: 1.4, h: 1.4, d: 0.8, color: "#f6e94a", emissive: true, key: "archive" });
  addMonitor(scene, { x: 0, y: 1.6, z: -144.5, ry: Math.PI, key: "archive-screen", title: "OP. ECHO", color: "#f6c93a", accent: "#ff2fd0", standH: 0.6, modelUrl: MODEL.terminal });
  addWarningSign(scene, { x: -4.12, y: 1.3, z: -138, ry: Math.PI / 2, text: "CLASSIFIED" });

  addDoorGate(scene, colliders, gates, "gate5", { x: 0, z: -147.6, w: 4.5, color: "#c94a3a" });

  // ================= ZONE 6 — ARASAKA CENTRAL DATA CORE =================
  addRoom(scene, colliders, { x: 0, z: -180, w: 22, d: 60, color: "#0c0c14", floorColor: "#06060a", key: "z6", ceiling: false });
  anchors.zone6Spawn = new THREE.Vector3(0, 0, -152);

  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const zz = -158 - Math.floor(i / 2) * 8;
    addServerRack(scene, colliders, { x: side * 9, z: zz, h: 6, key: `z6-${i}`, modelUrl: MODEL.serverRack });
    const beacon = new THREE.PointLight(side < 0 ? "#18e0e0" : "#ff2fd0", 1.4, 8, 2);
    beacon.position.set(side * 9, 4.5, zz);
    scene.add(beacon);
  }
  for (let i = 0; i < 5; i++) {
    addCable(scene, { from: [-9, 5.5, -158 - i * 8], to: [9, 5.4, -158 - i * 8], sag: 1.4, radius: 0.035 });
  }

  anchors.childrenGathering = addPropBox(scene, colliders, { x: 0, y: 0.05, z: -175, w: 4, h: 0.1, d: 4, color: "#18e0e0", emissive: true, collide: false, key: "gathering" });
  const gatherLight = new THREE.PointLight("#18e0e0", 4, 14, 2);
  gatherLight.position.set(0, 2.5, -175);
  scene.add(gatherLight);
  const finalChildren = [
    { hair: "#ff2fd0", jacket: "#ff2fd0", dx: -2.4 },
    { hair: "#f6e94a", jacket: "#f6e94a", dx: -0.8 },
    { hair: "#18e0e0", jacket: "#18e0e0", dx: 0.8 },
    { hair: "#7a2fff", jacket: "#7a2fff", dx: 2.4 },
  ];
  for (const c of finalChildren) {
    holograms.push(addHologramFigure(scene, { x: c.dx, z: -177, hair: c.hair, jacket: c.jacket, ry: Math.PI }));
  }

  anchors.choiceDestroy = addPropBox(scene, colliders, { x: -6, y: 0.9, z: -192, w: 1.1, h: 1.8, d: 1.1, color: "#ff2f3d", emissive: true, key: "destroy", modelUrl: MODEL.dataConsole });
  addNeonSign(scene, { x: -6, y: 2.2, z: -192.6, w: 1.8, h: 0.4, color: "#ff2f3d", intensity: 3 });
  anchors.choiceJoin = addPropBox(scene, colliders, { x: 6, y: 0.9, z: -192, w: 1.1, h: 1.8, d: 1.1, color: "#18e0e0", emissive: true, key: "join", modelUrl: MODEL.dataConsole });
  addNeonSign(scene, { x: 6, y: 2.2, z: -192.6, w: 1.8, h: 0.4, color: "#18e0e0", intensity: 3 });
  // hidden/secret console — unlit, tucked in a back corner, no signage
  anchors.choiceRelease = addPropBox(scene, colliders, {
    x: 9.6, y: 0.55, z: -206, w: 0.6, h: 1.1, d: 0.6, color: "#2b2e3a", key: "release", modelUrl: MODEL.hiddenConsole,
  });

  addBox(scene, colliders, { w: 22, h: 8, d: 0.6, x: 0, y: 4, z: -209.7, mat: wallMat("#0c0c14", "z6:endcap") });

  return { colliders, gates, anchors, holograms, updateLights: makeLightUpdater(flickerList, blinkers, scene) };
}

function makeLightUpdater(flickerList, _blinkers, scene) {
  const blinkMeshes = [];
  scene.traverse((o) => {
    if (o.userData?.blink) blinkMeshes.push(o);
  });
  let t = 0;
  return function updateLights(dt) {
    t += dt;
    for (const f of flickerList) {
      if (f.siren) {
        f.light.intensity = f.base * (0.5 + 0.5 * Math.sin(t * f.speed + f.seed));
        continue;
      }
      const n = Math.sin(t * f.speed + f.seed) * Math.sin(t * f.speed * 1.7 + f.seed * 2);
      const dip = f.broken && Math.sin(t * 0.6 + f.seed) > 0.93 ? 0.1 : 1;
      const flick = (0.82 + 0.18 * n) * dip;
      f.light.intensity = f.base * flick;
      if (f.glow) f.glow.material.emissiveIntensity = f.glowBase * flick * 2.2;
    }
    for (const m of blinkMeshes) {
      const b = m.userData.blink;
      const on = Math.sin(t * b.speed + b.phase) > 0.4;
      m.visible = on;
    }
  };
}

export function unlockGate(world, key) {
  const gate = world.gates[key];
  if (!gate || gate.userData.unlocked) return;
  gate.userData.unlocked = true;
  const idx = world.colliders.findIndex((c) => c.mesh === gate);
  if (idx >= 0) world.colliders.splice(idx, 1);
  const startY = gate.position.y;
  const targetY = startY - 7;
  const start = performance.now();
  function anim(now) {
    const t = Math.min(1, (now - start) / 1200);
    gate.position.y = THREE.MathUtils.lerp(startY, targetY, t);
    gate.material.emissiveIntensity = THREE.MathUtils.lerp(0.5, 0.05, t);
    if (t < 1) requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);
}
