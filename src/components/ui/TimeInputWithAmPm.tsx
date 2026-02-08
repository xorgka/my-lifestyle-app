"use client";

/** "HH:mm" 24h 기준에서 오전/오후 토글 (12시간 ±) */
export function toggleAmPm(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const hour = h ?? 0;
  const min = m ?? 0;
  const newHour = hour >= 12 ? hour - 12 : hour + 12;
  return `${String(newHour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "HH:mm" 24h -> 오전/오후 표시 */
export function getAmPmLabel(timeStr: string): "오전" | "오후" {
  const h = Number(timeStr.split(":")[0]) ?? 0;
  return h < 12 ? "오전" : "오후";
}

interface TimeInputWithAmPmProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
  inputClassName?: string;
}

export function TimeInputWithAmPm({
  value,
  onChange,
  onSubmit,
  className = "",
  inputClassName = "",
}: TimeInputWithAmPmProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={`flex items-center overflow-hidden rounded-xl border-2 border-neutral-200 ${className}`}>
      <span
        role="button"
        tabIndex={0}
        onClick={() => onChange(toggleAmPm(value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(toggleAmPm(value));
          }
        }}
        className="cursor-pointer select-none border-r-2 border-neutral-200 px-3 py-2 text-lg font-semibold text-neutral-700 hover:text-neutral-900"
      >
        {getAmPmLabel(value)}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-xl font-semibold tabular-nums text-neutral-900 focus:ring-0 [&::-webkit-datetime-edit-ampm-field]:hidden [&::-webkit-datetime-edit-ampm-field]:p-0 [&::-webkit-datetime-edit-ampm-field]:w-0 ${inputClassName}`}
        aria-label="시간 선택"
      />
    </div>
  );
}
