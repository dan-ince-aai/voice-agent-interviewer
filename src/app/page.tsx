import { Sparkles } from "lucide-react";

import { Header } from "@/components/Header";
import { SetupForm } from "@/components/SetupForm";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header subtitle="Configure your interview" />

      <section className="mx-auto max-w-6xl px-6 pb-6 pt-10 sm:pt-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
            <Sparkles className="h-3 w-3 text-[var(--color-brand)]" />
            Powered by AssemblyAI Voice Agent API
          </span>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Get interviewed by an AI that actually listens.
          </h1>
          <p className="mt-4 text-balance text-base text-slate-600 sm:text-lg">
            A real-time voice interviewer with proper turn-taking, scoring, and structured feedback.
            Set the role, pick a voice, talk for 20 minutes.
          </p>
        </div>

        <SetupForm />
      </section>

      <footer className="px-6 pb-12 pt-6 text-center text-xs text-slate-400">
        Built with Next.js · Voice Agent API ·{" "}
        <a
          href="https://www.assemblyai.com/docs/voice-agents/voice-agent-api"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          Read the docs
        </a>
      </footer>
    </main>
  );
}
