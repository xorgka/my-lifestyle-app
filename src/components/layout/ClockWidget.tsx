"use client";

import { useState, useEffect } from "react";
import { ClockModal } from "./ClockModal";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function useTimeString(): string {
  const [str, setStr] = useState("");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const w = WEEKDAY[d.getDay()];
      setStr(`${h}:${m} (${w})`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return str;
}

export function ClockWidget() {
  const timeStr = useTimeString();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full flex-col items-start rounded-2xl px-2 py-2.5 text-left transition hover:bg-neutral-100/80 active:bg-neutral-100"
        aria-label="현재 시각. 클릭하면 스톱워치·타이머 열기"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500 md:text-[11px]">
          MY LIFESTYLE
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-neutral-900 md:mt-1 md:text-[1.15rem]">
          {timeStr || "—:— (—)"}
        </div>
      </button>
      {modalOpen && <ClockModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
