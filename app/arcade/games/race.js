// Rondje Rally – top-down race over één circuit, 3 rondjes.
ARCADE.register({
  id: "race", name: "Rondje Rally", emoji: "🏎️", color: "#b91c1c",
  tagline: "Top-down race: 3 rondjes, wie is het eerst binnen?",
  howto: ["Duw de stick de kant op waar je heen wilt rijden", "TURBO = even extra snel (laadt daarna weer op)", "Gras = langzaam · 3 rondjes · eerste over de finish wint"],
  min: 1, max: 8,
  pad: { type: "stick", buttons: [{ id: "A", label: "🔥 TURBO", color: "#ea580c" }] },
  create(A, players) {
    const { W, H } = A, HALF = 66, LAPS = 3, CR = 19, START_DELAY = 3;
    const ctrl = [[260, 200], [700, 165], [910, 305], [1110, 180], [1400, 225], [1475, 450], [1300, 565], [1425, 775], [1000, 805], [800, 655], [600, 795], [255, 775], [150, 565], [335, 455], [160, 325]];
    const pts = [];
    for (let i = 0, n = ctrl.length; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      for (let k = 0; k < 24; k++) {
        const t = k / 24, t2 = t * t, t3 = t2 * t;
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    const N = pts.length, START = 9;
    const dirAt = (i) => { const a = pts[(i - 2 + N) % N], b = pts[(i + 2) % N]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    // achtergrond met circuit één keer voortekenen
    const bg = document.createElement("canvas"); bg.width = W; bg.height = H; const b = bg.getContext("2d");
    b.fillStyle = "#3f6212"; b.fillRect(0, 0, W, H);
    b.fillStyle = "#4d7c0f"; for (let x = 0; x < W; x += 80) b.fillRect(x, 0, 40, H);
    const path = () => { b.beginPath(); pts.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y))); b.closePath(); };
    b.lineJoin = "round"; b.lineCap = "round";
    path(); b.lineWidth = HALF * 2 + 22; b.strokeStyle = "#dc2626"; b.setLineDash([22, 22]); b.stroke();
    path(); b.strokeStyle = "#f8fafc"; b.lineDashOffset = 22; b.stroke(); b.setLineDash([]);
    path(); b.lineWidth = HALF * 2; b.strokeStyle = "#374151"; b.stroke();
    path(); b.lineWidth = 3; b.strokeStyle = "rgba(255,255,255,.35)"; b.setLineDash([26, 26]); b.stroke(); b.setLineDash([]);
    { const [sx, sy] = pts[START], a = dirAt(START); b.save(); b.translate(sx, sy); b.rotate(a);
      for (let k = -HALF, r = 0; k < HALF; k += 12, r++) for (let c = 0; c < 2; c++) { b.fillStyle = (r + c) % 2 ? "#111" : "#fff"; b.fillRect(-12 + c * 12, k, 12, 12); }
      b.restore(); }
    // auto's op de startgrid
    const cars = players.map((p, i) => {
      const idx = (START - 5 - Math.floor(i / 2) * 4 + N) % N, [x, y] = pts[idx], a = dirAt(idx), side = i % 2 ? 1 : -1;
      return { p, x: x - Math.sin(a) * side * 26, y: y + Math.cos(a) * side * 26, a, vx: 0, vy: 0, idx, prevRel: (idx - START + N) % N, started: false, lap: 0, cps: new Set(), turbo: 0, tcd: 0, finishT: 0, off: false };
    });
    const rel = (i) => (i - START + N) % N;
    let t = 0, firstFinish = 0;
    function nearest(c) {
      let best = c.idx, bd = Infinity;
      for (let k = -25; k <= 25; k++) { const i = (c.idx + k + N) % N, d = (pts[i][0] - c.x) ** 2 + (pts[i][1] - c.y) ** 2; if (d < bd) { bd = d; best = i; } }
      if (bd > 170 * 170) for (let i = 0; i < N; i++) { const d = (pts[i][0] - c.x) ** 2 + (pts[i][1] - c.y) ** 2; if (d < bd) { bd = d; best = i; } }
      return [best, Math.sqrt(bd)];
    }
    const progress = (c) => (c.finishT ? 1e6 - c.finishT : c.started ? c.lap * N + rel(c.idx) : rel(c.idx) - N);
    const padFor = (c) => ({ type: "stick", msg: c.finishT ? "🏁 Binnen!" : `Ronde ${Math.min(LAPS, c.lap + 1)}/${LAPS}`, buttons: [{ id: "A", label: "🔥 TURBO", color: "#ea580c" }] });
    cars.forEach((c) => A.pad(c.p.id, padFor(c)));
    const game = {
      over: false, ranking: null,
      stat: (id) => { const c = cars.find((x) => x.p.id === id); return c.finishT ? `${c.finishT.toFixed(2)} s` : `ronde ${Math.min(LAPS, c.lap + 1)}/${LAPS}`; },
      update(dt) {
        t += dt;
        const raceT = t - START_DELAY, go = raceT >= 0;
        if (!go && Math.ceil(raceT) !== Math.ceil(raceT - dt)) A.sfx("tick");
        if (go && raceT - dt < 0) A.sfx("go");
        for (const c of cars) {
          const boost = A.hit(c.p.id, "A");
          c.tcd = Math.max(0, c.tcd - dt); c.turbo = Math.max(0, c.turbo - dt);
          if (!go) continue;
          const st = c.finishT ? { x: 0, y: 0 } : A.stick(c.p.id), mag = Math.min(1, Math.hypot(st.x, st.y));
          let fwd = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
          let throttle = 0;
          if (mag > 0.2) {
            const target = Math.atan2(st.y, st.x);
            const diff = ((target - c.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const turn = 3.6 * dt * Math.min(1, Math.abs(fwd) / 140 + 0.3);
            c.a += A.clamp(diff, -turn, turn);
            throttle = mag * (Math.abs(diff) > 1.7 ? 0.35 : 1);
          }
          if (boost && c.tcd <= 0 && !c.finishT) { c.turbo = 1.3; c.tcd = 5; A.sfx("jump"); }
          const [idx, d] = nearest(c); c.idx = idx; c.off = d > HALF;
          const ca = Math.cos(c.a), sa = Math.sin(c.a);
          fwd = c.vx * ca + c.vy * sa; let lat = -c.vx * sa + c.vy * ca;
          const maxV = (c.off ? 175 : 430) * (c.turbo > 0 ? 1.45 : 1);
          fwd += throttle * (c.turbo > 0 ? 900 : 620) * dt;
          fwd -= fwd * (c.off ? 1.6 : 0.5) * dt;
          if (fwd > maxV) fwd -= (fwd - maxV) * Math.min(1, 3 * dt);
          fwd = Math.max(-100, fwd);
          lat *= Math.max(0, 1 - (c.off ? 5 : 8) * dt);
          c.vx = ca * fwd - sa * lat; c.vy = sa * fwd + ca * lat;
          c.x = A.clamp(c.x + c.vx * dt, 20, W - 20); c.y = A.clamp(c.y + c.vy * dt, 70, H - 20);
          if (c.off && Math.abs(fwd) > 120 && Math.random() < 0.3) A.burst(c.x, c.y, ["#a16207", "#65a30d"], 2, 80, 0.4, 4);
          // ronden tellen (met controlepunten tegen afsnijden)
          const r = rel(c.idx);
          const q = Math.floor(r / (N / 4)); if (q >= 1 && q <= 3 && c.started) c.cps.add(q);
          if (c.prevRel > N * 0.75 && r < N * 0.25 && !c.finishT) {
            if (!c.started) c.started = true;
            else if (c.cps.size >= 3) {
              c.lap++; c.cps.clear(); A.sfx("coin");
              if (c.lap >= LAPS) {
                c.finishT = raceT; if (!firstFinish) firstFinish = raceT;
                A.sfx("good"); A.burst(c.x, c.y, [c.p.color, "#fff", "#facc15"], 30, 320);
                const place = cars.filter((x) => x.finishT).length;
                A.pad(c.p.id, { type: "wait", emoji: place === 1 ? "🏆" : "🏁", text: `Binnen als ${place}e!`, sub: `Tijd: ${c.finishT.toFixed(2)} s` });
              } else A.pad(c.p.id, padFor(c));
            }
          }
          c.prevRel = r;
        }
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], c = cars[j], dd = A.dist(a.x, a.y, c.x, c.y);
          if (dd < CR * 2 && dd > 0) {
            const nx = (c.x - a.x) / dd, ny = (c.y - a.y) / dd, o = (CR * 2 - dd) / 2;
            a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
            const rv = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
            if (rv > 0) { a.vx -= rv * nx * 0.9; a.vy -= rv * ny * 0.9; c.vx += rv * nx * 0.9; c.vy += rv * ny * 0.9; if (rv > 150) A.sfx("blip"); }
          }
        }
        const all = cars.every((c) => c.finishT);
        if (!game.over && (all || (firstFinish && raceT - firstFinish > 25) || raceT > 180)) {
          game.over = true;
          game.ranking = A.rankGroups(cars.map((c) => ({ id: c.p.id, key: [c.finishT ? 1 : 0, c.finishT ? -Math.round(c.finishT * 100) : Math.round(progress(c))] })));
        }
      },
      draw(g, clock) {
        g.drawImage(bg, 0, 0, W, H);
        for (const c of cars) {
          g.save(); g.translate(c.x, c.y); g.rotate(c.a);
          g.fillStyle = "rgba(0,0,0,.3)"; A.rr(g, -22, -11, 48, 28, 7); g.fill();
          if (c.turbo > 0) { g.fillStyle = Math.floor(clock * 20) % 2 ? "#f97316" : "#facc15"; g.beginPath(); g.moveTo(-24, -6); g.lineTo(-40 - Math.random() * 10, 0); g.lineTo(-24, 6); g.fill(); }
          g.fillStyle = "#111"; g.fillRect(-16, -15, 11, 5); g.fillRect(8, -15, 11, 5); g.fillRect(-16, 10, 11, 5); g.fillRect(8, 10, 11, 5);
          g.fillStyle = c.p.color; A.rr(g, -23, -12, 46, 24, 8); g.fill();
          g.fillStyle = "rgba(255,255,255,.85)"; A.rr(g, 6, -9, 10, 18, 3); g.fill();
          g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(-20, -3, 22, 6);
          g.restore();
          A.emoji(g, c.p.emoji, c.x, c.y, 16);
        }
        // klassement bovenin
        const order = cars.slice().sort((a, c) => progress(c) - progress(a));
        order.forEach((c, i) => {
          const x = 30 + i * 190;
          g.fillStyle = "rgba(0,0,0,.5)"; A.rr(g, x - 6, 14, 150, 40, 20); g.fill();
          A.txt(g, `${i + 1}.`, x + 6, 42, { size: 20 });
          A.avatar(g, c.p, x + 44, 34, 15);
          A.txt(g, c.finishT ? "🏁" : `${Math.min(LAPS, c.lap + 1)}/${LAPS}`, x + 66, 42, { size: 20, color: "#fde68a" });
        });
        const raceT = t - START_DELAY;
        if (raceT < 0) {
          const lit = Math.min(3, Math.floor(t) + 1);
          A.rr(g, W / 2 - 110, 380, 220, 80, 20); g.fillStyle = "rgba(0,0,0,.75)"; g.fill();
          for (let k = 0; k < 3; k++) { g.fillStyle = k < lit ? "#ef4444" : "#3f3f46"; g.beginPath(); g.arc(W / 2 - 65 + k * 65, 420, 24, 0, Math.PI * 2); g.fill(); }
        } else if (raceT < 1) {
          A.rr(g, W / 2 - 110, 380, 220, 80, 20); g.fillStyle = "rgba(0,0,0,.75)"; g.fill();
          for (let k = 0; k < 3; k++) { g.fillStyle = "#22c55e"; g.beginPath(); g.arc(W / 2 - 65 + k * 65, 420, 24, 0, Math.PI * 2); g.fill(); }
        } else A.pill(g, `⏱ ${raceT.toFixed(1)} s`, W - 110, 34, { size: 22 });
        if (firstFinish && !game.over) A.pill(g, `Nog ${Math.max(0, Math.ceil(25 - (raceT - firstFinish)))} s om binnen te komen!`, W / 2, 870, { size: 24, bg: "rgba(185,28,28,.85)" });
      },
    };
    return game;
  },
});
