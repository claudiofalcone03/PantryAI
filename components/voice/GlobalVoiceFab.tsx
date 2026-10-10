"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { useAssistant } from "@/context/AssistantContext";

const STORAGE_KEY = "pantryai_voice_fab_pos";
const FAB_SIZE = 56; // 14rem = 56px
const MARGIN = 16;
const TOP_MARGIN = 64;
const BOTTOM_MARGIN = 110; // Spazio di sicurezza sopra la DownNavbar

interface FabPosition {
  x: number;
  y: number;
}

export function GlobalVoiceFab() {
  const { openAssistant } = useAssistant();
  const [position, setPosition] = useState<FabPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDownRef = useRef(false);
  const hasMovedRef = useRef(false);
  const pointerStartRef = useRef<{ clientX: number; clientY: number; posX: number; posY: number }>({
    clientX: 0,
    clientY: 0,
    posX: 0,
    posY: 0,
  });
  const fabRef = useRef<HTMLElement>(null);

  // Calcola i limiti dello schermo
  const clampPosition = useCallback((x: number, y: number): FabPosition => {
    if (typeof window === "undefined") return { x, y };
    const minX = MARGIN;
    const maxX = Math.max(minX, window.innerWidth - FAB_SIZE - MARGIN);
    const minY = TOP_MARGIN;
    const maxY = Math.max(minY, window.innerHeight - FAB_SIZE - BOTTOM_MARGIN);

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, []);

  // Caricamento posizione memorizzata da localStorage all'avvio
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setPosition(clampPosition(parsed.x, parsed.y));
          return;
        }
      }
    } catch {
      // Fallback a posizione predefinita
    }

    // Posizione di default in basso a destra
    const defaultX = window.innerWidth - FAB_SIZE - 20;
    const defaultY = window.innerHeight - FAB_SIZE - 100;
    setPosition(clampPosition(defaultX, defaultY));
  }, [clampPosition]);

  // Gestione ridimensionamento finestra
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Solo click sinistro o tocco
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const currentX = position?.x ?? (window.innerWidth - FAB_SIZE - 20);
    const currentY = position?.y ?? (window.innerHeight - FAB_SIZE - 100);

    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: currentX,
      posY: currentY,
    };

    isPointerDownRef.current = true;
    hasMovedRef.current = false;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignora se non supportato
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - pointerStartRef.current.clientX;
    const dy = e.clientY - pointerStartRef.current.clientY;

    if (!hasMovedRef.current) {
      if (Math.hypot(dx, dy) > 5) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }
    }

    if (hasMovedRef.current) {
      const nextX = pointerStartRef.current.posX + dx;
      const nextY = pointerStartRef.current.posY + dy;
      setPosition(clampPosition(nextX, nextY));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerDownRef.current) return;

    isPointerDownRef.current = false;

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignora
    }

    if (hasMovedRef.current) {
      setIsDragging(false);
      // Salva la nuova posizione in localStorage
      if (position) {
        const clamped = clampPosition(position.x, position.y);
        setPosition(clamped);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
        } catch {
          // Ignora se localStorage non disponibile
        }
      }
    } else {
      // Semplice tap/click: apri l'assistente
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate(30);
      }
      openAssistant();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignora
    }
  };

  return (
    <aside
      ref={fabRef}
      aria-label="Assistente AI Dispensa"
      style={
        position
          ? {
              position: "fixed",
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: 50,
            }
          : undefined
      }
      className={
        position
          ? "touch-none select-none"
          : "fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] right-4 sm:right-6 z-40 touch-none select-none"
      }
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label="Trascina o tocca per aprire la chat dell'Assistente AI"
        title="Tieni premuto per spostare, tocca per aprire l'assistente AI"
        className={`group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/30 border border-white/25 transition-transform duration-75 touch-none select-none cursor-grab active:cursor-grabbing ${
          isDragging
            ? "scale-110 shadow-2xl ring-4 ring-emerald-400/40 cursor-grabbing"
            : "hover:scale-105 active:scale-95 hover:shadow-emerald-500/50"
        }`}
      >
        {/* Alone pulsante animato discreto quando a riposo */}
        {!isDragging && (
          <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-25 animate-ping -z-10 pointer-events-none" />
        )}

        {/* Icona delle stelline AI */}
        <Sparkles className="w-7 h-7 text-amber-200 group-hover:scale-110 transition-transform pointer-events-none" />
      </button>
    </aside>
  );
}
