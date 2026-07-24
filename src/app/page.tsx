import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeLayout } from "@/components/home/HomeLayout";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <SectionTitle
          title="오늘을 정리하기"
          subtitle="일상의 모든 조각을 한 곳에."
        />
        <a
          href="https://waglelab.com/admin"
          className="mt-2 shrink-0 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 sm:mt-4"
        >
          와글랩
        </a>
      </div>

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <HomeLayout template="B" />
      </div>
    </div>
  );
}
