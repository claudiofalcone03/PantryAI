const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

// Carica variabili d'ambiente da .env.local
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
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function runTest() {
  const token = "pantry_mcp_bf66abc29e3543a4b0f266d7f77a6ac1hlvio9ak";
  const q = query(collection(db, "users"), where("mcpToken", "==", token));
  const snap = await getDocs(q);

  let user = null;
  if (!snap.empty) {
    const uDoc = snap.docs[0];
    const data = uDoc.data();
    user = {
      userId: uDoc.id,
      email: data.userEmail,
      name: data.userProfileName,
      currentPantryId: data.userProfileCurrentPantryId,
      pantryIds: data.userProfilePantryIds || [],
    };
  } else {
    // Fallback sul primo utente per verificare
    const uSnap = await getDocs(collection(db, "users"));
    if (!uSnap.empty) {
      const uDoc = uSnap.docs[0];
      const data = uDoc.data();
      user = {
        userId: uDoc.id,
        email: data.userEmail,
        name: data.userProfileName,
        currentPantryId: data.userProfileCurrentPantryId,
        pantryIds: data.userProfilePantryIds || [],
      };
    }
  }

  const result = { user, summary: null, products: [] };

  if (user && user.currentPantryId) {
    const pq = query(collection(db, "products"), where("productPantryId", "==", user.currentPantryId));
    const pSnap = await getDocs(pq);

    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let expiring3 = 0;
    let expiring7 = 0;
    let zeroStock = 0;
    let openedCount = 0;

    pSnap.forEach((docSnap) => {
      const d = docSnap.data();
      const qty = d.productQuantity ?? 0;
      if (qty <= 0) zeroStock++;
      if (d.productOpenedAt) openedCount++;

      const expTs = d.productOpenedExpiryAt || d.expiryDateProduct;
      let expDateStr = null;
      let diffDays = null;
      if (expTs && expTs.toDate) {
        const expDate = expTs.toDate();
        expDateStr = expDate.toISOString().split("T")[0];
        diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (expDate <= in3Days) expiring3++;
        if (expDate <= in7Days) expiring7++;
      }

      result.products.push({
        id: docSnap.id,
        name: d.productName,
        quantity: qty,
        unit: d.productUnitOfMeasure || "pz",
        category: d.productCategory || "Altro",
        expiry: expDateStr,
        daysToExpiry: diffDays,
        isOpened: Boolean(d.productOpenedAt),
      });
    });

    const sq = query(
      collection(db, "shoppingListItems"),
      where("listItemPantryId", "==", user.currentPantryId),
      where("listItemStatus", "==", "toBuy")
    );
    const sSnap = await getDocs(sq);

    result.summary = {
      pantryId: user.currentPantryId,
      totalProducts: pSnap.size,
      zeroStock,
      openedCount,
      expiring3Days: expiring3,
      expiring7Days: expiring7,
      shoppingListToBuy: sSnap.size,
    };
  }

  fs.writeFileSync(path.resolve(__dirname, "test-output.json"), JSON.stringify(result, null, 2));
}

runTest()
  .then(() => process.exit(0))
  .catch((e) => {
    fs.writeFileSync(path.resolve(__dirname, "test-output.json"), JSON.stringify({ error: e.message }, null, 2));
    process.exit(1);
  });
