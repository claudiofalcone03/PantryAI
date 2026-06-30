"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { addProduct, getExpiringProductsByPantry } from "@/lib/firestore/products";
import type { Product } from "@/types/firestore/productType";

export default function TestFirestorePage() {
    const [loading, setLoading] = useState(false);
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [loadingExpiring, setLoadingExpiring] = useState(false);
    const [message, setMessage] = useState("");
    const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);

    const handleSend = async () => {
        setLoading(true);
        setMessage("");

        const payload = {
            titolo: "Invio 2 da Next.js",
            descrizione: "Secondo salvataggio dalla webapp",
            createdAt: serverTimestamp(),
        };

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

    const handleTestExpiring = async () => {
        setLoadingExpiring(true);
        setMessage("");
        setExpiringProducts([]);

        try {
            if (!auth.currentUser) {
                throw new Error("Devi essere loggato per eseguire questo test.");
            }

            const { getDoc, doc } = await import("firebase/firestore");
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            const pantryId = userDoc.data()?.userProfileCurrentPantryId;

            if (!pantryId) {
                throw new Error("Nessuna dispensa associata al tuo utente.");
            }

            const products = await getExpiringProductsByPantry(pantryId, 7);
            setExpiringProducts(products);
            setMessage(`Test completato! Trovati ${products.length} prodotti in scadenza.`);
        } catch (error: any) {
            console.error(error);
            setMessage(`Errore nel recupero: ${error.message}`);
        } finally {
            setLoadingExpiring(false);
        }
    };

    const handleTestNotification = async () => {
        if (!("Notification" in window)) {
            alert("Il tuo browser/dispositivo non supporta le notifiche Web Push.");
            return;
        }

        let permission = Notification.permission;
        if (permission !== "granted") {
            permission = await Notification.requestPermission();
        }

        if (permission === "granted") {
            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                registration.showNotification("PantryAI 🥕", {
                    body: "Evviva! Le notifiche PWA funzionano perfettamente!",
                    icon: "/icon-192x192.png",
                });
            } else {
                new Notification("PantryAI 🥕", { body: "Evviva! Le notifiche funzionano!" });
            }
        } else {
            alert("Hai rifiutato le notifiche o non sono abilitate nelle impostazioni del tuo iPhone.");
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full flex flex-col gap-6 border border-gray-100">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Firestore</h1>
                    <p className="text-gray-500 text-sm">Invia un documento di prova alla raccolta &quot;tesi_test&quot; o testa i prodotti.</p>
                </div>

                <button
                    onClick={handleSend}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? "Salvataggio..." : "Invia al database"}
                </button>

                <button
                    onClick={handleCreateProduct}
                    disabled={loadingProduct}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-emerald-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loadingProduct ? "Salvataggio Prodotto..." : "Crea prodotto test"}
                </button>

                <button
                    onClick={handleTestExpiring}
                    disabled={loadingExpiring}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-amber-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loadingExpiring ? "Ricerca in corso..." : "Testa Query Scadenza"}
                </button>

                <button
                    onClick={handleTestNotification}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                >
                    Testa Notifiche Push (PWA)
                </button>


                {message && (
                    <div className={`p-4 rounded-xl text-sm ${message.includes("Errore") ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
                        {message}
                    </div>
                )}
            </div>

            {/* Mostra i risultati a schermo se ci sono */}
            {expiringProducts.length > 0 && (
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Prodotti Recuperati ({expiringProducts.length})</h2>
                    <div className="flex flex-col gap-3">
                        {expiringProducts.map((p) => (
                            <div key={p.productId} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex flex-col gap-1">
                                <span className="font-semibold text-gray-900">{p.productName}</span>
                                <span className="text-sm text-gray-500">
                                    Quantità: {p.productQuantity}
                                </span>
                                <span className="text-sm text-gray-500">
                                    Scadenza (Timestamp Firestore): {p.expiryDateProduct ? new Date(p.expiryDateProduct.seconds * 1000).toLocaleDateString() : 'Nessuna'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
}