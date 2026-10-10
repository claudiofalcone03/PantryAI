/**
 * Utility per la gestione semantica delle icone/emoji alimentari in PantryAI.
 * Include mapping lessicale italiano/inglese, fallback per categoria e lista di emoji popolari per il picker.
 */

export const FOOD_EMOJI_KEYWORDS: Record<string, string> = {
  // Latticini & Uova
  latte: "🥛",
  latticini: "🥛",
  yogurt: "🥣",
  panna: "🥛",
  burro: "🧈",
  formaggio: "🧀",
  parmigiano: "🧀",
  grana: "🧀",
  mozzarella: "🧀",
  ricotta: "🧀",
  gorgonzola: "🧀",
  stracchino: "🧀",
  caciotta: "🧀",
  pecorino: "🧀",
  fontina: "🧀",
  provola: "🧀",
  scamorza: "🧀",
  uova: "🥚",
  uovo: "🥚",

  // Frutta
  mela: "🍎",
  mele: "🍎",
  pera: "🍐",
  pere: "🍐",
  banana: "🍌",
  banane: "🍌",
  arancia: "🍊",
  arance: "🍊",
  mandarino: "🍊",
  mandarini: "🍊",
  clementina: "🍊",
  limone: "🍋",
  limoni: "🍋",
  fragola: "🍓",
  fragole: "🍓",
  uva: "🍇",
  anguria: "🍉",
  cocomero: "🍉",
  melone: "🍈",
  pesca: "🍑",
  pesche: "🍑",
  albicocca: "🍑",
  albicocche: "🍑",
  ciliegia: "🍒",
  ciliegie: "🍒",
  kiwi: "🥝",
  ananas: "🍍",
  mango: "🥭",
  avocado: "🥑",
  mirtilli: "🫐",
  more: "🫐",
  lamponi: "🍓",

  // Verdura & Ortaggi
  pomodoro: "🍅",
  pomodori: "🍅",
  passata: "🍅",
  pelati: "🍅",
  salsa: "🍅",
  patata: "🥔",
  patate: "🥔",
  cipolla: "🧅",
  cipolle: "🧅",
  scalogno: "🧅",
  aglio: "🧄",
  carota: "🥕",
  carote: "🥕",
  insalata: "🥗",
  lattuga: "🥗",
  rucola: "🥗",
  spinaci: "🥬",
  bietola: "🥬",
  verdura: "🥬",
  verdure: "🥬",
  zucchina: "🥒",
  zucchine: "🥒",
  cetriolo: "🥒",
  cetrioli: "🥒",
  melanzana: "🍆",
  melanzane: "🍆",
  peperone: "🫑",
  peperoni: "🫑",
  fungo: "🍄",
  funghi: "🍄",
  champignon: "🍄",
  porcini: "🍄",
  broccolo: "🥦",
  broccoli: "🥦",
  cavolfiore: "🥦",
  cavolo: "🥬",
  mais: "🌽",
  sedano: "🥬",
  finocchio: "🥬",
  carciofo: "🥬",
  carciofi: "🥬",
  asparagi: "🥬",
  zucca: "🎃",

  // Pane, Farinacei & Cereali
  pane: "🍞",
  pagnotta: "🍞",
  baguette: "🥖",
  toast: "🍞",
  focaccia: "🍕",
  pizza: "🍕",
  croissant: "🥐",
  cornetto: "🥐",
  brioche: "🥐",
  pasta: "🍝",
  spaghetti: "🍝",
  penne: "🍝",
  fusilli: "🍝",
  rigatoni: "🍝",
  tagliatelle: "🍝",
  lasagna: "🍝",
  lasagne: "🍝",
  gnocchi: "🍝",
  tortellini: "🥟",
  ravioli: "🥟",
  riso: "🍚",
  risotto: "🍚",
  basmati: "🍚",
  farina: "🌾",
  cereali: "🥣",
  muesli: "🥣",
  avena: "🥣",
  orzo: "🌾",
  farro: "🌾",

  // Carne & Salumi
  carne: "🥩",
  manzo: "🥩",
  vitello: "🥩",
  maiale: "🥩",
  bistecca: "🥩",
  hamburger: "🍔",
  svizzera: "🍔",
  macinato: "🥩",
  pollo: "🍗",
  tacchino: "🍗",
  fuso: "🍗",
  petto: "🍗",
  prosciutto: "🥓",
  speck: "🥓",
  pancetta: "🥓",
  bacon: "🥓",
  salame: "🥓",
  salsiccia: "🌭",
  salsicce: "🌭",
  wurstel: "🌭",
  mortadella: "🥓",
  bresaola: "🥓",

  // Pesce & Frutti di mare
  pesce: "🐟",
  salmone: "🐟",
  tonno: "🐟",
  merluzzo: "🐟",
  branzino: "🐟",
  orata: "🐟",
  trota: "🐟",
  pescespada: "🐟",
  platessa: "🐟",
  gambero: "🦐",
  gamberi: "🦐",
  scampi: "🦐",
  cozze: "🦪",
  vongole: "🦪",
  calamaro: "🦑",
  calamari: "🦑",
  polpo: "🐙",

  // Legumi
  fagioli: "🫘",
  ceci: "🫘",
  lenticchie: "🫘",
  piselli: "🫘",
  soia: "🫘",
  fave: "🫘",

  // Dolci, Snack & Colazione
  biscotti: "🍪",
  biscotto: "🍪",
  cookie: "🍪",
  cookies: "🍪",
  cioccolato: "🍫",
  cioccolata: "🍫",
  nutella: "🍫",
  cacao: "🍫",
  torta: "🍰",
  crostata: "🍰",
  muffin: "🧁",
  pasticcino: "🧁",
  gelato: "🍨",
  ghiacciolo: "🍧",
  marmellata: "🍯",
  confettura: "🍯",
  miele: "🍯",
  caramelle: "🍬",
  gomme: "🍬",
  popcorn: "🍿",
  patatine: "🥔",
  snack: "🥨",
  cracker: "🍘",
  fette: "🍞",

  // Condimenti, Salse & Oli
  olio: "🫒",
  olive: "🫒",
  aceto: "🫒",
  sale: "🧂",
  pepe: "🧂",
  spezie: "🧂",
  origano: "🌿",
  basilico: "🌿",
  rosmarino: "🌿",
  maionese: "🥫",
  ketchup: "🥫",
  senape: "🥫",

  // Bevande
  caffe: "☕",
  caffè: "☕",
  espresso: "☕",
  cappuccino: "☕",
  te: "🍵",
  tè: "🍵",
  tisana: "🍵",
  acqua: "💧",
  succo: "🧃",
  aranciata: "🧃",
  spremuta: "🧃",
  cola: "🥤",
  bibita: "🥤",
  birra: "🍺",
  vino: "🍷",
  spumante: "🍾",
  prosecco: "🍾",
};

export const CATEGORY_FALLBACK_EMOJIS: Record<string, string> = {
  "Frutta e Verdura": "🥦",
  "Frutta": "🍎",
  "Verdura": "🥬",
  "Carne e Pesce": "🥩",
  "Carne": "🥩",
  "Pesce": "🐟",
  "Latticini e Uova": "🧀",
  "Latticini": "🥛",
  "Dispensa": "🥫",
  "Pasta e Riso": "🍝",
  "Surgelati": "❄️",
  "Freezer": "❄️",
  "Dolci e Snack": "🍪",
  "Colazione": "🥐",
  "Bevande": "🧃",
  "Condimenti": "🫒",
  "Spezie": "🧂",
  "Pane e Sostituti": "🍞",
  "Legumi": "🫘",
};

export const POPULAR_FOOD_EMOJIS: string[] = [
  "🥛", "🧀", "🥚", "🧈", "🥣",
  "🍎", "🍌", "🍊", "🍋", "🍓", "🍇", "🥑",
  "🍅", "🥔", "🧅", "🥕", "🥗", "🥒", "🍄", "🥦",
  "🍞", "🥐", "🍕", "🍝", "🍚",
  "🥩", "🍗", "🥓", "🌭", "🍔",
  "🐟", "🦐", "🫘",
  "🍪", "🍫", "🍰", "🍨", "🍯",
  "☕", "🍵", "🧃", "💧", "🍺", "🍷", "🫒", "🥫", "❄️"
];

/**
 * Risolve l'emoji o icona migliore per un prodotto alimentare.
 * Ordine di priorità:
 * 1. Icona personalizzata esplicita (se presente su Firestore)
 * 2. Corrispondenza semantica con il nome dell'alimento
 * 3. Fallback per categoria di appartenenza
 * 4. Fallback generico standard '🍽️'
 */
export function getFoodIcon(
  productName?: string,
  category?: string,
  customIcon?: string | null
): string {
  if (customIcon && customIcon.trim() !== "") {
    return customIcon.trim();
  }

  if (productName) {
    const cleanName = productName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ");

    const words = cleanName.split(/\s+/).filter(Boolean);

    // 1. Cerca prima corrispondenza esatta di parole
    for (const word of words) {
      if (FOOD_EMOJI_KEYWORDS[word]) {
        return FOOD_EMOJI_KEYWORDS[word];
      }
    }

    // 2. Cerca corrispondenza parziale (es. "mozzarelle" -> "mozzarella", "spaghettini" -> "spaghetti")
    for (const [kw, emoji] of Object.entries(FOOD_EMOJI_KEYWORDS)) {
      if (cleanName.includes(kw)) {
        return emoji;
      }
    }
  }

  // 3. Fallback su categoria
  if (category && category.trim()) {
    const trimmedCat = category.trim();
    if (CATEGORY_FALLBACK_EMOJIS[trimmedCat]) {
      return CATEGORY_FALLBACK_EMOJIS[trimmedCat];
    }
    for (const [catName, emoji] of Object.entries(CATEGORY_FALLBACK_EMOJIS)) {
      if (trimmedCat.toLowerCase().includes(catName.toLowerCase())) {
        return emoji;
      }
    }
  }

  // 4. Default
  return "🍽️";
}
