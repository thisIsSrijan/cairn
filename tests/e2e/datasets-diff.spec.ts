import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Datasets and Diff e2e tests.
 * Tests the datasets ledger, workflow detail trail, re-run with previousRunId,
 * and the diff viewer showing changed records between two runs.
 * Runs twice in demo mode with fixture records that change between runs.
 */
test.describe("Datasets, Workflow Detail, and Diff Viewer", () => {
  test("datasets ledger shows completed runs grouped by workflow", async ({
    page,
  }) => {
    // Seed a completed demo run
    const demoRes = await page.request.get("/api/demo/run?complete=true");
    expect(demoRes.ok()).toBe(true);
    const demoData = await demoRes.json();
    const workflowId = demoData.workflow.id || demoData.workflow._id;

    // Navigate to Datasets page
    await page.goto("/datasets");
    await page.waitForLoadState("domcontentloaded");

    // Heading should be visible
    await expect(page.getByRole("heading", { name: /verified datasets/i })).toBeVisible();

    // The seeded workflow should appear (filter visible for mobile/desktop layout)
    const titleLink = page
      .getByText(/junior developers in lucknow/i)
      .filter({ visible: true });
    await expect(titleLink.first()).toBeVisible({ timeout: 8000 });

    // Clicking Open Results should navigate to results
    const openBtn = page
      .getByRole("link", { name: /open/i })
      .filter({ visible: true })
      .first();
    await expect(openBtn).toBeVisible();

    // Verify no horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    // Axe audit
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = scan.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious).toEqual([]);

    // Navigate to workflow detail page
    await page.goto(`/w/${workflowId}`);
    await page.waitForLoadState("domcontentloaded");

    // Workflow detail: blueprint section and run trail should be visible
    await expect(
      page.getByText(/junior developers in lucknow/i).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 8000 });

    await expect(
      page.getByRole("button", { name: /run again/i })
    ).toBeVisible();

    // Verify no horizontal overflow on workflow detail
    const overflowDetail = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflowDetail).toBe(false);
  });

  test("re-run creates second run with previousRunId, diff shows correct counts (+1 -1 ~1)", async ({
    page,
  }) => {
    // Seed first completed run (Run 1 - baseline)
    const run1Res = await page.request.get("/api/demo/run?complete=true");
    expect(run1Res.ok()).toBe(true);
    const run1Data = await run1Res.json();
    const workflowId = run1Data.workflow.id || run1Data.workflow._id;
    const run1Id = run1Data.run.id || run1Data.run._id;

    // Trigger a re-run (Run 2 - creates new queued run linked to run 1)
    const run2Res = await page.request.post(`/api/workflows/${workflowId}/runs`, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({}),
    });
    expect(run2Res.ok()).toBe(true);
    const run2Data = await run2Res.json();
    const run2Id = run2Data.id || run2Data._id;

    // Verify previousRunId is set
    const run2Detail = await page.request.get(`/api/runs/${run2Id}`);
    expect(run2Detail.ok()).toBe(true);
    const run2DetailData = await run2Detail.json();
    const runObj = run2DetailData.run || run2DetailData;
    expect(runObj.previousRunId).toBe(run1Id);

    // Complete Run 2 with diff variation fixtures (+1 added, -1 removed, ~1 changed)
    const completeRun2Res = await page.request.get(`/api/demo/run?runId=${run2Id}`);
    expect(completeRun2Res.ok()).toBe(true);

    // Navigate to results of Run 2 - verify diff link appears with changes
    await page.goto(`/w/${workflowId}/runs/${run2Id}/results`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/changes since last run/i)).toBeVisible({ timeout: 8000 });

    // Navigate to workflow detail to see the run trail with multiple runs
    await page.goto(`/w/${workflowId}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("button", { name: /run again/i })
    ).toBeVisible({ timeout: 8000 });

    // Navigate to diff view for Run 2
    await page.goto(`/w/${workflowId}/runs/${run2Id}/diff`);
    await page.waitForLoadState("domcontentloaded");

    // The diff page heading should be visible
    await expect(page.getByRole("heading", { name: /run changes/i })).toBeVisible({
      timeout: 8000,
    });

    // Summary rule should be present showing counts +1 -1 ~1
    const summaryRule = page.getByTestId("diff-summary");
    await expect(summaryRule).toBeVisible({ timeout: 5000 });
    await expect(summaryRule.getByText(/\+1/)).toBeVisible();
    await expect(summaryRule.getByText(/-1/)).toBeVisible();
    await expect(summaryRule.getByText(/~1/)).toBeVisible();

    // Verify sections (Added, Removed, Changed)
    await expect(page.getByRole("region", { name: /added/i })).toBeVisible();
    await expect(page.getByRole("region", { name: /removed/i })).toBeVisible();
    await expect(page.getByRole("region", { name: /changed/i })).toBeVisible();

    // Verify no horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    // Axe audit on diff page
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = scan.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious).toEqual([]);
  });

  test("workflow detail Run again button triggers re-run navigation", async ({
    page,
  }) => {
    const demoRes = await page.request.get("/api/demo/run?complete=true");
    expect(demoRes.ok()).toBe(true);
    const demoData = await demoRes.json();
    const workflowId = demoData.workflow.id || demoData.workflow._id;

    await page.goto(`/w/${workflowId}`);
    await page.waitForLoadState("domcontentloaded");

    const runAgainBtn = page.getByRole("button", { name: /run again/i });
    await expect(runAgainBtn).toBeVisible({ timeout: 8000 });
    await runAgainBtn.click();

    // Should navigate to a run execution page
    await page.waitForURL(/\/w\/.+\/runs\/.+/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/w\/.+\/runs\/.+/);
  });
});
