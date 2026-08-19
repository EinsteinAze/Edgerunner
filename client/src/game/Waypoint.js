import * as THREE from "three";

/** A subtle floating marker for the closest unfinished story objective. */
export class Waypoint {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.visible = false;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({ color: "#18e0e0", transparent: true, opacity: 0.88 })
    );
    ring.rotation.x = Math.PI / 2;
    this.root.add(ring);

    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.42, 4),
      new THREE.MeshBasicMaterial({ color: "#f6e94a", transparent: true, opacity: 0.95 })
    );
    arrow.rotation.x = Math.PI;
    arrow.position.y = -0.26;
    this.root.add(arrow);

    const glow = new THREE.PointLight("#18e0e0", 1.8, 3, 2);
    glow.position.y = 0.1;
    this.root.add(glow);
    scene.add(this.root);
  }

  update(anchor, dt) {
    if (!anchor) {
      this.root.visible = false;
      return;
    }
    const pos = anchor.position || anchor;
    this.root.visible = true;
    this.root.position.set(pos.x, (pos.y || 0) + 2.35 + Math.sin(performance.now() * 0.003) * 0.12, pos.z);
    this.root.rotation.y += dt * 0.8;
  }

  dispose(scene) {
    scene.remove(this.root);
  }
}
