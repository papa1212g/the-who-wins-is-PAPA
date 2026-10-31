const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
  pingInterval: 25000,
  pingTimeout: 20000
});

app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WIDTH = 960;
const FLOOR = 408;

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => ROOM_CHARS[crypto.randomInt(ROOM_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function makeFighter(id, slot) {
  return {
    id, slot, x: slot === 1 ? 220 : 740, y: FLOOR, vy: 0,
    hp: 100, wins: 0, face: slot === 1 ? 1 : -1,
    blocking: false, stun: 0, cooldown: 0,
    attack: null, attackTimer: 0, hitThisAttack: false,
    input: { left: false, right: false, jump: false, block: false, punch: false, kick: false, special: false },
    previous: { jump: false, punch: false, kick: false, special: false }
  };
}

function publicState(room) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    fighters: room.players.map(p => p ? ({
      id: p.id, slot: p.slot, x: p.x, y: p.y, hp: p.hp, wins: p.wins,
      face: p.face, blocking: p.blocking, attack: p.attack,
      attackTimer: p.attackTimer, stun: p.stun
    }) : null)
  };
}

function emitRoom(room, event = "gameState") {
  io.to(room.code).emit(event, publicState(room));
}

function startIfReady(room) {
  if (room.players[0] && room.players[1]) {
    room.status = "playing";
    room.round = Math.max(1, room.round || 1);
    emitRoom(room, "gameStarted");
    emitRoom(room);
  } else {
    room.status = "waiting";
    emitRoom(room);
  }
}

function resetRound(room) {
  for (let i = 0; i < 2; i++) {
    const old = room.players[i];
    if (!old) continue;
    const fresh = makeFighter(old.id, i + 1);
    fresh.wins = old.wins;
    room.players[i] = fresh;
  }
  room.status = room.players.every(Boolean) ? "playing" : "waiting";
  room.round += 1;
  emitRoom(room, "roundReset");
}

function updateRoom(room) {
  if (room.status !== "playing" || !room.players.every(Boolean)) return;
  const [a, b] = room.players;
  for (const f of [a, b]) {
    const inp = f.input;
    f.face = (f.slot === 1 ? b.x > f.x : a.x > f.x) ? 1 : -1;
    if (f.cooldown > 0) f.cooldown--;
    if (f.stun > 0) f.stun--;
    if (f.attackTimer > 0) {
      f.attackTimer--;
      if (f.attackTimer === 0) { f.attack = null; f.hitThisAttack = false; }
    }
    f.blocking = !!inp.block && f.y >= FLOOR;
    if (f.stun === 0) {
      if (!f.blocking) {
        if (inp.left) f.x -= 4.2;
        if (inp.right) f.x += 4.2;
      }
      if (inp.jump && !f.previous.jump && f.y >= FLOOR) f.vy = -13;
      const chosen = inp.special && !f.previous.special ? "special"
        : inp.kick && !f.previous.kick ? "kick"
        : inp.punch && !f.previous.punch ? "punch" : null;
      if (chosen && f.cooldown === 0 && !f.attack) {
        f.attack = chosen;
        f.attackTimer = chosen === "special" ? 24 : chosen === "kick" ? 18 : 13;
        f.cooldown = chosen === "special" ? 65 : chosen === "kick" ? 38 : 25;
        f.hitThisAttack = false;
      }
    }
    f.previous = { jump: !!inp.jump, punch: !!inp.punch, kick: !!inp.kick, special: !!inp.special };
    f.vy += 0.65;
    f.y += f.vy;
    if (f.y > FLOOR) { f.y = FLOOR; f.vy = 0; }
    f.x = Math.max(12, Math.min(WIDTH - 66, f.x));
  }

  // Resolve one hit per attack. The server owns positions and health.
  for (const [att, def] of [[a, b], [b, a]]) {
    if (!att.attack || att.hitThisAttack) continue;
    const activeAt = att.attack === "special" ? 16 : att.attack === "kick" ? 12 : 8;
    if (att.attackTimer !== activeAt) continue;
    const range = att.attack === "special" ? 145 : att.attack === "kick" ? 105 : 85;
    const distance = Math.abs((att.x + 27) - (def.x + 27));
    if (distance < range && Math.abs(att.y - def.y) < 55) {
      const damage = def.blocking ? (att.attack === "special" ? 5 : 2)
        : (att.attack === "special" ? 19 : att.attack === "kick" ? 12 : 8);
      def.hp = Math.max(0, def.hp - damage);
      if (!def.blocking) {
        def.stun = 11;
        def.x = Math.max(12, Math.min(WIDTH - 66, def.x + att.face * 18));
      } else def.stun = 4;
      att.hitThisAttack = true;
      io.to(room.code).emit("hitEffect", { x: def.x + 27, y: def.y - 55, blocked: def.blocking });
    }
  }

  const defeated = room.players.find(p => p.hp <= 0);
  if (defeated) {
    const winner = defeated.slot === 1 ? b : a;
    winner.wins++;
    room.status = "roundOver";
    room.lastWinner = winner.slot;
    emitRoom(room, "roundOver");
  } else {
    emitRoom(room);
  }
}

io.on("connection", socket => {
  socket.on("createRoom", (_data, callback) => {
    const code = makeCode();
    const room = { code, players: [makeFighter(socket.id, 1), null], status: "waiting", round: 1, lastWinner: null };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.slot = 1;
    if (typeof callback === "function") callback({ ok: true, code, slot: 1 });
    emitRoom(room);
  });

  socket.on("joinRoom", (rawCode, callback) => {
    const code = String(rawCode || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    const room = rooms.get(code);
    if (!room) return typeof callback === "function" && callback({ ok: false, error: "Room not found. Check the code and try again." });
    if (room.players[1] || room.status === "playing" || room.status === "roundOver")
      return typeof callback === "function" && callback({ ok: false, error: "That room is full or already playing." });
    room.players[1] = makeFighter(socket.id, 2);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.slot = 2;
    if (typeof callback === "function") callback({ ok: true, code, slot: 2 });
    startIfReady(room);
  });

  socket.on("input", input => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;
    const f = room.players[socket.data.slot - 1];
    if (!f || f.id !== socket.id) return;
    const allowed = ["left", "right", "jump", "block", "punch", "kick", "special"];
    for (const key of allowed) f.input[key] = !!(input && input[key]);
  });

  socket.on("rematch", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "roundOver" || !room.players.every(Boolean)) return;
    if (room.players.some(p => p.wins >= 2)) {
      room.players.forEach(p => { p.wins = 0; });
      room.round = 0;
    }
    resetRound(room);
  });

  socket.on("leaveRoom", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.data.roomCode = null;
  if (!room) return;
  const slot = (socket.data.slot || 1) - 1;
  if (room.players[slot] && room.players[slot].id === socket.id) room.players[slot] = null;
  socket.leave(code);
  if (!room.players[0] && !room.players[1]) {
    clearInterval(room.timer);
    rooms.delete(code);
  } else {
    room.status = "waiting";
    emitRoom(room, "opponentLeft");
    emitRoom(room);
  }
}

setInterval(() => {
  for (const room of rooms.values()) updateRoom(room);
}, 1000 / 30);

server.listen(PORT, () => console.log(`NEON CLASH ONLINE listening on port ${PORT}`));
