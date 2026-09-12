import { ArrowLeft, MessageSquare, RefreshCw } from "lucide-react";
import ChatPanel from "./ChatPanel.jsx";
import { label } from "./BusinessProfile.jsx";
export default function RecommendationDetail({
  item,
  session,
  onBack,
  onSend,
  onReanalyze,
  busy,
}) {
  const fields = [
    "problem",
    "solution",
    "whyAI",
    "technology",
    "benefits",
    "requirements",
    "integrations",
    "assumptions",
    "risks",
    "mitigations",
    "pilotRecommendation",
    "successMetrics",
    "implementationSteps",
  ];
  const names = {
    solution: "Proposed solution",
    whyAI: "Why AI?",
    requirements: "Required data",
    integrations: "Required integrations",
    pilotRecommendation: "Suggested pilot",
    implementationSteps: "Implementation roadmap",
  };
  return (
    <>
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to opportunity map
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OPPORTUNITY DEEP DIVE</div>
          <h1>{item.title}</h1>
          <span className="tag">
            {item.aiRecommended ? "AI OPPORTUNITY" : "AI NOT RECOMMENDED"}
          </span>
        </div>
        <div className="score large">
          {item.opportunityScore}
          <small>/ 100</small>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="panel">
            <div className="ratings">
              {[
                "businessImpact",
                "timeSavingPotential",
                "repetition",
                "implementationComplexity",
                "dataReadiness",
                "risk",
              ].map((k) => (
                <div key={k}>
                  <span>{label(k)}</span>
                  <strong>
                    {item[k]}
                    <small> / 10</small>
                  </strong>
                </div>
              ))}
            </div>
            <p className="muted">{item.ratingRationale}</p>
            <div className="note">
              <strong>Estimated time savings</strong>
              <p>{item.estimatedTimeSavings}</p>
              <p className="muted">{item.estimateBasis}</p>
            </div>
          </div>
          <div className="panel detail-sections">
            {fields.map((k) => (
              <section key={k}>
                <h3>{names[k] || label(k)}</h3>
                {Array.isArray(item[k]) ? (
                  <ul>
                    {item[k].map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{item[k]}</p>
                )}
              </section>
            ))}
            <section>
              <h3>Solution workflow</h3>
              <div className="workflow">
                {item.architecture.map((x, i) => (
                  <div key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {x}
                  </div>
                ))}
              </div>
            </section>
          </div>
          {item.changes.length > 0 && (
            <section className="panel">
              <h2>What changed</h2>
              {item.changes.map((change, i) => (
                <div className="change" key={i}>
                  <strong>
                    Score {change.before.score} → {change.after.score}
                  </strong>
                  <p>
                    Complexity {change.before.complexity} →{" "}
                    {change.after.complexity} · Risk {change.before.risk} →{" "}
                    {change.after.risk}
                  </p>
                  <p>{change.reason}</p>
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="discussion">
          <div className="discussion-title">
            <MessageSquare size={19} />
            <h2>Challenge this recommendation</h2>
          </div>
          <p className="muted">
            Question the assumptions. Add a constraint. Shape a better solution.
          </p>
          <ChatPanel
            messages={session.history.filter((m) => m.scope === item.id)}
            onSend={onSend}
            busy={busy}
            initial="What would you like to explore or challenge about this recommendation?"
            starters={[
              "Why should we use AI here?",
              "What assumptions are you making?",
              "Could normal automation solve this instead?",
              "How would we pilot this safely?",
            ]}
          />
          <button
            className="secondary full"
            disabled={busy}
            onClick={onReanalyze}
          >
            <RefreshCw size={16} />
            Reanalyze with latest context
          </button>
        </aside>
      </div>
    </>
  );
}
