import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { RequestBody } from "./utils/validation.js";
import { rank } from "./utils/scoring.js";
import * as liveAI from "./services/geminiService.js";
const { AppError } = liveAI;
export function createApp(store, ai = liveAI) {
  const app = express(),
    busy = new Set();
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 45,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a minute." },
    }),
  );
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      configured:
        !!process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "your_gemini_api_key_here",
    }),
  );
  app.post("/api/session", (_req, res) => res.status(201).json(store.create()));
  app.get("/api/session/:id", (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const s = store.get(id);
    if (!s)
      throw new AppError(404, "Analysis not found. Start a new analysis.");
    res.json(s);
  });
  const mutate = (operation) => async (req, res) => {
    const body = RequestBody.parse(req.body),
      s = store.get(body.sessionId);
    if (!s)
      throw new AppError(404, "Analysis not found. Start a new analysis.");
    if (s.completedRequests.includes(body.requestId)) return res.json(s);
    if (busy.has(s.id))
      throw new AppError(
        409,
        "An analysis request is already running. Wait for it to finish.",
      );
    if (s.history.length >= 160)
      throw new AppError(
        409,
        "This analysis has reached its conversation limit. Export it and start a new analysis.",
      );
    busy.add(s.id);
    try {
      await operation(s, body, req);
      s.revision++;
      s.completedRequests.push(body.requestId);
      res.json(store.save(s));
    } finally {
      busy.delete(s.id);
    }
  };
  app.post(
    "/api/interview",
    mutate(async (s, b) => {
      if (!b.message) throw new AppError(400, "Enter a message to continue.");
      const result = await ai.runBusinessInterview({
        profile: s.profile,
        history: s.history,
        message: b.message,
      });
      s.history.push(
        { role: "user", content: b.message, scope: "interview" },
        { role: "assistant", content: result.message, scope: "interview" },
      );
      Object.assign(s, {
        profile: result.profile,
        missingInformation: result.missingInformation,
        understandingScore: result.understandingScore,
        interviewComplete: result.interviewComplete,
      });
      if (s.useCases.length) s.stale = true;
    }),
  );
  app.post(
    "/api/recommendations",
    mutate(async (s) => {
      if (!s.interviewComplete)
        throw new AppError(
          409,
          "Continue the interview until the consultant has enough information.",
        );
      const result = await ai.generateRecommendations({
        profile: s.profile,
        history: s.history,
        previousRecommendations: s.useCases,
      });
      s.useCases = rank(
        result.useCases.map((item) => ({
          ...item,
          id: randomUUID(),
          changes: [],
        })),
      );
      s.summary = result.summary;
      s.stale = false;
    }),
  );
  const discuss = (reanalyze) =>
    mutate(async (s, b, req) => {
      const selected = s.useCases.find((x) => x.id === req.params.id);
      if (!selected)
        throw new AppError(
          404,
          "Recommendation not found. Return to the opportunity map.",
        );
      if (!b.message)
        throw new AppError(400, "Enter a question or new information.");
      const result = await (
        reanalyze ? ai.reanalyzeRecommendation : ai.discussRecommendation
      )({
        profile: s.profile,
        history: s.history,
        recommendations: s.useCases,
        selectedRecommendation: selected,
        message: b.message,
      });
      s.profile = result.profile;
      s.history.push(
        { role: "user", content: b.message, scope: selected.id },
        { role: "assistant", content: result.message, scope: selected.id },
      );
      if (result.updatedRecommendation) {
        const replacement = rank([
          { ...result.updatedRecommendation, id: selected.id },
        ])[0];
        replacement.changes = [
          ...selected.changes,
          {
            at: new Date().toISOString(),
            reason: result.changeReason || "Updated after discussion.",
            before: {
              score: selected.opportunityScore,
              complexity: selected.implementationComplexity,
              risk: selected.risk,
            },
            after: {
              score: replacement.opportunityScore,
              complexity: replacement.implementationComplexity,
              risk: replacement.risk,
            },
          },
        ];
        s.useCases = rank(
          s.useCases.map((x) => (x.id === selected.id ? replacement : x)),
        );
      }
      s.stale = s.stale || result.otherRecommendationsAffected;
    });
  app.post("/api/recommendations/:id/chat", discuss(false));
  app.post("/api/recommendations/:id/reanalyze", discuss(true));
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use(
    express.static(fileURLToPath(new URL("../client/dist/", import.meta.url))),
  );
  app.use((error, _req, res, _next) => {
    const status =
      error instanceof z.ZodError
        ? 400
        : error.type === "entity.too.large"
          ? 413
          : error instanceof SyntaxError
            ? 400
            : error.status || 500;
    const message =
      error instanceof z.ZodError
        ? "Invalid request. Check the session, request ID and message length."
        : status === 413
          ? "Message is too large. Please shorten it."
          : error instanceof SyntaxError
            ? "Invalid JSON request."
            : error instanceof AppError
              ? error.message
              : "Something went wrong on the server. Please retry.";
    res.status(status).json({ error: message });
  });
  return app;
}
