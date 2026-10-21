import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { internalError, notFound } from "@/lib/api-response";
import { OrgRole } from "@/lib/tenant";

export type ChatAccessResult<T> =
  | { ok: true; chat: T; role: OrgRole }
  | { ok: false; response: NextResponse };

export interface ValidateChatOptions {
  expectedOrgId?: string;
  selectFields?: string;
  context?: string;
}

/**
 * Validates that a chat exists, belongs to the user's organization,
 * and that the user has appropriate permissions (owner/admin sees all org chats, member sees own).
 */
export async function validateChatAccess<T extends Record<string, unknown> = Record<string, unknown>>(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  optionsOrSelectFields?: string | ValidateChatOptions,
  legacyContext = "validateChatAccess"
): Promise<ChatAccessResult<T>> {
  let selectFields = "id, product_name, product_description, organization_id, user_id";
  let expectedOrgId: string | undefined;
  let context = legacyContext;

  if (typeof optionsOrSelectFields === "string") {
    // If specific fields were requested, make sure organization_id and user_id are included for access control
    if (optionsOrSelectFields !== "*") {
      const fieldList = optionsOrSelectFields.split(",").map((s) => s.trim());
      if (!fieldList.includes("organization_id")) fieldList.push("organization_id");
      if (!fieldList.includes("user_id")) fieldList.push("user_id");
      selectFields = fieldList.join(", ");
    } else {
      selectFields = "*";
    }
  } else if (optionsOrSelectFields && typeof optionsOrSelectFields === "object") {
    if (optionsOrSelectFields.selectFields) {
      if (optionsOrSelectFields.selectFields !== "*") {
        const fieldList = optionsOrSelectFields.selectFields.split(",").map((s) => s.trim());
        if (!fieldList.includes("organization_id")) fieldList.push("organization_id");
        if (!fieldList.includes("user_id")) fieldList.push("user_id");
        selectFields = fieldList.join(", ");
      } else {
        selectFields = "*";
      }
    }
    expectedOrgId = optionsOrSelectFields.expectedOrgId;
    if (optionsOrSelectFields.context) {
      context = optionsOrSelectFields.context;
    }
  }

  // 1. Fetch chat record
  const { data: chatData, error: chatError } = await supabase
    .from("chats")
    .select(selectFields)
    .eq("id", chatId)
    .maybeSingle();

  if (chatError) {
    return {
      ok: false,
      response: internalError("Failed to verify chat ownership", chatError, context),
    };
  }

  if (!chatData) {
    return {
      ok: false,
      response: notFound("Chat not found"),
    };
  }

  const chat = chatData as unknown as {
    organization_id?: string;
    user_id?: string;
    [key: string]: unknown;
  };

  // 2. Validate tenant boundary if expectedOrgId was specified
  if (expectedOrgId && chat.organization_id && chat.organization_id !== expectedOrgId) {
    return {
      ok: false,
      response: notFound("Chat not found"),
    };
  }

  // 3. Check caller's role in the chat's organization
  if (chat.organization_id) {
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", chat.organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !membership) {
      return {
        ok: false,
        response: notFound("Chat not found"),
      };
    }

    const role = membership.role as OrgRole;

    // Role-based visibility check:
    // If regular member, they must be the author of the simulation.
    // Owners and Admins can view/access all simulations in the organization.
    if (role === "member" && chat.user_id && chat.user_id !== userId) {
      return {
        ok: false,
        response: notFound("Chat not found"),
      };
    }

    return { ok: true, chat: chat as unknown as T, role };
  }

  // Fallback for legacy chats without organization_id: must match user_id
  if (chat.user_id && chat.user_id !== userId) {
    return {
      ok: false,
      response: notFound("Chat not found"),
    };
  }

  return { ok: true, chat: chat as unknown as T, role: "owner" };
}
