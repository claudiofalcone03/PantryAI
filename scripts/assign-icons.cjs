const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

// Carica variabili d'ambiente da .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const FOOD_EMOJI_KEYWORDS = {
  latte: "🥛", latticini: "🥛", yogurt: "🥣", panna: "🥛", burro: "🧈",
  formaggio: "🧀", parmigiano: "🧀", grana: "🧀", mozzarella: "🧀", ricotta: "🧀",
  gorgonzola: "🧀", stracchino: "🧀", caciotta: "🧀", pecorino: "🧀", provola: "🧀",
  uova: "🥚", uovo: "🥚",
  mela: "🍎", mele: "🍎", pera: "🍐", pere: "🍐", banana: "🍌", banane: "🍌",
  arancia: "🍊", arance: "🍊", mandarino: "🍊", limone: "🍋", limoni: "🍋",
  fragola: "🍓", fragole: "🍓", uva: "🍇", anguria: "🍉", cocomero: "🍉",
  melone: "🍈", pesca: "🍑", pesche: "🍑", albicocca: "🍑", ciliegia: "🍒",
  kiwi: "🥝", ananas: "🍍", avocado: "🥑", mirtilli: "🫐",
  pomodoro: "🍅", pomodori: "🍅", passata: "🍅", pelati: "🍅", salsa: "🍅",
  patata: "🥔", patate: "🥔", cipolla: "🧅", cipolle: "🧅", aglio: "🧄",
  carota: "🥕", carote: "🥕", insalata: "🥗", lattuga: "🥗", rucola: "🥗",
  spinaci: "🥬", bietola: "🥬", verdura: "🥬", verdure: "🥬", zucchina: "🥒",
  zucchine: "🥒", cetriolo: "🥒", melanzana: "🍆", melanzane: "🍆", peperone: "🫑",
  peperoni: "🫑", fungo: "🍄", funghi: "🍄", champignon: "🍄", porcini: "🍄",
  broccolo: "🥦", broccoli: "🥦", cavolfiore: "🥦", mais: "🌽", zucca: "🎃",
  pane: "🍞", pagnotta: "🍞", baguette: "🥖", toast: "🍞", focaccia: "🍕", pizza: "🍕",
  croissant: "🥐", cornetto: "🥐", brioche: "🥐",
  pasta: "🍝", spaghetti: "🍝", penne: "🍝", fusilli: "🍝", rigatoni: "🍝",
  tagliatelle: "🍝", lasagna: "🍝", lasagne: "🍝", gnocchi: "🍝", tortellini: "🥟",
  riso: "🍚", risotto: "🍚", farina: "🌾", cereali: "🥣", muesli: "🥣", avena: "🥣",
  carne: "🥩", manzo: "🥩", vitello: "🥩", maiale: "🥩", bistecca: "🥩",
  hamburger: "🍔", macinato: "🥩", pollo: "🍗", tacchino: "🍗", petto: "🍗",
  prosciutto: "🥓", speck: "🥓", pancetta: "🥓", salame: "🥓", salsiccia: "🌭",
  wurstel: "🌭", mortadella: "🥓", bresaola: "🥓",
  pesce: "🐟", salmone: "🐟", tonno: "🐟", merluzzo: "🐟", branzino: "🐟",
  orata: "🐟", gambero: "🦐", gamberi: "🦐", cozze: "🦪", calamari: "🦑",
  fagioli: "🫘", ceci: "🫘", lenticchie: "🫘", piselli: "🫘", soia: "🫘",
  biscotti: "🍪", biscotto: "🍪", cookie: "🍪", cookies: "🍪",
  cioccolato: "🍫", cioccolata: "🍫", nutella: "🍫", cacao: "🍫",
  torta: "🍰", crostata: "🍰", gelato: "🍨", marmellata: "🍯", miele: "🍯",
  patatine: "🥔", cracker: "🍘",
  olio: "🫒", olive: "🫒", aceto: "🫒", sale: "🧂", pepe: "🧂", origano: "🌿", basilico: "🌿",
  maionese: "🥫", ketchup: "🥫",
  caffe: "☕", caffè: "☕", te: "🍵", tè: "🍵", tisana: "🍵", acqua: "💧",
  succo: "🧃", aranciata: "🧃", cola: "🥤", birra: "🍺", vino: "🍷"
};

const CATEGORY_FALLBACK_EMOJIS = {
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
  "Legumi": "🫘"
};

function resolveEmoji(name, category) {
  if (name) {
    const clean = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");
    const words = clean.split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (FOOD_EMOJI_KEYWORDS[w]) return FOOD_EMOJI_KEYWORDS[w];
    }
    for (const [kw, emoji] of Object.entries(FOOD_EMOJI_KEYWORDS)) {
      if (clean.includes(kw)) return emoji;
    }
  }
  if (category) {
    if (CATEGORY_FALLBACK_EMOJIS[category]) return CATEGORY_FALLBACK_EMOJIS[category];
    for (const [cat, emoji] of Object.entries(CATEGORY_FALLBACK_EMOJIS)) {
      if (category.toLowerCase().includes(cat.toLowerCase())) return emoji;
    }
  }
  return "🍽️";
}

async function run() {
  console.log("Inizio scansione prodotti in Firestore...");
  const snap = await getDocs(collection(db, "products"));
  console.log(`Trovati ${snap.size} prodotti totali nel database.`);

  let updated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.productIcon || data.productIcon.trim() === "") {
      const emoji = resolveEmoji(data.productName, data.productCategory);
      await updateDoc(doc(db, "products", docSnap.id), { productIcon: emoji });
      console.log(`[Aggiornato] ${data.productName} -> ${emoji}`);
      updated++;
    } else {
      console.log(`[Gia presente] ${data.productName} -> ${data.productIcon}`);
    }
  }

  console.log(`Completato! ${updated} prodotti aggiornati con nuova icona semantica.`);
}

run().catch(console.error);
