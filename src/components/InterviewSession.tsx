"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";
import { type InterviewSetup, INTERVIEW_TYPE_LABELS } from "@/lib/interview";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { Header } from "@/components/Header";
import { InterviewSummary } from "@/components/InterviewSummary";
import { Scorecard } from "@/components/Scorecard";
import { Transcript } from "@/components/Transcript";
import { VoiceOrb } from "@/components/VoiceOrb";

interface Props {
  setup: InterviewSetup;
}

const STATE_LABELS: Record<string, { label: string; tone: string }> = {
  idle: { label: "Ready to start", tone: "text-slate-600 bg-slate-100" },
  "requesting-mic": { label: "Asking for mic access…", tone: "text-amber-700 bg-amber-50" },
  "fetching-token": { label: "Authenticating…", tone: "text-amber-700 bg-amber-50" },
  connecting: { label: "Connecting…", tone: "text-amber-700 bg-amber-50" },
  ready: { label: "Connected", tone: "text-emerald-700 bg-emerald-50" },
  ended: { label: "Disconnected", tone: "text-slate-600 bg-slate-100" },
  error: { label: "Connection error", tone: "text-rose-700 bg-rose-50" },
};

export function InterviewSession({ setup }: Props) {
  const router = useRouter();
  const {
    state,
    speaker,
    messages,
    partialUser,
    evaluations,
    summary,
    error,
    level,
    connect,
    disconnect,
  } = useVoiceAgent(setup);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const showSummary = summary !== null;

  const stateLabel = STATE_LABELS[state] ?? { label: state, tone: "text-slate-500 bg-slate-100" };

  // Auto-end the call when the agent calls end_interview.
  const summaryArrivedRef = useRef(false);
  useEffect(() => {
    if (summary && !summaryArrivedRef.current) {
      summaryArrivedRef.current = true;
      setEndedAt(Date.now());
      // Give the agent ~3s to say "thanks, goodbye" before we cut the call.
      const t = setTimeout(() => {
        void disconnect();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [summary, disconnect]);

  // Live-update the elapsed timer.
  useEffect(() => {
    if (state === "ready" && startedAt === null) {
      setStartedAt(Date.now());
    }
  }, [state, startedAt]);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      const end = endedAt ?? Date.now();
      setElapsedSeconds(Math.floor((end - startedAt) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [startedAt, endedAt]);

  function handleStart() {
    void connect();
  }

  function handleEnd() {
    setEndedAt(Date.now());
    void disconnect();
  }

  function handleRestart() {
    try {
      sessionStorage.removeItem("voice-agent-interviewer.setup");
    } catch {
      /* noop */
    }
    router.push("/");
  }

  if (showSummary && summary) {
    return (
      <main className="min-h-screen">
        <Header subtitle="Interview complete" />
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="glass rounded-[20px] border border-slate-200/70 p-7 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-30px_rgba(15,23,42,0.18)]">
            <InterviewSummary
              summary={summary}
              evaluations={evaluations}
              candidateName={setup.candidateName}
              durationSeconds={elapsedSeconds}
              onRestart={handleRestart}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Header subtitle="Interview in progress" />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-8 lg:grid-cols-[2fr_1fr]">
        {/* Left: orb + transcript */}
        <div className="space-y-5">
          <div className="glass relative overflow-hidden rounded-[20px] border border-slate-200/70 px-6 py-10 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-30px_rgba(15,23,42,0.18)]">
            <div className="flex flex-col items-center justify-center">
              <VoiceOrb speaker={speaker} level={speaker === "user" ? level.user : level.agent} />

              <div className="mt-7 text-center">
                <div className="inline-flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", stateLabel.tone)}>
                    {stateLabel.label}
                  </span>
                  {state === "ready" && (
                    <span className="font-mono text-xs text-slate-500">
                      {formatTime(elapsedSeconds)}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
                  {state === "ready" ? speakerCaption(speaker, setup.candidateName) : "Get ready"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {state === "ready"
                    ? "Speak naturally — the agent will pause to let you finish your thought."
                    : `${INTERVIEW_TYPE_LABELS[setup.interviewType]} interview · ${setup.role}${setup.company ? ` · ${setup.company}` : ""}`}
                </p>
              </div>

              <div className="mt-7 flex items-center gap-3">
                {state === "idle" || state === "ended" || state === "error" ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="focus-ring group flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(54,77,234,0.3),0_8px_24px_-8px_rgba(54,77,234,0.4)] transition hover:bg-[var(--color-brand-dark)]"
                  >
                    <Mic className="h-4 w-4" />
                    Start interview
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnd}
                    disabled={state !== "ready"}
                    className="focus-ring flex items-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(220,38,38,0.3)] transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    <PhoneOff className="h-4 w-4" />
                    End call
                  </button>
                )}
                {state === "ready" && (
                  <span className="hidden text-xs text-slate-400 sm:inline-flex">
                    Echo cancellation on · 24 kHz · {setup.voice}
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-5 max-w-md rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-center text-sm text-rose-800">
                  {error}
                </div>
              )}

              {state === "idle" && (
                <p className="mt-6 max-w-md rounded-[12px] border border-slate-200 bg-white/70 px-4 py-3 text-center text-xs text-slate-500">
                  When you click Start, your browser will ask for microphone access. The interviewer will greet you and start the conversation.
                </p>
              )}
            </div>
          </div>

          <div className="glass min-h-[300px] overflow-hidden rounded-[20px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-30px_rgba(15,23,42,0.18)] lg:h-[420px]">
            <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/40 px-6 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transcript</h3>
              <SpeakerIndicator speaker={speaker} candidateName={setup.candidateName} />
            </div>
            <div className="h-[calc(100%-46px)]">
              <Transcript messages={messages} partialUser={partialUser} candidateName={setup.candidateName} />
            </div>
          </div>
        </div>

        {/* Right: scorecard + setup recap */}
        <aside className="space-y-5">
          <div className="glass rounded-[20px] border border-slate-200/70 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-30px_rgba(15,23,42,0.18)]">
            <Scorecard evaluations={evaluations} topics={setup.topics} />
          </div>

          <div className="glass rounded-[20px] border border-slate-200/70 p-5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-30px_rgba(15,23,42,0.18)]">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3 w-3 text-[var(--color-brand)]" />
              This interview
            </h3>
            <dl className="space-y-1.5">
              <Row label="Candidate" value={setup.candidateName} />
              <Row label="Role" value={setup.role} />
              {setup.company && <Row label="Company" value={setup.company} />}
              <Row label="Format" value={INTERVIEW_TYPE_LABELS[setup.interviewType]} />
              <Row label="Voice" value={setup.voice} />
              <Row label="Length target" value={`${setup.durationMinutes} min`} />
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}

function speakerCaption(speaker: "user" | "agent" | null, name: string): string {
  if (speaker === "user") return `Listening to ${name.split(" ")[0] || "you"}…`;
  if (speaker === "agent") return "Interviewer is speaking…";
  return "Waiting for someone to speak";
}

function SpeakerIndicator({
  speaker,
  candidateName,
}: {
  speaker: "user" | "agent" | null;
  candidateName: string;
}) {
  const userActive = speaker === "user";
  const agentActive = speaker === "agent";
  return (
    <div className="flex gap-1">
      <Pip
        active={userActive}
        label={candidateName.split(" ")[0] || "You"}
        tone="brand"
      />
      <Pip active={agentActive} label="Interviewer" tone="mint" />
    </div>
  );
}

function Pip({
  active,
  label,
  tone,
}: {
  active: boolean;
  label: string;
  tone: "brand" | "mint";
}) {
  const dotColor = tone === "brand" ? "bg-[var(--color-brand)]" : "bg-[var(--color-mint)]";
  const activeBg =
    tone === "brand"
      ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]"
      : "border-emerald-300 bg-emerald-50 text-emerald-700";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
        active ? activeBg : "border-slate-200 bg-white/40 text-slate-400",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? dotColor : "bg-slate-300", active && "animate-pulse")} />
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium capitalize text-slate-900">{value}</dd>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// keep MicOff in graph (lint hint) — used optionally if we surface a mic-muted state in future
void MicOff;
