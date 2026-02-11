import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold text-neutral-800">페이지를 찾을 수 없어요</h2>
      <p className="text-sm text-neutral-500">요청한 주소가 없거나 변경되었을 수 있어요.</p>
      <Link
        href="/"
        className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        홈으로
      </Link>
    </div>
  );
}
