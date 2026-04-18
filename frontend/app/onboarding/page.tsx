"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MOCK_EMAIL = "test@matchr.io";
const MOCK_SUPABASE_UID = "test-user-1";
const TOTAL_STEPS = 5;

type Role = "user" | "assistant";
type Message = { role: Role; content: string };
type Phase = "init" | "chat" | "upload" | "earning" | "done";

interface PointBadge {
  amount: number;
  label: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>("init");
  const [input, setInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [pointBadges, setPointBadges] = useState<PointBadge[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, pointBadges, agentLoading]);

  // On mount: create/fetch candidate, kick off first agent question
  useEffect(() => {
    (async () => {
      // Get or create candidate
      let cid: number;
      const stored = localStorage.getItem("matchr_candidate_id");
      if (stored && !isNaN(parseInt(stored))) {
        cid = parseInt(stored);
      } else {
        const res = await fetch(`${API}/candidates/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: MOCK_EMAIL, user_id: MOCK_SUPABASE_UID }),
        });
        const data = await res.json();
        cid = data.candidate_id;
        localStorage.setItem("matchr_candidate_id", String(cid));
      }
      setCandidateId(cid);

      // Fetch the first agent question (step=0, empty message)
      setAgentLoading(true);
      try {
        const res = await fetch(`${API}/onboarding/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate_id: cid,
            message: "",
            step: 0,
            history: [],
          }),
        });
        const data = await res.json();
        setMessages([{ role: "assistant", content: data.reply }]);
        setPhase("chat");
      } finally {
        setAgentLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || agentLoading || !candidateId) return;
    setInput("");

    const userMsg: Message = { role: "user", content: trimmed };
    // history = everything visible so far (before this user turn)
    const historySnapshot = [...messages];
    const withUser: Message[] = [...historySnapshot, userMsg];
    setMessages(withUser);
    setAgentLoading(true);

    const nextStep = step + 1;
    setStep(nextStep);

    try {
      const res = await fetch(`${API}/onboarding/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          message: trimmed,
          step: nextStep,
          history: historySnapshot,
        }),
      });
      const data = await res.json();

      if (data.complete) {
        setMessages(withUser);
        setPhase("upload");
      } else {
        setMessages([...withUser, { role: "assistant", content: data.reply }]);
      }
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile || !candidateId) return;
    setUploadLoading(true);

    try {
      // Upload resume
      const form = new FormData();
      form.append("candidate_id", String(candidateId));
      form.append("file", uploadFile);
      await fetch(`${API}/candidates/resume`, { method: "POST", body: form });

      // +20 pts for resume
      await fetch(`${API}/points/${candidateId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "resume_uploaded" }),
      });
      setPointBadges((b) => [...b, { amount: 20, label: "resume uploaded" }]);

      // small delay so user sees the +20 badge before +100
      await new Promise((r) => setTimeout(r, 600));

      // +100 pts for onboarding complete
      await fetch(`${API}/points/${candidateId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "onboarding_complete" }),
      });
      setPointBadges((b) => [
        ...b,
        { amount: 100, label: "onboarding complete" },
      ]);

      setPhase("earning");
      setTimeout(() => router.push("/dashboard"), 2500);
    } finally {
      setUploadLoading(false);
    }
  }

  const progress =
    phase === "upload" || phase === "earning" || phase === "done"
      ? 100
      : Math.min(Math.round((step / TOTAL_STEPS) * 100), 95);

  return (
    <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-8">
      {/* Progress bar */}
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Profile setup</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Chat thread */}
      <div className="flex-1 space-y-4 mb-6 overflow-y-auto">
        {messages.map((msg, i) =>
          msg.role === "assistant" ? (
            <div key={i} className="flex items-start gap-2 max-w-[85%]">
              <AgentAvatar />
              <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[85%]">
                {msg.content}
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {agentLoading && (
          <div className="flex items-start gap-2">
            <AgentAvatar />
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upload prompt bubble */}
        {phase === "upload" && !agentLoading && (
          <div className="flex items-start gap-2 max-w-[85%]">
            <AgentAvatar />
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800">
              Last step — upload your resume (PDF or TXT) so I can find your
              best matches.
            </div>
          </div>
        )}

        {/* Points earned badges */}
        {pointBadges.map((badge, i) => (
          <div key={i} className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-4 py-1.5 text-sm font-semibold">
              <span>+{badge.amount} pts</span>
              <span className="text-emerald-500 font-normal">
                · {badge.label}
              </span>
            </div>
          </div>
        ))}

        {/* Completion bubble */}
        {phase === "earning" && (
          <div className="flex items-start gap-2 max-w-[85%]">
            <AgentAvatar />
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800">
              Setting up your profile and finding the best matches…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {phase === "chat" && !agentLoading && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type your answer…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            className="flex-1 h-10 px-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            autoFocus
          />
          <Button
            onClick={() => sendMessage(input)}
            size="sm"
            disabled={!input.trim()}
          >
            Send
          </Button>
        </div>
      )}

      {phase === "upload" && !uploadLoading && (
        <div className="space-y-3">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
          />
          {uploadFile && (
            <Button onClick={handleUpload} className="w-full">
              Upload resume
            </Button>
          )}
        </div>
      )}

      {uploadLoading && (
        <p className="text-sm text-slate-500 text-center animate-pulse">
          Uploading and parsing resume…
        </p>
      )}
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
      m
    </div>
  );
}
