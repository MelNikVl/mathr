"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface RecruiterInfo {
  recruiter_id: number;
  email: string;
  company: string;
  plan: string;
  invites_left: number;
}

interface CandidateMatch {
  candidate_id: number;
  score: number;
  candidate_structured: {
    name?: string;
    email?: string;
    level?: string;
    skills?: string[];
    location?: string;
    salary_expectation?: number;
    experience_years?: number;
  };
}

type InviteState = "idle" | "loading" | "done" | "limit";

function planBadgeVariant(plan: string) {
  if (plan === "pro") return "default" as const;
  if (plan === "starter") return "warning" as const;
  return "secondary" as const;
}

function formatSalary(n?: number) {
  if (!n) return null;
  return `$${(n / 1000).toFixed(0)}k`;
}

function RecruiterDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [recruiter, setRecruiter] = useState<RecruiterInfo | null>(null);
  const [jobText, setJobText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postedJobId, setPostedJobId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [inviteStates, setInviteStates] = useState<Record<number, InviteState>>({});
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const recruiterIdRef = useRef<number | null>(null);

  const fetchRecruiter = useCallback(async (id: number) => {
    const res = await fetch(`${API}/recruiters/${id}`);
    if (!res.ok) return;
    setRecruiter(await res.json());
  }, []);

  // Handle mock upgrade redirect (?upgraded=1&mock=1&recruiter_id=X&plan=Y)
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const mock = searchParams.get("mock");
    const ridParam = searchParams.get("recruiter_id");
    const plan = searchParams.get("plan");

    if (upgraded && mock && ridParam && plan) {
      fetch(
        `${API}/billing/mock-upgrade?recruiter_id=${ridParam}&plan=${plan}`
      ).then(() => {
        // Strip query params and refresh recruiter data
        router.replace("/recruiter/dashboard");
        fetchRecruiter(parseInt(ridParam));
      });
    }
  }, [searchParams, router, fetchRecruiter]);

  // On mount: check localStorage for recruiter_id
  useEffect(() => {
    const stored = localStorage.getItem("matchr_recruiter_id");
    if (!stored || isNaN(parseInt(stored))) {
      router.push("/recruiter");
      return;
    }
    const id = parseInt(stored);
    recruiterIdRef.current = id;
    fetchRecruiter(id);
  }, [router, fetchRecruiter]);

  async function postJob() {
    if (!jobText.trim() || !recruiter) return;
    setPosting(true);
    setCandidates([]);
    setPostedJobId(null);
    setInviteStates({});

    try {
      const jobRes = await fetch(`${API}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruiter_id: recruiter.recruiter_id,
          raw_text: jobText.trim(),
        }),
      });
      const jobData = await jobRes.json();
      const jobId = jobData.id;
      setPostedJobId(jobId);

      setLoadingCandidates(true);
      const matchRes = await fetch(`${API}/jobs/${jobId}/candidates`);
      const matchData = await matchRes.json();
      setCandidates(matchData.matches ?? []);
    } finally {
      setPosting(false);
      setLoadingCandidates(false);
    }
  }

  async function sendInvite(candidate: CandidateMatch) {
    if (!recruiter || !postedJobId) return;

    // Check invite limit before attempting
    if (recruiter.invites_left === 0) {
      setInviteStates((s) => ({ ...s, [candidate.candidate_id]: "limit" }));
      return;
    }

    setInviteStates((s) => ({ ...s, [candidate.candidate_id]: "loading" }));

    try {
      // Step 1: create match record
      const matchRes = await fetch(`${API}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidate.candidate_id,
          job_id: postedJobId,
          score: candidate.score,
        }),
      });
      const matchData = await matchRes.json();
      const matchId = matchData.id;

      // Step 2: send invite
      const inviteRes = await fetch(
        `${API}/recruiters/${recruiter.recruiter_id}/invite/${matchId}`,
        { method: "POST" }
      );

      if (!inviteRes.ok) {
        const err = await inviteRes.json();
        if (inviteRes.status === 402) {
          setInviteStates((s) => ({ ...s, [candidate.candidate_id]: "limit" }));
          setRecruiter((r) => r && { ...r, invites_left: 0 });
          return;
        }
        throw new Error(err.detail);
      }

      const inviteData = await inviteRes.json();
      setInviteStates((s) => ({ ...s, [candidate.candidate_id]: "done" }));
      // Reflect updated invites_left from server
      setRecruiter((r) =>
        r ? { ...r, invites_left: inviteData.invites_left } : r
      );
    } catch {
      setInviteStates((s) => ({ ...s, [candidate.candidate_id]: "idle" }));
    }
  }

  async function handleUpgrade(plan: "starter" | "pro") {
    if (!recruiter) return;
    setCheckoutLoading(plan);
    try {
      const res = await fetch(`${API}/billing/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiter_id: recruiter.recruiter_id, plan }),
      });
      const data = await res.json();
      window.location.href = data.checkout_url;
    } finally {
      setCheckoutLoading(null);
    }
  }

  const isFreePlan = recruiter?.plan === "free";
  const invitesLeft = recruiter?.invites_left ?? 5;

  if (!recruiter) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-10 space-y-10">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {recruiter.company}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{recruiter.email}</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={planBadgeVariant(recruiter.plan)} className="capitalize text-sm px-3 py-1">
            {recruiter.plan} plan
          </Badge>
          <div className="text-sm text-slate-600">
            <span className="font-semibold">
              {invitesLeft === -1 ? "∞" : invitesLeft}
            </span>{" "}
            invite{invitesLeft !== 1 ? "s" : ""} left
          </div>
        </div>
      </div>

      {/* ── Upgrade banner (free plan) ── */}
      {isFreePlan && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900 mb-3">
            Upgrade to send more invites
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-white rounded-lg border border-amber-100 p-4">
              <div className="font-semibold text-slate-900">Starter</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                $49<span className="text-sm font-normal text-slate-400">/mo</span>
              </div>
              <div className="text-sm text-slate-500 mt-1">50 invites/month</div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => handleUpgrade("starter")}
                disabled={checkoutLoading !== null}
              >
                {checkoutLoading === "starter" ? "Redirecting…" : "Upgrade"}
              </Button>
            </div>

            <div className="flex-1 bg-slate-900 rounded-lg p-4 text-white">
              <div className="font-semibold">Pro</div>
              <div className="text-2xl font-bold mt-1">
                $149<span className="text-sm font-normal text-slate-400">/mo</span>
              </div>
              <div className="text-sm text-slate-400 mt-1">Unlimited invites</div>
              <Button
                size="sm"
                className="mt-3 w-full bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => handleUpgrade("pro")}
                disabled={checkoutLoading !== null}
              >
                {checkoutLoading === "pro" ? "Redirecting…" : "Upgrade"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post a Job ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Post a job</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Describe the role in plain text — AI will parse requirements and find matching candidates.
          </p>
        </div>

        <textarea
          rows={5}
          placeholder="e.g. Looking for a senior backend engineer. Python, FastAPI, PostgreSQL. Remote-friendly. $130–160k/year. 5+ years experience..."
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
        />

        <Button
          onClick={postJob}
          disabled={posting || !jobText.trim()}
          className="w-full sm:w-auto"
        >
          {posting ? "Finding candidates…" : "Find candidates"}
        </Button>
      </div>

      {/* ── Candidates section ── */}
      {(loadingCandidates || candidates.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Top candidates
            {candidates.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-2">
                — {candidates.length} ranked by AI
              </span>
            )}
          </h2>

          {loadingCandidates && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-36 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          )}

          {!loadingCandidates &&
            candidates.map((c) => {
              const cs = c.candidate_structured;
              const state = inviteStates[c.candidate_id] ?? "idle";
              const pct = Math.round(c.score * 100);
              const atLimit = invitesLeft === 0;

              return (
                <Card key={c.candidate_id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {cs.name ?? `Candidate #${c.candidate_id}`}
                        </CardTitle>
                        <CardDescription className="mt-0.5">
                          {cs.location ?? "Location unknown"}
                          {cs.experience_years &&
                            ` · ${cs.experience_years} yrs exp`}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={pct >= 20 ? "success" : pct >= 10 ? "warning" : "secondary"}
                        className="shrink-0"
                      >
                        {pct}% match
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {cs.level && (
                        <Badge variant="outline" className="capitalize">
                          {cs.level}
                        </Badge>
                      )}
                      {cs.salary_expectation && (
                        <Badge variant="outline">
                          Expects {formatSalary(cs.salary_expectation)}
                        </Badge>
                      )}
                    </div>

                    {cs.skills && cs.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {cs.skills.slice(0, 6).map((sk) => (
                          <span
                            key={sk}
                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="border-t border-slate-100 pt-3 gap-2">
                    {state === "done" ? (
                      <span className="text-sm text-emerald-600 font-medium">
                        ✓ Invite sent
                      </span>
                    ) : state === "limit" || (atLimit && state !== "loading") ? (
                      <span className="text-sm text-amber-600">
                        Invite limit reached — upgrade to send more
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => sendInvite(c)}
                        disabled={state === "loading"}
                      >
                        {state === "loading" ? "Sending…" : "Send invite"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function RecruiterDashboard() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-slate-400 text-sm animate-pulse">Loading…</div></div>}>
      <RecruiterDashboardInner />
    </Suspense>
  );
}
