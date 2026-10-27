import type { CSSProperties, ReactNode } from "react";

// Pipeline diagrams of the real systems, one per project. Each has a row variant (left to right, 840x160, from 1024px up)
// and a phone variant (top down, 358x280). Nodes are Phosphor regular glyphs in a ring; a check or gate is a rounded square;
// a drop is a muted x with no ring. `s` is the beat at which an element draws in when the row opens (globals.css "Diagrams").

type Pos = "above" | "below" | "right";
type Node = { x: number; y: number; icon: Glyph; label: string; pos: Pos; shape?: "square" | "drop"; s: number };
type Edge = { pts: number[][]; arrow?: boolean; label?: string; lpos?: Pos; s: number };
// route: the path the packet travels, node centre to node centre through the emphasis node.
type Variant = { w: number; h: number; r: number; g: number; nodes: Node[]; edges: Edge[]; route: number[][] };
type Def = { title: string; desc: string; row: Variant; phone: Variant };

const GLYPHS = {
  "images": <><rect x="64" y="48" width="160" height="128" rx="8"/><circle cx="172" cy="84" r="12" fill="currentColor" stroke="none"/><path d="M64,128.69l38.34-38.35a8,8,0,0,1,11.32,0L163.31,140,189,114.34a8,8,0,0,1,11.31,0L224,138.06"/><path d="M192,176v24a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V88a8,8,0,0,1,8-8H64"/></>,
  "text-t": <><line x1="128" y1="56" x2="128" y2="200"/><polyline points="56 88 56 56 200 56 200 88"/><line x1="96" y1="200" x2="160" y2="200"/></>,
  "text-strikethrough": <><line x1="40" y1="128" x2="216" y2="128"/><path d="M76.33,96a25.71,25.71,0,0,1-1.22-8c0-22.09,22-40,52.89-40,23,0,40.24,9.87,48,24"/><path d="M72,168c0,22.09,25.07,40,56,40s56-17.91,56-40c0-23.77-21.62-33-45.6-40"/></>,
  "scales": <><line x1="128" y1="40" x2="128" y2="216"/><line x1="104" y1="216" x2="152" y2="216"/><line x1="56" y1="88" x2="200" y2="56"/><path d="M24,168c0,17.67,20,24,32,24s32-6.33,32-24L56,88Z"/><path d="M168,136c0,17.67,20,24,32,24s32-6.33,32-24L200,56Z"/></>,
  "trend-down": <><polyline points="232 192 136 96 96 136 24 64"/><polyline points="232 128 232 192 168 192"/></>,
  "clock": <><circle cx="128" cy="128" r="96"/><polyline points="128 72 128 128 184 128"/></>,
  "buildings": <><path d="M136,216V32a8,8,0,0,0-12.44-6.65l-80,53.33A8,8,0,0,0,40,85.35V216"/><path d="M136,88h72a8,8,0,0,1,8,8V216"/><line x1="16" y1="216" x2="240" y2="216"/><line x1="104" y1="112" x2="104" y2="128"/><line x1="72" y1="112" x2="72" y2="128"/><line x1="72" y1="168" x2="72" y2="184"/><line x1="104" y1="168" x2="104" y2="184"/></>,
  "magnifying-glass": <><circle cx="112" cy="112" r="80"/><line x1="168.57" y1="168.57" x2="224" y2="224"/></>,
  "flag": <><line x1="48" y1="224" x2="48" y2="56"/><path d="M48,176c64-55.43,112,55.43,176,0V56C160,111.43,112,.57,48,56"/></>,
  "rss": <><path d="M56,136a64,64,0,0,1,64,64"/><path d="M56,88A112,112,0,0,1,168,200"/><path d="M56,40A160,160,0,0,1,216,200"/><circle cx="60" cy="196" r="12" fill="currentColor" stroke="none"/></>,
  "student": <><line x1="32" y1="64" x2="32" y2="144"/><path d="M56,216c15.7-24.08,41.11-40,72-40s56.3,15.92,72,40"/><polygon points="224 64 128 96 32 64 128 32 224 64"/><path d="M169.34,82.22a56,56,0,1,1-82.68,0"/></>,
  "briefcase": <><rect x="32" y="64" width="192" height="144" rx="8"/><path d="M168,64V48a16,16,0,0,0-16-16H104A16,16,0,0,0,88,48V64"/><path d="M224,118.31A191.09,191.09,0,0,1,128,144a191.14,191.14,0,0,1-96-25.68"/><line x1="112" y1="112" x2="144" y2="112"/></>,
  "function": <><line x1="72" y1="128" x2="184" y2="128"/><path d="M56,216H85.29a32,32,0,0,0,31.49-26.28L139.22,66.28A32,32,0,0,1,170.71,40H200"/></>,
  "note-pencil": <><polygon points="128 160 96 160 96 128 192 32 224 64 128 160"/><line x1="168" y1="56" x2="200" y2="88"/><path d="M216,128v80a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8h80"/></>,
  "books": <><rect x="48" y="40" width="64" height="176" rx="8"/><path d="M217.67,205.77l-46.81,10a8,8,0,0,1-9.5-6.21L128.18,51.8a8.07,8.07,0,0,1,6.15-9.57l46.81-10a8,8,0,0,1,9.5,6.21L223.82,196.2A8.07,8.07,0,0,1,217.67,205.77Z"/><line x1="48" y1="72" x2="112" y2="72"/><line x1="48" y1="184" x2="112" y2="184"/><line x1="133.16" y1="75.48" x2="195.61" y2="62.06"/><line x1="139.79" y1="107.04" x2="202.25" y2="93.62"/><line x1="156.39" y1="185.94" x2="218.84" y2="172.52"/></>,
  "path": <><circle cx="200" cy="200" r="24"/><path d="M72,56h96a32,32,0,0,1,0,64H72a40,40,0,0,0,0,80H176"/></>,
  "x-circle": <><line x1="160" y1="96" x2="96" y2="160"/><line x1="96" y1="96" x2="160" y2="160"/><circle cx="128" cy="128" r="96"/></>,
  "camera": <><path d="M208,208H48a16,16,0,0,1-16-16V80A16,16,0,0,1,48,64H80L96,40h64l16,24h32a16,16,0,0,1,16,16V192A16,16,0,0,1,208,208Z"/><circle cx="128" cy="132" r="36"/></>,
  "eye": <><path d="M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Z"/><circle cx="128" cy="128" r="40"/></>,
  "book-open": <><path d="M128,88a32,32,0,0,1,32-32h72V200H160a32,32,0,0,0-32,32"/><path d="M24,200H96a32,32,0,0,1,32,32V88A32,32,0,0,0,96,56H24Z"/></>,
  "equals": <><line x1="40" y1="160" x2="216" y2="160"/><line x1="40" y1="96" x2="216" y2="96"/></>,
  "file-text": <><path d="M200,224H56a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h96l56,56V216A8,8,0,0,1,200,224Z"/><polyline points="152 32 152 88 208 88"/><line x1="96" y1="136" x2="160" y2="136"/><line x1="96" y1="168" x2="160" y2="168"/></>,
} as const;
type Glyph = keyof typeof GLYPHS;

const R = { w: 840, h: 160, r: 18, g: 20 };
const P = { w: 358, h: 280, r: 16, g: 18 };

const DEFS = {
  research: {
    title: "How the experiment ran",
    desc: "Photos go through two lanes, one with the species name in the reference text and one with the name removed; the lanes are compared and accuracy drops.",
    row: { ...R, nodes: [
      { x: 72, y: 80, icon: "images", label: "Photos", pos: "above", s: 0 },
      { x: 300, y: 50, icon: "text-t", label: "With name", pos: "above", s: 2.2 },
      { x: 300, y: 112, icon: "text-strikethrough", label: "Name removed", pos: "below", s: 2.2 },
      { x: 540, y: 80, icon: "scales", label: "Compare", pos: "above", s: 4.8 },
      { x: 768, y: 80, icon: "trend-down", label: "Accuracy drop", pos: "above", s: 6.8 },
    ], edges: [
      { pts: [[95, 80], [180, 80], [180, 50], [277, 50]], arrow: true, s: 1 },
      { pts: [[180, 80], [180, 112], [277, 112]], arrow: true, s: 1 },
      { pts: [[323, 50], [460, 50], [460, 80]], s: 3.4 },
      { pts: [[323, 112], [460, 112], [460, 80]], s: 3.4 },
      { pts: [[460, 80], [517, 80]], arrow: true, s: 4 },
      { pts: [[563, 80], [745, 80]], arrow: true, s: 5.8 },
    ], route: [[72, 80], [180, 80], [180, 112], [460, 112], [460, 80], [768, 80]] },
    phone: { ...P, nodes: [
      { x: 36, y: 28, icon: "images", label: "Photos", pos: "right", s: 0 },
      { x: 36, y: 100, icon: "text-t", label: "With name", pos: "right", s: 2.2 },
      { x: 190, y: 100, icon: "text-strikethrough", label: "Name removed", pos: "right", s: 2.2 },
      { x: 36, y: 172, icon: "scales", label: "Compare", pos: "right", s: 4.6 },
      { x: 36, y: 236, icon: "trend-down", label: "Accuracy drop", pos: "right", s: 6.6 },
    ], edges: [
      { pts: [[36, 49], [36, 79]], arrow: true, s: 1 },
      { pts: [[36, 60], [190, 60], [190, 79]], arrow: true, s: 1 },
      { pts: [[36, 121], [36, 151]], arrow: true, s: 3.4 },
      { pts: [[190, 121], [190, 136], [36, 136]], s: 3.4 },
      { pts: [[36, 193], [36, 215]], arrow: true, s: 5.6 },
    ], route: [[36, 28], [36, 60], [190, 60], [190, 136], [36, 136], [36, 236]] },
  },
  scout: {
    title: "How Scout runs a scan",
    desc: "A schedule triggers reads of company job boards; postings flow to the feed while the counts pass an empty-scan check that raises a flag.",
    row: { ...R, nodes: [
      { x: 72, y: 72, icon: "clock", label: "Schedule", pos: "above", s: 0 },
      { x: 310, y: 72, icon: "buildings", label: "Job boards", pos: "above", s: 2 },
      { x: 548, y: 72, icon: "magnifying-glass", label: "Empty-scan check", pos: "above", shape: "square", s: 6 },
      { x: 768, y: 72, icon: "flag", label: "Flag", pos: "above", s: 8 },
      { x: 548, y: 132, icon: "rss", label: "Feed", pos: "right", s: 4 },
    ], edges: [
      { pts: [[95, 72], [287, 72]], arrow: true, s: 1 },
      { pts: [[333, 72], [525, 72]], arrow: true, label: "counts", lpos: "above", s: 5 },
      { pts: [[310, 95], [310, 132], [525, 132]], arrow: true, label: "postings", lpos: "above", s: 3 },
      { pts: [[571, 72], [745, 72]], arrow: true, s: 7 },
    ], route: [[72, 72], [768, 72]] },
    phone: { ...P, nodes: [
      { x: 36, y: 28, icon: "clock", label: "Schedule", pos: "right", s: 0 },
      { x: 36, y: 84, icon: "buildings", label: "Job boards", pos: "right", s: 2 },
      { x: 36, y: 140, icon: "magnifying-glass", label: "Empty-scan check", pos: "right", shape: "square", s: 6 },
      { x: 36, y: 196, icon: "flag", label: "Flag", pos: "right", s: 8 },
      { x: 230, y: 140, icon: "rss", label: "Feed", pos: "right", s: 4 },
    ], edges: [
      { pts: [[36, 49], [36, 63]], arrow: true, s: 1 },
      { pts: [[36, 105], [36, 119]], arrow: true, s: 5 },
      { pts: [[36, 112], [230, 112], [230, 119]], arrow: true, s: 3 },
      { pts: [[36, 161], [36, 175]], arrow: true, s: 7 },
    ], route: [[36, 28], [36, 196]] },
  },
  prospect: {
    title: "How Prospect builds a roadmap",
    desc: "A student profile and live postings are scored by code, an agent plans steps, and a catalog gate drops any step not in the catalog before the roadmap.",
    row: { ...R, nodes: [
      { x: 72, y: 50, icon: "student", label: "Student", pos: "above", s: 0 },
      { x: 72, y: 110, icon: "briefcase", label: "Live postings", pos: "below", s: 0 },
      { x: 300, y: 76, icon: "function", label: "Code scores", pos: "above", s: 2.2 },
      { x: 480, y: 76, icon: "note-pencil", label: "Agent plans", pos: "above", s: 4.2 },
      { x: 640, y: 76, icon: "books", label: "Catalog gate", pos: "above", shape: "square", s: 6.2 },
      { x: 790, y: 76, icon: "path", label: "Roadmap", pos: "above", s: 9.4 },
      { x: 640, y: 136, icon: "x-circle", label: "not in catalog", pos: "right", shape: "drop", s: 7.7 },
    ], edges: [
      { pts: [[95, 50], [200, 50], [200, 76]], s: 1 },
      { pts: [[95, 110], [200, 110], [200, 76]], s: 1 },
      { pts: [[200, 76], [277, 76]], arrow: true, s: 1.5 },
      { pts: [[323, 76], [457, 76]], arrow: true, label: "target job", lpos: "below", s: 3.2 },
      { pts: [[503, 76], [617, 76]], arrow: true, s: 5.2 },
      { pts: [[663, 76], [767, 76]], arrow: true, label: "verified only", lpos: "below", s: 8.4 },
      { pts: [[640, 99], [640, 122]], arrow: true, s: 7.2 },
    ], route: [[72, 50], [200, 50], [200, 76], [790, 76]] },
    phone: { ...P, nodes: [
      { x: 36, y: 28, icon: "student", label: "Student", pos: "right", s: 0 },
      { x: 190, y: 28, icon: "briefcase", label: "Live postings", pos: "right", s: 0 },
      { x: 36, y: 92, icon: "function", label: "Code scores", pos: "right", s: 2.2 },
      { x: 36, y: 148, icon: "note-pencil", label: "Agent plans", pos: "right", s: 4.2 },
      { x: 36, y: 204, icon: "books", label: "Catalog gate", pos: "right", shape: "square", s: 6.2 },
      { x: 36, y: 260, icon: "path", label: "Roadmap", pos: "right", s: 9.4 },
      { x: 190, y: 232, icon: "x-circle", label: "not in catalog", pos: "right", shape: "drop", s: 7.7 },
    ], edges: [
      { pts: [[36, 49], [36, 71]], arrow: true, s: 1 },
      { pts: [[190, 49], [190, 60], [36, 60]], s: 1 },
      { pts: [[36, 113], [36, 127]], arrow: true, s: 3.2 },
      { pts: [[36, 169], [36, 183]], arrow: true, s: 5.2 },
      { pts: [[36, 225], [36, 239]], arrow: true, s: 8.4 },
      { pts: [[36, 232], [176, 232]], arrow: true, s: 7.2 },
    ], route: [[36, 28], [36, 260]] },
  },
  witness: {
    title: "How Witness drafts a complaint",
    desc: "A photo is read, statutes are found, every citation is checked against the stored statutes and unmatched ones drop, then the complaint is written.",
    row: { ...R, nodes: [
      { x: 72, y: 72, icon: "camera", label: "Photo", pos: "above", s: 0 },
      { x: 246, y: 72, icon: "eye", label: "Read photo", pos: "above", s: 2 },
      { x: 420, y: 72, icon: "book-open", label: "Find statutes", pos: "above", s: 4 },
      { x: 594, y: 72, icon: "equals", label: "Citation check", pos: "above", shape: "square", s: 6 },
      { x: 768, y: 72, icon: "file-text", label: "Complaint", pos: "above", s: 9.2 },
      { x: 594, y: 134, icon: "x-circle", label: "no match", pos: "right", shape: "drop", s: 7.5 },
    ], edges: [
      { pts: [[95, 72], [223, 72]], arrow: true, s: 1 },
      { pts: [[269, 72], [397, 72]], arrow: true, s: 3 },
      { pts: [[443, 72], [571, 72]], arrow: true, label: "citations", lpos: "below", s: 5 },
      { pts: [[617, 72], [745, 72]], arrow: true, label: "verified only", lpos: "below", s: 8.2 },
      { pts: [[594, 95], [594, 120]], arrow: true, s: 7 },
    ], route: [[72, 72], [768, 72]] },
    phone: { ...P, nodes: [
      { x: 36, y: 28, icon: "camera", label: "Photo", pos: "right", s: 0 },
      { x: 36, y: 84, icon: "eye", label: "Read photo", pos: "right", s: 2 },
      { x: 36, y: 140, icon: "book-open", label: "Find statutes", pos: "right", s: 4 },
      { x: 36, y: 196, icon: "equals", label: "Citation check", pos: "right", shape: "square", s: 6 },
      { x: 36, y: 252, icon: "file-text", label: "Complaint", pos: "right", s: 9.2 },
      { x: 214, y: 224, icon: "x-circle", label: "no match", pos: "right", shape: "drop", s: 7.5 },
    ], edges: [
      { pts: [[36, 49], [36, 63]], arrow: true, s: 1 },
      { pts: [[36, 105], [36, 119]], arrow: true, s: 3 },
      { pts: [[36, 161], [36, 175]], arrow: true, s: 5 },
      { pts: [[36, 217], [36, 231]], arrow: true, s: 8.2 },
      { pts: [[36, 217], [36, 224], [200, 224]], arrow: true, s: 7 },
    ], route: [[36, 28], [36, 252]] },
  },
} satisfies Record<string, Def>;

export type DiagramName = keyof typeof DEFS;

// ---- geometry ----
const STEP = 0.25; // seconds per beat
const len = (pts: number[][]) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

// Polyline with every corner rounded to one radius.
function rounded(pts: number[][], rr: number) {
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

function chevron(pts: number[][], size: number) {
  const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1];
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, w = size * 0.8;
  return `M${x1 - dx * size - dy * w},${y1 - dy * size + dx * w} L${x1},${y1} L${x1 - dx * size + dy * w},${y1 - dy * size - dx * w}`;
}

// Rings and squares are paths so pathLength="1" lets CSS stroke them in without measuring.
const ring = (x: number, y: number, r: number) => `M${x - r},${y} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r},0 Z`;
function square(x: number, y: number, r: number) {
  const k = Math.round(r / 3), s = 2 * r - 2 * k;
  return `M${x - r + k},${y - r} h${s} a${k},${k} 0 0 1 ${k},${k} v${s} a${k},${k} 0 0 1 ${-k},${k} h${-s} a${k},${k} 0 0 1 ${-k},${-k} v${-s} a${k},${k} 0 0 1 ${k},${-k} Z`;
}

const beat = (s: number) => ({ "--s": s }) as CSSProperties;

function Svg({ v, def, id, className }: { v: Variant; def: Def; id: string; className: string }) {
  const { w, h, r, g } = v;
  const chev = r / 3, rr = r > 16 ? 10 : 9, f = 12;
  const last = Math.max(...v.nodes.map((n) => n.s), ...v.edges.map((e) => e.s));
  const routeLen = len(v.route);
  // a node is on the route when its centre lies on any route segment (the packet is masked inside every node it passes)
  const onRoute = (n: Node) => n.shape !== "drop" && v.route.slice(1).some(([x1, y1], i) => {
    const [x0, y0] = v.route[i];
    return n.x >= Math.min(x0, x1) - 0.5 && n.x <= Math.max(x0, x1) + 0.5 && n.y >= Math.min(y0, y1) - 0.5 && n.y <= Math.max(y0, y1) + 0.5 && Math.abs((x1 - x0) * (n.y - y0) - (y1 - y0) * (n.x - x0)) < 0.5 * Math.hypot(x1 - x0, y1 - y0);
  });
  const parts: ReactNode[] = [];
  v.edges.forEach((e, i) => {
    // an edge label sits at the midpoint of its (straight) edge
    const [a, b] = [e.pts[0], e.pts[e.pts.length - 1]], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    parts.push(
      <g key={`e${i}`} style={beat(e.s)}>
        <path className="e" d={rounded(e.pts, rr)} pathLength={1} />
        {e.arrow && <path className="e a" d={chevron(e.pts, chev)} pathLength={1} />}
        {e.label && <text className="f m" x={mx} y={e.lpos === "above" ? my - 7 : my + f + 6} textAnchor="middle" fontSize={f}>{e.label}</text>}
      </g>,
    );
  });
  v.nodes.forEach((n, i) => {
    const drop = n.shape === "drop", rad = drop ? g / 2 : r;
    const tx = n.pos === "right" ? n.x + rad + 10 : n.x;
    const ty = n.pos === "above" ? n.y - rad - 11 : n.pos === "below" ? n.y + rad + f + 7 : n.y + f * 0.36;
    parts.push(
      <g key={`n${i}`} className={drop ? "m" : undefined} style={beat(n.s)}>
        {!drop && <path className="n" d={n.shape === "square" ? square(n.x, n.y, r) : ring(n.x, n.y, r)} pathLength={1} />}
        <g className="f">
          <svg x={n.x - g / 2} y={n.y - g / 2} width={g} height={g} viewBox="0 0 256 256" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={(1.5 * 256) / g}>{GLYPHS[n.icon]}</svg>
          <text x={tx} y={ty} textAnchor={n.pos === "right" ? "start" : "middle"} fontSize={f}>{n.label}</text>
        </g>
      </g>,
    );
  });
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={`${id}-t`} style={{ "--T": `${(last * STEP + 0.42).toFixed(2)}s`, "--pd": +((22 / routeLen) * 100).toFixed(2) } as CSSProperties}>
      <title id={`${id}-t`}>{def.title}</title>
      <desc id={`${id}-d`}>{def.desc}</desc>
      <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
        <rect width={w} height={h} fill="#fff" />
        {v.nodes.filter(onRoute).map((n, i) => <rect key={i} x={n.x - r - 1} y={n.y - r - 1} width={2 * r + 2} height={2 * r + 2} rx={r} fill="#000" />)}
      </mask>
      {parts}
      <path className="pk" d={rounded(v.route, rr)} pathLength={100} mask={`url(#${id}-m)`} />
    </svg>
  );
}

export function Diagram({ name }: { name: DiagramName }) {
  const def = DEFS[name];
  return (
    <div className="dg">
      <Svg v={def.row} def={def} id={`dg-${name}-r`} className="dg-row" />
      <Svg v={def.phone} def={def} id={`dg-${name}-p`} className="dg-phone" />
    </div>
  );
}
