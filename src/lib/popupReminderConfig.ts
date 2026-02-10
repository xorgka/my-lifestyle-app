/**
 * 팝업 알림 설정: 문장, 체크 항목(장점), 배경/글자색, 사용 여부.
 * Supabase 연결 시 기기/브라우저 동기화, 없으면 localStorage만 사용.
 */

import type { ReminderPopupId } from "./reminderPopupChannel";
import { supabase } from "./supabase";

const STORAGE_KEY = "popup-reminder-config";
const CUSTOM_IDS_KEY = "popup-reminder-custom-ids";
const SUPABASE_ROW_ID = "default";

export type PopupBenefitItem = { text: string; bold: string[] };

export type PopupConfig = {
  title: string;
  benefitsSubtitle?: string;
  benefits: PopupBenefitItem[];
  /** 모달 카드 배경색 (CSS) */
  cardBgColor?: string;
  /** 본문 글자색 (CSS) */
  textColor?: string;
  /** 강조색 (✓, 버튼 호버 등). CSS */
  accentColor?: string;
  enabled: boolean;
  /** 커스텀 팝업만: 루틴 제목에 포함될 문자열 */
  routineTitle?: string;
  /** 커스텀 팝업만: 노출 시작 시(0~23) */
  timeStart?: number;
  /** 커스텀 팝업만: 노출 끝 시(0~23, 자정 넘기면 다음날까지) */
  timeEnd?: number;
};

const DEFAULT_CONFIGS: Record<ReminderPopupId, PopupConfig> = {
  shower: {
    title: "기상 후 샤워 하셨나요?",
    benefitsSubtitle: "지금 샤워를 하면,",
    benefits: [
      { text: "뇌가 깨어나 인지기능 상승!", bold: ["인지기능"] },
      { text: "창의적 사고 촉진", bold: ["창의적 사고"] },
      { text: "문제 해결능력 UP", bold: ["문제 해결능력"] },
      { text: "자는동안 쌓인 피지, 땀, 먼지 제거", bold: ["피지, 땀, 먼지"] },
      { text: "혈액순환 촉진으로 붓기 완화", bold: ["혈액순환", "붓기"] },
      { text: "하루 시작을 알리는 신호!", bold: ["하루 시작"] },
    ],
    enabled: true,
  },
  morning_face: {
    title: "아침 세안 하셨나요?",
    benefitsSubtitle: "아침 세안도 안하시게요?",
    benefits: [
      { text: "양치질 + 세안(스킨/로션)", bold: ["양치질", "세안", "스킨", "로션"] },
      { text: "잠이 확 깰 거예요!", bold: ["잠이 확 깰"] },
      { text: "자는동안 쌓인 구강 세균 제거", bold: ["구강 세균"] },
      { text: "피부 보습 윤기 좔좔!", bold: ["피부", "보습", "윤기"] },
    ],
    enabled: true,
  },
  evening_face: {
    title: "저녁 세안 하셨나요?",
    benefitsSubtitle: "저녁 세안도 안하시게요?",
    benefits: [
      { text: "양치질 + 세안(스킨/로션)", bold: ["양치질", "세안", "스킨", "로션"] },
      { text: "잠이 잘 올거예요!", bold: ["잠이 잘 올거예요!"] },
      { text: "하루동안 쌓인 먼지 털기", bold: ["먼지 털기"] },
      { text: "입 속 찌꺼기 말끔 제거", bold: ["찌꺼기", "말끔 제거"] },
    ],
    enabled: true,
  },
  gym: {
    title: "오늘 헬스장 가셨나요?",
    benefitsSubtitle: "헬스장에 가면,",
    benefits: [
      { text: "뱃살이 조금 들어간다", bold: ["뱃살"] },
      { text: "어깨가 조금 넓어진다", bold: ["어깨"] },
      { text: "밤에 꿀잠 잘 확률 UP", bold: ["꿀잠"] },
      { text: "평생 건강한 습관 만드는 ing", bold: ["평생", "습관"] },
      { text: "우울감 사라지고, 능률 UP", bold: ["우울감", "능률"] },
      { text: "후회 없고, 보람 찬 하루 추가!", bold: ["후회", "보람"] },
    ],
    enabled: true,
  },
  youtube: {
    title: "오늘 유튜브 업로드 하셨나요?",
    benefitsSubtitle: "미루지말고 하나라도 더 올리세요!",
    benefits: [
      { text: "삽질하는게 겁난다? 그냥 해야한다!", bold: ["그냥 해야한다!"] },
      { text: "쇼츠는 물량을 퍼부어야 한다.", bold: ["물량"] },
      { text: "사실 소재가 전부다!", bold: ["소재"] },
      { text: "텍홀님은 매일 8개 올렸다", bold: ["매일 8개"] },
      { text: "월억남님은 술 먹고 와서도 했다.", bold: ["술 먹고"] },
      { text: "홈피 할래? 유튜브 할래?", bold: ["유튜브"] },
    ],
    enabled: true,
  },
  wake: {
    title: "오늘 몇 시에 깼나요?",
    benefits: [],
    enabled: true,
  },
};

export const SYSTEM_POPUP_IDS: ReminderPopupId[] = [
  "shower",
  "morning_face",
  "evening_face",
  "gym",
  "youtube",
  "wake",
];

export const SYSTEM_POPUP_LABELS: Record<ReminderPopupId, string> = {
  shower: "기상 후 샤워",
  morning_face: "아침 세안",
  evening_face: "저녁 세안",
  gym: "헬스장",
  youtube: "유튜브 업로드",
  wake: "기상 시간",
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Supabase에서 최신 설정을 가져와 localStorage에 씀. 앱 로드 시 한 번 호출하면 기기 간 동기화됨 */
export async function syncPopupConfigFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: row, error } = await supabase
      .from("popup_reminder_config")
      .select("overrides, custom_ids")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle();
    if (error || !row) return;
    const overrides = row.overrides as Record<string, Partial<PopupConfig>>;
    const customIds = Array.isArray(row.custom_ids) ? (row.custom_ids as string[]) : [];
    if (overrides && typeof overrides === "object") saveJson(STORAGE_KEY, overrides);
    if (Array.isArray(customIds)) saveJson(CUSTOM_IDS_KEY, customIds);
  } catch {
    // ignore
  }
}

/** 현재 localStorage 값을 Supabase에 저장 (저장 시 호출) */
async function savePopupConfigToSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const overrides = loadJson<Record<string, Partial<PopupConfig>>>(STORAGE_KEY, {});
    const customIds = loadJson<string[]>(CUSTOM_IDS_KEY, []);
    await supabase
      .from("popup_reminder_config")
      .upsert(
        { id: SUPABASE_ROW_ID, overrides, custom_ids: customIds, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
  } catch {
    // ignore
  }
}

/** 저장된 오버라이드만 반환 (키 = 팝업 id). Supabase 연동 시 syncPopupConfigFromSupabase() 후 사용 */
export function loadPopupConfigOverrides(): Record<string, Partial<PopupConfig>> {
  const raw = loadJson<Record<string, Partial<PopupConfig>>>(STORAGE_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

export function savePopupConfigOverrides(overrides: Record<string, Partial<PopupConfig>>): void {
  saveJson(STORAGE_KEY, overrides);
  savePopupConfigToSupabase();
}

/** 커스텀 팝업 id 목록 */
export function loadCustomPopupIds(): string[] {
  const raw = loadJson<string[]>(CUSTOM_IDS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function saveCustomPopupIds(ids: string[]): void {
  saveJson(CUSTOM_IDS_KEY, ids);
  savePopupConfigToSupabase();
}

/** id에 해당하는 최종 설정 (기본값 + 오버라이드). 시스템 id 또는 커스텀 id. */
export function getPopupConfig(id: string): PopupConfig | null {
  const overrides = loadPopupConfigOverrides();
  const customIds = loadCustomPopupIds();
  const isSystem = SYSTEM_POPUP_IDS.includes(id as ReminderPopupId);
  const defaultConfig = isSystem ? DEFAULT_CONFIGS[id as ReminderPopupId] : null;
  if (!defaultConfig && !customIds.includes(id)) return null;
  const base = defaultConfig ?? {
    title: "",
    benefits: [],
    enabled: true,
    routineTitle: "",
    timeStart: 22,
    timeEnd: 3,
  };
  const ov = overrides[id];
  if (!ov) return base as PopupConfig;
  return {
    ...base,
    ...ov,
    benefits: ov.benefits ?? base.benefits,
  } as PopupConfig;
}

/** 시스템 + 커스텀 포함 전체 팝업 id 목록 (설정 UI 순서) */
export function getAllPopupIds(): string[] {
  return [...SYSTEM_POPUP_IDS, ...loadCustomPopupIds()];
}

export function generateCustomPopupId(): string {
  return "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** id에 대한 설정 저장 (오버라이드 병합). 시스템/커스텀 공통. */
export function savePopupConfig(id: string, config: Partial<PopupConfig>): void {
  const overrides = loadPopupConfigOverrides();
  const prev = overrides[id] ?? {};
  overrides[id] = { ...prev, ...config };
  savePopupConfigOverrides(overrides);
}

/** 커스텀 팝업 추가: id 생성 후 목록에 추가하고 config 저장 */
export function addCustomPopup(config: Omit<PopupConfig, "enabled"> & { enabled?: boolean }): string {
  const id = generateCustomPopupId();
  const ids = loadCustomPopupIds();
  ids.push(id);
  saveCustomPopupIds(ids);
  savePopupConfig(id, { ...config, enabled: config.enabled ?? true });
  return id;
}

/** 커스텀 팝업 삭제: 목록에서 제거 + 해당 id 오버라이드 제거 */
export function removeCustomPopup(id: string): void {
  const ids = loadCustomPopupIds().filter((x) => x !== id);
  saveCustomPopupIds(ids);
  const overrides = loadPopupConfigOverrides();
  delete overrides[id];
  savePopupConfigOverrides(overrides);
}
