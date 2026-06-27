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
