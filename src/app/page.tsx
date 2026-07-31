import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeTemplateLayout } from "@/components/home/HomeTemplateLayout";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
      <div className="relative min-w-0">
        <SectionTitle
          className="min-w-0 pr-[8.5rem] sm:pr-36"
          title="오늘을 정리하기"
          subtitle="일상의 모든 조각을 한 곳에."
        />
        <a
          href="https://waglelab.com/admin"
          className="absolute right-0 top-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 bg-white/40 px-3 py-1.5 text-sm font-medium text-neutral-700/50 backdrop-blur-sm transition hover:border-neutral-400 hover:bg-white/80 hover:text-neutral-900 sm:top-4 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base md:top-6"
        >
          <svg
            className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          와글랩
        </a>
      </div>

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <HomeTemplateLayout />
      </div>
    </div>
  );
}
