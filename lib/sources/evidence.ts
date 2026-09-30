export interface EvidenceLocation {
  start: number;
  end: number;
}

const SINGLE_QUOTE_SET = "'\u2018\u2019\u201A\u201B`";
const DOUBLE_QUOTE_SET = '"\u201C\u201D\u201E\u201F\u00AB\u00BB';

// Escaped character classes for regex matching
const SINGLE_QUOTE_CLASS = "['\u2018\u2019\u201A\u201B`]";
const DOUBLE_QUOTE_CLASS = '["\u201C\u201D\u201E\u201F\u00AB\u00BB]';

/**
 * Builds an exact, non-fuzzy regular expression that:
 * 1. Collapses contiguous whitespace into \s+
 * 2. Unifies curly and straight quote variations
 * 3. Escapes regex metacharacters
 * 4. Enables case-insensitive matching
 */
function buildEvidenceRegex(quote: string): RegExp | null {
  const trimmed = quote.trim();
  if (!trimmed) {
    return null;
  }

  // Collapse internal whitespace down to single space tokens
  const cleanTokens = trimmed.replace(/\s+/g, " ");

  let pattern = "";
  for (const ch of cleanTokens) {
    if (SINGLE_QUOTE_SET.includes(ch)) {
      pattern += SINGLE_QUOTE_CLASS;
    } else if (DOUBLE_QUOTE_SET.includes(ch)) {
      pattern += DOUBLE_QUOTE_CLASS;
    } else if (ch === " ") {
      pattern += "\\s+";
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      pattern += `\\${ch}`;
    } else {
      pattern += ch;
    }
  }

  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/**
 * Locates the exact character slice [start, end) of a quote in the snapshot text.
 * Returns null if the quote cannot be verified verbatim.
 *
 * Core USP guarantee: Code, never the model, verifies that quotes appear verbatim.
 * Never uses fuzzy matching or Levenshtein distance.
 */
export function locate(snapshotText: string, quote: string): EvidenceLocation | null {
  if (!snapshotText || typeof snapshotText !== "string" || !snapshotText.trim()) {
    return null;
  }
  if (!quote || typeof quote !== "string" || !quote.trim()) {
    return null;
  }

  const regex = buildEvidenceRegex(quote);
  if (!regex) {
    return null;
  }

  const match = regex.exec(snapshotText);
  if (!match || match.index === undefined) {
    return null;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
  };
}

/**
 * Verifies whether a claimed evidence quote appears verbatim in the snapshot text.
 * Core USP check for Cairn data intelligence receipts.
 */
export function verifyEvidence(snapshotText: string, quote: string): boolean {
  return locate(snapshotText, quote) !== null;
}
