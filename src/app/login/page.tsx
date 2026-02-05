import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-4">
      <div className="w-full max-w-[380px] rounded-3xl bg-white/90 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto h-7 w-32 animate-pulse rounded-lg bg-neutral-200" />
          <div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="space-y-5">
          <div className="h-14 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-14 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-200" />
        </div>
        <p className="mt-6 text-center text-sm text-neutral-400">불러오는 중…</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
