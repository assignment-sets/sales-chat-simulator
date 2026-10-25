import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { MessageItem } from "@/components/chat/ChatMessageList";
import { normalizePlanTier } from "@/lib/plans";

interface ChatPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ChatDetailPage({ params }: ChatPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select(
      "id, product_name, product_description, status, score, evaluation_outcome, evaluation_summary, ai_feedback, organization:organizations(plan_tier)"
    )
    .eq("id", id)
    .single();

  if (chatError || !chat) {
    notFound();
  }

  const orgRel = Array.isArray(chat.organization)
    ? chat.organization[0]
    : chat.organization;
  const planTier = normalizePlanTier(
    (orgRel as { plan_tier?: string | null } | null)?.plan_tier
  );

  const PAGE_SIZE = 50;
  const { data: messageRows } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  // Reverse so they are displayed in ascending chronological order
  const initialMessages: MessageItem[] = (messageRows || [])
    .slice()
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role as MessageItem["role"],
      content: row.content,
      created_at: row.created_at,
    }));

  const initialHasMore = (messageRows || []).length === PAGE_SIZE;

  return (
    <ChatRoom
      key={chat.id}
      chat={chat}
      initialMessages={initialMessages}
      initialHasMore={initialHasMore}
      planTier={planTier}
    />
  );
}
