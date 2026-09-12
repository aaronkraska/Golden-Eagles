import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { responseSchema } from "../services/geminiService.js";
import { createStore } from "../store.js";
import { createApp } from "../app.js";
import { scoreOpportunity, rank } from "../utils/scoring.js";
import { UseCase, emptyProfile, InterviewResponse, RecommendationResponse, DiscussionResponse } from "../utils/validation.js";
import { AppError, runBusinessInterview } from "../services/geminiService.js";
// Fixtures exist only inside tests; production always calls the Gemini service.
const fixture = () =>
  Object.fromEntries(
    Object.entries(UseCase.shape).map(([k, v]) => [
      k,
      v._def.typeName === "ZodArray"
        ? ["Test evidence"]
        : v._def.typeName === "ZodNumber"
          ? 5
          : v._def.typeName === "ZodBoolean"
            ? false
            : "Test analysis",
    ]),
  );
test("all response schemas convert with the installed Gemini SDK", () => {
  for (const schema of [InterviewResponse, RecommendationResponse, DiscussionResponse]) {
    const format = responseSchema(schema);
    assert.equal(format.type, "object");
    assert.ok(format.required.length > 0);
    assert.ok(format.properties);
  }
});
test("SQLite restores saved analysis after reopening the database", () => {
  const directory = mkdtempSync(join(tmpdir(), "opportunity-test-"));
  const filename = join(directory, "analysis.sqlite");
  let store = createStore(filename);
  try {
    const session = store.create();
    session.profile.process = "User-provided process";
    store.save(session);
    store.close();
    store = createStore(filename);
    assert.equal(store.get(session.id).profile.process, "User-provided process");
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test("scoring normalizes extrema, ranks and rejects invalid ratings", () => {
  const low = {
    businessImpact: 0,
    timeSavingPotential: 0,
    repetition: 0,
    dataReadiness: 0,
    implementationComplexity: 10,
    risk: 10,
  };
  assert.equal(scoreOpportunity(low), 0);
  assert.equal(
    scoreOpportunity({
      ...low,
      businessImpact: 10,
      timeSavingPotential: 10,
      repetition: 10,
      dataReadiness: 10,
      implementationComplexity: 0,
      risk: 0,
    }),
    100,
  );
  assert.throws(() => scoreOpportunity({ ...low, risk: 11 }));
  assert.equal(
    rank([
      { ...fixture(), title: "B", businessImpact: 3 },
      { ...fixture(), title: "A", businessImpact: 9 },
    ])[0].title,
    "A",
  );
});
test("schema rejects malformed AI ratings", () =>
  assert.equal(UseCase.safeParse({ ...fixture(), risk: 99 }).success, false));
test("real service reports missing key without a mock fallback", async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(runBusinessInterview({}), /not configured/);
  } finally {
    if (previous) process.env.GEMINI_API_KEY = previous;
  }
});
test("Gemini SDK sends structured context and rejects malformed responses", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-key-not-a-real-credential";
  let valid = true;
  const output = { message: "Which system supports this workflow?", profile: emptyProfile(), missingInformation: ["systemsUsed"], understandingScore: 25, interviewComplete: false };
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /generativelanguage.googleapis.com/);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(body.generationConfig.responseJsonSchema.properties.profile);
    assert.match(JSON.stringify(body.contents), /Unfamiliar workflow/);
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: valid ? JSON.stringify(output) : '{"message":123}' }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    assert.deepEqual(await runBusinessInterview({ message: "Unfamiliar workflow" }), output);
    valid = false;
    await assert.rejects(runBusinessInterview({ message: "Unfamiliar workflow" }), /could not be validated/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
test("API persists interview, ranks recommendations, handles discussion, duplicate requests, errors and locking", async () => {
  const store = createStore(":memory:");
  let calls = 0;
  let release;
  let slow = false;
  const profile = { ...emptyProfile(), process: "Custom workflow" };
  const ai = {
    runBusinessInterview: async (state) => {
      calls++;
      if (state.message === "fail")
        throw new AppError(502, "Model unavailable");
      if (slow) await new Promise((r) => (release = r));
      return {
        profile,
        message: "What system supports that workflow?",
        missingInformation: ["systemsUsed"],
        understandingScore: 80,
        interviewComplete: true,
      };
    },
    generateRecommendations: async () => ({
      summary: "Evidence-based options",
      useCases: [
        fixture(),
        { ...fixture(), title: "Higher impact", businessImpact: 10 },
      ],
    }),
    discussRecommendation: async () => ({
      profile: { ...profile, constraints: ["No API"] },
      message: "Integration is harder.",
      updatedRecommendation: { ...fixture(), implementationComplexity: 8 },
      changeReason: "No API exists.",
      otherRecommendationsAffected: true,
    }),
  };
  ai.reanalyzeRecommendation = ai.discussRecommendation;
  const server = createApp(store, ai).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, body) => {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    let { body: s } = await call("/session", {});
    const input = {
      sessionId: s.id,
      requestId: randomUUID(),
      message: "We have a novel workflow.",
    };
    assert.equal(
      (
        await call("/recommendations", {
          sessionId: s.id,
          requestId: randomUUID(),
        })
      ).status,
      409,
    );
    s = (await call("/interview", input)).body;
    assert.equal(s.profile.process, "Custom workflow");
    assert.equal(s.history.length, 2);
    await call("/interview", input);
    assert.equal(calls, 1);
    assert.equal(
      (
        await call("/interview", {
          ...input,
          requestId: randomUUID(),
          message: " ",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/interview", {
          ...input,
          requestId: randomUUID(),
          message: "fail",
        })
      ).status,
      502,
    );
    assert.equal((await call(`/session/${s.id}`)).body.history.length, 2);
    s = (
      await call("/recommendations", {
        sessionId: s.id,
        requestId: randomUUID(),
      })
    ).body;
    assert.equal(s.useCases[0].title, "Higher impact");
    assert.equal(s.useCases[0].aiRecommended, false);
    const id = s.useCases[0].id;
    s = (
      await call(`/recommendations/${id}/chat`, {
        ...input,
        requestId: randomUUID(),
        message: "We have no API",
      })
    ).body;
    assert.equal(
      s.useCases.find((x) => x.id === id).implementationComplexity,
      8,
    );
    assert.equal(s.useCases.find((x) => x.id === id).changes.length, 1);
    assert.equal(s.stale, true);
    assert.equal(
      (
        await call(`/recommendations/${randomUUID()}/chat`, {
          ...input,
          requestId: randomUUID(),
        })
      ).status,
      404,
    );
    slow = true;
    const pending = call("/interview", { ...input, requestId: randomUUID() });
    while (!release) await new Promise((r) => setTimeout(r, 5));
    assert.equal(
      (await call("/interview", { ...input, requestId: randomUUID() })).status,
      409,
    );
    release();
    await pending;
    assert.equal((await call(`/session/${randomUUID()}`)).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});
