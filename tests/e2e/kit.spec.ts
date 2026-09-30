import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("/kit component showcase", () => {
  test("renders without horizontal overflow and passes axe accessibility audit", async ({
    page,
  }) => {
    await page.goto("/kit");
    await page.waitForLoadState("domcontentloaded");

    // Verify page title and main landmark
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Design System Kit");

    // Check horizontal scroll / overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Run axe accessibility audit for WCAG AA compliance
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const seriousViolations = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );

    expect(seriousViolations).toEqual([]);
  });

  test("interacts with sheet drawer and dock navigation", async ({ page }) => {
    await page.goto("/kit");

    // Open sheet
    const openSheetBtn = page.getByRole("button", { name: "Open Receipt Drawer" });
    await openSheetBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Close sheet via close button
    const closeBtn = page.getByRole("button", { name: "Close sheet" });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();

    // Verify dock navigation button
    const tasksDockBtn = page.getByRole("button", { name: "Tasks" });
    await tasksDockBtn.click();
    await expect(tasksDockBtn).toHaveAttribute("aria-current", "page");
  });
});
