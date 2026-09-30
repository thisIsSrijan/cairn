import type { DiscoverLimits, ExtractParams } from "./types";

export function buildPlannerPrompt(userPrompt: string): string {
  return [
    "You are Cairn Planner, an expert data intelligence architect.",
    "Your objective is to turn the user request into an extraction Blueprint specification.",
    "",
    "User Request:",
    `"${userPrompt}"`,
    "",
    "Rules for the Blueprint:",
    "1. entity: Singular PascalCase entity name (e.g. JobOpening, SponsorOpportunity, HeadphoneModel).",
    "2. intent: Clear single-sentence description of what data is being gathered.",
    "3. fields: Array of between 3 and 12 fields.",
    "   - Every field key MUST be strictly snake_case (lowercase letters, numbers, underscores).",
    "   - label: Human-readable display label.",
    "   - type: Must be one of: 'string', 'number', 'date', 'url', 'email', 'boolean'.",
    "   - required: boolean (true if critical for the record, false otherwise).",
    "   - description: Guidance on what to extract.",
    "4. keyFields: Array of field keys used for deduplication (must contain at least one field key).",
    "5. sources: Array of initial seed sources, typically kind: 'search' with an effective web search query.",
    "6. limits: Sane operational limits with maxSources (up to 12) and maxRecords (up to 100).",
    "",
    "Respond with valid JSON matching the Blueprint schema.",
  ].join("\n");
}

export function buildExtractPrompt(params: ExtractParams): string {
  const fieldsSpec = params.blueprint.fields
    .map(
      (f) =>
        `- ${f.key} (${f.type}${f.required ? ", required" : ""}): ${f.description || f.label}`
    )
    .join("\n");

  return [
    `You are Cairn Extractor. Extract structured records for entity "${params.blueprint.entity}".`,
    "",
    `Source ID: ${params.sourceId}`,
    `Source URL: ${params.url}`,
    "",
    "Target Fields to Extract:",
    fieldsSpec,
    "",
    "MANDATORY RECEIPT RULES:",
    '1. "evidence must be copied verbatim from the text" (exact quotation including punctuation and case).',
    '2. "return null instead of guessing" if a value is not directly supported by the text.',
    "3. confidence must be a number between 0.0 and 1.0 reflecting factual certainty.",
    "4. Return an object with a 'rows' array where each item is a map of field key to { value, evidence, confidence }.",
    "",
    "PAGE TEXT TO EXTRACT FROM:",
    "--- BEGIN TEXT ---",
    params.text,
    "--- END TEXT ---",
  ].join("\n");
}

export function buildDiscoverPrompt(query: string, limits?: DiscoverLimits): string {
  const maxSources = limits?.maxSources ?? 10;
  return [
    `Search the web for up to ${maxSources} authoritative and publicly accessible sources.`,
    `Query: "${query}"`,
    "",
    "Summarise what sources were found and provide relevant source links.",
  ].join("\n");
}

export function buildRepairPrompt(invalidOutput: string, errorMessage: string): string {
  return [
    "The previous response was expected to be valid JSON matching the required schema, but failed validation.",
    `Validation error: ${errorMessage}`,
    "",
    "Previous output:",
    invalidOutput,
    "",
    "Please repair the output and return ONLY valid JSON matching the schema without explanatory markdown fences or conversational text.",
  ].join("\n");
}
