"use client";

import { useState, useRef, useEffect } from "react";
import { ScanBarcode, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { MobileProfileButton } from "./MobileProfileButton";

interface ShoppingListTopBarProps {
  pantryName: string;
  onAddProduct?: () => void;
  onScanClick?: () => void;
  onDeleteCompleted?: () => void;
  onClearAll?: () => void;
  hasPurchasedItems?: boolean;
  totalItemsCount?: number;
}

export function ShoppingListTopBar({
  pantryName,
  onAddProduct,
  onScanClick,
  onDeleteCompleted,
  onClearAll,
  hasPurchasedItems = false,
  totalItemsCount = 0,
}: ShoppingListTopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <div className="flex items-center justify-between px-4 pb-3.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
          {pantryName || "Caricamento..."}
        </h1>
      </div>
      <div className="flex items-center gap-1.5 ml-2">
        {/* Dropdown Menu Eliminazione */}
        {(onDeleteCompleted || onClearAll) && totalItemsCount > 0 && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="Opzioni eliminazione lista"
              aria-label="Opzioni eliminazione lista"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-11 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  disabled={!hasPurchasedItems}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDeleteCompleted?.();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Elimina completati</span>
                </button>
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                <button
                  type="button"
                  disabled={totalItemsCount === 0}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onClearAll?.();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Elimina tutti</span>
                </button>
              </div>
            )}
          </div>
        )}

        <button
          className="p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          title="Scannerizza prodotto"
          onClick={onScanClick}
        >
          <ScanBarcode className="w-5 h-5" />
        </button>
        <button
          className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors rounded-full shadow-xs cursor-pointer"
          title="Aggiungi prodotto alla lista"
          onClick={onAddProduct}
        >
          <Plus className="w-5 h-5" />
        </button>
        <MobileProfileButton />
      </div>
    </div>
  );
}
