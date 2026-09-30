"use client";

import { useEffect, useState } from "react";
import { HomeLayout } from "@/components/home/HomeLayout";
import { HomeVideoCard } from "@/components/home/HomeVideoCard";
import {
  getHomeTemplate,
  HOME_TEMPLATE_CHANGED_EVENT,
  type HomeTemplateId,
} from "@/lib/homeTemplate";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";

/** 설정(localStorage)에 저장된 홈 템플릿. 설정 변경 시·다른 기기에서 바꾼 값이 동기화될 때 즉시 갱신 */
function useHomeTemplateId(): HomeTemplateId {
  const [templateId, setTemplateId] = useState<HomeTemplateId>("basic");

  useEffect(() => {
    const sync = () => setTemplateId(getHomeTemplate());
    sync();
    window.addEventListener(HOME_TEMPLATE_CHANGED_EVENT, sync);
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HOME_TEMPLATE_CHANGED_EVENT, sync);
      window.removeEventListener(USER_SETTINGS_SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return templateId;
}

/** 저장된 홈 템플릿을 HomeLayout에 반영 */
export function HomeTemplateLayout() {
  const templateId = useHomeTemplateId();

  return (
    <HomeLayout
      template={
        templateId === "video"
          ? "video"
          : templateId === "calendar"
            ? "calendar"
            : templateId === "timeline"
              ? "timeline"
              : "B"
      }
    />
  );
}

/** 달력·타임라인 템플릿: 인사말 오른쪽 구석의 동그란 영상 버튼 (누르면 크게 재생) */
export function HomeCornerVideo() {
  const templateId = useHomeTemplateId();
  if (templateId !== "calendar" && templateId !== "timeline") return null;
  return <HomeVideoCard compact circle className="mt-2 h-14 w-14 shrink-0 sm:mt-4 md:mt-6 md:h-20 md:w-20" />;
}
