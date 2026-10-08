"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { X, Loader2, Zap, ZapOff, RefreshCw, Camera, Barcode, Sparkles } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { fetchProductByBarcode } from "@/lib/api/openFoodFacts";
import { analyzeImageProducts, type DetectedProductItem } from "@/lib/genkit/genkit";

interface BarcodeScannerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (
    productName: string,
    carbonFootprint?: number | null,
    detectedCategory?: string,
    detectedExpiryDate?: string,
    detectedShelfLifeDays?: number | null
  ) => void;
  pantryCategories?: string[];
  onMultipleProductsDetected?: (
    products: DetectedProductItem[],
    photoDataUrl: string
  ) => void;
}

type ScannerMode = "barcode" | "photo";

export function BarcodeScannerPopup({
  isOpen,
  onClose,
  onScanSuccess,
  pantryCategories,
  onMultipleProductsDetected,
}: BarcodeScannerPopupProps) {
  const [mode, setMode] = useState<ScannerMode>("barcode");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRequestingRef = useRef(false);

  // Sintesi audio Beep via Web Audio API (senza file audio esterni)
  const playBeep = useCallback((freq = 1050, durationMs = 120) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn("Audio feedback non disponibile:", e);
    }
  }, []);

  // Vibrazione aptica
  const triggerHaptic = useCallback((pattern: number | number[] = 150) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn("Vibrazione non supportata:", e);
      }
    }
  }, []);

  // Controllo Torcia
  const toggleTorch = async () => {
    try {
      const videoEl = document.querySelector("#barcode-reader video") as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];

      if (track) {
        const nextTorchState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorchState } as unknown as MediaTrackConstraintSet],
        });
        setIsTorchOn(nextTorchState);
      }
    } catch (err) {
      console.warn("Impossibile attivare la torcia:", err);
      setErrorMessage("La torcia non è disponibile su questa fotocamera.");
    }
  };

  // Switch Fotocamera Fronte / Retro
  const toggleCamera = () => {
    setIsTorchOn(false);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Cattura foto per riconoscimento con Gemini Vision
  const handleCapturePhoto = async () => {
    if (isAnalyzingAI || isProcessing) return;

    const videoEl = document.querySelector("#barcode-reader video") as HTMLVideoElement | null;
    if (!videoEl || videoEl.videoWidth === 0) {
      setErrorMessage("Fotocamera non pronta per lo scatto.");
      return;
    }

    try {
      setIsAnalyzingAI(true);
      setErrorMessage("");
      playBeep(880, 80);
      triggerHaptic(80);

      // Creazione snapshot ad alta risoluzione
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossibile inizializzare canvas 2D");

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/jpeg", 0.85);

      // Fermiamo lo scanner prima di procedere
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      // Invocazione Server Action Gemini Vision avanzata
      const aiResult = await analyzeImageProducts(base64Image, pantryCategories);

      if (aiResult.success && aiResult.products.length > 0) {
        playBeep(1200, 150);
        triggerHaptic([100, 50, 100]);

        if (aiResult.products.length === 1 || !onMultipleProductsDetected) {
          const single = aiResult.products[0];
          onScanSuccess(
            single.name,
            null,
            single.category,
            single.expiryDate || undefined,
            single.shelfLifeDays || null
          );
        } else {
          onMultipleProductsDetected(aiResult.products, base64Image);
        }
      } else {
        setErrorMessage("Nessun alimento identificato chiaramente. Riprova con luce migliore o inquadrando più da vicino.");
        setTimeout(() => {
          setIsAnalyzingAI(false);
        }, 2500);
      }
    } catch (err) {
      console.error("Errore durante la cattura foto:", err);
      setErrorMessage("Errore durante l'analisi dell'immagine.");
      setIsAnalyzingAI(false);
    }
  };

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsProcessing(false);
      setIsAnalyzingAI(false);
      setErrorMessage("");
      setIsTorchOn(false);
    }
  }

  // Inizializzazione ed esecuzione dello scanner
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    isRequestingRef.current = false;

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (isSubscribed) {
          setErrorMessage("Fotocamera non accessibile. Verifica le autorizzazioni o l'uso di HTTPS.");
        }
        return;
      }

      try {
        if (scannerRef.current?.isScanning) {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        }

        const scanner = new Html5Qrcode("barcode-reader", {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          {
            fps: 60,
            qrbox: (viewfinderWidth) => {
              const width = Math.floor(viewfinderWidth * 0.82);
              return { width, height: 160 };
            },
            disableFlip: false,
          },
          async (decodedText) => {
            // Ignoriamo letture barcode se siamo in modalità foto o se stiamo già processando
            if (mode === "photo" || isRequestingRef.current || isAnalyzingAI) return;

            isRequestingRef.current = true;
            setIsProcessing(true);
            setErrorMessage("");

            playBeep(1100, 120);
            triggerHaptic(150);

            try {
              const result = await fetchProductByBarcode(decodedText);
              if (scanner.isScanning) {
                await scanner.stop();
                scanner.clear();
              }
              onScanSuccess(result.name, result.carbonFootprint);
            } catch (err) {
              console.error("Errore lookup Open Food Facts:", err);
              setErrorMessage("Prodotto non trovato nel database.");
              setTimeout(() => {
                isRequestingRef.current = false;
                setIsProcessing(false);
              }, 2500);
            }
          },
          () => {
            // Callback errori frame-by-frame (ignorati per fluidità a 60fps)
          }
        );

        // Controllo capacità torcia una volta agganciata la traccia
        setTimeout(() => {
          const videoEl = document.querySelector("#barcode-reader video") as HTMLVideoElement | null;
          const stream = videoEl?.srcObject as MediaStream | null;
          const track = stream?.getVideoTracks()[0];
          if (track && typeof track.getCapabilities === "function") {
            const capabilities = track.getCapabilities() as { torch?: boolean };
            setSupportsTorch(!!capabilities.torch);
          }
        }, 500);
      } catch (err) {
        console.error("Errore avvio fotocamera:", err);
        if (isSubscribed) {
          setErrorMessage("Impossibile avviare la fotocamera. Controlla i permessi.");
        }
      }
    };

    const timer = setTimeout(startScanner, 120);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(console.error);
      } else if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [isOpen, facingMode, mode, playBeep, triggerHaptic, onScanSuccess, isAnalyzingAI]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-0">
      <style>{`
        @keyframes scan-laser {
          0% { top: 6%; opacity: 0.9; }
          50% { top: 92%; opacity: 1; }
          100% { top: 6%; opacity: 0.9; }
        }
        .laser-line {
          animation: scan-laser 2.2s ease-in-out infinite;
        }
      `}</style>

      <div
        className="bg-zinc-950 border border-zinc-800 w-full sm:max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header superiore con switch modalità e chiusura */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-900/60">
          {/* Tabs Modalità */}
          <div className="flex p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode("barcode");
                setErrorMessage("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                mode === "barcode"
                  ? "bg-green-600 text-white shadow-md shadow-green-900/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Barcode</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("photo");
                setErrorMessage("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                mode === "photo"
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-green-900/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Foto IA</span>
            </button>
          </div>

          {/* Azioni Hardware: Switch Fotocamera, Torcia, Chiudi */}
          <div className="flex items-center gap-1.5">
            {supportsTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? "Spegni torcia" : "Accendi torcia"}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isTorchOn
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:text-white"
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4 fill-amber-300" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={toggleCamera}
              title="Cambia fotocamera"
              className="p-2.5 rounded-xl border border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Chiudi scanner"
              className="p-2.5 rounded-xl border border-zinc-700/60 bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Area Viewfinder Fotocamera */}
        <div className="relative p-4 flex flex-col items-center">
          {errorMessage && (
            <div className="w-full mb-3 p-3 bg-red-950/60 border border-red-800/60 text-red-300 rounded-2xl text-xs font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* Container HTML5-QRCode */}
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-inner flex items-center justify-center">
            <div id="barcode-reader" className="w-full h-full object-cover" />

            {/* Overlay Mirino Laser per Barcode */}
            {mode === "barcode" && !isProcessing && (
              <div className="pointer-events-none absolute inset-6 flex items-center justify-center">
                {/* Cornice di targeting con angoli evidenziati */}
                <div className="relative w-full max-w-[280px] h-36 border-2 border-green-500/40 rounded-xl">
                  {/* Angoli decorativi */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-400 rounded-br-lg" />

                  {/* Laser verde animato */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent shadow-[0_0_12px_#22c55e] laser-line" />
                </div>
              </div>
            )}

            {/* Overlay Mirino per Foto IA */}
            {mode === "photo" && !isAnalyzingAI && (
              <div className="pointer-events-none absolute inset-5 flex flex-col items-center justify-between border-2 border-dashed border-emerald-400/40 rounded-2xl p-4">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-medium text-emerald-300">
                  Inquadra il cibo o l&apos;etichetta
                </span>
                <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center opacity-30">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div />
              </div>
            )}

            {/* Overlay di Caricamento / Analisi */}
            {(isProcessing || isAnalyzingAI) && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 text-center z-10 animate-in fade-in duration-150">
                <Loader2 className="w-9 h-9 text-green-400 animate-spin" />
                <div>
                  <p className="font-semibold text-sm text-zinc-100">
                    {isAnalyzingAI ? "Analisi IA in corso..." : "Ricerca prodotto nel database..."}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isAnalyzingAI
                      ? "Gemini Vision sta identificando l'ingrediente"
                      : "Verifica codice a barre su Open Food Facts"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Comandi Scatto (in modalità Foto IA) */}
          {mode === "photo" && (
            <div className="w-full mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={isAnalyzingAI}
                onClick={handleCapturePhoto}
                className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-green-600 to-emerald-400 p-1 shadow-lg shadow-green-950/60 active:scale-95 transition-all disabled:opacity-50"
              >
                <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center bg-transparent group-hover:bg-white/20 transition-colors">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>
          )}

          {/* Didascalia di aiuto */}
          <p className="text-xs text-zinc-400 text-center mt-3">
            {mode === "barcode"
              ? "Posiziona il codice a barre all'interno della cornice verde"
              : "Scatta una foto nitida per far riconoscere il prodotto a Gemini"}
          </p>
        </div>
      </div>
    </div>
  );
}
