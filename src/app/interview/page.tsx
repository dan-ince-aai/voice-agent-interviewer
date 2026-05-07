"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Header } from "@/components/Header";
import { InterviewSession } from "@/components/InterviewSession";
import type { InterviewSetup } from "@/lib/interview";

const STORAGE_KEY = "voice-agent-interviewer.setup";

export default function InterviewPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<InterviewSetup | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setMissing(true);
        return;
      }
      setSetup(JSON.parse(raw) as InterviewSetup);
    } catch {
      setMissing(true);
    }
  }, []);

  useEffect(() => {
    if (missing) {
      const t = setTimeout(() => router.replace("/"), 1500);
      return () => clearTimeout(t);
    }
  }, [missing, router]);

  if (missing) {
    return (
      <main className="min-h-screen">
        <Header subtitle="Interview" />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No interview configured</h2>
          <p className="mt-2 text-sm text-slate-600">Redirecting you back to setup…</p>
        </div>
      </main>
    );
  }

  if (!setup) {
    return (
      <main className="min-h-screen">
        <Header subtitle="Loading" />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-brand)]" />
        </div>
      </main>
    );
  }

  return <InterviewSession setup={setup} />;
}
