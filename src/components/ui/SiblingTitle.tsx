import Link from "next/link";

export type SiblingLink = { label: string; href: string; active: boolean };

/** 제목 자리에 형제 페이지 링크를 이어붙여 렌더링. 현재 페이지는 진하게, 나머지는 연하게(클릭하면 이동). */
export function SiblingTitle({ items }: { items: SiblingLink[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item.href}>
          {i > 0 && (
            <span className="mx-1 text-neutral-300" aria-hidden>
              ·
            </span>
          )}
          {item.active ? (
            item.label
          ) : (
            <Link href={item.href} className="text-neutral-300 transition hover:text-neutral-500">
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </>
  );
}
