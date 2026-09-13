# AskBusi - AI Opportunity Finder

A functional, general-purpose AI discovery application. Users describe any business workflow; a live AI consultant extracts context, chooses its next question, and decides when the evidence supports recommendations. There are no seeded businesses, canned model answers, or industry-based recommendation branches.

## Prerequisites and installation

- Node.js 22.13+ (Node 24 recommended) and npm. SQLite uses Node's built-in `node:sqlite`; some Node versions print an experimental warning.
- OpenAI developer account, API billing/quota, and access to the configured model. A ChatGPT subscription does not supply this application's API key.

In PowerShell:

```powershell
cd "C:\Users\krask071\Hackathon 2\SMSU-Hackathon"
npm install
Copy-Item server/.env.example server/.env
notepad server/.env
```

Create an API key in the [OpenAI developer platform](https://platform.openai.com/api-keys). Paste it only into `server/.env`, replacing the placeholder:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.6-luna
OPENAI_ANALYSIS_MODEL=gpt-5.6-luna
PORT=3001
```

`OPENAI_MODEL` controls the interactive interview and discussion; optional `OPENAI_ANALYSIS_MODEL` controls generation and explicit reanalysis and falls back to `OPENAI_MODEL`. GPT-5.6 Luna is the default cost-oriented option, verified against the [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Model availability depends on your account. Restart the backend after changing configuration. Do not use `VITE_OPENAI_API_KEY` or put keys in client code. `.env` and SQLite files are ignored by Git.

## Run locally

Both services from the repository root:

```powershell
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to port 3001.

Or use two terminals, both in the repository root:

```powershell
# Terminal 1: backend
npm run dev -w server
```

```powershell
# Terminal 2: frontend
npm run dev -w client
```

Production-style local build and server:

```powershell
npm run build
npm start
```

Open **http://127.0.0.1:3001**; Express serves the compiled frontend. If changing the API port during development, also update the target in `client/vite.config.js`.

## Deploy to Vercel

This repository includes a Vercel function entrypoint at `api/index.js`. In Vercel, create a project from this repository with the project root set to `SMSU-Hackathon`. The included `vercel.json` sets the build command and routes `/api/*` requests to the Express function.

Add these environment variables in the Vercel project settings for Production, Preview, and Development as needed:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=your_model
GEMINI_ANALYSIS_MODEL=your_analysis_model
```

`GEMINI_API_KEY` is server-only. Do not prefix it with `VITE_`, put it in client code, or commit it. Vercel exposes environment variables to the function, not to the browser, unless the variable is explicitly bundled into the client build.

The Vercel function currently uses `/tmp/analyses.sqlite`, which is writable but ephemeral. Sessions can disappear when Vercel starts a new function instance, and concurrent instances do not share the same database. Use a hosted database and replace `createStore` with a network-backed store before using this for persistent user data. The local SQLite store remains suitable for local development and tests.

## Architecture and request flow

```text
Browser / React + Vite
    → HTTP JSON / Express
    → server-owned SQLite session
    → OpenAI official JavaScript SDK / Responses API
    → strict structured output + Zod validation
    → deterministic scoring + SQLite commit
    → React profile, conversation and dashboard
```

**Interview:** Start Analysis creates a random session ID and saves it in browser localStorage. A free-form message goes from `ChatPanel.jsx` through `services/api.js` to `POST /api/interview`. Express validates the message and IDs, loads the server-owned history and profile, and calls `runBusinessInterview`. The model receives the accumulated context and the new message. `responses.parse` uses `zodTextFormat` as documented in [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Validated output updates the profile, important unknowns, evidence-based readiness and completion status. Only then is the turn committed. No fixed question list or message counter determines readiness. The initial greeting is static UI copy; every substantive response comes from OpenAI.

**Generation:** When the model marks the interview complete, the user can generate a map or continue the interview. `POST /api/recommendations` loads authoritative server context and makes a separate model request. The model returns up to five complete opportunities, including conventional automation when appropriate. Zod validates all fields and 0–10 ratings. JavaScript assigns IDs, computes scores, sorts opportunities, and saves the map. The client displays cards, a responsive impact/effort matrix, complete details, workflow steps, assumptions and pilot plans. The browser never supplies trusted profile or recommendation objects.

**Discussion and reanalysis:** The selected recommendation, all other recommendations, original interview, updated profile and discussions are sent with each follow-up. The model may return a complete replacement recommendation and change reason. The server recalculates its score, preserves its ID, records previous/new score, complexity and risk, and reranks the map. Changes affecting other opportunities flag the map as stale. Refreshing the map regenerates all recommendations with current context and new IDs; earlier discussion remains in server history. Explicit reanalysis uses the analysis model.

## State, privacy and request safety

- SQLite at `server/data/analyses.sqlite` stores full profile, history, recommendations, changes and processed request IDs. Browser localStorage stores only the session ID. Refreshes and backend restarts retain analyses.
- Sessions have unguessable UUIDs. Their IDs are bearer access tokens, not user authentication. Do not share them. There is no session listing endpoint.
- Responses use `store:false`; this application explicitly sends its stored state on each call instead of relying on previous-response IDs. This does not replace OpenAI's applicable API data policies.
- API keys stay on the server. React renders text, not raw AI HTML. Request bodies have a 32 KB limit; messages are capped at 12,000 characters. Helmet and a basic per-IP rate limit are enabled.
- One mutation per session runs at a time. Reusing a completed request ID returns saved state without another model call. Failed turns are not committed. The UI retains unsent text after failures.
- No sensitive conversation text or keys are logged. SQLite content is unencrypted; protect local disk access. The visible reminder asks users not to submit secrets. Submitted business context is sent to OpenAI.
- Export downloads the current analysis as JSON, including conversation history. New Analysis creates another session without deleting the previous one.

## Opportunity score

Implemented in `server/utils/scoring.js`, with editable `WEIGHTS`:

```text
weighted = impact×0.35 + timeSavingPotential×0.20
         + repetition×0.15 + dataReadiness×0.15
         − implementationComplexity×0.08 − risk×0.07
score = round((weighted + 1.5) × 10)
```

The weighted range is −1.5 to 8.5, normalized to 0–100. Higher is better. Ties sort by title. Ratings are model judgments; the final ranking is deterministic. Numeric savings require a stated basis, and unknown savings display “Insufficient information to estimate.” Predictions and hypothetical reductions need pilot validation.

## Project structure

```text
SMSU-Hackathon/
├── package.json                 # workspace scripts
├── package-lock.json
├── .gitignore
├── README.md
├── client/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # landing, interview, results and navigation
│       ├── styles.css
│       ├── services/api.js
│       └── components/
│           ├── BusinessProfile.jsx
│           ├── ChatPanel.jsx
│           ├── ImpactEffortChart.jsx
│           └── RecommendationDetail.jsx
└── server/
    ├── package.json
    ├── .env.example
    ├── server.js                # environment and local listener
    ├── app.js                   # validated API routes
    ├── store.js                 # SQLite persistence
    ├── services/openaiService.js
    ├── prompts/
    │   ├── interviewer.js
    │   └── recommendationAnalyst.js
    ├── utils/
    │   ├── validation.js        # strict structured response schemas
    │   └── scoring.js
    └── test/app.test.js
```

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend availability and key configuration status |
| POST | `/api/session` | Create saved analysis; body `{}` |
| GET | `/api/session/:id` | Restore analysis |
| POST | `/api/interview` | Submit message |
| POST | `/api/recommendations` | Generate or refresh map |
| POST | `/api/recommendations/:id/chat` | Discuss selected recommendation |
| POST | `/api/recommendations/:id/reanalyze` | Explicitly reassess selected recommendation |

Mutation bodies contain `sessionId` and unique UUID `requestId`. Interview/chat/reanalysis also require `message`. Error responses use `{ "error": "Helpful message" }`. Per-session concurrent requests return 409; completed duplicate request IDs are idempotent.

## Verification

```powershell
npm test
npm run build
```

Tests use isolated injected AI fixtures only in the test file: scoring boundaries, ranking, malformed ratings, missing-key behavior, session persistence through requests, error rollback, idempotency, concurrent request rejection, recommendation replacement and conventional automation support. Runtime has no mock mode.

For live acceptance testing after configuring your key: describe a business not listed in the brief; include department and volume in the first message; verify those are extracted and not asked again; complete the adaptive interview; generate a map; open a recommendation; add a constraint; inspect change history and refresh the map if flagged; reload to verify persistence. Also test a deterministic workflow where AI is unnecessary. Model behavior must be checked with live calls; automated fixtures do not establish the quality of model reasoning.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| OpenAI not configured | Create `server/.env`, replace the placeholder, restart backend. |
| Authentication / 401 | Check the backend key is valid and belongs to the intended project. |
| Rate limit / 429 | Check API credits, project limits and billing; wait before retrying. |
| Invalid model / rejected request | Check account access, model ID, and structured-output support. |
| Network error | Check backend internet connectivity to OpenAI. |
| Timeout | Model requests stop at 90 seconds. Reload saved analysis before retrying a browser timeout. |
| Invalid structured response / refusal | Retry or rephrase. Existing saved state is preserved. |
| Server unavailable | Start both services; verify `/api/health` and proxy port. |
| Session not found | Database may have been removed; start a new analysis. |
| Request already running / 409 | Wait for the existing turn to finish. |
| Node SQLite import error | Upgrade to Node 22.13+ or Node 24. |
| Port already in use | Stop the other process or configure another port and Vite proxy. |
| npm offline cache error | Use an internet-enabled terminal and `npm install --offline=false`. |

## Hackathon limitations

Designed for local use; Express binds to loopback. No account authentication, enterprise integrations, encrypted database, automatic retention cleanup, distributed concurrency lock or streaming responses. Do not expose the API publicly without authentication, authorization and stronger deployment controls. Full history is sent each turn, so cost/context grows; sessions cap at 160 history entries. API generation can take tens of seconds. Google Fonts is optional; system sans-serif works offline. Charts and workflow descriptions are advisory, not integrations or executable systems. AI estimates and judgments are not guaranteed facts. Live end-to-end model verification requires your own configured API key and billing; no key is bundled.



