"use client";

import { useEffect, useState } from "react";
import { WeatherCard } from "./WeatherCard";

/** 저장 후 홈 진입 시 날씨 배경을 다시 읽기 위해 key 사용 */
export function WeatherCardWrapper() {
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    const v = (typeof window !== "undefined" && (window as unknown as { __WEATHER_BG_SAVED?: number }).__WEATHER_BG_SAVED) ?? 0;
    if (v) setMountKey(v);
  }, []);

  return <WeatherCard key={mountKey} />;
}
