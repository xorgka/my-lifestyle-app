/**
 * 로컬 날짜 기준 YYYY-MM-DD (브라우저 타임존 사용).
 * toISOString()은 UTC라서 한국 새벽에 전날로 나오는 문제를 막기 위해 사용.
 */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘 날짜를 로컬 기준 YYYY-MM-DD로 */
export function todayStr(): string {
  return localDateStr(new Date());
}
