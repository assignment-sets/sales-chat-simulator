# saleschat

Interactive sales chat simulator powered by Next.js, Supabase, and Groq LLMs. Reps practice sales conversations with an AI lead who evaluates objection handling, responds with conversational pacing, and delivers realistic multi-message interactions.

## Features

- **Realistic Conversation Flow**: Typing cadence delay, debounced multi-message bursts, and typing-aware turn settlement.
- **AI Personas**: Lead persona simulation with objections, qualifying questions, and contextual responses.
- **Turn Feedback**: Real-time evaluation of sales rep responses with scoring and critique.
- **Full Chat Persistence**: Supabase authentication, session history, pagination, and transcripts export.

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router)
- **UI**: React 19, Tailwind CSS v4, Lucide Icons, Sonner
- **Database & Auth**: Supabase (@supabase/ssr)
- **AI Inference**: Groq SDK

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- A Groq API key

### 1. Clone & Install

```bash
git clone https://github.com/assignment-sets/saleschat.git
cd saleschat
npm install
```

### 2. Environment Variables

Create a `.env.local` or `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=qwen/qwen3.8-27b
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
```

Optional AI guardrail settings:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `GROQ_TIMEOUT_MS` | `30000` | Client-level timeout for a single Groq attempt |
| `GROQ_MAX_RETRIES` | `1` | SDK retries per call (each retry can cost another generation) |
| `GROQ_INPUT_PRICE_PER_MTOK` | `0` | Input price per 1M tokens, used only for the spend estimate column |
| `GROQ_OUTPUT_PRICE_PER_MTOK` | `0` | Output price per 1M tokens, used only for the spend estimate column |
| `AI_CEILING_DISABLED` | unset | Set to `true` to bypass the monthly per-org AI usage ceiling (load tests only) |

### 3. Database Setup

Apply the SQL migrations located in `supabase/migrations/` to your Supabase project:

```bash
npx supabase db push
# or run the SQL files directly in the Supabase SQL editor
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Scripts

- `npm run dev`: Start local development server with Turbopack.
- `npm run build`: Build production bundle.
- `npm run start`: Run production server.
- `npm run lint`: Run Oxlint checks.

## License

[MIT](LICENSE)
