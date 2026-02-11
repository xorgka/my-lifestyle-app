"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold text-neutral-800">문제가 생겼어요</h2>
      <p className="text-sm text-neutral-500">{error.message || "알 수 없는 오류"}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        다시 시도
      </button>
    </div>
  );
}
