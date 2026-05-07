import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/cn";
import type { EvaluationRecord } from "@/lib/interview";

export function Scorecard({
  evaluations,
  topics,
}: {
  evaluations: EvaluationRecord[];
  topics: string[];
}) {
  const byTopic = new Map<string, EvaluationRecord>();
  evaluations.forEach((e) => byTopic.set(e.topic, e));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live scorecard</h3>
        <span className="text-xs text-slate-400">
          {evaluations.length} / {topics.length}
        </span>
      </div>

      <ul className="space-y-2">
        {topics.map((topic) => {
          const e = byTopic.get(topic);
          return (
            <li
              key={topic}
              className={cn(
                "rounded-[12px] border px-3 py-2.5 transition",
                e
                  ? "border-emerald-100 bg-emerald-50/60"
                  : "border-slate-200/70 bg-white/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-slate-900">{topic}</span>
                {e ? (
                  <ScoreBadge score={e.score} />
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">pending</span>
                )}
              </div>
              {e && <p className="mt-1.5 text-xs text-slate-600">{e.note}</p>}
            </li>
          );
        })}
      </ul>

      {/* Topics evaluated that weren't on the original list (defensive) */}
      {evaluations
        .filter((e) => !topics.includes(e.topic))
        .map((e) => (
          <div key={e.topic} className="rounded-[12px] border border-amber-100 bg-amber-50/50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-slate-900">{e.topic}</span>
              <ScoreBadge score={e.score} />
            </div>
            <p className="mt-1.5 text-xs text-slate-600">{e.note}</p>
          </div>
        ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 4
      ? "bg-emerald-100 text-emerald-700"
      : score >= 3
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tone)}>
      <CheckCircle2 className="h-3 w-3" />
      {score}/5
    </span>
  );
}
