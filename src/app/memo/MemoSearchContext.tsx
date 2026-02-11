"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type MemoSearchContextValue = {
  searchQ: string;
  setSearchQ: (value: string) => void;
};

const MemoSearchContext = createContext<MemoSearchContextValue | null>(null);

export function MemoSearchProvider({ children }: { children: ReactNode }) {
  const [searchQ, setSearchQState] = useState("");
  const setSearchQ = useCallback((value: string) => {
    setSearchQState(value);
  }, []);
  return (
    <MemoSearchContext.Provider value={{ searchQ, setSearchQ }}>
      {children}
    </MemoSearchContext.Provider>
  );
}

export function useMemoSearch(): MemoSearchContextValue {
  const ctx = useContext(MemoSearchContext);
  if (!ctx) {
    return {
      searchQ: "",
      setSearchQ: () => {},
    };
  }
  return ctx;
}
