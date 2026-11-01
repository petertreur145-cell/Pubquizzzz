// Slangenkuil – eet appels, word lang en laat de anderen tegen jou aan botsen.
ARCADE.register({
  id: "snake", name: "Slangenkuil", emoji: "🐍", color: "#15803d",
  tagline: "Eet, groei en laat de rest tegen je aan knallen",
  howto: ["Pijltjes = je slang sturen", "🍎 = langer worden · ⭐ = extra veel langer", "Muur of slang raken = af · laatste slang wint (gelijk? langste wint)"],
  min: 1, max: 8,
  pad: { type: "dpad" },
  create(A, players) {
    const { W, H } = A, CW = 40, CH = 22, CS = 36, OX = (W - CW * CS) / 2, OY = 90;
    const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
    const OPP = { U: "D", D: "U", L: "R", R: "L" };
    const starts = [[4, 3, "R"], [35, 18, "L"], [35, 3, "L"], [4, 18, "R"], [4, 10, "R"], [35, 11, "L"], [20, 4, "D"], [19, 17, "U"]];
    const snakes = players.map((p, i) => {
      const [x, y, d] = starts[i];
      const body = []; for (let k = 0; k < 4; k++) body.push([x - DIRS[d][0] * k, y - DIRS[d][1] * k]);
      return { p, body, dir: d, queue: [], alive: true, deathT: 0, grow: 0 };
    });
    const food = [];
    const occupied = (x, y) => snakes.some((s) => s.alive && s.body.some(([bx, by]) => bx === x && by === y)) || food.some((f) => f.x === x && f.y === y);
    const addFood = (kind) => { for (let k = 0; k < 50; k++) { const x = A.irand(1, CW - 2), y = A.irand(1, CH - 2); if (!occupied(x, y)) { food.push({ x, y, kind }); return; } } };
    for (let i = 0; i < players.length + 4; i++) addFood("apple");
    let t = 0, acc = 0;
    function kill(s) {
      s.alive = false; s.deathT = t;
      const [hx, hy] = s.body[0];
      A.burst(OX + (hx + 0.5) * CS, OY + (hy + 0.5) * CS, [s.p.color, "#fff"], 28, 360);
      A.sfx("hit"); A.shake(8); A.buzz(s.p.id, 250);
      s.body.forEach(([x, y], i) => { if (i % 2 === 0 && x >= 0 && y >= 0 && x < CW && y < CH) food.push({ x, y, kind: "bit", color: s.p.color }); });
      A.pad(s.p.id, { type: "wait", emoji: "💀", text: "Gebotst!", sub: `Je werd ${s.body.length} lang` });
    }
    function tick() {
      for (const s of snakes) {
        if (!s.alive) continue;
        while (s.queue.length) { const d = s.queue.shift(); if (d !== OPP[s.dir] && d !== s.dir) { s.dir = d; break; } }
        const [hx, hy] = s.body[0];
        s.next = [hx + DIRS[s.dir][0], hy + DIRS[s.dir][1]];
      }
      for (const s of snakes) {
        if (!s.alive) continue;
        s.body.unshift(s.next);
        if (s.grow > 0) s.grow--; else s.body.pop();
      }
      const dead = new Set();
      for (const s of snakes) {
        if (!s.alive) continue;
        const [x, y] = s.body[0];
        if (x < 0 || y < 0 || x >= CW || y >= CH) { dead.add(s); continue; }
        for (const o of snakes) {
          if (!o.alive) continue;
          for (let i = 0; i < o.body.length; i++) {
            if (o === s && i === 0) continue;
            if (o.body[i][0] === x && o.body[i][1] === y) { dead.add(s); if (i === 0) dead.add(o); }
          }
        }
      }
      dead.forEach(kill);
      for (const s of snakes) {
        if (!s.alive) continue;
        const [x, y] = s.body[0];
        const fi = food.findIndex((f) => f.x === x && f.y === y);
        if (fi >= 0) {
          const f = food[fi]; food.splice(fi, 1);
          s.grow += f.kind === "star" ? 5 : f.kind === "apple" ? 2 : 1;
          A.sfx(f.kind === "bit" ? "blip" : "coin");
          if (f.kind !== "bit") addFood(Math.random() < 0.12 ? "star" : "apple");
        }
      }
    }
    const game = {
      over: false, ranking: null,
      stat: (id) => `lengte ${snakes.find((s) => s.p.id === id).body.length}`,
      update(dt) {
        t += dt;
        for (const s of snakes) {
          for (const d of ["U", "D", "L", "R"]) if (A.hit(s.p.id, d) && s.alive) { const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir; if (d !== last && d !== OPP[last] && s.queue.length < 3) s.queue.push(d); }
        }
        if (t < 1) return;
        acc += dt;
        const step = Math.max(0.065, 0.12 - t * 0.0007);
        while (acc >= step) { acc -= step; tick(); }
        const alive = snakes.filter((s) => s.alive).length;
        if (!game.over && (alive === 0 || (snakes.length > 1 && alive <= 1) || t > 150)) {
          game.over = true;
          game.ranking = A.rankGroups(snakes.map((s) => ({ id: s.p.id, key: [s.alive ? 1 : 0, s.alive ? 0 : Math.round(s.deathT * 10), s.body.length] })));
        }
      },
      draw(g, clock) {
        g.fillStyle = "#052e16"; g.fillRect(0, 0, W, H);
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { g.fillStyle = (x + y) % 2 ? "#14532d" : "#166534"; g.fillRect(OX + x * CS, OY + y * CS, CS, CS); }
        g.strokeStyle = "#4ade80"; g.lineWidth = 6; g.strokeRect(OX - 3, OY - 3, CW * CS + 6, CH * CS + 6);
        for (const f of food) {
          const cx = OX + (f.x + 0.5) * CS, cy = OY + (f.y + 0.5) * CS;
          if (f.kind === "bit") { g.fillStyle = f.color; g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill(); }
          else A.emoji(g, f.kind === "star" ? "⭐" : "🍎", cx, cy, 28 + Math.sin(clock * 5 + f.x) * 3);
        }
        for (const s of snakes) {
          if (!s.alive) continue;
          for (let i = s.body.length - 1; i >= 1; i--) {
            const [x, y] = s.body[i];
            g.fillStyle = s.p.color; g.globalAlpha = 1 - (i / s.body.length) * 0.45;
            A.rr(g, OX + x * CS + 3, OY + y * CS + 3, CS - 6, CS - 6, 9); g.fill();
          }
          g.globalAlpha = 1;
          const [hx, hy] = s.body[0];
          A.avatar(g, s.p, OX + (hx + 0.5) * CS, OY + (hy + 0.5) * CS, CS * 0.58);
        }
        A.pill(g, `⏱ ${Math.floor(t)} s`, W - 100, 44, { size: 24 });
        snakes.forEach((s, i) => { const x = 70 + i * 150; A.avatar(g, s.p, x, 44, 20, { alpha: s.alive ? 1 : 0.3 }); A.txt(g, `${s.body.length}`, x + 28, 53, { size: 24, color: s.alive ? "#bbf7d0" : "#64748b" }); });
        if (t < 1) A.txt(g, "Klaar…", W / 2, H / 2, { size: 80, align: "center", base: "middle", stroke: "#052e16", strokeW: 10, weight: 900 });
      },
    };
    return game;
  },
});
