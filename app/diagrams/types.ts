// Data model for the architecture diagrams (app/components/Arch.tsx). One file per project (scout.ts, ...) exports an ArchDiagram.
// Coordinates are viewBox units; the viewBox is `w` wide (840 for a row) and `h` tall. Everything is hand placed.

export type Pt = [number, number];

// client: glyph only, no ring. service: ring + glyph. gate: rounded square (a deterministic check). model: hexagon.
// store: cylinder. cron: ring + clock-like glyph. external: muted ring outside your infra. dropped: muted x.
export type NodeKind = "client" | "service" | "gate" | "model" | "store" | "cron" | "external" | "dropped";

// sync: solid. async: dashed. data: thin muted. failure: dotted muted.
export type EdgeKind = "sync" | "async" | "data" | "failure";

export type Side = "top" | "right" | "bottom" | "left";

export type ArchNode = {
  id: string;
  kind: NodeKind;
  x: number; // centre
  y: number;
  label: string; // "\n" starts a new line (labels are 11 units, keep lines under about 16 characters)
  glyph?: string; // key into app/diagrams/glyphs.tsx; stores and dropped nodes need none
  pos?: Side | "tl" | "tr" | "br"; // where the label sits (default bottom); the corner positions keep it off the edges that leave the node centre
  w?: number; // gate only: a wider rounded rectangle
};

export type ArchEdge = {
  from: string | Pt; // a node id, or a point (a branch that starts on another line)
  to: string | Pt;
  kind: EdgeKind;
  via?: Pt[]; // corners. Segments are made axis aligned automatically (horizontal first on a horizontal port).
  fromSide?: Side; // default: the side facing the first corner or the target
  toSide?: Side;
  fromOff?: number; // slide the port along the side, units
  toOff?: number;
  step?: string; // legend item this edge belongs to: "1".."n" request path (packet plays these in order), "A".."Z" off-path lane
  badge?: Pt | false; // the step badge sits on the middle of the longest segment; give a point to move it, false to hide it
  label?: string; // "\n" starts a new line
  labelAt?: Pt; // text anchor (default: beside the middle of the longest segment)
  labelAnchor?: "start" | "middle" | "end";
  noArrow?: boolean; // a branch that joins another line
};

export type ArchZone = { label: string; x: number; w: number };
export type ArchBoundary = { x: number; y: number; w: number; h: number; label: string; labelAt?: number };
export type ArchStep = { badge: string; text: string };

export type ArchDiagram = {
  id: string;
  title: string; // accessible name
  desc: string;
  w: number;
  h: number;
  zones: ArchZone[]; // columns left to right; a hairline rule sits at each x after the first
  boundary?: ArchBoundary; // the dashed trust boundary
  nodes: ArchNode[];
  edges: ArchEdge[];
  steps: ArchStep[]; // numbered legend, selectable text under the SVG
  fails?: string[]; // plain lines under the steps: what the dotted edges mean
};
