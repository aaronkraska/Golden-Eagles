import { Check, CircleHelp } from "lucide-react";
// Turn camelCase schema keys into display labels, also reused by recommendation details.
export const label = (key) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
// Render the server profile generically; readiness and missing facts come from the AI response.
export default function BusinessProfile({ session }) {
  return (
    <aside className="panel profile">
      <div className="eyebrow">LIVE CONTEXT</div>
      <h2>Business understanding</h2>
      <p className="muted">Built from what you share. Refined as we learn.</p>
      <div className="progress-label">
        <span>Analysis readiness</span>
        <strong>{session.understandingScore}%</strong>
      </div>
      <progress max="100" value={session.understandingScore} />
      <div className="profile-fields">
        {Object.entries(session.profile).map(([key, value]) => {
          // Empty arrays and absent scalar values both mean this fact has not been learned yet.
          const known = Array.isArray(value) ? value.length > 0 : !!value;
          return (
            <div className="profile-field" key={key}>
              <div>
                {known ? <Check size={15} /> : <CircleHelp size={15} />}
                <span>{label(key)}</span>
              </div>
              <p className={known ? "" : "muted"}>
                {known
                  ? Array.isArray(value)
                    ? value.join(" · ")
                    : value
                  : "Not yet discussed"}
              </p>
            </div>
          );
        })}
      </div>
      {session.missingInformation.length > 0 && (
        <div className="note">
          <strong>What would help next</strong>
          <p>{session.missingInformation.map(label).join(" · ")}</p>
        </div>
      )}
    </aside>
  );
}
