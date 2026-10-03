"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/Card";
import {
  type BudgetEntry,
  type BudgetEntryDetail,
  type CategoryId,
  type CategoryKeywords,
  type MonthExtraKeywords,
  type ParentGroup,
  type SmsGroupRule,
  applySmsGroupRulesToItem,
  baseGroupName,
  canonicalizeBudgetItemName,
  getCategoryForEntry,
  getKeywordsForMonth,
  isExcludedFromMonthTotal,
  looksLikeCardBulkSettlementItem,
  parentOfGroup,
  todayStr,
} from "@/lib/budget";
import { USER_SETTINGS_SYNC_EVENT, loadSetting, saveSetting } from "@/lib/userSettings";

/** 만 원 단위로 반올림해서 "594만". 1만 원이 안 되면 "8,500원" (좁은 곳용) */
function manShort(n: number): string {
  const abs = Math.abs(n);
  return abs < 10000 ? `${Math.round(abs).toLocaleString("ko-KR")}원` : `${Math.round(abs / 10000).toLocaleString("ko-KR")}만`;
}
/** "594만 원". 1만 원이 안 되면 "8,500원" */
function man(n: number): string {
  return Math.abs(n) < 10000 ? manShort(n) : manShort(n) + " 원";
}
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** "2026-10" 에서 delta 달 만큼 이동 */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}월`;
/** 올해가 아니면 "27년 5월" */
const monthLabelWithYear = (ym: string, baseYm: string) =>
  ym.slice(0, 4) === baseYm.slice(0, 4) ? monthLabel(ym) : `${ym.slice(2, 4)}년 ${monthLabel(ym)}`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 지출 한 줄: 카드출금은 세부내역으로 풀어서 본다 */
type Line = { date: string; name: string; group: string; amount: number; fromCard: boolean };

/** 할부 표기 "강의 (텍홀 11/12)" → { label: "텍홀", n: 11, total: 12 } */
function parseInstallment(name: string): { label: string; n: number; total: number } | null {
  const m = name.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  const total = Number(m[2]);
  if (!(n >= 1 && total >= n && total <= 60)) return null;
  const open = name.indexOf("(");
  const base = (open >= 0 ? name.slice(0, open) : name).trim();
  const inner = (open >= 0 ? name.slice(open + 1).replace(/\)\s*$/, "") : "")
    .replace(m[0], "")
    .replace(/할부/g, "")
    .trim();
  return { label: inner || base, n, total };
}

/** 미리 보여줄 줄 수 (나머지는 "전체 보기"로) */
const PREVIEW = 3;

type SectionId = "installment" | "subscription" | "compare" | "new";

/** 브리핑 한 칸: 제목(옆 화살표를 누르면 전체 펼침), 강조 문구, 숫자, 대표 항목 몇 줄 */
function Section({
  title,
  main,
  highlight,
  rows,
  empty,
  footnote,
  expanded,
  onToggle,
}: {
  title: string;
  main: string;
  highlight?: ReactNode;
  rows: ReactNode[];
  empty: string;
  footnote?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const shown = expanded ? rows : rows.slice(0, PREVIEW);
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4">
      {/* 제목 줄: 아래 항목과 구분되게 크고 굵게 + 구분선 */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
        {/* 강조 문구는 제목 바로 옆에 (좁으면 아래 줄로) */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          {rows.length > PREVIEW ? (
            // 제목과 화살표를 누르면 나머지 항목이 펼쳐짐
            <button
              type="button"
              onClick={onToggle}
              className="group flex items-center gap-1 text-left"
              aria-expanded={expanded}
              aria-label={expanded ? `${title} 접기` : `${title} 전체 ${rows.length}개 보기`}
            >
              <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
              <svg
                className={`h-5 w-5 shrink-0 text-neutral-400 transition group-hover:text-neutral-800 ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ) : (
            <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
          )}
          {highlight && <span className="text-[15px] font-semibold leading-snug">{highlight}</span>}
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-neutral-600">{main}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{empty}</p>
      ) : (
        <ul className="mt-2 pl-2.5 text-[15px] md:text-[17px]">{shown}</ul>
      )}
      {footnote && rows.length > 0 && (expanded || rows.length <= PREVIEW) && (
        <p className="mt-auto pt-2 text-xs text-neutral-400">{footnote}</p>
      )}
    </div>
  );
}

const rowClass = "flex items-baseline justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-0";
const navButton =
  "flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:pointer-events-none disabled:opacity-30";
const selectClass = "rounded-lg border border-neutral-200 bg-white px-1.5 py-1.5 text-sm text-neutral-800 sm:px-2.5";

/** 항목별 기록이 있는 첫 달 (그 전 해는 총액만 있어서 브리핑을 만들 수 없음) */
const FIRST_MONTH = "2026-01";

/** 한 달 지출 목표 기본값 (원). 브리핑에서 바꿀 수 있음 */
const DEFAULT_GOAL = 2500000;

/** 목표와 비교할 때 지출을 나누는 덩어리 */
type Bucket = "basic" | "lecture" | "business" | "other";
const BUCKETS: { id: Bucket; label: string; color: string }[] = [
  { id: "basic", label: "필수 지출", color: "#E5E5E5" },
  { id: "lecture", label: "강의·할부", color: "#F19E36" },
  { id: "business", label: "사업경비", color: "#38BDF8" },
  { id: "other", label: "그 외", color: "#737373" },
];

/** 덩어리 글자를 눌렀을 때 모달에 보여줄 설명 */
const BUCKET_NOTES: Record<Bucket, string> = {
  basic: "고정비·세금·생활비를 합친 금액이에요. 이름에 그 카테고리 키워드가 들어가면 여기로 잡혀요.",
  lecture: "이름이 \"강의\"로 시작하거나 \"3/12\" 같은 할부 표시가 있는 결제예요.",
  business: "사업경비 키워드에 걸리는 결제예요 (AI 도구, 광고, 세무사 등).",
  other: "필수 지출·강의·할부·사업경비 어디에도 안 들어가는 나머지예요.",
};

/**
 * 월별 브리핑: 쓴 돈과 전달 대비, 새로 생긴 지출, 할부, 구독, 전달과 비교.
 * 좌우 버튼·연/월 선택으로 지난 달도 본다. 지난 달은 그 달 전체 기준.
 * 가계부 항목(카드출금은 세부내역)만으로 계산한다. 적금·IRP·ISA·주택청약은 지출에서 뺀다.
 */
export function SpendingBriefing({
  entries,
  entryDetails,
  keywords,
  monthExtras,
  smsGroupRules,
  parentGroups,
}: {
  entries: BudgetEntry[];
  entryDetails: BudgetEntryDetail[];
  keywords: CategoryKeywords;
  monthExtras: MonthExtraKeywords;
  smsGroupRules: SmsGroupRule[];
  parentGroups: ParentGroup[];
}) {
  const [expanded, setExpanded] = useState<SectionId | null>(null);
  /** 내용을 보려고 누른 덩어리 (필수 지출·강의·할부·사업경비·그 외) */
  const [bucketModal, setBucketModal] = useState<Bucket | null>(null);
  const toggle = (id: SectionId) => () => setExpanded((cur) => (cur === id ? null : id));

  /** 한 달 지출 목표(원). 기기 간 동기화되는 설정 */
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [goalInput, setGoalInput] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const v = Number(loadSetting<number>("finance-monthly-goal", DEFAULT_GOAL));
      setGoal(Number.isFinite(v) && v > 0 ? v : DEFAULT_GOAL);
    };
    sync();
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    return () => window.removeEventListener(USER_SETTINGS_SYNC_EVENT, sync);
  }, []);
  const saveGoal = () => {
    const manWon = Number((goalInput ?? "").replace(/,/g, ""));
    if (Number.isFinite(manWon) && manWon > 0) {
      setGoal(manWon * 10000);
      saveSetting("finance-monthly-goal", manWon * 10000);
    }
    setGoalInput(null);
  };

  const todayYm = todayStr().slice(0, 7);
  /** 보고 있는 달 */
  const [ym, setYm] = useState(todayYm);
  /** 고를 수 있는 달: 기록이 있는 첫 달 ~ 이번 달 */
  const months = useMemo(() => {
    const first = entries.reduce((min, e) => (e.date.slice(0, 7) < min ? e.date.slice(0, 7) : min), todayYm);
    const start = first < FIRST_MONTH ? FIRST_MONTH : first;
    const list: string[] = [];
    for (let m = start; m <= todayYm; m = shiftMonth(m, 1)) list.push(m);
    return list;
  }, [entries, todayYm]);
  const years = Array.from(new Set(months.map((m) => m.slice(0, 4))));
  const goTo = (next: string) => {
    if (!months.includes(next)) return;
    setYm(next);
    setExpanded(null);
  };

  const data = useMemo(() => {
    const today = todayStr();
    const cur = ym;
    /** 이번 달은 오늘까지, 지난 달은 그 달 전체 */
    const isCurrent = cur === today.slice(0, 7);
    const day = isCurrent ? Number(today.slice(8, 10)) : 31;
    const prevMonths = [1, 2, 3].map((i) => shiftMonth(cur, -i));
    /** 필수 지출의 "평소"는 최근 12개월로 본다 (석 달만 보면 세금·재계약 한 번에 기준이 흔들림) */
    const yearMonths = Array.from({ length: 12 }, (_, i) => shiftMonth(cur, -(i + 1)));
    const oldest = yearMonths[11];

    // 큰 묶음(식비)에 들어가는 묶음(배달·편의점 …)은 큰 묶음 하나로 본다
    const groupOf = (raw: string) => {
      const group = baseGroupName(applySmsGroupRulesToItem(canonicalizeBudgetItemName(raw.trim()), smsGroupRules));
      return parentOfGroup(group, parentGroups) ?? group;
    };
    const detailsByParent = new Map<string, BudgetEntryDetail[]>();
    entryDetails.forEach((d) => {
      const list = detailsByParent.get(d.parentId);
      if (list) list.push(d);
      else detailsByParent.set(d.parentId, [d]);
    });

    const lines: Line[] = [];
    entries.forEach((e) => {
      const ym = e.date.slice(0, 7);
      if (ym < oldest || ym > cur) return;
      const details = detailsByParent.get(e.id);
      if (details && details.length > 0) {
        // 세부가 있어도 카드값인 건 카드출금뿐. 쿠팡·이마트를 쓴 곳별로 나눈 것은 카드값이 아니고, 안 나눈 금액은 원래 이름으로 남는다
        const fromCard = looksLikeCardBulkSettlementItem(e.item);
        let detailSum = 0;
        details.forEach((d) => {
          detailSum += d.amount;
          if (isExcludedFromMonthTotal(d.item)) return;
          lines.push({ date: e.date, name: d.item.trim(), group: groupOf(d.item), amount: d.amount, fromCard });
        });
        const rest = e.amount - detailSum;
        if (rest > 0 && fromCard) lines.push({ date: e.date, name: "카드 미분류", group: "카드 미분류", amount: rest, fromCard: true });
        else if (rest > 0 && !isExcludedFromMonthTotal(e.item))
          lines.push({ date: e.date, name: e.item.trim(), group: groupOf(e.item), amount: rest, fromCard: false });
      } else {
        if (isExcludedFromMonthTotal(e.item)) return;
        // 세부를 안 적은 카드출금도 카드값으로 본다
        lines.push({ date: e.date, name: e.item.trim(), group: groupOf(e.item), amount: e.amount, fromCard: looksLikeCardBulkSettlementItem(e.item) });
      }
    });

    const inMonth = (ym: string) => lines.filter((l) => l.date.startsWith(ym));
    const dayOf = (l: Line) => Number(l.date.slice(8, 10));
    const sum = (list: Line[]) => list.reduce((s, l) => s + l.amount, 0);
    const byGroup = (list: Line[]) => {
      const map = new Map<string, { amount: number; count: number }>();
      list.forEach((l) => {
        const g = map.get(l.group) ?? { amount: 0, count: 0 };
        g.amount += l.amount;
        g.count += 1;
        map.set(l.group, g);
      });
      return map;
    };

    // ── 지금까지 쓴 돈 / 지난달과 비교 (월말 예상은 월초에 100만 원 넘게 빗나가서 뺐다)
    const curToDate = inMonth(cur).filter((l) => dayOf(l) <= day);
    const spent = sum(curToDate);
    const history = prevMonths.map((ym) => inMonth(ym)).filter((list) => list.length > 0);
    const lastMonthTotal = sum(inMonth(prevMonths[0]));
    const typicalTotal = history.length > 0 ? median(history.map(sum)) : null;
    const cardTotal = sum(curToDate.filter((l) => l.fromCard));
    // 지난달 비교 기준: 지난 달을 볼 땐 전달 전체, 이번 달은 전달의 같은 날짜까지.
    // 카드값은 빠져나가는 날이 달마다 1~4일로 달라서 날짜로 자르지 않고 그 달 카드값 전체를 넣는다
    const compareBase = isCurrent
      ? sum(inMonth(prevMonths[0]).filter((l) => l.fromCard || dayOf(l) <= day))
      : lastMonthTotal;

    // ── 목표와 비교용 덩어리: 필수 지출(고정비·세금·생활비) / 강의·할부 / 사업경비 / 그 외
    // 카테고리는 항목 이름으로 보고, 이름으로 안 걸리면 묶음 이름으로 한 번 더 본다
    const bucketOf = (l: Line, kw: CategoryKeywords): Bucket => {
      if (l.name.startsWith("강의") || parseInstallment(l.name)) return "lecture";
      let cat = getCategoryForEntry(l.name, kw);
      if (cat === "기타") cat = getCategoryForEntry(l.group, kw);
      if (cat === "고정비" || cat === "세금" || cat === "생활비") return "basic";
      return cat === "사업경비" ? "business" : "other";
    };
    const bucketSums = (list: Line[], month: string) => {
      const kw = getKeywordsForMonth(keywords, monthExtras, month);
      const out: Record<Bucket, number> = { basic: 0, lecture: 0, business: 0, other: 0 };
      list.forEach((l) => (out[bucketOf(l, kw)] += l.amount));
      return out;
    };
    const buckets = bucketSums(curToDate, cur);
    const historyMonths = prevMonths.filter((m) => inMonth(m).length > 0);
    const usualMonths = yearMonths.filter((m) => inMonth(m).length > 0);
    const basicUsual = usualMonths.length > 0 ? median(usualMonths.map((m) => bucketSums(inMonth(m), m).basic)) : null;
    // 앞 석 달 가운데값보다 많이 나간 항목. 강의·할부는 위 덩어리로 따로 말하니 뺀다.
    // 필수 지출 항목도 넣는다: 보험 재가입·강아지 수술처럼 한 번 크게 나간 것도 원인으로 알려준다
    const kwCur = getKeywordsForMonth(keywords, monthExtras, cur);
    // 덩어리별로 무엇이 들어갔는지 (글자를 누르면 모달로 보여줌). 강의·할부는 묶음이 전부 "강의"라 원래 이름으로 나눈다
    const bucketItems: Record<Bucket, { cat: CategoryId; name: string; amount: number; count: number }[]> = {
      basic: [],
      lecture: [],
      business: [],
      other: [],
    };
    curToDate.forEach((l) => {
      const b = bucketOf(l, kwCur);
      let cat = getCategoryForEntry(l.name, kwCur);
      if (cat === "기타") cat = getCategoryForEntry(l.group, kwCur);
      const name = b === "lecture" ? l.name : l.group;
      const row = bucketItems[b].find((r) => r.name === name && r.cat === cat);
      if (row) {
        row.amount += l.amount;
        row.count += 1;
      } else bucketItems[b].push({ cat, name, amount: l.amount, count: 1 });
    });
    (Object.keys(bucketItems) as Bucket[]).forEach((b) => bucketItems[b].sort((x, y) => y.amount - x.amount));
    const causes: { name: string; amount: number; usual: number }[] = [];
    /** 필수 지출 안에서 평소보다 가장 많이 나간 항목 (세금·재계약처럼 한 번 크게 나간 것) */
    let basicCause: { name: string; amount: number; usual: number } | null = null;
    if (historyMonths.length > 0) {
      const bucketByGroup = new Map<string, Bucket>();
      curToDate.forEach((l) => {
        if (!bucketByGroup.has(l.group)) bucketByGroup.set(l.group, bucketOf(l, kwCur));
      });
      const pastGroups = historyMonths.map((m) => byGroup(inMonth(m)));
      byGroup(curToDate).forEach((v, name) => {
        const b = bucketByGroup.get(name);
        if (b === "lecture" || name === "카드 미분류") return;
        const usual = median(pastGroups.map((g) => g.get(name)?.amount ?? 0));
        if (v.amount - usual < 100000) return;
        if (b === "basic" && (!basicCause || v.amount - usual > basicCause.amount - basicCause.usual))
          basicCause = { name, amount: v.amount, usual };
        causes.push({ name, amount: v.amount, usual });
      });
      causes.sort((a, b) => b.amount - b.usual - (a.amount - a.usual));
    }

    // ── 할부: 가장 최근 카드 세부에서 "n/N"이 붙은 것
    const billMonth = [cur, ...prevMonths].find((ym) => inMonth(ym).some((l) => l.fromCard && parseInstallment(l.name))) ?? null;
    const installments = billMonth
      ? inMonth(billMonth)
          .filter((l) => l.fromCard)
          .map((l) => ({ line: l, inst: parseInstallment(l.name) }))
          .filter((x): x is { line: Line; inst: NonNullable<ReturnType<typeof parseInstallment>> } => x.inst != null)
          .map(({ line, inst }) => ({
            label: inst.label,
            n: inst.n,
            total: inst.total,
            amount: line.amount,
            left: inst.total - inst.n,
            endMonth: shiftMonth(billMonth, inst.total - inst.n),
          }))
          .sort((a, b) => b.amount - a.amount)
      : [];
    const installmentMonthly = installments.reduce((s, i) => s + i.amount, 0);
    const installmentRemaining = installments.reduce((s, i) => s + i.amount * i.left, 0);
    const endingNow = installments.filter((i) => i.left === 0);
    const nextEnding = installments.filter((i) => i.left > 0).sort((a, b) => a.left - b.left || b.amount - a.amount)[0] ?? null;

    // ── 구독: 최근 카드 명세의 AI·도구(사업경비 키워드)와, 키워드에 안 걸리는 것 중 앞 두 달에도 같은 이름으로 있던 결제.
    // 보험·통신비 같은 필수 요금(고정비·세금), 자주 사는 생활비(전자담배·쿠팡 등), 연회비, 광고비, 할부는 뺀다
    const cardMonth = [cur, ...prevMonths].find((ym) => inMonth(ym).some((l) => l.fromCard)) ?? null;
    const subscriptions: { name: string; amount: number; count: number }[] = [];
    if (cardMonth) {
      const kw = getKeywordsForMonth(keywords, monthExtras, cardMonth);
      const isCandidate = (l: Line) => {
        if (!l.fromCard || parseInstallment(l.name) || l.group === "카드 미분류" || looksLikeCardBulkSettlementItem(l.name)) return false;
        if (l.name.includes("연회비") || l.name.includes("광고") || l.name.includes("마케팅")) return false;
        const cat = getCategoryForEntry(l.name, kw);
        return cat === "사업경비" || cat === "기타";
      };
      const before = new Set(
        [shiftMonth(cardMonth, -1), shiftMonth(cardMonth, -2)].flatMap((ym) => inMonth(ym).filter(isCandidate).map((l) => l.name))
      );
      const picked = inMonth(cardMonth).filter(
        (l) => isCandidate(l) && (getCategoryForEntry(l.name, kw) === "사업경비" || before.has(l.name))
      );
      byGroup(picked).forEach((v, name) => subscriptions.push({ name, ...v }));
      subscriptions.sort((a, b) => b.amount - a.amount);
    }
    const subscriptionMonthly = subscriptions.reduce((s, r) => s + r.amount, 0);

    // ── 지난달과 비교: 카드값은 명세끼리(나가는 날이 달라도), 카드 아닌 지출은 같은 날짜까지끼리
    const comparable = (ym: string) => inMonth(ym).filter((l) => l.fromCard || dayOf(l) <= day);
    const curGroups = byGroup(comparable(cur));
    const prevGroups = byGroup(comparable(prevMonths[0]));
    const increases: { name: string; now: number; before: number }[] = [];
    const decreases: { name: string; now: number; before: number }[] = [];
    curGroups.forEach((v, name) => {
      const before = prevGroups.get(name)?.amount ?? 0;
      if (before > 0 && v.amount > before) increases.push({ name, now: v.amount, before });
      if (before > v.amount) decreases.push({ name, now: v.amount, before });
    });
    prevGroups.forEach((v, name) => {
      // 지난달 카드 명세에 있었는데 이번 달엔 없는 것 (카드 아닌 지출은 월초라 아직 안 쓴 것일 수 있어 제외)
      if (!curGroups.has(name) && name !== "카드 미분류" && inMonth(prevMonths[0]).some((l) => l.group === name && l.fromCard))
        decreases.push({ name, now: 0, before: v.amount });
    });
    increases.sort((a, b) => b.now - b.before - (a.now - a.before));
    decreases.sort((a, b) => b.before - b.now - (a.before - a.now));

    // ── 새로 생긴 것: 지난 3개월에 한 번도 없던 항목
    // 앞 달 기록이 하나도 없으면(첫 달) 전부 새것으로 나와 버려서 비워 둔다
    const seenBefore = new Set(prevMonths.flatMap((ym) => inMonth(ym).map((l) => l.group)));
    const fresh: { name: string; amount: number; count: number }[] = [];
    if (history.length > 0)
      byGroup(curToDate).forEach((v, name) => {
        if (!seenBefore.has(name) && name !== "카드 미분류") fresh.push({ name, ...v });
      });
    fresh.sort((a, b) => b.amount - a.amount);

    return {
      cur,
      isCurrent,
      hasHistory: history.length > 0,
      day,
      prevMonth: prevMonths[0],
      spent,
      buckets,
      bucketItems,
      basicUsual,
      basicCause: basicCause as { name: string; amount: number; usual: number } | null,
      causes,
      cardTotal,
      lastMonthTotal,
      typicalTotal,
      compareBase,
      billMonth,
      installments,
      installmentMonthly,
      installmentRemaining,
      endingNow,
      nextEnding,
      subscriptions,
      subscriptionMonthly,
      increases,
      decreases,
      fresh,
      freshTotal: fresh.reduce((s, r) => s + r.amount, 0),
    };
  }, [ym, entries, entryDetails, keywords, monthExtras, smsGroupRules, parentGroups]);

  if (entries.length === 0) return null;

  // ── 목표와 비교한 한 줄 설명. 핵심(얼마 넘었는지·필수 지출·원인 항목)만 굵게, 이어 주는 말은 보통 굵기
  const over = data.spent - goal;
  const m = monthLabel(data.cur);
  /** [앞말(보통), 핵심(굵게·색)] */
  const headline: [string, string] = data.isCurrent
    ? over > 0
      ? [`${m}은 ${data.day}일까지 ${man(data.spent)}을 써서 목표 ${man(goal)}을 `, `이미 ${man(over)} 넘었어요.`]
      : [`${m}은 ${data.day}일까지 ${man(data.spent)}을 썼어요. `, `목표 ${man(goal)}까지 ${man(-over)} 남았어요.`]
    : over > 0
      ? [`${m}은 목표 ${man(goal)}보다 `, `${man(over)} 더 썼어요.`]
      : [`${m}은 목표 ${man(goal)} 안에서 `, `${man(-over)} 남겼어요.`];
  const basic = data.buckets.basic;
  const basicHead = "필수 지출은";
  /** core = 굵게, tail = 원인이 뒤에 이어질 때 붙는 말, end = 원인이 없어 여기서 문장이 끝날 때 붙는 말 */
  // 이번 달은 아직 다 안 지났으니 평소(한 달 전체)와 견주지 않는다
  // 색: 평소 수준·비교 없음 = 노랑, 평소보다 많음 = 빨강, 적은 편 = 초록
  const basicPart: { core: string; tail: string; end: string; color: string } = data.isCurrent
    ? { core: `${basicHead} 아직 ${man(basic)}`, tail: "이고", end: "이에요.", color: "text-amber-200" }
    : data.basicUsual == null
      ? { core: `${basicHead} ${man(basic)}`, tail: "이고", end: "이에요.", color: "text-amber-200" }
      : basic > data.basicUsual * 1.15
        ? {
            core: `${basicHead} ${man(basic)}으로 평소(${man(data.basicUsual)})보다 ${man(basic - data.basicUsual)} 많음${
              data.basicCause ? ` (${data.basicCause.name} ${man(data.basicCause.amount)})` : ""
            }`,
            tail: "이고",
            end: "이에요.",
            color: "text-red-300",
          }
        : basic < data.basicUsual * 0.85
          ? { core: `${basicHead} ${man(basic)}으로 평소(${man(data.basicUsual)})보다 적은 편`, tail: "인데", end: "이에요.", color: "text-emerald-300" }
          : { core: `${basicHead} ${man(basic)}으로 평소 수준`, tail: "인데", end: "이에요.", color: "text-amber-200" };
  // 필수 지출 줄 괄호에 이미 나온 항목은 원인 줄에서 빼고, 평소보다 많이 나간 순으로 최대 4개
  const basicOverUsual = !data.isCurrent && data.basicUsual != null && basic > data.basicUsual * 1.15;
  const basicCauseShown = basicOverUsual ? data.basicCause?.name : undefined;
  const reasonParts = [
    ...(data.buckets.lecture >= 100000 ? [`강의·할부 ${man(data.buckets.lecture)}`] : []),
    ...data.causes
      .filter((c) => c.name !== basicCauseShown)
      .slice(0, 4)
      .map((c) => `${c.name} ${man(c.amount)}`),
  ];
  const strong = "font-bold text-white";
  const sentence = (
    <>
      {/* 세 묶음을 한 줄씩: 목표와 비교 / 필수 지출 / 원인 (원인이 없으면 두 줄) */}
      <span className="block">
        {headline[0]}
        <b className={`font-bold ${over > 0 ? "text-red-300" : "text-emerald-300"}`}>{headline[1]}</b>
      </span>
      <span className="block">
        <button
          type="button"
          onClick={() => setBucketModal("basic")}
          className={`text-left font-bold underline-offset-4 hover:underline ${basicPart.color}`}
          title="필수 지출에 뭐가 들어갔는지 보기"
        >
          {basicPart.core}
        </button>
        {reasonParts.length === 0 ? basicPart.end : `${basicPart.tail},`}
      </span>
      {reasonParts.length > 0 && (
        <span className="block">
          {reasonParts.map((r, i) => (
            <span key={r}>
              {i > 0 && ", "}
              <b className={strong}>{r}</b>
            </span>
          ))}
          {over > 0 ? " 때문이에요." : "이 나갔어요."}
        </span>
      )}
    </>
  );
  const barMax = Math.max(data.spent, goal);
  const endingSum = data.endingNow.reduce((s, i) => s + i.amount, 0);

  const nameCount = (name: string, count: number) => (
    <span className="min-w-0 truncate text-neutral-800">
      {name}
      {count > 1 && <span className="ml-1.5 text-xs tabular-nums text-neutral-400">{count}건</span>}
    </span>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">{monthLabel(data.cur)} 브리핑</h2>
        {/* 달 이동: 좌우 버튼 + 연·월 선택 */}
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {/* "이번 달"은 맨 앞에: 뒤에 두면 나타날 때마다 화살표 자리가 밀린다 (좁은 화면에서 줄이 바뀌어도 오른쪽 정렬) */}
          {!data.isCurrent && (
            <button
              type="button"
              onClick={() => goTo(todayYm)}
              className="shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200 sm:mr-1 sm:px-3 sm:text-sm"
            >
              이번 달
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(shiftMonth(ym, -1))}
            disabled={!months.includes(shiftMonth(ym, -1))}
            className={navButton}
            aria-label="이전 달"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <select
            value={ym.slice(0, 4)}
            onChange={(e) => {
              // 그 해에 같은 달이 없으면 그 해의 마지막 달로
              const sameMonth = `${e.target.value}-${ym.slice(5, 7)}`;
              const inYear = months.filter((m) => m.startsWith(e.target.value));
              goTo(months.includes(sameMonth) ? sameMonth : inYear[inYear.length - 1]);
            }}
            className={selectClass}
            aria-label="연도"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select value={ym} onChange={(e) => goTo(e.target.value)} className={selectClass} aria-label="월">
            {months
              .filter((m) => m.startsWith(ym.slice(0, 4)))
              .map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => goTo(shiftMonth(ym, 1))}
            disabled={!months.includes(shiftMonth(ym, 1))}
            className={navButton}
            aria-label="다음 달"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 요약: 어두운 띠로 이 패널의 핵심 숫자가 먼저 보이게. 왼쪽은 쓴 돈, 오른쪽은 지난달과 비교(이번 달은 같은 날짜까지끼리) */}
      <div className="mt-3 rounded-2xl bg-neutral-900 p-5 text-white md:p-6">
        <div className="grid gap-3 md:grid-cols-2 md:gap-6">
        <div>
          <p className="text-sm font-medium text-white/60">
            {data.isCurrent ? `${monthLabel(data.cur)} ${data.day}일까지 쓴 돈` : `${monthLabel(data.cur)}에 쓴 돈`}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums md:text-4xl">{man(data.spent)}</p>
          {data.hasHistory && (
            <p className="mt-1.5 text-sm tabular-nums text-white/60">
              {monthLabel(data.prevMonth)} 전체 {man(data.lastMonthTotal)}
              {data.typicalTotal != null && ` · 보통 한 달 ${man(data.typicalTotal)}`}
            </p>
          )}
        </div>
        {data.compareBase > 0 && (
          <div className="md:border-l md:border-white/15 md:pl-6">
            <p className="text-sm font-medium text-white/60">
              {data.isCurrent ? `${monthLabel(data.prevMonth)} ${data.day}일까지와 비교` : `${monthLabel(data.prevMonth)}과 비교`}
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums md:text-3xl ${
                data.spent > data.compareBase ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {data.spent > data.compareBase ? "+" : "−"}
              {man(data.spent - data.compareBase)}
            </p>
            <p className="mt-1.5 text-sm tabular-nums text-white/60">
              카드값 {man(data.cardTotal)} + 그 외 {man(data.spent - data.cardTotal)}
            </p>
          </div>
        )}
      </div>

        {/* 목표와 비교: 왜 이만큼 썼는지 한 줄 + 덩어리별 막대 */}
        <div className="mt-5 border-t border-white/15 pt-4">
          <p className="text-[15px] leading-relaxed text-white/65 md:text-base">{sentence}</p>
          <div className="relative mt-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
              {BUCKETS.map((bk) =>
                data.buckets[bk.id] > 0 ? (
                  <div key={bk.id} style={{ width: `${(data.buckets[bk.id] / barMax) * 100}%`, backgroundColor: bk.color }} />
                ) : null
              )}
            </div>
            {/* 목표 위치 */}
            <span
              className="absolute -top-1 h-5 w-0.5 rounded-full bg-white"
              style={{ left: `${(goal / barMax) * 100}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-white/70">
            {/* 덩어리 글자를 누르면 그 달에 뭐가 들어갔는지 모달로 */}
            {BUCKETS.map((bk) => (
              <button
                key={bk.id}
                type="button"
                onClick={() => setBucketModal(bk.id)}
                className="flex items-center gap-1.5 underline-offset-4 transition hover:text-white hover:underline"
                title={`${bk.label}에 뭐가 들어갔는지 보기`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bk.color }} aria-hidden />
                {bk.label} <b className="font-semibold text-white">{man(data.buckets[bk.id])}</b>
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1.5">
              {goalInput == null ? (
                <button
                  type="button"
                  onClick={() => setGoalInput(String(Math.round(goal / 10000)))}
                  className="rounded-lg px-2 py-0.5 text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-white"
                  title="한 달 지출 목표 바꾸기"
                >
                  목표 {man(goal)}
                </button>
              ) : (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveGoal();
                  }}
                >
                  목표
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={saveGoal}
                    className="w-16 rounded-lg border border-white/30 bg-transparent px-2 py-0.5 text-right text-white focus:border-white focus:outline-none"
                    aria-label="한 달 지출 목표 (만 원)"
                  />
                  만 원
                </form>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Section
          title="새로 생긴 지출"
          main={!data.hasHistory ? "–" : data.fresh.length > 0 ? `${data.fresh.length}개 · ${man(data.freshTotal)}` : "없음"}
          rows={data.fresh.map((r) => (
            <li key={r.name} className={rowClass}>
              {nameCount(r.name, r.count)}
              <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{won(r.amount)}</span>
            </li>
          ))}
          empty={data.hasHistory ? "지난 3개월에 없던 새 항목이 없어요." : "비교할 앞 달 기록이 없어요."}
          footnote="지난 3개월에 한 번도 없던 항목이에요."
          expanded={expanded === "new"}
          onToggle={toggle("new")}
        />

        <Section
          title="할부"
          main={data.installments.length > 0 ? `월 ${man(data.installmentMonthly)}` : "없음"}
          highlight={
            data.endingNow.length > 0 ? (
              <span className="text-emerald-600">
                다음 달부터 −{man(endingSum)} ({data.endingNow.map((i) => i.label).join(", ")} 끝)
              </span>
            ) : data.nextEnding ? (
              <span className="text-emerald-600">
                {monthLabelWithYear(data.nextEnding.endMonth, data.cur)}에 {data.nextEnding.label} 끝 → −{man(data.nextEnding.amount)}
              </span>
            ) : undefined
          }
          rows={data.installments.map((i, idx) => (
            <li key={`${i.label}-${idx}`} className={rowClass}>
              <span className="min-w-0 truncate text-neutral-800">
                {i.label}
                <span className="ml-1.5 text-xs tabular-nums text-neutral-400">
                  {i.n}/{i.total} · {i.left === 0 ? "이번 달로 끝" : `${monthLabelWithYear(i.endMonth, data.cur)}까지`}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{won(i.amount)}</span>
            </li>
          ))}
          empty={'카드 세부에 "3/12"처럼 회차가 적힌 할부가 없어요.'}
          footnote={`${data.billMonth ? monthLabel(data.billMonth) : ""} 카드 명세 기준 · 앞으로 남은 할부 ${man(data.installmentRemaining)}`}
          expanded={expanded === "installment"}
          onToggle={toggle("installment")}
        />

        <Section
          title="구독 (AI·도구)"
          main={data.subscriptions.length > 0 ? `${data.subscriptions.length}개 · 월 ${man(data.subscriptionMonthly)}` : "없음"}
          rows={data.subscriptions.map((r) => (
            <li key={r.name} className={rowClass}>
              {nameCount(r.name, r.count)}
              <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{won(r.amount)}</span>
            </li>
          ))}
          empty="최근 카드 명세에 구독 결제가 없어요."
          footnote="카드 명세의 사업경비(AI·도구)와 두 달 이상 이어진 결제예요. 보험·통신비·생활비·연회비·광고비·할부는 뺐어요."
          expanded={expanded === "subscription"}
          onToggle={toggle("subscription")}
        />

        <Section
          title={`${monthLabel(data.prevMonth)}과 비교`}
          main={!data.hasHistory ? "–" : data.increases.length > 0 ? `늘어난 것 ${data.increases.length}개` : "늘어난 것 없음"}
          rows={[
            ...data.increases.map((r) => (
              <li key={`up-${r.name}`} className={rowClass}>
                <span className="min-w-0 truncate text-neutral-800">{r.name}</span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-xs text-neutral-400">
                    {manShort(r.before)} → {manShort(r.now)}
                  </span>
                  <span className="ml-2 font-semibold text-red-500">▲ {manShort(r.now - r.before)}</span>
                </span>
              </li>
            )),
            ...data.decreases.map((r) => (
              <li key={`down-${r.name}`} className={rowClass}>
                <span className="min-w-0 truncate text-neutral-800">{r.name}</span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-xs text-neutral-400">
                    {manShort(r.before)} → {r.now > 0 ? manShort(r.now) : "0"}
                  </span>
                  <span className="ml-2 font-semibold text-emerald-600">▼ {manShort(r.before - r.now)}</span>
                </span>
              </li>
            )),
          ]}
          empty={data.hasHistory ? `${monthLabel(data.prevMonth)}과 달라진 항목이 없어요.` : "비교할 앞 달 기록이 없어요."}
          footnote="카드값은 명세끼리, 카드가 아닌 지출은 같은 날짜까지끼리 비교했어요. 새로 생긴 지출은 왼쪽 칸에 따로 있어요."
          expanded={expanded === "compare"}
          onToggle={toggle("compare")}
        />
      </div>
      <p className="mt-3 text-xs text-neutral-400">필수 지출 = 고정비·세금·생활비. 적금·IRP·ISA·주택청약은 지출에서 뺀 금액이에요.</p>
      {bucketModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/65 p-4"
            onClick={() => setBucketModal(null)}
          >
            <div
              className="my-auto max-h-[85vh] w-full max-w-md shrink-0 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const bk = BUCKETS.find((b) => b.id === bucketModal)!;
                const items = data.bucketItems[bucketModal];
                // 필수 지출은 고정비·세금·생활비로 나눠서, 나머지는 한 목록으로
                const sections: { title: string | null; rows: typeof items }[] =
                  bucketModal === "basic"
                    ? (["고정비", "세금", "생활비"] as const)
                        .map((cat) => ({ title: cat as string, rows: items.filter((r) => r.cat === cat) }))
                        .filter((sec) => sec.rows.length > 0)
                    : [{ title: null, rows: items }];
                return (
                  <>
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {monthLabel(data.cur)} {bk.label}
                      {data.isCurrent && <span className="ml-1.5 text-sm font-normal text-neutral-500">({data.day}일까지)</span>}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">{BUCKET_NOTES[bucketModal]}</p>
                    <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3">
                      <span className="text-sm font-medium text-neutral-600">합계</span>
                      <span className="ml-2 text-xl font-semibold tabular-nums text-neutral-900">{won(data.buckets[bucketModal])}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="mt-4 text-sm text-neutral-400">이 달에는 해당하는 지출이 없어요.</p>
                    ) : (
                      sections.map((sec) => (
                        <div key={sec.title ?? "all"} className="mt-4">
                          {sec.title && (
                            <div className="flex items-baseline justify-between border-b border-neutral-200 pb-1.5">
                              <h4 className="text-sm font-bold text-neutral-900">{sec.title}</h4>
                              <span className="text-sm font-semibold tabular-nums text-neutral-600">
                                {won(sec.rows.reduce((sum, r) => sum + r.amount, 0))}
                              </span>
                            </div>
                          )}
                          <ul className="text-[15px]">
                            {sec.rows.map((r) => (
                              <li key={`${r.cat}-${r.name}`} className={rowClass}>
                                <span className="min-w-0 truncate text-neutral-800">
                                  {r.name}
                                  {r.count > 1 && <span className="ml-1.5 text-xs tabular-nums text-neutral-400">{r.count}건</span>}
                                </span>
                                <span className="shrink-0 font-medium tabular-nums text-neutral-900">{won(r.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setBucketModal(null)}
                        className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
                      >
                        닫기
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}
    </Card>
  );
}
