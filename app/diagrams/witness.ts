import type { ArchDiagram } from "./types";

// Witness, as built for the AWS hackathon (March 2026; the public endpoint was removed afterwards). One main line, the check
// on it. Facts: planning/v5/witness-spec.md, re-checked in Witness/src/backend/lambdas. Every stage runs one after another
// (Step Functions Tasks; Stage 2 queries each category in turn, Stage 3 queries local then state contacts), so no `parallel`.
// Three model nodes because there are three model calls (vision, matching, letter). "30+" is Karthik's ruling (PROJECT.md:25).
export const witnessMain: ArchDiagram = {
  id: "witness",
  title: "Witness, from a photo to a cited complaint",
  desc: "You upload a photo of a housing problem and enter its address. A vision model describes what it sees, by category. Statute matching pulls the provisions for those categories from 30+ Virginia provisions, and a model drafts violations. A citation check keeps a citation only if it exactly matches a provision retrieved for this request, which proves the provision exists, not that it applies; the rest are dropped. A model then writes the complaint letter with the enforcement contacts for your area.",
  w: 840,
  h: 270,
  labelSize: 14,
  nodes: [
    { id: "photo", kind: "client", x: 48, y: 130, label: "Your photo\n+ address", glyph: "browser" },
    { id: "vision", kind: "model", x: 160, y: 130, label: "Vision\nmodel", glyph: "eye" },
    { id: "matching", kind: "model", x: 330, y: 130, label: "Statute\nmatching", glyph: "search" },
    { id: "codes", kind: "store", x: 330, y: 40, label: "30+ Virginia\nprovisions", pos: "right" },
    { id: "check", kind: "gate", x: 505, y: 130, w: 120, label: "Citation\ncheck", glyph: "w_equal", pos: "top" },
    { id: "dropped", kind: "dropped", x: 505, y: 225, label: "Dropped", glyph: "x" },
    { id: "letter", kind: "model", x: 690, y: 130, label: "Letter\nmodel", glyph: "w_doc" },
    { id: "contacts", kind: "store", x: 690, y: 40, label: "Enforcement\ncontacts", pos: "right" },
    { id: "complaint", kind: "client", x: 800, y: 130, label: "Complaint\nletter", glyph: "layout" },
  ],
  edges: [
    { from: "photo", to: "vision", kind: "sync", step: "1", label: "photo", labelAt: [108, 122], badge: [76, 130] },
    { from: "vision", to: "matching", kind: "sync", step: "2", label: "observations", labelAt: [255, 122], badge: [190, 130] },
    { from: "codes", to: "matching", kind: "sync", step: "3" },
    { from: "matching", to: "check", kind: "sync", step: "3", badge: false, label: "draft\nviolations", labelAt: [395, 122] },
    { from: "check", to: "letter", kind: "sync", step: "4", label: "matched\ncitations", labelAt: [623, 122], badge: [580, 130] },
    { from: "contacts", to: "letter", kind: "sync", step: "5" },
    { from: "letter", to: "complaint", kind: "sync", step: "5", badge: false },
    { from: "check", to: "dropped", kind: "failure", label: "no exact\nmatch" },
  ],
  // phone: the main line runs down x = 112 with labels on its left; the two stores come in and the drop branches off on the right
  narrow: {
    w: 340,
    h: 605,
    nodes: {
      photo: { x: 112, y: 40, pos: "left" },
      vision: { x: 112, y: 130, pos: "left" },
      matching: { x: 112, y: 240, pos: "left" },
      codes: { x: 262, y: 240, pos: "top" },
      check: { x: 112, y: 350, pos: "br" },
      dropped: { x: 300, y: 350 },
      letter: { x: 112, y: 490, pos: "left" },
      contacts: { x: 262, y: 490, pos: "top" },
      complaint: { x: 112, y: 580, pos: "left" },
    },
    edges: [
      { labelAt: [124, 89], labelAnchor: "start" },
      { labelAt: [124, 176], labelAnchor: "start" },
      {},
      { labelAt: [124, 305], labelAnchor: "start" },
      { badge: [112, 392], labelAt: [124, 445], labelAnchor: "start" },
      {},
      {},
      { labelAt: [232, 342] },
    ],
  },
  steps: [
    { badge: "1", text: "You upload a photo of the housing problem and enter its address." },
    { badge: "2", text: "A vision model describes what it sees, tagging each observation with a category." },
    { badge: "3", text: "Matching pulls the provisions for each category, and a model drafts violations from them." },
    { badge: "4", text: "Check: a citation survives only if it exactly matches a provision retrieved for this request." },
    { badge: "5", text: "A model writes the complaint letter with the enforcement contacts for your area." },
  ],
};
