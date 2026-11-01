// Tankslag – rijd rond, schiet stuiterende kogels en blijf als laatste over.
ARCADE.register({
  id: "tanks", name: "Tankslag", emoji: "💣", color: "#a16207",
  tagline: "Stuiterende kogels in een arena vol muren",
  howto: ["Duim links = rijden · VUUR = schieten", "Kogels stuiteren 2x tegen muren (pas op voor je eigen!)", "3 levens · laatste tank die rijdt wint"],
  min: 2, max: 8,
  pad: { type: "stick", buttons: [{ id: "A", label: "💥 VUUR", color: "#dc2626" }] },
  create(A, players) {
    const { W, H } = A, TOP = 80, R = 26;
    const border = [[0, 0, W, TOP], [0, H - 30, W, 30], [0, 0, 40, H], [W - 40, 0, 40, H]];
    const layouts = [
      [[300, 200, 50, 220], [1250, 480, 50, 220], [650, 300, 300, 40], [650, 560, 300, 40], [300, 640, 220, 40], [1080, 240, 220, 40]],
      [[775, 260, 50, 380], [520, 425, 560, 50], [240, 250, 170, 40], [1190, 250, 170, 40], [240, 620, 170, 40], [1190, 620, 170, 40]],
      [[365, 265, 70, 70], [765, 265, 70, 70], [1165, 265, 70, 70], [365, 615, 70, 70], [765, 615, 70, 70], [1165, 615, 70, 70], [565, 440, 70, 70], [965, 440, 70, 70]],
    ];
    const walls = border.concat(A.pick(layouts));
    const spawns = [[120, 150, 0.6], [1480, 800, 3.7], [1480, 150, 2.5], [120, 800, -0.6], [800, 140, 1.57], [800, 810, -1.57], [110, 475, 0], [1490, 475, 3.14]];
    const tanks = players.map((p, i) => ({ p, x: spawns[i][0], y: spawns[i][1], a: spawns[i][2], lives: 3, inv: 1.5, cd: 0, alive: true, kills: 0, deathT: 0, tread: 0 }));
    const bullets = [];
    let t = 0;
    function pushOut(o, r) {
      for (const [x, y, w, h] of walls) {
        const cx = A.clamp(o.x, x, x + w), cy = A.clamp(o.y, y, y + h), dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
        if (d < r) { if (d > 0.01) { o.x = cx + dx / d * r; o.y = cy + dy / d * r; } else { o.y = y - r; } }
      }
    }
    const inWall = (x, y, pad = 0) => walls.find(([wx, wy, ww, wh]) => x > wx - pad && x < wx + ww + pad && y > wy - pad && y < wy + wh + pad);
    function hurt(tk, by) {
      tk.lives--; tk.inv = 1.4; A.sfx("boom"); A.shake(10); A.buzz(tk.p.id, 250);
      A.burst(tk.x, tk.y, ["#f97316", "#facc15", "#78716c", tk.p.color], 30, 380);
      if (by && by !== tk) by.kills++;
      if (tk.lives <= 0) { tk.alive = false; tk.deathT = t; A.pad(tk.p.id, { type: "wait", emoji: "💀", text: "Je tank is kapot!", sub: `${tk.kills} keer raak geschoten` }); }
    }
    const game = {
      over: false, ranking: null,
      stat: (id) => { const tk = tanks.find((x) => x.p.id === id); return `${tk.kills} x raak · ${"♥".repeat(Math.max(0, tk.lives))}`; },
      update(dt) {
        t += dt;
        for (const tk of tanks) {
          const fire = A.hit(tk.p.id, "A");
          if (!tk.alive) continue;
          tk.inv = Math.max(0, tk.inv - dt); tk.cd = Math.max(0, tk.cd - dt);
          const st = A.stick(tk.p.id), mag = Math.min(1, Math.hypot(st.x, st.y));
          if (mag > 0.25) {
            const target = Math.atan2(st.y, st.x);
            let diff = ((target - tk.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const turn = 7 * dt;
            tk.a += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
            diff = ((target - tk.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const sp = 250 * mag * (Math.abs(diff) < 1.1 ? 1 : 0.25);
            tk.x += Math.cos(tk.a) * sp * dt; tk.y += Math.sin(tk.a) * sp * dt; tk.tread += sp * dt;
          }
          pushOut(tk, R);
          if (fire && tk.cd <= 0 && bullets.filter((b) => b.owner === tk).length < 3) {
            const bx = tk.x + Math.cos(tk.a) * 38, by = tk.y + Math.sin(tk.a) * 38;
            if (!inWall(bx, by, 4)) { bullets.push({ x: bx, y: by, vx: Math.cos(tk.a) * 560, vy: Math.sin(tk.a) * 560, owner: tk, bounces: 2, life: 4, age: 0 }); tk.cd = 0.3; A.sfx("shoot"); }
          }
        }
        for (let i = 0; i < tanks.length; i++) for (let j = i + 1; j < tanks.length; j++) {
          const a = tanks[i], b = tanks[j]; if (!a.alive || !b.alive) continue;
          const d = A.dist(a.x, a.y, b.x, b.y);
          if (d < R * 2 && d > 0) { const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, p = (R * 2 - d) / 2; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p; }
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.life -= dt; b.age += dt;
          let gone = b.life <= 0;
          for (let s = 0; s < 3 && !gone; s++) {
            const px = b.x, py = b.y;
            b.x += b.vx * dt / 3; b.y += b.vy * dt / 3;
            const wl = inWall(b.x, b.y, 5);
            if (wl) {
              if (b.bounces-- <= 0) { gone = true; break; }
              const [wx, wy, ww, wh] = wl;
              const wasInX = px > wx - 5 && px < wx + ww + 5, wasInY = py > wy - 5 && py < wy + wh + 5;
              if (!wasInX) b.vx = -b.vx; if (!wasInY) b.vy = -b.vy; if (wasInX && wasInY) { b.vx = -b.vx; b.vy = -b.vy; }
              b.x = px; b.y = py; A.sfx("blip");
            }
            for (const tk of tanks) {
              if (!tk.alive || tk.inv > 0) continue;
              if ((tk !== b.owner || b.age > 0.25) && A.dist(tk.x, tk.y, b.x, b.y) < R + 5) { hurt(tk, b.owner); gone = true; break; }
            }
          }
          if (gone) { A.burst(b.x, b.y, ["#fde68a", "#78716c"], 8, 160, 0.4, 4); bullets.splice(i, 1); continue; }
          for (let j = i - 1; j >= 0; j--) { const o = bullets[j]; if (A.dist(o.x, o.y, b.x, b.y) < 10) { A.burst(b.x, b.y, "#fde68a", 10, 200); bullets.splice(i, 1); bullets.splice(j, 1); i--; break; } }
        }
        const alive = tanks.filter((tk) => tk.alive).length;
        if (!game.over && (alive <= 1 || t > 150)) {
          game.over = true;
          game.ranking = A.rankGroups(tanks.map((tk) => ({ id: tk.p.id, key: [tk.alive ? 1 : 0, tk.lives, tk.alive ? 0 : Math.round(tk.deathT * 10), tk.kills] })));
        }
      },
      draw(g, clock) {
        g.fillStyle = "#c8a865"; g.fillRect(0, 0, W, H);
        g.fillStyle = "rgba(120,90,40,.18)";
        for (let y = TOP; y < H; y += 60) for (let x = 40 + ((y / 60) % 2) * 30; x < W; x += 60) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
        for (const [x, y, w, h] of walls) {
          g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 6, y + 8, w, h);
          g.fillStyle = "#57534e"; g.fillRect(x, y, w, h);
          g.fillStyle = "#78716c"; g.fillRect(x, y, w, Math.min(8, h));
        }
        for (const b of bullets) { g.fillStyle = "#1c1917"; g.beginPath(); g.arc(b.x, b.y, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fbbf24"; g.beginPath(); g.arc(b.x - 1.5, b.y - 1.5, 2, 0, Math.PI * 2); g.fill(); }
        for (const tk of tanks) {
          if (!tk.alive) { g.fillStyle = "rgba(28,25,23,.5)"; g.beginPath(); g.arc(tk.x, tk.y, R, 0, Math.PI * 2); g.fill(); continue; }
          if (tk.inv > 0 && Math.floor(clock * 12) % 2) continue;
          g.save(); g.translate(tk.x, tk.y); g.rotate(tk.a);
          g.fillStyle = "#292524"; g.fillRect(-30, -26, 60, 12); g.fillRect(-30, 14, 60, 12);
          g.fillStyle = "#57534e"; for (let k = -30 + (tk.tread % 10); k < 30; k += 10) { g.fillRect(k, -26, 3, 12); g.fillRect(k, 14, 3, 12); }
          g.fillStyle = tk.p.color; A.rr(g, -26, -17, 52, 34, 8); g.fill();
          g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(4, -5, 36, 10);
          g.fillStyle = "#1c1917"; g.fillRect(34, -4, 8, 8);
          g.restore();
          A.avatar(g, tk.p, tk.x, tk.y, 15);
          A.hearts(g, tk.x, tk.y - 38, tk.lives, 3, 16);
        }
        A.timer(g, 150 - t);
        tanks.forEach((tk, i) => { const x = 70 + i * 90; A.avatar(g, tk.p, x, 40, 18, { alpha: tk.alive ? 1 : 0.3 }); A.txt(g, `${tk.kills}`, x + 26, 50, { size: 20, color: "#fde68a" }); });
      },
    };
    return game;
  },
});
