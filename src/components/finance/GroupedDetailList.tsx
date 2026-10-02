"use client";

import { type ParentGroup, parentOfGroup } from "@/lib/budget";

export type DetailEntry = { date: string; amount: number; item: string };
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

function EntryRows({ entries, order, rowClass }: { entries: DetailEntry[]; order: "asc" | "desc"; rowClass: string }) {
  const sorted = order === "desc" ? entries.slice().sort((a, b) => b.date.localeCompare(a.date)) : entries;
  return (
    <>
      {sorted.map(({ date, amount, item }, i) => (
        <li key={`${date}-${item}-${i}`} className={`flex justify-between gap-2 rounded-lg px-3 py-1.5 ${rowClass}`}>
          <span className="min-w-0">
            <span className="mr-3 text-neutral-500">{formatDateLabelShort(date)}</span>
            <span>{item}</span>
          </span>
          <span className="shrink-0 font-medium">{formatNum(amount)}원</span>
        </li>
      ))}
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
}: {
  parentKey: string;
  groups: (DetailGroup & { name: string })[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  order?: "asc" | "desc";
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
                <EntryRows entries={child.entries} order={order} rowClass="bg-neutral-50" />
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
}: {
  grouped: Record<string, DetailGroup>;
  parentGroups: ParentGroup[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
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
                  <ChildGroupRows parentKey={node.name} groups={node.children} expanded={expanded} onToggle={onToggle} />
                </div>
              ) : (
                <ul className="space-y-1.5 border-t border-neutral-200 px-4 pb-4 pl-0 pt-2 text-[13px] text-neutral-600 md:text-sm">
                  <EntryRows entries={node.entries} order="asc" rowClass="bg-white" />
                </ul>
              ))}
          </div>
        );
      })}
    </>
  );
}
