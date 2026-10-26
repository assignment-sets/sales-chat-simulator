import { describe, it, expect, vi } from "vitest";
import { createMockSupabaseClient, setupMockAuth } from "../utils/mock-supabase";
import { getActiveOrganization } from "@/lib/tenant";
import { createServerSupabaseClient } from "@/utils/supabase/server";

describe("Test Infrastructure & Auth Harness (Phase 1)", () => {
  it("creates a chainable mock query builder with proper defaults", async () => {
    const client = createMockSupabaseClient({
      tables: {
        chats: [{ id: "chat-1", product_name: "CRM Suite" }],
      },
    });

    const res = await client.from("chats").select("*").eq("id", "chat-1").single();
    expect(res.data).toEqual({ id: "chat-1", product_name: "CRM Suite" });
    expect(res.error).toBeNull();
  });

  it("handles unauthenticated mock session properly", async () => {
    const client = createMockSupabaseClient({ userContext: null });
    const { data, error } = await client.auth.getUser();

    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
  });

  it("mocks active organization and user tenant context via setupMockAuth", async () => {
    const { activeContext } = setupMockAuth({
      userId: "user-999",
      email: "rep@example.com",
      role: "admin",
      orgId: "org-888",
      planTier: "pro",
    });

    const client = await createServerSupabaseClient();
    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe("user-999");
    expect(data.user?.email).toBe("rep@example.com");

    const resolvedOrg = await getActiveOrganization(client, data.user!.id, data.user!.email);
    expect(resolvedOrg?.organization.id).toBe("org-888");
    expect(resolvedOrg?.role).toBe("admin");
    expect(resolvedOrg?.organization.plan_tier).toBe("pro");
  });
});
