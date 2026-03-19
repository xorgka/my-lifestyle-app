import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBankSmsTransaction } from "@/lib/smsTransactionParser";
import { loadSmsGroupRulesFromDb } from "@/lib/budgetDb";
import { applySmsGroupRulesToItem } from "@/lib/budget";

type ImportSmsRequest = {
  sender?: string;
  message?: string;
  receivedAt?: string;
};

const SEOUL_TZ = "Asia/Seoul";

/** Vercel은 UTC 기본이라 getDate()만 쓰면 한국 새벽에 하루 밀림 → 항상 서울 달력 기준 */
function formatDateOnlyInSeoul(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

function todayDateOnlyInSeoul(): string {
  return formatDateOnlyInSeoul(new Date());
}

function toDateOnlyFromReceivedAt(input?: string): string {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return todayDateOnlyInSeoul();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return todayDateOnlyInSeoul();
  return formatDateOnlyInSeoul(d);
}

function yearMonthInSeoul(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TZ,
    year: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  return { year, month };
}

function buildExternalId(sender: string, message: string): string {
  return createHash("sha256").update(`${sender}||${message}`).digest("hex");
}

const INVALID_JSON_MULTILINE = "invalid_json_multiline_sms";

/** 줄바꿈이 많은 은행 문자는 JSON 본문에서 따옴표 밖 줄바꿈으로 깨지기 쉬움 → 폼/플레인도 지원 */
async function readImportSmsPayload(req: Request): Promise<{
  sender: string;
  message: string;
  receivedAt: string;
}> {
  const raw = await req.text();
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();

  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    return {
      sender: String(params.get("sender") ?? "").trim(),
      message: String(params.get("message") ?? "").trim(),
      receivedAt: String(params.get("receivedAt") ?? "").trim(),
    };
  }

  if (ct.includes("text/plain")) {
    return { sender: "", message: raw.trim(), receivedAt: "" };
  }

  if (ct.includes("application/json")) {
    try {
      const body = JSON.parse(raw) as ImportSmsRequest;
      return {
        sender: String(body.sender ?? "").trim(),
        message: String(body.message ?? "").trim(),
        receivedAt: String(body.receivedAt ?? "").trim(),
      };
    } catch {
      const err = new Error(INVALID_JSON_MULTILINE);
      err.name = INVALID_JSON_MULTILINE;
      throw err;
    }
  }

  try {
    const body = JSON.parse(raw) as ImportSmsRequest;
    return {
      sender: String(body.sender ?? "").trim(),
      message: String(body.message ?? "").trim(),
      receivedAt: String(body.receivedAt ?? "").trim(),
    };
  } catch {
    const params = new URLSearchParams(raw);
    if (params.has("message")) {
      return {
        sender: String(params.get("sender") ?? "").trim(),
        message: String(params.get("message") ?? "").trim(),
        receivedAt: String(params.get("receivedAt") ?? "").trim(),
      };
    }
    return { sender: "", message: raw.trim(), receivedAt: "" };
  }
}

export async function POST(req: Request) {
  try {
    let sender: string;
    let message: string;
    let receivedAt: string;
    try {
      const parsedBody = await readImportSmsPayload(req);
      sender = parsedBody.sender;
      message = parsedBody.message;
      receivedAt = parsedBody.receivedAt;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === INVALID_JSON_MULTILINE) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "invalid_json_multiline_sms: use Content-Type application/x-www-form-urlencoded with fields sender, message, receivedAt",
          },
          { status: 400 }
        );
      }
      throw e;
    }

    if (!message) {
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const parsed = parseBankSmsTransaction(message);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: "could not parse transaction from sms", skipped: true },
        { status: 200 }
      );
    }

    const supabase = await createClient();
    const externalId = buildExternalId(sender, message);
    const smsGroupRules = await loadSmsGroupRulesFromDb();

    if (parsed.kind === "withdrawal") {
      const { data: existing, error: existingErr } = await supabase
        .from("budget_entries")
        .select("id")
        .eq("source", "app")
        .eq("external_id", externalId)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) return NextResponse.json({ ok: true, duplicated: true, type: "withdrawal" });

      const rawItem = parsed.itemName?.trim() || "";
      const item = rawItem
        ? applySmsGroupRulesToItem(rawItem, smsGroupRules)
        : sender
          ? `출금(${sender})`
          : "출금";
      const { error } = await supabase.from("budget_entries").insert({
        date: toDateOnlyFromReceivedAt(receivedAt),
        item,
        amount: parsed.amount,
        source: "app",
        external_id: externalId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, duplicated: false, type: "withdrawal", amount: parsed.amount });
    }

    const incomeId = `sms-${externalId.slice(0, 24)}`;
    const rawReceived = String(receivedAt ?? "").trim();
    const parsedReceived = rawReceived ? new Date(rawReceived) : new Date();
    const safe = Number.isNaN(parsedReceived.getTime()) ? new Date() : parsedReceived;
    const { year, month } = yearMonthInSeoul(safe);
    const item = sender ? `입금(${sender})` : "입금";

    const { data: existingIncome, error: incomeExistingErr } = await supabase
      .from("income_entries")
      .select("id")
      .eq("id", incomeId)
      .maybeSingle();
    if (incomeExistingErr) throw incomeExistingErr;
    if (existingIncome) return NextResponse.json({ ok: true, duplicated: true, type: "deposit" });

    const { error: insertIncomeErr } = await supabase.from("income_entries").insert({
      id: incomeId,
      year,
      month,
      item,
      amount: parsed.amount,
      category: "기타",
    });
    if (insertIncomeErr) throw insertIncomeErr;

    return NextResponse.json({ ok: true, duplicated: false, type: "deposit", amount: parsed.amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
