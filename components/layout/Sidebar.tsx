"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { RenameChatModal } from "@/components/chat/RenameChatModal";
import {
  Plus,
  MessageSquare,
  Trash2,
  X,
  Search,
  Pencil,
  Archive,
  RotateCcw,
  PanelLeftClose,
} from "lucide-react";
import { notify } from "@/lib/toast";

export interface ChatSummary {
  id: string;
  product_name: string;
  product_description?: string;
  status?: string;
  created_at: string;
}

export interface SidebarProps {
  chats: ChatSummary[];
  isOpen: boolean;
  onToggle?: () => void;
  onCloseMobile?: () => void;
  onNewChat: () => void;
  onDeleteChat?: (chatId: string) => Promise<void>;
}

export function Sidebar({
  chats,
  isOpen,
  onToggle,
  onCloseMobile,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [localChats, setLocalChats] = useState<ChatSummary[]>(chats);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [renamingChat, setRenamingChat] = useState<ChatSummary | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  // Synchronize when server props update
  useEffect(() => {
    setLocalChats(chats);
  }, [chats]);

  // Synchronize cross-component events (e.g. ChatHeader or ChatRoom actions)
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const detail = (e as CustomEvent<{ chatId: string; status: string }>).detail;
      if (!detail?.chatId) return;
      setLocalChats((prev) =>
        prev.map((c) => (c.id === detail.chatId ? { ...c, status: detail.status } : c))
      );
    };

    const handleRenamed = (e: Event) => {
      const detail = (e as CustomEvent<{
        chatId: string;
        productName: string;
        productDescription?: string;
      }>).detail;
      if (!detail?.chatId) return;
      setLocalChats((prev) =>
        prev.map((c) =>
          c.id === detail.chatId
            ? {
                ...c,
                product_name: detail.productName,
                product_description: detail.productDescription ?? c.product_description,
              }
            : c
        )
      );
    };

    const handleDeleted = (e: Event) => {
      const detail = (e as CustomEvent<{ chatId: string }>).detail;
      if (!detail?.chatId) return;
      setLocalChats((prev) => prev.filter((c) => c.id !== detail.chatId));
    };

    window.addEventListener("chat:status-change", handleStatusChange);
    window.addEventListener("chat:renamed", handleRenamed);
    window.addEventListener("chat:deleted", handleDeleted);

    return () => {
      window.removeEventListener("chat:status-change", handleStatusChange);
      window.removeEventListener("chat:renamed", handleRenamed);
      window.removeEventListener("chat:deleted", handleDeleted);
    };
  }, []);

  const activeCount = useMemo(
    () => localChats.filter((c) => c.status !== "ARCHIVED").length,
    [localChats]
  );
  const archivedCount = useMemo(
    () => localChats.filter((c) => c.status === "ARCHIVED").length,
    [localChats]
  );

  const filteredChats = useMemo(() => {
    return localChats.filter((chat) => {
      // 1. Tab filter
      const isArchived = chat.status === "ARCHIVED";
      if (activeTab === "active" && isArchived) return false;
      if (activeTab === "archived" && !isArchived) return false;

      // 2. Search query filter
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const nameMatch = chat.product_name.toLowerCase().includes(query);
      const descMatch = (chat.product_description || "").toLowerCase().includes(query);
      return nameMatch || descMatch;
    });
  }, [localChats, activeTab, searchQuery]);

  const handleArchiveToggle = async (e: React.MouseEvent, chat: ChatSummary) => {
    e.preventDefault();
    e.stopPropagation();

    if (actionInProgress[chat.id]) return;

    const isArchived = chat.status === "ARCHIVED";
    const action = isArchived ? "resume" : "archive";
    const nextStatus = isArchived ? "ACTIVE" : "ARCHIVED";

    // Optimistically update local state so the conversation instantly moves across tabs
    setLocalChats((prev) =>
      prev.map((c) => (c.id === chat.id ? { ...c, status: nextStatus } : c))
    );

    try {
      setActionInProgress((prev) => ({ ...prev, [chat.id]: true }));
      const res = await fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to ${action} simulation`);
      }

      const json = await res.json();
      const confirmedStatus = json.chat?.status || nextStatus;

      // Confirm verified status
      setLocalChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, status: confirmedStatus } : c))
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("chat:status-change", {
            detail: { chatId: chat.id, status: confirmedStatus },
          })
        );
      }

      notify.success(isArchived ? "Simulation resumed" : "Simulation archived");
      router.refresh();
    } catch (err) {
      // Revert optimistic update on failure
      setLocalChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, status: chat.status } : c))
      );
      notify.error(err instanceof Error ? err.message : `Failed to ${action} simulation`);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [chat.id]: false }));
    }
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this simulation?")) return;

    // Optimistically remove from local list
    const previous = localChats;
    setLocalChats((prev) => prev.filter((c) => c.id !== chatId));

    if (onDeleteChat) {
      await onDeleteChat(chatId);
    } else {
      try {
        const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
        if (res.ok) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("chat:deleted", { detail: { chatId } })
            );
          }
          notify.success("Simulation deleted");
          if (pathname === `/chats/${chatId}`) {
            router.push("/chats");
          } else {
            router.refresh();
          }
        } else {
          setLocalChats(previous);
          notify.error("Failed to delete simulation");
        }
      } catch (err) {
        setLocalChats(previous);
        console.error("Failed to delete chat", err);
        notify.error("Failed to delete simulation");
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
      <div
        onClick={onCloseMobile}
        className={`fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-2xs transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-14 lg:top-0 bottom-0 left-0 z-30 lg:z-0 bg-zinc-50/70 border-zinc-200 flex flex-col h-[calc(100dvh-3.5rem)] lg:h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen
            ? "w-72 translate-x-0 border-r opacity-100 pointer-events-auto"
            : "w-72 -translate-x-full lg:translate-x-0 lg:w-0 lg:border-transparent lg:opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`w-72 min-w-[18rem] flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-x-0" : "lg:-translate-x-full"
          }`}
        >
          {/* Top Header / Actions */}
          <div className="p-3 pb-1 flex items-center justify-between gap-2 shrink-0">
          <Button
            onClick={onNewChat}
            variant="primary"
            size="sm"
            className="flex-1 font-medium shadow-xs"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Practice
          </Button>

          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200/70 transition-colors cursor-pointer shrink-0"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : onCloseMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 lg:hidden rounded-lg hover:bg-zinc-100 cursor-pointer shrink-0"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        {/* Search Input */}
        <div className="relative px-3 pt-2 pb-1.5 shrink-0">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-5.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search simulations..."
            className="w-full h-8 pl-8 pr-7 bg-zinc-100/80 border border-transparent rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 transition-colors focus:outline-none focus:bg-white focus:border-zinc-300 focus:ring-1 focus:ring-zinc-900/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Segmented Control (Active / Archived) */}
        <div className="px-3 pt-0.5 pb-1 shrink-0">
          <div className="flex bg-zinc-200/60 p-0.5 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`flex-1 py-1 rounded-lg text-center transition-all cursor-pointer ${
                activeTab === "active"
                  ? "bg-white text-zinc-900 font-semibold shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("archived")}
              className={`flex-1 py-1 rounded-lg text-center transition-all cursor-pointer ${
                activeTab === "archived"
                  ? "bg-white text-zinc-900 font-semibold shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>
        </div>

        {/* Chat Threads List */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 space-y-0.5 min-h-0">
          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              {searchQuery.trim()
                ? `No simulations matching "${searchQuery.trim()}".`
                : activeTab === "archived"
                ? "No archived simulations."
                : 'No active practice sessions yet. Click "New Practice" to begin!'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = pathname === `/chats/${chat.id}`;
              const isInProgress = Boolean(actionInProgress[chat.id]);

              return (
                <div
                  key={chat.id}
                  className="group relative flex items-center rounded-xl transition-colors"
                >
                  <Link
                    href={`/chats/${chat.id}`}
                    onClick={onCloseMobile}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 pr-20 rounded-xl text-xs transition-colors truncate ${
                      isActive
                        ? "bg-zinc-200/80 text-zinc-900 font-semibold"
                        : "text-zinc-600 hover:bg-zinc-100/90 hover:text-zinc-900"
                    } ${isInProgress ? "opacity-60" : ""}`}
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

                  {/* Quick Row Action Buttons */}
                  <div
                    className={`absolute right-1.5 flex items-center gap-0.5 transition-opacity ${
                      isInProgress
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRenamingChat(chat);
                      }}
                      disabled={isInProgress}
                      aria-label="Rename simulation"
                      title="Rename simulation"
                      className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 rounded-md transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleArchiveToggle(e, chat)}
                      disabled={isInProgress}
                      aria-label={
                        chat.status === "ARCHIVED" ? "Resume simulation" : "Archive simulation"
                      }
                      title={chat.status === "ARCHIVED" ? "Resume" : "Archive"}
                      className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 rounded-md transition-all cursor-pointer min-w-5 h-5 flex items-center justify-center disabled:cursor-wait"
                    >
                      {isInProgress ? (
                        <Loader size="sm" dotClassName="bg-zinc-600" />
                      ) : chat.status === "ARCHIVED" ? (
                        <RotateCcw className="w-3 h-3" />
                      ) : (
                        <Archive className="w-3 h-3" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, chat.id)}
                      disabled={isInProgress}
                      aria-label="Delete chat"
                      title="Delete simulation"
                      className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </aside>

      {renamingChat && (
        <RenameChatModal
          isOpen={Boolean(renamingChat)}
          onClose={() => setRenamingChat(null)}
          chatId={renamingChat.id}
          initialProductName={renamingChat.product_name}
          initialProductDescription={renamingChat.product_description || ""}
          onSuccess={(updated) => {
            setLocalChats((prev) =>
              prev.map((c) =>
                c.id === renamingChat.id
                  ? {
                      ...c,
                      product_name: updated.productName,
                      product_description:
                        updated.productDescription ?? c.product_description,
                    }
                  : c
              )
            );
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("chat:renamed", {
                  detail: {
                    chatId: renamingChat.id,
                    productName: updated.productName,
                    productDescription: updated.productDescription,
                  },
                })
              );
            }
            router.refresh();
          }}
        />
      )}
    </>
  );
}
