import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDodoConnection } from "@/lib/dodo/connection";
import { getDodoClient } from "@/lib/dodo/client";

describe("Dodo Payments Client & Connection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("detects placeholder API key safely without throwing", async () => {
    const result = await testDodoConnection();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("placeholder");
    expect(result.environment).toBe("test_mode");
  });

  it("throws clear error from getDodoClient when key is placeholder", () => {
    expect(() => getDodoClient()).toThrow(
      /DODO_PAYMENTS_API_KEY is not configured or is still using placeholder/
    );
  });
});
