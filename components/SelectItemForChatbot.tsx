import React from 'react';
import { X, Check } from 'lucide-react';
import type { Product } from "@/types/firestore/productType";

type PantryItemsModalProps = {
    isOpen: boolean;
    onClose: () => void;
    pantryItems: Product[];
    selectedItems: Set<string>;
    toggleItemSelection: (productId: string) => void;
    onGenerate: () => void;
};

export default function SelectItemForChatbot({
    isOpen,
    onClose,
    pantryItems,
    selectedItems,
    toggleItemSelection,
    onGenerate
}: PantryItemsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Seleziona gli ingredienti</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {pantryItems.length === 0 ? (
                        <p className="text-center text-zinc-500 text-sm py-4">Caricamento in corso o dispensa vuota...</p>
                    ) : (
                        pantryItems.map(item => (
                            <label key={item.productId} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.productId && selectedItems.has(item.productId) ? 'bg-green-600 border-green-600' : 'border-zinc-300 dark:border-zinc-700'}`}>
                                    {item.productId && selectedItems.has(item.productId) && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{item.productName}</p>
                                    <p className="text-xs text-zinc-500">Quantità disponibile: {item.productQuantity} {item.productUnitOfMeasure}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={item.productId ? selectedItems.has(item.productId) : false}
                                    onChange={() => item.productId && toggleItemSelection(item.productId)}
                                />
                            </label>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={onGenerate}
                        disabled={selectedItems.size === 0}
                        className="w-full py-2.5 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
                    >
                        Genera Ricetta ({selectedItems.size})
                    </button>
                </div>
            </div>
        </div>
    );
}
