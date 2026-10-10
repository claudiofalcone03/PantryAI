import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROJECT_ID = "pantryai-cee9e";
const PANTRY_ID = "uu7JIm7z40LAsIzxfmJN";
const EXPORT_PATH = "/Users/claudio/Downloads/pantry-export.json";

async function getValidAccessToken() {
  const configPath = path.join(os.homedir(), ".config/configstore/firebase-tools.json");
  if (!fs.existsSync(configPath)) return null;
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
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
      return resJson.access_token;
    }
  }
  return tokens.access_token || null;
}

function toFirestoreTimestamp(dateStr: string | number) {
  return { timestampValue: new Date(dateStr).toISOString() };
}

function toFirestoreString(val: string | null | undefined) {
  return val ? { stringValue: val } : { nullValue: null };
}

function toFirestoreBoolean(val: boolean | null | undefined) {
  return val !== undefined && val !== null ? { booleanValue: val } : { nullValue: null };
}

function toFirestoreDouble(val: number | null | undefined) {
  return val !== undefined && val !== null ? { doubleValue: val } : { nullValue: null };
}

async function run() {
  const token = await getValidAccessToken();
  if (!token) {
    console.error("No valid access token found.");
    return;
  }
  
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const data = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf-8"));
  console.log(`Pantry: ${data.pantry.name}`);

  // Fetch pantry to get current categories
  const pantryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pantries/${PANTRY_ID}`;
  const pantryResp = await fetch(pantryUrl, { headers });
  if (!pantryResp.ok) {
    console.error("Pantry not found or error:", await pantryResp.text());
    return;
  }
  
  const pantryDoc = await pantryResp.json();
  const existingCategories = pantryDoc.fields?.pantryCategories?.arrayValue?.values?.map((v: any) => v.stringValue) || [];
  const newCategories = new Set<string>(existingCategories);

  let totalItems = 0;
  for (const category of data.categories) {
    newCategories.add(category.name);
    
    for (const item of category.items) {
      const docId = crypto.randomUUID().replace(/-/g, "").substring(0, 20); // 20 char random id
      const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/products/${docId}`;
      const url = `https://firestore.googleapis.com/v1/${docPath}`;
      
      const fields: any = {
        productId: { stringValue: docId },
        productName: { stringValue: item.name },
        productCategory: { stringValue: category.name },
        productQuantity: { doubleValue: item.quantity || 1 },
        productUnitOfMeasure: { stringValue: item.unit || "pcs" },
        productPantryId: { stringValue: PANTRY_ID },
        addToShoppingList: { booleanValue: item.is_in_shopping_list || false },
        productCreatedAt: toFirestoreTimestamp(item.created_at || Date.now()),
        productUpdatedAt: toFirestoreTimestamp(item.updated_at || Date.now()),
      };
      
      if (item.expiry_date) {
        fields.expiryDateProduct = toFirestoreTimestamp(item.expiry_date);
      }
      if (item.is_frozen) {
        fields.isFrozen = { booleanValue: true };
        if (item.frozen_at) {
          fields.productFrozenAt = toFirestoreTimestamp(item.frozen_at);
        }
        fields.frozenMonthsDuration = { doubleValue: 3 }; // default
      }
      
      const payload = { fields };
      const resp = await fetch(url + "?currentDocument.exists=false", {
        method: "PATCH", // Firestore REST uses PATCH to create/update
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!resp.ok) {
        console.error(`Failed to create product ${item.name}:`, await resp.text());
      } else {
        totalItems++;
      }
    }
  }

  // Update categories if changed
  if (newCategories.size > existingCategories.length) {
    const updatedCategoriesArray = Array.from(newCategories).map(c => ({ stringValue: c }));
    pantryDoc.fields.pantryCategories = { arrayValue: { values: updatedCategoriesArray } };
    
    const patchUrl = `${pantryUrl}?updateMask.fieldPaths=pantryCategories`;
    const patchResp = await fetch(patchUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields: pantryDoc.fields })
    });
    if (!patchResp.ok) {
      console.error("Failed to update categories:", await patchResp.text());
    } else {
      console.log(`Updated pantry categories. Old count: ${existingCategories.length}, New count: ${newCategories.size}`);
    }
  }

  console.log(`Successfully imported ${totalItems} items.`);
}

run().catch(console.error);
