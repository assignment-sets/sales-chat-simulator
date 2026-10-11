import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { groq, DEFAULT_GROQ_MODEL } from "@/lib/groq";
import { formatGroqMessages, MessageItem } from "@/lib/prompt";

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

  // 1. Fetch chat metadata
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("*")
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

  // 3. Persist the sales rep's message
  const { error: insertUserMsgError } = await supabase
    .from("messages")
    .insert({
      chat_id: id,
      user_id: user.id,
      role: "user",
      content,
    });

  if (insertUserMsgError) {
    return NextResponse.json(
      { error: insertUserMsgError.message },
      { status: 500 }
    );
  }

  // 4. Fetch full chronological history
  const { data: historyRows, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  const history: MessageItem[] = (historyRows || []).map((row) => ({
    role: row.role as MessageItem["role"],
    content: row.content,
  }));

  // 5. Format prompt messages for Groq
  const groqMessages = formatGroqMessages(
    chat.product_name,
    chat.product_description,
    history
  );

  // 6. Initiate Groq completion stream
  const encoder = new TextEncoder();
  let fullResponse = "";

  try {
    const groqStream = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: groqMessages,
      stream: true,
      temperature: 0.7,
      max_completion_tokens: 500,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of groqStream) {
            const textDelta = chunk.choices[0]?.delta?.content || "";
            if (textDelta) {
              fullResponse += textDelta;
              controller.enqueue(encoder.encode(textDelta));
            }
          }

          // Once stream is done, save assistant message to Supabase
          if (fullResponse.trim()) {
            await supabase.from("messages").insert({
              chat_id: id,
              user_id: user.id,
              role: "assistant",
              content: fullResponse.trim(),
            });
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate AI response",
      },
      { status: 500 }
    );
  }
}
