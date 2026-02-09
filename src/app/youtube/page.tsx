"use client";

import React, { useEffect, useRef, useState } from "react";
import { YoutubePageView } from "./YoutubePageView";
import {
  type YouTubeChannel,
  loadYoutubeChannels,
  saveYoutubeChannels,
  deleteYoutubeChannel,
} from "@/lib/youtubeDb";
import {
  loadYoutubeActualDeposits,
  saveYoutubeActualDeposits,
} from "@/lib/youtubeActualDepositsDb";
import { supabase } from "@/lib/supabase";

const ACCOUNT_VIEW_PIN = "2013";
/** 수익 입력·저장 단위: 달러. 원 표시 시 이 환율로 곱함 */
export const USD_TO_KRW = 1350;

function getCurrentYearMonth(): string {
  const d = new Date();
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
  accountEmail: "",
  password: "",
  monthlyRevenues: {},
  memo: "",
});

export default function YoutubePage() {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [revealAccountId, setRevealAccountId] = useState<number | null>(null);
  const [accountModalChannelId, setAccountModalChannelId] = useState<number | null>(null);
  const [accountPinInput, setAccountPinInput] = useState("");
  const [accountPinError, setAccountPinError] = useState(false);
  const accountPinInputRef = useRef<HTMLInputElement>(null);
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

  /** 실제 입금 금액: 키 "국민6954-YYYY-MM" | "국민8189-YYYY-MM", 값 원. Supabase 또는 localStorage 동기화 */
  const [actualDeposits, setActualDeposits] = useState<Record<string, number>>({});
  const [actualDepositForm, setActualDepositForm] = useState({
    bank: "국민 6954" as "국민 6954" | "국민 8189",
    year: 2026,
    month: new Date().getMonth() + 1,
    amountKrw: 0,
  });

  /** 통계 탭: 월별 | 연도. 월별일 때 선택 연도 */
  const [statsTab, setStatsTab] = useState<"월별" | "연도">("월별");
  const [statsYear, setStatsYear] = useState<number>(2026);

  const checkAccountPin = (channelId: number) => {
    if (accountPinInput.trim() === ACCOUNT_VIEW_PIN) {
      setRevealAccountId(channelId);
      setAccountPinInput("");
      setAccountPinError(false);
    } else {
      setAccountPinError(true);
    }
  };

  const closeAccountModal = () => {
    setAccountModalChannelId(null);
    setRevealAccountId(null);
    setAccountPinInput("");
    setAccountPinError(false);
  };

  // 계정정보 모달이 열리고 PIN 입력 화면일 때 입력란에 자동 포커스
  useEffect(() => {
    if (
      accountModalChannelId != null &&
      revealAccountId !== accountModalChannelId
    ) {
      const t = setTimeout(() => accountPinInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [accountModalChannelId, revealAccountId]);

  useEffect(() => {
    setChannelsLoading(true);
    loadYoutubeChannels()
      .then(setChannels)
      .catch(console.error)
      .finally(() => setChannelsLoading(false));
  }, []);

  useEffect(() => {
    loadYoutubeActualDeposits().then(setActualDeposits).catch(console.error);
  }, []);

  useEffect(() => {
    if (channelsLoading || channels.length === 0) return;
    saveYoutubeChannels(channels).catch(console.error);
  }, [channels, channelsLoading]);

  useEffect(() => {
    if (Object.keys(actualDeposits).length === 0) return;
    saveYoutubeActualDeposits(actualDeposits).catch(console.error);
  }, [actualDeposits]);

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

  const bankKey = (bank: string) => (bank.replace(/\s/g, "") as "국민6954" | "국민8189");

  const saveActualDeposit = () => {
    const { bank, year, month, amountKrw } = actualDepositForm;
    if (amountKrw <= 0) return;
    const yyyyMm = `${year}-${String(month).padStart(2, "0")}`;
    const key = `${bankKey(bank)}-${yyyyMm}`;
    setActualDeposits((prev) => ({ ...prev, [key]: amountKrw }));
    setActualDepositForm((f) => ({ ...f, amountKrw: 0 }));
  };

  const currentYearMonth = getCurrentYearMonth();
  const currentMonthLabel = `${new Date().getMonth() + 1}월`;
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
    setRevealAccountId(null);
    setMemoModalChannelId(null);
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (modal === "add") {
      const newChannel: YouTubeChannel = {
        ...form,
        id: Date.now(),
      };
      setChannels((prev) => [...prev, newChannel]);
    } else {
      setChannels((prev) =>
        prev.map((c) => (c.id === editingId ? { ...form, id: c.id } : c))
      );
    }
    closeModal();
  };

  const remove = (id: number) => {
    if (typeof window !== "undefined" && !window.confirm("이 채널을 삭제할까요?"))
      return;
    deleteYoutubeChannel(id).catch(console.error);
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setRevealAccountId((prev) => (prev === id ? null : prev));
    setMemoModalChannelId((prev) => (prev === id ? null : prev));
  };

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
    revealAccountId,
    setRevealAccountId,
    accountModalChannelId,
    setAccountModalChannelId,
    accountPinInput,
    setAccountPinInput,
    accountPinError,
    setAccountPinError,
    accountPinInputRef,
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
    checkAccountPin,
    closeAccountModal,
    saveQuickRevenue,
    currentYearMonth,
    currentMonthLabel,
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
    formatted,
    channelMonthRevenue,
    channelTotalRevenue,
    usdToKrw: USD_TO_KRW,
    actualDeposits,
    actualDepositForm,
    setActualDepositForm,
    saveActualDeposit,
    statsTab,
    setStatsTab,
    statsYear,
    setStatsYear,
  };

  return React.createElement(YoutubePageView, viewProps);
}
