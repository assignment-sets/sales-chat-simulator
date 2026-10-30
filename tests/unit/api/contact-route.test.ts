import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import { GET } from "@/app/contact/route";

describe("GET /contact", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it("redirects to /support", async () => {
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT:/support");
    expect(mockRedirect).toHaveBeenCalledWith("/support");
  });
});
