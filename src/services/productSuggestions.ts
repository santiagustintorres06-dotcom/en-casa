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
        Number(b.terms.some((t) => t.startsWith(needle))) -
          Number(a.terms.some((t) => t.startsWith(needle))) ||
        a.p.name.localeCompare(b.p.name, "es"),
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
