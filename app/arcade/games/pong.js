// Pingpong Teams – klassiek pingpong, maar elk teamlid heeft een eigen batje op een eigen rij.
ARCADE.register({
  id: "pong", name: "Pingpong Teams", emoji: "🏓", color: "#0369a1", team: true,
  tagline: "Klassiek pingpong: Team Blauw tegen Team Oranje",
  howto: ["Houd ▲ of ▼ ingedrukt om je batje te bewegen", "Iedereen staat op een eigen rij – mist de voorste, dan kan de rest nog redden", "Eerst 7 punten (of na 2 minuten de meeste) wint"],
  min: 2, max: 8,
  pad: { type: "buttons", cols: 1, buttons: [{ id: "U", label: "▲", color: "#0ea5e9" }, { id: "D", label: "▼", color: "#0ea5e9" }] },
  create(A, players) {
    const { W, H } = A, TOP = 90, BOT = 870, GOAL = 7, DUR = 120, PW = 18, BR = 12;
    const TEAMS = [{ name: "Blauw", c: "#3b82f6", e: "💙" }, { name: "Oranje", c: "#f97316", e: "🧡" }];
    const order = A.shuffle(players.slice());
    const teams = [[], []]; order.forEach((p, i) => teams[i % 2].push(p));
    const paddles = [];
    teams.forEach((list, ti) => {
      const h = A.clamp(340 / list.length + 70, 140, 300);
      list.forEach((p, k) => {
        const depth = list.length - 1 - k; // k=0 voorste rij
        const xL = 130 + depth * 120;
        paddles.push({ p, team: ti, x: ti === 0 ? xL : W - xL, y: (TOP + BOT) / 2, h, hits: 0 });
        A.pad(p.id, { type: "buttons", cols: 1, msg: `${TEAMS[ti].e} Team ${TEAMS[ti].name}`, buttons: [{ id: "U", label: "▲", color: TEAMS[ti].c }, { id: "D", label: "▼", color: TEAMS[ti].c }] });
      });
    });
    const score = [0, 0];
    const balls = [];
    let t = 0, second = false, flash = 0, flashTeam = 0;
    function serve(dir) { const a = A.rand(-0.5, 0.5); balls.push({ x: W / 2, y: A.rand(TOP + 150, BOT - 150), vx: Math.cos(a) * 470 * dir, vy: Math.sin(a) * 470, wait: 1, trail: [] }); }
    serve(Math.random() < 0.5 ? 1 : -1);
    const game = {
      over: false, ranking: null,
      stat: (id) => { const pd = paddles.find((x) => x.p.id === id); return `Team ${TEAMS[pd.team].name} · ${pd.hits}x geraakt`; },
      update(dt) {
        t += dt; flash = Math.max(0, flash - dt);
        for (const pd of paddles) {
          const dir = (A.held(pd.p.id, "D") ? 1 : 0) - (A.held(pd.p.id, "U") ? 1 : 0);
          A.hit(pd.p.id, "U"); A.hit(pd.p.id, "D");
          pd.y = A.clamp(pd.y + dir * 680 * dt, TOP + pd.h / 2, BOT - pd.h / 2);
        }
        if (!second && t > 35) { second = true; serve(score[0] > score[1] ? 1 : -1); }
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (b.wait > 0) { b.wait -= dt; continue; }
          const px = b.x;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.trail.push([b.x, b.y]); if (b.trail.length > 10) b.trail.shift();
          if (b.y < TOP + BR) { b.y = TOP + BR; b.vy = Math.abs(b.vy); A.sfx("blip"); }
          if (b.y > BOT - BR) { b.y = BOT - BR; b.vy = -Math.abs(b.vy); A.sfx("blip"); }
          // botsen met batjes (alleen als de bal naar dat team toe beweegt)
          let hitPd = null;
          for (const pd of paddles) {
            const towards = pd.team === 0 ? b.vx < 0 : b.vx > 0;
            if (!towards || Math.abs(b.y - pd.y) > pd.h / 2 + BR) continue;
            const face = pd.team === 0 ? pd.x + PW / 2 : pd.x - PW / 2;
            const crossed = pd.team === 0 ? px - BR >= face - 1 && b.x - BR < face : px + BR <= face + 1 && b.x + BR > face;
            if (crossed && (!hitPd || (pd.team === 0 ? pd.x > hitPd.x : pd.x < hitPd.x))) hitPd = pd;
          }
          if (hitPd) {
            const off = A.clamp((b.y - hitPd.y) / (hitPd.h / 2), -1, 1);
            const sp = Math.min(1150, Math.hypot(b.vx, b.vy) * 1.06), ang = off * 1.0;
            const dir = hitPd.team === 0 ? 1 : -1;
            b.vx = Math.cos(ang) * sp * dir; b.vy = Math.sin(ang) * sp;
            b.x = hitPd.team === 0 ? hitPd.x + PW / 2 + BR : hitPd.x - PW / 2 - BR;
            hitPd.hits++; A.sfx("blip"); A.burst(b.x, b.y, [TEAMS[hitPd.team].c, "#fff"], 8, 180, 0.3);
          }
          if (b.x < 20 || b.x > W - 20) {
            const scorer = b.x < 20 ? 1 : 0;
            score[scorer]++; flash = 1.2; flashTeam = scorer;
            A.sfx("good"); A.shake(6); A.burst(b.x < 20 ? 30 : W - 30, b.y, [TEAMS[scorer].c, "#fff"], 30, 360);
            paddles.forEach((pd) => A.buzz(pd.p.id, pd.team === scorer ? 40 : 160));
            balls.splice(i, 1);
            if (!balls.length || (second && balls.length < 2)) serve(scorer === 0 ? 1 : -1);
          }
        }
        if (!game.over && (score[0] >= GOAL || score[1] >= GOAL || t > DUR)) {
          game.over = true;
          if (score[0] === score[1]) game.ranking = [players.map((p) => p.id)];
          else { const w = score[0] > score[1] ? 0 : 1; game.ranking = [teams[w].map((p) => p.id), teams[1 - w].map((p) => p.id)]; }
          A.confetti(80);
        }
      },
      draw(g, clock) {
        g.fillStyle = "#0c1a33"; g.fillRect(0, 0, W, H);
        g.fillStyle = "rgba(59,130,246,.08)"; g.fillRect(0, TOP, W / 2, BOT - TOP);
        g.fillStyle = "rgba(249,115,22,.08)"; g.fillRect(W / 2, TOP, W / 2, BOT - TOP);
        g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 4; g.strokeRect(10, TOP, W - 20, BOT - TOP);
        g.setLineDash([18, 18]); g.beginPath(); g.moveTo(W / 2, TOP); g.lineTo(W / 2, BOT); g.stroke(); g.setLineDash([]);
        if (flash > 0) { g.fillStyle = TEAMS[flashTeam].c; g.globalAlpha = flash * 0.25; g.fillRect(0, TOP, W, BOT - TOP); g.globalAlpha = 1; }
        A.txt(g, String(score[0]), W / 2 - 90, 75, { size: 64, align: "center", color: TEAMS[0].c, weight: 900 });
        A.txt(g, String(score[1]), W / 2 + 90, 75, { size: 64, align: "center", color: TEAMS[1].c, weight: 900 });
        A.txt(g, `${TEAMS[0].e} Team ${TEAMS[0].name}`, 30, 60, { size: 26, color: TEAMS[0].c });
        A.txt(g, `Team ${TEAMS[1].name} ${TEAMS[1].e}`, W - 30, 60, { size: 26, color: TEAMS[1].c, align: "right" });
        A.pill(g, `⏱ ${Math.max(0, Math.ceil(DUR - t))}`, W / 2, 40, { size: 20 });
        for (const pd of paddles) {
          g.fillStyle = TEAMS[pd.team].c; A.rr(g, pd.x - PW / 2, pd.y - pd.h / 2, PW, pd.h, 8); g.fill();
          g.strokeStyle = pd.p.color; g.lineWidth = 3; g.stroke();
          A.avatar(g, pd.p, pd.team === 0 ? pd.x - 26 : pd.x + 26, pd.y, 16);
        }
        for (const b of balls) {
          if (b.wait > 0) { A.txt(g, "●", b.x, b.y + 10, { size: 30, align: "center", color: `rgba(255,255,255,${0.3 + Math.sin(clock * 12) * 0.3})` }); continue; }
          b.trail.forEach(([x, y], i) => { g.fillStyle = `rgba(255,255,255,${i / b.trail.length * 0.35})`; g.beginPath(); g.arc(x, y, BR * i / b.trail.length, 0, Math.PI * 2); g.fill(); });
          g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 16; g.beginPath(); g.arc(b.x, b.y, BR, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
        }
      },
    };
    return game;
  },
});
