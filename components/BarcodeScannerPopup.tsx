import React, { useEffect, useState } from "react";
import { X, Loader } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { fetchProductByBarcode } from "@/lib/api/openFoodFacts";

interface BarcodeScannerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (productName: string) => void;
}

export function BarcodeScannerPopup({ isOpen, onClose, onScanSuccess }: BarcodeScannerPopupProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setIsProcessing(false);
    setErrorMessage("");

    // Controllo permessi fotocamera e HTTPS
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Fotocamera non accessibile. Assicurati di usare HTTPS.");
      return;
    }

    let scanner: Html5Qrcode | null = null;
    let isRequesting = false;

    const startScanner = async () => {
      try {
        console.log("Avvio scanner");
        scanner = new Html5Qrcode("barcode-reader", {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        });
        await scanner.start(
          { facingMode: "environment" }, // Usa la fotocamera posteriore se disponibile
          {
            fps: 60,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(viewfinderWidth * 0.8);
              return { width: width, height: 150 };
            },
            disableFlip: false, // Permette di leggere il codice anche se è capovolto
          },
          async (decodedText) => {
            if (isRequesting) return;
            isRequesting = true;
            setIsProcessing(true);
            setErrorMessage("");

            console.log(`Codice a barre rilevato: ${decodedText}`);
            console.log("Invio richiesta a Open Food Facts:");

            try {
              const productName = await fetchProductByBarcode(decodedText);
              if (scanner) {
                await scanner.stop();
                scanner.clear();
              }
              onScanSuccess(productName);
            } catch (err) {
              console.error("Errore fetch open food facts:", err);
              setErrorMessage("Il prodotto non è presente");
              setTimeout(() => {
                isRequesting = false;
                setIsProcessing(false);
              }, 3000);
            }
          },
          (errorMessage) => {
            // Ignora errori di scansione continui 
          }
        );
      } catch (err) {
        console.error("Errore avvio fotocamera:", err);
        setErrorMessage("Impossibile avviare la fotocamera. Verifica i permessi.");
      }
    };

    // Per assicurarci che il div "barcode-reader" sia montato
    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      if (scanner && scanner.isScanning) {
        scanner.stop().then(() => scanner?.clear()).catch(console.error);
      } else if (scanner) {
        scanner.clear();
      }
    };
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-0">
      <div
        className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Scannerizza Prodotto
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          {errorMessage && (
            <div className="w-full mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-center font-medium">
              {errorMessage}
            </div>
          )}

          <div id="barcode-reader" className="w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800" />

          {isProcessing && (
            <div className="mt-4 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Loader className="w-5 h-5 animate-spin" />
              <span>Ricerca prodotto...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
