import { z } from "zod";

/**
 * Server environment schema.
 * These variables are secret and must only be accessed in Node.js server runtime.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GROQ_MODEL: z.string().min(1).default("qwen/qwen3.8-27b"),
  GROQ_TIMEOUT_MS: z.string().optional(),
  GROQ_MAX_RETRIES: z.string().optional(),
  GROQ_INPUT_PRICE_PER_MTOK: z.string().optional(),
  GROQ_OUTPUT_PRICE_PER_MTOK: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  JEV_API_KEY: z.string().min(1).optional(),
  TYPESAFE_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL").optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().url("KV_REST_API_URL must be a valid URL").optional().or(z.literal("")),
  KV_REST_API_TOKEN: z.string().optional(),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
  KV_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RATE_LIMIT_DISABLED: z.enum(["true", "false"]).optional(),
  CACHE_DISABLED: z.enum(["true", "false"]).optional(),
  AI_CEILING_DISABLED: z.enum(["true", "false"]).optional(),
  ALLOW_SELF_SERVE_TIER_SWITCH: z.enum(["true", "false"]).optional(),
});

/**
 * Client environment schema.
 * These variables are public and exposed to the browser.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional().or(z.literal("")),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).optional(),
});

/**
 * Combined environment schema.
 * Any other standard process.env variables are passed through.
 */
export const envSchema = serverEnvSchema.merge(clientEnvSchema).passthrough();

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type Env = z.infer<typeof envSchema>;

export function formatErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

let parsedEnv: Env | null = null;

/**
 * Validates environment variables at application boot time.
 * If rawEnv is omitted, process.env is validated and the result is cached.
 */
export function validateEnv(rawEnv: Record<string, string | undefined> = process.env): Env {
  if (rawEnv.SKIP_ENV_VALIDATION === "true" || rawEnv.SKIP_ENV_VALIDATION === "1") {
    return rawEnv as unknown as Env;
  }

  const isServer = typeof window === "undefined";
  const schema = isServer ? envSchema : clientEnvSchema;

  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const formatted = formatErrors(result.error);
    const message = `❌ Invalid or missing environment variables at startup:\n${formatted}`;
    console.error(message);
    throw new Error(message);
  }

  if (rawEnv === process.env) {
    parsedEnv = result.data as Env;
  }
  return result.data as Env;
}

/**
 * Typed environment accessor.
 * Validates on first access if not already validated.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!parsedEnv) {
      parsedEnv = validateEnv();
    }
    return parsedEnv[prop as keyof Env];
  },
});
