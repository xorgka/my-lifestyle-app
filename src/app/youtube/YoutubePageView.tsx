"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { AmountToggle, formatAmountShort } from "@/components/ui/AmountToggle";

type ChannelRecord = {
  id: number;
  name: string;
  channelUrl: string;
  category: string;
  accountEmail: string;
  password: string;
  monthlyRevenues: Record<string, number>;
  memo: string;
};

export function YoutubePageView(props: Record<string, unknown>) {
  const p = props;
  const channels = (p.channels as ChannelRecord[]) ?? [];
  const channelsLoading = (p.channelsLoading as boolean) ?? false;
  const useSupabase = (p.useSupabase as boolean) ?? false;
  const setChannels = p.setChannels as React.Dispatch<React.SetStateAction<ChannelRecord[]>>;
  const modal = p.modal as "add" | "edit" | null;
  const setModal = p.setModal as React.Dispatch<React.SetStateAction<"add" | "edit" | null>>;
  const editingId = p.editingId as number | null;
  const setEditingId = p.setEditingId as React.Dispatch<React.SetStateAction<number | null>>;
  const revealAccountId = p.revealAccountId as number | null;
  const setRevealAccountId = p.setRevealAccountId as React.Dispatch<React.SetStateAction<number | null>>;
  const accountModalChannelId = p.accountModalChannelId as number | null;
  const setAccountModalChannelId = p.setAccountModalChannelId as React.Dispatch<React.SetStateAction<number | null>>;
  const accountPinInput = (p.accountPinInput as string) ?? "";
  const setAccountPinInput = p.setAccountPinInput as React.Dispatch<React.SetStateAction<string>>;
  const accountPinError = (p.accountPinError as boolean) ?? false;
  const setAccountPinError = p.setAccountPinError as React.Dispatch<React.SetStateAction<boolean>>;
  const accountPinInputRef = p.accountPinInputRef as React.RefObject<HTMLInputElement | null>;
  const memoModalChannelId = p.memoModalChannelId as number | null;
  const setMemoModalChannelId = p.setMemoModalChannelId as React.Dispatch<React.SetStateAction<number | null>>;
  const memoEditValue = (p.memoEditValue as string) ?? "";
  const setMemoEditValue = p.setMemoEditValue as React.Dispatch<React.SetStateAction<string>>;
  const form = p.form as ChannelRecord;
  const setForm = p.setForm as React.Dispatch<React.SetStateAction<ChannelRecord>>;
  const revenueInputChannelId = p.revenueInputChannelId as number | null;
  const setRevenueInputChannelId = p.setRevenueInputChannelId as React.Dispatch<React.SetStateAction<number | null>>;
  const revenueViewChannelId = p.revenueViewChannelId as number | null;
  const setRevenueViewChannelId = p.setRevenueViewChannelId as React.Dispatch<React.SetStateAction<number | null>>;
  const revenueForm = p.revenueForm as { year: number; month: number; amount: number };
  const setRevenueForm = p.setRevenueForm as React.Dispatch<React.SetStateAction<{ year: number; month: number; amount: number }>>;
  const quickRevenue = p.quickRevenue as { channelId: number; year: number; month: number; amount: number };
  const setQuickRevenue = p.setQuickRevenue as React.Dispatch<React.SetStateAction<{ channelId: number; year: number; month: number; amount: number }>>;
  const aggregateYear = p.aggregateYear as number | null;
  const setAggregateYear = p.setAggregateYear as React.Dispatch<React.SetStateAction<number | null>>;
  const channelRevenueYear = p.channelRevenueYear as number | null;
  const setChannelRevenueYear = p.setChannelRevenueYear as React.Dispatch<React.SetStateAction<number | null>>;
  const checkAccountPin = p.checkAccountPin as (channelId: number) => void;
  const closeAccountModal = p.closeAccountModal as () => void;
  const saveQuickRevenue = p.saveQuickRevenue as () => void;
  const currentYearMonth = p.currentYearMonth as string;
  const currentMonthLabel = p.currentMonthLabel as string;
  const totals = p.totals as { thisMonth: number; total: number };
  const monthlyAggregate = p.monthlyAggregate as Record<string, number>;
  const saveMonthlyRevenue = p.saveMonthlyRevenue as () => void;
  const deleteMonthRevenue = p.deleteMonthRevenue as (channelId: number, yyyyMm: string) => void;
  const updateMonthRevenue = p.updateMonthRevenue as (channelId: number, yyyyMm: string, amount: number) => void;
  const openAdd = p.openAdd as () => void;
  const openEdit = p.openEdit as (c: ChannelRecord) => void;
  const closeModal = p.closeModal as () => void;
  const save = p.save as () => void;
  const remove = p.remove as (id: number) => void;
  const formatted = p.formatted as (n: number) => string;
  const channelMonthRevenue = p.channelMonthRevenue as (c: ChannelRecord, yyyyMm: string) => number;
  const channelTotalRevenue = p.channelTotalRevenue as (c: ChannelRecord) => number;

  const now = new Date();
  const currentYear = now.getFullYear();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<"month" | "year" | "range" | "all">("year");
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [exportRangeFrom, setExportRangeFrom] = useState(() => {
    const d = new Date(currentYear - 1, now.getMonth(), now.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [exportRangeTo, setExportRangeTo] = useState(() =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );

  const getFromTo = (): [string, string] => {
    if (exportRange === "month") {
      const y = exportYear;
      const m = String(exportMonth).padStart(2, "0");
      const lastDay = new Date(y, exportMonth, 0).getDate();
      return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, "0")}`];
    }
    if (exportRange === "year") {
      return [`${exportYear}-01-01`, `${exportYear}-12-31`];
    }
    if (exportRange === "range") {
      return [exportRangeFrom, exportRangeTo];
    }
    return ["2000-01-01", "2030-12-31"];
  };

  const doExport = () => {
    const [from, to] = getFromTo();
    const fromYm = from.slice(0, 7);
    const toYm = to.slice(0, 7);
    let years = [...new Set(
      Object.keys(monthlyAggregate)
        .filter((k) => k >= fromYm && k <= toYm)
        .map((k) => parseInt(k.slice(0, 4), 10))
    )].sort((a, b) => a - b);
    if (years.length === 0) {
      years = fromYm <= "2027" && toYm >= "2026" ? [2026, 2027] : [currentYear];
    }

    const wb = XLSX.utils.book_new();
    years.forEach((y) => {
      const yearTotal = Object.entries(monthlyAggregate)
        .filter(([k]) => k.startsWith(String(y)) && k >= fromYm && k <= toYm)
        .reduce((a, [, v]) => a + v, 0);
      const rows: (string | number)[][] = [
        ["월", "수익(원)"],
        ...Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const yyyyMm = `${y}-${String(m).padStart(2, "0")}`;
          const amount = yyyyMm >= fromYm && yyyyMm <= toYm ? (monthlyAggregate[yyyyMm] ?? 0) : 0;
          return [`${m}월`, formatted(amount)];
        }),
        ["연 전체", formatted(yearTotal)],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `${y}년`);
    });
    const suffix = exportRange === "month"
      ? `${exportYear}-${String(exportMonth).padStart(2, "0")}`
      : exportRange === "year"
        ? `${exportYear}년`
        : exportRange === "range"
          ? `${fromYm}_${toYm}`
          : "전체";
    XLSX.writeFile(wb, `채널수익_${suffix}.xlsx`);
    setShowExportModal(false);
  };

  const formatChannelAmount = (n: number) => (n >= 10_000 ? formatAmountShort(n) : `${formatted(n)}원`);

  return (
    <div className="min-w-0 space-y-4">
      {channelsLoading || channels.length === 0 ? (
        <div className="min-w-0">
          <SectionTitle
            title="유튜브"
            subtitle="채널별 수익, 계정 정보, 메모를 한 곳에서 관리해요."
            className="mb-0 pb-0"
          />
          {!useSupabase && (
            <p className="mt-1 text-xs text-amber-600">
              데이터가 이 기기만 저장돼요. 모바일 연동: 배포 환경에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 설정 후 재배포하세요.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <SectionTitle
              title="유튜브"
              subtitle="채널별 수익, 계정 정보, 메모를 한 곳에서 관리해요."
              className="mb-0 pb-0"
            />
            {!useSupabase && (
              <p className="mt-1 text-xs text-amber-600">
                데이터가 이 기기만 저장돼요. 모바일 연동: 배포 환경에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 설정 후 재배포하세요.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="shrink-0 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            내보내기
          </button>
        </div>
      )}

      {channelsLoading ? (
        <Card className="py-12 text-center">
          <p className="text-neutral-500">불러오는 중…</p>
        </Card>
      ) : channels.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-neutral-500">
            등록된 채널이 없어요. 아래 버튼으로 첫 채널을 등록해보세요.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            채널 추가
          </button>
        </Card>
      ) : (
        <>
          <Card className="bg-gradient-to-br from-white via-[#f5f5f7] to-white ring-1 ring-neutral-300">
            <h2 className="text-lg font-semibold text-neutral-900">
              채널 수익 합계
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
                <div className="text-sm font-medium text-neutral-500">
                  이번 달 수익
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                  <AmountToggle amount={totals.thisMonth} className="text-2xl font-bold" />
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
                <div className="text-sm font-medium text-neutral-500">
                  누적 수익
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                  <AmountToggle amount={totals.total} className="text-2xl font-bold" />
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-neutral-200 pt-4">
              <div className="flex gap-3">
                {([2026, 2027] as const).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setAggregateYear((prev) => (prev === y ? null : y))}
                    className={`rounded-xl border-2 px-5 py-2.5 text-sm font-semibold transition ${
                      aggregateYear === y
                        ? "border-neutral-900 bg-neutral-900 text-white shadow-md"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-800"
                    }`}
                  >
                    {y}년
                  </button>
                ))}
              </div>
              {aggregateYear != null && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-neutral-700">
                    {aggregateYear}년 월별 수익
                  </h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((m) => {
                        const yyyyMm = `${aggregateYear}-${String(m).padStart(2, "0")}`;
                        const amount = monthlyAggregate[yyyyMm] ?? 0;
                        return (
                          <div
                            key={yyyyMm}
                            className="rounded-lg bg-neutral-50/80 px-2 py-2 text-center text-sm"
                          >
                            <div className="text-neutral-500 text-xs">{m}월</div>
                            <div className="mt-0.5 font-medium text-neutral-900 break-all">
                              {formatted(amount)}원
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {[7, 8, 9, 10, 11, 12].map((m) => {
                        const yyyyMm = `${aggregateYear}-${String(m).padStart(2, "0")}`;
                        const amount = monthlyAggregate[yyyyMm] ?? 0;
                        return (
                          <div
                            key={yyyyMm}
                            className="rounded-lg bg-neutral-50/80 px-2 py-2 text-center text-sm"
                          >
                            <div className="text-neutral-500 text-xs">{m}월</div>
                            <div className="mt-0.5 font-medium text-neutral-900 break-all">
                              {formatted(amount)}원
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between rounded-xl bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900">
                    <span>{aggregateYear}년 연 전체 수익</span>
                    <span>
                      {formatted(
                        Object.entries(monthlyAggregate)
                          .filter(([k]) => k.startsWith(String(aggregateYear)))
                          .reduce((a, [, v]) => a + v, 0)
                      )}
                      원
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {showExportModal &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10 px-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-modal-title"
              >
                <div
                  className="fixed inset-0 h-[100dvh] w-[100vw] min-h-full min-w-full bg-black/55"
                  onClick={() => setShowExportModal(false)}
                  aria-hidden
                />
                <div
                  className="relative z-10 my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="export-modal-title" className="text-lg font-semibold text-neutral-900">
                    유튜브 내보내기
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    연도와 범위를 선택한 뒤 내보내기를 누르세요.
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500">연도</label>
                      <select
                        value={exportYear}
                        onChange={(e) => setExportYear(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                      >
                        {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                          <option key={y} value={y}>{y}년</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-neutral-500">내보내기 범위</span>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="exportRange"
                            checked={exportRange === "month"}
                            onChange={() => setExportRange("month")}
                            className="text-neutral-700"
                          />
                          <span className="text-sm">특정 월</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="exportRange"
                            checked={exportRange === "year"}
                            onChange={() => setExportRange("year")}
                            className="text-neutral-700"
                          />
                          <span className="text-sm">특정 연도</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="exportRange"
                            checked={exportRange === "range"}
                            onChange={() => setExportRange("range")}
                            className="text-neutral-700"
                          />
                          <span className="text-sm">특정 기간</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="exportRange"
                            checked={exportRange === "all"}
                            onChange={() => setExportRange("all")}
                            className="text-neutral-700"
                          />
                          <span className="text-sm">전부</span>
                        </label>
                      </div>
                    </div>
                    {exportRange === "month" && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-500">월</label>
                        <select
                          value={exportMonth}
                          onChange={(e) => setExportMonth(Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{m}월</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {exportRange === "range" && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-500">시작일 ~ 종료일</label>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={exportRangeFrom}
                            onChange={(e) => setExportRangeFrom(e.target.value)}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                          />
                          <span className="text-neutral-400">~</span>
                          <input
                            type="date"
                            value={exportRangeTo}
                            onChange={(e) => setExportRangeTo(e.target.value)}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                          />
                        </div>
                      </div>
                    )}
                    {exportRange === "all" && (
                      <p className="text-sm text-neutral-600">저장된 전체 데이터를 내보냅니다.</p>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowExportModal(false)}
                      className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={doExport}
                      className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                    >
                      내보내기
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
              <h3 className="text-lg font-semibold text-neutral-800">채널 LIST</h3>
              <span className="group relative inline-block">
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900"
                  aria-label="채널 추가"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                <span
                  className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs text-white opacity-0 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100"
                  role="tooltip"
                >
                  채널 추가
                </span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80">
                    <th className="px-5 py-3 font-semibold text-neutral-700">채널명</th>
                    <th className="px-5 py-3 font-semibold text-neutral-700">카테고리</th>
                    <th className="px-5 py-3 font-semibold text-neutral-700">계정정보</th>
                    <th className="px-5 py-3 font-semibold text-neutral-700">{currentMonthLabel} 수익</th>
                    <th className="px-5 py-3 font-semibold text-neutral-700">누적 수익</th>
                    <th className="px-5 py-3 font-semibold text-neutral-700">메모</th>
                    <th className="min-w-[6rem] px-5 py-3 font-semibold text-neutral-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch) => (
                    <tr
                      key={ch.id}
                      className="border-b border-neutral-100 transition hover:bg-neutral-50/50"
                    >
                      <td className="px-5 py-3">
                        {ch.channelUrl ? (
                          <a
                            href={ch.channelUrl.startsWith("http") ? ch.channelUrl : `https://${ch.channelUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
                          >
                            {ch.name || "—"}
                          </a>
                        ) : (
                          <span className="font-medium text-neutral-900">
                            {ch.name || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-neutral-600">
                        {ch.category || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAccountModalChannelId(ch.id);
                            setAccountPinInput("");
                            setAccountPinError(false);
                            setRevealAccountId(null);
                          }}
                          className="rounded-xl bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                        >
                          보기
                        </button>
                      </td>
                      <td className="px-5 py-3 font-medium text-neutral-900" title={formatted(channelMonthRevenue(ch, currentYearMonth)) + "원"}>
                        {formatChannelAmount(channelMonthRevenue(ch, currentYearMonth))}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setRevenueViewChannelId(ch.id);
                            setChannelRevenueYear(new Date().getFullYear());
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg font-medium text-neutral-900 hover:bg-neutral-100 hover:text-neutral-700 px-1.5 py-0.5 -mx-1.5 -my-0.5 transition"
                          title={formatted(channelTotalRevenue(ch)) + "원"}
                        >
                          <span>{formatChannelAmount(channelTotalRevenue(ch))}</span>
                          <span className="text-neutral-400" aria-hidden>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setMemoModalChannelId(ch.id);
                            setMemoEditValue(ch.memo ?? "");
                          }}
                          className="rounded-xl bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                        >
                          보기
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(ch)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(ch.id)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden !bg-gradient-to-br !from-[#E62117] !to-[#b91c1c] p-0 ring-[#cc1a14] shadow-none hover:shadow-none hover:translate-y-0">
            <h2 className="mb-4 text-lg font-semibold text-white">
              월별 수익 입력
            </h2>
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-[1fr_6rem_6rem_1fr] sm:items-end">
              <div className="min-w-0">
                <select
                  value={quickRevenue.channelId || ""}
                  onChange={(e) =>
                    setQuickRevenue((q) => ({
                      ...q,
                      channelId: Number(e.target.value),
                    }))
                  }
                  aria-label="채널 선택"
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-3 pr-8 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 [appearance:none] [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%226b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] [background-position:right_0.5rem_center] [background-repeat:no-repeat] [background-size:1.25rem]"
                >
                  <option value="">채널 선택</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name || "—"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <select
                  value={quickRevenue.year}
                  onChange={(e) =>
                    setQuickRevenue((q) => ({
                      ...q,
                      year: Number(e.target.value),
                    }))
                  }
                  aria-label="연도"
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-2.5 pr-7 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 [appearance:none] [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%226b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] [background-position:right_0.35rem_center] [background-repeat:no-repeat] [background-size:1rem]"
                >
                  <option value={2026}>2026년</option>
                </select>
              </div>
              <div className="min-w-0">
                <select
                  value={quickRevenue.month}
                  onChange={(e) =>
                    setQuickRevenue((q) => ({
                      ...q,
                      month: Number(e.target.value),
                    }))
                  }
                  aria-label="월"
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-2.5 pr-7 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 [appearance:none] [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%226b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] [background-position:right_0.35rem_center] [background-repeat:no-repeat] [background-size:1rem]"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={quickRevenue.amount || ""}
                    onChange={(e) =>
                      setQuickRevenue((q) => ({
                        ...q,
                        amount: Number(e.target.value) || 0,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (quickRevenue.channelId) saveQuickRevenue();
                      }
                    }}
                    placeholder="수익 (엔터)"
                    aria-label="수익 원"
                    className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  />
                  <button
                    type="button"
                    onClick={saveQuickRevenue}
                    disabled={!quickRevenue.channelId}
                    className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {modal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0 bg-black/40"
              onClick={closeModal}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Card className="relative z-10 my-auto max-h-[90vh] w-full max-w-lg flex-shrink-0 overflow-y-auto">
                <h2 className="text-xl font-bold text-neutral-900">
                  {modal === "add" ? "채널 추가" : "채널 수정"}
                </h2>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-600">채널명 *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="예: 내 채널"
                      className="mt-1 w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600">채널 링크</label>
                    <input
                      type="text"
                      value={form.channelUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, channelUrl: e.target.value }))
                      }
                      placeholder="https://youtube.com/@..."
                      className="mt-1 w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600">카테고리</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      placeholder="예: 브이로그, 게임"
                      className="mt-1 w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600">구글 계정 (이메일)</label>
                    <input
                      type="text"
                      value={form.accountEmail}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, accountEmail: e.target.value }))
                      }
                      placeholder="example@gmail.com"
                      className="mt-1 w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600">비밀번호</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder="••••••••"
                      className="mt-1 w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600">메모</label>
                    <textarea
                      value={form.memo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, memo: e.target.value }))
                      }
                      rows={3}
                      placeholder="자유 메모"
                      className="mt-1 w-full resize-none rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 rounded-2xl border border-soft-border px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      className="flex-1 rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                    >
                      {modal === "add" ? "추가" : "저장"}
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>,
          document.body
        )}

      {accountModalChannelId != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0 bg-black/40"
              onClick={closeAccountModal}
              aria-hidden
            />
            <Card
              className="relative z-10 my-auto w-full max-w-md flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-neutral-900">계정정보</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {channels.find((c) => c.id === accountModalChannelId)?.name ?? ""} 채널
              </p>
              {revealAccountId === accountModalChannelId ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-500">이메일</label>
                    <p className="mt-1 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
                      {channels.find((c) => c.id === accountModalChannelId)?.accountEmail || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">비밀번호</label>
                    <p className="mt-1 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-900 font-mono">
                      {channels.find((c) => c.id === accountModalChannelId)?.password || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeAccountModal}
                    className="mt-4 w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    닫기
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-600">PIN</label>
                    <input
                      ref={accountPinInputRef as React.RefObject<HTMLInputElement>}
                      type="password"
                      value={accountPinInput}
                      onChange={(e) => {
                        setAccountPinInput(e.target.value);
                        setAccountPinError(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") checkAccountPin(accountModalChannelId);
                      }}
                      placeholder="PIN 입력"
                      className="mt-1 w-full rounded-xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                    {accountPinError && (
                      <p className="mt-1 text-xs text-red-600">PIN이 올바르지 않아요.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeAccountModal}
                      className="flex-1 rounded-xl border border-soft-border px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => checkAccountPin(accountModalChannelId)}
                      className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>,
          document.body
        )}

      {memoModalChannelId != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setMemoModalChannelId(null)}
              aria-hidden
            />
            <Card
              className="relative z-10 my-auto w-full max-w-md flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-neutral-900">메모</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {channels.find((c) => c.id === memoModalChannelId)?.name ?? ""} 채널
              </p>
              <textarea
                value={memoEditValue}
                onChange={(e) => setMemoEditValue(e.target.value)}
                rows={6}
                placeholder="메모를 입력하세요"
                className="mt-4 w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMemoModalChannelId(null)}
                  className="flex-1 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      window.confirm("메모를 삭제할까요?")
                    ) {
                      setChannels((prev) =>
                        prev.map((c) =>
                          c.id === memoModalChannelId
                            ? { ...c, memo: "" }
                            : c
                        )
                      );
                      setMemoModalChannelId(null);
                      setMemoEditValue("");
                    }
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannels((prev) =>
                      prev.map((c) =>
                        c.id === memoModalChannelId
                          ? { ...c, memo: memoEditValue }
                          : c
                      )
                    );
                    setMemoModalChannelId(null);
                  }}
                  className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  저장
                </button>
              </div>
            </Card>
          </div>,
          document.body
        )}

      {revenueViewChannelId != null &&
        typeof document !== "undefined" &&
        (() => {
          const ch = channels.find((c) => c.id === revenueViewChannelId);
          if (!ch) return null;
          const total = channelTotalRevenue(ch);
          const mr = ch.monthlyRevenues || {};
          const closeRevenueModal = () => {
            setRevenueViewChannelId(null);
            setChannelRevenueYear(null);
          };
          return createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="revenue-detail-title"
            >
              <div className="fixed inset-0" onClick={closeRevenueModal} aria-hidden />
              <Card
                className="relative z-10 my-8 w-full max-w-md max-h-[92vh] min-h-[28rem] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 id="revenue-detail-title" className="text-lg font-bold text-neutral-900">
                    채널별 월별/연별 수익 — {ch.name || "—"}
                  </h3>
                  <button
                    type="button"
                    onClick={closeRevenueModal}
                    className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="닫기"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex gap-3">
                      {([2026, 2027] as const).map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => setChannelRevenueYear((prev) => (prev === y ? null : y))}
                          className={`rounded-xl border-2 px-5 py-2.5 text-sm font-semibold transition ${
                            channelRevenueYear === y
                              ? "border-neutral-900 bg-neutral-900 text-white shadow-md"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-800"
                          }`}
                        >
                          {y}년
                        </button>
                      ))}
                    </div>
                    {channelRevenueYear != null && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-semibold text-neutral-700">
                          {channelRevenueYear}년 월별 수익
                        </h4>
                        <ul className="space-y-1.5">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const yyyyMm = `${channelRevenueYear}-${String(m).padStart(2, "0")}`;
                            const amount = mr[yyyyMm] ?? 0;
                            return (
                              <li
                                key={yyyyMm}
                                className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                              >
                                <span className="text-neutral-700">{m}월</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    value={amount || ""}
                                    onChange={(e) =>
                                      updateMonthRevenue(ch.id, yyyyMm, Number(e.target.value) || 0)
                                    }
                                    className="w-28 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-right text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                                  />
                                  <span className="text-neutral-500">원</span>
                                  {amount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => deleteMonthRevenue(ch.id, yyyyMm)}
                                      className="rounded-lg px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50"
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="mt-3 flex justify-between rounded-xl bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900">
                          <span>{channelRevenueYear}년 연 전체 수익</span>
                          <span>
                            {formatted(
                              Array.from({ length: 12 }, (_, i) => i + 1).reduce(
                                (a, m) =>
                                  a + (mr[`${channelRevenueYear}-${String(m).padStart(2, "0")}`] ?? 0),
                                0
                              )
                            )}
                            원
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-neutral-200 pt-4">
                    <div className="flex justify-between text-base font-semibold text-neutral-900">
                      <span>누적 수익</span>
                      <span>{formatted(total)}원</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>,
            document.body
          );
        })()}

      {revenueInputChannelId != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0"
              onClick={() => {
                setRevenueInputChannelId(null);
                setRevenueForm({ year: 2026, month: new Date().getMonth() + 1, amount: 0 });
              }}
              aria-hidden
            />
            <Card
              className="relative z-10 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-neutral-900">
                월별 수익 입력
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                {channels.find((c) => c.id === revenueInputChannelId)?.name ?? ""} 채널
              </p>
              <div className="mt-4 flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600">연도</label>
                  <select
                    value={revenueForm.year}
                    onChange={(e) =>
                      setRevenueForm((f) => ({ ...f, year: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  >
                    <option value={2026}>2026년</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600">월</label>
                  <select
                    value={revenueForm.month}
                    onChange={(e) =>
                      setRevenueForm((f) => ({ ...f, month: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs font-medium text-neutral-600">수익 (원)</label>
                <input
                  type="number"
                  value={revenueForm.amount || ""}
                  onChange={(e) =>
                    setRevenueForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))
                  }
                  placeholder="0"
                  className="mt-1 w-full rounded-xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRevenueInputChannelId(null);
                    setRevenueForm({ year: 2026, month: new Date().getMonth() + 1, amount: 0 });
                  }}
                  className="flex-1 rounded-xl border border-soft-border px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveMonthlyRevenue}
                  className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  저장
                </button>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </div>
  );
}
