import type { ArchDiagram } from "./types";

// Witness, as built for the AWS hackathon (March 2026; the public endpoint was removed afterwards).
// Read left to right: client, edge, control plane, workers, data, managed model.
export const witnessMain: ArchDiagram = {
  id: "witness",
  title: "Witness AWS serverless architecture",
  desc: "A static browser client checks a housing photo, uploads it straight to S3 through a presigned URL, then calls API Gateway. An orchestrator Lambda starts a Step Functions Express execution that runs three stage Lambdas: vision on the photo, statute matching against DynamoDB with an exact-match citation check that drops unmatched citations, and complaint drafting with enforcement contacts. Each stage calls a Bedrock model. The complaint returns to the browser. All of it sits inside one AWS account in us-east-1.",
  w: 840,
  h: 620,
  zones: [
    { label: "Client", x: 0, w: 120 },
    { label: "Edge", x: 120, w: 84 },
    { label: "Control plane", x: 204, w: 180 },
    { label: "Workers", x: 384, w: 164 },
    { label: "Data", x: 548, w: 176 },
    { label: "Managed", x: 724, w: 116 },
  ],
  boundary: { x: 116, y: 7, w: 720, h: 606, label: "AWS account, us-east-1", labelAt: 660 },
  nodes: [
    // client
    { id: "upload_page", kind: "client", x: 56, y: 75, label: "Upload page", glyph: "browser", pos: "top" },
    { id: "client_check", kind: "gate", x: 56, y: 140, label: "Client\nchecks", glyph: "shield" },
    { id: "local_store", kind: "store", x: 56, y: 215, label: "localStorage" },
    { id: "loading_page", kind: "client", x: 56, y: 310, label: "Loading page", glyph: "pulse", pos: "top" },
    { id: "mock_result", kind: "dropped", x: 56, y: 385, label: "Mock\nfallback", glyph: "x" },
    { id: "results_page", kind: "client", x: 56, y: 455, label: "Results page", glyph: "layout" },
    // edge
    { id: "api_gw", kind: "service", x: 162, y: 215, label: "API\nGateway", glyph: "w_gateway" },
    // control plane
    { id: "fn_upload_url", kind: "service", x: 255, y: 130, label: "get-upload-url", glyph: "w_link" },
    { id: "fn_send", kind: "external", x: 255, y: 215, label: "send-complaint\n(unused)", glyph: "mail" },
    { id: "fn_orchestrator", kind: "service", x: 255, y: 310, label: "Orchestrator", glyph: "w_play" },
    { id: "sfn", kind: "service", x: 322, y: 310, label: "Step Functions\n(Express)", glyph: "w_states", pos: "top" },
    { id: "fail_state", kind: "gate", x: 322, y: 400, label: "HandleError\n(Fail)", glyph: "x", pos: "left" },
    // workers
    { id: "fn_stage1", kind: "service", x: 448, y: 150, label: "Stage 1\nvision", glyph: "eye", pos: "top" },
    { id: "fn_stage2", kind: "service", x: 448, y: 250, label: "Stage 2\nmatching", glyph: "search", pos: "top" },
    { id: "citation_gate", kind: "gate", x: 448, y: 330, label: "Citation\ncheck", glyph: "w_equal", pos: "right" },
    { id: "dropped_citation", kind: "dropped", x: 448, y: 395, label: "Dropped\ncitation", glyph: "x" },
    { id: "fn_stage3", kind: "service", x: 448, y: 500, label: "Stage 3\ncomplaint", glyph: "w_doc", pos: "top" },
    // data
    { id: "s3_photos", kind: "store", x: 610, y: 66, label: "Photo bucket", pos: "top" },
    { id: "ddb_codes", kind: "store", x: 610, y: 330, label: "HousingCodes\n30+ Virginia\nprovisions" },
    { id: "ddb_contacts", kind: "store", x: 610, y: 455, label: "Enforcement\nContacts", pos: "top" },
    { id: "default_contact", kind: "store", x: 448, y: 575, label: "DHCD fallback\n(in code)", pos: "right" },
    { id: "seeder", kind: "cron", x: 690, y: 400, label: "Seed\nscript", glyph: "terminal", pos: "right" },
    // managed
    { id: "bedrock", kind: "model", x: 758, y: 242, label: "Bedrock\nmodel", pos: "right" },
    { id: "cw_logs", kind: "external", x: 515, y: 395, label: "CloudWatch\nLogs", glyph: "list" },
  ],
  edges: [
    // request path
    { from: "upload_page", to: "client_check", kind: "sync", step: "1", toSide: "top" },
    { from: "upload_page", to: "api_gw", kind: "sync", step: "2", fromSide: "right", fromOff: 9, via: [[104, 84], [104, 206]], toSide: "left", toOff: -9 },
    { from: "api_gw", to: "fn_upload_url", kind: "sync", step: "2", badge: false, fromSide: "right", fromOff: -12, via: [[198, 203], [198, 130]] },
    { from: "upload_page", to: "s3_photos", kind: "sync", step: "3", fromSide: "right", fromOff: -9, label: "presigned PUT,\nskips the API", labelAt: [392, 58], labelAnchor: "start" },
    { from: "upload_page", to: "local_store", kind: "data", fromSide: "left", via: [[10, 75], [10, 215]], toSide: "left" },
    { from: "loading_page", to: "api_gw", kind: "sync", step: "4", fromSide: "right", fromOff: -9, via: [[104, 301], [104, 224]], toSide: "left", toOff: 9 },
    { from: "api_gw", to: "fn_orchestrator", kind: "sync", step: "4", badge: false, fromSide: "right", fromOff: 12, via: [[198, 227], [198, 310]] },
    { from: "fn_orchestrator", to: "sfn", kind: "sync", step: "4", badge: false },
    { from: "sfn", to: "fn_stage1", kind: "sync", step: "5", fromSide: "right", via: [[376, 310], [376, 150]], badge: [404, 150] },
    { from: "s3_photos", to: "fn_stage1", kind: "data", fromSide: "bottom", via: [[610, 142]], toSide: "right", toOff: -8 },
    { from: "fn_stage1", to: "bedrock", kind: "sync", step: "5", badge: false, fromSide: "right", fromOff: 8, via: [[758, 158]], toSide: "top", label: "image to observations", labelAt: [690, 150] },
    { from: "sfn", to: "fn_stage2", kind: "sync", step: "6", fromSide: "right", via: [[376, 310], [376, 250]], badge: [404, 250] },
    { from: "ddb_codes", to: "fn_stage2", kind: "data", fromSide: "top", via: [[610, 258]], toSide: "right", toOff: 8 },
    { from: "fn_stage2", to: "bedrock", kind: "sync", step: "6", badge: false, fromSide: "right", fromOff: -8, toSide: "left", label: "draft violations", labelAt: [675, 235] },
    { from: "fn_stage2", to: "citation_gate", kind: "sync", step: "6", badge: false, toSide: "top", label: "candidates" },
    { from: "citation_gate", to: "dropped_citation", kind: "failure", toSide: "top", label: "no exact match" },
    { from: "sfn", to: "fn_stage3", kind: "sync", step: "7", fromSide: "right", via: [[376, 310], [376, 500]], badge: [404, 500] },
    { from: "ddb_contacts", to: "fn_stage3", kind: "data", fromSide: "left", via: [[540, 455], [540, 492]], toSide: "right", toOff: -8 },
    { from: "default_contact", to: "fn_stage3", kind: "data", toSide: "bottom", label: "both empty" },
    { from: "fn_stage3", to: "bedrock", kind: "sync", step: "7", badge: false, fromSide: "right", fromOff: 8, via: [[758, 508]], toSide: "bottom", label: "write letter" },
    { from: "fn_orchestrator", to: "loading_page", kind: "sync", step: "7", badge: false, fromSide: "left", fromOff: 9, toSide: "right", toOff: 9, label: "200 +\ncomplaint", labelAt: [126, 345], labelAnchor: "start" },
    { from: "loading_page", to: "results_page", kind: "sync", fromSide: "left", via: [[10, 310], [10, 455]], toSide: "left" },
    // off the request path
    { from: "seeder", to: "ddb_codes", kind: "async", step: "A", fromSide: "top", via: [[690, 330]], toSide: "right", badge: [690, 365] },
    { from: "seeder", to: "ddb_contacts", kind: "async", step: "A", badge: false, fromSide: "bottom", via: [[690, 455]], toSide: "right" },
    { from: "dropped_citation", to: "cw_logs", kind: "async", step: "B" },
    // failures
    { from: "sfn", to: "fail_state", kind: "failure", toSide: "top", label: "Catch\nStates.ALL", labelAt: [316, 374], labelAnchor: "end" },
    { from: "loading_page", to: "mock_result", kind: "failure", toSide: "top", label: "error" },
    { from: "api_gw", to: "fn_send", kind: "failure" },
  ],
  steps: [
    { badge: "1", text: "The browser checks file type, size, address and jurisdiction. These checks run only on the client." },
    { badge: "2", text: "POST /get-upload-url through API Gateway; a Lambda returns a presigned S3 PUT valid for 300 seconds." },
    { badge: "3", text: "The browser PUTs the photo straight to S3 and saves the key and address in localStorage." },
    { badge: "4", text: "POST /analyze; the orchestrator starts a synchronous Step Functions Express execution." },
    { badge: "5", text: "Stage 1 reads the photo from S3, and Bedrock returns categorized observations." },
    { badge: "6", text: "Stage 2 queries HousingCodes per category and Bedrock drafts violations. The exact-match check keeps a citation only if its section label equals a row retrieved for this request." },
    { badge: "7", text: "Stage 3 adds enforcement contacts, Bedrock writes the letter, and the complaint returns to the results page." },
    { badge: "A", text: "Off the path: the seed script loads the statutes and contacts into DynamoDB, 25 items per batch." },
    { badge: "B", text: "Off the path: the Lambdas log to CloudWatch, and Stage 2 logs each dropped citation." },
  ],
  fails: [
    "Each of the three Task states retries a task failure up to twice (2 second interval, backoff 2.0); then Catch sends the execution to HandleError and the orchestrator returns a 500 with the execution ARN.",
    "A citation with no exact match among the retrieved rows is logged and removed. The check proves the statute exists, not that it applies.",
    "No code rows retrieved: Stage 2 skips Bedrock. No contacts found: Stage 3 falls back to the state DHCD contact.",
    "Keys missing or /analyze fails: the page shows a mock result.",
    "send-complaint is deployed behind the API but no page calls it; it returns a mailto and sends nothing.",
  ],
};
