// Eierbommen – fladderen boven de lava en elkaar bekogelen met eieren.
ARCADE.register({
  id: "eggs", name: "Eierbommen", emoji: "🥚", color: "#c2410c",
  tagline: "Fladder boven de lava en bekogel elkaar met eieren",
  howto: ["Duim links = vliegen naar links/rechts · FLAP = omhoog", "GOOI = ei gooien (raak = hartje eraf)", "Lava kost ook een hartje · laatste overlevende wint"],
  min: 2, max: 8,
  pad: { type: "stick", buttons: [{ id: "A", label: "🪽 FLAP", color: "#f59e0b" }, { id: "B", label: "🥚 GOOI", color: "#8b5cf6" }] },
  create(A, players) {
    const { W, H } = A, R = 24, LAVA = H - 60;
    const plats = [{ x: 170, y: 640, w: 270 }, { x: 1160, y: 640, w: 270 }, { x: 665, y: 470, w: 270 }, { x: 90, y: 300, w: 220 }, { x: 1290, y: 300, w: 220 }, { x: 640, y: 190, w: 320 }];
    const birds = players.map((p, i) => {
      const pl = plats[i % plats.length];
      return { p, x: pl.x + pl.w / 2 + (i >= plats.length ? 40 : 0), y: pl.y - R, vx: 0, vy: 0, face: i % 2 ? -1 : 1, lives: 3, inv: 1.5, cd: 0, alive: true, hits: 0, deathT: 0, wing: 0 };
    });
    const eggs = [];
    let t = 0;
    function hurt(b, by) {
      if (b.inv > 0 || !b.alive) return;
      b.lives--; b.inv = 1.8; A.buzz(b.p.id, 200); A.sfx("hit"); A.shake(6);
      A.burst(b.x, b.y, [b.p.color, "#fff", "#fde68a"], 22, 340);
      if (by && by !== b) by.hits++;
      if (b.lives <= 0) {
        b.alive = false; b.deathT = t; A.sfx("boom");
        A.pad(b.p.id, { type: "wait", emoji: "🍳", text: "Je bent gebakken!", sub: `${b.hits} keer raak gegooid` });
      }
    }
    const game = {
      over: false, ranking: null,
      stat: (id) => { const b = birds.find((x) => x.p.id === id); return `${b.hits} x raak · ${"♥".repeat(Math.max(0, b.lives))}`; },
      update(dt) {
        t += dt;
        for (const b of birds) {
          const flap = A.hit(b.p.id, "A"), shoot = A.hit(b.p.id, "B");
          if (!b.alive) continue;
          const st = A.stick(b.p.id);
          b.vx += (st.x * 380 - b.vx) * Math.min(1, dt * 6);
          if (Math.abs(st.x) > 0.2) b.face = Math.sign(st.x);
          if (flap) { b.vy = -520; b.wing = 1; A.sfx("flap"); }
          b.vy = Math.min(800, b.vy + 1300 * dt);
          const prevY = b.y;
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < -30) b.x += W + 60; if (b.x > W + 30) b.x -= W + 60;
          if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.3; }
          for (const pl of plats) if (b.vy >= 0 && prevY + R <= pl.y + 2 && b.y + R >= pl.y && b.x > pl.x - 10 && b.x < pl.x + pl.w + 10) { b.y = pl.y - R; b.vy = 0; }
          b.inv = Math.max(0, b.inv - dt); b.cd = Math.max(0, b.cd - dt); b.wing = Math.max(0, b.wing - dt * 4);
          if (b.y + R > LAVA) {
            hurt(b, null);
            A.burst(b.x, LAVA, ["#f97316", "#facc15", "#ef4444"], 20, 300);
            if (b.alive) { b.x = A.rand(200, W - 200); b.y = 80; b.vy = 0; b.vx = 0; }
          }
          if (shoot && b.cd <= 0) {
            b.cd = 0.4; A.sfx("shoot");
            eggs.push({ x: b.x + b.face * 28, y: b.y, vx: b.face * 860 + b.vx * 0.4, vy: -170, owner: b, life: 1.8, rot: 0 });
          }
        }
        for (let i = 0; i < birds.length; i++) for (let j = i + 1; j < birds.length; j++) {
          const a = birds[i], b = birds[j];
          if (!a.alive || !b.alive) continue;
          const d = A.dist(a.x, a.y, b.x, b.y);
          if (d < R * 2 && d > 0) { const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, push = (R * 2 - d) / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; const tv = a.vx; a.vx = b.vx; b.vx = tv; }
        }
        for (let i = eggs.length - 1; i >= 0; i--) {
          const e = eggs[i];
          e.life -= dt; e.vy += 700 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += dt * 12;
          if (e.x < -20) e.x += W + 40; if (e.x > W + 20) e.x -= W + 40;
          let gone = e.life <= 0 || e.y > LAVA;
          for (const pl of plats) if (e.x > pl.x && e.x < pl.x + pl.w && e.y > pl.y - 6 && e.y < pl.y + 30) gone = true;
          for (const b of birds) if (b.alive && b !== e.owner && A.dist(b.x, b.y, e.x, e.y) < R + 10) { if (b.inv <= 0) { hurt(b, e.owner); b.vx += e.vx * 0.5; b.vy = -320; } gone = true; }
          if (gone) { A.burst(e.x, e.y, ["#fff", "#fde047"], 10, 200, 0.5, 5); eggs.splice(i, 1); }
        }
        const alive = birds.filter((b) => b.alive).length;
        if (!game.over && (alive <= 1 || t > 120)) {
          game.over = true;
          game.ranking = A.rankGroups(birds.map((b) => ({ id: b.p.id, key: [b.alive ? 1 : 0, b.lives, b.alive ? 0 : Math.round(b.deathT * 10), b.hits] })));
        }
      },
      draw(g, clock) {
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#1e1b4b"); sky.addColorStop(0.7, "#7c2d12"); sky.addColorStop(1, "#ea580c");
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = "#fef3c7"; g.beginPath(); g.arc(1350, 140, 55, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#3b0764"; g.beginPath(); g.moveTo(0, LAVA);
        for (let x = 0; x <= W; x += 100) g.lineTo(x, LAVA - 150 - Math.sin(x * 0.01) * 80 - (x % 300 === 0 ? 60 : 0));
        g.lineTo(W, LAVA); g.fill();
        for (const pl of plats) {
          g.fillStyle = "rgba(0,0,0,.25)"; A.rr(g, pl.x + 6, pl.y + 10, pl.w, 26, 13); g.fill();
          g.fillStyle = "#f1f5f9";
          for (let x = pl.x + 20; x < pl.x + pl.w - 10; x += 34) { g.beginPath(); g.arc(x, pl.y + 8, 22, 0, Math.PI * 2); g.fill(); }
          A.rr(g, pl.x, pl.y, pl.w, 24, 12); g.fill();
        }
        const lg = g.createLinearGradient(0, LAVA - 20, 0, H); lg.addColorStop(0, "#facc15"); lg.addColorStop(0.4, "#f97316"); lg.addColorStop(1, "#b91c1c");
        g.fillStyle = lg; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) g.lineTo(x, LAVA + Math.sin(x * 0.03 + clock * 3) * 6);
        g.lineTo(W, H); g.fill();
        for (const e of eggs) { g.save(); g.translate(e.x, e.y); g.rotate(e.rot); g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#cbd5e1"; g.lineWidth = 2; g.stroke(); g.restore(); }
        for (const b of birds) {
          if (!b.alive) continue;
          const blink = b.inv > 0 && Math.floor(clock * 12) % 2 === 0;
          if (blink) continue;
          g.save(); g.translate(b.x, b.y); g.scale(b.face, 1);
          const wa = Math.sin(clock * 28) * 0.6 * b.wing + 0.25;
          g.fillStyle = "#fde68a"; g.save(); g.rotate(-0.5 - wa); g.beginPath(); g.ellipse(-16, -8, 22, 10, 0, 0, Math.PI * 2); g.fill(); g.restore();
          g.fillStyle = "#f97316"; g.beginPath(); g.moveTo(R - 4, -5); g.lineTo(R + 14, 0); g.lineTo(R - 4, 7); g.fill();
          g.restore();
          A.avatar(g, b.p, b.x, b.y, R);
          A.hearts(g, b.x, b.y - 36, b.lives, 3, 16);
        }
        A.timer(g, 120 - t);
        birds.forEach((b, i) => { const x = 60 + i * 70; A.avatar(g, b.p, x, 34, 18, { alpha: b.alive ? 1 : 0.3 }); A.txt(g, `${b.hits}`, x + 26, 44, { size: 18, color: "#fde68a" }); });
      },
    };
    return game;
  },
});
