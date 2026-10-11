import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

  let query = supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", id);

  if (before) {
    query = query.lt("created_at", before);
  }

  query = query.order("created_at", { ascending: false }).limit(limit);

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reverse to chronological order (oldest to newest)
  const messages = (rows || []).slice().reverse();
  const hasMore = (rows || []).length === limit;
  const nextCursor = rows && rows.length > 0 ? rows[rows.length - 1].created_at : null;

  return NextResponse.json({
    messages,
    hasMore,
    nextCursor,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Verify chat exists and belongs to user
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("id", id)
    .single();

  if (chatError || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // 2. Parse incoming message body
  const body = await request.json().catch(() => ({}));
  const content = (body.content || "").trim();

  if (!content) {
    return NextResponse.json(
      { error: "Message content cannot be empty" },
      { status: 400 }
    );
  }

  // 3. Atomically persist user message
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      chat_id: id,
      user_id: user.id,
      role: "user",
      content,
    })
    .select("id, role, content, created_at")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ message }, { status: 201 });
}
