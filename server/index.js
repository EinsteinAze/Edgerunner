import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { nanoid } from "nanoid";

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true, players: players.size }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

/** @type {Map<string, {id:string,name:string,hair:string,jacket:string,x:number,y:number,z:number,ry:number,anim:string,act:number}>} */
const players = new Map();

function sanitizeName(raw) {
  const cleaned = String(raw ?? "")
    .replace(/[^\w \-]/g, "")
    .trim()
    .slice(0, 16);
  return cleaned.length ? cleaned : `Runner${nanoid(4)}`;
}

io.on("connection", (socket) => {
  socket.on("join", (payload, ack) => {
    const player = {
      id: socket.id,
      name: sanitizeName(payload?.name),
      hair: /^#[0-9a-fA-F]{6}$/.test(payload?.hair) ? payload.hair : "#ff2fd0",
      jacket: /^#[0-9a-fA-F]{6}$/.test(payload?.jacket) ? payload.jacket : "#18e0e0",
      x: 0,
      y: 0,
      z: 0,
      ry: 0,
      anim: "idle",
      act: 1,
    };
    players.set(socket.id, player);
    socket.join("nightcity");

    ack?.({ id: socket.id, players: Array.from(players.values()) });
    socket.to("nightcity").emit("player:joined", player);
  });

  socket.on("state", (state) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.x = Number(state?.x) || 0;
    player.y = Number(state?.y) || 0;
    player.z = Number(state?.z) || 0;
    player.ry = Number(state?.ry) || 0;
    player.anim = typeof state?.anim === "string" ? state.anim.slice(0, 20) : "idle";
    socket.to("nightcity").emit("player:state", {
      id: socket.id,
      x: player.x,
      y: player.y,
      z: player.z,
      ry: player.ry,
      anim: player.anim,
    });
  });

  socket.on("act", (act) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.act = Number(act) || 1;
    socket.to("nightcity").emit("player:act", { id: socket.id, act: player.act });
  });

  socket.on("chat", (text) => {
    const player = players.get(socket.id);
    if (!player) return;
    const clean = String(text ?? "").slice(0, 140);
    if (!clean.trim()) return;
    io.to("nightcity").emit("chat", { id: socket.id, name: player.name, text: clean });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    socket.to("nightcity").emit("player:left", { id: socket.id });
  });
});

httpServer.listen(PORT, () => {
  console.log(`[edgerunner-server] listening on :${PORT}`);
});
