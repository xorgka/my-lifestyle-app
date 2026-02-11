import { MemoSearchProvider } from "./MemoSearchContext";

export default function MemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MemoSearchProvider>{children}</MemoSearchProvider>;
}
