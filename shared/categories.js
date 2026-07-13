// Single source of truth for shopping-list categories. Imported by both the
// Worker (server-side validation/default, worker/index.js) and the frontend
// (display grouping, src/lib/shoppingUtils.js) so they can't drift.
export const CATEGORIES = [
  "Frukt og grønt", "Brød og bakevarer", "Meieriprodukter", "Kjøtt og fisk",
  "Ingredienser og krydder", "Frysevarer og ferdigmåltid", "Kornprodukter",
  "Snacks og godteri", "Drikkevarer", "Husholdning", "Omsorg og helse",
  "Dyreprodukter", "Annet"
];
