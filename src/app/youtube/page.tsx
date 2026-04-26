"use client";

import React, { useEffect, useState } from "react";
import { YoutubePageView } from "./YoutubePageView";
import {
  type YouTubeChannel,
  loadYoutubeChannels,
  saveYoutubeChannels,
  deleteYoutubeChannel,
} from "@/lib/youtubeDb";
import { type IncomeEntry, loadIncomeEntries } from "@/lib/income";
import { supabase } from "@/lib/supabase";

/** 수익 입력·저장 단위: 달러. 원 표시 시 이 환율로 곱함 */
const USD_TO_KRW = 1350;

function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousYearMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function channelTotalRevenue(c: YouTubeChannel): number {
  return Object.values(c.monthlyRevenues || {}).reduce((a, b) => a + b, 0);
}

function channelMonthRevenue(c: YouTubeChannel, yyyyMm: string): number {
  return c.monthlyRevenues?.[yyyyMm] ?? 0;
}

const emptyChannel = (): YouTubeChannel => ({
  id: 0,
  name: "",
  channelUrl: "",
  category: "",
  adsenseAccount: "",
  address: "",
  taxInfo: "",
  accountEmail: "",
  password: "",
  monthlyRevenues: {},
  memo: "",
  sortOrder: 0,
});

export default function YoutubePage() {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [accountModalChannelId, setAccountModalChannelId] = useState<number | null>(null);
  const [memoModalChannelId, setMemoModalChannelId] = useState<number | null>(null);
  const [memoEditValue, setMemoEditValue] = useState("");
  const [form, setForm] = useState<YouTubeChannel>(emptyChannel());

  const [revenueInputChannelId, setRevenueInputChannelId] = useState<number | null>(null);
  const [revenueViewChannelId, setRevenueViewChannelId] = useState<number | null>(null);
  const [revenueForm, setRevenueForm] = useState({
    year: 2026,
    month: new Date().getMonth() + 1,
    amount: 0,
  });
  /** 상단 월별 수익 빠른 입력용 */
  const [quickRevenue, setQuickRevenue] = useState({
    channelId: 0,
    year: 2026,
    month: new Date().getMonth() + 1,
    amount: 0,
  });
  /** 월별/연별 총합: 선택한 연도 (2026, 2027) */
  const [aggregateYear, setAggregateYear] = useState<number | null>(null);
  /** 채널별 수익: 선택한 연도 */
  const [channelRevenueYear, setChannelRevenueYear] = useState<number | null>(null);
  const [youtubeIncomeEntries, setYoutubeIncomeEntries] = useState<IncomeEntry[]>([]);

  /** 통계 탭: 월별 | 연도. 월별일 때 선택 연도 */
  const [statsTab, setStatsTab] = useState<"월별" | "연도">("월별");
  const [statsYear, setStatsYear] = useState<number>(2026);

  const closeAccountModal = () => {
    setAccountModalChannelId(null);
  };

  useEffect(() => {
    setChannelsLoading(true);
    Promise.all([loadYoutubeChannels(), loadIncomeEntries()])
      .then(([loadedChannels, incomeEntries]) => {
        setChannels(loadedChannels);
        setYoutubeIncomeEntries(
          incomeEntries.filter(
            (entry) =>
              entry.category.trim() === "애드센스" &&
              entry.item.trim().includes("유튜브")
          )
        );
      })
      .catch(console.error)
      .finally(() => setChannelsLoading(false));
  }, []);

  useEffect(() => {
    if (channelsLoading || channels.length === 0) return;
    saveYoutubeChannels(channels).catch(console.error);
  }, [channels, channelsLoading]);

  // 채널이 바뀌면 빠른 입력 기본 채널을 첫 채널로
  useEffect(() => {
    if (channels.length > 0 && !channels.some((c) => c.id === quickRevenue.channelId)) {
      setQuickRevenue((q) => ({ ...q, channelId: channels[0].id }));
    }
  }, [channels]);

  const saveQuickRevenue = () => {
    const { channelId, year, month, amount } = quickRevenue;
    if (!channelId || !channels.some((c) => c.id === channelId)) return;
    const yyyyMm = `${year}-${String(month).padStart(2, "0")}`;
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId
          ? {
              ...c,
              monthlyRevenues: {
                ...(c.monthlyRevenues || {}),
                [yyyyMm]: amount,
              },
            }
          : c
      )
    );
    setQuickRevenue((q) => ({ ...q, amount: 0 }));
  };

  const currentYearMonth = getCurrentYearMonth();
  const currentMonthLabel = `${new Date().getMonth() + 1}월`;

  /** 채널 LIST 테이블에서 보는 월 (이전/다음으로 변경 가능). 기본값: 이전달 */
  const [channelListViewYearMonth, setChannelListViewYearMonth] = useState(getPreviousYearMonth);

  const totals = channels.reduce(
    (acc, c) => ({
      thisMonth: acc.thisMonth + channelMonthRevenue(c, currentYearMonth),
      total: acc.total + channelTotalRevenue(c),
    }),
    { thisMonth: 0, total: 0 }
  );

  // 월별 총합(모든 채널): yyyyMm -> 원
  const monthlyAggregate = channels.reduce(
    (acc: Record<string, number>, c) => {
      Object.entries(c.monthlyRevenues || {}).forEach(([yyyyMm, amount]) => {
        acc[yyyyMm] = (acc[yyyyMm] ?? 0) + amount;
      });
      return acc;
    },
    {} as Record<string, number>
  );
  const monthlySorted = Object.entries(monthlyAggregate).sort((a, b) =>
    b[0].localeCompare(a[0])
  );

  // 연별 총합(모든 채널): year -> 원
  const yearlyAggregate = monthlySorted.reduce(
    (acc: Record<number, number>, [yyyyMm, amount]: [string, number]) => {
      const y = Number(yyyyMm.slice(0, 4));
      acc[y] = (acc[y] ?? 0) + amount;
      return acc;
    },
    {} as Record<number, number>
  );
  const yearlySorted = Object.entries(yearlyAggregate)
    .map(([y, sum]) => ({ year: Number(y), sum }))
    .sort((a, b) => b.year - a.year);

  const saveMonthlyRevenue = () => {
    if (!revenueInputChannelId) return;
    const yyyyMm = `${revenueForm.year}-${String(revenueForm.month).padStart(2, "0")}`;
    setChannels((prev) =>
      prev.map((c) =>
        c.id === revenueInputChannelId
          ? {
              ...c,
              monthlyRevenues: {
                ...(c.monthlyRevenues || {}),
                [yyyyMm]: revenueForm.amount,
              },
            }
          : c
      )
    );
    setRevenueInputChannelId(null);
    setRevenueForm({ year: 2026, month: new Date().getMonth() + 1, amount: 0 });
  };

  const deleteMonthRevenue = (channelId: number, yyyyMm: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id !== channelId) return c;
        const next = { ...(c.monthlyRevenues || {}) };
        delete next[yyyyMm];
        return { ...c, monthlyRevenues: next };
      })
    );
  };

  const updateMonthRevenue = (channelId: number, yyyyMm: string, amount: number) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId
          ? {
              ...c,
              monthlyRevenues: {
                ...(c.monthlyRevenues || {}),
                [yyyyMm]: amount,
              },
            }
          : c
      )
    );
  };

  const openAdd = () => {
    setForm(emptyChannel());
    setEditingId(null);
    setModal("add");
  };

  const openEdit = (c: YouTubeChannel) => {
    setForm({ ...c });
    setEditingId(c.id);
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
    setForm(emptyChannel());
    setMemoModalChannelId(null);
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (modal === "add") {
      const newChannel: YouTubeChannel = {
        ...form,
        id: Date.now(),
        sortOrder: channels.length,
      };
      setChannels((prev) => [...prev, newChannel]);
    } else {
      setChannels((prev) =>
        prev.map((c) => (c.id === editingId ? { ...form, id: c.id, sortOrder: c.sortOrder } : c))
      );
    }
    closeModal();
  };

  const remove = (id: number) => {
    if (typeof window !== "undefined" && !window.confirm("이 채널을 삭제할까요?"))
      return;
    deleteYoutubeChannel(id).catch(console.error);
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setMemoModalChannelId((prev) => (prev === id ? null : prev));
  };

  const moveChannel = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= channels.length) return;
    const next = [...channels];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setChannels(next);
    saveYoutubeChannels(next).catch(console.error);
  };
  const moveUp = (index: number) => moveChannel(index, index - 1);
  const moveDown = (index: number) => moveChannel(index, index + 1);

  const formatted = (n: number) =>
    n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

  const viewProps = {
    channels,
    channelsLoading,
    useSupabase: !!supabase,
    setChannels,
    modal,
    setModal,
    editingId,
    setEditingId,
    accountModalChannelId,
    setAccountModalChannelId,
    memoModalChannelId,
    setMemoModalChannelId,
    memoEditValue,
    setMemoEditValue,
    form,
    setForm,
    revenueInputChannelId,
    setRevenueInputChannelId,
    revenueViewChannelId,
    setRevenueViewChannelId,
    revenueForm,
    setRevenueForm,
    quickRevenue,
    setQuickRevenue,
    aggregateYear,
    setAggregateYear,
    channelRevenueYear,
    setChannelRevenueYear,
    closeAccountModal,
    saveQuickRevenue,
    currentYearMonth,
    currentMonthLabel,
    channelListViewYearMonth,
    setChannelListViewYearMonth,
    totals,
    monthlyAggregate,
    saveMonthlyRevenue,
    deleteMonthRevenue,
    updateMonthRevenue,
    openAdd,
    openEdit,
    closeModal,
    save,
    remove,
    moveUp,
    moveDown,
    formatted,
    channelMonthRevenue,
    channelTotalRevenue,
    usdToKrw: USD_TO_KRW,
    youtubeIncomeEntries,
    statsTab,
    setStatsTab,
    statsYear,
    setStatsYear,
  };

  return React.createElement(YoutubePageView, viewProps);
}
