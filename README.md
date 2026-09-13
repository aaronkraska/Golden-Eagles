# AskBusi: AI Opportunity Finder

AskBusi is an AI-powered business discovery tool. It interviews users about their workflows, pain points, repetitive tasks, and constraints, then generates ranked AI and automation opportunities.

The application does not rely on hard-coded industries, canned recommendations, or prewritten interview paths. Google Gemini dynamically decides what to ask next and when enough information has been collected to generate recommendations.

## Current Deployment

```text
Browser
  |
  v
Vercel: React + Vite frontend
  |
  | /api/* rewrite
  v
Railway: Node.js + Express backend
  |
  +--> SQLite session storage
  |
  v
Google Gemini API
```

- Frontend: Vercel
- Backend: Railway
- AI model: Google Gemini 3.8 Flash
- Backend: Express 5
- Frontend: React 19 + Vite 7
- Storage: SQLite
- Validation: Zod
- Charts: Recharts

The browser only calls relative `/api/...` routes. Vercel rewrites those requests to Railway, so the Gemini API key is never exposed to the frontend.

## Features

- Adaptive AI-led business interview
- Dynamic follow-up questions based on prior answers
- AI readiness and understanding tracking
- Ranked AI and automation recommendations
- Impact-versus-effort visualization
- Recommendation details, assumptions, risks, and implementation steps
- Follow-up discussion for individual recommendations
- Recommendation reanalysis when new constraints are provided
- SQLite-backed session storage
- JSON export of analysis data
- Request validation and structured AI responses
- API rate limiting and security headers

## Prerequisites

- Node.js 22.13 or newer
- npm
- A Google Gemini API key with access to `gemini-3.8-flash`

## Local Setup

From the repository root:

```powershell
npm install
```

Create `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
GEMINI_ANALYSIS_MODEL=gemini-3.8-flash
PORT=3001
HOST=0.0.0.0
```

`GEMINI_API_KEY` is required. The model variables are optional because the backend defaults to `gemini-3.8-flash`.

Never prefix the key with `VITE_`. Vite-prefixed variables can be included in the client bundle and must not be used for secrets. Do not commit `.env`.

## Run Locally

Start both workspaces from the repository root:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to the backend on port `3001`.

To run the services separately:

```powershell
# Backend
npm run dev -w server

# Frontend, in a second terminal
npm run dev -w client
```

## Production-Style Local Run

```powershell
npm run build
npm start
```

The Express backend listens on `PORT`, or `3001` by default. The frontend is built into `client/dist`.

## Environment Variables

| Variable                | Required | Purpose                                           |
| ----------------------- | -------- | ------------------------------------------------- |
| `GEMINI_API_KEY`        | Yes      | Google Gemini API key                             |
| `GEMINI_MODEL`          | No       | Interview and discussion model                    |
| `GEMINI_ANALYSIS_MODEL` | No       | Recommendation and reanalysis model               |
| `PORT`                  | No       | Backend port; Railway supplies this in production |
| `HOST`                  | No       | Bind address; defaults to `0.0.0.0`               |

## Deploy the Backend to Railway

1. Create a Railway service from `https://github.com/aaronkraska/Golden-Eagles`.
2. Use the repository root as the service root.
3. Set the custom start command to:

   ```text
   npm start
   ```

4. Add these variables under **Service > Variables**:

   ```env
   GEMINI_API_KEY=your_actual_key
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_ANALYSIS_MODEL=gemini-3.8-flash
   ```

   Railway provides `PORT`; do not hard-code the production port.

5. Generate a public domain under **Settings > Networking**.
6. Verify the backend:

   ```text
   https://YOUR-RAILWAY-DOMAIN/api/health
   ```

   A configured backend returns:

   ```json
   { "ok": true, "configured": true }
   ```

If `configured` is `false`, Railway does not have a valid `GEMINI_API_KEY`. Redeploy after changing environment variables.

### SQLite on Railway

Session data is stored in `server/data/analyses.sqlite`. Railway's normal filesystem is ephemeral, so a redeploy can remove the database.

For hackathon testing this may be acceptable. To preserve local SQLite data, attach a Railway Volume mounted at:

```text
/app/server/data
```

A hosted database such as PostgreSQL is a better long-term option for multiple backend instances.

## Deploy the Frontend to Vercel

Vercel hosts the React/Vite frontend. The project root is the repository root; do not set it to `SMSU-Hackathon`, `client`, or `server`.

Use these project settings:

| Setting          | Value           |
| ---------------- | --------------- |
| Root Directory   | Blank or `.`    |
| Install Command  | `npm install`   |
| Build Command    | `npm run build` |
| Output Directory | `client/dist`   |

The repository's `vercel.json` rewrites API calls to Railway:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RAILWAY-DOMAIN/api/:path*"
    }
  ]
}
```

Replace `YOUR-RAILWAY-DOMAIN` with the actual Railway domain. Do not add a Vercel Function runtime block. Railway hosts the backend, so Vercel does not need to run `api/index.js`.

## Architecture and Request Flow

```text
React UI
  |
  | fetch("/api/...")
  v
Vercel rewrite
  |
  v
Railway Express API
  |
  +--> Request validation
  +--> SQLite session lookup
  +--> Gemini structured response
  +--> Deterministic opportunity scoring
  +--> SQLite save
  |
  v
JSON response to React
```

### Interview Flow

1. The user starts a new analysis.
2. The backend creates a UUID session.
3. The user describes a workflow or business problem.
4. `POST /api/interview` sends the stored context and new message to Gemini.
5. Gemini returns structured JSON containing the response, business context, missing information, understanding score, and completion state.
6. Zod validates the response before the server saves the turn.

The interview is adaptive. It does not use a fixed list of questions or a fixed turn count.

### Recommendation Flow

1. `POST /api/recommendations` loads the stored session.
2. Gemini generates AI and conventional automation opportunities.
3. Zod validates the structured response.
4. JavaScript calculates deterministic opportunity scores.
5. Recommendations are ranked and saved.
6. The frontend displays recommendation cards and the impact/effort chart.

### Discussion and Reanalysis

Users can open a recommendation and provide new information. The backend can discuss the recommendation, update it, recalculate its score, record what changed, and flag the complete opportunity map as stale when other recommendations may also be affected.

## Opportunity Scoring

Scoring is implemented in `server/utils/scoring.js`:

```text
weighted = impact × 0.35
         + timeSavingPotential × 0.20
         + repetition × 0.15
         + dataReadiness × 0.15
         - implementationComplexity × 0.08
         - risk × 0.07

score = round((weighted + 1.5) × 10)
```

The final score is normalized to `0-100`. Gemini supplies the ratings; the application calculates the final score and ranking.

## Project Structure

```text
Golden-Eagles/
├── api/                     # Legacy Vercel entrypoint; Railway is current backend
├── client/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       ├── services/api.js
│       └── components/
├── server/
│   ├── package.json
│   ├── server.js
│   ├── app.js
│   ├── store.js
│   ├── services/geminiService.js
│   ├── prompts/
│   ├── utils/
│   └── test/
├── package.json
├── package-lock.json
├── playwright.config.js
├── vercel.json
└── README.md
```

## API Routes

| Method | Route                                | Purpose                                       |
| ------ | ------------------------------------ | --------------------------------------------- |
| GET    | `/api/health`                        | Check backend status and Gemini configuration |
| POST   | `/api/session`                       | Create a new analysis session                 |
| GET    | `/api/session/:id`                   | Restore an existing session                   |
| POST   | `/api/interview`                     | Submit an interview message                   |
| POST   | `/api/recommendations`               | Generate or refresh recommendations           |
| POST   | `/api/recommendations/:id/chat`      | Discuss a recommendation                      |
| POST   | `/api/recommendations/:id/reanalyze` | Reanalyze a recommendation                    |

Mutation requests use a session ID and request UUID so completed duplicate requests can be handled safely.

## Security and Request Safety

- Helmet security headers
- JSON request size limits
- Per-IP API rate limiting
- UUID-based analysis sessions
- Zod validation
- Server-side Gemini API key access
- Structured model responses
- One active mutation per session
- Idempotent completed request handling

Session IDs act as bearer access tokens rather than full user authentication. Do not treat this hackathon build as an authenticated multi-user SaaS product.

## Testing

```powershell
npm test
npm run build
npm run test:browser
```

The automated backend tests use injected AI fixtures and do not spend live API credits. Live acceptance testing should verify the configured Railway service, adaptive interview, recommendation generation, persistence, and Vercel API rewrites.

## Troubleshooting

| Problem                             | Check                                              |
| ----------------------------------- | -------------------------------------------------- |
| Vercel cannot find `package.json`   | Keep Root Directory blank or `.`                   |
| Vercel cannot find output directory | Set Output Directory to `client/dist`              |
| Vercel runtime error                | Remove any `functions.*.runtime` block             |
| `/api/health` does not load         | Confirm Railway is running and has a public domain |
| `configured: false`                 | Add `GEMINI_API_KEY` to Railway and redeploy       |
| Gemini authentication error         | Verify the key and Google AI project access        |
| Gemini model error                  | Verify `GEMINI_MODEL=gemini-3.8-flash`             |
| Gemini `429`                        | Check API quota and rate limits                    |
| Frontend works but API calls fail   | Check the Vercel rewrite destination               |
| Sessions disappear after redeploy   | Attach a Railway Volume or use PostgreSQL          |
| Node SQLite import fails            | Upgrade to Node 22.13 or newer                     |

## Current Limitations

- No user accounts or authentication
- SQLite instead of a networked production database
- Session IDs act as bearer tokens
- Railway storage is ephemeral without a volume
- No distributed session locking across multiple instances
- AI-generated estimates require business validation
- Long conversations increase token usage
- Model generation can take several seconds
- Recommendations are advisory and are not automatically deployed

## AI Model

The backend uses Google's official `@google/genai` JavaScript SDK. The default model is `gemini-3.8-flash`, configured in `server/services/geminiService.js`.

The API key is read only from `process.env.GEMINI_API_KEY` and is never intentionally sent to the browser.

## License / Hackathon Use

This project was created as a hackathon prototype for discovering practical AI opportunities in real business workflows.
