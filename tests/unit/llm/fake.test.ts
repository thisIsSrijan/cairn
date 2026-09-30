import { describe, it, expect } from "vitest";
import { FakeLlmClient } from "@/lib/llm/fake";

describe("FakeLlmClient", () => {
  const client = new FakeLlmClient();

  it("returns deterministic Blueprint for junior developers prompt", async () => {
    const blueprint = await client.planBlueprint("job openings for junior developers in Lucknow");
    expect(blueprint.entity).toBe("JobOpening");
    expect(blueprint.fields.length).toBeGreaterThanOrEqual(3);
    expect(blueprint.keyFields).toContain("job_title");
  });

  it("returns deterministic Blueprint for tech fest sponsors prompt", async () => {
    const blueprint = await client.planBlueprint("sponsorship opportunities for a college tech fest");
    expect(blueprint.entity).toBe("SponsorOpportunity");
    expect(blueprint.keyFields).toContain("company_name");
  });

  it("returns deterministic Blueprint for headphones pricing prompt", async () => {
    const blueprint = await client.planBlueprint("pricing of noise-cancelling headphones");
    expect(blueprint.entity).toBe("HeadphoneModel");
    expect(blueprint.keyFields).toContain("model_name");
  });

  it("returns deterministic discover results", async () => {
    const res = await client.discover("junior software developer jobs Lucknow hiring", { maxSources: 5 });
    expect(res.summary).toContain("Lucknow");
    expect(res.urls.length).toBeGreaterThan(0);
    expect(res.urls[0].url).toContain("https://");
  });

  it("returns deterministic extract rows", async () => {
    const blueprint = await client.planBlueprint("job openings for junior developers in Lucknow");
    const rows = await client.extract({
      blueprint,
      sourceId: "src_123",
      url: "https://example.com/jobs/lucknow-dev-1",
      text: "We are seeking a Junior Full Stack Engineer...",
    });

    expect(rows.length).toBe(1);
    expect(rows[0].job_title).toBeDefined();
    expect(rows[0].job_title.value).toBe("Junior Full Stack Engineer");
    expect(rows[0].job_title.evidence).toContain("Junior Full Stack Engineer");
    expect(rows[0].job_title.confidence).toBeGreaterThan(0.9);
  });

  it("throws a clear and descriptive error when a fixture is missing", async () => {
    await expect(
      client.planBlueprint("completely non-existent fixture query 999xyz")
    ).rejects.toThrow(/missing fixture for planBlueprint/i);

    await expect(
      client.discover("non-existent search query 999xyz")
    ).rejects.toThrow(/missing fixture for discover/i);

    const blueprint = await client.planBlueprint("job openings for junior developers in Lucknow");
    await expect(
      client.extract({
        blueprint,
        sourceId: "src_unknown",
        url: "https://unknown-example.com/no-such-page",
        text: "some text",
      })
    ).rejects.toThrow(/missing fixture for extract/i);

    const emptyClient = new FakeLlmClient("/tmp/empty-dir-that-does-not-exist-xyz");
    await expect(emptyClient.planBlueprint("any prompt")).rejects.toThrow(/missing fixture/i);
  });
});
