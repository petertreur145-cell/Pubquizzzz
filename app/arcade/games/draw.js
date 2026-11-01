// Tekenfeest – iedereen tekent tegelijk dezelfde opdracht op zijn telefoon, de host kiest de mooiste.
ARCADE.register({
  id: "draw", name: "Tekenfeest", emoji: "🖍️", color: "#7e22ce",
  tagline: "Teken op je telefoon – de host kiest de mooiste",
  howto: ["Iedereen krijgt dezelfde opdracht en tekent 30 sec op zijn telefoon", "Daarna komen alle tekeningen (zonder naam) op het grote scherm", "De host klikt op de mooiste – 3 rondes, vaakst gekozen wint"],
  min: 2, max: 8,
  pad: { type: "wait", emoji: "🖍️", text: "Pak je potlood… de opdracht komt eraan!" },
  create(A, players) {
    const { W, H } = A, ROUNDS = 3, DRAW_T = 30, PICK_T = 75;
    const PROMPTS = [
      "Een olifant op een skateboard", "Een pinguïn op vakantie", "Een kat die pizza bezorgt", "Een draak die zijn verjaardag viert",
      "Een spook dat bang is in het donker", "Een haai in een badkuip", "Een koe op de maan", "Een robot die verliefd is",
      "Een giraf met een sjaal", "Een slak die racet", "Een banaan met een zonnebril", "Een superheld die de afwas doet",
      "Een dinosaurus die gitaar speelt", "Een aap in een net pak", "Een kip die autorijdt", "Een sneeuwpop in de zomer",
      "Een vis die kan vliegen", "Een eenhoorn op een fiets", "Het monster onder je bed", "Een piraat zonder schip",
      "Een octopus die kookt", "Een hamster in de sportschool", "Een ijsje dat smelt van de stress", "Een tovenaar die zijn toverstaf kwijt is",
      "Een beer die honing steelt", "Een hond die de krant leest", "Een raket gemaakt van groente", "Een kasteel op een wolk",
      "Een vampier bij de tandarts", "Een frietje dat surft", "Een schildpad met een jetpack", "Een uil die huiswerk maakt",
      "Een zeemeermin in de supermarkt", "Een cactus die wil knuffelen", "Een kabouter met een megafoon", "Een walvis in een aquarium",
      "Een paard op schaatsen", "Een boze tomaat", "Een ridder op een step", "Een verdwaalde alien",
      "Een vulkaan die niest", "Een egel bij de kapper", "Een koekje dat ontsnapt", "Een kangoeroe met een rugzak",
      "Een kerstboom op het strand", "Een wolk die huilt", "Een dansende zombie", "Een muis die een olifant optilt",
      "Een taart met benen", "Een flamingo die voetbalt", "Een tijger in pyjama", "Een fiets met vleugels",
      "Een luiaard die haast heeft", "Een chagrijnige clown", "Een ninja die struikelt", "Een pizza met een gezichtje",
      "Een ufo die een koe meeneemt", "Een stofzuiger die honger heeft", "Een gorilla die ballet doet", "Een broodje dat gaat trouwen",
    ];
    const prompts = A.shuffle(PROMPTS.slice()).slice(0, ROUNDS);
    const wins = {}; players.forEach((p) => (wins[p.id] = 0));
    let round = 0, phase = "", t = 0, roundId = "", imgs = {}, tiles = [], chosen = -1;
    const nameOf = (id) => (players.find((p) => p.id === id) || {}).name || "?";
    function startRound() {
      round++; phase = "draw"; t = 0; imgs = {}; tiles = []; chosen = -1;
      roundId = `r${round}-${Math.random().toString(36).slice(2, 7)}`;
      players.forEach((p) => A.pad(p.id, { type: "draw", id: roundId, prompt: prompts[round - 1], secs: DRAW_T, msg: `Ronde ${round}/${ROUNDS}` }));
      A.sfx("go");
    }
    function toCollect() {
      phase = "collect"; t = 0;
      players.forEach((p) => A.pad(p.id, { type: "wait", emoji: "⏰", text: "Tijd is om!", sub: "Kijk naar het grote scherm", msg: `Ronde ${round}/${ROUNDS}` }));
    }
    function layoutTiles() {
      const ids = A.shuffle(Object.keys(imgs));
      const n = ids.length, gap = 22, maxW = 1500, maxH = 690;
      // kies het raster waarin de tekeningen zo groot mogelijk worden
      let cols = 1, rows = 1, s = 0;
      for (let c = 1; c <= Math.max(1, n); c++) {
        const r = Math.ceil(n / c), size = Math.min((maxW - gap * (c - 1)) / c, (maxH - gap * (r - 1) - r * 40) / r);
        if (size > s) { s = size; cols = c; rows = r; }
      }
      const totalW = cols * s + (cols - 1) * gap, totalH = rows * (s + 40) + (rows - 1) * gap;
      const x0 = (W - totalW) / 2, y0 = 140 + (maxH - totalH) / 2;
      tiles = ids.map((id, i) => ({ id, img: imgs[id], x: x0 + (i % cols) * (s + gap), y: y0 + Math.floor(i / cols) * (s + gap + 40), s }));
    }
    function toGallery() {
      layoutTiles(); phase = "gallery"; t = 0;
      if (!tiles.length) { phase = "reveal"; t = 0; chosen = -1; return; }
      const vip = A.vip();
      players.forEach((p) => {
        if (p.id === vip) {
          const btns = tiles.map((tl, i) => ({ id: "d" + i, label: `#${i + 1}`, color: "#7e22ce", own: tl.id === p.id })).filter((b) => !b.own).map(({ id, label, color }) => ({ id, label, color }));
          if (btns.length) A.pad(p.id, { type: "buttons", cols: btns.length > 4 ? 3 : 2, msg: "👑 Kies de mooiste!", buttons: btns });
          else A.pad(p.id, { type: "wait", emoji: "👀", text: "Kies op het grote scherm de mooiste!" });
        } else A.pad(p.id, { type: "wait", emoji: "👀", text: "De host kiest de mooiste tekening…", sub: "Duimen maar!", msg: `Ronde ${round}/${ROUNDS}` });
      });
    }
    function choose(i) {
      if (phase !== "gallery" || !tiles[i]) return;
      chosen = i; phase = "reveal"; t = 0;
      const winner = tiles[i].id; wins[winner]++;
      A.sfx("win"); A.confetti(120);
      players.forEach((p) => A.pad(p.id, p.id === winner
        ? { type: "wait", emoji: "🏆", text: "Jouw tekening is gekozen!", sub: `Ronde ${round}/${ROUNDS}` }
        : { type: "wait", emoji: "🎨", text: `${nameOf(winner)} wint deze ronde`, sub: `Ronde ${round}/${ROUNDS}` }));
    }
    startRound();
    const game = {
      over: false, ranking: null, tiles: () => tiles, _round: () => roundId, _phase: () => phase, _t: () => t,
      stat: (id) => `${wins[id]} x gekozen`,
      onData(pid, m) {
        if (m.kind !== "drawing" || m.round !== roundId || (phase !== "draw" && phase !== "collect") || imgs[pid]) return;
        const im = new Image(); im.src = m.img; imgs[pid] = im;
        A.sfx("blip");
        if (phase === "draw" && players.every((p) => imgs[p.id])) toCollect();
      },
      onClick(x, y) {
        if (phase !== "gallery") return;
        tiles.forEach((tl, i) => { if (x > tl.x && x < tl.x + tl.s && y > tl.y && y < tl.y + tl.s) choose(i); });
      },
      update(dt) {
        t += dt;
        const vip = A.vip();
        for (const p of players) for (let i = 0; i < 8; i++) if (A.hit(p.id, "d" + i) && p.id === vip) choose(i);
        if (phase === "draw" && t >= DRAW_T + 0.5) toCollect();
        else if (phase === "collect" && (t > 3.5 || players.every((p) => imgs[p.id]))) toGallery();
        else if (phase === "gallery" && t > PICK_T) { phase = "reveal"; t = 0; chosen = -1; }
        else if (phase === "reveal" && t > 6) {
          if (round >= ROUNDS) { if (!game.over) { game.over = true; game.ranking = A.rankGroups(players.map((p) => ({ id: p.id, key: [wins[p.id]] }))); } }
          else startRound();
        }
      },
      draw(g, clock) {
        const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#2e1065"); bg.addColorStop(1, "#4c1d95");
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        A.pill(g, `Ronde ${round}/${ROUNDS}`, 120, 40, { size: 22 });
        if (phase === "draw" || phase === "collect") {
          A.txt(g, "Iedereen tekent:", W / 2, 200, { size: 40, align: "center", color: "#ddd6fe", weight: 700 });
          A.txt(g, `“${prompts[round - 1]}”`, W / 2, 300, { size: prompts[round - 1].length > 30 ? 62 : 74, align: "center", weight: 900, stroke: "#2e1065", strokeW: 10 });
          const left = Math.max(0, DRAW_T - t);
          if (phase === "draw") {
            g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 16; g.beginPath(); g.arc(W / 2, 470, 70, 0, Math.PI * 2); g.stroke();
            g.strokeStyle = left < 6 ? "#f87171" : "#facc15"; g.beginPath(); g.arc(W / 2, 470, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / DRAW_T); g.stroke();
            A.txt(g, String(Math.ceil(left)), W / 2, 492, { size: 60, align: "center", weight: 900 });
          } else A.txt(g, "⏰ Tijd is om! Tekeningen ophalen…", W / 2, 490, { size: 40, align: "center", color: "#facc15" });
          const n = players.length, gap = Math.min(180, 1500 / n);
          players.forEach((p, i) => {
            const x = W / 2 + (i - (n - 1) / 2) * gap, done = !!imgs[p.id];
            A.avatar(g, p, x, 680 + (done ? 0 : Math.sin(clock * 6 + i) * 5), 36, { alpha: done ? 1 : 0.75 });
            A.txt(g, p.name, x, 745, { size: 20, align: "center", color: "#e9d5ff" });
            A.txt(g, done ? "✅" : "✏️", x, 790, { size: 30, align: "center" });
          });
        } else {
          A.txt(g, `“${prompts[round - 1]}”`, W / 2, 70, { size: 44, align: "center", weight: 900, stroke: "#2e1065", strokeW: 8 });
          if (phase === "gallery") A.txt(g, "👑 Host: klik op de mooiste tekening!", W / 2, 118, { size: 28, align: "center", color: "#facc15", alpha: 0.75 + Math.sin(clock * 4) * 0.25 });
          if (!tiles.length) A.txt(g, "Niemand heeft iets getekend 🙈", W / 2, H / 2, { size: 50, align: "center" });
          tiles.forEach((tl, i) => {
            const win = phase === "reveal" && i === chosen, lift = win ? Math.sin(clock * 5) * 4 : 0;
            g.save(); g.translate(0, lift);
            if (win) { g.shadowColor = "#facc15"; g.shadowBlur = 40; }
            g.fillStyle = "#fff"; A.rr(g, tl.x, tl.y, tl.s, tl.s, 14); g.fill(); g.shadowBlur = 0;
            if (tl.img && tl.img.complete && tl.img.naturalWidth) { g.save(); A.rr(g, tl.x + 4, tl.y + 4, tl.s - 8, tl.s - 8, 10); g.clip(); g.drawImage(tl.img, tl.x + 4, tl.y + 4, tl.s - 8, tl.s - 8); g.restore(); }
            g.lineWidth = win ? 10 : 4; g.strokeStyle = win ? "#facc15" : "rgba(255,255,255,.25)"; A.rr(g, tl.x, tl.y, tl.s, tl.s, 14); g.stroke();
            A.pill(g, `#${i + 1}`, tl.x + 34, tl.y + 26, { size: 20, bg: "rgba(46,16,101,.85)" });
            if (phase === "reveal") {
              const p = players.find((q) => q.id === tl.id);
              if (p) { A.avatar(g, p, tl.x + 22, tl.y + tl.s + 22, 16); A.txt(g, p.name, tl.x + 46, tl.y + tl.s + 30, { size: 22, color: win ? "#facc15" : "#e9d5ff" }); }
              if (win) A.emoji(g, "🏆", tl.x + tl.s - 30, tl.y + 30, 44);
            }
            g.restore();
          });
          if (phase === "reveal" && chosen < 0 && tiles.length) A.pill(g, "Geen keuze gemaakt – niemand wint deze ronde", W / 2, 870, { size: 24 });
          if (phase === "gallery" && t > PICK_T - 15) A.pill(g, `Nog ${Math.ceil(PICK_T - t)} s om te kiezen`, W / 2, 870, { size: 22 });
        }
      },
    };
    return game;
  },
});
