import { vi } from "vitest";
import { OrgRole } from "@/lib/tenant";
import { PlanTier } from "@/lib/plans";

export interface MockUserContext {
  userId?: string;
  email?: string;
  role?: OrgRole;
  orgId?: string;
  orgName?: string;
  planTier?: PlanTier;
  tables?: Record<string, any[]>;
  rpcHandlers?: Record<string, (params: any) => Promise<{ data?: any; error?: any }> | { data?: any; error?: any }>;
}

export interface MockSupabaseOptions {
  userContext?: MockUserContext | null; // null represents unauthenticated
  tables?: Record<string, any[]>;
  rpcHandlers?: Record<string, (params: any) => Promise<{ data?: any; error?: any }> | { data?: any; error?: any }>;
}

/**
 * Creates a chainable query builder mock that mimics Supabase's PostgREST query chain.
 */
export function createMockQueryBuilder(initialData: any = null, error: any = null) {
  let resolvedData = initialData;
  let resolvedError = error;
  let countResult: number | null = null;

  const builder: any = {
    select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
      if (options?.count) {
        countResult = Array.isArray(resolvedData) ? resolvedData.length : (resolvedData ? 1 : 0);
      }
      return builder;
    }),
    insert: vi.fn((payload: any) => {
      resolvedData = Array.isArray(payload) ? payload : [payload];
      return builder;
    }),
    update: vi.fn((payload: any) => {
      resolvedData = payload;
      return builder;
    }),
    delete: vi.fn(() => builder),
    eq: vi.fn((_col: string, _val: any) => builder),
    neq: vi.fn((_col: string, _val: any) => builder),
    in: vi.fn((_col: string, _vals: any[]) => builder),
    gte: vi.fn((_col: string, _val: any) => builder),
    lte: vi.fn((_col: string, _val: any) => builder),
    order: vi.fn((_col: string, _opts?: any) => builder),
    limit: vi.fn((_num: number) => builder),
    single: vi.fn(async () => {
      if (resolvedError) return { data: null, error: resolvedError };
      const item = Array.isArray(resolvedData) ? resolvedData[0] : resolvedData;
      return { data: item ?? null, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (resolvedError) return { data: null, error: resolvedError };
      const item = Array.isArray(resolvedData) ? resolvedData[0] : resolvedData;
      return { data: item ?? null, error: null };
    }),
    then: (onfulfilled: any, onrejected: any) => {
      const result = {
        data: resolvedData,
        error: resolvedError,
        count: countResult,
      };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  return builder;
}

/**
 * Global shared mock state for tests so vi.mock hoists cleanly without closure reference issues.
 */
export const testState = {
  activeClient: null as any,
  activeContext: null as any,
};

export const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(() => []),
};

/**
 * Constructs a mock Supabase client with auth and query methods.
 */
export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const user =
    options.userContext === null
      ? null
      : {
          id: options.userContext?.userId || "test-user-id",
          email: options.userContext?.email || "test@saleschat.io",
          user_metadata: {
            full_name: "Test User",
          },
        };

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: user ? null : { message: "Invalid session" },
      })),
      signInWithPassword: vi.fn(async () => ({
        data: { user, session: user ? { access_token: "mock-token" } : null },
        error: user ? null : { message: "Invalid email or password" },
      })),
      signUp: vi.fn(async () => ({
        data: { user, session: user ? { access_token: "mock-token" } : null },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((tableName: string) => {
      const tableData = options.tables?.[tableName] ?? [];
      return createMockQueryBuilder(tableData);
    }),
    rpc: vi.fn(async (fnName: string, params: any) => {
      if (options.rpcHandlers && options.rpcHandlers[fnName]) {
        return options.rpcHandlers[fnName](params);
      }
      return { data: null, error: null };
    }),
  };

  return client;
}

/**
 * Convenience helper to set up authenticated user and active organization context.
 */
export function setupMockAuth(options: MockUserContext | null = {}) {
  if (options === null) {
    const mockClient = createMockSupabaseClient({ userContext: null });
    testState.activeClient = mockClient;
    testState.activeContext = null;
    return { mockClient, user: null, activeContext: null };
  }

  const userId = options.userId || "test-user-id";
  const email = options.email || "test@saleschat.io";
  const role: OrgRole = options.role || "owner";
  const orgId = options.orgId || "test-org-id";
  const orgName = options.orgName || "Acme Sales";
  const planTier: PlanTier = options.planTier || "starter";

  const organization = {
    id: orgId,
    name: orgName,
    slug: "acme-sales",
    plan_tier: planTier,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const activeContext = {
    organization,
    role,
    allOrganizations: [
      {
        id: "mem-1",
        organization_id: orgId,
        user_id: userId,
        role,
        created_at: new Date().toISOString(),
        organization,
      },
    ],
  };

  const mockClient = createMockSupabaseClient({
    userContext: { userId, email, role, orgId, orgName, planTier },
    tables: options.tables,
    rpcHandlers: options.rpcHandlers,
  });

  testState.activeClient = mockClient;
  testState.activeContext = activeContext;

  return { mockClient, userId, activeContext };
}
