import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, LoaderCircle } from "lucide-react";
// Reusable interview/detail composer; the parent supplies already-filtered conversation history.
export default function ChatPanel({
  messages,
  onSend,
  busy,
  initial = "Tell me about your organization and a workflow you would like to improve.",
  starters = [],
}) {
  const [draft, setDraft] = useState("");
  const bottom = useRef(null);
  // Keep the newest message or thinking indicator visible when the conversation grows.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, busy]);
  // Only clear a draft after the parent confirms success, allowing failed messages to be retried.
  async function submit(e) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    const ok = await onSend(draft.trim());
    if (ok) setDraft("");
  }
  // An empty history shows a local greeting; starter buttons fill the draft without sending.
  // Enter submits via the same handler as the form, while Shift+Enter keeps a newline.
  return (
    <section className="panel chat">
      <div className="chat-heading">
        <div className="avatar">
          <Sparkles size={19} />
        </div>
        <div>
          <strong>Busi: Your AI consultant</strong>
          <div className="muted small">
            A conversation built around your business
          </div>
        </div>
        <span className="live-dot" />
      </div>
      <div className="messages" aria-live="polite">
        {!messages.length && (
          <div className="message assistant">
            <span className="message-label">AskBusi</span>
            <p>{initial}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <span className="message-label">
              {m.role === "user" ? "YOU" : "AI CONSULTANT"}
            </span>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="thinking">
            <LoaderCircle size={17} className="spin" />
            Thinking through your workflow…
          </div>
        )}
        <div ref={bottom} />
      </div>
      {starters.length > 0 && (
        <div className="starters">
          {starters.map((x) => (
            <button key={x} disabled={busy} onClick={() => setDraft(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="composer">
        <textarea
          aria-label="Message to AI consultant"
          placeholder="Share a little context, or ask a question…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={12000}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
        />
        <button
          className="send"
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send message"
        >
          <ArrowUp size={20} />
        </button>
      </form>
      <div className="composer-hint">
        Enter to send · Shift + Enter for a new line
      </div>
    </section>
  );
}
