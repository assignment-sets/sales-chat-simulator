import { useEffect, useRef, useCallback } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  closeOnEscape = true,
  lockScroll = true,
  initialFocusRef,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // 1. Focus capture & restoration
  useEffect(() => {
    if (!isOpen) return;

    // Save previously focused element before modal takes focus
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const frameId = requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const focusableElements =
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          containerRef.current.focus?.();
        }
      }
    });

    return () => {
      cancelAnimationFrame(frameId);
      // Restore focus on close / unmount if element is still connected to DOM
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === "function" &&
        previousActiveElementRef.current.isConnected
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  // 2. Scroll locking
  useEffect(() => {
    if (!isOpen || !lockScroll) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, lockScroll]);

  // 3. Tab trapping & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!containerRef.current) return;

        const focusable = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => {
          if (typeof window !== "undefined" && window.getComputedStyle) {
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") return false;
          }
          return true;
        });

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === firstElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (
            document.activeElement === lastElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // 4. Uniform backdrop click dismissal
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  return {
    containerRef,
    handleBackdropClick,
  };
}
