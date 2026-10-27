import type { DiagramName } from "./components/Diagram";
import type { IconName } from "./components/Icon";
import type { MarkName } from "./components/Mark";

// Every word on the page lives here.

// Open rows show the short problem story; false falls back to diagram, tags and links only.
export const showStories = false;

export const identity = {
  name: "Karthik Mandli",
  kicker: "Blacksburg, VA",
  line: "Computer science at Virginia Tech, class of 2028. Multimodal evaluation, LLM systems, and production data infrastructure.",
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

export type ExperienceRow = { date: string; place: string; role: string; plain: string; lines?: string[]; tag?: Tag; diagram?: DiagramName; story?: Story };

export const experience: ExperienceRow[] = [
  {
    date: "2026",
    place: "Independent research",
    role: "Multimodal AI researcher",
    plain: "Tested whether vision-language models truly see fine-grained differences or just read the label.",
    tag: { label: "Evaluation", glyph: "ruler" },
    diagram: "research",
    story: [
      { label: "Problem", text: "Reference text carried the species name, so accuracy might measure reading, not seeing." },
      { label: "Found", text: "The name stripper missed hyphenated names; its self-check shared the blind spot." },
      { label: "Chose", text: "Fixed it, re-ran, and kept the lower result: without names, 86.7% fell to 25.4%." },
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

export type Project = { name: string; note: string; plain: string; tag: Tag; diagram: DiagramName; story: Story; stack: Tag[]; links: ProjectLink[] };

export const projects: Project[] = [
  {
    name: "Scout",
    note: "Solo · live",
    plain: "Pulls fresh internship postings from company job boards on a schedule, and flags when a scan silently returns nothing.",
    tag: { label: "Data infrastructure", glyph: "database" },
    diagram: "scout",
    story: [
      { label: "Problem", text: "A job board can return HTTP 200 with zero postings. Nothing fails." },
      { label: "Chose", text: "A per-board baseline, flagged after two empty runs, so off-season never false-alarms." },
      { label: "Proof", text: "A canary and 451 automated tests guard four unattended production jobs." },
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
    note: "Solo · VTHacks 14",
    plain: "Plans a student's courses and clubs toward a target job; agents read, code decides.",
    tag: { label: "Agentic systems", glyph: "robot" },
    diagram: "prospect",
    story: [
      { label: "Problem", text: "The roadmap agent can propose a course or club that does not exist." },
      { label: "Chose", text: "Reject and name the unknown step, so one bad step never sinks the plan." },
      { label: "Proof", text: "Every step checked against 5,956 VT courses and 765 clubs; 1,243 tests." },
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
    plain: "Turns a photo of a housing problem into a complaint that cites the exact statute, with every citation checked.",
    tag: { label: "Multimodal AI", glyph: "image" },
    diagram: "witness",
    story: [
      { label: "Problem", text: "A model writing a legal complaint can cite a statute that does not exist." },
      { label: "Chose", text: "Keep a citation only if it exactly matches a retrieved statute row." },
      { label: "Proof", text: "Every citation checked against 30+ Virginia provisions. It proves existence, not applicability." },
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
