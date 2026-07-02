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
  monthTabLabel,
  nextProgressStatus,
  shiftYearMonth,
  sumAmount,
  sumNetProfit,
  toYearMonth,
} from "@/lib/productionRequests";
import {
  deleteProductionRequest,
  insertProductionRequest,
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
  };
}

const STATUS_STYLE: Record<ProgressStatus, string> = {
  "": "border-neutral-200 bg-white text-neutral-300",
  "~": "border-amber-400 bg-amber-50 text-amber-600",
  O: "border-emerald-500 bg-emerald-500 text-white",
};

function StatusDot({
  status,
  label,
  onClick,
}: {
  status: ProgressStatus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${status === "O" ? "완료" : status === "~" ? "진행중" : "해당없음"} (클릭해서 변경)`}
      className="flex flex-col items-center gap-1"
    >
      <span
        className={clsx(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition",
          STATUS_STYLE[status]
        )}
      >
        {status === "O" ? "✓" : status === "~" ? "·" : ""}
      </span>
      <span className="text-[10px] text-neutral-400">{label}</span>
    </button>
  );
}

export default function ProjectsPage() {
  const now = new Date();
  const [selectedYearMonth, setSelectedYearMonth] = useState(toYearMonth(todayStr()));
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyFormState(todayStr()));
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductionRequest | null>(null);

  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncErrorIds, setSyncErrorIds] = useState<Set<string>>(new Set());
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());

  const loadMonth = useCallback(async (yearMonth: string) => {
    setLoading(true);
    const list = await loadProductionRequests(yearMonth);
    setRequests(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMonth(selectedYearMonth);
  }, [selectedYearMonth, loadMonth]);

  useEffect(() => {
    loadDistinctYearMonths().then(setAvailableMonths);
  }, []);

  const monthsToShow = useMemo(() => {
    const set = new Set(availableMonths);
    set.add(toYearMonth(todayStr()));
    set.add(selectedYearMonth);
    return Array.from(set).sort();
  }, [availableMonths, selectedYearMonth]);

  const monthAmount = sumAmount(requests);
  const monthNetProfit = sumNetProfit(requests);

  const runSync = useCallback(async (id: string) => {
    setSyncingIds((s) => new Set(s).add(id));
    const result = await syncProductionRequestToSheet(id);
    setSyncingIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setSyncErrorIds((s) => {
      const n = new Set(s);
      if (result.ok) n.delete(id);
      else n.add(id);
      return n;
    });
    if (result.ok) {
      setSyncedIds((s) => new Set(s).add(id));
    }
  }, []);

  const openNewModal = () => {
    setEditingId(null);
    const defaultDate =
      selectedYearMonth === toYearMonth(todayStr()) ? todayStr() : `${selectedYearMonth}-01`;
    setForm(emptyFormState(defaultDate));
    setShowModal(true);
  };

  const openEditModal = (r: ProductionRequest) => {
    setEditingId(r.id);
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
  };

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle title="프로젝트" subtitle="홈페이지·로고 제작 의뢰 진행 상황을 관리하세요." />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedYearMonth((m) => shiftYearMonth(m, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
              aria-label="이전 달"
            >
              ‹
            </button>
            <div className="flex flex-wrap gap-1.5">
              {monthsToShow.map((ym) => (
                <button
                  key={ym}
                  type="button"
                  onClick={() => setSelectedYearMonth(ym)}
                  className={clsx(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                    ym === selectedYearMonth
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  {monthTabLabel(ym, now.getFullYear())}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedYearMonth((m) => shiftYearMonth(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-neutral-400">매출</div>
              <div className="text-lg font-bold text-neutral-900">{formatAmount(monthAmount)}원</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-400">순수익</div>
              <div className="text-lg font-bold text-neutral-900">{formatAmount(monthNetProfit)}원</div>
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
            const isSynced = syncedIds.has(r.id) || r.sheetRow != null;
            const isSyncing = syncingIds.has(r.id);
            const isSyncError = syncErrorIds.has(r.id);
            return (
              <Card key={r.id} className="!p-4 md:!p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-neutral-400">{formatKoreanMonthDay(r.requestDate)}</span>
                      <span className="text-base font-bold text-neutral-900">{r.clientName}</span>
                      {r.source && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                          {r.source}
                        </span>
                      )}
                      {r.category && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600">
                          {r.category}
                        </span>
                      )}
                      {r.inquiryChannel && (
                        <span className="text-[11px] text-neutral-400">{r.inquiryChannel}</span>
                      )}
                    </div>
                    {r.note && <p className="mt-1.5 text-sm text-neutral-500">{r.note}</p>}
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-neutral-900">{formatAmount(r.amount)}원</div>
                      <div className="text-xs text-neutral-400">순수익 {formatAmount(r.netProfit)}원</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="수정"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="삭제"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-neutral-100 pt-4">
                  {PROGRESS_STEPS.map((step) => (
                    <StatusDot
                      key={step.key}
                      status={r[step.key]}
                      label={step.label}
                      onClick={() => handleToggleStatus(r, step.key)}
                    />
                  ))}
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-300" title="구글 시트 동기화 상태">
                    {isSyncing ? (
                      "동기화 중…"
                    ) : isSyncError ? (
                      <button type="button" onClick={() => runSync(r.id)} className="text-amber-500 hover:underline">
                        ⚠ 시트 반영 실패 (재시도)
                      </button>
                    ) : isSynced ? (
                      "시트 반영됨"
                    ) : (
                      ""
                    )}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <ProjectFormModal
          form={form}
          setForm={setForm}
          saving={saving}
          isEdit={editingId != null}
          onClose={closeModal}
          onSave={handleSave}
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
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  saving: boolean;
  isEdit: boolean;
  onClose: () => void;
  onSave: () => void;
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
              <select
                {...field("source")}
                className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
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
            <span className="text-xs font-medium text-neutral-500">비고</span>
            <textarea
              rows={2}
              {...field("note")}
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
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
    </div>,
    document.body
  );
}
