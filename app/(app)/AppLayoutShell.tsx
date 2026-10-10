"use client";

import React from "react";
import { DownNavbar, DesktopSidebar, GlobalVoiceFab, AssistantChatModal } from "@/components";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { useAssistant } from "@/context/AssistantContext";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { isAssistantOpen, closeAssistant } = useAssistant();

  return (
    <div className="flex min-h-screen md:h-screen md:max-h-screen md:overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar fissa a sinistra per Desktop */}
      <DesktopSidebar />

      {/* Area Contenuto Principale: su desktop è h-screen flex flex-col overflow-hidden */}
      <div
        id="main-content-column"
        className="flex-1 flex flex-col min-w-0 min-h-screen md:min-h-0 md:h-screen md:max-h-screen md:overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] md:pb-0 transition-all duration-200"
      >
        <OfflineBanner />
        {children}

        {/* Pulsante assistente vocale flottante attivo SOLO su mobile */}
        <div className="md:hidden">
          <GlobalVoiceFab />
        </div>

        {/* Barra di navigazione inferiore attiva solo su mobile */}
        <div className="md:hidden">
          <DownNavbar />
        </div>
      </div>

      {/* Desktop Split View: Colonna fissa a destra (SECONDA AREA DI SCORRIMENTO INDIPENDENTE a tutta altezza h-screen) */}
      {isAssistantOpen && (
        <aside
          aria-label="Assistente AI Dispensa Split View"
          className="hidden md:flex flex-col w-[420px] lg:w-[460px] xl:w-[480px] h-screen max-h-screen border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 z-20 shadow-xl overflow-hidden"
        >
          <AssistantChatModal
            isOpen={true}
            onClose={closeAssistant}
            mode="docked"
          />
        </aside>
      )}

      {/* Mobile Modal Bottom-Sheet: Attivo solo su mobile (< md) quando aperto, sopra la navbar */}
      {isAssistantOpen && (
        <div className="md:hidden">
          <AssistantChatModal
            isOpen={true}
            onClose={closeAssistant}
            mode="modal"
          />
        </div>
      )}
    </div>
  );
}
