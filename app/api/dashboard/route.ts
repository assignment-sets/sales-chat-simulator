import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { getActiveOrganization } from "@/lib/tenant";

export interface DashboardMemberSummary {
  userId: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  simulationsCount: number;
  messagesCount: number;
  tokensUsed: number;
  lastActiveAt: string | null;
}

export interface DashboardKpiSummary {
  totalSimulations: number;
  totalMessages: number;
  totalTokens: number;
  activeMembersCount: number;
  totalMembersCount: number;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  const activeContext = await getActiveOrganization(supabase, user.id, user.email);
  if (!activeContext) {
    return internalError("Failed to resolve active organization");
  }

  const { organization, role } = activeContext;

  if (role !== "owner" && role !== "admin") {
    return forbidden("Team oversight is restricted to organization owners and admins");
  }

  // 1. Fetch organization members
  const { data: memberRows, error: membersError } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", organization.id);

  if (membersError) {
    return internalError(
      "Failed to fetch organization members",
      membersError,
      "GET /api/dashboard:members"
    );
  }

  // 2. Fetch all chats for this organization
  const { data: chatRows, error: chatsError } = await supabase
    .from("chats")
    .select("id, user_id, tokens_used, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (chatsError) {
    return internalError(
      "Failed to fetch organization chats",
      chatsError,
      "GET /api/dashboard:chats"
    );
  }

  const allChats = chatRows || [];
  const chatIds = allChats.map((c) => c.id);

  // 3. Fetch message stats across org chats
  let messageRows: { chat_id: string; user_id: string; total_tokens: number | null }[] = [];
  if (chatIds.length > 0) {
    const { data: msgs, error: msgsError } = await supabase
      .from("messages")
      .select("chat_id, user_id, total_tokens")
      .in("chat_id", chatIds);

    if (msgsError) {
      console.warn("Could not fetch messages for dashboard metrics:", msgsError);
    } else {
      messageRows = msgs || [];
    }
  }

  // 4. Aggregate metrics per member
  const memberMap = new Map<string, DashboardMemberSummary>();

  for (const m of memberRows || []) {
    memberMap.set(m.user_id, {
      userId: m.user_id,
      email: m.user_id === user.id && user.email ? user.email : `Team Member (${m.user_id.slice(0, 8)})`,
      role: m.role as "owner" | "admin" | "member",
      joinedAt: m.created_at,
      simulationsCount: 0,
      messagesCount: 0,
      tokensUsed: 0,
      lastActiveAt: null,
    });
  }

  // Aggregate simulations per user
  let overallTokens = 0;
  for (const c of allChats) {
    const tokens = c.tokens_used || 0;
    overallTokens += tokens;

    const existing = memberMap.get(c.user_id);
    if (existing) {
      existing.simulationsCount += 1;
      existing.tokensUsed += tokens;
      if (!existing.lastActiveAt || new Date(c.created_at) > new Date(existing.lastActiveAt)) {
        existing.lastActiveAt = c.created_at;
      }
    } else {
      // Member might have left org but has legacy chats
      memberMap.set(c.user_id, {
        userId: c.user_id,
        email: `Former Member (${c.user_id.slice(0, 8)})`,
        role: "member",
        joinedAt: c.created_at,
        simulationsCount: 1,
        messagesCount: 0,
        tokensUsed: tokens,
        lastActiveAt: c.created_at,
      });
    }
  }

  // Aggregate message counts
  for (const msg of messageRows) {
    const existing = memberMap.get(msg.user_id);
    if (existing) {
      existing.messagesCount += 1;
    }
  }

  const memberSummaries = Array.from(memberMap.values()).sort(
    (a, b) => b.simulationsCount - a.simulationsCount || b.messagesCount - a.messagesCount
  );

  const activeMembersCount = memberSummaries.filter((m) => m.simulationsCount > 0).length;

  const kpis: DashboardKpiSummary = {
    totalSimulations: allChats.length,
    totalMessages: messageRows.length,
    totalTokens: overallTokens,
    activeMembersCount,
    totalMembersCount: memberSummaries.length,
  };

  return apiSuccess({
    kpis,
    members: memberSummaries,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    currentUserRole: role,
  });
}
