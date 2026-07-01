import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, query, where, deleteDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { Product } from "../../types/firestore/productType";



//Recupera  i prodotti associati a una specifica dispensa
export async function getProductsByPantry(pantryId: string): Promise<Product[]> {
  const productsRef = collection(db, "products");
  const q = query(productsRef, where("productPantryId", "==", pantryId));

  const querySnapshot = await getDocs(q);
  const products: Product[] = [];

  querySnapshot.forEach((docSnap) => {
    products.push({
      productId: docSnap.id,
      ...docSnap.data()
    } as Product);
  });

  return products;
}

//Aggiunge un nuovo prodotto al database
export async function addProduct(
  productData: Omit<Product, "productId" | "productCreatedAt" | "productUpdatedAt"> //Questi campi sono generati automaticamente dal sistema
): Promise<string> {
  const productRef = doc(collection(db, "products"));

  const newProduct: Product = {
    ...productData,
    productId: productRef.id,
    productCreatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(productRef, newProduct);
  return productRef.id;
}

//Aggiorna i dati di un prodotto esistente
export async function updateProduct(
  productId: string,
  productData: Partial<Omit<Product, "productId" | "productCreatedAt">>
): Promise<void> {
  const productRef = doc(db, "products", productId);

  const updatedData = {
    ...productData,
    productUpdatedAt: serverTimestamp(),
  };

  await updateDoc(productRef, updatedData);
}

//Elimina un prodotto dal database
export async function deleteProduct(productId: string): Promise<void> {
  const productRef = doc(db, "products", productId);
  await deleteDoc(productRef);
}

// Recupera i prodotti in scadenza o già scaduti entro 7 giorni
export async function getExpiringProductsByPantry(
  pantryId: string,
  daysUntilExpiry: number = 7
): Promise<Product[]> {
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
}
