// Kleurreflex – snel de juiste kleur drukken, maar je hersenen doen niet mee.
ARCADE.register({
  id: "stroop", name: "Kleurreflex", emoji: "🎨", color: "#db2777",
  tagline: "Druk snel de goede kleur – als je hoofd meewerkt",
  howto: ["Lees de opdracht en druk de juiste kleur op je telefoon", "Snelste goede antwoord = meeste punten · fout = -2", "Te vroeg drukken = -1 · 12 rondes"],
  min: 1, max: 8,
  pad: { type: "buttons", cols: 2, buttons: [{ id: "r", label: "ROOD", color: "#ef4444" }, { id: "b", label: "BLAUW", color: "#3b82f6" }, { id: "g", label: "GROEN", color: "#22c55e" }, { id: "y", label: "GEEL", color: "#eab308" }] },
  create(A, players) {
    const { W, H } = A, ROUNDS = 12;
    const C = [{ id: "r", name: "ROOD", c: "#ef4444" }, { id: "b", name: "BLAUW", c: "#3b82f6" }, { id: "g", name: "GROEN", c: "#22c55e" }, { id: "y", name: "GEEL", c: "#eab308" }];
    const st = players.map((p) => ({ p, score: 0, ans: null, ms: 0, early: false, gain: 0 }));
    let round = 0, phase = "ready", phT = 0, wait = 0, prompt = null, correctCount = 0;
    const RULES = {
      block: "Druk op deze KLEUR",
      ink: "Druk op de KLEUR van de letters",
      word: "Druk op wat er STAAT",
      not: "Druk op een ANDERE kleur dan deze!",
    };
    function next() {
      round++; phase = "ready"; phT = 0; wait = A.rand(1.2, 2.6); correctCount = 0;
      const type = round <= 3 ? "block" : round <= 6 ? "ink" : round <= 9 ? "word" : A.pick(["ink", "word", "not", "ink"]);
      const word = A.pick(C); let ink = A.pick(C); while (type !== "block" && type !== "not" && ink === word) ink = A.pick(C);
      prompt = { type, word, ink };
      st.forEach((s) => { s.ans = null; s.ms = 0; s.early = false; s.gain = 0; });
    }
    const isCorrect = (id) => {
      const { type, word, ink } = prompt;
      if (type === "block") return id === ink.id;
      if (type === "ink") return id === ink.id;
      if (type === "word") return id === word.id;
      return id !== ink.id;
    };
    next();
    const game = {
      over: false, ranking: null,
      stat: (id) => `${st.find((s) => s.p.id === id).score} punten`,
      update(dt) {
        phT += dt;
        for (const s of st) {
          for (const c of C) {
            if (!A.hit(s.p.id, c.id)) continue;
            if (phase === "ready" && !s.early) { s.early = true; s.score -= 1; s.gain = -1; A.sfx("bad"); A.buzz(s.p.id, 150); }
            else if (phase === "go" && !s.ans && !s.early) {
              s.ans = c.id; s.ms = Math.round(phT * 1000);
              if (isCorrect(c.id)) { s.gain = Math.max(1, 5 - correctCount); correctCount++; A.sfx("good"); }
              else { s.gain = -2; A.sfx("bad"); A.buzz(s.p.id, 200); }
              s.score += s.gain;
            }
          }
        }
        if (phase === "ready" && phT >= wait) { phase = "go"; phT = 0; A.sfx("tick"); }
        else if (phase === "go" && (phT > 4 || st.every((s) => s.ans || s.early))) { phase = "show"; phT = 0; }
        else if (phase === "show" && phT > 2.3) {
          if (round >= ROUNDS) { if (!game.over) { game.over = true; game.ranking = A.rankGroups(st.map((s) => ({ id: s.p.id, key: [s.score] }))); } }
          else next();
        }
      },
      draw(g, clock) {
        g.fillStyle = "#18181b"; g.fillRect(0, 0, W, H);
        A.pill(g, `Ronde ${round}/${ROUNDS}`, W / 2, 40, { size: 26 });
        A.txt(g, RULES[prompt.type], W / 2, 140, { size: 50, align: "center", color: "#f4f4f5", weight: 900 });
        if (phase === "ready") {
          A.txt(g, "Klaar…", W / 2, 420, { size: 120, align: "center", base: "middle", color: "#52525b", weight: 900, alpha: 0.6 + Math.sin(clock * 8) * 0.3 });
        } else {
          const { type, word, ink } = prompt;
          if (type === "block" || type === "not") {
            g.fillStyle = ink.c; A.rr(g, W / 2 - 220, 230, 440, 380, 40); g.fill();
            if (type === "not") A.txt(g, "🚫", W / 2, 420, { size: 160, align: "center", base: "middle" });
          } else {
            A.txt(g, word.name, W / 2, 420, { size: 230, align: "center", base: "middle", color: ink.c, weight: 900 });
          }
          if (phase === "show") {
            const good = C.filter((c) => isCorrect(c.id)).map((c) => c.name).join(" / ");
            A.pill(g, `Goed: ${good}`, W / 2, 660, { size: 30, bg: "rgba(34,197,94,.85)" });
          }
        }
        const n = st.length, gap = Math.min(190, 1500 / n);
        st.forEach((s, i) => {
          const x = W / 2 + (i - (n - 1) / 2) * gap, y = 780;
          A.avatar(g, s.p, x, y, 34);
          A.txt(g, `${s.score}`, x, y + 70, { size: 26, align: "center", color: "#facc15" });
          let tag = "";
          if (s.early) tag = "te vroeg!";
          else if (s.ans && phase !== "ready") tag = phase === "show" ? `${s.gain > 0 ? "✅ +" + s.gain : "❌ " + s.gain}  ${s.ms}ms` : "✔";
          if (tag) A.txt(g, tag, x, y - 48, { size: 20, align: "center", color: s.early || s.gain < 0 ? "#fca5a5" : "#86efac" });
        });
      },
    };
    return game;
  },
});
