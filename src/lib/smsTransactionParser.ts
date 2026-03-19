export type ParsedSmsKind = "deposit" | "withdrawal";

export type ParsedSmsTransaction = {
  kind: ParsedSmsKind;
  amount: number;
  itemName?: string;
};

const WITHDRAWAL_KEYWORDS = ["출금", "결제", "인출", "이체출금", "자동이체", "승인"];
const DEPOSIT_KEYWORDS = ["입금", "이체입금", "급여", "수입", "받았습니다"];

function indexOfFirstKeyword(text: string, keywords: string[]): number {
  let min = -1;
  for (const keyword of keywords) {
    const idx = text.indexOf(keyword);
    if (idx >= 0 && (min === -1 || idx < min)) min = idx;
  }
  return min;
}

function parseAmount(text: string): number | null {
  const amountRegex = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;
  const matches = [...text.matchAll(amountRegex)];
  if (matches.length === 0) return null;

  // 대부분 은행 문자에서 첫 번째 "N원"이 거래 금액이다.
  const raw = matches[0]?.[1] ?? "";
  const normalized = raw.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.floor(amount);
}

function parseAmountFromLines(lines: string[]): number | null {
  // "6,000"처럼 원 단위가 없는 줄도 금액으로 처리
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, "");
    if (!/^\d{1,3}(?:,\d{3})*$|^\d+$/.test(normalized)) continue;
    const amount = Number(normalized.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) return Math.floor(amount);
  }
  return null;
}

function parseAmountFromTextLoose(text: string, anchorIndex: number): number | null {
  // 한 줄 문자에서 "테스트 1000 입금"처럼 원/줄분리 없이 온 경우 보정
  const numberRegex = /\d{1,3}(?:,\d{3})+|\d+/g;
  const candidates: Array<{ value: number; index: number }> = [];
  for (const m of text.matchAll(numberRegex)) {
    const raw = m[0] ?? "";
    const index = m.index ?? -1;
    if (index < 0) continue;
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;

    // 날짜/시간 조각(03, 19, 22 등) 오탐을 줄이기 위해 100원 미만은 제외
    if (value < 100) continue;

    // 숫자 주변이 시간/날짜 구분자인 경우는 우선 제외 (예: 03/19, 22:12)
    const prev = index > 0 ? text[index - 1] : "";
    const next = index + raw.length < text.length ? text[index + raw.length] : "";
    if (prev === "/" || prev === ":" || next === "/" || next === ":") continue;

    candidates.push({ value: Math.floor(value), index });
  }
  if (candidates.length === 0) return null;

  // 거래 키워드 위치와 가장 가까운 숫자를 금액으로 간주
  let picked = candidates[0];
  let bestDist = Math.abs((candidates[0]?.index ?? 0) - anchorIndex);
  for (const c of candidates.slice(1)) {
    const dist = Math.abs(c.index - anchorIndex);
    if (dist < bestDist) {
      bestDist = dist;
      picked = c;
    }
  }
  return picked.value;
}

function isNoiseLine(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (t.startsWith("[") && t.endsWith("]")) return true; // [Web발신]
  if (/^\[[^\]]+\]\d{1,2}\/\d{1,2}/.test(t)) return true; // [KB]03/19 22:12
  if (/^\d[\d*]{6,}$/.test(t.replace(/\s+/g, ""))) return true; // 마스킹 계좌/카드
  if (/^(잔액|balance)/i.test(t)) return true;
  if (/^(입금|출금|결제|인출|이체출금|자동이체|승인)$/i.test(t)) return true;
  if (/^\d{1,3}(?:,\d{3})*$|^\d+$/.test(t.replace(/\s+/g, ""))) return true;
  return false;
}

function parseWithdrawalItemName(lines: string[]): string | undefined {
  const kindIdx = lines.findIndex((line) => WITHDRAWAL_KEYWORDS.some((k) => line.includes(k)));
  if (kindIdx <= 0) return undefined;
  for (let i = kindIdx - 1; i >= 0; i -= 1) {
    const candidate = lines[i]?.trim() ?? "";
    if (!isNoiseLine(candidate)) return candidate;
  }
  return undefined;
}

export function parseBankSmsTransaction(message: string): ParsedSmsTransaction | null {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const lines = message
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const withdrawalIdx = indexOfFirstKeyword(text, WITHDRAWAL_KEYWORDS);
  const depositIdx = indexOfFirstKeyword(text, DEPOSIT_KEYWORDS);
  if (withdrawalIdx === -1 && depositIdx === -1) return null;

  const kind: ParsedSmsKind =
    withdrawalIdx !== -1 && (depositIdx === -1 || withdrawalIdx <= depositIdx)
      ? "withdrawal"
      : "deposit";

  const anchorIndex = kind === "withdrawal" ? withdrawalIdx : depositIdx;
  const amount =
    parseAmount(text) ??
    parseAmountFromLines(lines) ??
    parseAmountFromTextLoose(text, anchorIndex);
  if (!amount) return null;
  const itemName = kind === "withdrawal" ? parseWithdrawalItemName(lines) : undefined;

  return { kind, amount, itemName };
}
