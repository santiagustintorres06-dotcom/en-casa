import { categories, units, type ProductInput } from "../types/product.ts";
export const isLowStock = (
  p: Pick<ProductInput, "quantity" | "minimumStock">,
) => p.quantity <= p.minimumStock;
export function validateProduct(p: ProductInput): string | null {
  if (!p.name.trim() || p.name.trim().length > 80)
    return "Escribí un nombre de hasta 80 caracteres.";
  if (!categories.includes(p.category) || !units.includes(p.unit))
    return "Revisá la categoría y la unidad.";
  if (
    ![p.quantity, p.minimumStock].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100000,
    )
  )
    return "Las cantidades deben estar entre 0 y 100.000.";
  return null;
}
