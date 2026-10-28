// Data model for the architecture diagrams (app/components/Arch.tsx). One file per project (scout.ts, ...) exports an ArchDiagram.
// Coordinates are viewBox units; the viewBox is `w` wide (840 for a row) and `h` tall. Everything is hand placed, twice: the
// wide layout below, and `narrow` for phones.

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
  label: string; // "\n" starts a new line
  glyph?: string; // key into app/diagrams/glyphs.tsx; stores and dropped nodes need none
  pos?: Side | "tl" | "tr" | "br"; // where the label sits (default bottom); the corner positions keep it off the edges that leave the node centre
  w?: number; // gate only: a wider rounded rectangle (the hero check, about 120)
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
  step?: string; // "1".."5": the packet plays these in order (edges sharing a number together, with `parallel`)
  badge?: Pt | false; // the step badge sits on the middle of the longest segment; give a point to move it, false to hide it (one badge per step)
  label?: string; // what travels on this edge, 3 words at most; "\n" starts a new line
  labelAt?: Pt; // text anchor (default: beside the middle of the longest segment)
  labelAnchor?: "start" | "middle" | "end";
  noArrow?: boolean; // a branch that joins another line
};

// The phone layout (under 640px wide): the same nodes and edges placed again in a narrow viewBox, main line top to bottom.
// A field left out takes its default, never the wide value; the one exception is an edge's `badge: false`, which carries over.
export type ArchNarrow = {
  w: number; // about 340-360, so 14-unit labels render at 12px or more on a 390px phone
  h: number;
  nodes: Record<string, Pick<ArchNode, "x" | "y"> & Partial<Pick<ArchNode, "pos" | "label">>>; // every node id
  edges: Partial<Pick<ArchEdge, "from" | "to" | "via" | "fromSide" | "toSide" | "fromOff" | "toOff" | "badge" | "labelAt" | "labelAnchor">>[]; // one per edge, same order as `edges`; {} for all defaults
};

export type ArchStep = { badge: string; text: string };

export type ArchDiagram = {
  id: string;
  title: string; // accessible name
  desc: string;
  w: number;
  h: number;
  nodes: ArchNode[];
  edges: ArchEdge[];
  narrow: ArchNarrow;
  steps: ArchStep[]; // numbered list under the SVG, one column; the step in play gets a soft tint, synced with the packet
  labelSize?: number; // node and edge label size in units (default 11)
  parallel?: boolean; // edges sharing a step number start together, one packet each; the step lasts as long as its longest edge
};
