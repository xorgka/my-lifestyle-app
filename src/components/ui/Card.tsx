import { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export function Card({ children, className, onClick, onMouseDown }: CardProps) {
  return (
    <section
      className={clsx(
        "rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-soft-border transition-all duration-200 md:rounded-3xl md:p-9 hover:-translate-y-[2px] hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]",
        className
      )}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {children}
    </section>
  );
}

