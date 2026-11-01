// Minigolf – 3 holes, iedereen slaat tegelijk op dezelfde baan (ballen gaan door elkaar heen).
ARCADE.register({
  id: "golf", name: "Minigolf", emoji: "⛳", color: "#15803d",
  tagline: "3 holes tegelijk met z'n allen – minste slagen wint",
  howto: ["Trek je duim TERUG (zoals een katapult) en laat los om te slaan", "Hoe verder je trekt, hoe harder · de lijn op tv laat zien waar hij heen gaat", "Minste slagen over 3 holes wint · max 10 slagen of 50 sec per hole"],
  min: 1, max: 8,
  pad: { type: "stick", buttons: [], hint: "Trek terug en<br>laat los = slaan" },
  create(A, players) {
    const { W, H } = A, BR = 11, HOLE_R = 17, MAXS = 10, HOLE_T = 50;
    const FX = 80, FY = 110, FW = 1440, FH = 750;
    const COURSES = [
      { name: "De Opwarmer", tee: [230, 485], hole: [1360, 485], walls: [[690, 300, 60, 370], [1040, 110, 50, 230], [1040, 630, 50, 230]] },
      { name: "Zigzag", tee: [210, 770], hole: [1380, 210], walls: [[440, 300, 50, 560], [800, 110, 50, 520], [1150, 330, 50, 530]] },
      { name: "De Molen", tee: [210, 300], hole: [1360, 680], walls: [[560, 110, 50, 290], [560, 580, 50, 280], [1180, 420, 340, 40]], spinner: { x: 900, y: 485, len: 330, speed: 1.5 } },
    ];
    const border = [[0, 0, W, FY], [0, FY + FH, W, H - FY - FH], [0, 0, FX, H], [FX + FW, 0, W - FX - FW, H]];
    const ps = players.map((p, i) => ({ p, total: 0, strokes: 0, done: false, x: 0, y: 0, vx: 0, vy: 0, aim: null, lastMag: 0, sinkT: 0 }));
    let hole = 0, t = 0, between = 0, course = null, walls = [], spin = 0;
    const moving = (q) => Math.hypot(q.vx, q.vy) > 6;
    function startHole() {
      course = COURSES[hole]; walls = border.concat(course.walls); t = 0; spin = 0;
      ps.forEach((q, i) => {
        q.strokes = 0; q.done = false; q.vx = q.vy = 0; q.aim = null; q.lastMag = 0; q.sinkT = 0;
        q.x = course.tee[0] + ((i % 3) - 1) * 26; q.y = course.tee[1] + (Math.floor(i / 3) - 1) * 26;
        A.pad(q.p.id, { type: "stick", buttons: [], hint: "Trek terug en<br>laat los = slaan", msg: `Hole ${hole + 1}/3 · slagen: 0` });
      });
    }
    startHole();
    function finishPlayer(q, sunk) {
      q.done = true; q.total += Math.min(MAXS, q.strokes);
      A.pad(q.p.id, { type: "wait", emoji: sunk ? (q.strokes === 1 ? "🤩" : "⛳") : "😬", text: sunk ? (q.strokes === 1 ? "HOLE-IN-ONE!" : `In de hole met ${q.strokes} slagen`) : `${q.strokes} slagen – volgende hole beter!`, sub: `Totaal: ${q.total} slagen` });
    }
    function segHit(q, ax, ay, bx, by, sx, sy) {
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const tt = A.clamp(((q.x - ax) * dx + (q.y - ay) * dy) / L2, 0, 1), cx = ax + dx * tt, cy = ay + dy * tt;
      const ex = q.x - cx, ey = q.y - cy, d = Math.hypot(ex, ey);
      if (d >= BR + 6 || d === 0) return;
      const nx = ex / d, ny = ey / d;
      q.x = cx + nx * (BR + 6); q.y = cy + ny * (BR + 6);
      const rvx = q.vx - sx, rvy = q.vy - sy, dot = rvx * nx + rvy * ny;
      if (dot < 0) { q.vx = (rvx - 1.8 * dot * nx) + sx; q.vy = (rvy - 1.8 * dot * ny) + sy; A.sfx("blip"); }
    }
    const game = {
      over: false, ranking: null, _ps: () => ps, _hole: () => hole,
      stat: (id) => `${ps.find((q) => q.p.id === id).total} slagen`,
      update(dt) {
        if (between > 0) {
          between -= dt;
          if (between <= 0) { hole++; if (hole >= COURSES.length) { game.over = true; game.ranking = A.rankGroups(ps.map((q) => ({ id: q.p.id, key: [-q.total] }))); } else startHole(); }
          return;
        }
        t += dt; spin += dt * (course.spinner ? course.spinner.speed : 0);
        for (const q of ps) {
          if (q.done) { q.sinkT += dt; continue; }
          const st = A.stick(q.p.id), mag = Math.min(1, Math.hypot(st.x, st.y));
          if (!moving(q)) {
            if (mag > 0.2) { q.aim = { x: -st.x / (mag || 1), y: -st.y / (mag || 1), m: mag }; q.lastMag = mag; }
            else if (q.aim && mag < 0.12) {
              if (q.lastMag >= 0.25) {
                const pw = 220 + q.aim.m * 1180;
                q.vx = q.aim.x * pw; q.vy = q.aim.y * pw; q.strokes++; A.sfx("shoot");
                A.pad(q.p.id, { type: "stick", buttons: [], hint: "Trek terug en<br>laat los = slaan", msg: `Hole ${hole + 1}/3 · slagen: ${q.strokes}` });
              }
              q.aim = null; q.lastMag = 0;
            }
          } else q.aim = null;
          // beweging met kleine stapjes (geen tunnelen door muren)
          const steps = Math.max(1, Math.ceil(Math.hypot(q.vx, q.vy) * dt / 6));
          for (let s = 0; s < steps; s++) {
            const sdt = dt / steps;
            q.x += q.vx * sdt; q.y += q.vy * sdt;
            for (const [wx, wy, ww, wh] of walls) {
              const cx = A.clamp(q.x, wx, wx + ww), cy = A.clamp(q.y, wy, wy + wh), ex = q.x - cx, ey = q.y - cy, d = Math.hypot(ex, ey);
              if (d < BR) {
                if (d > 0.001) { const nx = ex / d, ny = ey / d; q.x = cx + nx * BR; q.y = cy + ny * BR; const dot = q.vx * nx + q.vy * ny; if (dot < 0) { q.vx -= 1.8 * dot * nx; q.vy -= 1.8 * dot * ny; A.sfx("blip"); } }
                else { q.vx = -q.vx; q.vy = -q.vy; }
              }
            }
            if (course.spinner) {
              const sp = course.spinner, a = spin, hx = Math.cos(a) * sp.len / 2, hy = Math.sin(a) * sp.len / 2;
              const cx = A.clamp(((q.x - sp.x) * Math.cos(a) + (q.y - sp.y) * Math.sin(a)), -sp.len / 2, sp.len / 2);
              const surfX = -Math.sin(a) * cx * sp.speed, surfY = Math.cos(a) * cx * sp.speed;
              segHit(q, sp.x - hx, sp.y - hy, sp.x + hx, sp.y + hy, surfX, surfY);
            }
          }
          const sp = Math.hypot(q.vx, q.vy);
          if (sp > 0) { const ns = Math.max(0, sp - (60 + sp * 0.9) * dt); q.vx *= ns / sp; q.vy *= ns / sp; }
          const dh = A.dist(q.x, q.y, course.hole[0], course.hole[1]);
          if (dh < HOLE_R && sp < 560) {
            q.x = course.hole[0]; q.y = course.hole[1]; q.vx = q.vy = 0;
            A.sfx(q.strokes === 1 ? "win" : "good"); A.burst(q.x, q.y, [q.p.color, "#fff", "#facc15"], 24, 260); A.buzz(q.p.id, 120);
            finishPlayer(q, true);
          } else if (dh < HOLE_R + 6 && sp >= 560) { q.vx += (q.x - course.hole[0]) * 4; q.vy += (q.y - course.hole[1]) * 4; }
          else if (q.strokes >= MAXS && !moving(q)) finishPlayer(q, false);
        }
        const allDone = ps.every((q) => q.done);
        if (allDone || t > HOLE_T) {
          for (const q of ps) if (!q.done) { q.strokes = Math.min(MAXS, q.strokes + 2); finishPlayer(q, false); }
          between = 3.2;
        }
      },
      draw(g, clock) {
        g.fillStyle = "#14532d"; g.fillRect(0, 0, W, H);
        for (let x = FX; x < FX + FW; x += 90) { g.fillStyle = (x / 90) % 2 < 1 ? "#22c55e" : "#16a34a"; g.fillRect(x, FY, Math.min(90, FX + FW - x), FH); }
        g.strokeStyle = "#78350f"; g.lineWidth = 14; g.strokeRect(FX - 7, FY - 7, FW + 14, FH + 14);
        for (const [x, y, w, h] of course.walls) {
          g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 5, y + 6, w, h);
          g.fillStyle = "#a16207"; g.fillRect(x, y, w, h); g.fillStyle = "#ca8a04"; g.fillRect(x, y, w, 6);
        }
        // hole + vlag
        const [hx, hy] = course.hole;
        g.fillStyle = "#052e16"; g.beginPath(); g.arc(hx, hy, HOLE_R, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#e5e7eb"; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, hy - 70); g.stroke();
        g.fillStyle = "#ef4444"; g.beginPath(); g.moveTo(hx, hy - 70); g.lineTo(hx + 38 + Math.sin(clock * 5) * 4, hy - 58); g.lineTo(hx, hy - 46); g.fill();
        A.txt(g, String(hole + 1), hx + 12, hy - 52, { size: 14, color: "#fff" });
        // tee
        g.fillStyle = "rgba(255,255,255,.2)"; A.rr(g, course.tee[0] - 50, course.tee[1] - 50, 100, 100, 14); g.fill();
        if (course.spinner) {
          const sp = course.spinner, a = spin;
          g.save(); g.translate(sp.x, sp.y); g.rotate(a);
          for (let k = -sp.len / 2; k < sp.len / 2; k += 30) { g.fillStyle = (Math.floor(k / 30) % 2) ? "#ef4444" : "#f8fafc"; g.fillRect(k, -6, 30, 12); }
          g.restore();
          g.fillStyle = "#7f1d1d"; g.beginPath(); g.arc(sp.x, sp.y, 14, 0, Math.PI * 2); g.fill();
        }
        // richtlijnen
        for (const q of ps) {
          if (!q.aim || q.done) continue;
          const len = 40 + q.aim.m * 220;
          const ex = q.x + q.aim.x * len, ey = q.y + q.aim.y * len;
          g.setLineDash([10, 9]); g.lineCap = "round";
          g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 9; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(ex, ey); g.stroke();
          g.strokeStyle = q.p.color; g.lineWidth = 5; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
          g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = q.p.color; g.beginPath(); g.arc(ex, ey, 5, 0, Math.PI * 2); g.fill();
        }
        for (const q of ps) {
          if (q.done && q.sinkT > 0.4) continue;
          const sc = q.done ? Math.max(0.1, 1 - q.sinkT / 0.4) : 1;
          g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(q.x + 3, q.y + 4, BR * sc, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(q.x, q.y, BR * sc, 0, Math.PI * 2); g.fill();
          g.strokeStyle = q.p.color; g.lineWidth = 4; g.stroke();
          if (!q.done) A.emoji(g, q.p.emoji, q.x, q.y - 24, 18);
        }
        A.pill(g, `Hole ${hole + 1}/3 · ${course.name}`, 230, 50, { size: 24 });
        A.pill(g, `⏱ ${Math.max(0, Math.ceil(HOLE_T - t))}`, W - 100, 50, { size: 24 });
        ps.forEach((q, i) => { const x = 470 + i * 112; A.avatar(g, q.p, x, 50, 17, { alpha: q.done ? 0.5 : 1 }); A.txt(g, `${q.total + (q.done ? 0 : q.strokes)}`, x + 24, 59, { size: 22, color: "#fde68a" }); });
        if (between > 0) A.pill(g, hole + 1 < COURSES.length ? `Op naar hole ${hole + 2}…` : "Laatste hole gespeeld!", W / 2, H / 2, { size: 46, bg: "rgba(20,83,45,.92)" });
      },
    };
    return game;
  },
});
