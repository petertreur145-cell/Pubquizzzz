// Sprint & Spring – om en om tikken om te rennen, springen over de horden.
ARCADE.register({
  id: "sprint", name: "Hordenrace", emoji: "🏃", color: "#b45309",
  tagline: "Tik je duimen blauw en spring over de horden",
  howto: ["Tik om en om op L en R om te rennen (twee keer dezelfde = struikelen)", "SPRING vlak voor een horde", "Eerst over de finish op 100 meter wint"],
  min: 1, max: 8,
  pad: { type: "buttons", cols: 2, buttons: [{ id: "J", label: "⤴ SPRING", color: "#16a34a", span: 2 }, { id: "L", label: "👟 L", color: "#2563eb" }, { id: "R", label: "R 👟", color: "#dc2626" }] },
  create(A, players) {
    const { W, H } = A, X0 = 190, X1 = 1490, PX = (X1 - X0) / 100, HURDLES = [20, 36, 52, 68, 84], TOPY = 190, AREA = 680, START = 3;
    const n = players.length, LH = Math.min(110, AREA / n), Y0 = TOPY + (AREA - LH * n) / 2;
    const run = players.map((p, i) => ({ p, lane: i, d: 0, v: 0, foot: null, air: 0, stumble: 0, finishT: 0, knocked: new Set(), cycle: 0 }));
    let t = 0;
    const crowd = Array.from({ length: 220 }, () => ({ x: Math.random() * W, y: A.rand(20, 140), c: A.pick(["#f87171", "#60a5fa", "#4ade80", "#facc15", "#c084fc", "#fb923c", "#f9fafb"]), ph: Math.random() * 6 }));
    const game = {
      over: false, ranking: null,
      stat: (id) => { const r = run.find((x) => x.p.id === id); return r.finishT ? `${r.finishT.toFixed(2)} s` : `${Math.floor(r.d)} m`; },
      update(dt) {
        t += dt;
        const go = t >= START, raceT = t - START;
        if (go && t - dt < START) A.sfx("go");
        if (!go && Math.floor(t) !== Math.floor(t - dt) && t > 0.5) A.sfx("tick");
        for (const r of run) {
          const tapL = A.hit(r.p.id, "L"), tapR = A.hit(r.p.id, "R"), jump = A.hit(r.p.id, "J");
          if (!go || r.finishT) { if (r.finishT) { r.v = Math.max(0, r.v - 6 * dt); r.d += r.v * dt; } continue; }
          r.stumble = Math.max(0, r.stumble - dt);
          for (const [tap, foot] of [[tapL, "L"], [tapR, "R"]]) {
            if (!tap || r.air > 0 || r.stumble > 0) continue;
            if (r.foot !== foot) { r.v = Math.min(11, r.v + 0.5); r.foot = foot; }
            else { r.v = Math.max(0, r.v - 0.6); }
          }
          if (jump && r.air <= 0 && r.stumble <= 0) { r.air = 0.6; A.sfx("jump"); }
          r.v = Math.max(0, r.v - (1.0 + 0.3 * r.v) * dt * (r.air > 0 ? 0.3 : 1));
          const prev = r.d;
          r.d += r.v * dt; r.cycle += r.v * dt * 1.6;
          if (r.air > 0) r.air = Math.max(0, r.air - dt);
          for (const h of HURDLES) {
            if (prev < h && r.d >= h && !r.knocked.has(h)) {
              if (r.air > 0.06 && r.air < 0.55) { A.sfx("blip"); }
              else { r.knocked.add(h); r.v *= 0.3; r.stumble = 0.5; A.sfx("bad"); A.buzz(r.p.id, 200); A.burst(X0 + h * PX, Y0 + (r.lane + 0.6) * LH, ["#fff", "#94a3b8"], 12, 200, 0.5); }
            }
          }
          if (r.d >= 100) {
            r.finishT = raceT - (r.d - 100) / Math.max(1, r.v);
            A.sfx("good"); A.burst(X1, Y0 + (r.lane + 0.5) * LH, [r.p.color, "#fff", "#facc15"], 24, 300);
            const place = run.filter((x) => x.finishT).length;
            A.pad(r.p.id, { type: "wait", emoji: place === 1 ? "🥇" : "🏁", text: `Finish! ${r.finishT.toFixed(2)} s`, sub: `Je kwam als ${place}e binnen` });
          }
        }
        if (!game.over && go && (run.every((r) => r.finishT) || raceT > 45)) {
          game.over = true;
          game.ranking = A.rankGroups(run.map((r) => ({ id: r.p.id, key: [r.finishT ? 1 : 0, r.finishT ? -Math.round(r.finishT * 100) : Math.round(r.d * 10)] })));
        }
      },
      draw(g, clock) {
        g.fillStyle = "#334155"; g.fillRect(0, 0, W, 160);
        for (const c of crowd) { g.fillStyle = c.c; g.beginPath(); g.arc(c.x, c.y + Math.sin(clock * 8 + c.ph) * 3, 9, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#1e293b"; g.fillRect(0, 150, W, 14);
        g.fillStyle = "#16a34a"; g.fillRect(0, 164, W, H - 164);
        g.fillStyle = "#c2410c"; g.fillRect(0, Y0, W, LH * n);
        g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3;
        for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(0, Y0 + i * LH); g.lineTo(W, Y0 + i * LH); g.stroke(); }
        for (let m = 10; m < 100; m += 10) A.txt(g, `${m}`, X0 + m * PX, Y0 - 8, { size: 16, align: "center", color: "rgba(255,255,255,.7)" });
        g.fillStyle = "#fff"; g.fillRect(X0 - 3, Y0, 6, LH * n);
        for (let y = Y0, k = 0; y < Y0 + LH * n; y += 14, k++) { g.fillStyle = k % 2 ? "#000" : "#fff"; g.fillRect(X1 - 7, y, 7, 14); g.fillStyle = k % 2 ? "#fff" : "#000"; g.fillRect(X1, y, 7, 14); }
        for (const r of run) {
          const ly = Y0 + r.lane * LH;
          for (const h of HURDLES) {
            const hx = X0 + h * PX;
            if (r.knocked.has(h)) { g.fillStyle = "#e5e7eb"; g.fillRect(hx - 4, ly + LH * 0.72, 30, 6); }
            else { g.fillStyle = "#e5e7eb"; g.fillRect(hx - 2, ly + LH * 0.35, 4, LH * 0.5); g.fillStyle = "#111"; g.fillRect(hx - 6, ly + LH * 0.32, 12, 8); g.fillStyle = "#fff"; g.fillRect(hx - 6, ly + LH * 0.32, 6, 8); }
          }
        }
        for (const r of run) {
          const ly = Y0 + r.lane * LH, x = X0 + Math.min(r.d, 104) * PX, rr = LH * 0.3;
          const jumpH = r.air > 0 ? Math.sin(Math.PI * (1 - r.air / 0.6)) * LH * 0.55 : 0;
          const y = ly + LH * 0.55 - jumpH - Math.abs(Math.sin(r.cycle * 3)) * Math.min(6, r.v);
          g.strokeStyle = "#111"; g.lineWidth = 4;
          const sw = Math.sin(r.cycle * 3) * 0.7;
          g.beginPath(); g.moveTo(x, y + rr * 0.8); g.lineTo(x + Math.sin(sw) * rr, y + rr * 1.6); g.moveTo(x, y + rr * 0.8); g.lineTo(x - Math.sin(sw) * rr, y + rr * 1.6); g.stroke();
          A.avatar(g, r.p, x, y, rr, { angle: r.stumble > 0 ? Math.sin(clock * 30) * 0.4 : 0 });
          A.txt(g, r.p.name, 20, ly + LH * 0.5 + 7, { size: Math.min(22, LH * 0.3), color: "#fff", stroke: "rgba(0,0,0,.5)", strokeW: 4 });
          if (r.finishT) A.txt(g, `${r.finishT.toFixed(2)} s`, X1 + 20, ly + LH * 0.5 + 7, { size: Math.min(24, LH * 0.3), color: "#facc15", stroke: "#000", strokeW: 4 });
        }
        if (t < START) {
          const txt = t < 1 ? "OP UW PLAATSEN…" : t < 2 ? "KLAAR…" : "…";
          A.txt(g, txt, W / 2, H / 2, { size: 90, align: "center", base: "middle", stroke: "#000", strokeW: 12, weight: 900 });
        } else if (t < START + 0.8) A.txt(g, "PAF! 🔫", W / 2, H / 2, { size: 120, align: "center", base: "middle", color: "#facc15", stroke: "#000", strokeW: 12, weight: 900 });
        else A.pill(g, `⏱ ${(t - START).toFixed(1)} s`, W / 2, 40, { size: 26 });
      },
    };
    return game;
  },
});
