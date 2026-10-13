"use client";

import React, { useEffect, useState } from "react";
import { DownNavbar } from "@/components/layout/DownNavbar";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { GlobalVoiceFab } from "@/components/voice/GlobalVoiceFab";
import { AssistantChatModal } from "@/components/assistant/AssistantChatModal";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { useAssistant } from "@/context/AssistantContext";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { isAssistantOpen, closeAssistant } = useAssistant();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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

      {/* Assistente AI: evita istanze duplicate simultanee desktop e mobile per prevenire listener snapshot doppi */}
      {isAssistantOpen && (
        isDesktop ? (
          <aside
            aria-label="Assistente AI Dispensa Split View"
            className="flex flex-col w-[420px] lg:w-[460px] xl:w-[480px] h-screen max-h-screen border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 z-20 shadow-xl overflow-hidden"
          >
            <AssistantChatModal
              isOpen={true}
              onClose={closeAssistant}
              mode="docked"
            />
          </aside>
        ) : (
          <div>
            <AssistantChatModal
              isOpen={true}
              onClose={closeAssistant}
              mode="modal"
            />
          </div>
        )
      )}
    </div>
  );
}
