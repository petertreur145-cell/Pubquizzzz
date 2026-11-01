// Vier op een rij – in twee teams, om de beurt gooit iemand uit je team een schijf.
ARCADE.register({
  id: "c4", name: "Vier op een Rij", emoji: "🔴", color: "#1d4ed8",
  tagline: "Team Rood tegen Team Geel – om de beurt een schijf",
  howto: ["Jullie spelen in twee teams, iedereen komt aan de beurt", "◀ ▶ = kolom kiezen · ⬇ = laten vallen (15 sec per beurt)", "Vier op een rij (ook schuin) wint! Alleen? Dan speel je tegen de computer"],
  min: 1, max: 8, team: true,
  pad: { type: "wait", emoji: "⏳", text: "Wacht op je beurt…" },
  create(A, players) {
    const { W, H } = A, COLS = 7, ROWS = 6, CELL = 104, BX = (W - COLS * CELL) / 2, BY = 230;
    const TEAM = [{ name: "Rood", c: "#ef4444", dark: "#991b1b", e: "❤️" }, { name: "Geel", c: "#facc15", dark: "#a16207", e: "💛" }];
    const order = A.shuffle(players.slice());
    const teams = [[], []];
    order.forEach((p, i) => teams[i % 2].push(p));
    const ai = teams[1].length === 0;
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const idx = [0, 0], cursor = [3, 3];
    let team = Math.random() < 0.5 ? 0 : 1, turnT = 15, falling = null, win = null, draw = false, t = 0, aiT = 0, endT = 0;
    const teamOf = (pid) => (teams[0].some((p) => p.id === pid) ? 0 : 1);
    const curPlayer = () => (ai && team === 1 ? null : teams[team][idx[team] % teams[team].length]);
    function sendPads() {
      const cur = curPlayer();
      for (const p of players) {
        const tm = teamOf(p.id);
        if (cur && p.id === cur.id && !win && !draw) {
          A.pad(p.id, { type: "buttons", cols: 3, msg: `${TEAM[tm].e} JOUW BEURT!`, buttons: [{ id: "L", label: "◀", color: "#334155" }, { id: "D", label: "⬇ GOOI", color: TEAM[tm].c }, { id: "R", label: "▶", color: "#334155" }] });
        } else {
          A.pad(p.id, { type: "wait", emoji: TEAM[tm].e, text: win || draw ? "Klaar!" : cur ? `${cur.name} is aan de beurt` : "De computer denkt na…", sub: `Jij zit in team ${TEAM[tm].name}`, msg: `Team ${TEAM[tm].name}` });
        }
      }
    }
    const lowest = (c) => { for (let r = ROWS - 1; r >= 0; r--) if (!grid[r][c]) return r; return -1; };
    function lineAt(gr, r, c, tm) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [[r, c]];
        for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && gr[rr][cc] && gr[rr][cc].team === tm) { cells.push([rr, cc]); rr += dr * s; cc += dc * s; } }
        if (cells.length >= 4) return cells;
      }
      return null;
    }
    function aiMove() {
      const valid = [...Array(COLS).keys()].filter((c) => lowest(c) >= 0);
      const test = (c, tm) => { const r = lowest(c); grid[r][c] = { team: tm }; const ok = !!lineAt(grid, r, c, tm); grid[r][c] = null; return ok; };
      for (const c of valid) if (test(c, 1)) return c;
      for (const c of valid) if (test(c, 0)) return c;
      const safe = valid.filter((c) => { const r = lowest(c); if (r <= 0) return true; grid[r][c] = { team: 1 }; const bad = test(c, 0); grid[r][c] = null; return !bad; });
      const pool = safe.length ? safe : valid;
      return pool.slice().sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + A.rand(-1.2, 1.2))[0];
    }
    function drop(c, pid) {
      const r = lowest(c); if (r < 0 || falling) return false;
      falling = { c, r, y: BY - CELL * 0.8, vy: 0, team, pid };
      A.sfx("drop");
      return true;
    }
    function land() {
      const f = falling; falling = null;
      grid[f.r][f.c] = { team: f.team, pid: f.pid };
      A.sfx("blip"); A.shake(3);
      const line = lineAt(grid, f.r, f.c, f.team);
      if (line) { win = line; game.winTeam = f.team; A.sfx("win"); A.confetti(80); sendPads(); return; }
      if (grid[0].every((x) => x)) { draw = true; sendPads(); return; }
      if (!(ai && f.team === 1)) idx[f.team]++;
      team = 1 - team; turnT = 15; aiT = 0;
      sendPads();
    }
    sendPads();
    const game = {
      over: false, ranking: null, winTeam: null,
      stat: (id) => `Team ${TEAM[teamOf(id)].name}`,
      update(dt) {
        t += dt;
        const cur = curPlayer();
        for (const p of players) if (!cur || p.id !== cur.id) { A.hit(p.id, "L"); A.hit(p.id, "R"); A.hit(p.id, "D"); }
        if (falling) {
          falling.vy += 3000 * dt; falling.y += falling.vy * dt;
          const target = BY + falling.r * CELL + CELL / 2;
          if (falling.y >= target) { falling.y = target; land(); }
        } else if (!win && !draw) {
          turnT -= dt;
          if (cur) {
            if (A.hit(cur.id, "L")) { cursor[team] = Math.max(0, cursor[team] - 1); A.sfx("blip"); }
            if (A.hit(cur.id, "R")) { cursor[team] = Math.min(COLS - 1, cursor[team] + 1); A.sfx("blip"); }
            if (A.hit(cur.id, "D") || turnT <= 0) {
              if (lowest(cursor[team]) < 0) { const v = [...Array(COLS).keys()].filter((c) => lowest(c) >= 0); cursor[team] = A.pick(v); }
              drop(cursor[team], cur.id);
            }
          } else {
            aiT += dt;
            if (aiT > 1.1) { cursor[1] = aiMove(); drop(cursor[1], null); }
          }
        } else {
          endT += dt;
          if (endT > 2.5 && !game.over) {
            game.over = true;
            if (draw) game.ranking = [players.map((p) => p.id)];
            else game.ranking = [teams[game.winTeam].map((p) => p.id), teams[1 - game.winTeam].map((p) => p.id)];
          }
        }
      },
      draw(g, clock) {
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0f172a"); bg.addColorStop(1, "#1e3a8a");
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        const disc = (x, y, tm, pid, r = CELL * 0.4) => {
          g.fillStyle = TEAM[tm].dark; g.beginPath(); g.arc(x, y + 4, r, 0, Math.PI * 2); g.fill();
          g.fillStyle = TEAM[tm].c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r * 0.72, 0, Math.PI * 2); g.stroke();
          const p = pid && players.find((q) => q.id === pid);
          A.emoji(g, p ? p.emoji : "🤖", x, y, r * 0.9);
        };
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) disc(BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2, grid[r][c].team, grid[r][c].pid);
        if (falling) disc(BX + falling.c * CELL + CELL / 2, falling.y, falling.team, falling.pid);
        g.fillStyle = "#2563eb"; g.beginPath(); A.rr(g, BX - 18, BY - 12, COLS * CELL + 36, ROWS * CELL + 30, 24);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const x = BX + c * CELL + CELL / 2, y = BY + r * CELL + CELL / 2; g.moveTo(x + CELL * 0.4, y); g.arc(x, y, CELL * 0.4, 0, Math.PI * 2); }
        g.fill("evenodd");
        g.strokeStyle = "#1e40af"; g.lineWidth = 6; A.rr(g, BX - 18, BY - 12, COLS * CELL + 36, ROWS * CELL + 30, 24); g.stroke();
        g.fillStyle = "#1e40af"; g.fillRect(BX - 50, BY + ROWS * CELL + 18, 40, 60); g.fillRect(BX + COLS * CELL + 10, BY + ROWS * CELL + 18, 40, 60);
        if (win) {
          g.strokeStyle = "#fff"; g.lineWidth = 10; g.lineCap = "round"; g.beginPath();
          const s = win.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          g.moveTo(BX + s[0][1] * CELL + CELL / 2, BY + s[0][0] * CELL + CELL / 2);
          g.lineTo(BX + s[s.length - 1][1] * CELL + CELL / 2, BY + s[s.length - 1][0] * CELL + CELL / 2); g.stroke();
          A.txt(g, `Team ${TEAM[game.winTeam].name} wint! 🎉`, W / 2, 140, { size: 64, align: "center", color: TEAM[game.winTeam].c, stroke: "#0f172a", strokeW: 10, weight: 900 });
        } else if (draw) {
          A.txt(g, "Gelijkspel! 🤝", W / 2, 140, { size: 64, align: "center", stroke: "#0f172a", strokeW: 10, weight: 900 });
        } else if (!falling) {
          const cx = BX + cursor[team] * CELL + CELL / 2;
          disc(cx, BY - CELL * 0.55 + Math.sin(clock * 6) * 6, team, curPlayer() ? curPlayer().id : null, CELL * 0.36);
          const cur = curPlayer();
          A.txt(g, cur ? `${cur.name} is aan de beurt` : "🤖 De computer denkt na…", W / 2, 70, { size: 40, align: "center", color: TEAM[team].c, stroke: "#0f172a", strokeW: 8 });
          g.strokeStyle = TEAM[team].c; g.lineWidth = 8; g.beginPath(); g.arc(W / 2, 120, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, turnT) / 15); g.stroke();
          A.txt(g, String(Math.max(0, Math.ceil(turnT))), W / 2, 129, { size: 22, align: "center" });
        }
        [0, 1].forEach((tm) => {
          const x = tm === 0 ? 170 : W - 170;
          A.txt(g, `${TEAM[tm].e} Team ${TEAM[tm].name}`, x, 250, { size: 36, align: "center", color: TEAM[tm].c, weight: 900 });
          const list = ai && tm === 1 ? [{ id: null, name: "Computer", emoji: "🤖", color: "#64748b" }] : teams[tm];
          list.forEach((p, i) => {
            const y = 320 + i * 80, cur = curPlayer(), active = !win && !draw && team === tm && (cur ? cur.id === p.id : p.id === null);
            if (active) { g.fillStyle = "rgba(255,255,255,.12)"; A.rr(g, x - 140, y - 34, 280, 68, 18); g.fill(); }
            A.avatar(g, p, x - 90, y, 26);
            A.txt(g, p.name, x - 50, y + 10, { size: 28, color: active ? "#fff" : "#cbd5e1" });
            if (active) A.txt(g, "◀", x + 130, y + 10, { size: 26, color: TEAM[tm].c });
          });
        });
      },
    };
    return game;
  },
});
