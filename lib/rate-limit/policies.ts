/**
 * Central rate-limit policy table.
 *
 * Keep every limit in this file so route handlers stay declarative and limits
 * can be reviewed/tuned without hunting through the API surface.
 *
 * Window format follows `@upstash/ratelimit` durations (e.g. "30 s", "10 m", "1 h", "1 d").
 */
export type RateLimitWindow =
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

export interface RateLimitPolicy {
  /** Maximum number of requests allowed inside the window. */
  limit: number;
  /** Sliding window duration. */
  window: RateLimitWindow;
  /** Human-readable intent, used in docs and logs. */
  description: string;
}

export const RATE_LIMITS = {
  // --- AI generation (Groq + Jev cost) -------------------------------------
  "ai.reply.user": {
    limit: 10,
    window: "1 m",
    description: "Prospect reply generations per user (burst)",
  },
  "ai.reply.user.hourly": {
    limit: 150,
    window: "1 h",
    description: "Prospect reply generations per user (sustained)",
  },
  "ai.reply.org": {
    limit: 40,
    window: "1 m",
    description: "Prospect reply generations per organization (burst)",
  },
  "ai.feedback.user": {
    limit: 5,
    window: "10 m",
    description: "Detailed AI coaching generations per user (burst)",
  },
  "ai.feedback.user.daily": {
    limit: 30,
    window: "1 d",
    description: "Detailed AI coaching generations per user (daily)",
  },

  // --- Simulations & messages ---------------------------------------------
  "chats.create.user": {
    limit: 5,
    window: "1 m",
    description: "Simulation creations per user (burst)",
  },
  "chats.create.user.daily": {
    limit: 100,
    window: "1 d",
    description: "Simulation creations per user (daily)",
  },
  "chats.update.user": {
    limit: 30,
    window: "1 m",
    description: "Simulation updates (rename/archive/resume) per user",
  },
  "messages.create.user": {
    limit: 20,
    window: "1 m",
    description: "Chat messages sent per user (burst)",
  },
  "messages.create.user.hourly": {
    limit: 300,
    window: "1 h",
    description: "Chat messages sent per user (sustained)",
  },

  // --- Organization management --------------------------------------------
  "orgs.create.user": {
    limit: 2,
    window: "1 h",
    description: "Organization creations per user (burst)",
  },
  "orgs.create.user.daily": {
    limit: 10,
    window: "1 d",
    description: "Organization creations per user (daily)",
  },
  "orgs.invite.org": {
    limit: 10,
    window: "1 h",
    description: "Member invitations per organization (burst)",
  },
  "orgs.invite.org.daily": {
    limit: 30,
    window: "1 d",
    description: "Member invitations per organization (daily)",
  },
  "orgs.switch.user": {
    limit: 60,
    window: "1 m",
    description: "Active organization switches per user",
  },
  "orgs.tier.org": {
    limit: 10,
    window: "1 h",
    description: "Plan tier changes per organization",
  },
  "orgs.rename.org": {
    limit: 10,
    window: "1 h",
    description: "Organization rename attempts per organization",
  },
  "orgs.delete.user": {
    limit: 3,
    window: "1 h",
    description: "Organization deletion attempts per user",
  },
  "orgs.transfer.org": {
    limit: 5,
    window: "1 h",
    description: "Organization ownership transfers per organization",
  },
  "orgs.invite.resend": {
    limit: 15,
    window: "1 h",
    description: "Invitation resends per organization",
  },
  "orgs.member.role": {
    limit: 20,
    window: "1 h",
    description: "Member role modifications per organization",
  },

  // --- Account & GDPR -----------------------------------------------------
  "account.export.user": {
    limit: 5,
    window: "1 h",
    description: "GDPR data exports per user",
  },
  "account.delete.user": {
    limit: 3,
    window: "1 h",
    description: "Account deletion attempts per user",
  },

  // --- Invitations --------------------------------------------------------
  "invitations.view": {
    limit: 60,
    window: "1 m",
    description: "Invitation page views per IP address",
  },
  "invitations.accept": {
    limit: 10,
    window: "1 m",
    description: "Invitation acceptance attempts per user",
  },

  // --- Authentication & Abuse Prevention ----------------------------------
  "auth.login.ip": {
    limit: 10,
    window: "1 m",
    description: "Login attempts per IP address (burst protection)",
  },
  "auth.login.email": {
    limit: 5,
    window: "15 m",
    description: "Login attempts per email address",
  },
  "auth.signup.ip": {
    limit: 5,
    window: "1 h",
    description: "Account registrations per IP address",
  },
  "auth.reset.ip": {
    limit: 3,
    window: "15 m",
    description: "Password reset requests per IP address",
  },
  "auth.verify.ip": {
    limit: 3,
    window: "15 m",
    description: "Resend verification requests per IP address",
  },
  "auth.password_update.ip": {
    limit: 5,
    window: "15 m",
    description: "Password updates per IP address",
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMITS;
