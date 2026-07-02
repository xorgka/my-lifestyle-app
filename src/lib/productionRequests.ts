/**
 * 프로젝트(홈페이지&로고 제작 의뢰) 관리 - 타입/순수 로직.
 * DB 입출력은 productionRequestsDb.ts, 구글 시트 동기화는 googleSheets.ts 참고.
 */

export type ProgressStatus = "" | "~" | "O";

export const PROGRESS_STEPS = [
  { key: "statusGuide", label: "안내" },
  { key: "statusPayment", label: "결제" },
  { key: "statusInvoice", label: "계산서" },
  { key: "statusMaterial", label: "자료" },
  { key: "statusProduction", label: "제작" },
  { key: "statusRevision", label: "수정" },
  { key: "statusComplete", label: "완료" },
] as const;

export type ProgressStepKey = (typeof PROGRESS_STEPS)[number]["key"];

export type ProductionRequest = {
  id: string;
  yearMonth: string; // "2026-07"
  requestDate: string; // "2026-07-02"
  clientName: string;
  source: string; // 유입: 크몽/기존
  inquiryChannel: string; // 문의 ID
  category: string; // 업종
  amount: number;
  netProfit: number;
  note: string;
  /** 결제를 선금만 받은 경우의 선금액. 0이면 선금 없음(또는 전액 완납) */
  depositAmount: number;
  statusGuide: ProgressStatus;
  statusPayment: ProgressStatus;
  statusInvoice: ProgressStatus;
  statusMaterial: ProgressStatus;
  statusProduction: ProgressStatus;
  statusRevision: ProgressStatus;
  statusComplete: ProgressStatus;
  sheetRow: number | null;
};

export const SOURCE_OPTIONS = ["크몽", "기존"] as const;

/** 클릭 시 순환: 해당없음 → 진행중 → 완료 → 해당없음 */
export function nextProgressStatus(current: ProgressStatus): ProgressStatus {
  if (current === "") return "~";
  if (current === "~") return "O";
  return "";
}

export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** "2026-07-02" -> "7월 2일" (시트 A열과 동일한 표기) */
export function formatKoreanMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}월 ${d}일`;
}

export function formatAmount(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 만 원 단위로 반올림해서 "143만원" 형식 */
export function formatManWon(n: number): string {
  const man = Math.round(n / 10000);
  return `${man.toLocaleString("ko-KR")}만원`;
}

export function emptyProductionRequest(requestDate: string): Omit<ProductionRequest, "id" | "sheetRow"> {
  return {
    yearMonth: toYearMonth(requestDate),
    requestDate,
    clientName: "",
    source: "크몽",
    inquiryChannel: "",
    category: "",
    amount: 0,
    netProfit: 0,
    note: "",
    depositAmount: 0,
    statusGuide: "",
    statusPayment: "",
    statusInvoice: "",
    statusMaterial: "",
    statusProduction: "",
    statusRevision: "",
    statusComplete: "",
  };
}

export function sumAmount(requests: ProductionRequest[]): number {
  return requests.reduce((sum, r) => sum + r.amount, 0);
}

export function sumNetProfit(requests: ProductionRequest[]): number {
  return requests.reduce((sum, r) => sum + r.netProfit, 0);
}

export type MonthStat = { yearMonth: string; amount: number; netProfit: number; count: number };

/** year_month 오름차순으로 월별 매출/순수익/건수 집계 */
export function groupStatsByMonth(requests: ProductionRequest[]): MonthStat[] {
  const map = new Map<string, MonthStat>();
  for (const r of requests) {
    const stat = map.get(r.yearMonth) ?? { yearMonth: r.yearMonth, amount: 0, netProfit: 0, count: 0 };
    stat.amount += r.amount;
    stat.netProfit += r.netProfit;
    stat.count += 1;
    map.set(r.yearMonth, stat);
  }
  return Array.from(map.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

/** 올해면 "7월", 아니면 "2025년 7월" */
export function monthTabLabel(yearMonth: string, thisYear: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return y === thisYear ? `${m}월` : `${y}년 ${m}월`;
}
