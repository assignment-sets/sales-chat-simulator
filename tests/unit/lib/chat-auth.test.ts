import { describe, it, expect, vi } from "vitest";
import { validateChatAccess } from "@/lib/chat-auth";
import { createMockSupabaseClient } from "../../utils/mock-supabase";
import * as tenantModule from "@/lib/tenant";

describe("chat-auth.ts (Multi-Tenant Simulation Access Control)", () => {
  it("returns 404 notFound when the chat does not exist", async () => {
    const client = createMockSupabaseClient({
      tables: {
        chats: [],
      },
    });

    const result = await validateChatAccess(client as any, "missing-chat", "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      const json = await result.response.json();
      expect(json.error).toContain("Chat not found");
    }
  });

  it("returns 404 notFound when user is not a member of the chat's organization", async () => {
    const client = createMockSupabaseClient({
      tables: {
        chats: [
          {
            id: "chat-1",
            organization_id: "org-foreign",
            user_id: "user-9",
            product_name: "Cold Email Tool",
            product_description: "B2B SaaS",
          },
        ],
        organization_members: [], // no membership in org-foreign
      },
    });

    const result = await validateChatAccess(client as any, "chat-1", "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it("returns 404 notFound when user is a 'member' but chat belongs to another user in the org", async () => {
    const client = createMockSupabaseClient({
      tables: {
        chats: [
          {
            id: "chat-1",
            organization_id: "org-1",
            user_id: "peer-user-2",
            product_name: "Cold Email Tool",
            product_description: "B2B SaaS",
          },
        ],
        organization_members: [{ organization_id: "org-1", user_id: "user-1", role: "member" }],
      },
    });

    const result = await validateChatAccess(client as any, "chat-1", "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it("allows access (ok: true) when user is a 'member' and owns the simulation", async () => {
    const chatRecord = {
      id: "chat-1",
      organization_id: "org-1",
      user_id: "user-1",
      product_name: "Cold Email Tool",
      product_description: "B2B SaaS",
    };

    const client = createMockSupabaseClient({
      tables: {
        chats: [chatRecord],
        organization_members: [{ organization_id: "org-1", user_id: "user-1", role: "member" }],
      },
    });

    const result = await validateChatAccess(client as any, "chat-1", "user-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chat.id).toBe("chat-1");
      expect(result.role).toBe("member");
    }
  });

  it("allows access (ok: true) when caller is an 'admin' or 'owner' even if another user created it", async () => {
    const chatRecord = {
      id: "chat-1",
      organization_id: "org-1",
      user_id: "junior-rep-5",
      product_name: "Enterprise ERP",
      product_description: "Heavy B2B",
    };

    const client = createMockSupabaseClient({
      tables: {
        chats: [chatRecord],
        organization_members: [{ organization_id: "org-1", user_id: "manager-admin", role: "admin" }],
      },
    });

    const result = await validateChatAccess(client as any, "chat-1", "manager-admin");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chat.id).toBe("chat-1");
      expect(result.role).toBe("admin");
    }
  });
});
