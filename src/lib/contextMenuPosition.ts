/** 우클릭 메뉴: 앵커(버튼) 바로 아래 + 화면 밖으로 나가지 않게 */
export function anchorContextMenuPosition(
  anchorRect: DOMRect,
  estimatedSize: { width: number; height: number }
): { x: number; y: number } {
  const pad = 8;
  let x = anchorRect.left;
  let y = anchorRect.bottom + 4;
  if (typeof window === "undefined") return { x, y };
  x = Math.min(Math.max(pad, x), window.innerWidth - estimatedSize.width - pad);
  y = Math.min(Math.max(pad, y), window.innerHeight - estimatedSize.height - pad);
  return { x, y };
}
