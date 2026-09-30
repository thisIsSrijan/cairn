import { z } from "zod";

export const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().min(1, "MONGODB_DB is required").default("cairn"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().min(1, "GEMINI_MODEL is required"),
  GEMINI_MODEL_LITE: z.string().min(1, "GEMINI_MODEL_LITE is required"),
  APP_URL: z.string().url("APP_URL must be a valid URL").default("http://localhost:3000"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env
): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const message = [
      "Invalid environment variables:",
      errorDetails,
      "Please verify your .env file against .env.example.",
    ].join("\n");

    throw new Error(message);
  }

  return result.data;
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}
