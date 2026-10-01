"use client";

import { useState } from "react";

/** 몸무게 추이 선 그래프 (SVG). 목표 몸무게가 있으면 점선으로 표시.
 * 점에 마우스를 올리거나(PC) 누르면(폰) 그날 몸무게 말풍선 */
export function WeightChart({
  points,
  targetKg,
}: {
  points: { date: string; weightKg: number }[];
  targetKg: number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">몸무게를 기록하면 추이가 여기에 그려져요.</p>;
  }

  const W = 640;
  const H = 200;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const values = points.map((p) => p.weightKg);
  if (targetKg != null) values.push(targetKg);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // 위아래 여유 + 변화가 없을 때도 선이 가운데 오게
  const min = Math.floor(rawMin - 1);
  const max = Math.ceil(rawMax + 1);

  const times = points.map((p) => new Date(p.date + "T12:00:00").getTime());
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const x = (t: number) => (t1 === t0 ? padL + (W - padL - padR) / 2 : padL + ((t - t0) / (t1 - t0)) * (W - padL - padR));
  const y = (v: number) => padT + ((max - v) / (max - min)) * (H - padT - padB);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(times[i]).toFixed(1)},${y(p.weightKg).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const label = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
  const last = points[points.length - 1];

  const activePoint = active != null ? points[active] : null;
  /** 말풍선 위치(%). 양 끝에서는 그래프 밖으로 안 나가게 정렬을 바꿈 */
  const activeLeft = active != null && activePoint ? (x(times[active]) / W) * 100 : 0;
  const activeTop = activePoint ? (y(activePoint.weightKg) / H) * 100 : 0;

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="몸무게 추이">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#f0f0ef" />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#a3a3a3">
            {Number.isInteger(v) ? v : v.toFixed(1)}
          </text>
        </g>
      ))}
      {targetKg != null && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(targetKg)} y2={y(targetKg)} stroke="#F19E36" strokeDasharray="5 5" />
          <text x={W - padR} y={y(targetKg) - 6} textAnchor="end" fontSize="11" fill="#C27415">
            목표 {targetKg}kg
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="#171717" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle
            cx={x(times[i])}
            cy={y(p.weightKg)}
            r={i === active ? 5.5 : i === points.length - 1 ? 4.5 : 3}
            fill={i === points.length - 1 || i === active ? "#171717" : "#fff"}
            stroke="#171717"
            strokeWidth={1.5}
          />
          {/* 작은 점도 잡히게 넓은 투명 원 */}
          <circle
            cx={x(times[i])}
            cy={y(p.weightKg)}
            r={14}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive((cur) => (cur === i ? null : i))}
          />
        </g>
      ))}
      <text x={x(t0)} y={H - 8} textAnchor="start" fontSize="11" fill="#a3a3a3">
        {label(points[0].date)}
      </text>
      {points.length > 1 && (
        <text x={x(t1)} y={H - 8} textAnchor="end" fontSize="11" fill="#a3a3a3">
          {label(last.date)}
        </text>
      )}
    </svg>
      {activePoint && (
        <div
          className={`pointer-events-none absolute z-10 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-2xl bg-neutral-900 px-4 py-3 text-[15px] font-semibold tabular-nums text-white shadow-lg ${
            activeLeft < 25 ? "" : activeLeft > 75 ? "-translate-x-full" : "-translate-x-1/2"
          }`}
          style={{ left: `${activeLeft}%`, top: `${activeTop}%` }}
          role="tooltip"
        >
          {label(activePoint.date)} · {activePoint.weightKg}kg
        </div>
      )}
    </div>
  );
}
