"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  MessageSquare,
  Coins,
  Bot,
  RefreshCw,
  Search,
  ChevronRight,
  ShieldAlert,
  Trophy,
  Award,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { notify } from "@/lib/toast";
import { MemberSimulationsModal } from "@/components/dashboard/MemberSimulationsModal";
import { TranscriptDrawer } from "@/components/dashboard/TranscriptDrawer";
import {
  DashboardKpiSummary,
  DashboardMemberSummary,
} from "@/app/api/dashboard/route";

interface DashboardData {
  kpis: DashboardKpiSummary;
  members: DashboardMemberSummary[];
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  currentUserRole: string;
}

export function TeamDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Drawer inspection state
  const [selectedMember, setSelectedMember] = useState<{
    userId: string;
    email: string;
    fullName?: string;
  } | null>(null);
  const [inspectingChatId, setInspectingChatId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load team dashboard metrics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" label="Loading team analytics..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <ShieldAlert className="w-10 h-10 text-zinc-300 mb-3" />
        <h3 className="text-sm font-semibold text-zinc-800">
          Dashboard Unavailable
        </h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Could not load organization analytics. Make sure you are signed in as an
          admin or owner of this organization.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fetchDashboardData()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { kpis, members, organization } = data;

  const filteredMembers = members.filter((m) =>
    (m.fullName && m.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "No activity yet";
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "accent";
      case "admin":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                Team Oversight Dashboard
              </h1>
              <Badge variant="accent" className="text-xs">
                {organization.name}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Aggregated team metrics, individual sales practice volume, and token usage oversight.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardData(true)}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Simulations</span>
              <Bot className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {kpis.totalSimulations}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Created in organization
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Exchanges</span>
              <MessageSquare className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {kpis.totalMessages}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Prompt & prospect turns
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Team Win Rate</span>
              <Trophy className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {kpis.winRate !== null ? `${kpis.winRate}%` : "—"}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Deals won vs leads lost
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Avg Evaluation</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {kpis.avgScore !== null ? `${kpis.avgScore}` : "—"}
              {kpis.avgScore !== null && (
                <span className="text-xs font-normal text-zinc-400"> / 5</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Jev simulation score
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Total AI Tokens</span>
              <Coins className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 font-mono tracking-tight">
              {kpis.totalTokens.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Model token volume
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Active Members</span>
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {kpis.activeMembersCount}{" "}
              <span className="text-xs font-normal text-zinc-400">
                / {kpis.totalMembersCount}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Reps with simulations
            </p>
          </div>
        </div>

        {/* Member Breakdown Table */}
        <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Team Member Practice Activity
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Review individual sales reps, token consumption, and conversation transcripts.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
              />
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 border-b border-zinc-100 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold select-none">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Team Member</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3 text-right">Simulations</th>
                  <th className="py-3 px-3 text-right">Win Rate</th>
                  <th className="py-3 px-3 text-right">Avg Score</th>
                  <th className="py-3 px-3 text-right">Messages</th>
                  <th className="py-3 px-3 text-right">Tokens</th>
                  <th className="py-3 px-4 sm:px-6">Last Active</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400">
                      No team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr
                      key={member.userId}
                      className="hover:bg-zinc-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.fullName || member.email} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 truncate max-w-[180px] sm:max-w-xs">
                              {member.fullName}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate max-w-[180px] sm:max-w-xs">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <Badge
                          variant={getRoleBadgeVariant(member.role)}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {member.role}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-zinc-800">
                        {member.simulationsCount}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {member.winRate !== null ? (
                          <span
                            className={`font-semibold ${
                              member.winRate >= 70
                                ? "text-emerald-600"
                                : member.winRate >= 40
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {member.winRate}%
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {member.avgScore !== null ? (
                          <span className="font-semibold text-zinc-800">
                            {member.avgScore}{" "}
                            <span className="text-[10px] text-zinc-400 font-normal">
                              / 5
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-zinc-800">
                        {member.messagesCount}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-zinc-700">
                        {member.tokensUsed.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-zinc-500">
                        {formatDate(member.lastActiveAt)}
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={member.simulationsCount === 0}
                          onClick={() => {
                            setSelectedMember({
                              userId: member.userId,
                              email: member.email,
                              fullName: member.fullName,
                            });
                          }}
                          className="h-7 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                          rightIcon={<ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                        >
                          Inspect ({member.simulationsCount})
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Member Simulations Modal */}
      <MemberSimulationsModal
        isOpen={selectedMember !== null}
        onClose={() => setSelectedMember(null)}
        userId={selectedMember?.userId || null}
        userEmail={selectedMember?.email || ""}
        userName={selectedMember?.fullName}
        onSelectChat={(chatId) => {
          setSelectedMember(null);
          setInspectingChatId(chatId);
        }}
      />

      {/* Transcript Drawer */}
      <TranscriptDrawer
        chatId={inspectingChatId}
        onClose={() => setInspectingChatId(null)}
      />
    </div>
  );
}
