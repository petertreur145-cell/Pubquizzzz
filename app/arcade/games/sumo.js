// Sumo op ijs – duw elkaar van een smeltende ijsschots. 3 rondes.
ARCADE.register({
  id: "sumo", name: "IJs-Sumo", emoji: "🧊", color: "#0891b2",
  tagline: "Duw iedereen van de smeltende ijsschots",
  howto: ["Duim links = glijden · DUW! = snelle rammer (even opladen)", "Van het ijs af = af · de schots wordt steeds kleiner", "3 rondes – langer blijven staan = meer punten"],
  min: 2, max: 8,
  pad: { type: "stick", buttons: [{ id: "A", label: "💨 DUW!", color: "#0ea5e9" }] },
  create(A, players) {
    const { W, H } = A, CX = W / 2, CY = 490, R0 = 390, RMIN = 160, BR = 34, ROUNDS = 3;
    const balls = players.map((p) => ({ p, x: 0, y: 0, vx: 0, vy: 0, alive: true, fall: 0, outT: 0, cd: 0, dashT: 0, total: 0, wins: 0 }));
    let round = 1, t = 0, radius = R0, banner = 0, bannerText = "", roundOver = false;
    function reset() {
      t = 0; radius = R0; roundOver = false;
      const off = Math.random() * Math.PI * 2;
      balls.forEach((b, i) => { const a = off + (i / balls.length) * Math.PI * 2; b.x = CX + Math.cos(a) * 230; b.y = CY + Math.sin(a) * 230; b.vx = b.vy = 0; b.alive = true; b.fall = 0; b.outT = 0; b.cd = 0.5; b.dashT = 0; });
      balls.forEach((b) => A.pad(b.p.id, { type: "stick", msg: `Ronde ${round}/${ROUNDS}`, buttons: [{ id: "A", label: "💨 DUW!", color: "#0ea5e9" }] }));
    }
    reset();
    function endRound() {
      roundOver = true;
      const order = balls.slice().sort((a, b) => (b.alive ? 1e9 : b.outT) - (a.alive ? 1e9 : a.outT));
      const winners = order.filter((b) => b.alive);
      balls.forEach((b) => { if (b.alive) b.total += balls.length; else b.total += order.length - 1 - order.indexOf(b); });
      winners.forEach((b) => b.wins++);
      bannerText = winners.length === 1 ? `🏆 ${winners[0].p.name} wint ronde ${round}!` : winners.length ? "Gelijkspel!" : "Iedereen ligt in het water!";
      banner = 3; A.sfx("good");
    }
    const game = {
      over: false, ranking: null,
      stat: (id) => { const b = balls.find((x) => x.p.id === id); return `${b.total} pt · ${b.wins} rondes gewonnen`; },
      update(dt) {
        if (banner > 0) {
          banner -= dt;
          for (const b of balls) A.hit(b.p.id, "A");
          if (banner <= 0) { if (round >= ROUNDS) { game.over = true; game.ranking = A.rankGroups(balls.map((b) => ({ id: b.p.id, key: [b.total, b.wins] }))); } else { round++; reset(); } }
          return;
        }
        t += dt;
        if (t > 5) radius = Math.max(RMIN, R0 - (t - 5) * 6);
        for (const b of balls) {
          const dash = A.hit(b.p.id, "A");
          if (!b.alive) { if (b.fall > 0) b.fall -= dt; continue; }
          const st = A.stick(b.p.id);
          b.cd = Math.max(0, b.cd - dt); b.dashT = Math.max(0, b.dashT - dt);
          b.vx += st.x * 1100 * dt; b.vy += st.y * 1100 * dt;
          if (dash && b.cd <= 0) {
            let dx = st.x, dy = st.y, m = Math.hypot(dx, dy);
            if (m < 0.2) { dx = b.vx; dy = b.vy; m = Math.hypot(dx, dy); }
            if (m > 0.01) { b.vx += dx / m * 760; b.vy += dy / m * 760; b.cd = 1.5; b.dashT = 0.25; A.sfx("jump"); A.burst(b.x, b.y, ["#e0f2fe", "#fff"], 12, 200, 0.4); }
          }
          const damp = Math.pow(0.45, dt); b.vx *= damp; b.vy *= damp;
          const sp = Math.hypot(b.vx, b.vy), cap = b.dashT > 0 ? 1100 : 560;
          if (sp > cap) { b.vx = b.vx / sp * cap; b.vy = b.vy / sp * cap; }
          b.x += b.vx * dt; b.y += b.vy * dt;
        }
        for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], c = balls[j]; if (!a.alive || !c.alive) continue;
          const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
          if (d < BR * 2 && d > 0) {
            const nx = dx / d, ny = dy / d, ov = (BR * 2 - d) / 2;
            a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
            const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
            if (rel > 0) {
              const imp = rel * 1.25;
              a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny;
              if (rel > 250) { A.sfx("hit"); A.shake(Math.min(10, rel / 80)); A.burst((a.x + c.x) / 2, (a.y + c.y) / 2, "#fff", 8, 200, 0.3); }
              else A.sfx("blip");
            }
          }
        }
        for (const b of balls) {
          if (b.alive && A.dist(b.x, b.y, CX, CY) > radius + BR * 0.2) {
            b.alive = false; b.outT = t; b.fall = 0.7; A.sfx("bad"); A.buzz(b.p.id, 300);
            A.burst(b.x, b.y, ["#38bdf8", "#e0f2fe", "#fff"], 24, 280);
            A.pad(b.p.id, { type: "wait", emoji: "🌊", text: "Plons! Je ligt in het water", sub: `Ronde ${round}/${ROUNDS} – kijk wie er wint` });
          }
        }
        const alive = balls.filter((b) => b.alive).length;
        if (!roundOver && (alive <= 1 || t > 70)) endRound();
      },
      draw(g, clock) {
        g.fillStyle = "#0c4a6e"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "rgba(125,211,252,.18)"; g.lineWidth = 3;
        for (let y = 20; y < H; y += 40) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * 0.02 + clock * 2 + y) * 6); g.stroke(); }
        g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(CX + 10, CY + 24, radius, radius * 0.97, 0, 0, Math.PI * 2); g.fill();
        const ice = g.createRadialGradient(CX - radius * 0.3, CY - radius * 0.3, 10, CX, CY, radius);
        ice.addColorStop(0, "#f0f9ff"); ice.addColorStop(0.7, "#bae6fd"); ice.addColorStop(1, "#7dd3fc");
        g.fillStyle = ice; g.beginPath(); g.arc(CX, CY, radius, 0, Math.PI * 2); g.fill();
        g.strokeStyle = t > 5 && banner <= 0 ? `rgba(239,68,68,${0.4 + Math.sin(clock * 6) * 0.3})` : "#e0f2fe"; g.lineWidth = 8; g.stroke();
        g.strokeStyle = "rgba(14,116,144,.35)"; g.lineWidth = 2;
        for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; g.beginPath(); g.moveTo(CX + Math.cos(a) * 40, CY + Math.sin(a) * 40); g.lineTo(CX + Math.cos(a + 0.2) * radius * 0.6, CY + Math.sin(a + 0.2) * radius * 0.6); g.lineTo(CX + Math.cos(a) * radius * 0.95, CY + Math.sin(a) * radius * 0.95); g.stroke(); }
        for (const b of balls) {
          if (!b.alive) { if (b.fall > 0) A.avatar(g, b.p, b.x, b.y, BR * (b.fall / 0.7), { alpha: b.fall / 0.7 }); continue; }
          g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(b.x + 6, b.y + 10, BR, BR * 0.8, 0, 0, Math.PI * 2); g.fill();
          A.avatar(g, b.p, b.x, b.y, BR, { glow: b.dashT > 0 ? "#fff" : null });
          if (b.cd > 0) { g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, BR + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.cd / 1.5)); g.stroke(); }
          A.label(g, b.p, b.x, b.y - BR - 10, 16);
        }
        A.pill(g, `Ronde ${round}/${ROUNDS}`, W / 2, 36, { size: 26 });
        balls.forEach((b, i) => { const x = 70 + i * 100; A.avatar(g, b.p, x, 40, 18); A.txt(g, `${b.total}`, x + 26, 50, { size: 22, color: "#bae6fd" }); });
        if (banner > 0) { A.pill(g, bannerText, W / 2, H / 2, { size: 54, bg: "rgba(12,74,110,.92)" }); }
      },
    };
    return game;
  },
});
