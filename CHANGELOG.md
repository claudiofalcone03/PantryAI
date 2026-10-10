# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file seguendo il formato [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e la specifica [Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/).

---

## [Unreleased] - In Sviluppo (Ramo `dev`)

### Added
- **Fotocamera e Scanner Dual-Mode**: Supporto a doppia modalità (Barcode standard vs Foto con IA) in [`BarcodeScannerPopup`](components/popups/BarcodeScannerPopup.tsx).
- **Controlli Hardware Fotocamera**: Supporto a torcia (`torch`) su dispositivi compatibili e switch rapido tra fotocamera posteriore e frontale.
- **Feedback Sensoriale Avanzato**: Segnale sonoro sintetizzato in real-time tramite Web Audio API (senza asset audio esterni), vibrazione aptica (`navigator.vibrate`) e mirino con scansione laser verde animata.
- **Smart Vision Multi-Alimento & OCR Scadenze**: Server Action `analyzeImageProducts` in [`lib/genkit/genkit.ts`](lib/genkit/genkit.ts) per rilevamento simultaneo di alimenti multipli, estrazione data di scadenza stampata su etichetta e stima automatica della shelf-life per prodotti freschi/sfusi.
- **Review Sheet di Selezione Smart Vision**: Nuovo componente [`VisionReviewSheetPopup`](components/popups/VisionReviewSheetPopup.tsx) per ispezionare, confermare o deselezionare gli alimenti rilevati dallo scatto prima dell'importazione.
- **Coda di Inserimento Sequenziale Guidata**: Integrazione della modalità coda in [`ProductAddPopup`](components/popups/ProductAddPopup.tsx) con indicatore di avanzamento ("Prodotto X di Y"), campi precompilati dall'IA, tasto "Salva e Continua" e opzione "Salta questo".
- **Modale Gestione Categorie Dedicata**: Componente [`ManageCategoriesPopup`](components/popups/ManageCategoriesPopup.tsx) accessibile direttamente dall'inventario per creare e rimuovere categorie personalizzate su Firestore.
- **Filtri Avanzati nell'Inventario**: Chip rapido "In Scadenza" ($\le 3$ giorni o aperti), contatori di giacenza in tempo reale per ogni categoria della dispensa e pulsante di configurazione rapida.
- **Riprogettazione Mobile-First Card Alimenti**: Ridimensionamento compatto di tutti i pulsanti operativi (28-32px) e stepper quantità in [`ProductListItem`](components/items/ProductListItem.tsx) e [`ShoppingListItem`](components/items/ShoppingListItem.tsx), liberando spazio orizzontale e garantendo la leggibilità dei nomi degli alimenti per intero su smartphone.
- **Pallino Stato Spostato a Destra**: Indicatore colorato di scadenza e freschezza (verde, giallo, rosso) riposizionato all'estrema destra della card dopo i pulsanti d'azione per una visualizzazione pulita e intuitiva.
- **Icone Alimenti Personalizzate & Sistema Ibrido**: Nuovo dizionario semantico in [`lib/utils/foodIcons.ts`](lib/utils/foodIcons.ts) con emoji alimentari a colori, fallback automatico su categoria e selettore popover integrato nelle modali di creazione ([`ProductAddPopup`](components/popups/ProductAddPopup.tsx)) e modifica ([`ProductEditPopup`](components/popups/ProductEditPopup.tsx)).
- **Auto-Assegnazione Intelligente Icone Esistenti**: Funzione in background che rileva e assegna in automatico l'icona/emoji più idonea a tutti gli alimenti già salvati nel database Firestore della dispensa.
- **Sidebar Fissa per Desktop ([`DesktopSidebar`](components/layout/DesktopSidebar.tsx))**: Navigazione laterale desktop (`≥ md`) con logo PantryAI, icone di sezione intuitive, scorciatoia rapida assistente vocale AI e profilo utente; barra mobile [`DownNavbar`](components/layout/DownNavbar.tsx) preservata esclusivamente per smartphone.
- **Desktop Header Ispirato a PantryFlow**: Nuova testata in [`/inventario`](app/(app)/inventario/page.tsx) con nome dispensa, contatore totale articoli, pulsante primario verde smeraldo *"+ Aggiungi Articolo"*, tasto fotocamera scanner, tasto ordinamento, switch vista (`⊞` Griglia vs `☰` Lista) e campanella notifiche scadenze.
- **Doppia Riga Filtri Categorie & Disponibilità**: Riga 1 con chip categorie arricchiti da emoji e contatori realtime; Riga 2 con chip di disponibilità e stato (*Tutti*, *Disponibili*, *In esaurimento*, *Terminati*, *Congelati*, *In scadenza*).
- **Modalità di Visualizzazione Lista vs Griglia**: Supporto a Vista Lista predefinita (schede orizzontali compatte su colonna singola) e Vista Griglia multi-colonna (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) con persistenza della preferenza su `localStorage`.
- **Dashboard Impostazioni a 2 Colonne ([`app/(app)/profilo/page.tsx`](app/(app)/profilo/page.tsx))**: Riorganizzazione dell'area impostazioni in una dashboard desktop a 2 colonne (`max-w-6xl`) con profilo e azioni rapide a sinistra, gestione dispense, notifiche push PWA e personalizzazione della navigazione mobile a destra.
- **Dashboard Spreco & CO₂ con 3 KPI ([`app/(app)/spreco/page.tsx`](app/(app)/spreco/page.tsx))**: Testata desktop dedicata, griglia superiore a 3 card KPI (CO₂ Evitata, CO₂ Sprecata, Efficienza Dispensa con progress bar visiva) e storico eventi esteso ad alta leggibilità.
- **Desktop Header Lista Spesa ([`app/(app)/lista-della-spesa/page.tsx`](app/(app)/lista-della-spesa/page.tsx))**: Testata desktop allineata all'inventario con pulsanti smeraldo, scanner, voce e completamento spesa unificato, con container allargato a `max-w-5xl`.
- **Rimozione Overlay Assistente Vocale su Desktop ([`app/(app)/layout.tsx`](app/(app)/layout.tsx))**: Il pulsante flottante `GlobalVoiceFab` è ora nascosto sui monitor desktop (`md:hidden`) evitando sovrapposizioni visive sul contenuto, pur restando attivo su smartphone e accessibile su desktop dalla sidebar.
- **Assistente AI Desktop Split View & Ancoraggio Deterministico Flexbox**: Architettura a pannello laterale a tutta altezza (`md:h-screen md:overflow-hidden`) con due sezioni di scorrimento completamente separate. Nelle pagine dell'app (Inventario, Spesa, Spreco, Ricettario, Profilo) la barra superiore del titolo e i blocchi ricerca/filtri sono permanentemente ancorati in cima (`shrink-0 z-20` / `shrink-0 z-10`), mentre la lista dei prodotti/contenuti è l'unica area che scorre (`flex-1 min-h-0 overflow-y-auto`). Il pannello del chatbot a destra rimane fisso e immobile nel viewport a 100vh con la sola area messaggi scrollabile internamente. Zero trascinamento, slittamento o accavallamento visivo quando si scorre la lista della dispensa.
- **Scorciatoia da Tastiera Assistente AI**: Supporto alla combinazione `Cmd+J` / `Ctrl+J` per aprire e chiudere istantaneamente il pannello affiancato dell'assistente da desktop, in pieno stile IDE.
- **Modalità Ibrida Mobile/Desktop Unificata**: [`AssistantChatModal`](components/assistant/AssistantChatModal.tsx) supporta sia `mode="docked"` (senza backdrop, integrato nella griglia flessibile desktop) sia `mode="modal"` (bottom sheet sovrapposto a schermo intero `z-[70]` su mobile), con registrazione audio `MediaRecorder` + trascrizione Gemini integrati.
- **Modale 'Ordina e Filtra' Dedicata ([`SortFilterPopup`](components/popups/SortFilterPopup.tsx))**: Ordinamento alfabetico (A-Z / Z-A), per scadenza più vicina/lontana, per quantità crescente/decrescente e per inserimenti recenti, combinabile con filtri rapidi di stato.
- **Avatar Profilo Mobile & Barra 5 Slot Unificata**: Nuovo componente [`MobileProfileButton`](components/layout/MobileProfileButton.tsx) in alto a destra negli header delle schermate smartphone, allineando perfettamente i 5 slot principali su Mobile ([`DownNavbar`](components/layout/DownNavbar.tsx)) e Desktop ([`DesktopSidebar`](components/layout/DesktopSidebar.tsx)): Dispensa, Spesa, Pasti, Ricettario, Spreco & CO₂.
- **Accesso Rapido Piano Pasti nel Ricettario**: Pulsante pill dedicato *"📅 Piano Pasti"* nell'header di [`/ricettario`](app/(app)/ricettario/page.tsx) sia su desktop che su mobile.
- **Risoluzione Spazio Vuoto Chatbot Mobile**: Eliminazione del padding inferiore ridondante (`pb-24` -> `pb-2 sm:pb-6`) in `/ricettario`, ancorando ergonomicamente l'input dello Chef AI sopra la navbar mobile.
- **Modalità Ibrida 'Aggiungi alla Spesa' su Desktop**: Nuovo popup [`AddToShoppingListDesktopModal`](components/popups/AddToShoppingListDesktopModal.tsx) con ricerca live tra i cibi censiti in dispensa (aggiunta 1-click) e opzione per creare un nuovo prodotto non a magazzino.
- **Rimozione Comando Vocale nella Lista Spesa**: Rimossi i tasti microfono e la modale di dettatura vocale da [`/lista-della-spesa`](app/(app)/lista-della-spesa/page.tsx).
- **Pulsante Fluttuante Draggable ([`GlobalVoiceFab`](components/voice/GlobalVoiceFab.tsx))**: Supporto completo al trascinamento fluido su smartphone e desktop touch con pointer capture, vincoli di sicurezza perimetrali (sopra la barra di navigazione) e salvataggio automatico della posizione personalizzata in `localStorage`.
- **Risoluzione Sovrapposizione AI Conversazionale**: Spostato il pulsante dello Chef Live da dentro la riga di invio chat a una pill dedicata in evidenza subito sopra la barra di digitazione in [`/ricettario`](app/(app)/ricettario/page.tsx), liberando completamente l'angolo inferiore destro.
- **Azzeramento Automatico Data di Scadenza a Quantità Zero**: Regola di business attiva in [`lib/firestore/products.ts`](lib/firestore/products.ts) e [`lib/offline/syncManager.ts`](lib/offline/syncManager.ts): quando la quantità di un alimento si riduce a zero, la data di scadenza viene azzerata per prevenire notifiche o alert spuri su alimenti esauriti.
- **Calendario Pasti Adattivo & Auto-Centraggio ([`app/(app)/piano-settimanale/page.tsx`](app/(app)/piano-settimanale/page.tsx))**: Riduzione larghezza minima pulsanti giorno (`min-w-[50px]`) e auto-scroll fluido immediato sul giorno corrente di oggi (o selezionato), rendendo tutti i 7 giorni (inclusi Sabato e Domenica) sempre visibili e raggiungibili.
- **Simulatore Desktop 1:1 e Switch Intelligente Navigazione ([`NavCustomizationPopup`](components/navigation/NavCustomizationPopup.tsx))**: Auto-rilevamento all'apertura del tipo di dispositivo (desktop vs smartphone) con precaricamento della modalità pertinente e switch segmentato interattivo (`📱 Barra Mobile` vs `💻 Sidebar Desktop`). Simulazione realistica verticale della sidebar desktop con logo, voci link ordinate e footer, oltre all'anteprima della barra inferiore mobile.
- **Preferenze Indipendenti Mobile & Desktop su Cloud Firestore**: Supporto a due set di navigazione distinti memorizzati su Firestore (`userProfileNavTabs` e `userProfileDesktopNavTabs`): vincolo 3-5 schermate su mobile per ergonomia d'uso; vincolo 2-8 schermate su desktop per massima scalabilità. Aggiornamento reattivo immediato sia di [`DesktopSidebar`](components/layout/DesktopSidebar.tsx) sia di [`DownNavbar`](components/layout/DownNavbar.tsx).

### Security
- **Hardening Regole Cloud Firestore (`firestoreCLI/firestore.rules`)**:
  - Eliminata la vulnerabilità di takeover IDOR su `/pantries/{pantryId}`, restringendo gli aggiornamenti operativi all'owner e ai membri comprovati, e vincolando l'unione via codice esclusivamente all'array `pantryMembers`.
  - Blindato l'aggiornamento dei profili `/users/{userId}`, impedendo la modifica non autorizzata di dispense altrui.
  - Immutabilità rafforzata per `productPantryId` e `listItemPantryId` per prevenire migrazioni fraudolente di alimenti tra dispense.
- **Protezione Path Traversal & CSV Injection**:
  - Whitelist a runtime `ALLOWED_METRIC_CATEGORIES` su `POST /api/log-performance` e [`lib/performance-logger.ts`](lib/performance-logger.ts).
  - Sanitizzazione dei valori registrati contro formula injection CSV e gestione trasparente in ambiente Vercel Serverless (read-only filesystem).
  - **Master Switch & Disattivazione Telemetria Prestazionale**: Aggiunta variabile d'ambiente `NEXT_PUBLIC_ENABLE_PERFORMANCE_LOGS` (default: `false` / `off`) per azzerare completamente l'overhead di logging. Quando disattivato, i wrapper client/server (`withClientPerformanceTracking`, `withServerPerformanceTracking`) eseguono direttamente il codice senza alcuna misurazione, `fetch` o I/O su disco.
  - **Risoluzione Loop di Re-Rendering su Localhost**: Configurato `watchOptions.ignored` in [`next.config.ts`](next.config.ts) escludendo `**/performance-data/**` dal file watcher di Next.js per prevenire loop infiniti di Hot Module Replacement / Fast Refresh. Pulizia e ripristino dei file CSV storici.
- **Hardening Modulo Vocale & Google AI Studio (Strix Code Audit)**:
  - **Difesa SSRF & DoS**: Blocco di schemi non-data (`http:`, `https:`, `file:`) in `audioBase64`, limite dimensione payload a 15MB e whitelist MIME types in [`transcribeAndParseVoiceInput`](lib/genkit/genkit.ts).
  - **Mitigazione Prompt Injection & Integrità Dati**: Sanitizzazione delle categorie della dispensa contro iniezioni nel prompt, troncamento sicuro dei nomi prodotti ($\le 100$ caratteri) e capping numerico delle quantità ($\le 999$).
  - **Controllo di Accesso Live Config**: Gatekeeping con token di sessione utente in [`getGeminiLiveConfig`](lib/genkit/genkit.ts) per prevenire l'esposizione o l'abuso non autorizzato della chiave API server in produzione.
  - **Resilienza Audio Client & Buffer Overflow**: Capping a 50 chunk massimi del buffer circolare `outputAudioQueue` in [`GeminiLiveClient`](lib/audio/geminiLiveClient.ts) e sanificazione di valori non finiti (`NaN`, `Infinity`) durante il downsampling a 16kHz PCM.

- **Smart Voice Dictation & Parser NLP**:
  - Server Action `transcribeAndParseVoiceInput` in [`lib/genkit/genkit.ts`](lib/genkit/genkit.ts) con trascrizione audio ad alta precisione e categorizzazione automatica multi-alimento in base alle categorie della dispensa.
  - **Riconoscimento Intelligente Alimenti Esistenti in Dispensa (Pantry-Aware Voice Parsing)**: L'IA verifica la presenza degli alimenti dettati rispetto alle scorte attuali. Se il prodotto è già presente, propone l'azione automatica `update_quantity` sommando la quantità dettata a quella presente (`Attuale: X → Nuovo: Y`), con fallback deterministico fuzzy per garantire affidabilità al 100%. Se è assente, lo contrassegna chiaramente come `create_new` ("✨ Nuovo alimento").
  - Componente [`VoiceDictationModal`](components/voice/VoiceDictationModal.tsx) aggiornato con badge visivi distintivi (già in dispensa vs nuovo alimento), pulsante interattivo per convertire l'azione ("Crea nuovo lotto" vs "Aggiorna esistente"), stepper `+/-` per ritoccare le quantità e CTA dinamico.
  - In [`/inventario`](app/(app)/inventario/page.tsx): aggiornamento diretto e immediato delle quantità su Firestore per i prodotti già esistenti, e accodamento guidato in [`ProductAddPopup`](components/popups/ProductAddPopup.tsx) solo per i prodotti nuovi per consentire l'inserimento rapido di data di scadenza e categoria.
  - Integrazione pulsante microfono in [`/lista-della-spesa`](app/(app)/lista-della-spesa/page.tsx) per aggiunta immediata alla spesa, in [`/inventario`](app/(app)/inventario/page.tsx) per inserimento a catena nella coda, e in [`/ricette-ai`](app/(app)/ricette-ai/page.tsx) per dettatura del prompt.
- **Live Voice Chef (Gemini Multimodal Live API)**:
  - Client WebSocket streaming bidirezionale [`GeminiLiveClient`](lib/audio/geminiLiveClient.ts) conforme alle specifiche Google AI Studio: endpoint ufficiale `v1beta`, modello live **`gemini-3.8-live`** (allineato alla dashboard di Google AI Studio), downsampling microfonico a 16kHz PCM Int16 e riproduzione fluida di chunk audio sintetizzati a 24kHz Float32.
  - Floating pill bar persistente [`LiveVoiceChefBar`](components/voice/LiveVoiceChefBar.tsx): forma d'onda reattiva al parlato, indicatori di stato, pulsante mute/unmute, drawer espandibile con trascrizione e terminazione pulita.
  - **Allineamento Z-Index e Posizionamento Viewport**: Corretto il posizionamento inferiore della floating bar (`bottom-20` su desktop e `calc(4.5rem + safe-area)` su mobile con `z-[55]`) e innalzato il livello dei popup modali a `z-[60]`, impedendo che la barra o i modali vocali vengano coperti o nascosti dalla navbar inferiore fissa (`DownNavbar`).
  - Contesto globale [`LiveChefProvider`](context/LiveChefContext.tsx) integrato in [`app/(app)/layout.tsx`](app/(app)/layout.tsx) che garantisce la persistenza dell'assistente audio durante la navigazione libera tra le pagine.
  - Pulsante dedicato *"Chef a mani libere (Live)"* con iniezione dinamica della dispensa in [`/ricette-ai`](app/(app)/ricette-ai/page.tsx).

### Planned
- **PWA Avanzata**: Web Push Notifications per allarmi di scadenza e affinamento strategie di caching Serwist.
- **Server MCP PantryAI**: Esposizione di strumenti di gestione dispensa per agenti IA esterni.

---

## [1.0.0-tesi] - 2026-10-02

### Added
- **Tracciamento Architetturale Interattivo (Archify)**: Diagramma interattivo completo di runtime salvato in [`docs/architecture/tesi-runtime-architecture.html`](./docs/architecture/tesi-runtime-architecture.html) e specifica dichiarativa [`docs/architecture/tesi-runtime-architecture.json`](./docs/architecture/tesi-runtime-architecture.json).
- **Mobile-First PWA**: Implementazione con Next.js 16, React 19 e Serwist (offline-first, precaching App Shell).
- **Scanner Barcode ad alte prestazioni**: Riconoscimento barcode EAN/UPC a 60 fps con `html5-qrcode` e interrogazione Open Food Facts.
- **Calcolo Dinamico Shelf-life**: Doppia validità con scadenza convenzionale e post-apertura (`productOpenedExpiryAt`).
- **Chef AI (Google Genkit & Gemini 3.1 Flash Lite)**: Flussi di generazione ricette anti-spreco da scadenze imminenti e chatbot interattivo con contesto della dispensa.
- **Modello NoSQL Firestore**: Architettura multi-dispensa query-driven con ruoli (`owner`, `editor`), cronologia sprechi/consumi e lista della spesa collaborativa.
- **Metriche di Sostenibilità & Telemetria**: Tracciamento $CO_2$ risparmiata (Agribalyse), classificazione spreco vs alimenti salvati e log prestazionali per benchmark scientifico.
