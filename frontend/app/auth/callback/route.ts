import { NextRequest, NextResponse } from "next/server";

/**
 * Supabase OAuth callback. The code is passed to the destination page where
 * the browser-side Supabase client completes the PKCE exchange and stores
 * the session in localStorage.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth_callback`);
  }

  // Redirect to the app with the code; Supabase browser client will
  // call exchangeCodeForSession automatically via detectSessionInUrl.
  return NextResponse.redirect(`${origin}${next}?code=${encodeURIComponent(code)}`);
}
