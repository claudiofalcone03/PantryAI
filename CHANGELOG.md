# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file seguendo il formato [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e la specifica [Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/).

---

## [Unreleased] - In Sviluppo (Ramo `dev`)

### Planned
- **Categorie & Filtri Avanzati (Pantry Pal Integration)**: Adozione della gestione categorie merceologiche personalizzate e filtri avanzati da Pantry Pal.
- **Flussi Genkit AI Strutturati**: Refactoring ed espansione dei flussi Genkit (`ai.defineFlow`), predisposizione per cronologia chat persistita e memoria delle preferenze utente.
- **Ottimizzazione Vercel & PWA**: Standardizzazione configurazioni di deploy Vercel e verifica compatibilità runtime Serwist PWA.

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
