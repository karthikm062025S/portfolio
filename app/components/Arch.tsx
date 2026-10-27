import type { CSSProperties, ReactNode } from "react";
import { GLYPHS } from "../diagrams/glyphs";
import type { ArchDiagram, ArchEdge, ArchNode, Pt, Side } from "../diagrams/types";
import { ArchExpand } from "./ArchExpand";

// Data-driven architecture diagram (types in app/diagrams/types.ts). Same grammar as Diagram.tsx: ring + glyph for a service,
// rounded square for a gate, cylinder for a store, muted x for a drop. The draw-in beats and the travelling packet are CSS
// (globals.css "Architecture diagrams"); orange is only ever the packet and a sync edge while it draws in.

const STEP = 0.25; // seconds per beat (same as Diagram.tsx)
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
    case "queue": return [22, 10];
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
  const arrive = side(last, tc); // direction of travel into the target
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

// Multi-line text. `up` makes y the baseline of the LAST line (the block grows upward).
function Label({ x, y, text, anchor = "middle", up = false }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; up?: boolean }) {
  const ls = lines(text), y0 = up ? y - (ls.length - 1) * 13 : y;
  return <text x={x} y={y0} textAnchor={anchor} fontSize={11}>{ls.map((l, i) => <tspan key={i} x={x} dy={i ? 13 : 0}>{l}</tspan>)}</text>;
}

function Svg({ d, id, still }: { d: ArchDiagram; id: string; still?: boolean }) {
  const nodes = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
  const edges = d.edges.map((e) => ({ e, pts: route(e, nodes) }));
  // the request path: edges whose step is a number, in order; the packet plays them one after another
  const seq = edges.filter(({ e }) => e.step && /^\d+$/.test(e.step)).sort((a, b) => +a.e.step! - +b.e.step!);
  // beats: zones first, then nodes in step order, then edges in step order
  const order: string[] = [];
  const seen = (x: unknown) => { if (typeof x === "string" && !order.includes(x)) order.push(x); };
  seq.forEach(({ e }) => { seen(e.from); seen(e.to); });
  d.nodes.forEach((n) => seen(n.id));
  const nb = (nid: string) => 1 + order.indexOf(nid) * 0.35;
  const edgeStart = 1 + order.length * 0.35 + 0.3;
  const eorder = [...seq.map((s) => s.e), ...d.edges.filter((e) => !seq.some((s) => s.e === e))];
  const eb = (e: ArchEdge) => edgeStart + eorder.indexOf(e) * 0.22;
  const last = edgeStart + eorder.length * 0.22;
  // packet timing: constant speed, a short pause at each node, a rest before it loops
  const segs = seq.map(({ pts }) => Math.max(0.5, plen(pts) / SPEED)), PAUSE = 0.35, REST = 2.5;
  const cyc = segs.reduce((s, x) => s + x + PAUSE, 0) + REST;
  const kf = seq.map(({ pts }, i) => {
    const t = segs.slice(0, i).reduce((a, x) => a + x + PAUSE, 0);
    const s = (t / cyc) * 100, en = ((t + segs[i]) / cyc) * 100, pd = +((18 / plen(pts)) * 100).toFixed(2);
    return { pd, css: `@keyframes ${id}-k${i}{0%,${s.toFixed(2)}%{stroke-dashoffset:${pd}}${en.toFixed(2)}%,100%{stroke-dashoffset:-100}}` };
  });

  const parts: ReactNode[] = [];
  d.zones.forEach((z, i) => {
    if (i > 0) parts.push(<path key={`zr${i}`} className="az" d={`M${z.x},${d.boundary ? 34 : 14} V${d.h - 6}`} pathLength={1} style={beat(0)} />);
    parts.push(<text key={`zl${i}`} className="zl af" x={z.x + 8} y={24} fontSize={11} style={beat(0)}>{z.label}</text>);
  });
  if (d.boundary) {
    const b = d.boundary, lx = b.labelAt ?? b.x + b.w / 2;
    parts.push(
      <g key="tb" className="af" style={beat(0)}>
        <rect className="tb" x={b.x} y={b.y} width={b.w} height={b.h} rx={12} />
        <text className="zl tbl" x={lx} y={b.y + 3.5} textAnchor="middle" fontSize={11}>{b.label}</text>
      </g>,
    );
  }
  edges.forEach(({ e, pts }, i) => {
    const m = e.kind === "data" || e.kind === "failure", b = eb(e), L = longest(pts);
    const cls = e.kind === "sync" ? "ae" : e.kind === "data" ? "ad thin" : e.kind === "async" ? "ax dash" : "ax dots";
    const lab = e.label && (() => {
      const at = e.labelAt ?? (L.vertical ? ([L.mid[0] + 10, L.mid[1] + 4] as Pt) : ([L.mid[0], L.mid[1] - 8] as Pt));
      const anchor = e.labelAnchor ?? (L.vertical && !e.labelAt ? "start" : "middle");
      return <Label x={at[0]} y={at[1]} text={e.label} anchor={anchor} up={!L.vertical || !!e.labelAt} />;
    })();
    parts.push(
      <g key={`e${i}`} className={m ? "m" : undefined} style={beat(b)}>
        <path className={cls} d={rounded(pts, 9)} pathLength={1} />
        {!e.noArrow && <path className={`af ch${e.kind === "data" ? " thin" : ""}`} d={chevron(pts)} />}
        {lab && <g className="af el">{lab}</g>}
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
    else if (n.kind === "queue") shape = <path className="an" d={boxPath(n.x, n.y, 22, 10)} pathLength={1} />;
    if (n.kind === "client") gs = 26;
    if (n.kind === "dropped") gs = 14;
    if (n.kind === "store") gs = 0;
    const pos = n.pos ?? "bottom", ln = lines(n.label).length, mid = n.y + 4 - ((ln - 1) * 13) / 2;
    const lab = pos === "bottom" ? { x: n.x, y: n.y + hh + 14, a: "middle" as const, up: false }
      : pos === "top" ? { x: n.x, y: n.y - hh - 6, a: "middle" as const, up: true }
      : pos === "right" ? { x: n.x + hw + 8, y: mid, a: "start" as const, up: false }
      : pos === "left" ? { x: n.x - hw - 8, y: mid, a: "end" as const, up: false }
      : pos === "br" ? { x: n.x + hw + 2, y: n.y + hh + 12, a: "start" as const, up: false }
      : pos === "bl" ? { x: n.x - hw - 2, y: n.y + hh + 12, a: "end" as const, up: false }
      : pos === "tr" ? { x: n.x + hw + 2, y: n.y - hh - 4, a: "start" as const, up: true }
      : { x: n.x - hw - 2, y: n.y - hh - 4, a: "end" as const, up: true };
    parts.push(
      <g key={`n${n.id}`} className={muted ? "m" : undefined} style={beat(b)}>
        {shape}
        <g className="af">
          {n.glyph && gs > 0 && <svg x={n.x - gs / 2} y={n.y - gs / 2} width={gs} height={gs} viewBox="0 0 256 256" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={(1.5 * 256) / gs}>{GLYPHS[n.glyph]}</svg>}
          <Label x={lab.x} y={lab.y} text={n.label} anchor={lab.a} up={lab.up} />
        </g>
      </g>,
    );
  });
  edges.forEach(({ e, pts }, i) => {
    if (!e.step || e.badge === false || e.noArrow) return;
    const at = e.badge ?? longest(pts).mid;
    parts.push(
      <g key={`b${i}`} className="af badge" style={beat(eb(e))}>
        <circle cx={at[0]} cy={at[1]} r={8} />
        <text x={at[0]} y={at[1] + 4} textAnchor="middle" fontSize={11}>{e.step}</text>
      </g>,
    );
  });
  (d.notes ?? []).forEach((c, i) => {
    const tn = typeof c.target === "string" ? nodes[c.target] : undefined;
    const tp: Pt = tn ? [tn.x, tn.y - ext(tn)[1] - 1] : (c.target as Pt), anchor = c.anchor ?? "start";
    parts.push(
      <g key={`c${i}`} className="af note" style={beat(last + 0.3)}>
        <path d={`M${c.at[0]},${c.at[1] + 5} L${tp[0]},${tp[1]}`} className="lead" />
        <circle cx={tp[0]} cy={tp[1]} r={2.2} className="dot" />
        <text x={c.at[0]} y={c.at[1]} textAnchor={anchor} fontSize={11}>
          <tspan className="nb">{c.lines[0]}</tspan>
          {c.lines[1] && <tspan x={c.at[0]} dy={13}>{c.lines[1]}</tspan>}
        </text>
      </g>,
    );
  });
  const style = { "--T": `${(last * STEP + 0.42).toFixed(2)}s`, "--cyc": `${cyc.toFixed(2)}s` } as CSSProperties;
  return (
    <svg className={still ? "ar-svg still" : "ar-svg"} viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id.replace(/-x$/, "")}-steps`} style={style}>
      <title id={`${id}-t`}>{d.title}</title>
      <desc>{d.desc}</desc>
      {!still && <style>{kf.map((k) => k.css).join("")}</style>}
      {parts}
      {!still && seq.map(({ pts }, i) => <path key={`p${i}`} className="ap" d={rounded(pts, 9)} pathLength={100} style={{ strokeDasharray: `${kf[i].pd} 100`, animationName: `${id}-k${i}` } as CSSProperties} />)}
    </svg>
  );
}

export function Arch({ d }: { d: ArchDiagram }) {
  const id = `ar-${d.id}`;
  return (
    <div className="dg ar">
      <Svg d={d} id={id} />
      <ol className="ar-steps" id={`${id}-steps`} aria-label="Steps">
        {d.steps.map((s) => <li key={s.badge}><b className="bd" aria-hidden="true">{s.badge}</b><span><span className="sr">Step {s.badge}: </span>{s.text}</span></li>)}
      </ol>
      {d.fails && (
        <>
          <p className="label ar-fh">When it fails</p>
          <ul className="ar-fails">{d.fails.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
      <p className="label ar-key">Solid: request. Dashed: async. Thin: data. Dotted: failure.</p>
      <ArchExpand title={d.title}>
        <Svg d={d} id={`${id}-x`} still />
      </ArchExpand>
    </div>
  );
}
