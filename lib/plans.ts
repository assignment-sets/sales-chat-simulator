export type PlanTier = "starter" | "solo" | "team" | "scale";

export type QuotaType =
  | "monthly_simulations"
  | "team_seats";

export type FeatureFlag =
  | "detailed_ai_feedback"
  | "team_dashboard";

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  tagline: string;
  priceMonthly: number;
  quotas: Record<QuotaType, number>;
  features: Record<FeatureFlag, boolean>;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For individual reps practicing core pitches",
    priceMonthly: 0,
    quotas: {
      monthly_simulations: 10,
      team_seats: 1,
    },
    features: {
      detailed_ai_feedback: false,
      team_dashboard: false,
    },
  },
  solo: {
    id: "solo",
    name: "Solo",
    tagline: "For solo SDRs, indie sales reps, and freelancers",
    priceMonthly: 5,
    quotas: {
      monthly_simulations: 50,
      team_seats: 1,
    },
    features: {
      detailed_ai_feedback: true,
      team_dashboard: false,
    },
  },
  team: {
    id: "team",
    name: "Team",
    tagline: "For sales pods and small SDR teams",
    priceMonthly: 29,
    quotas: {
      monthly_simulations: 200,
      team_seats: 10,
    },
    features: {
      detailed_ai_feedback: true,
      team_dashboard: true,
    },
  },
  scale: {
    id: "scale",
    name: "Scale",
    tagline: "For scaling sales organizations and revenue teams",
    priceMonthly: 79,
    quotas: {
      monthly_simulations: 600,
      team_seats: 50,
    },
    features: {
      detailed_ai_feedback: true,
      team_dashboard: true,
    },
  },
};

export const MAX_USER_TURNS = 40;
export const MAX_OWNED_ORGS_PER_USER = 3;

export function normalizePlanTier(tier?: string | null): PlanTier {
  if (tier === "pro") {
    return "team";
  }
  if (tier === "solo" || tier === "team" || tier === "scale") {
    return tier;
  }
  return "starter";
}

export function getPlanConfig(tier?: string | null): PlanDefinition {
  return PLAN_CONFIGS[normalizePlanTier(tier)];
}

export function hasFeature(
  tier: string | null | undefined,
  feature: FeatureFlag
): boolean {
  return getPlanConfig(tier).features[feature];
}

export function getQuotaLimit(
  tier: string | null | undefined,
  quota: QuotaType
): number {
  return getPlanConfig(tier).quotas[quota];
}
