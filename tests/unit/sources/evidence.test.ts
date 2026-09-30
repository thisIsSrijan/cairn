import { describe, it, expect } from "vitest";
import { verifyEvidence, locate } from "@/lib/sources/evidence";

describe("Evidence verification (USP)", () => {
  const sampleSnapshot = [
    "Cairn Systems - Engineering Ledger",
    "We are looking for a Senior Frontend Engineer to join our team in Lucknow, India.",
    "Salary: INR 24,00,000 to 32,00,000 per annum.",
    'Quote: "Every cell carries its receipt."',
    "Contact: careers@cairn.io for inquiries (Reference: [ENG-2026]).",
  ].join("\n");

  it("verifies exact verbatim quote and locates character range", () => {
    const quote = "Senior Frontend Engineer";
    const isValid = verifyEvidence(sampleSnapshot, quote);
    expect(isValid).toBe(true);

    const location = locate(sampleSnapshot, quote);
    expect(location).not.toBeNull();
    if (location) {
      expect(sampleSnapshot.slice(location.start, location.end)).toBe(quote);
    }
  });

  it("matches across whitespace differences (spaces, tabs, newlines)", () => {
    const textWithWhitespace = "Requirements:\n\n  At least   4 years   of TypeScript  experience.";
    const cleanQuote = "At least 4 years of TypeScript experience.";

    expect(verifyEvidence(textWithWhitespace, cleanQuote)).toBe(true);

    const location = locate(textWithWhitespace, cleanQuote);
    expect(location).not.toBeNull();
    if (location) {
      const extractedSpan = textWithWhitespace.slice(location.start, location.end);
      expect(extractedSpan).toContain("At least");
      expect(extractedSpan).toContain("TypeScript");
    }
  });

  it("normalises smart quotes and straight quotes bidirectionally", () => {
    // Snapshot has smart double quotes
    const textWithSmartQuotes = 'The document stated: “Every cell carries its receipt.”';
    const quoteWithStraight = '"Every cell carries its receipt."';

    expect(verifyEvidence(textWithSmartQuotes, quoteWithStraight)).toBe(true);
    const loc1 = locate(textWithSmartQuotes, quoteWithStraight);
    expect(loc1).not.toBeNull();

    // Snapshot has straight apostrophe, quote has curved apostrophe
    const textWithStraightApos = "Author: O'Reilly Media";
    const quoteWithCurvedApos = "O\u2019Reilly Media";

    expect(verifyEvidence(textWithStraightApos, quoteWithCurvedApos)).toBe(true);
  });

  it("performs case-insensitive verification", () => {
    const quote = "lucknow, india";
    expect(verifyEvidence(sampleSnapshot, quote)).toBe(true);

    const location = locate(sampleSnapshot, quote);
    expect(location).not.toBeNull();
    if (location) {
      expect(sampleSnapshot.slice(location.start, location.end)).toBe("Lucknow, India");
    }
  });

  it("fails when model hallucinates additional words (partial quote fails)", () => {
    // Snapshot only has "Senior Frontend Engineer"
    const hallucinatedQuote = "Lead Senior Frontend Engineer";
    expect(verifyEvidence(sampleSnapshot, hallucinatedQuote)).toBe(false);
    expect(locate(sampleSnapshot, hallucinatedQuote)).toBeNull();
  });

  it("fails when words are spliced together across gaps without original text", () => {
    // Snapshot has "Senior Frontend Engineer to join our team in Lucknow, India."
    const splicedQuote = "Senior Frontend Engineer Lucknow India";
    expect(verifyEvidence(sampleSnapshot, splicedQuote)).toBe(false);
    expect(locate(sampleSnapshot, splicedQuote)).toBeNull();
  });

  it("fails when quote only exists in a completely different page", () => {
    const otherPageQuote = "Series B valuation announced at 500 million dollars";
    expect(verifyEvidence(sampleSnapshot, otherPageQuote)).toBe(false);
    expect(locate(sampleSnapshot, otherPageQuote)).toBeNull();
  });

  it("fails on empty or whitespace-only quotes", () => {
    expect(verifyEvidence(sampleSnapshot, "")).toBe(false);
    expect(verifyEvidence(sampleSnapshot, "   ")).toBe(false);
    expect(verifyEvidence(sampleSnapshot, "\n\t ")).toBe(false);

    expect(locate(sampleSnapshot, "")).toBeNull();
    expect(locate(sampleSnapshot, "   ")).toBeNull();
  });

  it("fails when snapshot text itself is empty", () => {
    expect(verifyEvidence("", "Senior Frontend Engineer")).toBe(false);
    expect(locate("", "Senior Frontend Engineer")).toBeNull();
  });

  it("safely handles quotes containing regex special characters", () => {
    const specialQuote = "(Reference: [ENG-2026])";
    expect(verifyEvidence(sampleSnapshot, specialQuote)).toBe(true);

    const location = locate(sampleSnapshot, specialQuote);
    expect(location).not.toBeNull();
    if (location) {
      expect(sampleSnapshot.slice(location.start, location.end)).toBe(specialQuote);
    }
  });

  it("never fuzzy matches typos or near-words (strict verification)", () => {
    // Single character typo must be rejected
    const typoQuote = "Senior Frontnd Engineer";
    expect(verifyEvidence(sampleSnapshot, typoQuote)).toBe(false);
    expect(locate(sampleSnapshot, typoQuote)).toBeNull();

    const wrongSalary = "INR 24,00,000 to 35,00,000";
    expect(verifyEvidence(sampleSnapshot, wrongSalary)).toBe(false);
  });
});
