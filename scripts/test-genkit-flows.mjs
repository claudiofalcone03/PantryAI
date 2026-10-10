/**
 * Test Suite per Flussi Genkit e Funzionalità AI di PantryAI
 * Esegue la verifica dei flussi, schemi Zod, estrazione JSON, difese SSRF, sanitizzazione MIME e edge cases.
 */

import assert from "node:assert/strict";
import {
  ai,
  recipeExpirationFlow,
  recipeFromIngredientsFlow,
  recipeChatbotFlow,
  analyzeImageProductsFlow,
  voiceDictationParserFlow,
  antiWasteWeeklyPlanFlow,
  singleMealSuggestionFlow,
  pantryCopilotFlow,
  extractStructuredRecipeFlow,
  GENKIT_FLOWS_MANIFEST,
  extractJsonFromResponse,
} from "../lib/genkit/flows.ts";
import { buildLiveChefPantryContext } from "../lib/genkit/genkit.ts";

console.log("==================================================");
console.log("🚀 AVVIO TEST SUITE FLUSSI GENKIT PANTRYAI");
console.log("==================================================");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Errore: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Errore: ${err.message}`);
    failed++;
  }
}

// 1. Verifica Registrazione Flussi Genkit
runTest("1. Tutti i 9 flussi sono definiti e registrati in Genkit", () => {
  const flows = [
    recipeExpirationFlow,
    recipeFromIngredientsFlow,
    recipeChatbotFlow,
    analyzeImageProductsFlow,
    voiceDictationParserFlow,
    antiWasteWeeklyPlanFlow,
    singleMealSuggestionFlow,
    pantryCopilotFlow,
    extractStructuredRecipeFlow,
  ];

  assert.equal(flows.length, 9, "Devono essere presenti esattamente 9 flussi");
  for (const f of flows) {
    assert.equal(typeof f, "function", "Ogni flusso deve essere una funzione eseguibile");
  }
});

// 2. Verifica Manifest Flussi
runTest("2. Manifest GENKIT_FLOWS_MANIFEST contiene tutti i metadati", () => {
  assert.equal(GENKIT_FLOWS_MANIFEST.length, 9);
  for (const m of GENKIT_FLOWS_MANIFEST) {
    assert.ok(m.id, "ID mancante");
    assert.ok(m.name, "Nome mancante");
    assert.ok(m.category, "Categoria mancante");
    assert.ok(m.clientSurfaces.mobile.length > 0, "Superfici mobile mancanti");
    assert.ok(m.clientSurfaces.desktop.length > 0, "Superfici desktop mancanti");
  }
});

// 3. Test Estrattore Robusto JSON (Trailing commas, preamboli, markdown e graffe precedenti)
runTest("3. extractJsonFromResponse gestisce JSON puro, markdown, trailing commas ed edge case preamboli", () => {
  // Test 3.1: JSON puro
  const pure = extractJsonFromResponse('{"key": "value"}');
  assert.equal(pure.key, "value");

  // Test 3.2: Markdown con ```json
  const md = extractJsonFromResponse('```json\n{"products": [{"name": "Mela"}]}\n```');
  assert.equal(md.products[0].name, "Mela");

  // Test 3.3: Preambolo testuale prima e dopo il JSON
  const preamble = extractJsonFromResponse('Ecco il risultato:\n```json\n{"reply": "Ciao"}\n```\nSpero sia utile!');
  assert.equal(preamble.reply, "Ciao");

  // Test 3.4: Array JSON
  const arr = extractJsonFromResponse('Risposta:\n[{"id": 1}, {"id": 2}]\nFine');
  assert.equal(arr.length, 2);
  assert.equal(arr[1].id, 2);

  // Test 3.5: Trailing commas in oggetti e array (classico errore LLM)
  const trailing = extractJsonFromResponse('{\n  "title": "Pasta",\n  "count": 2,\n}');
  assert.equal(trailing.title, "Pasta");
  assert.equal(trailing.count, 2);

  const trailingArr = extractJsonFromResponse('[{"a": 1,}, {"b": 2,},]');
  assert.equal(trailingArr.length, 2);

  // Test 3.6: Preambolo con graffe prima dell\'array effettivo
  const braceBeforeArr = extractJsonFromResponse('Esempio di schema: {}. Ecco i dati reali elaborati:\n[{"name": "Latte", "qty": 1}]');
  assert.ok(Array.isArray(braceBeforeArr), "Deve estrarre l'array effettivo ignorando l'oggetto vuoto");
  assert.equal(braceBeforeArr[0].name, "Latte");
});

// 4. Edge Cases: Gestione Input Vuoti su TUTTI gli 8 flussi
await runAsyncTest("4. Edge cases su input vuoti su tutti i flussi (Gestione controllata senza crash)", async () => {
  // 4.1 recipeExpirationFlow con array vuoto
  const expRes = await recipeExpirationFlow([]);
  assert.ok(expRes.includes("Nessun prodotto"), "Deve restituire messaggio di guardia");

  // 4.2 recipeFromIngredientsFlow con array vuoto
  const ingRes = await recipeFromIngredientsFlow([]);
  assert.ok(ingRes.includes("Nessun ingrediente"), "Deve restituire messaggio di guardia");

  // 4.3 recipeChatbotFlow con stringa vuota
  const chatRes = await recipeChatbotFlow({ promptChatbot: "   " });
  assert.ok(chatRes.includes("Scrivi una domanda"), "Deve richiedere una domanda valida");

  // 4.4 analyzeImageProductsFlow con stringa vuota
  const imgRes = await analyzeImageProductsFlow({ base64Image: "" });
  assert.equal(imgRes.success, false);
  assert.equal(imgRes.products.length, 0);

  // 4.5 voiceDictationParserFlow con stringa vuota
  const voiceRes = await voiceDictationParserFlow({ audioBase64: "" });
  assert.equal(voiceRes.success, false);

  // 4.6 antiWasteWeeklyPlanFlow con array days vuoto
  const planRes = await antiWasteWeeklyPlanFlow({ days: [] });
  assert.deepEqual(planRes, { days: {} }, "Deve gestire giorni vuoti senza chiamare il modello");

  // 4.7 singleMealSuggestionFlow con input non validi
  const mealRes = await singleMealSuggestionFlow({ slotType: "pranzo", dayName: "   " });
  assert.equal(mealRes, null, "Deve ritornare null per dayName vuoto");

  // 4.8 pantryCopilotFlow con stringa vuota
  const copilotRes = await pantryCopilotFlow({ message: "   " });
  assert.equal(copilotRes.success, true);
  assert.ok(copilotRes.reply.length > 0);
});

// 5. Difesa SSRF e DoS su voiceDictationParserFlow
await runAsyncTest("5. Protezione SSRF e DoS su voiceDictationParserFlow", async () => {
  // SSRF: Blocco URL http/https/file
  const ssrf1 = await voiceDictationParserFlow({ audioBase64: "https://evil.com/audio.webm" });
  assert.equal(ssrf1.success, false, "Deve bloccare URL esterni http:");

  const ssrf2 = await voiceDictationParserFlow({ audioBase64: "file:///etc/passwd" });
  assert.equal(ssrf2.success, false, "Deve bloccare schemi file:");

  // DoS: Blocco payload > 15MB
  const largeAudio = "A".repeat(16 * 1024 * 1024);
  const dosRes = await voiceDictationParserFlow({ audioBase64: largeAudio });
  assert.equal(dosRes.success, false, "Deve bloccare audio > 15MB");
});

// 6. Resilienza helper contesti (buildLiveChefPantryContext)
await runAsyncTest("6. Resilienza helper contesti per Chef Vocale", async () => {
  // Array vuoto
  const emptyCtx = await buildLiveChefPantryContext([]);
  assert.ok(emptyCtx.includes("DISPENSA ATTUALE: Al momento non ci sono prodotti"));

  // Prodotti misti con e senza scadenza
  const mixedCtx = await buildLiveChefPantryContext([
    { name: "Yogurt", quantity: 2, isExpiringSoon: true, expiryDate: "2026-10-15" },
    { name: "Pasta", quantity: 1, isExpiringSoon: false },
  ]);
  assert.ok(mixedCtx.includes("PRODOTTI IN SCADENZA RAVVICINATA"));
  assert.ok(mixedCtx.includes("Yogurt"));
  assert.ok(mixedCtx.includes("Pasta"));
});

console.log("==================================================");
console.log(`📊 RISULTATI TEST SUITE: ${passed} PASSATI, ${failed} FALLITI`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
