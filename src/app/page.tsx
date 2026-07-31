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
          className="absolute right-0 top-2 inline-flex shrink-0 items-center gap-2 rounded-2xl bg-neutral-900 px-5 py-2.5 text-base font-medium text-white transition hover:bg-neutral-700 sm:top-4 md:top-6"
        >
          <svg
            className="h-4 w-4 shrink-0"
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
