/**
 * 구글 시트 단방향 동기화 (앱 저장 → 시트 반영). 서비스 계정 JWT 직접 서명 (googleapis 패키지 불필요).
 * 서버(API 라우트)에서만 import할 것 — GOOGLE_SHEETS_PRIVATE_KEY 노출 방지.
 */
import { createSign } from "node:crypto";
import type { ProductionRequest } from "./productionRequests";
import { formatKoreanMonthDay } from "./productionRequests";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

type SheetsConfig = { clientEmail: string; privateKey: string; spreadsheetId: string };

function getConfig(): SheetsConfig | null {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL ?? "";
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? "";
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "";
  if (!clientEmail || !privateKeyRaw || !spreadsheetId) return null;
  return { clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n"), spreadsheetId };
}

export const isGoogleSheetsConfigured = getConfig() != null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input as never).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: SheetsConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URI,
      exp: now + 3600,
      iat: now,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(config.privateKey));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_sheets_token_failed: ${JSON.stringify(json)}`);
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return cachedToken.token;
}

/** "2026-07" -> "7월" (시트 탭 이름) */
export function monthTabName(yearMonth: string): string {
  const m = Number(yearMonth.slice(5, 7));
  return `${m}월`;
}

/** production_requests 한 행 -> 시트 A:O 셀 값 배열 */
function toSheetValues(req: ProductionRequest): string[] {
  return [
    formatKoreanMonthDay(req.requestDate),
    req.clientName,
    req.source,
    req.inquiryChannel,
    req.category,
    req.amount ? String(req.amount) : "",
    req.netProfit ? String(req.netProfit) : "",
    req.note,
    req.statusGuide,
    req.statusPayment,
    req.statusInvoice,
    req.statusMaterial,
    req.statusProduction,
    req.statusRevision,
    req.statusComplete,
  ];
}

async function sheetsFetch(config: SheetsConfig, path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await getAccessToken(config);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_sheets_api_failed: ${JSON.stringify(json)}`);
  return json;
}

/**
 * production_requests 한 행을 구글 시트에 반영.
 * sheetRow가 없으면(처음 저장) 해당 월 탭의 3행부터 첫 빈 행에 append.
 * sheetRow가 있으면 그 행을 그대로 덮어씀(수정 반영).
 * 반환값: 실제로 쓰여진 행 번호 (앱 DB의 sheet_row로 저장해둘 값).
 */
export async function syncProductionRequestRow(req: ProductionRequest): Promise<number> {
  const config = getConfig();
  if (!config) throw new Error("google_sheets_not_configured");

  const tab = monthTabName(req.yearMonth);
  const values = toSheetValues(req);

  if (req.sheetRow != null) {
    await sheetsFetch(
      config,
      `/values/${encodeURIComponent(tab)}!A${req.sheetRow}:O${req.sheetRow}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [values] }) }
    );
    return req.sheetRow;
  }

  const appendResult = await sheetsFetch(
    config,
    `/values/${encodeURIComponent(tab)}!A3:O:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [values] }) }
  );
  const updatedRange = String(
    (appendResult.updates as Record<string, unknown> | undefined)?.updatedRange ?? ""
  );
  // updatedRange 예: "7월!A4:O4" -> 4
  const match = updatedRange.match(/!A(\d+)/);
  if (!match) throw new Error(`could not parse appended row from range: ${updatedRange}`);
  return Number(match[1]);
}
