"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, X } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  buildGreeting,
  COMMON_TOPICS,
  DIFFICULTY_LABELS,
  type Difficulty,
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_VOICES,
  type InterviewSetup,
  type InterviewType,
} from "@/lib/interview";

const STORAGE_KEY = "voice-agent-interviewer.setup";

const DIFFICULTIES: Difficulty[] = ["junior", "mid", "senior", "staff"];
const INTERVIEW_TYPES: InterviewType[] = ["screening", "behavioral", "skills", "mixed"];
const DURATIONS = [15, 20, 30, 45];

interface FormState {
  candidateName: string;
  role: string;
  company: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
  topics: string[];
  durationMinutes: number;
  voice: string;
  greeting: string;
}

const defaultState: FormState = {
  candidateName: "",
  role: "",
  company: "",
  interviewType: "mixed",
  difficulty: "mid",
  topics: [],
  durationMinutes: 20,
  voice: "ivy",
  greeting: "",
};

export function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultState);
  const [topicInput, setTopicInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const suggestedTopics = useMemo(() => COMMON_TOPICS[form.interviewType], [form.interviewType]);

  // Live preview of the auto-generated greeting — shown as the textarea
  // placeholder so the user can see what'll be used if they leave it blank.
  const greetingPreview = useMemo(() => {
    if (!form.candidateName.trim() || !form.role.trim()) return "";
    return buildGreeting({
      candidateName: form.candidateName.trim(),
      role: form.role.trim(),
      company: form.company.trim() || undefined,
      interviewType: form.interviewType,
      difficulty: form.difficulty,
      topics: form.topics,
      durationMinutes: form.durationMinutes,
      voice: form.voice,
    });
  }, [
    form.candidateName,
    form.role,
    form.company,
    form.interviewType,
    form.difficulty,
    form.topics,
    form.durationMinutes,
    form.voice,
  ]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addTopic(topic: string) {
    const trimmed = topic.trim();
    if (!trimmed) return;
    if (form.topics.includes(trimmed)) return;
    update("topics", [...form.topics, trimmed]);
  }

  function removeTopic(topic: string) {
    update("topics", form.topics.filter((t) => t !== topic));
  }

  const isValid =
    form.candidateName.trim().length > 0 &&
    form.role.trim().length > 0 &&
    form.topics.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);

    const setup: InterviewSetup = {
      candidateName: form.candidateName.trim(),
      role: form.role.trim(),
      company: form.company.trim() || undefined,
      interviewType: form.interviewType,
      difficulty: form.difficulty,
      topics: form.topics,
      durationMinutes: form.durationMinutes,
      voice: form.voice,
      greeting: form.greeting.trim() || undefined,
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
      router.push("/interview");
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass mx-auto max-w-2xl space-y-7 rounded-[20px] border border-slate-200/70 p-7 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-30px_rgba(15,23,42,0.18)]"
    >
      <SectionHeader index={1} title="About the candidate" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Candidate name" required>
          <Input
            value={form.candidateName}
            placeholder="Jordan Kim"
            onChange={(v) => update("candidateName", v)}
            autoFocus
          />
        </Field>
        <Field label="Role" required>
          <Input
            value={form.role}
            placeholder="Customer Service Representative"
            onChange={(v) => update("role", v)}
          />
        </Field>
        <Field label="Company" hint="optional">
          <Input
            value={form.company}
            placeholder="Acme Health"
            onChange={(v) => update("company", v)}
          />
        </Field>
        <Field label="Seniority">
          <select
            className="focus-ring w-full appearance-none rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
            value={form.difficulty}
            onChange={(e) => update("difficulty", e.target.value as Difficulty)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Divider />

      <SectionHeader index={2} title="Interview style" />
      <div className="space-y-3">
        <Label>Format</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INTERVIEW_TYPES.map((t) => (
            <ChoicePill
              key={t}
              active={form.interviewType === t}
              onClick={() => update("interviewType", t)}
            >
              {INTERVIEW_TYPE_LABELS[t]}
            </ChoicePill>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Topics to cover</Label>
          <span className="text-xs text-slate-400">
            {form.topics.length} {form.topics.length === 1 ? "topic" : "topics"}
          </span>
        </div>

        {form.topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.topics.map((topic) => (
              <Chip key={topic} onRemove={() => removeTopic(topic)}>
                {topic}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={topicInput}
            placeholder="Add a topic — e.g. database design"
            onChange={setTopicInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic(topicInput);
                setTopicInput("");
              }
            }}
          />
          <button
            type="button"
            disabled={topicInput.trim().length === 0}
            onClick={() => {
              addTopic(topicInput);
              setTopicInput("");
            }}
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="space-y-2 pt-1">
          <p className="text-xs text-slate-400">Suggested for {INTERVIEW_TYPE_LABELS[form.interviewType].toLowerCase()}:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTopics
              .filter((t) => !form.topics.includes(t))
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTopic(t)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  + {t}
                </button>
              ))}
          </div>
        </div>
      </div>

      <Divider />

      <SectionHeader index={3} title="Voice and pacing" />
      <div className="space-y-3">
        <Label>Interviewer voice</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INTERVIEW_VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => update("voice", v.id)}
              className={cn(
                "focus-ring rounded-[10px] border bg-white px-3 py-2.5 text-left transition",
                form.voice === v.id
                  ? "border-[var(--color-brand)] ring-brand"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <div className="text-sm font-semibold text-slate-900 capitalize">{v.label}</div>
              <div className="text-xs text-slate-500">{v.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Length</Label>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((d) => (
            <ChoicePill
              key={d}
              active={form.durationMinutes === d}
              onClick={() => update("durationMinutes", d)}
            >
              {d} min
            </ChoicePill>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label hint="optional — what the agent says first">Greeting</Label>
        <textarea
          className="focus-ring w-full resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300"
          rows={2}
          value={form.greeting}
          placeholder={greetingPreview || "Hi {name}, thanks for jumping on…"}
          onChange={(e) => update("greeting", e.target.value)}
        />
        {form.greeting.trim().length === 0 && greetingPreview && (
          <p className="text-xs text-slate-400">
            We&apos;ll auto-generate this from the role and candidate name if you leave it blank.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="focus-ring group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[12px] bg-[var(--color-brand)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(54,77,234,0.3),0_8px_24px_-8px_rgba(54,77,234,0.4)] transition hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start interview
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>

      <p className="text-center text-xs text-slate-400">
        We&apos;ll request mic access on the next screen. Audio stays between your browser and AssemblyAI.
      </p>
    </form>
  );
}

// ---- Field primitives ----

function SectionHeader({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
        style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}
      >
        {index}
      </span>
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-slate-200/60" aria-hidden />;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label hint={hint} required={required}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function Label({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
      {children}
      {required && <span className="text-coral">*</span>}
      {hint && <span className="text-[10px] uppercase tracking-wide text-slate-400">{hint}</span>}
    </label>
  );
}

function Input({
  value,
  placeholder,
  onChange,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      className="focus-ring w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
    />
  );
}

function ChoicePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring rounded-[10px] border px-3 py-2.5 text-sm font-medium transition",
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-brand"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
