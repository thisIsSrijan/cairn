import fs from "fs";
import path from "path";

export interface PolicyViolation {
  filePath: string;
  line: number;
  column: number;
  type: "em-dash" | "en-dash" | "emoji";
  char: string;
  codePoint: string;
  snippet: string;
}

const DASH_EM = 0x2014; // em dash
const DASH_EN = 0x2013; // en dash

// Extended pictographics and regional indicator flag pairs
const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;

export function checkText(content: string, filePath = "<inline>"): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) {
      continue;
    }

    let charIndex = 0;
    for (const ch of line) {
      const code = ch.codePointAt(0);
      if (!code) {
        charIndex += ch.length;
        continue;
      }

      if (code === DASH_EM) {
        violations.push({
          filePath,
          line: lineIndex + 1,
          column: charIndex + 1,
          type: "em-dash",
          char: ch,
          codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
          snippet: line.trim(),
        });
      } else if (code === DASH_EN) {
        violations.push({
          filePath,
          line: lineIndex + 1,
          column: charIndex + 1,
          type: "en-dash",
          char: ch,
          codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
          snippet: line.trim(),
        });
      } else if (EMOJI_REGEX.test(ch)) {
        violations.push({
          filePath,
          line: lineIndex + 1,
          column: charIndex + 1,
          type: "emoji",
          char: ch,
          codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
          snippet: line.trim(),
        });
      }

      charIndex += ch.length;
    }
  }

  return violations;
}

const DEFAULT_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
  ".agents",
]);

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "skills-lock.json",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
]);

export function findFilesToScan(rootDir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        if (LOCKFILE_NAMES.has(entry.name)) {
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) {
          continue;
        }

        const topDir = relativePath.split(path.sep)[0] ?? "";
        const isTargetDir = ["app", "components", "lib", "tests"].includes(topDir);
        const isMarkdown = ext === ".md";

        if (isTargetDir || isMarkdown) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return files;
}

export function scanRepository(rootDir: string): PolicyViolation[] {
  const files = findFilesToScan(rootDir);
  const violations: PolicyViolation[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(rootDir, file);
    const fileViolations = checkText(content, relativePath);
    violations.push(...fileViolations);
  }

  return violations;
}
