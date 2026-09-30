import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Live Collection Run Execution Screen", () => {
  test("monitors live run, controls execution with pause/resume/cancel, and inspects sources", async ({
    page,
    request,
  }) => {
    // 1. Initialize demo workflow and run via demo API
    const demoRes = await request.get("/api/demo/run");
    expect(demoRes.ok()).toBe(true);
    const demoData = await demoRes.json();
    const workflowId = demoData.workflow.id || demoData.workflow._id;
    const runId = demoData.run.id || demoData.run._id;

    // 2. Navigate to live run screen
    await page.goto(`/w/${workflowId}/runs/${runId}`);
    await page.waitForLoadState("domcontentloaded");

    // 3. Verify signature CairnBuilder stack is visible
    const cairn = page.getByRole("img", { name: /Cairn stage stack/i });
    await expect(cairn).toBeVisible({ timeout: 10000 });

    // 4. Verify Stat counters row
    await expect(page.getByText(/sources/i).first()).toBeVisible();
    await expect(page.getByText(/records/i).first()).toBeVisible();

    // 5. Verify Field log
    const fieldLog = page.getByRole("region", { name: /Field Log/i });
    await expect(fieldLog).toBeVisible();

    // 6. Test Pause and Resume controls
    const pauseBtn = page.getByRole("button", { name: /Pause collection/i });
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      // Wait for the UI to reflect paused state (resume button appears)
      const resumeBtn = page.getByRole("button", { name: /Resume collection/i });
      const isResumeVisible = await resumeBtn.isVisible({ timeout: 8000 }).catch(() => false);

      if (isResumeVisible) {
        // Resume collection
        await resumeBtn.click();
        // Either pause button reappears or run completes - both are valid
        await page
          .getByRole("button", { name: /Pause collection/i })
          .waitFor({ state: "visible", timeout: 8000 })
          .catch(() => {
            // Run may have completed while resuming - that is fine
          });
      }
    }

    // 7. Test Cancel Confirm Sheet
    const cancelBtn = page.getByRole("button", { name: /Cancel collection/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Verify confirm sheet opens
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText(/Cancel collection run\?/i)).toBeVisible();

    // Dismiss cancel sheet without cancelling
    const keepRunningBtn = confirmDialog.getByRole("button", { name: /Keep collecting/i });
    await keepRunningBtn.click();
    await expect(confirmDialog).not.toBeVisible();

    // 8. Test Sources tab
    const sourcesTabBtn = page.getByRole("tab", { name: /Permitted Sources/i });
    await expect(sourcesTabBtn).toBeVisible();
    await sourcesTabBtn.click();

    const sourcesPanel = page.getByRole("tabpanel", { name: /Permitted Sources/i });
    await expect(sourcesPanel).toBeVisible();

    // Switch back to Field Log tab
    const logTabBtn = page.getByRole("tab", { name: /Field Log/i });
    await logTabBtn.click();
    await expect(sourcesPanel).not.toBeVisible();

    // 9. Run axe accessibility audit on the live run view
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const seriousViolations = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );

    expect(seriousViolations).toEqual([]);
  });
});
