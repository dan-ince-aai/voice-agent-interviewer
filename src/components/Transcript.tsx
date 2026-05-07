"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import type { ConversationItem } from "@/hooks/useVoiceAgent";

interface Props {
  messages: ConversationItem[];
  partialUser: string;
  candidateName: string;
}

export function Transcript({ messages, partialUser, candidateName }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, partialUser]);

  if (messages.length === 0 && !partialUser) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
        The transcript will appear here as you talk.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      {messages.map((m) => (
        <Bubble key={m.id} role={m.role} interrupted={m.interrupted} candidateName={candidateName}>
          {m.text}
        </Bubble>
      ))}
      {partialUser && (
        <Bubble role="user" candidateName={candidateName} partial>
          {partialUser}
        </Bubble>
      )}
    </div>
  );
}

function Bubble({
  role,
  interrupted,
  partial,
  candidateName,
  children,
}: {
  role: "user" | "agent";
  interrupted?: boolean;
  partial?: boolean;
  candidateName: string;
  children: React.ReactNode;
}) {
  const userLabel = candidateName.split(" ")[0] || "You";
  const isUser = role === "user";
  return (
    <div className={cn("flex max-w-[88%] flex-col gap-1", isUser ? "self-end items-end" : "self-start items-start")}>
      <span
        className={cn(
          "px-1 text-[10px] font-semibold uppercase tracking-wider",
          isUser ? "text-[var(--color-brand)]" : "text-[var(--color-mint)]",
        )}
      >
        {isUser ? userLabel : "Interviewer"}
        {interrupted && <span className="ml-1.5 text-[10px] font-medium normal-case text-amber-600">interrupted</span>}
      </span>
      <div
        className={cn(
          "rounded-[14px] px-4 py-2.5 text-[15px] leading-relaxed",
          isUser
            ? "bg-[var(--color-brand-soft)] text-slate-900"
            : "border border-emerald-100 bg-emerald-50/60 text-slate-900",
          partial && "opacity-70",
        )}
      >
        {children}
        {partial && <span className="ml-1 inline-block animate-pulse text-slate-400">…</span>}
      </div>
    </div>
  );
}
