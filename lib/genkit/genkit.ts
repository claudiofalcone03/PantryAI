"use server";

import { genkit } from 'genkit'
import { googleAI } from '@genkit-ai/google-genai';

// Inizializzazione Istanza di Genkit
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';  //Modello più accessibile

const ai = genkit({
    plugins: [googleAI()],
    model: googleAI.model(geminiModel),
});


// Prompt per generare ricette in base ai prodotti in scadenza
export async function generateRecipeExpiration(prodotti: { nome: string, quantita: string }[]) {
    console.log("Generazione ricetta da scaduti in corso...");
    console.log("Dati in ingresso ricevuti dal client:", JSON.stringify(prodotti, null, 2));

    const ingredientiFormattati = prodotti.map(p => `${p.quantita} di ${p.nome}`).join(", ");
    const promptExpiration = `Sei uno chef esperto. I seguenti ingredienti stanno per scadere: ${ingredientiFormattati}. Crea una breve ricetta per utilizzarli, evitando gli sprechi.`;


    console.log("Prompt Gemini:");
    console.log(promptExpiration);

    try {
        const { text } = await ai.generate(promptExpiration);
        console.log("Risposta di Gemini:");
        console.log(text);
        console.log("Generazione ricetta da scaduti conclusa.");
        return text;
    } catch (error) {
        console.error("Errore Genkit:", error);
        return "Generazione ricetta fallita.";
    }
}

// Prompt per generare ricette in base agli ingredienti selezionati
export async function generateRecipeFromIngredients(prodotti: { nome: string, quantita: string }[]) {
    console.log("Generazione ricetta da ingredienti selezionati in corso...");
    console.log("Dati in ingresso ricevuti dal client:", JSON.stringify(prodotti, null, 2));

    const ingredientiFormattati = prodotti.map(p => `${p.quantita} di ${p.nome}`).join(", ");
    const promptSelected = `Sei uno chef esperto. L'utente ha selezionato i seguenti ingredienti dalla sua dispensa: ${ingredientiFormattati}. Crea una ricetta gustosa per utilizzarli al meglio. Cerca di essere creativo ma pratico.`;

    console.log("Prompt Gemini:");
    console.log(promptSelected);

    try {
        const { text } = await ai.generate(promptSelected);
        console.log("Risposta di Gemini:");
        console.log(text);
        console.log("Generazione ricetta da ingredienti selezionati conclusa.");
        return text;
    } catch (error) {
        console.error("Errore Genkit:", error);
        return "Generazione ricetta fallita.";
    }
}

// Prompt role chatbot
const promptRole = `Sei uno chef esperto e un assistente culinario. Il tuo obiettivo è aiutare l'utente con ricette, idee per cucinare e consigli su come ridurre gli sprechi alimentari. Rispondi in modo creativo, utile e sintetico.`;

// Genera ricette in base alla richiesta dell'utente
export async function generateRecipeChatbot(
    promptChatbot: string,
    history: { role: "user" | "ai", content: string }[] = [],
    prodotti?: { nome: string, quantita: string }[]
) {
    console.log("Inizio Chatbot in corso...");
    console.log("Messaggio utente:", promptChatbot);

    let contextDispensa = "";
    if (prodotti && prodotti.length > 0) {
        const ingredientiFormattati = prodotti.map(p => `${p.quantita} di ${p.nome}`).join(", ");
        contextDispensa = `Contesto aggiuntivo: l'utente ha attualmente a disposizione nella sua dispensa i seguenti ingredienti: ${ingredientiFormattati}. Quando suggerisci una ricetta o rispondi, tieni a mente questi ingredienti e cerca di dare la priorità a ciò che l'utente ha già, se pertinente alla sua richiesta.`;
    }

    const systemPrompt = promptRole + contextDispensa;

    const messages = [
        { role: "system" as const, content: [{ text: systemPrompt }] },
        ...history.map(msg => ({
            role: msg.role === "ai" ? "model" as const : "user" as const,
            content: [{ text: msg.content }]
        })),
        { role: "user" as const, content: [{ text: promptChatbot }] }
    ];

    console.log("Messaggi chatbot inviati:");
    console.log(JSON.stringify(messages, null, 2));

    try {
        const { text } = await ai.generate({ messages });
        console.log("Risposta ricevuta da Gemini:");
        console.log(text);
        console.log("Chatbot concluso.");
        return text;
    } catch (error) {
        console.error("Errore Genkit (Chatbot):", error);
        return "Ops, si è verificato un errore durante la generazione della risposta.";
    }
}

export async function getGeminiModelName() {
    return geminiModel;
}

