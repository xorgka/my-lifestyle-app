/**
 * 유튜브 채널: Supabase 연결 시 DB 사용(모바일·PC 동기화), 없으면 localStorage
 */

import { supabase } from "./supabase";

export type YouTubeChannel = {
  id: number;
  name: string;
  channelUrl: string;
  category: string;
  accountEmail: string;
  password: string;
  /** 월별 수익. 키: "YYYY-MM", 값: 원 */
  monthlyRevenues: Record<string, number>;
  memo: string;
};

const STORAGE_KEY = "my-lifestyle-youtube-channels";

function loadFromStorage(): YouTubeChannel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (YouTubeChannel & { thisMonthRevenue?: number; totalRevenue?: number })[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      id: c.id,
      name: c.name ?? "",
      channelUrl: c.channelUrl ?? "",
      category: c.category ?? "",
      accountEmail: c.accountEmail ?? "",
      password: c.password ?? "",
      monthlyRevenues: c.monthlyRevenues && Object.keys(c.monthlyRevenues).length > 0
        ? c.monthlyRevenues
        : c.thisMonthRevenue != null && c.thisMonthRevenue > 0
          ? { [getCurrentYearMonth()]: c.thisMonthRevenue }
          : {},
      memo: c.memo ?? "",
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
}): YouTubeChannel {
  const id = typeof row.id === "string" ? parseInt(row.id, 10) : row.id;
  return {
    id,
    name: row.name ?? "",
    channelUrl: row.channel_url ?? "",
    category: row.category ?? "",
    accountEmail: row.account_email ?? "",
    password: row.password ?? "",
    monthlyRevenues: (row.monthly_revenues && typeof row.monthly_revenues === "object") ? row.monthly_revenues : {},
    memo: row.memo ?? "",
  };
}

/** 채널 목록 로드 (Supabase 우선, 없으면 localStorage. Supabase 비어 있고 localStorage 있으면 한 번 업로드 후 localStorage 삭제) */
export async function loadYoutubeChannels(): Promise<YouTubeChannel[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("youtube_channels")
      .select("id, name, channel_url, category, account_email, password, memo, monthly_revenues")
      .order("id", { ascending: true });
    if (error) {
      console.error("[youtube] loadYoutubeChannels", error);
      return loadFromStorage();
    }
    const fromDb = (data ?? []).map(rowToChannel);
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

/** 채널 목록 저장 (Supabase 있으면 DB에, 없으면 localStorage) */
export async function saveYoutubeChannels(channels: YouTubeChannel[]): Promise<void> {
  if (supabase) {
    for (const c of channels) {
      const { error } = await supabase.from("youtube_channels").upsert(
        {
          id: c.id,
          name: c.name,
          channel_url: c.channelUrl,
          category: c.category,
          account_email: c.accountEmail,
          password: c.password,
          memo: c.memo,
          monthly_revenues: c.monthlyRevenues ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) console.error("[youtube] saveYoutubeChannels", c.id, error);
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
