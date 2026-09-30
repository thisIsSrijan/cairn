import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Full Keyboard Accessibility and Theme Scan", () => {
  test("verifies keyboard path and axe zero serious/critical on Ask in light and dark themes", async ({
    page,
  }) => {
    // 1. Visit Ask route in light mode
    await page.goto("/");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.waitForTimeout(300);

    // Scan light theme
    const scanLight = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousLight = scanLight.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousLight).toEqual([]);

    // 2. Toggle to dark theme using theme button
    const themeBtn = page.getByRole("button", { name: /switch to (dark|light) theme/i }).first();
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await page.waitForTimeout(300);

    // Verify dark theme attribute
    const themeAttr = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(themeAttr).toBe("dark");

    // Scan dark theme
    const scanDark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousDark = scanDark.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousDark).toEqual([]);

    // 3. Test keyboard focus on prompt input
    const promptInput = page.getByPlaceholder(/describe the entity/i);
    await promptInput.focus();
    await expect(promptInput).toBeFocused();
  });

  test("verifies keyboard path on Results and Receipt Drawer", async ({ page }) => {
    // Initialize completed demo run
    const demoRes = await page.request.get("/api/demo/run?complete=true");
    expect(demoRes.ok()).toBe(true);
    const demoData = await demoRes.json();
    const workflowId = demoData.workflow.id || demoData.workflow._id;
    const runId = demoData.run.id || demoData.run._id;

    // Navigate to results
    await page.goto(`/w/${workflowId}/runs/${runId}/results`);
    await page.waitForLoadState("domcontentloaded");

    // Find receipt cell trigger button (ensures records are loaded)
    const cellBtn = page.locator("button[data-receipt-trigger='true']").filter({ visible: true }).first();
    await expect(cellBtn).toBeVisible({ timeout: 10000 });

    // Check axe on Results after ledger records load
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousViolations = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousViolations).toEqual([]);

    await cellBtn.focus();
    await expect(cellBtn).toBeFocused();

    // Press Enter to open receipt drawer via keyboard
    await page.keyboard.press("Enter");

    // Receipt drawer opens
    const drawer = page.locator("[data-testid='receipt-drawer']");
    await expect(drawer).toBeVisible();

    // Verify close button is visible inside dialog
    const closeBtn = drawer.getByRole("button", { name: /close receipt/i });
    await expect(closeBtn).toBeVisible();

    // Press Escape to close via keyboard
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("verifies Tasks and Datasets routes pass axe audit", async ({ page }) => {
    // Tasks page
    await page.goto("/tasks");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(300);
    const scanTasks = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousTasks = scanTasks.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousTasks).toEqual([]);

    // Datasets page
    await page.goto("/datasets");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(300);
    const scanDatasets = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousDatasets = scanDatasets.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousDatasets).toEqual([]);
  });
});
