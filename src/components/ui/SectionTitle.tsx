import { clsx } from "clsx";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionTitle({ title, subtitle, className }: SectionTitleProps) {
  return (
    <header className={clsx("mb-6 pt-2 pl-2 sm:mb-8 sm:pt-4 sm:pl-4 md:mb-10 md:pt-6 md:pl-6", className)}>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-5xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-xs text-neutral-500 sm:mt-3 sm:text-sm md:text-lg">
          {subtitle}
        </p>
      )}
    </header>
  );
}

