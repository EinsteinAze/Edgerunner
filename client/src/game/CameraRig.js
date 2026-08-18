import * as THREE from "three";

const _desired = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _pivotOffset = new THREE.Vector3(0, 1.55, 0);
const _camPos = new THREE.Vector3();

export class CameraRig {
  constructor(camera, colliderMeshesRef) {
    this.camera = camera;
    this.camera.fov = 48;
    this.camera.updateProjectionMatrix();
    this.colliderMeshesRef = colliderMeshesRef;
    this.yaw = 0;
    this.pitch = -0.15;
    this.distance = 4.2;
    this.minDistance = 1.1;
    this.maxDistance = 7;
    this.raycaster = new THREE.Raycaster();
    this._initialized = false;
    this._sway = Math.random() * Math.PI * 2;
  }

  applyLook(dx, dy) {
    this.yaw -= dx * 0.0026;
    this.pitch -= dy * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.85, 0.55);
  }

  applyZoom(deltaY) {
    this.distance = THREE.MathUtils.clamp(this.distance + deltaY * 0.0025, this.minDistance, this.maxDistance);
  }

  update(targetPos, dt = 1 / 60) {
    this._sway += dt;
    const pivot = _origin.copy(targetPos).add(_pivotOffset);

    _desired.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    let dist = this.distance;
    _dir.copy(_desired);
    this.raycaster.set(pivot, _dir);
    this.raycaster.far = this.distance;
    const hits = this.raycaster.intersectObjects(this.colliderMeshesRef.current, false);
    if (hits.length) dist = Math.max(this.minDistance, hits[0].distance * 0.9);

    // subtle handheld sway — barely-there breathing/idle drift, not a shake
    const swayX = Math.sin(this._sway * 0.6) * 0.012;
    const swayY = Math.sin(this._sway * 0.9 + 1.3) * 0.008;

    _camPos.copy(pivot).addScaledVector(_desired, dist);
    _camPos.x += swayX;
    _camPos.y += swayY;

    if (!this._initialized) {
      this.camera.position.copy(_camPos);
      this._initialized = true;
    } else {
      // frame-rate independent damping: smaller camera moves during cutscene-like
      // proximity (short `dist`) read as more "locked on", matching cinematic framing
      const damp = 1 - Math.pow(0.0025, dt);
      this.camera.position.lerp(_camPos, damp);
    }
    this.camera.lookAt(pivot.x, pivot.y + 0.15 + swayY * 0.5, pivot.z);
  }

  /** Forward vector projected on the XZ plane, used to drive movement relative to camera. */
  getPlanarForward(out) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out.normalize();
  }

  getPlanarRight(out) {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out.normalize();
  }
}
