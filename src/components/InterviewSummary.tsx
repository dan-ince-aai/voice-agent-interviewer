import { ArrowRight, CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  type EvaluationRecord,
  type InterviewSummary as InterviewSummaryT,
  RECOMMENDATION_LABELS,
} from "@/lib/interview";

const RECOMMENDATION_TONE: Record<InterviewSummaryT["recommendation"], string> = {
  strong_hire: "border-emerald-200 bg-emerald-50 text-emerald-800",
  hire: "border-emerald-200 bg-emerald-50 text-emerald-800",
  lean_hire: "border-blue-200 bg-blue-50 text-blue-800",
  lean_no_hire: "border-amber-200 bg-amber-50 text-amber-800",
  no_hire: "border-rose-200 bg-rose-50 text-rose-800",
};

export function InterviewSummary({
  summary,
  evaluations,
  candidateName,
  durationSeconds,
  onRestart,
}: {
  summary: InterviewSummaryT;
  evaluations: EvaluationRecord[];
  candidateName: string;
  durationSeconds: number;
  onRestart: () => void;
}) {
  const avg =
    evaluations.length > 0
      ? evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center text-center">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Interview complete
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Feedback for {candidateName}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {formatDuration(durationSeconds)} · {evaluations.length} topics scored
          {avg != null && ` · avg ${avg.toFixed(1)}/5`}
        </p>
      </header>

      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3",
          RECOMMENDATION_TONE[summary.recommendation],
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Recommendation</span>
        <span className="text-base font-semibold">{RECOMMENDATION_LABELS[summary.recommendation]}</span>
      </div>

      <Section title="Overall">
        <p className="text-[15px] leading-relaxed text-slate-700">{summary.overall_assessment}</p>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Strengths" icon={<ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />}>
          <BulletList items={summary.key_strengths} tone="emerald" />
        </Section>
        <Section title="Areas to grow" icon={<ThumbsDown className="h-3.5 w-3.5 text-amber-600" />}>
          <BulletList items={summary.areas_for_improvement} tone="amber" />
        </Section>
      </div>

      {evaluations.length > 0 && (
        <Section title="Per-topic scores">
          <ul className="space-y-2">
            {evaluations.map((e) => (
              <li
                key={e.topic + e.recordedAt}
                className="rounded-[12px] border border-slate-200 bg-white/70 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900">{e.topic}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      e.score >= 4
                        ? "bg-emerald-100 text-emerald-700"
                        : e.score >= 3
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {e.score}/5
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{e.note}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="focus-ring group flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-brand)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(54,77,234,0.3),0_8px_24px_-8px_rgba(54,77,234,0.4)] transition hover:bg-[var(--color-brand-dark)]"
      >
        Start a new interview
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "emerald" | "amber" }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">—</p>;
  }
  const dot = tone === "emerald" ? "bg-emerald-400" : "bg-amber-400";
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-700">
          <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}
