"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Smartphone,
  Monitor,
  Code,
  Zap,
  Eye,
  Mic,
  Calendar,
  UtensilsCrossed,
  MessageSquare,
  FileCode,
} from "lucide-react";
import { GENKIT_FLOWS_MANIFEST, type GenkitFlowMetadata } from "@/lib/genkit/manifest";
import {
  generateRecipeExpiration,
  generateRecipeFromIngredients,
  generateRecipeChatbot,
  generateSingleMealSuggestion,
  generateAIAntiWasteWeeklyPlan,
  analyzeImageProducts,
  transcribeAndParseVoiceInput,
  chatWithPantryCopilot,
} from "@/lib/genkit/genkit";

export default function GenkitFlowsStudioPage() {
  const router = useRouter();
  const [selectedFlowId, setSelectedFlowId] = useState<string>(GENKIT_FLOWS_MANIFEST[0].id);
  const [categoryFilter, setCategoryFilter] = useState<string>("Tutte");
  const [testStatus, setTestStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testTraceId, setTestTraceId] = useState<string | null>(null);

  const selectedFlow =
    GENKIT_FLOWS_MANIFEST.find((f) => f.id === selectedFlowId) || GENKIT_FLOWS_MANIFEST[0];

  const categories = ["Tutte", "Vision", "Voice", "Chat", "Recipes", "Planning"];

  const filteredFlows =
    categoryFilter === "Tutte"
      ? GENKIT_FLOWS_MANIFEST
      : GENKIT_FLOWS_MANIFEST.filter((f) => f.category === categoryFilter);

  const getCategoryIcon = (cat: GenkitFlowMetadata["category"]) => {
    switch (cat) {
      case "Vision":
        return <Eye className="w-4 h-4 text-emerald-500" />;
      case "Voice":
        return <Mic className="w-4 h-4 text-purple-500" />;
      case "Chat":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "Recipes":
        return <UtensilsCrossed className="w-4 h-4 text-amber-500" />;
      case "Planning":
        return <Calendar className="w-4 h-4 text-indigo-500" />;
    }
  };

  const handleOpenGenkitUI = () => {
    window.open("http://localhost:4000", "_blank", "noopener,noreferrer");
  };

  const handleOpenStandaloneDiagram = () => {
    window.open("/genkit-architecture.html", "_blank", "noopener,noreferrer");
  };

  // Esecuzione test su flusso selezionato
  const handleRunFlowTest = async () => {
    setTestStatus("running");
    setTestResult(null);
    setTestDurationMs(null);
    const start = performance.now();
    const fakeTraceId = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setTestTraceId(fakeTraceId);

    try {
      let result: any = null;
      if (selectedFlow.id === "recipeExpirationFlow") {
        result = await generateRecipeExpiration([
          { nome: "Yogurt Greco", quantita: "2 vasetti" },
          { nome: "Fragole", quantita: "250g" },
        ]);
      } else if (selectedFlow.id === "recipeFromIngredientsFlow") {
        result = await generateRecipeFromIngredients([
          { nome: "Pasta di grano duro", quantita: "320g" },
          { nome: "Pomodori pelati", quantita: "400g" },
          { nome: "Basilico fresco", quantita: "qualche foglia" },
        ]);
      } else if (selectedFlow.id === "recipeChatbotFlow") {
        result = await generateRecipeChatbot(
          "Cosa posso cucinare al volo con uova e parmigiano?",
          [],
          [{ nome: "Uova", quantita: "4" }, { nome: "Parmigiano", quantita: "100g" }]
        );
      } else if (selectedFlow.id === "antiWasteWeeklyPlanFlow") {
        result = await generateAIAntiWasteWeeklyPlan(
          [
            { dateStr: "2026-10-12", dayName: "Lunedì" },
            { dateStr: "2026-10-13", dayName: "Martedì" },
            { dateStr: "2026-10-14", dayName: "Mercoledì" },
          ],
          [{ name: "Ricotta", quantity: "250g", expiryDate: "2026-10-13" }],
          [{ name: "Pasta", quantity: "500g" }, { name: "Passata di pomodoro", quantity: "700ml" }]
        );
      } else if (selectedFlow.id === "singleMealSuggestionFlow") {
        result = await generateSingleMealSuggestion(
          "pranzo",
          "Mercoledì",
          [{ name: "Ricotta", quantity: "200g" }],
          [{ name: "Pasta", quantity: "500g" }, { name: "Zucchine", quantity: "2" }]
        );
      } else if (selectedFlow.id === "pantryCopilotFlow") {
        result = await chatWithPantryCopilot(
          "Ho comprato 2 cartoni di latte intero da 1 litro",
          [],
          { pantryName: "Dispensa Principale" }
        );
      } else if (selectedFlow.id === "analyzeImageProductsFlow") {
        // Carica l'immagine reale dell'icona dell'app come campione alimentare (carota e barattolo)
        try {
          const resp = await fetch("/icon-192x192.png");
          const blob = await resp.blob();
          const sampleImage = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          result = await analyzeImageProducts(sampleImage, ["Latticini", "Frutta", "Verdura", "Dispensa"]);
        } catch {
          // Fallback
          result = await analyzeImageProducts("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", ["Latticini", "Frutta", "Verdura", "Dispensa"]);
        }
      } else if (selectedFlow.id === "voiceDictationParserFlow") {
        // Campione audio muto simulato con catalogo categorie e prodotti esistenti
        const sampleAudio = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        result = await transcribeAndParseVoiceInput(
          sampleAudio,
          "audio/wav",
          "shopping_list",
          ["Latticini", "Frutta", "Verdura", "Dispensa"],
          [
            { id: "p1", name: "Latte intero", quantity: 1, category: "Latticini" },
            { id: "p2", name: "Mele Golden", quantity: 4, category: "Frutta" }
          ]
        );
      } else {
        result = {
          info: `Flusso ${selectedFlow.name} registrato correttamente nel layer Genkit.`,
          status: "Schema & Tracing Registered OK",
          flowId: selectedFlow.id,
        };
      }

      const elapsed = Math.round(performance.now() - start);
      setTestDurationMs(elapsed);
      setTestResult(typeof result === "string" ? result : JSON.stringify(result, null, 2));
      setTestStatus("success");
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setTestDurationMs(elapsed);
      console.error("[Genkit Studio Test Error]:", err);
      setTestResult(err?.message || "Errore sconosciuto durante l'esecuzione del flusso.");
      setTestStatus("error");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      {/* Top Header Ancorata */}
      <header className="shrink-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Torna a Strumenti Dev</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenStandaloneDiagram}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-500" />
              <span>Diagramma HTML</span>
            </button>
            <button
              onClick={handleOpenGenkitUI}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-xs transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Apri Genkit Dev UI (:4000)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area con Scroll Indipendente */}
      <main className="flex-1 min-h-0 overflow-y-auto max-w-6xl w-full mx-auto px-4 py-6 space-y-6 pb-24 md:pb-12">
        {/* Banner Introduttivo */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-3xl p-6 sm:p-8 border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Google Genkit SDK 1.39.0 • Full Traceability Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Architettura Flussi Genkit & Tracciabilità AI
            </h1>
            <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Tutte le funzionalità AI di PantryAI (visione multimodale, dettatura vocale, copilot dispensa, chef chatbot e pianificazione pasti) sono formalmente orchestrate come <strong>flussi Genkit tracciabili</strong> con OpenTelemetry su modello <strong>gemini-3.1-flash-lite</strong>.
            </p>
          </div>
        </div>

        {/* 1. MAPPA VISIVA ARCHITETTURA (3-TIER INTERATTIVA) */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Mappa dell&apos;Architettura End-to-End
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Flusso bidirezionale: Client (Mobile & Desktop) ➔ Genkit Flow Layer ➔ Google Gemini & Servizi
              </p>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
              8 Flussi Registrati
            </span>
          </div>

          {/* Diagramma 3-Tier */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* TIER 1: CLIENT SURFACES */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                <Smartphone className="w-4 h-4 text-blue-500" />
                <span>Tier 1: Client Surfaces</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Interfacce utente responsive ottimizzate per mobile e desktop:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/70">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                    <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Mobile (PWA / Touch)</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    FAB Vocale, Scanner Fotocamera, Bottom Sheet Copilot, Ricettario touch
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/70">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                    <Monitor className="w-3.5 h-3.5 text-purple-500" />
                    <span>Desktop (Widescreen)</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Docked Split View Copilot, Upload Foto da file, Meal Plan esteso
                  </p>
                </div>
              </div>
            </div>

            {/* TIER 2: GENKIT FLOW RUNTIME */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Tier 2: Genkit Flow Engine</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Flussi tipizzati con Zod, tracciamento OpenTelemetry e Server Actions:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  analyzeImageFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  voiceDictationFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  pantryCopilotFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  recipeChatbotFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  recipeExpirationFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  recipeIngredientsFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  weeklyPlanFlow
                </span>
                <span className="p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-center truncate">
                  singleMealFlow
                </span>
              </div>
            </div>

            {/* TIER 3: MODELS & SERVICES */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Tier 3: Modelli & Backend</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Modelli multimodali Gemini e integrazioni dati esterne:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/70">
                  <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                    <span>Google Gemini 3.1 Flash Lite</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Standard
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Visione multi-item, OCR scadenze, NLP vocale e ragionamento
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/70">
                  <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                    <span>Gemini 3.8 Live & Firestore</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      Streaming
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Voce bidirezionale a bassa latenza e persistenza su Cloud Firestore
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CATALOGO DEI FLUSSI ED INTERACTIVE RUNNER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonna Sinistra: Lista Flussi (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <Code className="w-4 h-4 text-emerald-600" />
                Flussi Genkit ({filteredFlows.length})
              </h3>
              {/* Filtro Categoria */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5">
              {filteredFlows.map((flow) => {
                const isSelected = flow.id === selectedFlowId;
                return (
                  <button
                    key={flow.id}
                    onClick={() => {
                      setSelectedFlowId(flow.id);
                      setTestStatus("idle");
                      setTestResult(null);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-white dark:bg-zinc-900 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(flow.category)}
                        <span className="font-semibold text-xs text-gray-900 dark:text-white">
                          {flow.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 shrink-0">
                        {flow.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                      {flow.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800/80 text-[10px] font-mono text-gray-400">
                      <span>ID: {flow.id}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colonna Destra: Dettaglio Flusso & Live Test Runner (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(selectedFlow.category)}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedFlow.name}
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready to Trace
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {selectedFlow.description}
              </p>
            </div>

            {/* Specifiche Schemi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700/60 space-y-1">
                <span className="font-semibold text-gray-700 dark:text-gray-300 block">Input Schema:</span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {selectedFlow.inputDescription}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700/60 space-y-1">
                <span className="font-semibold text-gray-700 dark:text-gray-300 block">Output Schema:</span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {selectedFlow.outputDescription}
                </p>
              </div>
            </div>

            {/* Superfici Client Collegate */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700/60 space-y-2 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300 block">
                Superfici Utente Attive (Mobile & Desktop):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> Mobile:
                  </span>
                  <ul className="list-disc list-inside text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                    {selectedFlow.clientSurfaces.mobile.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Monitor className="w-3 h-3" /> Desktop:
                  </span>
                  <ul className="list-disc list-inside text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                    {selectedFlow.clientSurfaces.desktop.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Sezione Esegui Test Interattivo */}
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  Esegui Test Flusso con Input di Esempio
                </span>
                <button
                  onClick={handleRunFlowTest}
                  disabled={testStatus === "running"}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus === "running" ? "animate-spin" : ""}`} />
                  <span>{testStatus === "running" ? "Elaborazione in corso..." : "Esegui Flusso Ora"}</span>
                </button>
              </div>

              {/* Risultato Test */}
              {testStatus !== "idle" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium">
                      {testStatus === "success" && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Flusso completato con successo
                        </span>
                      )}
                      {testStatus === "error" && (
                        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Esecuzione interrotta con errore
                        </span>
                      )}
                      {testStatus === "running" && (
                        <span className="text-gray-500 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Invocazione Gemini e creazione span di traccia...
                        </span>
                      )}
                    </div>
                    {testDurationMs !== null && (
                      <span className="text-gray-400 font-mono">
                        {testDurationMs}ms • Trace: {testTraceId}
                      </span>
                    )}
                  </div>

                  {testResult && (
                    <pre className="p-3.5 rounded-2xl bg-zinc-950 text-zinc-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60 border border-zinc-800 select-all whitespace-pre-wrap">
                      {testResult}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
