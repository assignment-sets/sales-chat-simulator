import { beforeEach, vi } from "vitest";
import { testState, mockCookieStore } from "./utils/mock-supabase";

// Set baseline dummy environment variables for Supabase and Groq
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock-publishable-key";
process.env.GROQ_API_KEY = "mock-groq-key";

// Intercept next/headers cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => new Headers()),
}));

// Intercept server Supabase client
vi.mock("@/utils/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => testState.activeClient),
}));

// Intercept admin Supabase client
vi.mock("@/utils/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => testState.adminClient || testState.activeClient),
}));

// Intercept tenant resolver
vi.mock("@/lib/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant")>();
  return {
    ...actual,
    getActiveOrganization: vi.fn(async () => testState.activeContext),
    validateOrgMembership: vi.fn(async (_client: any, _uId: string, targetOrgId: string) => {
      if (testState.activeContext?.organization.id === targetOrgId) {
        return { isMember: true, role: testState.activeContext.role };
      }
      return { isMember: false, role: null };
    }),
  };
});

beforeEach(() => {
  testState.activeClient = null;
  testState.activeContext = null;
  testState.adminClient = null;
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
  mockCookieStore.delete.mockReset();
  mockCookieStore.getAll.mockReset().mockReturnValue([]);
  vi.clearAllMocks();
});
