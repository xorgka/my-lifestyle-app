"use client";

import { useState } from "react";
import { type ParentGroup, parentOfGroup } from "@/lib/budget";

/** 내역 한 줄의 원래 기록: 일반 내역, 또는 카드출금 같은 내역의 세부 한 줄. 계산으로 생긴 줄(미분류 등)은 없음 */
export type EntryRef = { kind: "entry"; id: string } | { kind: "detail"; id: string; parentId: string };
export type DetailEntry = { date: string; amount: number; item: string; ref?: EntryRef };
/** 더블클릭 수정: 저장(이름·금액)과 삭제 */
export type EntryEditHandlers = {
  onSave: (ref: EntryRef, next: { item: string; amount: number }) => void;
  onDelete: (ref: EntryRef) => void;
};
export type DetailGroup = { total: number; entries: DetailEntry[] };
/** 큰 묶음(식비)이면 children에 원래 묶음(배달·편의점 …)이 금액 큰 순으로 들어간다 */
export type DetailNode = DetailGroup & { name: string; children?: (DetailGroup & { name: string })[] };

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 짧은 날짜: "2/2(목)" */
function formatDateLabelShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${week})`;
}

/** 묶음 목록을 큰 묶음 아래로 모은다. 큰 묶음에 안 들어가는 묶음은 그대로 둔다 */
export function nestByParentGroup(grouped: Record<string, DetailGroup>, parentGroups: ParentGroup[]): DetailNode[] {
  const parents = new Map<string, DetailNode>();
  const nodes: DetailNode[] = [];
  for (const [name, group] of Object.entries(grouped)) {
    const parentName = parentOfGroup(name, parentGroups);
    if (!parentName) {
      nodes.push({ name, ...group });
      continue;
    }
    let parent = parents.get(parentName);
    if (!parent) {
      parent = { name: parentName, total: 0, entries: [], children: [] };
      parents.set(parentName, parent);
      nodes.push(parent);
    }
    parent.total += group.total;
    parent.entries.push(...group.entries);
    parent.children!.push({ name, ...group });
  }
  parents.forEach((p) => {
    p.entries.sort((a, b) => a.date.localeCompare(b.date));
    p.children!.sort((a, b) => b.total - a.total);
  });
  return nodes;
}

const toggleArrow = (open: boolean) => (
  <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
    ▼
  </span>
);

/** 날짜별 내역 줄. edit가 있으면 실제 기록인 줄을 더블클릭해 그 자리에서 이름·금액을 고치거나 지운다 */
function EntryRows({
  entries,
  order,
  rowClass,
  edit,
}: {
  entries: DetailEntry[];
  order: "asc" | "desc";
  rowClass: string;
  edit?: EntryEditHandlers;
}) {
  const sorted = order === "desc" ? entries.slice().sort((a, b) => b.date.localeCompare(a.date)) : entries;
  /** 고치는 중인 줄 (원래 기록 id)과 입력값 */
  const [editing, setEditing] = useState<{ id: string; item: string; amount: string } | null>(null);
  const save = (ref: EntryRef) => {
    if (!editing || !edit) return;
    const item = editing.item.trim();
    const amount = Number(editing.amount.replace(/,/g, ""));
    if (!item || !Number.isFinite(amount) || amount <= 0) return;
    setEditing(null);
    edit.onSave(ref, { item, amount });
  };
  return (
    <>
      {sorted.map(({ date, amount, item, ref }, i) => {
        const key = ref ? `${ref.kind}-${ref.id}` : `${date}-${item}-${i}`;
        if (ref && edit && editing?.id === ref.id)
          return (
            <li key={key} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 ${rowClass}`}>
              <span className="text-neutral-500">{formatDateLabelShort(date)}</span>
              <input
                type="text"
                value={editing.item}
                onChange={(e) => setEditing({ ...editing, item: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(ref);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="min-w-[8rem] flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900"
                aria-label="항목 이름"
                autoFocus
              />
              <input
                type="number"
                min={1}
                value={editing.amount}
                onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(ref);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="w-28 rounded border border-neutral-300 bg-white px-2 py-1 text-right text-neutral-900"
                aria-label="금액"
              />
              <span className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => save(ref)} className="rounded bg-neutral-800 px-2.5 py-1 text-xs font-medium text-white">
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    edit.onDelete(ref);
                  }}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </span>
            </li>
          );
        const editable = !!(ref && edit);
        return (
          <li
            key={key}
            onDoubleClick={editable ? () => setEditing({ id: ref!.id, item, amount: String(amount) }) : undefined}
            title={editable ? "더블클릭해서 수정" : undefined}
            className={`flex justify-between gap-2 rounded-lg px-3 py-1.5 ${rowClass} ${editable ? "cursor-pointer select-none" : ""}`}
          >
            <span className="min-w-0">
              <span className="mr-3 text-neutral-500">{formatDateLabelShort(date)}</span>
              <span>{item}</span>
            </span>
            <span className="shrink-0 font-medium">{formatNum(amount)}원</span>
          </li>
        );
      })}
    </>
  );
}

/**
 * 큰 묶음을 펼쳤을 때 나오는 묶음 줄들 (식비 → 배달·편의점 …). 묶음을 누르면 날짜별 내역이 나온다.
 * 펼침 상태 키는 "큰묶음>묶음".
 */
export function ChildGroupRows({
  parentKey,
  groups,
  expanded,
  onToggle,
  order = "asc",
  edit,
}: {
  parentKey: string;
  groups: (DetailGroup & { name: string })[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  order?: "asc" | "desc";
  edit?: EntryEditHandlers;
}) {
  return (
    <div className="space-y-1.5">
      {groups.map((child) => {
        const key = `${parentKey}>${child.name}`;
        const isOpen = expanded.has(key);
        return (
          <div key={key} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => onToggle(key)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
            >
              <span className="min-w-0 truncate font-medium text-neutral-800">
                {child.name} ({child.entries.length})
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-neutral-900">{formatNum(child.total)}원</span>
                {toggleArrow(isOpen)}
              </span>
            </button>
            {isOpen && (
              <ul className="space-y-1.5 border-t border-neutral-200 px-2 pb-2 pt-2 text-neutral-600">
                <EntryRows entries={child.entries} order={order} rowClass="bg-neutral-50" edit={edit} />
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 카테고리 상세 모달의 항목 목록. 묶음을 누르면 날짜별 내역이,
 * 큰 묶음(식비)을 누르면 그 안의 묶음(배달·편의점 …)이 먼저 나온다.
 */
export function GroupedDetailList({
  grouped,
  parentGroups,
  expanded,
  onToggle,
  edit,
}: {
  grouped: Record<string, DetailGroup>;
  parentGroups: ParentGroup[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  /** 있으면 날짜별 내역을 더블클릭해 고칠 수 있다 */
  edit?: EntryEditHandlers;
}) {
  const nodes = nestByParentGroup(grouped, parentGroups).sort((a, b) => b.total - a.total);
  if (nodes.length === 0) return <p className="text-sm text-neutral-400">해당 카테고리 내역이 없어요.</p>;
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expanded.has(node.name);
        return (
          <div key={node.name} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/50">
            <button
              type="button"
              onClick={() => onToggle(node.name)}
              className="flex w-full items-center justify-between p-4 text-left text-[13px] transition-colors hover:bg-neutral-100/80 md:text-base"
            >
              <span className="font-semibold text-neutral-900">
                {node.name} ({node.entries.length})
              </span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900 md:text-lg">{formatNum(node.total)}원</span>
                {toggleArrow(isExpanded)}
              </span>
            </button>
            {isExpanded &&
              (node.children ? (
                <div className="border-t border-neutral-200 px-4 pb-4 pt-2 text-[13px] md:text-sm">
                  <ChildGroupRows parentKey={node.name} groups={node.children} expanded={expanded} onToggle={onToggle} edit={edit} />
                </div>
              ) : (
                <ul className="space-y-1.5 border-t border-neutral-200 px-4 pb-4 pl-0 pt-2 text-[13px] text-neutral-600 md:text-sm">
                  <EntryRows entries={node.entries} order="asc" rowClass="bg-white" edit={edit} />
                </ul>
              ))}
          </div>
        );
      })}
    </>
  );
}
