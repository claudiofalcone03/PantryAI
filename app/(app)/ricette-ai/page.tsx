"use client";

import React, { useState, useEffect } from "react";
import { Send, Clock, Loader2, ListPlus } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getExpiringProductsByPantry, getProductsByPantry } from "@/lib/firestore/products";
import { generateRecipeExpiration, generateRecipeChatbot, generateRecipeFromIngredients, getGeminiModelName } from "@/lib/genkit/genkit";
import type { Product } from "@/types/firestore/productType";
import SelectItemForChatbot from "@/components/SelectItemForChatbot";

type Message = {
	role: "user" | "ai"; //Per distinguere chi ha scritto
	content: string;
};

export default function RicetteAIPage() {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [pantryItems, setPantryItems] = useState<Product[]>([]);
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
	const [modelName, setModelName] = useState("gemini-3.1-flash-lite");

	useEffect(() => {
		getGeminiModelName()
			.then(setModelName)
			.catch(err => console.error("Error fetching model name:", err));
	}, []);

	const handleExpiringProducts = async () => {
		if (!auth.currentUser) {
			alert("Devi effettuare l'accesso per usare questa funzione.");
			return;
		}

		setIsLoading(true);
		setMessages(prev => [...prev, { role: "user", content: "Crea una ricetta con i prodotti in scadenza" }]);

		try {
			const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
			const userData = userDoc.data();
			const pantryId = userData?.userProfileCurrentPantryId;

			if (!pantryId) {
				throw new Error("Nessuna dispensa selezionata.");
			}

			const expiringProducts = await getExpiringProductsByPantry(pantryId, 7);

			console.log("Prodotti in scadenza recuperati da Firestore");
			console.log(expiringProducts);

			if (expiringProducts.length === 0) {
				setMessages(prev => [...prev, { role: "ai", content: "Non hai prodotti in scadenza nella tua dispensa entro i prossimi 7 giorni." }]);
				setIsLoading(false);
				return;
			}

			const mappedProducts = expiringProducts.map(p => ({
				nome: p.productName,
				quantita: `${p.productQuantity} ${p.productUnitOfMeasure || ''}`.trim()
			}));

			const ricetta = await generateRecipeExpiration(mappedProducts);

			setMessages(prev => [...prev, { role: "ai", content: ricetta }]);

		} catch (error) {
			console.error("Errore durante la generazione della ricetta:", error);
			setMessages(prev => [...prev, { role: "ai", content: "Si è verificato un errore durante la generazione della ricetta." }]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleChatSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		const userMessage = input.trim();
		setInput("");
		setMessages(prev => [...prev, { role: "user", content: userMessage }]);
		setIsLoading(true);

		try {
			const ricetta = await generateRecipeChatbot(userMessage);
			setMessages(prev => [...prev, { role: "ai", content: ricetta }]);
		} catch (error) {
			console.error("Errore durante la chat:", error);
			setMessages(prev => [...prev, { role: "ai", content: "Si è verificato un errore durante la generazione della risposta." }]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleOpenModal = async () => {
		if (!auth.currentUser) {
			alert("Devi effettuare l'accesso per usare questa funzione.");
			return;
		}
		setIsModalOpen(true);
		try {
			const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
			const pantryId = userDoc.data()?.userProfileCurrentPantryId;
			if (!pantryId) return;
			const products = await getProductsByPantry(pantryId);
			//Compaiono solo i prodotti con quantità > 0
			const availableProducts = products.filter(p => p.productQuantity > 0);
			setPantryItems(availableProducts);
		} catch (error) {
			console.error("Errore recupero dispensa:", error);
		}
	};

	const toggleItemSelection = (productId: string) => {
		setSelectedItems(prev => {
			const next = new Set(prev);
			if (next.has(productId)) next.delete(productId);
			else next.add(productId);
			return next;
		});
	};

	const handleGenerateFromSelection = async () => {
		if (selectedItems.size === 0) return;
		setIsModalOpen(false);
		setIsLoading(true);

		const selectedProductsData = pantryItems.filter(p => p.productId && selectedItems.has(p.productId));
		const mappedProducts = selectedProductsData.map(p => ({
			nome: p.productName,
			quantita: `${p.productQuantity} ${p.productUnitOfMeasure || ''}`.trim()
		}));

		setMessages(prev => [...prev, { role: "user", content: `Crea una ricetta con questi ingredienti selezionati: ${mappedProducts.map(p => p.nome).join(", ")}` }]);

		try {
			const ricetta = await generateRecipeFromIngredients(mappedProducts);
			setMessages(prev => [...prev, { role: "ai", content: ricetta }]);
		} catch (error) {
			console.error("Errore durante la generazione della ricetta:", error);
			setMessages(prev => [...prev, { role: "ai", content: "Si è verificato un errore durante la generazione della ricetta." }]);
		} finally {
			setIsLoading(false);
			setSelectedItems(new Set());
		}
	};

	return (
		<div className="flex flex-col h-[calc(100vh-80px)] bg-zinc-50 dark:bg-zinc-950">
			{/* Barra superiore */}
			<div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 shrink-0">
				<div className="flex-1 min-w-0">
					<h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
						Chef AI
					</h1>
				</div>
			</div>

			{/* Sezione chat */}
			<main className="flex-1 overflow-y-auto p-4 w-full max-w-3xl mx-auto flex flex-col space-y-4">
				{messages.length === 0 && (
					<div className="flex justify-center items-center h-full text-zinc-500 dark:text-zinc-400 text-sm text-center px-4">
						Inizia una conversazione o usa uno dei pulsanti in basso per ottenere una ricetta! Stai parlando con {modelName}
					</div>
				)}

				{messages.map((msg, idx) => (
					<div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
						<div className={`px-4 py-3 max-w-[85%] rounded-2xl shadow-sm whitespace-pre-wrap ${msg.role === "user"
							? "bg-green-600 text-white rounded-br-none"
							: "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none"
							}`}>
							{msg.content}
						</div>
					</div>
				))}

				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 text-zinc-800 dark:text-zinc-200 shadow-sm flex items-center gap-2">
							<Loader2 className="w-4 h-4 animate-spin text-green-600" />
							<span>Lo Chef sta pensando...</span>
						</div>
					</div>
				)}
			</main>

			{/* Barra inferiore input */}
			<div className="shrink-0 p-4 bg-zinc-50 dark:bg-zinc-950 w-full max-w-3xl mx-auto">
				{/* Pulsanti azioni rapide */}
				<div className="flex flex-wrap gap-2 mb-3">
					<button
						onClick={handleExpiringProducts}
						disabled={isLoading}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-full text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
					>
						<Clock className="w-4 h-4 text-green-600 dark:text-green-500" />
						<span>Usa ciò che sta per scadere</span>
					</button>
					<button
						onClick={handleOpenModal}
						disabled={isLoading}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-full text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
					>
						<ListPlus className="w-4 h-4 text-green-600 dark:text-green-500" />
						<span>Seleziona elementi</span>
					</button>
				</div>

				{/* Form inserimento chat */}
				<form className="relative flex items-center" onSubmit={handleChatSubmit}>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Chiedimi una ricetta..."
						disabled={isLoading}
						className="w-full pl-4 pr-12 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm transition-colors disabled:opacity-50"
					/>
					<button
						type="submit"
						className="absolute right-2 p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
						disabled={!input.trim() || isLoading}
					>
						<Send className="w-5 h-5" />
					</button>
				</form>
			</div>
			{/* Finestra Selezione Elementi */}
			<SelectItemForChatbot
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				pantryItems={pantryItems}
				selectedItems={selectedItems}
				toggleItemSelection={toggleItemSelection}
				onGenerate={handleGenerateFromSelection}
			/>
		</div>
	);
}
