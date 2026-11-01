/* Spellenkast – motor voor het grote scherm.
   Spellen registreren zich met ARCADE.register({...}) en krijgen een API mee. */
(() => {
  const W = 1600, H = 900;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const POINTS = [5, 3, 2];

  const A = (window.ARCADE = { W, H, games: [], register(def) { this.games.push(def); } });

  // ---------- canvas ----------
  const cv = document.getElementById("c");
  const g = cv.getContext("2d");
  let scale = 1, cssScale = 1;
  function resize() {
    cssScale = Math.min(innerWidth / W, innerHeight / H);
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.width = W * cssScale + "px";
    cv.style.height = H * cssScale + "px";
    cv.width = Math.round(W * cssScale * dpr);
    cv.height = Math.round(H * cssScale * dpr);
    scale = cv.width / W;
  }
  addEventListener("resize", resize);
  resize();

  // ---------- helpers ----------
  A.rand = (a, b) => a + Math.random() * (b - a);
  A.irand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  A.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  A.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  A.lerp = (a, b, t) => a + (b - a) * t;
  A.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  A.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  A.font = (size, weight = 800) => `${weight} ${size}px ${FONT}`;
  A.txt = (gg, s, x, y, o = {}) => {
    gg.save();
    gg.font = A.font(o.size || 32, o.weight || 800);
    gg.textAlign = o.align || "left";
    gg.textBaseline = o.base || "alphabetic";
    if (o.alpha !== undefined) gg.globalAlpha *= o.alpha;
    if (o.stroke) { gg.lineJoin = "round"; gg.lineWidth = o.strokeW || 6; gg.strokeStyle = o.stroke; gg.strokeText(s, x, y); }
    if (o.shadow) { gg.shadowColor = o.shadow; gg.shadowBlur = o.blur || 12; }
    gg.fillStyle = o.color || "#fff";
    gg.fillText(s, x, y);
    gg.restore();
  };
  A.emoji = (gg, e, x, y, size) => {
    gg.save(); gg.font = `${size}px ${EMOJI_FONT}`; gg.textAlign = "center"; gg.textBaseline = "middle"; gg.fillStyle = "#000";
    gg.fillText(e, x, y + size * 0.06); gg.restore();
  };
  A.rr = (gg, x, y, w, h, r) => { gg.beginPath(); gg.roundRect ? gg.roundRect(x, y, w, h, r) : gg.rect(x, y, w, h); };
  A.avatar = (gg, p, x, y, r, o = {}) => {
    gg.save();
    if (o.alpha !== undefined) gg.globalAlpha *= o.alpha;
    gg.translate(x, y);
    if (o.angle) gg.rotate(o.angle);
    if (o.glow) { gg.shadowColor = o.glow; gg.shadowBlur = 25; }
    gg.beginPath(); gg.arc(0, 0, r, 0, Math.PI * 2);
    gg.fillStyle = p.color; gg.fill();
    gg.shadowBlur = 0;
    gg.lineWidth = Math.max(2, r * 0.14); gg.strokeStyle = o.ring || "rgba(255,255,255,.9)"; gg.stroke();
    A.emoji(gg, p.emoji, 0, 0, r * 1.2);
    gg.restore();
  };
  A.label = (gg, p, x, y, size = 18) => A.txt(gg, p.name, x, y, { size, align: "center", color: "#fff", stroke: "rgba(0,0,0,.7)", strokeW: 5 });
  A.hearts = (gg, x, y, n, max, size = 18) => {
    for (let i = 0; i < max; i++) A.txt(gg, i < n ? "♥" : "♡", x + (i - (max - 1) / 2) * size * 1.05, y, { size, align: "center", color: i < n ? "#f43f5e" : "rgba(255,255,255,.4)", stroke: "rgba(0,0,0,.6)", strokeW: 4 });
  };
  A.pill = (gg, s, x, y, o = {}) => {
    gg.save(); gg.font = A.font(o.size || 26, 800);
    const w = gg.measureText(s).width + 36, h = (o.size || 26) + 20;
    A.rr(gg, x - w / 2, y - h / 2, w, h, h / 2); gg.fillStyle = o.bg || "rgba(0,0,0,.55)"; gg.fill();
    gg.restore();
    A.txt(gg, s, x, y + 1, { size: o.size || 26, align: "center", base: "middle", color: o.color || "#fff" });
  };
  A.timer = (gg, secs) => A.pill(gg, `⏱ ${Math.max(0, Math.ceil(secs))}`, W / 2, 34, { size: 26 });
  // ranking: entries [{id, key:[...]}] – hoger is beter, gelijke keys = gedeelde plek
  A.rankGroups = (entries) => {
    const sorted = entries.slice().sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (b.key[i] !== a.key[i]) return b.key[i] - a.key[i]; return 0; });
    const groups = [];
    for (const e of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.key.every((k, i) => k === e.key[i])) last.ids.push(e.id); else groups.push({ key: e.key, ids: [e.id] });
    }
    return groups.map((gr) => gr.ids);
  };

  // ---------- particles & shake ----------
  const parts = [];
  let shakeAmt = 0;
  A.burst = (x, y, color, n = 16, speed = 320, life = 0.7, size = 6) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color: Array.isArray(color) ? A.pick(color) : color, size: size * (0.6 + Math.random() * 0.8) });
    }
  };
  A.confetti = (n = 120) => {
    const cols = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899", "#f97316"];
    for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * 200, vx: A.rand(-60, 60), vy: A.rand(150, 380), life: 3.5, max: 3.5, color: A.pick(cols), size: A.rand(6, 12), conf: true, rot: Math.random() * 6 });
  };
  A.shake = (amt) => { shakeAmt = Math.max(shakeAmt, amt); };
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.conf) { p.rot += dt * 6; p.vx += Math.sin(p.rot) * 20 * dt; } else { p.vx *= 1 - 2.5 * dt; p.vy = p.vy * (1 - 2.5 * dt) + 300 * dt; }
    }
  }
  function drawParts() {
    for (const p of parts) {
      g.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      g.fillStyle = p.color;
      if (p.conf) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, p.size * (p.life / p.max), 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  }

  // ---------- audio (zelfgemaakte bliepjes) ----------
  let ac = null;
  const lastSfx = {};
  function audio() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) {}
  }
  addEventListener("pointerdown", audio);
  addEventListener("keydown", audio);
  function tone(f, dur, type = "square", vol = 0.12, slide = 0, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), v = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(v).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, freq = 800) {
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain();
    s.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; v.gain.value = vol;
    s.connect(f).connect(v).connect(ac.destination); s.start();
  }
  const SFX = {
    blip: () => tone(880, 0.07, "square", 0.06),
    flap: () => tone(420, 0.09, "triangle", 0.12, 760),
    shoot: () => tone(900, 0.12, "square", 0.05, 220),
    coin: () => { tone(988, 0.07, "square", 0.06); tone(1319, 0.12, "square", 0.06, 0, 0.07); },
    hit: () => { noise(0.18, 0.3, 1200); tone(160, 0.15, "sawtooth", 0.08, 60); },
    boom: () => { noise(0.5, 0.45, 500); tone(90, 0.4, "sawtooth", 0.1, 30); },
    bad: () => tone(150, 0.25, "sawtooth", 0.08, 90),
    good: () => { tone(660, 0.08, "triangle", 0.12); tone(990, 0.14, "triangle", 0.12, 0, 0.08); },
    tick: () => tone(660, 0.1, "sine", 0.18),
    go: () => tone(1320, 0.3, "sine", 0.2),
    drop: () => tone(500, 0.18, "triangle", 0.12, 160),
    jump: () => tone(300, 0.16, "square", 0.06, 700),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.14, 0, i * 0.12)),
  };
  A.sfx = (name) => {
    if (!ac || ac.state !== "running" || !SFX[name]) return;
    const now = performance.now(); if (now - (lastSfx[name] || 0) < 40) return; lastSfx[name] = now;
    try { SFX[name](); } catch (e) {}
  };

  // ---------- netwerk ----------
  const socket = io("/arcade", { transports: ["websocket", "polling"] });
  let players = []; // van server: [{id,name,emoji,color,connected}]
  const inputs = {};
  const padCache = {};
  const inp = (pid) => inputs[pid] || (inputs[pid] = { held: {}, hits: {}, sx: 0, sy: 0, order: [] });
  socket.on("connect", () => { socket.emit("screen:hello"); for (const k in padCache) delete padCache[k]; setTimeout(refreshPads, 300); });
  socket.on("players", (list) => {
    players = list;
    for (const p of list) if (!p.connected) { const s = inp(p.id); s.held = {}; s.order = []; s.sx = s.sy = 0; }
    for (const p of list) { const r = roster.find((x) => x.id === p.id); if (r) Object.assign(r, p); }
    refreshPads();
  });
  socket.on("in", (m) => {
    const s = inp(m.p), k = m.k;
    if (k === "stick") { s.sx = m.x; s.sy = m.y; return; }
    if (k.startsWith("pick:")) { if (m.v) onPick(m.p, k.slice(5)); return; }
    if (k === "quit") { if (m.v) onQuit(m.p); return; }
    if (k === "next") { if (m.v) onNext(m.p); return; }
    if (m.v) {
      if (!s.held[k]) s.hits[k] = Math.min(3, (s.hits[k] || 0) + 1);
      s.held[k] = true;
      if (k.length === 1 && "UDLR".includes(k)) { s.order = s.order.filter((d) => d !== k); s.order.push(k); }
    } else {
      s.held[k] = false;
      s.order = s.order.filter((d) => d !== k);
    }
  });
  A.held = (pid, k) => !!inp(pid).held[k];
  A.hit = (pid, k) => { const s = inp(pid); if (s.hits[k] > 0) { s.hits[k]--; return true; } return false; };
  A.stick = (pid) => { const s = inp(pid); return { x: s.sx, y: s.sy }; };
  A.dir = (pid) => { const o = inp(pid).order; return o.length ? o[o.length - 1] : null; };
  A.buzz = (pid, ms = 80) => socket.emit("screen:buzz", { to: pid, ms });
  function clearHits() { for (const k in inputs) inputs[k].hits = {}; }

  function sendPad(to, layout) {
    const l = Object.assign({}, layout);
    delete l.quit;
    if (to !== "all" && to === vipId() && (scene === "intro" || scene === "play")) l.quit = true;
    const json = JSON.stringify(l);
    if (padCache[to] === json) return;
    padCache[to] = json;
    if (to === "all") for (const k in padCache) if (k !== "all") delete padCache[k];
    socket.emit("screen:layout", { to, layout: l });
  }
  A.pad = (pid, layout) => sendPad(pid, layout);

  // ---------- spelverloop ----------
  let scene = "menu", sceneT = 0, sel = 0, current = null, inst = null, roster = [], result = null, toastMsg = null, toastT = 0;
  const scores = {};
  const online = () => players.filter((p) => p.connected);
  const vipId = () => (online()[0] || {}).id;
  A.toast = (m) => { toastMsg = m; toastT = 3.5; };

  function menuPadFor(p) {
    if (p.id === vipId()) {
      return { type: "menu", title: "👑 Jij kiest het spel!", msg: `${scores[p.id] || 0} punten`,
        items: [{ id: "random", label: "Verras ons!", emoji: "🎲", sub: "Willekeurig spel" }].concat(
          A.games.map((d) => ({ id: d.id, label: d.name, emoji: d.emoji, sub: `${d.min > 1 ? d.min + "+ spelers · " : ""}${d.tagline}` }))) };
    }
    const vip = players.find((x) => x.id === vipId());
    return { type: "wait", emoji: "⏳", text: `${vip ? vip.name : "De baas"} kiest een spel…`, sub: `Jij hebt ${scores[p.id] || 0} punten`, msg: `${scores[p.id] || 0} punten` };
  }
  function refreshPads() {
    for (const p of players) {
      if (!p.connected) continue;
      const inGame = roster.some((r) => r.id === p.id);
      if (scene === "menu") sendPad(p.id, menuPadFor(p));
      else if (!inGame) sendPad(p.id, { type: "wait", emoji: "🍿", text: "Even wachten…", sub: "Bij het volgende spel doe je mee!" });
      else if (scene === "intro" || scene === "play") {
        sendPad(p.id, padCache[p.id] ? JSON.parse(padCache[p.id]) : Object.assign({ msg: current.name }, current.pad));
      } else if (scene === "result") sendPad(p.id, resultPadFor(p));
    }
  }

  function onPick(pid, id) {
    if (scene !== "menu" || pid !== vipId()) return;
    if (id === "random") {
      const n = online().length;
      const ok = A.games.filter((d) => n >= (d.min || 1));
      if (!ok.length) return A.toast("Te weinig spelers – haal er nog iemand bij!");
      return startGame(A.pick(ok).id);
    }
    startGame(id);
  }
  function onQuit(pid) { if (pid === vipId() && scene !== "menu") toMenu(); }
  function onNext(pid) { if (scene === "result" && pid === vipId() && sceneT > 1.5) toMenu(); }

  function startGame(id) {
    const def = A.games.find((d) => d.id === id);
    if (!def) return;
    const ps = online();
    if (ps.length < (def.min || 1)) return A.toast(`${def.emoji} ${def.name}: minimaal ${def.min} spelers nodig`);
    current = def; roster = ps.slice(0, def.max || 8).map((p) => Object.assign({}, p));
    scene = "intro"; sceneT = 0; inst = null; parts.length = 0;
    for (const k in padCache) delete padCache[k];
    for (const p of roster) sendPad(p.id, Object.assign({ msg: def.name }, def.pad));
    refreshPads();
    A.sfx("blip");
  }
  function beginPlay() {
    clearHits();
    try { inst = current.create(A, roster); } catch (e) { console.error(e); A.toast("Oeps, dit spel crashte"); return toMenu(); }
    scene = "play"; sceneT = 0;
  }
  function finishGame() {
    let ranking = (inst.ranking || []).map((grp) => grp.filter((id) => roster.some((r) => r.id === id))).filter((grp) => grp.length);
    const placed = new Set(ranking.flat());
    const rest = roster.filter((r) => !placed.has(r.id)).map((r) => r.id);
    if (rest.length) ranking.push(rest);
    let place = 1;
    const rows = [];
    for (const grp of ranking) {
      const pts = POINTS[place - 1] || 1;
      for (const id of grp) { scores[id] = (scores[id] || 0) + pts; rows.push({ id, place, pts, stat: inst.stat ? inst.stat(id) : "" }); }
      place += grp.length;
    }
    result = { rows, game: current };
    scene = "result"; sceneT = 0;
    A.confetti(); A.sfx("win");
    for (const k in padCache) delete padCache[k];
    refreshPads();
  }
  function resultPadFor(p) {
    const row = result && result.rows.find((r) => r.id === p.id);
    const medal = row ? (["🥇", "🥈", "🥉"][row.place - 1] || "🎖️") : "🍿";
    const l = { type: "wait", emoji: medal, text: row ? `Je werd ${row.place}e! +${row.pts} punten` : "Volgende keer doe je mee!", sub: `Totaal: ${scores[p.id] || 0} punten`, msg: `${scores[p.id] || 0} punten` };
    if (p.id === vipId()) l.button = { id: "next", label: "Verder ▶" };
    return l;
  }
  function toMenu() {
    scene = "menu"; sceneT = 0; inst = null; roster = []; current = null;
    for (const k in padCache) delete padCache[k];
    refreshPads();
  }

  // ---------- QR ----------
  const joinUrl = location.origin + "/spel";
  let qrCanvas = null;
  try {
    const div = document.createElement("div");
    new QRCode(div, { text: joinUrl, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
    qrCanvas = div.querySelector("canvas");
  } catch (e) { console.warn("QR niet beschikbaar", e); }

  // ---------- menu tekenen ----------
  const tiles = [];
  function layoutTiles() {
    tiles.length = 0;
    const x0 = 450, y0 = 150, cols = 5, gap = 18, w = (1550 - x0 - gap * (cols - 1)) / cols, h = 330;
    A.games.forEach((d, i) => tiles.push({ d, x: x0 + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (h + gap), w, h }));
  }
  let mouse = { x: -1, y: -1 };
  function drawBg(t, c1 = "#0b1020", c2 = "#1b1446") {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const x = (i * 263 + t * (12 + i * 3)) % (W + 200) - 100, y = (i * 137) % H + Math.sin(t * 0.6 + i) * 30;
      g.fillStyle = `hsla(${(i * 40 + t * 10) % 360},80%,60%,0.06)`;
      g.beginPath(); g.arc(x, y, 40 + (i % 5) * 25, 0, Math.PI * 2); g.fill();
    }
  }
  function drawTitle(t) {
    const word = "SPELLENKAST";
    let x = 60;
    g.font = A.font(64, 900);
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], y = 92 + Math.sin(t * 3 + i * 0.5) * 5;
      A.txt(g, ch, x, y, { size: 64, weight: 900, color: `hsl(${(i * 32 + t * 40) % 360},90%,62%)`, stroke: "#0b1020", strokeW: 8 });
      x += g.measureText(ch).width + 2;
    }
    A.emoji(g, "🕹️", x + 40, 70, 56);
  }
  function drawMenu(t) {
    drawBg(t);
    drawTitle(t);
    const vip = players.find((p) => p.id === vipId());
    A.txt(g, vip ? `👑 ${vip.name} kiest op de telefoon – of klik hier een spel aan` : "Scan de QR-code om mee te doen!", 1550, 92, { size: 24, align: "right", color: "#cbd5e1", weight: 700 });

    // QR kaart
    A.rr(g, 50, 140, 360, 400, 24); g.fillStyle = "#fff"; g.fill();
    if (qrCanvas) { g.imageSmoothingEnabled = false; g.drawImage(qrCanvas, 80, 162, 300, 300); g.imageSmoothingEnabled = true; }
    else A.txt(g, "QR laden…", 230, 310, { size: 26, align: "center", color: "#0b1020" });
    A.txt(g, "📱 Scan & doe mee!", 230, 500, { size: 28, align: "center", color: "#0b1020", weight: 900 });
    A.txt(g, joinUrl.replace(/^https?:\/\//, ""), 230, 528, { size: joinUrl.length > 45 ? 11 : 15, align: "center", color: "#475569", weight: 600 });

    // spelers
    A.txt(g, `Spelers (${online().length}/8)`, 50, 590, { size: 26, color: "#e2e8f0" });
    const sorted = players.slice();
    if (!sorted.length) A.txt(g, "Nog niemand… scan de code!", 50, 635, { size: 22, color: "#94a3b8", weight: 600 });
    sorted.forEach((p, i) => {
      const y = 630 + i * 33;
      A.avatar(g, p, 68, y, 14, { alpha: p.connected ? 1 : 0.35 });
      A.txt(g, (p.id === vipId() ? "👑 " : "") + p.name, 92, y + 8, { size: 22, color: p.connected ? "#fff" : "#64748b", weight: 700 });
      A.txt(g, `${scores[p.id] || 0}`, 400, y + 8, { size: 22, align: "right", color: "#facc15" });
    });

    // speltegels
    layoutTiles();
    const n = online().length;
    tiles.forEach((tl, i) => {
      const hover = mouse.x > tl.x && mouse.x < tl.x + tl.w && mouse.y > tl.y && mouse.y < tl.y + tl.h;
      const active = hover || i === sel;
      const lift = active ? -6 : 0;
      g.save(); g.translate(0, lift);
      A.rr(g, tl.x, tl.y, tl.w, tl.h, 22);
      const gr = g.createLinearGradient(tl.x, tl.y, tl.x, tl.y + tl.h);
      gr.addColorStop(0, tl.d.color || "#334155"); gr.addColorStop(1, "#111827");
      g.fillStyle = gr; g.fill();
      g.lineWidth = active ? 5 : 2; g.strokeStyle = active ? "#facc15" : "rgba(255,255,255,.15)"; g.stroke();
      A.emoji(g, tl.d.emoji, tl.x + tl.w / 2, tl.y + 95 + (active ? Math.sin(t * 6) * 4 : 0), 92);
      A.txt(g, tl.d.name, tl.x + tl.w / 2, tl.y + 200, { size: tl.d.name.length > 13 ? 22 : 26, align: "center", weight: 900 });
      wrap(tl.d.tagline, tl.x + tl.w / 2, tl.y + 236, tl.w - 26, 18, "#cbd5e1");
      const enough = n >= (tl.d.min || 1);
      A.txt(g, `👥 ${tl.d.min || 1}–${tl.d.max || 8}`, tl.x + tl.w / 2, tl.y + tl.h - 18, { size: 18, align: "center", color: enough ? "#86efac" : "#fca5a5", weight: 700 });
      g.restore();
    });
    if (!ac || ac.state !== "running") A.pill(g, "🔊 Klik ergens voor geluid", 1000, 870, { size: 20 });
    if (players.some((p) => !p.connected)) A.txt(g, "🧹 offline spelers weghalen", 50, 890, { size: 16, color: "#64748b", weight: 600 });
  }
  function wrap(text, x, y, maxW, size, color) {
    g.font = A.font(size, 600);
    const words = text.split(" "); let line = "", ly = y;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > maxW && line) { A.txt(g, line, x, ly, { size, weight: 600, align: "center", color }); line = w; ly += size * 1.3; }
      else line = test;
    }
    if (line) A.txt(g, line, x, ly, { size, weight: 600, align: "center", color });
  }

  function drawIntro(t) {
    drawBg(t, "#0b1020", current.color || "#1b1446");
    A.emoji(g, current.emoji, W / 2, 190, 150);
    A.txt(g, current.name, W / 2, 360, { size: 84, weight: 900, align: "center", stroke: "#0b1020", strokeW: 10 });
    A.txt(g, current.tagline, W / 2, 415, { size: 30, align: "center", color: "#e2e8f0", weight: 600 });
    current.howto.forEach((line, i) => A.txt(g, line, W / 2, 500 + i * 48, { size: 32, align: "center", color: "#fff", weight: 700 }));
    const left = 6 - sceneT;
    if (left <= 3) {
      const nTxt = left > 0 ? String(Math.ceil(left)) : "GO!";
      const f = 1 - (left % 1);
      A.txt(g, nTxt, W / 2, 850, { size: 110 + f * 30, align: "center", color: "#facc15", stroke: "#0b1020", strokeW: 12, weight: 900, alpha: 1 - f * 0.4 });
    } else A.txt(g, "Pak je telefoon erbij!", W / 2, 830, { size: 34, align: "center", color: "#facc15" });
    // spelers onderin
    roster.forEach((p, i) => {
      const x = W / 2 + (i - (roster.length - 1) / 2) * 110;
      A.avatar(g, p, x, 715 + Math.sin(t * 4 + i) * 6, 32);
    });
  }

  function drawResult(t) {
    drawBg(t, "#0b1020", result.game.color || "#1b1446");
    A.txt(g, `${result.game.emoji} ${result.game.name} – uitslag`, W / 2, 100, { size: 56, weight: 900, align: "center", stroke: "#0b1020", strokeW: 8 });
    const rows = result.rows;
    const rowH = Math.min(84, 640 / Math.max(1, rows.length));
    rows.forEach((r, i) => {
      const p = roster.find((x) => x.id === r.id) || players.find((x) => x.id === r.id);
      if (!p) return;
      const appear = A.clamp((sceneT - i * 0.15) * 3, 0, 1);
      const y = 170 + i * rowH, x = 300 + (1 - appear) * 120;
      g.globalAlpha = appear;
      A.rr(g, x, y, 1000, rowH - 10, 18); g.fillStyle = r.place === 1 ? "rgba(250,204,21,.25)" : "rgba(255,255,255,.08)"; g.fill();
      const medal = ["🥇", "🥈", "🥉"][r.place - 1];
      if (medal) A.emoji(g, medal, x + 45, y + (rowH - 10) / 2, rowH * 0.6); else A.txt(g, `${r.place}e`, x + 45, y + (rowH - 10) / 2, { size: 28, align: "center", base: "middle" });
      A.avatar(g, p, x + 120, y + (rowH - 10) / 2, (rowH - 10) * 0.38);
      A.txt(g, p.name, x + 170, y + (rowH - 10) / 2, { size: Math.min(34, rowH * 0.45), base: "middle" });
      if (r.stat) A.txt(g, r.stat, x + 620, y + (rowH - 10) / 2, { size: Math.min(26, rowH * 0.35), base: "middle", color: "#cbd5e1", weight: 600, align: "center" });
      A.txt(g, `+${r.pts}`, x + 970, y + (rowH - 10) / 2, { size: Math.min(36, rowH * 0.48), base: "middle", align: "right", color: "#facc15", weight: 900 });
      g.globalAlpha = 1;
    });
    const left = Math.ceil(12 - sceneT);
    A.txt(g, `Terug naar het menu over ${left}… (👑 kan doorklikken)`, W / 2, 870, { size: 22, align: "center", color: "#94a3b8", weight: 600 });
  }

  // ---------- invoer op het grote scherm ----------
  cv.addEventListener("mousemove", (e) => { const r = cv.getBoundingClientRect(); mouse = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; });
  cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (scene === "menu") {
      for (const tl of tiles) if (x > tl.x && x < tl.x + tl.w && y > tl.y && y < tl.y + tl.h) return startGame(tl.d.id);
      if (x < 300 && y > 870) socket.emit("screen:reset");
    } else if (scene === "result" && sceneT > 1.5) toMenu();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (scene !== "menu") toMenu(); return; }
    if (e.key === "f" || e.key === "F") toggleFs();
    if (scene !== "menu") return;
    const cols = 5;
    if (e.key === "ArrowRight") sel = (sel + 1) % A.games.length;
    if (e.key === "ArrowLeft") sel = (sel - 1 + A.games.length) % A.games.length;
    if (e.key === "ArrowDown") sel = Math.min(A.games.length - 1, sel + cols);
    if (e.key === "ArrowUp") sel = Math.max(0, sel - cols);
    if (e.key === "Enter") startGame(A.games[sel].id);
  });
  function toggleFs() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); }
  const fsBtn = document.getElementById("fs");
  if (fsBtn) fsBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleFs(); });
  document.addEventListener("fullscreenchange", () => { if (fsBtn) fsBtn.style.display = document.fullscreenElement ? "none" : ""; });

  // ---------- hoofdlus ----------
  let last = performance.now(), clock = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt; sceneT += dt;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    try {
      if (scene === "menu") drawMenu(clock);
      else if (scene === "intro") {
        const before = 6 - (sceneT - dt), after = 6 - sceneT;
        if (after <= 3 && Math.ceil(before) !== Math.ceil(after) && after > 0) A.sfx("tick");
        drawIntro(clock);
        if (sceneT >= 6) { A.sfx("go"); beginPlay(); }
      } else if (scene === "play" && inst) {
        inst.update(dt);
        stepParts(dt);
        g.save();
        if (shakeAmt > 0.5) { g.translate(A.rand(-shakeAmt, shakeAmt), A.rand(-shakeAmt, shakeAmt)); shakeAmt *= Math.pow(0.02, dt); } else shakeAmt = 0;
        inst.draw(g, clock);
        drawParts();
        g.restore();
        if (sceneT < 1) A.txt(g, "GO!", W / 2, H / 2, { size: 160, align: "center", base: "middle", color: "#facc15", stroke: "#0b1020", strokeW: 14, weight: 900, alpha: 1 - sceneT });
        if (inst.over) { inst.overT = (inst.overT || 0) + dt; if (inst.overT > 1.6) finishGame(); }
      } else if (scene === "result") {
        drawResult(clock); stepParts(dt); drawParts();
        if (sceneT > 12) toMenu();
      }
    } catch (err) {
      console.error(err);
      A.toast("Er ging iets mis – terug naar het menu");
      toMenu();
    }
    if (toastT > 0) { toastT -= dt; A.pill(g, toastMsg, W / 2, 820, { size: 30, bg: "rgba(220,38,38,.9)" }); }
    requestAnimationFrame(frame);
  }
  A.start = () => requestAnimationFrame(frame);
})();
