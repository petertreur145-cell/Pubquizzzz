// Meteorenregen – zweef door de ruimte en ontwijk de rotsen.
ARCADE.register({
  id: "meteor", name: "Meteorenregen", emoji: "☄️", color: "#4338ca",
  tagline: "Zweef door de ruimte en ontwijk de vallende rotsen",
  howto: ["Duim links = zweven · ZOEF = snelle uitwijk-boost", "Rode ⚠️ = er komt een meteoor aan", "⭐ = schild · laatste astronaut over wint"],
  min: 1, max: 8,
  pad: { type: "stick", buttons: [{ id: "A", label: "🚀 ZOEF", color: "#7c3aed" }] },
  create(A, players) {
    const { W, H } = A, R = 24, TOP = 70;
    const ps = players.map((p, i) => ({ p, x: W / 2 + (i - (players.length - 1) / 2) * 110, y: H * 0.62, vx: 0, vy: 0, alive: true, deathT: 0, shield: 0, cd: 0, inv: 0, ax: 0, ay: 0 }));
    const mets = [], stars = [], pickups = [];
    for (let i = 0; i < 160; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: A.rand(0.2, 1) });
    let t = 0, spawnT = 1.5, pickT = 8;
    function spawn() {
      const r = A.rand(18, 34 + Math.min(36, t * 0.6)), speed = Math.min(560, 230 + t * 4) * A.rand(0.8, 1.2);
      const side = t > 25 && Math.random() < 0.35 ? (Math.random() < 0.5 ? "L" : "R") : "T";
      let x, y, vx, vy;
      if (side === "T") { x = A.rand(60, W - 60); y = -r; vx = A.rand(-150, 150); vy = speed; }
      else { y = A.rand(TOP + 60, H - 80); x = side === "L" ? -r : W + r; vx = side === "L" ? speed : -speed; vy = A.rand(-60, 80); }
      const pts = Array.from({ length: 9 }, (_, k) => { const a = (k / 9) * Math.PI * 2; return [Math.cos(a) * r * A.rand(0.75, 1.1), Math.sin(a) * r * A.rand(0.75, 1.1)]; });
      mets.push({ x, y, vx, vy, r, rot: 0, vr: A.rand(-3, 3), warn: 0.9, side, pts });
    }
    function die(q) {
      q.alive = false; q.deathT = t; A.sfx("boom"); A.shake(12); A.buzz(q.p.id, 300);
      A.burst(q.x, q.y, [q.p.color, "#fff", "#f97316", "#facc15"], 34, 420);
      A.pad(q.p.id, { type: "wait", emoji: "☄️", text: "Geraakt!", sub: `Je overleefde ${t.toFixed(1)} seconden` });
    }
    const game = {
      over: false, ranking: null,
      stat: (id) => { const q = ps.find((x) => x.p.id === id); return `${(q.alive ? t : q.deathT).toFixed(1)} s`; },
      update(dt) {
        t += dt;
        for (const s of stars) { s.y += s.z * 60 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); if (t > 40 && Math.random() < 0.3) spawn(); spawnT = Math.max(0.22, 0.9 - t * 0.012); }
        pickT -= dt;
        if (pickT <= 0) { pickups.push({ x: A.rand(120, W - 120), y: A.rand(TOP + 80, H - 100), life: 8 }); pickT = A.rand(9, 13); }
        for (const q of ps) {
          const boost = A.hit(q.p.id, "A");
          if (!q.alive) continue;
          const st = A.stick(q.p.id);
          q.ax = st.x; q.ay = st.y;
          q.vx += st.x * 1500 * dt; q.vy += st.y * 1500 * dt;
          q.cd = Math.max(0, q.cd - dt); q.inv = Math.max(0, q.inv - dt); q.shield = Math.max(0, q.shield - dt);
          if (boost && q.cd <= 0) {
            let dx = st.x, dy = st.y, m = Math.hypot(dx, dy);
            if (m < 0.2) { dx = q.vx; dy = q.vy; m = Math.hypot(dx, dy) || 1; }
            q.vx += dx / m * 650; q.vy += dy / m * 650; q.cd = 2; A.sfx("jump");
            A.burst(q.x, q.y, ["#a78bfa", "#fff"], 12, 220, 0.4);
          }
          const damp = Math.pow(0.06, dt); q.vx *= damp; q.vy *= damp;
          const sp = Math.hypot(q.vx, q.vy), cap = q.cd > 1.7 ? 900 : 430;
          if (sp > cap) { q.vx = q.vx / sp * cap; q.vy = q.vy / sp * cap; }
          q.x += q.vx * dt; q.y += q.vy * dt;
          if (q.x < R) { q.x = R; q.vx = Math.abs(q.vx) * 0.5; } if (q.x > W - R) { q.x = W - R; q.vx = -Math.abs(q.vx) * 0.5; }
          if (q.y < TOP + R) { q.y = TOP + R; q.vy = Math.abs(q.vy) * 0.5; } if (q.y > H - R) { q.y = H - R; q.vy = -Math.abs(q.vy) * 0.5; }
          for (let i = pickups.length - 1; i >= 0; i--) if (A.dist(q.x, q.y, pickups[i].x, pickups[i].y) < R + 24) { pickups.splice(i, 1); q.shield = 6; A.sfx("coin"); }
        }
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j]; if (!a.alive || !b.alive) continue;
          const d = A.dist(a.x, a.y, b.x, b.y);
          if (d < R * 2 && d > 0) { const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, o = (R * 2 - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rel > 0) { a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny; } }
        }
        for (let i = mets.length - 1; i >= 0; i--) {
          const m = mets[i];
          if (m.warn > 0) { m.warn -= dt; continue; }
          m.x += m.vx * dt; m.y += m.vy * dt; m.rot += m.vr * dt;
          if (m.y > H + 100 || m.x < -150 || m.x > W + 150 || m.y < -200) { mets.splice(i, 1); continue; }
          for (const q of ps) {
            if (!q.alive || q.inv > 0) continue;
            if (A.dist(q.x, q.y, m.x, m.y) < R + m.r * 0.82) {
              if (q.shield > 0) { q.shield = 0; q.inv = 0.8; A.sfx("hit"); A.burst(m.x, m.y, ["#a8a29e", "#67e8f9"], 20, 300); mets.splice(i, 1); break; }
              die(q);
            }
          }
        }
        for (let i = pickups.length - 1; i >= 0; i--) { pickups[i].life -= dt; if (pickups[i].life <= 0) pickups.splice(i, 1); }
        const alive = ps.filter((q) => q.alive).length;
        if (!game.over && (alive === 0 || (ps.length > 1 && alive <= 1) || t > 120)) {
          game.over = true;
          game.ranking = A.rankGroups(ps.map((q) => ({ id: q.p.id, key: [q.alive ? 1 : 0, q.alive ? 0 : Math.round(q.deathT * 10)] })));
        }
      },
      draw(g, clock) {
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#020617"); sky.addColorStop(1, "#1e1b4b");
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        for (const s of stars) { g.fillStyle = `rgba(255,255,255,${s.z})`; g.fillRect(s.x, s.y, s.z * 3, s.z * 3); }
        g.fillStyle = "#7c3aed"; g.beginPath(); g.arc(1420, 820, 170, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#a78bfa"; g.beginPath(); g.arc(1380, 780, 120, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(196,181,253,.6)"; g.lineWidth = 10; g.beginPath(); g.ellipse(1420, 820, 280, 50, -0.3, 0, Math.PI * 2); g.stroke();
        for (const pk of pickups) A.emoji(g, "⭐", pk.x, pk.y, 40 + Math.sin(clock * 6) * 6);
        for (const m of mets) {
          if (m.warn > 0) {
            const wx = m.side === "T" ? m.x : m.side === "L" ? 30 : W - 30, wy = m.side === "T" ? TOP + 30 : m.y;
            if (Math.floor(clock * 10) % 2) A.emoji(g, "⚠️", wx, wy, 34);
            continue;
          }
          const sp = Math.hypot(m.vx, m.vy), tx = -m.vx / sp, ty = -m.vy / sp;
          const tr = g.createLinearGradient(m.x, m.y, m.x + tx * m.r * 4, m.y + ty * m.r * 4);
          tr.addColorStop(0, "rgba(251,146,60,.7)"); tr.addColorStop(1, "rgba(251,146,60,0)");
          g.fillStyle = tr; g.beginPath(); g.moveTo(m.x - ty * m.r, m.y + tx * m.r); g.lineTo(m.x + tx * m.r * 4, m.y + ty * m.r * 4); g.lineTo(m.x + ty * m.r, m.y - tx * m.r); g.fill();
          g.save(); g.translate(m.x, m.y); g.rotate(m.rot);
          g.fillStyle = "#78716c"; g.beginPath(); m.pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
          g.fillStyle = "#57534e"; g.beginPath(); g.arc(m.r * 0.25, -m.r * 0.2, m.r * 0.22, 0, Math.PI * 2); g.arc(-m.r * 0.35, m.r * 0.3, m.r * 0.15, 0, Math.PI * 2); g.fill();
          g.restore();
        }
        for (const q of ps) {
          if (!q.alive) continue;
          const am = Math.hypot(q.ax, q.ay);
          if (am > 0.2) {
            const fx = q.x - q.ax / am * (R + 6), fy = q.y - q.ay / am * (R + 6);
            g.fillStyle = Math.floor(clock * 20) % 2 ? "#f97316" : "#facc15"; g.beginPath(); g.arc(fx, fy, 8 + am * 6, 0, Math.PI * 2); g.fill();
          }
          A.avatar(g, q.p, q.x, q.y, R, { alpha: q.inv > 0 && Math.floor(clock * 12) % 2 ? 0.4 : 1 });
          if (q.shield > 0) { g.strokeStyle = `rgba(103,232,249,${q.shield < 1.5 && Math.floor(clock * 8) % 2 ? 0.3 : 0.85})`; g.lineWidth = 5; g.beginPath(); g.arc(q.x, q.y, R + 10, 0, Math.PI * 2); g.stroke(); }
          A.label(g, q.p, q.x, q.y - R - 10, 15);
        }
        A.pill(g, `⏱ ${t.toFixed(0)} s`, W / 2, 36, { size: 24 });
        ps.forEach((q, i) => A.avatar(g, q.p, 60 + i * 56, 36, 20, { alpha: q.alive ? 1 : 0.25 }));
      },
    };
    return game;
  },
});
