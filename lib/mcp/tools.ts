import { adminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { ResolvedMcpUser } from "./auth";
import { generateRecipeExpiration, generateRecipeFromIngredients, chatWithChefAI } from "@/lib/genkit/genkit";

// Helper per risolvere la dispensa di destinazione
function resolvePantryId(user: ResolvedMcpUser, requestedPantryId?: string): string {
  if (requestedPantryId && requestedPantryId.trim()) {
    const id = requestedPantryId.trim();
    if (!user.pantryIds.includes(id)) {
      throw new Error(`Non hai accesso alla dispensa specificata: ${id}`);
    }
    return id;
  }
  if (!user.currentPantryId) {
    throw new Error("Nessuna dispensa selezionata o associata al tuo account.");
  }
  return user.currentPantryId;
}

// Helper formattazione date
function formatTimestamp(ts?: Timestamp | null): string | null {
  if (!ts || !ts.toDate) return null;
  return ts.toDate().toISOString().split("T")[0]!;
}

// ===============================================================
// TOOL DEFINITIONS
// ===============================================================

export const MCP_TOOLS = [
  // --- INVENTARIO ---
  {
    name: "pantry_get_summary",
    description: "Restituisce una panoramica quantitativa della dispensa attiva: conteggio totale articoli, prodotti in scadenza a 3 e 7 giorni, prodotti esauriti e totale articoli da comprare nella spesa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa (se omesso usa quella predefinita dell'utente)",
        },
      },
    },
  },
  {
    name: "pantry_list_items",
    description: "Elenca e cerca gli alimenti presenti in dispensa, con filtri avanzati per nome, categoria, stato di scadenza, o stato di apertura.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
        query: {
          type: "string",
          description: "Ricerca testuale per nome prodotto",
        },
        category: {
          type: "string",
          description: "Filtra per categoria merceologica (es. Frutta, Latticini, Carne, ecc.)",
        },
        only_expiring_days: {
          type: "number",
          description: "Filtra i prodotti che scadono entro questo numero di giorni (es. 3 o 7)",
        },
        only_opened: {
          type: "boolean",
          description: "Se true restituisce solo gli alimenti già aperti",
        },
        only_frozen: {
          type: "boolean",
          description: "Se true restituisce solo gli alimenti congelati nel freezer",
        },
      },
    },
  },
  {
    name: "pantry_add_item",
    description: "Aggiunge un nuovo alimento all'inventario o ne incrementa la quantità se già presente. Supporta scadenza, barcode e shelf-life da aperto.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
        name: {
          type: "string",
          description: "Nome dell'alimento",
        },
        quantity: {
          type: "number",
          description: "Quantità da inserire (default: 1)",
        },
        unit: {
          type: "string",
          description: "Unità di misura (pz, kg, g, l, ml, confezioni)",
        },
        category: {
          type: "string",
          description: "Categoria merceologica",
        },
        expiry_date: {
          type: "string",
          description: "Data di scadenza nel formato YYYY-MM-DD",
        },
        shelf_life_days: {
          type: "number",
          description: "Giorni di durata dopo l'apertura della confezione",
        },
        barcode: {
          type: "string",
          description: "Codice a barre EAN/UPC opzionale",
        },
        update_if_exists: {
          type: "boolean",
          description: "Se true e un prodotto con lo stesso nome esiste già, somma la quantità invece di creare un duplicato (default: true)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "pantry_update_item",
    description: "Aggiorna i dettagli o la quantità di un alimento esistente tramite il suo productId.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "ID univoco del prodotto",
        },
        name: {
          type: "string",
          description: "Nuovo nome",
        },
        quantity: {
          type: "number",
          description: "Nuova quantità (numero assoluto)",
        },
        unit: {
          type: "string",
          description: "Unità di misura",
        },
        category: {
          type: "string",
          description: "Nuova categoria",
        },
        expiry_date: {
          type: "string",
          description: "Nuova data di scadenza (YYYY-MM-DD)",
        },
        shelf_life_days: {
          type: "number",
          description: "Giorni di validità da aperto",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_open_item",
    description: "Contrassegna un alimento come aperto, calcolando dinamicamente la nuova scadenza post-apertura basata su shelfLifeDays.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "ID del prodotto da aprire",
        },
        shelf_life_days: {
          type: "number",
          description: "Giorni di durata da aperto (se non specificato usa il valore già associato o 3 giorni)",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_freeze_item",
    description: "Contrassegna un alimento come congelato nel freezer, preservando la scadenza originale della confezione e calcolando la nuova scadenza estesa (default: +3 mesi).",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "ID del prodotto da congelare",
        },
        months: {
          type: "number",
          description: "Mesi di conservazione nel freezer (default: 3, ad es. 1, 3, 6, 12)",
        },
        custom_expiry_date: {
          type: "string",
          description: "Data personalizzata di scadenza nel freezer (YYYY-MM-DD)",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_unfreeze_item",
    description: "Scongela un alimento dal freezer. Supporta la modalità 'consume_soon' (da consumare entro 24-72h) o 'restore_original' (ripristina la data originale di confezione).",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "ID del prodotto da scongelare",
        },
        mode: {
          type: "string",
          enum: ["consume_soon", "restore_original"],
          description: "Modalità di scongelamento: 'consume_soon' per consumo immediato (default) o 'restore_original' per ripristino data confezione",
        },
        hours_to_consume: {
          type: "number",
          description: "Ore entro cui consumare l'alimento scongelato se in modalità consume_soon (default: 48)",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_consume_item",
    description: "Consuma o scarta una quantità di prodotto con tracciamento automatico anti-spreco ('consumed', 'rescued' se a meno di 3 giorni dalla scadenza, o 'wasted' se scaduto/buttato). Registra l'evento nello storico e aggiorna o elimina la giacenza.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "ID del prodotto da consumare",
        },
        quantity: {
          type: "number",
          description: "Quantità consumata/scartata (se omessa o >= della giacenza, il prodotto viene rimosso del tutto)",
        },
        resolution: {
          type: "string",
          enum: ["consumed", "rescued", "wasted", "auto"],
          description: "Motivazione: 'consumed' (normale), 'rescued' (salvato in extremis), 'wasted' (buttato), oppure 'auto' per lasciare all'algoritmo la classificazione in base ai giorni alla scadenza",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "pantry_delete_item",
    description: "Elimina direttamente un alimento dall'inventario senza registrare metriche di spreco.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "ID del prodotto da eliminare",
        },
      },
      required: ["product_id"],
    },
  },

  // --- LISTA DELLA SPESA ---
  {
    name: "shopping_list_get",
    description: "Recupera tutti gli articoli della lista della spesa per la dispensa, con il loro stato (toBuy, reserved, purchased).",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
      },
    },
  },
  {
    name: "shopping_list_add",
    description: "Aggiunge un elemento alla lista della spesa o vi invia un prodotto già esistente in dispensa che è terminato.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
        name: {
          type: "string",
          description: "Nome dell'articolo da comprare",
        },
        product_id: {
          type: "string",
          description: "ID opzionale del prodotto corrispondente in inventario",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "shopping_list_set_status",
    description: "Modifica lo stato di un articolo della lista della spesa: 'toBuy', 'reserved' (prenotato con nome dell'acquirente) o 'purchased' (spuntato come acquistato).",
    inputSchema: {
      type: "object",
      properties: {
        item_id: {
          type: "string",
          description: "ID dell'articolo nella lista della spesa",
        },
        status: {
          type: "string",
          enum: ["toBuy", "reserved", "purchased"],
          description: "Nuovo stato",
        },
        user_name: {
          type: "string",
          description: "Nome di chi prenota o acquista (default: il nome dell'utente del token)",
        },
      },
      required: ["item_id", "status"],
    },
  },
  {
    name: "shopping_list_checkout",
    description: "Finalizza la spesa: archivia tutti gli articoli spuntati come 'purchased' e li reinserisce/incrementa automaticamente nell'inventario.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
      },
    },
  },
  {
    name: "shopping_list_remove",
    description: "Rimuove un articolo dalla lista della spesa.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: {
          type: "string",
          description: "ID dell'articolo da rimuovere",
        },
      },
      required: ["item_id"],
    },
  },

  // --- RICETTE & CHEF AI ---
  {
    name: "recipes_suggest_anti_waste",
    description: "Genera ricette salva-dispensa tramite Google Gemini vincolando la preparazione agli ingredienti che stanno per scadere a breve nella dispensa attiva.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
        days: {
          type: "number",
          description: "Soglia giorni di scadenza (default: 7)",
        },
      },
    },
  },
  {
    name: "recipes_chat",
    description: "Conversa con lo Chef AI di PantryAI. Inietta in background le reali giacenze della dispensa per fornire consigli personalizzati, sostituzioni di ingredienti o idee culinarie.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Domanda o richiesta culinaria per l'assistente AI",
        },
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa da usare come contesto",
        },
      },
      required: ["message"],
    },
  },

  // --- STORICO & SPRECO ---
  {
    name: "history_get_summary",
    description: "Restituisce il riepilogo delle metriche ambientali: totale cibo salvato vs sprecato, log recenti di consumo e CO2 risparmiata.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
        limit: {
          type: "number",
          description: "Numero massimo di eventi recenti da mostrare (default: 20)",
        },
      },
    },
  },

  // --- DISPENSE & CATEGORIE ---
  {
    name: "pantry_list_pantries",
    description: "Elenca tutte le dispense a cui l'utente del token ha accesso, indicando il nome, il ruolo (owner/editor) e la dispensa attualmente attiva.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pantry_manage_categories",
    description: "Legge, aggiunge o rimuove categorie merceologiche personalizzate dalla dispensa.",
    inputSchema: {
      type: "object",
      properties: {
        pantry_id: {
          type: "string",
          description: "ID opzionale della dispensa",
        },
        action: {
          type: "string",
          enum: ["list", "add", "remove"],
          description: "Azione da compiere: 'list' (mostra categorie), 'add' (aggiunge), 'remove' (elimina)",
        },
        category_name: {
          type: "string",
          description: "Nome della categoria da aggiungere o rimuovere",
        },
      },
      required: ["action"],
    },
  },
];

// ===============================================================
// TOOL EXECUTION HANDLERS
// ===============================================================

export async function executeMcpTool(
  toolName: string,
  args: Record<string, any>,
  user: ResolvedMcpUser
): Promise<{ text: string }> {
  switch (toolName) {
    // -------------------------------------------------------------
    // PANTRY GET SUMMARY
    // -------------------------------------------------------------
    case "pantry_get_summary": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const productsSnap = await adminDb
        .collection("products")
        .where("productPantryId", "==", pantryId)
        .get();

      let totalProducts = 0;
      let zeroStock = 0;
      let expiring3Days = 0;
      let expiring7Days = 0;
      let openedCount = 0;
      let frozenCount = 0;

      productsSnap.forEach((doc) => {
        totalProducts++;
        const data = doc.data();
        if ((data.productQuantity ?? 0) <= 0) zeroStock++;
        if (data.productOpenedAt) openedCount++;
        if (data.isFrozen) frozenCount++;

        // Controlla scadenza effettiva (congelato vs aperto vs confezione)
        const effectiveExpiry = data.isFrozen
          ? data.productFrozenExpiryAt
          : (data.productOpenedExpiryAt || data.expiryDateProduct);
        if (effectiveExpiry && effectiveExpiry.toDate) {
          const expDate = effectiveExpiry.toDate();
          if (expDate <= in3Days) expiring3Days++;
          if (expDate <= in7Days) expiring7Days++;
        }
      });

      const shoppingSnap = await adminDb
        .collection("shoppingListItems")
        .where("listItemPantryId", "==", pantryId)
        .where("listItemStatus", "==", "toBuy")
        .get();

      return {
        text: JSON.stringify(
          {
            pantryId,
            totaleProdottiInGiacenza: totalProducts,
            prodottiEsauriti: zeroStock,
            prodottiAperti: openedCount,
            prodottiCongelatiNelFreezer: frozenCount,
            prodottiInScadenzaEntro3Giorni: expiring3Days,
            prodottiInScadenzaEntro7Giorni: expiring7Days,
            articoliDaComprareInSpesa: shoppingSnap.size,
          },
          null,
          2
        ),
      };
    }

    // -------------------------------------------------------------
    // PANTRY LIST ITEMS
    // -------------------------------------------------------------
    case "pantry_list_items": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const snap = await adminDb
        .collection("products")
        .where("productPantryId", "==", pantryId)
        .get();

      let items: any[] = [];
      const now = new Date();

      snap.forEach((doc) => {
        const d = doc.data();
        const effectiveExpiryTs = d.isFrozen
          ? d.productFrozenExpiryAt
          : (d.productOpenedExpiryAt || d.expiryDateProduct);
        const effectiveExpiryDate = effectiveExpiryTs?.toDate ? effectiveExpiryTs.toDate() : null;

        let daysToExpiry: number | null = null;
        if (effectiveExpiryDate) {
          const diffMs = effectiveExpiryDate.getTime() - now.getTime();
          daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }

        items.push({
          productId: doc.id,
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

      // Filtro per query testuale
      if (args.query && typeof args.query === "string") {
        const q = args.query.toLowerCase().trim();
        items = items.filter((it) => it.name.toLowerCase().includes(q));
      }

      // Filtro per categoria
      if (args.category && typeof args.category === "string") {
        const cat = args.category.toLowerCase().trim();
        items = items.filter((it) => (it.category || "").toLowerCase() === cat);
      }

      // Filtro per soli aperti
      if (args.only_opened) {
        items = items.filter((it) => it.isOpened);
      }

      // Filtro per soli congelati
      if (args.only_frozen) {
        items = items.filter((it) => it.isFrozen);
      }

      // Filtro per giorni di scadenza
      if (typeof args.only_expiring_days === "number") {
        items = items.filter(
          (it) => it.effectiveDaysToExpiry !== null && it.effectiveDaysToExpiry <= args.only_expiring_days
        );
      }

      // Ordina per scadenza imminente
      items.sort((a, b) => {
        if (a.effectiveDaysToExpiry === null) return 1;
        if (b.effectiveDaysToExpiry === null) return -1;
        return a.effectiveDaysToExpiry - b.effectiveDaysToExpiry;
      });

      return {
        text: JSON.stringify({ count: items.length, items }, null, 2),
      };
    }

    // -------------------------------------------------------------
    // PANTRY ADD ITEM
    // -------------------------------------------------------------
    case "pantry_add_item": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const name = String(args.name).trim();
      const quantityToAdd = Number(args.quantity ?? 1);
      const shouldUpdateIfExists = args.update_if_exists !== false;

      // Se richiesto, controlla se esiste già un prodotto con questo nome
      if (shouldUpdateIfExists) {
        const existingSnap = await adminDb
          .collection("products")
          .where("productPantryId", "==", pantryId)
          .where("productName", "==", name)
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          const existingDoc = existingSnap.docs[0]!;
          const currentQty = existingDoc.data().productQuantity ?? 0;
          const newQty = currentQty + quantityToAdd;

          const updatePayload: any = {
            productQuantity: newQty,
            productUpdatedAt: FieldValue.serverTimestamp(),
          };

          if (args.expiry_date) {
            updatePayload.expiryDateProduct = Timestamp.fromDate(new Date(args.expiry_date));
          }
          if (args.unit) updatePayload.productUnitOfMeasure = args.unit;
          if (args.category) updatePayload.productCategory = args.category;

          await existingDoc.ref.update(updatePayload);

          return {
            text: `Prodotto '${name}' già esistente aggiornato: quantità sommata da ${currentQty} a ${newQty}. (ID: ${existingDoc.id})`,
          };
        }
      }

      // Creazione nuovo prodotto
      const newRef = adminDb.collection("products").doc();
      let expiryTs: Timestamp | null = null;
      if (args.expiry_date) {
        expiryTs = Timestamp.fromDate(new Date(args.expiry_date));
      }

      const productDoc: any = {
        productId: newRef.id,
        productPantryId: pantryId,
        productName: name,
        productQuantity: quantityToAdd,
        productUnitOfMeasure: args.unit || "pz",
        productCategory: args.category || "Altro",
        expiryDateProduct: expiryTs,
        shelfLifeDays: args.shelf_life_days ?? null,
        productBarcode: args.barcode || null,
        addToShoppingList: false,
        productCreatedAt: FieldValue.serverTimestamp(),
      };

      await newRef.set(productDoc);

      return {
        text: `Nuovo alimento '${name}' aggiunto con successo all'inventario (Quantità: ${quantityToAdd} ${productDoc.productUnitOfMeasure}, ID: ${newRef.id}).`,
      };
    }

    // -------------------------------------------------------------
    // PANTRY UPDATE ITEM
    // -------------------------------------------------------------
    case "pantry_update_item": {
      const productId = String(args.product_id).trim();
      const productRef = adminDb.collection("products").doc(productId);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        throw new Error(`Prodotto non trovato con ID: ${productId}`);
      }

      const currentPantryId = productSnap.data()?.productPantryId;
      if (!user.pantryIds.includes(currentPantryId)) {
        throw new Error("Non hai i permessi per modificare questo prodotto.");
      }

      const updates: any = {
        productUpdatedAt: FieldValue.serverTimestamp(),
      };

      if (args.name !== undefined) updates.productName = String(args.name).trim();
      if (args.quantity !== undefined) updates.productQuantity = Number(args.quantity);
      if (args.unit !== undefined) updates.productUnitOfMeasure = args.unit;
      if (args.category !== undefined) updates.productCategory = args.category;
      if (args.shelf_life_days !== undefined) updates.shelfLifeDays = Number(args.shelf_life_days);
      if (args.expiry_date !== undefined) {
        updates.expiryDateProduct = args.expiry_date
          ? Timestamp.fromDate(new Date(args.expiry_date))
          : null;
      }

      await productRef.update(updates);
      return { text: `Prodotto ${productId} aggiornato con successo.` };
    }

    // -------------------------------------------------------------
    // PANTRY OPEN ITEM
    // -------------------------------------------------------------
    case "pantry_open_item": {
      const productId = String(args.product_id).trim();
      const productRef = adminDb.collection("products").doc(productId);
      const snap = await productRef.get();

      if (!snap.exists) throw new Error(`Prodotto ${productId} inesistente.`);

      const data = snap.data()!;
      if (!user.pantryIds.includes(data.productPantryId)) {
        throw new Error("Accesso negato alla dispensa del prodotto.");
      }

      const shelfLifeDays = args.shelf_life_days ?? data.shelfLifeDays ?? 3;
      const openedAt = new Date();
      const openedExpiryAt = new Date(openedAt.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);

      await productRef.update({
        productOpenedAt: Timestamp.fromDate(openedAt),
        productOpenedExpiryAt: Timestamp.fromDate(openedExpiryAt),
        shelfLifeDays,
        productUpdatedAt: FieldValue.serverTimestamp(),
      });

      return {
        text: `Alimento '${data.productName}' contrassegnato come aperto! Nuova scadenza dinamica calcolata: ${openedExpiryAt.toISOString().split("T")[0]} (${shelfLifeDays} giorni di durata).`,
      };
    }

    // -------------------------------------------------------------
    // PANTRY FREEZE ITEM
    // -------------------------------------------------------------
    case "pantry_freeze_item": {
      const productId = String(args.product_id).trim();
      const productRef = adminDb.collection("products").doc(productId);
      const snap = await productRef.get();

      if (!snap.exists) throw new Error(`Prodotto ${productId} non trovato.`);
      const pData = snap.data()!;
      if (!user.pantryIds.includes(pData.productPantryId)) {
        throw new Error("Accesso negato alla dispensa del prodotto.");
      }

      const months = typeof args.months === "number" && args.months > 0 ? args.months : 3;
      const now = new Date();
      let frozenExpiry: Date;
      if (args.custom_expiry_date) {
        frozenExpiry = new Date(args.custom_expiry_date);
      } else {
        frozenExpiry = new Date(now);
        frozenExpiry.setMonth(frozenExpiry.getMonth() + months);
      }

      const originalExp = pData.originalExpiryDateBeforeFreeze || pData.expiryDateProduct || null;

      await productRef.update({
        isFrozen: true,
        productFrozenAt: Timestamp.fromDate(now),
        productFrozenExpiryAt: Timestamp.fromDate(frozenExpiry),
        frozenMonthsDuration: months,
        originalExpiryDateBeforeFreeze: originalExp,
        productUpdatedAt: FieldValue.serverTimestamp(),
      });

      return {
        text: `Alimento '${pData.productName}' congelato con successo nel freezer! Nuova scadenza stimata: ${frozenExpiry.toISOString().split("T")[0]} (+${months} mesi). Data di confezione originale preservata per eventuale ripristino.`,
      };
    }

    // -------------------------------------------------------------
    // PANTRY UNFREEZE ITEM
    // -------------------------------------------------------------
    case "pantry_unfreeze_item": {
      const productId = String(args.product_id).trim();
      const productRef = adminDb.collection("products").doc(productId);
      const snap = await productRef.get();

      if (!snap.exists) throw new Error(`Prodotto ${productId} non trovato.`);
      const pData = snap.data()!;
      if (!user.pantryIds.includes(pData.productPantryId)) {
        throw new Error("Accesso negato alla dispensa del prodotto.");
      }

      const mode = args.mode === "restore_original" ? "restore_original" : "consume_soon";
      const now = new Date();

      if (mode === "consume_soon") {
        const hours = typeof args.hours_to_consume === "number" && args.hours_to_consume > 0 ? args.hours_to_consume : 48;
        const openedExpiry = new Date(now.getTime() + hours * 60 * 60 * 1000);
        await productRef.update({
          isFrozen: false,
          productOpenedAt: Timestamp.fromDate(now),
          productOpenedExpiryAt: Timestamp.fromDate(openedExpiry),
          shelfLifeDays: Math.ceil(hours / 24),
          productFrozenExpiryAt: null,
          productUpdatedAt: FieldValue.serverTimestamp(),
        });
        return {
          text: `Alimento '${pData.productName}' scongelato con successo in modalità consumo rapido! Da consumare entro: ${openedExpiry.toISOString().split("T")[0]} (${hours} ore di validità).`,
        };
      } else {
        const originalDate = pData.originalExpiryDateBeforeFreeze || pData.expiryDateProduct || null;
        await productRef.update({
          isFrozen: false,
          expiryDateProduct: originalDate,
          productFrozenAt: null,
          productFrozenExpiryAt: null,
          originalExpiryDateBeforeFreeze: null,
          productUpdatedAt: FieldValue.serverTimestamp(),
        });
        return {
          text: `Alimento '${pData.productName}' scongelato con successo! È stata ripristinata la data di scadenza originale della confezione (${formatTimestamp(originalDate) || "nessuna"}).`,
        };
      }
    }

    // -------------------------------------------------------------
    // PANTRY CONSUME ITEM
    // -------------------------------------------------------------
    case "pantry_consume_item": {
      const productId = String(args.product_id).trim();
      const productRef = adminDb.collection("products").doc(productId);
      const snap = await productRef.get();

      if (!snap.exists) throw new Error(`Prodotto ${productId} non trovato.`);
      const pData = snap.data()!;
      const pantryId = pData.productPantryId;

      if (!user.pantryIds.includes(pantryId)) {
        throw new Error("Permesso negato.");
      }

      const currentQty = pData.productQuantity ?? 1;
      const qtyToConsume = args.quantity ? Math.min(Number(args.quantity), currentQty) : currentQty;

      // Risoluzione motivazione automatica se non specificata
      let resolution: "consumed" | "rescued" | "wasted" = "consumed";
      if (args.resolution && args.resolution !== "auto") {
        resolution = args.resolution;
      } else {
        const expTs = pData.productOpenedExpiryAt || pData.expiryDateProduct;
        if (expTs && expTs.toDate) {
          const expDate = expTs.toDate();
          const now = new Date();
          const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            resolution = "wasted";
          } else if (diffDays <= 3) {
            resolution = "rescued";
          } else {
            resolution = "consumed";
          }
        }
      }

      // Registra evento nello storico
      const historyRef = adminDb.collection("pantries").doc(pantryId).collection("history").doc();
      await historyRef.set({
        logId: historyRef.id,
        productId,
        productName: pData.productName,
        productCategory: pData.productCategory || "Altro",
        carbonFootprint: pData.carbonFootprint ?? null,
        quantityHistory: qtyToConsume,
        pantryId,
        resolvedAt: FieldValue.serverTimestamp(),
        resolution,
      });

      // Aggiorna o rimuove prodotto
      const remaining = currentQty - qtyToConsume;
      if (remaining <= 0) {
        await productRef.delete();
        return {
          text: `Prodotto '${pData.productName}' consumato interamente (${qtyToConsume} ${pData.productUnitOfMeasure || "pz"}). Registrato come '${resolution}'. Rimosso dall'inventario.`,
        };
      } else {
        await productRef.update({
          productQuantity: remaining,
          productUpdatedAt: FieldValue.serverTimestamp(),
        });
        return {
          text: `Consumati ${qtyToConsume} ${pData.productUnitOfMeasure || "pz"} di '${pData.productName}' (${resolution}). Giacenza rimanente: ${remaining}.`,
        };
      }
    }

    // -------------------------------------------------------------
    // PANTRY DELETE ITEM
    // -------------------------------------------------------------
    case "pantry_delete_item": {
      const productId = String(args.product_id).trim();
      const productRef = adminDb.collection("products").doc(productId);
      const snap = await productRef.get();
      if (!snap.exists) throw new Error("Prodotto non trovato.");
      if (!user.pantryIds.includes(snap.data()?.productPantryId)) {
        throw new Error("Permesso negato.");
      }
      await productRef.delete();
      return { text: `Prodotto ${productId} rimosso dall'inventario.` };
    }

    // -------------------------------------------------------------
    // SHOPPING LIST GET
    // -------------------------------------------------------------
    case "shopping_list_get": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const snap = await adminDb
        .collection("shoppingListItems")
        .where("listItemPantryId", "==", pantryId)
        .get();

      const items: any[] = [];
      snap.forEach((doc: any) => {
        const d = doc.data();
        items.push({
          itemId: doc.id,
          name: d.listItemName,
          status: d.listItemStatus,
          reservedBy: d.listItemReservedBy || null,
          purchasedBy: d.listItemPurchasedBy || null,
          productId: d.listItemProductId || null,
        });
      });

      return {
        text: JSON.stringify({ count: items.length, items }, null, 2),
      };
    }

    // -------------------------------------------------------------
    // SHOPPING LIST ADD
    // -------------------------------------------------------------
    case "shopping_list_add": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const name = String(args.name).trim();
      const productId = args.product_id ? String(args.product_id).trim() : null;

      const newRef = adminDb.collection("shoppingListItems").doc();
      const itemData: any = {
        listItemId: newRef.id,
        listItemPantryId: pantryId,
        listItemName: name,
        listItemStatus: "toBuy",
        listItemCreatedAt: FieldValue.serverTimestamp(),
      };

      if (productId) {
        itemData.listItemProductId = productId;
        // Aggiorna anche il flag sul prodotto
        await adminDb.collection("products").doc(productId).update({
          addToShoppingList: true,
          productShoppingListItemId: newRef.id,
          productUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      await newRef.set(itemData);
      return {
        text: `Articolo '${name}' aggiunto alla lista della spesa (ID: ${newRef.id}).`,
      };
    }

    // -------------------------------------------------------------
    // SHOPPING LIST SET STATUS
    // -------------------------------------------------------------
    case "shopping_list_set_status": {
      const itemId = String(args.item_id).trim();
      const status = args.status as "toBuy" | "reserved" | "purchased";
      const userName = args.user_name || user.userName || user.userEmail || "Membro";

      const itemRef = adminDb.collection("shoppingListItems").doc(itemId);
      const snap = await itemRef.get();
      if (!snap.exists) throw new Error("Articolo spesa non trovato.");

      if (!user.pantryIds.includes(snap.data()?.listItemPantryId)) {
        throw new Error("Permesso negato.");
      }

      const updates: any = {
        listItemStatus: status,
        listItemUpdatedAt: FieldValue.serverTimestamp(),
      };

      if (status === "reserved") {
        updates.listItemReservedBy = userName;
        updates.listItemReservedAt = FieldValue.serverTimestamp();
      } else if (status === "purchased") {
        updates.listItemPurchasedBy = userName;
        updates.listItemPurchasedAt = FieldValue.serverTimestamp();
      } else {
        updates.listItemReservedBy = null;
        updates.listItemReservedAt = null;
        updates.listItemPurchasedBy = null;
        updates.listItemPurchasedAt = null;
      }

      await itemRef.update(updates);
      return { text: `Stato articolo aggiornato a '${status}' per conto di '${userName}'.` };
    }

    // -------------------------------------------------------------
    // SHOPPING LIST CHECKOUT
    // -------------------------------------------------------------
    case "shopping_list_checkout": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const purchasedSnap = await adminDb
        .collection("shoppingListItems")
        .where("listItemPantryId", "==", pantryId)
        .where("listItemStatus", "==", "purchased")
        .get();

      if (purchasedSnap.empty) {
        return { text: "Nessun articolo contrassegnato come 'purchased' da finalizzare." };
      }

      const batch = adminDb.batch();
      const processed: string[] = [];

      for (const doc of purchasedSnap.docs) {
        const item = doc.data();
        processed.push(item.listItemName);

        // Se collegato a prodotto esistente, incrementa la quantità
        if (item.listItemProductId) {
          const prodRef = adminDb.collection("products").doc(item.listItemProductId);
          const prodSnap = await prodRef.get();
          if (prodSnap.exists) {
            const curQty = prodSnap.data()?.productQuantity ?? 0;
            batch.update(prodRef, {
              productQuantity: curQty + 1,
              addToShoppingList: false,
              productShoppingListItemId: null,
              productUpdatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          // Crea nuovo prodotto in inventario
          const newProdRef = adminDb.collection("products").doc();
          batch.set(newProdRef, {
            productId: newProdRef.id,
            productPantryId: pantryId,
            productName: item.listItemName,
            productQuantity: 1,
            productUnitOfMeasure: "pz",
            productCategory: "Altro",
            addToShoppingList: false,
            productCreatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Elimina dalla lista spesa
        batch.delete(doc.ref);
      }

      await batch.commit();
      return {
        text: `Spesa completata con successo! ${processed.length} articoli archiviati e reinseriti in dispensa: ${processed.join(", ")}.`,
      };
    }

    // -------------------------------------------------------------
    // SHOPPING LIST REMOVE
    // -------------------------------------------------------------
    case "shopping_list_remove": {
      const itemId = String(args.item_id).trim();
      const itemRef = adminDb.collection("shoppingListItems").doc(itemId);
      const snap = await itemRef.get();
      if (!snap.exists) throw new Error("Articolo non trovato.");
      const itemData = snap.data()!;

      if (!user.pantryIds.includes(itemData.listItemPantryId)) {
        throw new Error("Permesso negato.");
      }

      if (itemData.listItemProductId) {
        await adminDb.collection("products").doc(itemData.listItemProductId).update({
          addToShoppingList: false,
          productShoppingListItemId: null,
        });
      }

      await itemRef.delete();
      return { text: `Articolo ${itemId} rimosso dalla spesa.` };
    }

    // -------------------------------------------------------------
    // RECIPES SUGGEST ANTI WASTE
    // -------------------------------------------------------------
    case "recipes_suggest_anti_waste": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const days = typeof args.days === "number" ? args.days : 7;
      const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const productsSnap = await adminDb
        .collection("products")
        .where("productPantryId", "==", pantryId)
        .get();

      const expiring: { nome: string; quantita: string }[] = [];
      productsSnap.forEach((doc: any) => {
        const d = doc.data();
        const effectiveExpiry = d.productOpenedExpiryAt || d.expiryDateProduct;
        if (effectiveExpiry && effectiveExpiry.toDate) {
          const expDate = effectiveExpiry.toDate();
          if (expDate <= targetDate) {
            expiring.push({
              nome: d.productName,
              quantita: `${d.productQuantity ?? 1} ${d.productUnitOfMeasure || "pz"}`,
            });
          }
        }
      });

      if (expiring.length === 0) {
        return {
          text: `Ottime notizie: nessun alimento in scadenza nei prossimi ${days} giorni nella dispensa.`,
        };
      }

      const recipeResult = await generateRecipeExpiration(expiring);
      return { text: recipeResult };
    }

    // -------------------------------------------------------------
    // RECIPES CHAT
    // -------------------------------------------------------------
    case "recipes_chat": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const message = String(args.message).trim();

      const productsSnap = await adminDb
        .collection("products")
        .where("productPantryId", "==", pantryId)
        .get();

      const currentProducts: string[] = [];
      productsSnap.forEach((doc: any) => {
        const d = doc.data();
        currentProducts.push(`${d.productQuantity ?? 1} ${d.productUnitOfMeasure || "pz"} di ${d.productName}`);
      });

      const response = await chatWithChefAI(
        message,
        [], // cronologia iniziale
        currentProducts
      );

      return { text: response };
    }

    // -------------------------------------------------------------
    // HISTORY GET SUMMARY
    // -------------------------------------------------------------
    case "history_get_summary": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const limitCount = typeof args.limit === "number" ? args.limit : 20;

      const historySnap = await adminDb
        .collection("pantries")
        .doc(pantryId)
        .collection("history")
        .orderBy("resolvedAt", "desc")
        .limit(limitCount)
        .get();

      let consumedCount = 0;
      let rescuedCount = 0;
      let wastedCount = 0;
      const recentEvents: any[] = [];

      historySnap.forEach((doc: any) => {
        const d = doc.data();
        if (d.resolution === "consumed") consumedCount += d.quantityHistory ?? 1;
        else if (d.resolution === "rescued") rescuedCount += d.quantityHistory ?? 1;
        else if (d.resolution === "wasted") wastedCount += d.quantityHistory ?? 1;

        recentEvents.push({
          logId: doc.id,
          product: d.productName,
          quantity: d.quantityHistory,
          resolution: d.resolution,
          date: formatTimestamp(d.resolvedAt),
        });
      });

      return {
        text: JSON.stringify(
          {
            pantryId,
            totaleCiboConsumato: consumedCount,
            totaleCiboSalvatoInExtremis: rescuedCount,
            totaleCiboSprecato: wastedCount,
            recentEvents,
          },
          null,
          2
        ),
      };
    }

    // -------------------------------------------------------------
    // PANTRY LIST PANTRIES
    // -------------------------------------------------------------
    case "pantry_list_pantries": {
      if (user.pantryIds.length === 0) {
        return { text: "Nessuna dispensa associata all'utente." };
      }

      const list: any[] = [];
      for (const pid of user.pantryIds) {
        const pSnap = await adminDb.collection("pantries").doc(pid).get();
        if (pSnap.exists) {
          const pData = pSnap.data()!;
          const isCurrent = pid === user.currentPantryId;
          const myMember = (pData.pantryMembers || []).find((m: any) => m.memberId === user.userId);

          list.push({
            pantryId: pid,
            name: pData.pantryName,
            isCurrent,
            myRole: myMember?.memberRole || "member",
            inviteCode: pData.pantryInviteCode,
            membersCount: (pData.pantryMembers || []).length,
          });
        }
      }

      return {
        text: JSON.stringify({ pantries: list }, null, 2),
      };
    }

    // -------------------------------------------------------------
    // PANTRY MANAGE CATEGORIES
    // -------------------------------------------------------------
    case "pantry_manage_categories": {
      const pantryId = resolvePantryId(user, args.pantry_id);
      const action = args.action as "list" | "add" | "remove";
      const pantryRef = adminDb.collection("pantries").doc(pantryId);
      const pSnap = await pantryRef.get();

      if (!pSnap.exists) throw new Error("Dispensa non trovata.");
      const currentCats: string[] = pSnap.data()?.pantryCategories || [];

      if (action === "list") {
        return {
          text: JSON.stringify({ pantryId, categories: currentCats }, null, 2),
        };
      }

      if (action === "add") {
        const catToAdd = String(args.category_name).trim();
        if (!catToAdd) throw new Error("Nome categoria mancante.");
        if (currentCats.includes(catToAdd)) {
          return { text: `La categoria '${catToAdd}' esiste già.` };
        }
        await pantryRef.update({
          pantryCategories: FieldValue.arrayUnion(catToAdd),
        });
        return { text: `Categoria '${catToAdd}' aggiunta con successo.` };
      }

      if (action === "remove") {
        const catToRemove = String(args.category_name).trim();
        if (!catToRemove) throw new Error("Nome categoria mancante.");
        await pantryRef.update({
          pantryCategories: FieldValue.arrayRemove(catToRemove),
        });
        return { text: `Categoria '${catToRemove}' rimossa dalla dispensa.` };
      }

      throw new Error(`Azione sconosciuta: ${action}`);
    }

    default:
      throw new Error(`Tool sconosciuto: ${toolName}`);
  }
}
