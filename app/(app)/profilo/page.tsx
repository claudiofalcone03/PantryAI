/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User, LogOut, Layers, FileDown, Trash, Pencil, Copy, DoorOpen, Plus, UserPlus, CheckCircle, Settings, Database, Bot, Key, Eye, EyeOff, RefreshCw, Bell, BellRing, BellOff, Send, Check, ChevronRight, Code2, Layout, CalendarDays } from "lucide-react";
import Image from "next/image";
import type { UserProfile, UserNotificationPreferences } from "@/types/firestore/userProfileType";
import type { Pantry } from "@/types/firestore/pantryType";
import { getUserPantries, leavePantry, createPantry, joinPantryWithCode, setCurrentPantry } from "@/lib/firestore/pantries";
import { updateNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, ALL_APP_SCREENS, DEFAULT_NAV_TABS } from "@/lib/firestore/userProfile";
import { requestAndRegisterFcmToken, disablePushNotifications, getNotificationPermissionState } from "@/lib/notifications/fcmClient";
import { Skeleton, PantryCardSkeleton, NavCustomizationPopup } from "@/components";

export default function ProfilePage() {
	const router = useRouter();
	const [userData, setUserData] = useState<{
		name: string;
		email: string;
		photoURL: string | null;
		currentPantryId?: string | null;
	} | null>(null);
	const [pantries, setPantries] = useState<Pantry[]>([]);  //Vettore dispense utente
	const [loading, setLoading] = useState(true);

	// Stati per le notifiche push
	const [pushEnabled, setPushEnabled] = useState<boolean>(false);
	const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
	const [pushLoading, setPushLoading] = useState<boolean>(false);
	const [notificationPrefs, setNotificationPrefs] = useState<UserNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
	const [testPushLoading, setTestPushLoading] = useState<boolean>(false);
	const [testPushResult, setTestPushResult] = useState<{ success: boolean; msg: string } | null>(null);

	// Stati per personalizzazione barra di navigazione
	const [navTabs, setNavTabs] = useState<string[]>(DEFAULT_NAV_TABS);
	const [isNavPopupOpen, setIsNavPopupOpen] = useState<boolean>(false);

	useEffect(() => {
		const fetchUser = async () => {
			const user = auth.currentUser;
			if (user) {
				let name = user.displayName || "Utente sconosciuto";
				let photoURL = user.photoURL || null;
				let currentPantryId = null;
				let pushActive = false;
				let prefs = DEFAULT_NOTIFICATION_PREFERENCES;
				let userTabs = DEFAULT_NAV_TABS;

				try {
					const userDoc = await getDoc(doc(db, "users", user.uid));
					if (userDoc.exists()) {
						const data = userDoc.data() as UserProfile & { userProfileCurrentPantryId?: string };
						name = data.userProfileName || name; //Usa il nome dal profilo se disponibile altrimenti quello da auth	
						photoURL = data.userProfilePhotoURL || photoURL;
						currentPantryId = data.userProfileCurrentPantryId || null;

						if (data.notificationPreferences) {
							prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...data.notificationPreferences };
						}
						const fcmList = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
						const localFcm = typeof window !== "undefined" ? localStorage.getItem("pantry_fcm_token") : null;
						pushActive = Boolean(prefs.enabled && (fcmList.length > 0 || localFcm));

						if (data.userProfileNavTabs && Array.isArray(data.userProfileNavTabs) && data.userProfileNavTabs.length > 0) {
							userTabs = data.userProfileNavTabs;
						} else {
							const localTabs = typeof window !== "undefined" ? localStorage.getItem("user_nav_tabs") : null;
							if (localTabs) {
								try {
									const parsed = JSON.parse(localTabs);
									if (Array.isArray(parsed) && parsed.length > 0) userTabs = parsed;
								} catch {}
							}
						}
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
				setPushPermission(getNotificationPermissionState());
				setPushEnabled(pushActive);
				setNotificationPrefs(prefs);
				setNavTabs(userTabs);
				setLoading(false);
			} else {
				setLoading(false);
			}
		};

		fetchUser();
	}, []);

	// Gestione attivazione / disattivazione notifiche push
	const handleTogglePushNotifications = async () => {
		const user = auth.currentUser;
		if (!user) return;

		setPushLoading(true);
		setTestPushResult(null);
		try {
			if (pushEnabled) {
				await disablePushNotifications(user.uid);
				await updateNotificationPreferences(user.uid, { ...notificationPrefs, enabled: false });
				setPushEnabled(false);
				setNotificationPrefs(prev => ({ ...prev, enabled: false }));
			} else {
				const token = await requestAndRegisterFcmToken(user.uid);
				if (token) {
					await updateNotificationPreferences(user.uid, { ...notificationPrefs, enabled: true });
					setPushEnabled(true);
					setPushPermission("granted");
					setNotificationPrefs(prev => ({ ...prev, enabled: true }));
				}
			}
		} catch (error: any) {
			console.error("Errore toggle notifiche:", error);
			alert("Errore notifiche push: " + (error.message || error));
		} finally {
			setPushLoading(false);
		}
	};

	// Modifica preferenze di notifica (soglia giorni, ecc.)
	const handleUpdateNotificationPrefs = async (key: keyof UserNotificationPreferences, value: any) => {
		const user = auth.currentUser;
		if (!user) return;
		const updated = { ...notificationPrefs, [key]: value };
		setNotificationPrefs(updated);
		try {
			await updateNotificationPreferences(user.uid, updated);
		} catch (e) {
			console.error("Errore salvataggio preferenze notifiche:", e);
		}
	};

	// Invio notifica push di test immediata
	const handleSendTestPush = async () => {
		const user = auth.currentUser;
		if (!user) return;

		setTestPushLoading(true);
		setTestPushResult(null);
		try {
			const res = await fetch("/api/notifications/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.uid,
					title: "Test Notifiche PantryAI",
					message: "Fantastico! Il tuo dispositivo riceve correttamente gli avvisi della dispensa.",
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Errore invio");
			}
			setTestPushResult({ success: true, msg: "Notifica push di prova inviata con successo!" });
		} catch (err: any) {
			setTestPushResult({ success: false, msg: err.message || "Errore durante l'invio della notifica." });
		} finally {
			setTestPushLoading(false);
		}
	};

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

	if (loading) {
		return (
			<div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
				<header className="sticky top-0 z-10 px-4 py-6 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Impostazioni</h1>
				</header>
				<main className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
					<div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-zinc-800 mb-8 flex flex-col items-center">
						<Skeleton className="w-24 h-24 rounded-full mb-4" />
						<Skeleton className="h-6 w-32 mb-1" />
						<Skeleton className="h-4 w-48" />
					</div>
					<div className="space-y-4">
						<Skeleton className="h-14 w-full rounded-2xl" />
						<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
							<div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center space-x-3 bg-gray-50 dark:bg-zinc-800/50">
								<Skeleton className="w-5 h-5 rounded-full" />
								<Skeleton className="h-5 w-32" />
							</div>
							<div className="p-4">
								<PantryCardSkeleton />
								<PantryCardSkeleton />
							</div>
						</div>
					</div>
				</main>
			</div>
		);
	}

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

					{/* Card Notifiche Push & Promemoria Scadenze */}
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-all">
						<div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
									<BellRing className="w-5 h-5" />
								</div>
								<div>
									<h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
										Notifiche Push & Scadenze
										<span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
											PWA
										</span>
									</h2>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Ricevi avvisi automatici quando gli alimenti stanno per scadere.
									</p>
								</div>
							</div>
						</div>

						<div className="p-5 space-y-4">
							{/* Toggle attivazione notifiche */}
							<div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200/70 dark:border-zinc-700/60">
								<div className="flex items-center space-x-3">
									{pushEnabled ? (
										<Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
									) : (
										<BellOff className="w-5 h-5 text-gray-400 shrink-0" />
									)}
									<div>
										<p className="text-xs font-semibold text-gray-900 dark:text-white">
											{pushEnabled ? "Notifiche Push Attive" : "Notifiche Push Disattivate"}
										</p>
										<p className="text-[11px] text-gray-500 dark:text-gray-400">
											{pushPermission === "denied"
												? "Permesso bloccato nel browser: sbloccalo dalle impostazioni sito."
												: pushEnabled
												? "Questo dispositivo riceverà gli avvisi per la dispensa."
												: "Attiva per ricevere promemoria anche ad app chiusa."}
										</p>
									</div>
								</div>

								<button
									onClick={handleTogglePushNotifications}
									disabled={pushLoading || pushPermission === "denied"}
									className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
										pushEnabled
											? "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-900/50"
											: "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
									} disabled:opacity-50`}
								>
									{pushLoading ? (
										<RefreshCw className="w-3.5 h-3.5 animate-spin" />
									) : pushEnabled ? (
										<span>Disattiva</span>
									) : (
										<span>Attiva</span>
									)}
								</button>
							</div>

							{/* Preferenze avanzate (visibili quando le notifiche sono attive) */}
							{pushEnabled && (
								<div className="space-y-3 pt-1">
									{/* Soglia giorni anticipo */}
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
										<div>
											<span className="text-xs font-semibold text-gray-900 dark:text-white block">
												Preavviso Scadenza Alimenti
											</span>
											<span className="text-[11px] text-gray-500 dark:text-gray-400 block">
												Quanti giorni prima vuoi essere avvisato?
											</span>
										</div>

										<div className="flex items-center gap-1">
											{[
												{ days: 0, label: "Oggi" },
												{ days: 1, label: "1 gg" },
												{ days: 2, label: "2 gg" },
												{ days: 3, label: "3 gg" },
											].map(({ days, label }) => (
												<button
													key={days}
													onClick={() => handleUpdateNotificationPrefs("notifyOnExpiryDays", days)}
													className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
														notificationPrefs.notifyOnExpiryDays === days
															? "bg-amber-600 text-white shadow-xs"
															: "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700"
													}`}
												>
													{label}
												</button>
											))}
										</div>
									</div>

									{/* Toggle Cibi Aperti */}
									<label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-200/60 dark:border-zinc-700/40 cursor-pointer">
										<div>
											<span className="text-xs font-semibold text-gray-900 dark:text-white block">
												Avviso Cibi Aperti (Shelf-Life)
											</span>
											<span className="text-[11px] text-gray-500 dark:text-gray-400 block">
												Avvisami quando un alimento aperto sta per superare i giorni di consumo consigliati.
											</span>
										</div>
										<input
											type="checkbox"
											checked={Boolean(notificationPrefs.notifyOpenedProducts)}
											onChange={(e) => handleUpdateNotificationPrefs("notifyOpenedProducts", e.target.checked)}
											className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 border-gray-300 dark:border-zinc-700 shrink-0 ml-3"
										/>
									</label>

									{/* Pulsante invio notifica di prova */}
									<div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
										<button
											onClick={handleSendTestPush}
											disabled={testPushLoading}
											className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-xl transition-colors disabled:opacity-50"
										>
											{testPushLoading ? (
												<RefreshCw className="w-3.5 h-3.5 animate-spin" />
											) : (
												<Send className="w-3.5 h-3.5" />
											)}
											<span>Invia Notifica Push di Prova</span>
										</button>

										{testPushResult && (
											<div
												className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${
													testPushResult.success
														? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/30"
														: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/30"
												}`}
											>
												{testPushResult.success ? <Check className="w-3.5 h-3.5" /> : null}
												<span>{testPushResult.msg}</span>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Personalizzazione Barra e Mappa Schermate */}
					<div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-200 dark:border-zinc-800 shadow-xs space-y-4">
						<div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
							<div className="flex items-center space-x-3">
								<div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
									<Layout className="w-5 h-5" />
								</div>
								<div>
									<h3 className="font-bold text-gray-900 dark:text-white text-sm">
										Barra di Navigazione & Schermate
									</h3>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Personalizza quali pagine visualizzare nella barra inferiore
									</p>
								</div>
							</div>

							<button
								onClick={() => setIsNavPopupOpen(true)}
								className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-colors cursor-pointer"
							>
								Personalizza
							</button>
						</div>

						{/* Schermate attualmente attive */}
						<div className="flex flex-wrap items-center gap-1.5">
							{navTabs.map((tabId) => {
								const screen = ALL_APP_SCREENS.find((s) => s.id === tabId);
								if (!screen) return null;
								return (
									<span
										key={tabId}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-700"
									>
										{screen.name}
									</span>
								);
							})}
						</div>

						{/* Collegamento diretto a Piano Pasti */}
						<div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
							<button
								onClick={() => router.push("/piano-settimanale")}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
							>
								<CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
								<span>Apri Piano Pasti Settimanale →</span>
							</button>
							<span className="text-[11px] text-gray-400">
								Puoi aggiungerlo alla barra tramite &ldquo;Personalizza&rdquo;
							</span>
						</div>
					</div>

					{/* Collegamento Sottopagina Strumenti Sviluppatore & MCP */}
					<button
						onClick={() => router.push("/profilo/sviluppo")}
						className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 rounded-2xl border border-gray-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-800/60 transition-all group shadow-xs text-left"
					>
						<div className="flex items-center space-x-3.5">
							<div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shrink-0">
								<Code2 className="w-5 h-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold text-gray-900 dark:text-white text-sm">
										Strumenti Sviluppatore & MCP
									</span>
									<span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
										Dev
									</span>
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Server MCP per Antigravity, diagnostica database e cache offline.
								</p>
							</div>
						</div>
						<ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
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

			{/* Modal di Personalizzazione Barra di Navigazione */}
			<NavCustomizationPopup
				isOpen={isNavPopupOpen}
				onClose={() => setIsNavPopupOpen(false)}
				currentTabs={navTabs}
				onTabsUpdated={(newTabs) => setNavTabs(newTabs)}
			/>
		</div>
	);
}
