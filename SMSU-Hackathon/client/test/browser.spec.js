import { test, expect } from "@playwright/test";
import { UseCase, emptyProfile } from "../../server/utils/validation.js";
import { randomUUID } from "node:crypto";
test("desktop and mobile landing, actual session creation, refresh and safe error recovery", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); console.log("BROWSER ERROR", e.message); });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Less AI hype/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Analyze My Organization" }).click();
  await expect(
    page.getByRole("heading", { name: "Your business. A fresh perspective." }),
  ).toBeVisible();
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  const id = await page.evaluate(() =>
    localStorage.getItem("opportunity-session"),
  );
  expect(id).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Business understanding" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("opportunity-session")),
  ).toBe(id);
  // Intercept only this error case, so the test never incurs API charges if a key exists.
  await page.route("**/api/interview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Gemini is not configured. Add your API key to server/.env and restart the backend.",
      }),
    }),
  );
  await page
    .getByRole("textbox")
    .fill("Our team reviews unusual project requests.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Gemini is not configured",
  );
  await expect(page.getByRole("textbox")).toHaveValue(
    "Our team reviews unusual project requests.",
  );
  await page.screenshot({
    path: "test-results/interview-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("textbox")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/interview-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("isolated dashboard fixture renders matrix, detail, discussion and score revision", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); console.log("BROWSER ERROR", e.message); });
  const id = randomUUID(),
    caseId = randomUUID();
  const item = {
    ...Object.fromEntries(
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
    ),
    id: caseId,
    title: "Test workflow integration",
    opportunityScore: 50,
    changes: [],
  };
  const session = {
    id,
    profile: emptyProfile(),
    history: [],
    useCases: [item],
    summary: "Test-only business analysis",
    stale: false,
    understandingScore: 85,
    missingInformation: [],
    interviewComplete: true,
  };
  await page.addInitScript(
    (id) => localStorage.setItem("opportunity-session", id),
    id,
  );
  await page.route(`**/api/session/${id}`, (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, configured: true } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Possibilities, prioritized." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Impact vs. effort" }),
  ).toBeVisible();
  await expect(
    page.getByText("AI NOT RECOMMENDED", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View recommendation & discuss" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Challenge this recommendation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Solution workflow" }),
  ).toBeVisible();
  await page.route(`**/api/recommendations/${caseId}/chat`, (route) => {
    session.history = [
      { role: "user", scope: caseId, content: "We have no API." },
      {
        role: "assistant",
        scope: caseId,
        content: "This increases complexity.",
      },
    ];
    item.implementationComplexity = 8;
    item.opportunityScore = 48;
    item.changes = [
      {
        before: { score: 50, complexity: 5, risk: 5 },
        after: { score: 48, complexity: 8, risk: 5 },
        reason: "No API is available.",
      },
    ];
    return route.fulfill({ json: session });
  });
  await page.getByRole("textbox").fill("We have no API.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("This increases complexity.")).toBeVisible();
  await expect(page.getByText("Score 50 → 48")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
