import fs from "fs";
import path from "path";
import { blueprintSchema, type Blueprint } from "@/lib/db/schemas";
import type {
  LlmClient,
  DiscoverLimits,
  DiscoverResult,
  ExtractParams,
  ExtractedRow,
} from "./types";

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class FakeLlmClient implements LlmClient {
  private fixturesDir: string;

  constructor(fixturesDir?: string) {
    this.fixturesDir =
      fixturesDir || path.resolve(process.cwd(), "tests/fixtures/llm");
  }

  private loadAllFixtures(): Array<{ filename: string; content: Record<string, unknown> }> {
    if (!fs.existsSync(this.fixturesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.fixturesDir).filter((f) => f.endsWith(".json"));
    return files.map((filename) => {
      const fullPath = path.join(this.fixturesDir, filename);
      const raw = fs.readFileSync(fullPath, "utf-8");
      return {
        filename,
        content: JSON.parse(raw) as Record<string, unknown>,
      };
    });
  }

  async planBlueprint(prompt: string): Promise<Blueprint> {
    const slug = toSlug(prompt);
    const fixtures = this.loadAllFixtures();

    // 1. Direct slug match on filename
    const directFile = fixtures.find(
      (f) =>
        f.filename === `plan-${slug}.json` ||
        f.filename === `${slug}.json`
    );

    if (directFile) {
      const blueprintData = (directFile.content.blueprint ?? directFile.content) as unknown;
      return blueprintSchema.parse(blueprintData);
    }

    // 2. Match by prompt content inside JSON
    const contentMatch = fixtures.find(
      (f) =>
        typeof f.content.prompt === "string" &&
        f.content.prompt.toLowerCase().trim() === prompt.toLowerCase().trim()
    );

    if (contentMatch) {
      const blueprintData = (contentMatch.content.blueprint ?? contentMatch.content) as unknown;
      return blueprintSchema.parse(blueprintData);
    }

    // 3. Fallback: match by keyword overlap
    const promptWords = toSlug(prompt).split("-").filter((w) => w.length >= 3);
    const planFixtures = fixtures.filter(
      (f) =>
        f.filename.startsWith("plan-") ||
        (f.content.blueprint && typeof f.content.blueprint === "object")
    );

    let bestPlanMatch: { filename: string; content: Record<string, unknown> } | null = null;
    let highestPlanScore = 0;

    for (const f of planFixtures) {
      const hay = (
        f.filename +
        " " +
        (typeof f.content.prompt === "string" ? f.content.prompt : "")
      ).toLowerCase();
      let score = 0;
      for (const w of promptWords) {
        if (hay.includes(w)) {
          score += 1;
        }
      }
      const hasDistinctive = promptWords.some((w) =>
        [
          "headphone",
          "headphones",
          "noise",
          "sponsor",
          "sponsorship",
          "sponsors",
          "developer",
          "developers",
          "job",
          "jobs",
          "lucknow",
        ].includes(w) && hay.includes(w)
      );

      if ((score >= 2 || hasDistinctive) && score > highestPlanScore) {
        highestPlanScore = score;
        bestPlanMatch = f;
      }
    }

    if (bestPlanMatch) {
      const blueprintData = (bestPlanMatch.content.blueprint ?? bestPlanMatch.content) as unknown;
      return blueprintSchema.parse(blueprintData);
    }

    throw new Error(
      `Missing fixture for planBlueprint: "${prompt}". Looked in ${this.fixturesDir} for slug "${slug}".`
    );
  }

  async discover(query: string, limits?: DiscoverLimits): Promise<DiscoverResult> {
    const slug = toSlug(query);
    const fixtures = this.loadAllFixtures();

    const directFile = fixtures.find(
      (f) =>
        f.filename === `discover-${slug}.json` ||
        f.filename === `${slug}.json`
    );

    let res: DiscoverResult | null = null;

    if (directFile) {
      res = (directFile.content.result ?? directFile.content) as DiscoverResult;
    } else {
      const contentMatch = fixtures.find(
        (f) =>
          typeof f.content.query === "string" &&
          f.content.query.toLowerCase().trim() === query.toLowerCase().trim()
      );
      if (contentMatch) {
        res = (contentMatch.content.result ?? contentMatch.content) as DiscoverResult;
      }
    }

    if (!res) {
      // 3. Fallback: match by keyword overlap
      const queryWords = toSlug(query).split("-").filter((w) => w.length >= 3);
      const discoverFixtures = fixtures.filter(
        (f) =>
          f.filename.startsWith("discover-") ||
          (f.content.result && typeof f.content.result === "object")
      );

      let bestDiscoverMatch: { filename: string; content: Record<string, unknown> } | null = null;
      let highestDiscoverScore = 0;

      for (const f of discoverFixtures) {
        const hay = (
          f.filename +
          " " +
          (typeof f.content.query === "string" ? f.content.query : "")
        ).toLowerCase();
        let score = 0;
        for (const w of queryWords) {
          if (hay.includes(w)) {
            score += 1;
          }
        }
        const hasDistinctive = queryWords.some((w) =>
          [
            "headphone",
            "headphones",
            "noise",
            "sponsor",
            "sponsorship",
            "sponsors",
            "hackathon",
            "developer",
            "developers",
            "job",
            "jobs",
            "lucknow",
          ].includes(w) && hay.includes(w)
        );

        if ((score >= 2 || hasDistinctive) && score > highestDiscoverScore) {
          highestDiscoverScore = score;
          bestDiscoverMatch = f;
        }
      }

      if (bestDiscoverMatch) {
        res = (bestDiscoverMatch.content.result ?? bestDiscoverMatch.content) as DiscoverResult;
      }
    }

    if (!res) {
      throw new Error(
        `Missing fixture for discover: "${query}". Looked in ${this.fixturesDir} for slug "${slug}".`
      );
    }

    if (limits?.maxSources && res.urls.length > limits.maxSources) {
      return {
        summary: res.summary,
        urls: res.urls.slice(0, limits.maxSources),
      };
    }

    return res;
  }

  async extract(params: ExtractParams): Promise<ExtractedRow[]> {
    const slug = toSlug(params.url);
    const fixtures = this.loadAllFixtures();

    const directFile = fixtures.find(
      (f) =>
        f.filename === `extract-${slug}.json` ||
        f.filename === `${slug}.json`
    );

    let rows: ExtractedRow[] | null = null;

    if (directFile) {
      rows = (directFile.content.rows ?? directFile.content) as ExtractedRow[];
    } else {
      const contentMatch = fixtures.find(
        (f) =>
          (typeof f.content.url === "string" && f.content.url === params.url) ||
          (typeof f.content.sourceId === "string" && f.content.sourceId === params.sourceId)
      );
      if (contentMatch) {
        rows = (contentMatch.content.rows ?? contentMatch.content) as ExtractedRow[];
      }
    }

    if (!rows) {
      // 3. Fallback: match by URL path tokens
      const urlLower = params.url.toLowerCase();
      const extractFixtures = fixtures.filter(
        (f) =>
          f.filename.startsWith("extract-") ||
          (Array.isArray(f.content.rows) && f.content.rows.length > 0)
      );

      const segments = [
        "sony",
        "bose",
        "cloudcorp",
        "devtools",
        "lucknow-dev-1",
        "lucknow-dev-2",
        "page1",
        "page2",
        "page3",
      ];

      for (const seg of segments) {
        if (urlLower.includes(seg)) {
          const match = extractFixtures.find((f) => {
            const fixtureUrl = typeof f.content.url === "string" ? f.content.url.toLowerCase() : "";
            const fixtureSlug = f.filename.toLowerCase();
            return fixtureUrl.includes(seg) || fixtureSlug.includes(seg);
          });
          if (match) {
            rows = (match.content.rows ?? match.content) as ExtractedRow[];
            break;
          }
        }
      }
    }

    if (!rows) {
      throw new Error(
        `Missing fixture for extract: "${params.url}". Looked in ${this.fixturesDir} for slug "${slug}".`
      );
    }

    return rows;
  }
}
