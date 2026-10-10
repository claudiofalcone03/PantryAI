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
import { updateNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, ALL_APP_SCREENS, DEFAULT_NAV_TABS, DEFAULT_DESKTOP_NAV_TABS } from "@/lib/firestore/userProfile";
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
	const [desktopNavTabs, setDesktopNavTabs] = useState<string[]>(DEFAULT_DESKTOP_NAV_TABS);
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
				let userDesktopTabs = DEFAULT_DESKTOP_NAV_TABS;

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

						if (data.userProfileDesktopNavTabs && Array.isArray(data.userProfileDesktopNavTabs) && data.userProfileDesktopNavTabs.length > 0) {
							userDesktopTabs = data.userProfileDesktopNavTabs;
						} else {
							const localDesktopTabs = typeof window !== "undefined" ? localStorage.getItem("user_desktop_nav_tabs") : null;
							if (localDesktopTabs) {
								try {
									const parsed = JSON.parse(localDesktopTabs);
									if (Array.isArray(parsed) && parsed.length > 0) userDesktopTabs = parsed;
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
				setDesktopNavTabs(userDesktopTabs);
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
			<div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
				<header className="px-4 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md shrink-0">
					<div className="max-w-6xl mx-auto flex items-center justify-between">
						<Skeleton className="h-8 w-48 rounded-xl" />
						<Skeleton className="h-6 w-24 rounded-full" />
					</div>
				</header>
				<main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 w-full max-w-6xl mx-auto">
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
						<div className="lg:col-span-4 space-y-4">
							<div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xs border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
								<Skeleton className="w-24 h-24 rounded-full mb-4" />
								<Skeleton className="h-6 w-36 mb-1" />
								<Skeleton className="h-4 w-48" />
							</div>
							<Skeleton className="h-14 w-full rounded-2xl" />
							<Skeleton className="h-14 w-full rounded-2xl" />
						</div>
						<div className="lg:col-span-8 space-y-6">
							<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
								<Skeleton className="h-6 w-40" />
								<PantryCardSkeleton />
								<PantryCardSkeleton />
							</div>
							<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-16 w-full rounded-xl" />
							</div>
						</div>
					</div>
				</main>
			</div>
		);
	}

	const currentPantryObj = pantries.find((p) => p.pantryId === userData?.currentPantryId);

	return (
		<div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
			{/* Mobile TopBar */}
			<div className="md:hidden shrink-0">
				<header className="sticky top-0 z-10 px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
							<Settings className="w-4 h-4" />
						</div>
						<h1 className="text-lg font-bold">Impostazioni</h1>
					</div>
					<span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-700">
						{pantries.length} {pantries.length === 1 ? "dispensa" : "dispense"}
					</span>
				</header>
			</div>

			{/* Desktop Header - PERMANENTEMENTE ANCORATO: shrink-0 */}
			<header className="hidden md:flex items-center justify-between py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 z-20">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
						<Settings className="w-5 h-5" />
					</div>
					<div>
						<div className="flex items-center gap-2.5">
							<h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
								Impostazioni & Profilo
							</h1>
							<span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
								{pantries.length} {pantries.length === 1 ? "dispensa attiva" : "dispense attive"}
							</span>
						</div>
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							Gestisci account, dispense condivise, notifiche push di scadenza e impostazioni dell&apos;interfaccia.
						</p>
					</div>
				</div>
			</header>

			{/* Main Content - UNICA AREA CHE SCORRE */}
			<main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 w-full max-w-6xl mx-auto">
				{/* Layout Dashboard a 2 Colonne su Desktop */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24">
					{/* COLONNA SINISTRA: Profilo & Azioni Account */}
					<div className="lg:col-span-4 space-y-4">
						{/* Card Profilo Utente */}
						<div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xs border border-zinc-200/90 dark:border-zinc-800/90 text-center relative overflow-hidden">
							<div className="w-24 h-24 mx-auto bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-4 overflow-hidden relative border-2 border-emerald-200 dark:border-emerald-800/60 shadow-xs">
								{userData?.photoURL ? (
									<Image
										src={userData.photoURL}
										alt="Foto profilo"
										fill
										className="object-cover"
										referrerPolicy="no-referrer"
									/>
								) : (
									<User className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
								)}
							</div>

							<h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
								{userData ? `${userData.name}`.trim() : "Caricamento..."}
							</h2>

							<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
								{userData?.email}
							</p>

							{/* Badge Dispensa Selezionata */}
							{currentPantryObj && (
								<div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-1.5">
									<span className="text-[11px] text-zinc-500">Dispensa attuale:</span>
									<span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
										{currentPantryObj.pantryName}
									</span>
								</div>
							)}
						</div>

						{/* Azioni Account & Scorciatoie */}
						<div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 shadow-2xs border border-zinc-200/90 dark:border-zinc-800/90 space-y-2">
							<button
								className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
								onClick={() => {}}
							>
								<div className="flex items-center space-x-3">
									<Pencil className="w-4 h-4 text-zinc-400" />
									<span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
										Modifica dati profilo (Prossimamente)
									</span>
								</div>
							</button>

							<button
								onClick={() => router.push("/profilo/sviluppo")}
								className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all text-left group"
							>
								<div className="flex items-center space-x-3">
									<Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
									<div>
										<span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
											Strumenti Sviluppatore & MCP
										</span>
										<span className="ml-1.5 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
											Server AI
										</span>
									</div>
								</div>
								<ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
							</button>

							<button
								className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
								onClick={() => {}}
							>
								<div className="flex items-center space-x-3">
									<FileDown className="w-4 h-4 text-zinc-400" />
									<span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
										Esporta dati (Prossimamente)
									</span>
								</div>
							</button>

							<div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
								<button
									onClick={handleLogout}
									className="w-full flex items-center justify-between p-3 rounded-2xl bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors cursor-pointer text-left"
								>
									<div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
										<LogOut className="w-4 h-4" />
										<span className="text-xs font-semibold">Disconnetti</span>
									</div>
								</button>

								<button
									className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-rose-50/40 dark:hover:bg-rose-950/10 text-left transition-colors"
									onClick={() => {}}
								>
									<div className="flex items-center space-x-3 text-zinc-400 hover:text-rose-500 text-xs">
										<Trash className="w-4 h-4" />
										<span>Elimina account (Prossimamente)</span>
									</div>
								</button>
							</div>
						</div>
					</div>

					{/* COLONNA DESTRA: Dispense, Notifiche, Navigazione */}
					<div className="lg:col-span-8 space-y-6">
						{/* Sezione Le tue Dispense */}
						<div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs overflow-hidden">
							<div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
										<Layers className="w-5 h-5" />
									</div>
									<div>
										<h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
											Le tue dispense
										</h2>
										<p className="text-xs text-zinc-500 dark:text-zinc-400">
											Visualizza, cambia dispensa attiva o gestisci i membri
										</p>
									</div>
								</div>
							</div>

							<div className="divide-y divide-zinc-100 dark:divide-zinc-800">
								{pantries.length === 0 ? (
									<div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
										Non sei ancora membro di nessuna dispensa. Creane una o unisciti a una dispensa esistente!
									</div>
								) : (
									pantries.map((pantry) => {
										const userRole =
											pantry.pantryMembers?.find((m) => m.memberId === auth.currentUser?.uid)
												?.memberRole || "membro";
										const isCurrent = userData?.currentPantryId === pantry.pantryId;

										return (
											<div
												key={pantry.pantryId}
												className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
											>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
															{pantry.pantryName}
														</h3>
														{isCurrent && (
															<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
																Attiva
															</span>
														)}
													</div>
													<div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
														<span className="capitalize">{userRole}</span>
														<span>•</span>
														<span className="font-mono text-[11px]">Codice: {pantry.pantryInviteCode}</span>
													</div>
												</div>

												<div className="flex items-center gap-1.5 shrink-0">
													<button
														onClick={() => handleSetCurrentPantry(pantry.pantryId)}
														className={`p-2 rounded-xl transition-all cursor-pointer ${
															isCurrent
																? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 shadow-2xs"
																: "text-zinc-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400 bg-zinc-100 hover:bg-emerald-50 dark:bg-zinc-800 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-zinc-700"
														}`}
														title={isCurrent ? "Dispensa corrente attiva" : "Imposta come dispensa corrente"}
													>
														<CheckCircle className="w-4 h-4" />
													</button>
													<button
														onClick={() => router.push(`/dispense/${pantry.pantryId}/impostazioni`)}
														className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
														title="Impostazioni dispensa"
													>
														<Settings className="w-4 h-4" />
													</button>
													<button
														onClick={() => handleCopyCode(pantry.pantryInviteCode)}
														className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
														title="Copia codice di accesso"
													>
														<Copy className="w-4 h-4" />
													</button>
													<button
														onClick={() => handleLeavePantry(pantry.pantryId)}
														className="p-2 text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 bg-zinc-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/30 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
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

							<div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row gap-3">
								<button
									onClick={handleCreatePantry}
									className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-colors font-semibold text-xs shadow-xs cursor-pointer"
								>
									<Plus className="w-4 h-4" />
									<span>Crea nuova dispensa</span>
								</button>
								<button
									onClick={handleJoinPantry}
									className="flex-1 flex items-center justify-center space-x-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 p-2.5 rounded-xl transition-colors font-semibold text-xs cursor-pointer"
								>
									<UserPlus className="w-4 h-4" />
									<span>Unisciti con codice</span>
								</button>
							</div>
						</div>

						{/* Card Notifiche Push & Promemoria Scadenze */}
						<div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs overflow-hidden">
							<div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
										<BellRing className="w-5 h-5" />
									</div>
									<div>
										<h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
											<span>Notifiche Push & Scadenze</span>
											<span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
												PWA
											</span>
										</h2>
										<p className="text-xs text-zinc-500 dark:text-zinc-400">
											Ricevi avvisi automatici quando gli alimenti stanno per scadere
										</p>
									</div>
								</div>
							</div>

							<div className="p-5 space-y-4">
								{/* Toggle attivazione notifiche */}
								<div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60">
									<div className="flex items-center space-x-3">
										{pushEnabled ? (
											<Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
										) : (
											<BellOff className="w-5 h-5 text-zinc-400 shrink-0" />
										)}
										<div>
											<p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
												{pushEnabled ? "Notifiche Push Attive" : "Notifiche Push Disattivate"}
											</p>
											<p className="text-[11px] text-zinc-500 dark:text-zinc-400">
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
										className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
											pushEnabled
												? "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
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

								{/* Preferenze avanzate (quando le notifiche sono attive) */}
								{pushEnabled && (
									<div className="space-y-3 pt-1">
										{/* Soglia giorni anticipo */}
										<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
											<div>
												<span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
													Preavviso Scadenza Alimenti
												</span>
												<span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
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
														className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
															notificationPrefs.notifyOnExpiryDays === days
																? "bg-amber-600 text-white shadow-xs"
																: "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
														}`}
													>
														{label}
													</button>
												))}
											</div>
										</div>

										{/* Toggle Cibi Aperti */}
										<label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 cursor-pointer">
											<div>
												<span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
													Avviso Cibi Aperti (Shelf-Life)
												</span>
												<span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
													Avvisami quando un alimento aperto sta per superare i giorni di consumo consigliati.
												</span>
											</div>
											<input
												type="checkbox"
												checked={Boolean(notificationPrefs.notifyOpenedProducts)}
												onChange={(e) => handleUpdateNotificationPrefs("notifyOpenedProducts", e.target.checked)}
												className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 shrink-0 ml-3"
											/>
										</label>

										{/* Pulsante invio notifica di prova */}
										<div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
											<button
												onClick={handleSendTestPush}
												disabled={testPushLoading}
												className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
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
													className={`text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 ${
														testPushResult.success
															? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/30 border border-emerald-200"
															: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/30 border border-rose-200"
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
						<div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs space-y-4">
							<div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
								<div className="flex items-center space-x-3">
									<div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
										<Layout className="w-5 h-5" />
									</div>
									<div>
										<h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
											Personalizzazione Navigazione (Mobile & Desktop)
										</h3>
										<p className="text-xs text-zinc-500 dark:text-zinc-400">
											Configura indipendentemente la barra inferiore smartphone e la sidebar desktop
										</p>
									</div>
								</div>

								<button
									onClick={() => setIsNavPopupOpen(true)}
									className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
								>
									Personalizza
								</button>
							</div>

							<div className="space-y-3">
								{/* Voci Mobile */}
								<div>
									<div className="flex items-center justify-between mb-1.5">
										<span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											📱 Barra Mobile ({navTabs.length} schermate)
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-1.5">
										{navTabs.map((tabId) => {
											const screen = ALL_APP_SCREENS.find((s) => s.id === tabId);
											if (!screen) return null;
											return (
												<span
													key={tabId}
													className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80"
												>
													{screen.name}
												</span>
											);
										})}
									</div>
								</div>

								{/* Voci Desktop */}
								<div>
									<div className="flex items-center justify-between mb-1.5">
										<span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											💻 Sidebar Desktop ({desktopNavTabs.length} schermate)
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-1.5">
										{desktopNavTabs.map((tabId) => {
											const screen = ALL_APP_SCREENS.find((s) => s.id === tabId);
											if (!screen) return null;
											return (
												<span
													key={tabId}
													className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80"
												>
													{screen.name}
												</span>
											);
										})}
									</div>
								</div>
							</div>

							<div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
								<button
									onClick={() => router.push("/piano-settimanale")}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
								>
									<CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
									<span>Apri Piano Pasti Settimanale →</span>
								</button>
								<span className="text-[11px] text-zinc-400">
									Riconoscimento automatico dispositivo con switch manuale
								</span>
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* Modal di Personalizzazione Barra di Navigazione */}
			<NavCustomizationPopup
				isOpen={isNavPopupOpen}
				onClose={() => setIsNavPopupOpen(false)}
				currentTabs={navTabs}
				currentDesktopTabs={desktopNavTabs}
				onTabsUpdated={(newMobile, newDesktop) => {
					setNavTabs(newMobile);
					if (newDesktop) setDesktopNavTabs(newDesktop);
				}}
			/>
		</div>
	);
}
