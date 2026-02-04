import { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={clsx(
        "rounded-3xl bg-white/90 p-8 shadow-sm ring-1 ring-soft-border transition-all duration-200 md:p-9 hover:-translate-y-[2px] hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {children}
    </section>
  );
}

