"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User, LogOut, Layers, FileDown, Trash, Pencil } from "lucide-react";
import type { UserProfile } from "@/types/firestore/userProfile";

export default function ProfilePage() {
	const router = useRouter();
	const [userData, setUserData] = useState<{
		name: string;
		email: string;
	} | null>(null);

	useEffect(() => {
		const fetchUser = async () => {
			const user = auth.currentUser;
			if (user) {
				let name = user.displayName || "Utente sconosciuto";

				try {
					const userDoc = await getDoc(doc(db, "users", user.uid));
					if (userDoc.exists()) {
						const data = userDoc.data() as UserProfile;
						name = data.userProfileName || name; //Usa il nome dal profilo se disponibile altrimenti quello da auth	
					}
				} catch (error) {
					console.error("Errore nel recupero dati utente:", error);
				}

				setUserData({
					name: name || "Nome utente non disponibile",
					email: user.email || "Email non disponibile"
				});
			}
		};

		fetchUser();
	}, []);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			router.push("/login");
		} catch (error) {
			console.error("Errore durante il logout:", error);
		}
	};

	return (
		<main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
			<div className="px-4 py-8 max-w-md mx-auto">
				<h1 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">Impostazioni</h1>

				<div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-zinc-800 mb-8">
					<div className="flex flex-col items-center">
						<div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
							
							{/* Sostituire eventualmente con immagine profilo se disponibile da google auth */}
							<User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
							
						</div>

						<h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center">
							{userData ? `${userData.name}`.trim() : "Caricamento..."}
						</h2>

						<p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
							{userData?.email}
						</p>
					</div>
				</div>

				<div className="space-y-4">
					<button
						className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 transition-colors"
						onClick={() => {/*Funzione modifica profilo*/}}
					>
						<div className="flex items-center space-x-3">
							<Pencil className="w-5 h-5 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-white">Modifica dati profilo  (email e password?) </span>
						</div>
					</button>

					<button
						className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 transition-colors"
						onClick={() => {/* Funzione selezione dispensa */ }}
					>
						<div className="flex items-center space-x-3">
							<Layers className="w-5 h-5 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-white">Seleziona dispensa</span>
						</div>
					</button>

					<button
						className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 transition-colors"
						onClick={() => {/* Funzione esporta dati in csv o json */ }}
					>
						<div className="flex items-center space-x-3">
							<FileDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-white">Esporta dati in csv</span>
						</div>
					</button>

					<div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-800 space-y-4">
						<button
							onClick={handleLogout}
							className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900/50 transition-colors"
						>
							<div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
								<LogOut className="w-5 h-5" />
								<span className="font-medium">Disconnetti</span>
							</div>
						</button>

						<button
							className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl border border-gray-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50 transition-colors group"
							onClick={() => {/* Elimina account invia una mail a me */ }}
						>
							<div className="flex items-center space-x-3 text-red-600 dark:text-red-400 opacity-80 group-hover:opacity-100 transition-opacity">
								<Trash className="w-5 h-5" />
								<span className="font-medium">Elimina account definitivamente</span>
							</div>
						</button>
					</div>
				</div>
			</div>
		</main>
	);
}
