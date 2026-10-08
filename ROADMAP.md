# 🗺️ Roadmap di Sviluppo & Guida di Progetto (Ramo `dev`)

> **Promemoria per le sessioni future**: Questo documento riassume le decisioni architetturali, la baseline della versione Tesi e la roadmap di sviluppo concordata. È progettato per consentire a qualsiasi sviluppatore o assistente AI di riprendere immediatamente il lavoro sul ramo `dev`.

---

## 📌 1. Contesto & Baseline
- **Repository**: PantryAI (`claudiofalcone03/PantryAI`)
- **Ramo di sviluppo attivo**: `dev`
- **Baseline Accademica / Tesi**:
  - Congelata nel ramo `Tesi` e contrassegnata dal tag release annotato `v1.0.0-tesi`.
  - Tracciamento architetturale completo disponibile nel diagramma interattivo Archify: [`docs/architecture/tesi-runtime-architecture.html`](./docs/architecture/tesi-runtime-architecture.html) (specifica: [`docs/architecture/tesi-runtime-architecture.json`](./docs/architecture/tesi-runtime-architecture.json)).
- **Stack Tecnologico Corrente**:
  - **Framework**: Next.js 16.2.6 (App Router) + React 19.2.4
  - **PWA / Service Worker**: Serwist 9.5.11 (Offline-First)
  - **Database & Auth**: Firebase Authentication + Cloud Firestore NoSQL
  - **AI Engine**: Google Genkit SDK 1.39.0 (`@genkit-ai/google-genai`), modello `gemini-3.1-flash-lite`
  - **Scanner Ottico**: `html5-qrcode` (60 fps) + Open Food Facts API (metadati & $CO_2$ Agribalyse)
  - **Styling**: Tailwind CSS v4
  - **Hosting Target**: Vercel (uso personale iniziale con design modulare e scalabile per futura pubblicazione)

---

## 🎯 2. Obiettivi & Decisioni Architetturali

### A. Deploy su Vercel & PWA Avanzata
- **PWA Mobile-First**:
  - Cache avanzata (strategie differenziate per asset statici vs dati dinamici con fallback offline).
  - **Web Push Notifications**: avvisi automatici di scadenza imminente alimenti, alert scorte minime, promemoria lista spesa.
  - Background Sync per sincronizzare le azioni offline una volta ripristinata la connettività.
- **Serverless su Vercel**:
  - Rispetto dei limiti serverless di Vercel (timeout esecuzione, gestione Edge vs Node runtime).
  - Gestione sicura delle variabili d'ambiente (Firebase client/admin, Google AI Studio API key).

### B. Sicurezza Rigorosa (Strix Security Suite)
- **Strix Code Audit & OWASP Top 10**:
  - Verifica della superficie di attacco su App Router, Server Actions e API routes.
  - Audit delle Firestore Security Rules (`firestore.rules`) per isolamento multi-tenant dei dati delle dispense.
- **Strix Web/API Pentest**:
  - Test dinamico di iniezione, privilege escalation tra membri della stessa dispensa, data leakage e rate limiting.
- **Strix CI Security**:
  - Pipeline GitHub Actions con secret scanning, linting di sicurezza e dependency check automatici.

### C. Google AI Studio: Audio Transcribe & Multimodal Live API
- **Gemini Flash Audio Transcribe**:
  - Inserimento rapido "a voce" di alimenti e note nella spesa tramite trascrizione vocale rapida (speech-to-text ultra-veloce ed economico).
- **Gemini Multimodal Live API (Dialogo Interattivo a Mani Libere)**:
  - Assistente culinario realtime vocale bidirezionale (Live WebSocket / WebRTC): permette di cucinare interagendo vocalmente senza sporcare lo schermo dello smartphone.
  - Gestione architetturale compatibile con Vercel (token effimeri o connessione diretta client-to-Gemini per ovviare all'assenza di WebSocket persistenti serverless).

### D. Potenziamento Fotocamera & Smart Vision
- **Scanner Barcode Hardware-Accelerated**:
  - Controllo avanzato della fotocamera: toggle torcia (flashlight/torch API), selezione fotocamera (ultra-wide/macro se disponibile), feedback tattile (vibrazione aptica) alla cattura.
- **Smart Vision (Gemini 2.5/3.x Multimodal Vision)**:
  - Modalità "Snap & Recognize": scattare foto alla dispensa/frigo o a un gruppo di ingredienti sfusi per estrarli e catalogarli automaticamente senza codice a barre.
  - Riconoscimento automatico della data di scadenza stampata su etichette e confezioni.

### E. Esposizione Server MCP (Model Context Protocol)
- Implementazione di un server MCP interno dedicato a PantryAI:
  - Esposizione di tool standardizzati (`get_inventory`, `add_item`, `get_expiring_products`, `manage_shopping_list`, `generate_recipe`).
  - Abilitazione dell'interoperabilità tra agenti esterni (Claude Desktop, IDE, assistenti vocali) e la dispensa dell'utente.

### F. Integrazione con l'App "Pantry Pal" & Categorie Personalizzate
- Categorie merceologiche dinamiche per dispensa (modificabili, ordinabili, icone/colori dedicati).
- Filtri veloci avanzati per data di scadenza, categoria, ubicazione (frigo, freezer, dispensa secca).
- Evoluzione verso Ricettario Persistito e Meal Planning settimanale.

---

## 📋 3. Piano Operativo per le Prossime Chat (Next Steps)

### Fase 1: Categorie Dinamiche, Filtri Avanzati & Fotocamera Dual-Mode ✅ (COMPLETATA)
1. **Fotocamera e Scanner Hardware Dual-Mode**:
   - Supporto a doppia modalità (Barcode standard vs Foto con IA) in [`BarcodeScannerPopup`](./components/popups/BarcodeScannerPopup.tsx).
   - Controlli hardware: Torcia (`torch`), commutazione fotocamera fronte/retro (`facingMode`).
   - Feedback sensoriale integrato: segnale audio sintetizzato Web Audio API, vibrazione aptica e linea laser animata.
   - Integrazione Server Action `identifyProductFromImage` con Gemini Multimodal Vision in [`lib/genkit/genkit.ts`](./lib/genkit/genkit.ts).
2. **Modale Gestione Categorie & Filtri Avanzati**:
   - Nuova modale dedicata [`ManageCategoriesPopup`](./components/popups/ManageCategoriesPopup.tsx) accessibile direttamente dall'inventario per aggiungere/eliminare categorie su Firestore.
   - Filtro rapido chip "In Scadenza" con calcolo della shelf-life effettiva ($\le 3$ giorni o aperti).
   - Chip categorie dinamiche con contatori di giacenza in tempo reale in [`app/(app)/inventario/page.tsx`](./app/(app)/inventario/page.tsx).

### Fase 2: Potenziamento Smart Vision Multi-Item & OCR Scadenze ✅ (COMPLETATA)
1. **Smart Vision All-in-One con Gemini**:
   - Server Action `analyzeImageProducts` in [`lib/genkit/genkit.ts`](./lib/genkit/genkit.ts) per rilevamento simultaneo fino a 8 alimenti.
   - Lettura OCR della data di scadenza stampata su etichette (`YYYY-MM-DD`).
   - Stima intelligente di conservazione (`shelfLifeDays`) per cibi freschi o sfusi senza etichetta.
2. **Review Sheet & Inserimento Sequenziale**:
   - Componente [`VisionReviewSheetPopup`](./components/popups/VisionReviewSheetPopup.tsx) per selezionare o escludere gli alimenti rilevati.
   - Coda di aggiunta guidata in [`ProductAddPopup`](./components/popups/ProductAddPopup.tsx) con badge step (*"Prodotto X di Y"*), precompilazione automatica e tasto per saltare singoli elementi.

### Fase 3: Strix Security Audit & Hardening ✅ (COMPLETATA)
1. **Hardening Regole Firestore (`firestoreCLI/firestore.rules`)**:
   - Eliminazione totale della vulnerabilità IDOR su `/pantries/{pantryId}` e blindatura dei profili `/users/{userId}`.
   - Prevenzione del takeover non autorizzato e immutabilità di `productPantryId` e `listItemPantryId`.
2. **Messa in sicurezza API Performance Logger**:
   - Whitelist runtime rigorosa contro Path Traversal su `POST /api/log-performance`.
   - Difesa contro CSV Injection e compatibilità Serverless con Vercel.

### Fase 4: Google AI Studio (Transcribe & Multimodal Live) ✅ (COMPLETATA)
1. **Analisi Limiti & Benchmark Modelli**:
   - Analisi quote Google AI Studio su screenshot e modelli attivi: `gemini-3.1-flash-lite` (15 RPM / 500 RPD), `gemini-3.5-transcribe` (500 RPD), modelli Live audio (`gemini-2.0-flash-exp` / `gemini-2.5-flash-native-audio-dialog` / `gemini-3-flash-live`).
2. **Smart Voice Dictation & Parser NLP**:
   - Server Action `transcribeAndParseVoiceInput` in [`lib/genkit/genkit.ts`](./lib/genkit/genkit.ts) per estrazione e categorizzazione istantanea di alimenti e quantità.
   - **Riconoscimento Intelligente Dispensa**: L'IA confronta i cibi dettati con le scorte esistenti (`existingProducts`), identificando se il prodotto è già a magazzino per incrementarne la quantità (`Attuale: X → Nuovo: Y`) oppure se suggerirne la creazione con inserimento guidato di scadenza. Fallback deterministico a doppio livello contro allucinazioni o mancate corrispondenze.
   - Componente [`VoiceDictationModal`](./components/voice/VoiceDictationModal.tsx) integrato in Spesa, Inventario e Chatbot Ricette con badge di stato, toggle azione e stepper quantità.
3. **Live Voice Chef Bidirezionale a Mani Libere (Gemini Multimodal Live API)**:
   - Client streaming WebSocket [`GeminiLiveClient`](./lib/audio/geminiLiveClient.ts) con gestione audio Web Audio API (in: 16kHz PCM, out: 24kHz PCM).
   - Floating pill bar persistente [`LiveVoiceChefBar`](./components/voice/LiveVoiceChefBar.tsx) sopra la navbar con equalizzatore reattivo, controlli mute e visualizzatore trascrizione espandibile.
   - Provider globale [`LiveChefProvider`](./context/LiveChefContext.tsx) in [`app/(app)/layout.tsx`](./app/(app)/layout.tsx) che garantisce la continuità della conversazione hands-free durante la navigazione libera tra le pagine.

### Fase 5: PWA Avanzata & Web Push Notifications ✅ (COMPLETATA)
1. **Infrastruttura Notifiche Push (FCM Web & Firebase Admin)**:
   - Client helper [`lib/notifications/fcmClient.ts`](./lib/notifications/fcmClient.ts) per richiesta permessi browser, recupero token push e registrazione su Firestore (`users/{uid}.fcmTokens`).
   - Gestione background nel Service Worker Serwist ([`app/sw.ts`](./app/sw.ts)) con intercettazione eventi `push` e navigazione mirata con `notificationclick` (apertura o focus finestra).
   - Service Worker di fallback [`public/firebase-messaging-sw.js`](./public/firebase-messaging-sw.js) per massima compatibilità cross-browser (Android Chrome, iOS Safari PWA).
   - Endpoint di test immediato [`app/api/notifications/test/route.ts`](./app/api/notifications/test/route.ts) con pulizia automatica dei token obsoleti (`messaging/registration-token-not-registered`).
   - Endpoint schedulabile Cron [`app/api/cron/check-expirations/route.ts`](./app/api/cron/check-expirations/route.ts) per scansione automatica scadenze alimenti e invio alert personalizzati.
2. **Pannello Configurazione Notifiche In-App**:
   - Sezione dedicata nella pagina Profilo ([`app/(app)/profilo/page.tsx`](./app/(app)/profilo/page.tsx)): toggle attivazione con stato permessi del browser, selettore soglia preavviso scadenze (0, 1, 2, 3 giorni), toggle avviso cibi aperti con shelf-life e tasto *"Invia Notifica di Prova"*.
3. **Offline-First & Coda di Sincronizzazione IndexedDB**:
   - Modulo [`lib/offline/indexedDb.ts`](./lib/offline/indexedDb.ts) per persistenza locale dell'inventario (`cachedProducts`), della spesa (`cachedShoppingItems`) e coda mutazioni offline (`mutationsQueue`).
   - Replay automatico delle azioni offline su riconnessione in [`lib/offline/syncManager.ts`](./lib/offline/syncManager.ts) (ascolto evento `online`).
   - Banner visivo reattivo non invasivo [`OfflineBanner`](./components/offline/OfflineBanner.tsx) integrato nel layout principale ([`app/(app)/layout.tsx`](./app/(app)/layout.tsx)).
   - Supporto offline integrato in [`app/(app)/inventario/page.tsx`](./app/(app)/inventario/page.tsx), [`components/items/ProductListItem.tsx`](./components/items/ProductListItem.tsx), [`app/(app)/lista-della-spesa/page.tsx`](./app/(app)/lista-della-spesa/page.tsx) e [`components/items/ShoppingListItem.tsx`](./components/items/ShoppingListItem.tsx).

### Fase 6: Server MCP PantryAI & Sottopagina Sviluppo ✅ (COMPLETATA)
1. **Endpoint Remoto JSON-RPC 2.0 / Streamable HTTP (`/api/mcp`) & Runner Stdio**:
   - Implementazione compatibile con deploy su Vercel e locale in [`app/api/mcp/route.ts`](./app/api/mcp/route.ts) e [`scripts/mcp-server.cjs`](./scripts/mcp-server.cjs).
   - Supporto handshake, protocol negotiation `2024-11-05`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`.
2. **Suite Completa dei Tool per Antigravity**:
   - **Inventario & Freezer**: `pantry_get_summary`, `pantry_list_items`, `pantry_add_item`, `pantry_update_item`, `pantry_open_item`, `pantry_freeze_item`, `pantry_unfreeze_item`, `pantry_consume_item`, `pantry_delete_item`.
   - **Lista Spesa**: `shopping_list_get`, `shopping_list_add`, `shopping_list_set_status`, `shopping_list_checkout`, `shopping_list_remove`.
   - **Chef AI & Ricette**: `recipes_suggest_anti_waste`, `recipes_chat`.
   - **Metriche & Storico**: `history_get_summary`.
   - **Dispense & Categorie**: `pantry_list_pantries`, `pantry_manage_categories`.
3. **Autenticazione con Token Personale Utente**:
   - Gestione token sicuro con rotazione e revoca in [`lib/firestore/userProfile.ts`](./lib/firestore/userProfile.ts).
   - Validazione token multi-tenant su Firestore via Firebase Admin SDK in [`lib/mcp/auth.ts`](./lib/mcp/auth.ts).
4. **Sottopagina Riservata per Sviluppo & Strumenti Tecnici**:
   - Nuova pagina dedicata [`app/(app)/profilo/sviluppo/page.tsx`](./app/(app)/profilo/sviluppo/page.tsx) accessibile dal Profilo: isola strumenti tecnici (token MCP, configurazione per Antigravity, log performance e diagnostica offline/push) mantenendo pulita l'interfaccia principale per l'utente finale.

### Fase 7: Gestione Alimenti Congelati (Freezer Mode) ✅ (COMPLETATA)
1. **Modello Dati Firestore & Calcolo Scadenza Estesa**:
   - Estensione schema `Product` in [`types/firestore/productType.ts`](./types/firestore/productType.ts): campi `isFrozen`, `productFrozenAt`, `productFrozenExpiryAt`, `originalExpiryDateBeforeFreeze`, `frozenMonthsDuration`.
   - Funzione [`getEffectiveExpiryDate`](./lib/firestore/pantries.ts) aggiornata per riconoscere lo stato congelato, evitando falsi positivi di scadenza e coordinando correttamente le notifiche push.
   - Funzioni [`freezeProduct`](./lib/firestore/products.ts) (salvataggio data confezione e calcolo durata freezer) e [`unfreezeProduct`](./lib/firestore/products.ts) (scelta tra consumo rapido entro 24-72h con status aperto o ripristino data originale).
2. **Componenti UI & Interazioni**:
   - Modale completa [`FreezeProductPopup`](./components/popups/FreezeProductPopup.tsx): slider per mesi di conservazione (1, 3, 6, 12 mesi o data libera), dialogo interattivo di scongelamento.
   - Riga prodotto [`ProductListItem`](./components/items/ProductListItem.tsx): badge visivo `❄️ Congelato`, etichetta di scadenza specifica e pulsante rapido `Snowflake` per congelare o scongelare con un tocco.
   - Form [`ProductAddPopup`](./components/popups/ProductAddPopup.tsx) e [`ProductEditPopup`](./components/popups/ProductEditPopup.tsx): toggle per conservazione diretta nel freezer con selezione durata.
   - Pagina [`InventarioPage`](./app/(app)/inventario/page.tsx): pulsante rapido `Snowflake` con badge numerico e chip `❄️ Freezer ({count})` che filtra istantaneamente i prodotti conservati a basse temperature.
3. **Offline-First & Server MCP**:
   - Mutazioni IndexedDB `FREEZE_PRODUCT` e `UNFREEZE_PRODUCT` registrate in [`lib/offline/indexedDb.ts`](./lib/offline/indexedDb.ts) e sincronizzate automaticamente da [`lib/offline/syncManager.ts`](./lib/offline/syncManager.ts).
   - Tool MCP dedicati `pantry_freeze_item`, `pantry_unfreeze_item`, filtro `only_frozen` e metriche nel summary in [`lib/mcp/tools.ts`](./lib/mcp/tools.ts) e [`scripts/mcp-server.cjs`](./scripts/mcp-server.cjs).

### Fase 8: Ricettario Persistito, Carosello & Controllo Vocale Globale ✅ (COMPLETATA)
1. **Controllo Vocale AI Sempre in Primo Piano (Global Voice FAB)**:
   - Nuovo componente [`GlobalVoiceFab`](./components/voice/GlobalVoiceFab.tsx) fluttuante in basso a destra sopra la barra di navigazione, integrato nel layout globale ([`app/(app)/layout.tsx`](./app/(app)/layout.tsx)).
   - Riconosce la pagina attiva (Inventario, Spesa, Ricettario) e apre istantaneamente [`VoiceDictationModal`](./components/voice/VoiceDictationModal.tsx) per aggiungere prodotti o dettare richieste con la voce mediante Gemini Flash Audio Transcribe.
2. **Evoluzione da 'Ricette AI' a 'Ricettario' (`/ricettario`)**:
   - Aggiornamento barra di navigazione [`DownNavbar`](./components/layout/DownNavbar.tsx) con voce *Ricettario* e icona `ChefHat`.
   - Reindirizzamento permanente da `/ricette-ai` alla nuova rotta `/ricettario`.
3. **Carosello di Ricette con Espansione Inline**:
   - Componente [`RecipeCarousel`](./components/recipes/RecipeCarousel.tsx) nella parte alta con doppia vista: *"Le mie ricette"* (salvate) e *"Idee Anti-Spreco"* (generate automaticamente dagli ingredienti in scadenza nella dispensa).
   - Componente [`RecipeInlineDetail`](./components/recipes/RecipeInlineDetail.tsx) per visualizzare ed espandere le ricette inline direttamente nella pagina sopra la chat (ingredienti con checklist interattiva, passaggi numerati, invio rapido ingredienti mancanti alla Spesa, toggle condivisione con la dispensa, eliminazione).
4. **Chatbot Conversazionale con Salvataggio Ricette su Firestore**:
   - Assistente Chef AI conversazionale nella parte inferiore con supporto testo, audio continuo e Gemini Multimodal Live API.
   - Pulsante rapido *"🔖 Salva nel Ricettario"* sotto ogni risposta ricetta dello Chef: estrazione strutturata ([`lib/recipes/recipeParser.ts`](./lib/recipes/recipeParser.ts)) e persistenza immediata su Firestore ([`lib/firestore/recipes.ts`](./lib/firestore/recipes.ts)) nel profilo utente con opzione di condivisione con la dispensa.

5. **Comandi Vocali Intelligenti Avanzati (Voice FAB & Backend NLP)**:
   - Modello di riconoscimento esteso in [`lib/genkit/genkit.ts`](./lib/genkit/genkit.ts) con azioni dirette:
     * `open_item`: *"ho aperto il latte"*, *"stappato"* -> imposta `isOpened`, calcola scadenza da `shelfLifeDays`.
     * `freeze_item`: *"congela la carne"*, *"metti il pollo nel freezer"* -> congela con durata stimata (default 3 mesi).
     * `unfreeze_item`: *"scongela il salmone"* -> scongela per consumo entro 48h.
     * `consume_item`: *"ho mangiato le uova"*, *"abbiamo finito il parmigiano"* -> decrementa quantità/elimina e registra nel log storico.
     * `add_to_shopping_list`: *"compra il burro"*, *"segna nella spesa la pasta"* -> aggiunge istantaneamente alla lista della spesa.
     * `update_quantity` & `create_new`: aggiunta/incremento intelligente con confronto deterministico della dispensa.
   - Helper lifecycle dedicati in [`lib/firestore/products.ts`](./lib/firestore/products.ts) (`openProduct`, `consumeProduct`) con fallback offline in IndexedDB (`lib/offline/indexedDb.ts`).
   - Componente [`VoiceDictationModal`](./components/voice/VoiceDictationModal.tsx) aggiornato con badge colorati per azione, pulsante ciclico per cambiare intenzione e stepper di quantità.
6. **Ricerca, Filtri Rapidi & Tag di Disponibilità nel Ricettario**:
   - Componente [`RecipeCarousel`](./components/recipes/RecipeCarousel.tsx) potenziato con:
     * Barra di ricerca testuale dinamica per titolo, descrizione o ingredienti.
     * Chip filtri rapidi: *"Tutte"*, *"⚡️ ≤ 25 min"*, *"🥗 Pronta in dispensa"*, *"Facile"*, *"Media/Difficile"*.
     * Toggle layout tra Carosello orizzontale e Griglia compatta a 2 colonne.
     * Calcolo disponibilità ingredienti in tempo reale rispetto alle giacenze effettive della dispensa con indicatori colorati (*"3/4 ingredienti in dispensa (75%)"*).
   - Componente [`RecipeInlineDetail`](./components/recipes/RecipeInlineDetail.tsx) con barra di avanzamento della disponibilità, badge per singolo ingrediente (*"In dispensa"* vs *"Mancante"*), pre-spunta automatica degli alimenti presenti e tasto dedicato per inviare alla spesa solo quelli mancanti.

### Fase 9: Personalizzazione Mappa Schermate & Meal Planning Settimanale Anti-Spreco ✅ (COMPLETATA)
1. **Personalizzazione Mappa Schermate & Barra di Navigazione**:
   - Modello dati utente ([`types/firestore/userProfileType.ts`](./types/firestore/userProfileType.ts)) arricchito con `userProfileNavTabs?: string[] | null`.
   - Modulo [`lib/firestore/userProfile.ts`](./lib/firestore/userProfile.ts) con definizione centralizzata `ALL_APP_SCREENS` (Inventario, Spesa, Ricettario, Piano Pasti, Spreco, Profilo), `DEFAULT_NAV_TABS` e funzione `updateNavTabsPreferences`.
   - Componente modale [`NavCustomizationPopup`](./components/navigation/NavCustomizationPopup.tsx) accessibile dalla pagina Profilo ([`app/(app)/profilo/page.tsx`](./app/(app)/profilo/page.tsx)): attiva/disattiva schermate e permette di riordinare le schede con frecce ↑/↓ e anteprima live.
   - Barra inferiore dinamica [`DownNavbar`](./components/layout/DownNavbar.tsx) sincrona e reattiva: doppio livello di persistenza (`localStorage` ad avvio istantaneo zero-layout-shift + Firestore), listener `nav-tabs-updated` e supporto completo alla nuova icona e rotta del Piano Pasti (`/piano-settimanale`).
2. **Architettura Dati & Modello Meal Planning**:
   - Schema tipizzato [`types/firestore/mealPlanType.ts`](./types/firestore/mealPlanType.ts): 4 slot giornalieri (`colazione`, `pranzo`, `merenda`, `cena`), supporto ricette collegate (`recipeId`, `recipeTitle`, `recipeIsAntiWaste`), porzioni, note e lista ingredienti.
   - Documento dedicato su Firestore `users/{userId}/mealPlans/{weekId}` e modulo [`lib/firestore/mealPlan.ts`](./lib/firestore/mealPlan.ts) con calcolo settimana ISO Lunedì-Domenica (`getWeekInfo`), `getWeeklyMealPlan`, `saveMealSlot`, `saveFullWeeklyMealPlan` e `clearWeeklyMealPlan`.
3. **Generatore IA Anti-Spreco Settimanale & Singolo Slot**:
   - Integrazione Gemini in [`lib/genkit/genkit.ts`](./lib/genkit/genkit.ts) tramite `generateAIAntiWasteWeeklyPlan`: pianificazione intelligente per tutti i 7 giorni che assegna gli ingredienti in scadenza nei primi giorni della settimana (Lunedì-Mercoledì) contrassegnandoli con badge anti-spreco.
   - Server action `generateSingleMealSuggestion` per suggerimenti mirati al volo per singolo slot e giorno.
4. **Componenti UI Dedicati**:
   - Card pasto interattiva [`MealSlotCard`](./components/meal-plan/MealSlotCard.tsx): slot vuoto o valorizzato, icone tematiche, badge `♻️ Salva-Spreco`, tempo preparazione, note e scorciatoia per consiglio IA.
   - Modale ibrida di assegnazione [`AssignMealModal`](./components/meal-plan/AssignMealModal.tsx): selezione a schede tra ricette salvate/condivise dal Ricettario, composizione piatto libero e proposta istantanea dello Chef AI.
   - Pannello di review della spesa [`WeeklyShoppingReviewModal`](./components/meal-plan/WeeklyShoppingReviewModal.tsx): aggregazione degli ingredienti della settimana, incrocio automatico con le scorte in dispensa, filtraggio tra "Mancanti" e "In dispensa", e aggiunta batch alla lista della spesa.
5. **Pagina Meal Planning Settimanale (`/piano-settimanale`)**:
   - Nuova rotta [`app/(app)/piano-settimanale/page.tsx`](./app/(app)/piano-settimanale/page.tsx): navigatore della settimana (`< Settimana Corrente >`), toggle vista giornaliera vs vista settimana completa, banner reattivo con avviso ingredienti a rischio, e pulsanti veloci *"Pianifica con IA Anti-Spreco"* e *"Genera Spesa"*.

---

*Documento aggiornato con le direttive architetturali per la scalabilità, Google AI Studio Live/Transcribe, Strix Security, PWA Push, MCP, Freezer Mode, Ricettario, Comandi Vocali Avanzati, Personalizzazione Mappa e Meal Planning Settimanale.*



