import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { emptyProfile } from "./utils/validation.js";
export function createStore(filename) {
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
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, body TEXT NOT NULL)",
  );
  return {
    get: (id) => {
      const row = db.prepare("SELECT body FROM sessions WHERE id=?").get(id);
      return row ? JSON.parse(row.body) : null;
    },
    save(session) {
      session.updatedAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO sessions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      ).run(session.id, JSON.stringify(session));
      return session;
    },
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
