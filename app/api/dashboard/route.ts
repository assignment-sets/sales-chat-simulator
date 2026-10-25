import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { requireFeature } from "@/lib/entitlements";
import { getActiveOrganization } from "@/lib/tenant";

export interface DashboardMemberSummary {
  userId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  simulationsCount: number;
  messagesCount: number;
  tokensUsed: number;
  winRate: number | null;
  avgScore: number | null;
  lastActiveAt: string | null;
}

export interface DashboardKpiSummary {
  totalSimulations: number;
  totalMessages: number;
  totalTokens: number;
  activeMembersCount: number;
  totalMembersCount: number;
  winRate: number | null;
  avgScore: number | null;
}

export interface DashboardActivityPoint {
  date: string;
  label: string;
  count: number;
  wonCount: number;
}

export interface DashboardScorePoint {
  score: number;
  count: number;
  percentage: number;
}

export interface DashboardScenarioPoint {
  productName: string;
  count: number;
  wonCount: number;
  winRate: number | null;
  avgScore: number | null;
}

export interface DashboardAnalytics {
  outcomes: {
    won: number;
    lost: number;
    active: number;
    total: number;
    winRate: number | null;
  };
  scoreDistribution: DashboardScorePoint[];
  activityTimeline: DashboardActivityPoint[];
  scenarioBreakdown: DashboardScenarioPoint[];
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

  // Enforce Pro/Scale plan tier requirement for Team Oversight Dashboard
  const featureGate = requireFeature(organization, "team_dashboard");
  if (!featureGate.ok) {
    return featureGate.response;
  }

  // 1. Fetch organization members with profile names and emails
  let memberRows: Array<{
    id: string;
    organization_id?: string;
    user_id: string;
    role: string;
    created_at: string;
    email?: string;
    full_name?: string;
  }> = [];

  const { data: rpcMembers, error: rpcError } = await supabase.rpc(
    "get_organization_members",
    { target_org_id: organization.id }
  );

  if (!rpcError && rpcMembers) {
    memberRows = rpcMembers;
  } else {
    // Fallback if RPC migration hasn't run yet
    const { data: directMembers, error: membersError } = await supabase
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
    memberRows = directMembers || [];
  }

  // 2. Fetch all chats for this organization
  const { data: chatRows, error: chatsError } = await supabase
    .from("chats")
    .select("id, user_id, product_name, tokens_used, status, score, evaluation_outcome, created_at")
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
  interface MemberAccumulator extends DashboardMemberSummary {
    wonCount: number;
    lostCount: number;
    totalScore: number;
    scoredCount: number;
  }

  const memberMap = new Map<string, MemberAccumulator>();

  for (const m of memberRows || []) {
    const isSelf = m.user_id === user.id;
    const fallbackEmail = isSelf && user.email ? user.email : `member-${m.user_id.slice(0, 8)}@team`;
    const memberEmail = m.email || fallbackEmail;
    const fallbackName = isSelf
      ? ((user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || memberEmail.split("@")[0])
      : (memberEmail.includes("@") ? memberEmail.split("@")[0] : `Team Member (${m.user_id.slice(0, 8)})`);

    const fullName = m.full_name || fallbackName;

    memberMap.set(m.user_id, {
      userId: m.user_id,
      email: memberEmail,
      fullName,
      role: m.role as "owner" | "admin" | "member",
      joinedAt: m.created_at,
      simulationsCount: 0,
      messagesCount: 0,
      tokensUsed: 0,
      winRate: null,
      avgScore: null,
      lastActiveAt: null,
      wonCount: 0,
      lostCount: 0,
      totalScore: 0,
      scoredCount: 0,
    });
  }

  // Aggregate simulations per user and overall
  let overallTokens = 0;
  let overallWon = 0;
  let overallLost = 0;
  let overallTotalScore = 0;
  let overallScoredCount = 0;

  for (const c of allChats) {
    const tokens = c.tokens_used || 0;
    overallTokens += tokens;

    const isWon = c.status === "WON" || c.evaluation_outcome === "deal_won";
    const isLost = c.status === "LOST" || c.evaluation_outcome === "deal_lost";

    if (isWon) overallWon += 1;
    if (isLost) overallLost += 1;

    if (typeof c.score === "number" && c.score > 0) {
      overallTotalScore += c.score;
      overallScoredCount += 1;
    }

    let existing = memberMap.get(c.user_id);
    if (!existing) {
      existing = {
        userId: c.user_id,
        email: `Former Member (${c.user_id.slice(0, 8)})`,
        fullName: `Former Member (${c.user_id.slice(0, 8)})`,
        role: "member",
        joinedAt: c.created_at,
        simulationsCount: 0,
        messagesCount: 0,
        tokensUsed: 0,
        winRate: null,
        avgScore: null,
        lastActiveAt: c.created_at,
        wonCount: 0,
        lostCount: 0,
        totalScore: 0,
        scoredCount: 0,
      };
      memberMap.set(c.user_id, existing);
    }

    existing.simulationsCount += 1;
    existing.tokensUsed += tokens;
    if (isWon) existing.wonCount += 1;
    if (isLost) existing.lostCount += 1;
    if (typeof c.score === "number" && c.score > 0) {
      existing.totalScore += c.score;
      existing.scoredCount += 1;
    }

    if (!existing.lastActiveAt || new Date(c.created_at) > new Date(existing.lastActiveAt)) {
      existing.lastActiveAt = c.created_at;
    }
  }

  // Aggregate message counts
  for (const msg of messageRows) {
    const existing = memberMap.get(msg.user_id);
    if (existing) {
      existing.messagesCount += 1;
    }
  }

  // Calculate winRate and avgScore for each member
  const memberSummaries: DashboardMemberSummary[] = Array.from(memberMap.values()).map((m) => {
    const concludedCount = m.wonCount + m.lostCount;
    const winRate = concludedCount > 0 ? Math.round((m.wonCount / concludedCount) * 100) : null;
    const avgScore = m.scoredCount > 0 ? Number((m.totalScore / m.scoredCount).toFixed(1)) : null;

    return {
      userId: m.userId,
      email: m.email,
      fullName: m.fullName,
      role: m.role,
      joinedAt: m.joinedAt,
      simulationsCount: m.simulationsCount,
      messagesCount: m.messagesCount,
      tokensUsed: m.tokensUsed,
      winRate,
      avgScore,
      lastActiveAt: m.lastActiveAt,
    };
  }).sort(
    (a, b) => b.simulationsCount - a.simulationsCount || b.messagesCount - a.messagesCount
  );

  const activeMembersCount = memberSummaries.filter((m) => m.simulationsCount > 0).length;
  const overallConcluded = overallWon + overallLost;
  const teamWinRate = overallConcluded > 0 ? Math.round((overallWon / overallConcluded) * 100) : null;
  const teamAvgScore = overallScoredCount > 0 ? Number((overallTotalScore / overallScoredCount).toFixed(1)) : null;

  const kpis: DashboardKpiSummary = {
    totalSimulations: allChats.length,
    totalMessages: messageRows.length,
    totalTokens: overallTokens,
    activeMembersCount,
    totalMembersCount: memberSummaries.length,
    winRate: teamWinRate,
    avgScore: teamAvgScore,
  };

  // --- Derive Visual Analytics Datasets ---

  // 1. Outcome Ratio
  const activeChatsCount = Math.max(0, allChats.length - overallConcluded);
  const outcomes = {
    won: overallWon,
    lost: overallLost,
    active: activeChatsCount,
    total: allChats.length,
    winRate: teamWinRate,
  };

  // 2. 14-Day Simulation Activity Timeline
  const activityMap = new Map<string, { count: number; wonCount: number }>();
  const now = new Date();
  const timeline: DashboardActivityPoint[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    activityMap.set(dateStr, { count: 0, wonCount: 0 });
    timeline.push({ date: dateStr, label, count: 0, wonCount: 0 });
  }

  for (const c of allChats) {
    if (c.created_at) {
      const chatDateStr = c.created_at.split("T")[0];
      const entry = activityMap.get(chatDateStr);
      if (entry) {
        entry.count += 1;
        const isWon = c.status === "WON" || c.evaluation_outcome === "deal_won";
        if (isWon) {
          entry.wonCount += 1;
        }
      }
    }
  }

  for (const item of timeline) {
    const entry = activityMap.get(item.date);
    if (entry) {
      item.count = entry.count;
      item.wonCount = entry.wonCount;
    }
  }

  // 3. Evaluation Score Distribution (1-5)
  const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let scoredTotal = 0;
  for (const c of allChats) {
    if (typeof c.score === "number" && c.score >= 1 && c.score <= 5) {
      const rounded = Math.round(c.score);
      scoreCounts[rounded] = (scoreCounts[rounded] || 0) + 1;
      scoredTotal += 1;
    }
  }

  const scoreDistribution: DashboardScorePoint[] = [1, 2, 3, 4, 5].map((s) => ({
    score: s,
    count: scoreCounts[s] || 0,
    percentage: scoredTotal > 0 ? Math.round(((scoreCounts[s] || 0) / scoredTotal) * 100) : 0,
  }));

  // 4. Product / Scenario Performance Breakdown
  interface ScenarioAccumulator {
    productName: string;
    count: number;
    wonCount: number;
    lostCount: number;
    totalScore: number;
    scoredCount: number;
  }
  const scenarioMap = new Map<string, ScenarioAccumulator>();

  for (const c of allChats) {
    const pName = (c.product_name as string)?.trim() || "General Practice";
    let entry = scenarioMap.get(pName);
    if (!entry) {
      entry = {
        productName: pName,
        count: 0,
        wonCount: 0,
        lostCount: 0,
        totalScore: 0,
        scoredCount: 0,
      };
      scenarioMap.set(pName, entry);
    }
    entry.count += 1;
    const isWon = c.status === "WON" || c.evaluation_outcome === "deal_won";
    const isLost = c.status === "LOST" || c.evaluation_outcome === "deal_lost";
    if (isWon) entry.wonCount += 1;
    if (isLost) entry.lostCount += 1;
    if (typeof c.score === "number" && c.score > 0) {
      entry.totalScore += c.score;
      entry.scoredCount += 1;
    }
  }

  const scenarioBreakdown: DashboardScenarioPoint[] = Array.from(scenarioMap.values())
    .map((s) => {
      const concluded = s.wonCount + s.lostCount;
      return {
        productName: s.productName,
        count: s.count,
        wonCount: s.wonCount,
        winRate: concluded > 0 ? Math.round((s.wonCount / concluded) * 100) : null,
        avgScore: s.scoredCount > 0 ? Number((s.totalScore / s.scoredCount).toFixed(1)) : null,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const analytics: DashboardAnalytics = {
    outcomes,
    scoreDistribution,
    activityTimeline: timeline,
    scenarioBreakdown,
  };

  return apiSuccess({
    kpis,
    analytics,
    members: memberSummaries,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    currentUserRole: role,
  });
}
