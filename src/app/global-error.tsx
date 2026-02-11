"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", background: "#f5f5f7" }}>
        <div style={{ maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1a1a1a" }}>문제가 생겼어요</h2>
          <p style={{ fontSize: "0.875rem", color: "#737373", marginTop: "0.5rem" }}>
            {error.message || "알 수 없는 오류"}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fff",
              background: "#262626",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
