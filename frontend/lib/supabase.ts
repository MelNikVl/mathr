import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Minimal typed interface covering every auth method used in this app.
export interface AppSession {
  user: { id: string; email?: string };
  access_token: string;
}

export interface AppSupabaseClient {
  auth: {
    getSession(): Promise<{ data: { session: AppSession | null }; error: null }>;
    getUser(): Promise<{ data: { user: AppSession["user"] | null }; error: null }>;
    exchangeCodeForSession(
      code: string
    ): Promise<{ data: { session: AppSession | null }; error: null }>;
    signInWithOAuth(opts: {
      provider: string;
      options?: { redirectTo?: string };
    }): Promise<{ data: null; error: null }>;
    signOut(): Promise<{ error: null }>;
    onAuthStateChange(
      cb: (event: string, session: AppSession | null) => void
    ): { data: { subscription: { unsubscribe(): void } } };
  };
}

const MOCK_SESSION: AppSession = {
  user: { id: "dev-user", email: "dev@matchr.io" },
  access_token: "",
};

function createMockClient(): AppSupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session: MOCK_SESSION }, error: null }),
      getUser: async () => ({ data: { user: MOCK_SESSION.user }, error: null }),
      exchangeCodeForSession: async (_code: string) => ({
        data: { session: MOCK_SESSION },
        error: null,
      }),
      signInWithOAuth: async (_opts) => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: (_cb) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
}

export function createBrowserClient(): AppSupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return createMockClient();
  }
  return _createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY) as unknown as AppSupabaseClient;
}

export const supabase = createBrowserClient();
