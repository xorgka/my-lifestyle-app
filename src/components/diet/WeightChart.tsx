"use client";

/** 몸무게 추이 선 그래프 (SVG). 목표 몸무게가 있으면 점선으로 표시 */
export function WeightChart({
  points,
  targetKg,
}: {
  points: { date: string; weightKg: number }[];
  targetKg: number | null;
}) {
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

  return (
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
        <circle key={p.date} cx={x(times[i])} cy={y(p.weightKg)} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? "#171717" : "#fff"} stroke="#171717" strokeWidth={1.5} />
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
  );
}
