import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { extractTextFromHtml } from "@/lib/sources/extractText";

const fixturesDir = path.resolve(__dirname, "../../fixtures/html");

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("HTML text extractor", () => {
  it("extracts clean article title and body using Readability", () => {
    const html = readFixture("article.html");
    const result = extractTextFromHtml(html, "https://cairn.io/blog/verification");

    expect(result.title).toBe("Engineering at Cairn: Verification First");
    expect(result.text).toContain("In automated web data intelligence, extraction without receipts is guesswork.");
    expect(result.text).toContain("Every cell must carry an indisputable receipt");

    // Nav, cookies, script, sidebar should be stripped
    expect(result.text).not.toContain("Analytics tracker initialized");
    expect(result.text).not.toContain("We use cookies to improve your ledger experience");
    expect(result.text).not.toContain("Accept all cookies");
  });

  it("extracts structured job listing details accurately", () => {
    const html = readFixture("job-listing.html");
    const result = extractTextFromHtml(html, "https://jobs.example.com/senior-fe");

    expect(result.title).toContain("Senior Frontend Engineer");
    expect(result.text).toContain("Cairn Systems");
    expect(result.text).toContain("Lucknow, India (Remote Available)");
    expect(result.text).toContain("INR 24,00,000 to 32,00,000");
    expect(result.text).toContain("Build high-performance web ledger interfaces");
    expect(result.text).toContain("At least 4 years of TypeScript production experience.");
  });

  it("thoroughly strips intrusive cookie banners and consent overlays", () => {
    const html = readFixture("cookie-banner.html");
    const result = extractTextFromHtml(html, "https://privacy-test.org");

    expect(result.text).toContain("Core Document Title");
    expect(result.text).toContain("This is the legitimate body content that must remain intact.");

    // Banners must be completely stripped
    expect(result.text).not.toContain("onetrust");
    expect(result.text).not.toContain("Cookie Preferences");
    expect(result.text).not.toContain("We track your browsing habits");
    expect(result.text).not.toContain("Got it!");
  });

  it("falls back cleanly to Cheerio on tabular catalog without standard article container", () => {
    const html = readFixture("table-data.html");
    const result = extractTextFromHtml(html, "https://summit.org/sponsors");

    expect(result.title).toContain("Event Sponsor Directory");
    expect(result.text).toContain("Vanguard Systems");
    expect(result.text).toContain("Diamond");
    expect(result.text).toContain("$50,000");
    expect(result.text).toContain("Apex Data Corp");
    expect(result.text).toContain("Beacon Labs");
  });

  it("normalises excessive whitespace, tabs, and newlines", () => {
    const rawHtml = `
      <html>
        <body>
          <h1>Heading    With    Gaps</h1>
          <p>Line 1   with   spaces.</p>
          <br><br><br><br>
          <p>Line 2   after   line-breaks.</p>
        </body>
      </html>
    `;
    const result = extractTextFromHtml(rawHtml, "https://example.com/spacing");

    // Whitespace should be collapsed, max 2 consecutive newlines
    expect(result.text).not.toMatch(/[ ]{2,}/);
    expect(result.text).not.toMatch(/\n{3,}/);
    expect(result.text).toContain("Line 1 with spaces.");
  });

  it("handles empty or minimal HTML gracefully", () => {
    const result = extractTextFromHtml("<html><body></body></html>", "https://empty.org");
    expect(result.text).toBe("");
  });
});
