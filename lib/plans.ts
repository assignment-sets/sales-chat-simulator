export type PlanTier = "starter" | "pro" | "scale";

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
      monthly_simulations: 15,
      team_seats: 1,
    },
    features: {
      detailed_ai_feedback: false,
      team_dashboard: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For small sales pods and SDR teams",
    priceMonthly: 79,
    quotas: {
      monthly_simulations: 150,
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
    tagline: "For scaling sales organizations",
    priceMonthly: 249,
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

export function normalizePlanTier(tier?: string | null): PlanTier {
  if (tier === "pro" || tier === "scale") {
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
