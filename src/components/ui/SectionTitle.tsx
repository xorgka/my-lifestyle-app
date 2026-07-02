import { clsx } from "clsx";
import { SiblingTitle, type SiblingLink } from "./SiblingTitle";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
  /** 있으면 title 대신 형제 페이지 링크들을 이어붙여 렌더링 (예: 메모 · 노트 · 일기장) */
  siblings?: SiblingLink[];
}

export function SectionTitle({ title, subtitle, className, siblings }: SectionTitleProps) {
  return (
    <header className={clsx("mb-6 pt-2 pl-2 sm:mb-8 sm:pt-4 sm:pl-4 md:mb-10 md:pt-6 md:pl-6", className)}>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-5xl">
        {siblings ? <SiblingTitle items={siblings} /> : title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-xs text-neutral-500 sm:mt-3 sm:text-sm md:text-lg">
          {subtitle}
        </p>
      )}
    </header>
  );
}

