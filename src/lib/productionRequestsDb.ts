/**
 * 프로젝트(제작 의뢰) Supabase CRUD. supabase.ts 의 client 사용.
 * API 라우트 등 서버에서 쓸 땐 client 인자로 createSupabaseAnonClient() 전달.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { ProductionRequest } from "./productionRequests";

const SELECT_COLUMNS =
  "id, year_month, request_date, client_name, source, inquiry_channel, category, amount, net_profit, note, status_guide, status_payment, status_invoice, status_material, status_production, status_revision, status_complete, sheet_row";

function rowFromDb(row: Record<string, unknown>): ProductionRequest {
  return {
    id: String(row.id),
    yearMonth: String(row.year_month),
    requestDate: String(row.request_date),
    clientName: String(row.client_name ?? ""),
    source: String(row.source ?? ""),
    inquiryChannel: String(row.inquiry_channel ?? ""),
    category: String(row.category ?? ""),
    amount: Number(row.amount ?? 0),
    netProfit: Number(row.net_profit ?? 0),
    note: String(row.note ?? ""),
    statusGuide: (row.status_guide as ProductionRequest["statusGuide"]) ?? "",
    statusPayment: (row.status_payment as ProductionRequest["statusPayment"]) ?? "",
    statusInvoice: (row.status_invoice as ProductionRequest["statusInvoice"]) ?? "",
    statusMaterial: (row.status_material as ProductionRequest["statusMaterial"]) ?? "",
    statusProduction: (row.status_production as ProductionRequest["statusProduction"]) ?? "",
    statusRevision: (row.status_revision as ProductionRequest["statusRevision"]) ?? "",
    statusComplete: (row.status_complete as ProductionRequest["statusComplete"]) ?? "",
    sheetRow: row.sheet_row == null ? null : Number(row.sheet_row),
  };
}

function patchToDb(patch: Partial<Omit<ProductionRequest, "id" | "sheetRow">>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.yearMonth !== undefined) out.year_month = patch.yearMonth;
  if (patch.requestDate !== undefined) out.request_date = patch.requestDate;
  if (patch.clientName !== undefined) out.client_name = patch.clientName;
  if (patch.source !== undefined) out.source = patch.source;
  if (patch.inquiryChannel !== undefined) out.inquiry_channel = patch.inquiryChannel;
  if (patch.category !== undefined) out.category = patch.category;
  if (patch.amount !== undefined) out.amount = patch.amount;
  if (patch.netProfit !== undefined) out.net_profit = patch.netProfit;
  if (patch.note !== undefined) out.note = patch.note;
  if (patch.statusGuide !== undefined) out.status_guide = patch.statusGuide;
  if (patch.statusPayment !== undefined) out.status_payment = patch.statusPayment;
  if (patch.statusInvoice !== undefined) out.status_invoice = patch.statusInvoice;
  if (patch.statusMaterial !== undefined) out.status_material = patch.statusMaterial;
  if (patch.statusProduction !== undefined) out.status_production = patch.statusProduction;
  if (patch.statusRevision !== undefined) out.status_revision = patch.statusRevision;
  if (patch.statusComplete !== undefined) out.status_complete = patch.statusComplete;
  return out;
}

export async function loadProductionRequests(
  yearMonth: string,
  client?: SupabaseClient | null
): Promise<ProductionRequest[]> {
  const db = client ?? supabase;
  if (!db) return [];
  const { data, error } = await db
    .from("production_requests")
    .select(SELECT_COLUMNS)
    .eq("year_month", yearMonth)
    .order("request_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[productionRequestsDb] load", error);
    return [];
  }
  return (data ?? []).map(rowFromDb);
}

/** 데이터가 있는 월 목록 (year_month 오름차순 unique) */
export async function loadDistinctYearMonths(client?: SupabaseClient | null): Promise<string[]> {
  const db = client ?? supabase;
  if (!db) return [];
  const { data, error } = await db.from("production_requests").select("year_month");
  if (error) {
    console.error("[productionRequestsDb] loadDistinctYearMonths", error);
    return [];
  }
  const set = new Set((data ?? []).map((r) => String(r.year_month)));
  return Array.from(set).sort();
}

export async function loadProductionRequestById(
  id: string,
  client?: SupabaseClient | null
): Promise<ProductionRequest | null> {
  const db = client ?? supabase;
  if (!db) return null;
  const { data, error } = await db.from("production_requests").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowFromDb(data);
}

export async function insertProductionRequest(
  input: Omit<ProductionRequest, "id" | "sheetRow">,
  client?: SupabaseClient | null
): Promise<ProductionRequest> {
  const db = client ?? supabase;
  if (!db) throw new Error("supabase_not_configured");
  const { data, error } = await db
    .from("production_requests")
    .insert(patchToDb(input))
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return rowFromDb(data);
}

export async function updateProductionRequest(
  id: string,
  patch: Partial<Omit<ProductionRequest, "id" | "sheetRow">>,
  client?: SupabaseClient | null
): Promise<ProductionRequest> {
  const db = client ?? supabase;
  if (!db) throw new Error("supabase_not_configured");
  const { data, error } = await db
    .from("production_requests")
    .update(patchToDb(patch))
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return rowFromDb(data);
}

export async function deleteProductionRequest(id: string, client?: SupabaseClient | null): Promise<void> {
  const db = client ?? supabase;
  if (!db) return;
  const { error } = await db.from("production_requests").delete().eq("id", id);
  if (error) throw error;
}

export async function setProductionRequestSheetRow(
  id: string,
  sheetRow: number,
  client?: SupabaseClient | null
): Promise<void> {
  const db = client ?? supabase;
  if (!db) return;
  const { error } = await db
    .from("production_requests")
    .update({ sheet_row: sheetRow, sheet_synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[productionRequestsDb] setSheetRow", error);
}

/** 저장 후 호출: 구글 시트에 반영 시도. 실패해도 앱 저장 자체엔 영향 없음(별도 재시도용 상태만 반환). */
export async function syncProductionRequestToSheet(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/production-requests/sync-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) return { ok: false, error: String(json?.error ?? `http_${res.status}`) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}
