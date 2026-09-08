import { getExpiringProductsByPantry } from '@/lib/firestore/products';

async function main() {
    const testPantryId = "test-dispensa-123";
    console.log(`Test recupero prodotti in scadenza per la dispensa: ${testPantryId}`);
    try {
        const products = await getExpiringProductsByPantry(testPantryId, 7);
        console.log(`Trovati ${products.length} prodotti in scadenza.`);
        console.log(products);
    } catch (e: unknown) {
        console.error("Errore durante il test:");
        console.error(e instanceof Error ? e.message : String(e));
    }
}

main().catch(console.error);
