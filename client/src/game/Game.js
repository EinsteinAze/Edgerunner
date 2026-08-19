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
// Which beat a carried item is used at — lets the inventory panel trigger the
// same beat E-interact would, once the player is in range.
const ITEM_USE_BEAT = { accessKey: "gateDoor" };

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
    this._pendingCodeBeat = null;
    this._lastGateWarning = 0;
    this._apartmentAlarmFired = false;
    this.inventory = [];

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
    if (beat.requiresCode) {
      this._pendingCodeBeat = beat;
      this.input.setChatActive(true);
      this.cb.onTerminalPrompt?.(true);
      return;
    }
    this.dialogue.play(this._resolveLines(beat.lines));
  }

  /** Swaps the `{CODE}` token for the session's random security code (see World.js's `generateAccessCode`). */
  _resolveLines(lines) {
    const code = this.world.securityCode;
    if (!code) return lines;
    return lines.map((l) => (l.text.includes("{CODE}") ? { ...l, text: l.text.replace("{CODE}", code) } : l));
  }

  /** Called by the UI when the player submits the Act II terminal password prompt. */
  submitTerminalCode(value) {
    const beat = this._pendingCodeBeat;
    if (!beat) return;
    const ok = String(value || "").trim().toUpperCase() === this.world.securityCode;
    this.cb.onTerminalResult?.(ok);
    if (!ok) return;
    this._pendingCodeBeat = null;
    this._removeInventoryItem("code");
    // Let "ACCESS GRANTED" hold on screen for a beat before the terminal
    // panel gives way to the hack dialogue.
    setTimeout(() => {
      this.input.setChatActive(false);
      this.cb.onTerminalPrompt?.(false);
      this.dialogue.play(this._resolveLines(beat.lines));
    }, 650);
  }

  /** Called by the UI when the player backs out of the terminal prompt (Esc) without solving it. */
  cancelTerminalPrompt() {
    if (!this._pendingCodeBeat) return;
    this._pendingCodeBeat = null;
    this.dialogueActive = false;
    this._activeBeat = null;
    this.input.setChatActive(false);
    this.interactables.clearPending();
    this.cb.onTerminalPrompt?.(false);
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
      this._addInventoryItem("accessKey", "ARASAKA KEY");
    }
    if (key === "dataShards") {
      this._addInventoryItem("code", `ACCESS CODE: ${this.world.securityCode}`);
    }
    // The key's last job is the door out — drop it from the list once used.
    if (key === "gateDoor") {
      this._removeInventoryItem("accessKey");
    }
    this._maybeTriggerApartmentAlarm();
  }

  _addInventoryItem(id, label) {
    if (this.inventory.some((i) => i.id === id)) return;
    this.inventory.push({ id, label });
    this._refreshInventory();
  }

  _removeInventoryItem(id) {
    const idx = this.inventory.findIndex((i) => i.id === id);
    if (idx < 0) return;
    this.inventory.splice(idx, 1);
    this._refreshInventory();
  }

  _refreshInventory() {
    this.cb.onInventory?.(this.inventory.map((i) => ({ id: i.id, label: i.label })));
  }

  /**
   * Called by the UI when the player clicks a carried item — an alternate to
   * walking up and pressing E. Only fires the beat if the player is actually
   * in range of wherever that item is used (same radius the E-prompt uses),
   * so it can't be used from across the room.
   */
  useInventoryItem(id) {
    if (this.dialogueActive || this.paused) return;
    const beatId = ITEM_USE_BEAT[id];
    const beat = beatId && this.story.beat(beatId);
    if (!beat || this.story.isObjectiveDone(beat.id) || !this.story.isBeatUnlocked(beat)) {
      this.cb.onError?.("Nothing to use that on right now.");
      return;
    }
    const anchor = this.world.anchors[beat.anchor];
    const pos = anchor?.position || anchor;
    const dist = pos && Math.hypot(this.player.position.x - pos.x, this.player.position.z - pos.z);
    if (dist == null || dist > beat.radius) {
      this.cb.onError?.("You need to be closer to use that here.");
      return;
    }
    this._onBeatTrigger(beat);
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
    if (act.key === 1) {
      // Switch the apartment and facility as one transaction: no Act I room
      // geometry remains visible behind the Act II facility.
      if (this.world.actGroups?.[1]) this.world.actGroups[1].visible = false;
      if (this.world.actGroups?.[2]) this.world.actGroups[2].visible = true;
      this.scene.fog = new THREE.FogExp2(0x0c0614, 0.045);
    }
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
