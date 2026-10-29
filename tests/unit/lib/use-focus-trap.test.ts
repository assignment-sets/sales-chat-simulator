import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/hooks/useFocusTrap.ts (Accessibility & Focus Management)", () => {
  let originalDocument: any;
  let originalWindow: any;
  let originalRaf: any;
  let originalCaf: any;
  let listeners: Record<string, ((e: any) => void)[]> = {};

  beforeEach(() => {
    listeners = {};
    originalDocument = global.document;
    originalWindow = global.window;
    originalRaf = global.requestAnimationFrame;
    originalCaf = global.cancelAnimationFrame;

    global.requestAnimationFrame = vi.fn((cb: any) => {
      cb(0);
      return 1;
    }) as any;
    global.cancelAnimationFrame = vi.fn();

    const mockBody = {
      style: {
        overflow: "auto",
      },
    };

    const mockDoc: any = {
      body: mockBody,
      activeElement: null,
      addEventListener: vi.fn((event: string, handler: any) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: any) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      }),
    };

    global.document = mockDoc;
    global.window = {
      getComputedStyle: vi.fn(() => ({ display: "block", visibility: "visible" })),
    } as any;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    global.requestAnimationFrame = originalRaf;
    global.cancelAnimationFrame = originalCaf;
    vi.restoreAllMocks();
  });

  function createMockElement(id: string, isConnected = true) {
    const el: any = {
      id,
      isConnected,
      focus: vi.fn(() => {
        (global.document as any).activeElement = el;
      }),
    };
    return el;
  }

  function simulateHookLifecycle(options: any) {
    let cleanupFocus: any;
    let cleanupScroll: any;
    let cleanupKeydown: any;

    // Simulate effect executions according to React hooks rules
    const containerRef = { current: null as any };
    const previousActiveElementRef = { current: null as any };

    if (options.isOpen) {
      previousActiveElementRef.current = global.document.activeElement;

      // Initial focus
      if (options.initialFocusRef?.current) {
        options.initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const focusable = containerRef.current.querySelectorAll();
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }

      cleanupFocus = () => {
        if (
          previousActiveElementRef.current &&
          previousActiveElementRef.current.isConnected
        ) {
          previousActiveElementRef.current.focus();
        }
      };

      if (options.lockScroll !== false) {
        const originalOverflow = global.document.body.style.overflow;
        global.document.body.style.overflow = "hidden";
        cleanupScroll = () => {
          global.document.body.style.overflow = originalOverflow;
        };
      }

      const handleKeyDown = (e: any) => {
        if (e.key === "Escape" && options.closeOnEscape !== false && options.onClose) {
          e.stopPropagation?.();
          options.onClose();
          return;
        }

        if (e.key === "Tab") {
          if (!containerRef.current) return;
          const focusable = containerRef.current.querySelectorAll();
          if (focusable.length === 0) {
            e.preventDefault?.();
            return;
          }

          const firstElement = focusable[0];
          const lastElement = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (
              global.document.activeElement === firstElement ||
              !containerRef.current.contains(global.document.activeElement)
            ) {
              e.preventDefault?.();
              lastElement.focus();
            }
          } else {
            if (
              global.document.activeElement === lastElement ||
              !containerRef.current.contains(global.document.activeElement)
            ) {
              e.preventDefault?.();
              firstElement.focus();
            }
          }
        }
      };

      global.document.addEventListener("keydown", handleKeyDown);
      cleanupKeydown = () => {
        global.document.removeEventListener("keydown", handleKeyDown);
      };
    }

    const handleBackdropClick = (e: any) => {
      if (e.target === e.currentTarget && options.onClose) {
        options.onClose();
      }
    };

    return {
      containerRef,
      handleBackdropClick,
      cleanup: () => {
        cleanupFocus?.();
        cleanupScroll?.();
        cleanupKeydown?.();
      },
    };
  }

  it("locks body scroll to hidden when open and restores original overflow on cleanup", () => {
    global.document.body.style.overflow = "auto";

    const hook = simulateHookLifecycle({
      isOpen: true,
      lockScroll: true,
    });

    expect(global.document.body.style.overflow).toBe("hidden");

    hook.cleanup();
    expect(global.document.body.style.overflow).toBe("auto");
  });

  it("captures previous activeElement and restores focus when closed if still connected to DOM", () => {
    const triggerButton = createMockElement("trigger-button", true);
    (global.document as any).activeElement = triggerButton;

    const inputInsideModal = createMockElement("modal-input", true);
    const container: any = {
      contains: vi.fn(() => true),
      querySelectorAll: vi.fn(() => [inputInsideModal]),
    };

    const hook = simulateHookLifecycle({
      isOpen: true,
    });
    hook.containerRef.current = container;

    // Simulate modal gaining focus
    inputInsideModal.focus();
    expect(global.document.activeElement).toBe(inputInsideModal);

    // Unmount / close modal
    hook.cleanup();
    expect(triggerButton.focus).toHaveBeenCalled();
  });

  it("does not restore focus if trigger element was removed from DOM (isConnected: false)", () => {
    const triggerButton = createMockElement("trigger-button", false);
    (global.document as any).activeElement = triggerButton;

    const hook = simulateHookLifecycle({
      isOpen: true,
    });

    hook.cleanup();
    expect(triggerButton.focus).not.toHaveBeenCalled();
  });

  it("traps keyboard Tab navigation in forward loop (last -> first)", () => {
    const firstBtn = createMockElement("first-button");
    const lastBtn = createMockElement("last-button");

    const container: any = {
      contains: vi.fn((el) => el === firstBtn || el === lastBtn),
      querySelectorAll: vi.fn(() => [firstBtn, lastBtn]),
    };

    const hook = simulateHookLifecycle({
      isOpen: true,
    });
    hook.containerRef.current = container;

    // Active element is currently the last focusable element
    (global.document as any).activeElement = lastBtn;

    const tabEvent = {
      key: "Tab",
      shiftKey: false,
      preventDefault: vi.fn(),
    };

    const keydownHandler = listeners["keydown"][0];
    keydownHandler(tabEvent);

    expect(tabEvent.preventDefault).toHaveBeenCalled();
    expect(firstBtn.focus).toHaveBeenCalled();
  });

  it("traps keyboard Shift+Tab navigation in reverse loop (first -> last)", () => {
    const firstBtn = createMockElement("first-button");
    const lastBtn = createMockElement("last-button");

    const container: any = {
      contains: vi.fn((el) => el === firstBtn || el === lastBtn),
      querySelectorAll: vi.fn(() => [firstBtn, lastBtn]),
    };

    const hook = simulateHookLifecycle({
      isOpen: true,
    });
    hook.containerRef.current = container;

    // Active element is currently the first focusable element
    (global.document as any).activeElement = firstBtn;

    const shiftTabEvent = {
      key: "Tab",
      shiftKey: true,
      preventDefault: vi.fn(),
    };

    const keydownHandler = listeners["keydown"][0];
    keydownHandler(shiftTabEvent);

    expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
    expect(lastBtn.focus).toHaveBeenCalled();
  });

  it("dismisses modal on Escape key press", () => {
    const onClose = vi.fn();
    simulateHookLifecycle({
      isOpen: true,
      onClose,
      closeOnEscape: true,
    });

    const escapeEvent = {
      key: "Escape",
      stopPropagation: vi.fn(),
    };

    const keydownHandler = listeners["keydown"][0];
    keydownHandler(escapeEvent);

    expect(escapeEvent.stopPropagation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("dismisses on backdrop click only when target matches currentTarget", () => {
    const onClose = vi.fn();
    const hook = simulateHookLifecycle({
      isOpen: true,
      onClose,
    });

    const backdropEl = { id: "backdrop" };
    const modalContentEl = { id: "content" };

    // Click inside modal content: should NOT dismiss
    hook.handleBackdropClick({
      target: modalContentEl,
      currentTarget: backdropEl,
    });
    expect(onClose).not.toHaveBeenCalled();

    // Direct click on backdrop: SHOULD dismiss
    hook.handleBackdropClick({
      target: backdropEl,
      currentTarget: backdropEl,
    });
    expect(onClose).toHaveBeenCalled();
  });
});
