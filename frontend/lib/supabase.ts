const MOCK_SESSION = {
  user: {
    id: "test-user-1",
    email: "test@matchr.io",
  },
};

export function createBrowserClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: MOCK_SESSION }, error: null }),
      getUser: async () => ({ data: { user: MOCK_SESSION.user }, error: null }),
      signInWithOAuth: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}

export const supabase = createBrowserClient();
