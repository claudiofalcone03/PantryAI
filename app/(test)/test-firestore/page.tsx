"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addProduct } from "@/lib/firestore/products";
import type { Product } from "@/types/firestore/productType";

export default function TestFirestorePage() {
    const [loading, setLoading] = useState(false);
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [message, setMessage] = useState("");

    const handleSend = async () => {
        setLoading(true);
        setMessage("");

        const payload = {
            titolo: "Invio 2 da Next.js",
            descrizione: "Secondo salvataggio dalla webapp",
            createdAt: serverTimestamp(),
        };

        console.log("Invio documento alla raccolta 'tesi_test' su Firestore:", payload);

        try {
            const docRef = await addDoc(collection(db, "tesi_test"), payload);

            setMessage(`Documento salvato con ID: ${docRef.id}`);
        } catch (error) {
            console.error(error);
            setMessage("Errore nel salvataggio su Firestore");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProduct = async () => {
        setLoadingProduct(true);
        setMessage("");

        const testProductPayload: Omit<Product, "productId" | "productCreatedAt" | "productUpdatedAt"> = {
            productName: "Prodotto di Test",
            productQuantity: 1,
            productCategory: "Categoria Test",
            addToShoppingList: false,
            productPantryId: "cHQgPil0u8NjKKGUbN74"
        };

        try {
            const productId = await addProduct(testProductPayload);
            setMessage(`Prodotto salvato con ID: ${productId}`);
        } catch (error) {
            console.error(error);
            setMessage("Errore nel salvataggio del prodotto su Firestore");
        } finally {
            setLoadingProduct(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full flex flex-col gap-6 border border-gray-100">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Firestore</h1>
                    <p className="text-gray-500 text-sm">Invia un documento di prova alla raccolta &quot;tesi_test&quot; del tuo database.</p>
                </div>

                <button
                    onClick={handleSend}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Salvataggio...
                        </>
                    ) : (
                        "Invia al database"
                    )}
                </button>

                <button
                    onClick={handleCreateProduct}
                    disabled={loadingProduct}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-emerald-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loadingProduct ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Salvataggio Prodotto...
                        </>
                    ) : (
                        "Crea prodotto test"
                    )}
                </button>

                {message && (
                    <div className={`p-4 rounded-xl text-sm ${message.includes("Errore") ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
                        {message}
                    </div>
                )}
            </div>
        </main>
    );
}