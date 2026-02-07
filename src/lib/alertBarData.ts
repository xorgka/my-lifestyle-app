/**
 * 홈 알림바용 문장 수집: 스케줄, 루틴, 일기, 지출 등
 */

import { todayStr, addDays } from "./dateUtil";
import {
  loadScheduleEntries,
  getScheduleItemsInRange,
  type ScheduleItem,
} from "./scheduleDb";
import { loadRoutineItems, loadRoutineCompletions } from "./routineDb";
import { loadJournalEntries } from "./journal";
import {
  loadEntries,
  loadKeywords,
  loadMonthExtras,
  getKeywordsForMonth,
  isExcludedFromMonthTotal,
  toYearMonth,
} from "./budget";
export type AlertItem =
  | { type: "schedule"; prefix: string; bracketed: string; suffix: string; href: string }
  | { type: "plain"; text: string; href: string };

function isToday(dateStr: string, today: string) {
  return dateStr === today;
}

function scheduleToParts(item: ScheduleItem, today: string): { prefix: string; bracketed: string; suffix: string } {
  const dayLabel = isToday(item.date, today) ? "오늘" : "내일";
  const t = item.title.trim();
  if (!t) return { prefix: `${dayLabel}은 `, bracketed: "예정", suffix: "이 있어요!" };
  const last = t.charCodeAt(t.length - 1);
  const hasJong = (last - 0xac00) % 28 !== 0;
  return {
    prefix: `${dayLabel}은 `,
    bracketed: t,
    suffix: hasJong ? "이 있어요!" : "가 있어요!",
  };
}

/** 루틴 항목 제목에 키워드가 포함돼 있으면 이번달 해당 항목 완료 일수 카운트용 */
const ROUTINE_KEYWORDS_FOR_MONTH = ["독서", "철봉", "헬스", "유튜브"];

function formatAmount(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 만 원 단위로 반올림해서 "282만원" 형식으로 표시 */
function formatAmountMan(n: number): string {
  const man = Math.round(n / 10000);
  return `${man.toLocaleString("ko-KR")}만원`;
}

/** 일기 연속 작성일 (오늘 기준, 오늘 포함해서 과거로 쭉) */
function getJournalStreak(entries: { date: string }[]): number {
  const dateSet = new Set(entries.map((e) => e.date));
  let d = new Date();
  let count = 0;
  for (;;) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    if (!dateSet.has(key)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export async function loadAllAlertItems(): Promise<AlertItem[]> {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const now = new Date();
  const yearMonth = toYearMonth(today);
  const [y, m] = yearMonth.split("-").map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const [
    scheduleEntries,
    routineItems,
    routineCompletions,
    journalEntries,
    budgetEntries,
    keywords,
    monthExtras,
  ] = await Promise.all([
    loadScheduleEntries(),
    loadRoutineItems(),
    loadRoutineCompletions(),
    loadJournalEntries(),
    loadEntries(),
    loadKeywords(),
    loadMonthExtras(),
  ]);

  const alerts: AlertItem[] = [];

  // --- 다가오는 생일 (오늘=🎂, D-1/D-5=📅) ---
  const yearEnd = addDays(today, 365);
  const allUpcoming = getScheduleItemsInRange(today, yearEnd, scheduleEntries);
  const birthdayItems = allUpcoming.filter(
    (i) => i.builtinKind === "birthday" || i.title.includes("생일")
  );
  const fromToday = new Date(today + "T12:00:00").getTime();
  for (const item of birthdayItems) {
    if (item.date === today) {
      alerts.push({
        type: "plain",
        text: `오늘 ${item.title}이에요! 🎂`,
        href: "/schedule",
      });
      break;
    }
  }
  for (const item of birthdayItems) {
    if (item.date <= today) continue;
    const to = new Date(item.date + "T12:00:00").getTime();
    const daysLeft = Math.ceil((to - fromToday) / 86400000);
    if (daysLeft === 1) {
      alerts.push({
        type: "plain",
        text: `${item.title} D-1 📅`,
        href: "/schedule",
      });
    } else if (daysLeft === 5) {
      alerts.push({
        type: "plain",
        text: `${item.title} D-5 📅`,
        href: "/schedule",
      });
    }
  }

  // --- 스케줄 (오늘/내일). 시간 있는 오늘 일정은 지난 건 제외 ---
  const scheduleItems = getScheduleItemsInRange(today, tomorrow, scheduleEntries);
  const nowMs = now.getTime();
  for (const item of scheduleItems) {
    if (item.date === today && item.time) {
      const eventMs = new Date(item.date + "T" + item.time).getTime();
      if (eventMs <= nowMs) continue; // 이미 지난 시간이면 알림 제외
    }
    const parts = scheduleToParts(item, today);
    alerts.push({
      type: "schedule",
      ...parts,
      href: "/schedule",
    });
  }

  // --- 스케줄 다가오는 시간 (24시간 전, 3시간 전, 1시간 전, 30분 전) ---
  for (const item of scheduleItems) {
    if (!item.time) continue;
    const eventMs = new Date(item.date + "T" + item.time).getTime();
    if (eventMs <= nowMs) continue;
    const diffMs = eventMs - nowMs;
    const diffHours = diffMs / (1000 * 60 * 60);
    const title = item.title?.trim() || "일정";
    if (diffHours >= 23.5 && diffHours < 24.5) {
      alerts.push({ type: "plain", text: `${title} 24시간 전`, href: "/schedule" });
    } else if (diffHours >= 2.5 && diffHours < 3.5) {
      alerts.push({ type: "plain", text: `${title} 3시간 전`, href: "/schedule" });
    } else if (diffHours >= 0.75 && diffHours < 1.25) {
      alerts.push({ type: "plain", text: `${title} 1시간 전`, href: "/schedule" });
    } else if (diffHours >= 0.25 && diffHours < 0.5) {
      alerts.push({ type: "plain", text: `${title} 30분 전`, href: "/schedule" });
    }
  }

  // --- 루틴: 오늘 미완료 항목 ---
  const totalRoutine = routineItems.length;
  const completedToday = new Set(routineCompletions[today] ?? []);
  const incompleteToday = routineItems.filter((it) => !completedToday.has(it.id));
  if (incompleteToday.length > 0 && totalRoutine > 0) {
    alerts.push({
      type: "plain",
      text: `오늘 루틴 ${incompleteToday.length}개 남았어요. (${incompleteToday.length}/${totalRoutine}) 📋`,
      href: "/routine",
    });
  }

  // --- 루틴: 현재 시간 + 오늘 달성률 ---
  const doneRoutine = (routineCompletions[today] ?? []).length;
  const rate = totalRoutine === 0 ? 0 : Math.round((doneRoutine / totalRoutine) * 100);
  const hour = now.getHours();
  const minute = now.getMinutes();
  alerts.push({
    type: "plain",
    text: `지금 ${hour}시 ${String(minute).padStart(2, "0")}분 | 루틴 달성률 ${rate}% 🕐`,
    href: "/routine",
  });

  // --- 일기 연속 N일 ---
  const streak = getJournalStreak(journalEntries);
  if (streak > 0) {
    alerts.push({
      type: "plain",
      text: `일기 연속 ${streak}일 작성 중이에요!`,
      href: "/journal",
    });
  }

  // --- 지출: 오늘 ---
  const keywordsForMonth = getKeywordsForMonth(keywords, monthExtras, yearMonth);
  const todayEntries = (budgetEntries ?? []).filter((e) => e.date === today && !isExcludedFromMonthTotal(e.item));
  const todayTotal = todayEntries.reduce((s, e) => s + e.amount, 0);
  if (todayTotal > 0) {
    alerts.push({
      type: "plain",
      text: `오늘의 지출은 ${formatAmount(todayTotal)}원이에요.`,
      href: "/finance",
    });
  }

  // --- 이번달 15일까지 vs 저번달 15일까지 ---
  const thisMonthEntries = (budgetEntries ?? []).filter(
    (e) => toYearMonth(e.date) === yearMonth && !isExcludedFromMonthTotal(e.item)
  );
  const lastMonthEntries = (budgetEntries ?? []).filter(
    (e) => toYearMonth(e.date) === lastMonth && !isExcludedFromMonthTotal(e.item)
  );
  const dayNum = now.getDate();
  const thisBy15 = thisMonthEntries.filter((e) => parseInt(e.date.slice(8, 10), 10) <= 15).reduce((s, e) => s + e.amount, 0);
  const lastBy15 = lastMonthEntries.filter((e) => parseInt(e.date.slice(8, 10), 10) <= 15).reduce((s, e) => s + e.amount, 0);
  if (dayNum >= 15 && (thisBy15 > 0 || lastBy15 > 0)) {
    if (thisBy15 > lastBy15) {
      alerts.push({
        type: "plain",
        text: `이번달 15일까지 쓴 지출이 저번달보다 많아요.`,
        href: "/finance",
      });
    } else if (thisBy15 < lastBy15 && thisBy15 > 0) {
      alerts.push({
        type: "plain",
        text: `이번달 15일까지 쓴 지출이 저번달보다 적어요.`,
        href: "/finance",
      });
    }
  }

  // --- 이번달 총 지출 (월요일에만 표시) ---
  const isMonday = now.getDay() === 1;
  const monthTotal = thisMonthEntries.reduce((s, e) => s + e.amount, 0);
  if (monthTotal > 0 && isMonday) {
    alerts.push({
      type: "plain",
      text: `이번달 총 지출은 ${formatAmountMan(monthTotal)}입니다.`,
      href: "/finance",
    });
  }

  // --- 루틴 항목별 이번달 N일 (독서, 철봉, 헬스장, 유튜브 등) ---
  const thisMonthStart = `${yearMonth}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const thisMonthEnd = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
  for (const keyword of ROUTINE_KEYWORDS_FOR_MONTH) {
    const matchingItems = routineItems.filter((it) => it.title.includes(keyword));
    if (matchingItems.length === 0) continue;
    const matchingIds = new Set(matchingItems.map((it) => it.id));
    const datesDone = new Set<string>();
    Object.entries(routineCompletions).forEach(([date, ids]) => {
      if (date >= thisMonthStart && date <= thisMonthEnd && ids.some((id) => matchingIds.has(id))) {
        datesDone.add(date);
      }
    });
    const days = datesDone.size;
    if (days > 0) {
      const label = keyword === "헬스" ? "헬스장" : keyword;
      alerts.push({
        type: "plain",
        text: `이번달 ${label}은 ${days}일 했어요. 🔥`,
        href: "/routine",
      });
    }
  }

  // --- 안티비젼 (오전 8시 ~ 오후 3시 사이에 랜덤으로 한 번) ---
  const inAntivisionWindow = hour >= 8 && hour < 15;
  const antivisionSeed = (parseInt(today.replace(/-/g, ""), 10) + 1) % 3;
  if (inAntivisionWindow && antivisionSeed === 0) {
    alerts.push({
      type: "plain",
      text: "지금 멍때리고 있다면 안티비젼에 답변해보세요.",
      href: "/",
    });
  }

  // --- 갓생 (저녁 9시 ~ 새벽 3시 사이에 랜덤으로 한 번) ---
  const inSleepWindow = hour >= 21 || hour < 3;
  const sleepSeed = (parseInt(today.replace(/-/g, ""), 10) + 2) % 3;
  if (inSleepWindow && sleepSeed === 0) {
    alerts.push({
      type: "plain",
      text: "갓생의 시작은 일찍 자는 것부터입니다.",
      href: "/",
    });
  }

  // --- 근육 멘트 (어제 헬스장 루틴 안 했으면 다음날 랜덤으로 한 번) ---
  const yesterday = addDays(today, -1);
  const gymItems = routineItems.filter((it) => it.title.includes("헬스"));
  const completedYesterday = new Set(routineCompletions[yesterday] ?? []);
  const didGymYesterday = gymItems.some((it) => completedYesterday.has(it.id));
  const muscleSeed = (parseInt(today.replace(/-/g, ""), 10) + 3) % 2;
  if (gymItems.length > 0 && !didGymYesterday && muscleSeed === 0) {
    alerts.push({
      type: "plain",
      text: "근육 1kg은 1500만원의 가치가 있다.",
      href: "/routine",
    });
  }

  return alerts;
}
