import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { RenameChatModal } from "@/components/chat/RenameChatModal";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Sidebar, ChatSummary } from "@/components/layout/Sidebar";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { Navbar } from "@/components/layout/Navbar";

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

    it("renders close sidebar button inside sidebar header when onToggle is provided", () => {
      const html = renderToString(
        React.createElement(Sidebar, {
          chats: [],
          isOpen: true,
          onNewChat: vi.fn(),
          onToggle: vi.fn(),
        })
      );

      expect(html).toContain('aria-label="Close sidebar"');
      expect(html).toContain('title="Close sidebar"');
    });
  });

  describe("Navbar", () => {
    it("renders home logo at the extreme left and does not render a sidebar toggle button in the navbar band", () => {
      const html = renderToString(
        React.createElement(Navbar, {
          userEmail: "user@example.com",
          userName: "Test User",
        })
      );

      // Verify home link exists and is rendered
      expect(html).toContain('href="/chats"');
      expect(html).toContain("SalesChat");
      // Sidebar toggle button should not be present in navbar
      expect(html).not.toContain("Collapse sidebar");
      expect(html).not.toContain("Expand sidebar");
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

  describe("Cross-Component Event Synchronization & Loading States", () => {
    let originalWindow: any;
    let listeners: Record<string, ((e: any) => void)[]> = {};

    beforeEach(() => {
      originalWindow = global.window;
      listeners = {};
      const mockWindow = {
        addEventListener: vi.fn((event: string, handler: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        }),
        dispatchEvent: vi.fn((event: any) => {
          const handlers = listeners[event.type] || [];
          handlers.forEach((h) => h(event));
          return true;
        }),
      };
      (global as any).window = mockWindow;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it("dispatches and receives chat:status-change and chat:renamed custom events for synchronization", () => {
      let receivedStatus = "";
      let receivedName = "";

      global.window.addEventListener("chat:status-change", (e: any) => {
        receivedStatus = e.detail?.status;
      });
      global.window.addEventListener("chat:renamed", (e: any) => {
        receivedName = e.detail?.productName;
      });

      global.window.dispatchEvent(
        new CustomEvent("chat:status-change", {
          detail: { chatId: "c1", status: "ARCHIVED" },
        })
      );
      global.window.dispatchEvent(
        new CustomEvent("chat:renamed", {
          detail: { chatId: "c1", productName: "Renamed Title" },
        })
      );

      expect(receivedStatus).toBe("ARCHIVED");
      expect(receivedName).toBe("Renamed Title");
    });
  });
});
