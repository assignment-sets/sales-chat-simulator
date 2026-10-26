import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { forbidden, internalError, notFound } from "@/lib/api-response";
import {
  FeatureFlag,
  getPlanConfig,
  getQuotaLimit,
  hasFeature,
  normalizePlanTier,
  PlanTier,
} from "@/lib/plans";
import { Organization } from "@/lib/tenant";

export type GuardResult =
  | { ok: true; current?: number; limit?: number; planTier?: PlanTier }
  | {
      ok: false;
      response: NextResponse;
      current?: number;
      limit?: number;
      planTier?: PlanTier;
    };

const FEATURE_ERROR_MESSAGES: Record<FeatureFlag, string> = {
  detailed_ai_feedback:
    "Detailed AI Coaching Breakdown is a Pro feature. Upgrade your workspace to Pro or Scale to unlock line-by-line critiques.",
  team_dashboard:
    "Team Oversight Dashboard & Rep Analytics require the Pro or Scale plan.",
};

/**
 * Synchronous feature gate check when the Organization object is already loaded.
 */
export function requireFeature(
  organization: Pick<Organization, "plan_tier"> | { plan_tier?: string | null },
  feature: FeatureFlag
): GuardResult {
  const planTier = normalizePlanTier(organization.plan_tier);
  if (!hasFeature(planTier, feature)) {
    return {
      ok: false,
      planTier,
      response: forbidden(FEATURE_ERROR_MESSAGES[feature]),
    };
  }

  return { ok: true, planTier };
}

/**
 * Asynchronous feature gate check when only an organizationId is available.
 */
export async function requireOrgFeature(
  supabase: SupabaseClient,
  organizationId: string | undefined | null,
  feature: FeatureFlag
): Promise<GuardResult> {
  if (!organizationId) {
    return {
      ok: false,
      response: notFound("Organization not found"),
    };
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, plan_tier")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: internalError(
        "Failed to verify organization plan",
        error,
        `requireOrgFeature:${feature}`
      ),
    };
  }

  if (!org) {
    return {
      ok: false,
      response: notFound("Organization not found"),
    };
  }

  return requireFeature(org, feature);
}

export type CheckQuotaParams = {
  type: "monthly_simulations" | "team_seats";
  organization?: Pick<Organization, "id" | "plan_tier">;
  organizationId?: string;
};

/**
 * Returns the UTC timestamp for the 1st of the current calendar month (00:00:00.000Z).
 */
export function getStartOfCurrentMonthUTC(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  ).toISOString();
}

/**
 * Unified server-side quota guard for organization-scoped limits:
 * - `monthly_simulations`: chats created in the organization during the current UTC month
 * - `team_seats`: active members + pending invitations in the organization
 */
export async function checkQuota(
  supabase: SupabaseClient,
  params: CheckQuotaParams
): Promise<GuardResult> {
  // Resolve organization ID and plan_tier for org-scoped quotas
  let orgId = params.organization?.id || params.organizationId;
  let rawTier: string | undefined = params.organization?.plan_tier;

  if (!orgId) {
    return {
      ok: false,
      response: notFound("Organization not found"),
    };
  }

  if (!rawTier) {
    const { data: orgRow, error: orgError } = await supabase
      .from("organizations")
      .select("id, plan_tier")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      return {
        ok: false,
        response: internalError(
          "Failed to verify organization plan",
          orgError,
          `checkQuota:${params.type}:org`
        ),
      };
    }

    if (!orgRow) {
      return {
        ok: false,
        response: notFound("Organization not found"),
      };
    }

    orgId = orgRow.id;
    rawTier = orgRow.plan_tier;
  }

  const planTier = normalizePlanTier(rawTier);
  const plan = getPlanConfig(planTier);
  const limit = getQuotaLimit(planTier, params.type);

  // 3. Check monthly simulations count
  if (params.type === "monthly_simulations") {
    const startOfMonth = getStartOfCurrentMonthUTC();

    const { count, error } = await supabase
      .from("chats")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", startOfMonth);

    if (error) {
      return {
        ok: false,
        response: internalError(
          "Failed to check monthly simulation quota",
          error,
          "checkQuota:monthly_simulations"
        ),
      };
    }

    const currentCount = count ?? 0;
    if (currentCount >= limit) {
      return {
        ok: false,
        current: currentCount,
        limit,
        planTier,
        response: forbidden(
          `Monthly simulation limit reached (${currentCount}/${limit} on ${plan.name} plan). Upgrade your workspace for more monthly sessions.`
        ),
      };
    }

    return { ok: true, current: currentCount, limit, planTier };
  }

  // 4. Check team seats count (active members + pending invitations)
  if (params.type === "team_seats") {
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("organization_invitations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
    ]);

    if (membersRes.error) {
      return {
        ok: false,
        response: internalError(
          "Failed to check organization seat quota",
          membersRes.error,
          "checkQuota:team_seats"
        ),
      };
    }

    const membersCount = membersRes.count ?? 0;
    const invitesCount = invitesRes.count ?? 0;
    const totalSeats = membersCount + invitesCount;

    if (totalSeats >= limit) {
      return {
        ok: false,
        current: totalSeats,
        limit,
        planTier,
        response: forbidden(
          `Team seat limit reached (${totalSeats}/${limit} on ${plan.name} plan). Upgrade to Pro or Scale to invite more teammates.`
        ),
      };
    }

    return { ok: true, current: totalSeats, limit, planTier };
  }

  return { ok: true, planTier };
}
