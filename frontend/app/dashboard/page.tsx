"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FALLBACK_CANDIDATE_ID = 2;

interface JobMatch {
  job_id: number;
  score: number;
  job_structured: {
    title?: string;
    company?: string;
    skills_required?: string[];
    level?: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    remote_ok?: boolean;
  };
}

interface PointsEvent {
  event: string;
  amount: number;
  ts: string;
}

function scoreColor(score: number) {
  if (score >= 0.2) return "success";
  if (score >= 0.1) return "warning";
  return "secondary";
}

function formatSalary(min?: number, max?: number) {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return `From ${fmt(min!)}`;
}

function eventLabel(event: string) {
  const labels: Record<string, string> = {
    resume_uploaded: "Resume uploaded",
    onboarding_complete: "Onboarding complete",
    referral: "Referral bonus",
    offer_confirmed: "Offer confirmed",
  };
  return labels[event] ?? event;
}

export default function DashboardPage() {
  const [candidateId, setCandidateId] = useState<number>(FALLBACK_CANDIDATE_ID);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [pointsHistory, setPointsHistory] = useState<PointsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [interested, setInterested] = useState<Set<number>>(new Set());

  // Resolve candidateId from localStorage on mount (client-only)
  useEffect(() => {
    const stored = localStorage.getItem("matchr_candidate_id");
    if (stored && !isNaN(parseInt(stored))) {
      setCandidateId(parseInt(stored));
    }
  }, []);

  // Fetch jobs + points whenever candidateId is known
  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);

    Promise.all([
      fetch(`${API}/candidates/${candidateId}/jobs`).then((r) => {
        if (!r.ok) throw new Error(`Jobs: HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`${API}/points/${candidateId}`).then((r) => {
        if (!r.ok) throw new Error(`Points: HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([jobData, pointsData]) => {
        setMatches(jobData.matches ?? []);
        setBalance(pointsData.balance ?? 0);
        setPointsHistory((pointsData.history ?? []).slice().reverse());
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [candidateId]);

  async function handleInterested(match: JobMatch) {
    setInterested((prev) => new Set(prev).add(match.job_id));
    try {
      await fetch(`${API}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: match.job_id,
          score: match.score,
          status: "pending",
        }),
      });
    } catch {
      // UI already updated — ignore network errors silently
    }
  }

  function handlePass(jobId: number) {
    setDismissed((prev) => new Set(prev).add(jobId));
  }

  const visible = matches.filter((m) => !dismissed.has(m.job_id));

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your matches</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ranked by AI compatibility score
          </p>
        </div>

        {/* Points card */}
        <div className="shrink-0 bg-slate-900 text-white rounded-xl px-5 py-3 text-center min-w-[88px]">
          <div className="text-2xl font-bold">
            {balance === null ? "—" : balance}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">points</div>

          {/* Points history */}
          {pointsHistory.length > 0 && (
            <ul className="mt-3 space-y-1 text-left border-t border-slate-700 pt-2">
              {pointsHistory.slice(0, 5).map((evt, i) => (
                <li key={i} className="flex justify-between gap-2 text-xs">
                  <span className="text-slate-400 truncate">
                    {eventLabel(evt.event)}
                  </span>
                  <span className="text-emerald-400 font-semibold shrink-0">
                    +{evt.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-44 rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load data: {error}. Is the backend running on port 8000?
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visible.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          No more matches — check back soon!
        </div>
      )}

      {/* Match cards */}
      {!loading &&
        !error &&
        visible.map((match) => {
          const j = match.job_structured;
          const pct = Math.round(match.score * 100);
          const isInterested = interested.has(match.job_id);
          const salary = formatSalary(j.salary_min, j.salary_max);

          return (
            <Card key={match.job_id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {j.title ?? "Untitled Role"}
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {j.company ?? "Company"}
                      {j.location && ` · ${j.location}`}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={scoreColor(match.score)}
                    className="shrink-0"
                  >
                    {pct}% match
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {j.level && (
                    <Badge variant="outline" className="capitalize">
                      {j.level}
                    </Badge>
                  )}
                  {j.remote_ok && <Badge variant="outline">Remote OK</Badge>}
                  {salary && <Badge variant="outline">{salary}</Badge>}
                </div>

                {j.skills_required && j.skills_required.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {j.skills_required.slice(0, 6).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>

              <CardFooter className="gap-2 border-t border-slate-100 pt-4">
                {isInterested ? (
                  <span className="text-sm text-emerald-600 font-medium">
                    ✓ Saved — recruiter notified
                  </span>
                ) : (
                  <>
                    <Button size="sm" onClick={() => handleInterested(match)}>
                      Interested
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePass(match.job_id)}
                    >
                      Pass
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
    </div>
  );
}
