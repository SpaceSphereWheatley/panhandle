// Emoji icon set for common catalogue items (TODO #10). Keyed by normalized
// item name (lowercase, trimmed) — lookup/fallback logic is added in #11.
// Covers the most frequent items per category in
// migrations/0004_seed_catalogue.sql; not exhaustive by design.
const ITEM_ICONS = {
  // Frukt og grønt
  "banan": "🍌", "eple": "🍎", "pære": "🍐", "appelsin": "🍊", "klementin": "🍊",
  "mandarin": "🍊", "sitron": "🍋", "lime": "🍋", "grapefrukt": "🍊", "druer": "🍇",
  "jordbær": "🍓", "blåbær": "🫐", "kiwi": "🥝", "mango": "🥭", "ananas": "🍍",
  "melon": "🍈", "vannmelon": "🍉", "fersken": "🍑", "plomme": "🍑", "avokado": "🥑",
  "tomat": "🍅", "cherrytomat": "🍅", "agurk": "🥒", "salat": "🥬", "isbergsalat": "🥬",
  "spinat": "🥬", "grønnkål": "🥬", "brokkoli": "🥦", "blomkål": "🥦", "gulrot": "🥕",
  "potet": "🥔", "søtpotet": "🍠", "løk": "🧅", "rødløk": "🧅", "hvitløk": "🧄",

  // Brød og bakevarer
  "grovbrød": "🍞", "loff": "🍞", "rundstykker": "🥐", "baguette": "🥖",
  "knekkebrød": "🍞", "pita": "🫓", "tortilla": "🫓", "vafler": "🧇", "pannekaker": "🥞",
  "croissant": "🥐", "boller": "🥯", "kake": "🍰", "sjokoladekake": "🍰",

  // Meieriprodukter
  "melk": "🥛", "lettmelk": "🥛", "helmelk": "🥛", "fløte": "🥛", "kremfløte": "🥛",
  "rømme": "🥛", "smør": "🧈", "margarin": "🧈", "brunost": "🧀", "hvitost": "🧀",
  "norvegia": "🧀", "jarlsberg": "🧀", "gulost": "🧀", "egg": "🥚",

  // Kjøtt og fisk
  "kjøttdeig": "🥩", "svinekjøtt": "🥩", "storfekjøtt": "🥩", "kylling": "🍗",
  "kyllingfilet": "🍗", "kalkun": "🍗", "biff": "🥩", "bacon": "🥓", "pølser": "🌭",
  "grillpølser": "🌭", "laks": "🐟", "torsk": "🐟", "fisk": "🐟", "reker": "🦐",

  // Ingredienser og krydder
  "salt": "🧂", "pepper": "🧂", "sukker": "🍬", "hvetemel": "🌾", "gjær": "🍞",
  "olivenolje": "🫒", "eddik": "🍶", "ketchup": "🍅", "sennep": "🌭", "honning": "🍯",

  // Frysevarer og ferdigmåltid
  "grandiosa": "🍕", "frossenpizza": "🍕", "lasagne": "🍝", "pommes frites": "🍟",
  "vårruller": "🌯", "saftis": "🍦", "is": "🍦",

  // Kornprodukter
  "havregryn": "🥣", "müsli": "🥣", "cornflakes": "🥣", "ris": "🍚", "pasta": "🍝",
  "spaghetti": "🍝",

  // Snacks og godteri
  "potetgull": "🍟", "popcorn": "🍿", "nachos": "🌽", "melkesjokolade": "🍫",
  "mørk sjokolade": "🍫", "vingummi": "🍬", "lakris": "🍬", "tyggegummi": "🍬",

  // Drikkevarer
  "vann": "💧", "kullsyret vann": "🥤", "cola": "🥤", "sprite": "🥤", "fanta": "🥤",
  "eplejuice": "🧃", "appelsinjuice": "🧃", "juice": "🧃", "saft": "🧃", "kaffe": "☕",
  "te": "🍵", "øl": "🍺", "vin": "🍷",

  // Husholdning
  "toalettpapir": "🧻", "tørkepapir": "🧻", "kjøkkenrull": "🧻", "servietter": "🧻",
  "oppvasksåpe": "🧴", "vaskemiddel": "🧴", "klorin": "🧴", "lyspærer": "💡",

  // Omsorg og helse
  "bleier": "🍼", "våtservietter": "🧻", "tannkrem": "🪥", "tannbørste": "🪥",
  "shampo": "🧴", "såpe": "🧼", "plaster": "🩹",

  // Dyreprodukter
  "kattemat": "🐱", "hundemat": "🐶", "kattesand": "🐱",

  // Annet
  "ballonger": "🎈", "blomster": "💐", "potteplante": "🪴", "grillkull": "🔥"
};

function normalizeItemName(name) {
  return String(name).trim().toLowerCase();
}

// Returns an emoji icon for the item, or null if none is mapped — callers
// should fall back to a first-letter badge in that case.
function iconForItem(name) {
  return ITEM_ICONS[normalizeItemName(name)] || null;
}
