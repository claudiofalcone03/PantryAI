#!/usr/bin/env node
/**
 * PantryAI Stdio MCP Server Runner
 * Comunica via stdin/stdout con Antigravity e legge/scrive su Firestore
 * con supporto ibrido: Firebase Admin SDK (se configurate credenziali Service Account)
 * oppure Firestore REST API con OAuth token da Firebase CLI (~/.config/configstore/firebase-tools.json).
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// Carica variabili d'ambiente da .env.local se presenti
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "pantryai-cee9e";

// ===============================================================
// AUTH & TOKEN MANAGEMENT (Firebase CLI / Service Account)
// ===============================================================

async function getValidAccessToken() {
  const configPath = path.join(os.homedir(), ".config/configstore/firebase-tools.json");
  if (!fs.existsSync(configPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const tokens = data.tokens || {};
    if (tokens.access_token && tokens.expires_at && tokens.expires_at > Date.now() + 60000) {
      return tokens.access_token;
    }
    if (tokens.refresh_token) {
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const resJson = await resp.json();
      if (resJson.access_token) {
        tokens.access_token = resJson.access_token;
        tokens.expires_at = Date.now() + (resJson.expires_in || 3600) * 1000;
        try {
          fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
        } catch (_) {}
        return resJson.access_token;
      }
    }
    return tokens.access_token || null;
  } catch (err) {
    console.error("[PantryAI MCP] Errore refresh token Firebase CLI:", err);
    return null;
  }
}

function getCliUserEmail() {
  try {
    const configPath = path.join(os.homedir(), ".config/configstore/firebase-tools.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return data.user?.email || null;
    }
  } catch (_) {}
  return null;
}

// ===============================================================
// REST API HELPERS (Value serialization for Cloud Firestore)
// ===============================================================

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function fromFirestoreValue(val) {
  if (!val) return null;
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return parseInt(val.integerValue, 10);
  if ("doubleValue" in val) return parseFloat(val.doubleValue);
  if ("stringValue" in val) return val.stringValue;
  if ("timestampValue" in val) return val.timestampValue;
  if ("arrayValue" in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function fromFirestoreDoc(doc) {
  if (!doc) return null;
  const data = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = fromFirestoreValue(v);
  }
  const parts = (doc.name || "").split("/");
  data.id = parts[parts.length - 1];
  return data;
}

// ===============================================================
// UNIFIED HYBRID DATABASE ADAPTER
// ===============================================================

class HybridDatabase {
  constructor() {
    this.mode = "uninitialized";
    this.adminDb = null;
  }

  async init() {
    // 1. Prova inizializzazione Admin SDK con Service Account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)) {
      try {
        const { initializeApp, cert, getApps } = require("firebase-admin/app");
        const { getFirestore } = require("firebase-admin/firestore");

        let app;
        const currentApps = getApps();
        if (currentApps.length > 0) {
          app = currentApps[0];
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          app = initializeApp({ credential: cert(creds), projectId: PROJECT_ID });
        } else {
          const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
          let privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
          app = initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail, privateKey }), projectId: PROJECT_ID });
        }

        this.adminDb = getFirestore(app);
        this.mode = "admin";
        console.error("[PantryAI MCP] Connesso con Firebase Admin SDK (Service Account).");
        return;
      } catch (err) {
        console.error("[PantryAI MCP] Avviso: inizializzazione Admin SDK fallita, fallback su REST:", err.message);
      }
    }

    // 2. Modalità REST come default affidabile con Firebase CLI token
    this.mode = "rest";
    console.error("[PantryAI MCP] Connesso tramite Firestore REST API (OAuth Firebase CLI).");
  }

  async getAuthHeaders() {
    const token = await getValidAccessToken();
    if (!token) throw new Error("Nessun token di accesso disponibile. Effettua il login con 'firebase login' o imposta FIREBASE_SERVICE_ACCOUNT_KEY.");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async getDoc(fullPath) {
    if (this.mode === "admin") {
      const snap = await this.adminDb.doc(fullPath).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    }

    const headers = await this.getAuthHeaders();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${fullPath}`;
    const res = await fetch(url, { headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Errore getDoc (${res.status}): ${txt}`);
    }
    const json = await res.json();
    return fromFirestoreDoc(json);
  }

  async listDocs(collectionPath, pageSize = 100) {
    if (this.mode === "admin") {
      const snap = await this.adminDb.collection(collectionPath).limit(pageSize).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const headers = await this.getAuthHeaders();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Errore listDocs (${res.status}): ${txt}`);
    }
    const json = await res.json();
    return (json.documents || []).map(fromFirestoreDoc);
  }

  async queryDocs(collectionPath, field, op, value) {
    if (this.mode === "admin") {
      let q = this.adminDb.collection(collectionPath);
      if (field && op && value !== undefined) {
        const firestoreOp = op === "EQUAL" ? "==" : op;
        q = q.where(field, firestoreOp, value);
      }
      const snap = await q.get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const headers = await this.getAuthHeaders();
    const isRootCollection = !collectionPath.includes("/");
    const parentUrl = isRootCollection
      ? `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`
      : `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath.substring(0, collectionPath.lastIndexOf("/"))}:runQuery`;

    const targetCollectionId = collectionPath.split("/").pop();

    const body = {
      structuredQuery: {
        from: [{ collectionId: targetCollectionId }],
      },
    };

    if (field && op && value !== undefined) {
      const opMap = {
        "==": "EQUAL",
        EQUAL: "EQUAL",
        "<": "LESS_THAN",
        "<=": "LESS_THAN_OR_EQUAL",
        ">": "GREATER_THAN",
        ">=": "GREATER_THAN_OR_EQUAL",
      };
      body.structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: field },
          op: opMap[op] || "EQUAL",
          value: toFirestoreValue(value),
        },
      };
    }

    const res = await fetch(parentUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Errore queryDocs (${res.status}): ${txt}`);
    }

    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return json.filter((item) => item.document).map((item) => fromFirestoreDoc(item.document));
  }

  async setDoc(fullPath, data, merge = false) {
    if (this.mode === "admin") {
      await this.adminDb.doc(fullPath).set(data, { merge });
      return;
    }

    const headers = await this.getAuthHeaders();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${fullPath}`;
    const fields = toFirestoreFields(data);
    const body = { fields };

    let finalUrl = url;
    if (merge) {
      const updateMaskParams = Object.keys(data)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join("&");
      if (updateMaskParams) finalUrl += `?${updateMaskParams}`;
    }

    const res = await fetch(finalUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Errore setDoc (${res.status}): ${txt}`);
    }
  }

  async updateDoc(fullPath, data) {
    return this.setDoc(fullPath, data, true);
  }

  async deleteDoc(fullPath) {
    if (this.mode === "admin") {
      await this.adminDb.doc(fullPath).delete();
      return;
    }

    const headers = await this.getAuthHeaders();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${fullPath}`;
    const res = await fetch(url, { method: "DELETE", headers });
    if (!res.ok && res.status !== 404) {
      const txt = await res.text();
      throw new Error(`Errore deleteDoc (${res.status}): ${txt}`);
    }
  }
}

const db = new HybridDatabase();

// ===============================================================
// DATE & WEEK HELPERS
// ===============================================================

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function getIsoWeekInfo(baseDate = new Date()) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = monday.getFullYear();
  const weekId = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  const dayNames = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push({
      dateStr: formatDate(cur),
      dayName: dayNames[i],
    });
  }

  return { weekId, startDate: formatDate(monday), endDate: formatDate(sunday), days };
}

// ===============================================================
// USER RESOLUTION
// ===============================================================

async function resolveUser(token) {
  if (token) {
    try {
      const users = await db.queryDocs("users", "mcpToken", "==", token);
      if (users.length > 0) {
        const u = users[0];
        const pantryIds = Array.isArray(u.userProfilePantryIds) ? u.userProfilePantryIds.filter(Boolean) : [];
        return {
          userId: u.id,
          userEmail: u.userEmail || "",
          userName: u.userProfileName || undefined,
          currentPantryId: u.userProfileCurrentPantryId || pantryIds[0] || "",
          pantryIds,
        };
      }
    } catch (e) {
      console.error("[PantryAI MCP] Errore lookup token:", e.message);
    }
  }

  const cliEmail = getCliUserEmail();
  if (cliEmail) {
    try {
      const users = await db.queryDocs("users", "userEmail", "==", cliEmail);
      if (users.length > 0) {
        const u = users[0];
        const pantryIds = Array.isArray(u.userProfilePantryIds) ? u.userProfilePantryIds.filter(Boolean) : [];
        return {
          userId: u.id,
          userEmail: u.userEmail || "",
          userName: u.userProfileName || undefined,
          currentPantryId: u.userProfileCurrentPantryId || pantryIds[0] || "",
          pantryIds,
        };
      }
    } catch (e) {
      console.error("[PantryAI MCP] Errore lookup cliEmail:", e.message);
    }
  }

  try {
    const allUsers = await db.listDocs("users", 20);
    for (const u of allUsers) {
      const pantryIds = Array.isArray(u.userProfilePantryIds) ? u.userProfilePantryIds.filter(Boolean) : [];
      if (pantryIds.length > 0 || u.userProfileCurrentPantryId) {
        return {
          userId: u.id,
          userEmail: u.userEmail || "",
          userName: u.userProfileName || undefined,
          currentPantryId: u.userProfileCurrentPantryId || pantryIds[0] || "",
          pantryIds,
        };
      }
    }
  } catch (e) {
    console.error("[PantryAI MCP] Errore fallback users:", e.message);
  }

  return {
    userId: "guest",
    userEmail: "guest@pantryai.app",
    currentPantryId: "",
    pantryIds: [],
  };
}

// ===============================================================
// COMPLETE TOOL DEFINITIONS (22+ TOOLS)
// ===============================================================

const MCP_TOOLS = [
  // 1. PANORAMICA & EXPORT
  {
    name: "pantry_get_summary",
    description: "Restituisce una panoramica quantitativa della dispensa attiva: conteggio articoli, scadenze imminenti a 3 e 7 giorni, prodotti aperti, congelati, esauriti, articoli da comprare nella spesa e pasti programmati.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string", description: "ID opzionale della dispensa (default: dispensa attiva)" },
      },
    },
  },
  {
    name: "pantry_export_all_data",
    description: "Estrae un dump completo e strutturato di TUTTI i dati della dispensa: metadati dispensa, inventario prodotti con scadenze e dettagli completi, lista della spesa, piano pasti settimanale, ricette e storico consumi/sprechi.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string", description: "ID opzionale della dispensa" },
        include_recipes: { type: "boolean", description: "Includi le ricette salvate (default: true)" },
        include_meal_plans: { type: "boolean", description: "Includi il piano pasti settimanale (default: true)" },
        include_history: { type: "boolean", description: "Includi lo storico consumi e sprechi (default: true)" },
      },
    },
  },

  // 2. INVENTARIO PRODOTTI
  {
    name: "pantry_list_items",
    description: "Elenca e cerca gli alimenti presenti in dispensa, con filtri avanzati per nome, categoria, stato di scadenza, prodotti aperti o congelati nel freezer.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        query: { type: "string", description: "Ricerca per nome prodotto" },
        category: { type: "string", description: "Filtra per categoria (es. Pasta, Latticini, Frutta)" },
        only_expiring_days: { type: "number", description: "Filtra prodotti che scadono entro questo numero di giorni" },
        only_opened: { type: "boolean", description: "Filtra solo prodotti già aperti" },
        only_frozen: { type: "boolean", description: "Filtra solo prodotti congelati nel freezer" },
        limit: { type: "number", description: "Limite massimo risultati (default: 100)" },
      },
    },
  },
  {
    name: "pantry_get_item",
    description: "Recupera i dettagli completi di un singolo prodotto: quantità, unità, scadenze, giorni da aperto, congelamento, barcode, nutriscore e note.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "ID univoco del prodotto" },
        item_id: { type: "string", description: "Alias alternativo per product_id" },
      },
    },
  },
  {
    name: "pantry_add_item",
    description: "Aggiunge un nuovo alimento all'inventario o ne incrementa la quantità se già presente. Supporta scadenza, barcode e shelf-life da aperto.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        name: { type: "string", description: "Nome dell'alimento" },
        quantity: { type: "number", description: "Quantità da inserire (default: 1)" },
        unit: { type: "string", description: "Unità di misura (pcs, g, kg, ml, l, conf)" },
        category: { type: "string", description: "Categoria alimentare" },
        expiry_date: { type: "string", description: "Data di scadenza (formato YYYY-MM-DD)" },
        opened_shelf_life_days: { type: "number", description: "Giorni di conservazione raccomandati una volta aperto" },
        is_frozen: { type: "boolean", description: "Se true indica che il prodotto viene inserito congelato" },
        barcode: { type: "string", description: "Codice a barre EAN" },
        notes: { type: "string", description: "Note aggiuntive" },
      },
      required: ["name"],
    },
  },
  {
    name: "pantry_update_item",
    description: "Aggiorna i dati di un prodotto esistente (quantità, data di scadenza, categoria, note, ecc.).",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "ID del prodotto" },
        item_id: { type: "string", description: "Alias per product_id" },
        name: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string" },
        category: { type: "string" },
        expiry_date: { type: "string", description: "YYYY-MM-DD" },
        opened_shelf_life_days: { type: "number" },
        barcode: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "pantry_open_item",
    description: "Segna un prodotto come aperto, ricalcolando automaticamente la scadenza dinamica in base ai giorni di conservazione dall'apertura.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        item_id: { type: "string" },
        opened_shelf_life_days: { type: "number", description: "Giorni entro cui consumarlo da aperto (default: 3)" },
      },
    },
  },
  {
    name: "pantry_freeze_item",
    description: "Contrassegna un alimento come congelato nel freezer con estensione automatica della scadenza.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        item_id: { type: "string" },
        months: { type: "number", description: "Mesi di conservazione nel freezer (default: 3)" },
        custom_expiry_date: { type: "string", description: "Data di scadenza personalizzata nel freezer (YYYY-MM-DD)" },
      },
    },
  },
  {
    name: "pantry_unfreeze_item",
    description: "Scongela un prodotto dal freezer, impostando una scadenza breve per rapido consumo.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        item_id: { type: "string" },
        hours_to_consume: { type: "number", description: "Ore entro cui consumarlo una volta scongelato (default: 48)" },
      },
    },
  },
  {
    name: "pantry_consume_item",
    description: "Registra il consumo di un prodotto (totale o parziale) e ne archivia l'evento nello storico consumi anti-spreco.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        item_id: { type: "string" },
        quantity: { type: "number", description: "Quantità consumata (se omesso o pari al totale rimuove il prodotto)" },
        resolution: { type: "string", enum: ["consumed", "rescued", "wasted"], description: "Esito (default: consumed)" },
      },
    },
  },
  {
    name: "pantry_delete_item",
    description: "Rimuove direttamente un prodotto dall'inventario, opzionalmente registrando lo spreco nello storico.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        item_id: { type: "string" },
        reason: { type: "string", enum: ["wasted", "expired", "removed"], description: "Motivo eliminazione (default: removed)" },
      },
    },
  },

  // 3. LISTA DELLA SPESA
  {
    name: "shopping_list_get",
    description: "Recupera gli articoli presenti nella lista della spesa con i loro stati (toBuy, reserved, purchased).",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        status: { type: "string", enum: ["toBuy", "reserved", "purchased", "all"] },
      },
    },
  },
  {
    name: "shopping_list_add",
    description: "Aggiunge un nuovo articolo alla lista della spesa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        name: { type: "string", description: "Nome articolo da comprare" },
        quantity: { type: "number", description: "Quantità da comprare (default: 1)" },
        unit: { type: "string", description: "Unità di misura (pcs, kg, l)" },
        product_id: { type: "string", description: "ID opzionale del prodotto esaurito collegato" },
      },
      required: ["name"],
    },
  },
  {
    name: "shopping_list_set_status",
    description: "Aggiorna lo stato di un articolo nella lista della spesa (toBuy, reserved, purchased).",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        status: { type: "string", enum: ["toBuy", "reserved", "purchased"] },
        user_name: { type: "string", description: "Nome dell'acquirente o prenotatore" },
      },
      required: ["item_id", "status"],
    },
  },
  {
    name: "shopping_list_checkout",
    description: "Finalizza la spesa: converte tutti gli articoli segnati come 'purchased' in prodotti nella dispensa e li cancella dalla spesa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
      },
    },
  },
  {
    name: "shopping_list_remove",
    description: "Rimuove un articolo dalla lista della spesa.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
      },
      required: ["item_id"],
    },
  },

  // 4. PIANO PASTI SETTIMANALE
  {
    name: "meal_plan_get_weekly",
    description: "Recupera il piano pasti completo per la settimana corrente (o una settimana specifica ISO, es. 2026-W41), con tutti i giorni e gli slot (colazione, pranzo, merenda, cena).",
    inputSchema: {
      type: "object",
      properties: {
        week_id: { type: "string", description: "Identificativo settimana (es. 2026-W41, default: settimana corrente)" },
      },
    },
  },
  {
    name: "meal_plan_set_slot",
    description: "Assegna o aggiorna un piatto/ricetta in uno slot del piano pasti settimanale.",
    inputSchema: {
      type: "object",
      properties: {
        week_id: { type: "string", description: "Identificativo settimana (default: settimana corrente)" },
        date: { type: "string", description: "Data nel formato YYYY-MM-DD" },
        slot_type: { type: "string", enum: ["colazione", "pranzo", "merenda", "cena"] },
        recipe_title: { type: "string", description: "Nome del pasto o ricetta" },
        recipe_id: { type: "string", description: "ID opzionale della ricetta salvata" },
        recipe_is_anti_waste: { type: "boolean" },
        recipe_prep_time_minutes: { type: "number" },
        servings: { type: "number" },
        notes: { type: "string" },
        is_cooked: { type: "boolean" },
      },
      required: ["date", "slot_type", "recipe_title"],
    },
  },
  {
    name: "meal_plan_remove_slot",
    description: "Rimuove il pasto pianificato in uno slot specifico.",
    inputSchema: {
      type: "object",
      properties: {
        week_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        slot_type: { type: "string", enum: ["colazione", "pranzo", "merenda", "cena"] },
      },
      required: ["date", "slot_type"],
    },
  },
  {
    name: "meal_plan_clear_week",
    description: "Svuota completamente il piano pasti per una determinata settimana.",
    inputSchema: {
      type: "object",
      properties: {
        week_id: { type: "string", description: "Identificativo settimana (es. 2026-W41)" },
      },
    },
  },

  // 5. RICETTE & ANTI-SPRECO
  {
    name: "recipes_list",
    description: "Elenca tutte le ricette disponibili: ricette personali dell'utente e ricette condivise nella dispensa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        include_shared: { type: "boolean", description: "Includi le ricette condivise della dispensa (default: true)" },
      },
    },
  },
  {
    name: "recipes_get",
    description: "Recupera tutti i dettagli di una ricetta (ingredienti, dosi, passaggi di preparazione, tempi, porzioni).",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: { type: "string" },
        pantry_id: { type: "string" },
      },
      required: ["recipe_id"],
    },
  },
  {
    name: "recipes_save",
    description: "Salva una nuova ricetta per l'utente, opzionalmente condividendola con i membri della dispensa.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titolo della ricetta" },
        description: { type: "string" },
        ingredients: {
          type: "array",
          items: { type: "string" },
          description: "Elenco degli ingredienti con quantità",
        },
        instructions: {
          type: "array",
          items: { type: "string" },
          description: "Passaggi sequenziali di preparazione",
        },
        prep_time_minutes: { type: "number" },
        servings: { type: "number" },
        is_anti_waste: { type: "boolean" },
        share_with_pantry: { type: "boolean", description: "Se true la condivide nella dispensa attiva" },
        pantry_id: { type: "string" },
      },
      required: ["title", "ingredients", "instructions"],
    },
  },
  {
    name: "recipes_delete",
    description: "Elimina una ricetta salvata.",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: { type: "string" },
        pantry_id: { type: "string" },
      },
      required: ["recipe_id"],
    },
  },
  {
    name: "recipes_suggest_anti_waste",
    description: "Suggerisce ricette intelligenti create a partire dagli ingredienti in scadenza presenti in dispensa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        max_recipes: { type: "number", description: "Numero massimo di idee da generare (default: 3)" },
      },
    },
  },

  // 6. STORICO CONSUMI & ANALISI SPRECO
  {
    name: "history_get_logs",
    description: "Estrae il registro storico cronologico degli eventi: prodotti consumati, recuperati o buttati.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        limit: { type: "number", description: "Numero massimo di record (default: 50)" },
        resolution: { type: "string", enum: ["consumed", "rescued", "wasted", "all"] },
      },
    },
  },
  {
    name: "history_get_summary",
    description: "Calcola metriche ambientali e statistiche di spreco: percentuale cibo salvato vs sprecato e prodotti più a rischio.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        days: { type: "number", description: "Numero di giorni da considerare (default: 30)" },
      },
    },
  },

  // 7. GESTIONE DISPENSE E CATEGORIE
  {
    name: "pantry_list_pantries",
    description: "Elenca tutte le dispense accessibili all'utente con codice invito, membri e indicazione della dispensa attiva.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pantry_switch_current",
    description: "Imposta la dispensa attiva per la sessione e aggiorna il profilo utente.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string", description: "ID della dispensa da impostare come attiva" },
      },
      required: ["pantry_id"],
    },
  },
  {
    name: "pantry_manage_categories",
    description: "Legge, aggiunge o rimuove categorie merceologiche personalizzate della dispensa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        action: { type: "string", enum: ["list", "add", "remove"] },
        category_name: { type: "string" },
      },
      required: ["action"],
    },
  },
];

// ===============================================================
// TOOL EXECUTION HANDLER
// ===============================================================

async function handleToolExecution(name, args, user) {
  const getPantryId = (reqPid) => {
    if (reqPid && typeof reqPid === "string" && reqPid.trim()) {
      return reqPid.trim();
    }
    if (user.currentPantryId) return user.currentPantryId;
    if (user.pantryIds && user.pantryIds.length > 0) return user.pantryIds[0];
    throw new Error("Nessuna dispensa associata all'utente o selezionata.");
  };

  const getProductId = () => args.product_id || args.item_id || null;

  switch (name) {
    // -------------------------------------------------------------
    // 1. PANORAMICA & EXPORT
    // -------------------------------------------------------------
    case "pantry_get_summary": {
      const pantryId = getPantryId(args.pantry_id);
      const prods = await db.queryDocs("products", "productPantryId", "==", pantryId);
      const shopItems = await db.queryDocs("shoppingListItems", "listItemPantryId", "==", pantryId);

      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let expiring3 = 0;
      let expiring7 = 0;
      let zeroStock = 0;
      let openedCount = 0;
      let frozenCount = 0;

      for (const p of prods) {
        const qty = p.productQuantity ?? 0;
        if (qty <= 0) zeroStock++;
        if (p.productOpenedAt) openedCount++;
        if (p.productIsFrozen) frozenCount++;

        const expStr = p.productOpenedExpiryAt || p.expiryDateProduct;
        if (expStr) {
          const expDate = new Date(expStr);
          if (!isNaN(expDate.getTime())) {
            if (expDate <= in3Days) expiring3++;
            if (expDate <= in7Days) expiring7++;
          }
        }
      }

      const toBuyCount = shopItems.filter((i) => i.listItemStatus === "toBuy").length;

      let pantryName = pantryId;
      try {
        const pDoc = await db.getDoc(`pantries/${pantryId}`);
        if (pDoc && pDoc.pantryName) pantryName = pDoc.pantryName;
      } catch (_) {}

      return {
        activePantryId: pantryId,
        activePantryName: pantryName,
        totalProducts: prods.length,
        expiringIn3Days: expiring3,
        expiringIn7Days: expiring7,
        zeroStockCount: zeroStock,
        openedProductsCount: openedCount,
        frozenProductsCount: frozenCount,
        shoppingListToBuyCount: toBuyCount,
        userEmail: user.userEmail,
      };
    }

    case "pantry_export_all_data": {
      const pantryId = getPantryId(args.pantry_id);
      const pantryDoc = await db.getDoc(`pantries/${pantryId}`);
      const products = await db.queryDocs("products", "productPantryId", "==", pantryId);
      const shoppingList = await db.queryDocs("shoppingListItems", "listItemPantryId", "==", pantryId);

      let mealPlans = null;
      if (args.include_meal_plans !== false && user.userId) {
        try {
          mealPlans = await db.listDocs(`users/${user.userId}/mealPlans`, 20);
        } catch (_) {}
      }

      let recipes = null;
      if (args.include_recipes !== false) {
        try {
          const userRec = user.userId ? await db.listDocs(`users/${user.userId}/recipes`, 50) : [];
          const sharedRec = await db.listDocs(`pantries/${pantryId}/sharedRecipes`, 50);
          recipes = { userRecipes: userRec, sharedRecipes: sharedRec };
        } catch (_) {}
      }

      let history = null;
      if (args.include_history !== false) {
        try {
          history = await db.listDocs(`pantries/${pantryId}/history`, 100);
        } catch (_) {}
      }

      return {
        exportedAt: new Date().toISOString(),
        pantry: pantryDoc || { id: pantryId },
        productsCount: products.length,
        products,
        shoppingListCount: shoppingList.length,
        shoppingList,
        mealPlans,
        recipes,
        history,
      };
    }

    // -------------------------------------------------------------
    // 2. INVENTARIO PRODOTTI
    // -------------------------------------------------------------
    case "pantry_list_items": {
      const pantryId = getPantryId(args.pantry_id);
      const prods = await db.queryDocs("products", "productPantryId", "==", pantryId);

      const now = new Date();
      let filtered = prods;

      if (args.query && typeof args.query === "string") {
        const q = args.query.toLowerCase().trim();
        filtered = filtered.filter((p) => (p.productName || "").toLowerCase().includes(q));
      }

      if (args.category && typeof args.category === "string") {
        const cat = args.category.toLowerCase().trim();
        filtered = filtered.filter((p) => (p.productCategory || "").toLowerCase() === cat);
      }

      if (args.only_opened) {
        filtered = filtered.filter((p) => !!p.productOpenedAt);
      }

      if (args.only_frozen) {
        filtered = filtered.filter((p) => !!p.productIsFrozen);
      }

      if (typeof args.only_expiring_days === "number") {
        const targetDate = new Date(now.getTime() + args.only_expiring_days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((p) => {
          const expStr = p.productOpenedExpiryAt || p.expiryDateProduct;
          if (!expStr) return false;
          const d = new Date(expStr);
          return !isNaN(d.getTime()) && d <= targetDate;
        });
      }

      const limit = args.limit || 100;
      filtered = filtered.slice(0, limit);

      const items = filtered.map((p) => {
        const expStr = p.productOpenedExpiryAt || p.expiryDateProduct;
        let daysToExpiry = null;
        if (expStr) {
          const expDate = new Date(expStr);
          if (!isNaN(expDate.getTime())) {
            daysToExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
        return {
          productId: p.id || p.productId,
          name: p.productName,
          quantity: p.productQuantity ?? 1,
          unit: p.productUnitOfMeasure || "pcs",
          category: p.productCategory || "Altro",
          expiryDate: p.expiryDateProduct || null,
          isOpened: !!p.productOpenedAt,
          openedAt: p.productOpenedAt || null,
          openedExpiryDate: p.productOpenedExpiryAt || null,
          isFrozen: !!p.productIsFrozen,
          frozenAt: p.productFrozenAt || null,
          barcode: p.productBarcode || null,
          nutriscore: p.productNutriscore || null,
          notes: p.productNotes || null,
          daysToExpiry,
        };
      });

      return { count: items.length, items };
    }

    case "pantry_get_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id o item_id.");
      const doc = await db.getDoc(`products/${pId}`);
      if (!doc) throw new Error(`Prodotto con ID '${pId}' non trovato.`);
      return doc;
    }

    case "pantry_add_item": {
      const pantryId = getPantryId(args.pantry_id);
      const name = String(args.name).trim();
      const existing = await db.queryDocs("products", "productPantryId", "==", pantryId);
      const found = existing.find((p) => (p.productName || "").toLowerCase() === name.toLowerCase());

      if (found) {
        const newQty = (found.productQuantity ?? 0) + (args.quantity || 1);
        await db.updateDoc(`products/${found.id}`, {
          productQuantity: newQty,
          productUpdatedAt: new Date().toISOString(),
        });
        return {
          message: `Prodotto '${name}' già presente: quantità incrementata a ${newQty}.`,
          productId: found.id,
          productQuantity: newQty,
        };
      }

      const newId = crypto.randomBytes(10).toString("hex");
      const newProduct = {
        productId: newId,
        productPantryId: pantryId,
        productName: name,
        productQuantity: args.quantity !== undefined ? args.quantity : 1,
        productUnitOfMeasure: args.unit || "pcs",
        productCategory: args.category || "Altro",
        expiryDateProduct: args.expiry_date || null,
        productOpenedShelfLifeDays: args.opened_shelf_life_days || 3,
        productIsFrozen: !!args.is_frozen,
        productBarcode: args.barcode || null,
        productNotes: args.notes || null,
        addToShoppingList: false,
        productCreatedAt: new Date().toISOString(),
        productUpdatedAt: new Date().toISOString(),
      };

      await db.setDoc(`products/${newId}`, newProduct);
      return { message: `Alimento '${name}' aggiunto con successo.`, productId: newId, product: newProduct };
    }

    case "pantry_update_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id.");
      const updates = { productUpdatedAt: new Date().toISOString() };
      if (args.name) updates.productName = String(args.name).trim();
      if (args.quantity !== undefined) updates.productQuantity = Number(args.quantity);
      if (args.unit) updates.productUnitOfMeasure = args.unit;
      if (args.category) updates.productCategory = args.category;
      if (args.expiry_date !== undefined) updates.expiryDateProduct = args.expiry_date;
      if (args.opened_shelf_life_days !== undefined) updates.productOpenedShelfLifeDays = args.opened_shelf_life_days;
      if (args.barcode !== undefined) updates.productBarcode = args.barcode;
      if (args.notes !== undefined) updates.productNotes = args.notes;

      await db.updateDoc(`products/${pId}`, updates);
      return { message: `Prodotto '${pId}' aggiornato con successo.`, updates };
    }

    case "pantry_open_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id.");
      const prod = await db.getDoc(`products/${pId}`);
      if (!prod) throw new Error(`Prodotto '${pId}' non trovato.`);

      const shelfDays = args.opened_shelf_life_days || prod.productOpenedShelfLifeDays || 3;
      const openedDate = new Date();
      const openedExpiry = new Date(openedDate.getTime() + shelfDays * 24 * 60 * 60 * 1000);

      const updates = {
        productOpenedAt: openedDate.toISOString(),
        productOpenedExpiryAt: openedExpiry.toISOString().split("T")[0],
        productOpenedShelfLifeDays: shelfDays,
        productUpdatedAt: openedDate.toISOString(),
      };

      await db.updateDoc(`products/${pId}`, updates);
      return {
        message: `Prodotto '${prod.productName}' aperto: nuova scadenza calcolata al ${updates.productOpenedExpiryAt}.`,
        productId: pId,
        openedExpiryDate: updates.productOpenedExpiryAt,
      };
    }

    case "pantry_freeze_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id.");
      const prod = await db.getDoc(`products/${pId}`);
      if (!prod) throw new Error(`Prodotto '${pId}' non trovato.`);

      const months = args.months || 3;
      const now = new Date();
      let newExp;
      if (args.custom_expiry_date) {
        newExp = args.custom_expiry_date;
      } else {
        const fDate = new Date(now);
        fDate.setMonth(fDate.getMonth() + months);
        newExp = fDate.toISOString().split("T")[0];
      }

      const updates = {
        productIsFrozen: true,
        productFrozenAt: now.toISOString(),
        productFrozenOriginalExpiry: prod.expiryDateProduct || null,
        expiryDateProduct: newExp,
        productUpdatedAt: now.toISOString(),
      };

      await db.updateDoc(`products/${pId}`, updates);
      return {
        message: `Prodotto '${prod.productName}' congelato nel freezer. Scadenza prorogata al ${newExp}.`,
        productId: pId,
        expiryDate: newExp,
      };
    }

    case "pantry_unfreeze_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id.");
      const prod = await db.getDoc(`products/${pId}`);
      if (!prod) throw new Error(`Prodotto '${pId}' non trovato.`);

      const hours = args.hours_to_consume || 48;
      const unfreezeExpiry = new Date(Date.now() + hours * 3600 * 1000).toISOString().split("T")[0];

      const updates = {
        productIsFrozen: false,
        productThawedAt: new Date().toISOString(),
        expiryDateProduct: unfreezeExpiry,
        productUpdatedAt: new Date().toISOString(),
      };

      await db.updateDoc(`products/${pId}`, updates);
      return {
        message: `Prodotto '${prod.productName}' scongelato. Da consumare preferibilmente entro il ${unfreezeExpiry}.`,
        productId: pId,
        expiryDate: unfreezeExpiry,
      };
    }

    case "pantry_consume_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id.");
      const prod = await db.getDoc(`products/${pId}`);
      if (!prod) throw new Error(`Prodotto '${pId}' non trovato.`);

      const pantryId = prod.productPantryId || getPantryId();
      const currentQty = prod.productQuantity ?? 1;
      const consumeQty = args.quantity !== undefined ? Number(args.quantity) : currentQty;
      const resolution = args.resolution || "consumed";

      const logId = crypto.randomBytes(10).toString("hex");
      await db.setDoc(`pantries/${pantryId}/history/${logId}`, {
        logId,
        pantryId,
        productId: pId,
        productName: prod.productName,
        quantityHistory: consumeQty,
        resolution,
        resolvedAt: new Date().toISOString(),
      });

      if (consumeQty >= currentQty) {
        await db.deleteDoc(`products/${pId}`);
        return {
          message: `Prodotto '${prod.productName}' consumato interamente (${currentQty} ${prod.productUnitOfMeasure || "pcs"}). Rimosso dalla dispensa.`,
          removed: true,
        };
      } else {
        const remaining = currentQty - consumeQty;
        await db.updateDoc(`products/${pId}`, {
          productQuantity: remaining,
          productUpdatedAt: new Date().toISOString(),
        });
        return {
          message: `Consumati ${consumeQty} di '${prod.productName}'. Rimangono ${remaining} ${prod.productUnitOfMeasure || "pcs"}.`,
          remainingQuantity: remaining,
        };
      }
    }

    case "pantry_delete_item": {
      const pId = getProductId();
      if (!pId) throw new Error("Specifica product_id.");
      const prod = await db.getDoc(`products/${pId}`);
      const reason = args.reason || "removed";

      if (prod) {
        const pantryId = prod.productPantryId || getPantryId();
        const logId = crypto.randomBytes(10).toString("hex");
        await db.setDoc(`pantries/${pantryId}/history/${logId}`, {
          logId,
          pantryId,
          productId: pId,
          productName: prod.productName,
          quantityHistory: prod.productQuantity ?? 1,
          resolution: reason === "wasted" || reason === "expired" ? "wasted" : "removed",
          resolvedAt: new Date().toISOString(),
        });
      }

      await db.deleteDoc(`products/${pId}`);
      return { message: `Prodotto '${pId}' eliminato.`, reason };
    }

    // -------------------------------------------------------------
    // 3. LISTA DELLA SPESA
    // -------------------------------------------------------------
    case "shopping_list_get": {
      const pantryId = getPantryId(args.pantry_id);
      let items = await db.queryDocs("shoppingListItems", "listItemPantryId", "==", pantryId);

      if (args.status && args.status !== "all") {
        items = items.filter((i) => i.listItemStatus === args.status);
      }

      const formatted = items.map((i) => ({
        itemId: i.id || i.listItemId,
        name: i.listItemName,
        quantity: i.listItemQuantity ?? 1,
        unit: i.listItemUnit || "pcs",
        status: i.listItemStatus || "toBuy",
        reservedBy: i.listItemReservedBy || null,
        purchasedBy: i.listItemPurchasedBy || null,
        productId: i.listItemProductId || null,
      }));

      return { count: formatted.length, items: formatted };
    }

    case "shopping_list_add": {
      const pantryId = getPantryId(args.pantry_id);
      const newId = crypto.randomBytes(10).toString("hex");
      const newItem = {
        listItemId: newId,
        listItemPantryId: pantryId,
        listItemName: String(args.name).trim(),
        listItemQuantity: args.quantity !== undefined ? args.quantity : 1,
        listItemUnit: args.unit || "pcs",
        listItemStatus: "toBuy",
        listItemProductId: args.product_id || null,
        listItemCreatedAt: new Date().toISOString(),
      };

      await db.setDoc(`shoppingListItems/${newId}`, newItem);
      return { message: `Articolo '${args.name}' aggiunto alla spesa.`, itemId: newId };
    }

    case "shopping_list_set_status": {
      const itemId = args.item_id;
      if (!itemId) throw new Error("Specifica item_id.");
      const updates = {
        listItemStatus: args.status,
        listItemUpdatedAt: new Date().toISOString(),
      };
      if (args.status === "reserved") {
        updates.listItemReservedBy = args.user_name || user.userName || user.userEmail || "Utente";
      } else if (args.status === "purchased") {
        updates.listItemPurchasedBy = args.user_name || user.userName || user.userEmail || "Utente";
      } else {
        updates.listItemReservedBy = null;
        updates.listItemPurchasedBy = null;
      }

      await db.updateDoc(`shoppingListItems/${itemId}`, updates);
      return { message: `Stato articolo aggiornato a '${args.status}'.`, itemId };
    }

    case "shopping_list_checkout": {
      const pantryId = getPantryId(args.pantry_id);
      const allItems = await db.queryDocs("shoppingListItems", "listItemPantryId", "==", pantryId);
      const purchased = allItems.filter((i) => i.listItemStatus === "purchased");

      if (purchased.length === 0) {
        return { message: "Nessun articolo contrassegnato come 'purchased' da finalizzare.", movedCount: 0 };
      }

      const names = [];
      for (const item of purchased) {
        names.push(item.listItemName);
        if (item.listItemProductId) {
          const existingProd = await db.getDoc(`products/${item.listItemProductId}`);
          if (existingProd) {
            await db.updateDoc(`products/${item.listItemProductId}`, {
              productQuantity: (existingProd.productQuantity ?? 0) + (item.listItemQuantity || 1),
              addToShoppingList: false,
              productShoppingListItemId: null,
              productUpdatedAt: new Date().toISOString(),
            });
          }
        } else {
          const newPId = crypto.randomBytes(10).toString("hex");
          await db.setDoc(`products/${newPId}`, {
            productId: newPId,
            productPantryId: pantryId,
            productName: item.listItemName,
            productQuantity: item.listItemQuantity || 1,
            productUnitOfMeasure: item.listItemUnit || "pcs",
            productCategory: "Altro",
            addToShoppingList: false,
            productCreatedAt: new Date().toISOString(),
          });
        }
        await db.deleteDoc(`shoppingListItems/${item.id || item.listItemId}`);
      }

      return {
        message: `Spesa finalizzata con successo: ${purchased.length} articoli aggiunti in dispensa (${names.join(", ")}).`,
        movedCount: purchased.length,
        items: names,
      };
    }

    case "shopping_list_remove": {
      const itemId = args.item_id;
      if (!itemId) throw new Error("Specifica item_id.");
      await db.deleteDoc(`shoppingListItems/${itemId}`);
      return { message: `Articolo ${itemId} rimosso dalla spesa.` };
    }

    // -------------------------------------------------------------
    // 4. PIANO PASTI SETTIMANALE
    // -------------------------------------------------------------
    case "meal_plan_get_weekly": {
      if (!user.userId) throw new Error("Utente non identificato.");
      const weekInfo = getIsoWeekInfo();
      const targetWeek = args.week_id || weekInfo.weekId;
      const plan = await db.getDoc(`users/${user.userId}/mealPlans/${targetWeek}`);

      if (!plan) {
        return {
          weekId: targetWeek,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          days: {},
          message: "Nessun pasto pianificato per questa settimana.",
        };
      }

      return plan;
    }

    case "meal_plan_set_slot": {
      if (!user.userId) throw new Error("Utente non identificato.");
      const weekInfo = getIsoWeekInfo();
      const weekId = args.week_id || weekInfo.weekId;
      const dateStr = args.date;
      const slotType = args.slot_type;

      let plan = await db.getDoc(`users/${user.userId}/mealPlans/${weekId}`);
      if (!plan) {
        plan = {
          weekId,
          userId: user.userId,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          days: {},
        };
      }

      if (!plan.days) plan.days = {};
      if (!plan.days[dateStr]) {
        const dObj = new Date(dateStr);
        const dayNames = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
        plan.days[dateStr] = {
          date: dateStr,
          dayName: dayNames[dObj.getDay()] || "Giorno",
          slots: { colazione: null, pranzo: null, merenda: null, cena: null },
        };
      }

      plan.days[dateStr].slots[slotType] = {
        slotId: crypto.randomBytes(8).toString("hex"),
        slotType,
        recipeId: args.recipe_id || null,
        recipeTitle: args.recipe_title,
        recipeIsAntiWaste: !!args.recipe_is_anti_waste,
        recipePrepTimeMinutes: args.recipe_prep_time_minutes || null,
        servings: args.servings || 2,
        notes: args.notes || null,
        isCooked: !!args.is_cooked,
      };
      plan.updatedAt = new Date().toISOString();

      await db.setDoc(`users/${user.userId}/mealPlans/${weekId}`, plan);
      return {
        message: `Pasto '${args.recipe_title}' assegnato a ${slotType} per il giorno ${dateStr}.`,
        weekId,
        date: dateStr,
        slotType,
      };
    }

    case "meal_plan_remove_slot": {
      if (!user.userId) throw new Error("Utente non identificato.");
      const weekInfo = getIsoWeekInfo();
      const weekId = args.week_id || weekInfo.weekId;
      const { date: dateStr, slot_type: slotType } = args;

      const plan = await db.getDoc(`users/${user.userId}/mealPlans/${weekId}`);
      if (plan && plan.days && plan.days[dateStr] && plan.days[dateStr].slots) {
        plan.days[dateStr].slots[slotType] = null;
        plan.updatedAt = new Date().toISOString();
        await db.setDoc(`users/${user.userId}/mealPlans/${weekId}`, plan);
        return { message: `Slot ${slotType} del ${dateStr} svuotato con successo.` };
      }
      return { message: "Slot non trovato o già vuoto." };
    }

    case "meal_plan_clear_week": {
      if (!user.userId) throw new Error("Utente non identificato.");
      const weekInfo = getIsoWeekInfo();
      const weekId = args.week_id || weekInfo.weekId;
      await db.deleteDoc(`users/${user.userId}/mealPlans/${weekId}`);
      return { message: `Piano pasti della settimana ${weekId} eliminato con successo.` };
    }

    // -------------------------------------------------------------
    // 5. RICETTE & ANTI-SPRECO
    // -------------------------------------------------------------
    case "recipes_list": {
      const pantryId = getPantryId(args.pantry_id);
      let userRec = [];
      let sharedRec = [];

      if (user.userId) {
        try {
          userRec = await db.listDocs(`users/${user.userId}/recipes`, 50);
        } catch (_) {}
      }

      if (args.include_shared !== false) {
        try {
          sharedRec = await db.listDocs(`pantries/${pantryId}/sharedRecipes`, 50);
        } catch (_) {}
      }

      return {
        userRecipesCount: userRec.length,
        userRecipes: userRec,
        sharedRecipesCount: sharedRec.length,
        sharedRecipes: sharedRec,
      };
    }

    case "recipes_get": {
      const recipeId = args.recipe_id;
      const pantryId = getPantryId(args.pantry_id);

      if (user.userId) {
        const uRec = await db.getDoc(`users/${user.userId}/recipes/${recipeId}`);
        if (uRec) return uRec;
      }

      const sRec = await db.getDoc(`pantries/${pantryId}/sharedRecipes/${recipeId}`);
      if (sRec) return sRec;

      throw new Error(`Ricetta con ID '${recipeId}' non trovata.`);
    }

    case "recipes_save": {
      if (!user.userId) throw new Error("Utente non autenticato.");
      const pantryId = getPantryId(args.pantry_id);
      const recId = crypto.randomBytes(10).toString("hex");

      const recipeDoc = {
        recipeId: recId,
        recipeTitle: String(args.title).trim(),
        recipeDescription: args.description || "",
        recipeIngredients: Array.isArray(args.ingredients) ? args.ingredients : [args.ingredients],
        recipeInstructions: Array.isArray(args.instructions) ? args.instructions : [args.instructions],
        recipePrepTimeMinutes: args.prep_time_minutes || null,
        recipeServings: args.servings || null,
        recipeIsAntiWaste: !!args.is_anti_waste,
        recipeAuthorUid: user.userId,
        recipeSharedWithPantryId: args.share_with_pantry ? pantryId : null,
        recipeCreatedAt: new Date().toISOString(),
        recipeUpdatedAt: new Date().toISOString(),
      };

      await db.setDoc(`users/${user.userId}/recipes/${recId}`, recipeDoc);
      if (args.share_with_pantry) {
        await db.setDoc(`pantries/${pantryId}/sharedRecipes/${recId}`, recipeDoc);
      }

      return { message: `Ricetta '${args.title}' salvata con successo.`, recipeId: recId };
    }

    case "recipes_delete": {
      const recId = args.recipe_id;
      const pantryId = getPantryId(args.pantry_id);
      if (user.userId) {
        await db.deleteDoc(`users/${user.userId}/recipes/${recId}`);
      }
      try {
        await db.deleteDoc(`pantries/${pantryId}/sharedRecipes/${recId}`);
      } catch (_) {}
      return { message: `Ricetta ${recId} eliminata.` };
    }

    case "recipes_suggest_anti_waste": {
      const pantryId = getPantryId(args.pantry_id);
      const prods = await db.queryDocs("products", "productPantryId", "==", pantryId);

      const now = new Date();
      const expiringSoon = prods
        .map((p) => {
          const expStr = p.productOpenedExpiryAt || p.expiryDateProduct;
          let days = 999;
          if (expStr) {
            const d = new Date(expStr);
            if (!isNaN(d.getTime())) {
              days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            }
          }
          return { name: p.productName, days, qty: p.productQuantity, unit: p.productUnitOfMeasure, category: p.productCategory };
        })
        .filter((p) => p.days <= 7)
        .sort((a, b) => a.days - b.days);

      return {
        expiringIngredients: expiringSoon,
        suggestionCount: Math.min(expiringSoon.length, args.max_recipes || 3),
        note: "Utilizza questi ingredienti prioritari per comporre ricette veloci e abbattere lo spreco.",
      };
    }

    // -------------------------------------------------------------
    // 6. STORICO CONSUMI & ANALISI SPRECO
    // -------------------------------------------------------------
    case "history_get_logs": {
      const pantryId = getPantryId(args.pantry_id);
      let logs = await db.listDocs(`pantries/${pantryId}/history`, args.limit || 50);

      if (args.resolution && args.resolution !== "all") {
        logs = logs.filter((l) => l.resolution === args.resolution);
      }

      return { count: logs.length, logs };
    }

    case "history_get_summary": {
      const pantryId = getPantryId(args.pantry_id);
      const logs = await db.listDocs(`pantries/${pantryId}/history`, 200);

      let totalConsumed = 0;
      let totalWasted = 0;
      const wastedProducts = {};

      for (const l of logs) {
        const qty = l.quantityHistory ?? 1;
        if (l.resolution === "consumed" || l.resolution === "rescued") {
          totalConsumed += qty;
        } else if (l.resolution === "wasted") {
          totalWasted += qty;
          const pName = l.productName || "Sconosciuto";
          wastedProducts[pName] = (wastedProducts[pName] || 0) + qty;
        }
      }

      const totalItems = totalConsumed + totalWasted;
      const wasteRate = totalItems > 0 ? ((totalWasted / totalItems) * 100).toFixed(1) + "%" : "0%";
      const rescueRate = totalItems > 0 ? ((totalConsumed / totalItems) * 100).toFixed(1) + "%" : "100%";

      return {
        totalLoggedItems: totalItems,
        totalConsumedOrRescued: totalConsumed,
        totalWasted,
        wasteRate,
        rescueRate,
        mostWastedItems: Object.entries(wastedProducts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, qty]) => ({ name, qty })),
      };
    }

    // -------------------------------------------------------------
    // 7. GESTIONE DISPENSE E CATEGORIE
    // -------------------------------------------------------------
    case "pantry_list_pantries": {
      const pantries = [];
      for (const pid of user.pantryIds) {
        const pDoc = await db.getDoc(`pantries/${pid}`);
        if (pDoc) {
          pantries.push({
            pantryId: pid,
            name: pDoc.pantryName,
            isCurrent: pid === user.currentPantryId,
            inviteCode: pDoc.pantryInviteCode || null,
            membersCount: (pDoc.pantryMembers || []).length,
          });
        }
      }
      return { pantries };
    }

    case "pantry_switch_current": {
      const targetPantryId = String(args.pantry_id).trim();
      if (!user.pantryIds.includes(targetPantryId)) {
        throw new Error(`Non hai accesso alla dispensa specificata: ${targetPantryId}. Dispense valide: ${user.pantryIds.join(", ")}`);
      }

      user.currentPantryId = targetPantryId;
      if (user.userId) {
        await db.updateDoc(`users/${user.userId}`, {
          userProfileCurrentPantryId: targetPantryId,
        });
      }

      return {
        message: `Dispensa attiva impostata con successo su ${targetPantryId}.`,
        currentPantryId: targetPantryId,
      };
    }

    case "pantry_manage_categories": {
      const pantryId = getPantryId(args.pantry_id);
      const pDoc = await db.getDoc(`pantries/${pantryId}`);
      if (!pDoc) throw new Error("Dispensa non trovata.");

      const defaultCats = [
        "Frutta", "Verdura", "Latticini", "Carne", "Pesce", "Pasta",
        "Cereali", "Conserve", "Condimenti", "Bevande", "Snack", "Surgelati", "Altro"
      ];
      const customCats = pDoc.pantryCustomCategories || [];
      const allCats = Array.from(new Set([...defaultCats, ...customCats]));

      if (args.action === "list") {
        return { categories: allCats, customCategories: customCats };
      }

      if (args.action === "add") {
        const catName = String(args.category_name).trim();
        if (!catName) throw new Error("Specifica category_name.");
        if (!customCats.includes(catName)) {
          customCats.push(catName);
          await db.updateDoc(`pantries/${pantryId}`, { pantryCustomCategories: customCats });
        }
        return { message: `Categoria '${catName}' aggiunta.`, categories: Array.from(new Set([...defaultCats, ...customCats])) };
      }

      if (args.action === "remove") {
        const catName = String(args.category_name).trim();
        const filtered = customCats.filter((c) => c !== catName);
        await db.updateDoc(`pantries/${pantryId}`, { pantryCustomCategories: filtered });
        return { message: `Categoria '${catName}' rimossa.`, customCategories: filtered };
      }

      throw new Error(`Azione sconosciuta: ${args.action}`);
    }

    default:
      throw new Error(`Tool sconosciuto: ${name}`);
  }
}

// ===============================================================
// RESOURCE READ HANDLER
// ===============================================================

async function handleReadResource(uri, user) {
  const pantryId = user.currentPantryId || (user.pantryIds[0] || "");
  if (!pantryId) throw new Error("Nessuna dispensa associata per visualizzare la risorsa.");

  let data;
  switch (uri) {
    case "pantry://current/summary":
      data = await handleToolExecution("pantry_get_summary", { pantry_id: pantryId }, user);
      break;
    case "pantry://current/inventory":
      data = await handleToolExecution("pantry_list_items", { pantry_id: pantryId }, user);
      break;
    case "pantry://current/shopping-list":
      data = await handleToolExecution("shopping_list_get", { pantry_id: pantryId }, user);
      break;
    case "pantry://current/meal-plan":
      data = await handleToolExecution("meal_plan_get_weekly", {}, user);
      break;
    case "pantry://current/recipes":
      data = await handleToolExecution("recipes_list", { pantry_id: pantryId }, user);
      break;
    case "pantry://current/history":
      data = await handleToolExecution("history_get_summary", { pantry_id: pantryId }, user);
      break;
    case "pantry://current/export-all":
      data = await handleToolExecution("pantry_export_all_data", { pantry_id: pantryId }, user);
      break;
    default:
      throw new Error(`Risorsa sconosciuta: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ===============================================================
// MAIN INITIALIZATION
// ===============================================================

async function main() {
  await db.init();

  const token = process.env.PANTRY_MCP_TOKEN || process.env.MCP_TOKEN;
  const user = await resolveUser(token);
  console.error(`[PantryAI MCP] Inizializzato per utente: ${user.userEmail || user.userId} (Dispensa: ${user.currentPantryId || "N/A"})`);

  const server = new Server(
    { name: "pantry-ai", version: "2.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const res = await handleToolExecution(req.params.name, req.params.arguments || {}, user);
      return {
        content: [
          {
            type: "text",
            text: typeof res === "string" ? res : JSON.stringify(res, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Errore: ${err.message || String(err)}` }],
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: "pantry://current/summary", name: "Panoramica Dispensa Corrente", mimeType: "application/json" },
      { uri: "pantry://current/inventory", name: "Inventario Prodotti Corrente", mimeType: "application/json" },
      { uri: "pantry://current/shopping-list", name: "Lista della Spesa Corrente", mimeType: "application/json" },
      { uri: "pantry://current/meal-plan", name: "Piano Pasti Settimana Corrente", mimeType: "application/json" },
      { uri: "pantry://current/recipes", name: "Ricette Utente e Condivise", mimeType: "application/json" },
      { uri: "pantry://current/history", name: "Statistiche Storico e Spreco", mimeType: "application/json" },
      { uri: "pantry://current/export-all", name: "Dump Completo Dati Dispensa", mimeType: "application/json" },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    return await handleReadResource(req.params.uri, user);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      { name: "pantry_audit", description: "Audit anti-spreco completo della dispensa attiva" },
      { name: "meal_prep_planner", description: "Pianificatore settimanale dei pasti basato sui cibi in scadenza" },
      { name: "waste_reduction_advisor", description: "Suggerimenti per abbattere gli sprechi alimentari e massimizzare il risparmio" },
    ],
  }));

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Fatal error starting PantryAI MCP server:", e);
  process.exit(1);
});
