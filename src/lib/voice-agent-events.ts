/**
 * Type definitions for the AssemblyAI Voice Agent API WebSocket protocol.
 * See https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference
 */

// ---- Client → Server ----

export type ClientEvent =
  | { type: "session.update"; session: SessionConfig }
  | { type: "session.resume"; session_id: string }
  | { type: "session.end" }
  | { type: "input.audio"; audio: string }
  | { type: "tool.result"; call_id: string; result: string; is_error?: boolean }
  | { type: "conversation.message"; role: "user" | "system"; content: string }
  | { type: "reply.cancel"; reply_id: string }
  | { type: "reply.create" };

export interface SessionConfig {
  system_prompt?: string;
  greeting?: string | null;
  input?: AudioInputConfig | { type: "text" };
  output?: AudioOutputConfig | { type: "text" };
  tools?: ToolDefinition[];
}

export interface AudioInputConfig {
  type: "audio";
  format?: { encoding: "audio/pcm"; sample_rate: 24000 };
  turn_detection?: TurnDetection | null;
}

export interface AudioOutputConfig {
  type: "audio";
  voice?: string;
  format?: { encoding: "audio/pcm"; sample_rate: 24000 };
}

export interface TurnDetection {
  type?: "server_vad" | "semantic_vad" | null;
  vad_threshold?: number;
  interrupt_response?: boolean;
  min_silence?: number;
  max_silence?: number;
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description?: string;
  parameters?: object;
}

// ---- Server → Client ----

export type ServerEvent =
  | { type: "session.ready"; session_id: string; config: object; expires_at: number }
  | { type: "session.updated"; config: object }
  | { type: "session.error"; code: string; message: string; param?: string }
  | { type: "session.ended"; session_duration_seconds: number; audio_duration_seconds?: number }
  | { type: "input.speech.started" }
  | { type: "input.speech.stopped" }
  | { type: "transcript.user"; item_id: string; text: string }
  | { type: "transcript.user.delta"; text: string }
  | { type: "transcript.agent"; reply_id: string; item_id: string; text: string; interrupted: boolean }
  | { type: "transcript.agent.delta"; reply_id: string; item_id: string; delta: string }
  | { type: "reply.started"; reply_id: string; item_id: string }
  | { type: "reply.audio"; reply_id: string; data: string }
  | { type: "reply.done"; reply_id: string; status?: "completed" | "interrupted" | "failed" }
  | { type: "tool.call"; call_id: string; name: string; arguments: Record<string, unknown> };

/** Plain message shape used for rendering the live transcript. */
export interface ConversationMessage {
  id: string;
  role: "agent" | "user";
  text: string;
  interrupted?: boolean;
  partial?: boolean;
}
