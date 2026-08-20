// "THE CHILDREN OF ARASAKA" — an original Night City / Arasaka netrunner story
// inspired by the tone of Cyberpunk: Edgerunners. Not affiliated with or
// reproducing dialogue from the show.

const L = "LUCY";
const M = "MARA";
const N = "NOAH";
const S = "SERA";
const K = "KIAN";
const NARR = "";
const SCR = "SCREEN";

export const ACTS = {
  1: {
    key: 1,
    name: "THE MESSAGE",
    location: "Lucy's Apartment",
    beats: [
      {
        id: "window",
        anchor: "window",
        radius: 2.2,
        trigger: "interact",
        prompt: "Look out the window",
        lines: [
          { speaker: NARR, text: "Night City sprawls below — neon signs, flying vehicles cutting through rain, a thousand ads screaming for attention." },
        ],
      },
      {
        id: "dataShards",
        anchor: "dataShards",
        radius: 2,
        trigger: "interact",
        prompt: "Examine old data shards",
        lines: [{ speaker: NARR, text: "Old personal data shards. Fragments of a life before all this." }],
      },
      {
        id: "bloodNote",
        anchor: "bloodNote",
        radius: 1.9,
        trigger: "interact",
        prompt: "Pick up the stained paper",
        lines: [
          { speaker: NARR, text: "A sheet of paper lies half under the bed, folded down to the size of a shard." },
          { speaker: L, text: '"That wasn\'t there yesterday."' },
          { speaker: NARR, text: "She unfolds it. The writing isn't ink — it's dried to a dull, cracked brown-red." },
          { speaker: NARR, text: 'Two words, dragged across the page: "SAVE US."' },
          { speaker: NARR, text: "Below them, smaller, signed with a single letter: M." },
          { speaker: L, text: '"Someone was in my apartment."' },
          { speaker: NARR, text: "There's a mark under the signature — a crude arrow, pointing at the desk." },
        ],
      },
      {
        id: "accessKey",
        anchor: "accessKey",
        radius: 1.8,
        trigger: "interact",
        prompt: "Search the floor by the desk",
        requires: ["bloodNote"],
        lockedPrompts: { bloodNote: "Nothing under here — but something pale is lying by the bed" },
        lines: [
          { speaker: NARR, text: "Lucy crouches and sweeps her hand under the desk. Something small and cold snags her fingers." },
          { speaker: NARR, text: "An Arasaka access key. Old model — the kind they stopped issuing years before she got out." },
          { speaker: NARR, text: "Someone has scratched two characters into the casing by hand: M-02." },
          { speaker: L, text: '"...Mara\'s number."' },
          { speaker: L, text: '"Someone put this where they knew I\'d look."' },
        ],
      },
      {
        id: "bloodWall",
        anchor: "bloodWall",
        radius: 2.4,
        trigger: "interact",
        prompt: "Read the writing on the wall",
        requires: ["bloodNote", "accessKey"],
        // Invisible until the room turns red — no prompt should exist before then.
        hiddenUntilUnlocked: true,
        lines: [
          { speaker: NARR, text: "Under the red light the wall gives up what it was hiding — the same hand, the same dried red." },
          { speaker: NARR, text: "Four names: MARA · NOAH · SERA · KIAN." },
          { speaker: NARR, text: "And beneath them, in a shakier stroke, a fifth: LUCY." },
          { speaker: L, text: '"Only someone from the program knows these names."' },
          { speaker: L, text: '"Everyone from the program is dead."' },
          { speaker: NARR, text: "Behind her, the cyberdeck's standby light blinks awake." },
        ],
      },
      {
        id: "cyberdeck",
        anchor: "cyberdeck",
        radius: 2.2,
        trigger: "interact",
        prompt: "Unlock the cyberdeck with the key",
        requires: ["accessKey", "bloodWall"],
        lockedPrompts: {
          accessKey: "The deck is locked — an Arasaka key is missing",
          bloodWall: "The deck holds. Whatever is written on that wall comes first",
        },
        lines: [
          { speaker: NARR, text: "Lucy slots the scratched access key into the deck. It takes on the first try." },
          { speaker: NARR, text: "BEEP. A mysterious data packet arrives." },
          { speaker: L, text: '"What?"' },
          { speaker: "UNKNOWN", text: '"If you remember the facility, you remember me."' },
          { speaker: L, text: '"Who is this?"' },
          { speaker: NARR, text: "A photograph loads. Five children. Lucy recognizes them." },
          { speaker: L, text: '"No... Mara."' },
          { speaker: "UNKNOWN", text: '"They told you we were dead."' },
          { speaker: L, text: '"That\'s impossible."' },
          { speaker: "UNKNOWN", text: '"They lied."' },
          { speaker: L, text: '"Mara died."' },
          { speaker: NARR, text: "The system displays coordinates: ARASAKA SUBLEVEL 23." },
          { speaker: L, text: '"I swore I\'d never go back."' },
          { speaker: "UNKNOWN", text: '"You promised me."' },
          { speaker: L, text: '"...Mara?"' },
        ],
      },
    ],
    endTitle: "ACT I — THE MESSAGE",
    endMessage:
      "The coordinates burn behind her eyes. ARASAKA SUBLEVEL 23. A place she swore she'd never see again — and a voice that shouldn't exist.",
    endReference:
      "Reference: nothing Arasaka builds ever really gets deleted. Ahead: the facility remembers you too.",
  },

  2: {
    key: 2,
    name: "RETURN TO ARASAKA",
    location: "Abandoned Arasaka Facility",
    beats: [
      {
        id: "entry",
        anchor: "zone2Spawn",
        radius: 6,
        trigger: "proximity",
        lines: [
          { speaker: NARR, text: "Lucy enters the abandoned facility. Arasaka logos, broken cameras, flickering lights." },
          { speaker: L, text: '"It\'s still here."' },
          { speaker: L, text: '"After all these years..."' },
        ],
      },
      {
        id: "nameWall",
        anchor: "nameWall",
        radius: 2.8,
        trigger: "interact",
        prompt: "Read Names",
        lines: [
          { speaker: NARR, text: "Five names are scratched into the wall: LUCY · MARA · NOAH · SERA · KIAN." },
          { speaker: NARR, text: "Lucy touches Mara's name. A memory surfaces." },
          { speaker: `${M} (memory)`, text: '"You\'re too slow."' },
          { speaker: `${L} (memory)`, text: '"I\'m coming."' },
          { speaker: `${M} (memory)`, text: '"If they catch us, we\'re dead."' },
          { speaker: `${L} (memory)`, text: '"They won\'t."' },
          { speaker: `${M} (memory)`, text: '"Promise?"' },
          { speaker: `${L} (memory)`, text: '"Promise."' },
          { speaker: L, text: '"I kept my promise."' },
        ],
      },
      {
        id: "securityTerminal",
        anchor: "securityTerminal",
        radius: 2,
        trigger: "interact",
        prompt: "Hack the security terminal",
        lines: [
          { speaker: NARR, text: "A terminal still has power. Lucy hacks it." },
          { speaker: SCR, text: "ARASAKA INTERNAL PROGRAM — CHILD NETRUNNER DEVELOPMENT" },
          { speaker: SCR, text: "L-01 LUCY · M-02 MARA · N-03 NOAH · S-04 SERA · K-05 KIAN" },
          { speaker: SCR, text: "STATUS — LUCY: ESCAPED. MARA / NOAH / SERA / KIAN: DECEASED." },
          { speaker: L, text: '"They really wrote us off."' },
          { speaker: NARR, text: "A recording activates." },
          { speaker: `${M} (recording)`, text: '"Lucy... if they tell you we\'re dead..."' },
          { speaker: `${M} (recording)`, text: '"...don\'t believe them."' },
          { speaker: L, text: '"Mara?"' },
        ],
      },
    ],
    endTitle: "ACT II — RETURN TO ARASAKA",
    endMessage:
      "Five names on a wall. A dead girl's voice in a live recording. Whatever Arasaka buried down here, it isn't finished with Lucy.",
    endReference:
      "Reference: the training room is deeper still. That's where they taught five children to share more than lessons.",
  },

  3: {
    key: 3,
    name: "WHAT ARASAKA DID",
    location: "Netrunner Training Facility",
    beats: [
      {
        id: "trainingChairs",
        anchor: "trainingChairs",
        radius: 2.6,
        trigger: "interact",
        prompt: "Play the training recording",
        lines: [
          { speaker: NARR, text: "Five netrunning chairs, each stamped with a child's identification number." },
          { speaker: NARR, text: "An old terminal plays a holographic recording." },
          { speaker: "RESEARCHER", text: '"The subjects demonstrate exceptional neural compatibility."' },
          { speaker: "RESEARCHER 2", text: '"They\'re children."' },
          { speaker: "RESEARCHER", text: '"They\'re assets."' },
          { speaker: "RESEARCHER", text: '"During deep-net operations, their neural patterns began synchronizing."' },
          { speaker: "RESEARCHER 2", text: '"Synchronizing?"' },
          { speaker: "RESEARCHER", text: '"They\'re sharing memories."' },
          { speaker: L, text: '"No..."' },
          { speaker: "RESEARCHER", text: '"Subject M-02 can access memories belonging to L-01."' },
          { speaker: L, text: '"They were using us."' },
        ],
      },
      {
        id: "memoryRoom",
        anchor: "memoryRoom",
        radius: 2.6,
        trigger: "interact",
        prompt: "Connect to the memory room",
        lines: [
          { speaker: NARR, text: "Lucy connects her cyberdeck. The room dissolves into memory." },
          { speaker: M, text: '"Can you hear me?"' },
          { speaker: `${L} (young)`, text: '"You\'re not talking."' },
          { speaker: M, text: '"I know."' },
          { speaker: `${L} (young)`, text: '"Then how am I hearing you?"' },
          { speaker: M, text: '"The Net."' },
          { speaker: N, text: '"They\'re watching us."' },
          { speaker: `${L} (young)`, text: '"Noah?"' },
          { speaker: NARR, text: "The memory glitches. Sera's voice comes from Mara." },
          { speaker: S, text: '"Don\'t trust the doctors."' },
          { speaker: NARR, text: "The memory disappears." },
          { speaker: L, text: '"Those weren\'t Mara\'s memories."' },
          { speaker: NARR, text: "Lucy realizes: the children's memories are mixed together." },
        ],
      },
    ],
    endTitle: "ACT III — WHAT ARASAKA DID",
    endMessage:
      "Arasaka didn't just train five children to run the net together. It taught their minds to bleed into each other — and never told them.",
    endReference:
      "Reference: what happens next isn't a memory file. It's a flashback — you're about to BE there.",
  },

  4: {
    key: 4,
    name: "THE ESCAPE",
    location: "Arasaka Facility — Flashback",
    beats: [
      {
        id: "entry",
        anchor: "zone4Spawn",
        radius: 6,
        trigger: "proximity",
        lines: [
          { speaker: NARR, text: "ALARM. Red lights. Security shutters slam down the corridor." },
          { speaker: M, text: '"Lucy!"' },
          { speaker: L, text: '"Where\'s Noah?"' },
          { speaker: M, text: '"I don\'t know."' },
          { speaker: L, text: '"We have to find him."' },
          { speaker: M, text: '"There\'s no time."' },
          { speaker: NARR, text: "An explosion rocks the hallway." },
        ],
      },
      {
        id: "seraProp",
        anchor: "seraProp",
        radius: 2.6,
        trigger: "interact",
        prompt: "Check on Sera",
        lines: [
          { speaker: L, text: '"Sera!"' },
          { speaker: NARR, text: "Mara checks her." },
          { speaker: M, text: '"She\'s alive."' },
          { speaker: L, text: '"Then carry her."' },
          { speaker: M, text: '"We can\'t. Arasaka locked the neural system onto us."' },
          { speaker: L, text: '"Then disconnect it."' },
          { speaker: M, text: '"It\'s locked onto me."' },
          { speaker: L, text: '"Then we\'ll break it."' },
          { speaker: M, text: '"You still don\'t understand."' },
        ],
      },
      {
        id: "escapeDoor",
        anchor: "escapeDoor",
        radius: 2.6,
        trigger: "interact",
        prompt: "Reach the escape door",
        lines: [
          { speaker: L, text: '"Come on!"' },
          { speaker: M, text: '"You have to go."' },
          { speaker: L, text: '"No."' },
          { speaker: M, text: '"Lucy."' },
          { speaker: L, text: '"We\'re leaving together."' },
          { speaker: M, text: '"If I leave, the system follows me."' },
          { speaker: L, text: '"Then we\'ll destroy it."' },
          { speaker: M, text: '"You can\'t."' },
          { speaker: L, text: '"I\'m not leaving you."' },
          { speaker: M, text: '"You promised."' },
          { speaker: L, text: '"Together."' },
          { speaker: M, text: '"You kept half of that promise."' },
          { speaker: NARR, text: "Mara pushes Lucy through the escape door." },
          { speaker: L, text: '"MARA!"' },
          { speaker: NARR, text: "The door slams shut. Explosion. Black." },
        ],
      },
    ],
    endTitle: "ACT IV — THE ESCAPE",
    endMessage:
      "The door closed on half a promise. Lucy got out. Mara didn't — not all the way, not for good.",
    endReference:
      "Reference: Arasaka's archives don't die when the building does. Somewhere, there's a file that calls this operation a success.",
  },

  5: {
    key: 5,
    name: "THE LIE",
    location: "Arasaka Classified Archive",
    beats: [
      {
        id: "archiveTerminal",
        anchor: "archiveTerminal",
        radius: 2.4,
        trigger: "interact",
        prompt: "Hack the classified archive",
        lines: [
          { speaker: NARR, text: "An extremely old Arasaka archive. Lucy hacks it." },
          { speaker: SCR, text: "OPERATION ECHO — STATUS: SUCCESSFUL" },
          { speaker: L, text: '"Successful?"' },
          { speaker: SCR, text: "M-02 / N-03 / S-04 / K-05 — NEURAL DATA PRESERVED" },
          { speaker: L, text: '"They\'re alive..."' },
          { speaker: L, text: '"...No. Not alive."' },
          { speaker: NARR, text: "The server activates." },
          { speaker: `${M} (voice)`, text: '"Lucy?"' },
          { speaker: L, text: '"Mara?"' },
        ],
      },
    ],
    endTitle: "ACT V — THE LIE",
    endMessage:
      "Not dead. Preserved. Whatever Arasaka kept running in that server for years, it just said her name.",
    endReference:
      "Reference: the Central Data Core is the only place left to go. Whatever's waiting there has had a long time to think.",
  },

  6: {
    key: 6,
    name: "THE FINAL NETRUN",
    location: "Arasaka Central Data Core",
    beats: [
      {
        id: "entry",
        anchor: "zone6Spawn",
        radius: 7,
        trigger: "proximity",
        lines: [
          { speaker: NARR, text: "Lucy enters the server chamber. Hundreds of servers, huge cables, holographic data. She connects her cyberdeck." },
          { speaker: NARR, text: "The environment reshapes into a reconstructed digital space. Five children stand together." },
        ],
      },
      {
        id: "childrenGathering",
        anchor: "childrenGathering",
        radius: 3.2,
        trigger: "interact",
        prompt: "Approach the children",
        lines: [
          { speaker: M, text: '"You came back."' },
          { speaker: L, text: '"Are you Mara?"' },
          { speaker: M, text: '"Does it matter?"' },
          { speaker: L, text: '"Yes."' },
          { speaker: M, text: '"Then I don\'t know."' },
          { speaker: N, text: '"We remember you."' },
          { speaker: S, text: '"We remember everything."' },
          { speaker: K, text: '"No. We remember pieces."' },
          { speaker: L, text: '"What are you?"' },
          { speaker: M, text: '"What\'s left."' },
          { speaker: NARR, text: "Lucy understands: this isn't just Mara. It's Mara, Noah, Sera and Kian's memories, tangled with fragments of Lucy herself." },
          { speaker: L, text: '"Arasaka copied us."' },
          { speaker: M, text: '"They tried."' },
          { speaker: L, text: '"And you?"' },
          { speaker: M, text: '"I stayed behind."' },
          { speaker: L, text: '"Why contact me?"' },
          { speaker: M, text: '"Because you\'re the missing piece."' },
          { speaker: L, text: '"What happens if I connect?"' },
          { speaker: M, text: '"We become complete."' },
          { speaker: L, text: '"And if I don\'t?"' },
          { speaker: M, text: '"We remain ghosts."' },
          { speaker: NARR, text: "Three consoles hum to life around the chamber: DESTROY. JOIN. RELEASE. The choice is yours." },
        ],
      },
    ],
    // Final act has no single ending — the player picks one of three consoles.
    endings: {
      destroy: {
        prompt: "Interface with the DESTROY console",
        lines: [
          { speaker: L, text: '"I\'m sorry."' },
          { speaker: M, text: '"Don\'t be."' },
          { speaker: NARR, text: "Lucy destroys the server." },
          { speaker: M, text: '"Thank you."' },
          { speaker: NARR, text: "Everything disappears." },
        ],
        endTitle: "LET THEM GO",
        endMessage: "Lucy chose mercy over resurrection. The ghosts of Sublevel 23 are finally allowed to rest.",
      },
      join: {
        prompt: "Interface with the JOIN console",
        lines: [
          { speaker: NARR, text: "Lucy connects her cyberdeck. The screen goes white." },
          { speaker: NARR, text: "She wakes inside the childhood memory. Five children stand together." },
          { speaker: M, text: '"You came back."' },
          { speaker: L, text: '"I promised."' },
          { speaker: M, text: '"You kept your promise."' },
          { speaker: NARR, text: "They walk away together." },
        ],
        endTitle: "TOGETHER",
        endMessage: "Lucy stayed. Whatever she is now, she isn't alone in that server anymore — and neither are they.",
      },
      release: {
        prompt: "A hidden data port — investigate",
        lines: [
          { speaker: L, text: '"You don\'t belong here."' },
          { speaker: M, text: '"What are you doing?"' },
          { speaker: L, text: '"Giving you a way out."' },
          { speaker: NARR, text: "Lucy uploads the children's memories across every screen in Night City." },
          { speaker: M, text: '"My name is Mara."' },
          { speaker: N, text: '"I was here."' },
          { speaker: S, text: '"I was here."' },
          { speaker: K, text: '"They erased us."' },
          { speaker: L, text: '"But they couldn\'t erase everything."' },
          { speaker: M, text: '"Now they know."' },
        ],
        endTitle: "REMEMBER US",
        endMessage: "Five names Arasaka tried to bury are now on every screen in Night City. Some things can't be deleted twice.",
      },
    },
    endReference:
      "Reference: this is an original story written in the spirit of Cyberpunk: Edgerunners — not the show's actual assets or dialogue. If the tone hit you, watch the real thing. Preem work, choom.",
  },
};

export const ACT_ORDER = [1, 2, 3, 4, 5, 6];

// Plays automatically the moment Lucy holds both the note and the key — the
// point where the apartment's lighting turns over to red and the hidden
// writing by the window becomes readable.
export const ACT1_ALARM_LINES = [
  { speaker: NARR, text: "The apartment's lights stutter, drop out — and come back wrong." },
  { speaker: NARR, text: "Warm white bleeds down into a deep arterial red. The room looks like the inside of something." },
  { speaker: L, text: '"That\'s not my grid."' },
  { speaker: NARR, text: "In the red, the wall by the window stops being blank. There's writing on it." },
];

export class StoryManager {
  constructor(onChange) {
    this.act = 1;
    this.done = new Set();
    this.onChange = onChange || (() => {});
    this.chosenEnding = null;
  }

  get current() {
    return ACTS[this.act];
  }

  beat(id) {
    return this.current.beats.find((b) => b.id === id);
  }

  isObjectiveDone(id) {
    return this.done.has(id);
  }

  /**
   * A beat with `requires` stays inert until every prerequisite objective is
   * done — this is what turns a room full of independently readable props
   * into an ordered sequence.
   */
  isBeatUnlocked(beat) {
    if (!beat?.requires) return true;
    return beat.requires.every((id) => this.done.has(id));
  }

  /** First unmet prerequisite, so a locked beat can explain *what* is missing. */
  missingRequirement(beat) {
    if (!beat?.requires) return null;
    return beat.requires.find((id) => !this.done.has(id)) || null;
  }

  complete(id) {
    if (this.done.has(id)) return false;
    if (!this.beat(id)) return false;
    this.done.add(id);
    this.onChange({ type: "objective", key: id });
    return true;
  }

  isActComplete() {
    return this.current.beats.every((b) => this.done.has(b.id));
  }

  isFinalAct() {
    return this.act === ACT_ORDER[ACT_ORDER.length - 1];
  }

  advance() {
    this.done.clear();
    this.act += 1;
  }

  chooseEnding(key) {
    if (!this.current.endings?.[key]) return null;
    this.chosenEnding = key;
    return this.current.endings[key];
  }

  objectiveSummary() {
    const visible = this.current.beats.filter(
      (b) =>
        b.trigger !== "proximity" &&
        b.prompt &&
        // Beats tied to something that isn't in the room yet stay off the list
        // until they exist — listing them would spoil their reveal.
        !(b.hiddenUntilUnlocked && !this.isBeatUnlocked(b))
    );
    return visible
      .map((b) => {
        if (this.done.has(b.id)) return `✓ ${b.prompt}`;
        return this.isBeatUnlocked(b) ? `○ ${b.prompt}` : `⊘ ${b.prompt}`;
      })
      .join("\n");
  }
}
