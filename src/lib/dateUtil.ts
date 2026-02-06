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

/** 해당 날짜가 속한 주의 월요일 (로컬) */
export function startOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

/** 해당 날짜가 속한 주의 일요일 (로컬) */
export function endOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

/** 해당 월 1일 YYYY-MM-DD */
export function startOfMonth(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return localDateStr(d);
}

/** 해당 월 마지막 날 YYYY-MM-DD */
export function endOfMonth(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return localDateStr(d);
}

/** 해당 주 월~일 7일 날짜 문자열 배열 (refDate가 속한 주) */
export function getWeekDateStrings(refDate: Date): string[] {
  const mon = new Date(refDate);
  const day = mon.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  mon.setDate(mon.getDate() + diff);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(localDateStr(mon));
    mon.setDate(mon.getDate() + 1);
  }
  return out;
}

/** dateStr(YYYY-MM-DD) 기준 + offset일 후 날짜 문자열 */
export function addDays(dateStr: string, offset: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + offset);
  return localDateStr(d);
}

/** 해당 주 월요일 날짜 문자열로 7일 배열 (월~일) */
export function getWeekDateStringsFromMonday(mondayDateStr: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(addDays(mondayDateStr, i));
  }
  return out;
}

/** 달력용 셀 35개 (일~토 5줄). 각 셀: { dateStr, dayNum, isCurrentMonth } */
export function getCalendarCells(year: number, month: number): { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] {
  const first = new Date(year, month - 1, 1);
  const firstDow = first.getDay();
  const startOffset = firstDow;
  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
  const totalCells = 35;
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month - 1, 1);
    d.setDate(1 - startOffset + i);
    const dateStr = localDateStr(d);
    const dayNum = d.getDate();
    const isCurrentMonth = d.getMonth() === month - 1 && d.getFullYear() === year;
    cells.push({ dateStr, dayNum, isCurrentMonth });
  }
  return cells;
}
