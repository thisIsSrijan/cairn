import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv, envSchema } from "../../lib/env";

describe("Environment schema and validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const validEnv = {
    MONGODB_URI: "mongodb://localhost:27017",
    MONGODB_DB: "cairn",
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "dummy_key",
    CLOUDINARY_API_SECRET: "dummy_secret",
    GEMINI_API_KEY: "dummy_key",
    GEMINI_MODEL: "gemini-2.5-flash",
    GEMINI_MODEL_LITE: "gemini-2.5-flash-lite",
    APP_URL: "http://localhost:3000",
    DEMO_MODE: "true",
  };

  it("successfully parses valid environment variables", () => {
    expect(envSchema.shape).toHaveProperty("MONGODB_URI");
    const env = validateEnv(validEnv);
    expect(env.MONGODB_URI).toBe("mongodb://localhost:27017");
    expect(env.DEMO_MODE).toBe(true);
    expect(env.GEMINI_MODEL).toBe("gemini-2.5-flash");
  });

  it("fails with readable message when required variables are missing", () => {
    expect(() => validateEnv({})).toThrow(/Invalid environment variables:/);
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
    expect(() => validateEnv({})).toThrow(/GEMINI_API_KEY/);
  });

  it("fails when APP_URL is invalid", () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        APP_URL: "not-a-valid-url",
      })
    ).toThrow(/APP_URL/);
  });
});
