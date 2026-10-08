#!/usr/bin/env node
/**
 * PantryAI Stdio MCP Server Runner
 * Esegue il server MCP direttamente comunicando via stdin/stdout con Antigravity
 * e leggendo/scrivendo su Firestore tramite Firebase SDK.
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "pantryai-cee9e";

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

function initAdmin() {
  if (admin.apps.length > 0) return admin.apps[0];

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
        projectId: PROJECT_ID,
      });
    } catch (e) {
      console.error("[PantryAI MCP] Errore parsing service account:", e);
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: PROJECT_ID,
        clientEmail,
        privateKey,
      }),
      projectId: PROJECT_ID,
    });
  }

  const customCredential = {
    getAccessToken: async () => {
      const token = await getValidAccessToken();
      return {
        access_token: token || "",
        expires_in: 3600,
      };
    },
  };

  return admin.initializeApp({
    credential: customCredential,
    projectId: PROJECT_ID,
  });
}

const adminApp = initAdmin();
const adminDb = admin.firestore(adminApp);
const db = adminDb;

// Helper shims compatibili con la sintassi Firestore usata nei tool handlers
function collection(database, colName) {
  return adminDb.collection(colName);
}

function doc(first, ...rest) {
  if (typeof first === "string") {
    return rest[0] ? adminDb.collection(first).doc(rest[0]) : adminDb.collection(first).doc();
  }
  if (first && first.collection && rest.length === 2) {
    return adminDb.collection(rest[0]).doc(rest[1]);
  }
  if (first && first.collection && rest.length === 1) {
    return adminDb.collection(rest[0]).doc();
  }
  if (first && first.doc) {
    return rest[0] ? first.doc(rest[0]) : first.doc();
  }
  return adminDb.doc(rest.join("/"));
}

function query(colRef, ...constraints) {
  let q = colRef;
  for (const c of constraints) {
    if (c && typeof c.apply === "function") {
      q = c.apply(q);
    }
  }
  return q;
}

function where(field, op, val) {
  return {
    apply: (q) => q.where(field, op, val),
  };
}

async function getDocs(q) {
  return await q.get();
}

async function getDoc(docRef) {
  return await docRef.get();
}

async function setDoc(docRef, data, options) {
  return await docRef.set(data, options);
}

async function updateDoc(docRef, data) {
  return await docRef.update(data);
}

async function deleteDoc(docRef) {
  return await docRef.delete();
}

function writeBatch() {
  return adminDb.batch();
}

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const Timestamp = admin.firestore.Timestamp;

function formatTimestamp(ts) {
  if (!ts || !ts.toDate) return null;
  return ts.toDate().toISOString().split("T")[0];
}

async function resolveUser(token) {
  if (token) {
    try {
      const q = query(collection(db, "users"), where("mcpToken", "==", token));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const uDoc = snap.docs[0];
        const data = uDoc.data();
        const pantryIds = Array.isArray(data.userProfilePantryIds) ? data.userProfilePantryIds.filter(Boolean) : [];
        return {
          userId: uDoc.id,
          userEmail: data.userEmail || "",
          userName: data.userProfileName || undefined,
          currentPantryId: data.userProfileCurrentPantryId || (pantryIds[0] || ""),
          pantryIds,
        };
      }
    } catch (e) {
      console.error("[PantryAI MCP] Errore lookup token:", e);
    }
  }

  // Fallback sull'email dell'account Firebase CLI loggato
  const cliEmail = getCliUserEmail();
  if (cliEmail) {
    try {
      const q = query(collection(db, "users"), where("userEmail", "==", cliEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const uDoc = snap.docs[0];
        const data = uDoc.data();
        const pantryIds = Array.isArray(data.userProfilePantryIds) ? data.userProfilePantryIds.filter(Boolean) : [];
        return {
          userId: uDoc.id,
          userEmail: data.userEmail || "",
          userName: data.userProfileName || undefined,
          currentPantryId: data.userProfileCurrentPantryId || (pantryIds[0] || ""),
          pantryIds,
        };
      }
    } catch (e) {
      console.error("[PantryAI MCP] Errore lookup email:", e);
    }
  }

  // Fallback sul primo utente registrato con dispense
  try {
    const snap = await getDocs(collection(db, "users"));
    if (!snap.empty) {
      for (const uDoc of snap.docs) {
        const data = uDoc.data();
        const pantryIds = Array.isArray(data.userProfilePantryIds) ? data.userProfilePantryIds.filter(Boolean) : [];
        if (pantryIds.length > 0 || data.userProfileCurrentPantryId) {
          return {
            userId: uDoc.id,
            userEmail: data.userEmail || "",
            userName: data.userProfileName || undefined,
            currentPantryId: data.userProfileCurrentPantryId || (pantryIds[0] || ""),
            pantryIds,
          };
        }
      }
    }
  } catch (e) {
    console.error("[PantryAI MCP] Errore lookup users:", e);
  }

  return {
    userId: "guest",
    userEmail: "guest@pantryai.app",
    currentPantryId: "",
    pantryIds: [],
  };
}

const MCP_TOOLS = [
  {
    name: "pantry_get_summary",
    description: "Restituisce una panoramica quantitativa della dispensa attiva: conteggio totale articoli, prodotti in scadenza a 3 e 7 giorni, prodotti esauriti e totale articoli da comprare nella spesa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string", description: "ID opzionale della dispensa" },
      },
    },
  },
  {
    name: "pantry_list_items",
    description: "Elenca e cerca gli alimenti presenti in dispensa, con filtri avanzati per nome, categoria, stato di scadenza, o stato di apertura.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        query: { type: "string", description: "Ricerca per nome" },
        category: { type: "string" },
        only_expiring_days: { type: "number" },
        only_opened: { type: "boolean" },
        only_frozen: { type: "boolean", description: "Se true filtra solo gli alimenti congelati nel freezer" },
      },
    },
  },
  {
    name: "pantry_freeze_item",
    description: "Contrassegna un alimento come congelato nel freezer con scadenza estesa (default: +3 mesi).",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        months: { type: "number", description: "Mesi di conservazione (default: 3)" },
        custom_expiry_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_unfreeze_item",
    description: "Scongela un alimento dal freezer (consume_soon per consumo in 24-72h o restore_original per data originale).",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        mode: { type: "string", enum: ["consume_soon", "restore_original"] },
        hours_to_consume: { type: "number", description: "Ore per consume_soon (default: 48)" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_add_item",
    description: "Aggiunge un nuovo alimento all'inventario o ne incrementa la quantità se già presente.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        name: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string" },
        category: { type: "string" },
        expiry_date: { type: "string", description: "YYYY-MM-DD" },
        shelf_life_days: { type: "number" },
        barcode: { type: "string" },
        update_if_exists: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "pantry_update_item",
    description: "Aggiorna dettagli o quantità di un prodotto.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        name: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string" },
        category: { type: "string" },
        expiry_date: { type: "string" },
        shelf_life_days: { type: "number" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_open_item",
    description: "Contrassegna un alimento come aperto, ricalcolando la scadenza dinamica.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        shelf_life_days: { type: "number" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_consume_item",
    description: "Consuma o scarta un prodotto tracciando lo spreco/risparmio (consumed, rescued, wasted).",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        quantity: { type: "number" },
        resolution: { type: "string", enum: ["consumed", "rescued", "wasted", "auto"] },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_delete_item",
    description: "Elimina direttamente un prodotto.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "shopping_list_get",
    description: "Recupera gli articoli della lista della spesa con il loro stato (toBuy, reserved, purchased).",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
      },
    },
  },
  {
    name: "shopping_list_add",
    description: "Aggiunge un articolo alla lista della spesa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        name: { type: "string" },
        product_id: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "shopping_list_set_status",
    description: "Aggiorna lo stato di un articolo in spesa (toBuy, reserved, purchased).",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        status: { type: "string", enum: ["toBuy", "reserved", "purchased"] },
        user_name: { type: "string" },
      },
      required: ["item_id", "status"],
    },
  },
  {
    name: "shopping_list_checkout",
    description: "Finalizza la spesa: archivia gli articoli spuntati 'purchased' e li reinserisce in dispensa.",
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
  {
    name: "pantry_list_pantries",
    description: "Elenca le dispense accessibili all'utente.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pantry_manage_categories",
    description: "Legge, aggiunge o rimuove categorie merceologiche.",
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
  {
    name: "history_get_summary",
    description: "Riepilogo metriche ambientali: totale cibo salvato vs sprecato e registro consumi.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
];

async function handleToolExecution(name, args, user) {
  function getPantryId(reqId) {
    if (reqId && reqId.trim()) return reqId.trim();
    if (!user.currentPantryId) throw new Error("Nessuna dispensa selezionata o associata all'account.");
    return user.currentPantryId;
  }

  switch (name) {
    case "pantry_get_summary": {
      const pantryId = getPantryId(args.pantry_id);
      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const q = query(collection(db, "products"), where("productPantryId", "==", pantryId));
      const snap = await getDocs(q);

      let totalProducts = 0;
      let zeroStock = 0;
      let expiring3Days = 0;
      let expiring7Days = 0;
      let openedCount = 0;
      let frozenCount = 0;

      snap.forEach((dSnap) => {
        totalProducts++;
        const d = dSnap.data();
        if ((d.productQuantity ?? 0) <= 0) zeroStock++;
        if (d.productOpenedAt) openedCount++;
        if (d.isFrozen) frozenCount++;

        const expTs = d.isFrozen ? d.productFrozenExpiryAt : (d.productOpenedExpiryAt || d.expiryDateProduct);
        if (expTs && expTs.toDate) {
          const expDate = expTs.toDate();
          if (expDate <= in3Days) expiring3Days++;
          if (expDate <= in7Days) expiring7Days++;
        }
      });

      const sq = query(
        collection(db, "shoppingListItems"),
        where("listItemPantryId", "==", pantryId),
        where("listItemStatus", "==", "toBuy")
      );
      const sSnap = await getDocs(sq);

      return {
        pantryId,
        totaleProdottiInGiacenza: totalProducts,
        prodottiEsauriti: zeroStock,
        prodottiAperti: openedCount,
        prodottiCongelatiNelFreezer: frozenCount,
        prodottiInScadenzaEntro3Giorni: expiring3Days,
        prodottiInScadenzaEntro7Giorni: expiring7Days,
        articoliDaComprareInSpesa: sSnap.size,
      };
    }

    case "pantry_list_items": {
      const pantryId = getPantryId(args.pantry_id);
      const q = query(collection(db, "products"), where("productPantryId", "==", pantryId));
      const snap = await getDocs(q);

      const now = new Date();
      let items = [];

      snap.forEach((dSnap) => {
        const d = dSnap.data();
        const expTs = d.isFrozen ? d.productFrozenExpiryAt : (d.productOpenedExpiryAt || d.expiryDateProduct);
        let daysToExpiry = null;
        if (expTs && expTs.toDate) {
          daysToExpiry = Math.ceil((expTs.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        items.push({
          productId: dSnap.id,
          name: d.productName,
          quantity: d.productQuantity ?? 1,
          unit: d.productUnitOfMeasure || "pz",
          category: d.productCategory || "Altro",
          expiryDate: formatTimestamp(d.expiryDateProduct),
          isOpened: Boolean(d.productOpenedAt),
          openedExpiryDate: formatTimestamp(d.productOpenedExpiryAt),
          isFrozen: Boolean(d.isFrozen),
          frozenExpiryDate: formatTimestamp(d.productFrozenExpiryAt),
          frozenAt: formatTimestamp(d.productFrozenAt),
          effectiveDaysToExpiry: daysToExpiry,
          barcode: d.productBarcode || null,
        });
      });

      if (args.query) {
        const queryTerm = args.query.toLowerCase().trim();
        items = items.filter((it) => it.name.toLowerCase().includes(queryTerm));
      }
      if (args.category) {
        const cat = args.category.toLowerCase().trim();
        items = items.filter((it) => (it.category || "").toLowerCase() === cat);
      }
      if (args.only_opened) {
        items = items.filter((it) => it.isOpened);
      }
      if (args.only_frozen) {
        items = items.filter((it) => it.isFrozen);
      }
      if (typeof args.only_expiring_days === "number") {
        items = items.filter((it) => it.effectiveDaysToExpiry !== null && it.effectiveDaysToExpiry <= args.only_expiring_days);
      }

      items.sort((a, b) => {
        if (a.effectiveDaysToExpiry === null) return 1;
        if (b.effectiveDaysToExpiry === null) return -1;
        return a.effectiveDaysToExpiry - b.effectiveDaysToExpiry;
      });

      return { count: items.length, items };
    }

    case "pantry_add_item": {
      const pantryId = getPantryId(args.pantry_id);
      const name = String(args.name).trim();
      const qty = Number(args.quantity ?? 1);

      if (args.update_if_exists !== false) {
        const existingQuery = query(
          collection(db, "products"),
          where("productPantryId", "==", pantryId),
          where("productName", "==", name)
        );
        const existingSnap = await getDocs(existingQuery);
        if (!existingSnap.empty) {
          const docRef = existingSnap.docs[0].ref;
          const curQty = existingSnap.docs[0].data().productQuantity ?? 0;
          const newQty = curQty + qty;
          await updateDoc(docRef, {
            productQuantity: newQty,
            productUpdatedAt: serverTimestamp(),
          });
          return `Prodotto '${name}' già esistente: quantità incrementata da ${curQty} a ${newQty}.`;
        }
      }

      const pRef = doc(collection(db, "products"));
      let expiryTs = null;
      if (args.expiry_date) {
        expiryTs = Timestamp.fromDate(new Date(args.expiry_date));
      }

      await setDoc(pRef, {
        productId: pRef.id,
        productPantryId: pantryId,
        productName: name,
        productQuantity: qty,
        productUnitOfMeasure: args.unit || "pz",
        productCategory: args.category || "Altro",
        expiryDateProduct: expiryTs,
        shelfLifeDays: args.shelf_life_days ?? null,
        productBarcode: args.barcode || null,
        addToShoppingList: false,
        productCreatedAt: serverTimestamp(),
      });

      return `Alimento '${name}' (${qty} ${args.unit || "pz"}) aggiunto con successo in dispensa (ID: ${pRef.id}).`;
    }

    case "pantry_open_item": {
      const pRef = doc(db, "products", args.product_id);
      const snap = await getDoc(pRef);
      if (!snap.exists()) throw new Error("Prodotto non trovato.");
      const d = snap.data();
      const shelfDays = args.shelf_life_days ?? d.shelfLifeDays ?? 3;
      const openedAt = new Date();
      const openedExpiryAt = new Date(openedAt.getTime() + shelfDays * 24 * 60 * 60 * 1000);

      await updateDoc(pRef, {
        productOpenedAt: Timestamp.fromDate(openedAt),
        productOpenedExpiryAt: Timestamp.fromDate(openedExpiryAt),
        shelfLifeDays: shelfDays,
        productUpdatedAt: serverTimestamp(),
      });

      return `Alimento '${d.productName}' aperto! Scadenza ricalcolata al ${openedExpiryAt.toISOString().split("T")[0]}.`;
    }

    case "pantry_freeze_item": {
      const pRef = doc(db, "products", args.product_id);
      const snap = await getDoc(pRef);
      if (!snap.exists()) throw new Error("Prodotto non trovato.");
      const d = snap.data();

      const months = typeof args.months === "number" && args.months > 0 ? args.months : 3;
      const now = new Date();
      let frozenExpiry;
      if (args.custom_expiry_date) {
        frozenExpiry = new Date(args.custom_expiry_date);
      } else {
        frozenExpiry = new Date(now);
        frozenExpiry.setMonth(frozenExpiry.getMonth() + months);
      }

      const originalExp = d.originalExpiryDateBeforeFreeze || d.expiryDateProduct || null;

      await updateDoc(pRef, {
        isFrozen: true,
        productFrozenAt: Timestamp.fromDate(now),
        productFrozenExpiryAt: Timestamp.fromDate(frozenExpiry),
        frozenMonthsDuration: months,
        originalExpiryDateBeforeFreeze: originalExp,
        productUpdatedAt: serverTimestamp(),
      });

      return `Alimento '${d.productName}' congelato nel freezer! Nuova scadenza: ${frozenExpiry.toISOString().split("T")[0]} (+${months} mesi).`;
    }

    case "pantry_unfreeze_item": {
      const pRef = doc(db, "products", args.product_id);
      const snap = await getDoc(pRef);
      if (!snap.exists()) throw new Error("Prodotto non trovato.");
      const d = snap.data();

      const mode = args.mode === "restore_original" ? "restore_original" : "consume_soon";
      const now = new Date();

      if (mode === "consume_soon") {
        const hours = typeof args.hours_to_consume === "number" && args.hours_to_consume > 0 ? args.hours_to_consume : 48;
        const openedExpiry = new Date(now.getTime() + hours * 60 * 60 * 1000);
        await updateDoc(pRef, {
          isFrozen: false,
          productOpenedAt: Timestamp.fromDate(now),
          productOpenedExpiryAt: Timestamp.fromDate(openedExpiry),
          shelfLifeDays: Math.ceil(hours / 24),
          productFrozenExpiryAt: null,
          productUpdatedAt: serverTimestamp(),
        });
        return `Alimento '${d.productName}' scongelato per consumo rapido (entro ${hours} ore: ${openedExpiry.toISOString().split("T")[0]}).`;
      } else {
        const originalDate = d.originalExpiryDateBeforeFreeze || d.expiryDateProduct || null;
        await updateDoc(pRef, {
          isFrozen: false,
          expiryDateProduct: originalDate,
          productFrozenAt: null,
          productFrozenExpiryAt: null,
          originalExpiryDateBeforeFreeze: null,
          productUpdatedAt: serverTimestamp(),
        });
        return `Alimento '${d.productName}' scongelato con data originale di confezione ripristinata.`;
      }
    }

    case "pantry_consume_item": {
      const pRef = doc(db, "products", args.product_id);
      const snap = await getDoc(pRef);
      if (!snap.exists()) throw new Error("Prodotto non trovato.");
      const d = snap.data();
      const curQty = d.productQuantity ?? 1;
      const qtyToConsume = args.quantity ? Math.min(Number(args.quantity), curQty) : curQty;

      let resolution = "consumed";
      if (args.resolution && args.resolution !== "auto") {
        resolution = args.resolution;
      } else {
        const expTs = d.productOpenedExpiryAt || d.expiryDateProduct;
        if (expTs && expTs.toDate) {
          const diffDays = Math.ceil((expTs.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) resolution = "wasted";
          else if (diffDays <= 3) resolution = "rescued";
        }
      }

      // Log storico
      const histRef = doc(collection(db, "pantries", d.productPantryId, "history"));
      await setDoc(histRef, {
        logId: histRef.id,
        productId: snap.id,
        productName: d.productName,
        quantityHistory: qtyToConsume,
        pantryId: d.productPantryId,
        resolvedAt: serverTimestamp(),
        resolution,
      });

      const rem = curQty - qtyToConsume;
      if (rem <= 0) {
        await deleteDoc(pRef);
        return `'${d.productName}' consumato interamente (${qtyToConsume}). Classificato come '${resolution}' e rimosso dalla dispensa.`;
      } else {
        await updateDoc(pRef, { productQuantity: rem, productUpdatedAt: serverTimestamp() });
        return `Consumati ${qtyToConsume} di '${d.productName}' (${resolution}). Giacenza rimanente: ${rem}.`;
      }
    }

    case "pantry_delete_item": {
      const pRef = doc(db, "products", args.product_id);
      await deleteDoc(pRef);
      return `Prodotto ${args.product_id} eliminato.`;
    }

    case "shopping_list_get": {
      const pantryId = getPantryId(args.pantry_id);
      const q = query(collection(db, "shoppingListItems"), where("listItemPantryId", "==", pantryId));
      const snap = await getDocs(q);
      const items = [];
      snap.forEach((dSnap) => {
        const d = dSnap.data();
        items.push({
          itemId: dSnap.id,
          name: d.listItemName,
          status: d.listItemStatus,
          reservedBy: d.listItemReservedBy || null,
          purchasedBy: d.listItemPurchasedBy || null,
          productId: d.listItemProductId || null,
        });
      });
      return { count: items.length, items };
    }

    case "shopping_list_add": {
      const pantryId = getPantryId(args.pantry_id);
      const itemRef = doc(collection(db, "shoppingListItems"));
      await setDoc(itemRef, {
        listItemId: itemRef.id,
        listItemPantryId: pantryId,
        listItemName: String(args.name).trim(),
        listItemStatus: "toBuy",
        listItemProductId: args.product_id || null,
        listItemCreatedAt: serverTimestamp(),
      });
      return `Articolo '${args.name}' aggiunto alla spesa (ID: ${itemRef.id}).`;
    }

    case "shopping_list_checkout": {
      const pantryId = getPantryId(args.pantry_id);
      const q = query(
        collection(db, "shoppingListItems"),
        where("listItemPantryId", "==", pantryId),
        where("listItemStatus", "==", "purchased")
      );
      const snap = await getDocs(q);
      if (snap.empty) return "Nessun articolo spuntato come 'purchased' da finalizzare.";

      const batch = writeBatch(db);
      const names = [];

      for (const dSnap of snap.docs) {
        const item = dSnap.data();
        names.push(item.listItemName);
        if (item.listItemProductId) {
          const pRef = doc(db, "products", item.listItemProductId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            batch.update(pRef, {
              productQuantity: (pSnap.data().productQuantity ?? 0) + 1,
              addToShoppingList: false,
              productShoppingListItemId: null,
              productUpdatedAt: serverTimestamp(),
            });
          }
        } else {
          const newP = doc(collection(db, "products"));
          batch.set(newP, {
            productId: newP.id,
            productPantryId: pantryId,
            productName: item.listItemName,
            productQuantity: 1,
            productUnitOfMeasure: "pz",
            productCategory: "Altro",
            addToShoppingList: false,
            productCreatedAt: serverTimestamp(),
          });
        }
        batch.delete(dSnap.ref);
      }
      await batch.commit();
      return `Spesa finalizzata: ${names.length} articoli reinseriti in dispensa (${names.join(", ")}).`;
    }

    case "shopping_list_remove": {
      await deleteDoc(doc(db, "shoppingListItems", args.item_id));
      return `Articolo ${args.item_id} rimosso dalla spesa.`;
    }

    case "pantry_list_pantries": {
      const list = [];
      for (const pid of user.pantryIds) {
        const snap = await getDoc(doc(db, "pantries", pid));
        if (snap.exists()) {
          const d = snap.data();
          list.push({
            pantryId: pid,
            name: d.pantryName,
            isCurrent: pid === user.currentPantryId,
            inviteCode: d.pantryInviteCode,
            membersCount: (d.pantryMembers || []).length,
          });
        }
      }
      return { pantries: list };
    }

    default:
      throw new Error(`Tool sconosciuto: ${name}`);
  }
}

async function main() {
  const token = process.env.PANTRY_MCP_TOKEN || process.env.MCP_TOKEN;
  const user = await resolveUser(token);

  const server = new Server(
    { name: "pantry-ai", version: "1.0.0" },
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
      {
        uri: "pantry://current/inventory",
        name: "Inventario Dispensa Attuale",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [{ name: "pantry_audit", description: "Audit anti-spreco dispensa" }],
  }));

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Fatal error starting PantryAI MCP server:", e);
  process.exit(1);
});
