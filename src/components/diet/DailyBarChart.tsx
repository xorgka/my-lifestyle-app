"use client";

import { useState } from "react";

/** 날짜별 막대 그래프 (SVG). 기록 없는 날은 막대 없음. 목표선이 있으면 점선.
 * 막대에 마우스를 올리거나(PC) 누르면(폰) 날짜·값·설명 말풍선 */
export function DailyBarChart({
  dates,
  values,
  details,
  unit,
  color = "#171717",
  target,
  targetLabel,
  emptyText,
}: {
  /** 보여줄 날짜 (오름차순, 하루도 빠짐없이) */
  dates: string[];
  /** 날짜 → 값. 없으면 기록 없음 */
  values: Record<string, number>;
  /** 날짜 → 말풍선에 한 줄씩 보여줄 설명 (예: 그날 한 운동들) */
  details?: Record<string, string[]>;
  unit: string;
  color?: string;
  target?: number | null;
  targetLabel?: string;
  emptyText: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const recorded = dates.filter((d) => values[d] != null && values[d] > 0);
  if (recorded.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">{emptyText}</p>;
  }

  const W = 640;
  const H = 200;
  const padL = 44;
  const padR = 12;
  const padT = 18;
  const padB = 26;
  const max = Math.max(...recorded.map((d) => values[d]), target ?? 0) * 1.1;
  const slot = (W - padL - padR) / dates.length;
  const barW = Math.max(2, Math.min(18, slot * 0.6));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const label = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
  /** 말풍선용 날짜: 값(숫자)과 헷갈리지 않게 "10월 1일" */
  const tipDate = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
  const ticks = [0, max / 2, max].map((v) => Math.round(v / 10) * 10);

  const activeIndex = active != null ? dates.indexOf(active) : -1;
  const activeValue = active != null ? values[active] : null;
  /** 말풍선 가로 위치(%). 양 끝에서는 그래프 밖으로 안 나가게 정렬을 바꿈 */
  const activeLeft = activeIndex >= 0 ? ((padL + slot * (activeIndex + 0.5)) / W) * 100 : 0;

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`날짜별 ${unit}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#f0f0ef" />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#a3a3a3">
            {v.toLocaleString()}
          </text>
        </g>
      ))}
      {dates.map((d, i) => {
        const v = values[d];
        if (v == null || v <= 0) return null;
        const x = padL + slot * i + (slot - barW) / 2;
        return (
          <g key={d}>
            <rect x={x} y={y(v)} width={barW} height={Math.max(1, H - padB - y(v))} rx={Math.min(4, barW / 2)} fill={color} opacity={active == null || active === d ? 1 : 0.45} />
            {/* 막대가 가늘거나 낮아도 잡히게 그 날짜 칸 전체를 누를 수 있게 */}
            <rect
              x={padL + slot * i}
              y={padT}
              width={slot}
              height={H - padT - padB}
              fill="transparent"
              onMouseEnter={() => setActive(d)}
              onClick={() => setActive((cur) => (cur === d ? null : d))}
            />
          </g>
        );
      })}
      {target != null && target > 0 && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="#F19E36" strokeDasharray="5 5" />
          <text x={W - padR} y={y(target) - 6} textAnchor="end" fontSize="11" fill="#C27415">
            {targetLabel ?? "목표"} {Math.round(target).toLocaleString()}
            {unit}
          </text>
        </g>
      )}
      <text x={padL} y={H - 6} textAnchor="start" fontSize="11" fill="#a3a3a3">
        {label(dates[0])}
      </text>
      <text x={W - padR} y={H - 6} textAnchor="end" fontSize="11" fill="#a3a3a3">
        {label(dates[dates.length - 1])}
      </text>
    </svg>
      {active != null && activeValue != null && activeValue > 0 && (
        <div
          className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-2xl bg-neutral-900 px-4 py-3 text-left text-white shadow-lg ${
            activeLeft < 25 ? "" : activeLeft > 75 ? "-translate-x-full" : "-translate-x-1/2"
          }`}
          style={{ left: `${activeLeft}%`, top: 0 }}
          role="tooltip"
        >
          <p className="text-[13px] font-medium text-white/60">{tipDate(active)}</p>
          <p className="mt-0.5 text-lg font-bold leading-tight tabular-nums">
            {Math.round(activeValue).toLocaleString()}
            {unit}
          </p>
          {details?.[active]?.map((line) => (
            <p key={line} className="mt-1 text-[15px] leading-snug text-white/80">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
