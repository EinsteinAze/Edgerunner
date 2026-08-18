import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export class Network {
  constructor() {
    this.socket = null;
    this.id = null;
    this.handlers = {};
  }

  connect() {
    this.socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    for (const [event, fns] of Object.entries(this.handlers)) {
      for (const fn of fns) this.socket.on(event, fn);
    }
    return new Promise((resolve) => {
      this.socket.on("connect", () => resolve());
      this.socket.on("connect_error", () => resolve());
    });
  }

  on(event, fn) {
    (this.handlers[event] ??= []).push(fn);
    this.socket?.on(event, fn);
  }

  join({ name, hair, jacket }) {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ id: null, players: [] });
      this.socket.emit("join", { name, hair, jacket }, (res) => {
        this.id = res.id;
        resolve(res);
      });
    });
  }

  sendState(state) {
    if (this.socket?.connected) this.socket.emit("state", state);
  }

  sendAct(act) {
    if (this.socket?.connected) this.socket.emit("act", act);
  }

  sendChat(text) {
    if (this.socket?.connected) this.socket.emit("chat", text);
  }

  get connected() {
    return !!this.socket?.connected;
  }
}
