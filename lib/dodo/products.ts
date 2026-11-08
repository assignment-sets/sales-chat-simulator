export interface DodoPlanProduct {
  tierId: 'solo' | 'team' | 'scale';
  productId: string;
  name: string;
  description: string;
  usdPriceCents: number;
  inrPricePaise: number;
}

export const DODO_PRODUCTS: Record<'solo' | 'team' | 'scale', DodoPlanProduct> = {
  solo: {
    tierId: 'solo',
    productId: 'pdt_0NrCqCpQLfiaQSDlhGxoC',
    name: 'Chat2Sell Solo',
    description: 'For solo SDRs, indie sales reps, and freelancers (50 simulations/month, 1 seat)',
    usdPriceCents: 500,
    inrPricePaise: 39900,
  },
  team: {
    tierId: 'team',
    productId: 'pdt_0NrCqCw137x2o5PtfWW3E',
    name: 'Chat2Sell Team',
    description: 'For small sales pods and SDR teams (200 simulations/month, up to 10 seats, team dashboard & benchmarks)',
    usdPriceCents: 2900,
    inrPricePaise: 199900,
  },
  scale: {
    tierId: 'scale',
    productId: 'pdt_0NrCqD1GfGTlFxBTIfmdg',
    name: 'Chat2Sell Scale',
    description: 'For scaling sales organizations and revenue teams (600 simulations/month, up to 50 seats)',
    usdPriceCents: 7900,
    inrPricePaise: 549900,
  },
};

/**
 * Helper to look up Dodo product configuration by tier ID ('solo' | 'team' | 'scale').
 */
export function getDodoProductByTier(tierId: 'solo' | 'team' | 'scale'): DodoPlanProduct {
  return DODO_PRODUCTS[tierId];
}

/**
 * Helper to look up Dodo product configuration by Dodo product ID (pdt_...).
 */
export function getDodoProductById(productId: string): DodoPlanProduct | undefined {
  return Object.values(DODO_PRODUCTS).find((p) => p.productId === productId);
}
