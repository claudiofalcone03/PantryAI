import { generaRicetta } from './lib/genkit/genkit';

async function main() {
    console.log("Inviando la richiesta a Gemini...");
    const ingredienti = ["Zucchine", "Pomodori", "Formaggio", "Uova", "Pesto"];
    const ricetta = await generaRicetta(ingredienti);

    console.log("\n--- Risposta di Gemini  alle 17:10 ---");
    console.log(ricetta);
    console.log("--------------------------");
}

main().catch(console.error);
