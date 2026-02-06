/**
 * 한국 공휴일 (고정 + 연도별). 필요 시 API로 확장 가능.
 */

export type HolidayItem = { date: string; name: string };

// YYYY-MM-DD → 이름. 2025·2026 기준 (설날/추석/석가탄신일 등 연도별 반영)
const HOLIDAYS: HolidayItem[] = [
  // 2025
  { date: "2025-01-01", name: "신정" },
  { date: "2025-01-28", name: "설날" },
  { date: "2025-01-29", name: "설날" },
  { date: "2025-01-30", name: "설날" },
  { date: "2025-03-01", name: "삼일절" },
  { date: "2025-05-05", name: "어린이날" },
  { date: "2025-05-05", name: "석가탄신일" },
  { date: "2025-06-06", name: "현충일" },
  { date: "2025-08-15", name: "광복절" },
  { date: "2025-10-03", name: "개천절" },
  { date: "2025-10-05", name: "추석" },
  { date: "2025-10-06", name: "추석" },
  { date: "2025-10-07", name: "추석" },
  { date: "2025-10-09", name: "한글날" },
  { date: "2025-12-25", name: "크리스마스" },
  // 2026
  { date: "2026-01-01", name: "신정" },
  { date: "2026-02-16", name: "설날" },
  { date: "2026-02-17", name: "설날" },
  { date: "2026-02-18", name: "설날" },
  { date: "2026-03-01", name: "삼일절" },
  { date: "2026-03-02", name: "대체공휴일" },
  { date: "2026-05-05", name: "어린이날" },
  { date: "2026-05-24", name: "석가탄신일" },
  { date: "2026-05-25", name: "대체공휴일" },
  { date: "2026-06-06", name: "현충일" },
  { date: "2026-08-15", name: "광복절" },
  { date: "2026-08-17", name: "대체공휴일" },
  { date: "2026-09-24", name: "추석" },
  { date: "2026-09-25", name: "추석" },
  { date: "2026-09-26", name: "추석" },
  { date: "2026-10-03", name: "개천절" },
  { date: "2026-10-05", name: "대체공휴일" },
  { date: "2026-10-09", name: "한글날" },
  { date: "2026-12-25", name: "크리스마스" },
];

const BY_DATE = new Map<string, string[]>();
for (const { date, name } of HOLIDAYS) {
  if (!BY_DATE.has(date)) BY_DATE.set(date, []);
  BY_DATE.get(date)!.push(name);
}

/** 특정 날짜의 공휴일 이름 목록 (같은 날 여러 개면 모두 반환) */
export function getHolidaysOn(dateStr: string): string[] {
  return BY_DATE.get(dateStr) ?? [];
}

/** 날짜 구간 내 공휴일 목록 */
export function getHolidaysInRange(start: string, end: string): HolidayItem[] {
  const result: HolidayItem[] = [];
  const startT = new Date(start).getTime();
  const endT = new Date(end).getTime();
  for (const { date, name } of HOLIDAYS) {
    const t = new Date(date).getTime();
    if (t >= startT && t <= endT) result.push({ date, name });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
