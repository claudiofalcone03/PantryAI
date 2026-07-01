/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User, LogOut, Layers, FileDown, Trash, Pencil, Copy, DoorOpen, Plus, UserPlus, CheckCircle, Settings, Database } from "lucide-react";
import Image from "next/image";
import type { UserProfile } from "@/types/firestore/userProfileType";
import type { Pantry } from "@/types/firestore/pantryType";
import { getUserPantries, leavePantry, createPantry, joinPantryWithCode, setCurrentPantry } from "@/lib/firestore/pantries";

export default function ProfilePage() {
	const router = useRouter();
	const [userData, setUserData] = useState<{
		name: string;
		email: string;
		photoURL: string | null;
		currentPantryId?: string | null;
	} | null>(null);
	const [pantries, setPantries] = useState<Pantry[]>([]);  //Vettore dispense utente

	useEffect(() => {
		const fetchUser = async () => {
			const user = auth.currentUser;
			if (user) {
				let name = user.displayName || "Utente sconosciuto";
				let photoURL = user.photoURL || null;
				let currentPantryId = null;

				try {
					const userDoc = await getDoc(doc(db, "users", user.uid));
					if (userDoc.exists()) {
						const data = userDoc.data() as UserProfile & { userProfileCurrentPantryId?: string };
						name = data.userProfileName || name; //Usa il nome dal profilo se disponibile altrimenti quello da auth	
						photoURL = data.userProfilePhotoURL || photoURL;
						currentPantryId = data.userProfileCurrentPantryId || null;
					}

					const userPantries = await getUserPantries(user.uid); //Funzione importata 
					setPantries(userPantries);
				} catch (error) {
					console.error("Errore nel recupero dati utente o dispense:", error);
				}

				setUserData({
					name: name || "Nome utente non disponibile",
					email: user.email || "Email non disponibile",
					photoURL: photoURL,
					currentPantryId: currentPantryId
				});
			}
		};

		fetchUser();
	}, []);

	//Funzione logout
	const handleLogout = async () => {
		try {
			await signOut(auth);
			router.push("/login");
		} catch (error) {
			console.error("Errore durante il logout:", error);
		}
	};

	//Funzione copia codice negli appunti
	const handleCopyCode = (code?: string) => {
		if (!code) return;
		navigator.clipboard.writeText(code); // Copia il codice negli appunti
		alert("Codice copiato: " + code);
	};

	//Funzione abbandono dispensa
	const handleLeavePantry = async (pantryId?: string) => {
		const user = auth.currentUser;
		if (!user || !pantryId) return;
		const confirmLeave = window.confirm("Sei sicuro di voler abbandonare questa dispensa?");
		if (confirmLeave) {
			try {
				await leavePantry(user.uid, pantryId);
				setPantries(prev => prev.filter(p => p.pantryId !== pantryId));
			} catch (error: any) {
				console.error("Errore durante l'abbandono della dispensa", error);
				alert("Impossibile abbandonare la dispensa: " + error.message);
			}
		}
	};

	//Funzione crea dispensa
	const handleCreatePantry = async () => {
		const user = auth.currentUser;
		if (!user) return;
		const pantryName = window.prompt("Inserisci il nome della nuova dispensa:");
		if (pantryName && pantryName.trim()) {
			try {
				await createPantry(user.uid, pantryName.trim(), userData?.name);
				const updatedPantries = await getUserPantries(user.uid);
				setPantries(updatedPantries);
				alert("Dispensa creata con successo!");
			} catch (error: any) {
				console.error("Errore durante la creazione:", error);
				alert("Errore durante la creazione: " + error.message);
			}
		}
	};

	//Funzione per unirsi a una dispensa tramite codice di invito
	const handleJoinPantry = async () => {
		const user = auth.currentUser;
		if (!user) return;
		const inviteCode = window.prompt("Inserisci il codice di invito (6 caratteri):");
		if (inviteCode && inviteCode.trim()) {
			try {
				await joinPantryWithCode(user.uid, inviteCode.trim().toUpperCase(), userData?.name);
				const updatedPantries = await getUserPantries(user.uid);
				setPantries(updatedPantries);
				alert("Ti sei unito alla dispensa con successo!");
			} catch (error: any) {
				console.error("Errore durante l'accesso:", error);
				alert("Errore: " + error.message);
			}
		}
	};

	//Funzione imposta dispensa corrente
	const handleSetCurrentPantry = async (pantryId?: string) => {
		if (!pantryId) return;
		const user = auth.currentUser;
		if (!user) return;
		try {
			await setCurrentPantry(user.uid, pantryId);
			setUserData(prev => prev ? { ...prev, currentPantryId: pantryId } : null);
		} catch (error: any) {
			console.error("Errore durante l'impostazione:", error);
			alert("Errore: " + error.message);
		}
	};

	return (
		<div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
			<header className="sticky top-0 z-10 px-4 py-6 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Impostazioni</h1>
			</header>

			<main className="flex-1 px-4 py-6 max-w-md mx-auto w-full">

				<div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-zinc-800 mb-8">
					<div className="flex flex-col items-center">
						<div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 overflow-hidden relative">
							{userData?.photoURL ? (
								<Image
									src={userData.photoURL}
									alt="Foto profilo"
									fill
									className="object-cover"
									referrerPolicy="no-referrer"
								/>
							) : (
								<User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
							)}
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
						onClick={() => {/*Funzione modifica profilo*/ }}
					>
						<div className="flex items-center space-x-3">
							<Pencil className="w-5 h-5 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-white">Modifica dati profilo  (Prossimamente) </span>
						</div>
					</button>

					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
						<div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center space-x-3 bg-gray-50 dark:bg-zinc-800/50">
							<Layers className="w-5 h-5 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-white">Le tue dispense</span>
						</div>
						<div className="divide-y divide-gray-200 dark:divide-zinc-800">
							{pantries.length === 0 ? (
								<div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
									Non sei ancora membro di nessuna dispensa.
								</div>
							) : (
								pantries.map((pantry) => {
									const userRole = pantry.pantryMembers?.find(m => m.memberId === auth.currentUser?.uid)?.memberRole || 'membro';
									return (
										<div key={pantry.pantryId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
											<div className="flex-1">
												<h3 className="font-medium text-gray-900 dark:text-white">{pantry.pantryName}</h3>
												<div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
													<span className="capitalize">{userRole}</span>
													<span>•</span>
													<span>Codice: {pantry.pantryInviteCode}</span>
												</div>
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => handleSetCurrentPantry(pantry.pantryId)}
													className={`p-2 rounded-lg transition-colors ${userData?.currentPantryId === pantry.pantryId ? "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30" : "text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 bg-gray-100 hover:bg-green-50 dark:bg-zinc-800 dark:hover:bg-green-900/30"}`}
													title={userData?.currentPantryId === pantry.pantryId ? "Dispensa corrente" : "Imposta come dispensa corrente"}
												>
													<CheckCircle className="w-4 h-4" />
												</button>
												<button
													onClick={() => router.push(`/dispense/${pantry.pantryId}/impostazioni`)}
													className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 bg-gray-100 hover:bg-purple-50 dark:bg-zinc-800 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
													title="Impostazioni dispensa"
												>
													<Settings className="w-4 h-4" />
												</button>
												<button
													onClick={() => handleCopyCode(pantry.pantryInviteCode)}
													className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 bg-gray-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
													title="Copia codice di accesso"
												>
													<Copy className="w-4 h-4" />
												</button>
												<button
													onClick={() => handleLeavePantry(pantry.pantryId)}
													className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-gray-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-900/30 rounded-lg transition-colors"
													title="Abbandona dispensa"
												>
													<DoorOpen className="w-4 h-4" />
												</button>
											</div>
										</div>
									);
								})
							)}
						</div>
						<div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex flex-col sm:flex-row gap-3">
							<button
								onClick={handleCreatePantry}
								className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-colors font-medium text-sm"
							>
								<Plus className="w-4 h-4" />
								<span>Crea dispensa</span>
							</button>
							<button
								onClick={handleJoinPantry}
								className="flex-1 flex items-center justify-center space-x-2 bg-white dark:bg-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-600 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-600 p-3 rounded-xl transition-colors font-medium text-sm"
							>
								<UserPlus className="w-4 h-4" />
								<span>Unisciti con codice</span>
							</button>
						</div>
					</div>

					<button
						className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 transition-colors"
						onClick={() => router.push('/test-firestore')}
					>
						<div className="flex items-center space-x-3">
							<Database className="w-5 h-5 text-purple-500 dark:text-purple-400" />
							<span className="font-medium text-gray-900 dark:text-white">Pagina Test Firestore</span>
						</div>
					</button>

					<button
						className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 transition-colors"
						onClick={() => {/* Funzione esporta dati in csv o json */ }}
					>
						<div className="flex items-center space-x-3">
							<FileDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-white">Esporta dati (Prossimamente)</span>
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
								<span className="font-medium">Elimina account definitivamente (Prossimamente)</span>
							</div>
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
