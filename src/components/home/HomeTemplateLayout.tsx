"use client";

import { useEffect, useState } from "react";
import { HomeLayout } from "@/components/home/HomeLayout";
import {
  getHomeTemplate,
  HOME_TEMPLATE_CHANGED_EVENT,
  type HomeTemplateId,
} from "@/lib/homeTemplate";

/** 설정(localStorage)에 저장된 홈 템플릿을 읽어 HomeLayout에 반영. 설정 변경 시 즉시 갱신 */
export function HomeTemplateLayout() {
  const [templateId, setTemplateId] = useState<HomeTemplateId>("basic");

  useEffect(() => {
    const sync = () => setTemplateId(getHomeTemplate());
    sync();
    window.addEventListener(HOME_TEMPLATE_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HOME_TEMPLATE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return <HomeLayout template={templateId === "video" ? "video" : "B"} />;
}
