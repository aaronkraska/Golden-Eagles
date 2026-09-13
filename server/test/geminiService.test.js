import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWithRetry } from "../services/geminiService.js";

// Capture retry delays with a fake wait function so recovery tests run without backoff sleeps.
test("temporary Gemini failure retries and returns the recovered response", async () => {
  let calls = 0;
  const delays = [];
  const response = { text: "response" };
  const client = {
    models: {
      generateContent: async () => {
        if (++calls < 3)
          throw Object.assign(new Error("Busy"), { status: 503 });
        return response;
      },
    },
  };
  assert.equal(
    await generateWithRetry(client, {}, async (ms) => delays.push(ms)),
    response,
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

// Verify both the retry ceiling and immediate propagation of non-retryable status codes.
test("retries are bounded and do not retry quota, authentication or invalid requests", async () => {
  for (const status of [500, 503, 429, 401, 403, 400, 404]) {
    let calls = 0;
    const error = Object.assign(new Error("API failure"), { status });
    const client = {
      models: {
        generateContent: async () => {
          calls++;
          throw error;
        },
      },
    };
    await assert.rejects(
      generateWithRetry(client, {}, async () => {}),
      (caught) => caught === error,
    );
    assert.equal(calls, [500, 503].includes(status) ? 3 : 1);
  }
});
