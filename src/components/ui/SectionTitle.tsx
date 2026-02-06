import { clsx } from "clsx";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionTitle({ title, subtitle, className }: SectionTitleProps) {
  return (
    <header className={clsx("mb-8 pt-4 pl-4 md:mb-10 md:pt-6 md:pl-6", className)}>
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 text-sm text-neutral-500 md:text-lg">
          {subtitle}
        </p>
      )}
    </header>
  );
}

