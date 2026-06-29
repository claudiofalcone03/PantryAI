import React from "react";

interface DecreaseQuantityPopupProps {
  isOpen: boolean;
  onClose: (e: React.MouseEvent) => void;
  productName: string;
  onResolve: (e: React.MouseEvent, resolution: 'consumed' | 'wasted') => void;
}

export function RemoveQuantityPopup({ isOpen, onClose, productName, onResolve }: DecreaseQuantityPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">Conferma azione</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Stai rimuovendo un'unità di <strong>{productName}</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={(e) => onResolve(e, 'consumed')}
            className="w-full px-4 py-3 text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl"></span> Mangiato
          </button>
          <button
            onClick={(e) => onResolve(e, 'wasted')}
            className="w-full px-4 py-3 text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl"></span> Buttato
          </button>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 mt-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
