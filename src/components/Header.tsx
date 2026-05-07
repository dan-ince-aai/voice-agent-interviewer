import Link from "next/link";

export function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="glass sticky top-0 z-20 border-b border-slate-200/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
        </Link>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span className="hidden text-sm text-slate-500 sm:block">{subtitle ?? "Voice Agent API demo"}</span>
        <div className="flex-1" />
        <a
          href="https://www.assemblyai.com/docs/voice-agents/voice-agent-api"
          target="_blank"
          rel="noreferrer"
          className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex"
        >
          Docs ↗
        </a>
        <a
          href="https://github.com/AssemblyAI"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-700"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
        style={{
          background: "linear-gradient(135deg, #364dea 0%, #6e85ff 100%)",
          boxShadow: "0 4px 16px rgba(54,77,234,0.35)",
        }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="10" rx="3" />
          <path d="M5 10v1a7 7 0 0014 0v-1" />
          <path d="M12 18v4" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">AI Interviewer</span>
    </span>
  );
}
