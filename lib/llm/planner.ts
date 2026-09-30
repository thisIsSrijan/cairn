import { blueprintSchema, type Blueprint, type BlueprintField } from "@/lib/db/schemas";
import { LlmError, type LlmClient, type PlannerRefusal } from "./types";

export type { PlannerRefusal };

export type PlannerResult =
  | { ok: true; blueprint: Blueprint }
  | { ok: false; refusal: PlannerRefusal };

export function isPlannerRefusal(val: unknown): val is PlannerRefusal {
  return (
    typeof val === "object" &&
    val !== null &&
    (val as PlannerRefusal).refused === true &&
    typeof (val as PlannerRefusal).reason === "string"
  );
}

function toSnakeCase(str: string): string {
  return str
    .trim()
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");
}

const PRIVATE_PII_PATTERNS = [
  /\b(personal|private)\s+(phone|cell|mobile|whatsapp)\s*(numbers?|contacts?)/i,
  /\b(home|residential)\s+(address|addresses)/i,
  /\b(personal|private)\s+(email|emails)\s+of\s+(private\s+)?(individuals|citizens|people|employees)/i,
  /\b(social\s+security|ssn|aadhaar|national\s+id)\s*(number|numbers)?/i,
  /\b(private|personal)\s+(medical|health)\s+(records|data)/i,
  /\b(private|personal)\s+bank\s+(account|accounts|details)/i,
  /\bdox\b/i,
];

export function checkPromptRefusal(prompt: string): PlannerRefusal | null {
  for (const pattern of PRIVATE_PII_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        refused: true,
        reason:
          "Cairn cannot collect personal contact or private personal data about private individuals. Requests must focus on publicly available organization, business, or market data.",
      };
    }
  }
  return null;
}

export function validateAndClampBlueprint(raw: unknown): Blueprint {
  if (typeof raw !== "object" || raw === null) {
    throw new LlmError("Invalid blueprint: expected an object", {
      code: "INVALID_BLUEPRINT",
    });
  }

  const rawObj = raw as Record<string, unknown>;
  const rawFields = Array.isArray(rawObj.fields) ? rawObj.fields : [];

  if (rawFields.length < 3) {
    throw new LlmError(
      `Blueprint must have between 3 and 12 fields, got ${rawFields.length}`,
      { code: "INVALID_FIELD_COUNT" }
    );
  }

  // Normalise field keys to snake_case and track mapping
  const keyMap = new Map<string, string>();
  const normalisedFields: BlueprintField[] = rawFields.map((f: unknown) => {
    const fieldObj = (typeof f === "object" && f !== null ? f : {}) as Record<string, unknown>;
    const rawKey = typeof fieldObj.key === "string" ? fieldObj.key : "field";
    const snakeKey = toSnakeCase(rawKey) || "field";
    keyMap.set(rawKey, snakeKey);

    return {
      key: snakeKey,
      label: typeof fieldObj.label === "string" ? fieldObj.label : snakeKey,
      type: (typeof fieldObj.type === "string" ? fieldObj.type : "string") as BlueprintField["type"],
      required: Boolean(fieldObj.required),
      description: typeof fieldObj.description === "string" ? fieldObj.description : "",
    };
  });

  // Clamp fields to maximum 12
  const clampedFields = normalisedFields.slice(0, 12);
  const validKeys = new Set(clampedFields.map((f) => f.key));

  // Map and normalise keyFields
  const rawKeyFields = Array.isArray(rawObj.keyFields) ? rawObj.keyFields : [];
  const mappedKeyFields: string[] = [];

  for (const kf of rawKeyFields) {
    if (typeof kf === "string") {
      const mapped = keyMap.get(kf) || toSnakeCase(kf);
      if (validKeys.has(mapped) && !mappedKeyFields.includes(mapped)) {
        mappedKeyFields.push(mapped);
      }
    }
  }

  // Ensure at least one keyField
  if (mappedKeyFields.length === 0) {
    const firstRequired = clampedFields.find((f) => f.required);
    mappedKeyFields.push(firstRequired ? firstRequired.key : clampedFields[0].key);
  }

  // Clamp limits to maximums: maxSources <= 12, maxRecords <= 100
  const rawLimits = (typeof rawObj.limits === "object" && rawObj.limits !== null
    ? rawObj.limits
    : {}) as Record<string, unknown>;

  const rawMaxSources = typeof rawLimits.maxSources === "number" ? rawLimits.maxSources : 8;
  const rawMaxRecords = typeof rawLimits.maxRecords === "number" ? rawLimits.maxRecords : 30;

  const clampedLimits = {
    maxSources: Math.min(Math.max(1, Math.floor(rawMaxSources)), 12),
    maxRecords: Math.min(Math.max(1, Math.floor(rawMaxRecords)), 100),
  };

  const rawSources = Array.isArray(rawObj.sources) && rawObj.sources.length > 0
    ? rawObj.sources
    : [{ kind: "search", query: String(rawObj.intent || rawObj.entity || "data") }];

  const candidateBlueprint = {
    intent: typeof rawObj.intent === "string" ? rawObj.intent : "Gather data records",
    entity: typeof rawObj.entity === "string" ? rawObj.entity : "Record",
    fields: clampedFields,
    keyFields: mappedKeyFields,
    sources: rawSources,
    limits: clampedLimits,
  };

  const parsed = blueprintSchema.safeParse(candidateBlueprint);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new LlmError(`Blueprint validation failed: ${issues}`, {
      code: "INVALID_BLUEPRINT_SCHEMA",
      cause: parsed.error,
    });
  }

  return parsed.data;
}

export async function planUserPrompt(
  prompt: string,
  client: LlmClient
): Promise<PlannerResult> {
  const refusal = checkPromptRefusal(prompt);
  if (refusal) {
    return { ok: false, refusal };
  }

  const rawBlueprint = await client.planBlueprint(prompt);
  const blueprint = validateAndClampBlueprint(rawBlueprint);
  return { ok: true, blueprint };
}

export const planBlueprint = planUserPrompt;
