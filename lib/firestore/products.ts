import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, query, where, deleteDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { Product } from "../../types/firestore/productType";
import { withClientPerformanceTracking } from '@/lib/performance-logger.client';




//Recupera  i prodotti associati a una specifica dispensa
export async function getProductsByPantry(pantryId: string): Promise<Product[]> {
  return withClientPerformanceTracking('db-latency', 'getProductsByPantry', async () => {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("productPantryId", "==", pantryId));

    const querySnapshot = await getDocs(q);
    const products: Product[] = [];
    const zeroQtyExpiredDocsToClean: string[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Product;
      const prod: Product = {
        productId: docSnap.id,
        ...data,
      };

      // Se la quantità si è ridotta a zero e ha ancora una data di scadenza, rimuovila
      if (
        (prod.productQuantity === undefined || prod.productQuantity <= 0) &&
        (prod.expiryDateProduct || prod.productOpenedExpiryAt || prod.productFrozenExpiryAt)
      ) {
        prod.productQuantity = 0;
        prod.expiryDateProduct = null;
        prod.productOpenedExpiryAt = null;
        prod.productFrozenExpiryAt = null;
        prod.originalExpiryDateBeforeFreeze = null;
        zeroQtyExpiredDocsToClean.push(docSnap.id);
      }

      products.push(prod);
    });

    // Pulisci in background su Firestore i documenti con quantità zero che avevano ancora una data di scadenza
    if (zeroQtyExpiredDocsToClean.length > 0 && typeof window !== "undefined") {
      Promise.allSettled(
        zeroQtyExpiredDocsToClean.map((id) =>
          updateDoc(doc(db, "products", id), {
            expiryDateProduct: null,
            productOpenedExpiryAt: null,
            productFrozenExpiryAt: null,
            originalExpiryDateBeforeFreeze: null,
            productUpdatedAt: serverTimestamp(),
          })
        )
      ).catch((err) => console.warn("[PantryAI] Errore pulizia scadenza quantità zero:", err));
    }

    return products;
  }, (res) => res.length);
}

//Aggiunge un nuovo prodotto al database
export async function addProduct(
  productData: Omit<Product, "productId" | "productCreatedAt" | "productUpdatedAt"> //Questi campi sono generati automaticamente dal sistema
): Promise<string> {
  return withClientPerformanceTracking('db-latency', 'addProduct', async () => {
    const productRef = doc(collection(db, "products"));
    const isZeroQuantity = productData.productQuantity !== undefined && productData.productQuantity <= 0;

    const newProduct: Product = {
      ...productData,
      productQuantity: isZeroQuantity ? 0 : productData.productQuantity,
      // Se la quantità iniziale è zero, rimuovi la data di scadenza
      expiryDateProduct: isZeroQuantity ? null : (productData.expiryDateProduct || null),
      productOpenedExpiryAt: isZeroQuantity ? null : (productData.productOpenedExpiryAt || null),
      productFrozenExpiryAt: isZeroQuantity ? null : (productData.productFrozenExpiryAt || null),
      productId: productRef.id,
      productCreatedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(productRef, newProduct);
    return productRef.id;
  });
}

//Aggiorna i dati di un prodotto esistente
export async function updateProduct(
  productId: string,
  productData: Partial<Omit<Product, "productId" | "productCreatedAt">>
): Promise<void> {
  return withClientPerformanceTracking('db-latency', 'updateProduct', async () => {
    const productRef = doc(db, "products", productId);

    const updatedData: Record<string, any> = {
      ...productData,
      productUpdatedAt: serverTimestamp(),
    };

    // Quando la quantità si riduce a zero, rimuovi la data di scadenza
    if (productData.productQuantity !== undefined && productData.productQuantity <= 0) {
      updatedData.productQuantity = 0;
      updatedData.expiryDateProduct = null;
      updatedData.productOpenedExpiryAt = null;
      updatedData.productFrozenExpiryAt = null;
      updatedData.originalExpiryDateBeforeFreeze = null;
    }

    await updateDoc(productRef, updatedData);
  });
}

//Elimina un prodotto dal database
export async function deleteProduct(productId: string): Promise<void> {
  return withClientPerformanceTracking('db-latency', 'deleteProduct', async () => {
    const productRef = doc(db, "products", productId);
    await deleteDoc(productRef);
  });
}

// Recupera i prodotti in scadenza o già scaduti entro 7 giorni
export async function getExpiringProductsByPantry(
  pantryId: string,
  daysUntilExpiry: number = 7
): Promise<Product[]> {
  return withClientPerformanceTracking('db-latency', 'getExpiringProductsByPantry', async () => {
    const productsRef = collection(db, "products");

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiry);

    const q = query(
      productsRef,
      where("productPantryId", "==", pantryId),
      where("expiryDateProduct", "<=", Timestamp.fromDate(targetDate))
    );

    const querySnapshot = await getDocs(q);
    const products: Product[] = [];

    querySnapshot.forEach((docSnap) => {
      products.push({
        productId: docSnap.id,
        ...docSnap.data()
      } as Product);
    });

    // Ordina in memoria per sicurezza (dal più scaduto/più vicino alla scadenza al più lontano)
    products.sort((a, b) => {
      const dateA = a.expiryDateProduct?.toMillis() || Number.MAX_SAFE_INTEGER;
      const dateB = b.expiryDateProduct?.toMillis() || Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });

    return products;
  }, (res) => res.length);
}

/**
 * Congela un alimento: salva la data originale e imposta la nuova data di scadenza nel freezer
 */
export async function freezeProduct(
  productId: string,
  monthsDuration: number = 3,
  customExpiryDate?: Date
): Promise<void> {
  return withClientPerformanceTracking('db-latency', 'freezeProduct', async () => {
    const { getDoc } = await import("firebase/firestore");
    const productRef = doc(db, "products", productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) throw new Error("Prodotto non trovato");

    const currentData = snap.data() as Product;
    const now = new Date();
    
    // Calcola la scadenza nel freezer
    let frozenExpiry: Date;
    if (customExpiryDate) {
      frozenExpiry = customExpiryDate;
    } else {
      frozenExpiry = new Date(now);
      frozenExpiry.setMonth(frozenExpiry.getMonth() + monthsDuration);
    }

    await updateDoc(productRef, {
      isFrozen: true,
      productFrozenAt: Timestamp.fromDate(now),
      productFrozenExpiryAt: Timestamp.fromDate(frozenExpiry),
      frozenMonthsDuration: monthsDuration,
      originalExpiryDateBeforeFreeze: currentData.originalExpiryDateBeforeFreeze || currentData.expiryDateProduct || null,
      productUpdatedAt: serverTimestamp(),
    });
  });
}

/**
 * Scongela un alimento con scelta tra consumo immediato (entro ore) o ripristino data originale
 */
export async function unfreezeProduct(
  productId: string,
  mode: 'consume_soon' | 'restore_original' = 'consume_soon',
  hoursToConsume: number = 48
): Promise<void> {
  return withClientPerformanceTracking('db-latency', 'unfreezeProduct', async () => {
    const { getDoc } = await import("firebase/firestore");
    const productRef = doc(db, "products", productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) throw new Error("Prodotto non trovato");

    const currentData = snap.data() as Product;
    const now = new Date();

    if (mode === 'consume_soon') {
      const openedExpiry = new Date(now.getTime() + hoursToConsume * 60 * 60 * 1000);
      await updateDoc(productRef, {
        isFrozen: false,
        productOpenedAt: Timestamp.fromDate(now),
        productOpenedExpiryAt: Timestamp.fromDate(openedExpiry),
        shelfLifeDays: Math.ceil(hoursToConsume / 24),
        productFrozenExpiryAt: null,
        productUpdatedAt: serverTimestamp(),
      });
    } else {
      // Ripristina data originale
      const originalDate = currentData.originalExpiryDateBeforeFreeze || currentData.expiryDateProduct || null;
      await updateDoc(productRef, {
        isFrozen: false,
        expiryDateProduct: originalDate,
        productFrozenAt: null,
        productFrozenExpiryAt: null,
        originalExpiryDateBeforeFreeze: null,
        productUpdatedAt: serverTimestamp(),
      });
    }
  });
}

/**
 * Segna un alimento come aperto, calcolando la scadenza in base a shelfLifeDays
 */
export async function openProduct(
  productId: string,
  shelfLifeDaysOverride?: number
): Promise<void> {
  return withClientPerformanceTracking('db-latency', 'openProduct', async () => {
    const { getDoc } = await import("firebase/firestore");
    const productRef = doc(db, "products", productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) throw new Error("Prodotto non trovato");

    const currentData = snap.data() as Product;
    const now = new Date();
    const shelfLife = shelfLifeDaysOverride ?? currentData.shelfLifeDays ?? 3;
    const openedExpiry = new Date(now.getTime() + shelfLife * 24 * 60 * 60 * 1000);

    await updateDoc(productRef, {
      isOpened: true,
      productOpenedAt: Timestamp.fromDate(now),
      productOpenedExpiryAt: Timestamp.fromDate(openedExpiry),
      shelfLifeDays: shelfLife,
      productUpdatedAt: serverTimestamp(),
    });
  });
}

/**
 * Consuma una quantità di alimento (o lo rimuove se azzerato) e aggiunge il log storico
 */
export async function consumeProduct(
  productId: string,
  quantityToConsume: number = 1,
  resolution: 'consumed' | 'wasted' = 'consumed'
): Promise<void> {
  return withClientPerformanceTracking('db-latency', 'consumeProduct', async () => {
    const { getDoc } = await import("firebase/firestore");
    const productRef = doc(db, "products", productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) throw new Error("Prodotto non trovato");

    const currentData = snap.data() as Product;
    const currentQty = currentData.productQuantity || 1;
    const remainingQty = Math.max(0, currentQty - quantityToConsume);

    if (remainingQty <= 0) {
      await deleteDoc(productRef);
    } else {
      await updateDoc(productRef, {
        productQuantity: remainingQty,
        productUpdatedAt: serverTimestamp(),
      });
    }

    // Se associato a dispensa, aggiunge log allo storico
    if (currentData.productPantryId) {
      try {
        const { addProductHistoryLog } = await import("./productHistory");
        const { getEffectiveExpiryDate } = await import("./pantries");

        let finalResolution: 'consumed' | 'rescued' | 'wasted' = resolution;
        if (resolution === 'consumed') {
          const effectiveExpiryDate = getEffectiveExpiryDate(currentData);
          if (effectiveExpiryDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expCopy = new Date(effectiveExpiryDate);
            expCopy.setHours(0, 0, 0, 0);
            const diffTime = expCopy.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 3 && diffDays >= 0) {
              finalResolution = 'rescued';
            }
          }
        }

        await addProductHistoryLog(currentData.productPantryId, {
          productId: currentData.productId,
          productName: currentData.productName,
          productCategory: currentData.productCategory,
          quantityHistory: Math.min(currentQty, quantityToConsume),
          resolution: finalResolution,
          carbonFootprint: currentData.carbonFootprint || null,
        });
      } catch (logErr) {
        console.warn("Avviso registrazione storico consumo:", logErr);
      }
    }
  });
}

/**
 * Assegna automaticamente l'icona/emoji migliore a tutti i prodotti di una dispensa
 * che non hanno ancora un'icona personalizzata definita.
 */
export async function autoAssignIconsToPantryProducts(pantryId: string): Promise<number> {
  const { getFoodIcon } = await import("@/lib/utils/foodIcons");
  const products = await getProductsByPantry(pantryId);
  let updatedCount = 0;

  for (const prod of products) {
    if (!prod.productId) continue;
    if (!prod.productIcon || prod.productIcon.trim() === "") {
      const resolvedIcon = getFoodIcon(prod.productName, prod.productCategory);
      if (resolvedIcon && resolvedIcon !== "🍽️") {
        await updateProduct(prod.productId, { productIcon: resolvedIcon });
        updatedCount++;
      }
    }
  }

  return updatedCount;
}



