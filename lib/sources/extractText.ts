import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface ExtractedPageText {
  title: string;
  text: string;
  method: "readability" | "cheerio";
}

/**
 * Normalises whitespace in extracted text:
 * - Unifies line breaks to \n
 * - Replaces non-breaking spaces and tabs with single space
 * - Trims each line
 * - Collapses 3 or more consecutive newlines into 2
 * - Trims leading and trailing whitespace
 */
export function normalizeWhitespace(raw: string): string {
  if (!raw) return "";

  return raw
    .replace(/\r\n|\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const UNWANTED_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "aside",
  "iframe",
  "svg",
  "#onetrust-consent-sdk",
  "#onetrust-banner-sdk",
  ".cc-banner",
  "[id*='cookie' i]",
  "[class*='cookie' i]",
  "[id*='consent' i]",
  "[class*='consent' i]",
  "[id*='banner' i]:not([id*='main' i]):not([id*='content' i]):not([id*='title' i])",
  "[class*='banner' i]:not([class*='main' i]):not([class*='content' i]):not([class*='title' i])",
  "[role='dialog']",
  "[role='alertdialog']",
];

/**
 * Cleans HTML content, stripping scripts, navigation, and cookie banners.
 */
function stripUnwantedMarkup(html: string): { cleanedHtml: string; pageTitle: string } {
  const $ = cheerio.load(html);

  const pageTitle =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "";

  // Remove intrusive elements
  $(UNWANTED_SELECTORS.join(", ")).remove();

  return {
    cleanedHtml: $.html(),
    pageTitle,
  };
}

/**
 * Extracts clean textual content from HTML using Mozilla Readability with Cheerio fallback.
 */
export function extractTextFromHtml(html: string, url = "https://cairn.local"): ExtractedPageText {
  if (!html || !html.trim()) {
    return { title: "", text: "", method: "cheerio" };
  }

  // 1. Preprocess and strip unwanted elements (scripts, nav, cookie banners)
  const { cleanedHtml, pageTitle } = stripUnwantedMarkup(html);
  const $preprocessed = cheerio.load(cleanedHtml);

  // 2. Attempt Readability extraction
  try {
    const dom = new JSDOM(cleanedHtml, { url });
    const reader = new Readability(dom.window.document);
    const parsedArticle = reader.parse();

    if (parsedArticle && parsedArticle.textContent && parsedArticle.textContent.trim().length > 30) {
      const cleanTitle = parsedArticle.title || pageTitle;
      let cleanText = normalizeWhitespace(parsedArticle.textContent);

      // If document header was sibling to main content and dropped by Readability, preserve it
      const headerText = normalizeWhitespace($preprocessed("header").text());
      if (headerText && !cleanText.toLowerCase().includes(headerText.toLowerCase())) {
        cleanText = `${headerText}\n\n${cleanText}`;
      }

      return {
        title: cleanTitle.trim(),
        text: cleanText,
        method: "readability",
      };
    }
  } catch {
    // Fall back to Cheerio if Readability crashes on malformed DOM
  }

  // 3. Fallback to Cheerio for non-article / tabular layouts
  const cleanCheerioText = normalizeWhitespace($preprocessed.text());

  return {
    title: pageTitle.trim(),
    text: cleanCheerioText,
    method: "cheerio",
  };
}
