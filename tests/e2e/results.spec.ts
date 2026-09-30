import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Results Dashboard and Receipt Drawer", () => {
  test("renders summary strip, filters records, inspects receipt evidence, and exports data", async ({
    page,
  }) => {
    // 1. Initialize completed demo run with records using page.request to preserve workspace cookie
    const demoRes = await page.request.get("/api/demo/run?complete=true");
    expect(demoRes.ok()).toBe(true);
    const demoData = await demoRes.json();
    const workflowId = demoData.workflow.id || demoData.workflow._id;
    const runId = demoData.run.id || demoData.run._id;

    // 2. Navigate to results screen
    await page.goto(`/w/${workflowId}/runs/${runId}/results`);
    await page.waitForLoadState("domcontentloaded");

    // 3. Verify Summary Strip metrics
    await expect(page.getByText(/records kept/i).first()).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByText(/duplicates merged/i).first()).toBeVisible();

    // 4. Test Search Field
    const searchInput = page.getByPlaceholder(/search records/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Apex");
    // Give debounce a moment to update list
    await page.waitForTimeout(400);

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(400);

    // 5. Test Filters
    // On mobile (< 768px), filters open in a Sheet; on desktop they are inline
    const isMobile = (page.viewportSize()?.width ?? 1024) < 768;
    if (isMobile) {
      const filterBtn = page.getByRole("button", { name: /filters/i });
      await expect(filterBtn).toBeVisible();
      await filterBtn.click();
      const filterSheet = page.getByRole("dialog");
      await expect(filterSheet).toBeVisible();

      // Tap verified filter option
      const verifiedOption = filterSheet.getByRole("button", { name: /^verified$/i });
      await verifiedOption.click();

      // Close filter sheet
      const applyBtn = filterSheet.getByRole("button", { name: /apply filters/i });
      if (await applyBtn.isVisible()) {
        await applyBtn.click();
      } else {
        const closeBtn = filterSheet.getByRole("button", { name: /close/i });
        await closeBtn.click();
      }
    } else {
      const verifiedOption = page.getByRole("button", { name: /^verified$/i });
      if (await verifiedOption.isVisible()) {
        await verifiedOption.click();
      }
    }

    // 6. Test Cell Button Tap -> Opens Receipt Drawer
    // Every cell value is an interactive button
    const cellBtn = page.locator("button[data-receipt-trigger='true']").filter({ visible: true }).first();
    await expect(cellBtn).toBeVisible({ timeout: 10000 });
    await cellBtn.click();

    // Verify Receipt Drawer is open
    const receiptDrawer = page.locator("[data-testid='receipt-drawer']");
    await expect(receiptDrawer).toBeVisible({ timeout: 10000 });

    // Check receipt contents
    await expect(receiptDrawer.getByText(/verdict/i).first()).toBeVisible();
    await expect(receiptDrawer.getByText(/confidence/i).first()).toBeVisible();
    await expect(receiptDrawer.getByText(/evidence snapshot/i).first()).toBeVisible();

    // Close Receipt Drawer
    const closeDrawerBtn = receiptDrawer.getByRole("button", { name: /close receipt/i });
    await closeDrawerBtn.click();
    await expect(receiptDrawer).not.toBeVisible();

    // 7. Test Export Sheet
    const exportBtn = page.getByRole("button", { name: /^export$/i }).filter({ visible: true }).first();
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    const exportSheet = page.getByRole("dialog");
    await expect(exportSheet).toBeVisible();
    await expect(exportSheet.getByText(/export dataset/i)).toBeVisible();
    await expect(
      exportSheet.getByText(/Every field includes a corresponding provenance source URL column/i)
    ).toBeVisible();

    // Click Generate Export
    const generateBtn = exportSheet.getByRole("button", { name: /generate export/i });
    await generateBtn.click();

    // Verify progress or completed download action
    await expect(
      exportSheet.getByRole("link", { name: /download/i })
    ).toBeVisible({ timeout: 10000 });

    // Close export dialog
    const closeExportBtn = exportSheet.getByRole("button", { name: /close/i }).first();
    await closeExportBtn.click();
    await expect(exportSheet).not.toBeVisible();

    // 8. Verify No Horizontal Overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 9. Axe accessibility audit
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const seriousViolations = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousViolations).toEqual([]);
  });
});
