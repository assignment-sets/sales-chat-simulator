import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateEnv, env, serverEnvSchema, clientEnvSchema } from "@/lib/env";

describe("lib/env (Boot-time Zod Environment Validation)", () => {
  const validBaseEnv = {
    NODE_ENV: "test",
    GROQ_API_KEY: "gsk_valid_groq_api_key",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_valid_key",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates successfully with required base environment variables", () => {
    const parsed = validateEnv(validBaseEnv);
    expect(parsed.GROQ_API_KEY).toBe("gsk_valid_groq_api_key");
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_valid_key");
    expect(parsed.GROQ_MODEL).toBe("qwen/qwen3.8-27b");
    expect(parsed.NODE_ENV).toBe("test");
  });

  it("fails validation when GROQ_API_KEY is missing", () => {
    const invalidEnv = { ...validBaseEnv };
    delete (invalidEnv as Record<string, string | undefined>).GROQ_API_KEY;

    expect(() => validateEnv(invalidEnv)).toThrowError(/GROQ_API_KEY/);
  });

  it("fails validation when NEXT_PUBLIC_SUPABASE_URL is missing or invalid URL", () => {
    const invalidUrlEnv = {
      ...validBaseEnv,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
    };
    expect(() => validateEnv(invalidUrlEnv)).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);

    const missingUrlEnv = { ...validBaseEnv };
    delete (missingUrlEnv as Record<string, string | undefined>).NEXT_PUBLIC_SUPABASE_URL;
    expect(() => validateEnv(missingUrlEnv)).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("fails validation when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", () => {
    const invalidEnv = { ...validBaseEnv };
    delete (invalidEnv as Record<string, string | undefined>).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => validateEnv(invalidEnv)).toThrowError(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("validates optional variables and flags properly", () => {
    const fullEnv = {
      ...validBaseEnv,
      GROQ_MODEL: "llama-3.3-70b-versatile",
      RATE_LIMIT_DISABLED: "true",
      CACHE_DISABLED: "false",
      UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      NEXT_PUBLIC_APP_URL: "https://saleschat.io",
    };

    const parsed = validateEnv(fullEnv);
    expect(parsed.GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    expect(parsed.RATE_LIMIT_DISABLED).toBe("true");
    expect(parsed.CACHE_DISABLED).toBe("false");
    expect(parsed.UPSTASH_REDIS_REST_URL).toBe("https://redis.upstash.io");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("https://saleschat.io");
  });

  it("handles APP_ENV defaults and environment profiles", () => {
    const defaultParsed = validateEnv(validBaseEnv);
    expect(defaultParsed.APP_ENV).toBe("development");

    const stagingParsed = validateEnv({
      ...validBaseEnv,
      APP_ENV: "staging",
      NEXT_PUBLIC_APP_ENV: "staging",
    });
    expect(stagingParsed.APP_ENV).toBe("staging");
    expect(stagingParsed.NEXT_PUBLIC_APP_ENV).toBe("staging");

    const prodParsed = validateEnv({
      ...validBaseEnv,
      APP_ENV: "production",
      NEXT_PUBLIC_APP_ENV: "production",
    });
    expect(prodParsed.APP_ENV).toBe("production");
    expect(prodParsed.NEXT_PUBLIC_APP_ENV).toBe("production");

    expect(() =>
      validateEnv({
        ...validBaseEnv,
        APP_ENV: "invalid-env" as unknown as "development",
      })
    ).toThrowError(/APP_ENV/);
  });

  it("allows skipping validation when SKIP_ENV_VALIDATION is true", () => {
    const emptyEnv = {
      SKIP_ENV_VALIDATION: "true",
    };

    const parsed = validateEnv(emptyEnv);
    expect(parsed.SKIP_ENV_VALIDATION).toBe("true");
  });

  it("provides typed property access via env proxy", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(typeof env.NEXT_PUBLIC_SUPABASE_URL).toBe("string");
  });

  it("exports server and client schemas separately", () => {
    expect(serverEnvSchema.shape.GROQ_API_KEY).toBeDefined();
    expect(clientEnvSchema.shape.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
  });
});
