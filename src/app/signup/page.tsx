"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback` },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-4">
        <div className="w-full max-w-[380px] rounded-3xl bg-white/90 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-xl text-center">
          <h1 className="text-xl font-semibold text-neutral-900">이메일을 확인해 주세요</h1>
          <p className="mt-3 text-sm text-neutral-600">
            {email}로 인증 링크를 보냈습니다. 링크를 클릭하면 로그인됩니다.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white"
          >
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-4">
      <div className="w-full max-w-[380px] rounded-3xl bg-white/90 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            회원가입
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            이메일과 비밀번호를 입력해 주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/20"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/20"
              placeholder="6자 이상"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.25)] hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "가입 중…" : "가입하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          이미 계정이 있으시면{" "}
          <Link href="/login" className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
