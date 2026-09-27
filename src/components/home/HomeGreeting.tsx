"use client";

import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";

/** 시간대별 인사말 (시 기준, 앞에서부터 처음 맞는 구간) */
function getGreeting(hour: number): { title: string; subtitle: string } {
  if (hour >= 5 && hour < 12) return { title: "좋은 아침이에요 👋", subtitle: "오늘도 원하는 하루를 만들어가세요." };
  if (hour >= 12 && hour < 14) return { title: "오전 수고했어요 💪", subtitle: "잠깐 숨 고르고 오전을 정리해 보세요." };
  if (hour >= 14 && hour < 19) return { title: "좋은 오후예요 ☀️", subtitle: "남은 하루도 차근차근 해나가요." };
  if (hour >= 19 && hour < 22) return { title: "수고했어요, 좋은 저녁이에요 🌆", subtitle: "오늘 하루를 차분히 돌아보세요." };
  return { title: "늦은 시간이네요 🌙", subtitle: "오늘을 정리하고 푹 쉬세요." };
}

export function HomeGreeting({ className }: { className?: string }) {
  const [greeting, setGreeting] = useState<{ title: string; subtitle: string } | null>(null);

  useEffect(() => {
    const update = () => setGreeting(getGreeting(new Date().getHours()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  // 서버/클라이언트 시간이 달라 생기는 hydration 불일치를 피하려고 마운트 후에 표시
  return <SectionTitle className={className} title={greeting?.title ?? " "} subtitle={greeting?.subtitle ?? " "} />;
}
