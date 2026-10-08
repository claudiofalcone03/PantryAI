"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface LiveChefContextType {
  isLiveChefActive: boolean;
  openLiveChef: (systemContext?: string) => void;
  closeLiveChef: () => void;
  toggleLiveChef: (systemContext?: string) => void;
}

const LiveChefContext = createContext<LiveChefContextType | undefined>(undefined);

export function LiveChefProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openLiveChef = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeLiveChef = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleLiveChef = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isLiveChefActive: isOpen,
      openLiveChef,
      closeLiveChef,
      toggleLiveChef,
    }),
    [isOpen, openLiveChef, closeLiveChef, toggleLiveChef]
  );

  return (
    <LiveChefContext.Provider value={value}>
      {children}
    </LiveChefContext.Provider>
  );
}

export function useLiveChef(): LiveChefContextType {
  const context = useContext(LiveChefContext);
  if (!context) {
    throw new Error("useLiveChef must be used within a LiveChefProvider");
  }
  return context;
}
