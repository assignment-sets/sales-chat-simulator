"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface SidebarContextValue {
  isOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = "saleschat_sidebar_open";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  // Sync state from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsOpen(stored === "true");
      }
    } catch {
      // Ignore localStorage access issues (e.g., privacy/sandboxed mode)
    }
  }, []);

  const setSidebarOpen = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {}
  };

  const toggleSidebar = () => {
    setSidebarOpen(!isOpen);
  };

  const closeMobile = () => {
    // Only close if on mobile viewport (< 1024px / lg breakpoint)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        toggleSidebar,
        setSidebarOpen,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
