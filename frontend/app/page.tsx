import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl w-full mx-auto text-center space-y-10">
        {/* Logo mark */}
        <div className="flex justify-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white text-2xl font-bold tracking-tight">
            m
          </span>
        </div>

        {/* Hero */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-slate-900 tracking-tight leading-[1.1]">
            Your agent finds the right job.{" "}
            <span className="text-slate-400">Before you even apply.</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
            matchr uses AI to match your skills and preferences to the jobs that
            actually fit — and surfaces you to the recruiters who matter.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-colors w-full sm:w-auto"
          >
            I&apos;m looking for a job
          </Link>
          <Link
            href="/recruiter"
            className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors w-full sm:w-auto"
          >
            I&apos;m hiring
          </Link>
        </div>

        {/* Social proof / trust signals */}
        <div className="flex items-center justify-center gap-6 text-xs text-slate-400 pt-4">
          <span>AI-powered matching</span>
          <span>·</span>
          <span>Resume parsing</span>
          <span>·</span>
          <span>Zero cold applications</span>
        </div>
      </div>
    </div>
  );
}
