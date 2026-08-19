/**
 * Finds the nearest active beat (or, in the final act, ending console) within
 * range and fires a trigger callback when the player interacts with it —
 * either by pressing E or, for `proximity` beats, just by walking close.
 * Actual dialogue playback and objective completion live in Game.js; this
 * class only decides *what* is in range and *when* it should fire.
 */
export class Interactables {
  constructor(world, story, { onTrigger, onLocked } = {}) {
    this.world = world;
    this.story = story;
    this.onTrigger = onTrigger || (() => {});
    this.onLocked = onLocked || (() => {});
    this.pendingId = null;
  }

  /**
   * Incomplete beats for the current act. Beats whose `requires` aren't
   * satisfied yet are only included when `includeLocked` is set — they can
   * still be *seen* (so the player gets a "why can't I use this" prompt) but
   * never fire and never attract the waypoint.
   */
  _candidates({ includeLocked = false } = {}) {
    const act = this.story.current;
    const list = [];
    for (const beat of act.beats) {
      if (this.story.isObjectiveDone(beat.id)) continue;
      if (this.story.isBeatUnlocked(beat)) {
        list.push(beat);
        continue;
      }
      // `hiddenUntilUnlocked` props aren't in the room yet (the writing that
      // only the red light reveals) — they get no prompt at all.
      if (!includeLocked || beat.hiddenUntilUnlocked) continue;
      const missing = this.story.missingRequirement(beat);
      list.push({
        ...beat,
        locked: true,
        lockedPrompt: beat.lockedPrompts?.[missing] || beat.lockedPrompt || "Locked",
      });
    }

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

    const candidates = this._candidates({ includeLocked: true });
    let nearest = null;
    let nearestDist = Infinity;
    let nearestLocked = null;
    let nearestLockedDist = Infinity;

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
      if (dist > beat.radius) continue;
      if (beat.locked) {
        if (dist < nearestLockedDist) {
          nearestLocked = beat;
          nearestLockedDist = dist;
        }
      } else if (dist < nearestDist) {
        nearest = beat;
        nearestDist = dist;
      }
    }

    // A locked beat never eclipses one the player can actually do, even when
    // it's closer — props sit close together (the key lies beside the deck).
    if (!nearest) nearest = nearestLocked;
    if (!nearest) return { promptText: null };

    if (nearest.locked) {
      // Pressing E on a locked beat is deliberate feedback, not a no-op:
      // the player gets told what's still missing.
      if (input.consumeInteract()) this.onLocked(nearest);
      return { promptText: nearest.lockedPrompt || "Locked" };
    }

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
