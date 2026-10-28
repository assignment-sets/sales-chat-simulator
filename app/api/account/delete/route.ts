import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import {
  apiSuccess,
  badRequest,
  unauthorized,
  internalError,
} from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { invalidate } from "@/lib/cache";
import {
  dashboardKey,
  pricingKey,
  memberChatsKey,
  transcriptKey,
} from "@/lib/cache/keys";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized("Authentication required to delete account");
  }

  // Rate limit: 3 delete attempts per user per hour
  const rateLimitResult = await enforceRateLimit(
    "account.delete.user",
    `u:${user.id}`
  );
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  // Parse and validate safety confirmation body
  let body: { confirmation?: string } = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (body.confirmation !== "DELETE") {
    return badRequest("Confirmation string 'DELETE' is required");
  }

  const adminClient = createAdminSupabaseClient();
  const dbClient = adminClient || supabase;

  try {
    // 1. Fetch all memberships for user
    const { data: memberRows, error: memberFetchError } = await dbClient
      .from("organization_members")
      .select("organization_id, role, organizations(id, name)")
      .eq("user_id", user.id);

    if (memberFetchError) {
      return internalError(
        "Failed to verify organization memberships",
        memberFetchError,
        "POST /api/account/delete:fetchMemberships"
      );
    }

    const memberships = memberRows || [];
    const soleMemberOrgIds: string[] = [];
    const allUserOrgIds: string[] = [];

    // 2. Check each organization for sole-owner guardrails and determine sole-member orgs
    for (const mem of memberships) {
      const orgId = mem.organization_id;
      allUserOrgIds.push(orgId);
      const orgData = (mem as any).organizations;
      const orgName = orgData?.name || "your organization";

      // Query all members in this organization
      const { data: orgMembers, error: orgMembersError } = await dbClient
        .from("organization_members")
        .select("id, user_id, role")
        .eq("organization_id", orgId);

      if (orgMembersError) {
        return internalError(
          "Failed to verify organization members",
          orgMembersError,
          "POST /api/account/delete:verifyMembers"
        );
      }

      const membersList = orgMembers || [];
      const totalMembers = membersList.length;

      // Sole owner guardrail:
      // If user is owner and totalMembers > 1, check if there are other owners
      if (mem.role === "owner" && totalMembers > 1) {
        const ownerCount = membersList.filter((m) => m.role === "owner").length;
        if (ownerCount <= 1) {
          return badRequest(
            `You are the sole owner of organization '${orgName}'. Please transfer ownership to another team member or remove all members before deleting your account.`
          );
        }
      }

      // If user is the only member of an organization, it is a private / sole-member workspace
      if (totalMembers === 1) {
        soleMemberOrgIds.push(orgId);
      }
    }

    // 3. Collect cache keys to invalidate
    const cacheKeysToInvalidate: string[] = [];
    for (const orgId of allUserOrgIds) {
      cacheKeysToInvalidate.push(dashboardKey(orgId));
      cacheKeysToInvalidate.push(pricingKey(orgId));
      cacheKeysToInvalidate.push(memberChatsKey(orgId, user.id));
    }

    // Also collect user's chats to invalidate their transcript caches
    const { data: userChats } = await dbClient
      .from("chats")
      .select("id, organization_id")
      .eq("user_id", user.id);

    if (userChats) {
      for (const chat of userChats) {
        if (chat.organization_id) {
          cacheKeysToInvalidate.push(
            transcriptKey(chat.organization_id, chat.id)
          );
        }
      }
    }

    // Execute cache invalidation
    await invalidate(...cacheKeysToInvalidate);

    // 4. Delete private / sole-member organizations
    if (soleMemberOrgIds.length > 0) {
      const { error: orgDeleteError } = await dbClient
        .from("organizations")
        .delete()
        .in("id", soleMemberOrgIds);

      if (orgDeleteError) {
        return internalError(
          "Failed to delete private organizations",
          orgDeleteError,
          "POST /api/account/delete:deleteSoleOrgs"
        );
      }
    }

    // 5. Delete Supabase Auth record via admin client
    if (!adminClient) {
      return internalError(
        "Admin client unavailable for account deletion",
        null,
        "POST /api/account/delete:missingAdmin"
      );
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteUserError) {
      return internalError(
        "Failed to delete user account",
        deleteUserError,
        "POST /api/account/delete:deleteUser"
      );
    }

    // 6. Terminate active session and clear cookies
    await supabase.auth.signOut();
    try {
      const cookieStore = await cookies();
      cookieStore.delete("sc_active_org_id");
    } catch {
      // In case cookie mutation in route context is restricted
    }

    return apiSuccess({
      success: true,
      message: "Account successfully deleted",
    });
  } catch (err) {
    return internalError(
      "Failed to process account deletion",
      err,
      "POST /api/account/delete"
    );
  }
}
