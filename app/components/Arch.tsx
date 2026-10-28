import type { CSSProperties, ReactNode } from "react";
import { GLYPHS } from "../diagrams/glyphs";
import type { ArchDiagram, ArchEdge, ArchNode, Pt, Side } from "../diagrams/types";
import { ArchExpand } from "./ArchExpand";

// Data-driven architecture diagram (types in app/diagrams/types.ts). Grammar: ring + glyph for a service,
// rounded square for a gate, cylinder for a store, muted x for a drop. The draw-in beats and the travelling packet are CSS
// (globals.css "Architecture diagrams"); orange is only ever the packet and a sync edge while it draws in. Two SVGs are drawn,
// the wide layout and the phone one (d.narrow); CSS shows one per breakpoint. Both run on the wide layout's clock, so the step
// list stays in sync with whichever is showing.

const STEP = 0.25; // seconds per beat
const SPEED = 240; // packet units per second
const R = 15; // ring radius
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const plen = (p: Pt[]) => p.slice(1).reduce((s, q, i) => s + dist(p[i], q), 0);

function rounded(pts: Pt[], rr: number) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const r = Math.min(rr, l1 / 2, l2 / 2);
    d += ` L${x1 - ((x1 - x0) / l1) * r},${y1 - ((y1 - y0) / l1) * r} Q${x1},${y1} ${x1 + ((x2 - x1) / l2) * r},${y1 + ((y2 - y1) / l2) * r}`;
  }
  const [ex, ey] = pts[pts.length - 1];
  return `${d} L${ex},${ey}`;
}
function chevron(pts: Pt[], size = 5) {
  const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1];
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, w = size * 0.8;
  return `M${x1 - dx * size - dy * w},${y1 - dy * size + dx * w} L${x1},${y1} L${x1 - dx * size + dy * w},${y1 - dy * size - dx * w}`;
}
const ringPath = (x: number, y: number, r: number) => `M${x - r},${y} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r},0 Z`;
function boxPath(x: number, y: number, hw: number, hh: number) {
  const k = 5, w = 2 * hw - 2 * k, h = 2 * hh - 2 * k;
  return `M${x - hw + k},${y - hh} h${w} a${k},${k} 0 0 1 ${k},${k} v${h} a${k},${k} 0 0 1 ${-k},${k} h${-w} a${k},${k} 0 0 1 ${-k},${-k} v${-h} a${k},${k} 0 0 1 ${k},${-k} Z`;
}
const hexPath = (x: number, y: number, r: number) => `M${x - r},${y} L${x - r / 2},${y - r * 0.87} L${x + r / 2},${y - r * 0.87} L${x + r},${y} L${x + r / 2},${y + r * 0.87} L${x - r / 2},${y + r * 0.87} Z`;
function cylPath(x: number, y: number) {
  const hw = 16, ry = 5, t = y - 12, b = y + 12;
  return `M${x - hw},${t} a${hw},${ry} 0 1 0 ${2 * hw},0 a${hw},${ry} 0 1 0 ${-2 * hw},0 v${b - t} a${hw},${ry} 0 0 0 ${2 * hw},0 v${-(b - t)}`;
}

// half extents of a node's shape, for edge ports
function ext(n: ArchNode): [number, number] {
  switch (n.kind) {
    case "client": return [13, 13];
    case "dropped": return [9, 9];
    case "store": return [16, 17];
    case "gate": return [(n.w ?? 30) / 2, 15];
    default: return [R, R];
  }
}
function port(n: ArchNode, s: Side, off = 0): Pt {
  const [hw, hh] = ext(n), g = 2;
  return s === "right" ? [n.x + hw + g, n.y + off] : s === "left" ? [n.x - hw - g, n.y + off] : s === "top" ? [n.x + off, n.y - hh - g] : [n.x + off, n.y + hh + g];
}
const horiz = (s: Side) => s === "left" || s === "right";

// Turn an edge spec into an orthogonal polyline whose ends sit on the node borders.
function route(e: ArchEdge, nodes: Record<string, ArchNode>): Pt[] {
  const fn = typeof e.from === "string" ? nodes[e.from] : undefined, tn = typeof e.to === "string" ? nodes[e.to] : undefined;
  const fc: Pt = fn ? [fn.x, fn.y] : (e.from as Pt), tc: Pt = tn ? [tn.x, tn.y] : (e.to as Pt);
  const mids = (e.via ?? []).map((p) => [...p] as Pt);
  const first = mids[0] ?? tc;
  const side = (a: Pt, b: Pt): Side => (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? (b[0] >= a[0] ? "right" : "left") : b[1] >= a[1] ? "bottom" : "top");
  const fs = e.fromSide ?? side(fc, first);
  const p0 = fn ? port(fn, fs, e.fromOff) : fc;
  if (mids[0]) { if (horiz(fs)) mids[0][1] = p0[1]; else mids[0][0] = p0[0]; }
  const last = mids[mids.length - 1] ?? (horiz(fs) ? ([tc[0], p0[1]] as Pt) : ([p0[0], tc[1]] as Pt));
  const arrive = dist(last, tc) < 13 ? fs : side(last, tc); // aligned with no corner: keep travelling the way we left; direction of travel into the target
  const ts: Side = e.toSide ?? (arrive === "right" ? "left" : arrive === "left" ? "right" : arrive === "bottom" ? "top" : "bottom");
  const p1 = tn ? port(tn, ts, e.toOff) : tc;
  if (mids.length) { const m = mids[mids.length - 1]; if (horiz(ts)) m[1] = p1[1]; else m[0] = p1[0]; }
  const raw: Pt[] = [p0, ...mids, p1], out: Pt[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const a = out[out.length - 1], b = raw[i];
    if (Math.abs(a[0] - b[0]) > 0.5 && Math.abs(a[1] - b[1]) > 0.5) {
      const prevH = out.length === 1 ? horiz(fs) : Math.abs(out[out.length - 2][1] - a[1]) < 0.5;
      out.push(prevH ? [b[0], a[1]] : [a[0], b[1]]);
    }
    out.push(b);
  }
  return out;
}

function longest(p: Pt[]) {
  let bi = 0, bl = -1;
  for (let i = 0; i < p.length - 1; i++) { const l = dist(p[i], p[i + 1]); if (l > bl) { bl = l; bi = i; } }
  const [a, b] = [p[bi], p[bi + 1]];
  return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt, vertical: Math.abs(a[0] - b[0]) < 0.5 };
}

const beat = (s: number) => ({ "--s": s }) as CSSProperties;
const lines = (s: string) => s.split("\n");
const pc = (x: number) => `${x.toFixed(2)}%`;

// Multi-line text. `up` makes y the baseline of the LAST line (the block grows upward). fs is the label size (11 unless the
// diagram sets labelSize); every offset below scales with it, so 11 reproduces the original geometry exactly.
function Label({ x, y, text, anchor = "middle", up = false, fs = 11 }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; up?: boolean; fs?: number }) {
  const lh = (13 * fs) / 11, ls = lines(text), y0 = up ? y - (ls.length - 1) * lh : y;
  return <text x={x} y={y0} textAnchor={anchor} fontSize={fs} style={fs === 11 ? undefined : { fontSize: fs }}>{ls.map((l, i) => <tspan key={i} x={x} dy={i ? lh : 0}>{l}</tspan>)}</text>;
}

type Place = { x: number; y: number; a: "start" | "middle" | "end"; up: boolean };
function nodeLab(n: ArchNode, fs = 11): Place {
  const k = fs / 11, [hw, hh] = ext(n), pos = n.pos ?? "bottom", mid = n.y + 4 * k - ((lines(n.label).length - 1) * 13 * k) / 2;
  return pos === "bottom" ? { x: n.x, y: n.y + hh + 14 * k, a: "middle", up: false }
    : pos === "top" ? { x: n.x, y: n.y - hh - 6, a: "middle", up: true }
    : pos === "right" ? { x: n.x + hw + 8, y: mid, a: "start", up: false }
    : pos === "left" ? { x: n.x - hw - 8, y: mid, a: "end", up: false }
    : pos === "br" ? { x: n.x + hw + 2, y: n.y + hh + 12 * k, a: "start", up: false }
    : pos === "tr" ? { x: n.x + hw + 2, y: n.y - hh - 4, a: "start", up: true }
    : { x: n.x - hw - 2, y: n.y - hh - 4, a: "end", up: true };
}
function edgeLab(e: ArchEdge, pts: Pt[]): Place {
  const L = longest(pts), at = e.labelAt ?? (L.vertical ? ([L.mid[0] + 10, L.mid[1] + 4] as Pt) : ([L.mid[0], L.mid[1] - 8] as Pt));
  return { x: at[0], y: at[1], a: e.labelAnchor ?? (L.vertical && !e.labelAt ? "start" : "middle"), up: !L.vertical || !!e.labelAt };
}

// The phone layout as a diagram of its own: wide data, narrow positions. Routing falls back to defaults, not the wide values.
function narrowOf(d: ArchDiagram): ArchDiagram {
  const n = d.narrow;
  return {
    ...d,
    w: n.w,
    h: n.h,
    nodes: d.nodes.map((x) => ({ ...x, pos: undefined, ...n.nodes[x.id] })),
    edges: d.edges.map((e, i) => ({ from: e.from, to: e.to, kind: e.kind, step: e.step, label: e.label, noArrow: e.noArrow, badge: e.badge === false ? false : undefined, ...n.edges[i] })),
  };
}

const place = (d: ArchDiagram) => {
  const nodes = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
  return d.edges.map((e) => route(e, nodes));
};

// Beats and the packet clock, from the wide layout; shared by both SVGs and the step list. Edges are referred to by index.
function timing(d: ArchDiagram) {
  const pts = place(d), all = d.edges.map((_, i) => i);
  // the request path: edges whose step is a number, in order
  const seq = all.filter((i) => /^\d+$/.test(d.edges[i].step ?? "")).sort((a, b) => +d.edges[a].step! - +d.edges[b].step!);
  // beats: nodes in step order, then edges in step order
  const order: string[] = [];
  const seen = (x: unknown) => { if (typeof x === "string" && !order.includes(x)) order.push(x); };
  seq.forEach((i) => { seen(d.edges[i].from); seen(d.edges[i].to); });
  d.nodes.forEach((n) => seen(n.id));
  const nb = (nid: string) => 1 + order.indexOf(nid) * 0.35;
  const edgeStart = 1 + order.length * 0.35 + 0.3;
  const eorder = [...seq, ...all.filter((i) => !seq.includes(i))];
  const eb = (i: number) => edgeStart + eorder.indexOf(i) * 0.22;
  const last = edgeStart + eorder.length * 0.22;
  // packet: constant speed, a short pause after each step, a rest before it loops. The edges play one after another; with
  // `parallel`, edges sharing a step number start together (one packet each) and the step lasts as long as its longest edge.
  const segs = seq.map((i) => Math.max(0.5, plen(pts[i]) / SPEED)), PAUSE = 0.35, REST = 2.5;
  const key = (k: number) => (d.parallel ? d.edges[seq[k]].step! : `${k}`);
  const dur = new Map<string, number>();
  seq.forEach((_, k) => dur.set(key(k), Math.max(dur.get(key(k)) ?? 0, segs[k])));
  const start = new Map<string, number>();
  let t = 0;
  dur.forEach((x, g) => { start.set(g, t); t = t + x + PAUSE; });
  const t0 = seq.map((_, k) => start.get(key(k))!);
  // each step's window in the cycle (first packet out to the end of its pause), for the synced step-line tint
  const win: Record<string, [number, number]> = {};
  seq.forEach((i, k) => { const s = d.edges[i].step!, w = win[s], a = t0[k], b = a + segs[k] + PAUSE; win[s] = w ? [Math.min(w[0], a), Math.max(w[1], b)] : [a, b]; });
  const cyc = t + REST;
  const clock = { "--T": `${(last * STEP + 0.42).toFixed(2)}s`, "--cyc": `${cyc.toFixed(2)}s` } as CSSProperties;
  return { seq, nb, eb, segs, t0, win, cyc, clock };
}
type Timing = ReturnType<typeof timing>;

function Svg({ d, tm, id, cls, still }: { d: ArchDiagram; tm: Timing; id: string; cls: string; still?: boolean }) {
  const { seq, nb, eb, segs, t0, cyc, clock } = tm, pts = place(d), fs = d.labelSize ?? 11;
  // the packet runs on the shared clock; only its dash length (18 units of this layout's path) is per layout. It waits half a
  // unit off each end of the path, so a round cap never leaves a static orange dot there.
  const kf = seq.map((ei, k) => {
    const s = (t0[k] / cyc) * 100, en = ((t0[k] + segs[k]) / cyc) * 100, pd = +((18 / plen(pts[ei])) * 100).toFixed(2);
    return { pd, css: `@keyframes ${id}-k${k}{0%,${s.toFixed(2)}%{stroke-dashoffset:${pd + 0.5}}${en.toFixed(2)}%,100%{stroke-dashoffset:-100.5}}` };
  });
  const parts: ReactNode[] = [];
  d.edges.forEach((e, i) => {
    const m = e.kind === "data" || e.kind === "failure";
    const ec = e.kind === "sync" ? "ae" : e.kind === "data" ? "ad thin" : e.kind === "async" ? "ax dash" : "ax dots";
    const lab = e.label && (() => { const l = edgeLab(e, pts[i]); return <Label x={l.x} y={l.y} text={e.label} anchor={l.a} up={l.up} fs={fs} />; })();
    parts.push(
      <g key={`e${i}`} className={m ? "m" : undefined} style={beat(eb(i))}>
        <path className={ec} d={rounded(pts[i], 9)} pathLength={1} />
        {!e.noArrow && <path className={`af ch${e.kind === "data" ? " thin" : ""}`} d={chevron(pts[i])} />}
        {lab && <g className="af">{lab}</g>}
      </g>,
    );
  });
  d.nodes.forEach((n) => {
    const [hw, hh] = ext(n), b = nb(n.id), muted = n.kind === "external" || n.kind === "dropped";
    let shape: ReactNode = null, gs = 18;
    if (n.kind === "service" || n.kind === "cron" || n.kind === "external") shape = <path className="an" d={ringPath(n.x, n.y, R)} pathLength={1} />;
    else if (n.kind === "gate") shape = <path className="an" d={boxPath(n.x, n.y, hw, hh)} pathLength={1} />;
    else if (n.kind === "model") shape = <path className="an" d={hexPath(n.x, n.y, R + 2)} pathLength={1} />;
    else if (n.kind === "store") shape = <path className="an" d={cylPath(n.x, n.y)} pathLength={1} />;
    if (n.kind === "client") gs = 26;
    if (n.kind === "dropped") gs = 14;
    if (n.kind === "store") gs = 0;
    const lab = nodeLab(n, fs);
    parts.push(
      <g key={`n${n.id}`} className={muted ? "m" : undefined} style={beat(b)}>
        {shape}
        <g className="af">
          {n.glyph && gs > 0 && <svg x={n.x - gs / 2} y={n.y - gs / 2} width={gs} height={gs} viewBox="0 0 256 256" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={(1.5 * 256) / gs}>{GLYPHS[n.glyph]}</svg>}
          <Label x={lab.x} y={lab.y} text={n.label} anchor={lab.a} up={lab.up} fs={fs} />
        </g>
      </g>,
    );
  });
  d.edges.forEach((e, i) => {
    if (!e.step || e.badge === false || e.noArrow) return;
    const at = e.badge ?? longest(pts[i]).mid;
    parts.push(
      <g key={`b${i}`} className="af badge" style={beat(eb(i))}>
        <circle cx={at[0]} cy={at[1]} r={8} />
        <text x={at[0]} y={at[1] + 4} textAnchor="middle" fontSize={11}>{e.step}</text>
      </g>,
    );
  });
  return (
    <svg className={cls} viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-labelledby={`${id}-t`} style={clock}>
      <title id={`${id}-t`}>{d.title}</title>
      <desc>{d.desc}</desc>
      {!still && <style>{kf.map((k) => k.css).join("")}</style>}
      {parts}
      {!still && seq.map((ei, k) => <path key={`p${k}`} className="ap" d={rounded(pts[ei], 9)} pathLength={100} style={{ strokeDasharray: `${kf[k].pd} 200`, animationName: `${id}-k${k}` } as CSSProperties} />)}
    </svg>
  );
}

export function Arch({ d }: { d: ArchDiagram }) {
  const id = `ar-${d.id}`, tm = timing(d), c = tm.cyc / 100;
  const nd = narrowOf(d);
  // the step line in play gets a soft ink tint (never orange) on the packet's cycle
  const sk = Object.entries(tm.win).map(([g, [a, b]]) => `@keyframes ${id}-s${g}{0%,${pc(a / c)}{background-color:transparent}${pc(a / c + 0.3)},${pc(b / c)}{background-color:var(--tint)}${pc(b / c + 0.3)},100%{background-color:transparent}}`);
  return (
    <div className="dg ar">
      <style>{sk.join("")}</style>
      <Svg d={d} tm={tm} id={id} cls="ar-svg ar-w" />
      <Svg d={nd} tm={tm} id={`${id}-n`} cls="ar-svg ar-n" />
      <ol className="ar-steps" aria-label="Steps" style={tm.clock}>
        {d.steps.map((s) => <li key={s.badge} style={{ animationName: `${id}-s${s.badge}` }}><b className="bd" aria-hidden="true">{s.badge}</b><span><span className="sr">Step {s.badge}: </span>{s.text}</span></li>)}
      </ol>
      <ArchExpand title={d.title}>
        <Svg d={d} tm={tm} id={`${id}-x`} cls="ar-svg still" still />
      </ArchExpand>
    </div>
  );
}
