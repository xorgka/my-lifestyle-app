/**
 * 홈 알림바용 문장 수집: 스케줄, 루틴, 일기, 지출 등
 */

import { todayStr, addDays } from "./dateUtil";
import {
  loadScheduleEntries,
  getScheduleItemsInRange,
  loadScheduleCompletions,
  getScheduleCompletionKey,
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
    scheduleCompletions,
    routineItems,
    routineCompletions,
    journalEntries,
    budgetEntries,
    keywords,
    monthExtras,
  ] = await Promise.all([
    loadScheduleEntries(),
    loadScheduleCompletions(),
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

  // --- 스케줄 (오늘/내일). 시간 있는 오늘 일정은 지난 건 제외. 완료 체크한 항목 제외 ---
  const scheduleItems = getScheduleItemsInRange(today, tomorrow, scheduleEntries);
  const nowMs = now.getTime();
  for (const item of scheduleItems) {
    const completionKey = getScheduleCompletionKey(item, item.date);
    if (completionKey !== null && scheduleCompletions.has(completionKey)) continue; // 완료한 항목은 알림 제외
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

  // --- 스케줄 다가오는 시간 (24시간 전, 3시간 전, 1시간 전, 30분 전). 완료한 항목 제외 ---
  for (const item of scheduleItems) {
    if (!item.time) continue;
    const completionKeyForItem = getScheduleCompletionKey(item, item.date);
    if (completionKeyForItem !== null && scheduleCompletions.has(completionKeyForItem)) continue;
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
  const ampm = hour >= 12 ? "PM" : "AM";
  const timeLabel = `[${ampm} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}]`;
  alerts.push({
    type: "plain",
    text: `${timeLabel} 루틴 달성률 ${rate}% 🕐`,
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
  const hasAnyTodayEntry = (budgetEntries ?? []).some((e) => e.date === today);
  const todayEntries = (budgetEntries ?? []).filter((e) => e.date === today && !isExcludedFromMonthTotal(e.item));
  const todayTotal = todayEntries.reduce((s, e) => s + e.amount, 0);
  if (todayTotal > 0) {
    alerts.push({
      type: "plain",
      text: `오늘의 지출은 ${formatAmount(todayTotal)}원이에요.`,
      href: "/finance",
    });
  } else if (!hasAnyTodayEntry) {
    alerts.push({
      type: "plain",
      text: "오늘 가계부 작성하셨나요?",
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
      const verb = keyword === "헬스" ? "갔어요" : "했어요";
      const particle = label === "독서" ? "는" : "은";
      alerts.push({
        type: "plain",
        text: `이번달 ${label}${particle} ${days}일 ${verb}. 🔥`,
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

  // --- 헬스장 루틴: 오늘 기준 어제부터 연속 미달성/달성 문구 ---
  const yesterday = addDays(today, -1);
  const gymItems = routineItems.filter((it) => it.title.includes("헬스"));
  const gymIds = new Set(gymItems.map((it) => it.id));
  const label = "헬스장";
  if (gymItems.length > 0) {
    const didOnDate = (dateStr: string) =>
      (routineCompletions[dateStr] ?? []).some((id) => gymIds.has(id));
    const didYesterday = didOnDate(yesterday);
    if (!didYesterday) {
      // 연속 미달성: 어제부터 거슬러 올라가며 안 한 일수
      let missDays = 0;
      for (let d = 1; d <= 365; d++) {
        const dateStr = addDays(today, -d);
        if (didOnDate(dateStr)) break;
        missDays = d;
      }
      if (missDays === 1) {
        alerts.push({
          type: "plain",
          text: "어제 헬스장 안 갔어요! ⚠️",
          href: "/routine",
        });
      } else {
        alerts.push({
          type: "plain",
          text: `${missDays}일째 ${label} 안 가고 있어요! ⚠️`,
          href: "/routine",
        });
      }
    } else {
      // 연속 달성: 어제부터 거슬러 올라가며 한 일수
      let streak = 0;
      for (let d = 1; d <= 365; d++) {
        const dateStr = addDays(today, -d);
        if (!didOnDate(dateStr)) break;
        streak = d;
      }
      if (streak === 1) {
        alerts.push({
          type: "plain",
          text: "어제 헬스장 갔어요! 오늘도 도전? 💪",
          href: "/routine",
        });
      } else {
        // 신기록 여부: 현재 구간보다 이전 데이터만 보고 최대 연속 일수 계산
        const firstDayOfCurrent = addDays(today, -streak);
        const pastGymDates = (Object.keys(routineCompletions) as string[])
          .filter((dateStr) => dateStr < firstDayOfCurrent && didOnDate(dateStr))
          .sort();
        let maxPastStreak = 0;
        let run = 0;
        let prev = "";
        for (const d of pastGymDates) {
          if (prev === "" || addDays(prev, 1) === d) {
            run += 1;
          } else {
            run = 1;
          }
          if (run > maxPastStreak) maxPastStreak = run;
          prev = d;
        }
        const isNewRecord = streak > maxPastStreak;
        alerts.push({
          type: "plain",
          text: isNewRecord
            ? `${streak}일 연속 ${label}! 신기록이에요! 🎉`
            : `${streak}일째 ${label}에 나가고 있어요! 💪`,
          href: "/routine",
        });
      }
    }
  }

  // --- 근육 멘트 (어제 헬스장 루틴 안 했으면 다음날 랜덤으로 한 번) ---
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

  // --- 당신의 속도대로 (날짜 시드로 가끔 표시) ---
  const paceSeed = (parseInt(today.replace(/-/g, ""), 10) + 5) % 4;
  if (paceSeed === 0) {
    alerts.push({
      type: "plain",
      text: "당신의 속도대로 천천히.",
      href: "/",
    });
  }

  // --- 가만히 있으면 (날짜 시드로 가끔 표시) ---
  const stillnessSeed = (parseInt(today.replace(/-/g, ""), 10) + 7) % 5;
  if (stillnessSeed === 0) {
    alerts.push({
      type: "plain",
      text: "가만히 있으면 아무 변화도 없다.",
      href: "/",
    });
  }

  return alerts;
}
