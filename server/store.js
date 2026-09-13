import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { emptyProfile } from "./utils/validation.js";
// Each session is a JSON document keyed by UUID; callers receive a new parsed object per read.
// A supplied filename also allows isolated in-memory databases in tests.
export function createStore(filename) {
  // Serverless storage uses /tmp; ordinary launches create a module-relative data directory.
  if (!filename) {
    if (process.env.VERCEL) filename = "/tmp/analyses.sqlite";
  }
  if (!filename) {
    mkdirSync(new URL("./data/", import.meta.url), { recursive: true });
    filename = fileURLToPath(
      new URL("./data/analyses.sqlite", import.meta.url),
    );
  }
  const db = new DatabaseSync(filename);
  // WAL journaling accompanies a minimal table; profile and history need no separate tables.
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, body TEXT NOT NULL)",
  );
  return {
    get: (id) => {
      const row = db.prepare("SELECT body FROM sessions WHERE id=?").get(id);
      return row ? JSON.parse(row.body) : null;
    },
    // Upsert the complete document and stamp its last successful persistence time.
    save(session) {
      session.updatedAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO sessions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      ).run(session.id, JSON.stringify(session));
      return session;
    },
    // Initialize the shape expected by the UI, AI context, and mutation bookkeeping.
    create() {
      return this.save({
        id: randomUUID(),
        profile: emptyProfile(),
        history: [],
        missingInformation: [],
        understandingScore: 0,
        interviewComplete: false,
        useCases: [],
        summary: "",
        stale: false,
        revision: 0,
        completedRequests: [],
      });
    },
    close: () => db.close(),
  };
}
