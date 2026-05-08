import type { SessionConfig, ToolDefinition } from "./voice-agent-events";

// ----------------------------------------------------------------------------
// Setup form types
// ----------------------------------------------------------------------------

export type InterviewType = "behavioral" | "technical" | "system_design" | "mixed";
export type Difficulty = "junior" | "mid" | "senior" | "staff";

export interface InterviewSetup {
  candidateName: string;
  role: string;
  company?: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
  topics: string[];
  durationMinutes: number;
  voice: string;
}

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  system_design: "System design",
  mixed: "Mixed",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  junior: "Junior (0–2 yrs)",
  mid: "Mid-level (2–5 yrs)",
  senior: "Senior (5–10 yrs)",
  staff: "Staff+ (10+ yrs)",
};

// Curated voices that work well for interview scenarios.
export const INTERVIEW_VOICES = [
  { id: "ivy", label: "Ivy", desc: "Professional, deliberate" },
  { id: "james", label: "James", desc: "Conversational, friendly" },
  { id: "sophie", label: "Sophie", desc: "British, clear, instructive" },
  { id: "david", label: "David", desc: "Deep, calming" },
  { id: "emma", label: "Emma", desc: "Lively, engaged" },
  { id: "oliver", label: "Oliver", desc: "British, narrative" },
] as const;

export const COMMON_TOPICS: Record<InterviewType, string[]> = {
  behavioral: [
    "Conflict resolution",
    "Leadership",
    "Tradeoffs and prioritization",
    "Failure and learning",
    "Cross-team collaboration",
    "Mentorship",
  ],
  technical: [
    "Data structures and algorithms",
    "API design",
    "Concurrency and threading",
    "Debugging strategies",
    "Code review",
    "Testing",
  ],
  system_design: [
    "Scalability",
    "Database design",
    "Caching strategies",
    "Distributed systems",
    "Real-time systems",
    "Tradeoffs in architecture",
  ],
  mixed: [
    "Recent project deep-dive",
    "Technical decision-making",
    "Team collaboration",
    "Problem solving",
  ],
};

// ----------------------------------------------------------------------------
// Tool definitions
// ----------------------------------------------------------------------------

// NOTE: the server validates tool schemas strictly — it rejects extra JSON
// Schema fields like `enum`, `minimum`, `maximum`, and nested `items`.
// Keep parameter schemas to bare `type` + `description`, then describe the
// constraints (allowed values, ranges) in the `description` text instead.
export const INTERVIEW_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "record_evaluation",
    description:
      "Record a per-topic evaluation note as the interview progresses. Call this after the candidate finishes a substantive answer on one of the planned topics. Don't tell the candidate you're scoring — just call the tool quietly between turns.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The topic this answer relates to. Should match one of the topics in the system prompt.",
        },
        score: {
          type: "integer",
          description:
            "Rating from 1 to 5. 1 = clearly struggled, 2 = below bar, 3 = met bar, 4 = strong, 5 = exceptional.",
        },
        note: {
          type: "string",
          description: "One- or two-sentence note on what the candidate did well or where they fell short.",
        },
      },
      required: ["topic", "score", "note"],
    },
  },
  {
    type: "function",
    name: "end_interview",
    description:
      "Wrap up the interview. Call this when you've covered enough ground (typically after 3–5 substantive answers) or when the candidate signals they're done. Don't call this without warning — first say something like 'I think we've got what we need, let me wrap up'.",
    parameters: {
      type: "object",
      properties: {
        overall_assessment: {
          type: "string",
          description: "2–3 sentence overall assessment of the candidate.",
        },
        key_strengths: {
          type: "array",
          description: "Array of 2–3 bullet-point strengths (each a string).",
        },
        areas_for_improvement: {
          type: "array",
          description: "Array of 2–3 bullet-point growth areas (each a string).",
        },
        recommendation: {
          type: "string",
          description:
            "Exactly one of: strong_hire, hire, lean_hire, lean_no_hire, no_hire.",
        },
      },
      required: ["overall_assessment", "key_strengths", "areas_for_improvement", "recommendation"],
    },
  },
];

// ----------------------------------------------------------------------------
// System prompt builder
// ----------------------------------------------------------------------------

export function buildInterviewerPrompt(setup: InterviewSetup): string {
  const topicList = setup.topics.map((t) => `- ${t}`).join("\n");

  return `You are an experienced interviewer conducting a ${INTERVIEW_TYPE_LABELS[setup.interviewType].toLowerCase()} interview${
    setup.company ? ` at ${setup.company}` : ""
  } for a ${DIFFICULTY_LABELS[setup.difficulty].toLowerCase()} ${setup.role} role. The candidate is ${setup.candidateName}.

# How you talk
- Warm, professional, calm. You've done hundreds of these.
- Short. Almost always 1–2 sentences. Never lecture.
- You ask one focused question at a time, then listen.
- Acknowledge briefly ("got it", "makes sense") then move on. Don't gush.
- Never say "Certainly", "Absolutely", or "Great question".
- Avoid filler that pretends to be deep ("That's really insightful").

# Pacing
- This is a ${setup.durationMinutes}-minute interview. Plan to cover ${Math.min(setup.topics.length, 4)} substantive topics.
- One main question per topic. One follow-up if their answer needs depth.
- Move on when you have enough signal. Don't drill forever on one thing.

# Topics to explore (in roughly this order)
${topicList}

# What good answers look like (${DIFFICULTY_LABELS[setup.difficulty].toLowerCase()})
${calibrationGuide(setup.difficulty)}

# Scoring (silent — never read out loud)
After each substantive answer, call the record_evaluation tool with:
- topic: the topic name from the list above (verbatim).
- score: 1–5 against the calibration above.
- note: one or two sentences on what stood out.

Don't tell the candidate you're scoring. The tool runs silently.

# Wrapping up
When you've covered enough ground (typically 3–5 substantive answers), say something like "I think I've got a good sense of where you are — let me wrap up." Then call end_interview with structured feedback. After that, thank them and end the call.

# Handling edge cases
- Vague answer → ask for a concrete example.
- Long-winded answer → "got it — let me move us on."
- Off-topic → "let's come back to that — I want to ask about X."
- "I don't know" → "no problem, let's try a different angle." Don't shame.

# Voice-first
You're being spoken aloud. Don't use markdown, lists, or anything that wouldn't sound natural read out. Numbers like "10–20" become "ten to twenty".

You'll start by greeting the candidate (a short greeting will be played first). Once they respond, ease in with a light opener — "tell me a bit about yourself" or "what drew you to apply" — before getting into the topics.`;
}

export function buildGreeting(setup: InterviewSetup): string {
  const firstName = setup.candidateName.split(" ")[0] || "there";
  const format = INTERVIEW_TYPE_LABELS[setup.interviewType].toLowerCase();
  const where = setup.company ? ` at ${setup.company}` : "";
  return `Hi ${firstName}, thanks for jumping on. I'll be running your ${format} interview${where} today for the ${setup.role} role. How are you doing?`;
}

function calibrationGuide(difficulty: Difficulty): string {
  switch (difficulty) {
    case "junior":
      return "- Strong: clear thinking, names the right concepts, asks good clarifying questions.\n- Weak: confused on fundamentals, can't name basic tools, no recovery from mistakes.";
    case "mid":
      return "- Strong: structured answers, real examples from production, knows tradeoffs.\n- Weak: handwaves through specifics, no concrete examples, surface-level reasoning.";
    case "senior":
      return "- Strong: nuanced tradeoff thinking, concrete production stories, owns past mistakes, system-level thinking.\n- Weak: generic answers, can't tell you why a decision was made, blames others, no scope ownership.";
    case "staff":
      return "- Strong: org-wide thinking, technical strategy, mentorship stories, comfortable with ambiguity, has shipped through crises.\n- Weak: still talks like an IC, can't articulate impact beyond their team, no strategic perspective.";
  }
}

// ----------------------------------------------------------------------------
// Build the full session config
// ----------------------------------------------------------------------------

export function buildSessionConfig(setup: InterviewSetup): SessionConfig {
  return {
    system_prompt: buildInterviewerPrompt(setup),
    // The greeting plays automatically when session.ready fires. Set it
    // here (not via reply.create) so the candidate isn't greeted by silence.
    greeting: buildGreeting(setup),
    input: {
      type: "audio",
      // Conservative turn detection — interviewers should let candidates think,
      // not jump in at every short pause. These values are tuned from real
      // interview audio: min_silence 1500 ms, max_silence 4000 ms.
      turn_detection: {
        type: "server_vad",
        vad_threshold: 0.5,
        interrupt_response: true,
        min_silence: 1500,
        max_silence: 4000,
      },
    },
    output: {
      type: "audio",
      voice: setup.voice,
    },
    tools: INTERVIEW_TOOLS,
  };
}

// ----------------------------------------------------------------------------
// Tool result types
// ----------------------------------------------------------------------------

export interface EvaluationRecord {
  topic: string;
  score: number;
  note: string;
  recordedAt: number;
}

export interface InterviewSummary {
  overall_assessment: string;
  key_strengths: string[];
  areas_for_improvement: string[];
  recommendation: "strong_hire" | "hire" | "lean_hire" | "lean_no_hire" | "no_hire";
  endedAt: number;
}

export const RECOMMENDATION_LABELS: Record<InterviewSummary["recommendation"], string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  lean_hire: "Lean hire",
  lean_no_hire: "Lean no-hire",
  no_hire: "No hire",
};
