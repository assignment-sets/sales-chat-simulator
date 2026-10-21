"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Plus, MessageSquare, Trash2, X } from "lucide-react";

export interface ChatSummary {
  id: string;
  product_name: string;
  created_at: string;
}

export interface SidebarProps {
  chats: ChatSummary[];
  isOpen: boolean;
  onCloseMobile?: () => void;
  onNewChat: () => void;
  onDeleteChat?: (chatId: string) => Promise<void>;
}

export function Sidebar({
  chats,
  isOpen,
  onCloseMobile,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this simulation?")) return;

    if (onDeleteChat) {
      await onDeleteChat(chatId);
    } else {
      try {
        const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
        if (res.ok) {
          if (pathname === `/chats/${chatId}`) {
            router.push("/chats");
          } else {
            router.refresh();
          }
        }
      } catch (err) {
        console.error("Failed to delete chat", err);
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-2xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-14 lg:top-0 bottom-0 left-0 z-30 lg:z-0 w-72 bg-zinc-50/70 border-r border-zinc-200 flex flex-col h-[calc(100dvh-3.5rem)] lg:h-full shrink-0 overflow-hidden transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        {/* Top Header / Actions */}
        <div className="p-3 pb-1 flex items-center justify-between gap-2 shrink-0">
          <Button
            onClick={onNewChat}
            variant="primary"
            size="sm"
            className="w-full font-medium shadow-xs"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Practice
          </Button>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 lg:hidden rounded-lg hover:bg-zinc-100 cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Chat Threads List */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 space-y-0.5 min-h-0">
          <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider select-none">
            Simulations
          </div>

          {chats.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              No practice sessions yet. Click &quot;New Practice&quot; to begin!
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = pathname === `/chats/${chat.id}`;

              return (
                <div
                  key={chat.id}
                  className="group relative flex items-center rounded-xl transition-colors"
                >
                  <Link
                    href={`/chats/${chat.id}`}
                    onClick={onCloseMobile}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors truncate ${
                      isActive
                        ? "bg-zinc-200/80 text-zinc-900 font-semibold"
                        : "text-zinc-600 hover:bg-zinc-100/90 hover:text-zinc-900"
                    }`}
                  >
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    />
                    <div className="flex-1 truncate text-left">
                      <div className="truncate">{chat.product_name}</div>
                      <div className="text-[10px] text-zinc-400 font-normal">
                        {formatDate(chat.created_at)}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={(e) => handleDelete(e, chat.id)}
                    aria-label="Delete chat"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-2 p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
