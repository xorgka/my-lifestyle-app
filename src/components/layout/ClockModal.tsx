"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function formatStopwatch(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const tenth = Math.floor((ms % 1000) / 100);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenth}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenth}`;
}

function formatTimer(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface ClockModalProps {
  onClose: () => void;
}

export function ClockModal({ onClose }: ClockModalProps) {
  const [tab, setTab] = useState<"stopwatch" | "timer">("stopwatch");

  // Stopwatch
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  useEffect(() => {
    if (!stopwatchRunning) return;
    const startAt = Date.now() - stopwatchMs;
    const id = window.setInterval(() => {
      setStopwatchMs(Date.now() - startAt);
    }, 100);
    return () => clearInterval(id);
  }, [stopwatchRunning]); // eslint-disable-line react-hooks/exhaustive-deps -- startAt uses stopwatchMs at toggle time only

  const stopwatchStartPause = useCallback(() => {
    setStopwatchRunning((r) => !r);
  }, []);
  const stopwatchReset = useCallback(() => {
    setStopwatchRunning(false);
    setStopwatchMs(0);
  }, []);

  // Timer
  const [timerInputMin, setTimerInputMin] = useState(5);
  const [timerInputSec, setTimerInputSec] = useState(0);
  const [timerRemainMs, setTimerRemainMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEndRef = useRef<number>(0);

  useEffect(() => {
    if (!timerRunning || timerRemainMs <= 0) return;
    const id = window.setInterval(() => {
      const remain = timerEndRef.current - Date.now();
      if (remain <= 0) {
        setTimerRemainMs(0);
        setTimerRunning(false);
        try {
          const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.connect(gain);
          gain.connect(ac.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.2;
          osc.start();
          osc.stop(ac.currentTime + 0.3);
        } catch {
          // ignore
        }
        return;
      }
      setTimerRemainMs(remain);
    }, 100);
    return () => clearInterval(id);
  }, [timerRunning, timerRemainMs]);

  const timerStart = useCallback(() => {
    const totalMs = timerRemainMs > 0 ? timerRemainMs : (timerInputMin * 60 + timerInputSec) * 1000;
    if (totalMs <= 0) return;
    setTimerRemainMs(totalMs);
    timerEndRef.current = Date.now() + totalMs;
    setTimerRunning(true);
  }, [timerInputMin, timerInputSec, timerRemainMs]);
  const timerPause = useCallback(() => setTimerRunning(false), []);
  const timerReset = useCallback(() => {
    setTimerRunning(false);
    setTimerRemainMs(0);
  }, []);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const weekdayStr = WEEKDAY[now.getDay()];

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="시계 · 스톱워치 · 타이머"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">시계 · 스톱워치 · 타이머</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setTab("stopwatch")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === "stopwatch" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            스톱워치
          </button>
          <button
            type="button"
            onClick={() => setTab("timer")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === "timer" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            타이머
          </button>
        </div>

        {tab === "stopwatch" && (
          <div className="mt-6">
            <div className="text-center text-3xl font-bold tabular-nums text-neutral-900">
              {formatStopwatch(stopwatchMs)}
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={stopwatchStartPause}
                className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                {stopwatchRunning ? "일시정지" : "시작"}
              </button>
              <button
                type="button"
                onClick={stopwatchReset}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                초기화
              </button>
            </div>
          </div>
        )}

        {tab === "timer" && (
          <div className="mt-6">
            {!timerRunning && timerRemainMs === 0 && (
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={timerInputMin}
                  onChange={(e) => setTimerInputMin(Number(e.target.value) || 0)}
                  className="w-16 rounded-lg border border-neutral-200 px-2 py-2 text-center text-lg font-semibold tabular-nums"
                />
                <span className="text-neutral-500">분</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={timerInputSec}
                  onChange={(e) => setTimerInputSec(Number(e.target.value) || 0)}
                  className="w-16 rounded-lg border border-neutral-200 px-2 py-2 text-center text-lg font-semibold tabular-nums"
                />
                <span className="text-neutral-500">초</span>
              </div>
            )}
            {(timerRunning || timerRemainMs > 0) && (
              <div className="text-center text-3xl font-bold tabular-nums text-neutral-900">
                {formatTimer(timerRemainMs)}
              </div>
            )}
            <div className="mt-4 flex justify-center gap-2">
              {timerRunning ? (
                <button
                  type="button"
                  onClick={timerPause}
                  className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  일시정지
                </button>
              ) : (
                <button
                  type="button"
                  onClick={timerStart}
                  className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  {timerRemainMs > 0 ? "재개" : "시작"}
                </button>
              )}
              <button
                type="button"
                onClick={timerReset}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                초기화
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 border-t border-neutral-100 pt-4 text-center text-sm text-neutral-500">
          현재 시각 {timeStr} ({weekdayStr})
        </p>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
