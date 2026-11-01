// Doolhof-tikkertje – verzamel munten in het doolhof, maar blijf uit handen van de tikker.
ARCADE.register({
  id: "maze", name: "Doolhoftikker", emoji: "🔥", color: "#7c3aed",
  tagline: "Grijp munten in het doolhof en ontwijk de tikker",
  howto: ["Pijltjes = lopen door het doolhof", "🪙 munten pakken · de tikker 🔥 tikt je → jij bent hem (en -3)", "Wie aan het eind tikker is: -5 · meeste munten wint"],
  min: 2, max: 8,
  pad: { type: "dpad" },
  create(A, players) {
    const { W, H } = A, CW = 15, CH = 8, GW = CW * 2 + 1, GH = CH * 2 + 1;
    const T = Math.floor(Math.min(1500 / GW, 780 / GH)), OX = Math.floor((W - GW * T) / 2), OY = 100;
    const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
    const OPP = { U: "D", D: "U", L: "R", R: "L" };
    // doolhof genereren (backtracker + extra lussen)
    const m = Array.from({ length: GH }, () => Array(GW).fill(1));
    const seen = new Set(["0,0"]), stack = [[0, 0]]; m[1][1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < CW && y < CH && !seen.has(x + "," + y));
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = A.pick(nb); seen.add(nx + "," + ny);
      m[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0; m[ny * 2 + 1][nx * 2 + 1] = 0; stack.push([nx, ny]);
    }
    for (let i = 0; i < CW * CH * 0.45; i++) {
      const x = A.irand(1, GW - 2), y = A.irand(1, GH - 2);
      if (m[y][x] === 1 && ((m[y][x - 1] === 0 && m[y][x + 1] === 0 && m[y - 1][x] === 1 && m[y + 1][x] === 1) || (m[y - 1][x] === 0 && m[y + 1][x] === 0 && m[y][x - 1] === 1 && m[y][x + 1] === 1))) m[y][x] = 0;
    }
    const open = (x, y) => y >= 0 && y < GH && x >= 0 && x < GW && m[y][x] === 0;
    const openTiles = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (m[y][x] === 0) openTiles.push([x, y]);
    // voorgetekend doolhof
    const bg = document.createElement("canvas"); bg.width = W; bg.height = H; const b = bg.getContext("2d");
    b.fillStyle = "#0b1020"; b.fillRect(0, 0, W, H);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (m[y][x] !== 1) { b.fillStyle = (x + y) % 2 ? "#111a33" : "#0f1730"; b.fillRect(OX + x * T, OY + y * T, T, T); continue; }
      b.fillStyle = "#4c1d95"; b.fillRect(OX + x * T, OY + y * T, T, T);
      b.fillStyle = "#7c3aed"; b.fillRect(OX + x * T + 3, OY + y * T + 3, T - 6, T - 6);
      b.fillStyle = "rgba(255,255,255,.18)"; b.fillRect(OX + x * T + 3, OY + y * T + 3, T - 6, 5);
    }
    // spelers
    const center = openTiles.slice().sort((a, c) => A.dist(a[0], a[1], GW / 2, GH / 2) - A.dist(c[0], c[1], GW / 2, GH / 2))[0];
    const far = A.shuffle(openTiles.filter(([x, y]) => Math.abs(x - center[0]) + Math.abs(y - center[1]) > 12));
    const nTaggers = players.length >= 6 ? 2 : 1;
    const taggerIdx = new Set(A.shuffle(players.map((_, i) => i)).slice(0, nTaggers));
    const pls = players.map((p, i) => {
      const [x, y] = taggerIdx.has(i) ? center : far[i % far.length];
      return { p, fx: x, fy: y, moving: false, dx: 0, dy: 0, tgx: x, tgy: y, cur: null, want: null, coins: 0, tagger: taggerIdx.has(i), freeze: taggerIdx.has(i) ? 2 : 0, immune: 0 };
    });
    const coins = new Map();
    const addCoin = () => { for (let k = 0; k < 20; k++) { const [x, y] = A.pick(openTiles); const key = x + "," + y; if (!coins.has(key) && !pls.some((q) => Math.round(q.fx) === x && Math.round(q.fy) === y)) { coins.set(key, { x, y, ph: Math.random() * 6 }); return; } } };
    for (let i = 0; i < 50; i++) addCoin();
    let t = 0, coinT = 0;
    const DUR = 90;
    const padFor = (q) => ({ type: "dpad", msg: q.tagger ? "🔥 JIJ BENT DE TIKKER!" : `🪙 ${q.coins} munten` });
    pls.forEach((q) => A.pad(q.p.id, padFor(q)));
    const game = {
      over: false, ranking: null,
      stat: (id) => `${pls.find((q) => q.p.id === id).coins} munten`,
      update(dt) {
        t += dt;
        coinT += dt; if (coinT > 0.8 && coins.size < 50) { coinT = 0; addCoin(); }
        for (const q of pls) {
          const d = A.dir(q.p.id); if (d) q.want = d;
          q.freeze = Math.max(0, q.freeze - dt); q.immune = Math.max(0, q.immune - dt);
          if (q.freeze > 0) continue;
          if (q.moving && q.want && q.want === OPP[q.cur]) { q.tgx -= q.dx; q.tgy -= q.dy; q.dx = -q.dx; q.dy = -q.dy; q.cur = q.want; }
          let move = (q.tagger ? 6.9 : 6.2) * dt;
          let guard = 0;
          while (move > 1e-6 && guard++ < 4) {
            if (q.moving) {
              const rem = Math.abs(q.tgx - q.fx) + Math.abs(q.tgy - q.fy);
              if (move < rem) { q.fx += q.dx * move; q.fy += q.dy * move; move = 0; break; }
              q.fx = q.tgx; q.fy = q.tgy; move -= rem; q.moving = false;
              const key = q.fx + "," + q.fy;
              if (!q.tagger && coins.has(key)) { coins.delete(key); q.coins++; A.sfx("coin"); A.burst(OX + (q.fx + 0.5) * T, OY + (q.fy + 0.5) * T, ["#facc15", "#fde68a"], 8, 160, 0.4, 4); A.pad(q.p.id, padFor(q)); }
            }
            let nd = null;
            if (q.want && open(q.fx + DIRS[q.want][0], q.fy + DIRS[q.want][1])) nd = q.want;
            else if (q.cur && open(q.fx + DIRS[q.cur][0], q.fy + DIRS[q.cur][1])) nd = q.cur;
            if (!nd) break;
            q.cur = nd; q.dx = DIRS[nd][0]; q.dy = DIRS[nd][1]; q.tgx = q.fx + q.dx; q.tgy = q.fy + q.dy; q.moving = true;
          }
        }
        for (const tg of pls) {
          if (!tg.tagger || tg.freeze > 0) continue;
          for (const r of pls) {
            if (r.tagger || r.immune > 0) continue;
            if (A.dist(tg.fx, tg.fy, r.fx, r.fy) < 0.7) {
              tg.tagger = false; tg.immune = 2.5;
              r.tagger = true; r.freeze = 1.5; r.coins = Math.max(0, r.coins - 3);
              A.sfx("hit"); A.shake(6); A.buzz(r.p.id, 300); A.buzz(tg.p.id, 60);
              A.burst(OX + (r.fx + 0.5) * T, OY + (r.fy + 0.5) * T, ["#ef4444", "#f97316", "#fff"], 24, 300);
              A.pad(r.p.id, padFor(r)); A.pad(tg.p.id, padFor(tg));
              break;
            }
          }
        }
        if (!game.over && t >= DUR) {
          for (const q of pls) if (q.tagger) q.coins = Math.max(0, q.coins - 5);
          game.over = true;
          game.ranking = A.rankGroups(pls.map((q) => ({ id: q.p.id, key: [q.coins] })));
        }
      },
      draw(g, clock) {
        g.drawImage(bg, 0, 0, W, H);
        for (const c of coins.values()) {
          const cx = OX + (c.x + 0.5) * T, cy = OY + (c.y + 0.5) * T, w = Math.abs(Math.sin(clock * 3 + c.ph)) * 9 + 3;
          g.fillStyle = "#facc15"; g.beginPath(); g.ellipse(cx, cy, w, 11, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#fef08a"; g.beginPath(); g.ellipse(cx - w * 0.25, cy - 3, w * 0.35, 4, 0, 0, Math.PI * 2); g.fill();
        }
        for (const q of pls) {
          const x = OX + (q.fx + 0.5) * T, y = OY + (q.fy + 0.5) * T, r = T * 0.42;
          if (q.tagger) {
            g.strokeStyle = `rgba(239,68,68,${0.5 + Math.sin(clock * 10) * 0.4})`; g.lineWidth = 5;
            g.beginPath(); g.arc(x, y, r + 7 + Math.sin(clock * 10) * 2, 0, Math.PI * 2); g.stroke();
          }
          const alpha = q.immune > 0 && Math.floor(clock * 10) % 2 ? 0.4 : 1;
          A.avatar(g, q.p, x, y, r, { alpha, glow: q.tagger ? "#ef4444" : null });
          if (q.tagger) A.emoji(g, "🔥", x, y - r - 12, 22);
          if (q.freeze > 0 && q.tagger) A.txt(g, String(Math.ceil(q.freeze)), x, y - r - 30, { size: 26, align: "center", color: "#fff", stroke: "#000", strokeW: 5 });
        }
        A.pill(g, `⏱ ${Math.max(0, Math.ceil(DUR - t))}`, W - 90, 46, { size: 26 });
        const sorted = pls.slice().sort((a, c) => c.coins - a.coins);
        sorted.forEach((q, i) => {
          const x = 70 + i * 165;
          A.avatar(g, q.p, x, 48, 20, { glow: q.tagger ? "#ef4444" : null });
          A.txt(g, `${q.tagger ? "🔥" : "🪙"} ${q.coins}`, x + 28, 57, { size: 24, color: q.tagger ? "#fca5a5" : "#fde68a" });
        });
      },
    };
    return game;
  },
});
