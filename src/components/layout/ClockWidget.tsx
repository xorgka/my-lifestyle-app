"use client";

import { useState, useEffect } from "react";
import { ClockModal } from "./ClockModal";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useDateString(): string {
  const [str, setStr] = useState("");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const w = WEEKDAY[d.getDay()];
      setStr(`${d.getMonth() + 1}.${d.getDate()} ${w}`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return str;
}

export function ClockWidget() {
  const dateStr = useDateString();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full flex-col items-start rounded-2xl px-2 py-2.5 text-left transition hover:bg-neutral-100/80 active:bg-neutral-100"
        aria-label="오늘 날짜. 클릭하면 시계·스톱워치·타이머 열기"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500 md:text-[11px] fold:hidden">
          MY LIFESTYLE
        </div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-neutral-900 md:mt-1 md:text-[1.35rem] fold:text-[15px]">
          {dateStr || "—.— ———"}
        </div>
      </button>
      {modalOpen && <ClockModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
