import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { normalizePlanTier, PlanTier } from "@/lib/plans";

export const ACTIVE_ORG_COOKIE_NAME = "saleschat_active_org_id";

export const ACTIVE_ORG_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: PlanTier;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  organization: Organization;
}

export interface ActiveOrgContext {
  organization: Organization;
  role: OrgRole;
  allOrganizations: OrganizationMembership[];
}

/**
 * Fetches all organizations that the user belongs to along with their roles.
 */
export async function getUserOrganizations(
  supabase: SupabaseClient,
  userId: string
): Promise<OrganizationMembership[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      id,
      organization_id,
      user_id,
      role,
      created_at,
      organization:organizations(id, name, slug, plan_tier, created_at, updated_at)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) {
      console.error("Error fetching user organizations:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }
    return [];
  }

  // Filter out any members where organization join might have failed and normalize plan_tier
  return (data as unknown as OrganizationMembership[])
    .filter((m) => m && m.organization && m.organization.id)
    .map((m) => ({
      ...m,
      organization: {
        ...m.organization,
        plan_tier: normalizePlanTier(m.organization.plan_tier),
      },
    }));
}

/**
 * Creates a default workspace organization for a new or existing user without orgs.
 */
export async function createDefaultOrganizationForUser(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string,
  userName?: string
): Promise<OrganizationMembership | null> {
  const baseName = userName?.trim() || (userEmail ? userEmail.split("@")[0] : "My");
  const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const orgName = `${capitalized}'s Workspace`;
  const cleanSlug = `${baseName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Math.random().toString(36).substring(2, 8)}`;

  // Create organization + owner membership atomically via RPC
  const { data: result, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    { org_name: orgName, org_slug: cleanSlug }
  );

  if (rpcError || !result) {
    console.error("Failed to create default organization:", rpcError ? {
      message: rpcError.message,
      code: rpcError.code,
      details: rpcError.details,
      hint: rpcError.hint,
    } : "No data returned");
    return null;
  }

  return {
    id: result.member_id,
    organization_id: result.id,
    user_id: userId,
    role: "owner" as OrgRole,
    created_at: result.created_at,
    organization: {
      id: result.id,
      name: result.name,
      slug: result.slug,
      plan_tier: normalizePlanTier(result.plan_tier),
      created_at: result.created_at,
      updated_at: result.updated_at,
    },
  };
}

/**
 * Resolves the active organization for the user.
 * - Reads `saleschat_active_org_id` cookie.
 * - If cookie matches a valid membership, uses it.
 * - Otherwise falls back to primary org or creates a default workspace.
 */
export async function getActiveOrganization(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string,
  userName?: string
): Promise<ActiveOrgContext | null> {
  let memberships = await getUserOrganizations(supabase, userId);

  // If user has no organizations, provision a default one
  if (memberships.length === 0) {
    const defaultMembership = await createDefaultOrganizationForUser(
      supabase,
      userId,
      userEmail,
      userName
    );
    if (defaultMembership) {
      memberships = [defaultMembership];
    }
  }

  if (memberships.length === 0) {
    return null;
  }

  let cookieOrgId: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value;
  } catch {
    // cookies() might fail in certain environments or contexts
  }

  // Find membership matching cookie
  let activeMembership = cookieOrgId
    ? memberships.find((m) => m.organization_id === cookieOrgId)
    : undefined;

  // Fallback to first membership
  if (!activeMembership) {
    activeMembership = memberships[0];
  }

  // Try to persist the cookie if changed or not present
  if (cookieOrgId !== activeMembership.organization_id) {
    try {
      const cookieStore = await cookies();
      cookieStore.set(
        ACTIVE_ORG_COOKIE_NAME,
        activeMembership.organization_id,
        ACTIVE_ORG_COOKIE_OPTIONS
      );
    } catch {
      // In Server Components, cookie setting might throw; this is expected and safe
    }
  }

  return {
    organization: activeMembership.organization,
    role: activeMembership.role,
    allOrganizations: memberships,
  };
}

/**
 * Validates whether a user belongs to a specific organization.
 */
export async function validateOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<{ isMember: boolean; role: OrgRole | null }> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { isMember: false, role: null };
  }

  return { isMember: true, role: data.role as OrgRole };
}
