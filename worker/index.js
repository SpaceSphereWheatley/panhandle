// Laget av Mohibb Malik, 2026
// Worker API for shared shopping list + meal planner
// Served at shopping.mohibb.com. Frontend on Cloudflare Pages,
// API = this Worker under /api/*. Proxies other paths to Pages.
// Auth: users in D1 with PBKDF2 password hashes, JWT with token versioning,
//       sliding expiry, in-app password change that logs out other devices.
// Multi-tenant: every user belongs to exactly one list (users.list_id); all
//       shopping/meal data is scoped by list_id. is_admin/is_owner are
//       independent flags (a user can be both). Admins create owner accounts
//       (each gets its own list); owners add members to their own list.

import { VERSION } from "../shared/version.js";
import { CATEGORIES } from "../shared/categories.js";

// Deployed Worker (API) version, imported from shared/version.js so it can't
// drift from src/lib/version.js's APP_VERSION. Surfaced at GET /api/version —
// the Profile page shows both so a half-finished deploy (one side stale) is
// visible at a glance.

// Login rate-limiting (TODO #14): max failed attempts per source IP within
// the sliding window below, backed by the login_attempts table (see
// migrations/0001_init.sql, the login_attempts table). Keyed by IP rather than username so a
// flood of failed attempts against one account can't be used to lock out its
// real owner. Also reused by /change-password (see below) to throttle
// current-password brute-forcing on a stolen token.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

// Common Norwegian groceries seeded into a new list's catalogue at creation,
// so a fresh household gets autocomplete/category-matching for everyday items
// instead of a blank catalogue. One-time copy per list — editing this array
// only affects lists created afterwards. Categories must be in CATEGORIES.
// Kept in sync with migrations/0002_seed_catalogue.sql and
// 0003_expand_catalogue.sql (~710 items total) — those migrations backfilled
// this same set into every list that existed *at the time they were run*
// (via CROSS JOIN lists), but new lists only ever get seeded through this
// array, so it needs to carry the full set too, not just the original
// smaller list. If you add more items via a future migration, add them here
// as well so newly-created lists don't fall behind again.
export const COMMON_ITEMS = [
  { name: "Frukt", category: "Frukt og grønt" },
  { name: "Grønnsaker", category: "Frukt og grønt" },
  { name: "Banan", category: "Frukt og grønt" },
  { name: "Eple", category: "Frukt og grønt" },
  { name: "Appelsin", category: "Frukt og grønt" },
  { name: "Sitron", category: "Frukt og grønt" },
  { name: "Druer", category: "Frukt og grønt" },
  { name: "Jordbær", category: "Frukt og grønt" },
  { name: "Blåbær", category: "Frukt og grønt" },
  { name: "Avokado", category: "Frukt og grønt" },
  { name: "Tomat", category: "Frukt og grønt" },
  { name: "Agurk", category: "Frukt og grønt" },
  { name: "Salat", category: "Frukt og grønt" },
  { name: "Brokkoli", category: "Frukt og grønt" },
  { name: "Gulrot", category: "Frukt og grønt" },
  { name: "Potet", category: "Frukt og grønt" },
  { name: "Løk", category: "Frukt og grønt" },
  { name: "Hvitløk", category: "Frukt og grønt" },
  { name: "Paprika", category: "Frukt og grønt" },
  { name: "Sopp", category: "Frukt og grønt" },
  { name: "Spinat", category: "Frukt og grønt" },
  { name: "Ingefær", category: "Frukt og grønt" },
  { name: "Brød", category: "Brød og bakevarer" },
  { name: "Grovbrød", category: "Brød og bakevarer" },
  { name: "Loff", category: "Brød og bakevarer" },
  { name: "Rundstykker", category: "Brød og bakevarer" },
  { name: "Knekkebrød", category: "Brød og bakevarer" },
  { name: "Tortilla", category: "Brød og bakevarer" },
  { name: "Boller", category: "Brød og bakevarer" },
  { name: "Melk", category: "Meieriprodukter" },
  { name: "Lettmelk", category: "Meieriprodukter" },
  { name: "Fløte", category: "Meieriprodukter" },
  { name: "Rømme", category: "Meieriprodukter" },
  { name: "Smør", category: "Meieriprodukter" },
  { name: "Ost", category: "Meieriprodukter" },
  { name: "Brunost", category: "Meieriprodukter" },
  { name: "Hvitost", category: "Meieriprodukter" },
  { name: "Norvegia", category: "Meieriprodukter" },
  { name: "Mozzarella", category: "Meieriprodukter" },
  { name: "Parmesan", category: "Meieriprodukter" },
  { name: "Yoghurt", category: "Meieriprodukter" },
  { name: "Gresk yoghurt", category: "Meieriprodukter" },
  { name: "Skyr", category: "Meieriprodukter" },
  { name: "Egg", category: "Meieriprodukter" },
  { name: "Kjøtt", category: "Kjøtt og fisk" },
  { name: "Fisk", category: "Kjøtt og fisk" },
  { name: "Pålegg", category: "Kjøtt og fisk" },
  { name: "Kjøttdeig", category: "Kjøtt og fisk" },
  { name: "Kylling", category: "Kjøtt og fisk" },
  { name: "Kyllingfilet", category: "Kjøtt og fisk" },
  { name: "Bacon", category: "Kjøtt og fisk" },
  { name: "Pølser", category: "Kjøtt og fisk" },
  { name: "Kjøttboller", category: "Kjøtt og fisk" },
  { name: "Laks", category: "Kjøtt og fisk" },
  { name: "Torsk", category: "Kjøtt og fisk" },
  { name: "Tunfisk", category: "Kjøtt og fisk" },
  { name: "Reker", category: "Kjøtt og fisk" },
  { name: "Fiskekaker", category: "Kjøtt og fisk" },
  { name: "Kokt skinke", category: "Kjøtt og fisk" },
  { name: "Mel", category: "Ingredienser og krydder" },
  { name: "Olje", category: "Ingredienser og krydder" },
  { name: "Salt", category: "Ingredienser og krydder" },
  { name: "Pepper", category: "Ingredienser og krydder" },
  { name: "Sukker", category: "Ingredienser og krydder" },
  { name: "Hvetemel", category: "Ingredienser og krydder" },
  { name: "Olivenolje", category: "Ingredienser og krydder" },
  { name: "Soyasaus", category: "Ingredienser og krydder" },
  { name: "Ketchup", category: "Ingredienser og krydder" },
  { name: "Sennep", category: "Ingredienser og krydder" },
  { name: "Majones", category: "Ingredienser og krydder" },
  { name: "Tomatpuré", category: "Ingredienser og krydder" },
  { name: "Hermetiske tomater", category: "Ingredienser og krydder" },
  { name: "Honning", category: "Ingredienser og krydder" },
  { name: "Grandiosa", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne grønnsaker", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne bær", category: "Frysevarer og ferdigmåltid" },
  { name: "Pommes frites", category: "Frysevarer og ferdigmåltid" },
  { name: "Iskrem boks", category: "Frysevarer og ferdigmåltid" },
  { name: "Frokostblanding", category: "Kornprodukter" },
  { name: "Havregryn", category: "Kornprodukter" },
  { name: "Müsli", category: "Kornprodukter" },
  { name: "Cornflakes", category: "Kornprodukter" },
  { name: "Ris", category: "Kornprodukter" },
  { name: "Pasta", category: "Kornprodukter" },
  { name: "Spaghetti", category: "Kornprodukter" },
  { name: "Makaroni", category: "Kornprodukter" },
  { name: "Couscous", category: "Kornprodukter" },
  { name: "Kikerter", category: "Kornprodukter" },
  { name: "Potetgull", category: "Snacks og godteri" },
  { name: "Melkesjokolade", category: "Snacks og godteri" },
  { name: "Kjeks", category: "Snacks og godteri" },
  { name: "Popcorn", category: "Snacks og godteri" },
  { name: "Sjokolade", category: "Snacks og godteri" },
  { name: "Vann", category: "Drikkevarer" },
  { name: "Kullsyret vann", category: "Drikkevarer" },
  { name: "Cola", category: "Drikkevarer" },
  { name: "Juice", category: "Drikkevarer" },
  { name: "Saft", category: "Drikkevarer" },
  { name: "Kaffe", category: "Drikkevarer" },
  { name: "Te", category: "Drikkevarer" },
  { name: "Brus", category: "Drikkevarer" },
  { name: "Eplejuice", category: "Drikkevarer" },
  { name: "Toalettpapir", category: "Husholdning" },
  { name: "Tørkepapir", category: "Husholdning" },
  { name: "Kjøkkenrull", category: "Husholdning" },
  { name: "Oppvasksåpe", category: "Husholdning" },
  { name: "Oppvaskmaskin tabletter", category: "Husholdning" },
  { name: "Vaskemiddel", category: "Husholdning" },
  { name: "Allrengjøring", category: "Husholdning" },
  { name: "Søppelsekker", category: "Husholdning" },
  { name: "Aluminiumsfolie", category: "Husholdning" },
  { name: "Bakepapir", category: "Husholdning" },
  { name: "Tannkrem", category: "Omsorg og helse" },
  { name: "Tannbørste", category: "Omsorg og helse" },
  { name: "Sjampo", category: "Omsorg og helse" },
  { name: "Dusjsåpe", category: "Omsorg og helse" },
  { name: "Håndsåpe", category: "Omsorg og helse" },
  { name: "Plaster", category: "Omsorg og helse" },
  { name: "Kattemat", category: "Dyreprodukter" },
  { name: "Hundemat", category: "Dyreprodukter" },
  { name: "Blomster", category: "Annet" },
  { name: "Pære", category: "Frukt og grønt" },
  { name: "Klementin", category: "Frukt og grønt" },
  { name: "Mandarin", category: "Frukt og grønt" },
  { name: "Lime", category: "Frukt og grønt" },
  { name: "Grapefrukt", category: "Frukt og grønt" },
  { name: "Bringebær", category: "Frukt og grønt" },
  { name: "Bjørnebær", category: "Frukt og grønt" },
  { name: "Kiwi", category: "Frukt og grønt" },
  { name: "Mango", category: "Frukt og grønt" },
  { name: "Ananas", category: "Frukt og grønt" },
  { name: "Melon", category: "Frukt og grønt" },
  { name: "Vannmelon", category: "Frukt og grønt" },
  { name: "Fersken", category: "Frukt og grønt" },
  { name: "Nektarin", category: "Frukt og grønt" },
  { name: "Plomme", category: "Frukt og grønt" },
  { name: "Aprikos", category: "Frukt og grønt" },
  { name: "Granateple", category: "Frukt og grønt" },
  { name: "Cherrytomat", category: "Frukt og grønt" },
  { name: "Isbergsalat", category: "Frukt og grønt" },
  { name: "Ruccola", category: "Frukt og grønt" },
  { name: "Grønnkål", category: "Frukt og grønt" },
  { name: "Blomkål", category: "Frukt og grønt" },
  { name: "Søtpotet", category: "Frukt og grønt" },
  { name: "Rødløk", category: "Frukt og grønt" },
  { name: "Purreløk", category: "Frukt og grønt" },
  { name: "Vårløk", category: "Frukt og grønt" },
  { name: "Chili", category: "Frukt og grønt" },
  { name: "Squash", category: "Frukt og grønt" },
  { name: "Aubergine", category: "Frukt og grønt" },
  { name: "Mais", category: "Frukt og grønt" },
  { name: "Sukkererter", category: "Frukt og grønt" },
  { name: "Champignon", category: "Frukt og grønt" },
  { name: "Reddik", category: "Frukt og grønt" },
  { name: "Rødbete", category: "Frukt og grønt" },
  { name: "Kålrot", category: "Frukt og grønt" },
  { name: "Stangselleri", category: "Frukt og grønt" },
  { name: "Asparges", category: "Frukt og grønt" },
  { name: "Rosenkål", category: "Frukt og grønt" },
  { name: "Hodekål", category: "Frukt og grønt" },
  { name: "Rødkål", category: "Frukt og grønt" },
  { name: "Kinakål", category: "Frukt og grønt" },
  { name: "Persille", category: "Frukt og grønt" },
  { name: "Basilikum", category: "Frukt og grønt" },
  { name: "Koriander", category: "Frukt og grønt" },
  { name: "Dill", category: "Frukt og grønt" },
  { name: "Gressløk", category: "Frukt og grønt" },
  { name: "Mynte", category: "Frukt og grønt" },
  { name: "Rabarbra", category: "Frukt og grønt" },
  { name: "Pasjonsfrukt", category: "Frukt og grønt" },
  { name: "Kokosnøtt", category: "Frukt og grønt" },
  { name: "Erter", category: "Frukt og grønt" },
  { name: "Baguette", category: "Brød og bakevarer" },
  { name: "Polarbrød", category: "Brød og bakevarer" },
  { name: "Pita", category: "Brød og bakevarer" },
  { name: "Lefse", category: "Brød og bakevarer" },
  { name: "Vafler", category: "Brød og bakevarer" },
  { name: "Pannekaker", category: "Brød og bakevarer" },
  { name: "Croissant", category: "Brød og bakevarer" },
  { name: "Skolebrød", category: "Brød og bakevarer" },
  { name: "Kanelboller", category: "Brød og bakevarer" },
  { name: "Muffins", category: "Brød og bakevarer" },
  { name: "Kake", category: "Brød og bakevarer" },
  { name: "Sjokoladekake", category: "Brød og bakevarer" },
  { name: "Brioche", category: "Brød og bakevarer" },
  { name: "Toastbrød", category: "Brød og bakevarer" },
  { name: "Fullkornsbrød", category: "Brød og bakevarer" },
  { name: "Speltbrød", category: "Brød og bakevarer" },
  { name: "Surdeigsbrød", category: "Brød og bakevarer" },
  { name: "Ciabatta", category: "Brød og bakevarer" },
  { name: "Focaccia", category: "Brød og bakevarer" },
  { name: "Naanbrød", category: "Brød og bakevarer" },
  { name: "Hamburgerbrød", category: "Brød og bakevarer" },
  { name: "Hotdogbrød", category: "Brød og bakevarer" },
  { name: "Kavring", category: "Brød og bakevarer" },
  { name: "Donut", category: "Brød og bakevarer" },
  { name: "Helmelk", category: "Meieriprodukter" },
  { name: "Skummet melk", category: "Meieriprodukter" },
  { name: "Ekstra lettmelk", category: "Meieriprodukter" },
  { name: "Laktosefri melk", category: "Meieriprodukter" },
  { name: "Kremfløte", category: "Meieriprodukter" },
  { name: "Matfløte", category: "Meieriprodukter" },
  { name: "Crème fraîche", category: "Meieriprodukter" },
  { name: "Lettrømme", category: "Meieriprodukter" },
  { name: "Margarin", category: "Meieriprodukter" },
  { name: "Bremykt", category: "Meieriprodukter" },
  { name: "Jarlsberg", category: "Meieriprodukter" },
  { name: "Gulost", category: "Meieriprodukter" },
  { name: "Cottage cheese", category: "Meieriprodukter" },
  { name: "Kremost", category: "Meieriprodukter" },
  { name: "Philadelphia", category: "Meieriprodukter" },
  { name: "Fetaost", category: "Meieriprodukter" },
  { name: "Cheddar", category: "Meieriprodukter" },
  { name: "Naturell yoghurt", category: "Meieriprodukter" },
  { name: "Drikkeyoghurt", category: "Meieriprodukter" },
  { name: "Kefir", category: "Meieriprodukter" },
  { name: "Kvarg", category: "Meieriprodukter" },
  { name: "Vaniljesaus", category: "Meieriprodukter" },
  { name: "Iskrem", category: "Meieriprodukter" },
  { name: "Karbonadedeig", category: "Kjøtt og fisk" },
  { name: "Svinekjøtt", category: "Kjøtt og fisk" },
  { name: "Storfekjøtt", category: "Kjøtt og fisk" },
  { name: "Kyllinglår", category: "Kjøtt og fisk" },
  { name: "Kyllingvinger", category: "Kjøtt og fisk" },
  { name: "Kalkun", category: "Kjøtt og fisk" },
  { name: "Biff", category: "Kjøtt og fisk" },
  { name: "Entrecôte", category: "Kjøtt og fisk" },
  { name: "Indrefilet", category: "Kjøtt og fisk" },
  { name: "Ytrefilet", category: "Kjøtt og fisk" },
  { name: "Svinekoteletter", category: "Kjøtt og fisk" },
  { name: "Svinefilet", category: "Kjøtt og fisk" },
  { name: "Grillpølser", category: "Kjøtt og fisk" },
  { name: "Wienerpølser", category: "Kjøtt og fisk" },
  { name: "Medisterkaker", category: "Kjøtt og fisk" },
  { name: "Lammekjøtt", category: "Kjøtt og fisk" },
  { name: "Lammelår", category: "Kjøtt og fisk" },
  { name: "Pinnekjøtt", category: "Kjøtt og fisk" },
  { name: "Ribbe", category: "Kjøtt og fisk" },
  { name: "Spekeskinke", category: "Kjøtt og fisk" },
  { name: "Salami", category: "Kjøtt og fisk" },
  { name: "Servelat", category: "Kjøtt og fisk" },
  { name: "Leverpostei", category: "Kjøtt og fisk" },
  { name: "Røkt laks", category: "Kjøtt og fisk" },
  { name: "Ørret", category: "Kjøtt og fisk" },
  { name: "Sei", category: "Kjøtt og fisk" },
  { name: "Hyse", category: "Kjøtt og fisk" },
  { name: "Makrell", category: "Kjøtt og fisk" },
  { name: "Sild", category: "Kjøtt og fisk" },
  { name: "Fiskeboller", category: "Kjøtt og fisk" },
  { name: "Fiskepinner", category: "Kjøtt og fisk" },
  { name: "Fiskegrateng", category: "Kjøtt og fisk" },
  { name: "Krabbe", category: "Kjøtt og fisk" },
  { name: "Blåskjell", category: "Kjøtt og fisk" },
  { name: "Scampi", category: "Kjøtt og fisk" },
  { name: "Brunt sukker", category: "Ingredienser og krydder" },
  { name: "Melis", category: "Ingredienser og krydder" },
  { name: "Vaniljesukker", category: "Ingredienser og krydder" },
  { name: "Sammalt mel", category: "Ingredienser og krydder" },
  { name: "Maizena", category: "Ingredienser og krydder" },
  { name: "Bakepulver", category: "Ingredienser og krydder" },
  { name: "Natron", category: "Ingredienser og krydder" },
  { name: "Gjær", category: "Ingredienser og krydder" },
  { name: "Tørrgjær", category: "Ingredienser og krydder" },
  { name: "Rapsolje", category: "Ingredienser og krydder" },
  { name: "Solsikkeolje", category: "Ingredienser og krydder" },
  { name: "Eddik", category: "Ingredienser og krydder" },
  { name: "Balsamico", category: "Ingredienser og krydder" },
  { name: "Remulade", category: "Ingredienser og krydder" },
  { name: "Buljong", category: "Ingredienser og krydder" },
  { name: "Buljongterning", category: "Ingredienser og krydder" },
  { name: "Grønnsaksbuljong", category: "Ingredienser og krydder" },
  { name: "Kokosmelk", category: "Ingredienser og krydder" },
  { name: "Sirup", category: "Ingredienser og krydder" },
  { name: "Peanøttsmør", category: "Ingredienser og krydder" },
  { name: "Nugatti", category: "Ingredienser og krydder" },
  { name: "Jordbærsyltetøy", category: "Ingredienser og krydder" },
  { name: "Bringebærsyltetøy", category: "Ingredienser og krydder" },
  { name: "Marmelade", category: "Ingredienser og krydder" },
  { name: "Karri", category: "Ingredienser og krydder" },
  { name: "Paprikakrydder", category: "Ingredienser og krydder" },
  { name: "Chilipulver", category: "Ingredienser og krydder" },
  { name: "Kanel", category: "Ingredienser og krydder" },
  { name: "Kardemomme", category: "Ingredienser og krydder" },
  { name: "Muskat", category: "Ingredienser og krydder" },
  { name: "Gurkemeie", category: "Ingredienser og krydder" },
  { name: "Spisskummen", category: "Ingredienser og krydder" },
  { name: "Oregano", category: "Ingredienser og krydder" },
  { name: "Timian", category: "Ingredienser og krydder" },
  { name: "Rosmarin", category: "Ingredienser og krydder" },
  { name: "Laurbærblad", category: "Ingredienser og krydder" },
  { name: "Hvitløkspulver", category: "Ingredienser og krydder" },
  { name: "Tacokrydder", category: "Ingredienser og krydder" },
  { name: "Grillkrydder", category: "Ingredienser og krydder" },
  { name: "Bakekakao", category: "Ingredienser og krydder" },
  { name: "Sjokoladebiter", category: "Ingredienser og krydder" },
  { name: "Gelatin", category: "Ingredienser og krydder" },
  { name: "Vaniljeessens", category: "Ingredienser og krydder" },
  { name: "Mandler", category: "Ingredienser og krydder" },
  { name: "Valnøtter", category: "Ingredienser og krydder" },
  { name: "Hasselnøtter", category: "Ingredienser og krydder" },
  { name: "Cashewnøtter", category: "Ingredienser og krydder" },
  { name: "Pinjekjerner", category: "Ingredienser og krydder" },
  { name: "Rosiner", category: "Ingredienser og krydder" },
  { name: "Sesamfrø", category: "Ingredienser og krydder" },
  { name: "Solsikkefrø", category: "Ingredienser og krydder" },
  { name: "Gresskarkjerner", category: "Ingredienser og krydder" },
  { name: "Fond", category: "Ingredienser og krydder" },
  { name: "Frossenpizza", category: "Frysevarer og ferdigmåltid" },
  { name: "Lasagne", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne erter", category: "Frysevarer og ferdigmåltid" },
  { name: "Potetbåter", category: "Frysevarer og ferdigmåltid" },
  { name: "Løkringer", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen fisk", category: "Frysevarer og ferdigmåltid" },
  { name: "Vårruller", category: "Frysevarer og ferdigmåltid" },
  { name: "Wok grønnsaker", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne kjøttboller", category: "Frysevarer og ferdigmåltid" },
  { name: "Ferdigmiddag", category: "Frysevarer og ferdigmåltid" },
  { name: "Pai", category: "Frysevarer og ferdigmåltid" },
  { name: "Saftis", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen kylling", category: "Frysevarer og ferdigmåltid" },
  { name: "Pizzasnurrer", category: "Frysevarer og ferdigmåltid" },
  { name: "Pannekaker frosne", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen laks", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne reker", category: "Frysevarer og ferdigmåltid" },
  { name: "Potetlomper", category: "Frysevarer og ferdigmåltid" },
  { name: "Smoothie frosne bær", category: "Frysevarer og ferdigmåltid" },
  { name: "Fiskepinner frosne", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen pizza mini", category: "Frysevarer og ferdigmåltid" },
  { name: "Pølsedeig", category: "Frysevarer og ferdigmåltid" },
  { name: "Lettkokte havregryn", category: "Kornprodukter" },
  { name: "Frosties", category: "Kornprodukter" },
  { name: "Cheerios", category: "Kornprodukter" },
  { name: "Havrefras", category: "Kornprodukter" },
  { name: "Weetabix", category: "Kornprodukter" },
  { name: "Puffet ris", category: "Kornprodukter" },
  { name: "Jasminris", category: "Kornprodukter" },
  { name: "Basmatiris", category: "Kornprodukter" },
  { name: "Risgrøt", category: "Kornprodukter" },
  { name: "Grøtris", category: "Kornprodukter" },
  { name: "Penne", category: "Kornprodukter" },
  { name: "Fusilli", category: "Kornprodukter" },
  { name: "Lasagneplater", category: "Kornprodukter" },
  { name: "Tagliatelle", category: "Kornprodukter" },
  { name: "Bulgur", category: "Kornprodukter" },
  { name: "Quinoa", category: "Kornprodukter" },
  { name: "Byggryn", category: "Kornprodukter" },
  { name: "Røde linser", category: "Kornprodukter" },
  { name: "Sorte bønner", category: "Kornprodukter" },
  { name: "Kidneybønner", category: "Kornprodukter" },
  { name: "Polenta", category: "Kornprodukter" },
  { name: "Pannekakemix", category: "Kornprodukter" },
  { name: "Vaffelmix", category: "Kornprodukter" },
  { name: "Linser", category: "Kornprodukter" },
  { name: "Ostepop", category: "Snacks og godteri" },
  { name: "Saltstenger", category: "Snacks og godteri" },
  { name: "Nachos", category: "Snacks og godteri" },
  { name: "Dipp", category: "Snacks og godteri" },
  { name: "Salsa", category: "Snacks og godteri" },
  { name: "Guacamole", category: "Snacks og godteri" },
  { name: "Mørk sjokolade", category: "Snacks og godteri" },
  { name: "Kvikk Lunsj", category: "Snacks og godteri" },
  { name: "Smash", category: "Snacks og godteri" },
  { name: "Non Stop", category: "Snacks og godteri" },
  { name: "Twist", category: "Snacks og godteri" },
  { name: "Seigmenn", category: "Snacks og godteri" },
  { name: "Vingummi", category: "Snacks og godteri" },
  { name: "Lakris", category: "Snacks og godteri" },
  { name: "Pastiller", category: "Snacks og godteri" },
  { name: "Tyggegummi", category: "Snacks og godteri" },
  { name: "Digestive", category: "Snacks og godteri" },
  { name: "Marie kjeks", category: "Snacks og godteri" },
  { name: "Havrekjeks", category: "Snacks og godteri" },
  { name: "Sjokoladekjeks", category: "Snacks og godteri" },
  { name: "Snickers", category: "Snacks og godteri" },
  { name: "Kit Kat", category: "Snacks og godteri" },
  { name: "Daim", category: "Snacks og godteri" },
  { name: "Toblerone", category: "Snacks og godteri" },
  { name: "Saltlakris", category: "Snacks og godteri" },
  { name: "Chips", category: "Snacks og godteri" },
  { name: "Mineralvann", category: "Drikkevarer" },
  { name: "Cola Zero", category: "Drikkevarer" },
  { name: "Sprite", category: "Drikkevarer" },
  { name: "Fanta", category: "Drikkevarer" },
  { name: "Solo", category: "Drikkevarer" },
  { name: "Urge", category: "Drikkevarer" },
  { name: "Pepsi", category: "Drikkevarer" },
  { name: "Appelsinjuice", category: "Drikkevarer" },
  { name: "Multijuice", category: "Drikkevarer" },
  { name: "Solbærsaft", category: "Drikkevarer" },
  { name: "Eplemost", category: "Drikkevarer" },
  { name: "Iste", category: "Drikkevarer" },
  { name: "Filterkaffe", category: "Drikkevarer" },
  { name: "Kaffekapsler", category: "Drikkevarer" },
  { name: "Espresso", category: "Drikkevarer" },
  { name: "Grønn te", category: "Drikkevarer" },
  { name: "Svart te", category: "Drikkevarer" },
  { name: "Urtete", category: "Drikkevarer" },
  { name: "Kakaopulver", category: "Drikkevarer" },
  { name: "Energidrikk", category: "Drikkevarer" },
  { name: "Red Bull", category: "Drikkevarer" },
  { name: "Smoothie", category: "Drikkevarer" },
  { name: "Øl", category: "Drikkevarer" },
  { name: "Vin", category: "Drikkevarer" },
  { name: "Servietter", category: "Husholdning" },
  { name: "Oppvaskmaskinsalt", category: "Husholdning" },
  { name: "Tøymykner", category: "Husholdning" },
  { name: "Flekkfjerner", category: "Husholdning" },
  { name: "Klorin", category: "Husholdning" },
  { name: "Glassrengjøring", category: "Husholdning" },
  { name: "Toalettrens", category: "Husholdning" },
  { name: "Baderengjøring", category: "Husholdning" },
  { name: "Skurepulver", category: "Husholdning" },
  { name: "Oppvaskbørste", category: "Husholdning" },
  { name: "Oppvasksvamp", category: "Husholdning" },
  { name: "Kluter", category: "Husholdning" },
  { name: "Mikrofiberklut", category: "Husholdning" },
  { name: "Søppelposer", category: "Husholdning" },
  { name: "Fryseposer", category: "Husholdning" },
  { name: "Matpapir", category: "Husholdning" },
  { name: "Plastfolie", category: "Husholdning" },
  { name: "Lyspære", category: "Husholdning" },
  { name: "Batterier", category: "Husholdning" },
  { name: "Stearinlys", category: "Husholdning" },
  { name: "Telys", category: "Husholdning" },
  { name: "Fyrstikker", category: "Husholdning" },
  { name: "Gulvmopp", category: "Husholdning" },
  { name: "Luftfrisker", category: "Husholdning" },
  { name: "Vaskepulver", category: "Husholdning" },
  { name: "Skyllemiddel", category: "Husholdning" },
  { name: "Grønnsåpe", category: "Husholdning" },
  { name: "Tannpirker", category: "Husholdning" },
  { name: "Tape", category: "Husholdning" },
  { name: "Klesklyper", category: "Husholdning" },
  { name: "Zip poser", category: "Husholdning" },
  { name: "Håndsåpe kjøkken", category: "Husholdning" },
  { name: "Støvkluter", category: "Husholdning" },
  { name: "Vaskeklut", category: "Husholdning" },
  { name: "Bleier", category: "Omsorg og helse" },
  { name: "Bleier størrelse 4", category: "Omsorg og helse" },
  { name: "Bleier størrelse 5", category: "Omsorg og helse" },
  { name: "Våtservietter", category: "Omsorg og helse" },
  { name: "Barnemat", category: "Omsorg og helse" },
  { name: "Barnegrøt", category: "Omsorg og helse" },
  { name: "Velling", category: "Omsorg og helse" },
  { name: "Morsmelkerstatning", category: "Omsorg og helse" },
  { name: "Smokk", category: "Omsorg og helse" },
  { name: "Tåteflaske", category: "Omsorg og helse" },
  { name: "Bæsjposer", category: "Omsorg og helse" },
  { name: "Babyolje", category: "Omsorg og helse" },
  { name: "Babykrem", category: "Omsorg og helse" },
  { name: "Vaselin", category: "Omsorg og helse" },
  { name: "Solkrem", category: "Omsorg og helse" },
  { name: "Solkrem barn", category: "Omsorg og helse" },
  { name: "Myggspray", category: "Omsorg og helse" },
  { name: "Bandasje", category: "Omsorg og helse" },
  { name: "Sårsalve", category: "Omsorg og helse" },
  { name: "Antibac", category: "Omsorg og helse" },
  { name: "Munnbind", category: "Omsorg og helse" },
  { name: "Paracet", category: "Omsorg og helse" },
  { name: "Ibux", category: "Omsorg og helse" },
  { name: "Paracetamol barn", category: "Omsorg og helse" },
  { name: "Nesespray", category: "Omsorg og helse" },
  { name: "Halstabletter", category: "Omsorg og helse" },
  { name: "Hostesaft", category: "Omsorg og helse" },
  { name: "Termometer", category: "Omsorg og helse" },
  { name: "Bomullspinner", category: "Omsorg og helse" },
  { name: "Tannbørste barn", category: "Omsorg og helse" },
  { name: "Tannkrem barn", category: "Omsorg og helse" },
  { name: "Tanntråd", category: "Omsorg og helse" },
  { name: "Munnskyll", category: "Omsorg og helse" },
  { name: "Sjampo barn", category: "Omsorg og helse" },
  { name: "Balsam", category: "Omsorg og helse" },
  { name: "Deodorant", category: "Omsorg og helse" },
  { name: "Barberskum", category: "Omsorg og helse" },
  { name: "Barberblader", category: "Omsorg og helse" },
  { name: "Bind", category: "Omsorg og helse" },
  { name: "Tamponger", category: "Omsorg og helse" },
  { name: "Truseinnlegg", category: "Omsorg og helse" },
  { name: "Fuktighetskrem", category: "Omsorg og helse" },
  { name: "Q-tips", category: "Omsorg og helse" },
  { name: "Vitaminer", category: "Omsorg og helse" },
  { name: "Tran", category: "Omsorg og helse" },
  { name: "Multivitamin barn", category: "Omsorg og helse" },
  { name: "Kattemat våt", category: "Dyreprodukter" },
  { name: "Kattemat tørr", category: "Dyreprodukter" },
  { name: "Kattesand", category: "Dyreprodukter" },
  { name: "Kattegodteri", category: "Dyreprodukter" },
  { name: "Hundemat våt", category: "Dyreprodukter" },
  { name: "Hundemat tørr", category: "Dyreprodukter" },
  { name: "Hundegodteri", category: "Dyreprodukter" },
  { name: "Tyggebein", category: "Dyreprodukter" },
  { name: "Fuglefrø", category: "Dyreprodukter" },
  { name: "Fiskefôr", category: "Dyreprodukter" },
  { name: "Kaninmat", category: "Dyreprodukter" },
  { name: "Dyreleker", category: "Dyreprodukter" },
  { name: "Bæsjeposer hund", category: "Dyreprodukter" },
  { name: "Gavepapir", category: "Annet" },
  { name: "Gavebånd", category: "Annet" },
  { name: "Bursdagslys", category: "Annet" },
  { name: "Ballonger", category: "Annet" },
  { name: "Servietter fest", category: "Annet" },
  { name: "Engangsbestikk", category: "Annet" },
  { name: "Engangstallerken", category: "Annet" },
  { name: "Plastkopper", category: "Annet" },
  { name: "Sugerør", category: "Annet" },
  { name: "Grillkull", category: "Annet" },
  { name: "Tennvæske", category: "Annet" },
  { name: "Potteplante", category: "Annet" },
  { name: "Jord", category: "Annet" },
  { name: "Frø", category: "Annet" },
  { name: "Kirsebær", category: "Frukt og grønt" },
  { name: "Søtkirsebær", category: "Frukt og grønt" },
  { name: "Stikkelsbær", category: "Frukt og grønt" },
  { name: "Tranebær", category: "Frukt og grønt" },
  { name: "Fiken", category: "Frukt og grønt" },
  { name: "Dadler", category: "Frukt og grønt" },
  { name: "Litchi", category: "Frukt og grønt" },
  { name: "Papaya", category: "Frukt og grønt" },
  { name: "Physalis", category: "Frukt og grønt" },
  { name: "Mirabelle", category: "Frukt og grønt" },
  { name: "Kaki", category: "Frukt og grønt" },
  { name: "Fennikel", category: "Frukt og grønt" },
  { name: "Artisjokk", category: "Frukt og grønt" },
  { name: "Pak choi", category: "Frukt og grønt" },
  { name: "Mangold", category: "Frukt og grønt" },
  { name: "Friséesalat", category: "Frukt og grønt" },
  { name: "Romansalat", category: "Frukt og grønt" },
  { name: "Vårsalat", category: "Frukt og grønt" },
  { name: "Selleriknoll", category: "Frukt og grønt" },
  { name: "Nepe", category: "Frukt og grønt" },
  { name: "Estragon", category: "Frukt og grønt" },
  { name: "Salvie", category: "Frukt og grønt" },
  { name: "Karse", category: "Frukt og grønt" },
  { name: "Sjalottløk", category: "Frukt og grønt" },
  { name: "Rugbrød", category: "Brød og bakevarer" },
  { name: "Flatbrød", category: "Brød og bakevarer" },
  { name: "Lompe", category: "Brød og bakevarer" },
  { name: "Grissini", category: "Brød og bakevarer" },
  { name: "Bagel", category: "Brød og bakevarer" },
  { name: "Müslibrød", category: "Brød og bakevarer" },
  { name: "Solsikkebrød", category: "Brød og bakevarer" },
  { name: "Steinbakt brød", category: "Brød og bakevarer" },
  { name: "Lavkarbobrød", category: "Brød og bakevarer" },
  { name: "Glutenfritt brød", category: "Brød og bakevarer" },
  { name: "Wienerbrød", category: "Brød og bakevarer" },
  { name: "Mascarpone", category: "Meieriprodukter" },
  { name: "Ricotta", category: "Meieriprodukter" },
  { name: "Halloumi", category: "Meieriprodukter" },
  { name: "Geitost", category: "Meieriprodukter" },
  { name: "Pultost", category: "Meieriprodukter" },
  { name: "Havremelk", category: "Meieriprodukter" },
  { name: "Mandelmelk", category: "Meieriprodukter" },
  { name: "Soyamelk", category: "Meieriprodukter" },
  { name: "Vegansk ost", category: "Meieriprodukter" },
  { name: "Vegansk yoghurt", category: "Meieriprodukter" },
  { name: "Vegansk rømme", category: "Meieriprodukter" },
  { name: "Kalvekjøtt", category: "Kjøtt og fisk" },
  { name: "Elgkjøtt", category: "Kjøtt og fisk" },
  { name: "Reinsdyrkjøtt", category: "Kjøtt og fisk" },
  { name: "Andebryst", category: "Kjøtt og fisk" },
  { name: "Kanin", category: "Kjøtt og fisk" },
  { name: "Geitekjøtt", category: "Kjøtt og fisk" },
  { name: "Lammekoteletter", category: "Kjøtt og fisk" },
  { name: "Chorizo", category: "Kjøtt og fisk" },
  { name: "Pepperoni", category: "Kjøtt og fisk" },
  { name: "Prosciutto", category: "Kjøtt og fisk" },
  { name: "Parmaskinke", category: "Kjøtt og fisk" },
  { name: "Kyllingpålegg", category: "Kjøtt og fisk" },
  { name: "Kalkunpålegg", category: "Kjøtt og fisk" },
  { name: "Makrell i tomat", category: "Kjøtt og fisk" },
  { name: "Ansjos", category: "Kjøtt og fisk" },
  { name: "Kaviar", category: "Kjøtt og fisk" },
  { name: "Krabbeklør", category: "Kjøtt og fisk" },
  { name: "Hummer", category: "Kjøtt og fisk" },
  { name: "Østers", category: "Kjøtt og fisk" },
  { name: "Pangasius", category: "Kjøtt og fisk" },
  { name: "Steinbit", category: "Kjøtt og fisk" },
  { name: "Breiflabb", category: "Kjøtt og fisk" },
  { name: "Tofu", category: "Kjøtt og fisk" },
  { name: "Tempeh", category: "Kjøtt og fisk" },
  { name: "Vegankjøttdeig", category: "Kjøtt og fisk" },
  { name: "Falafel", category: "Kjøtt og fisk" },
  { name: "Cayennepepper", category: "Ingredienser og krydder" },
  { name: "Chiliflak", category: "Ingredienser og krydder" },
  { name: "Sambal Oelek", category: "Ingredienser og krydder" },
  { name: "Sweet chili saus", category: "Ingredienser og krydder" },
  { name: "BBQ saus", category: "Ingredienser og krydder" },
  { name: "Pesto", category: "Ingredienser og krydder" },
  { name: "Worcestershiresaus", category: "Ingredienser og krydder" },
  { name: "Fiskesaus", category: "Ingredienser og krydder" },
  { name: "Østerssaus", category: "Ingredienser og krydder" },
  { name: "Hoisinsaus", category: "Ingredienser og krydder" },
  { name: "Sriracha", category: "Ingredienser og krydder" },
  { name: "Tabasco", category: "Ingredienser og krydder" },
  { name: "Vaniljestang", category: "Ingredienser og krydder" },
  { name: "Safran", category: "Ingredienser og krydder" },
  { name: "Anis", category: "Ingredienser og krydder" },
  { name: "Fennikelfrø", category: "Ingredienser og krydder" },
  { name: "Korianderfrø", category: "Ingredienser og krydder" },
  { name: "Sennepsfrø", category: "Ingredienser og krydder" },
  { name: "Karvefrø", category: "Ingredienser og krydder" },
  { name: "Stjerneanis", category: "Ingredienser og krydder" },
  { name: "Nellik", category: "Ingredienser og krydder" },
  { name: "Hvit pepper", category: "Ingredienser og krydder" },
  { name: "Rødvinseddik", category: "Ingredienser og krydder" },
  { name: "Hvitvinseddik", category: "Ingredienser og krydder" },
  { name: "Kokosolje", category: "Ingredienser og krydder" },
  { name: "Sesamolje", category: "Ingredienser og krydder" },
  { name: "Agavesirup", category: "Ingredienser og krydder" },
  { name: "Lønnesirup", category: "Ingredienser og krydder" },
  { name: "Stevia", category: "Ingredienser og krydder" },
  { name: "Mandelmel", category: "Ingredienser og krydder" },
  { name: "Kokosmel", category: "Ingredienser og krydder" },
  { name: "Hampfrø", category: "Ingredienser og krydder" },
  { name: "Chiafrø", category: "Ingredienser og krydder" },
  { name: "Linfrø", category: "Ingredienser og krydder" },
  { name: "Peanøtter", category: "Ingredienser og krydder" },
  { name: "Pistasjnøtter", category: "Ingredienser og krydder" },
  { name: "Macadamianøtter", category: "Ingredienser og krydder" },
  { name: "Tørkede aprikoser", category: "Ingredienser og krydder" },
  { name: "Tørkede fiken", category: "Ingredienser og krydder" },
  { name: "Tørkede dadler", category: "Ingredienser og krydder" },
  { name: "Tørkede tranebær", category: "Ingredienser og krydder" },
  { name: "Is på pinne", category: "Frysevarer og ferdigmåltid" },
  { name: "Softis", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne bønner", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen blomkål", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen brokkoli", category: "Frysevarer og ferdigmåltid" },
  { name: "Iskake", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne croissanter", category: "Frysevarer og ferdigmåltid" },
  { name: "Frossen mango", category: "Frysevarer og ferdigmåltid" },
  { name: "Havremel", category: "Kornprodukter" },
  { name: "Bygg", category: "Kornprodukter" },
  { name: "Spelt", category: "Kornprodukter" },
  { name: "Rug", category: "Kornprodukter" },
  { name: "Müslibarer", category: "Kornprodukter" },
  { name: "Soyabønner", category: "Kornprodukter" },
  { name: "Edamame", category: "Kornprodukter" },
  { name: "Hirse", category: "Kornprodukter" },
  { name: "Risnudler", category: "Kornprodukter" },
  { name: "Eggnudler", category: "Kornprodukter" },
  { name: "Glassnudler", category: "Kornprodukter" },
  { name: "Udonnudler", category: "Kornprodukter" },
  { name: "Ramen", category: "Kornprodukter" },
  { name: "Twix", category: "Snacks og godteri" },
  { name: "Mars", category: "Snacks og godteri" },
  { name: "Bounty", category: "Snacks og godteri" },
  { name: "Maltesers", category: "Snacks og godteri" },
  { name: "Skumgodteri", category: "Snacks og godteri" },
  { name: "Marshmallows", category: "Snacks og godteri" },
  { name: "Lakrisrull", category: "Snacks og godteri" },
  { name: "Smågodt", category: "Snacks og godteri" },
  { name: "Proteinbar", category: "Snacks og godteri" },
  { name: "Sportsdrikk", category: "Drikkevarer" },
  { name: "Kombucha", category: "Drikkevarer" },
  { name: "Iskaffe", category: "Drikkevarer" },
  { name: "Most", category: "Drikkevarer" },
  { name: "Druejuice", category: "Drikkevarer" },
  { name: "Tranebærjuice", category: "Drikkevarer" },
  { name: "Ananasjuice", category: "Drikkevarer" },
  { name: "Mangojuice", category: "Drikkevarer" },
  { name: "Sider", category: "Drikkevarer" },
  { name: "Alkoholfritt øl", category: "Drikkevarer" },
  { name: "Matboks", category: "Husholdning" },
  { name: "Termos", category: "Husholdning" },
  { name: "Drikkeflaske", category: "Husholdning" },
  { name: "Avkalkningsmiddel", category: "Husholdning" },
  { name: "Finvask", category: "Husholdning" },
  { name: "Silikonform", category: "Husholdning" },
  { name: "Bakeform", category: "Husholdning" },
  { name: "Engangshansker", category: "Husholdning" },
  { name: "Gummihansker", category: "Husholdning" },
  { name: "Kost", category: "Husholdning" },
  { name: "Feiebrett", category: "Husholdning" },
  { name: "Vindusvisker", category: "Husholdning" },
  { name: "Toalettbørste", category: "Husholdning" },
  { name: "Møllmiddel", category: "Husholdning" },
  { name: "Insektspray", category: "Husholdning" },
  { name: "Sikringer", category: "Husholdning" },
  { name: "Forlengerledning", category: "Husholdning" },
  { name: "Vitamin D", category: "Omsorg og helse" },
  { name: "Magnesium", category: "Omsorg og helse" },
  { name: "Probiotika", category: "Omsorg og helse" },
  { name: "Jerntilskudd", category: "Omsorg og helse" },
  { name: "Allergitabletter", category: "Omsorg og helse" },
  { name: "Øyedrops", category: "Omsorg og helse" },
  { name: "Nesedrops", category: "Omsorg og helse" },
  { name: "Kompresser", category: "Omsorg og helse" },
  { name: "Sportstape", category: "Omsorg og helse" },
  { name: "Kuldepose", category: "Omsorg og helse" },
  { name: "Varmepute", category: "Omsorg og helse" },
  { name: "Graviditetstest", category: "Omsorg og helse" },
  { name: "Kondomer", category: "Omsorg og helse" },
  { name: "Menstruasjonskopp", category: "Omsorg og helse" },
  { name: "Intimvask", category: "Omsorg og helse" },
  { name: "Rakekrem", category: "Omsorg og helse" },
  { name: "Hårfjerningskrem", category: "Omsorg og helse" },
  { name: "Hårspray", category: "Omsorg og helse" },
  { name: "Hårgele", category: "Omsorg og helse" },
  { name: "Leppepomade", category: "Omsorg og helse" },
  { name: "Negleklipper", category: "Omsorg og helse" },
  { name: "Pinsett", category: "Omsorg og helse" },
  { name: "Hamstermat", category: "Dyreprodukter" },
  { name: "Marsvinmat", category: "Dyreprodukter" },
  { name: "Lim", category: "Annet" },
  { name: "Saks", category: "Annet" },
  { name: "Penn", category: "Annet" },
  { name: "Notatbok", category: "Annet" },
  { name: "Konvolutter", category: "Annet" },
  { name: "Gjødsel", category: "Annet" }
];

// Creates a new list, seeded with COMMON_ITEMS. Shared by /admin/owners,
// /register, and /auth/google so "what a brand-new list looks like" only
// exists in one place. `name` is an optional household display name
// (lists.name); omitted/undefined for the admin-driven paths, which don't
// collect one.
async function createList(env, name) {
  const list = await env.DB.prepare(
    "INSERT INTO lists (name) VALUES (?1) RETURNING id"
  ).bind(name || null).first();
  const listId = list.id;
  await env.DB.batch(COMMON_ITEMS.map(it =>
    env.DB.prepare("INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)")
      .bind(it.name, it.category, listId)
  ));
  return listId;
}

// ---------- JWT helpers (HS256, no external deps) ----------
export function b64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Encode via UTF-8 bytes so payloads with non-ASCII characters (e.g. a
// username with æ/ø/å) don't make btoa throw.
export function b64urlStr(str) {
  return b64url(new TextEncoder().encode(str));
}
export function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
// Constant-time string comparison so a JWT signature check can't be probed
// byte-by-byte via response timing.
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}
export async function signJwt(payload, secret) {
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlStr(JSON.stringify(payload));
  const sig = await hmac(secret, `${header}.${body}`);
  return `${header}.${body}.${sig}`;
}
export async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = await hmac(secret, `${header}.${body}`);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ---------- password hashing (PBKDF2 via Web Crypto) ----------
const PBKDF2_ITER = 100000;
// A well-formed but unmatchable hash. Verified against this when the supplied
// username doesn't exist, so login spends the same PBKDF2 time either way and
// can't be used to enumerate valid usernames by response latency.
const DUMMY_PASS_HASH =
  "100000:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export async function hashPassword(password, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    keyMaterial, 256
  );
  const hashB64 = b64url(bits);
  const saltB64 = b64url(salt.buffer);
  return `${PBKDF2_ITER}:${saltB64}:${hashB64}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [iterStr, saltB64, hashB64] = stored.split(":");
    const iterations = parseInt(iterStr, 10);
    const salt = Uint8Array.from(atob(saltB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial, 256
    );
    return b64url(bits) === hashB64;
  } catch { return false; }
}

// Generates a short, human-readable random password for admin/owner-created
// accounts. Charset omits visually ambiguous characters (0/O, 1/l/I) since
// these are read off a screen and retyped by hand. ~12 chars, grouped
// xxxx-xxxx-xxxx. Rejection sampling avoids modulo bias. No external deps.
export function genPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const len = 12;
  const max = Math.floor(256 / charset.length) * charset.length;
  const out = [];
  while (out.length < len) {
    const buf = crypto.getRandomValues(new Uint8Array(len));
    for (const b of buf) {
      if (b < max) out.push(charset[b % charset.length]);
      if (out.length === len) break;
    }
  }
  return out.join("").replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
}

// Cheap format check shared by /register and /change-email — not RFC-strict,
// just enough to reject obvious garbage before it hits the DB/Resend.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

// Cleans a free-typed display name (Settings, signup, admin/owner creation):
// trims, collapses internal whitespace, caps length. Unlike capitalizeName
// (catalogue items), a person's name isn't force-capitalized — nicknames/
// casing like "iPhone-Ola" should survive as typed. Returns "" if blank.
export function sanitizeDisplayName(name) {
  return (name || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

// Recognises a gluten-free marker (GF / gf / glutenfri / glutenfritt) typed as
// part of an item name and reports it so the caller can lift it into the notes:
// "Pasta GF" becomes name "Pasta" + note "GF". The cleaned name still resolves
// to the normal catalogue entry, so a plain "Pasta" and a "Pasta" + "GF" note
// share the same catalogue row but stay distinct list lines (the add path's
// merge check is notes-aware). If the marker is the entire input (e.g. just
// "GF"), it's left untouched — there's no item name to attach it to.
export function extractGlutenFree(name) {
  let gf = false;
  const cleaned = (name || "")
    .replace(/\b(gf|glutenfri|glutenfritt)\b/gi, () => { gf = true; return " "; })
    .replace(/\s+/g, " ")
    .trim();
  if (!gf || !cleaned) return { name: (name || "").trim(), gf: false };
  return { name: cleaned, gf: true };
}

// Upper-cases the first character of an item/catalogue name so stored names are
// always capitalised ("brød" -> "Brød"), leaving the rest as typed (proper
// nouns, acronyms and casing like "7 Up" survive). Applied wherever a catalogue
// name is created or renamed; the frontend mirrors it at display time.
export function capitalizeName(name) {
  const s = (name || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Cleans a free-form labels array for storage on meal_catalogue: trims each,
// drops blanks, capitalises like capitalizeName, and dedupes case-insensitively
// (keeping the first-seen casing) so "vegetar" and "Vegetar" don't both stick.
export function sanitizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of labels) {
    const clean = capitalizeName(typeof raw === "string" ? raw : "");
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

// ---------- response helpers ----------
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", ...extra }
  });

// Parses a JSON request body, returning null on empty/malformed input so
// callers can answer 400 instead of throwing an opaque 500.
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Verifies JWT signature/expiry AND that token_version matches the DB. Returns
// the live user row (flags + list_id) — the DB is the source of truth on every
// request, so any change to a user's flags/list_id/token_version takes effect
// on their next call (the JWT's copies are only client-display hints).
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  const row = await env.DB.prepare(
    "SELECT username, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
  ).bind(payload.sub).first();
  if (!row) return null;
  if (payload.tv !== row.token_version) return null;
  return row;
}

// Mints a 90-day token from a user row. list_id/is_admin/is_owner are carried
// for the client's convenience; the server always re-reads them from the DB.
async function mintToken(u, env) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90;
  return await signJwt({
    sub: u.username, tv: u.token_version,
    list_id: u.list_id, is_admin: u.is_admin, is_owner: u.is_owner, exp
  }, env.JWT_SECRET);
}

// Username is a by-value copy — not a foreign key — inside list_items.added_by,
// meal_plan.responsible, recurring_schedule.responsible, users.created_by, and
// password_resets.username (see TODO #17), so renaming it means updating
// every one of those alongside the users row itself, in one batch so they
// can't drift apart. Callers must mint a fresh token afterward — the caller's
// existing JWT's `sub` now points at a row that no longer exists.
async function renameUsername(env, oldUsername, newUsername) {
  await env.DB.batch([
    env.DB.prepare("UPDATE list_items SET added_by = ?1 WHERE added_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE meal_plan SET responsible = ?1 WHERE responsible = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE recurring_schedule SET responsible = ?1 WHERE responsible = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE users SET created_by = ?1 WHERE created_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE password_resets SET username = ?1 WHERE username = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE users SET username = ?1, email = ?1 WHERE username = ?2 COLLATE NOCASE").bind(newUsername, oldUsername),
  ]);
}

// Site-wide metrics (across every list) are gated beyond ordinary is_admin
// (which is deliberately per-list) via this env var — a comma-separated
// allowlist of usernames, set as a Worker dashboard variable alongside
// JWT_SECRET, never committed.
export function isSuperAdmin(username, env) {
  const allowed = (env.SUPERADMIN_USERNAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes((username || "").toLowerCase());
}

// Builds the same {token, user, is_admin, is_owner, list_id, is_superadmin}
// shape that /login, /register, /reset-password, and /auth/google all return,
// so the frontend has one response shape to store regardless of which path
// authenticated the user.
async function authResponse(row, env) {
  const token = await mintToken(row, env);
  return {
    token, user: row.username, name: row.name || row.username,
    is_admin: row.is_admin, is_owner: row.is_owner, list_id: row.list_id,
    is_superadmin: isSuperAdmin(row.username, env),
  };
}

// ---------- abuse protection for public signup/recovery endpoints ----------
// Generalizes login_attempts' delete-expired-then-count pattern (IP-keyed,
// opportunistic cleanup, no cron) across multiple independent endpoints via a
// `kind` discriminator, so /register and /forgot-password each get their own
// window/threshold without a near-duplicate table per endpoint.
const RATE_LIMITS = {
  register: { windowMs: 60 * 60 * 1000, max: 8 },        // 8/hour/IP
  forgot_password: { windowMs: 60 * 60 * 1000, max: 5 }, // 5/hour/IP
  feedback: { windowMs: 60 * 60 * 1000, max: 5 },        // 5/hour/IP
};
async function checkRateLimit(env, ip, kind) {
  const { windowMs, max } = RATE_LIMITS[kind];
  const windowStart = Date.now() - windowMs;
  await env.DB.prepare("DELETE FROM rate_limit_attempts WHERE kind = ?1 AND created_at < ?2")
    .bind(kind, windowStart).run();
  const { attempts } = await env.DB.prepare(
    "SELECT COUNT(*) AS attempts FROM rate_limit_attempts WHERE kind = ?1 AND ip = ?2 AND created_at >= ?3"
  ).bind(kind, ip, windowStart).first();
  return attempts < max;
}
async function recordAttempt(env, ip, kind) {
  await env.DB.prepare("INSERT INTO rate_limit_attempts (ip, kind, created_at) VALUES (?1, ?2, ?3)")
    .bind(ip, kind, Date.now()).run();
}

// ---------- Cloudflare Turnstile verification ----------
async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY || "", response: token, remoteip: ip });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = await res.json();
    return data.success === true;
  } catch { return false; }
}

// Every other sendEmail() call so far only interpolates fixed URLs/usernames
// (already sanitized elsewhere) into the HTML body — /feedback is the first
// to embed real free-text user input, so it needs this to avoid the email
// client rendering stray HTML the sender typed.
export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- transactional email (Resend) ----------
// Update once a sending domain is verified in Resend's dashboard (manual,
// one-time — see CLAUDE.md/the signup feature's PR description).
const EMAIL_FROM = "Panhandle <noreply@shopping.mohibb.com>";
async function sendEmail(env, { to, subject, html, replyTo }) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: [replyTo] } : {}) }),
    });
    if (!res.ok) console.error("Resend send failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend fetch threw", e);
    return false;
  }
}

async function sha256Hex(str) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------- "Sign in with Google" ID token verification ----------
// Public by nature (shipped in frontend JS), so it's hardcoded like other
// public config (API_BASE, pagesUrl.hostname) rather than routed through env.
const GOOGLE_CLIENT_ID = "148854883648-86vjm8s2ihc50pjl9sj4t0nj0pe98dh3.apps.googleusercontent.com";

let googleJwksCache = null;
async function getGoogleJwks() {
  if (googleJwksCache) return googleJwksCache;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  googleJwksCache = await res.json();
  return googleJwksCache;
}

// Verifies a Google Identity Services ID token entirely by hand (RS256, via
// Web Crypto), the same no-external-deps ethos as this file's own HS256
// signJwt/verifyJwt — just someone else's keys instead of our own secret.
// Returns the decoded payload (with a verified email) or null.
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(headerB64));
    payload = JSON.parse(b64urlDecode(bodyB64));
  } catch { return null; }

  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  if (payload.aud !== GOOGLE_CLIENT_ID) return null;
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") return null;
  if (!payload.email || payload.email_verified !== true) return null;

  const jwks = await getGoogleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const signedData = new TextEncoder().encode(`${headerB64}.${bodyB64}`);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sigBytes, signedData);
    return ok ? payload : null;
  } catch { return null; }
}

// ---------- main ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ===== ROUTING =====
    const isApi = url.pathname.startsWith("/api");
    if (!isApi) {
      const pagesUrl = new URL(request.url);
      pagesUrl.hostname = "panhandle-ecj.pages.dev";
      return fetch(new Request(pagesUrl.toString(), request));
    }

    const path = url.pathname.replace(/^\/api/, "");

    // ===== VERSION (public, unauthenticated) =====
    // Cheap deploy-confirmation probe: lets the frontend (and a curl) read the
    // live Worker version without a token.
    if (path === "/version" && method === "GET") {
      return json({ version: VERSION });
    }

    // ===== LOGIN =====
    if (path === "/login" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      // Opportunistic cleanup, same pattern as /plan's meal_plan pruning:
      // drop attempts outside the window on every login, no cron needed.
      await env.DB.prepare("DELETE FROM login_attempts WHERE created_at < ?1").bind(windowStart).run();
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return json({ error: "For mange innloggingsforsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { username, password } = body;
      const row = await env.DB.prepare(
        "SELECT username, name, pass_hash, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind((username || "").trim()).first();
      // Always run the PBKDF2 check (against a dummy hash for unknown users) so
      // login latency doesn't reveal whether a username exists.
      const ok = await verifyPassword(password || "", row ? row.pass_hash : DUMMY_PASS_HASH);
      if (!row || !ok) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        return json({ error: "Feil e-post eller passord" }, 401);
      }
      return json(await authResponse(row, env));
    }

    // ===== REGISTER (public, self-service signup) =====
    // Creates a brand-new household: a fresh list (optionally named) plus its
    // first owner account. Open to anyone — gated by Turnstile + an IP rate
    // limit instead of an invite code, since any signed-up member of an
    // existing household is added by its owner via POST /list-users instead.
    if (path === "/register" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "register"))) {
        return json({ error: "For mange registreringsforsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      // Recorded regardless of outcome below: account-creation *volume* is the
      // abuse vector here, not just guessing (unlike login_attempts, which
      // only counts failures).
      await recordAttempt(env, ip, "register");

      // Cheap local validation first, before spending Turnstile's external
      // round-trip on a request that was going to be rejected anyway. Username
      // is always the e-mail (see TODO #17) — there's no separate username
      // field to collect.
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return json({ error: "Skriv inn et navn" }, 400);
      if (!body.password || body.password.length < 8) {
        return json({ error: "Passord må være minst 8 tegn" }, 400);
      }
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return json({ error: "Ugyldig e-post" }, 400);
      }
      if (!(await verifyTurnstile(body.turnstile_token, ip, env))) {
        return json({ error: "Bot-verifisering feilet" }, 403);
      }
      const existingEmail = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (existingEmail) return json({ error: "E-posten er allerede i bruk" }, 409);

      const hash = await hashPassword(body.password);
      const listId = await createList(env, (body.list_name || "").trim() || null);
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 1, ?3, 'self-register', ?4, ?5)"
      ).bind(cleanEmail, hash, listId, cleanEmail, cleanName).run();
      const row = { username: cleanEmail, name: cleanName, token_version: 1, is_admin: 0, is_owner: 1, list_id: listId };
      return json(await authResponse(row, env));
    }

    // ===== SIGN IN WITH GOOGLE (public) =====
    // Accepts the ID-token JWT from Google's client-side sign-in button.
    // Logs in an existing account (matched by google_sub, or by email if this
    // is that account's first time using Google), or creates a brand-new
    // household the same way /register does. Google's own sign-in flow is
    // already strong bot resistance, so account creation here skips Turnstile
    // but still shares /register's rate-limit bucket.
    if (path === "/auth/google" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const payload = await verifyGoogleIdToken(body.credential);
      if (!payload) return json({ error: "Google-innlogging feilet" }, 401);
      const email = payload.email.toLowerCase();

      let row = await env.DB.prepare(
        "SELECT username, name, token_version, is_admin, is_owner, list_id FROM users WHERE google_sub = ?1"
      ).bind(payload.sub).first();

      if (!row) {
        row = await env.DB.prepare(
          "SELECT username, name, token_version, is_admin, is_owner, list_id FROM users WHERE email = ?1 COLLATE NOCASE"
        ).bind(email).first();
        if (row) {
          // First time this existing (password) account signs in with Google —
          // link it so future Google sign-ins match directly by google_sub.
          await env.DB.prepare("UPDATE users SET google_sub = ?1 WHERE username = ?2 COLLATE NOCASE")
            .bind(payload.sub, row.username).run();
          // Seed the display name from Google once, only if the account
          // doesn't already have one — never overwrites a local edit.
          if (!row.name && payload.name) {
            const seeded = sanitizeDisplayName(payload.name);
            if (seeded) {
              await env.DB.prepare("UPDATE users SET name = ?1 WHERE username = ?2 COLLATE NOCASE")
                .bind(seeded, row.username).run();
              row.name = seeded;
            }
          }
        }
      }

      if (!row) {
        if (!(await checkRateLimit(env, ip, "register"))) {
          return json({ error: "For mange registreringsforsøk. Prøv igjen senere." }, 429);
        }
        await recordAttempt(env, ip, "register");
        // Username is always the e-mail (see TODO #17) — email is already
        // guaranteed fresh here (no row matched google_sub or email above),
        // so there's no clash to resolve like the old local-part-derived
        // username needed.
        const displayName = sanitizeDisplayName(payload.name) || email.split("@")[0];
        // No password is ever handed to the user for a Google-only account —
        // stored as a hash of unknown random bytes so /login always fails
        // safely until they run /forgot-password on this same verified email.
        const hash = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
        const listId = await createList(env, (body.list_name || "").trim() || null);
        await env.DB.prepare(
          "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, google_sub, name) VALUES (?1, ?2, 1, 0, 1, ?3, 'google', ?4, ?5, ?6)"
        ).bind(email, hash, listId, email, payload.sub, displayName).run();
        row = { username: email, name: displayName, token_version: 1, is_admin: 0, is_owner: 1, list_id: listId };
      }

      return json(await authResponse(row, env));
    }

    // ===== FORGOT PASSWORD (public) =====
    if (path === "/forgot-password" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "forgot_password"))) {
        return json({ error: "For mange forsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      await recordAttempt(env, ip, "forgot_password");

      if (!(await verifyTurnstile(body.turnstile_token, ip, env))) {
        return json({ error: "Bot-verifisering feilet" }, 403);
      }
      // Always the same response regardless of whether the email matched, so
      // this endpoint can't be used to enumerate registered addresses.
      const genericOk = json({ ok: true, message: "Hvis e-posten finnes, er en lenke sendt." });
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!cleanEmail) return genericOk;

      const row = await env.DB.prepare(
        "SELECT username FROM users WHERE email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (!row) return genericOk;

      const rawToken = b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const tokenHash = await sha256Hex(rawToken);
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO password_resets (username, token_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)"
      ).bind(row.username, tokenHash, now, now + 30 * 60 * 1000).run();

      const resetUrl = `https://shopping.mohibb.com/app.html?reset_token=${rawToken}`;
      await sendEmail(env, {
        to: cleanEmail,
        subject: "Tilbakestill passordet ditt - Panhandle",
        html: `<p>Klikk her for å tilbakestille passordet ditt (lenken er gyldig i 30 minutter):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p>`,
      });
      return genericOk;
    }

    // ===== RESET PASSWORD (public) =====
    if (path === "/reset-password" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "forgot_password"))) {
        return json({ error: "For mange forsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      if (!body.new_password || body.new_password.length < 8) {
        return json({ error: "Passord må være minst 8 tegn" }, 400);
      }
      if (!body.token) return json({ error: "Ugyldig eller utløpt lenke" }, 400);

      const tokenHash = await sha256Hex(body.token);
      const now = Date.now();
      const reset = await env.DB.prepare(
        "SELECT username FROM password_resets WHERE token_hash = ?1 AND expires_at > ?2"
      ).bind(tokenHash, now).first();
      if (!reset) return json({ error: "Ugyldig eller utløpt lenke" }, 400);

      const userRow = await env.DB.prepare(
        "SELECT username, name, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(reset.username).first();
      if (!userRow) return json({ error: "Fant ikke bruker" }, 404);

      const hash = await hashPassword(body.new_password);
      const newVersion = userRow.token_version + 1;
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = ?2 WHERE username = ?3 COLLATE NOCASE"
      ).bind(hash, newVersion, userRow.username).run();
      // Invalidate every outstanding reset token for this user, not just the
      // one just used, so an older emailed link can't also be redeemed later.
      await env.DB.prepare("DELETE FROM password_resets WHERE username = ?1").bind(userRow.username).run();

      return json(await authResponse({ ...userRow, token_version: newVersion }, env));
    }

    // ===== AUTH REQUIRED BELOW =====
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Ikke autorisert" }, 401);
    const freshToken = await mintToken(user, env);
    // Sliding expiry: every authenticated response carries a freshly-minted
    // token so the session is extended no matter which endpoint is used (not
    // just /list). /change-password is the exception — it returns the
    // authoritative new-version token in its body, and the frontend ignores
    // this header on that path.
    const authedJson = (data, status = 200, extra = {}) =>
      json(data, status, { "X-Refresh-Token": freshToken, ...extra });

    // ===== CHANGE PASSWORD =====
    if (path === "/change-password" && method === "POST") {
      // Same per-IP throttle as /login, sharing the login_attempts table —
      // a valid JWT (e.g. stolen via a lost device) shouldn't grant unlimited
      // guesses at current_password.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return json({ error: "For mange forsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { current_password, new_password } = body;
      if (!new_password || new_password.length < 6) {
        return json({ error: "Nytt passord må være minst 6 tegn" }, 400);
      }
      const row = await env.DB.prepare(
        "SELECT pass_hash, token_version FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(current_password || "", row.pass_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        return json({ error: "Feil nåværende passord" }, 401);
      }
      const newHash = await hashPassword(new_password);
      const newVersion = row.token_version + 1;
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = ?2 WHERE username = ?3 COLLATE NOCASE"
      ).bind(newHash, newVersion, user.username).run();
      const tokenAfter = await mintToken({ ...user, token_version: newVersion }, env);
      return json({ ok: true, token: tokenAfter });
    }

    // ===== ACCOUNT (name/email; email doubles as username, see TODO #17) =====
    if (path === "/account" && method === "GET") {
      const row = await env.DB.prepare(
        "SELECT email, name FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      return authedJson({ email: row.email || null, name: row.name || user.username, username: user.username });
    }

    // Display name only — unlike email/password, this isn't security-sensitive
    // (not used to log in or recover the account), so no current_password
    // check is required.
    if (path === "/change-name" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedJson({ error: "Skriv inn et navn" }, 400);
      await env.DB.prepare("UPDATE users SET name = ?1 WHERE username = ?2 COLLATE NOCASE")
        .bind(cleanName, user.username).run();
      return authedJson({ ok: true, name: cleanName });
    }

    if (path === "/change-email" && method === "POST") {
      // Same per-IP throttle as /change-password, sharing login_attempts — a
      // stolen token shouldn't grant unlimited current_password guesses, and
      // email is what /forgot-password trusts to reset a password, so setting
      // it needs the same proof-of-password as changing the password itself.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return json({ error: "For mange forsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return json({ error: "Ugyldig e-post" }, 400);
      const row = await env.DB.prepare(
        "SELECT pass_hash FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(body.current_password || "", row.pass_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        return json({ error: "Feil passord" }, 401);
      }
      const clash = await env.DB.prepare(
        "SELECT 1 FROM users WHERE (email = ?1 COLLATE NOCASE OR username = ?1 COLLATE NOCASE) AND username != ?2 COLLATE NOCASE"
      ).bind(cleanEmail, user.username).first();
      if (clash) return json({ error: "E-posten er allerede i bruk av en annen konto" }, 409);
      // Username always mirrors email (see TODO #17) — renaming cascades into
      // every other table that stores it by value, so this isn't a plain
      // single-column UPDATE. The caller's current JWT becomes stale the
      // instant the rename lands (its `sub` is the old username), same as
      // /change-password's token_version bump — return a fresh token in the
      // body rather than relying on this request's X-Refresh-Token header,
      // which was minted from the pre-rename username and is unusable.
      if (cleanEmail !== user.username.toLowerCase()) {
        await renameUsername(env, user.username, cleanEmail);
      }
      const token = await mintToken({ ...user, username: cleanEmail }, env);
      return json({ ok: true, email: cleanEmail, username: cleanEmail, token });
    }

    // Self-service account deletion (phase 1 of TODO's account-lifecycle
    // item — still one list per user, so this only ever removes/replaces the
    // caller's own household, never leaves them list-less). A non-owner just
    // leaves; an owner who isn't the list's last owner does the same. The
    // list's last owner deleting their account cascade-deletes the entire
    // list (every other member included) rather than being refused like
    // DELETE /list-users and PATCH /flags do — there's no "reassign
    // ownership" flow yet, and blocking self-deletion entirely would leave
    // solo/last-owner accounts with no way to close their account at all.
    if (path === "/account" && method === "DELETE") {
      // Same per-IP throttle as /change-password and /change-email.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return json({ error: "For mange forsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const row = await env.DB.prepare(
        "SELECT pass_hash FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(body.current_password || "", row.pass_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        return json({ error: "Feil passord" }, 401);
      }

      // Superadmin accounts can never be self-deleted, full stop — no count
      // check, no override flag. Status comes solely from being named in
      // env.SUPERADMIN_USERNAMES (a Worker dashboard variable this code has
      // no way to edit), so deleting the row is one-way: the only path back
      // is a developer editing that variable by hand.
      if (isSuperAdmin(user.username, env)) {
        return json({ error: "Kan ikke slette en app-eier-konto" }, 400);
      }

      let listDeleted = false;
      if (user.is_owner) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(user.list_id).first();
        if (c.n <= 1) {
          listDeleted = true;
          // Children before parents — list_id/meal_id/catalogue_id FKs are
          // enforced (see DELETE /list/:id/catalogue's cascade comment) but
          // most of them aren't ON DELETE CASCADE from lists itself, so each
          // list-scoped table is cleared explicitly rather than relying on
          // cascade from a single `DELETE FROM lists`.
          await env.DB.batch([
            env.DB.prepare("DELETE FROM list_items WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM item_catalogue WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM meal_plan WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM meal_catalogue WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM recurring_schedule WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM users WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM lists WHERE id = ?1").bind(user.list_id),
          ]);
        }
      }
      if (!listDeleted) {
        // Deleting the row makes requireAuth's DB lookup fail (no row) on the
        // user's next request → 401 → re-login, so no token_version bump
        // needed — same reasoning as DELETE /list-users.
        await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
          .bind(user.username).run();
      }
      return json({ ok: true, list_deleted: listDeleted });
    }

    // ===== FEEDBACK =====
    // Emails env.FEEDBACK_EMAIL via the same Resend integration /forgot-password
    // uses — a Worker dashboard variable, set up manually post-deploy like
    // RESEND_API_KEY/TURNSTILE_SECRET_KEY (see CLAUDE.md), not committed. No
    // ticketing system needed for a 2-person app; this just closes the loop.
    if (path === "/feedback" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "feedback"))) {
        return authedJson({ error: "For mange tilbakemeldinger. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      // Recorded regardless of outcome below, same as /register and
      // /forgot-password — request volume is the abuse vector, not just
      // successful sends.
      await recordAttempt(env, ip, "feedback");
      const message = (body.message || "").trim();
      if (!message) return authedJson({ error: "Skriv en melding" }, 400);
      if (message.length > 4000) return authedJson({ error: "Meldingen er for lang" }, 400);
      if (!env.FEEDBACK_EMAIL) {
        return authedJson({ error: "Tilbakemelding er ikke satt opp ennå" }, 500);
      }
      // Sender identity survives even through Resend's shared "from" address:
      // the username is in the subject line (visible in an inbox list without
      // opening the email) and repeated in the body, and — when the sender
      // has an email on file — set as reply-to so replying goes straight to
      // them instead of the noreply@ address in "from".
      const acct = await env.DB.prepare(
        "SELECT email FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      const sent = await sendEmail(env, {
        to: env.FEEDBACK_EMAIL,
        replyTo: acct?.email || undefined,
        subject: `Tilbakemelding fra ${user.username}`,
        html: `<p><strong>${escapeHtml(user.username)}</strong> sendte en tilbakemelding fra Panhandle:</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
      });
      if (!sent) return authedJson({ error: "Kunne ikke sende tilbakemelding. Prøv igjen senere." }, 502);
      return authedJson({ ok: true });
    }

    // ===== ADMIN ENDPOINTS (require is_admin) =====
    // Create a new owner + their own list, seeded with COMMON_ITEMS.
    if (path === "/admin/owners" && method === "POST") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return authedJson({ error: "Ugyldig e-post" }, 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedJson({ error: "Skriv inn et navn" }, 400);
      const exists = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (exists) return authedJson({ error: "E-posten er allerede i bruk" }, 409);
      const password = genPassword();
      const hash = await hashPassword(password);
      const listId = await createList(env);
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 1, ?3, ?4, ?5, ?6)"
      ).bind(cleanEmail, hash, listId, user.username, cleanEmail, cleanName).run();
      return authedJson({ username: cleanEmail, password });
    }

    // Every user in the system (across all lists) with their flags.
    if (path === "/admin/users" && method === "GET") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const { results } = await env.DB.prepare(
        "SELECT username, name, is_admin, is_owner, list_id, created_by FROM users ORDER BY list_id, username"
      ).all();
      return authedJson(results);
    }

    // Reset any user's password (recovery path). Bumps token_version.
    const rpMatch = path.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
    if (rpMatch && method === "POST") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const target = decodeURIComponent(rpMatch[1]);
      const row = await env.DB.prepare(
        "SELECT username FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row) return authedJson({ error: "Fant ikke bruker" }, 404);
      const password = genPassword();
      const hash = await hashPassword(password);
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = token_version + 1 WHERE username = ?2 COLLATE NOCASE"
      ).bind(hash, row.username).run();
      return authedJson({ username: row.username, password });
    }

    // Set is_admin / is_owner flags independently. Bumps token_version.
    const flagMatch = path.match(/^\/admin\/users\/([^/]+)\/flags$/);
    if (flagMatch && method === "PATCH") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const target = decodeURIComponent(flagMatch[1]);
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const row = await env.DB.prepare(
        "SELECT username, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row) return authedJson({ error: "Fant ikke bruker" }, 404);
      let newAdmin = row.is_admin, newOwner = row.is_owner;
      if (body.is_admin !== undefined) newAdmin = body.is_admin ? 1 : 0;
      if (body.is_owner !== undefined) newOwner = body.is_owner ? 1 : 0;
      // Never let the last admin be demoted.
      if (row.is_admin === 1 && newAdmin === 0) {
        const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").first();
        if (c.n <= 1) return authedJson({ error: "Kan ikke fjerne siste admin" }, 400);
      }
      // Never let a list lose its only owner.
      if (row.is_owner === 1 && newOwner === 0) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(row.list_id).first();
        if (c.n <= 1) return authedJson({ error: "Listen ville miste sin eneste eier" }, 400);
      }
      await env.DB.prepare(
        "UPDATE users SET is_admin = ?1, is_owner = ?2, token_version = token_version + 1 WHERE username = ?3 COLLATE NOCASE"
      ).bind(newAdmin, newOwner, row.username).run();
      return authedJson({ ok: true, username: row.username, is_admin: newAdmin, is_owner: newOwner });
    }

    // Delete any user account outright — gated beyond ordinary is_admin by
    // isSuperAdmin (same double-gate as /admin/metrics), since this is a much
    // more consequential operation than the other admin endpoints, which only
    // ever demote/reset/remove-from-one-list rather than deleting a row.
    // Still refuses (doesn't cascade) if the target is the last admin —
    // there's no list to cascade into for that case, mirroring PATCH
    // .../flags's guard exactly, so the superadmin promotes someone else
    // first, same as any other admin already has to.
    // If the target is a list's last owner, deleting them would otherwise hit
    // the same "eneste eier" guard — but here (unlike PATCH .../flags and
    // DELETE /list-users, which only ever demote/remove-from-list) there's no
    // "leave the list ownerless" outcome to protect against: the caller can
    // choose to cascade-delete the entire list along with the user, same as
    // DELETE /account does for a self-deleting last owner. That's a much
    // bigger blast radius than an ordinary user deletion, so it's opt-in via
    // body.delete_list — the frontend shows an explicit extra warning first
    // and only then resends the request with that flag set.
    const adminDelMatch = path.match(/^\/admin\/users\/([^/]+)$/);
    if (adminDelMatch && method === "DELETE") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      if (!isSuperAdmin(user.username, env)) return authedJson({ error: "Kun tilgjengelig for app-eier" }, 403);
      const target = decodeURIComponent(adminDelMatch[1]);
      const body = await readJson(request);
      const row = await env.DB.prepare(
        "SELECT username, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row) return authedJson({ error: "Fant ikke bruker" }, 404);
      // Same unconditional guard as DELETE /account's self-delete path —
      // superadmins can't delete each other's accounts either, even here on
      // the superadmin-only force-delete endpoint. See that guard's comment.
      if (isSuperAdmin(row.username, env)) {
        return authedJson({ error: "Kan ikke slette en app-eier-konto" }, 400);
      }
      if (row.is_admin === 1) {
        const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").first();
        if (c.n <= 1) return authedJson({ error: "Kan ikke slette siste admin" }, 400);
      }
      let listDeleted = false;
      if (row.is_owner === 1) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(row.list_id).first();
        if (c.n <= 1) {
          if (!body?.delete_list) return authedJson({ error: "Listen ville miste sin eneste eier" }, 400);
          listDeleted = true;
          // Children before parents — same cascade as DELETE /account's
          // last-owner self-deletion path (see its comment for why each
          // list-scoped table is cleared explicitly rather than relying on
          // an ON DELETE CASCADE from `lists` itself).
          await env.DB.batch([
            env.DB.prepare("DELETE FROM list_items WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM item_catalogue WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM meal_plan WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM meal_catalogue WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM recurring_schedule WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM users WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM lists WHERE id = ?1").bind(row.list_id),
          ]);
        }
      }
      if (!listDeleted) {
        await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
          .bind(row.username).run();
      }
      return authedJson({ ok: true, list_deleted: listDeleted });
    }

    // Site-wide usage metrics, across all lists (not just the caller's own).
    // Gated beyond is_admin by isSuperAdmin — see its definition above.
    if (path === "/admin/metrics" && method === "GET") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      if (!isSuperAdmin(user.username, env)) return authedJson({ error: "Kun tilgjengelig for app-eier" }, 403);

      const [
        listCount, userCount, roleCounts,
        signupsByWeek, listsByWeek,
        itemStats, itemsByWeek, topItems,
        mealPlanFill, topMeals,
        perList, recentFailedLogins,
      ] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM lists").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM users").first(),
        env.DB.prepare(
          "SELECT SUM(is_admin) AS admins, SUM(is_owner) AS owners FROM users"
        ).first(),
        env.DB.prepare(
          "SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM users GROUP BY week ORDER BY week"
        ).all(),
        env.DB.prepare(
          "SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM lists GROUP BY week ORDER BY week"
        ).all(),
        env.DB.prepare(
          "SELECT COUNT(*) AS total, SUM(bought) AS bought FROM list_items"
        ).first(),
        env.DB.prepare(
          "SELECT strftime('%Y-%W', added_at) AS week, COUNT(*) AS n FROM list_items GROUP BY week ORDER BY week"
        ).all(),
        env.DB.prepare(
          "SELECT name, SUM(times_bought) AS n FROM item_catalogue GROUP BY name ORDER BY n DESC LIMIT 10"
        ).all(),
        env.DB.prepare(
          "SELECT COUNT(*) AS total, SUM(CASE WHEN meal_id IS NOT NULL THEN 1 ELSE 0 END) AS filled FROM meal_plan"
        ).first(),
        env.DB.prepare(
          "SELECT name, SUM(times_planned) AS n FROM meal_catalogue GROUP BY name ORDER BY n DESC LIMIT 10"
        ).all(),
        env.DB.prepare(`
          SELECT l.id AS list_id,
                 (SELECT COUNT(*) FROM users u WHERE u.list_id = l.id) AS users,
                 (SELECT COUNT(*) FROM item_catalogue c WHERE c.list_id = l.id) AS items,
                 (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id AND li.bought = 1) AS bought
          FROM lists l ORDER BY l.id
        `).all(),
        env.DB.prepare(
          "SELECT COUNT(*) AS n FROM login_attempts WHERE created_at >= ?1"
        ).bind(Date.now() - 24 * 60 * 60 * 1000).first(),
      ]);

      return authedJson({
        overview: {
          lists: listCount.n, users: userCount.n,
          admins: roleCounts.admins || 0, owners: roleCounts.owners || 0,
        },
        signups_by_week: signupsByWeek.results,
        lists_by_week: listsByWeek.results,
        shopping: {
          total_items: itemStats.total || 0, bought_items: itemStats.bought || 0,
          items_by_week: itemsByWeek.results, top_items: topItems.results,
        },
        meals: {
          plan_total: mealPlanFill.total || 0, plan_filled: mealPlanFill.filled || 0,
          top_meals: topMeals.results,
        },
        per_list: perList.results,
        failed_logins_24h: recentFailedLogins.n,
      });
    }

    // ===== LIST-USER ENDPOINTS =====
    // Members of the caller's own list. Readable by any authed user on the
    // list (used to populate the meal-responsible dropdown).
    if (path === "/list-users" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT username, name, is_admin, is_owner FROM users WHERE list_id = ?1 ORDER BY username"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Add a plain member to the caller's list (owner only). Capped at 10.
    if (path === "/list-users" && method === "POST") {
      if (!user.is_owner) return authedJson({ error: "Krever eier" }, 403);
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return authedJson({ error: "Ugyldig e-post" }, 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedJson({ error: "Skriv inn et navn" }, 400);
      const c = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE list_id = ?1"
      ).bind(user.list_id).first();
      if (c.n >= 10) return authedJson({ error: "Listen er full (maks 10 brukere)" }, 400);
      const exists = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (exists) return authedJson({ error: "E-posten er allerede i bruk" }, 409);
      const password = genPassword();
      const hash = await hashPassword(password);
      // is_admin/is_owner are hardcoded 0 — never taken from the request body,
      // so an owner can't self-escalate a member into an admin/owner.
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 0, ?3, ?4, ?5, ?6)"
      ).bind(cleanEmail, hash, user.list_id, user.username, cleanEmail, cleanName).run();
      return authedJson({ username: cleanEmail, password });
    }

    // Remove a member from the caller's list (owner only).
    const luDelMatch = path.match(/^\/list-users\/([^/]+)$/);
    if (luDelMatch && method === "DELETE") {
      if (!user.is_owner) return authedJson({ error: "Krever eier" }, 403);
      const target = decodeURIComponent(luDelMatch[1]);
      const row = await env.DB.prepare(
        "SELECT username, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row || row.list_id !== user.list_id) {
        return authedJson({ error: "Fant ikke bruker på listen" }, 404);
      }
      if (row.is_owner === 1) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(user.list_id).first();
        if (c.n <= 1) return authedJson({ error: "Kan ikke fjerne listens eneste eier" }, 400);
      }
      // Deleting the row makes requireAuth's DB lookup fail (no row) on the
      // user's next request → 401 → re-login, so no token_version bump needed.
      await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
        .bind(row.username).run();
      return authedJson({ ok: true });
    }

    // ===== SHOPPING LIST (all queries scoped to user.list_id) =====
    if (path === "/list" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT li.id, li.bought, li.added_by, li.added_at, li.bought_at, li.qty, li.notes, c.name, c.category
        FROM list_items li
        JOIN item_catalogue c ON c.id = li.catalogue_id
        WHERE li.list_id = ?1
        ORDER BY li.bought ASC, c.category ASC, c.name ASC
      `).bind(user.list_id).all();
      return authedJson(results);
    }

    if (path === "/list" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { name, category, notes, qty } = body;
      const { name: stripped, gf } = extractGlutenFree(name);
      const clean = capitalizeName(stripped);
      if (!clean) return authedJson({ error: "Tomt navn" }, 400);
      const addQty = Math.max(1, parseInt(qty, 10) || 1);
      // A gluten-free marker pulled out of the name is recorded as a "Glutenfri"
      // note (regardless of how it was typed — "gf", "GF", "glutenfri"), without
      // duplicating one the caller already passed, so the gluten-free variant is
      // tracked as a note rather than a separate catalogue name.
      let noteVal = (notes || "").trim();
      if (gf && !/\b(gf|glutenfri|glutenfritt)\b/i.test(noteVal)) {
        noteVal = noteVal ? `${noteVal} Glutenfri` : "Glutenfri";
      }
      noteVal = noteVal || null;
      let cat = await env.DB.prepare(
        "SELECT id, category FROM item_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (!cat) {
        const chosenCat = CATEGORIES.includes(category) ? category : "Annet";
        // Upsert so two concurrent adds of a new name can't collide on the
        // UNIQUE(list_id, name) constraint — the loser gets the existing row.
        cat = await env.DB.prepare(`
          INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)
          ON CONFLICT(list_id, name) DO UPDATE SET name = name
          RETURNING id, category
        `).bind(clean, chosenCat, user.list_id).first();
      }
      // Merge only into an unbought line whose notes match, so e.g. a plain
      // "Pasta" and a "Pasta" + "GF" note coexist as two separate lines instead
      // of one bumping the other's quantity.
      const existing = await env.DB.prepare(
        "SELECT id FROM list_items WHERE catalogue_id = ?1 AND bought = 0 AND list_id = ?2 AND IFNULL(notes, '') = IFNULL(?3, '')"
      ).bind(cat.id, user.list_id, noteVal).first();
      if (existing) {
        const updated = await env.DB.prepare(
          "UPDATE list_items SET qty = qty + ?2 WHERE id = ?1 RETURNING qty"
        ).bind(existing.id, addQty).first();
        return authedJson({ ok: true, duplicate: true, qty: updated.qty });
      }
      await env.DB.prepare(
        "INSERT INTO list_items (catalogue_id, added_by, notes, qty, list_id) VALUES (?1, ?2, ?3, ?4, ?5)"
      ).bind(cat.id, user.username, noteVal, addQty, user.list_id).run();
      return authedJson({ ok: true, qty: addQty });
    }

    const patchMatch = path.match(/^\/list\/(\d+)$/);
    if (patchMatch && method === "PATCH") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { qty, notes, category, name } = body;
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(patchMatch[1], user.list_id).first();
      if (!row) return authedJson({ error: "Fant ikke vare" }, 404);
      if (qty !== undefined) {
        const cleanQty = Math.max(1, parseInt(qty, 10) || 1);
        await env.DB.prepare("UPDATE list_items SET qty = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(cleanQty, patchMatch[1], user.list_id).run();
      }
      if (notes !== undefined) {
        await env.DB.prepare("UPDATE list_items SET notes = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind((notes || "").trim() || null, patchMatch[1], user.list_id).run();
      }
      if (category !== undefined && CATEGORIES.includes(category)) {
        await env.DB.prepare("UPDATE item_catalogue SET category = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(category, row.catalogue_id, user.list_id).run();
      }
      if (name !== undefined) {
        const cleanName = capitalizeName(name);
        if (!cleanName) return authedJson({ error: "Tomt navn" }, 400);
        const clash = await env.DB.prepare(
          "SELECT id FROM item_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2 AND id != ?3"
        ).bind(cleanName, user.list_id, row.catalogue_id).first();
        if (clash) return authedJson({ error: "En vare med dette navnet finnes allerede" }, 400);
        await env.DB.prepare("UPDATE item_catalogue SET name = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(cleanName, row.catalogue_id, user.list_id).run();
      }
      return authedJson({ ok: true });
    }

    // Deletes the catalogue entry entirely (not just this list_items row) —
    // cascades to every list_items row referencing it via the FK, removing the
    // item from past/present lists, not just hiding this one occurrence.
    const delCatMatch = path.match(/^\/list\/(\d+)\/catalogue$/);
    if (delCatMatch && method === "DELETE") {
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(delCatMatch[1], user.list_id).first();
      if (!row) return authedJson({ error: "Fant ikke vare" }, 404);
      await env.DB.prepare("DELETE FROM item_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(row.catalogue_id, user.list_id).run();
      return authedJson({ ok: true });
    }

    const toggleMatch = path.match(/^\/list\/(\d+)\/toggle$/);
    if (toggleMatch && method === "POST") {
      const item = await env.DB.prepare(
        "SELECT bought, catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(toggleMatch[1], user.list_id).first();
      await env.DB.prepare(`
        UPDATE list_items SET bought = CASE bought WHEN 0 THEN 1 ELSE 0 END,
            bought_at = CASE bought WHEN 0 THEN datetime('now') ELSE NULL END
        WHERE id = ?1 AND list_id = ?2
      `).bind(toggleMatch[1], user.list_id).run();
      // Only count it as a purchase on the 0->1 transition, not on undo —
      // these lifetime stats power GET /catalogue/suggestions below.
      if (item && item.bought === 0) {
        await env.DB.prepare(`
          UPDATE item_catalogue SET
            times_bought = times_bought + 1,
            first_bought = COALESCE(first_bought, datetime('now')),
            last_bought = datetime('now')
          WHERE id = ?1
        `).bind(item.catalogue_id).run();
      }
      return authedJson({ ok: true });
    }

    const delMatch = path.match(/^\/list\/(\d+)$/);
    if (delMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM list_items WHERE id = ?1 AND list_id = ?2")
        .bind(delMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/catalogue" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT name, category FROM item_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Items worth nudging the user about: bought often enough (>=2 times) to
    // have a reliable average gap between purchases, not already sitting
    // unbought on the list, and at least that average gap overdue. Lifetime
    // stats live on item_catalogue (see 0005_item_purchase_stats.sql) since
    // list_items loses bought_at the moment an item is toggled back off.
    if (path === "/catalogue/suggestions" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT c.id, c.name, c.category, c.last_bought,
          (julianday(c.last_bought) - julianday(c.first_bought)) / (c.times_bought - 1) AS avg_interval_days,
          julianday('now') - julianday(c.last_bought) AS days_since
        FROM item_catalogue c
        WHERE c.list_id = ?1
          AND c.times_bought >= 2
          AND NOT EXISTS (SELECT 1 FROM list_items li WHERE li.catalogue_id = c.id AND li.bought = 0)
          AND (julianday('now') - julianday(c.last_bought)) >=
              (julianday(c.last_bought) - julianday(c.first_bought)) / (c.times_bought - 1)
        ORDER BY (days_since - avg_interval_days) DESC
        LIMIT 8
      `).bind(user.list_id).all();
      return authedJson(results);
    }

    // ===== MEALS =====
    if (path === "/meals" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, ingredients, labels, times_planned, last_planned FROM meal_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Meals worth suggesting when planning a day: ones eaten often but not
    // recently (a 10-day cooldown), ranked by frequency first and staleness
    // second. Lifetime stats live on meal_catalogue (see 0004_meal_usage_stats.sql)
    // since meal_plan itself is pruned after 14 days.
    if (path === "/meals/suggestions" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT id, name, ingredients, labels, times_planned, last_planned
        FROM meal_catalogue
        WHERE list_id = ?1
          AND (last_planned IS NULL OR last_planned <= date('now', '-10 days'))
        ORDER BY times_planned DESC, last_planned ASC
        LIMIT 5
      `).bind(user.list_id).all();
      return authedJson(results);
    }

    // Adds a brand-new meal to the catalogue directly (no day assignment) —
    // the editor view's "+ Nytt måltid", as opposed to /plan's implicit
    // create-on-first-use. Rejects a name that already exists so the editor
    // doesn't silently merge into an existing meal's row.
    if (path === "/meals" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const clean = capitalizeName(body.name);
      if (!clean) return authedJson({ error: "Tomt navn" }, 400);
      const ingredientsJson = JSON.stringify(Array.isArray(body.ingredients) ? body.ingredients : []);
      const labelsJson = JSON.stringify(sanitizeLabels(body.labels));
      const clash = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (clash) return authedJson({ error: "Et måltid med dette navnet finnes allerede" }, 400);
      const meal = await env.DB.prepare(
        "INSERT INTO meal_catalogue (name, list_id, ingredients, labels) VALUES (?1, ?2, ?3, ?4) RETURNING id"
      ).bind(clean, user.list_id, ingredientsJson, labelsJson).first();
      return authedJson({ ok: true, id: meal.id });
    }

    const mealPatchMatch = path.match(/^\/meals\/(\d+)$/);
    if (mealPatchMatch && method === "PATCH") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const meal = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE id = ?1 AND list_id = ?2"
      ).bind(mealPatchMatch[1], user.list_id).first();
      if (!meal) return authedJson({ error: "Fant ikke måltid" }, 404);
      if (body.name !== undefined) {
        const clean = capitalizeName(body.name);
        if (!clean) return authedJson({ error: "Tomt navn" }, 400);
        const clash = await env.DB.prepare(
          "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2 AND id != ?3"
        ).bind(clean, user.list_id, meal.id).first();
        if (clash) return authedJson({ error: "Et måltid med dette navnet finnes allerede" }, 400);
        await env.DB.prepare("UPDATE meal_catalogue SET name = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(clean, meal.id, user.list_id).run();
      }
      if (body.ingredients !== undefined) {
        const ingredientsJson = JSON.stringify(Array.isArray(body.ingredients) ? body.ingredients : []);
        await env.DB.prepare("UPDATE meal_catalogue SET ingredients = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(ingredientsJson, meal.id, user.list_id).run();
      }
      if (body.labels !== undefined) {
        const labelsJson = JSON.stringify(sanitizeLabels(body.labels));
        await env.DB.prepare("UPDATE meal_catalogue SET labels = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(labelsJson, meal.id, user.list_id).run();
      }
      return authedJson({ ok: true });
    }

    // Deletes the meal entirely from the catalogue. meal_plan.meal_id is
    // ON DELETE SET NULL (see migrations/0009_meal_plan_set_null.sql), so any
    // day currently assigned this meal reverts to unplanned but keeps its
    // plan_date/responsible — unlike item_catalogue's cascade delete, this
    // doesn't drop the row itself.
    const mealDelMatch = path.match(/^\/meals\/(\d+)$/);
    if (mealDelMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM meal_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(mealDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/plan" && method === "GET") {
      // The frontend only ever navigates to last/this/next week (at most 13
      // days before today), so there's no value in keeping plan rows beyond
      // that — opportunistically drop anything older on every read. The
      // 14-day cutoff (vs. 13) is a safety margin against clock/timezone
      // skew between the server's `now` and a client's local "today".
      await env.DB.prepare(
        "DELETE FROM meal_plan WHERE list_id = ?1 AND plan_date < date('now', '-14 days')"
      ).bind(user.list_id).run();
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = `SELECT p.id, p.plan_date, p.responsible, m.name AS meal_name, m.id AS meal_id,
        m.ingredients AS ingredients, m.labels AS labels
        FROM meal_plan p LEFT JOIN meal_catalogue m ON m.id = p.meal_id
        WHERE p.list_id = ?1`;
      const binds = [user.list_id];
      if (from && to) { q += " AND p.plan_date BETWEEN ?2 AND ?3"; binds.push(from, to); }
      q += " ORDER BY p.plan_date ASC";
      const { results } = await env.DB.prepare(q).bind(...binds).all();
      return authedJson(results);
    }

    if (path === "/plan" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { plan_date, meal_name, responsible, ingredients } = body;
      if (!plan_date || !/^\d{4}-\d{2}-\d{2}$/.test(plan_date)) {
        return authedJson({ error: "Ugyldig dato" }, 400);
      }
      // Require at least one of meal_name or responsible to be set.
      if (!meal_name && !responsible) return authedJson({ error: "Mangler måltid eller ansvarlig" }, 400);

      let mealId = null;
      if (meal_name) {
        // Capitalise new meal names the same way item names are (capitalizeName),
        // so a meal typed in the planner is stored "Taco", not "taco". Lookups are
        // COLLATE NOCASE, so this only affects how a genuinely new name is stored.
        const clean = capitalizeName(meal_name);
        // ingredients is a JSON-encoded array, stored once per meal name in
        // meal_catalogue and shared across every occurrence of that meal —
        // undefined means "leave whatever's stored alone".
        const ingredientsJson = Array.isArray(ingredients) ? JSON.stringify(ingredients) : undefined;
        let meal = await env.DB.prepare(
          "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
        ).bind(clean, user.list_id).first();
        if (!meal) {
          // Upsert to avoid a UNIQUE(list_id, name) collision on concurrent first use.
          meal = await env.DB.prepare(`
            INSERT INTO meal_catalogue (name, list_id, ingredients) VALUES (?1, ?2, ?3)
            ON CONFLICT(list_id, name) DO UPDATE SET name = name
            RETURNING id
          `).bind(clean, user.list_id, ingredientsJson ?? "[]").first();
        } else if (ingredientsJson !== undefined) {
          await env.DB.prepare("UPDATE meal_catalogue SET ingredients = ?1 WHERE id = ?2")
            .bind(ingredientsJson, meal.id).run();
        }
        mealId = meal.id;
      }

      // Only bump usage stats when this date's meal is actually new/changed —
      // re-saving the same date with the same meal (e.g. just changing who's
      // responsible) shouldn't inflate times_planned.
      const prevPlan = await env.DB.prepare(
        "SELECT meal_id FROM meal_plan WHERE list_id = ?1 AND plan_date = ?2"
      ).bind(user.list_id, plan_date).first();
      await env.DB.prepare(`
        INSERT INTO meal_plan (plan_date, meal_id, responsible, list_id)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(list_id, plan_date) DO UPDATE SET
          meal_id = excluded.meal_id,
          responsible = excluded.responsible,
          updated_at = datetime('now')
      `).bind(plan_date, mealId, responsible || "", user.list_id).run();
      if (mealId !== null && (!prevPlan || prevPlan.meal_id !== mealId)) {
        await env.DB.prepare(`
          UPDATE meal_catalogue
          SET times_planned = times_planned + 1,
              last_planned = CASE WHEN last_planned IS NULL OR last_planned < ?1 THEN ?1 ELSE last_planned END
          WHERE id = ?2
        `).bind(plan_date, mealId).run();
      }
      return authedJson({ ok: true });
    }

    const planDelMatch = path.match(/^\/plan\/(\d{4}-\d{2}-\d{2})$/);
    if (planDelMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM meal_plan WHERE plan_date = ?1 AND list_id = ?2")
        .bind(planDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/recurring" && method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT day_of_week, responsible FROM recurring_schedule WHERE list_id = ?1 ORDER BY day_of_week"
      ).bind(user.list_id).all();
      return authedJson(rows.results);
    }

    if (path === "/recurring" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { day_of_week, responsible } = body;
      if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6)
        return authedJson({ error: "Ugyldig dag" }, 400);
      try {
        if (!responsible) {
          await env.DB.prepare(
            "DELETE FROM recurring_schedule WHERE list_id = ?1 AND day_of_week = ?2"
          ).bind(user.list_id, day_of_week).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO recurring_schedule (list_id, day_of_week, responsible)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(list_id, day_of_week) DO UPDATE SET responsible = excluded.responsible
          `).bind(user.list_id, day_of_week, responsible).run();
        }
      } catch (e) {
        return authedJson({ error: "DB-feil: " + (e?.message ?? String(e)) }, 500);
      }
      return authedJson({ ok: true });
    }

    return authedJson({ error: "Not found" }, 404);
  }
};
