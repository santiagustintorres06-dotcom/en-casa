import { normalizeProductName, productCatalog } from "./productCatalog.ts";
import type { ProductInput } from "../types/product.ts";
export type ProductSuggestion = Pick<
  ProductInput,
  "name" | "category" | "unit"
>;
const aliases: Record<string, string[]> = {
  "pasta-dental": ["dentífrico", "dentrifico", "pasta de dientes"],
  shampoo: ["champú"],
  "papel-higienico": ["papel de baño"],
  arvejas: ["arveja", "arvejas en lata"],
  atun: ["atún en lata"],
  "choclo-en-lata": ["choclo", "choclos", "maíz en lata", "maíz dulce"],
  "choclo-fresco": ["choclos frescos"],
  "choclo-congelado": ["choclos congelados"],
  maicena: ["fécula de maíz", "almidón de maíz"],
  ketchup: ["ketchup"],
  "queso-mozzarella": ["muzzarella", "muzarela"],
  morron: ["pimiento"],
  "rollo-de-cocina": ["papel de cocina", "rollos de cocina"],
};
export function productSuggestions(query: string): ProductSuggestion[] {
  const needle = normalizeProductName(query);
  if (!needle) return [];
  return productCatalog
    .map((p) => ({
      p,
      terms: [p.name, ...(aliases[p.key] ?? [])].map(normalizeProductName),
    }))
    .filter(({ terms }) => terms.some((term) => term.includes(needle)))
    .sort(
      (a, b) =>
        Number(b.terms.includes(needle)) - Number(a.terms.includes(needle)) ||
        Number(b.terms.some((t) => t.startsWith(needle))) -
          Number(a.terms.some((t) => t.startsWith(needle))) ||
        (a.terms.find((t) => t.startsWith(needle)) ?? a.p.name).localeCompare(
          b.terms.find((t) => t.startsWith(needle)) ?? b.p.name,
          "es",
        ),
    )
    .slice(0, 6)
    .map(({ p }) => ({
      name:
        p.key === "pasta-dental" &&
        normalizeProductName("dentifrico").startsWith(needle)
          ? "Dentífrico"
          : p.name,
      category: p.category,
      unit: p.unit,
    }));
}
