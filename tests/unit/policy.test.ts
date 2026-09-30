import { describe, it, expect } from "vitest";
import path from "path";
import { checkText, scanRepository } from "../../lib/policy/ban-check";

describe("Policy ban checker", () => {
  it("detects em-dash violations at runtime", () => {
    const emDash = String.fromCharCode(0x2014);
    const content = `const text = "Prefix ${emDash} suffix";`;
    const violations = checkText(content, "test.ts");

    expect(violations.length).toBe(1);
    expect(violations[0]?.type).toBe("em-dash");
    expect(violations[0]?.codePoint).toBe("U+2014");
    expect(violations[0]?.line).toBe(1);
  });

  it("detects en-dash violations at runtime", () => {
    const enDash = String.fromCharCode(0x2013);
    const content = `const range = "10 ${enDash} 20";`;
    const violations = checkText(content, "test.ts");

    expect(violations.length).toBe(1);
    expect(violations[0]?.type).toBe("en-dash");
    expect(violations[0]?.codePoint).toBe("U+2013");
    expect(violations[0]?.line).toBe(1);
  });

  it("detects emoji code points at runtime", () => {
    const rocket = String.fromCodePoint(0x1F680);
    const content = `// launch ${rocket}`;
    const violations = checkText(content, "test.ts");

    expect(violations.length).toBe(1);
    expect(violations[0]?.type).toBe("emoji");
    expect(violations[0]?.line).toBe(1);
  });

  it("permits standard hyphens, colons, and commas", () => {
    const content = 'const valid = "hyphen-separated: value, item (detail)";';
    const violations = checkText(content, "test.ts");

    expect(violations).toHaveLength(0);
  });

  it("verifies repository contains zero em-dashes, en-dashes, and emojis", () => {
    const rootDir = path.resolve(__dirname, "../../");
    const violations = scanRepository(rootDir);

    if (violations.length > 0) {
      const summary = violations
        .map(
          (v) =>
            `${v.filePath}:${v.line}:${v.column} [${v.type} ${v.codePoint}]: "${v.snippet}"`
        )
        .join("\n");
      expect.fail(
        `Found ${violations.length} policy ban violation(s):\n${summary}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
