// Canvas shell over the wasm golf simulation. The wasm owns every number that matters;
// this file owns input, theme, scheduling and the motion that makes it feel like something.

export type Action = "aim+" | "aim-" | "power+" | "power-" | "spin" | "hit" | "restart" | "next";

export type Over = { title: string; detail: string; final: boolean };

export type Hud = {
  hole: number;
  holes: number;
  par: number;
  strokes: number;
  wind: number;
  spin: string;
  note: string;
  over: Over | null;
};

export type Sink = {
  set(patch: Partial<Hud>): void;
  polite(text: string): void;
  assertive(text: string): void;
  ready(): void;
};

export type Shell = { act(action: Action): void; share(): string | null; destroy(): void };

export type Options = { canvas: HTMLCanvasElement; stage: HTMLElement; sink: Sink; replay: string | null };

type Wasm = {
  memory: WebAssembly.Memory;
  new_course(seed: number): void;
  hole_prepare(k: number): void;
  hole_solve(maxShots: number): number;
  hole_start(): number;
  restart(): void;
  shoot(angle: number, power: number, spin: number): number;
  advance(dtMs: number): number;
  settle(): number;
  preview(angle: number, power: number, spin: number): void;
  preview_len(): number;
  hash_lo(): number;
  view_ptr(): number;
  heights_ptr(): number;
  surf_ptr(): number;
  preview_ptr(): number;
  replay_buf_ptr(): number;
  replay_encode(): number;
  replay_verify(len: number): number;
  replay_seed(): number;
};

type RGB = [number, number, number];
type Colors = { ink: RGB; muted: RGB; hair: RGB; accent: RGB; orange: RGB; sand: RGB; water: RGB; ground: RGB };
type Pt = { x: number; y: number; t: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: RGB };
type Drag = { x: number; y: number; id: number };

// view[] slots
const X = 0, Y = 1, VY = 3, PHASE = 5, STROKES = 6, PAR = 7, WIND = 8, LEN = 9, CUPX = 10, NS = 11, K = 12, DONE = 13, TOT = 14, TOTPAR = 15;
const READY = 0, AIR = 1, GROUND = 2;
const EV = { LAND: 1, SAND: 2, WATER: 4, HOLED: 8, WALL: 16, RIM: 32, REST: 64, OVER: 128 };
const SP = 0.5, MARGIN = 4, LAST_HOLE = 8, MAXN = 160, TAU = Math.PI * 2;
const SPINS = ["none", "low", "mid", "high"];
const SURFACE = ["on the fairway", "in the sand", "in the water", "on the green"];
const FALLBACK: Colors = {
  ink: [23, 29, 22], muted: [84, 96, 79], hair: [204, 214, 204], accent: [125, 45, 38], orange: [212, 102, 60],
  sand: [201, 182, 138], water: [77, 106, 115], ground: [232, 237, 231],
};

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);
const rgb = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function hex(s: string, fallback: RGB): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function load(url: string): Promise<Wasm> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`golf.wasm ${res.status}`);
  let r: WebAssembly.WebAssemblyInstantiatedSource;
  try {
    r = await WebAssembly.instantiateStreaming(res.clone(), {});
  } catch {
    r = await WebAssembly.instantiate(await res.arrayBuffer(), {});
  }
  return r.instance.exports as unknown as Wasm;
}

function dailySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function seedLabel(seed: number): string {
  const s = String(seed);
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
}

function holeName(strokes: number, par: number): string {
  const d = strokes - par;
  if (strokes === 1) return "Hole in one";
  if (d <= -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Double bogey";
  return `${d} over par`;
}

export async function mount({ canvas, stage, sink, replay }: Options): Promise<Shell> {
  const w = await load("/golf/golf.wasm");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const motion = () => !reduced.matches;
  const stop = new AbortController();
  const { signal } = stop;
  let dead = false;

  // ---- wasm views (rebuilt if memory ever moves)
  let buf: ArrayBuffer | null = null;
  let view = new Float64Array(16), heights = new Float64Array(MAXN), surf = new Uint8Array(MAXN), prevBuf = new Float64Array(128);
  function bind() {
    if (buf === w.memory.buffer) return;
    buf = w.memory.buffer;
    view = new Float64Array(buf, w.view_ptr(), 16);
    heights = new Float64Array(buf, w.heights_ptr(), MAXN);
    surf = new Uint8Array(buf, w.surf_ptr(), MAXN);
    prevBuf = new Float64Array(buf, w.preview_ptr(), 128);
  }
  bind();

  // ---- replay check, then the course
  let seed = dailySeed();
  let verifyLine = "";
  if (replay) {
    sink.set({ note: "Checking replay" });
    await new Promise((r) => setTimeout(r, 40));
    let code = -1;
    if (/^[A-Za-z0-9_-]{1,512}$/.test(replay)) {
      bind();
      const bytes = new Uint8Array(w.memory.buffer, w.replay_buf_ptr(), 512);
      for (let i = 0; i < replay.length; i++) bytes[i] = replay.charCodeAt(i);
      code = w.replay_verify(replay.length);
    }
    verifyLine = code === 1 ? "Replay matches" : code === 0 ? "Replay differs from this build" : "Replay could not be read";
    if (code >= 0) seed = w.replay_seed() >>> 0;
    sink.polite(verifyLine);
  }
  w.new_course(seed);

  // ---- state
  let started = false, holeDone = false, waiting = false, firstStart = true;
  let prepReady = false, prepTimer = 0, noteTimer = 0;
  const aim = { a: 30, p: 36, s: 1, shown: false, t: 0, drag: null as Drag | null };
  let pts: Float64Array = new Float64Array(0);
  let col: Colors = FALLBACK, dark = false;
  let dpr = 1, W = 0, H = 0, S = 1, ybase = 0, br = 4;
  let staticLayer = document.createElement("canvas"), oldLayer: HTMLCanvasElement | null = null;
  const anim = { drawIn: 0, glide: 0, squash: 0, squashT: 0, dip: 0, holed: 0, splash: 0, splashX: 0, splashY: 0, reappear: 0, flutterUntil: 0, ff: false };
  const particles: Particle[] = [];
  const trail: Pt[] = [];
  let sunk = false;
  let now = performance.now(), last = now, raf = 0, hidden = document.hidden, visible = true;
  const lastDraw = { x: 0, y: 0, vy: 0 };

  const setNote = () => sink.set({ note: waiting ? "Preparing" : verifyLine });

  // ---- theme + layout
  function resolve() {
    const cs = getComputedStyle(stage);
    const get = (n: string, f: RGB) => hex(cs.getPropertyValue(n), f);
    col = {
      ink: get("--ink", FALLBACK.ink), muted: get("--muted", FALLBACK.muted), hair: get("--hair", FALLBACK.hair),
      accent: get("--accent", FALLBACK.accent), orange: get("--orange", FALLBACK.orange),
      sand: get("--g-sand", FALLBACK.sand), water: get("--g-water", FALLBACK.water), ground: get("--ground", FALLBACK.ground),
    };
    dark = cs.colorScheme === "dark";
  }
  function frame() {
    const n = view[NS];
    let min = Infinity;
    for (let i = 0; i < n; i++) if (heights[i] < min) min = heights[i];
    S = W / (view[LEN] + 2 * MARGIN);
    ybase = (isFinite(min) ? min : 0) - 2.5;
    br = Math.max(3, Math.min(5, S * 0.55));
  }
  function layout() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    if (W < 1 || H < 1) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (started) { bind(); frame(); buildStatic(); }
    wake();
  }
  const wx = (x: number) => (x + MARGIN) * S;
  const wy = (y: number) => H - (y - ybase) * S;
  const cupY = () => heights[Math.min(MAXN - 1, Math.round(view[CUPX] / SP))];

  function runs(kind: number, n: number, fn: (i: number, j: number) => void) {
    for (let i = 0; i < n - 1; i++) {
      if (surf[i] !== kind) continue;
      let j = i;
      while (j < n - 1 && surf[j] === kind) j++;
      fn(i, j);
      i = j;
    }
  }

  function buildStatic() {
    const c = staticLayer;
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = view[NS], L = view[LEN];
    const band = (i: number, j: number, px: number, fill: string) => {
      g.beginPath();
      for (let t = i; t <= j; t++) g.lineTo(wx(t * SP), wy(heights[t]));
      for (let t = j; t >= i; t--) g.lineTo(wx(t * SP), wy(heights[t]) + px);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    g.beginPath();
    g.moveTo(wx(0), H + 2);
    for (let i = 0; i < n; i++) g.lineTo(wx(i * SP), wy(heights[i]));
    g.lineTo(wx(L), H + 2);
    g.closePath();
    g.fillStyle = rgb(col.hair);
    g.fill();
    band(0, n - 1, 6, rgb(col.ink, dark ? 0.12 : 0.07));
    runs(3, n, (i, j) => band(i, j, 4, rgb(col.muted, 0.5)));
    runs(1, n, (i, j) => {
      band(i, j, 10, rgb(col.sand));
      g.fillStyle = rgb(col.ink, dark ? 0.35 : 0.28);
      let h = (i * 2654435761) >>> 0;
      for (let d = 0; d < (j - i) * 2; d++) {
        h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
        const x = i * SP + ((h & 1023) / 1023) * (j - i) * SP;
        const idx = Math.min(n - 1, Math.floor(x / SP));
        g.fillRect(wx(x), wy(heights[idx]) + 1 + ((h >>> 10) & 1023) / 1023 * 8, 1.2, 1.2);
      }
    });
    runs(2, n, (i, j) => {
      const line = Math.min(heights[Math.max(i - 1, 0)], heights[Math.min(j, n - 1)]);
      g.beginPath();
      g.moveTo(wx(i * SP), wy(line));
      for (let t = i; t <= j; t++) g.lineTo(wx(t * SP), wy(heights[t]));
      g.lineTo(wx(j * SP), wy(line));
      g.closePath();
      g.fillStyle = rgb(col.water);
      g.fill();
      g.strokeStyle = rgb(col.ground, 0.55);
      g.lineWidth = 1;
      for (let t = i + 1; t < j; t += 3) {
        const x0 = wx(t * SP + 0.3), y0 = wy(line) + 5 + (t % 2) * 4;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + 3, y0 - 2, x0 + 6, y0); g.stroke();
      }
    });
    g.strokeStyle = rgb(col.ink);
    g.lineWidth = 1.5;
    g.lineJoin = "round";
    g.beginPath();
    let pen = false;
    for (let i = 0; i < n - 1; i++) {
      if (surf[i] === 2) { pen = false; continue; }
      if (!pen) { g.moveTo(wx(i * SP), wy(heights[i])); pen = true; }
      g.lineTo(wx((i + 1) * SP), wy(heights[i + 1]));
    }
    g.stroke();
    // Cup: a symbol-sized notch cut out of the ground (the real cup is 108 mm).
    const cx = wx(view[CUPX]), cy = wy(cupY());
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.fillRect(cx - 3.5, cy - 0.5, 7, 6.5);
    g.restore();
    g.strokeStyle = rgb(col.ink);
    g.beginPath();
    g.moveTo(cx - 3.5, cy); g.lineTo(cx - 3.5, cy + 6); g.lineTo(cx + 3.5, cy + 6); g.lineTo(cx + 3.5, cy);
    g.stroke();
  }

  // ---- motion
  function spawn(x: number, y: number, n: number, color: RGB, up: number, spread: number) {
    if (!motion()) return;
    for (let i = 0; i < n && particles.length < 12; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = up * (0.5 + Math.random());
      particles.push({ x: wx(x), y: wy(y) - br, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, size: 1 + Math.random() * 1.6, color });
    }
  }
  function squash(vn: number) {
    if (!motion()) return;
    anim.squash = Math.min(1, vn / 20) * 0.25; anim.squashT = now;
  }

  // ---- hole flow
  function pushHud() {
    sink.set({ hole: view[K] + 1, par: view[PAR], strokes: view[STROKES], wind: view[WIND], spin: SPINS[aim.s] });
  }
  function prepare(idx: number) {
    window.clearTimeout(prepTimer);
    if (idx > LAST_HOLE) { prepReady = false; return; }
    w.hole_prepare(idx);
    prepReady = false;
    slice();
  }
  function slice() {
    prepTimer = window.setTimeout(() => {
      if (dead) return;
      if (w.hole_solve(48) >= 0) { prepReady = true; if (waiting) begin(); } else slice();
    }, 16);
  }
  function wantStart() {
    if (prepReady) { begin(); return; }
    waiting = true;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(setNote, 250);
  }
  function begin() {
    if (!w.hole_start()) { waiting = true; return; }
    waiting = false;
    window.clearTimeout(noteTimer);
    bind();
    started = true; holeDone = false; sunk = false;
    now = performance.now();
    frame();
    const first = firstStart;
    firstStart = false;
    if (!first && motion()) { oldLayer = staticLayer; staticLayer = document.createElement("canvas"); anim.glide = now; }
    buildStatic();
    if (first && motion()) anim.drawIn = now;
    trail.length = 0; particles.length = 0; aim.shown = false;
    anim.holed = 0; anim.splash = 0; anim.reappear = 0;
    pushHud();
    sink.set({ over: null, note: verifyLine });
    prepare(view[K] + 1);
    if (first) sink.ready();
    wake();
  }
  function holeEnd(ev: number) {
    holeDone = true;
    sunk = (ev & EV.HOLED) !== 0;
    anim.holed = now;
    const s = view[STROKES], p = view[PAR];
    const final = view[K] >= LAST_HOLE;
    const name = holeName(s, p);
    const total = view[TOT] - view[TOTPAR];
    const sign = total === 0 ? "level par" : `${Math.abs(total)} ${total < 0 ? "under" : "over"} par`;
    const holed = (ev & EV.HOLED) !== 0;
    sink.set({
      strokes: s,
      over: {
        title: final ? "Course complete" : holed ? name : "Hole over",
        detail: final ? `${view[TOT]} on a par ${view[TOTPAR]}` : (holed ? `${s} on a par ${p}` : `${s} strokes, par ${p}`) + (view[K] > 0 ? ` · Total ${total === 0 ? "E" : total > 0 ? `+${total}` : total}` : ""),
        final,
      },
    });
    sink.assertive(final ? `Course complete, ${view[TOT]} strokes, ${sign}.` : holed ? `Holed in ${s}, par ${p}. ${name}.` : `Hole over at ${s} strokes, par ${p}.`);
    if (holed) spawn(view[CUPX], cupY(), 12, col.accent, 70, 1.1);
  }
  function onEvents(ev: number) {
    if (ev & EV.LAND) { squash(Math.abs(lastDraw.vy)); spawn(view[X], view[Y], 4, col.muted, 40 + Math.abs(lastDraw.vy), 1.4); }
    if (ev & EV.SAND) { squash(Math.abs(lastDraw.vy) * 1.3); spawn(view[X], view[Y], 8, col.sand, 50 + Math.abs(lastDraw.vy) * 1.5, 1.8); }
    if (ev & EV.RIM) anim.dip = now;
    if (ev & EV.WATER) {
      anim.splash = now; anim.splashX = lastDraw.x; anim.splashY = lastDraw.y; anim.reappear = now + 520;
      spawn(lastDraw.x, lastDraw.y, 6, col.water, 90, 1.2);
      sink.polite("Water.");
      sink.set({ strokes: view[STROKES] });
    }
    if (ev & (EV.HOLED | EV.OVER)) holeEnd(ev);
    else if (ev & EV.REST) {
      const d = Math.abs(view[X] - view[CUPX]);
      const where = SURFACE[surf[Math.min(MAXN - 1, Math.max(0, Math.round(view[X] / SP)))]] ?? "";
      sink.set({ strokes: view[STROKES] });
      sink.polite(`Stroke ${view[STROKES]}, ${where}, ${d < 10 ? d.toFixed(1) : d.toFixed(0)} metres from the cup.`);
    }
  }

  // ---- actions
  function refreshPreview() {
    bind();
    w.preview(aim.a, aim.p, aim.s);
    const n = Math.min(64, w.preview_len());
    pts = prevBuf.slice(0, n * 2);
  }
  function ready() { return started && !holeDone && view[PHASE] === READY && anim.reappear <= performance.now(); }
  function nudge(da: number, dp: number) {
    if (!ready()) return;
    aim.a = (aim.a + da) & 255;
    aim.p = Math.min(63, Math.max(1, aim.p + dp));
    aim.t = aim.p / 63;
    aim.shown = true;
    refreshPreview();
  }
  function hit() {
    if (!ready()) return;
    if (w.shoot(aim.a, aim.p, aim.s)) {
      aim.shown = false; trail.length = 0;
      sink.set({ strokes: view[STROKES] });
    }
  }
  function restart() {
    if (!started || holeDone) return;
    w.restart();
    trail.length = 0; aim.shown = false;
    sink.set({ strokes: 0 });
    sink.polite("Hole restarted.");
  }
  function next() {
    if (!holeDone || view[K] >= LAST_HOLE) return;
    sink.set({ over: null });
    wantStart();
  }
  function spin() {
    aim.s = (aim.s + 1) & 3;
    sink.set({ spin: SPINS[aim.s] });
    sink.polite(`Spin ${SPINS[aim.s]}.`);
    if (aim.shown) refreshPreview();
  }
  function act(a: Action) {
    bind();
    if (a === "aim+") nudge(2, 0);
    else if (a === "aim-") nudge(-2, 0);
    else if (a === "power+") nudge(0, 4);
    else if (a === "power-") nudge(0, -4);
    else if (a === "spin") spin();
    else if (a === "hit") hit();
    else if (a === "restart") restart();
    else next();
    wake();
  }

  // ---- input
  const maxPull = () => Math.min(110, 0.35 * W);
  function pointerAim(e: PointerEvent) {
    const d = aim.drag;
    if (!d) return;
    const r = canvas.getBoundingClientRect();
    const lx = d.x - (e.clientX - r.left), ly = -(d.y - (e.clientY - r.top));
    const len = Math.hypot(lx, ly);
    aim.t = Math.min(1, Math.max(0, (len - 10) / (maxPull() - 10)));
    if (len > 10) {
      aim.a = Math.round((Math.atan2(ly, lx) / TAU) * 256) & 255;
      aim.p = Math.max(1, Math.round(aim.t * 63));
      refreshPreview();
    }
    aim.shown = aim.t > 0;
  }
  function airborne() { return view[PHASE] === AIR || view[PHASE] === GROUND; }
  canvas.addEventListener("pointerdown", (e) => {
    bind();
    canvas.dataset.input = "pointer";
    canvas.focus({ preventScroll: true });
    if (airborne()) {
      if (motion()) { anim.ff = true; canvas.setPointerCapture(e.pointerId); }
      else { onEvents(w.settle()); }
      wake();
      return;
    }
    if (!ready()) return;
    const r = canvas.getBoundingClientRect();
    aim.drag = { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
    aim.t = 0; aim.shown = false;
    canvas.setPointerCapture(e.pointerId);
    wake();
  }, { signal });
  canvas.addEventListener("pointermove", (e) => {
    if (aim.drag && e.pointerId === aim.drag.id) { pointerAim(e); wake(); }
  }, { signal });
  function endDrag(e: PointerEvent, fire: boolean) {
    anim.ff = false;
    if (!aim.drag || e.pointerId !== aim.drag.id) return;
    pointerAim(e);
    aim.drag = null;
    if (fire && aim.t > 0) hit(); else aim.shown = false;
    wake();
  }
  canvas.addEventListener("pointerup", (e) => endDrag(e, true), { signal });
  canvas.addEventListener("pointercancel", (e) => endDrag(e, false), { signal });
  canvas.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    delete canvas.dataset.input;
    bind();
    const big = e.shiftKey ? 4 : 1;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => nudge(big, 0), ArrowRight: () => nudge(-big, 0), ArrowUp: () => nudge(0, 2 * big), ArrowDown: () => nudge(0, -2 * big),
      " ": hit, Enter: hit, r: restart, R: restart, s: spin, S: spin,
      Escape: () => { aim.drag = null; aim.shown = false; },
    };
    const f = keys[e.key];
    if (!f) return;
    e.preventDefault();
    f();
    wake();
  }, { signal });
  const retheme = () => { resolve(); if (started) buildStatic(); wake(); };
  const mo = new MutationObserver(retheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", retheme, { signal });
  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) wake(); }, { signal });
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }, { rootMargin: "100px" });
  io.observe(stage);

  // ---- loop
  function busy() {
    if (airborne() || aim.drag) return true;
    if (particles.length || (motion() && trail.length)) return true;
    const t = now;
    return t - anim.drawIn < 420 || t - anim.glide < 500 || t - anim.squashT < 140 || t - anim.dip < 220 || t - anim.holed < 500 || anim.reappear + 260 > t || t < anim.flutterUntil;
  }
  function wake() {
    anim.flutterUntil = performance.now() + 1500;
    if (!raf && !hidden && visible && !dead) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function loop(t: number) {
    raf = 0;
    now = t;
    bind();
    const dt = Math.min(100, t - last);
    last = t;
    if (airborne()) {
      lastDraw.x = view[X]; lastDraw.y = view[Y]; lastDraw.vy = view[VY];
      const ev = w.advance(dt * (anim.ff ? 3 : 1));
      if (ev) onEvents(ev);
      if (airborne() && trail.length < 1500) trail.push({ x: view[X], y: view[Y], t });
      if (!airborne()) anim.ff = false;
    }
    if (motion()) while (trail.length && t - trail[0].t > 1500) trail.shift();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += (160 * dt) / 1000; p.x += (p.vx * dt) / 1000; p.y += (p.vy * dt) / 1000; p.life -= dt / 520;
      if (p.life <= 0) particles.splice(i, 1);
    }
    render(t);
    if (busy() && !hidden && visible) raf = requestAnimationFrame(loop);
  }

  function render(t: number) {
    if (!started) return;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, W, H);
    const c = ctx!;
    const gl = (t - anim.glide) / 450;
    if (anim.glide && gl < 1 && oldLayer) {
      const e = easeOut(gl);
      c.drawImage(oldLayer, -W * e, 0, W, H);
      c.drawImage(staticLayer, W * (1 - e), 0, W, H);
    } else {
      oldLayer = null;
      const di = (t - anim.drawIn) / 380;
      if (anim.drawIn && di < 1) {
        const cw = W * easeOut(di);
        c.drawImage(staticLayer, 0, 0, cw * dpr, H * dpr, 0, 0, cw, H);
      } else c.drawImage(staticLayer, 0, 0, W, H);
    }
    const entering = anim.glide && gl < 1;
    c.save();
    c.translate(entering ? W * (1 - easeOut(gl)) : 0, 0);
    // Flag: a pole of symbol height and a cloth in the accent.
    const cupx = wx(view[CUPX]), cupy = wy(cupY());
    const pole = Math.max(20, Math.min(44, 2.1 * S));
    const fl = motion() && t < anim.flutterUntil ? Math.sin(t / 110) * 0.8 : 0;
    c.strokeStyle = rgb(col.ink);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(cupx + 3.5, cupy); c.lineTo(cupx + 3.5, cupy - pole); c.stroke();
    c.fillStyle = rgb(col.accent);
    c.beginPath();
    c.moveTo(cupx + 3.5, cupy - pole);
    c.quadraticCurveTo(cupx + 9, cupy - pole + 2 + fl, cupx + 15, cupy - pole + 3 + fl * 1.6);
    c.quadraticCurveTo(cupx + 9, cupy - pole + 5 + fl, cupx + 3.5, cupy - pole + 8);
    c.closePath();
    c.fill();
    // Trail: the in-flight Magnus curve. Under reduced motion it stays until the next shot.
    if (trail.length > 1) {
      c.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = motion() ? 1 - (t - trail[i].t) / 1500 : 1;
        c.strokeStyle = rgb(col.orange, 0.75 * a);
        c.lineWidth = 0.6 + 1.4 * a;
        c.beginPath(); c.moveTo(wx(trail[i - 1].x), wy(trail[i - 1].y) - br); c.lineTo(wx(trail[i].x), wy(trail[i].y) - br); c.stroke();
      }
    }
    // Aim: the first 0.4 s of the predicted flight as dots.
    if (aim.shown && view[PHASE] === READY && pts.length >= 4) {
      const n = pts.length / 2;
      for (let i = 0; i < 7; i++) {
        const j = Math.round((i * (n - 1)) / 6);
        c.fillStyle = rgb(col.orange, 0.85 - i * 0.08);
        c.beginPath(); c.arc(wx(pts[j * 2]), wy(pts[j * 2 + 1]) - br, 2.4 - i * 0.18, 0, TAU); c.fill();
      }
    }
    // Ball.
    let bx = wx(view[X]), by = wy(view[Y]) - br, scale = 1, alpha = 1;
    if (anim.splash && t < anim.reappear) {
      const f = Math.min(1, (t - anim.splash) / 220);
      bx = wx(anim.splashX); by = wy(anim.splashY) - br + f * 4; alpha = 1 - f; scale = 1 - f * 0.4;
    } else if (anim.reappear && t - anim.reappear < 240) {
      const f = easeOut((t - anim.reappear) / 240); scale = 0.6 + 0.4 * f; alpha = f;
    }
    if (view[PHASE] === 3 && sunk) {
      const e = easeOut(motion() ? Math.min(1, (t - anim.holed) / 340) : 1);
      bx = cupx; by = cupy - br + e * 8; scale = 1 - e; alpha = 1 - e * e;
    }
    if (view[Y] > ybase + H / S + 1) {
      c.fillStyle = rgb(col.ink, 0.7);
      c.beginPath(); c.moveTo(bx - 4, 10); c.lineTo(bx + 4, 10); c.lineTo(bx, 2); c.closePath(); c.fill();
    } else if (alpha > 0 && scale > 0) {
      const sq = anim.squash * Math.max(0, 1 - (t - anim.squashT) / 120);
      const dip = anim.dip && t - anim.dip < 200 ? Math.sin(((t - anim.dip) / 200) * Math.PI) * 2 : 0;
      c.save();
      c.globalAlpha = alpha;
      c.translate(bx, by + br + dip);
      c.scale(scale * (1 + sq * 0.9), scale * (1 - sq));
      c.fillStyle = rgb(col.ink);
      c.strokeStyle = rgb(col.ground);
      c.lineWidth = 1.5 / Math.max(scale, 0.2);
      c.beginPath(); c.arc(0, -br, br, 0, TAU); c.fill(); c.stroke();
      c.restore();
    }
    for (const p of particles) {
      c.fillStyle = rgb(p.color, Math.max(0, p.life));
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + 0.6 * p.life), 0, TAU); c.fill();
    }
    c.restore();
  }

  // ---- share
  function share(): string | null {
    const done = view[DONE];
    if (!holeDone || done < 1) return null;
    bind();
    const len = w.replay_encode();
    const bytes = new Uint8Array(w.memory.buffer, w.replay_buf_ptr(), 512);
    let code = "";
    for (let i = 0; i < len; i++) code += String.fromCharCode(bytes[i]);
    const diff = view[TOT] - view[TOTPAR];
    const hash = (w.hash_lo() >>> 0).toString(16).padStart(8, "0");
    const rel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : String(diff);
    return `Golf ${seedLabel(seed)} · ${done} ${done === 1 ? "hole" : "holes"} · ${view[TOT]} (${rel}) · ${hash}\n${location.origin}/?r=${code}#golf`;
  }

  // ---- boot
  resolve();
  layout();
  prepare(0);
  wantStart();
  return {
    act,
    share,
    destroy() {
      dead = true;
      stop.abort();
      mo.disconnect(); ro.disconnect(); io.disconnect();
      window.clearTimeout(prepTimer); window.clearTimeout(noteTimer);
      cancelAnimationFrame(raf);
    },
  };
}
