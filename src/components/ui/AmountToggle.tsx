"use client";

import { useState } from "react";

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 반올림 축약: 2,804,949 → 280만원, 11,068,940 → 1,107만원, 1억 이상 → 1.6억원 */
export function formatAmountShort(n: number): string {
  if (n >= 100_000_000) {
    const 억 = Math.round(n / 1_000_000) / 100;
    return `${억}억원`;
  }
  const 만 = Math.round(n / 10_000);
  return `${만.toLocaleString("ko-KR")}만원`;
}

type AmountToggleProps = {
  amount: number;
  className?: string;
  /** 연도별 테이블 등에서 음수 색상 */
  variant?: "default" | "profit" | "loss";
  /** 있으면 amount는 USD. 기본 표시=원(환산), 클릭=달러 */
  usdToKrw?: number;
  /** usdToKrw 사용 시 true면 기본 표시를 달러로 */
  defaultShowUsd?: boolean;
};

export function AmountToggle({ amount, className = "", variant = "default", usdToKrw, defaultShowUsd }: AmountToggleProps) {
  const [showFull, setShowFull] = useState(false);
  const [showUsd, setShowUsd] = useState(!!defaultShowUsd);
  const colorClass =
    variant === "loss"
      ? "text-red-600"
      : variant === "profit"
        ? "text-neutral-800"
        : "text-neutral-900";

  if (usdToKrw != null && usdToKrw > 0) {
    const krw = amount * usdToKrw;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowUsd((v) => !v);
        }}
        className={`cursor-pointer rounded px-0.5 py-0.5 text-left transition hover:bg-neutral-100 ${colorClass} ${className}`}
        title={showUsd ? "원으로 보기" : "달러로 보기"}
      >
        {showUsd ? `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : (krw >= 10_000 ? formatAmountShort(krw) : `${formatNum(krw)}원`)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShowFull((v) => !v);
      }}
      className={`cursor-pointer rounded px-0.5 py-0.5 text-left transition hover:bg-neutral-100 ${colorClass} ${className}`}
      title={showFull ? "축약 표시로 전환" : "실제 금액 보기"}
    >
      {showFull ? `${formatNum(amount)}원` : formatAmountShort(amount)}
    </button>
  );
}
