export type ParsedSmsKind = "deposit" | "withdrawal";

export type ParsedSmsTransaction = {
  kind: ParsedSmsKind;
  amount: number;
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

export function parseBankSmsTransaction(message: string): ParsedSmsTransaction | null {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const withdrawalIdx = indexOfFirstKeyword(text, WITHDRAWAL_KEYWORDS);
  const depositIdx = indexOfFirstKeyword(text, DEPOSIT_KEYWORDS);
  if (withdrawalIdx === -1 && depositIdx === -1) return null;

  const kind: ParsedSmsKind =
    withdrawalIdx !== -1 && (depositIdx === -1 || withdrawalIdx <= depositIdx)
      ? "withdrawal"
      : "deposit";

  const amount = parseAmount(text);
  if (!amount) return null;

  return { kind, amount };
}
