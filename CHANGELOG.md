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
