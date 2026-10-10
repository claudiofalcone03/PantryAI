"use client";

import { ScanBarcode, Plus } from "lucide-react";
import { MobileProfileButton } from "./MobileProfileButton";

interface ShoppingListTopBarProps {
  pantryName: string;
  onAddProduct?: () => void;
  onScanClick?: () => void;
}

export function ShoppingListTopBar({ pantryName, onAddProduct, onScanClick }: ShoppingListTopBarProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
          {pantryName || "Caricamento..."}
        </h1>
      </div>
      <div className="flex items-center gap-2 ml-3">
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
