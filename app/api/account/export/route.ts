import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { unauthorized, internalError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized("Authentication required to export data");
  }

  // Rate limit: 5 exports per user per hour
  const rateLimitResult = await enforceRateLimit(
    "account.export.user",
    `u:${user.id}`
  );
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  try {
    // 1. Fetch user organizations & memberships
    const { data: memberRows, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role, created_at, organizations(id, name, slug, plan_tier, created_at)")
      .eq("user_id", user.id);

    if (memberError) {
      return internalError("Failed to fetch organizations for export", memberError, "GET /api/account/export");
    }

    const organizations = (memberRows || []).map((m: any) => ({
      id: m.organization_id,
      name: m.organizations?.name ?? "Unknown Organization",
      slug: m.organizations?.slug ?? "",
      role: m.role,
      planTier: m.organizations?.plan_tier ?? "free",
      joinedAt: m.created_at,
      organizationCreatedAt: m.organizations?.created_at ?? null,
    }));

    // 2. Fetch all simulations authored by the user
    const { data: userChats, error: chatsError } = await supabase
      .from("chats")
      .select("id, organization_id, product_name, product_description, status, score, evaluation_outcome, tokens_used, ai_feedback, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (chatsError) {
      return internalError("Failed to fetch simulations for export", chatsError, "GET /api/account/export");
    }

    const chatIds = (userChats || []).map((c) => c.id);

    // 3. Fetch all messages in the user's simulations
    let messagesByChatId: Record<string, any[]> = {};
    if (chatIds.length > 0) {
      const { data: messageRows, error: messagesError } = await supabase
        .from("messages")
        .select("id, chat_id, role, content, prompt_tokens, completion_tokens, total_tokens, created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: true });

      if (messagesError) {
        return internalError("Failed to fetch chat messages for export", messagesError, "GET /api/account/export");
      }

      for (const msg of messageRows || []) {
        if (!messagesByChatId[msg.chat_id]) {
          messagesByChatId[msg.chat_id] = [];
        }
        messagesByChatId[msg.chat_id].push({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          promptTokens: msg.prompt_tokens,
          completionTokens: msg.completion_tokens,
          totalTokens: msg.total_tokens,
          createdAt: msg.created_at,
        });
      }
    }

    const simulations = (userChats || []).map((c) => ({
      id: c.id,
      organizationId: c.organization_id,
      productName: c.product_name,
      productDescription: c.product_description,
      status: c.status,
      score: c.score,
      evaluationOutcome: c.evaluation_outcome,
      tokensUsed: c.tokens_used,
      aiFeedback: c.ai_feedback,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      messages: messagesByChatId[c.id] || [],
    }));

    // 4. Fetch pending invitations sent and received
    const [sentInvitesResult, receivedInvitesResult] = await Promise.all([
      supabase
        .from("organization_invitations")
        .select("id, organization_id, email, role, created_at")
        .eq("invited_by", user.id),
      user.email
        ? supabase
            .from("organization_invitations")
            .select("id, organization_id, email, role, invited_by, created_at")
            .eq("email", user.email)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const sentInvitations = sentInvitesResult.data || [];
    const receivedInvitations = receivedInvitesResult.data || [];

    // 5. Structure payload
    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email ?? null,
        fullName:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      },
      organizations,
      simulations,
      invitations: {
        sent: sentInvitations,
        received: receivedInvitations,
      },
    };

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `saleschat-data-export-${user.id}-${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return internalError("Failed to compile user export data", err, "GET /api/account/export");
  }
}
