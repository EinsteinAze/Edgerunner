import * as THREE from "three";
import { Input } from "./Input.js";
import { createWorld, unlockGate } from "./World.js";
import { PlayerController } from "./PlayerController.js";
import { RemotePlayer } from "./RemotePlayer.js";
import { CameraRig } from "./CameraRig.js";
import { Interactables } from "./Interactables.js";
import { StoryManager, ACT1_ALARM_LINES } from "./StoryManager.js";
import { DialogueSequencer } from "./Dialogue.js";
import { flickerHologram } from "./CharacterModel.js";
import { PostFX } from "./PostFX.js";
import { Waypoint } from "./Waypoint.js";

const GATE_FOR_ACT = { 1: "gate1", 2: "gate2", 3: "gate3", 4: "gate4", 5: "gate5" };
const SPAWN_FOR_ACT = { 1: "spawn", 2: "zone2Spawn", 3: "zone3Spawn", 4: "zone4Spawn", 5: "zone5Spawn", 6: "zone6Spawn" };
const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.cb = callbacks;
    this.running = false;
    this.remotePlayers = new Map();
    this.network = null;
    this.paused = false;
    this.dialogueActive = false;
    this._activeBeat = null;
    this._lastGateWarning = 0;
    this._apartmentAlarmFired = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.postfx = new PostFX(this.renderer, this.scene, this.camera);

    this._resize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postfx.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", this._resize);

    this.colliderMeshesRef = { current: [] };
    this.clock = new THREE.Clock();
  }

  init(cosmetics, network, existingPlayers = []) {
    this.network = network;
    this.world = createWorld(this.scene, this.colliderMeshesRef.current);
    this.scene.updateMatrixWorld(true);
    this.colliderMeshesRef.current.push(...this.world.colliders.map((c) => c.mesh));

    this.player = new PlayerController(this.scene, this.world.colliders, cosmetics);
    this.player.teleport(this.world.anchors.spawn);

    this.cameraRig = new CameraRig(this.camera, this.colliderMeshesRef);
    this.cameraRig.faceTarget(this.player.position, this.world.anchors.mainDesk);
    this.input = new Input(this.canvas);

    this.story = new StoryManager((evt) => this._onStoryEvent(evt));
    this.interactables = new Interactables(this.world, this.story, {
      onTrigger: (beat) => this._onBeatTrigger(beat),
      onLocked: (beat) => this.cb.onError?.(beat.lockedPrompt || "You can't use this yet"),
    });
    this.waypoint = new Waypoint(this.scene);
    this.dialogue = new DialogueSequencer({
      onLine: (line, isLast) => this.cb.onDialogueLine?.(line, isLast),
      onDone: () => this._onDialogueDone(),
    });

    this._refreshHud();

    if (network) {
      network.on("player:joined", (p) => this._addRemote(p));
      network.on("player:left", ({ id }) => this._removeRemote(id));
      network.on("player:state", (s) => this.remotePlayers.get(s.id)?.applyState(s));
      network.on("player:act", () => {});
      network.on("chat", (entry) => this.cb.onChat?.(entry));
      for (const p of existingPlayers) this._addRemote(p);
    }
  }

  _addRemote(p) {
    if (p.id === this.network?.id) return;
    if (this.remotePlayers.has(p.id)) return;
    const rp = new RemotePlayer(this.scene, p.id, { hair: p.hair, jacket: p.jacket }, p.name);
    rp.target.set(p.x, p.y, p.z);
    this.remotePlayers.set(p.id, rp);
    this._refreshRoster();
  }

  _removeRemote(id) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    rp.dispose(this.scene);
    this.remotePlayers.delete(id);
    this._refreshRoster();
  }

  _refreshRoster() {
    this.cb.onRoster?.(this.remotePlayers.size);
  }

  _refreshHud() {
    const act = this.story.current;
    this.cb.onActBadge?.(`ACT ${ROMAN[act.key]} — ${act.name}`);
    this.cb.onLocation?.(act.location);
    this.cb.onObjectives?.(this.story.objectiveSummary());
  }

  _onBeatTrigger(beat) {
    this._activeBeat = beat;
    this.dialogueActive = true;
    this.input.releasePointerLock();
    this.dialogue.play(beat.lines);
  }

  _onDialogueDone() {
    this.dialogueActive = false;
    this.cb.onDialogueLine?.(null);
    const beat = this._activeBeat;
    this._activeBeat = null;
    this.interactables.clearPending();
    if (!beat) return;

    if (beat.isEnding) {
      this._finishWithEnding(beat.endingKey);
      return;
    }
    this.story.complete(beat.id);
  }

  _onStoryEvent(evt) {
    if (evt.type === "objective") {
      this._refreshHud();
      this._onObjectiveComplete(evt.key);
      if (!this.story.current.endings && this.story.isActComplete()) {
        this._completeAct();
      }
    }
  }

  _onObjectiveComplete(key) {
    // Lucy pockets the key — the prop and its glint light go with her.
    if (key === "accessKey") {
      const prop = this.world.props?.accessKey;
      if (prop) prop.visible = false;
    }
    this._maybeTriggerApartmentAlarm();
  }

  /**
   * Act I's payoff: holding both the bloodied note and the access key flips
   * the apartment's lighting over to red, which is also what makes the
   * writing by the window readable (and unlocks the `bloodWall` beat).
   */
  _maybeTriggerApartmentAlarm() {
    if (this._apartmentAlarmFired || this.story.act !== 1) return;
    if (!this.story.isObjectiveDone("bloodNote") || !this.story.isObjectiveDone("accessKey")) return;

    this._apartmentAlarmFired = true;
    this.world.triggerApartmentAlarm?.();
    this.postfx.pulseFlash(0.3);
    this.postfx.setRedWash(0.62, { duration: 2.4 });

    // Reached from _onDialogueDone, which has already torn down the previous
    // line, so starting a new sequence here is safe.
    this.dialogueActive = true;
    this.input.releasePointerLock();
    this.dialogue.play(ACT1_ALARM_LINES);
  }

  _completeAct() {
    this.paused = true;
    this.input.releasePointerLock();
    const act = this.story.current;
    const gateKey = GATE_FOR_ACT[act.key];
    if (gateKey) unlockGate(this.world, gateKey);
    const nextActGroup = this.world.actGroups?.[act.key + 1];
    if (nextActGroup) nextActGroup.visible = true;
    this.network?.sendAct(act.key + 1);
    this.cb.onActComplete?.(act, false);
  }

  _checkLockedBoundary() {
    const gateKey = GATE_FOR_ACT[this.story.act];
    const gate = gateKey && this.world.gates[gateKey];
    if (!gate || gate.userData.unlocked || this.story.isActComplete()) return;

    const width = gate.geometry.parameters.width / 2 + 0.8;
    const depth = gate.geometry.parameters.depth / 2 + 1.1;
    if (Math.abs(this.player.position.x - gate.position.x) > width || Math.abs(this.player.position.z - gate.position.z) > depth) return;

    const now = performance.now();
    if (now - this._lastGateWarning < 1800) return;
    this._lastGateWarning = now;
    this.cb.onError?.("Access Denied: Complete current objectives first");
  }

  _finishWithEnding(key) {
    const def = this.story.chooseEnding(key);
    if (!def) return;
    this.paused = true;
    this.input.releasePointerLock();
    const act = this.story.current;
    this.cb.onActComplete?.(
      { endTitle: def.endTitle, endMessage: def.endMessage, endReference: act.endReference },
      true
    );
  }

  continueToNextAct() {
    if (this.story.isFinalAct()) return;
    // The red wash belongs to the apartment — it doesn't follow Lucy out.
    this.postfx.setRedWash(0, { duration: 1.6 });
    this.story.advance();
    const spawnKey = SPAWN_FOR_ACT[this.story.act];
    const spawn = this.world.anchors[spawnKey];
    if (spawn) this.player.teleport(spawn);
    this._refreshHud();
    this.paused = false;
  }

  setPaused(v) {
    this.paused = v;
    if (v) this.input.releasePointerLock();
  }

  start() {
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this._tick(dt);
    };
    requestAnimationFrame(loop);
  }

  _tick(dt) {
    if (this.dialogueActive) {
      if (this.input.consumeInteract()) this.dialogue.next();
      this.input.consumeLook();
      this.input.consumeWheel();
    } else if (!this.paused) {
      const look = this.input.consumeLook();
      this.cameraRig.applyLook(look.dx, look.dy);
      this.cameraRig.applyZoom(this.input.consumeWheel());
      this.player.update(dt, this.input, this.cameraRig);
      this._checkLockedBoundary();

      const { promptText } = this.interactables.update(dt, this.player.position, this.input);
      this.cb.onPrompt?.(promptText);
      this.waypoint.update(this.interactables.navigationTarget(this.player.position), dt);

      if (this.network?.connected) {
        this.network.sendState({
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          ry: this.player.facing,
          anim: this.player.speed > 0.75 ? "run" : this.player.speed > 0 ? "walk" : "idle",
        });
      }
    } else {
      this.input.consumeInteract();
      this.input.consumeLook();
      this.input.consumeWheel();
    }

    if (this.dialogueActive || this.paused) this.waypoint?.update(null, dt);

    this.cameraRig.update(this.player.position, dt);

    for (const rp of this.remotePlayers.values()) {
      rp.update(dt);
      rp.updateLabel(this.camera, this.renderer);
    }
    for (const h of this.world.holograms) flickerHologram(h, dt);
    if (this.world.updateLights) this.world.updateLights(dt);

    this.postfx.render(dt);
  }

  dispose() {
    this.running = false;
    window.removeEventListener("resize", this._resize);
    this.input?.dispose();
    this.waypoint?.dispose(this.scene);
    for (const rp of this.remotePlayers.values()) rp.dispose(this.scene);
  }
}
