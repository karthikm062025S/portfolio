import type { IconName } from "./components/Icon";
import type { MarkName } from "./components/Mark";

// Every word on the page lives here.

export const identity = {
  name: "Karthik Mandli",
  line: "Computer science at Virginia Tech.",
  description:
    "Karthik Mandli studies computer science at Virginia Tech. He likes building AI products and evaluating whether they work.",
};

export const links = {
  email: "karthikmandli6@gmail.com",
  github: "https://github.com/karthikm062025S",
  linkedin: "https://www.linkedin.com/in/karthik-mandli-56794a2a5",
};

export const about = [
  "Before this, I worked on DBWorkout at HICE Lab and did independent research on vision-language models.",
  "Now I run Scout, a live internship tracker, and teach CS 3114 as a TA.",
  "Next, I am interested in building tools that make AI output easier to verify.",
  "Looking for a Summer 2027 software engineering or AI internship.",
];

export type Tag = { label: string; glyph: IconName };

export type ExperienceRow = {
  from: string;
  to: string;
  tag?: Tag;
  role: string;
  place: string;
  line: string;
};

export const experience: ExperienceRow[] = [
  {
    from: "Jan 2026 -",
    to: "Sep 2026",
    tag: { label: "Evaluation", glyph: "ruler" },
    role: "Undergraduate Researcher",
    place: "Independent research, multimodal AI",
    line: "Measured how frozen CLIP identifies 200 bird species once the name leaves the text; traced a leakage bug and kept the lower result.",
  },
  {
    from: "Aug 2026 -",
    to: "Present",
    role: "Undergraduate Teaching Assistant",
    place: "Virginia Tech, CS 3114 Data Structures & Algorithms",
    line: "Weekly office hours and forum help; students bring a test that reproduces the bug before we debug.",
  },
  {
    from: "Sep 2025 -",
    to: "Dec 2025",
    role: "Software Developer",
    place: "HICE Lab, DBWorkout",
    line: "Worked on moving a production SQL-practice platform from JavaScript to TypeScript, and tested its REST workflows.",
  },
];

export type ProjectLink = { label: string; href: string; aria: string };

export type Project = {
  tag: Tag;
  name: string;
  lines: string[];
  stack: { name: string; mark: MarkName }[];
  links: ProjectLink[];
};

export const projects: Project[] = [
  {
    tag: { label: "AI products", glyph: "cube" },
    name: "Scout",
    lines: [
      "An internship tracker built on one feed scanned from 999 applicant-tracking endpoints.",
      "A canary flags any scan that comes back 200 with zero rows.",
      "Applications stay private per user, and an MCP server lets Claude work with them.",
    ],
    stack: [
      { name: "Next.js", mark: "nextdotjs" },
      { name: "TypeScript", mark: "typescript" },
      { name: "Supabase", mark: "supabase" },
      { name: "GitHub Actions", mark: "github-actions" },
      { name: "MCP", mark: "model-context-protocol" },
    ],
    links: [
      { label: "Live", href: "https://scoutfeed.vercel.app", aria: "Scout, live site (opens in a new tab)" },
    ],
  },
  {
    tag: { label: "AI agents", glyph: "robot" },
    name: "Prospect",
    lines: [
      "An AI career planner for Virginia Tech students, built solo at VTHacks 14.",
      "Ranks 7,600+ live postings with a deterministic score, then Gemini agents draft a roadmap.",
      "A validator drops any course or club the model invents.",
    ],
    stack: [
      { name: "Next.js", mark: "nextdotjs" },
      { name: "Databricks", mark: "databricks" },
      { name: "Gemini", mark: "google-gemini" },
    ],
    links: [
      { label: "Live", href: "https://prospect.courses", aria: "Prospect, live site (opens in a new tab)" },
      { label: "Code", href: "https://github.com/karthikm062025S/prospect", aria: "Prospect, code (opens in a new tab)" },
    ],
  },
  {
    tag: { label: "Grounded AI", glyph: "anchor" },
    name: "Witness",
    lines: [
      "Turns a tenant's photo of a housing problem into a complaint that cites the statute.",
      "Built by a team of four at an AWS and Kiro hackathon, on Lambda, Step Functions, and Bedrock.",
      "Every citation must exact-match a record in DynamoDB, and anything that misses is dropped.",
    ],
    stack: [
      { name: "AWS", mark: "aws" },
      { name: "DynamoDB", mark: "dynamodb" },
      { name: "Amazon Bedrock", mark: "bedrock-aws" },
      { name: "Claude", mark: "claude" },
    ],
    links: [
      { label: "Code", href: "https://github.com/karthikm062025S/Witness", aria: "Witness, code (opens in a new tab)" },
      { label: "Devpost", href: "https://devpost.com/software/witness-f9ijzq", aria: "Witness, Devpost page (opens in a new tab)" },
    ],
  },
];

export const education = {
  date: "May 2028",
  school: "Virginia Tech · B.S. Computer Science · GPA 3.96 · Blacksburg, VA", // no-break inside each segment so a phone never splits "GPA" from "3.96"
  interests: "Away from the keyboard, I play golf and lift.",
};

export const contact = {
  lead: "Email is the best way to reach me.",
};

export const footer = "Karthik Mandli · 2026";
