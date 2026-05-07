"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type EvaluationRecord,
  type InterviewSetup,
  type InterviewSummary,
  buildSessionConfig,
} from "@/lib/interview";
import {
  type ConnectionState,
  type ToolCall,
  VoiceAgentClient,
} from "@/lib/voice-agent-client";

export interface ConversationItem {
  id: string;
  role: "user" | "agent";
  text: string;
  interrupted?: boolean;
  timestamp: number;
}

export interface VoiceAgentState {
  state: ConnectionState;
  speaker: "user" | "agent" | null;
  messages: ConversationItem[];
  partialUser: string;
  evaluations: EvaluationRecord[];
  summary: InterviewSummary | null;
  error: string | null;
  level: { user: number; agent: number };
}

const initialState: VoiceAgentState = {
  state: "idle",
  speaker: null,
  messages: [],
  partialUser: "",
  evaluations: [],
  summary: null,
  error: null,
  level: { user: 0, agent: 0 },
};

export function useVoiceAgent(setup: InterviewSetup | null) {
  const [state, setState] = useState<VoiceAgentState>(initialState);
  const clientRef = useRef<VoiceAgentClient | null>(null);

  const session = useMemo(() => (setup ? buildSessionConfig(setup) : null), [setup]);

  // Build the client once per setup. Re-running connect on the same instance
  // would conflict with the WebSocket lifecycle, so we always create fresh.
  const buildClient = useCallback(() => {
    if (!session) return null;
    const client = new VoiceAgentClient({
      session,
      onToolCall: async (call: ToolCall) => handleToolCall(call, setState),
    });
    clientRef.current = client;

    client.on("state", (s) => setState((prev) => ({ ...prev, state: s })));
    client.on("speakingChange", (who) => setState((prev) => ({ ...prev, speaker: who })));
    client.on("level", (level) => setState((prev) => ({ ...prev, level })));
    client.on("error", (msg) => setState((prev) => ({ ...prev, error: msg })));
    client.on("message", ({ role, text, interrupted }) => {
      setState((prev) => ({
        ...prev,
        partialUser: role === "user" ? "" : prev.partialUser,
        messages: [
          ...prev.messages,
          { id: cryptoId(), role, text, interrupted, timestamp: Date.now() },
        ],
      }));
    });
    client.on("partial", ({ role, text }) => {
      if (role !== "user") return;
      setState((prev) => ({ ...prev, partialUser: text }));
    });

    return client;
  }, [session]);

  const connect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
      clientRef.current = null;
    }
    setState({ ...initialState });
    const client = buildClient();
    if (!client) return;
    try {
      await client.connect();
    } catch {
      /* error already surfaced through listener */
    }
  }, [buildClient]);

  const disconnect = useCallback(async () => {
    await clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  // Auto-cleanup on unmount.
  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  return { ...state, connect, disconnect };
}

// ----------------------------------------------------------------------------
// Tool dispatch
// ----------------------------------------------------------------------------

async function handleToolCall(
  call: ToolCall,
  setState: React.Dispatch<React.SetStateAction<VoiceAgentState>>,
): Promise<unknown> {
  const args = call.arguments ?? {};

  switch (call.name) {
    case "record_evaluation": {
      const evaluation: EvaluationRecord = {
        topic: String(args.topic ?? ""),
        score: clampScore(Number(args.score ?? 0)),
        note: String(args.note ?? ""),
        recordedAt: Date.now(),
      };
      setState((prev) => ({ ...prev, evaluations: [...prev.evaluations, evaluation] }));
      return { recorded: true };
    }

    case "end_interview": {
      const summary: InterviewSummary = {
        overall_assessment: String(args.overall_assessment ?? ""),
        key_strengths: arrayOfStrings(args.key_strengths),
        areas_for_improvement: arrayOfStrings(args.areas_for_improvement),
        recommendation: validateRecommendation(args.recommendation),
        endedAt: Date.now(),
      };
      setState((prev) => ({ ...prev, summary }));
      return { ended: true, instruction: "Thank the candidate briefly and end the call." };
    }

    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function validateRecommendation(value: unknown): InterviewSummary["recommendation"] {
  const allowed = ["strong_hire", "hire", "lean_hire", "lean_no_hire", "no_hire"] as const;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as InterviewSummary["recommendation"];
  }
  return "lean_hire";
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
