import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ========================= Matrix background ============================== */
function MatrixBackground({ hidden }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (hidden) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });

    const fontSize = 16;
    const chars =
      "アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    let w = 0, h = 0, columns = 0, drops = [];
    let raf = 0;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(w / fontSize);
      drops = new Array(columns).fill(0).map(() => (Math.random() * h) / fontSize);
    };

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#00ff7f";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[(Math.random() * chars.length) | 0];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillText(text, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [hidden]);

  return <canvas ref={canvasRef} className={`fixed inset-0 z-0 block pointer-events-none ${hidden ? "hidden" : ""}`} />;
}

/* ============================== Utilities ================================= */
const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); }, []);
  return now;
};
const borderCol = "border-emerald-400/30";
const frame = `rounded-[4px] ${borderCol} border shadow-[0_0_6px_rgba(0,255,127,0.25)_inset]`;

/* ============================== SFX system =================================
   Tiny WebAudio sound designer: playSfx("open"|"close"|...)
   Controlled by master volume + mute in the mixer. */
function useSfx(masterVol, muted) {
  const ctxRef = useRef(null);

  const withCtx = async () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const tone = async (freq = 440, dur = 0.1, type = "sine", gain = 0.5) => {
    if (muted || masterVol <= 0) return;
    const ctx = await withCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(ctx.destination);

    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, gain * masterVol));
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.03, dur));

    osc.start(now);
    osc.stop(now + dur + 0.05);
  };

  const play = async (name) => {
    switch (name) {
      case "menu":      return tone(520, 0.08, "square", 0.35);
      case "open":      await tone(440, 0.08, "triangle", 0.4); return tone(660, 0.07, "triangle", 0.35);
      case "close":     return tone(220, 0.12, "sawtooth", 0.35);
      case "minimize":  return tone(320, 0.08, "triangle", 0.35);
      case "success":   await tone(523, 0.08, "sine", 0.45); await tone(659, 0.08, "sine", 0.45); return tone(784, 0.14, "sine", 0.45);
      case "error":     await tone(150, 0.14, "square", 0.45); return tone(110, 0.12, "square", 0.45);
      case "flag":      return tone(650, 0.06, "square", 0.35);
      case "reveal":    return tone(360, 0.06, "triangle", 0.3);
      case "boom":      await tone(90, 0.18, "sawtooth", 0.5); return tone(60, 0.18, "sawtooth", 0.5);
      default: return;
    }
  };

  return play;
}

/* =========================== Desktop Icon ================================= */
const DesktopIcon = ({ src, label, onOpen, playSfx }) => (
  <button
    onDoubleClick={() => { playSfx("open"); onOpen(); }}
    className="group flex w-24 flex-col items-center gap-1 bg-transparent p-1 text-xs text-emerald-300/85 hover:text-emerald-200 focus:outline-none"
    title={`${label} (double-click)`}
  >
    <img
      src={src}
      alt={label}
      draggable={false}
      className="h-12 w-12 select-none transition group-hover:scale-105 group-hover:drop-shadow-[0_0_10px_rgba(0,255,127,0.6)]"
    />
    <span className="pointer-events-none text-center font-mono text-[11px] opacity-85 group-hover:opacity-100">
      {label}
    </span>
  </button>
);

/* ========================= Window controls ================================= */
const ControlButton = ({ kind, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`grid h-6 w-6 place-items-center ${borderCol} border bg-black/40 text-emerald-300 hover:bg-emerald-400/10 active:bg-emerald-400/20 rounded-[3px]`}
    style={{ lineHeight: 0 }}
  >
    {kind === "min" ? (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden shapeRendering="crispEdges" vectorEffect="non-scaling-stroke">
        <rect x="2" y="6" width="8" height="1" fill="#00ff7f" />
      </svg>
    ) : (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden shapeRendering="crispEdges" vectorEffect="non-scaling-stroke">
        <path d="M3 3 L9 9 M9 3 L3 9" stroke="#00ff7f" strokeWidth="1" />
      </svg>
    )}
  </button>
);

/* ================================ Window =================================== */
function MatrixWindow({ app, content: Content, z, onClose, onMinimize, onFocus, boundsRef, inject }) {
  return (
    <motion.div
      drag dragMomentum={false} dragElastic={0}
      dragConstraints={boundsRef}
      onMouseDown={onFocus}
      style={{ zIndex: z }}
      className={`absolute select-none overflow-hidden ${frame} bg-[rgba(0,0,0,0.7)] backdrop-blur-[2px]`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 250, damping: 22 }}
    >
      <div className={`flex items-center gap-2 border-b ${borderCol} px-2 py-1`}>
        <span className="font-mono text-[12px] text-emerald-300">{app.title}</span>
        <div className="ml-auto flex items-center gap-1">
          <ControlButton kind="min" onClick={onMinimize} title="Minimize" />
          <ControlButton kind="close" onClick={onClose} title="Close" />
        </div>
      </div>
      <div className="max-h-[70vh] min-w-[360px] max-w-[80vw] overflow-auto p-3 font-mono text-[13px] text-emerald-200/90">
        <Content {...(inject || {})} />
      </div>
    </motion.div>
  );
}

/* =========================== App stubs ===================================== */
const AboutApp = () => <p>$ whoami → Developer</p>;
//const ExperienceApp = () => <p>Jobs list goes here</p>;
const ProjectsApp = () => <p>Projects list goes here</p>;
const ResumeApp = () => <a href="/CV.pdf" download>Download CV.pdf</a>;
//const ContactApp = () => <p>Contact links</p>;

/* ================= Secret (password gate with jokes) ======================= */
function SecretApp({ playSfx }) {
  const [guess, setGuess] = React.useState("");
  const [msg, setMsg] = React.useState('');
  const [ok, setOk]   = React.useState(false);
  const [shakeKey, setShakeKey] = React.useState(0);

  const FUNNY = {
    "password": "ha ha, never heard of that one before. totally new. 🙃",
    "123456": "ah yes, the Fort Knox strategy.",
    "123456789": "longer ≠ stronger—nice try.",
    "12345678": "retro 2010 vibes, but still no.",
    "12345": "high five for effort. denied ✋",
    "qwerty": "keyboard walks don’t open vaults.",
    "letmein": "polite, but security doesn’t do manners.",
    "admin": "admin… of disappointment.",
    "welcome": "thanks! but also: no.",
    "login": "meta… and wrong.",
    "abc123": "starting from the basics, I see.",
    "111111": "unique! (in the worst way).",
    "123123": "twice the numbers, zero the access.",
    "iloveyou": "🥹 sweet—but bribery won’t work here.",
    "starwars": "these are not the creds you’re looking for.",
    "dragon": "you didn’t slay this one.",
    "monkey": "🐒 flung… and missed.",
    "football": "flag on the play: password foul.",
    "baseball": "strike three. you’re out.",
    "passw0rd": "leet speak ain’t so elite anymore."
  };
  const normalize = (s) => s.trim().toLowerCase();

  const onSubmit = (e) => {
    e.preventDefault();
    const g = normalize(guess);
    if (!g) {
      setMsg("the password can’t be this invisible.");
      setShakeKey(k => k + 1);
      playSfx("error");
      return;
    }
    if (g === "thejobisyours") {
      setOk(true);
      setMsg("✅ ACCESS GRANTED — Thank you for viewing my work!");
      playSfx("success");
      return;
    }
    if (FUNNY[g]) {
      setMsg(FUNNY[g]);
    } else {
      setMsg("Nope. Hint: it’s a full phrase… and very flattering.");
    }
    setOk(false);
    setShakeKey(k => k + 1);
    playSfx("error");
  };

  return (
    <div className="grid min-h-[52vh] place-items-center">
      <div className="w-full max-w-[560px] text-center">
        <h2 className="mb-4 font-mono text-2xl text-emerald-300">🔒 ENTER PASSWORD</h2>
        <motion.form
          key={shakeKey}
          onSubmit={onSubmit}
          initial={{ x: 0 }}
          animate={{ x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          <input
            type="password"
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="••••••••••"
            className={`w-full rounded-md border px-5 py-5 text-2xl tracking-widest focus:outline-none
                        ${ok ? "border-emerald-400 bg-black/40" : "border-emerald-400/50 bg-black/50"}`}
          />
          <button type="submit" className="mt-3 w-full rounded-md border border-emerald-400/40 bg-black/60 px-4 py-3 font-mono text-sm text-emerald-200 hover:bg-emerald-400/10">
            Unlock
          </button>
        </motion.form>
        <div className={`mt-4 min-h-[2.5rem] font-mono ${ok ? "text-emerald-400" : "text-emerald-300/80"}`}>
          {msg}
        </div>
      </div>
    </div>
  );
}

/* =============================== Mines Game ================================ */
const MINES_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="%2300ff7f" stroke-width="1.5"><circle cx="10" cy="14" r="5" fill="%2300ff7f22"/><path d="M14 10l4-4M16 4h4v4" /><circle cx="18" cy="6" r="2" fill="%2300ff7f"/></svg>';

function MinesApp({ playSfx }) {
  const presets = {
    Beginner: { w: 9, h: 9, m: 10 },
    Intermediate: { w: 16, h: 16, m: 40 },
    Expert: { w: 30, h: 16, m: 99 },
  };
  const [level, setLevel] = useState("Beginner");
  const [{ w, h, m }, setDims] = useState(presets.Beginner);
  const [board, setBoard] = useState([]);
  const [placed, setPlaced] = useState(false);
  const [flags, setFlags] = useState(0);
  const [lost, setLost] = useState(false);
  const [won, setWon] = useState(false);
  const [startAt, setStartAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startAt || lost || won) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startAt, lost, won]);

  useEffect(() => {
    const cells = Array(w * h).fill(0).map(() => ({ r: false, f: false, mine: false, adj: 0 }));
    setBoard(cells); setPlaced(false); setFlags(0); setLost(false); setWon(false); setStartAt(null); setElapsed(0);
  }, [w, h, m]);

  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && x < w && y >= 0 && y < h;
  const nbors = (i) => {
    const x = i % w, y = Math.floor(i / w);
    const out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (dx || dy) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) out.push(idx(nx, ny)); }
    return out;
  };

  const placeMines = (safeIndex) => {
    const taken = new Set([safeIndex]);
    const mines = new Set();
    while (mines.size < m) {
      const r = Math.floor(Math.random() * w * h);
      if (!taken.has(r) && !mines.has(r)) mines.add(r);
    }
    const next = board.map((c, i) => ({ ...c, mine: mines.has(i) }));
    for (let i = 0; i < next.length; i++) {
      next[i].adj = nbors(i).reduce((a, j) => a + (next[j].mine ? 1 : 0), 0);
    }
    setBoard(next);
    setPlaced(true);
  };

  const revealAllMines = () => setBoard((b) => b.map((c) => (c.mine ? { ...c, r: true } : c)));

  const checkWin = (b) => {
    const safeRevealed = b.every((c) => (c.mine ? true : c.r));
    if (safeRevealed) { setWon(true); setStartAt(null); playSfx("success"); }
  };

  const flood = (start) => {
    const next = board.slice();
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      const c = next[i];
      if (c.r || c.f) continue;
      c.r = true;
      if (c.adj === 0 && !c.mine) for (const j of nbors(i)) if (!next[j].r && !next[j].f) stack.push(j);
    }
    setBoard(next);
    checkWin(next);
  };

  const leftClick = (i) => {
    if (lost || won) return;
    if (!placed) { placeMines(i); setStartAt(Date.now()); }
    setBoard((cur) => {
      const c = cur[i];
      if (c.f || c.r) return cur;
      const next = cur.slice();
      if (c.mine) {
        next[i] = { ...c, r: true }; setLost(true); setStartAt(null);
        setTimeout(revealAllMines, 50); playSfx("boom"); return next;
      }
      if (c.adj === 0) { setBoard(next); setTimeout(() => flood(i), 0); playSfx("reveal"); return next; }
      next[i] = { ...c, r: true }; checkWin(next); playSfx("reveal"); return next;
    });
  };

  const rightClick = (e, i) => {
    e.preventDefault(); if (lost || won) return;
    setBoard((cur) => {
      const c = cur[i]; if (c.r) return cur;
      const next = cur.slice(); next[i] = { ...c, f: !c.f };
      setFlags((f) => f + (next[i].f ? 1 : -1)); playSfx("flag"); return next;
    });
  };

  const reset = (presetKey = level) => {
    const p = presets[presetKey]; setLevel(presetKey); setDims(p);
  };

  const numberColors = {1:"text-emerald-200",2:"text-emerald-300",3:"text-emerald-400",4:"text-emerald-500",5:"text-emerald-600",6:"text-emerald-400",7:"text-emerald-300",8:"text-emerald-200"};
  const MineIcon = () => (<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="5" fill="#00ff7f" opacity="0.25" /><circle cx="12" cy="12" r="3.5" stroke="#00ff7f" strokeWidth="1" fill="none" /></svg>);
  const FlagIcon = () => (<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 21V5m0 0h8l-2 3l2 3H6" stroke="#00ff7f" strokeWidth="1.2" fill="none" /></svg>);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={level} onChange={(e) => reset(e.target.value)} className={`rounded-md border ${borderCol} bg-black/60 px-2 py-1 text-emerald-200`}>
          {Object.keys(presets).map((k) => (<option key={k} value={k}>{k}</option>))}
        </select>
        <button className={`rounded-md border ${borderCol} bg-black/60 px-3 py-1 hover:bg-emerald-400/10`} onClick={() => reset()}>New Game</button>
        <div className="ml-auto flex items-center gap-3">
          <span>Mines: {m - flags}</span><span>Time: {elapsed}s</span>
          {lost && <span className="text-red-400">💥 Boom!</span>}
          {won && <span className="text-emerald-400">✔ You win!</span>}
        </div>
      </div>
      <div className="inline-grid rounded-md border border-emerald-400/20 bg-black/40 p-1" style={{ gridTemplateColumns: `repeat(${w}, 24px)` }}>
        {board.map((c, i) => (
          <button key={i} onClick={() => leftClick(i)} onContextMenu={(e) => rightClick(e, i)}
            className={`grid h-6 w-6 place-items-center border border-emerald-400/20 text-[12px] leading-none ${c.r ? "bg-black/60" : "bg-emerald-400/10 hover:bg-emerald-400/20"}`}>
            {c.r ? (c.mine ? <MineIcon /> : c.adj ? <span className={`${numberColors[c.adj]}`}>{c.adj}</span> : "") : c.f ? <FlagIcon /> : ""}
          </button>
        ))}
      </div>
      <p className="opacity-60">Tip: Left-click to reveal, right-click to flag. First click is always safe.</p>
    </div>
  );
}

/* ======================= About Me ======================= */
function AboutMeApp() {
  const PHOTO = "/media/Me.jpg"; 

  const SCRIPT = `Hi there! Thanks for peeking into my little Matrix OS. 
(…wait—you’re actually reviewing this? *clears throat*) 

I’m Andreas Ioannou, a Computer Science & Communications graduate from the University of Thessaly.
I’m happiest building software—clean UI, sturdy logic, and a bit of playful polish. 
I enjoy the whole CS spectrum too: cybersecurity, cryptography, and tinkering with applied AI (YOLO and friends).

Day to day I’m pretty full-stack: React, TypeScript/JavaScript, CSS/Tailwind, and a dash of Three.js when things need depth. 
I love turning rough ideas into working tools.

The personal bit: as a kid I was obsessed with computers (okay… mostly the games), 
but what really hooked me later was my first little Python automation. It took way too many tries to get right— 
and when it finally worked, the feeling was amazing. Something I made… actually made life easier. 
That moment set my path.

I worked while studying, pushed through the hard parts, and finished my degree. 
Now I’m excited to learn from experienced teammates, ship real features, and keep leveling up as a developer.

Anyway—enjoy wandering around this weird portfolio OS. 
Let’s call it… not quite a CV, more like a tiny world that shows what I can do. 😄`;

  const SPEED = 60; // ms per character (fixed)

  const [i, setI] = React.useState(0);
  const done = i >= SCRIPT.length;

  React.useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setI(n => Math.min(n + 1, SCRIPT.length)), SPEED);
    return () => clearTimeout(t);
  }, [i, done]);

  const boxRef = React.useRef(null);
  React.useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [i]);

  return (
    <div className="grid items-start gap-4 md:grid-cols-[180px,1fr]">
      {/* Photo */}
      <div className="mx-auto w-[160px]">
        <img
          src={PHOTO}
          alt="Andreas Ioannou"
          className={`h-[160px] w-[160px] rounded-lg object-cover border ${borderCol}
                      shadow-[0_0_12px_rgba(0,255,127,0.25)]`}
          draggable={false}
        />
      </div>

      {/* Typing panel */}
      <div className="space-y-3">
        <div className={`rounded-lg border ${borderCol} bg-black/55 backdrop-blur-[2px]`}>
          {/* title bar */}
          <div className={`flex items-center justify-between border-b ${borderCol} px-3 py-1 text-[12px] font-mono text-emerald-300/90`}>
            <span>about.txt — nano</span>
            <span className="opacity-70">UTF-8</span>
          </div>

          {/* text (auto-typing) */}
          <div
            ref={boxRef}
            className="max-h-[48vh] min-h-[220px] overflow-auto p-3 font-mono text-[13px] leading-6 text-emerald-100"
            style={{ whiteSpace: "pre-wrap" }}
            aria-live="polite"
          >
            {SCRIPT.slice(0, i)}
            {!done && <span className="ml-[1px] inline-block animate-pulse">▌</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Experience (meme + timeline) ============================ */
function ExperienceApp() {
  // animated "downloading experience" bar for the meme
  const [pct, setPct] = React.useState(60);
  React.useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => (p >= 95 ? 55 : p + 1));
    }, 80);
    return () => clearInterval(id);
  }, []);

  const Row = ({ icon, title, place, time, children }) => (
    <div className={`rounded-lg border ${borderCol} bg-black/55 p-3`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md border border-emerald-400/30 bg-black/40 text-xl">
          <span aria-hidden>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[13px] text-emerald-200">{title}</div>
          <div className="text-[12px] text-emerald-300/80">
            {place} • {time}
          </div>
          {children && <div className="mt-2 text-[12px] opacity-85">{children}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Meme header */}
      <div className={`rounded-lg border ${borderCol} bg-black/55 p-4`}>
        <div className="text-center font-mono text-lg text-emerald-300">
          ME IRL: Graduating in ~1 month 🎓 (yes i lied on about me .I AM GETTING MY degree at NOVEMBER SO LET ME LIVE THE DREAM)
        </div>
        <div className="mt-1 text-center text-[12px] opacity-80">experience.exe downloading…</div>

        <div className="mt-3 overflow-hidden rounded border border-emerald-400/30 bg-emerald-400/10">
          <div
            className="h-4 bg-emerald-400/60 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-emerald-300/70">{pct}%</div>

        <div className="mt-2 text-center text-[12px] opacity-75">
          Meanwhile: I can brew elite coffee ☕ and keep phones calm ☎️
        </div>
      </div>

      {/* Timeline-ish cards */}
      <div className="grid gap-3 md:grid-cols-2">
        <Row icon="☎️" title="Technical Customer Support" place="Teleperformance" time="~1 year">
          Troubleshooting, ticketing, patient communication, and keeping cool under pressure.
          Learned a lot about user empathy and clear explanations.
        </Row>

        <Row icon="🍽️" title="Waiter" place="Seasonal (summer)" time="2 seasons">
          Fast service, teamwork, and juggling ten things at once without dropping a smile.
        </Row>

        <Row icon="☕" title="Barman / Barista" place="Various venues" time="~1 year">
          Espresso art + late-night shift stamina. Great training for focus and rhythm.
        </Row>

        <Row icon="💻" title="Student & Personal Projects" place="University of Thessaly" time="ongoing">
          Full-stack projects with React/TypeScript/CSS, some Three.js, Python automations, a YOLO dabble,
          and this Matrix-style OS (with terminal, mines, stylophone, 2D TRON, etc.).
        </Row>
      </div>

      {/* What I'm aiming for */}
      <div className={`rounded-lg border ${borderCol} bg-black/55 p-3`}>
        <div className="mb-2 font-mono text-[12px] text-emerald-300/90">What I’m aiming for</div>
        <ul className="ml-5 list-disc text-[12px] opacity-90">
          <li>Junior Software Developer (front-end or full-stack)</li>
          <li>Learn from an experienced team, ship real features</li>
          <li>Keep leveling up in React/TypeScript and general CS craft</li>
        </ul>
      </div>
    </div>
  );
}



/* =============================== Contact ================================== */
function ContactApp() {
  const contacts = {
    linkedin: "https://www.linkedin.com/in/andreas-ioannou-4805b7222/",
    github: "https://github.com/IoannouAndreas",
    email: "ioannou.andreas20@gmail.com",
  };

  const [copied, setCopied] = React.useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const Card = ({ href, title, subtitle, icon, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-center gap-3 rounded-lg border ${borderCol} bg-black/55 px-3 py-3 hover:bg-emerald-400/10`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-md border border-emerald-400/30 bg-black/40 text-emerald-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-sm text-emerald-200">{title}</div>
        <div className="truncate text-[12px] text-emerald-300/80">{subtitle}</div>
      </div>
      {children}
    </a>
  );

  const EmailCard = () => (
    <div
      className={`flex items-center gap-3 rounded-lg border ${borderCol} bg-black/55 px-3 py-3`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-md border border-emerald-400/30 bg-black/40 text-emerald-300">
        {/* @ icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ffbf" strokeWidth="1.5">
          <path d="M16 8a4 4 0 1 0 0 8h1v-8" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="font-mono text-sm text-emerald-200">Email</div>
        <div className="truncate text-[12px] text-emerald-300/80">{contacts.email}</div>
        <div className="mt-1 flex gap-2">
          <a
            href={`mailto:${contacts.email}`}
            className={`rounded-md border ${borderCol} bg-black/40 px-2 py-1 text-[12px] text-emerald-200 hover:bg-emerald-400/10`}
          >
            Open mail app
          </a>
          <button
            onClick={() => copy(contacts.email)}
            className={`rounded-md border ${borderCol} bg-black/40 px-2 py-1 text-[12px] text-emerald-200 hover:bg-emerald-400/10`}
          >
            Copy email
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card
        href={contacts.linkedin}
        title="LinkedIn"
        subtitle="andreas-ioannou-4805b7222"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#00ffbf">
            <path d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4zM8 8h3.8v2.05h.05c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.07V23h-4v-6.6c0-1.57-.03-3.6-2.2-3.6-2.2 0-2.53 1.72-2.53 3.5V23h-4z"/>
          </svg>
        }
      />
      <Card
        href={contacts.github}
        title="GitHub"
        subtitle="IoannouAndreas"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#00ffbf">
            <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58l-.02-2.04c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.24 1.83 1.24 1.07 1.84 2.81 1.31 3.5 1.01.11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.9 0-1.3.47-2.36 1.24-3.19-.12-.3-.54-1.51.12-3.14 0 0 1-.32 3.3 1.22a11.4 11.4 0 0 1 6 0c2.3-1.54 3.3-1.22 3.3-1.22.66 1.63.24 2.84.12 3.14.77.83 1.24 1.89 1.24 3.19 0 4.59-2.81 5.59-5.49 5.89.43.37.81 1.09.81 2.2l-.01 3.26c0 .32.22.7.82.58A12 12 0 0 0 12 .5z" />
          </svg>
        }
      />
      <div className="sm:col-span-2">
        <EmailCard />
      </div>

      {/* tiny copied toast */}
      {copied && (
        <div className="fixed right-4 bottom-24 z-50 rounded-md border border-emerald-400/40 bg-black/80 px-3 py-1 text-sm text-emerald-200 shadow">
          Copied!
        </div>
      )}
    </div>
  );
}


/* ============================ Stylophone App =============================== */
/* Click/touch to play; slide while pressed for classic stylus feel.
   Keyboard: z s x d c v g b h n j m ,  l  .  ;  /  (C4..E5)
*/
const STYLO_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="%2300ff7f" stroke-width="1.5"><rect x="2" y="2" width="60" height="36" rx="4" fill="%2300ff7f11"/><path d="M6 28H58" /><path d="M8 12h48v10H8z" /><circle cx="12" cy="22" r="1.5" /><circle cx="20" cy="22" r="1.5" /><circle cx="28" cy="22" r="1.5" /><circle cx="36" cy="22" r="1.5" /><circle cx="44" cy="22" r="1.5" /><circle cx="52" cy="22" r="1.5" /></svg>';

function StylophoneApp({ playSfx }) {
  const ctxRef = React.useRef(null);
  const masterRef = React.useRef(null);
  const oscRef = React.useRef(null);
  const ampRef = React.useRef(null);
  const lfoRef = React.useRef(null);
  const lfoGainRef = React.useRef(null);

  const [isDown, setIsDown] = React.useState(false);
  const [active, setActive] = React.useState(null); // midi of current note

  const [wave, setWave]       = React.useState("square");
  const [oct, setOct]         = React.useState(0);           // -2..+2
  const [glide, setGlide]     = React.useState(0.03);        // seconds
  const [vRate, setVRate]     = React.useState(5);           // Hz
  const [vDepth, setVDepth]   = React.useState(12);          // cents
  const [sustain, setSustain] = React.useState(false);
  const [vol, setVol]         = React.useState(0.8);         // 0..1

  const midiStrip = React.useMemo(() => {
    // C4 (60) .. C6 (84) – 25 semitones like a real stylophone strip
    return Array.from({ length: 25 }, (_, i) => 60 + i);
  }, []);

  const KEY_TO_MIDI = React.useMemo(() => ({
    // z s x d c v g b h n j m ,  l  .  ;  /
    z: 60, s: 61, x: 62, d: 63, c: 64, v: 65, g: 66, b: 67, h: 68, n: 69,
    j: 70, m: 71, ',': 72, l: 73, '.': 74, ';': 75, '/': 76
  }), []);

  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const ensureAudio = async () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;

      // main gain → destination
      const master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
      masterRef.current = master;

      // synth: OSC → AMP → MASTER
      const amp = ctx.createGain();
      amp.gain.value = 0;
      ampRef.current = amp;

      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = 440;
      osc.connect(amp);
      osc.start();
      oscRef.current = osc;

      // vibrato: lfo → (gain depth) → osc.detune
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = vRate;
      lfoGain.gain.value = vDepth; // cents
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start();
      lfoRef.current = lfo;
      lfoGainRef.current = lfoGain;

      amp.connect(master);
    } else {
      if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    }
  };

  // live-param updates
  React.useEffect(() => { if (oscRef.current) oscRef.current.type = wave; }, [wave]);
  React.useEffect(() => { if (masterRef.current) masterRef.current.gain.value = vol; }, [vol]);
  React.useEffect(() => { if (lfoRef.current) lfoRef.current.frequency.value = vRate; }, [vRate]);
  React.useEffect(() => { if (lfoGainRef.current) lfoGainRef.current.gain.value = vDepth; }, [vDepth]);

  const noteOn = async (midi) => {
    await ensureAudio();
    const ctx = ctxRef.current;
    const osc = oscRef.current;
    const amp = ampRef.current;

    const now = ctx.currentTime;
    const target = midiToHz(midi + oct * 12);

    // glide/portamento
    osc.frequency.cancelScheduledValues(now);
    if (glide > 0) osc.frequency.linearRampToValueAtTime(target, now + glide);
    else           osc.frequency.setValueAtTime(target, now);

    // simple fast attack
    amp.gain.cancelScheduledValues(now);
    amp.gain.linearRampToValueAtTime(1, now + 0.01);

    setActive(midi);
  };

  const noteOff = () => {
    if (!ctxRef.current) return;
    const now = ctxRef.current.currentTime;
    const amp = ampRef.current;
    const rel = sustain ? 0.25 : 0.06;
    amp.gain.cancelScheduledValues(now);
    amp.gain.linearRampToValueAtTime(0.0001, now + rel);
    setActive(null);
  };

  // pointer (stylus) behaviour
  const onStripDown = (m) => (e) => {
    e.preventDefault();
    setIsDown(true);
    noteOn(m);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onStripEnter = (m) => () => { if (isDown) noteOn(m); };
  React.useEffect(() => {
    const up = () => { if (isDown) { setIsDown(false); noteOff(); } };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [isDown]);

  // keyboard control
  React.useEffect(() => {
    const pressed = new Set();
    const down = async (e) => {
      if (e.repeat) return;
      const m = KEY_TO_MIDI[e.key];
      if (m == null) return;
      e.preventDefault();
      pressed.add(e.key);
      await noteOn(m);
    };
    const up = (e) => {
      if (KEY_TO_MIDI[e.key] == null) return;
      pressed.delete(e.key);
      if (pressed.size === 0) noteOff();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [KEY_TO_MIDI, oct, glide, vRate, vDepth, wave, sustain]);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Wave
          <select value={wave} onChange={(e)=>setWave(e.target.value)}
                  className={`rounded-md border ${borderCol} bg-black/60 px-2 py-1`}>
            <option>square</option>
            <option>sawtooth</option>
            <option>triangle</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          Octave
          <select value={oct} onChange={(e)=>setOct(Number(e.target.value))}
                  className={`rounded-md border ${borderCol} bg-black/60 px-2 py-1`}>
            <option value={-2}>-2</option><option value={-1}>-1</option>
            <option value={0}>0</option><option value={1}>+1</option>
            <option value={2}>+2</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          Glide
          <input type="range" min="0" max="0.25" step="0.005"
                 value={glide} onChange={(e)=>setGlide(Number(e.target.value))}/>
          <span className="w-10 text-right">{(glide*1000)|0}ms</span>
        </label>

        <label className="flex items-center gap-2">
          Vibrato
          <input type="range" min="0" max="12" step="0.1"
                 value={vRate} onChange={(e)=>setVRate(Number(e.target.value))}/>
          <span className="w-8 text-right">{vRate.toFixed(1)}Hz</span>
        </label>

        <label className="flex items-center gap-2">
          Depth
          <input type="range" min="0" max="50" step="1"
                 value={vDepth} onChange={(e)=>setVDepth(Number(e.target.value))}/>
          <span className="w-10 text-right">{vDepth|0}¢</span>
        </label>

        <label className="flex items-center gap-2">
          Vol
          <input type="range" min="0" max="1" step="0.01"
                 value={vol} onChange={(e)=>setVol(Number(e.target.value))}/>
          <span className="w-8 text-right">{Math.round(vol*100)}%</span>
        </label>

        <label className="ml-auto inline-flex items-center gap-2">
          <input type="checkbox" checked={sustain} onChange={(e)=>setSustain(e.target.checked)} />
          Sustain
        </label>
      </div>

      {/* Stylus strip (25 semitone segments) */}
      <div className="select-none">
        <div className="rounded-md border border-emerald-400/30 bg-black/40 p-1">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${midiStrip.length}, minmax(18px, 1fr))` }}>
            {midiStrip.map((m) => {
              const isSharp = [1,3,6,8,10].includes(m % 12);
              const on = active === m;
              return (
                <button
                  key={m}
                  onPointerDown={onStripDown(m)}
                  onPointerEnter={onStripEnter(m)}
                  className={`h-16 border ${borderCol} ${on ? "bg-emerald-400/30" : isSharp ? "bg-emerald-400/15" : "bg-emerald-400/10"} 
                              hover:bg-emerald-400/20`}
                  title={`MIDI ${m}`}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-2 text-xs opacity-70">
          Keyboard: <code>z s x d c v g b h n j m , l . ; /</code> (C4→E5). Slide the mouse across the strip while pressed.
        </div>
      </div>
    </div>
  );
}

/* ===================== TRON 2D — Player vs Computer ====================== */
/* Arrow keys to steer. Space = pause, Enter = reset. Hover/click the canvas
   once so arrows don't scroll the page. Fits inside the window content area. */
const TRON2D_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="%2300ff7f" stroke-width="1.5"><rect x="2" y="6" width="60" height="28" rx="6" fill="%2300ff7f10"/><path d="M10 26h12l6-8h16l10 8"/><circle cx="22" cy="26" r="3"/><circle cx="50" cy="26" r="3"/></svg>';

function Tron2DApp({ playSfx }) {
  // UI
  const [running, setRunning] = React.useState(false);
  const [winner, setWinner]   = React.useState(null); // null | "You win!" | "Computer wins" | "Draw"
  const [arena, setArena]     = React.useState("M");  // S/M/L
  const [speed, setSpeed]     = React.useState(8);    // 1..12 faster

  // grid size from arena
  const { cols, rows } = React.useMemo(() => {
    if (arena === "S") return { cols: 28, rows: 20 };
    if (arena === "L") return { cols: 48, rows: 32 };
    return { cols: 36, rows: 26 }; // M
  }, [arena]);

  // canvas + sizing
  const wrapRef   = React.useRef(null);
  const canvasRef = React.useRef(null);
  const ctxRef    = React.useRef(null);
  const cellSizeRef = React.useRef(12); // px, computed on resize

  // game state (in refs so RAF doesn’t re-render)
  const worldRef = React.useRef(null);  // Uint8Array len cols*rows: 0 empty, 1 P1, 2 P2
  const p1Ref    = React.useRef(null);  // {x,y,dir:[dx,dy]}
  const p2Ref    = React.useRef(null);
  const lastT    = React.useRef(0);
  const accum    = React.useRef(0);
  const rafRef   = React.useRef(0);
  const activeRef= React.useRef(false); // when true, we capture arrow keys

  const idx = (x,y)=> y*cols + x;
  const inb = (x,y)=> x>=0 && x<cols && y>=0 && y<rows;
  const isRev = (a,b)=> a[0]===-b[0] && a[1]===-b[1];

  // ==== build / rebuild when arena changes =================================
  React.useEffect(() => {
    // init world + players
    const world = new Uint8Array(cols*rows); world.fill(0);
    worldRef.current = world;
    const mid = (rows/2)|0;
    p1Ref.current = { x: 2,       y: mid, dir: [1,0] };      // human →
    p2Ref.current = { x: cols-3,  y: mid, dir: [-1,0] };     // AI     ←
    world[idx(p1Ref.current.x, p1Ref.current.y)] = 1;
    world[idx(p2Ref.current.x, p2Ref.current.y)] = 2;

    // canvas
    const cnv = canvasRef.current;
    const ctx = cnv.getContext("2d");
    ctxRef.current = ctx;

    const resize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      // fit canvas to wrapper with square cells
      const W = wrap.clientWidth - 8;             // padding fudge
      const H = wrap.clientHeight - 8;
      const cs = Math.max(4, Math.floor(Math.min(W/cols, H/rows)));
      cellSizeRef.current = cs;
      cnv.width  = cols * cs;
      cnv.height = rows * cs;
      drawAll(); // redraw after size change
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);

    // keys
    const onKey = (e) => {
      if (!activeRef.current) return;
      let handled = false;
      const p1 = p1Ref.current;
      switch (e.key) {
        case "ArrowUp":    if(!isRev(p1.dir,[0,-1])) p1.dir=[0,-1], handled=true; break;
        case "ArrowDown":  if(!isRev(p1.dir,[0, 1])) p1.dir=[0, 1], handled=true; break;
        case "ArrowLeft":  if(!isRev(p1.dir,[-1,0])) p1.dir=[-1,0], handled=true; break;
        case "ArrowRight": if(!isRev(p1.dir,[1, 0])) p1.dir=[1, 0], handled=true; break;
        case " ": setRunning(r=>!r); handled=true; break;
        case "Enter": reset(); handled=true; break;
        default: break;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    // loop
    lastT.current = 0; accum.current = 0;
    const loop = (t) => {
      rafRef.current = requestAnimationFrame(loop);
      const now = t*0.001;
      const dt = lastT.current ? (now - lastT.current) : 0;
      lastT.current = now;
      const stepTime = lerp(0.24, 0.06, (speed-1)/11); // seconds
      if (running && !winner) {
        accum.current += dt;
        while (accum.current >= stepTime) {
          accum.current -= stepTime;
          stepOnce();
        }
      }
      drawAll();
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows]); // rebuild when arena size changes

  // if speed/running changes we don't need to rebuild; loop reads state by ref

  const lerp = (a,b,t)=> a+(b-a)*t;

  // ==== AI (flood fill area heuristic, prefer straight) =====================
  const aiChoose = () => {
    const world = worldRef.current, p2 = p2Ref.current, cur = p2.dir;
    const opts = [cur, [cur[1],-cur[0]], [-cur[1],cur[0]]]; // straight, right, left
    let best = cur, bestScore = -Infinity;
    for (const d of opts) {
      const nx = p2.x + d[0], ny = p2.y + d[1];
      if (!inb(nx,ny)) continue;
      if (world[idx(nx,ny)] !== 0) continue;
      const area = floodScore(nx, ny, world, cols, rows);
      const straight = (d[0]===cur[0] && d[1]===cur[1]) ? 1.05 : 1.0;
      const s = area * straight;
      if (s > bestScore) { bestScore = s; best = d; }
    }
    if (bestScore === -Infinity) {
      // emergency pick any non-reverse open dir
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const d of dirs) {
        if (isRev(cur,d)) continue;
        const nx = p2.x+d[0], ny = p2.y+d[1];
        if (inb(nx,ny) && world[idx(nx,ny)]===0) { best=d; break; }
      }
    }
    p2.dir = best;
  };

  function floodScore(sx, sy, world, C, R) {
    const N = C*R;
    const qx = new Int16Array(N), qy = new Int16Array(N);
    const seen = new Uint8Array(N);
    let qs=0, qe=0, count=0;
    const push = (x,y)=>{
      if(x<0||x>=C||y<0||y>=R) return;
      const k = y*C+x;
      if (seen[k]) return;
      if (world[k]!==0 && !(x===sx&&y===sy)) return;
      seen[k]=1; qx[qe]=x; qy[qe]=y; qe++;
    };
    push(sx,sy);
    const LIMIT = Math.min(N, 600);
    while(qs<qe && count<LIMIT){
      const x=qx[qs], y=qy[qs]; qs++; count++;
      push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
    }
    // light center bias
    const cx=C/2, cy=R/2, d=Math.abs(sx-cx)+Math.abs(sy-cy);
    return count*(1/(1+d*0.2));
  }

  // ==== single game step ====================================================
  const stepOnce = () => {
    aiChoose();

    const world = worldRef.current, p1=p1Ref.current, p2=p2Ref.current;

    const n1 = { x: p1.x + p1.dir[0], y: p1.y + p1.dir[1] };
    const n2 = { x: p2.x + p2.dir[0], y: p2.y + p2.dir[1] };

    let c1 = !inb(n1.x,n1.y) || world[idx(n1.x,n1.y)]!==0;
    let c2 = !inb(n2.x,n2.y) || world[idx(n2.x,n2.y)]!==0;

    if (!c1 && !c2 && n1.x===n2.x && n1.y===n2.y) { c1=c2=true; }

    if (c1 || c2) {
      setRunning(false);
      setWinner(c1 && c2 ? "Draw" : c2 ? "You win!" : "Computer wins");
      playSfx?.("boom");
      return;
    }

    // commit
    p1.x=n1.x; p1.y=n1.y; world[idx(p1.x,p1.y)]=1;
    p2.x=n2.x; p2.y=n2.y; world[idx(p2.x,p2.y)]=2;
  };

  // ==== drawing =============================================================
  const drawAll = () => {
    const ctx = ctxRef.current; if (!ctx) return;
    const world = worldRef.current, cs = cellSizeRef.current;

    // clear
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

    // grid
    ctx.strokeStyle = "rgba(0,255,170,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x=0; x<=cols; x++){ ctx.moveTo(x*cs+0.5, 0); ctx.lineTo(x*cs+0.5, rows*cs); }
    for (let y=0; y<=rows; y++){ ctx.moveTo(0, y*cs+0.5); ctx.lineTo(cols*cs, y*cs+0.5); }
    ctx.stroke();

    // trails
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        const v = world[idx(x,y)];
        if (v===0) continue;
        ctx.fillStyle = v===1 ? "#00ffd522" : "#66ccff22";
        ctx.fillRect(x*cs+1, y*cs+1, cs-2, cs-2);
      }
    }

    // heads
    const heads = [
      { p: p1Ref.current, cFill:"#00ffd5", cStroke:"#00fff0" },
      { p: p2Ref.current, cFill:"#66ccff", cStroke:"#99ddff" },
    ];
    heads.forEach(({p,cFill,cStroke})=>{
      const cx = p.x*cs + cs/2, cy = p.y*cs + cs/2, r = Math.max(3, cs*0.35);
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle = cFill; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = cStroke; ctx.stroke();
      // direction “glow”
      const dx=p.dir[0], dy=p.dir[1];
      ctx.beginPath(); ctx.arc(cx+dx*r*0.6, cy+dy*r*0.6, Math.max(2,cs*0.12),0,Math.PI*2);
      ctx.fillStyle = cStroke; ctx.fill();
    });

    // winner overlay
    if (winner){
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
      ctx.fillStyle="#9fffe0"; ctx.font = `bold ${Math.floor(cs*1.2)}px monospace`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(winner, ctx.canvas.width/2, ctx.canvas.height/2);
    }
  };

  // ==== reset ===============================================================
  const reset = () => {
    const world = new Uint8Array(cols*rows); world.fill(0);
    worldRef.current = world;
    const mid = (rows/2)|0;
    p1Ref.current = { x: 2,       y: mid, dir:[1,0] };
    p2Ref.current = { x: cols-3,  y: mid, dir:[-1,0] };
    world[idx(p1Ref.current.x,p1Ref.current.y)] = 1;
    world[idx(p2Ref.current.x,p2Ref.current.y)] = 2;
    lastT.current=0; accum.current=0;
    setWinner(null);
    setRunning(false);
    drawAll();
    playSfx?.("open");
  };

  // first draw once wrapper has height
  React.useEffect(()=>{ const id=setTimeout(drawAll,0); return ()=>clearTimeout(id); },[cols,rows]);

  return (
    <div className="flex flex-col gap-3">
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Arena
          <select
            value={arena}
            onChange={(e)=>setArena(e.target.value)}
            className={`rounded-md border ${borderCol} bg-black/60 px-2 py-1`}
          >
            <option value="S">Small</option>
            <option value="M">Medium</option>
            <option value="L">Large</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          Speed
          <input type="range" min="1" max="12" step="1" value={speed} onChange={(e)=>setSpeed(Number(e.target.value))}/>
          <span className="w-6 text-right">{speed}</span>
        </label>

        <button
          className={`rounded-md border ${borderCol} bg-black/60 px-3 py-1 hover:bg-emerald-400/10`}
          onClick={()=>{ setWinner(null); setRunning(r=>!r); playSfx?.("menu"); }}
        >
          {running ? "Pause" : "Start"}
        </button>

        <button
          className={`rounded-md border ${borderCol} bg-black/60 px-3 py-1 hover:bg-emerald-400/10`}
          onClick={reset}
        >
          Reset
        </button>

        <div className="ml-auto text-emerald-300/80">
          You: ⬆ ⬇ ⬅ ➡ &nbsp;•&nbsp; Space: pause &nbsp;•&nbsp; Enter: reset
        </div>
      </div>

      {/* Canvas wrapper — sized so there's NO inner scroll */}
      <div
        ref={wrapRef}
        onMouseEnter={()=> (activeRef.current = true)}
        onMouseLeave={()=> (activeRef.current = false)}
        onPointerDown={()=> (activeRef.current = true)}
        className="relative h-[56vh] min-h-[320px] rounded-md border border-emerald-400/30 bg-black/40 overscroll-none"
      >
        <canvas ref={canvasRef} className="absolute left-0 top-0" />
      </div>

      <div className="text-xs opacity-70">
        Keep moving; your trail becomes a wall. Crash = lose. Head-on = draw. Hover the arena once so arrow keys steer (and don’t scroll).
      </div>
    </div>
  );
}


/* ========================= Terminal (working) =============================== */
function TerminalApp({ openApp, apps, showRick }) {
  const [lines, setLines] = useState([
    "MatrixOS pseudo-terminal (pts/0)",
    'Type "help" for commands.',
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [hIndex, setHIndex] = useState(-1);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }); }, [lines]);
  const focusInput = () => inputRef.current?.focus();
  const print = (t) => setLines((l) => [...l, ...(Array.isArray(t) ? t : [t])]);
  const clear = () => setLines([]);

  const helpText = [
    "Available commands:",
    "  help               Show this help",
    "  ls                 List apps",
    "  open <app>         Open an app window (id or title)",
    "  mines              Launch Mines",
    "  echo <text>        Print text",
    "  date | time        Show date/time",
    "  whoami             Identity",
    "  uname -a           System info",
    "  neofetch           Fancy system summary",
    "  cowsay <text>      A wise cow speaks",
    "  hack               Fake hacking sequence",
    "  secret             ?",
    "  clear              Clear screen",
    "",
    "Easter eggs: sudo, rm -rf /, vim, emacs, theanswer, wakeup",
  ];
  const appNames = () => apps.map(a => `- ${a.id}  (${a.title})`);
  const toAsciiCow = (msg) => { const top="_".repeat(msg.length+2), bot="‾".repeat(msg.length+2);
    return [` ${top}`, `< ${msg} >`, ` ${bot}`, "        \\   ^__^","         \\  (oo)\\_______","            (__)\\       )\\/\\","                ||----w |","                ||     ||"]; };
  const neofetchBlock = () => {
    const logo = ["        ████        ","      ██    ██      ","     ██  ██  ██     ","     ██  ██  ██     ","      ██    ██      ","        ████        "];
    const info = [`user: guest`,`os: AndreasOS`,`shell: pseudo-tty`,`resolution: ${window.innerWidth}x${window.innerHeight}`,`theme: neon-emerald`];
    const widest = Math.max(...logo.map(l => l.length)); const rows = Math.max(logo.length, info.length);
    const out = []; for (let i=0;i<rows;i++){ const left=(logo[i]||"").padEnd(widest," "); out.push(`${left}   ${info[i]||""}`); } return out;
  };
  const fakeHack = async () => { const steps=["[*] Initializing sockets...","[*] Scanning ports 1-65535...","[*] Found open ports: 22, 80, 443","[*] Bruteforcing admin login...","[*] Token acquired: 0xDEADBEEF","[*] Downloading secrets.tar.gz ...","[!] ACCESS DENIED — nice try 😅"]; for (const s of steps){ await new Promise(r=>setTimeout(r,350)); print(s);} };
  const wakeUpNeo = ["Wake up, Neo...","The Matrix has you...","Follow the white rabbit.","Knock, knock, Neo."];

  const commands = {
    help: () => print(helpText),
    ls: () => print(["Desktop:", ...appNames()]),
    clear: () => clear(),
    whoami: () => print("guest"),
    date: () => print(new Date().toString()),
    time: () => print(new Date().toLocaleTimeString()),
    "uname -a": () => print("AndreasOS 1.0.0 #1337 SMP neon-emerald x86_64"),
    uname: () => print("AndreasOS"),
    echo: (a) => print(a.join(" ")),
    neofetch: () => print(neofetchBlock()),
    cowsay: (a) => print(toAsciiCow(a.join(" ") || "Moo.")),
    hack: () => fakeHack(),
    secret: () => {print(["ACCESS GRANTED...", "...", "...", "...", "HA HA HA"]);
    if (typeof showRick === "function") showRick(5);
    },
    matrix: () => print("Already in it."),
    theanswer: () => print("42"),
    open: (a) => { const q = a.join(" ").toLowerCase(); const app = apps.find(x => x.id.toLowerCase()===q || x.title.toLowerCase()===q); if (app){ setTimeout(()=>openApp(app.id), 0); print(`Opening ${app.title}…`);} else print(`No such app: ${q}`); },
    mines: () => { setTimeout(()=>openApp("mines"), 0); print("Opening Mines…"); },
    sudo: () => print("Nice try. You have no power here."),
    "rm -rf /": () => print("Nope."),
    vim: () => print("Esc :q!"),
    emacs: () => print("You mean vim?"),
    wakeup: () => { let i = 0; const run=()=>{ if(i>=wakeUpNeo.length) return; print(wakeUpNeo[i++]); setTimeout(run,700); }; run(); },
    tron2d: () => { setTimeout(() => openApp("tron2d"), 0); print("Opening TRON 2D…"); },
  };

  const exec = (raw) => {
    const cmdline = raw.trim(); if (!cmdline) return;
    setHistory((h) => [cmdline, ...h]); setHIndex(-1);
    if (commands[cmdline]) return commands[cmdline]([]);
    const [cmd, ...args] = cmdline.split(" ");
    const multi = `${cmd} ${args[0] ?? ""}`;
    if (commands[multi]) { args.shift(); return commands[multi](args); }
    if (commands[cmd]) return commands[cmd](args);
    print(`command not found: ${cmd}`);
  };

  const onSubmit = (e) => { e.preventDefault(); const prompt = `guest@Sp8OS:~$ ${input}`; print(prompt); exec(input); setInput(""); };
  const onKeyDown = (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); setHIndex((i)=>{ const ni=Math.min(history.length-1,i+1); setInput(history[ni]??input); return ni; }); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHIndex((i)=>{ const ni=Math.max(-1,i-1); setInput(history[ni]??""); return ni; }); }
    else if (e.key === "Tab") { e.preventDefault(); const list=Object.keys(commands); const match=list.find((c)=>c.startsWith(input)); if (match) setInput(match); }
  };

  return (
    <div className="rounded-md border border-emerald-400/30 bg-black/60 p-2" onClick={focusInput}>
      <div ref={scrollerRef} className="max-h-[55vh] overflow-auto whitespace-pre-wrap leading-relaxed">
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <span className="text-emerald-300">guest@Sp8OS:~$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          className={`flex-1 bg-transparent text-emerald-200 placeholder-emerald-300/50 focus:outline-none`}
          placeholder="type a command… (help)"
        />
      </form>
    </div>
  );
}

/* ======================= Ubuntu-like Start Menu ============================ */
const FAVORITES = ["about", "projects", "terminal", "mines"];

function UbuntuMenu({ open, onClose, onLaunch, apps, onOpenMixer, onRestart, onPowerOff, playSfx }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = apps.filter(a =>
    a.title.toLowerCase().includes(q.trim().toLowerCase())
  );

  const favApps = FAVORITES.map(id => apps.find(a => a.id === id)).filter(Boolean);

  const AppTile = ({ app }) => (
    <button
      onClick={() => { playSfx("open"); onLaunch(app.id); onClose(); }}
      className={`flex flex-col items-center gap-2 rounded-md ${borderCol} border bg-black/50 p-3 text-emerald-200 hover:bg-emerald-400/10`}
    >
      <img src={app.src} alt={app.title} className="h-10 w-10 select-none" />
      <span className="text-xs font-mono opacity-90">{app.title}</span>
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-hidden onClick={() => { playSfx("menu"); onClose(); }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className={`fixed left-2 bottom-12 z-50 flex ${frame} bg-[rgba(0,0,0,0.85)]`}
            style={{ width: "min(960px, 96vw)", height: "min(620px, 72vh)" }}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <div className={`flex w-16 flex-col items-center gap-2 border-r ${borderCol} p-2`}>
              {favApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => { playSfx("open"); onLaunch(app.id); onClose(); }}
                  className="rounded-md border border-transparent p-2 hover:border-emerald-400/40 hover:bg-emerald-400/10"
                  title={app.title}
                >
                  <img src={app.src} alt={app.title} className="h-8 w-8" />
                </button>
              ))}
              <div className="mt-auto flex flex-col items-center gap-1">
                <IconBtn title="Settings" onClick={() => { playSfx("menu"); onOpenMixer(); }} icon={<GearIcon/>} />
                <IconBtn title="Restart"  onClick={() => { playSfx("menu"); onRestart(); }} icon={<RestartIcon/>} />
                <IconBtn title="Power Off" onClick={() => { playSfx("menu"); onPowerOff(); }} icon={<PowerIcon/>} />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col p-3">
              <div className="mb-3 flex items-center gap-2">
                <SearchIcon />
                <input
                  autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type to search…"
                  className={`w-full rounded-md border ${borderCol} bg-black/60 px-3 py-2 font-mono text-sm text-emerald-200 placeholder-emerald-300/50 focus:outline-none`}
                />
              </div>
              <div className="grid flex-1 grid-cols-3 gap-3 overflow-auto sm:grid-cols-4 md:grid-cols-5">
                {(q ? filtered : apps).map(app => <AppTile key={app.id} app={app} />)}
                {q && filtered.length === 0 && (
                  <div className="col-span-full grid place-items-center text-emerald-300/70">
                    No apps match “{q}”
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const IconBtn = ({ title, onClick, icon }) => (
  <button title={title} onClick={onClick} className="rounded-md p-2 text-emerald-300 hover:bg-emerald-400/10">
    {icon}
  </button>
);
/* icons */
const SearchIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" className="text-emerald-300"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM10 14a4 4 0 1 1 0-8a4 4 0 0 1 0 8z"/></svg>);
const PowerIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" className="text-emerald-300"><path fill="currentColor" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.99 6.99 0 0 1 19 12a7 7 0 1 1-14 0a6.99 6.99 0 0 1 2.59-5.41L6.17 5.17A9 9 0 1 0 21 12a8.98 8.98 0 0 0-3.17-6.83z"/></svg>);
const RestartIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" className="text-emerald-300"><path fill="currentColor" d="M12 6V3l4 4l-4 4V8c-2.76 0-5 2.24-5 5a5 5 0 0 0 9 3h2a7 7 0 1 1-6-11z"/></svg>);
const GearIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" className="text-emerald-300"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.027 7.027 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.3 1h-4.6a.5.5 0 0 0-.49.41l-.36 2.54c-.59.24-1.14.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L1.32 7.93a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L1.44 13.6a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.49.39 1.04.7 1.63.94l.36 2.54c.06.29.31.5.6.5h4.6c.3 0 .55-.21.6-.5l.36-2.54c.59-.24 1.14-.55 1.63-.94l2.39.96c.24.1.51.01.64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7a3.5 3.5 0 0 1 0 7z"/></svg>);

/* ============================ Volume Mixer ================================= */
function VolumeMixer({ open, onClose, volume, setVolume, muted, setMuted }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-hidden onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className={`fixed left-1/2 top-1/2 z-50 w-[min(520px,95vw)] -translate-x-1/2 -translate-y-1/2 ${frame} bg-[rgba(0,0,0,0.9)] p-4`}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          >
            <h3 className="mb-3 font-mono text-lg text-emerald-300">🔊 Volume Mixer</h3>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-full"
              />
              <span className="w-12 text-right">{Math.round(volume * 100)}%</span>
            </div>
            <label className="mt-3 inline-flex items-center gap-2">
              <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
              <span>Mute</span>
            </label>
            <div className="mt-4 text-right">
              <button onClick={onClose} className={`rounded-md border ${borderCol} bg-black/60 px-3 py-1 hover:bg-emerald-400/10`}>Close</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* === Rickroll toast (CTA link) =========================================== */
function RickRollToast({
  show,
  onClose,
  url = "https://youtu.be/dQw4w9WgXcQ?t",
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 9999 }}         // keep above windows
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`pointer-events-auto fixed right-4 bottom-20 w-[360px] overflow-hidden rounded-lg border ${borderCol} bg-black/90 shadow-xl`}
            initial={{ y: 28, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <button
              onClick={onClose}
              className="absolute right-2 top-1 rounded px-2 text-emerald-300/80 hover:bg-emerald-400/10"
              title="Close"
            >
              ✕
            </button>

            <div className="p-4">
              <div className="mb-2 font-mono text-sm text-emerald-300">
                ACCESS GRANTED…
              </div>

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-400/50 bg-emerald-400/10 px-3 py-3 font-mono text-sm text-emerald-200 hover:bg-emerald-400/20"
              >
                🔓 Click here to unlock. <strong>Hurry!</strong>
              </a>

              <div className="mt-2 text-right text-[11px] text-emerald-300/70">
                Opens in a new tab.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}




/* =============================== App list ================================== */
function TerminalWrapper(props) { return <TerminalApp {...props} />; }

const APPS = [
  { id: "about", title: "About Me", src: `${import.meta.env.BASE_URL}icons/about.svg`, content: AboutMeApp },
  { id: "experience", title: "Experience", src: `${import.meta.env.BASE_URL}icons/experience.svg`, content: ExperienceApp },
  { id: "projects", title: "Projects", src: `${import.meta.env.BASE_URL}icons/projects.svg`, content: ProjectsApp },
  { id: "resume", title: "Résumé", src: `${import.meta.env.BASE_URL}icons/resume.svg`, content: ResumeApp },
  { id: "contact", title: "Contact", src: `${import.meta.env.BASE_URL}icons/contact.svg`, content: ContactApp },
  { id: "terminal", title: "Terminal", src: `${import.meta.env.BASE_URL}icons/terminal.svg`, content: TerminalWrapper },
  { id: "mines", title: "Mines", src: MINES_ICON, content: MinesApp },
  { id: "stylophone", title: "Stylophone", src: STYLO_ICON, content: StylophoneApp },
  { id: "secret", title: "?", src: `${import.meta.env.BASE_URL}icons/secret.svg`, content: SecretApp },
  { id: "tron2d", title: "TRON 2D", src: TRON2D_ICON, content: Tron2DApp },
];


/* ================================= Main ==================================== */
export default function MatrixOS() {
  const desktopRef = useRef(null);
  const now = useClock();
  const [zTop, setZTop] = useState(10);
  const [windows, setWindows] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Power/mixer state
  const [mixerOpen, setMixerOpen] = useState(false);
  const [masterVol, setMasterVol] = useState(0.6);
  const [muted, setMuted] = useState(false);
  const [powerOff, setPowerOff] = useState(false);

  //Get Ricked
  const [rick, setRick] = useState(false);
  const rickTimer = useRef(null);
  const showRick = (seconds = 5) => {
    clearTimeout(rickTimer.current);
    setRick(true);
    rickTimer.current = setTimeout(() => setRick(false), seconds * 1000);
  };

  // SFX
  const playSfx = useSfx(masterVol, muted);

  const openApp = (id) => {
    setWindows((wins) => {
      const ex = wins.find((w) => w.id === id);
      if (ex) return wins.map((w) => (w.id === id ? { ...w, minimized: false, z: zTop + 1 } : w));
      return [...wins, { id, minimized: false, z: zTop + 1 }];
    });
    setZTop((z) => z + 1);
    playSfx("open");
  };
  const closeApp = (id) => { setWindows((w)=> w.filter((x)=>x.id!==id)); playSfx("close"); };
  const minimizeApp = (id) => { setWindows((w)=> w.map((x)=>x.id===id?{...x,minimized:true}:x)); playSfx("minimize"); };
  const focusApp = (id) => { setWindows((w)=> w.map((x)=>x.id===id?{...x,z:zTop+1}:x)); setZTop((z)=>z+1); };

  // Power actions
  const doRestart = () => { window.location.reload(); };
  const doPowerOff = () => { setPowerOff(true); setMenuOpen(false); };

  // "Boot" from power off
  useEffect(() => {
    if (!powerOff) return;
    const anyKey = (e) => { e.preventDefault(); setPowerOff(false); playSfx("success"); };
    window.addEventListener("keydown", anyKey);
    return () => window.removeEventListener("keydown", anyKey);
  }, [powerOff, playSfx]);

  return (
    <div className="relative h-screen w-full overflow-hidden text-emerald-200" ref={desktopRef}>
      <MatrixBackground hidden={powerOff} />

      {/* desktop icons */}
      {!powerOff && (
        <div className="relative z-10 grid grid-cols-3 gap-4 p-4 sm:grid-cols-6">
          {APPS.map((app) => (
            <DesktopIcon key={app.id} src={app.src} label={app.title} onOpen={() => openApp(app.id)} playSfx={playSfx} />
          ))}
        </div>
      )}

      {/* windows */}
      {!powerOff && windows.map((w) => {
        const app = APPS.find((a) => a.id === w.id);
        if (!app || w.minimized) return null;
        const Content = app.content;
        return (
          <MatrixWindow
            key={w.id}
            app={app}
            content={Content}
            z={w.z}
            onClose={() => closeApp(w.id)}
            onMinimize={() => minimizeApp(w.id)}
            onFocus={() => focusApp(w.id)}
            boundsRef={desktopRef}
            inject={{ openApp, apps: APPS, playSfx, showRick }}
            
          />
        );
      })}

      {/* Ubuntu-like Start Menu */}
      {!powerOff && (
        <UbuntuMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onLaunch={openApp}
          apps={APPS}
          onOpenMixer={() => setMixerOpen(true)}
          onRestart={doRestart}
          onPowerOff={doPowerOff}
          playSfx={playSfx}
        />
      )}

      {/* Volume Mixer */}
      <VolumeMixer
        open={mixerOpen}
        onClose={() => setMixerOpen(false)}
        volume={masterVol}
        setVolume={setMasterVol}
        muted={muted}
        setMuted={setMuted}
      />

      {/* Rickroll toast */}
      <RickRollToast show={rick} onClose={() => setRick(false)} />

      {/* taskbar */}
      {!powerOff && (
        <div className={`fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t ${borderCol} bg-black/70 px-2 py-1 backdrop-blur-[2px]`}>
          <button
            className={`rounded-[4px] ${borderCol} border px-3 py-1 font-mono text-[12px] text-emerald-200`}
            onClick={() => { setMenuOpen((s) => !s); playSfx("menu"); }}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
          >
            Start
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {windows.map((w)=>{ const app=APPS.find((a)=>a.id===w.id); if(!app) return null; return (
              <button key={w.id}
                      onClick={()=>{ setWindows((arr)=>arr.map((x)=>x.id===w.id?{...x,minimized:!x.minimized}:x)); playSfx("minimize"); }}
                      className={`rounded-[4px] ${borderCol} border px-2 py-1 text-[12px] text-emerald-200 hover:bg-black/50`}>
                {app.title}
              </button>
            ); })}
          </div>
          <div className={`rounded-[4px] ${borderCol} border px-2 py-1 font-mono text-[12px] text-emerald-200`}>
            {now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
          </div>
        </div>
      )}

      {/* POWER OFF overlay */}
      <AnimatePresence>
        {powerOff && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <div className="mb-6 text-emerald-400">Sp8OS</div>
              <button
                onClick={() => { setPowerOff(false); playSfx("success"); }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-500/50 text-emerald-400 hover:bg-emerald-400/10"
                title="Power On"
              >
                <PowerIcon />
              </button>
              <div className="mt-3 text-sm text-emerald-200/70">Click the button or press any key to power on</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

