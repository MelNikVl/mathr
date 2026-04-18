"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 hidden sm:block truncate max-w-[160px]">
          {email}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            supabase.auth.signOut().then(() => (window.location.href = "/"))
          }
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        })
      }
    >
      Sign in with Google
    </Button>
  );
}
