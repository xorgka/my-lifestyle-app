/**
 * 유튜브 채널: Supabase 연결 시 DB 사용(모바일·PC 동기화), 없으면 localStorage
 */

import { supabase } from "./supabase";

export type YouTubeChannel = {
  id: number;
  name: string;
  channelUrl: string;
  category: string;
  /** 애드센스 계정 (이메일 등) */
  adsenseAccount: string;
  /** 주소 */
  address: string;
  /** 세금정보 */
  taxInfo: string;
  accountEmail: string;
  password: string;
  /** 월별 수익. 키: "YYYY-MM", 값: 달러(USD) */
  monthlyRevenues: Record<string, number>;
  memo: string;
  /** 목록 표시 순서 (작을수록 위) */
  sortOrder: number;
};

const STORAGE_KEY = "my-lifestyle-youtube-channels";

function loadFromStorage(): YouTubeChannel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (YouTubeChannel & { thisMonthRevenue?: number; totalRevenue?: number })[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c, i) => ({
      id: c.id,
      name: c.name ?? "",
      channelUrl: c.channelUrl ?? "",
      category: c.category ?? "",
      adsenseAccount: (c as { adsenseAccount?: string }).adsenseAccount ?? "",
      address: (c as { address?: string }).address ?? "",
      taxInfo: (c as { taxInfo?: string }).taxInfo ?? "",
      accountEmail: c.accountEmail ?? "",
      password: c.password ?? "",
      monthlyRevenues: c.monthlyRevenues && Object.keys(c.monthlyRevenues).length > 0
        ? c.monthlyRevenues
        : c.thisMonthRevenue != null && c.thisMonthRevenue > 0
          ? { [getCurrentYearMonth()]: c.thisMonthRevenue }
          : {},
      memo: c.memo ?? "",
      sortOrder: (c as { sortOrder?: number }).sortOrder ?? i,
    }));
  } catch {
    return [];
  }
}

function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function saveToStorage(channels: YouTubeChannel[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch {}
}

function rowToChannel(row: {
  id: number;
  name: string | null;
  channel_url: string | null;
  category: string | null;
  account_email: string | null;
  password: string | null;
  memo: string | null;
  monthly_revenues: Record<string, number> | null;
  sort_order?: number | null;
  adsense_account?: string | null;
  address?: string | null;
  tax_info?: string | null;
}): YouTubeChannel {
  const id = typeof row.id === "string" ? parseInt(row.id, 10) : row.id;
  return {
    id,
    name: row.name ?? "",
    channelUrl: row.channel_url ?? "",
    category: row.category ?? "",
    adsenseAccount: row.adsense_account ?? "",
    address: row.address ?? "",
    taxInfo: row.tax_info ?? "",
    accountEmail: row.account_email ?? "",
    password: row.password ?? "",
    monthlyRevenues: (row.monthly_revenues && typeof row.monthly_revenues === "object") ? row.monthly_revenues : {},
    memo: row.memo ?? "",
    sortOrder: row.sort_order ?? 0,
  };
}

/** 채널 목록 로드 (Supabase 우선. sort_order 있으면 그대로 정렬, 없으면 id 기준 로드) */
export async function loadYoutubeChannels(): Promise<YouTubeChannel[]> {
  if (supabase) {
    let data: unknown[] | null = null;
    let error: { message?: string } | null = null;
    const withSort = await supabase
      .from("youtube_channels")
      .select("id, name, channel_url, category, adsense_account, address, tax_info, account_email, password, memo, monthly_revenues, sort_order")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (withSort.error && /column|sort_order/i.test(String(withSort.error.message))) {
      const withoutSort = await supabase
        .from("youtube_channels")
        .select("id, name, channel_url, category, adsense_account, address, tax_info, account_email, password, memo, monthly_revenues")
        .order("id", { ascending: true });
      data = withoutSort.data ?? null;
      error = withoutSort.error;
    } else {
      data = withSort.data ?? null;
      error = withSort.error;
    }
    if (error) {
      console.error("[youtube] loadYoutubeChannels", error);
      return loadFromStorage();
    }
    const fromDb = (data ?? []).map(rowToChannel).map((c, i) => ({ ...c, sortOrder: (c as { sortOrder?: number }).sortOrder ?? i }));
    if (fromDb.length > 0) return fromDb;
    const fromStorage = loadFromStorage();
    if (fromStorage.length > 0) {
      await saveYoutubeChannels(fromStorage);
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      return fromStorage;
    }
    return [];
  }
  return loadFromStorage();
}

/** 채널 목록 저장 (Supabase 있으면 DB에, 없으면 localStorage. sort_order 컬럼 없어도 저장 가능) */
export async function saveYoutubeChannels(channels: YouTubeChannel[]): Promise<void> {
  if (supabase) {
    const withOrder = channels.map((c, i) => ({ ...c, sortOrder: i }));
    const withSortOrder = (c: YouTubeChannel) => ({
      id: c.id,
      name: c.name,
      channel_url: c.channelUrl,
      category: c.category,
      adsense_account: c.adsenseAccount ?? "",
      address: c.address ?? "",
      tax_info: c.taxInfo ?? "",
      account_email: c.accountEmail,
      password: c.password,
      memo: c.memo,
      monthly_revenues: c.monthlyRevenues ?? {},
      sort_order: c.sortOrder,
      updated_at: new Date().toISOString(),
    });
    const withoutSortOrder = (c: YouTubeChannel) => ({
      id: c.id,
      name: c.name,
      channel_url: c.channelUrl,
      category: c.category,
      adsense_account: c.adsenseAccount ?? "",
      address: c.address ?? "",
      tax_info: c.taxInfo ?? "",
      account_email: c.accountEmail,
      password: c.password,
      memo: c.memo,
      monthly_revenues: c.monthlyRevenues ?? {},
      updated_at: new Date().toISOString(),
    });
    for (const c of withOrder) {
      const { error } = await supabase.from("youtube_channels").upsert(withSortOrder(c), { onConflict: "id" });
      if (error) {
        const isColumnMissing = /sort_order|column/i.test(String(error.message ?? error.code ?? ""));
        if (isColumnMissing) {
          const { error: err2 } = await supabase.from("youtube_channels").upsert(withoutSortOrder(c), { onConflict: "id" });
          if (err2) console.error("[youtube] saveYoutubeChannels", c.id, err2);
        } else {
          console.error("[youtube] saveYoutubeChannels", c.id, error);
        }
      }
    }
    return;
  }
  saveToStorage(channels);
}

/** 채널 한 건 삭제 (Supabase 있을 때) */
export async function deleteYoutubeChannel(id: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("youtube_channels").delete().eq("id", id);
    if (error) console.error("[youtube] deleteYoutubeChannel", id, error);
  }
}
