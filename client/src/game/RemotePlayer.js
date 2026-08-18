import * as THREE from "three";
import { spawnCharacter } from "./CharacterLoader.js";

export class RemotePlayer {
  constructor(scene, id, cosmetics, name) {
    this.id = id;
    this.character = spawnCharacter(scene, cosmetics);
    this.target = new THREE.Vector3();
    this.targetRy = 0;
    this.lastSpeed = 0;

    this.label = document.createElement("div");
    this.label.className = "name-tag";
    this.label.textContent = name;
    Object.assign(this.label.style, {
      position: "fixed",
      color: "#9fe8e8",
      fontFamily: "Share Tech Mono, monospace",
      fontSize: "11px",
      textShadow: "0 0 6px rgba(24,224,224,0.8)",
      pointerEvents: "none",
      transform: "translate(-50%, -100%)",
      zIndex: 6,
    });
    document.getElementById("app").appendChild(this.label);
  }

  applyState(state) {
    this.target.set(state.x, state.y, state.z);
    this.targetRy = state.ry;
    this.lastSpeed = state.anim === "run" ? 1 : state.anim === "walk" ? 0.5 : 0;
  }

  update(dt) {
    const root = this.character.root;
    root.position.lerp(this.target, Math.min(1, dt * 10));
    let diff = ((this.targetRy - root.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    root.rotation.y += diff * Math.min(1, dt * 10);
    this.character.animate({ speed: this.lastSpeed, dt, jumping: false, turnRate: 0 });
  }

  updateLabel(camera, renderer) {
    const pos = this.character.root.position.clone();
    pos.y += 1.85;
    pos.project(camera);
    if (pos.z > 1) {
      this.label.style.display = "none";
      return;
    }
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const x = (pos.x * 0.5 + 0.5) * w;
    const y = (-pos.y * 0.5 + 0.5) * h;
    this.label.style.display = "block";
    this.label.style.left = `${x}px`;
    this.label.style.top = `${y}px`;
  }

  dispose(scene) {
    scene.remove(this.character.root);
    this.label.remove();
  }
}
