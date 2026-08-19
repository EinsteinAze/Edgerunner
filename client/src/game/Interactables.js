/**
 * Finds the nearest active beat (or, in the final act, ending console) within
 * range and fires a trigger callback when the player interacts with it —
 * either by pressing E or, for `proximity` beats, just by walking close.
 * Actual dialogue playback and objective completion live in Game.js; this
 * class only decides *what* is in range and *when* it should fire.
 */
export class Interactables {
  constructor(world, story, { onTrigger } = {}) {
    this.world = world;
    this.story = story;
    this.onTrigger = onTrigger || (() => {});
    this.pendingId = null;
  }

  _candidates() {
    const act = this.story.current;
    const list = act.beats.filter((b) => !this.story.isObjectiveDone(b.id));

    const finalUnlocked = act.endings && this.story.isObjectiveDone("childrenGathering");
    if (finalUnlocked) {
      for (const [key, def] of Object.entries(act.endings)) {
        list.push({
          id: `ending:${key}`,
          anchor: key === "destroy" ? "choiceDestroy" : key === "join" ? "choiceJoin" : "choiceRelease",
          radius: 2.2,
          trigger: "interact",
          prompt: def.prompt,
          lines: def.lines,
          isEnding: true,
          endingKey: key,
        });
      }
    }
    return list;
  }

  navigationTarget(playerPos) {
    let target = null;
    let nearestDist = Infinity;
    for (const beat of this._candidates()) {
      const anchor = this.world.anchors[beat.anchor];
      if (!anchor) continue;
      const pos = anchor.position || anchor;
      const distance = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
      if (distance < nearestDist) {
        nearestDist = distance;
        target = anchor;
      }
    }
    return target;
  }

  update(dt, playerPos, input) {
    if (this.pendingId) {
      input.consumeInteract();
      return { promptText: null };
    }

    const candidates = this._candidates();
    let nearest = null;
    let nearestDist = Infinity;

    for (const beat of candidates) {
      const anchor = this.world.anchors[beat.anchor];
      if (!anchor) continue;
      // Anchors are either an Object3D (props/gates — use .position) or a
      // raw Vector3 (zone spawn points, also used directly for teleporting
      // the player — see Game.js's SPAWN_FOR_ACT) which has x/z itself.
      const ap = anchor.position || anchor;
      const dx = playerPos.x - ap.x;
      const dz = playerPos.z - ap.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= beat.radius && dist < nearestDist) {
        nearest = beat;
        nearestDist = dist;
      }
    }

    if (!nearest) return { promptText: null };

    if (nearest.trigger === "proximity") {
      this.pendingId = nearest.id;
      this.onTrigger(nearest);
      return { promptText: null };
    }

    if (input.consumeInteract()) {
      this.pendingId = nearest.id;
      this.onTrigger(nearest);
      return { promptText: null };
    }

    return { promptText: nearest.isEnding ? nearest.prompt : nearest.prompt || "Interact" };
  }

  clearPending() {
    this.pendingId = null;
  }
}
