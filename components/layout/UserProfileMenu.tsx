"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateProfile, logout } from "@/app/auth/actions";
import { notify } from "@/lib/toast";
import { AccountSettingsModal } from "./AccountSettingsModal";
import {
  ChevronDown,
  Settings,
  User,
  LogOut,
  Check,
  X,
  Pencil,
} from "lucide-react";

export interface UserProfileMenuProps {
  userEmail?: string;
  userName?: string;
}

export function UserProfileMenu({
  userEmail = "",
  userName = "",
}: UserProfileMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(userName || userEmail.split("@")[0] || "");
  const [currentName, setCurrentName] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignOutPending, startSignOutTransition] = useTransition();

  const menuRef = useRef<HTMLDivElement>(null);

  // Sync internal state if prop updates
  useEffect(() => {
    if (userName) {
      setCurrentName(userName);
      setNameInput(userName);
    } else if (userEmail) {
      setNameInput(userEmail.split("@")[0]);
    }
  }, [userName, userEmail]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = currentName || (userEmail ? userEmail.split("@")[0] : "Account");

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      notify.error("Full name cannot be empty");
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateProfile(trimmed);
      if (!res.success) {
        throw new Error(res.error || "Failed to update profile name");
      }

      setCurrentName(trimmed);
      setIsEditing(false);
      notify.success("Name updated successfully");
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      await logout();
    });
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Navbar Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIsEditing(false);
        }}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer select-none border ${
          isOpen
            ? "bg-zinc-100 text-zinc-900 border-zinc-200/90 shadow-2xs"
            : "text-zinc-700 border-transparent hover:border-zinc-200/60 hover:bg-zinc-100/70"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Avatar name={displayName} size="sm" />
        <span className="hidden sm:inline text-xs text-zinc-900 max-w-[140px] truncate font-medium">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-zinc-600" : ""
          }`}
        />
      </button>

      {/* Profile Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-zinc-200/80 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
          {/* User Info Header */}
          <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-3">
            <Avatar name={displayName} size="md" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-zinc-900 block truncate">
                {displayName}
              </span>
              {userEmail && (
                <p className="text-[11px] text-zinc-500 truncate" title={userEmail}>
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          {/* Quick Edit Name Form / Button */}
          <div className="mt-2 pt-1 border-t border-zinc-100 px-1">
            {isEditing ? (
              <form onSubmit={handleSaveName} className="p-1 space-y-2">
                <label className="text-[11px] font-medium text-zinc-600 flex items-center justify-between">
                  <span>Display Name</span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your full name"
                  className="h-8 text-xs px-2.5"
                  autoFocus
                  required
                />
                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    isLoading={isSaving}
                    leftIcon={<Check className="w-3 h-3" />}
                  >
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameInput(currentName || userEmail.split("@")[0] || "");
                  setIsEditing(true);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Edit Name</span>
                </div>
                <Pencil className="w-3 h-3 text-zinc-400" />
              </button>
            )}

            {/* Settings */}
            <button
              type="button"
              onClick={handleSettingsClick}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer text-left mt-0.5"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                <span>Settings</span>
              </div>
            </button>
          </div>

          {/* Sign Out Option inside Menu */}
          <div className="mt-1 pt-1 border-t border-zinc-100 px-1">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSignOutPending}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-zinc-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400 group-hover:text-red-600" />
              <span>{isSignOutPending ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={userEmail}
        userName={displayName}
      />
    </div>
  );
}
