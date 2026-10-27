import { scoutMain } from "./diagrams/scout";
import { prospectMain } from "./diagrams/prospect";
import { witnessMain } from "./diagrams/witness";
import type { ArchDiagram } from "./diagrams/types";
import type { IconName } from "./components/Icon";
import type { MarkName } from "./components/Mark";

// Every word on the page lives here.

// Open rows show the short problem story; false falls back to diagram, tags and links only.
export const showStories = true;

export const identity = {
  name: "Karthik Mandli",
  kicker: "Blacksburg, VA",
  // The hero line: a lead, then the three fields, each with the glyph its rows use further down.
  lead: "Computer science at Virginia Tech, class of 2028.",
  fields: [
    { label: "Multimodal evaluation", glyph: "ruler" },
    { label: "LLM systems", glyph: "robot" },
    { label: "production data infrastructure", glyph: "database" },
  ] as { label: string; glyph: IconName }[],
  sub: "Open to Summer 2027 SWE and AI internships.",
  description:
    "Karthik Mandli, computer science at Virginia Tech. Multimodal evaluation, LLM systems, data infrastructure. Projects: Scout, Prospect, Witness.",
};

export const links = {
  email: "karthikmandli6@gmail.com",
  compose: "https://mail.google.com/mail/?view=cm&fs=1&to=karthikmandli6@gmail.com",
  github: "https://github.com/karthikm062025S",
  linkedin: "https://www.linkedin.com/in/karthik-mandli-56794a2a5",
};

export const nav = [
  { label: "Experience", href: "#experience" },
  { label: "Projects", href: "#projects" },
  { label: "Stack", href: "#stack" },
  { label: "Contact", href: "#contact" },
];

// A tag shows a brand mark when one exists, otherwise a Phosphor glyph.
export type Tag = { label: string; mark?: MarkName; glyph?: IconName };

// Three labelled lines: the problem, what was chosen (or found) and the proof.
export type Story = { label: string; text: string }[];

export type ExperienceRow = { date: string; place: string; role: string; plain: string; lines?: string[]; tag?: Tag; story?: Story };

export const experience: ExperienceRow[] = [
  {
    date: "2026",
    place: "Independent research",
    role: "Multimodal AI researcher",
    plain: "Tested whether vision-language models truly see fine-grained differences or just read the label.",
    tag: { label: "Evaluation", glyph: "ruler" },
    story: [
      { label: "Question", text: "Do vision-language models see fine-grained differences, or just read the names in the text? Explored over eight months." },
      { label: "Built", text: "Evaluation pipelines with leakage guards and controls, refined across several framings of the question." },
      { label: "Found", text: "Showed the model was reading, not seeing: removing species names cut accuracy from 86.7% to 25.4% on 5,794 images." },
    ],
  },
  {
    date: "2026 – now",
    place: "Virginia Tech",
    role: "Teaching assistant, Data Structures & Algorithms",
    plain: "Teach students to debug data structures by writing the failing test first.",
    lines: ["Algorithm analysis, structure trade-offs, and test design on the course forum."],
  },
  {
    date: "2025",
    place: "HICE Lab · DBWorkout",
    role: "Software developer",
    plain: "Drove a live SQL-learning platform's move to TypeScript and fed its APIs malformed input to catch failures before release.",
    lines: ["Traced failures in database-backed REST workflows through Docker logs."],
  },
];

export type ProjectLink = { label: string; href: string; aria: string };

export type Project = { name: string; note: string; plain: string; tag: Tag; arch: ArchDiagram; story: Story; stack: Tag[]; links: ProjectLink[] };

export const projects: Project[] = [
  {
    name: "Scout",
    note: "Live",
    plain: "Pulls fresh internship postings from company job boards on a schedule, and flags when a scan silently returns nothing.",
    tag: { label: "Data infrastructure", glyph: "database" },
    arch: scoutMain,
    story: [
      { label: "Problem", text: "A job board can return HTTP 200 with zero postings. Nothing fails." },
      { label: "Chose", text: "Each board keeps a baseline; one that returned 3 or more postings is flagged after two empty runs." },
      { label: "Proof", text: "A canary watches 877 of 999 boards, a run where under half answer opens an outage issue, and 450+ tests cover it." },
    ],
    stack: [
      { label: "Supabase", mark: "supabase" },
      { label: "GitHub Actions", mark: "github-actions" },
      { label: "MCP", mark: "model-context-protocol" },
    ],
    links: [{ label: "Live", href: "https://scoutfeed.vercel.app", aria: "Scout, live site (opens in a new tab)" }],
  },
  {
    name: "Prospect",
    note: "VTHacks 14",
    plain: "Plans a student's courses and clubs toward a target job; models read, code decides.",
    tag: { label: "Agentic systems", glyph: "robot" },
    arch: prospectMain,
    story: [
      { label: "Problem", text: "A plan built by language models can name courses that do not exist or rank jobs by guesswork." },
      { label: "Chose", text: "Models only read and propose; code ranks the jobs and checks every course and club against the real catalog." },
      { label: "Proof", text: "Checked against 5,956 VT courses and 765 clubs; four agent identities active on GoDaddy ANS; 1,243 tests pass." },
    ],
    stack: [
      { label: "Databricks", mark: "databricks" },
      { label: "TypeScript", mark: "typescript" },
    ],
    links: [
      { label: "Live", href: "https://prospect.courses", aria: "Prospect, live site (opens in a new tab)" },
      { label: "Code", href: "https://github.com/karthikm062025S/prospect", aria: "Prospect, code (opens in a new tab)" },
    ],
  },
  {
    name: "Witness",
    note: "Team of four · AWS hackathon · backend and architecture",
    plain: "Turns a photo of a housing problem into a complaint that cites the exact statute, and drops any citation that matches no real one.",
    tag: { label: "Multimodal AI", glyph: "image" },
    arch: witnessMain,
    story: [
      { label: "Problem", text: "A model writing a legal complaint can cite a statute that does not exist." },
      { label: "Chose", text: "Keep a model citation only if its section label exactly matches a statute row retrieved for that request." },
      { label: "Proof", text: "Each citation the model proposes is checked against 30+ Virginia provisions. It proves existence, not applicability." },
    ],
    stack: [
      { label: "AWS Lambda", mark: "aws" },
      { label: "Step Functions", mark: "aws" },
      { label: "DynamoDB", mark: "dynamodb" },
    ],
    links: [
      { label: "Code", href: "https://github.com/karthikm062025S/Witness", aria: "Witness, code (opens in a new tab)" },
      { label: "Devpost", href: "https://devpost.com/software/witness-f9ijzq", aria: "Witness, Devpost page (opens in a new tab)" },
    ],
  },
];

export const stack: { group: string; items: Tag[] }[] = [
  {
    group: "Languages",
    items: [
      { label: "Python", mark: "python" },
      { label: "C/C++", mark: "cplusplus" },
      { label: "Java", mark: "java" },
      { label: "JavaScript", mark: "javascript" },
      { label: "TypeScript", mark: "typescript" },
      { label: "SQL", glyph: "database" },
    ],
  },
  {
    group: "ML & vision",
    items: [
      { label: "PyTorch", mark: "pytorch" },
      { label: "Hugging Face Transformers", mark: "huggingface" },
    ],
  },
  {
    group: "LLM systems",
    items: [
      { label: "RAG & semantic search", glyph: "magnifying-glass" },
      { label: "Agents & tool calling", glyph: "robot" },
      { label: "MCP", mark: "model-context-protocol" },
      { label: "LangChain", mark: "langchain" },
      { label: "LLM evaluation", glyph: "ruler" },
    ],
  },
  {
    group: "Web & data",
    items: [
      { label: "React", mark: "react" },
      { label: "Next.js", mark: "nextdotjs" },
      { label: "Node.js", mark: "nodedotjs" },
      { label: "PostgreSQL + pgvector", mark: "postgresql" },
    ],
  },
  {
    group: "Cloud & tooling",
    items: [
      { label: "AWS (Lambda, API Gateway, Step Functions, S3, DynamoDB, Bedrock)", mark: "aws" },
      { label: "Docker", mark: "docker" },
      { label: "CI/CD", glyph: "arrows-clockwise" },
      { label: "Git", mark: "git" },
      { label: "JUnit", mark: "junit5" },
      { label: "Linux", mark: "linux" },
    ],
  },
];

export const education = {
  date: "2024 – 2028",
  line: "Virginia Tech · B.S. Computer Science · GPA 3.96 · Dean's List, all semesters",
};

export const footer = { left: "Karthik Mandli · 2026" };

export const golf = "I play golf and love traveling to new places.";
