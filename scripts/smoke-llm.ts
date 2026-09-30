import fs from "fs";
import path from "path";
import { GeminiClient } from "@/lib/llm/gemini";
import { planUserPrompt } from "@/lib/llm/planner";

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "mock_gemini_api_key_placeholder") {
    console.error(
      "GEMINI_API_KEY is not configured with a valid key. Please set GEMINI_API_KEY in .env before running this smoke test."
    );
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL;
  if (!model) {
    console.error("GEMINI_MODEL is not set in environment or .env file.");
    process.exit(1);
  }

  const prompt = process.argv[2] || "job openings for junior developers in Lucknow";

  console.log(`Running smoke test with prompt: "${prompt}"`);
  console.log(`Model: ${model}`);

  const client = new GeminiClient({ apiKey, model });
  const result = await planUserPrompt(prompt, client);

  if (!result.ok) {
    console.log("\nPlanner Refusal:");
    console.log(result.refusal.reason);
  } else {
    console.log("\nGenerated Blueprint:");
    console.log(JSON.stringify(result.blueprint, null, 2));
  }
}

main().catch((err: unknown) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
