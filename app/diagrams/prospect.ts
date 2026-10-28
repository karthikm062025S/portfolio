import type { ArchDiagram } from "./types";

// Prospect, production system: one main line and one check. Facts: planning/v5/prospect-spec.md (local master cef556e).
// Identity = the ANS gate every agent run opens with (startAgentRun), drawn passing by owner ruling. Models = the profile, roadmap
// and match agents' model calls, which only read and propose. Catalog check = validatePlan against vt_courses / vt_clubs.
// Code ranks jobs = scorePosting over the 30-day US feed. Roadmap and match run in parallel after the profile step (harness.ts),
// so the check and the ranking share step 3, and both results share step 4.
export const prospectMain: ArchDiagram = {
  id: "prospect",
  title: "Prospect, from a resume to a checked plan",
  desc: "You upload a resume and transcript. Each agent passes a GoDaddy identity check, then models read both and propose courses, clubs and the kind of role you fit. Code drops any course or club that is not in the real catalog of 5,956 courses and 765 clubs, while code ranks recent US job listings against your target role. Your checked plan and ranked jobs are saved, and progress streams back to you.",
  w: 840,
  h: 350,
  labelSize: 14,
  parallel: true,
  nodes: [
    { id: "you", kind: "client", x: 60, y: 130, label: "Resume +\ntranscript", glyph: "w_doc" },
    { id: "ans", kind: "gate", x: 200, y: 130, label: "Agent\nidentity", glyph: "p_badge" },
    { id: "models", kind: "model", x: 340, y: 130, label: "Models\nread, propose", glyph: "p_spark", pos: "top" },
    { id: "jobs", kind: "store", x: 560, y: 40, label: "Job listings\nUS, last 30 days", pos: "right" },
    { id: "rank", kind: "gate", x: 560, y: 130, label: "Code ranks\njobs", glyph: "gauge" },
    { id: "out", kind: "client", x: 780, y: 130, label: "Your plan +\nmatches", glyph: "browser", pos: "top" },
    { id: "check", kind: "gate", x: 340, y: 240, w: 120, label: "Catalog\ncheck", glyph: "p_book" },
    { id: "catalog", kind: "store", x: 170, y: 240, label: "Real catalog\n5,956 courses\n765 clubs", pos: "left" },
    { id: "dropped", kind: "dropped", x: 290, y: 322, label: "Dropped:\nnot in catalog", glyph: "x", pos: "left" },
  ],
  edges: [
    { from: "you", to: "ans", kind: "sync", step: "1", label: "PDFs", labelAt: [140, 122], badge: [95, 130] },
    { from: "ans", to: "models", kind: "sync", step: "2" },
    { from: "models", to: "check", kind: "sync", step: "3", label: "proposed plan", labelAt: [352, 190], labelAnchor: "start" },
    { from: "models", to: "rank", kind: "sync", step: "3", badge: false, label: "target role", labelAt: [450, 122] },
    { from: "jobs", to: "rank", kind: "data" },
    { from: "rank", to: "out", kind: "sync", step: "4", label: "matched jobs", labelAt: [665, 122], badge: [594, 130] },
    { from: "check", to: "out", kind: "sync", step: "4", badge: false, fromSide: "right", via: [[780, 240]], toSide: "bottom", label: "checked plan", labelAt: [590, 232] },
    { from: "catalog", to: "check", kind: "data" },
    { from: "check", to: "dropped", kind: "failure", fromSide: "bottom", fromOff: -50, toSide: "top" },
  ],
  // phone: the main line runs down x = 110 with labels on its left; the check, the catalog and the job listings sit on the right
  narrow: {
    w: 340,
    h: 600,
    nodes: {
      you: { x: 110, y: 50, pos: "left" },
      ans: { x: 110, y: 140, pos: "left", label: "Agent\nidentity" },
      models: { x: 110, y: 235, pos: "left", label: "Models\nread,\npropose" },
      catalog: { x: 280, y: 215, pos: "top" },
      check: { x: 235, y: 320 },
      dropped: { x: 285, y: 410, pos: "left" },
      rank: { x: 110, y: 480, pos: "left", label: "Code\nranks\njobs" },
      jobs: { x: 230, y: 480, pos: "top", label: "Job listings" },
      out: { x: 110, y: 580, pos: "left", label: "Your plan\n+ matches" },
    },
    edges: [
      { labelAt: [124, 100], labelAnchor: "start" },
      {},
      { fromSide: "right", via: [[235, 235]], toSide: "top", badge: [235, 272] },
      { labelAt: [122, 290], labelAnchor: "start" },
      {},
      { labelAt: [124, 535], labelAnchor: "start" },
      { fromSide: "right", via: [[318, 320], [318, 580]], toSide: "right", labelAt: [220, 572] },
      { fromSide: "bottom", toSide: "top", toOff: 45 },
      { fromSide: "bottom", fromOff: 50, toSide: "top" },
    ],
  },
  steps: [
    { badge: "1", text: "You upload a resume and transcript; each agent first passes a GoDaddy identity check." },
    { badge: "2", text: "Models read both, then propose courses and clubs and the kind of role you fit." },
    { badge: "3", text: "Check: code drops any course or club not in the real catalog, while code ranks jobs." },
    { badge: "4", text: "Your checked plan and ranked jobs are saved, and progress streams back to you." },
  ],
};
