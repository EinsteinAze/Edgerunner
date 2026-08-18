import * as THREE from "three";
import { spawnCharacter } from "./CharacterLoader.js";

const GRAVITY = -22;
const JUMP_SPEED = 7.5;
const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.6;
const PLAYER_RADIUS = 0.32;

const _move = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class PlayerController {
  constructor(scene, colliders, cosmetics) {
    this.colliders = colliders;
    this.character = spawnCharacter(scene, cosmetics);
    this.position = new THREE.Vector3(0, 0, 8);
    this.velocityY = 0;
    this.grounded = true;
    this.facing = 0;
    this.turnRate = 0;
    this.speed = 0;
    this.character.root.position.copy(this.position);
  }

  teleport(vec3) {
    this.position.copy(vec3);
    this.velocityY = 0;
  }

  resolveCollisions(nextPos) {
    for (const c of this.colliders) {
      const dx = nextPos.x - c.x;
      const dz = nextPos.z - c.z;
      // world -> collider-local space (undo the box's yaw)
      const cos = Math.cos(-c.ry);
      const sin = Math.sin(-c.ry);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const hw = c.hw + PLAYER_RADIUS;
      const hd = c.hd + PLAYER_RADIUS;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;

      const overlapX = hw - Math.abs(lx);
      const overlapZ = hd - Math.abs(lz);
      let pushLx = lx;
      let pushLz = lz;
      if (overlapX < overlapZ) {
        pushLx = lx + overlapX * Math.sign(lx || 1);
      } else {
        pushLz = lz + overlapZ * Math.sign(lz || 1);
      }

      // collider-local -> world space (re-apply the box's yaw)
      const wcos = Math.cos(c.ry);
      const wsin = Math.sin(c.ry);
      nextPos.x = c.x + (pushLx * wcos - pushLz * wsin);
      nextPos.z = c.z + (pushLx * wsin + pushLz * wcos);
    }
  }

  update(dt, input, cameraRig) {
    const forward = input.isDown("KeyW") || input.isDown("ArrowUp") ? 1 : input.isDown("KeyS") || input.isDown("ArrowDown") ? -1 : 0;
    const strafe = input.isDown("KeyD") || input.isDown("ArrowRight") ? 1 : input.isDown("KeyA") || input.isDown("ArrowLeft") ? -1 : 0;
    const sprinting = input.isDown("ShiftLeft") || input.isDown("ShiftRight");

    cameraRig.getPlanarForward(_fwd);
    cameraRig.getPlanarRight(_right);

    _move.set(0, 0, 0);
    if (forward) _move.addScaledVector(_fwd, forward);
    if (strafe) _move.addScaledVector(_right, strafe);
    const moving = _move.lengthSq() > 0.0001;
    if (moving) _move.normalize();

    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    this.speed = moving ? speed / SPRINT_SPEED : 0;

    if (this.grounded && input.isDown("Space")) {
      this.velocityY = JUMP_SPEED;
      this.grounded = false;
    }
    this.velocityY += GRAVITY * dt;

    _tmp.copy(this.position);
    _tmp.addScaledVector(_move, speed * dt);
    _tmp.y += this.velocityY * dt;

    if (_tmp.y <= 0) {
      _tmp.y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }

    this.resolveCollisions(_tmp);
    this.position.copy(_tmp);
    this.character.root.position.copy(this.position);

    this.turnRate = 0;
    if (moving) {
      const targetFacing = Math.atan2(_move.x, _move.z);
      const prevFacing = this.facing;
      this.facing = lerpAngle(this.facing, targetFacing, 1 - Math.pow(0.0001, dt));
      this.turnRate = dt > 0 ? shortestAngleDelta(prevFacing, this.facing) / dt : 0;
    }
    this.character.root.rotation.y = this.facing;

    this.character.animate({ speed: this.speed, dt, jumping: !this.grounded, turnRate: this.turnRate });
  }
}

function shortestAngleDelta(a, b) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
