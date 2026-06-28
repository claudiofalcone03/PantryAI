export async function fetchProductByBarcode(barcode: string): Promise<{ name: string; carbonFootprint: number | null }> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  console.log(`Richiesta API in corso per il barcode: ${barcode}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log("La risposta di Open Food Facts", data);

    if (data.status === 1 && data.product) {
      // Prova a recuperare vari campi nome, oppure la marca
      const productName = data.product.product_name_it || data.product.product_name || data.product.generic_name || data.product.product_name_en || data.product.brands || "Prodotto Sconosciuto";
      
      let carbonFootprint: number | null = null;
      if (data.product.product_quantity && data.product.ecoscore_data?.agribalyse?.co2_total) {
        const quantity = Number(data.product.product_quantity);
        if (!isNaN(quantity)) {
          carbonFootprint = quantity * data.product.ecoscore_data.agribalyse.co2_total;
        }
      }

      return { name: productName, carbonFootprint };
    } else {
      throw new Error("Prodotto non presente");
    }
  } catch (error) {
    console.error("Errore fetch Open Food Facts:", error);
    throw error;
  }
}
