import { Game } from "./game/Game.js";
import { Network } from "./net/Network.js";
import { codeFromEvent } from "./game/Input.js";
import { preloadCharacterAsset } from "./game/CharacterLoader.js";

// Kick off the (optional) character.glb fetch as early as possible so it has
// a head start — by the time the player clicks through login/menu to Play,
// it's very likely already resolved and the GLB (if present) becomes the
// primary character with no pop-in swap. Never blocks the UI either way.
preloadCharacterAsset();

const HAIR_COLORS = ["#ff2fd0", "#18e0e0", "#f6e94a", "#7a2fff", "#ff5c3d"];
const JACKET_COLORS = ["#18e0e0", "#ff2fd0", "#3a3f52", "#f6e94a", "#ff5c3d"];

const el = (id) => document.getElementById(id);
const screens = {
  login: el("screen-login"),
  menu: el("screen-menu"),
  controls: el("screen-controls"),
  credits: el("screen-credits"),
  pause: el("screen-pause"),
  act: el("screen-act"),
  loading: el("loading"),
};

function show(name) {
  for (const s of Object.values(screens)) s.classList.add("hidden");
  screens[name].classList.remove("hidden");
}
function hide(name) {
  screens[name].classList.add("hidden");
}

let cosmetics = { name: "RUNNER", hair: HAIR_COLORS[0], jacket: JACKET_COLORS[0] };

function buildSwatches(containerId, colors, onPick) {
  const container = el(containerId);
  colors.forEach((c, i) => {
    const sw = document.createElement("div");
    sw.className = "swatch" + (i === 0 ? " selected" : "");
    sw.style.background = c;
    sw.style.color = c;
    sw.addEventListener("click", () => {
      container.querySelectorAll(".swatch").forEach((n) => n.classList.remove("selected"));
      sw.classList.add("selected");
      onPick(c);
    });
    container.appendChild(sw);
  });
}
buildSwatches("swatch-hair", HAIR_COLORS, (c) => (cosmetics.hair = c));
buildSwatches("swatch-jacket", JACKET_COLORS, (c) => (cosmetics.jacket = c));

window.addEventListener("DOMContentLoaded", () => {
  hide("loading");
  show("login");
});

const network = new Network();
let game = null;
let hudVisible = false;
let chatEntries = 0;

el("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nameInput = el("input-name").value.trim();
  cosmetics.name = nameInput || "RUNNER";
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.textContent = "CONNECTING…";
  submitBtn.disabled = true;
  await network.connect();
  el("menu-welcome").textContent = `Welcome, ${cosmetics.name}. Night City is waiting.`;
  updatePlayersOnline();
  submitBtn.textContent = "JACK IN";
  submitBtn.disabled = false;
  show("menu");
});

function updatePlayersOnline() {
  el("players-online").textContent = network.connected
    ? "connected to Night City relay"
    : "offline — playing solo (server not reachable)";
}

el("btn-controls").addEventListener("click", () => show("controls"));
el("btn-controls-back").addEventListener("click", () => show("menu"));
el("btn-credits").addEventListener("click", () => show("credits"));
el("btn-credits-back").addEventListener("click", () => show("menu"));

el("btn-play").addEventListener("click", async () => {
  for (const s of Object.values(screens)) s.classList.add("hidden");
  const { players } = await network.join(cosmetics);
  startGame(players);
});

function startGame(existingPlayers = []) {
  const canvas = el("scene");
  game = new Game(canvas, {
    onPrompt: (text) => {
      const promptEl = el("hud-prompt");
      if (text) {
        promptEl.classList.remove("hidden");
        el("hud-prompt-text").textContent = text;
      } else {
        promptEl.classList.add("hidden");
      }
    },
    onActBadge: (text) => (el("hud-act").textContent = text),
    onLocation: (text) => (el("hud-location").textContent = text),
    onObjectives: (text) => (el("hud-objective").textContent = text),
    onRoster: (count) => (el("hud-roster").textContent = count > 0 ? `${count} other runner${count > 1 ? "s" : ""} nearby` : "solo run"),
    onChat: (entry) => appendChat(entry.name, entry.text),
    onActComplete: (act, isFinal) => showActScreen(act, isFinal),
    onDialogueLine: (line, isLast) => showDialogueLine(line, isLast),
    onError: (text) => showToast(text),
  });
  game.init(cosmetics, network, existingPlayers);
  hudVisible = true;
  el("hud").classList.remove("hidden");
  game.start();
}

let toastTimer = null;
function showToast(text) {
  const box = el("hud-toast");
  if (!text) {
    box.classList.add("hidden");
    return;
  }
  box.textContent = text;
  box.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add("hidden"), 2600);
}

function showDialogueLine(line, isLast) {
  const box = el("hud-dialogue");
  if (!line) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  el("dialogue-speaker").textContent = line.speaker || "";
  el("dialogue-text").textContent = line.text;
  el("dialogue-hint").textContent = isLast ? "[E] Close" : "[E] Continue";
}

function appendChat(name, text) {
  const log = el("chat-log");
  const line = document.createElement("div");
  line.className = "line";
  line.innerHTML = `<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
  log.appendChild(line);
  chatEntries += 1;
  while (log.children.length > 6) log.removeChild(log.firstChild);
  setTimeout(() => line.remove(), 12000);
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showActScreen(act, isFinal) {
  el("act-eyebrow").textContent = isFinal ? "STORY COMPLETE" : `ACT ${act.key} COMPLETE`;
  el("act-title").textContent = act.endTitle;
  el("act-message").textContent = act.endMessage;
  el("act-reference").textContent = act.endReference;
  el("btn-act-continue").textContent = isFinal ? "RETURN TO MENU" : "CONTINUE";
  screens.act.classList.remove("hidden");
}

el("btn-act-continue").addEventListener("click", () => {
  const isFinal = el("btn-act-continue").textContent.includes("MENU");
  screens.act.classList.add("hidden");
  if (isFinal) {
    location.reload();
    return;
  }
  game.continueToNextAct();
});

// Pause (Escape) handling
window.addEventListener("keydown", (e) => {
  if (codeFromEvent(e) !== "Escape" || !hudVisible) return;
  const chatOpen = !el("chat-form").classList.contains("hidden");
  if (chatOpen) {
    closeChat();
    return;
  }
  if (!screens.act.classList.contains("hidden")) return;
  const isPaused = !screens.pause.classList.contains("hidden");
  if (isPaused) {
    resumeGame();
  } else {
    game?.setPaused(true);
    screens.pause.classList.remove("hidden");
  }
});

function resumeGame() {
  screens.pause.classList.add("hidden");
  game?.setPaused(false);
}
el("btn-resume").addEventListener("click", resumeGame);
el("btn-quit").addEventListener("click", () => location.reload());

// Chat (Enter to open/send)
const chatForm = el("chat-form");
const chatInput = el("chat-input");
window.addEventListener("keydown", (e) => {
  if (codeFromEvent(e) !== "Enter" || !hudVisible) return;
  if (!screens.pause.classList.contains("hidden")) return;
  if (!screens.act.classList.contains("hidden")) return;
  const chatOpen = !chatForm.classList.contains("hidden");
  if (!chatOpen) {
    openChat();
  }
});
function openChat() {
  chatForm.classList.remove("hidden");
  chatForm.style.pointerEvents = "auto";
  chatInput.focus();
  if (game) game.input.setChatActive(true);
}
function closeChat() {
  chatForm.classList.add("hidden");
  chatInput.value = "";
  chatInput.blur();
  if (game) game.input.setChatActive(false);
}
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) network.sendChat(text);
  closeChat();
});
