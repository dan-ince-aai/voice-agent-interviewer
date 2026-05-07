import { NextResponse } from "next/server";

/**
 * Mint a short-lived temporary token for the browser to connect to the Voice
 * Agent API. The API key never leaves the server.
 *
 * See https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration
 */
export async function POST() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const host = process.env.ASSEMBLYAI_TOKEN_HOST ?? "https://agents.assemblyai.com";
  const url = new URL("/v3/token", host);
  // 5-minute token; session can run up to 1 hour after connect.
  url.searchParams.set("expires_in_seconds", "300");
  url.searchParams.set("max_session_duration_seconds", "3600");

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { error: `Token issuer returned ${upstream.status}`, detail },
        { status: upstream.status },
      );
    }

    const data = (await upstream.json()) as { token: string; expires_in_seconds?: number };
    return NextResponse.json({
      token: data.token,
      expiresInSeconds: data.expires_in_seconds ?? 300,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach token issuer", detail: String(err) },
      { status: 502 },
    );
  }
}
