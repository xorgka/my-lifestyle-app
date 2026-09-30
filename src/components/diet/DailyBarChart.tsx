"use client";

/** 날짜별 막대 그래프 (SVG). 기록 없는 날은 막대 없음. 목표선이 있으면 점선 */
export function DailyBarChart({
  dates,
  values,
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
  unit: string;
  color?: string;
  target?: number | null;
  targetLabel?: string;
  emptyText: string;
}) {
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
  const ticks = [0, max / 2, max].map((v) => Math.round(v / 10) * 10);

  return (
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
          <rect key={d} x={x} y={y(v)} width={barW} height={Math.max(1, H - padB - y(v))} rx={Math.min(4, barW / 2)} fill={color}>
            <title>{`${label(d)} · ${Math.round(v).toLocaleString()}${unit}`}</title>
          </rect>
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
  );
}
