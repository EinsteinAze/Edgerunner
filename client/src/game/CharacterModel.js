import * as THREE from "three";
import { metalSet } from "./Textures.js";

/**
 * Builds an original, stylized "edgerunner" courier character — NOT a copy of
 * any copyrighted model, just a homage silhouette: twin-tail hair, visor,
 * cropped jacket, cyberware arm glow. This is the always-available fallback
 * used until (and unless) a realistic GLB is dropped in — see CharacterLoader.js.
 */
export function buildCharacter({ hair = "#ff2fd0", jacket = "#18e0e0", skin = "#e8b790" } = {}) {
  const root = new THREE.Group();

  const jacketTex = metalSet(jacket, `jacket:${jacket}`);
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55, metalness: 0.0 });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: jacketTex.map,
    roughness: 0.5,
    metalness: 0.25,
    roughnessMap: jacketTex.map,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: "#15161f", roughness: 0.75, metalness: 0.05 });
  const bootMat = new THREE.MeshStandardMaterial({ color: "#0e0f16", roughness: 0.45, metalness: 0.3 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.35, emissive: hair, emissiveIntensity: 0.12 });
  const visorMat = new THREE.MeshStandardMaterial({ color: "#0a0f14", roughness: 0.15, metalness: 0.85, emissive: "#18e0e0", emissiveIntensity: 0.5 });
  const cyberMat = new THREE.MeshStandardMaterial({ color: "#c9d6e8", roughness: 0.25, metalness: 0.9, emissive: hair, emissiveIntensity: 0.55 });

  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const torsoPivot = new THREE.Group();
  hips.add(torsoPivot);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 12), jacketMat);
  torso.position.y = 0.42;
  torso.castShadow = true;
  torsoPivot.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10), skinMat);
  neck.position.y = 0.7;
  torsoPivot.add(neck);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 16), jacketMat);
  collar.position.y = 0.66;
  collar.rotation.x = Math.PI / 2;
  torsoPivot.add(collar);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.85;
  torsoPivot.add(headPivot);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  skull.scale.set(0.92, 1.05, 0.98);
  headPivot.add(skull);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skinMat);
  jaw.position.set(0, -0.09, 0.03);
  jaw.scale.set(0.85, 0.6, 0.8);
  headPivot.add(jaw);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.055, 0.05), visorMat);
  visor.position.set(0, 0.015, 0.135);
  headPivot.add(visor);

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8), hairMat);
    tail.position.set(side * 0.14, 0.02, -0.08);
    tail.rotation.x = 0.3;
    tail.rotation.z = side * 0.25;
    headPivot.add(tail);
  }
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.172, 14, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
  hairCap.position.y = 0.02;
  headPivot.add(hairCap);

  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 0.62, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.26, 6, 10), jacketMat);
    upper.position.y = -0.15;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);

    const isCyberArm = side === 1;
    const lowerMat = isCyberArm ? cyberMat : skinMat;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.24, 6, 10), lowerMat);
    lower.position.y = -0.14;
    lower.castShadow = true;
    elbow.add(lower);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), lowerMat);
    hand.position.y = -0.28;
    hand.scale.set(0.8, 1.15, 0.65);
    elbow.add(hand);

    shoulder.userData.elbow = elbow;
    return shoulder;
  }

  const armL = buildArm(-1);
  const armR = buildArm(1);
  torsoPivot.add(armL, armR);

  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 0, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.3, 6, 10), pantsMat);
    upper.position.y = -0.17;
    upper.castShadow = true;
    hip.add(upper);

    const knee = new THREE.Group();
    knee.position.y = -0.34;
    hip.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.28, 6, 10), pantsMat);
    lower.position.y = -0.16;
    lower.castShadow = true;
    knee.add(lower);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.21), bootMat);
    boot.position.set(0, -0.32, 0.045);
    boot.castShadow = true;
    knee.add(boot);
    const bootCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.08, 8), bootMat);
    bootCuff.position.set(0, -0.24, 0);
    knee.add(bootCuff);

    hip.userData.knee = knee;
    return hip;
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  hips.add(legL, legR);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  root.userData.parts = { hips, torso: torsoPivot, head: headPivot, armL, armR, legL, legR };
  root.userData.leanState = { value: 0 };
  return root;
}

/** Turns a built character into a flickering, translucent "memory" apparition. */
export function makeHologram(root, color = "#18e0e0") {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      wireframe: false,
    });
    o.material = mat;
    o.castShadow = false;
  });
  root.userData.hologramPhase = Math.random() * Math.PI * 2;
  return root;
}

/** Subtle flicker for hologram figures — call once per frame. */
export function flickerHologram(root, dt) {
  root.userData.hologramPhase += dt * 3;
  const flicker = 0.45 + Math.sin(root.userData.hologramPhase) * 0.1 + (Math.random() - 0.5) * 0.05;
  root.traverse((o) => {
    if (o.isMesh) o.material.opacity = Math.max(0.15, flicker);
  });
}

/** Cheap procedural walk-cycle: swings limbs based on a phase accumulator. */
export function animateCharacter(root, { speed = 0, dt = 0, jumping = false, phaseRef, turnRate = 0, walking = false, walkTime = 0 }) {
  const { armL, armR, legL, legR, torso, head, hips } = root.userData.parts;
  phaseRef.value += dt * (2 + speed * 6);
  const p = phaseRef.value;
  const amp = THREE.MathUtils.clamp(speed, 0, 1.4);

  if (jumping) {
    legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, -0.3, 0.2);
    legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0.5, 0.2);
    armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, -0.6, 0.2);
    armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -0.6, 0.2);
    return;
  }

  const settle = Math.min(1, dt * 11);
  legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, Math.sin(p) * 0.55 * amp, settle);
  legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, Math.sin(p + Math.PI) * 0.55 * amp, settle);
  // Explicit counter-swing driven by elapsed walking time keeps the hands
  // readable even at a slow walk and smoothly settles them when idle.
  const armSwing = walking ? Math.sin(walkTime * 8) * 0.6 : 0;
  armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, armSwing, settle);
  armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, -armSwing, settle);

  // lean into the run + a light counter-lean while turning — cheap but reads
  // as weight and momentum instead of a sprite sliding across the floor.
  const leanState = root.userData.leanState;
  const targetLean = 0.1 * amp - THREE.MathUtils.clamp(turnRate, -1, 1) * 0.05;
  leanState.value = THREE.MathUtils.lerp(leanState.value, targetLean, Math.min(1, dt * 6));
  torso.rotation.x = leanState.value;
  torso.rotation.z = Math.sin(p) * 0.025 * amp - THREE.MathUtils.clamp(turnRate, -1, 1) * 0.06;
  head.rotation.y = THREE.MathUtils.clamp(turnRate, -1, 1) * 0.18;

  hips.position.y = THREE.MathUtils.lerp(hips.position.y, 0.9 + Math.abs(Math.sin(p * 2)) * 0.02 * amp, settle);
}
