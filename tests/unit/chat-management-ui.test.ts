import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { RenameChatModal } from "@/components/chat/RenameChatModal";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Sidebar, ChatSummary } from "@/components/layout/Sidebar";
import { ChatRoom } from "@/components/chat/ChatRoom";

vi.mock("next/navigation", () => ({
  usePathname: () => "/chats/chat-1",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Chat Management UI Components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("RenameChatModal", () => {
    it("renders nothing when isOpen is false", () => {
      const html = renderToString(
        React.createElement(RenameChatModal, {
          isOpen: false,
          onClose: vi.fn(),
          chatId: "chat-123",
          initialProductName: "Old Name",
        })
      );
      expect(html).toBe("");
    });

    it("renders edit dialog with pre-filled inputs when isOpen is true", () => {
      const html = renderToString(
        React.createElement(RenameChatModal, {
          isOpen: true,
          onClose: vi.fn(),
          chatId: "chat-123",
          initialProductName: "Enterprise CRM",
          initialProductDescription: "Enterprise pricing objection",
        })
      );

      expect(html).toContain("Edit Simulation");
      expect(html).toContain("Enterprise CRM");
      expect(html).toContain("Enterprise pricing objection");
      expect(html).toContain("Save Changes");
    });
  });

  describe("ChatHeader", () => {
    it("renders active simulation title, edit button, and pitch details toggle", () => {
      const html = renderToString(
        React.createElement(ChatHeader, {
          chatId: "chat-1",
          productName: "SaaS Platform Pitch",
          productDescription: "Objection handle description",
          messageCount: 5,
          status: "ACTIVE",
        })
      );

      expect(html).toContain("SaaS Platform Pitch");
      expect(html).toContain("messages");
      expect(html).toContain("Pitch &amp; Policies");
      expect(html).toContain("Archive");
      expect(html).not.toContain("Archived</");
    });

    it("renders archived badge and resume button when simulation status is ARCHIVED", () => {
      const html = renderToString(
        React.createElement(ChatHeader, {
          chatId: "chat-1",
          productName: "SaaS Platform Pitch",
          productDescription: "Objection handle description",
          messageCount: 3,
          status: "ARCHIVED",
        })
      );

      expect(html).toContain("Archived");
      expect(html).toContain("Resume");
    });
  });

  describe("Sidebar", () => {
    const sampleChats: ChatSummary[] = [
      {
        id: "c1",
        product_name: "Cloud Security",
        product_description: "Zero trust network",
        status: "ACTIVE",
        created_at: "2026-10-28T10:00:00Z",
      },
      {
        id: "c2",
        product_name: "HR Payroll",
        product_description: "Automated tax compliance",
        status: "ARCHIVED",
        created_at: "2026-10-27T10:00:00Z",
      },
      {
        id: "c3",
        product_name: "DevOps Tooling",
        product_description: "CI/CD acceleration",
        status: "ACTIVE",
        created_at: "2026-10-26T10:00:00Z",
      },
    ];

    it("renders search input, segmented active/archived counts, and active simulations list", () => {
      const html = renderToString(
        React.createElement(Sidebar, {
          chats: sampleChats,
          isOpen: true,
          onNewChat: vi.fn(),
        })
      );

      // Verify search input placeholder
      expect(html).toContain('placeholder="Search simulations..."');

      // Verify segmented filter pills show active and archived counts
      expect(html).toContain("Active (");
      expect(html).toContain("Archived (");
      expect(html).toContain("2");
      expect(html).toContain("1");

      // Active chats rendered by default
      expect(html).toContain("Cloud Security");
      expect(html).toContain("DevOps Tooling");
      // Archived chat should not be in active tab list
      expect(html).not.toContain("HR Payroll");
    });

    it("renders empty state message when there are no active practice sessions", () => {
      const html = renderToString(
        React.createElement(Sidebar, {
          chats: [],
          isOpen: true,
          onNewChat: vi.fn(),
        })
      );

      expect(html).toContain("No active practice sessions yet");
    });
  });

  describe("ChatRoom", () => {
    it("renders archived prompt and disabled placeholder when simulation is archived", () => {
      const html = renderToString(
        React.createElement(ChatRoom, {
          chat: {
            id: "chat-archived-1",
            product_name: "Archived SaaS Tool",
            product_description: "Old pitch context",
            status: "ARCHIVED",
          },
          initialMessages: [],
        })
      );

      expect(html).toContain("Archived SaaS Tool");
      expect(html).toContain("Simulation is archived");
      expect(html).toContain("Resume practice");
      expect(html).toContain("Simulation is archived • Click resume to continue");
    });
  });
});
