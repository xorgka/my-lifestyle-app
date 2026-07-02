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
  source: string; // 유입: 기존/신규
  inquiryChannel: string; // 문의 ID
  category: string; // 업종
  amount: number;
  netProfit: number;
  note: string;
  statusGuide: ProgressStatus;
  statusPayment: ProgressStatus;
  statusInvoice: ProgressStatus;
  statusMaterial: ProgressStatus;
  statusProduction: ProgressStatus;
  statusRevision: ProgressStatus;
  statusComplete: ProgressStatus;
  sheetRow: number | null;
};

export const SOURCE_OPTIONS = ["신규", "기존"] as const;

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

export function emptyProductionRequest(requestDate: string): Omit<ProductionRequest, "id" | "sheetRow"> {
  return {
    yearMonth: toYearMonth(requestDate),
    requestDate,
    clientName: "",
    source: "신규",
    inquiryChannel: "",
    category: "",
    amount: 0,
    netProfit: 0,
    note: "",
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

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 올해면 "7월", 아니면 "2025년 7월" */
export function monthTabLabel(yearMonth: string, thisYear: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return y === thisYear ? `${m}월` : `${y}년 ${m}월`;
}
