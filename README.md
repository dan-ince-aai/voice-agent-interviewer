# AI Interviewer

A real-time voice interviewer demo built on [AssemblyAI's Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api). Configure the role, pick a voice, and have a 20-minute conversation. The agent asks questions, scores answers as it goes, and ends with a structured hire/no-hire recommendation.

![AI Interviewer setup screen](./.github/assets/setup.png)

## What it shows

- **Server-side temp tokens** — your API key never leaves the server. The browser fetches a 5-minute scoped token before opening the WebSocket.
- **AudioWorklet capture** — mic audio is encoded to PCM16 off the main thread.
- **Scheduled playback** — agent audio chunks are scheduled via `AudioBufferSourceNode.start(t)` for seamless concatenation, with instant flush on barge-in.
- **Tool calling for live state** — the interviewer calls `record_evaluation` after each answer (live scorecard updates) and `end_interview` to wrap up with structured feedback.
- **Conservative turn detection** — `min_silence: 1500ms`, `max_silence: 4000ms` so the agent doesn't cut you off while you're thinking.
- **Gated tool-result delivery** — tool results are buffered and only sent when both the agent and user are silent. Sending mid-reply drops the in-flight reply.

## Stack

- **Next.js 15** (App Router) + React 19
- **TypeScript** strict
- **Tailwind CSS v4**
- **lucide-react** icons
- **Vercel-ready** — `vercel deploy` Just Works

No backend other than a single `/api/token` route.

## Quick start

### 1. Get an AssemblyAI API key

Grab one at [assemblyai.com/app](https://www.assemblyai.com/app). Voice Agent API access required.

### 2. Install and configure

```bash
git clone https://github.com/dan-ince-aai/voice-agent-interviewer
cd voice-agent-interviewer
npm install
cp .env.example .env.local
```

Open `.env.local` and add your key:

```
ASSEMBLYAI_API_KEY=your-key-here
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), fill in the form, click Start.

## Architecture

```
┌─────────────┐       POST /api/token       ┌─────────────┐
│   Browser   │ ──────────────────────────► │  Next.js    │
│             │ ◄────── { token } ─────────│  /api/token │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │   wss://agents.assemblyai.com              │  authorization: Bearer <key>
       │   /v1/ws?token=<temp_token>                │   GET  /v3/token
       ▼                                            ▼
┌────────────────────────────────────────────────────────────┐
│                  AssemblyAI Voice Agent API                │
└────────────────────────────────────────────────────────────┘
```

- The browser only ever sees the temporary token. The API key stays in the Node runtime.
- Tokens expire in 5 minutes; the session itself can run up to an hour after connect.

## Code map

```
src/
├── app/
│   ├── api/token/route.ts       # mints temp tokens server-side
│   ├── page.tsx                 # landing — setup form
│   ├── interview/page.tsx       # interview screen
│   └── layout.tsx
├── components/
│   ├── SetupForm.tsx
│   ├── InterviewSession.tsx     # main interview UI
│   ├── VoiceOrb.tsx             # animated speaker indicator
│   ├── Transcript.tsx
│   ├── Scorecard.tsx
│   └── InterviewSummary.tsx
├── hooks/
│   └── useVoiceAgent.ts         # React hook around the client
└── lib/
    ├── voice-agent-client.ts    # WebSocket + audio I/O
    ├── voice-agent-events.ts    # typed event definitions
    ├── interview.ts             # prompt builder + tools
    └── cn.ts                    # Tailwind className helper
```

The interesting files:

- **`voice-agent-client.ts`** — the protocol implementation. WebSocket lifecycle, AudioWorklet capture, scheduled playback, gated tool-result delivery.
- **`interview.ts`** — `buildInterviewerPrompt()` constructs the system prompt from the setup form. Tools `record_evaluation` and `end_interview` are defined here.
- **`api/token/route.ts`** — single Next.js route handler that proxies `GET /v3/token` with your API key.

## Customising the agent

The agent is fully prompt-driven. Edit `src/lib/interview.ts`:

- **`buildInterviewerPrompt()`** — change the persona, pacing rules, calibration guide.
- **`INTERVIEW_TOOLS`** — add tools, e.g. `request_clarification`, `pause_interview`.
- **`buildSessionConfig()`** — tweak turn detection, voice, audio format.

For deeper customisation, `voice-agent-client.ts` exposes an `onEvent` hook that fires for every server event.

## Deploying

### Vercel

```bash
vercel deploy
```

Add `ASSEMBLYAI_API_KEY` as an environment variable in your Vercel project settings.

### Self-hosted

```bash
npm run build
npm start
```

The app needs:

- Node.js 20+
- The `ASSEMBLYAI_API_KEY` env var set at runtime
- HTTPS in production (browsers require it for `getUserMedia`)

## Trade-offs and limitations

- **No persistence.** Setup form data lives in `sessionStorage`. Interview transcripts are lost on refresh. For a real product, persist conversations to a database after each turn.
- **One conversation at a time.** No queue, no scheduling, no multiple rooms. Designed as a single-user demo.
- **Browser support.** Requires a modern browser with AudioWorklet (all evergreen browsers as of 2024).
- **No reconnection logic.** If the WebSocket drops, the interview ends. The Voice Agent API supports `session.resume` within 30s — not wired up here, but easy to add.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built on the [AssemblyAI Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api). Star the repo if it helps you ship.
