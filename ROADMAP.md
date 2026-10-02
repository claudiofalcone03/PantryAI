# 🗺️ Roadmap di Sviluppo & Guida di Progetto (Ramo `dev`)

> **Promemoria per le sessioni future**: Questo documento riassume le decisioni architetturali, la baseline della versione Tesi e la roadmap di sviluppo concordata nella sessione di allineamento con `/grill-me`. È progettato per consentire a qualsiasi sviluppatore o assistente AI di riprendere immediatamente il lavoro sul ramo `dev`.

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

---

## 🎯 2. Obiettivi & Decisioni Architetturali (Sessione `/grill-me`)

### A. Deploy su Vercel & PWA
- L'applicazione deve mantenere e rafforzare la natura **PWA Mobile-First** (installabile su smartphone senza store).
- L'architettura deve essere pienamente compatibile con il deployment serverless su **Vercel**:
  - Attenzione ai timeout di esecuzione serverless (supporto a flussi Genkit rapidi o in streaming).
  - Verifica della build Serwist su Vercel (`next build`).
  - Corretta gestione delle variabili d'ambiente di produzione (Firebase client, Gemini API Key, etc.).

### B. Rigore di Sviluppo & Documentazione
- Adozione di **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`).
- Mantenimento continuo di [`CHANGELOG.md`](./CHANGELOG.md) in conformità allo standard *Keep a Changelog*.
- Principio guida: **non stravolgere** l'eccellente base del progetto Tesi, ma arricchirlo modularmente con nuove feature.

### C. Integrazione con l'App "Pantry Pal" (Lovable)
- Pantry Pal dispone di strumenti e schemi MCP dedicati (`pantry-pal` server).
- **Priorità 1 Concordata**: **Gestione Categorie merceologiche personalizzate e Filtri Avanzati**.
  - Permettere agli utenti di aggiungere, rinominare o personalizzare le categorie della propria dispensa.
  - Filtri dinamici nell'inventario basati sulle categorie attive, stato di conservazione e urgenza di consumo.
- **Funzionalità per le fasi successive**:
  - *Ricettario Strutturato & Salvato*: salvare ricette persistite, con ingredienti, passaggi e calcolo ingredienti mancanti dalla dispensa.
  - *Meal Planning*: pianificazione pasti settimanale/giornaliera collegata alle giacenze reali.

### D. Visione & Evoluzione dei Flussi Genkit AI
- **Strutturazione dei Flussi**:
  - Transizione da chiamate dirette `ai.generate()` in `lib/genkit/genkit.ts` a flussi tipizzati formali con `ai.defineFlow()` e schemi di validazione **Zod** (input/output strutturato).
- **Cronologia Chat & Memoria Utente**:
  - Salvare e persistere la cronologia delle conversazioni dello Chef AI (su Firestore o sessione utente).
  - L'assistente deve costruire una memoria progressiva dell'utente in base alle sue richieste passate.
- **Gestione del Contesto & Preferenze Alimentari**:
  - Predisporre l'architettura per accogliere nella fase di onboarding/configurazione dell'app (e nella schermata profilo) le preferenze alimentari (es. diete vegetariana/vegana, intolleranze al lattosio/glutine, numero di componenti del nucleo familiare).
  - Iniettare dinamicamente tali preferenze nel system prompt dei flussi Genkit.

---

## 📋 3. Piano Operativo per le Prossime Chat (Next Steps)

Quando apri una nuova chat per continuare lo sviluppo, indica di partire dal punto seguente:

### Step 1: Categorie Personalizzate & Filtri Avanzati (Pantry Pal)
1. **Modello Dati Firestore**:
   - Estendere la gestione delle categorie nel documento `pantries/{pantryId}` (campo `pantryCategories`) o con funzioni dedicate in `lib/firestore/pantries.ts` e `lib/firestore/products.ts`.
   - Garantire retrocompatibilità con i prodotti già esistenti.
2. **UI & Filtri**:
   - Creare o aggiornare la modale/schermata di gestione categorie (es. in `app/(app)/dispense/[pantryId]/impostazioni` o modale dedicata).
   - Aggiornare i filtri veloci nella barra superiore di `app/(app)/inventario/page.tsx` per supportare le categorie dinamiche.

### Step 2: Refactoring Genkit AI Flows & Struttura Memoria
1. Ristrutturare `lib/genkit/genkit.ts` con flussi formali `ai.defineFlow`.
2. Definire lo schema per la persistenza della cronologia chat dello Chef AI.
3. Predisporre i campi per le preferenze alimentari dell'utente nel profilo.

### Step 3: Verifica Build & Preparazione Deploy Vercel
1. Eseguire `npm run build` e verificare l'output del service worker Serwist.
2. Configurare `vercel.json` o script di build per garantire un deploy fluido su Vercel.

---

*File generato automaticamente a conclusione della fase di baseline e allineamento.*
