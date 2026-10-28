import type { ArchDiagram } from "./types";

// Scout, production system: one main line and one check. Facts: planning/v5/scout-spec.md (production = origin/master 5b56340).
// Scheduler = pg_cron fast lane (30 min, 232 hot boards) + Actions scan (3 h, 999 boards). Scanner = /api/scan + board scanner
// + conditional fetch. Filter = title/US/recency filters + upsertRole dedupe, tombstone and applied checks (skipped rows fold into
// step 3). Empty-scan check = the canary in scripts/scan.mjs, which runs on the 999-board scan after it finishes, so step 5 plays last.
export const scoutMain: ArchDiagram = {
  id: "scout",
  title: "Scout, from a scheduled scan to your feed",
  desc: "A scheduler starts the scanner, which reads 999 company job boards. A filter keeps recent US internships, merges repeats and skips deleted or applied roles; new roles land in the database and show up in your feed. On full scans, an empty-scan check opens an alert when a board that had 3 or more postings returns zero on two scans in a row.",
  w: 840,
  h: 300,
  labelSize: 14,
  nodes: [
    { id: "sched", kind: "cron", x: 60, y: 130, label: "Scheduler", glyph: "clock" },
    { id: "boards", kind: "external", x: 230, y: 40, label: "999 company\nboards", glyph: "globe", pos: "right" },
    { id: "scanner", kind: "service", x: 230, y: 130, label: "Scanner", glyph: "search", pos: "br" },
    { id: "filter", kind: "gate", x: 450, y: 130, label: "Filter", glyph: "funnel" },
    { id: "db", kind: "store", x: 620, y: 130, label: "Database" },
    { id: "feed", kind: "client", x: 780, y: 130, label: "Your feed", glyph: "browser" },
    { id: "check", kind: "gate", x: 230, y: 240, w: 120, label: "Empty-scan\ncheck", glyph: "eye" },
    { id: "alert", kind: "external", x: 430, y: 240, label: "Alert", glyph: "issue" },
  ],
  edges: [
    { from: "sched", to: "scanner", kind: "async", step: "1" },
    { from: "boards", to: "scanner", kind: "sync", step: "2" },
    { from: "scanner", to: "filter", kind: "sync", step: "3", label: "postings", labelAt: [355, 122], badge: [290, 130] },
    { from: "filter", to: "db", kind: "sync", step: "4", label: "new roles", labelAt: [550, 122], badge: [495, 130] },
    { from: "db", to: "feed", kind: "sync", step: "4", badge: false },
    { from: "scanner", to: "check", kind: "sync", step: "5" },
    { from: "check", to: "alert", kind: "failure" },
  ],
  // phone: the main line runs down x = 110 with labels on its left; the boards come in and the check branches off on the right
  narrow: {
    w: 340,
    h: 515,
    nodes: {
      sched: { x: 110, y: 56, pos: "left" },
      boards: { x: 258, y: 56, pos: "top" },
      scanner: { x: 110, y: 146, pos: "left" },
      filter: { x: 110, y: 300, pos: "left" },
      db: { x: 110, y: 400, pos: "left" },
      feed: { x: 110, y: 490, pos: "left" },
      check: { x: 245, y: 215, pos: "top" },
      alert: { x: 245, y: 310 },
    },
    edges: [
      {},
      { fromSide: "bottom", via: [[258, 146]], toSide: "right" },
      { badge: [110, 248], labelAt: [124, 253], labelAnchor: "start" },
      { labelAt: [124, 354], labelAnchor: "start" },
      {},
      { from: [110, 215] },
      {},
    ],
  },
  steps: [
    { badge: "1", text: "A scheduler starts scans: 232 target-company boards every 30 minutes, all 999 every 3 hours." },
    { badge: "2", text: "The scanner reads each board's open postings." },
    { badge: "3", text: "The filter keeps recent US internships, merges repeats, and skips deleted or applied roles." },
    { badge: "4", text: "New roles land in the database and appear in your feed." },
    { badge: "5", text: "Check: a board that had 3+ postings, then zero on two full scans, opens an alert." },
  ],
};
