import { generaRicetta } from './lib/genkit/genkit';

async function main() {
    console.log("Inviando la richiesta a Gemini...");
    const ingredienti = ["Patatine", "Mozzarella", "Parmigiano", "panna", "wurstel"];
    const ricetta = await generaRicetta(ingredienti);

    console.log("\n--- Risposta di Gemini ---");
    console.log(ricetta);
    console.log("--------------------------");
}

main().catch(console.error);
