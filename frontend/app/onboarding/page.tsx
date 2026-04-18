"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type Answer = { question: string; answer: string };

const QUESTIONS = [
  {
    id: 0,
    text: "Where would you prefer to work?",
    options: ["Remote", "Hybrid", "On-site"],
  },
  {
    id: 1,
    text: "Open to relocation if sponsored?",
    options: ["Yes", "No, remote only"],
  },
  {
    id: 2,
    text: "What type of company?",
    options: ["Startup", "Corporate", "Agency", "Any"],
  },
  {
    id: 3,
    text: "What matters most to you?",
    options: ["Growth", "Salary", "Work-life balance"],
  },
];

const SALARY_QUESTION = {
  id: 4,
  text: "What's your expected salary? (USD/year)",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [salary, setSalary] = useState("");
  const [finishing, setFinishing] = useState(false);

  const totalSteps = QUESTIONS.length + 1; // +1 for salary
  const progress = Math.round((currentStep / totalSteps) * 100);

  function handleOption(option: string) {
    const q = QUESTIONS[currentStep];
    setAnswers((prev) => [...prev, { question: q.text, answer: option }]);
    setCurrentStep((s) => s + 1);
  }

  function handleSalary() {
    if (!salary.trim()) return;
    setAnswers((prev) => [
      ...prev,
      { question: SALARY_QUESTION.text, answer: salary },
    ]);
    setFinishing(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 1800);
  }

  const allBubbles: { role: "agent" | "user"; text: string }[] = [];
  for (let i = 0; i < answers.length; i++) {
    const q = i < QUESTIONS.length ? QUESTIONS[i] : SALARY_QUESTION;
    allBubbles.push({ role: "agent", text: q.text });
    allBubbles.push({ role: "user", text: answers[i].answer });
  }
  // Current question bubble
  if (!finishing) {
    const currentQ =
      currentStep < QUESTIONS.length ? QUESTIONS[currentStep] : SALARY_QUESTION;
    allBubbles.push({ role: "agent", text: currentQ.text });
  }

  return (
    <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-8">
      {/* Progress */}
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Profile setup</span>
          <span>{progress}%</span>
        </div>
        <Progress value={finishing ? 100 : progress} />
      </div>

      {/* Chat area */}
      <div className="flex-1 space-y-4 mb-8">
        {allBubbles.map((bubble, i) => (
          <div
            key={i}
            className={`flex ${bubble.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {bubble.role === "agent" && (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  m
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800">
                  {bubble.text}
                </div>
              </div>
            )}
            {bubble.role === "user" && (
              <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[85%]">
                {bubble.text}
              </div>
            )}
          </div>
        ))}

        {finishing && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 max-w-[85%]">
              <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                m
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800">
                Setting up your profile…
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      {!finishing && (
        <div className="space-y-3">
          {currentStep < QUESTIONS.length ? (
            <div className="flex flex-wrap gap-2">
              {QUESTIONS[currentStep].options.map((opt) => (
                <Button
                  key={opt}
                  variant="outline"
                  size="sm"
                  onClick={() => handleOption(opt)}
                  className="rounded-full"
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 120000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSalary()}
                className="flex-1 h-10 px-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                autoFocus
              />
              <Button onClick={handleSalary} size="sm">
                Send
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
