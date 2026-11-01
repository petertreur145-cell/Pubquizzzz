// Fladderfeest – iedereen fladdert tegelijk door dezelfde torens. Laatste vogel in de lucht wint.
ARCADE.register({
  id: "flap", name: "Fladderfeest", emoji: "🐤", color: "#0284c7",
  tagline: "Fladder door de torens – wie houdt het langst vol?",
  howto: ["Tik op FLADDER om omhoog te gaan", "Raak geen toren en niet de grond", "⭐ = bonus · de laatste vogel in de lucht wint"],
  min: 1, max: 8,
  pad: { type: "buttons", cols: 1, buttons: [{ id: "A", label: "🪽 FLADDER", color: "#f59e0b" }] },
  create(A, players) {
    const { W, H } = A, GROUND = H - 70, R = 24, SPACING = 440;
    const birds = players.map((p, i) => ({ p, x: 230 + i * 44, y: H / 2 - 140 + (i % 4) * 70, vy: 0, alive: true, deathT: 0, stars: 0, wing: 0 }));
    const cols = [];
    let t = 0, speed = 300, dist = SPACING, lastGap = H / 2, groundX = 0;
    const clouds = Array.from({ length: 7 }, (_, i) => ({ x: i * 260 + A.rand(0, 120), y: A.rand(60, 330), s: A.rand(0.7, 1.4) }));
    const game = {
      over: false, ranking: null,
      stat: (id) => { const b = birds.find((x) => x.p.id === id); return `${(b.alive ? t : b.deathT).toFixed(1)} s · ${b.stars} ⭐`; },
      update(dt) {
        t += dt;
        const flying = t > 1.3;
        speed = Math.min(570, 300 + t * 6);
        groundX = (groundX + speed * dt) % 60;
        for (const c of clouds) { c.x -= speed * 0.15 * c.s * dt; if (c.x < -200) { c.x = W + 100; c.y = A.rand(60, 330); } }
        if (t > 1.6) {
          dist += speed * dt;
          if (dist >= SPACING) {
            dist = 0;
            const gap = Math.max(200, 320 - t * 2.2);
            lastGap = A.clamp(lastGap + A.rand(-240, 240), 110 + gap / 2, GROUND - 50 - gap / 2);
            const moving = t > 18 && Math.random() < 0.4;
            cols.push({ x: W + 60, w: 110, gy: lastGap, cy: lastGap, gap, amp: moving ? A.rand(45, 85) : 0, ph: A.rand(0, 6), hue: A.irand(0, 360), star: Math.random() < 0.5 });
          }
        }
        for (const c of cols) { c.x -= speed * dt; c.cy = c.gy + Math.sin(t * 1.7 + c.ph) * c.amp; }
        while (cols.length && cols[0].x < -160) cols.shift();

        for (const b of birds) {
          const pressed = A.hit(b.p.id, "A");
          if (!b.alive) { b.vy += 2000 * dt; b.y += b.vy * dt; b.x -= speed * 0.6 * dt; continue; }
          if (!flying) { b.vy = 0; b.y += Math.sin(t * 6 + b.x) * 0.6; continue; }
          if (pressed) { b.vy = -600; b.wing = 1; A.sfx("flap"); }
          b.vy = Math.min(900, b.vy + 1900 * dt);
          b.y += b.vy * dt;
          b.wing = Math.max(0, b.wing - dt * 4);
          if (b.y < R) { b.y = R; b.vy = Math.max(0, b.vy); }
          let dead = b.y + R > GROUND;
          for (const c of cols) {
            if (b.x + R * 0.8 > c.x && b.x - R * 0.8 < c.x + c.w && (b.y - R * 0.8 < c.cy - c.gap / 2 || b.y + R * 0.8 > c.cy + c.gap / 2)) dead = true;
            if (c.star && A.dist(b.x, b.y, c.x + c.w / 2, c.cy) < R + 24) { c.star = false; b.stars++; A.sfx("coin"); A.burst(c.x + c.w / 2, c.cy, ["#facc15", "#fde68a"], 14, 260); }
          }
          if (dead) {
            b.alive = false; b.deathT = t; b.vy = -350;
            A.burst(b.x, b.y, [b.p.color, "#fff"], 26, 380); A.sfx("hit"); A.shake(10); A.buzz(b.p.id, 250);
            A.pad(b.p.id, { type: "wait", emoji: "💥", text: "Neergestort!", sub: `Je hield het ${t.toFixed(1)} seconden vol` });
          }
        }
        const alive = birds.filter((b) => b.alive).length;
        if (!game.over && (alive === 0 || (birds.length > 1 && alive <= 1) || t > 150)) {
          game.over = true;
          game.ranking = A.rankGroups(birds.map((b) => ({ id: b.p.id, key: [b.alive ? 1 : 0, b.alive ? 0 : Math.round(b.deathT * 10), b.stars] })));
        }
      },
      draw(g, clock) {
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#38bdf8"); sky.addColorStop(1, "#e0f2fe");
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = "#fde047"; g.beginPath(); g.arc(1380, 130, 70, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,255,255,.9)";
        for (const c of clouds) { for (const [dx, dy, r] of [[0, 0, 40], [40, -18, 48], [85, 0, 38], [45, 12, 40]]) { g.beginPath(); g.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2); g.fill(); } }
        g.fillStyle = "#86efac";
        for (let i = -1; i < 10; i++) { const x = i * 220 - ((t * speed * 0.3) % 220); g.beginPath(); g.ellipse(x, GROUND, 170, 110, 0, Math.PI, 0); g.fill(); }
        for (const c of cols) {
          const top = c.cy - c.gap / 2, bot = c.cy + c.gap / 2;
          const body = `hsl(${c.hue},70%,52%)`, dark = `hsl(${c.hue},70%,36%)`;
          g.fillStyle = body; g.fillRect(c.x, 0, c.w, top); g.fillRect(c.x, bot, c.w, GROUND - bot);
          g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(c.x + 12, 0, 14, top); g.fillRect(c.x + 12, bot, 14, GROUND - bot);
          g.fillStyle = "rgba(255,255,255,.55)";
          for (let wy = top - 60; wy > 10; wy -= 50) { g.fillRect(c.x + 40, wy, 18, 22); g.fillRect(c.x + 72, wy, 18, 22); }
          for (let wy = bot + 40; wy < GROUND - 30; wy += 50) { g.fillRect(c.x + 40, wy, 18, 22); g.fillRect(c.x + 72, wy, 18, 22); }
          g.fillStyle = dark; A.rr(g, c.x - 10, top - 26, c.w + 20, 26, 6); g.fill(); A.rr(g, c.x - 10, bot, c.w + 20, 26, 6); g.fill();
          if (c.star) A.emoji(g, "⭐", c.x + c.w / 2, c.cy, 38 + Math.sin(clock * 6) * 5);
        }
        g.fillStyle = "#65a30d"; g.fillRect(0, GROUND, W, H - GROUND);
        g.fillStyle = "#4d7c0f"; for (let x = -groundX; x < W; x += 60) g.fillRect(x, GROUND + 12, 30, 10);
        g.fillStyle = "#a16207"; g.fillRect(0, GROUND + 40, W, H - GROUND - 40);
        for (const b of birds) {
          g.save(); g.translate(b.x, b.y); g.globalAlpha = b.alive ? 1 : 0.5;
          const flapA = b.alive ? Math.sin(clock * 30) * 0.5 * b.wing + 0.2 : 0;
          g.fillStyle = "#fff"; g.save(); g.rotate(-0.4 - flapA); g.beginPath(); g.ellipse(-14, -6, 20, 10, 0, 0, Math.PI * 2); g.fill(); g.restore();
          g.fillStyle = "#f97316"; g.beginPath(); g.moveTo(R - 4, -5); g.lineTo(R + 14, 0); g.lineTo(R - 4, 7); g.fill();
          g.restore();
          A.avatar(g, b.p, b.x, b.y, R, { angle: A.clamp(b.vy / 1000, -0.5, 1), alpha: b.alive ? 1 : 0.5 });
          if (b.alive && t < 6) A.label(g, b.p, b.x, b.y - 36, 15);
        }
        const alive = birds.filter((b) => b.alive).length;
        A.pill(g, `🐤 ${alive} in de lucht`, 130, 34, { size: 22 });
        A.pill(g, `⏱ ${t.toFixed(0)} s`, W / 2, 34, { size: 24 });
        if (t < 1.3) A.txt(g, "Klaar…", W / 2, H / 2 - 80, { size: 70, align: "center", color: "#fff", stroke: "#0369a1", strokeW: 10, weight: 900 });
      },
    };
    return game;
  },
});
