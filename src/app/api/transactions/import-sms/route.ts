import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBankSmsTransaction } from "@/lib/smsTransactionParser";

type ImportSmsRequest = {
  sender?: string;
  message?: string;
  receivedAt?: string;
};

function toDateOnly(input?: string): string {
  const d = input ? new Date(input) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, "0");
  const day = String(safe.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildExternalId(sender: string, message: string): string {
  return createHash("sha256").update(`${sender}||${message}`).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImportSmsRequest;
    const sender = String(body.sender ?? "").trim();
    const message = String(body.message ?? "").trim();
    const receivedAt = String(body.receivedAt ?? "").trim();

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

    if (parsed.kind === "withdrawal") {
      const { data: existing, error: existingErr } = await supabase
        .from("budget_entries")
        .select("id")
        .eq("source", "app")
        .eq("external_id", externalId)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) return NextResponse.json({ ok: true, duplicated: true, type: "withdrawal" });

      const item = parsed.itemName?.trim() || (sender ? `출금(${sender})` : "출금");
      const { error } = await supabase.from("budget_entries").insert({
        date: toDateOnly(receivedAt),
        item,
        amount: parsed.amount,
        source: "app",
        external_id: externalId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, duplicated: false, type: "withdrawal", amount: parsed.amount });
    }

    const incomeId = `sms-${externalId.slice(0, 24)}`;
    const d = receivedAt ? new Date(receivedAt) : new Date();
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    const year = safe.getFullYear();
    const month = safe.getMonth() + 1;
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
