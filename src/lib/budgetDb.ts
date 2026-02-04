/**
 * 가계부 Supabase CRUD. supabase.ts 의 client 사용.
 */
import { supabase } from "./supabase";

type BudgetEntryRow = { id: string; date: string; item: string; amount: number };
const CATEGORY_IDS = ["고정비", "사업경비", "세금", "생활비", "신용카드"] as const;
type CategoryId = (typeof CATEGORY_IDS)[number];
type CategoryKeywords = Record<CategoryId, string[]>;
type MonthExtraKeywords = Record<string, Partial<Record<CategoryId, string[]>>>;

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function loadEntriesFromDb(): Promise<BudgetEntryRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("budget_entries")
    .select("id, date, item, amount")
    .order("date", { ascending: false });
  if (error) {
    console.error("[budgetDb] loadEntries", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    date: row.date,
    item: row.item,
    amount: Number(row.amount),
  }));
}

/** 저장 후 앱에서 쓸 목록 반환 (새 행은 DB id로 갱신됨). 삭제된 항목은 DB에서도 제거됨. */
export async function saveEntriesToDb(entries: BudgetEntryRow[]): Promise<BudgetEntryRow[]> {
  if (!supabase) return entries;
  const keepIds = entries.filter((e) => isUuid(e.id)).map((e) => e.id);
  const { data: existingRows } = await supabase
    .from("budget_entries")
    .select("id")
    .eq("source", "app");
  const existingIds = (existingRows ?? []).map((r) => String(r.id));
  const toDelete = existingIds.filter((id) => !keepIds.includes(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("budget_entries")
      .delete()
      .in("id", toDelete);
    if (delErr) console.error("[budgetDb] delete removed entries", delErr);
  }
  const existing: BudgetEntryRow[] = [];
  const newEntries: BudgetEntryRow[] = [];
  for (const e of entries) {
    if (isUuid(e.id)) existing.push(e);
    else newEntries.push(e);
  }
  const out: BudgetEntryRow[] = [];
  for (const e of existing) {
    const { error } = await supabase
      .from("budget_entries")
      .upsert(
        { id: e.id, date: e.date, item: e.item, amount: e.amount, source: "app" },
        { onConflict: "id" }
      );
    if (!error) out.push(e);
  }
  for (const e of newEntries) {
    const { data, error } = await supabase
      .from("budget_entries")
      .insert({ date: e.date, item: e.item, amount: e.amount, source: "app" })
      .select("id, date, item, amount")
      .single();
    if (error) {
      console.error("[budgetDb] insert entry failed", error);
      throw error;
    }
    if (data)
      out.push({
        id: String(data.id),
        date: data.date,
        item: data.item,
        amount: Number(data.amount),
      });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadKeywordsFromDb(): Promise<CategoryKeywords> {
  if (!supabase) return {} as CategoryKeywords;
  const { data, error } = await supabase.from("budget_keywords").select("category, keywords");
  if (error) {
    console.error("[budgetDb] loadKeywords", error);
    return {} as CategoryKeywords;
  }
  const out = {} as CategoryKeywords;
  for (const cat of CATEGORY_IDS) out[cat] = [];
  (data ?? []).forEach((row: { category: string; keywords: unknown }) => {
    const cat = row.category as CategoryId;
    if (CATEGORY_IDS.includes(cat) && Array.isArray(row.keywords)) out[cat] = row.keywords as string[];
  });
  return out;
}

export async function saveKeywordsToDb(keywords: CategoryKeywords): Promise<void> {
  if (!supabase) return;
  for (const cat of CATEGORY_IDS) {
    await supabase.from("budget_keywords").upsert(
      { category: cat, keywords: keywords[cat] ?? [] },
      { onConflict: "category" }
    );
  }
}

export async function loadMonthExtrasFromDb(): Promise<MonthExtraKeywords> {
  if (!supabase) return {};
  const { data, error } = await supabase.from("budget_month_extras").select("year_month, extras");
  if (error) {
    console.error("[budgetDb] loadMonthExtras", error);
    return {};
  }
  const out: MonthExtraKeywords = {};
  (data ?? []).forEach((row: { year_month: string; extras: unknown }) => {
    if (row.extras && typeof row.extras === "object") out[row.year_month] = row.extras as MonthExtraKeywords[string];
  });
  return out;
}

export async function saveMonthExtrasToDb(extras: MonthExtraKeywords): Promise<void> {
  if (!supabase) return;
  const keys = Object.keys(extras);
  for (const yearMonth of keys) {
    await supabase.from("budget_month_extras").upsert(
      { year_month: yearMonth, extras: extras[yearMonth] ?? {} },
      { onConflict: "year_month" }
    );
  }
}
