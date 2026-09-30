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
      throw new Error(
        `Missing fixture for extract: "${params.url}". Looked in ${this.fixturesDir} for slug "${slug}".`
      );
    }

    return rows;
  }
}
