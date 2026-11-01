// Spellenkast: groot scherm = spel, telefoon = controller.
// Draait mee op dezelfde server/poort als de pubquiz (socket.io namespace "/arcade").
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCADE_DIR = path.join(__dirname, "..", "arcade");
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899", "#14b8a6"];
const MAX_PLAYERS = 8;
const FORGET_AFTER_MS = 15 * 60 * 1000;

const clean = (value, max) =>
  String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
};

export function setupArcade(app, io) {
  app.get("/arcade", (_req, res) => res.sendFile(path.join(ARCADE_DIR, "screen.html")));
  app.get(["/spel", "/spel/"], (_req, res) => res.sendFile(path.join(ARCADE_DIR, "pad.html")));
  app.use("/arcade", express.static(ARCADE_DIR));

  const nsp = io.of("/arcade");
  let players = []; // {id, token, name, emoji, color, connected, sid, leftAt}
  let seq = 0;
  const layouts = new Map();
  let defaultLayout = { type: "wait", text: "Kijk naar het grote scherm!" };
  let activeScreen = null; // maar één tv-scherm tegelijk bestuurt het spel
  let scores = {};
  const isActive = (socket) => socket.data.screen && socket.id === activeScreen;

  const pub = () => players.map(({ id, name, emoji, color, connected }) => ({ id, name, emoji, color, connected }));
  const sendPlayers = () => nsp.to("screens").emit("players", pub());

  setInterval(() => {
    const now = Date.now();
    const before = players.length;
    players = players.filter((p) => p.connected || now - p.leftAt < FORGET_AFTER_MS);
    if (players.length !== before) sendPlayers();
  }, 30000).unref();

  nsp.on("connection", (socket) => {
    socket.on("screen:hello", () => {
      socket.data.screen = true;
      socket.join("screens");
      if (activeScreen && activeScreen !== socket.id) nsp.to(activeScreen).emit("screen:inactive");
      activeScreen = socket.id;
      socket.emit("players", pub());
      socket.emit("scores", scores);
    });

    socket.on("screen:scores", (data) => {
      if (!isActive(socket) || !data || typeof data !== "object") return;
      scores = {};
      for (const [k, v] of Object.entries(data)) if (/^p\d+$/.test(k) && Number.isFinite(v)) scores[k] = v;
    });

    socket.on("pad:join", (data, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      const token = clean(data?.token, 40);
      if (!token) return reply({ ok: false, error: "Ongeldige aanmelding." });
      let p = players.find((x) => x.token === token);
      if (!p) {
        if (players.length >= MAX_PLAYERS) {
          const idle = players.find((x) => !x.connected);
          if (!idle) return reply({ ok: false, error: `Vol! Er kunnen maximaal ${MAX_PLAYERS} spelers meedoen.` });
          players = players.filter((x) => x !== idle);
        }
        const used = new Set(players.map((x) => x.color));
        p = { id: `p${++seq}`, token, color: COLORS.find((c) => !used.has(c)) || COLORS[seq % COLORS.length] };
        players.push(p);
      }
      p.name = clean(data?.name, 12) || "Speler";
      p.emoji = clean(data?.emoji, 8) || "🙂";
      p.connected = true;
      p.sid = socket.id;
      socket.data.pid = p.id;
      socket.join("pads");
      socket.join(`p:${p.id}`);
      reply({ ok: true, id: p.id, color: p.color });
      socket.emit("layout", layouts.get(p.id) || defaultLayout);
      sendPlayers();
    });

    socket.on("in", (m) => {
      const pid = socket.data.pid;
      if (!pid || !m) return;
      if (activeScreen) nsp.to(activeScreen).emit("in", { p: pid, k: clean(m.k, 16), v: Number(m.v) || 0, x: num(m.x), y: num(m.y) });
    });

    socket.on("pad:data", (m) => {
      const pid = socket.data.pid;
      if (!pid || !m || !activeScreen) return;
      const img = typeof m.img === "string" && m.img.startsWith("data:image/") && m.img.length < 900000 ? m.img : null;
      if (!img) return;
      nsp.to(activeScreen).emit("data", { p: pid, kind: clean(m.kind, 16), round: clean(m.round, 40), img });
    });

    socket.on("screen:layout", (msg) => {
      if (!isActive(socket) || !msg) return;
      if (msg.to === "all") {
        defaultLayout = msg.layout;
        layouts.clear();
        nsp.to("pads").emit("layout", msg.layout);
      } else {
        layouts.set(msg.to, msg.layout);
        nsp.to(`p:${msg.to}`).emit("layout", msg.layout);
      }
    });

    socket.on("screen:buzz", (msg) => {
      if (isActive(socket) && msg?.to) nsp.to(`p:${msg.to}`).emit("buzz", Math.min(400, Number(msg.ms) || 60));
    });

    socket.on("screen:reset", () => {
      if (!isActive(socket)) return;
      players = players.filter((p) => p.connected);
      sendPlayers();
    });

    socket.on("disconnect", () => {
      if (socket.id === activeScreen) {
        // ander tv-venster nog open? Dan neemt dat het automatisch over.
        activeScreen = null;
        const others = [...(nsp.adapter.rooms.get("screens") || [])].filter((id) => id !== socket.id);
        if (others.length) { activeScreen = others[others.length - 1]; nsp.to(activeScreen).emit("screen:active"); }
      }
      const p = players.find((x) => x.id === socket.data.pid);
      if (p && p.sid === socket.id) {
        p.connected = false;
        p.leftAt = Date.now();
        sendPlayers();
      }
    });
  });
}
