import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { cached } from "@/lib/cache";
import { transcriptKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import { requireFeature } from "@/lib/entitlements";
import { getActiveOrganization } from "@/lib/tenant";
import { DbChat, DbMessage } from "@/types/database";

interface RouteContext {
  params: Promise<{
    chatId: string;
  }>;
}

interface ChatTranscript {
  chat: DbChat | Record<string, unknown>;
  messages: (DbMessage | Record<string, unknown>)[];
}

class TranscriptLoadError extends Error {
  readonly internal?: unknown;
  readonly context?: string;

  constructor(message: string, internal?: unknown, context?: string) {
    super(message);
    this.name = "TranscriptLoadError";
    this.internal = internal;
    this.context = context;
  }
}

/**
 * Loads one simulation transcript, scoped to the organization.
 *
 * Returns `null` when the simulation is not in this organization so the 404
 * path is never written to the cache.
 */
async function loadTranscript(
  supabase: SupabaseClient,
  orgId: string,
  chatId: string
): Promise<ChatTranscript | null> {
  // 1. Fetch simulation metadata verifying it belongs to this organization
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, product_name, product_description, status, score, evaluation_outcome, tokens_used, created_at, user_id, ai_feedback")
    .eq("id", chatId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (chatError) {
    throw new TranscriptLoadError(
      "Failed to fetch simulation",
      chatError,
      "GET /api/dashboard/chats/[chatId]:chat"
    );
  }

  if (!chat) {
    return null;
  }

  // 2. Fetch full message history for this simulation
  const { data: messages, error: msgsError } = await supabase
    .from("messages")
    .select("id, role, content, created_at, prompt_tokens, completion_tokens, total_tokens")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (msgsError) {
    throw new TranscriptLoadError(
      "Failed to fetch conversation history",
      msgsError,
      "GET /api/dashboard/chats/[chatId]:messages"
    );
  }

  return {
    chat,
    messages: messages || [],
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
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
    return forbidden("Viewing conversation transcripts is restricted to organization owners and admins");
  }

  // Enforce Pro/Scale plan tier requirement for Team Oversight Dashboard
  const featureGate = requireFeature(organization, "team_dashboard");
  if (!featureGate.ok) {
    return featureGate.response;
  }

  let transcript: ChatTranscript | null;
  try {
    transcript = await cached(
      transcriptKey(organization.id, chatId),
      CACHE_TTLS.transcript,
      () => loadTranscript(supabase, organization.id, chatId)
    );
  } catch (error) {
    if (error instanceof TranscriptLoadError) {
      return internalError(error.message, error.internal, error.context);
    }
    return internalError(
      "Failed to fetch conversation",
      error,
      "GET /api/dashboard/chats/[chatId]"
    );
  }

  if (!transcript) {
    return notFound("Simulation not found in this organization");
  }

  return apiSuccess({
    chat: transcript.chat,
    messages: transcript.messages,
  });
}
