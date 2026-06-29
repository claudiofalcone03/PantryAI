import { genkit } from 'genkit'
import { googleAI } from '@genkit-ai/google-genai';

// Inizializzazione Istanza di Genkit
export const ai = genkit({
    plugins: [googleAI()],
    model: googleAI.model('gemini-3.1-flash-lite'),
});

export async function generaRicetta(ingredienti: string[]) {
    const promptRuolo = `Sei uno chef esperto. Crea una breve ricetta  utilizzando questi ingredienti: ${ingredienti.join(', ')}.`;

    try {
        const { text } = await ai.generate(promptRuolo);
        return text;
    } catch (error) {
        console.error("Errore Genkit:", error);
        return "Generazione ricetta fallita.";
    }
}
