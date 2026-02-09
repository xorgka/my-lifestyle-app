/**
 * 알림 팝업이 동시에 여러 개 뜨지 않도록, 하나가 열릴 때 나머지는 닫음.
 * z-index도 통일해서 배경이 이중으로 겹쳐 더 어둡게 보이는 현상 방지.
 */

export const REMINDER_POPUP_Z_INDEX = 9999;
/** 알림 팝업 배경 어둡기 (0~1, 높을수록 어두움) */
export const REMINDER_BACKDROP_OPACITY = 0.88;
export const REMINDER_OPEN_EVENT = "reminderPopupOpen";

export type ReminderPopupId = "shower" | "morning_face" | "gym" | "youtube" | "wake";

export function dispatchReminderOpen(id: ReminderPopupId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REMINDER_OPEN_EVENT, { detail: { id } }));
}

export function subscribeReminderOpen(
  myId: ReminderPopupId,
  onOthersOpen: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ id: ReminderPopupId }>).detail;
    if (detail?.id !== myId) onOthersOpen();
  };
  window.addEventListener(REMINDER_OPEN_EVENT, handler);
  return () => window.removeEventListener(REMINDER_OPEN_EVENT, handler);
}
