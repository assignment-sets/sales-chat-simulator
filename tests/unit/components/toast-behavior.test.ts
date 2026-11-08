import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { notify } from "@/lib/toast";
import { toast } from "sonner";

// Mock sonner module
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: (props: any) => React.createElement("div", { "data-testid": "toaster", ...props }),
}));

describe("Toast Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lib/toast notify helper", () => {
    it("calls toast.success with message, optional description, and 3500ms duration", () => {
      notify.success("Simulation archived", "Ready to review later");
      expect(toast.success).toHaveBeenCalledWith("Simulation archived", {
        description: "Ready to review later",
        duration: 3500,
      });
    });

    it("calls toast.error with message, optional description, and 4000ms duration", () => {
      notify.error("Failed to delete chat", "Network timeout");
      expect(toast.error).toHaveBeenCalledWith("Failed to delete chat", {
        description: "Network timeout",
        duration: 4000,
      });
    });

    it("calls toast.info with message, optional description, and 3500ms duration", () => {
      notify.info("Practice concluded");
      expect(toast.info).toHaveBeenCalledWith("Practice concluded", {
        description: undefined,
        duration: 3500,
      });
    });

    it("calls toast.warning with message, optional description, and 4000ms duration", () => {
      notify.warning("Approaching token ceiling");
      expect(toast.warning).toHaveBeenCalledWith("Approaching token ceiling", {
        description: undefined,
        duration: 4000,
      });
    });

    it("calls toast.dismiss with target id", () => {
      notify.dismiss("toast-123");
      expect(toast.dismiss).toHaveBeenCalledWith("toast-123");
    });
  });

  describe("app/layout.tsx Toaster Configuration", () => {
    it("configures Toaster for top-right positioning, list expansion, and 5 visible toasts", () => {
      const layoutContent = fs.readFileSync(
        path.join(process.cwd(), "app/layout.tsx"),
        "utf-8"
      );

      expect(layoutContent).toContain('position="top-right"');
      expect(layoutContent).toContain("expand={true}");
      expect(layoutContent).toContain("visibleToasts={5}");
      expect(layoutContent).toContain("richColors");
      expect(layoutContent).toContain("closeButton");
    });
  });

  describe("app/globals.css Slide-In Animations", () => {
    it("defines horizontal translateX transforms for top-right toasts", () => {
      const cssContent = fs.readFileSync(
        path.join(process.cwd(), "app/globals.css"),
        "utf-8"
      );

      // Verify entrance rule
      expect(cssContent).toContain("[data-sonner-toaster][data-x-position='right'] [data-sonner-toast]");
      expect(cssContent).toContain("--x: translateX(110%);");
      expect(cssContent).toContain("transform: var(--y) var(--x);");

      // Verify mounted visible rule
      expect(cssContent).toContain("[data-sonner-toaster][data-x-position='right'] [data-sonner-toast][data-mounted='true']");
      expect(cssContent).toContain("--x: translateX(0);");

      // Verify exit removal rule
      expect(cssContent).toContain("[data-sonner-toaster][data-x-position='right'] [data-sonner-toast][data-removed='true']");
    });
  });
});
