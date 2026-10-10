import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { MessageItem } from "@/components/chat/ChatMessageList";

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
    .select("id, product_name, product_description, status")
    .eq("id", id)
    .single();

  if (chatError || !chat) {
    notFound();
  }

  const { data: messageRows } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  const initialMessages: MessageItem[] = (messageRows || []).map((row) => ({
    id: row.id,
    role: row.role as MessageItem["role"],
    content: row.content,
    created_at: row.created_at,
  }));

  return <ChatRoom chat={chat} initialMessages={initialMessages} />;
}
