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
import { loadSleepData } from "./sleepDb";
import {
  loadSystemOverrides,
  loadCustomAlerts,
  isCustomAlertInTimeWindow,
} from "./alertBarSettings";

export type AlertItem =
  | { type: "schedule"; prefix: string; bracketed: string; suffix: string; href: string }
  | { type: "plain"; text: string; href: string; /** 시스템 알림 설정 키 (멘트 등) */ systemKey?: string };

/** 홈 알림바 멘트 구간 오렌지 테마 (설정「멘트」탭 5종, 순서 고정) */
export const ALERT_BAR_MOTTO_KEY_ORDER = [
  "antivision",
  "godsae",
  "muscle",
  "pace",
  "stillness",
] as const;

export const ALERT_BAR_MOTTO_KEYS = new Set<string>(ALERT_BAR_MOTTO_KEY_ORDER);

const MOTTO_DEFAULTS: Record<(typeof ALERT_BAR_MOTTO_KEY_ORDER)[number], { text: string; href: string }> = {
  antivision: { text: "지금 멍때리고 있다면 안티비젼에 답변해보세요.", href: "/" },
  godsae: { text: "갓생의 시작은 일찍 자는 것부터입니다.", href: "/" },
  muscle: { text: "근육 1kg은 1500만원의 가치가 있다.", href: "/routine" },
  pace: { text: "당신의 속도대로 천천히.", href: "/" },
  stillness: { text: "가만히 있으면 아무 변화도 없다.", href: "/" },
};

/** 설정「멘트」탭 5문구Slice — `loadAllAlertItems`에 합쳐 한 줄 알림바에서 노출 */
export async function loadMottoTabAlertItems(): Promise<AlertItem[]> {
  const overrides = loadSystemOverrides();
  const out: AlertItem[] = [];
  for (const key of ALERT_BAR_MOTTO_KEY_ORDER) {
    if (overrides[key]?.disabled) continue;
    const def = MOTTO_DEFAULTS[key];
    const custom = overrides[key]?.customText?.trim();
    const text = custom || def.text;
    out.push({ type: "plain", text: text || def.text, href: def.href, systemKey: key });
  }
  return out;
}

function isToday(dateStr: string, today: string) {
  return dateStr === today;
}

/** "HH:mm" → "N시M분" (23:30 → 11시30분, 00:15 → 12시15분) */
function formatBedTimeForAlert(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const minPart = m > 0 ? `${m}분` : "";
  return `${hour}시${minPart}`;
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
  const overrides = loadSystemOverrides();
  const customList = loadCustomAlerts();
  const currentHour = now.getHours();

  /** customText에 {N}, {TIME} 등이 있으면 vars로 치환. 없으면 기본 문구 사용 */
  const pushPlain = (
    key: string,
    defaultText: string,
    href: string,
    vars?: Record<string, string | number>
  ) => {
    if (overrides[key]?.disabled) return;
    const custom = overrides[key]?.customText?.trim();
    let text: string;
    if (custom) {
      text = vars
        ? custom.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
        : custom;
    } else {
      text = defaultText;
    }
    if (!text) text = defaultText;
    alerts.push({ type: "plain", text, href, systemKey: key });
  };

  // --- 수면: 저녁 10시 ~ 새벽 5시에만 "어제 N시M분에 잠에 들었어요.💤" (수면 페이지 데이터 기준) ---
  const isSleepAlertTime = currentHour >= 22 || currentHour < 5;
  if (isSleepAlertTime) {
    const { data: sleepData } = await loadSleepData();
    const todayRecord = sleepData[today];
    const bedTime = todayRecord?.bedTime;
    if (bedTime) {
      const timeStr = formatBedTimeForAlert(bedTime);
      pushPlain("sleep_bedtime", `어제 ${timeStr}에 잠에 들었어요.💤`, "/routine/sleep", { TIME: timeStr });
    }
  }

  // --- 다가오는 생일 (오늘=🎂, D-1/D-5=📅) ---
  const yearEnd = addDays(today, 365);
  const allUpcoming = getScheduleItemsInRange(today, yearEnd, scheduleEntries);
  const birthdayItems = allUpcoming.filter(
    (i) => i.builtinKind === "birthday" || i.title.includes("생일")
  );
  if (!overrides["birthday"]?.disabled) {
    if (overrides["birthday"]?.customText?.trim()) {
      pushPlain("birthday", overrides["birthday"].customText!.trim(), "/schedule");
    } else {
      const fromToday = new Date(today + "T12:00:00").getTime();
      for (const item of birthdayItems) {
        if (item.date === today) {
          pushPlain("birthday", `오늘 ${item.title}이에요! 🎂`, "/schedule");
          break;
        }
      }
      for (const item of birthdayItems) {
        if (item.date <= today) continue;
        const to = new Date(item.date + "T12:00:00").getTime();
        const daysLeft = Math.ceil((to - fromToday) / 86400000);
        if (daysLeft === 1) {
          pushPlain("birthday", `${item.title} D-1 📅`, "/schedule");
        } else if (daysLeft === 5) {
          pushPlain("birthday", `${item.title} D-5 📅`, "/schedule");
        }
      }
    }
  }

  // --- 스케줄 (오늘/내일). 시간 있는 오늘 일정은 지난 건 제외. 완료 체크한 항목 제외 ---
  const scheduleItems = getScheduleItemsInRange(today, tomorrow, scheduleEntries);
  const nowMs = now.getTime();
  if (!overrides["schedule"]?.disabled) {
    if (overrides["schedule"]?.customText?.trim()) {
      alerts.push({ type: "plain", text: overrides["schedule"].customText!.trim(), href: "/schedule" });
    } else {
      for (const item of scheduleItems) {
        const completionKey = getScheduleCompletionKey(item, item.date);
        if (completionKey !== null && scheduleCompletions.has(completionKey)) continue;
        if (item.date === today && item.time) {
          const eventMs = new Date(item.date + "T" + item.time).getTime();
          if (eventMs <= nowMs) continue;
        }
        const parts = scheduleToParts(item, today);
        alerts.push({ type: "schedule", ...parts, href: "/schedule" });
      }
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
    }
  }

  // --- 루틴: 오늘 미완료 항목 ---
  const totalRoutine = routineItems.length;
  const completedToday = new Set(routineCompletions[today] ?? []);
  const incompleteToday = routineItems.filter((it) => !completedToday.has(it.id));
  if (incompleteToday.length > 0 && totalRoutine > 0) {
    pushPlain(
      "routine_incomplete",
      `오늘 루틴 ${incompleteToday.length}개 남았어요. (${incompleteToday.length}/${totalRoutine}) 📋`,
      "/routine",
      { N: incompleteToday.length, total: totalRoutine }
    );
  }

  // --- 루틴: 현재 시간 + 오늘 달성률 ---
  const doneRoutine = (routineCompletions[today] ?? []).length;
  const rate = totalRoutine === 0 ? 0 : Math.round((doneRoutine / totalRoutine) * 100);
  const hour = now.getHours();
  const minute = now.getMinutes();
  const ampm = hour >= 12 ? "PM" : "AM";
  const timeLabel = `[${ampm} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}]`;
  pushPlain("routine_rate", `${timeLabel} 루틴 달성률 ${rate}% 🕐`, "/routine", { TIME: timeLabel, N: rate });

  // --- 일기 연속 N일 ---
  const streak = getJournalStreak(journalEntries);
  if (streak > 0) {
    pushPlain("journal_streak", `일기 연속 ${streak}일 작성 중이에요!`, "/journal", { N: streak });
  }

  // --- 지출: 오늘 ---
  const hasAnyTodayEntry = (budgetEntries ?? []).some((e) => e.date === today);
  const todayEntries = (budgetEntries ?? []).filter((e) => e.date === today && !isExcludedFromMonthTotal(e.item));
  const todayTotal = todayEntries.reduce((s, e) => s + e.amount, 0);
  if (todayTotal > 0) {
    pushPlain("budget_today", `오늘의 지출은 ${formatAmount(todayTotal)}원이에요.`, "/finance", {
      N: formatAmount(todayTotal),
    });
  } else if (!hasAnyTodayEntry) {
    pushPlain("budget_today_none", "오늘 가계부 작성하셨나요?", "/finance");
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
  if (dayNum >= 15 && thisBy15 > lastBy15 && thisBy15 > 0) {
    pushPlain("budget_15_more", "이번달 지출이 좀 많아요.", "/finance");
  }

  // --- 이번달 총 지출 (월요일에만 표시) ---
  const isMonday = now.getDay() === 1;
  const monthTotal = thisMonthEntries.reduce((s, e) => s + e.amount, 0);
  if (monthTotal > 0 && isMonday) {
    pushPlain("budget_month_monday", `이번달 총 지출은 ${formatAmountMan(monthTotal)}입니다.`, "/finance", {
      N: formatAmountMan(monthTotal),
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
      pushPlain("routine_month", `이번달 ${label}${particle} ${days}일 ${verb}. 🔥`, "/routine", {
        label,
        N: days,
        verb,
      });
    }
  }

  // --- 헬스장 루틴: 오늘 기준 어제부터 연속 미달성/달성 문구 ---
  const yesterday = addDays(today, -1);
  const gymItems = routineItems.filter((it) => it.title.includes("헬스"));
  const gymIds = new Set(gymItems.map((it) => it.id));
  const label = "헬스장";
  if (gymItems.length > 0 && !overrides["gym"]?.disabled) {
    const didOnDate = (dateStr: string) =>
      (routineCompletions[dateStr] ?? []).some((id) => gymIds.has(id));
    const didYesterday = didOnDate(yesterday);
    let gymN = 0;
    if (!didYesterday) {
      for (let d = 1; d <= 365; d++) {
        const dateStr = addDays(today, -d);
        if (didOnDate(dateStr)) break;
        gymN = d;
      }
    } else {
      for (let d = 1; d <= 365; d++) {
        const dateStr = addDays(today, -d);
        if (!didOnDate(dateStr)) break;
        gymN = d;
      }
    }
    if (overrides["gym"]?.customText?.trim()) {
      pushPlain("gym", overrides["gym"].customText!.trim(), "/routine", { N: gymN });
    } else {
      if (!didYesterday) {
        if (gymN === 1) {
          pushPlain("gym", "어제 헬스장 안 갔어요! ⚠️", "/routine");
        } else {
          pushPlain("gym", `${gymN}일째 ${label} 안 가고 있어요! ⚠️`, "/routine", { N: gymN });
        }
      } else {
        if (gymN === 1) {
          pushPlain("gym", "어제 헬스장 갔어요! 오늘도 도전? 💪", "/routine");
        } else {
          const firstDayOfCurrent = addDays(today, -gymN);
          const pastGymDates = (Object.keys(routineCompletions) as string[])
            .filter((dateStr) => dateStr < firstDayOfCurrent && didOnDate(dateStr))
            .sort();
          let maxPastStreak = 0;
          let run = 0;
          let prev = "";
          for (const d of pastGymDates) {
            if (prev === "" || addDays(prev, 1) === d) run += 1;
            else run = 1;
            if (run > maxPastStreak) maxPastStreak = run;
            prev = d;
          }
          const isNewRecord = gymN > maxPastStreak;
          pushPlain(
            "gym",
            isNewRecord ? `${gymN}일 연속 ${label}! 신기록이에요! 🎉` : `${gymN}일째 ${label}에 나가고 있어요! 💪`,
            "/routine",
            { N: gymN }
          );
        }
      }
    }
  }

  const mottoSlice = await loadMottoTabAlertItems();
  for (const m of mottoSlice) alerts.push(m);

  // --- 사용자 추가 문구 ---
  for (const item of customList) {
    if (!isCustomAlertInTimeWindow(item, currentHour)) continue;
    alerts.push({
      type: "plain",
      text: item.text.trim() || item.text,
      href: item.href?.trim() || "/",
    });
  }

  return alerts;
}
