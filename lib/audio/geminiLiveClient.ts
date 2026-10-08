/**
 * Gemini Live Multimodal WebSocket Client
 * Gestisce la sessione audio streaming bidirezionale a bassa latenza con Google AI Studio.
 * Supporta Full-Duplex con Echo Guard acustico, Barge-in istantaneo, Muto hardware/software
 * e Trascrizione vocale continua in tempo reale (streaming interim results).
 */

export interface LiveClientCallbacks {
  onStatusChange?: (status: "disconnected" | "connecting" | "connected" | "speaking" | "listening") => void;
  onTranscript?: (transcript: string, speaker: "user" | "chef", isInterim?: boolean) => void;
  onError?: (error: string) => void;
  onAudioLevel?: (level: number) => void; // Per animazioni onde sonore (0.0 - 1.0)
}

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionResultItem;
  length: number;
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private model: string;
  private callbacks: LiveClientCallbacks;

  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private silenceGain: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private speechRec: SpeechRecognitionInstance | null = null;
  // Riproduzione Audio Web Audio Timeline & Barge-in immediato (come Google Gemini)
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlayingOutput = false;
  private nextPlayTime = 0;
  private isMuted = false;
  private status: "disconnected" | "connecting" | "connected" | "speaking" | "listening" = "disconnected";

  // Flag per scartare i restanti pacchetti del turno interrotto
  private isInterruptedCurrentTurn = false;
  private loudSpeechFrames = 0;
  private lastPlaybackEndTime = 0;

  // Echo Guard acustico per evitare che la voce dello Chef venga ritrascritta come utente
  private chefSpokenUtterances: { text: string; timestamp: number }[] = [];

  constructor(apiKey: string, model = "gemini-3.8-live", callbacks: LiveClientCallbacks = {}) {
    this.apiKey = apiKey;
    this.model = model.startsWith("models/") ? model : `models/${model}`;
    this.callbacks = callbacks;
  }

  private updateStatus(newStatus: "disconnected" | "connecting" | "connected" | "speaking" | "listening") {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  public async connect(systemContext = "") {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.updateStatus("connecting");

    try {
      // Inizializza AudioContext
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      // Richiesta microfono utente con cancellazione eco hardware attiva
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // WebSocket URL v1beta ufficiale
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.sendSetupMessage(systemContext);
        this.updateStatus("connected");
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error("Gemini Live WebSocket Error:", err);
        this.callbacks.onError?.("Errore di connessione con lo Chef Vocale Live.");
        this.disconnect();
      };

      this.ws.onclose = (event) => {
        if (event.code !== 1000) {
          const reason =
            event.reason ||
            (event.code === 1008
              ? "API Key non abilitata al WebSocket Multimodal Live (serve chiave Google AI Studio)."
              : "Connessione Live terminata dal server.");
          this.callbacks.onError?.(reason);
        }
        this.disconnect();
      };
    } catch (err) {
      console.error("Errore inizializzazione Gemini Live:", err);
      this.callbacks.onError?.(err instanceof Error ? err.message : "Errore avvio audio.");
      this.disconnect();
    }
  }

  private sendSetupMessage(systemContext: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const pacingPrompt =
      "SEI LO CHEF VOCALE DI PANTRYAI.\n" +
      "ISTRUZIONI VOCALI FONDAMENTALI SUL RITMO DI PARLATA:\n" +
      "- Parla sempre in lingua italiana con un ritmo CALMO, RILASSATO, NATURALE e DISTESO. Non parlare velocemente, non avere alcuna fretta.\n" +
      "- Scandisci bene ogni singola parola e fai brevi pause naturali tra le frasi, come un vero chef italiano tranquillo che cucina con un amico.\n" +
      "- Sii conciso e diretto (2-3 frasi chiare per turno), con andatura distesa, calorosa e rassicurante.\n\n";

    const basePrompt =
      "Aiuti l'utente mentre cucina a mani libere. Consiglia ricette pratiche basate sugli ingredienti disponibili.";

    const fullPrompt = `${pacingPrompt}${systemContext ? systemContext : basePrompt}`;

    const setupMsg = {
      setup: {
        model: this.model,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede", // Voce calma, calda, rilassata e naturale (elimina la parlata troppo veloce)
              },
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: fullPrompt }],
        },
      },
    };

    this.ws.send(JSON.stringify(setupMsg));
  }

  private async startMicrophoneCapture() {
    if (!this.audioCtx || !this.micStream) return;

    if (this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn("AudioContext resume warning:", err);
      }
    }

    try {
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.scriptProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.silenceGain = this.audioCtx.createGain();
      this.silenceGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.silenceGain);
      this.silenceGain.connect(this.audioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        const outData = e.outputBuffer.getChannelData(0);
        outData.fill(0);

        if (this.isMuted) {
          this.callbacks.onAudioLevel?.(0);
          return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const inputSampleRate = this.audioCtx?.sampleRate || 44100;

        // Calcola livello audio RMS per le onde grafiche
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const level = Math.min(1.0, rms * 5.0);
        this.callbacks.onAudioLevel?.(level);

        // SE LO CHEF STA PARLANDO DAGLI ALTOPARLANTI:
        if (this.isPlayingOutput || this.status === "speaking") {
          // INTERRUZIONE ISTANTANEA (BARGE-IN COME SU GOOGLE GEMINI):
          // Appena l'utente inizia a parlare al microfono, l'energia RMS sale sopra il rumore di fondo delle casse.
          // Soglia 0.22 reattiva: al primo fonema o parola pronunciata dall'utente, blocca IMMEDIATAMENTE lo Chef!
          if (level > 0.22) {
            this.loudSpeechFrames++;
            if (this.loudSpeechFrames >= 2) {
              console.log("Audio VAD: voce utente rilevata, blocco immediato dello Chef (Barge-in come Gemini)!");
              this.triggerBargeIn();
              this.loudSpeechFrames = 0;
            }
          } else {
            this.loudSpeechFrames = 0;
          }

          // Protezione anti-eco: non inviare l'audio dello Chef a Gemini per evitare riverbero/eco acustico
          return;
        }

        this.loudSpeechFrames = 0;

        // Downsampling a 16000Hz PCM Int16
        const pcm16 = this.downsampleTo16kHz(inputData, inputSampleRate);
        if (pcm16.length === 0) return;

        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
        const audioMsg = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio,
              },
            ],
          },
        };

        try {
          this.ws.send(JSON.stringify(audioMsg));
        } catch (sendErr) {
          console.warn("Errore invio realtime audio:", sendErr);
        }
      };
    } catch (captureErr) {
      console.error("Errore inizializzazione cattura microfono:", captureErr);
    }
  }

  // Registra frasi pronunciate dallo Chef per il filtro eco acustico
  private recordChefUtterance(text: string) {
    const clean = text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .trim();
    if (!clean) return;

    this.chefSpokenUtterances.push({
      text: clean,
      timestamp: Date.now(),
    });

    const cutoff = Date.now() - 8000;
    while (this.chefSpokenUtterances.length > 0 && this.chefSpokenUtterances[0].timestamp < cutoff) {
      this.chefSpokenUtterances.shift();
    }
  }

  // Riconosce parole o comandi in italiano con cui l'utente interrompe l'assistente (Barge-in vocale)
  private isInterruptCommand(text: string): boolean {
    const clean = text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .trim();
    if (!clean) return false;

    const words = clean.split(/\s+/);

    const interruptKeywords = [
      "stop",
      "basta",
      "aspetta",
      "aspettami",
      "fermati",
      "ferma",
      "bloccati",
      "blocca",
      "silenzio",
      "zitto",
      "zitta",
      "pausa",
      "chef",
      "ehi",
      "hey",
      "senti",
      "ascolta",
      "un momento",
      "un attimo",
      "calma",
      "chiudi",
      "cancella",
      "no",
    ];

    for (const kw of interruptKeywords) {
      if (clean === kw || words.includes(kw)) {
        return true;
      }
    }

    return false;
  }

  // Verifica se il testo rilevato dal microfono corrisponde alla voce emessa dagli altoparlanti
  private isAcousticEcho(candidateText: string): boolean {
    const cleanCandidate = candidateText
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .trim();
    if (!cleanCandidate) return true;

    // Parole tipiche di interruzione/barge-in non devono mai essere scartate come eco
    if (this.isInterruptCommand(cleanCandidate)) {
      return false;
    }

    const candidateWords = cleanCandidate.split(/\s+/).filter((w) => w.length > 2);
    if (candidateWords.length === 0) return false;

    for (const u of this.chefSpokenUtterances) {
      if (u.text.includes(cleanCandidate) && cleanCandidate.length >= 6) {
        return true;
      }
      const utteranceWords = new Set(u.text.split(/\s+/).filter((w) => w.length > 2));
      let matchCount = 0;
      for (const w of candidateWords) {
        if (utteranceWords.has(w)) matchCount++;
      }
      if (matchCount / candidateWords.length >= 0.6) {
        return true;
      }
    }
    return false;
  }

  private startSpeechRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.log("SpeechRecognition Web API non disponibile, uso solo Gemini Multimodal Live Audio.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true; // TRASCRIZIONE CONTINUA IN TEMPO REALE
      recognition.lang = "it-IT";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (this.isMuted) return;

        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0]?.transcript || "";
          if (res.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const candidateInterim = interimTranscript.trim();
        const candidateFinal = finalTranscript.trim();
        const activeText = (candidateFinal || candidateInterim).trim();

        if (!activeText) return;

        // 1. SE LO CHEF STA PARLANDO:
        // Se viene intercettata qualsiasi voce/parola dell'utente, blocca IMMEDIATAMENTE lo Chef!
        if (this.isPlayingOutput || this.status === "speaking") {
          console.log("SpeechRecognition: rilevata voce utente durante la riproduzione, blocco dello Chef:", activeText);
          this.triggerBargeIn();
          // Scarta categoricamente la trascrizione mentre lo Chef parla per non duplicare l'audio delle casse
          return;
        }

        // 2. FINESTRA DI SOPPRESSIONE CODA ACUSTICA (post-riproduzione):
        // Scarta eventuali frammenti di sillabe finali dello Chef che Web Speech API emette con leggero ritardo (350ms)
        const timeSincePlayback = Date.now() - this.lastPlaybackEndTime;
        if (this.lastPlaybackEndTime > 0 && timeSincePlayback < 350) {
          console.log("Scartato residuo audio altoparlante post-riproduzione:", activeText);
          return;
        }

        // 3. QUANDO LO CHEF NON PARLA (sta parlando l'utente reale a voce):
        // Trascrizione continua man mano che l'utente parla (interim)
        if (candidateInterim) {
          this.callbacks.onTranscript?.(candidateInterim, "user", true);
        }

        // Trascrizione consolidata quando l'utente finisce la frase (final)
        if (candidateFinal) {
          this.callbacks.onTranscript?.(candidateFinal, "user", false);
          // NOTA: Niente fallback turn testuale via WebSocket!
          // Gemini Live riceve e comprende direttamente l'audio PCM streaming a 16kHz via onaudioprocess.
        }
      };

      recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          console.warn("SpeechRecognition warning:", e.error);
        }
      };

      recognition.onend = () => {
        if (this.status !== "disconnected" && !this.isMuted && this.ws?.readyState === WebSocket.OPEN) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      this.speechRec = recognition;
    } catch (e) {
      console.warn("Impossibile avviare SpeechRecognition locale:", e);
    }
  }

  private async handleServerMessage(data: unknown) {
    let rawText: string;
    if (typeof data === "string") {
      rawText = data;
    } else if (typeof Blob !== "undefined" && data instanceof Blob) {
      rawText = await data.text();
    } else if (data instanceof ArrayBuffer) {
      rawText = new TextDecoder().decode(data);
    } else {
      return;
    }

    try {
      const msg = JSON.parse(rawText);

      // Risposta di setup completato da Google AI Studio
      if (msg.setupComplete) {
        console.log("Sessione Gemini Live stabilita con successo!");
        this.updateStatus("listening");
        await this.startMicrophoneCapture();
        this.startSpeechRecognition();
        return;
      }

      // BARGE-IN DA GOOGLE LIVE
      if (msg.serverContent?.interrupted) {
        console.log("Interruzione vocale rilevata dal server Gemini (Barge-in).");
        this.triggerBargeIn();
      }

      // Se questo turno è stato interrotto dall'utente, scarta tutti i successivi chunk audio di questo turno!
      if (this.isInterruptedCurrentTurn) {
        if (msg.serverContent?.turnComplete) {
          this.isInterruptedCurrentTurn = false;
        }
        return;
      }

      // Trascrizione testo dello Chef da outputTranscription
      const outputText =
        msg.serverContent?.outputTranscription?.text ||
        msg.serverContent?.outputAudioTranscription?.text;
      if (outputText) {
        this.recordChefUtterance(outputText);
        this.callbacks.onTranscript?.(outputText, "chef", false);
      }

      // Trascrizione testo dell'utente da inputTranscription (se fornita dal server)
      const inputText =
        msg.serverContent?.inputTranscription?.text ||
        msg.serverContent?.inputAudioTranscription?.text;
      if (inputText && !this.isAcousticEcho(inputText)) {
        this.callbacks.onTranscript?.(inputText, "user", false);
      }

      if (msg.serverContent?.modelTurn?.parts) {

        for (const part of msg.serverContent.modelTurn.parts) {
          // Trascrizione testo di fallback se non già ricevuta da outputTranscription
          if (part.text && !outputText) {
            this.recordChefUtterance(part.text);
            this.callbacks.onTranscript?.(part.text, "chef", false);
          }

          // Chunks Audio PCM 24000Hz
          if (part.inlineData?.data) {
            if (this.isInterruptedCurrentTurn) return;
            this.updateStatus("speaking");
            const rawPcm = this.base64ToArrayBuffer(part.inlineData.data);
            const float32 = this.pcm16ToFloat32(new Int16Array(rawPcm));
            this.queueAudioOutput(float32);
          }
        }
      }

      if (msg.serverContent?.turnComplete) {
        this.isInterruptedCurrentTurn = false;
        if (!this.isPlayingOutput) {
          this.updateStatus("listening");
        }
      }
    } catch (err) {
      console.warn("Errore parsing messaggio Live:", err);
    }
  }

  private queueAudioOutput(samples: Float32Array) {
    if (this.isInterruptedCurrentTurn || !this.audioCtx) return;

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    this.isPlayingOutput = true;
    this.updateStatus("speaking");

    const audioBuffer = this.audioCtx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioCtx.destination);

    const currentTime = this.audioCtx.currentTime;
    // Jitter buffer di 30ms per garantire continuità naturale senza gap o accelerazioni improvvise
    const startTime = Math.max(currentTime + 0.03, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.isPlayingOutput = false;
        this.nextPlayTime = 0;
        this.lastPlaybackEndTime = Date.now();
        this.updateStatus("listening");
      }
    };
  }

  // Interruzione immediata dello Chef (Barge-in / Stop istantaneo come su Google Gemini)
  public triggerBargeIn() {
    this.isInterruptedCurrentTurn = true;
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.isPlayingOutput = false;
    this.nextPlayTime = 0;
    this.loudSpeechFrames = 0;
    this.lastPlaybackEndTime = 0; // Permette l'acquisizione immediata della voce dell'utente post-barge-in
    this.updateStatus("listening");
  }

  // Alias retrocompatibile
  public stopCurrentAudioPlayback() {
    this.triggerBargeIn();
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;

    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }

    if (muted) {
      if (this.speechRec) {
        try {
          this.speechRec.abort();
        } catch {}
      }
      this.callbacks.onAudioLevel?.(0);
    } else {
      if (this.status !== "disconnected") {
        this.startSpeechRecognition();
      }
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getStatus() {
    return this.status;
  }

  public disconnect() {
    this.updateStatus("disconnected");

    this.triggerBargeIn();

    if (this.speechRec) {
      try {
        this.speechRec.abort();
      } catch {}
      this.speechRec = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.silenceGain) {
      this.silenceGain.disconnect();
      this.silenceGain = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.activeSources = [];
    this.isPlayingOutput = false;
    this.nextPlayTime = 0;
    this.chefSpokenUtterances = [];
    this.isInterruptedCurrentTurn = false;
  }

  // --- Utility di Conversione Audio ---

  private downsampleTo16kHz(buffer: Float32Array, inputRate: number): Int16Array {
    if (inputRate === 16000) {
      return this.float32ToInt16(buffer);
    }
    const ratio = inputRate / 16000;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        const val = Number.isFinite(buffer[i]) ? buffer[i] : 0;
        accum += val;
        count++;
      }
      const sample = count > 0 ? accum / count : 0;
      const s = Math.max(-1, Math.min(1, sample));
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }

  private float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const val = Number.isFinite(buffer[i]) ? buffer[i] : 0;
      const s = Math.max(-1, Math.min(1, val));
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return buf;
  }

  private pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
