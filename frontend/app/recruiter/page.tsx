"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function RecruiterRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !company.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/recruiters/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), company: company.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localStorage.setItem("matchr_recruiter_id", String(data.recruiter_id));
      localStorage.setItem("matchr_recruiter_company", data.company);
      router.push("/recruiter/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 text-white text-lg font-bold mb-4">
            m
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Start hiring smarter
          </h1>
          <p className="text-slate-500 text-sm">
            AI finds you the right candidates — before they even apply.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="company"
              className="text-sm font-medium text-slate-700"
            >
              Company name
            </label>
            <input
              id="company"
              type="text"
              placeholder="Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700"
            >
              Work email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email.trim() || !company.trim()}
          >
            {loading ? "Setting up account…" : "Get started — it's free"}
          </Button>
        </form>

        {/* Plan preview */}
        <div className="border border-slate-100 rounded-xl p-4 space-y-2 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Free plan includes
          </p>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>✓ Post unlimited jobs</li>
            <li>✓ AI-ranked candidate list</li>
            <li>✓ 5 candidate invites</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
