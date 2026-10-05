"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SIDEBAR_MENU_CHANGED_EVENT, getHiddenSubMenus } from "@/lib/sidebarMenu";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";

export type SiblingLink = { label: string; href: string; active: boolean };

/**
 * 제목 자리에 형제 페이지 링크를 이어붙여 렌더링. 현재 페이지는 진하게, 나머지는 연하게(클릭하면 이동).
 * 설정에서 끈 하위 메뉴는 빠진다. 지금 보고 있는 페이지는 꺼져 있어도 제목으로 남긴다.
 */
export function SiblingTitle({ items }: { items: SiblingLink[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setHidden(getHiddenSubMenus());
    sync();
    window.addEventListener(SIDEBAR_MENU_CHANGED_EVENT, sync);
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    return () => {
      window.removeEventListener(SIDEBAR_MENU_CHANGED_EVENT, sync);
      window.removeEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    };
  }, []);
  const shown = items.filter((item) => item.active || !hidden.includes(item.href));
  return (
    <>
      {shown.map((item, i) => (
        <span key={item.href}>
          {i > 0 && (
            <span className="mx-1 font-normal text-neutral-300" aria-hidden>
              ·
            </span>
          )}
          {item.active ? (
            item.label
          ) : (
            <Link href={item.href} className="font-normal text-neutral-300 transition hover:text-neutral-500">
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </>
  );
}
