import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Compass,
  ShieldCheck,
  Layers,
  MessageSquare,
  Download,
  Plus,
  LoaderCircle,
} from "lucide-react";
import { api } from "./services/api.js";
import ChatPanel from "./components/ChatPanel.jsx";
import BusinessProfile from "./components/BusinessProfile.jsx";
// Load the chart library only when the opportunity map is rendered.
const ImpactEffortChart = lazy(
  () => import("./components/ImpactEffortChart.jsx"),
);
import RecommendationDetail from "./components/RecommendationDetail.jsx";
// Browser storage holds only the session ID; the server restores the full analysis.
// Storage access may fail in restricted browser contexts, so restoration is optional.
const savedId = () => {
  try {
    return localStorage.getItem("opportunity-session");
  } catch {
    return null;
  }
};
// This component owns navigation, the current server snapshot, and shared request feedback.
export default function App() {
  const [session, setSession] = useState(null),
    [page, setPage] = useState("home"),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [configured, setConfigured] = useState(true);
  // On mount, check configuration and independently restore the last saved session.
  useEffect(() => {
    api("/health")
      .then((h) => setConfigured(h.configured))
      .catch((e) => setError(e.message));
    const id = savedId();
    if (id) {
      setBusy("Restoring your analysis…");
      api(`/session/${id}`)
        .then((s) => {
          setSession(s);
          setPage(s.useCases.length ? "results" : "interview");
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(""));
    }
  }, []);
  // Replace local state with the server response and remember its ID for future reloads.
  function remember(s) {
    setSession(s);
    try {
      localStorage.setItem("opportunity-session", s.id);
    } catch {}
  }
  // Creating a session resets the selected detail and opens the interview stage.
  async function start() {
    setBusy("Starting your analysis…");
    setError("");
    try {
      const s = await api("/session", {});
      remember(s);
      setSelected(null);
      setPage("interview");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  // Centralize mutations and return success so composers can retain drafts after failures.
  // Each invocation gets a new request UUID for the backend's completed-request tracking.
  async function action(path, message, loading = "Analyzing your workflow…") {
    if (busy) return false;
    setBusy(loading);
    setError("");
    try {
      const s = await api(path, {
        sessionId: session.id,
        requestId: crypto.randomUUID(),
        ...(message ? { message } : {}),
      });
      remember(s);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy("");
    }
  }
  // Navigate to the refreshed map only after generation succeeds.
  async function generate() {
    if (
      await action(
        "/recommendations",
        null,
        "Evaluating opportunities and comparing impact, effort, and risk…",
      )
    ) {
      setSelected(null);
      setPage("results");
    }
  }
  // Download the current snapshot through a temporary Blob URL, then release that URL.
  function exportAnalysis() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(session, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-opportunity-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  // Derive the detail from the latest snapshot so reanalysis immediately updates the view.
  // Rendering below switches among home, interview, selected detail, and ranked map.
  const item = session?.useCases.find((x) => x.id === selected);
  return (
    <div className="app">
      <header>
        <button className="brand" onClick={() => setPage("home")}>
          <span className="brand-icon">
            <Compass size={23} />
          </span>
          AskBusi: <span className="brand-ai">/ AI</span>
        </button>
        <nav>
          <span className="nav-caption">
            FROM POSSIBILITY TO A PRACTICAL PLAN
          </span>
          {session && (
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => {
                setSelected(null);
                setPage(session.useCases.length ? "results" : "interview");
              }}
            >
              My analysis <ArrowUpRight size={15} />
            </button>
          )}
          <button className="secondary" disabled={!!busy} onClick={start}>
            <Plus size={16} />
            New analysis
          </button>
        </nav>
      </header>
      <main>
        {error && (
          <div className="error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {!configured && (
          <div className="setup">
            Connect Gemini to begin: copy <code>server/.env.example</code> to{" "}
            <code>server/.env</code>, add your API key, and restart the backend.
          </div>
        )}
        {page === "home" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="mini-dot" /> YOUR NEXT OPPORTUNITY STARTS
                  HERE
                </div>
                <h1>
                  Less AI hype.
                  <br />
                  More business <em>impact.</em>
                </h1>
                <p>
                  Discover where AI can actually create value in your
                  organization.
                </p>
                <p className="hero-description">
                  An AI consultant that learns how your team works, finds the
                  friction, and turns it into realistic opportunities. Grounded
                  in your business. Built for action.
                </p>
                <button
                  className="primary big"
                  disabled={!!busy}
                  onClick={start}
                >
                  Analyze My Organization <ArrowRight size={19} />
                </button>
                <div className="hero-foot">
                  <ShieldCheck size={16} />
                  No industry templates. Just your real workflow.
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="art-label">FIND YOUR NEXT MOVE</div>
                <div className="art-node node-one">
                  <MessageSquare size={20} />
                  <span>Your business context</span>
                </div>
                <div className="art-core">
                  <Sparkles size={35} />
                  <span>
                    Clarity from
                    <br />
                    complexity.
                  </span>
                </div>
                <div className="art-node node-two">
                  <Layers size={20} />
                  <span>A practical opportunity map</span>
                  <ArrowUpRight size={18} />
                </div>
                <div className="art-caption">
                  UNDERSTAND → EVALUATE → ACT
                </div>
              </div>
            </section>
            <section className="process">
              <div className="section-intro">
                <div className="eyebrow">A CLEAR PATH FORWARD</div>
                <h2>From “could we?” to “here’s how.”</h2>
              </div>
              <div className="process-cards">
                {[
                  [
                    "01",
                    "Tell us how work happens",
                    "A focused conversation that adapts to your answers, your processes, and your challenges.",
                  ],
                  [
                    "02",
                    "Find the right opportunities",
                    "Compare AI and conventional automation by business impact, effort, readiness, and risk.",
                  ],
                  [
                    "03",
                    "Build a plan you can challenge",
                    "Explore recommendations, test assumptions, and shape a pilot your team can actually run.",
                  ],
                ].map(([n, title, description]) => (
                  <article key={n}>
                    <span className="step-number">{n}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          session && (
            <>
              <div className="stagebar">
                <button
                  className={page === "interview" ? "active" : ""}
                  onClick={() => setPage("interview")}
                >
                  01 <span>Understand your business</span>
                </button>
                <span className="stage-line" />
                <button
                  className={page === "results" ? "active" : ""}
                  disabled={!session.useCases.length}
                  onClick={() => {
                    setSelected(null);
                    setPage("results");
                  }}
                >
                  02 <span>Your opportunity map</span>
                </button>
                <div className="saved">Saved on this device</div>
              </div>
              {page === "interview" ? (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">LET’S FIND WHAT MATTERS</div>
                      <h1>Your business. A fresh perspective.</h1>
                      <p className="muted">
                        Share how your team works. We’ll uncover where a
                        better approach could help.
                      </p>
                    </div>
                  </div>
                  <div className="interview-grid">
                    <div>
                      <ChatPanel
                        messages={session.history.filter(
                          (x) => x.scope === "interview",
                        )}
                        busy={!!busy}
                        onSend={(message) => action("/interview", message)}
                      />
                      {session.interviewComplete && (
                        <div className="ready">
                          <div>
                            <Sparkles size={20} />
                            <strong>Business analysis complete.</strong>
                            <p>
                              You can add more context, or explore your
                              opportunities.
                            </p>
                          </div>
                          <button
                            className="primary"
                            disabled={!!busy}
                            onClick={generate}
                          >
                            Generate My AI Opportunity Map{" "}
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      )}
                    </div>
                    <BusinessProfile session={session} />
                  </div>
                </>
              ) : item ? (
                <RecommendationDetail
                  item={item}
                  session={session}
                  onBack={() => setSelected(null)}
                  busy={!!busy}
                  onSend={(message) =>
                    action(`/recommendations/${item.id}/chat`, message)
                  }
                  onReanalyze={() =>
                    action(
                      `/recommendations/${item.id}/reanalyze`,
                      "Reassess this recommendation using all the latest business information. Explain any changes.",
                      "Reassessing the recommendation…",
                    )
                  }
                />
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">YOUR OPPORTUNITY MAP</div>
                      <h1>Possibilities, prioritized.</h1>
                      <p className="muted">{session.summary}</p>
                    </div>
                    <button className="secondary" onClick={exportAnalysis}>
                      <Download size={16} />
                      Export analysis
                    </button>
                  </div>
                  {session.stale && (
                    <div className="setup">
                      Your business context has changed. Refresh the full map to
                      reassess all opportunities.
                      <button
                        disabled={!!busy}
                        className="text-button"
                        onClick={generate}
                      >
                        Refresh opportunity map <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <div className="results-top">
                    <Suspense
                      fallback={
                        <div className="panel">Loading opportunity matrix…</div>
                      }
                    >
                      <ImpactEffortChart
                        items={session.useCases}
                        onSelect={setSelected}
                      />
                    </Suspense>
                    <section className="panel score-explainer">
                      <div className="eyebrow">VALUE BEFORE NOVELTY</div>
                      <h2>A better starting point.</h2>
                      <p>
                        Opportunities are ranked by a transparent score
                        calculated in code.
                      </p>
                      <div className="weight">
                        <span>Business impact</span>
                        <strong>35%</strong>
                      </div>
                      <div className="weight">
                        <span>Time saving potential</span>
                        <strong>20%</strong>
                      </div>
                      <div className="weight">
                        <span>Repetition + data readiness</span>
                        <strong>30%</strong>
                      </div>
                      <div className="weight">
                        <span>Complexity + risk penalties</span>
                        <strong>15%</strong>
                      </div>
                      <p className="small muted">
                        Ratings are AI assessments, not measured outcomes.
                        Scores normalize the weighted result to 0–100.
                        Estimates require pilot validation.
                      </p>
                    </section>
                  </div>
                  <div className="opportunities">
                    {session.useCases.map((x, i) => (
                      <article className="panel opportunity" key={x.id}>
                        <div className="card-top">
                          <span className="eyebrow">
                            OPPORTUNITY {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="score">
                            {x.opportunityScore}
                            <small>/100</small>
                          </div>
                        </div>
                        <span
                          className={`tag ${x.aiRecommended ? "" : "alternative"}`}
                        >
                          {x.aiRecommended
                            ? x.technology[0]
                            : "AI NOT RECOMMENDED"}
                        </span>
                        <h2>{x.title}</h2>
                        <p className="muted">{x.problem}</p>
                        <div className="mini-ratings">
                          <span>
                            Impact <b>{x.businessImpact}/10</b>
                          </span>
                          <span>
                            Effort <b>{x.implementationComplexity}/10</b>
                          </span>
                          <span>
                            Risk <b>{x.risk}/10</b>
                          </span>
                        </div>
                        <ul>
                          {x.benefits.slice(0, 3).map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                        <button
                          className="secondary full"
                          onClick={() => setSelected(x.id)}
                        >
                          View recommendation & discuss{" "}
                          <ArrowUpRight size={17} />
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )
        )}
        {busy && (
          <div className="loading" role="status">
            <LoaderCircle className="spin" size={19} />
            {busy}
          </div>
        )}
      </main>
      <footer>
        <span>
          <ShieldCheck size={15} />
          Do not enter passwords, API keys, Social Security numbers, or other
          secrets into the assessment.
        </span>
        <span>AskBusi: AI Opportunity Finder</span>
      </footer>
    </div>
  );
}
