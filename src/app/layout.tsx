import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Interviewer · Voice Agent API demo",
  description:
    "A real-time voice interviewer demo built on AssemblyAI's Voice Agent API. Configure the role, pick a voice, and have a conversation.",
  openGraph: {
    title: "AI Interviewer · Voice Agent API demo",
    description: "Real-time voice interviewer powered by AssemblyAI.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#364dea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
