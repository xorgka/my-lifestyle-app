"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { todayStr } from "@/lib/dateUtil";
import {
  type ProductionRequest,
  type ProgressStatus,
  PROGRESS_STEPS,
  SOURCE_OPTIONS,
  emptyProductionRequest,
  formatAmount,
  formatKoreanMonthDay,
  formatManWon,
  groupStatsByMonth,
  monthTabLabel,
  nextProgressStatus,
  sumAmount,
  sumNetProfit,
  toYearMonth,
} from "@/lib/productionRequests";
import {
  deleteProductionRequest,
  insertProductionRequest,
  loadAllProductionRequests,
  loadDistinctYearMonths,
  loadProductionRequests,
  syncProductionRequestToSheet,
  updateProductionRequest,
} from "@/lib/productionRequestsDb";

type FormState = {
  requestDate: string;
  clientName: string;
  source: string;
  inquiryChannel: string;
  category: string;
  amount: string;
  netProfit: string;
  note: string;
  depositAmount: string;
};

function formStateFromRequest(r: ProductionRequest): FormState {
  return {
    requestDate: r.requestDate,
    clientName: r.clientName,
    source: r.source,
    inquiryChannel: r.inquiryChannel,
    category: r.category,
    amount: r.amount ? String(r.amount) : "",
    netProfit: r.netProfit ? String(r.netProfit) : "",
    note: r.note,
    depositAmount: r.depositAmount ? String(r.depositAmount) : "",
  };
}

function emptyFormState(requestDate: string): FormState {
  const e = emptyProductionRequest(requestDate);
  return {
    requestDate: e.requestDate,
    clientName: "",
    source: e.source,
    inquiryChannel: "",
    category: "",
    amount: "",
    netProfit: "",
    note: "",
    depositAmount: "",
  };
}

const STATUS_STYLE: Record<ProgressStatus, string> = {
  "": "border-neutral-200 bg-white text-neutral-300",
  "~": "border-amber-500 text-white",
  O: "border-neutral-900 bg-neutral-900 text-white",
};
const FINAL_STEP_O_STYLE = "border-blue-600 bg-blue-600 text-white";

/** 진행중은 절반만 채운 사각형으로 완료(꽉 찬 사각형)와 뚜렷하게 구분 */
const IN_PROGRESS_BG = "linear-gradient(to right, #f59e0b 50%, #ffffff 50%)";

function StatusDot({
  status,
  label,
  isFinalStep,
  onClick,
}: {
  status: ProgressStatus;
  label: string;
  isFinalStep: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${status === "O" ? "완료" : status === "~" ? "진행중" : "해당없음"} (클릭해서 변경)`}
      className="flex flex-col items-center gap-1.5"
    >
      <span className="text-xs font-semibold text-neutral-600 sm:text-sm">{label}</span>
      <span
        style={status === "~" ? { background: IN_PROGRESS_BG } : undefined}
        className={clsx(
          "flex h-7 w-7 items-center justify-center rounded-lg border-2 text-sm font-bold transition sm:h-9 sm:w-9",
          status === "O" && isFinalStep ? FINAL_STEP_O_STYLE : STATUS_STYLE[status]
        )}
      >
        {status === "O" ? (
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

type ViewMode = "month" | "stats";

export default function ProjectsPage() {
  const now = new Date();
  const [view, setView] = useState<ViewMode>("month");
  const [selectedYearMonth, setSelectedYearMonth] = useState(toYearMonth(todayStr()));
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [allRequests, setAllRequests] = useState<ProductionRequest[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<ProductionRequest | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyFormState(todayStr()));
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductionRequest | null>(null);

  const [syncErrorIds, setSyncErrorIds] = useState<Set<string>>(new Set());

  const loadMonth = useCallback(async (yearMonth: string) => {
    setLoading(true);
    const list = await loadProductionRequests(yearMonth);
    setRequests(list);
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const list = await loadAllProductionRequests();
    setAllRequests(list);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    loadMonth(selectedYearMonth);
  }, [selectedYearMonth, loadMonth]);

  useEffect(() => {
    loadDistinctYearMonths().then(setAvailableMonths);
    loadStats();
  }, [loadStats]);

  const monthStats = useMemo(() => groupStatsByMonth(allRequests), [allRequests]);
  const totalAmount = sumAmount(allRequests);
  const totalNetProfit = sumNetProfit(allRequests);
  const avgMonthlyNetProfit = monthStats.length > 0 ? totalNetProfit / monthStats.length : 0;

  /** 월별 완료 안 된(진행중/해당없음) 의뢰 건수 */
  const incompleteCountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allRequests) {
      if (r.statusComplete !== "O") {
        map.set(r.yearMonth, (map.get(r.yearMonth) ?? 0) + 1);
      }
    }
    return map;
  }, [allRequests]);

  const monthsToShow = useMemo(() => {
    const set = new Set(availableMonths);
    set.add(toYearMonth(todayStr()));
    set.add(selectedYearMonth);
    return Array.from(set).sort().reverse();
  }, [availableMonths, selectedYearMonth]);

  const monthNetProfit = sumNetProfit(requests);

  const runSync = useCallback(async (id: string) => {
    const result = await syncProductionRequestToSheet(id);
    setSyncErrorIds((s) => {
      const n = new Set(s);
      if (result.ok) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const openNewModal = () => {
    setEditingId(null);
    setEditingRequest(null);
    const defaultDate =
      selectedYearMonth === toYearMonth(todayStr()) ? todayStr() : `${selectedYearMonth}-01`;
    setForm(emptyFormState(defaultDate));
    setShowModal(true);
  };

  const openEditModal = (r: ProductionRequest) => {
    setEditingId(r.id);
    setEditingRequest(r);
    setForm(formStateFromRequest(r));
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  const handleSave = async () => {
    if (!form.clientName.trim()) return;
    setSaving(true);
    const patch = {
      yearMonth: toYearMonth(form.requestDate),
      requestDate: form.requestDate,
      clientName: form.clientName.trim(),
      source: form.source,
      inquiryChannel: form.inquiryChannel.trim(),
      category: form.category.trim(),
      amount: Number(form.amount) || 0,
      netProfit: Number(form.netProfit) || 0,
      note: form.note.trim(),
      depositAmount: Number(form.depositAmount) || 0,
    };
    try {
      let saved: ProductionRequest;
      if (editingId) {
        saved = await updateProductionRequest(editingId, patch);
      } else {
        saved = await insertProductionRequest({
          ...patch,
          statusGuide: "",
          statusPayment: "",
          statusInvoice: "",
          statusMaterial: "",
          statusProduction: "",
          statusRevision: "",
          statusComplete: "",
        });
      }
      setShowModal(false);
      if (saved.yearMonth === selectedYearMonth) {
        await loadMonth(selectedYearMonth);
      } else {
        setSelectedYearMonth(saved.yearMonth);
      }
      setAvailableMonths((prev) => (prev.includes(saved.yearMonth) ? prev : [...prev, saved.yearMonth].sort()));
      runSync(saved.id);
      loadStats();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (r: ProductionRequest, key: (typeof PROGRESS_STEPS)[number]["key"]) => {
    const nextValue = nextProgressStatus(r[key]);
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, [key]: nextValue } : x)));
    await updateProductionRequest(r.id, { [key]: nextValue });
    runSync(r.id);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProductionRequest(deleteTarget.id);
    setRequests((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    loadStats();
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title="프로젝트" subtitle="홈페이지·로고 제작 의뢰 진행 상황을 관리하세요." />
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setView("month")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                view === "month" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              월별
            </button>
            <button
              type="button"
              onClick={() => setView("stats")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                view === "stats" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              전체 통계
            </button>
          </div>
          <button
            type="button"
            onClick={openNewModal}
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            + 새 의뢰
          </button>
        </div>
      </div>

      {view === "stats" ? (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <div className="text-xs font-medium text-amber-700">총 매출</div>
                <div className="mt-1 text-2xl font-bold text-amber-900">{formatAmount(totalAmount)}원</div>
              </div>
              <div>
                <div className="text-xs font-medium text-neutral-500">총 순수익</div>
                <div className="mt-1 text-2xl font-bold text-neutral-900">{formatAmount(totalNetProfit)}원</div>
              </div>
              <div>
                <div className="text-xs font-medium text-sky-600">월 평균 순수익</div>
                <div className="mt-1 text-2xl font-bold text-sky-800">{formatAmount(Math.round(avgMonthlyNetProfit))}원</div>
              </div>
            </div>
          </Card>

          <Card>
            {statsLoading ? (
              <div className="py-10 text-center text-sm text-neutral-400">불러오는 중…</div>
            ) : monthStats.length === 0 ? (
              <div className="py-10 text-center text-sm text-neutral-400">데이터가 없습니다.</div>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
              <div className="min-w-[17rem] divide-y divide-neutral-100">
                <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 pb-3 text-xs font-medium text-neutral-400 sm:gap-x-4">
                  <span className="whitespace-nowrap">월</span>
                  <span className="whitespace-nowrap text-right">건수</span>
                  <span className="whitespace-nowrap text-right">매출</span>
                  <span className="whitespace-nowrap text-right">순수익</span>
                </div>
                {monthStats.map((stat) => (
                  <button
                    key={stat.yearMonth}
                    type="button"
                    onClick={() => {
                      setSelectedYearMonth(stat.yearMonth);
                      setView("month");
                    }}
                    className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 py-3 text-left text-sm transition hover:bg-neutral-50 sm:gap-x-4"
                  >
                    <span className="whitespace-nowrap font-medium text-neutral-900">
                      {monthTabLabel(stat.yearMonth, now.getFullYear())}
                    </span>
                    <span className="whitespace-nowrap text-right tabular-nums text-neutral-500">{stat.count}건</span>
                    <span className="whitespace-nowrap text-right tabular-nums text-neutral-700">{formatAmount(stat.amount)}원</span>
                    <span className="whitespace-nowrap text-right tabular-nums font-semibold text-neutral-900">
                      {formatAmount(stat.netProfit)}원
                    </span>
                  </button>
                ))}
              </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
      <Card>
        <div className="flex flex-nowrap items-center gap-4">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
            {monthsToShow.map((ym) => (
              <button
                key={ym}
                type="button"
                onClick={() => setSelectedYearMonth(ym)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  ym === selectedYearMonth
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {monthTabLabel(ym, now.getFullYear())}
                {incompleteCountByMonth.get(ym) ? (
                  <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {incompleteCountByMonth.get(ym)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xs text-neutral-400">순수익</div>
            <div className="text-lg font-bold text-neutral-900">{formatManWon(monthNetProfit)}</div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-neutral-400">불러오는 중…</div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-400">
          {monthTabLabel(selectedYearMonth, now.getFullYear())}에 등록된 의뢰가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const isSyncError = syncErrorIds.has(r.id);
            return (
              <Card
                key={r.id}
                className={clsx("!p-0", r.statusComplete === "O" && "opacity-60 transition-opacity hover:opacity-100")}
              >
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <div className="min-w-0 flex-1 p-5 md:p-6">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                      <span>{formatKoreanMonthDay(r.requestDate)}</span>
                      {r.category && (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-600">
                          {r.category}
                        </span>
                      )}
                      {r.source && (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                          {r.source}
                        </span>
                      )}
                      {r.inquiryChannel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                            />
                          </svg>
                          {r.inquiryChannel}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                      <span className="text-lg font-bold text-neutral-900 sm:text-xl">{r.clientName}</span>
                      <span className="text-neutral-400" aria-hidden>
                        |
                      </span>
                      <span className="text-lg font-bold text-neutral-900 sm:text-xl">{formatAmount(r.netProfit)}원</span>
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="수정"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      {isSyncError && (
                        <button type="button" onClick={() => runSync(r.id)} className="text-xs text-amber-500 hover:underline">
                          ⚠ 시트 반영 실패 (재시도)
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2 text-sm text-neutral-400">
                      {r.note || (r.depositAmount > 0 && r.statusPayment !== "O") ? (
                        <>
                          {r.note && <span>{r.note}</span>}
                          {r.depositAmount > 0 && r.statusPayment !== "O" && (
                            <span className="font-medium text-amber-600">선금 {formatAmount(r.depositAmount)}원</span>
                          )}
                        </>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 justify-items-center gap-3 border-t border-neutral-100 px-5 py-5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:border-l sm:border-t-0 sm:shrink-0">
                    {PROGRESS_STEPS.map((step) => (
                      <StatusDot
                        key={step.key}
                        status={r[step.key]}
                        label={step.label}
                        isFinalStep={step.key === "statusComplete"}
                        onClick={() => handleToggleStatus(r, step.key)}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
        </>
      )}

      {showModal && (
        <ProjectFormModal
          form={form}
          setForm={setForm}
          saving={saving}
          isEdit={editingId != null}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={
            editingRequest
              ? () => {
                  setShowModal(false);
                  setDeleteTarget(editingRequest);
                }
              : undefined
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.clientName}" 의뢰를 삭제할까요? 구글 시트의 행은 자동으로 지워지지 않습니다.`}
          confirmLabel="삭제"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ProjectFormModal({
  form,
  setForm,
  saving,
  isEdit,
  onClose,
  onSave,
  onDelete,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  saving: boolean;
  isEdit: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-black/65 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-neutral-900">{isEdit ? "의뢰 수정" : "새 의뢰"}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">날짜</span>
              <input
                type="date"
                {...field("requestDate")}
                className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">유입</span>
              <div className="relative mt-1">
                <input
                  type="text"
                  placeholder="직접 입력"
                  {...field("source")}
                  className="block h-[42px] w-full rounded-lg border border-neutral-200 bg-white py-2 pl-3 pr-[108px] text-sm text-neutral-800"
                />
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-1">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, source: opt }))}
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-xs font-medium transition",
                        form.source === opt
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">클라이언트</span>
            <input
              type="text"
              {...field("clientName")}
              className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">문의 ID</span>
              <input
                type="text"
                placeholder="예: 유선용"
                {...field("inquiryChannel")}
                className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">업종</span>
              <input
                type="text"
                placeholder="예: 학회"
                {...field("category")}
                className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">금액</span>
              <input
                type="number"
                {...field("amount")}
                className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">순수익</span>
              <input
                type="number"
                {...field("netProfit")}
                className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">선금액 (결제를 선금만 받은 경우)</span>
            <input
              type="number"
              placeholder="선금 없으면 비워두세요"
              {...field("depositAmount")}
              className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">비고</span>
            <textarea
              rows={2}
              {...field("note")}
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving || !form.clientName.trim()}
            onClick={onSave}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
