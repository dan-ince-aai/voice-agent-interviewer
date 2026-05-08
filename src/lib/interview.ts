import type { SessionConfig, ToolDefinition } from "./voice-agent-events";

// ----------------------------------------------------------------------------
// Setup form types
// ----------------------------------------------------------------------------

export type InterviewType = "screening" | "behavioral" | "skills" | "mixed";
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
  /** Custom greeting; falls back to a generated one when blank. */
  greeting?: string;
}

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  screening: "Screening call",
  behavioral: "Behavioral",
  skills: "Skills assessment",
  mixed: "Mixed",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  junior: "Entry level (0–2 yrs)",
  mid: "Mid-level (2–5 yrs)",
  senior: "Senior (5–10 yrs)",
  staff: "Lead / Manager (10+ yrs)",
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
  screening: [
    "Background and experience",
    "Why you applied",
    "Salary expectations",
    "Availability and start date",
    "Work authorization",
    "Why you're leaving your current role",
    "Schedule and shift flexibility",
  ],
  behavioral: [
    "Conflict with a coworker",
    "Handling a difficult customer",
    "A time you went above and beyond",
    "A failure and what you learned",
    "Working under pressure",
    "Disagreeing with a manager",
    "A time you led a team or project",
  ],
  skills: [
    "A typical day in this role",
    "Most challenging part of this role",
    "How you'd handle a common scenario",
    "Tools and systems you use",
    "Your strongest skill",
    "An area you want to grow in",
    "Customer or stakeholder examples",
  ],
  mixed: [
    "A recent accomplishment you're proud of",
    "Why you'd be a good fit",
    "Strengths and weaknesses",
    "Career goals",
    "A challenging situation you handled",
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
      return "- Strong: curious, asks clarifying questions, learns from feedback, owns mistakes, clear about why this role.\n- Weak: vague about basics, deflects when uncertain, can't articulate why they applied.";
    case "mid":
      return "- Strong: concrete examples from real work, knows the tradeoffs in their decisions, takes accountability.\n- Weak: generic answers, no specific examples, blames external factors, can't say what they'd do differently.";
    case "senior":
      return "- Strong: specific stories with real outcomes, depth in their craft, mentors others, calm under ambiguity.\n- Weak: still answering like an entry-level candidate, no measurable impact, no growth in last few years.";
    case "staff":
      return "- Strong: big-picture thinking, strategic perspective, comfortable owning ambiguous problems, develops people, has shipped through hard moments.\n- Weak: tactical-only answers, no scope beyond their immediate work, no examples of leading or developing others.";
  }
}

// ----------------------------------------------------------------------------
// Build the full session config
// ----------------------------------------------------------------------------

export function buildSessionConfig(setup: InterviewSetup): SessionConfig {
  // Honour a user-provided greeting; fall back to the generated one if blank.
  const greeting = setup.greeting?.trim() || buildGreeting(setup);
  return {
    system_prompt: buildInterviewerPrompt(setup),
    // The greeting plays automatically when session.ready fires. Set it
    // here (not via reply.create) so the candidate isn't greeted by silence.
    greeting,
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
