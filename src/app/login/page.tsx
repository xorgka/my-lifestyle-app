"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 올바르지 않습니다." : signInError.message);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-4">
      <div className="w-full max-w-[380px] rounded-3xl bg-white/90 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            로그인
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            My Lifestyle 대시보드에 로그인하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-sm transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/20"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-sm transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/20"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.25)] transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          계정이 없으시면{" "}
          <Link
            href="/signup"
            className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
          >
            회원가입
          </Link>
          을 진행해 주세요.
        </p>
      </div>
    </div>
  );
}
