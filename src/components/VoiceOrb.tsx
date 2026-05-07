"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

interface VoiceOrbProps {
  speaker: "user" | "agent" | null;
  level: number; // 0..1, RMS-style
  size?: number;
}

/**
 * Animated voice orb. Draws three layered glow rings:
 *   - Outer ring scales softly with audio level (breathing-style).
 *   - Middle ring tints based on who's currently speaking.
 *   - Inner core has a subtle constant pulse.
 *
 * Uses `requestAnimationFrame` to smooth raw RMS into a nicer envelope.
 */
export function VoiceOrb({ speaker, level, size = 220 }: VoiceOrbProps) {
  const ringOuter = useRef<HTMLDivElement>(null);
  const ringMid = useRef<HTMLDivElement>(null);
  const smoothed = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      // Smooth envelope: attack fast, decay slow.
      const target = Math.min(1, level * 5);
      const cur = smoothed.current;
      smoothed.current = cur + (target - cur) * (target > cur ? 0.4 : 0.08);

      const v = smoothed.current;
      const outerScale = 1 + v * 0.18;
      const midScale = 1 + v * 0.1;

      if (ringOuter.current) {
        ringOuter.current.style.transform = `scale(${outerScale})`;
        ringOuter.current.style.opacity = `${0.35 + v * 0.45}`;
      }
      if (ringMid.current) {
        ringMid.current.style.transform = `scale(${midScale})`;
      }

      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [level]);

  const tint =
    speaker === "user" ? "var(--color-brand)" : speaker === "agent" ? "var(--color-mint)" : "#94a3b8";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={
        speaker === "user" ? "You are speaking" : speaker === "agent" ? "Interviewer is speaking" : "Idle"
      }
      role="status"
    >
      {/* outer breathing glow */}
      <div
        ref={ringOuter}
        className="pointer-events-none absolute inset-0 rounded-full transition-[background] duration-300"
        style={{
          background: `radial-gradient(circle at center, ${tint} 0%, transparent 65%)`,
          filter: "blur(20px)",
        }}
      />
      {/* mid ring */}
      <div
        ref={ringMid}
        className="absolute inset-6 rounded-full border border-white/40 transition-all duration-200"
        style={{
          background: `linear-gradient(135deg, ${tint}30, ${tint}10)`,
          boxShadow: `0 0 0 1px ${tint}40 inset, 0 20px 40px -10px ${tint}55`,
        }}
      />
      {/* core */}
      <div
        className="absolute inset-12 rounded-full bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        style={{ animation: "orb-pulse 3.2s ease-in-out infinite" }}
      />
      <div
        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors"
        style={{ background: tint }}
      >
        {speaker === "user" ? <MicIcon /> : speaker === "agent" ? <SpeakerIcon /> : <DotsIcon />}
      </div>

      <style jsx>{`
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.96); opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="10" rx="3" />
      <path d="M5 10v1a7 7 0 0014 0v-1" />
      <path d="M12 18v4" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}
