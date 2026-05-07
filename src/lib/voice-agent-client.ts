/**
 * Voice Agent API client.
 *
 * Owns the WebSocket connection, audio capture (AudioWorklet), audio playback
 * (scheduled buffer queue), and event dispatch. Provides a clean event bus
 * that React components can subscribe to without ever touching audio internals.
 *
 * Design notes:
 * - Capture uses an AudioWorklet so the encode-to-PCM16 step runs off the
 *   main thread. The worklet posts ArrayBuffers; we base64 them and ship.
 * - Playback uses Web Audio's `AudioBufferSourceNode` scheduled with
 *   `start(playT)`. A single rolling timestamp ensures chunks play seamlessly.
 *   On interruption we set `playT = currentTime`, dropping the queue.
 * - Tool results are gated: never sent while the agent or user is talking,
 *   buffered and drained when both are idle. This is the documented pattern.
 *   See https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tool-calling
 */

import type { ClientEvent, ServerEvent, SessionConfig } from "./voice-agent-events";

const SAMPLE_RATE = 24_000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";

// AudioWorklet processor source — converts Float32 mic samples to PCM16
// and posts the ArrayBuffer to the main thread. Inlined as a Blob URL so
// the app stays single-bundle-friendly.
const CAPTURE_WORKLET_SOURCE = /* javascript */ `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    const pcm = new Int16Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
`;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ConnectionState =
  | "idle"
  | "requesting-mic"
  | "fetching-token"
  | "connecting"
  | "ready"
  | "ended"
  | "error";

export interface ToolCall {
  call_id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type ToolHandler = (call: ToolCall) => Promise<unknown> | unknown;

export interface VoiceAgentClientOptions {
  /** Endpoint that mints a temporary token. POSTed to. */
  tokenEndpoint?: string;
  /** Initial session.update payload (system prompt, voice, tools, etc.). */
  session: SessionConfig;
  /** Called for each tool.call. Return value is JSON-serialised and sent back. */
  onToolCall?: ToolHandler;
  /** Optional handler for any server event you want raw access to. */
  onEvent?: (event: ServerEvent) => void;
}

interface Listeners {
  state: Set<(state: ConnectionState) => void>;
  speakingChange: Set<(who: "user" | "agent" | null) => void>;
  message: Set<(msg: { role: "user" | "agent"; text: string; interrupted?: boolean }) => void>;
  partial: Set<(msg: { role: "user" | "agent"; text: string }) => void>;
  level: Set<(level: { user: number; agent: number }) => void>;
  error: Set<(message: string) => void>;
  toolCall: Set<(call: ToolCall) => void>;
}

// ----------------------------------------------------------------------------
// Client
// ----------------------------------------------------------------------------

export class VoiceAgentClient {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private mic: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  /** Wall-clock time at which the next playback buffer should start. */
  private playT = 0;
  /** Track active playback sources so we can stop them on interruption. */
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  private agentSpeaking = false;
  private userSpeaking = false;
  private pendingToolResults: { call_id: string; result: string; is_error?: boolean }[] = [];

  private listeners: Listeners = {
    state: new Set(),
    speakingChange: new Set(),
    message: new Set(),
    partial: new Set(),
    level: new Set(),
    error: new Set(),
    toolCall: new Set(),
  };

  private connectionState: ConnectionState = "idle";
  private analyser: AnalyserNode | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private levelRaf: number | null = null;
  private playbackGain: GainNode | null = null;

  constructor(private opts: VoiceAgentClientOptions) {}

  // ---------- Public API ----------

  on<K extends keyof Listeners>(event: K, handler: Listeners[K] extends Set<infer H> ? H : never) {
    (this.listeners[event] as Set<unknown>).add(handler);
    return () => (this.listeners[event] as Set<unknown>).delete(handler);
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  /** Connect: request mic → fetch temp token → open WebSocket → send session.update. */
  async connect(): Promise<void> {
    if (this.connectionState !== "idle" && this.connectionState !== "ended" && this.connectionState !== "error") {
      return;
    }

    try {
      // 1. Request microphone access (this is the user gesture surface).
      this.setState("requesting-mic");
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Boot AudioContext at 24 kHz so it matches the API natively.
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      await this.ctx.resume();
      const workletUrl = URL.createObjectURL(
        new Blob([CAPTURE_WORKLET_SOURCE], { type: "application/javascript" }),
      );
      await this.ctx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      this.source = this.ctx.createMediaStreamSource(this.mic);
      this.capture = new AudioWorkletNode(this.ctx, "capture-processor");

      // Mic-side analyser drives the user-speaking visualiser.
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.source.connect(this.analyser);
      this.source.connect(this.capture);
      // Don't connect the capture node anywhere — we only care about its port messages.

      // Playback chain: gain → analyser → destination, so we can reflect bot loudness
      // and instantly mute on interruption.
      this.playbackGain = this.ctx.createGain();
      this.playbackAnalyser = this.ctx.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackGain.connect(this.playbackAnalyser);
      this.playbackAnalyser.connect(this.ctx.destination);

      this.startLevelLoop();

      // 3. Fetch a temp token from our server.
      this.setState("fetching-token");
      const tokenRes = await fetch(this.opts.tokenEndpoint ?? "/api/token", { method: "POST" });
      if (!tokenRes.ok) {
        throw new Error(`Failed to mint temp token: HTTP ${tokenRes.status}`);
      }
      const { token } = (await tokenRes.json()) as { token: string };

      // 4. Open the WebSocket.
      this.setState("connecting");
      const url = new URL(WS_URL);
      url.searchParams.set("token", token);
      this.ws = new WebSocket(url);

      this.ws.addEventListener("open", () => {
        this.send({ type: "session.update", session: this.opts.session });
      });

      this.ws.addEventListener("message", (e) => {
        try {
          const event = JSON.parse(e.data as string) as ServerEvent;
          this.handleServerEvent(event);
        } catch (err) {
          console.error("[voice-agent] failed to parse message", err);
        }
      });

      this.ws.addEventListener("error", () => this.fail("WebSocket error"));
      this.ws.addEventListener("close", () => {
        if (this.connectionState !== "ended" && this.connectionState !== "error") {
          this.setState("ended");
        }
      });

      // Stream mic audio after session.ready (we gate inside the worklet handler).
      this.capture.port.onmessage = (msg) => {
        if (this.connectionState !== "ready" || this.ws?.readyState !== WebSocket.OPEN) return;
        const bytes = new Uint8Array(msg.data as ArrayBuffer);
        // btoa over a binary string; chunked to avoid arg-length limits.
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const audio = btoa(bin);
        this.send({ type: "input.audio", audio });
      };
    } catch (err) {
      this.fail(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }

  /** Cleanly close the session and free audio resources. */
  async disconnect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: "session.end" });
      // Give the server a beat to acknowledge.
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.ws.close();
    }
    this.cleanup();
    this.setState("ended");
  }

  // ---------- Internal: connection state & event bus ----------

  private setState(state: ConnectionState) {
    this.connectionState = state;
    this.listeners.state.forEach((cb) => cb(state));
  }

  private fail(msg: string) {
    this.setState("error");
    this.listeners.error.forEach((cb) => cb(msg));
  }

  private send(event: ClientEvent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(event));
  }

  // ---------- Server event dispatch ----------

  private handleServerEvent(event: ServerEvent) {
    this.opts.onEvent?.(event);

    switch (event.type) {
      case "session.ready":
        this.setState("ready");
        return;

      case "session.error":
        this.fail(event.message ?? event.code);
        return;

      case "input.speech.started":
        this.userSpeaking = true;
        this.listeners.speakingChange.forEach((cb) => cb("user"));
        // Barge-in: instantly drop any agent audio in flight.
        this.flushPlayback();
        return;

      case "input.speech.stopped":
        this.userSpeaking = false;
        if (!this.agentSpeaking) this.listeners.speakingChange.forEach((cb) => cb(null));
        this.maybeFlushTools();
        return;

      case "reply.started":
        this.agentSpeaking = true;
        this.listeners.speakingChange.forEach((cb) => cb("agent"));
        // Reset playback clock to "now" so chunks for this reply start immediately.
        if (this.ctx) this.playT = Math.max(this.playT, this.ctx.currentTime);
        return;

      case "reply.audio":
        this.enqueueAudio(event.data);
        return;

      case "reply.done":
        this.agentSpeaking = false;
        if (event.status === "interrupted") this.flushPlayback();
        if (!this.userSpeaking) this.listeners.speakingChange.forEach((cb) => cb(null));
        this.maybeFlushTools();
        return;

      case "transcript.user":
        if (event.text) {
          this.listeners.message.forEach((cb) => cb({ role: "user", text: event.text }));
        }
        return;

      case "transcript.user.delta":
        if (event.text) {
          this.listeners.partial.forEach((cb) => cb({ role: "user", text: event.text }));
        }
        return;

      case "transcript.agent":
        if (event.text) {
          this.listeners.message.forEach((cb) =>
            cb({ role: "agent", text: event.text, interrupted: event.interrupted }),
          );
        }
        return;

      case "tool.call": {
        const call = { call_id: event.call_id, name: event.name, arguments: event.arguments };
        this.listeners.toolCall.forEach((cb) => cb(call));
        if (this.opts.onToolCall) {
          void Promise.resolve(this.opts.onToolCall(call))
            .then((result) => {
              const serialized =
                typeof result === "string" ? result : JSON.stringify(result ?? null);
              this.pendingToolResults.push({ call_id: event.call_id, result: serialized });
              this.maybeFlushTools();
            })
            .catch((err) => {
              this.pendingToolResults.push({
                call_id: event.call_id,
                result: JSON.stringify({ error: String(err) }),
                is_error: true,
              });
              this.maybeFlushTools();
            });
        }
        return;
      }
    }
  }

  /**
   * Send tool results only when both the agent and user are silent.
   * Sending mid-reply causes the in-flight reply to be dropped.
   */
  private maybeFlushTools() {
    if (this.agentSpeaking || this.userSpeaking) return;
    while (this.pendingToolResults.length) {
      const t = this.pendingToolResults.shift()!;
      this.send({ type: "tool.result", call_id: t.call_id, result: t.result, is_error: t.is_error });
    }
  }

  // ---------- Audio playback ----------

  private enqueueAudio(b64: string) {
    if (!this.ctx || !this.playbackGain) return;

    // Decode base64 → bytes → Int16 → Float32, build a 1ch AudioBuffer.
    const raw = atob(b64);
    const len = raw.length / 2;
    const buf = this.ctx.createBuffer(1, len, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const lo = raw.charCodeAt(i * 2);
      const hi = raw.charCodeAt(i * 2 + 1);
      const sample = (lo | (hi << 8)) << 16 >> 16; // sign-extend
      data[i] = sample / 32768;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.playbackGain);
    src.onended = () => this.activeSources.delete(src);
    this.activeSources.add(src);

    const startAt = Math.max(this.playT, this.ctx.currentTime);
    src.start(startAt);
    this.playT = startAt + buf.duration;
  }

  /** Stop all in-flight playback nodes and reset the queue clock. */
  private flushPlayback() {
    if (!this.ctx) return;
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.activeSources.clear();
    this.playT = this.ctx.currentTime;
  }

  // ---------- Level metering ----------

  private startLevelLoop() {
    const userBuf = new Float32Array(this.analyser?.fftSize ?? 256);
    const botBuf = new Float32Array(this.playbackAnalyser?.fftSize ?? 256);

    const tick = () => {
      let userLevel = 0;
      let agentLevel = 0;

      if (this.analyser) {
        this.analyser.getFloatTimeDomainData(userBuf);
        userLevel = rms(userBuf);
      }
      if (this.playbackAnalyser) {
        this.playbackAnalyser.getFloatTimeDomainData(botBuf);
        agentLevel = rms(botBuf);
      }

      this.listeners.level.forEach((cb) => cb({ user: userLevel, agent: agentLevel }));
      this.levelRaf = requestAnimationFrame(tick);
    };
    this.levelRaf = requestAnimationFrame(tick);
  }

  // ---------- Cleanup ----------

  private cleanup() {
    if (this.levelRaf !== null) cancelAnimationFrame(this.levelRaf);
    this.levelRaf = null;
    this.activeSources.clear();
    try {
      this.capture?.disconnect();
      this.source?.disconnect();
      this.analyser?.disconnect();
      this.playbackAnalyser?.disconnect();
      this.playbackGain?.disconnect();
    } catch {
      /* swallow */
    }
    this.mic?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();

    this.ws = null;
    this.ctx = null;
    this.mic = null;
    this.capture = null;
    this.source = null;
    this.analyser = null;
    this.playbackAnalyser = null;
    this.playbackGain = null;
  }
}

function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}
