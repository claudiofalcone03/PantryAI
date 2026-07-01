import { generateRecipeFromIngredients } from './lib/genkit/genkit';

async function main() {
    console.log("Inviando la richiesta a Gemini...");
    const ingredienti = [
        { nome: "Zucchine", quantita: "1" },
        { nome: "Pomodori", quantita: "2" },
        { nome: "Formaggio", quantita: "100g" },
        { nome: "Uova", quantita: "2" },
        { nome: "Pesto", quantita: "q.b." }
    ];
    const ricetta = await generateRecipeFromIngredients(ingredienti);

    console.log("\n--- Risposta di Gemini  alle 17:10 ---");
    console.log(ricetta);
    console.log("--------------------------");
}

main().catch(console.error);
