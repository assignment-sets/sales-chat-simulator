"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader } from "@/components/ui/Loader";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogIn,
  UserPlus,
  LogOut,
  Mail,
  Shield,
} from "lucide-react";
import { notify } from "@/lib/toast";
import { logout } from "@/app/auth/actions";

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

interface CurrentUser {
  id: string;
  email?: string;
}

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function InvitePage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInvitation() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Invitation not found or has expired");
        }

        const data = await res.json();
        if (mounted) {
          setInvitation(data.invitation);
          setCurrentUser(data.current_user);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load invitation. Please verify your link."
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadInvitation();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to accept invitation");
      }

      notify.success(
        `Welcome to ${invitation?.organization.name || "the workspace"}!`
      );
      router.push("/chats");
      router.refresh();
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Failed to accept invitation"
      );
      setIsAccepting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const isEmailMismatch =
    currentUser &&
    invitation &&
    currentUser.email?.toLowerCase().trim() !==
      invitation.email?.toLowerCase().trim();

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-8 shadow-xs">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Loader size="md" />
            <p className="text-xs text-zinc-500">Checking invitation details...</p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!isLoading && error && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-zinc-900 mb-2">
              Invitation Invalid or Expired
            </h1>
            <p className="text-xs text-zinc-500 mb-6 max-w-xs">{error}</p>
            <div className="flex gap-2 w-full">
              <Link href="/chats" className="flex-1">
                <Button variant="outline" size="md" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
              <Link href="/login" className="flex-1">
                <Button size="md" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Valid Invitation */}
        {!isLoading && !error && invitation && (
          <div>
            {/* Header Icon & Org Name */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Organization Invitation
                </span>
                <h1 className="text-lg font-bold text-zinc-900 leading-tight">
                  {invitation.organization.name}
                </h1>
              </div>
            </div>

            {/* Expired Banner */}
            {invitation.is_expired ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/60 mb-6">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Invitation Expired</span>
                </div>
                <p className="text-xs text-amber-700">
                  This invitation expired on{" "}
                  {new Date(invitation.expires_at).toLocaleDateString()}. Please
                  ask an organization admin to send you a new link.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-600 mb-5 leading-relaxed">
                  You have been invited to join{" "}
                  <strong className="text-zinc-900">
                    {invitation.organization.name}
                  </strong>{" "}
                  as a workspace team member.
                </p>

                {/* Details Card */}
                <div className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4 mb-6 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Invited Email
                    </span>
                    <span className="font-medium text-zinc-900 font-mono text-[11px]">
                      {invitation.email}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Assigned Role
                    </span>
                    <Badge variant={invitation.role === "admin" ? "success" : "default"}>
                      {invitation.role.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Scenario 1: Not Logged In */}
                {!currentUser && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-zinc-500 text-center">
                      Sign in or create an account with{" "}
                      <span className="font-medium text-zinc-700">
                        {invitation.email}
                      </span>{" "}
                      to accept.
                    </p>
                    <Link
                      href={`/login?next=${encodeURIComponent(
                        `/invite/${token}`
                      )}&email=${encodeURIComponent(invitation.email)}`}
                      className="block w-full"
                    >
                      <Button
                        size="md"
                        className="w-full font-semibold"
                        rightIcon={<LogIn className="w-4 h-4" />}
                      >
                        Sign In to Accept
                      </Button>
                    </Link>
                    <Link
                      href={`/register?next=${encodeURIComponent(
                        `/invite/${token}`
                      )}&email=${encodeURIComponent(invitation.email)}`}
                      className="block w-full"
                    >
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full font-semibold"
                        rightIcon={<UserPlus className="w-4 h-4" />}
                      >
                        Create an Account
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Scenario 2: Logged In, Email Mismatch */}
                {currentUser && isEmailMismatch && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70 text-xs">
                      <p className="font-semibold text-amber-900 mb-1">
                        Different Account Signed In
                      </p>
                      <p className="text-amber-800 leading-relaxed text-[11px]">
                        You are currently signed in as{" "}
                        <strong className="font-mono text-zinc-900">
                          {currentUser.email}
                        </strong>
                        , but this invitation was issued for{" "}
                        <strong className="font-mono text-zinc-900">
                          {invitation.email}
                        </strong>
                        .
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="md"
                      className="w-full text-xs font-medium"
                      onClick={handleSignOut}
                      isLoading={isLoggingOut}
                      leftIcon={<LogOut className="w-3.5 h-3.5" />}
                    >
                      Sign Out & Switch Account
                    </Button>
                  </div>
                )}

                {/* Scenario 3: Logged In, Matching Email */}
                {currentUser && !isEmailMismatch && (
                  <div className="space-y-3">
                    <Button
                      size="md"
                      className="w-full font-semibold"
                      onClick={handleAccept}
                      isLoading={isAccepting}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      {isAccepting ? "Joining Workspace..." : "Accept & Enter Workspace"}
                    </Button>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>
                        Verified as {currentUser.email}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
